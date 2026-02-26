# Kế hoạch chuyển đổi hệ thống: GAS sang Supabase

Tài liệu này tóm tắt toàn bộ cuộc thảo luận về việc thay thế Google Apps Script (GAS) bằng Supabase cho dự án PhysiVault. Mục tiêu là giúp AI tiếp nhận công việc có thể bắt đầu ngay mà không cần hỏi lại từ đầu.

## 1. Bối cảnh hiện tại
- **Hạ tầng:** App đang dùng GAS để quản lý học sinh (Activation) và Index file. Dữ liệu lưu tại Google Sheets.
- **Lưu trữ:** Dùng Telegram làm kho chứa file PDF (đúng ý Admin: sẽ giữ nguyên phần này).
- **Cơ chế bảo mật:** Dùng `machineId` kết hợp SĐT để tạo `Mã PV`.

## 2. Mục tiêu chuyển đổi
- **Thay "Ruột" giữ "Vỏ":** Giữ nguyên giao diện và nguyên lý hoạt động của App. Chỉ thay thế các hàm gọi đến Google Script bằng các hàm gọi đến Supabase.
- **Tốc độ:** Tăng tốc độ kích hoạt và đồng bộ dữ liệu (từ vài giây xuống < 1 giây).
- **Bảo mật:** Sử dụng **RLS (Row Level Security)** của Supabase để bảo vệ dữ liệu ở mức database.
- **Ổn định:** Loại bỏ hoàn toàn lỗi timeout hoặc quota của Google Sheets.

## 3. Kiến trúc hệ thống mới (Hybrid Model)
- **Supabase (Backend/Database):** 
  - Lưu bảng `students` (SĐT, Mã PV, machineId, DeviceLimit).
  - Lưu bảng `exams` và `vault_index` (Thay cho `exam_index.json` và log trong Sheets).
- **Telegram (Storage):** Vẫn là nơi lưu trữ file vật lý (PDF). Supabase chỉ lưu `file_id`.
- **Logic Mã PV:** Giữ nguyên thuật toán Hash hiện tại để không gây gián đoạn cho học sinh cũ.

## 4. Lộ trình triển khai cho AI (Claude/GPT)
Khi bắt đầu code, hãy thực hiện theo các bước sau:

### Bước 1: Thiết lập Supabase
- Hướng dẫn Admin lấy `SUPABASE_URL` và `SUPABASE_ANON_KEY`.
- Tạo các bảng (Tables):
  - `students`: `phone` (text, primary key), `activation_key` (text), `machine_id` (text), `is_active` (boolean), `grade` (int).
  - `exams`: Lưu thông tin đề thi và `telegram_file_id`.
  - `vault_index`: Lưu danh sách bài giảng và `telegram_file_id`.

### Bước 2: Di chuyển dữ liệu (Migration)
- Đọc file CSV từ Google Sheets của Admin để import vào bảng `students`.

### Bước 3: Cập nhật Code Logic
- Sửa file `src/hooks/useCloudStorage.ts`:
  - Thay thế các hàm `fetch(GOOGLE_SCRIPT_URL)` bằng các API của Supabase Client.
  - Cập nhật hàm `verifyAccess` để kiểm tra trực tiếp trên bảng `students`.
  - Cập nhật hàm `fetchLessonsFromGitHub` và `loadExams` để lấy dữ liệu từ Supabase thay vì crawl từ Telegram thông qua GAS.

### Bước 4: Tăng cường Bảo mật
- Cài đặt quy tắc RLS: `auth.uid()` (hoặc machineId kiểm tra thủ công) chỉ được phép xem các dòng dữ liệu thuộc về mình.
- Tri khai Rate Limiting để chống dò mã PV.

## 5. Hướng dẫn thao tác cho Admin (Các bước thực hiện tay)

Để chuyển đổi, Admin chỉ thực hiện các bước đơn giản sau:

1. **Khởi tạo Project:** Đăng nhập Supabase bằng GitHub, tạo Project mới tại Region **Singapore**.
2. **Cung cấp chìa khóa:** Vào `Settings` -> `API`, gửi cho AI hai thông tin: `Project URL` và `anon public key`.
3. **Thiết lập bảng (SQL Editor):** Copy đoạn mã SQL mà AI cung cấp, dán vào mục `SQL Editor` của Supabase và bấm **Run**.
4. **Quản lý dữ liệu:** Sử dụng mục `Table Editor` trên web Supabase để nhập/sửa/xóa học sinh như đang dùng Excel.

## 6. Lưu ý quan trọng cho AI sau này
- **Tuyệt đối không** thay đổi cách tính Mã PV nếu không có yêu cầu từ Admin.
- **Tuyệt đối không** bỏ Telegram để chuyển sang Supabase Storage (để tiết kiệm chi phí cho Admin).
- Luôn ưu tiên hiệu năng tải trang đầu tiên (Initial Load).
- **Chiến lược an toàn:** Không xóa logic GAS cũ ngay, hãy tạo file mới hoặc dùng biến môi trường để có thể quay lại bản cũ (Rollback) ngay lập tức nếu có sự cố.

---
*Tài liệu này được soạn thảo để tối ưu hóa quota trao đổi với AI. Khi cần triển khai, Admin chỉ cần gửi file này cho AI và yêu cầu bắt đầu từ Bước 1.*
