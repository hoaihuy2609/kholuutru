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

    // Security Check: Block requests from unauthorized referers
    const referer = request.headers.get("Referer");
    const isAllowedReferer = referer && ALLOWED_ORIGINS.some(allowed => referer.startsWith(allowed));
    
    if (!isAllowedReferer) {
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
    // TTL: 300s — khớp chu kỳ refresh_leaderboard. Fix: BXH 20s → 70ms
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

    // Route 6: POST /vote — Ghi nhận vote câu hỏi khó (2 lớp phòng thủ)
    // Lớp 1: Edge Lock (Cache API) — chặn spam ngay tại Cloudflare, không chạm DB
    // Lớp 2: DB đã có ON CONFLICT DO NOTHING — phòng thủ tầng cuối
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

      // Edge Lock: 1 SĐT chỉ được vote 1 câu/đề 1 lần duy nhất (khóa 1 giờ)
      const lockKey = new Request(
        `https://physivault-proxy.hoaihuy2609.workers.dev/__votelock__/${student_phone}-${exam_id}-${part_name}-${question_number}`
      );
      const alreadyLocked = await caches.default.match(lockKey);
      if (alreadyLocked) {
        // Trả về thành công ngay — học sinh không biết bị chặn, không bực bội
        return new Response(JSON.stringify({ success: true, note: "Vote đã được ghi nhận" }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
        });
      }

      // Ghi khóa vào Edge Cache (1 giờ)
      await caches.default.put(lockKey, new Response("locked", {
        headers: { "Cache-Control": "public, max-age=3600" },
      }));

      // Ghi vào DB qua REST (DB đã có ON CONFLICT DO NOTHING để bảo vệ tầng cuối)
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
        // Xóa lock nếu ghi DB thất bại để học sinh có thể thử lại
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

    // Route 7: MỞ XEM FILE TELEGRAM (Proxy + Edge Cache vĩnh viễn)
    // Fix: Cloudflare Cache PDF → Telegram chỉ bị gọi đúng 1 lần/file
    // Lần 2 trở đi: Cloudflare phục vụ ngay, không qua Telegram → Fix lỗi 11%
    if (url.pathname.startsWith("/getFile/") && request.method === "GET") {
      const fileId = url.pathname.split("/").pop();
      const cache = caches.default;
      const cacheReq = new Request(`https://physivault-proxy.hoaihuy2609.workers.dev/__filecache__/${fileId}`);

      // Kiểm tra cache trước — tránh gọi Telegram nếu đã có
      const cachedFile = await cache.match(cacheReq);
      if (cachedFile) {
        const resp = new Response(cachedFile.body, cachedFile);
        Object.entries(corsHeaders(origin)).forEach(([k, v]) => resp.headers.set(k, v));
        resp.headers.set("x-cache", "HIT");
        return resp;
      }

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
        // Bước 2: Tải file thật từ Telegram
        const fileRes = await fetch(`https://api.telegram.org/file/bot${env.TELEGRAM_TOKEN}/${filePath}`);
        if (!fileRes.ok) throw new Error(`Telegram file fetch failed: ${fileRes.status}`);

        const fileBuffer = await fileRes.arrayBuffer();
        const contentType = fileRes.headers.get("Content-Type") || "application/octet-stream";

        // Lưu vào Cloudflare Cache (1 năm — file đề thi không bao giờ thay đổi)
        await cache.put(
          cacheReq,
          new Response(fileBuffer, {
            headers: {
              "Content-Type": contentType,
              "Cache-Control": "public, max-age=31536000, immutable",
            },
          })
        );

        const response = new Response(fileBuffer, {
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=31536000, immutable",
            "x-cache": "MISS",
            ...corsHeaders(origin),
          },
        });
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
      } else if (target === "leaderboard") {
        const grade = body.grade;
        keysToDelete = grade !== undefined
          ? [`leaderboard-grade-${grade}`]
          : ["leaderboard-grade-0", "leaderboard-grade-10", "leaderboard-grade-11", "leaderboard-grade-12"];
      } else {
        // "all" → xóa toàn bộ cache bao gồm cả leaderboard
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

    // ── Route: GET /comments?exam_id=xxx ─────────────────────────────
    // Lấy danh sách comment theo đề thi từ Cloudflare D1
    if (url.pathname === "/comments" && request.method === "GET") {
      const examId = url.searchParams.get("exam_id");
      if (!examId) {
        return new Response(JSON.stringify({ error: "Thiếu exam_id" }), {
          status: 400, headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
        });
      }
      try {
        const { results } = await env.DB.prepare(
          "SELECT * FROM exam_comments WHERE exam_id = ? AND is_deleted = 0 ORDER BY created_at DESC LIMIT 100"
        ).bind(examId).all();
        return new Response(JSON.stringify(results), {
          headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: "DB error", detail: err.message }), {
          status: 500, headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
        });
      }
    }

    // ── Route: POST /comments ─────────────────────────────────────────
    // Đăng comment mới vào D1
    if (url.pathname === "/comments" && request.method === "POST") {
      let body = {};
      try { body = await request.json(); } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON" }), {
          status: 400, headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
        });
      }
      const { exam_id, author_id, author_name, text, image_url } = body;
      if (!exam_id || !author_id || !author_name || (!text && !image_url)) {
        return new Response(JSON.stringify({ error: "Thiếu dữ liệu bắt buộc" }), {
          status: 400, headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
        });
      }
      // Rate limit: 1 SĐT/machine chỉ gửi 1 comment/10 giây
      const rateLimitKey = new Request(
        `https://physivault-proxy.hoaihuy2609.workers.dev/__comment_rl__/${author_id}`
      );
      if (await caches.default.match(rateLimitKey)) {
        return new Response(JSON.stringify({ error: "Gửi quá nhanh, thử lại sau" }), {
          status: 429, headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
        });
      }
      await caches.default.put(rateLimitKey, new Response("rl", {
        headers: { "Cache-Control": "public, max-age=10" },
      }));

      const id = crypto.randomUUID();
      const created_at = Date.now();
      try {
        await env.DB.prepare(
          "INSERT INTO exam_comments (id, exam_id, author_id, author_name, text, image_url, created_at, is_deleted) VALUES (?, ?, ?, ?, ?, ?, ?, 0)"
        ).bind(id, exam_id, author_id, author_name, text || "", image_url || null, created_at).run();
        return new Response(JSON.stringify({ id, exam_id, author_id, author_name, text, image_url, created_at }), {
          status: 201, headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: "DB error", detail: err.message }), {
          status: 500, headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
        });
      }
    }

    // ── Route: DELETE /comments/:id ───────────────────────────────────
    // Admin xóa mềm comment (set is_deleted = 1)
    if (url.pathname.startsWith("/comments/") && request.method === "DELETE") {
      const auth = request.headers.get("Authorization") || "";
      const adminKey = env.ADMIN_KEY || "";
      if (!adminKey || auth !== `Bearer ${adminKey}`) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
        });
      }
      const commentId = url.pathname.split("/comments/")[1];
      if (!commentId) {
        return new Response(JSON.stringify({ error: "Thiếu comment ID" }), {
          status: 400, headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
        });
      }
      try {
        await env.DB.prepare(
          "UPDATE exam_comments SET is_deleted = 1 WHERE id = ?"
        ).bind(commentId).run();
        return new Response(JSON.stringify({ success: true }), {
          headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: "DB error", detail: err.message }), {
          status: 500, headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
        });
      }
    }

    // ── Route: POST /upload-image ─────────────────────────────────────
    // Upload ảnh comment lên Cloudflare R2
    if (url.pathname === "/upload-image" && request.method === "POST") {
      const contentType = request.headers.get("Content-Type") || "image/jpeg";
      const fileNameEncoded = request.headers.get("x-file-name") || `comments/${Date.now()}.jpg`;
      const fileName = decodeURIComponent(fileNameEncoded);

      // Giới hạn 5MB
      const contentLength = parseInt(request.headers.get("Content-Length") || "0");
      if (contentLength > 5 * 1024 * 1024) {
        return new Response(JSON.stringify({ error: "Ảnh tối đa 5MB" }), {
          status: 413, headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
        });
      }

      try {
        const buffer = await request.arrayBuffer();
        await env.IMAGES.put(fileName, buffer, {
          httpMetadata: { contentType },
        });
        // Public URL của R2 object (cần bật Public Access trên bucket)
        const publicUrl = `${env.R2_PUBLIC_URL}/${fileName}`;
        return new Response(JSON.stringify({ url: publicUrl }), {
          status: 201, headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: "Upload thất bại", detail: err.message }), {
          status: 500, headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
        });
      }
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  },
};

