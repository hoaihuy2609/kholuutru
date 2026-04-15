// cloudflare-worker/vault-index-cache.js
// =========================================================
// API Gateway: Dùng chung 1 Worker cho mọi route index
//   GET  /vault-index?grade=0        → Danh sách Đề thi
//   GET  /vault-index?grade=10|11|12 → Index Bài giảng
//   GET  /blog-index                 → Index Tin tức / Blog
//   GET  /notifications?grade=0|10|11|12 → Thông báo theo khối
//   GET  /schedule?grade=0|10|11|12  → Thời khóa biểu theo khối
//   GET  /leaderboard?grade=0|10|11|12 → BXH theo khối (Cache 5 phút)
//   POST /purge                      → Xóa cache thủ công (Admin)
//   POST /proxy/:method              → Proxy cho Telegram Bot API
//   GET  /getFile/:fileId            → Proxy tải file Telegram (Cache 1 năm)
// NOTE: Comment API → Worker riêng: cloudflare-worker/comment-worker.js
// =========================================================

const SUPABASE_URL = "https://ndhcwrczwbehyznnxzou.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kaGN3cmN6d2JlaHl6bm54em91Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwNzk0OTEsImV4cCI6MjA4NzY1NTQ5MX0.-LAbz_xMZdPlHlvyaYrotonX_sKoTLwNMEpHss5fun4";
const PURGE_SECRET = "physivault-purge-2025"; 

const ALLOWED_ORIGINS = [
  "https://physivault.vercel.app",
  "https://kholuutru.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
];

