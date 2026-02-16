# 📚 PhysiVault - Kho Lưu Trữ Vật Lý Thông Minh

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## 🌟 Giới thiệu

**PhysiVault** là ứng dụng web hiện đại giúp học sinh quản lý và lưu trữ tài liệu Vật Lý một cách dễ dàng, hiệu quả. Với giao diện thân thiện và tính năng mạnh mẽ, PhysiVault là công cụ hoàn hảo cho việc học tập.

## ✨ Tính năng nổi bật

### 🎯 Quản lý tài liệu thông minh
- ✅ Tổ chức theo khối lớp (10, 11, 12)
- ✅ Phân chia theo chương học
- ✅ Tạo bài học tùy chỉnh
- ✅ Upload và quản lý file PDF

### 🤖 Công cụ AI (Mới!)
- ✅ **AI Solver**: Giải toán & vật lý tự động, xuất LaTeX
- ✅ **SmartCrop AI**: Cắt ảnh thông minh với AI
- ✅ Hỗ trợ đa ảnh và PDF
- ✅ Tích hợp Gemini AI

### 🔍 Tìm kiếm & Sắp xếp
- ✅ Tìm kiếm tài liệu nhanh chóng
- ✅ Sắp xếp theo tên, ngày, kích thước
- ✅ Lọc tài liệu theo từ khóa

### 👁️ Xem trước & Tải xuống
- ✅ Xem trước PDF trực tiếp trong trình duyệt
- ✅ Tải xuống tài liệu dễ dàng
- ✅ Quản lý file hiệu quả

### 🎨 Giao diện hiện đại
- ✅ Thiết kế responsive, tương thích mọi thiết bị
- ✅ Animations mượt mà
- ✅ Dark mode friendly
- ✅ Toast notifications cho phản hồi người dùng

### 💾 Lưu trữ cục bộ
- ✅ Dữ liệu được lưu trên trình duyệt (localStorage)
- ✅ Không cần đăng nhập
- ✅ Bảo mật và riêng tư

## 🚀 Cài đặt & Sử dụng

### Yêu cầu hệ thống
- Node.js >= 16.x
- npm hoặc yarn

### Cài đặt

```bash
# Clone repository
git clone https://github.com/your-username/physivault.git

# Di chuyển vào thư mục dự án
cd physivault

# Cài đặt dependencies
npm install

# Cấu hình API key (cho tính năng AI)
# Tạo file .env.local và thêm Gemini API key
echo "VITE_GEMINI_API_KEY=your_api_key_here" > .env.local

# Chạy ứng dụng ở chế độ development
npm run dev

# Build cho production
npm run build

# Preview bản build
npm run preview
```

### Cấu hình API Key (Tùy chọn)

Để sử dụng tính năng **AI Solver** và **SmartCrop AI**, bạn cần cấu hình Gemini API key:

1. Truy cập [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Tạo API key mới (miễn phí)
3. Tạo file `.env.local` trong thư mục gốc:
   ```bash
   VITE_GEMINI_API_KEY=your_actual_api_key_here
   ```
4. Khởi động lại dev server

**Lưu ý**: Nếu không cấu hình API key, các tính năng AI sẽ không hoạt động nhưng tính năng quản lý tài liệu vẫn sử dụng bình thường.

### Sử dụng

1. **Chọn khối lớp**: Từ trang chủ, chọn khối lớp bạn muốn quản lý (10, 11, hoặc 12)
2. **Chọn chương**: Chọn chương học bạn muốn làm việc
3. **Tạo bài học**: Tạo bài học mới hoặc chọn bài học có sẵn
4. **Upload tài liệu**: Kéo thả hoặc chọn file PDF để upload
5. **Quản lý**: Tìm kiếm, sắp xếp, xem trước và tải xuống tài liệu

## 📁 Cấu trúc dự án

```
physivault/
├── components/          # React components
│   ├── Dashboard.tsx    # Trang chủ
│   ├── ChapterView.tsx  # Danh sách bài học
│   ├── LessonView.tsx   # Quản lý tài liệu
│   ├── Sidebar.tsx      # Menu điều hướng
│   ├── SearchBar.tsx    # Thanh tìm kiếm
│   ├── Modal.tsx        # Modal component
│   └── Toast.tsx        # Thông báo
├── App.tsx              # Component chính
├── constants.ts         # Dữ liệu chương trình học
├── types.ts             # TypeScript types
├── index.css            # Global styles
├── index.html           # HTML template
├── index.tsx            # Entry point
└── package.json         # Dependencies
```

## 🛠️ Công nghệ sử dụng

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Lucide React** - Icons
- **localStorage** - Data persistence

## 🎨 Tối ưu hóa UX/UI

### Animations & Transitions
- Fade in/out effects
- Smooth hover states
- Loading skeletons
- Toast notifications

### Responsive Design
- Mobile-first approach
- Adaptive layouts
- Touch-friendly interactions
- Optimized for all screen sizes

### Performance
- Lazy loading
- Memoization (useMemo)
- Optimized re-renders
- Fast search & filter

## 📱 Tương thích

- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Mobile browsers

## 🤝 Đóng góp

Mọi đóng góp đều được chào đón! Vui lòng:

1. Fork dự án
2. Tạo branch mới (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Tạo Pull Request

## 📝 License

Dự án này được phân phối dưới giấy phép MIT. Xem file `LICENSE` để biết thêm chi tiết.

## 👨‍💻 Tác giả

**PhysiVault Team**

## 🙏 Lời cảm ơn

Cảm ơn bạn đã sử dụng PhysiVault! Nếu bạn thấy hữu ích, hãy cho chúng tôi một ⭐ trên GitHub!

---

Made with ❤️ for Vietnamese students
