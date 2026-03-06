# Hướng Dẫn Nâng Cấp Bảo Mật: Chuyển Sang Dùng Cloudflare Worker Áp Dụng Cho PhysiVault

Tài liệu này hướng dẫn cách nâng cấp dự án PhysiVault để che giấu hoàn toàn `TELEGRAM_TOKEN`, tránh nguy cơ bị học sinh đánh cắp token từ phía Client.

## Phương án giải quyết
Thay vì để `TELEGRAM_TOKEN` nằm "lộ thiên" trong code Frontend (React/Vite), chúng ta sẽ tạo một máy chủ trung gian nhỏ (gọi là **Cloudflare Worker**). 
Máy chủ này sẽ nhận lệnh từ web, sau đó nó sẽ tự đem cái Token bí mật của nó ráp vào và lén đi lấy file từ Telegram về trả cho học sinh. Học sinh chỉ thấy được link Cloudflare chứa tham số mà mã tài liệu, không thể đọc được Token chứa bên trong.

---

## BƯỚC 1: Cấu hình Cloudflare Worker (Trên Trang Chủ Cloudflare)

1. Đăng nhập vào trang quản trị [Cloudflare API / Workers Overview](https://dash.cloudflare.com/?to=/:account/workers).
2. Tìm đến Worker của bạn đang sử dụng ví dụ: `physivault-proxy.hoaihuy2609`.
3. Bấm vào nút **Edit code** trên màn hình quản lý.
4. Xóa hết tất cả code cũ đi. Cóp y chang toàn bộ đoạn code ở file **`cloudflare_worker.js`** (mình đã tạo riêng bên dưới) dán vào. Rồi ấn **Deploy** hoặc **Save and Deploy**.
5. Mở danh mục bên trái, vào **Settings** -> **Variables and Secrets**. Nhấn **Add Variable**:
   - Vị trí `Variable name`, nhập đúng cái tên: `TELEGRAM_TOKEN`
   - Vị trí `Value`, điền vào token Telegram của bạn (ví dụ: `79859019...`).
   - Nhớ bấm nút **Encrypt** để mã hóa ẩn token (không được bỏ qua). Xong bấm **Deploy**.

Sau bước này, đoạn Worker bên server đã sẵn sàng hoạt động mà không bị lộ bất kỳ mã nào, nó biết phân giải 2 chức năng: lấy file (`/getFile/{id}`) và chức năng uploade (`/proxy/sendDocument`).

---

## BƯỚC 2: Mã Cloudflare Worker Cần Dùng

*Đoạn mã này copy dán thẳng lên Cloudflare như mô tả ở Bước 1. Đừng bỏ quên.*

```javascript
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const TELEGRAM_TOKEN = env.TELEGRAM_TOKEN;

    if (!TELEGRAM_TOKEN) {
      return new Response(JSON.stringify({ error: "Thiếu TELEGRAM_TOKEN trong cấu hình Worker" }), {
        status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization" },
      });
    }

    const corsHeaders = { "Access-Control-Allow-Origin": "*" };

    try {
      // 1. API TẢI FILE: /getFile/<file_id>
      if (url.pathname.startsWith('/getFile/') || url.searchParams.has('file_id')) {
        const fileId = url.pathname.replace('/getFile/', '') || url.searchParams.get('file_id');
        
        const pathRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getFile?file_id=${fileId}`);
        const pathData = await pathRes.json();
        
        if (!pathData.ok) {
          return new Response(JSON.stringify({ error: 'Telegram API từ chối' }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }});
        }
        
        const fileRes = await fetch(`https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${pathData.result.file_path}`);
        
        const newHeaders = new Headers(fileRes.headers);
        newHeaders.set("Access-Control-Allow-Origin", "*");
        
        return new Response(fileRes.body, { status: fileRes.status, statusText: fileRes.statusText, headers: newHeaders });
      }
      
      // 2. API TẢI LÊN (Sync): /proxy/sendDocument
      if (url.pathname.startsWith('/proxy/')) {
        const tgMethod = url.pathname.replace('/proxy/', ''); // Method "sendDocument"
        const tgUrl = new URL(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/${tgMethod}`);
        tgUrl.search = url.search;
        
        const headersToForward = new Headers();
        const contentType = request.headers.get("content-type");
        if (contentType) headersToForward.set("content-type", contentType);

        const proxyRes = await fetch(tgUrl.toString(), { method: request.method, headers: headersToForward, body: request.method !== 'GET' ? request.body : undefined });
        const responseHeaders = new Headers(proxyRes.headers);
        responseHeaders.set("Access-Control-Allow-Origin", "*");
        return new Response(proxyRes.body, { status: proxyRes.status, headers: responseHeaders });
      }

      return new Response(JSON.stringify({ message: "Phân hệ kết nối PhysiVault - Cloudflare đã sẵn sàng!" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }});
    }
  }
};
```

---

## BƯỚC 3: Dọn Dẹp FrontEnd (Toàn Bộ PhysiVault)

Tìm tất cả những vị trí trong code đang định nghĩa `const TELEGRAM_TOKEN = ...` và XÓA HẾT.

### 1. Trong file `components/ExamView.tsx`

Tại hàm `useEffect` tìm dòng logic cũ (thường bắt đầu ở **bước 2 hoặc 3**) gọi `api.telegram.org` hoặc `codetabs` hoặc `gasUrl`. **Xóa các dòng rườm rà đó đi và thay thế bằng:**

```typescript
// ② Lấy PDF qua Cloudflare Proxy (nhanh, an toàn, đã ẩn Token)
let blob: Blob | null = null;
const proxyUrl = `https://physivault-proxy.hoaihuy2609.workers.dev/getFile/${exam.pdfTelegramFileId}`;
const res = await fetch(proxyUrl);

if (res.ok) {
    blob = await res.blob();
    console.log('[PDF] ✅ Loaded via Cloudflare proxy');
} else {
    throw new Error(`Cloudflare proxy lỗi: ${res.status}`);
}
```

*File này nằm mục đích để đọc điểm PDF cho học sinh khi làm Đề Thi.*

### 2. Trong file `src/hooks/useCloudStorage.ts`

Toàn bộ các yêu cầu `POST https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendDocument` (có 2-3 vị trí trong phần **sync** và phần **upload PDF**) CẦN được thay thành:
`https://physivault-proxy.hoaihuy2609.workers.dev/proxy/sendDocument`

*(Đổi từ đường dẫn trực tiếp qua đường dẫn proxy của CloudFlare, nhớ xóa cái phần Bot Token đi).*

---
**Tổng Quyết**: Phương pháp này sẽ xóa 100% token khỏi file chạy Frontend. Không ảnh hưởng đến Fetch, cũng không làm chậm quá trình Sync của Admin.
