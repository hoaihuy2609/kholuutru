// src/lib/serverTime.ts
let serverOffset = 0; // ms difference between server and local clock (serverTime - localTime)
export let isServerSynced = false; // exported so callers can check if time was successfully synced

// Thử lấy Date header từ 1 URL, trả về offset (ms) hoặc null nếu thất bại
async function tryGetOffset(url: string): Promise<number | null> {
    try {
        const start = Date.now();
        const res = await fetch(url, { method: 'HEAD', cache: 'no-store' });
        const dateHeader = res.headers.get('Date');
        if (!dateHeader) return null;
        const serverTime = new Date(dateHeader).getTime();
        if (isNaN(serverTime)) return null;
        const latency = (Date.now() - start) / 2;
        return (serverTime + latency) - Date.now();
    } catch {
        return null;
    }
}

// Gọi hàm này 1 lần lúc app khởi động (hoặc khi cần verify time)
// ✅ FIX BUG 3: Thêm retry 3 lần + fallback nguồn khác, tránh isServerSynced = false mãi mãi
export const syncServerTime = async () => {
    const RETRY = 3;
    // Nguồn ưu tiên: chính domain đang host (nhanh nhất)
    // Fallback: Cloudflare CDN (luôn trả Date header chính xác)
    const sources = [
        window.location.origin,
        'https://cloudflare.com',
    ];

    for (const source of sources) {
        for (let attempt = 0; attempt < RETRY; attempt++) {
            const offset = await tryGetOffset(source);
            if (offset !== null) {
                serverOffset = offset;
                isServerSynced = true;
                console.log(`[TimeSync] 🕒 Server offset: ${serverOffset}ms (source: ${source})`);
                return;
            }
            // Backoff: 500ms, 1s giữa các lần retry
            if (attempt < RETRY - 1) await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
        }
    }

    // Tất cả nguồn đều fail → dùng giờ local, cảnh báo
    console.warn('[TimeSync] ⚠️ Không thể đồng bộ giờ sau 6 lần thử. Dùng giờ local.');
    // isServerSynced vẫn false — ExamView sẽ dùng getSecureTime() fallback về Date.now()
};

// Luôn lấy giờ này để xử lý
export const getSecureTime = (): number => {
    return Date.now() + serverOffset;
};
