# Tài liệu Kỹ thuật: Hệ thống Đóng & Khóa Đề thi (Scheduled Exam Closing)

Tài liệu này ghi chép lại toàn bộ logic, cấu trúc dữ liệu và các khối code quan trọng đã triển khai ngày 30/03/2026. Đây là cơ sở để triển khai lại tính năng một cách chặt chẽ hơn.

---

## 1. Cấu trúc Dữ liệu (Schema)

### Frontend: `types.ts`
Thêm trường `closedAt` (kiểu số, UTC milliseconds) vào interface `Exam`.
```typescript
interface Exam {
  // ... các trường cũ
  closedAt?: number; // Thời điểm đóng đề hoàn toàn (mili giây)
}
```

### Backend: Supabase (`supabase_all_setup.sql`)
Cần một bảng để lưu metadata vì Supabase không đọc được file JSON từ Telegram.
```sql
-- Bảng metadata đề thi
CREATE TABLE IF NOT EXISTS exams (
  id          TEXT PRIMARY KEY,
  closed_at   TIMESTAMPTZ,
  duration    INT NOT NULL DEFAULT 50
);

-- Hàm đồng bộ metadata từ Admin
CREATE OR REPLACE FUNCTION admin_upsert_exam_metadata(p_id TEXT, p_closed_at TIMESTAMPTZ, p_duration INT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO exams (id, closed_at, duration)
  VALUES (p_id, p_closed_at, p_duration)
  ON CONFLICT (id) DO UPDATE SET closed_at = EXCLUDED.closed_at, duration = EXCLUDED.duration;
END;
$$;
```

---

## 2. Logic Kiểm tra tại Backend (RPC)

Cập nhật hàm `submit_exam_result` để làm "cửa chặn cuối" chống gian lận.
```sql
CREATE OR REPLACE FUNCTION submit_exam_result(
  -- ... các tham số cũ
  p_time_taken INT DEFAULT 0 -- Thời gian làm bài thực tế (giây)
) RETURNS void AS $$
DECLARE v_exam RECORD;
BEGIN
  SELECT closed_at, duration INTO v_exam FROM exams WHERE id = p_exam_id;
  
  -- Check 1: Chặn nếu đã quá giờ đóng chung (ân huệ 60s)
  IF v_exam.closed_at IS NOT NULL AND now() > v_exam.closed_at + interval '60 seconds' THEN
    RAISE EXCEPTION 'EXAM_CLOSED';
  END IF;

  -- Check 2: Chặn nếu làm bài quá thời gian quy định (ân huệ 60s)
  IF p_time_taken > v_exam.duration * 60 + 60 THEN
    RAISE EXCEPTION 'TIME_LIMIT_EXCEEDED';
  END IF;

  -- ... INSERT dữ liệu vào exam_results
END;
$$;
```

---

## 3. Quản lý Admin (`ExamManager.tsx`)

Thêm ô nhập giờ đóng và logic đồng bộ dữ liệu.
```tsx
// 1. State lưu giờ đóng
const [closedAt, setClosedAt] = useState<string>('');

// 2. Validation khi Lưu đề
if (closedAt) {
  const closedTs = new Date(closedAt).getTime();
  if (closedTs <= scheduledAt + durationMinutes * 60000) {
    alert("Giờ đóng đề phải sau khi kết thúc thời gian làm bài dự kiến!");
    return;
  }
}

// 3. Cảnh báo khi rút ngắn thời gian đề đang diễn ra
if (isBeingShortened) {
  const ok = window.confirm("⚠️ Có học sinh đang thi. Rút ngắn giờ đóng sẽ buộc họ nộp bài sớm. Xác nhận?");
  if (!ok) return;
}
```

---

## 4. Trải nghiệm Học sinh (`ExamListPage.tsx`)

Tính toán trạng thái `CLOSED` dựa trên `isDone`.
```tsx
// Logic xác định trạng thái đề
let status = 'OPEN';
if (exam.closedAt && now > exam.closedAt && !isAdmin && !isDone) {
    status = 'CLOSED'; // Chỉ khóa đối với người CHƯA làm bài
}

// Hiển thị nút tương ứng
{status === 'CLOSED' ? (
    <button disabled className="bg-gray-100 text-gray-400">
        <Lock className="w-4 h-4" /> <span>Đã khóa</span>
    </button>
) : (
    // Hiện nút "Làm bài" hoặc "Xem kết quả" như cũ
)}
```

---

## 5. Phòng thi Thông minh (`ExamView.tsx`)

Đây là phần phức tạp nhất, xử lý thời gian thực.

### Đồng hồ Giới hạn kép (Double Deadline)
Tính toán `msLeft` (thời gian còn lại) dựa trên cả thời gian cá nhân và giờ đóng chung.
```tsx
const calculateMsLeft = () => {
    const sTime = startTime.current;
    const now = getSecureTime();
    
    // 1. Thời gian cá nhân (ms)
    const personalDeadline = sTime + (exam.duration * 60 * 1000);
    // 2. Giờ đóng chung của hệ thống (ms)
    const globalDeadline = exam.closedAt || Infinity;
    
    // Lấy deadline nào đến sớm hơn
    const finalDeadline = Math.min(personalDeadline, globalDeadline);
    return Math.max(0, finalDeadline - now);
};
```

### Cơ chế Tự động nộp bài (Visibility Change)
Phòng chống việc học sinh tắt màn hình hoặc để tab "ngủ" để gian lận thời gian.
```tsx
useEffect(() => {
    const handleVisibility = () => {
        if (document.visibilityState === 'visible') {
            // Khi quay lại tab, tính toán lại thời gian ngay
            const left = calculateMsLeft();
            if (left <= 0) handleAutoSubmit(); // Nếu đã hết giờ trong lúc vắng mặt -> Nộp ngay
        }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
}, []);
```

### Banner Cảnh báo Khẩn cấp
```tsx
{msUntilGlobalClose <= 300000 && ( // Nếu còn dưới 5 phút đến giờ đóng chung
    <div className="bg-red-600 text-white animate-pulse p-2 text-center text-xs font-bold">
        ⚠️ HỆ THỐNG SẮP ĐÓNG ĐỀ CHUNG TRONG {Math.floor(msUntilGlobalClose/60000)} PHÚT. HÃY NỘP BÀI NGAY!
    </div>
)}
```

---

## 6. Tổng kết Quy trình Lưu & Đồng bộ (`examService.ts`)

Mỗi khi Admin lưu danh sách đề, phải thực hiện upsert metadata lên Supabase.
```typescript
export const saveExam = async (exams: Exam[]) => {
    // ... logic lưu file lên Telegram như cũ
    
    // Động tác mới: Đồng bộ Metadata lên Supabase cho Backend check
    for (const exam of exams) {
        await supabase.rpc('admin_upsert_exam_metadata', {
            p_id: exam.id,
            p_closed_at: exam.closedAt ? new Date(exam.closedAt).toISOString() : null,
            p_duration: exam.duration
        });
    }
};
```

**Ghi chú cuối:** 
Phiên bản này đã giải quyết được việc khóa đề nhưng vẫn cho xem lại điểm. Các điểm yếu hiện tại cần củng cố ở phiên làm việc sau: 
1. Cơ chế đồng bộ Metadata cần hiệu quả hơn (tránh lặp trong vòng for).
2. UI Admin cần trực quan hơn khi chọn ngày giờ.
