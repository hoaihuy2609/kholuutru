# KẾ HOẠCH NÂNG CẤP BẢO MẬT & TỐI ƯU GIAO TIẾP VỚI TELEGRAM (NEXT STEPS)

File này lưu trữ kế hoạch khắc phục 3 rủi ro lớn trong hệ thống PhysiVault v4 để các phiên làm việc sau thao tác trực tiếp mà không cần phân tích lại.

## Rủi Ro 1 & 2: Lộ TELEGRAM_TOKEN ở Client & Phụ thuộc vào CORS Proxy (`api.codetabs.com`)
*   **Hiện trạng:** Mã nguồn React/Vite (Frontend) đang chứa trực tiếp `TELEGRAM_TOKEN` để gọi API `api.telegram.org`. Học sinh có thể soi Network (F12) để lấy Token này, dẫn đến nguy cơ bị chiếm quyền Bot. Đồng thời, do Telegram chặt CORS nên Web đang phải bọc qua proxy miễn phí `api.codetabs.com`, nếu học sinh truy cập đông sẽ bị sập (lỗi 429 Too Many Requests).
*   **Giải pháp (Chọn 1 trong 2):**
    *   **Cách A (Khuyên dùng - Cloudflare Workers):** Viết 1 đoạn script trung gian chạy trên Cloudflare Workers. Web của học sinh chỉ gọi đến `https://my-proxy.workers.dev/...`. Thằng Cloudflare sẽ giấu Token, tự động thêm Header CORS và thay mặt Web liên lạc với Telegram. Miễn phí 100k requests/ngày, tốc độ cực nhanh.
    *   **Cách B (Supabase Edge Functions):** Viết API chạy trên Server của Supabase. Trình duyệt gọi Supabase, Supabase sẽ dùng Token giấu kín gọi Telegram rồi trả File về. (Lưu ý: Supabase bản Free có giới hạn số lần gọi Function/tháng, có thể không trâu bằng Cloudflare).

## Rủi Ro 3: Rác dữ liệu làm đầy nhóm Telegram
*   **Hiện trạng:** Mỗi lần Admin bấm Sync, code sẽ nén file ZIP mới và đẩy lên Telegram lấy `file_id` mới. File ZIP cũ của các lần Sync trước vẫn nằm chết trên Telegram gây rác.
*   **Giải pháp:** 
    *   Sửa hàm `syncToGitHub` và `saveExam`.
    *   Trước khi ghi đè `telegram_file_id` mới lên Supabase, hãy Query (Select) để lấy `telegram_file_id` CŨ.
    *   Sau khi lưu thành công File mới, dùng lệnh Telegram API `deleteMessage` thông qua Bot để xóa luôn cái tin nhắn chứa File cũ đi. Kho lưu trữ của thầy sẽ luôn sạch bóng!

## Tính Năng 4: Hệ Thống Thông Báo & Cập Nhật Dữ Liệu Cho Học Sinh
*   **Mục tiêu:** Giúp học sinh cập nhật liên tục các tài liệu/bài thi mới thay vì chỉ lấy được 1 lần sau khi mở khóa. Đồng thời nhận được thông báo khi thầy giáo có đề mới.
*   **Giải pháp chi tiết:**
    *   **Cơ sở dữ liệu (Supabase):** Tạo bảng `notifications` (chứa `id`, `message`, `created_at`). Mỗi khi Admin đăng File mới & Sync Telegram thì thêm 1 Row thông báo vào bảng này.
    *   **Giao diện Học sinh (Frontend):** 
        1. Thêm biểu tượng **Cái chuông 🔔** (khi có thông báo mới hiển thị chấm đỏ).
        2. Thêm nút **Cập nhật dữ liệu** (Refresh / Lấy bài mới). Nút này gọi lại API lấy file từ Telegram về thiết bị, bổ sung thêm cho kho thư viện của học sinh.
    *   **Luồng chạy:** Admin có bài học mới -> Sync -> Hệ thống tạo Thông báo -> Học sinh hiện chuông đỏ -> Học sinh bấm nút Cập nhật bài học (Gọi gọi bài về) -> Tài liệu mới hiện ra trong kho.

---
*Ghi chép này chờ được thực thi trong phiên làm việc kế tiếp. Vui lòng không xóa.*