// ─── Helper: Tạo CORS header đúng domain ───────────────────
function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-purge-secret",
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

    // Security Check: Block requests from unauthorized referers
    // EXCEPTION: /getFile/ is accessed directly by browser for file download → skip Referer check
    const referer = request.headers.get("Referer");
    const isGetFile = url.pathname.startsWith("/getFile/");
    const isAllowedReferer = referer && ALLOWED_ORIGINS.some(allowed => referer.startsWith(allowed));
    
    if (!isGetFile && !isAllowedReferer) {
      return new Response(JSON.stringify({ error: "Forbidden", message: "Invalid or Missing Referer" }), { 
        status: 403, 
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) } 
      });
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

    // Route 5: GET /leaderboard?grade=0|10|11|12
    if (url.pathname === "/leaderboard" && request.method === "GET") {
      const grade = url.searchParams.get("grade") || "0";
      if (!["0", "10", "11", "12"].includes(grade)) {
        return new Response(JSON.stringify({ error: "Invalid grade" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
        });
      }
      return handleCache(
        `leaderboard-grade-${grade}`,
        `leaderboard_cache?select=*&grade=eq.${grade}&order=avg_score.desc&limit=200`,
        300,
        origin
      );
    }

    // Route 6: POST /vote
    if (url.pathname === "/vote" && request.method === "POST") {
      let body = {};
      try { body = await request.json(); } catch { }

      const { exam_id, part_name, question_number, student_phone } = body;
      if (!exam_id || !part_name || !question_number || !student_phone) {
        return new Response(JSON.stringify({ error: "Thiếu dữ liệu" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
        });
      }

      const lockKey = new Request(
        `https://physivault-proxy.hoaihuy2609.workers.dev/__votelock__/${student_phone}-${exam_id}-${part_name}-${question_number}`
      );
      const alreadyLocked = await caches.default.match(lockKey);
      if (alreadyLocked) {
        return new Response(JSON.stringify({ success: true, note: "Vote đã được ghi nhận" }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
        });
      }

      await caches.default.put(lockKey, new Response("locked", {
        headers: { "Cache-Control": "public, max-age=3600" },
      }));

      try {
        const supaRes = await fetch(`${SUPABASE_URL}/rest/v1/question_votes`, {
          method: "POST",
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
          },
          body: JSON.stringify({ exam_id, part_name, question_number, student_phone }),
        });
        if (!supaRes.ok && supaRes.status !== 409) {
          throw new Error(`Supabase ${supaRes.status}`);
        }
      } catch (err) {
        await caches.default.delete(lockKey);
        return new Response(JSON.stringify({ error: "Lỗi ghi vote", detail: err.message }), {
          status: 502,
          headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    // Route 7: POST /proxy/:method → Telegram Bot API
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
        Object.entries(corsHeaders(origin)).forEach(([k, v]) => newResponse.headers.set(k, v));
        return newResponse;
      } catch (err) {
        return new Response(JSON.stringify({ error: "Telegram Proxy error", detail: err.message }), {
          status: 502,
          headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
        });
      }
    }

    // Route 8: GET /getFile/:fileId → Proxy tải file Telegram (Cache 1 năm)
    if (url.pathname.startsWith("/getFile/") && request.method === "GET") {
      const fileId = url.pathname.split("/").pop();
      const cache = caches.default;
      const cacheReq = new Request(`https://physivault-proxy.hoaihuy2609.workers.dev/__filecache__/${fileId}`);

      const cachedFile = await cache.match(cacheReq);
      if (cachedFile) {
        const resp = new Response(cachedFile.body, cachedFile);
        Object.entries(corsHeaders(origin)).forEach(([k, v]) => resp.headers.set(k, v));
        resp.headers.set("x-cache", "HIT");
        return resp;
      }

      try {
        const getFileRes = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/getFile?file_id=${fileId}`);
        const getFileData = await getFileRes.json();

        if (!getFileData.ok) {
          return new Response(JSON.stringify({ error: "Telegram GetFile failed", detail: getFileData }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
          });
        }

        const filePath = getFileData.result.file_path;
        const fileRes = await fetch(`https://api.telegram.org/file/bot${env.TELEGRAM_TOKEN}/${filePath}`);
        if (!fileRes.ok) throw new Error(`Telegram file fetch failed: ${fileRes.status}`);

        const fileBuffer = await fileRes.arrayBuffer();
        const contentType = fileRes.headers.get("Content-Type") || "application/octet-stream";

        // Determine filename from file_path or use a sensible default
        const rawFileName = filePath ? filePath.split("/").pop() : "mau_phieu_thi.pdf";
        const downloadName = rawFileName.endsWith(".pdf") ? rawFileName : "mau_phieu_thi.pdf";
        const contentDisposition = `attachment; filename="${downloadName}"`;

        await cache.put(
          cacheReq,
          new Response(fileBuffer, {
            headers: {
              "Content-Type": contentType,
              "Content-Disposition": contentDisposition,
              "Cache-Control": "public, max-age=31536000, immutable",
            },
          })
        );

        return new Response(fileBuffer, {
          headers: {
            "Content-Type": contentType,
            "Content-Disposition": contentDisposition,
            "Cache-Control": "public, max-age=31536000, immutable",
            "x-cache": "MISS",
            ...corsHeaders(origin),
          },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: "File download error", detail: err.message }), {
          status: 502,
          headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
        });
      }
    }

    // Route 9: POST /purge
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
      } else if (target === "leaderboard") {
        const grade = body.grade;
        keysToDelete = grade !== undefined
          ? [`leaderboard-grade-${grade}`]
          : ["leaderboard-grade-0", "leaderboard-grade-10", "leaderboard-grade-11", "leaderboard-grade-12"];
      } else {
        keysToDelete = [
          "blog-index",
          "vault-index-grade-0", "vault-index-grade-10", "vault-index-grade-11", "vault-index-grade-12",
          "notifications-grade-0", "notifications-grade-10", "notifications-grade-11", "notifications-grade-12",
          "schedule-grade-0", "schedule-grade-10", "schedule-grade-11", "schedule-grade-12",
          "leaderboard-grade-0", "leaderboard-grade-10", "leaderboard-grade-11", "leaderboard-grade-12",
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
