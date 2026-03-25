// cloudflare-worker/vault-index-cache.js
// =========================================================
// API Gateway: Dùng chung 1 Worker cho mọi route index
//   GET  /vault-index?grade=0        → Danh sách Đề thi
//   GET  /vault-index?grade=10|11|12 → Index Bài giảng
//   GET  /blog-index                 → Index Tin tức / Blog
//   GET  /notifications?grade=0|10|11|12 → Thông báo theo khối
//   POST /purge                      → Xóa cache thủ công (Admin)
// =========================================================

const SUPABASE_URL = "https://ndhcwrczwbehyznnxzou.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kaGN3cmN6d2JlaHl6bm54em91Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwNzk0OTEsImV4cCI6MjA4NzY1NTQ5MX0.-LAbz_xMZdPlHlvyaYrotonX_sKoTLwNMEpHss5fun4";
const PURGE_SECRET = "physivault-purge-2025"; // ĐỔI thành chuỗi bí mật của bạn

const ALLOWED_ORIGINS = [
  "https://physivault.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
];

// ─── Helper: Tạo CORS header đúng domain ───────────────────
function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-purge-secret",
  };
}

// ─── Helper: Gọi Supabase rồi cache kết quả ────────────────
// cacheKey  → chuỗi duy nhất để định danh cache entry
// supaPath  → đường dẫn REST Supabase (sau base URL)
// ttl       → thời gian giữ cache (giây)
// origin    → Origin của request để gắn CORS
async function handleCache(cacheKey, supaPath, ttl, origin) {
  const cache = caches.default;
  const cacheReq = new Request(`https://physivault-proxy.hoaihuy2609.workers.dev/__cache__/${cacheKey}`);

  // Cache HIT → trả ngay
  const hit = await cache.match(cacheReq);
  if (hit) {
    const body = await hit.text();
    return new Response(body, {
      headers: {
        "Content-Type": "application/json",
        "x-cache": "HIT",
        "x-cache-key": cacheKey,
        ...corsHeaders(origin),
      },
    });
  }

  // Cache MISS → truy vấn Supabase
  let supaData;
  try {
    const supaRes = await fetch(`${SUPABASE_URL}/rest/v1/${supaPath}`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
    });
    if (!supaRes.ok) throw new Error(`Supabase ${supaRes.status}`);
    supaData = await supaRes.json();
  } catch (err) {
    return new Response(JSON.stringify({ error: "Upstream error", detail: err.message }), {
      status: 502,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  }

  const body = JSON.stringify(supaData);

  // Lưu vào Cloudflare Cache
  await cache.put(
    cacheReq,
    new Response(body, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=${ttl}, s-maxage=${ttl}`,
      },
    })
  );

  return new Response(body, {
    headers: {
      "Content-Type": "application/json",
      "x-cache": "MISS",
      "x-cache-key": cacheKey,
      ...corsHeaders(origin),
    },
  });
}

// ─── Entry point ────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    // CORS Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // ============================================================
    // Route 1: GET /vault-index?grade=0|10|11|12
    //   grade=0       → Đề thi (vault_index)
    //   grade=10|11|12 → Bài giảng (vault_index)
    // TTL: 60s (đề thi cập nhật thường xuyên hơn blog)
    // ============================================================
    if (url.pathname === "/vault-index" && request.method === "GET") {
      const grade = url.searchParams.get("grade") || "0";
      if (!["0", "10", "11", "12"].includes(grade)) {
        return new Response(JSON.stringify({ error: "Invalid grade" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
        });
      }
      return handleCache(
        `vault-index-grade-${grade}`,
        `vault_index?select=telegram_file_id&grade=eq.${grade}&limit=1`,
        60,
        origin
      );
    }

    // ============================================================
    // Route 2: GET /blog-index
    //   Không cần grade (blog chung cho toàn trường)
    //   TTL: 300s (5 phút) — blog ít thay đổi hơn
    // ============================================================
    if (url.pathname === "/blog-index" && request.method === "GET") {
      return handleCache(
        "blog-index",
        "blog_index?select=telegram_file_id&order=updated_at.desc&limit=1",
        300,
        origin
      );
    }

    // ============================================================
    // Route 3: GET /notifications?grade=0|10|11|12
    //   grade=0       → Thông báo cho mục Đề thi
    //   grade=10|11|12 → Thông báo theo khối lớp
    //   TTL: 30s — thông báo cần fresh hơn blog (cần reactivity cao)
    //   limit=20 — chỉ lấy 20 thông báo mới nhất, tránh data phình to
    // ============================================================
    if (url.pathname === "/notifications" && request.method === "GET") {
      const grade = url.searchParams.get("grade") || "0";
      if (!["0", "10", "11", "12"].includes(grade)) {
        return new Response(JSON.stringify({ error: "Invalid grade" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
        });
      }
      return handleCache(
        `notifications-grade-${grade}`,
        `notifications?select=*&grade=eq.${grade}&order=created_at.desc&limit=20`,
        30,
        origin
      );
    }

    // ============================================================
    //   Xóa cache thủ công sau khi Admin đăng nội dung mới
    //   Body (JSON):
    //     { "target": "vault-index", "grade": 0 }       → xóa đề thi
    //     { "target": "vault-index", "grade": 10 }      → xóa bài giảng lớp 10
    //     { "target": "blog-index" }                    → xóa blog
    //     { "target": "notifications", "grade": 12 }    → xóa thông báo khối 12
    //     { "target": "all" }                           → xóa toàn bộ
    // ============================================================
    if (url.pathname === "/purge" && request.method === "POST") {
      const auth = request.headers.get("x-purge-secret");
      if (auth !== PURGE_SECRET) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      let body = {};
      try { body = await request.json(); } catch { }

      const target = body.target || "all";
      const cache = caches.default;
      const BASE = "https://physivault-proxy.hoaihuy2609.workers.dev/__cache__";

      // Xây danh sách cache key cần xóa
      let keysToDelete = [];
      if (target === "blog-index") {
        keysToDelete = ["blog-index"];
      } else if (target === "vault-index") {
        const grade = body.grade;
        keysToDelete = grade !== undefined
          ? [`vault-index-grade-${grade}`]
          : ["vault-index-grade-0", "vault-index-grade-10", "vault-index-grade-11", "vault-index-grade-12"];
      } else if (target === "notifications") {
        const grade = body.grade;
        keysToDelete = grade !== undefined
          ? [`notifications-grade-${grade}`]
          : ["notifications-grade-0", "notifications-grade-10", "notifications-grade-11", "notifications-grade-12"];
      } else {
        // "all" → xóa toàn bộ
        keysToDelete = [
          "blog-index",
          "vault-index-grade-0",
          "vault-index-grade-10",
          "vault-index-grade-11",
          "vault-index-grade-12",
          "notifications-grade-0",
          "notifications-grade-10",
          "notifications-grade-11",
          "notifications-grade-12",
        ];
      }

      const results = await Promise.all(
        keysToDelete.map(async (key) => {
          const deleted = await cache.delete(new Request(`${BASE}/${key}`));
          return { key, deleted };
        })
      );

      return new Response(JSON.stringify({ ok: true, purged: results }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  },
};
