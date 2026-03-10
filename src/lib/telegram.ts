export const TELEGRAM_CHAT_ID = import.meta.env.VITE_TELEGRAM_CHAT_ID || '';
export const CLOUDFLARE_PROXY_URL = import.meta.env.VITE_CLOUDFLARE_PROXY_URL || '';
export const ADMIN_AUTH_HEADER = `Bearer ${import.meta.env.VITE_ADMIN_KEY || ''}`;
if (!TELEGRAM_CHAT_ID || !CLOUDFLARE_PROXY_URL) console.error('[telegram] Missing VITE_TELEGRAM_CHAT_ID or VITE_CLOUDFLARE_PROXY_URL');

export const fetchViaCloudflareProxy = async (fileId: string): Promise<ArrayBuffer> => {
    if (!CLOUDFLARE_PROXY_URL) {
        throw new Error('CLOUDFLARE_PROXY_URL chưa được cấu hình. Kiểm tra biến môi trường VITE_CLOUDFLARE_PROXY_URL.');
    }
    const maxRetries = 3;
    const FETCH_TIMEOUT_MS = 60_000;
    let lastError: any = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        try {
            const proxyRes = await fetch(`${CLOUDFLARE_PROXY_URL}/getFile/${fileId}`, {
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (!proxyRes.ok) {
                let errorMsg = proxyRes.statusText;
                try { const errData = await proxyRes.json(); if (errData.error) errorMsg = errData.error; } catch { }
                if (proxyRes.status === 429) {
                    await new Promise(r => setTimeout(r, 5000));
                } else {
                    throw new Error(`Cloudflare Proxy Error: ${proxyRes.status} - ${errorMsg}`);
                }
                continue;
            }
            // Detect HTML responses (e.g. SPA fallback, error pages) that should be binary data
            const contentType = proxyRes.headers.get('content-type') || '';
            if (contentType.includes('text/html')) {
                throw new Error('Server trả về HTML thay vì dữ liệu. Kiểm tra VITE_CLOUDFLARE_PROXY_URL hoặc Cloudflare Worker.');
            }
            return await proxyRes.arrayBuffer();
        } catch (e: any) {
            clearTimeout(timeoutId);
            lastError = e;
            const isTimeout = e.name === 'AbortError';
            console.warn(`[Cloudflare] Lần thử ${attempt + 1}/${maxRetries} ${isTimeout ? '(timeout)' : ''} thất bại:`, e.message);
            if (attempt < maxRetries - 1) {
                await new Promise(r => setTimeout(r, 500));
            }
        }
    }
    throw lastError || new Error("Không thể kết nối đến Cloudflare Server.");
};
