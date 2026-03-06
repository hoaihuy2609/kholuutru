# HƯỚNG DẪN TRIỂN KHAI GIAO DIỆN TỐI TỰ ĐỘNG THEO THỜI GIAN (AUTO DARK MODE) - BẢN CAO CẤP

*Tài liệu này lưu trữ kịch bản và cách thức triển khai tính năng giao diện tối tự động (Auto Dark Mode) theo Phương án B. Đặc biệt chú trọng vào sự ĐỒNG BỘ TUYỆT ĐỐI (không lởm chởm trắng đen) và CHI TIẾT TINH TẾ (hiệu ứng hửng sáng).*

---

## 🌟 1. Mô tả Kịch bản (Phương án B - Chủ động theo giờ)
Hệ thống PhysiVault sẽ tự động thay đổi dựa vào đồng hồ thời gian thực của máy học sinh:
- 🌞 **Ban ngày (06:00 - 17:59):** Giao diện Light Mode - Giữ nguyên 100% phong cách tĩnh lặng, sạch sẽ Notion-style.
- 🌙 **Ban đêm (18:00 - 05:59):** Giao diện Dark Mode - Tự động sập nền thành Không Gian Đen (Dark Space).
    - **Yêu cầu cốt lõi:** Chuyển đổi phải KHỚP 100%, không được xót lại bất kỳ cái nền trắng hay chữ đen nào.
    - **Sự Tinh Tế (Glow Effect):** Trong bóng tối, các thành phần tương tác (Nút bấm, Menu đang Submit, Tab đang Active) không chỉ đổi màu mà phải HỬNG SÁNG (Glow) tỏa ra một luồng sáng mờ ảo theo đúng màu chủ đạo của nó (ví dụ: Nút xanh lá phát sáng xanh lá, Nút cam phát sáng cam). Cảm giác như bóng đèn LED neon mờ trong màn đêm.

---

## 🛠 2. Chế tài Kỹ thuật (Các bước Dev bắt buộc tuân thủ)

### BƯỚC 1: Xây dựng CSS Variables "Bóng Đêm Công Nghệ" (`index.css`)
Khai báo nhánh màu `.dark-theme`. Lúc này ta không chỉ đổi màu nền/chữ, mà phải định nghĩa sẵn các mã bóng đổ (glow) cực deep:

```css
/* TRƯỚC ĐÓ LÀ BỘ MÀU LIGHT MODE MẶC ĐỊNH (GIỮ NGUYÊN) */
:root {
    --bg: #F7F6F3;
    --surface: #FFFFFF;
    --text-primary: #1A1A1A;
    --border: #E9E9E7;
    /* ... */
}

/* BỘ MÀU KHI VÀO BAN ĐÊM (KÍCH HOẠT KHI BODY CÓ CLASS .dark-theme) */
.dark-theme {
    /* 1. Nền & Khối */
    --bg: #121212;             /* Đen than/không gian sâu */
    --surface: #1E1E1E;        /* Khối Card nổi lên 1 chút */
    --sidebar-bg: #18181A;     /* Sidebar tĩnh lặng */
    
    /* 2. Đường kẻ & Chữ */
    --border: #2C2C2E;         /* Kẻ viền tối chỉ mờ mờ thấy */
    --border-hover: #444446; 
    --text-primary: #EDEDED;   /* Chữ trắng ngà (chống lóa) */
    --text-secondary: #999999; /* Chữ xám */
    --text-muted: #666666;

    /* 3. HIỆU ỨNG TỎA SÁNG CÁC NÚT (GLOW EFFECTS) - Tinh tế, không chói */
    --glow-green: 0 0 12px rgba(68, 131, 97, 0.4);
    --glow-blue: 0 0 12px rgba(107, 124, 219, 0.4);
    --glow-orange: 0 0 12px rgba(217, 115, 13, 0.4);
    --glow-red: 0 0 12px rgba(224, 62, 62, 0.4);
    
    --shadow-sm: 0 4px 12px rgba(0, 0, 0, 0.5);
    --shadow-md: 0 8px 24px rgba(0, 0, 0, 0.6);
}
```

