# 🔥 TÀI LIỆU HƯỚNG DẪN TỐI ƯU HÓA CODE (PHIÊN LÀM VIỆC TIẾP THEO)

File hướng dẫn này được thiết kế như một **Bản kế hoạch hành động chi tiết** (Action Plan) dành riêng cho bạn và trợ lý AI trong phiên làm việc sau. Kế hoạch tập trung vào việc áp dụng 4 kỹ thuật tối ưu hóa nâng cao mà không làm phá vỡ logic cốt lõi.

---

## 🚀 1. Tối ưu thanh tìm kiếm bằng Debounce
**Lý do:** Hiện tại, thanh tìm kiếm ở `ContactBook` và `ChapterView` đang thực hiện thao tác lọc dữ liệu ngay lập tức mỗi khi bạn nhấn một phím => Gây giật lag nhẹ khi danh sách quá dài.
**Vùng cần code:** `components/ContactBook.tsx` (và `components/ChapterView.tsx`)
**Cách làm cụ thể:**

1. Ở đầu file, thêm Import thư viện:
```tsx
import { useDebounce } from 'use-debounce';
```

2. Ngay dưới dòng khai báo `useState` của biến `searchTerm`, thêm Hook debounce:
```tsx
const [searchTerm, setSearchTerm] = useState('');
// Thêm móc thời gian chờ 300ms
const [debouncedSearchTerm] = useDebounce(searchTerm, 300); 
```

3. Vào bên trong vòng lặp lọc dữ liệu (`filteredStudents` hoặc `filteredLessons`) nằm trong `useMemo`, thay đổi biến phụ thuộc:
```diff
- const filteredData = useMemo(() => { ... dựa trên searchTerm ... }, [data, searchTerm]);
+ const filteredData = useMemo(() => { ... dựa trên debouncedSearchTerm ... }, [data, debouncedSearchTerm]);
```


---

## ⚡ 2. Sử dụng Component riêng biệt & `React.memo` cho Danh sách
**Lý do:** Khi người dùng click chọn 1 bài học hoặc 1 học sinh, toàn bộ danh sách gồm vài chục/vài trăm hàng (rows) sẽ bị Render (vẽ) lại từ đầu. React.memo sẽ giúp "đóng băng" các hàng không thay đổi để tiết kiệm CPU.
**Vùng cần code:** Các vòng lặp `.map` bự trong `components/ChapterView.tsx` hoặc `components/ContactBook.tsx`.
**Cách làm cụ thể:**

1. Tách thẻ hiển thị một hàng (ví dụ: một thẻ bài học) thành một Component con và bọc với `React.memo`:
```tsx
const LessonCard = React.memo(({ lesson, onClick }) => {
  return (
    <div onClick={() => onClick(lesson)} className="p-4 border...">
      {lesson.name}
    </div>
  ); // Thay bằng thiết kế UI hiện có của thẻ bài học
});
```

2. ⚠️ **Rất quan trọng:** Khi truyền hàm `onClick` xuống Component con bị bọc bởi `memo`, phải ép hàm đó đứng yên bằng `useCallback`. Trở lại Component Cha:
```tsx
const handleLessonSelect = useCallback((lesson) => {
    navigate(`/grade/.../${lesson.id}`);
}, [navigate]);

// Render list:
{lessons.map(lesson => (
    <LessonCard key={lesson.id} lesson={lesson} onClick={handleLessonSelect} />
))}
```

---

## 📴 3. Kích hoạt tính năng Offline & Bộ nhớ đệm (PWA Service Worker)
**Lý do:** Trang web hiện tại phải tải lại mã (JS/CSS) nếu refresh hoặc mất mạng. Ta cần biến web thành dạng App tải tức thì (Instant Load).
**Vùng cần code:** `vite.config.ts` và `src/App.tsx` (hoặc `index.html`).
**Cách làm cụ thể:**

1. Mở Terminal và cài đặt thư viện: `npm install vite-plugin-pwa --save-dev`
2. Mở `vite.config.ts` và khai báo:
```tsx
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'] // Các file sẽ được cache vĩnh viễn ở máy HS
      }
    })
  ]
})
```


---

## 🖼️ 4. Chuyển đổi chuẩn Hình ảnh sang chuẩn WebP/AVIF
**Lý do:** Giảm dung lượng tải file rác từ 2-3MB xuống vài chục KB, đặc biệt hữu ích cho học sinh sử dụng 3G/4G trên điện thoại.
**Vùng cần làm:** Các file hình ảnh tĩnh (nếu có) trong thư mục `public/` (hoặc ảnh Einstein).
**Cách làm:**
1. Covert các hình ảnh `.png`, `.jpg` sang định dạng `.webp` sử dụng các trang web online (như Squoosh.app).
2. Xóa các hình cũ đi để trống chỗ, đổi tên hình mới và khai báo thay thế import trong code.


---

## 👨‍💻 DOUBLE CHECK SỰ TỐI ƯU CỦA KẾ HOẠCH NÀY
- **Đã khoanh vùng cẩn thận chưa?** Bản kế hoạch không yêu cầu viết lại logic, chỉ tác động đúng 3 thành tố: (1) state input (Debounce), (2) quá trình vẽ danh sách (React.memo), (3) Config ở file build (PWA). Cấu trúc dữ liệu Database, Router không bị làm phiền. Mức độ rủi ro gần như = 0.
- **Có đúng mục tiêu "mượt" không?** Có. PWA sẽ làm web load ngay lặp tức. Còn Debounce và Memo sẽ xử lý độ trễ Animation khi người dùng vuốt/gõ phím - đây chính là 2 nguyên nhân cốt lõi gây cảm giác "chậm".
- **Khối lượng việc:** Rất phù hợp cho một phiên làm việc 30-45 phút tiếp theo mà vẫn để dư thời gian Test lỗi.


*✨ File này đã được lưu trực tiếp tại Thư mục dự án với tên `NEXT_SESSION_OPTIMIZATION.md`. Ở phiên làm việc tới, bạn chỉ cần báo trợ lý AI mở/đọc file này và làm theo y hệt từng dòng là xong!*
