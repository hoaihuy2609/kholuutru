// src/lib/serverTime.ts
let serverOffset = 0; // ms difference between server and local clock (serverTime - localTime)
let isSynced = false;

// Gọi hàm này 1 lần lúc app khởi động (hoặc khi cần verify time)
export const syncServerTime = async () => {
    try {
        const start = Date.now();
        // Lệnh HEAD tới chính domain đang host để xin header Date
        const res = await fetch(window.location.origin, { method: 'HEAD', cache: 'no-store' });
        const dateHeader = res.headers.get('Date');
        if (dateHeader) {
            const serverTime = new Date(dateHeader).getTime();
            const latency = (Date.now() - start) / 2;
            const trueServerTime = serverTime + latency;
            serverOffset = trueServerTime - Date.now();
            isSynced = true;
            console.log(`[TimeSync] 🕒 Server offset: ${serverOffset}ms`);
        }
    } catch {
        console.warn(`[TimeSync] ⚠️ Lỗi đồng bộ giờ. Fallback về giờ local.`);
    }
};

// Luôn lấy giờ này để xử lý
export const getSecureTime = (): number => {
    return Date.now() + serverOffset;
};
