// cloudflare-worker/vault-index-cache.js
// =========================================================
// API Gateway: Dùng chung 1 Worker cho mọi route index
//   GET  /vault-index?grade=0        → Danh sách Đề thi
//   GET  /vault-index?grade=10|11|12 → Index Bài giảng
//   GET  /blog-index                 → Index Tin tức / Blog
//   GET  /notifications?grade=0|10|11|12 → Thông báo theo khối
//   GET  /schedule?grade=0|10|11|12  → Thời khóa biểu theo khối
//   POST /purge                      → Xóa cache thủ công (Admin)
//   POST /proxy/:method              → Proxy cho Telegram Bot API
//   GET  /getFile/:fileId            → Proxy tải file Telegram
// =========================================================

const SUPABASE_URL = "https://ndhcwrczwbehyznnxzou.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kaGN3cmN6d2JlaHl6bm54em91Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwNzk0OTEsImV4cCI6MjA4NzY1NTQ5MX0.-LAbz_xMZdPlHlvyaYrotonX_sKoTLwNMEpHss5fun4";
const PURGE_SECRET = "physivault-purge-2025"; 

const ALLOWED_ORIGINS = [
  "https://physivault.vercel.app",
  "https://kholuutru.vercel.app", // Domain mới trong screenshot
  "http://localhost:5173",
  "http://localhost:3000",
];

// ─── Helper: Tạo CORS header đúng domain ───────────────────
function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-purge-secret", // Thêm Authorization
    "Access-Control-Expose-Headers": "x-cache, x-cache-key",
  };
}

// ─── Helper: Gọi Supabase rồi cache kết quả ────────────────
async function handleCache(cacheKey, supaPath, ttl, origin) {
  const cache = caches.default;
  const cacheReq = new Request(`https://physivault-proxy.hoaihuy2609.workers.dev/__cache__/${cacheKey}`);

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

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // Route 1: GET /vault-index
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

    // Route 2: GET /blog-index
    if (url.pathname === "/blog-index" && request.method === "GET") {
      return handleCache(
        "blog-index",
        "blog_index?select=telegram_file_id&order=updated_at.desc&limit=1",
        300,
        origin
      );
    }

    // Route 3: GET /notifications
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

    // Route 4: GET /schedule
    if (url.pathname === "/schedule" && request.method === "GET") {
      const grade = url.searchParams.get("grade") || "0";
      if (!["0", "10", "11", "12"].includes(grade)) {
        return new Response(JSON.stringify({ error: "Invalid grade" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
        });
      }
      return handleCache(
        `schedule-grade-${grade}`,
        `schedules?select=*&grade=eq.${grade}&order=date.asc&order=start_time.asc`,
        300,
        origin
      );
    }

    // Route 5: PROXY TELEGRAM (Proxy cho bot)
    if (url.pathname.startsWith("/proxy/")) {
      const method = url.pathname.replace("/proxy/", "");
      const tgUrl = `https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/${method}${url.search}`;
      
      const newRequest = new Request(tgUrl, {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });

      try {
        const response = await fetch(newRequest);
        const newResponse = new Response(response.body, response);
        // Gắn lại CORS cho domain frontend
        Object.entries(corsHeaders(origin)).forEach(([k, v]) => newResponse.headers.set(k, v));
        return newResponse;
      } catch (err) {
        return new Response(JSON.stringify({ error: "Telegram Proxy error", detail: err.message }), {
          status: 502,
          headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
        });
      }
    }

    // Route 6: TẢI FILE TELEGRAM (Proxy tải file)
    if (url.pathname.startsWith("/getFile/") && request.method === "GET") {
      const fileId = url.pathname.split("/").pop();
      try {
        // Bước 1: Lấy file path từ Telegram
        const getFileRes = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/getFile?file_id=${fileId}`);
        const getFileData = await getFileRes.json();
        
        if (!getFileData.ok) {
          return new Response(JSON.stringify({ error: "Telegram GetFile failed", detail: getFileData }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
          });
        }
        
        const filePath = getFileData.result.file_path;
        // Bước 2: Tải file thật từ server Telegram
        const fileRes = await fetch(`https://api.telegram.org/file/bot${env.TELEGRAM_TOKEN}/${filePath}`);
        
        const response = new Response(fileRes.body, fileRes);
        Object.entries(corsHeaders(origin)).forEach(([k, v]) => response.headers.set(k, v));
        response.headers.set("Cache-Control", "public, max-age=31536000, immutable");
        return response;
      } catch (err) {
        return new Response(JSON.stringify({ error: "File download error", detail: err.message }), {
          status: 502,
          headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
        });
      }
    }

    // Route: PURGE
    if (url.pathname === "/purge" && request.method === "POST") {
      const auth = request.headers.get("x-purge-secret");
      if (auth !== PURGE_SECRET) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
        });
      }

      let body = {};
      try { body = await request.json(); } catch { }

      const target = body.target || "all";
      const cache = caches.default;
      const BASE = "https://physivault-proxy.hoaihuy2609.workers.dev/__cache__";

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
      } else if (target === "schedule") {
        const grade = body.grade;
        keysToDelete = grade !== undefined
          ? [`schedule-grade-${grade}`]
          : ["schedule-grade-0", "schedule-grade-10", "schedule-grade-11", "schedule-grade-12"];
      } else {
        keysToDelete = [
          "blog-index",
          "vault-index-grade-0", "vault-index-grade-10", "vault-index-grade-11", "vault-index-grade-12",
          "notifications-grade-0", "notifications-grade-10", "notifications-grade-11", "notifications-grade-12",
          "schedule-grade-0", "schedule-grade-10", "schedule-grade-11", "schedule-grade-12",
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
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  },
};

