
# Hướng dẫn Cấu hình Firebase cho PhysiVault

Để ứng dụng có thể đồng bộ dữ liệu giữa điện thoại và laptop, bạn cần tạo một dự án Firebase (miễn phí của Google).

## Bước 1: Tạo dự án Firebase
1. Truy cập [Firebase Console](https://console.firebase.google.com/).
2. Nhấn **Create a project**.
3. Đặt tên (ví dụ: `physivault-app`) và làm theo hướng dẫn.

## Bước 2: Lấy mã cấu hình (Config)
1. Trong trang tổng quan dự án, nhấn vào icon **Web (</>)** để thêm ứng dụng web.
2. Đặt tên (ví dụ: `PhysiVault Web`).
3. Bạn sẽ thấy đoạn mã `const firebaseConfig = { ... };`.
4. Copy các giá trị bên trong (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId).

## Bước 3: Dán vào code
1. Mở file `src/lib/firebase.ts` trong dự án này.
2. Thay thế các dòng `YOUR_API_KEY`, `YOUR_PROJECT_ID`... bằng giá trị thật bạn vừa copy.

## Bước 4: Bật tính năng
1. **Firestore Database**: 
   - Vào menu **Build** -> **Firestore Database**.
   - Nhấn **Create database**.
   - Chọn **Start in database mode** (Chọn location gần Việt Nam, ví dụ `asia-southeast1` hoặc để mặc định).
   - Vào tab **Rules**, sửa thành:
     ```
     rules_version = '2';
     service cloud.firestore {
       match /databases/{database}/documents {
         match /{document=**} {
           allow read, write: if true;
         }
       }
     }
     ```
     *(Lưu ý: Đây là chế độ test, cho phép ai cũng đọc ghi được. Sau này nên bảo mật hơn).*

2. **Storage**:
   - Vào menu **Build** -> **Storage**.
   - Nhấn **Get started**, chọn **Start in test mode**.
   - Vào tab **Rules**, sửa thành:
     ```
     rules_version = '2';
     service firebase.storage {
       match /b/{bucket}/o {
         match /{allPaths=**} {
           allow read, write: if true;
         }
       }
     }
     ```

## Bước 5: Chạy ứng dụng
Sau khi điền xong config, ứng dụng sẽ tự động kết nối và đồng bộ!