### BƯỚC 2: Diệt tận gốc Bệnh "Lởm Chởm" (Hardcoded Color Hunt)
Đây là nguyên nhân gây ra hiện tượng chỗ đen chỗ trắng. Dev phải Lục lọi toàn bộ file `.tsx` (Sidebar, FocusTimer, ExamResult...).
- **Nghiêm cấm:** Code HTML kiểu `style={{ background: '#FFFFFF' }}` hoặc dùng class `bg-white`.
- **Bắt buộc:** Đổi hết thành BIẾN CSS.
    - Màu trắng (`#FFF`) -> Đổi thành `var(--surface)`.
    - Màu nền xám (`#F7F6F3`) -> Đổi thành `var(--bg)`.
    - Màu text đen (`#1A1A1A`) -> Đổi thành `var(--text-primary)`.
    - **Đặc biệt lưu ý các vùng chọn ở Sidebar (như hình "Mục Tiêu & Lịch Trình"):** Lớp nền nhạt của Item đang Active (`#EAF3EE`) cũng phải đưa vào dạng biến (VD: `--active-item-bg`) để đêm xuống nó sẽ thành 1 màu Đen có ánh Xanh mờ, không bị chói.

### BƯỚC 3: Công thức CSS tạo Hiệu Ứng Hửng Sáng (Glow) Ban Đêm
Ở CSS, để các nút bấm Active hoặc nút Play/Pause hửng sáng đẹp mắt vào ban đêm ta dùng cú pháp cấu trúc sau:

```css
/* Trong index.css */

/* Nút Accent Green chung */
.btn-accent-green {
    background-color: var(--accent-green);
    color: white;
    transition: all 0.3s ease;
}

/* KHI CHUYỂN QUA ĐÊM (dark-theme), nó tự hắt sáng ra xung quanh */
.dark-theme .btn-accent-green {
    background-color: var(--accent-green); /* Vẫn giữ màu xanh lá gốc */
    box-shadow: var(--glow-green);         /* <- TỎA SÁNG MỜ ẢO! */
}

/* Áp dụng tương tự cho các Item trong Sidebar đang ở trạng thái ACTIVE */
.dark-theme .sidebar-item.active {
    background-color: rgba(68, 131, 97, 0.15); /* Nền xanh lục siêu mờ */
    border-color: rgba(68, 131, 97, 0.5);      /* Viền xanh lục nhẹ */
    box-shadow: inset 0 0 10px rgba(68, 131, 97, 0.1); /* Sáng mờ mờ từ bên trong */
    color: #A7D7BC; /* Chữ dạ quang */
}
```
*Lưu ý: Sự tinh tế nằm ở hệ số Opacity (0.1, 0.15). Bóng đổ sáng (glow) tuyệt đối không được gắt, chỉ là ánh sáng dịu hắt lên trong không gian đen.*

### BƯỚC 4: Lắp đặt "Bộ Não Đồng Hồ" (Time-based Logic)
Tại file Layout cao nhất (VD: `App.tsx`), thêm đoạn Hook này:
```javascript
import { useEffect } from 'react';

useEffect(() => {
    // Hàm cập nhật trạng thái
    const updateTheme = () => {
        const currentHour = new Date().getHours();
        // Từ 18h tối đến 5h sáng hôm sau
        if (currentHour >= 18 || currentHour < 6) {
            document.documentElement.classList.add('dark-theme');
            document.body.classList.add('dark-theme');
        } else {
            document.documentElement.classList.remove('dark-theme');
            document.body.classList.remove('dark-theme');
        }
    };

    // Chạy lượt đầu 
    updateTheme();
    
    // Tự động kiểm tra lại mỗi 1 phút (Để nhỡ học sinh treo máy lố giờ)
    const interval = setInterval(updateTheme, 60000);
    return () => clearInterval(interval);
}, []);
```

---

## 🎯 3. Tóm tắt Tiêu Chuẩn Nghiệm Thu cho Dev
- [ ] Mở Web lúc 18:00 - UI tự mượt mà chuyển sang tông màu Ghi Đen Tối vĩ đại.
- [ ] KHÔNG BỊ "LANG BEN" (chỗ đen chỗ trắng) do sót mã màu tĩnh dưới source code.
- [ ] Các thành phần Active (Ví dụ dòng Menu *Mục Tiêu & Lịch Trình* ở thanh Sidebar bên trái), các nút Start/Stop của đồng hồ,... nhè nhẹ hắt ánh sáng mờ phát quang (Neon Glow), cảm giác cực kỳ công nghệ điện tử Cyberpunk mà vẫn gọn gàng.
