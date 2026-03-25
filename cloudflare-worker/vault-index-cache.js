// cloudflare-worker/vault-index-cache.js
// =========================================================
// Deploy lên: Cloudflare Dashboard → Workers & Pages → Create Worker
// Điền SUPABASE_URL, SUPABASE_ANON_KEY, PURGE_SECRET vào phần Variables
// hoặc thay trực tiếp vào đây.
// =========================================================

const SUPABASE_URL = "https://ndhcwrczwbehyznnxzou.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kaGN3cmN6d2JlaHl6bm54em91Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwNzk0OTEsImV4cCI6MjA4NzY1NTQ5MX0.-LAbz_xMZdPlHlvyaYrotonX_sKoTLwNMEpHss5fun4";
const CACHE_TTL = 60; // giây - tăng lên 300 nếu bạn ít khi đăng đề mới
const PURGE_SECRET = "physivault-purge-2025"; // ĐỔI cái này thành chuỗi bí mật của bạn

// Danh sách domain được phép gọi (CORS)
const ALLOWED_ORIGINS = [
  "https://physivault.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
];

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-purge-secret",
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    // --- Xử lý CORS Preflight ---
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // =========================================================
    // Route 1: Purge cache thủ công (gọi khi bạn đăng đề mới)
    // POST /purge
    // Header: x-purge-secret: physivault-purge-2025
    // Body (optional): { "grade": 0 }  → purge 1 grade cụ thể
    //                  không có body   → purge toàn bộ grades (0, 10, 11, 12)
    // =========================================================
    if (url.pathname === "/purge" && request.method === "POST") {
      const auth = request.headers.get("x-purge-secret");
      if (auth !== PURGE_SECRET) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const cache = caches.default;
      let gradesToPurge = [0, 10, 11, 12];

      try {
        const body = await request.json();
        if (body.grade !== undefined) gradesToPurge = [Number(body.grade)];
      } catch {
        // Không có body → purge toàn bộ
      }

      const purgeResults = await Promise.all(
        gradesToPurge.map(async (g) => {
          const key = new Request(`${url.origin}/vault-index?grade=${g}`);
          const deleted = await cache.delete(key);
          return { grade: g, deleted };
        })
      );

      return new Response(JSON.stringify({ ok: true, purged: purgeResults }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    // =========================================================
    // Route 2: Lấy vault_index theo grade (với cache)
    // GET /vault-index?grade=0  (0 = Đề thi, 10/11/12 = Bài giảng)
    // =========================================================
    if (url.pathname === "/vault-index" && request.method === "GET") {
      const grade = url.searchParams.get("grade") || "0";

      // Validate grade
      if (!["0", "10", "11", "12"].includes(grade)) {
        return new Response(JSON.stringify({ error: "Invalid grade" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
        });
      }

      const cache = caches.default;
      // Cache key riêng biệt cho từng grade
      const cacheKey = new Request(`${url.origin}/vault-index?grade=${grade}`);

      // Kiểm tra cache trước (Cache HIT)
      const cachedResponse = await cache.match(cacheKey);
      if (cachedResponse) {
        const cachedData = await cachedResponse.json();
        return new Response(JSON.stringify(cachedData), {
          headers: {
            "Content-Type": "application/json",
            "x-cache": "HIT",
            "x-cache-grade": grade,
            ...corsHeaders(origin),
          },
        });
      }

      // Cache MISS → gọi Supabase
      let supabaseData = null;
      try {
        const supabaseRes = await fetch(
          `${SUPABASE_URL}/rest/v1/vault_index?select=telegram_file_id&grade=eq.${grade}&limit=1`,
          {
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (!supabaseRes.ok) {
          throw new Error(`Supabase error: ${supabaseRes.status}`);
        }
        supabaseData = await supabaseRes.json();
      } catch (err) {
        return new Response(JSON.stringify({ error: "Upstream error", detail: err.message }), {
          status: 502,
          headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
        });
      }

      const body = JSON.stringify(supabaseData);

      // Lưu vào Cloudflare Cache với TTL
      const responseToCache = new Response(body, {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": `public, max-age=${CACHE_TTL}, s-maxage=${CACHE_TTL}`,
        },
      });
      await cache.put(cacheKey, responseToCache);

      // Trả về cho client, thêm các header debug
      return new Response(body, {
        headers: {
          "Content-Type": "application/json",
          "x-cache": "MISS",
          "x-cache-grade": grade,
          ...corsHeaders(origin),
        },
      });
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  },
};
