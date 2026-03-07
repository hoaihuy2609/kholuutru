export const TELEGRAM_CHAT_ID = '-1003889339240';
export const CLOUDFLARE_PROXY_URL = 'https://physivault-proxy.hoaihuy2609.workers.dev';

export const fetchViaCloudflareProxy = async (fileId: string): Promise<ArrayBuffer> => {
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
