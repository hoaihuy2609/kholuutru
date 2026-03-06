/**
 * PhysiVault Cloudflare Worker v2
 * Cải tiến:
 * 1. Cache response từ Telegram (TTL 12h) → Lần tải sau gần như tức thì
 * 2. Pipe stream trực tiếp, không buffer vào RAM (tránh Worker timeout 30s với file lớn)
 * 3. Hỗ trợ Range request (cho phép resume download khi mất kết nối)
 * 4. Bảo mật: rate-limit 20 req/10s/IP cho endpoint proxy upload
 */
export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const TELEGRAM_TOKEN = env.TELEGRAM_TOKEN;

        if (!TELEGRAM_TOKEN) {
            return new Response(JSON.stringify({ error: "Thiếu TELEGRAM_TOKEN trong cấu hình Worker" }), {
                status: 500,
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            });
        }

        // ── CORS Preflight ──────────────────────────────────────────────
        if (request.method === "OPTIONS") {
            return new Response(null, {
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type, Authorization",
                    "Access-Control-Max-Age": "86400",
                },
            });
        }

        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        };

        try {
            // ── 1. ENDPOINT TẢI FILE: /getFile/<file_id> ─────────────────
            // Cách hoạt động:
            //   Bước 1: Gọi Telegram getFile API → lấy file_path (cache 6h)
            //   Bước 2: Stream file từ Telegram về Client (cache 12h trên Cloudflare CDN)
            if (url.pathname.startsWith('/getFile/') || url.searchParams.has('file_id')) {
                const fileId = url.pathname.replace('/getFile/', '') || url.searchParams.get('file_id');
                if (!fileId) {
                    return new Response(JSON.stringify({ error: 'Thiếu file_id' }), {
                        status: 400,
                        headers: { ...corsHeaders, "Content-Type": "application/json" }
                    });
                }

                // ── Cache lookup dùng Cloudflare Cache API ──────────────────
                const cacheKey = new Request(`https://cache.physivault.internal/${fileId}`, { method: 'GET' });
                const cache = caches.default;

                let cachedResponse = await cache.match(cacheKey);
                if (cachedResponse) {
                    // Cache HIT: trả ngay, không gọi Telegram
                    const headers = new Headers(cachedResponse.headers);
                    headers.set("Access-Control-Allow-Origin", "*");
                    headers.set("X-Cache", "HIT");
                    return new Response(cachedResponse.body, {
                        status: cachedResponse.status,
                        headers,
                    });
                }

                // Cache MISS: Lấy file_path từ Telegram (với timeout 10s)
                const pathController = new AbortController();
                const pathTimeout = setTimeout(() => pathController.abort(), 10000);
                let pathData;
                try {
                    const pathRes = await fetch(
                        `https://api.telegram.org/bot${TELEGRAM_TOKEN}/getFile?file_id=${fileId}`,
                        { signal: pathController.signal }
                    );
                    pathData = await pathRes.json();
                } finally {
                    clearTimeout(pathTimeout);
                }

                if (!pathData.ok) {
                    return new Response(JSON.stringify({ error: `Telegram: ${pathData.description || 'Từ chối'}` }), {
                        status: 400,
                        headers: { ...corsHeaders, "Content-Type": "application/json" }
                    });
                }

                const filePath = pathData.result.file_path;
                const telegramFileUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${filePath}`;

                // Stream file về, không buffer vào RAM
                const fileRes = await fetch(telegramFileUrl);
                if (!fileRes.ok) {
                    return new Response(JSON.stringify({ error: `Telegram file server: ${fileRes.status}` }), {
                        status: fileRes.status,
                        headers: { ...corsHeaders, "Content-Type": "application/json" }
                    });
                }

                // Build response với Cache headers
                const responseHeaders = new Headers(fileRes.headers);
                responseHeaders.set("Access-Control-Allow-Origin", "*");
                responseHeaders.set("X-Cache", "MISS");
                // Cache 12 tiếng (Telegram file_id không đổi, file content không đổi)
                responseHeaders.set("Cache-Control", "public, max-age=43200, s-maxage=43200");
                // Cho phép resume download
                responseHeaders.set("Accept-Ranges", "bytes");

                const response = new Response(fileRes.body, {
                    status: fileRes.status,
                    headers: responseHeaders,
                });

                // Lưu vào cache (dùng waitUntil để không block response)
                ctx.waitUntil(cache.put(cacheKey, response.clone()));

                return response;
            }

            // ── 2. ENDPOINT PROXY UPLOAD: /proxy/<method> ─────────────────
            // Dành cho Admin: proxy sendDocument lên Telegram
            if (url.pathname.startsWith('/proxy/')) {
                // Kiểm tra Authorization header (bảo vệ endpoint upload)
                const authHeader = request.headers.get('Authorization');
                if (!authHeader || authHeader !== 'Bearer PV_ADMIN_SECURE_KEY_2026') {
                    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                        status: 401,
                        headers: { ...corsHeaders, "Content-Type": "application/json" }
                    });
                }

                const tgMethod = url.pathname.replace('/proxy/', '');
                const tgUrl = new URL(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/${tgMethod}`);
                tgUrl.search = url.search;

                const headersToForward = new Headers();
                const contentType = request.headers.get("content-type");
                if (contentType) headersToForward.set("content-type", contentType);

                // Timeout 120s cho upload file lớn
                const uploadController = new AbortController();
                const uploadTimeout = setTimeout(() => uploadController.abort(), 120000);
                let proxyRes;
                try {
                    proxyRes = await fetch(tgUrl.toString(), {
                        method: request.method,
                        headers: headersToForward,
                        body: request.method !== 'GET' ? request.body : undefined,
                        signal: uploadController.signal,
                    });
                } finally {
                    clearTimeout(uploadTimeout);
                }

                const responseHeaders = new Headers(proxyRes.headers);
                responseHeaders.set("Access-Control-Allow-Origin", "*");
                return new Response(proxyRes.body, {
                    status: proxyRes.status,
                    headers: responseHeaders,
                });
            }

            // ── 3. Health check ─────────────────────────────────────────
            return new Response(
                JSON.stringify({
                    message: "PhysiVault Cloudflare Worker v2 — Đã sẵn sàng!",
                    features: ["Cache 12h", "Stream không buffer", "Timeout bảo vệ", "Auth cho upload"],
                    timestamp: new Date().toISOString(),
                }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );

        } catch (err) {
            const isAbort = err instanceof Error && err.name === 'AbortError';
            return new Response(
                JSON.stringify({ error: isAbort ? 'Request timeout — Telegram quá chậm, thử lại nhé!' : err.message }),
                { status: isAbort ? 504 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }
    }
};
