---
description: Hoàn tác toàn bộ về version trước khi thêm tính năng Thi Thử
---

# ⚠️ Checkpoint: Trước khi thêm tính năng Thi Thử

## Thông tin checkpoint

- **Thời điểm tạo:** 2026-02-25 18:19 (GMT+7)
- **Git tag:** `v-before-exam-feature`
- **Commit hash:** `78a2357`
- **Commit message:** `feat: update answer panel tip to mention đúng/sai`
- **Tag đã push lên GitHub:** ✅ (https://github.com/hoaihuy2609/kholuutru)

## Trạng thái web tại checkpoint này

Web đang hoạt động bình thường với đầy đủ tính năng:
- Xem bài giảng theo lớp/chương/bài
- Upload và xem PDF tài liệu  
- Sync dữ liệu lên/xuống Telegram
- Admin Dashboard và quản lý học sinh
- Phiếu trả lời ABCD đơn giản (gắn với PDF viewer trong ChapterView/LessonView)
- Tiến độ học bài (done/none) và ghi chú

**CHƯA có:** Tính năng Thi Thử (ExamManager, ExamView, ExamResult)

---

## Cách hoàn tác

### Trường hợp 1: Chỉ thay đổi local, chưa push lên GitHub

```bash
git reset --hard v-before-exam-feature
```

### Trường hợp 2: Đã push lên GitHub, cần đưa cả remote về

// turbo
```bash
git reset --hard v-before-exam-feature
```

Sau đó force push:
// turbo
```bash
git push origin main --force
```

### Trường hợp 3: Kiểm tra xem đang ở đâu so với checkpoint

// turbo
```bash
git log --oneline v-before-exam-feature..HEAD
```

Nếu output rỗng = đang ĐÚng tại checkpoint. Nếu có dòng = đã có commit mới sau checkpoint.

---

## Sau khi hoàn tác

Vercel sẽ tự deploy lại khi nhận push mới. Nếu cần deploy thủ công:
1. Vào https://vercel.com/dashboard
2. Tìm project `kholuutru`
3. Bấm "Redeploy" trên deployment mới nhất
