# Kế hoạch triển khai Hệ thống Cloud Sync cho PhysiVault

## 1. Bối cảnh hiện tại
- Website đã được tối ưu UI/UX cho cả Desktop và Mobile.
- Hệ thống kích hoạt hiện đang hoạt động qua SĐT và Google Sheets.
- Học liệu đang được nạp thủ công qua file JSON (Base64 PDF).

## 2. Mục tiêu tính năng mới (Cloud Sync)
Tự động hóa việc phân phối bài giảng. Học sinh chỉ cần kích hoạt là tự động nhận bài giảng tương ứng với khối lớp từ GitHub, thầy không cần gửi file thủ công.

## 3. Quy trình chi tiết cho AI tiếp theo (Claude)

### A. Phía Admin (Thầy Huy)
1. **Quản lý lắt nhắt:** Cho phép Admin upload PDF lên LocalStorage/IndexedDB của trình duyệt để lưu nháp (không cần đẩy lên GitHub ngay).
2. **Đóng gói dữ liệu:** Khi Admin nhấn "Sync", hệ thống tự động:
   - Phân loại bài giảng theo Khối 10, 11, 12.
   - Chuyển PDF sang Base64 và Obfuscate (mã hóa nhẹ) để bảo mật.
   - Tạo ra 3 cấu trúc JSON: `kho-10.json`, `kho-11.json`, `kho-12.json`.
3. **GitHub API Integration:** Sử dụng GitHub API (Octokit hoặc dùng Fetch) để **Ghi đè** (Update) trực tiếp vào Repo GitHub của Thầy Huy.

### B. Phía Học sinh (Student)
1. **Xác thực & Nhận diện lớp:** 
   - Khi gọi Apps Script để kiểm tra mã kích hoạt, Script phải trả về thêm trường `grade` (10, 11, hoặc 12).
2. **Auto-fetch Bài giảng:** 
   - Sau khi kích hoạt thành công, App tự động nhận diện `grade`.
   - Gọi `fetch` tới GitHub Raw URL tương ứng (VD: `kho-12.json`).
   - Tự động nạp dữ liệu vào State và hiển thị bài học.

## 4. Các việc Bro Huy cần chuẩn bị
- [ ] Thêm cột **"Lớp"** (giá trị: 10, 11, hoặc 12) vào Google Sheet quản lý mã.
- [ ] Tạo 1 GitHub Repo (chứa bài giảng).
- [ ] Lấy 1 GitHub **Personal Access Token** (quyền `repo` hoặc `contents`). Lưu vào `.env`.

## 5. Lưu ý kỹ thuật cho AI
- File JSON trên GitHub nên được mã hóa nhẹ bằng mã hóa XOR hoặc Base64 phức hợp để tránh bị "soi" bài giảng nếu Repo là Public.
- Cần tối ưu việc lưu trữ LocalStorage để không bị tràn dung lượng khi Admin upload bài giảng nháp.
- Phải giữ nguyên giao diện Desktop khi nâng cấp các tính năng này.

---
*Tài liệu này được soạn bởi Antigravity để hỗ trợ Claude tiếp quản công việc vào ngày mai.*
