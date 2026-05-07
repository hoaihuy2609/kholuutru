// cloudflare-worker/comment-worker.js
// =========================================================
// Worker riêng biệt cho hệ thống Comment đề thi PhysiVault
//
// Bindings cần thiết (cấu hình trên Cloudflare Dashboard):
//   D1 Database : DB           → physivault-comments-db
//   R2 Bucket   : IMAGES       → physivault-images
//   Env Var     : ADMIN_KEY    → giống VITE_ADMIN_KEY trên Vercel
//   Env Var     : R2_PUBLIC_URL → https://pub-xxx.r2.dev (lấy sau khi bật Public Access)
//
// Routes:
//   GET  /comments?exam_id=xxx  → Lấy danh sách comment
//   POST /comments              → Đăng comment mới (text + ảnh)
//   DELETE /comments/:id        → Admin xóa mềm comment
//   POST /upload-image          → Upload ảnh lên R2
//   GET  /health                → Kiểm tra Worker còn sống
// =========================================================

const ALLOWED_ORIGINS = [
  "https://physivault.vercel.app",
  "https://kholuutru.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
];

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const RATE_LIMIT_SECONDS = 10;          // 1 comment/10 giây/user
const MAX_COMMENTS_PER_EXAM = 100;
const MAX_TEXT_LENGTH = 1000;           // Tối đa 1000 ký tự/comment

// ── CORS ────────────────────────────────────────────────────────
function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-file-name",
  };
}

function json(data, status = 200, origin = "") {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

// ── Entry Point ─────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    // Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // Security: chỉ cho phép từ domain đã whitelist
    const referer = request.headers.get("Referer") || "";
    const isAllowed = ALLOWED_ORIGINS.some(o => referer.startsWith(o));
    if (!isAllowed) {
      return json({ error: "Forbidden" }, 403, origin);
    }

    // ── GET /health ─────────────────────────────────────────────
    if (url.pathname === "/health" && request.method === "GET") {
      return json({ status: "ok", worker: "physivault-comments", ts: Date.now() }, 200, origin);
    }

    // ── GET /comments?exam_id=xxx ────────────────────────────────
    if (url.pathname === "/comments" && request.method === "GET") {
      const examId = url.searchParams.get("exam_id");
      if (!examId) return json({ error: "Thiếu exam_id" }, 400, origin);

      try {
        const { results } = await env.DB.prepare(
          `SELECT id, exam_id, author_id, author_name, text, image_url, created_at
           FROM exam_comments
           WHERE exam_id = ? AND is_deleted = 0
           ORDER BY created_at DESC
           LIMIT ?`
        ).bind(examId, MAX_COMMENTS_PER_EXAM).all();

        return json(results, 200, origin);
      } catch (err) {
        console.error("[GET /comments]", err);
        return json({ error: "Lỗi database" }, 500, origin);
      }
    }

    // ── POST /comments ───────────────────────────────────────────
    if (url.pathname === "/comments" && request.method === "POST") {
      let body = {};
      try { body = await request.json(); } catch {
        return json({ error: "Body không hợp lệ" }, 400, origin);
      }

      const { exam_id, author_id, author_name, text, image_url } = body;

      // Validate
      if (!exam_id || !author_id || !author_name) {
        return json({ error: "Thiếu thông tin bắt buộc (exam_id, author_id, author_name)" }, 400, origin);
      }
      if (!text?.trim() && !image_url) {
        return json({ error: "Bình luận phải có nội dung hoặc ảnh" }, 400, origin);
      }
      if (text && text.length > MAX_TEXT_LENGTH) {
        return json({ error: `Nội dung tối đa ${MAX_TEXT_LENGTH} ký tự` }, 400, origin);
      }
      if (author_name.length > 30) {
        return json({ error: "Tên hiển thị tối đa 30 ký tự" }, 400, origin);
      }

      // Rate limit: 1 comment / RATE_LIMIT_SECONDS / user
      const rlKey = new Request(
        `https://physivault-comments.workers.dev/__rl__/${author_id}`
      );
      if (await caches.default.match(rlKey)) {
        return json({ error: `Gửi quá nhanh, thử lại sau ${RATE_LIMIT_SECONDS} giây` }, 429, origin);
      }
      await caches.default.put(rlKey, new Response("1", {
        headers: { "Cache-Control": `public, max-age=${RATE_LIMIT_SECONDS}` },
      }));

      const id = crypto.randomUUID();
      const created_at = Date.now();

      try {
        await env.DB.prepare(
          `INSERT INTO exam_comments
             (id, exam_id, author_id, author_name, text, image_url, created_at, is_deleted)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0)`
        ).bind(
          id, exam_id, author_id, author_name,
          text?.trim() || "",
          image_url || null,
          created_at
        ).run();

        return json({ id, exam_id, author_id, author_name, text, image_url, created_at }, 201, origin);
      } catch (err) {
        console.error("[POST /comments]", err);
        return json({ error: "Lỗi lưu bình luận" }, 500, origin);
      }
    }

    // ── DELETE /comments/:id ─────────────────────────────────────
    if (url.pathname.startsWith("/comments/") && request.method === "DELETE") {
      // Auth: chỉ Admin
      const auth = request.headers.get("Authorization") || "";
      if (!env.ADMIN_KEY || auth !== `Bearer ${env.ADMIN_KEY}`) {
        return json({ error: "Không có quyền" }, 401, origin);
      }

      const commentId = url.pathname.replace("/comments/", "");
      if (!commentId) return json({ error: "Thiếu comment ID" }, 400, origin);

      try {
        const info = await env.DB.prepare(
          "UPDATE exam_comments SET is_deleted = 1 WHERE id = ?"
        ).bind(commentId).run();

        if (info.changes === 0) {
          return json({ error: "Không tìm thấy bình luận" }, 404, origin);
        }
        return json({ success: true, deleted_id: commentId }, 200, origin);
      } catch (err) {
        console.error("[DELETE /comments]", err);
        return json({ error: "Lỗi xóa bình luận" }, 500, origin);
      }
    }

    // ── POST /upload-image ───────────────────────────────────────
    if (url.pathname === "/upload-image" && request.method === "POST") {
      const contentType = request.headers.get("Content-Type") || "image/jpeg";

      // Chỉ nhận file ảnh
      if (!contentType.startsWith("image/")) {
        return json({ error: "Chỉ hỗ trợ file ảnh (image/*)" }, 415, origin);
      }

      // Kiểm tra kích thước
      const contentLength = parseInt(request.headers.get("Content-Length") || "0");
      if (contentLength > MAX_IMAGE_SIZE) {
        return json({ error: "Kích thước ảnh tối đa 5MB" }, 413, origin);
      }

      const fileNameHeader = request.headers.get("x-file-name") || "";
      const fileName = fileNameHeader
        ? decodeURIComponent(fileNameHeader)
        : `comments/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.jpg`;

      try {
        const buffer = await request.arrayBuffer();
        // Kiểm tra kích thước thực (phòng trường hợp Content-Length sai)
        if (buffer.byteLength > MAX_IMAGE_SIZE) {
          return json({ error: "Kích thước ảnh tối đa 5MB" }, 413, origin);
        }

        await env.IMAGES.put(fileName, buffer, {
          httpMetadata: { contentType },
        });

        const publicUrl = `${env.R2_PUBLIC_URL}/${fileName}`;
        return json({ url: publicUrl, file_name: fileName }, 201, origin);
      } catch (err) {
        console.error("[POST /upload-image]", err);
        return json({ error: "Upload ảnh thất bại" }, 500, origin);
      }
    }


    // ── GET /game/topics?grade=0 ─────────────────────────────────
    if (url.pathname === "/game/topics" && request.method === "GET") {
      const grade = parseInt(url.searchParams.get("grade") || "0", 10);
      try {
        const query = grade > 0
          ? `SELECT DISTINCT topic, grade FROM game_questions WHERE (grade = ? OR grade = 0) AND topic IS NOT NULL AND topic != '' ORDER BY grade, topic`
          : `SELECT DISTINCT topic, grade FROM game_questions WHERE topic IS NOT NULL AND topic != '' ORDER BY grade, topic`;
        const stmt = grade > 0
          ? env.DB.prepare(query).bind(grade)
          : env.DB.prepare(query);
        const { results } = await stmt.all();
        return json(results, 200, origin);
      } catch (err) {
        console.error("[GET /game/topics]", err);
        return json({ error: "Lỗi database" }, 500, origin);
      }
    }

    // ── GET /game/questions?grade=0&topic=...&limit=100&shuffle=true ─
    if (url.pathname === "/game/questions" && request.method === "GET") {
      const grade = parseInt(url.searchParams.get("grade") || "0", 10);
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "100", 10), 500);
      const topic = url.searchParams.get("topic") || "";
      const shuffle = url.searchParams.get("shuffle") !== "false"; // default true
      const orderBy = shuffle ? "ORDER BY RANDOM()" : "ORDER BY created_at ASC";
      try {
        let query = "";
        let params = [];
        if (grade > 0 && topic) {
          query = `SELECT id, question, option_a, option_b, option_c, option_d, answer, grade, topic, explanation FROM game_questions WHERE (grade = ? OR grade = 0) AND topic = ? ${orderBy} LIMIT ?`;
          params = [grade, topic, limit];
        } else if (grade > 0) {
          query = `SELECT id, question, option_a, option_b, option_c, option_d, answer, grade, topic, explanation FROM game_questions WHERE (grade = ? OR grade = 0) ${orderBy} LIMIT ?`;
          params = [grade, limit];
        } else if (topic) {
          query = `SELECT id, question, option_a, option_b, option_c, option_d, answer, grade, topic, explanation FROM game_questions WHERE topic = ? ${orderBy} LIMIT ?`;
          params = [topic, limit];
        } else {
          query = `SELECT id, question, option_a, option_b, option_c, option_d, answer, grade, topic, explanation FROM game_questions ${orderBy} LIMIT ?`;
          params = [limit];
        }
        const { results } = await env.DB.prepare(query).bind(...params).all();
        return json(results, 200, origin);
      } catch (err) {
        console.error("[GET /game/questions]", err);
        return json({ error: "Lỗi database" }, 500, origin);
      }
    }

    // ── POST /game/questions (Admin only) ────────────────────────
    if (url.pathname === "/game/questions" && request.method === "POST") {
      const auth = request.headers.get("Authorization") || "";
      if (!env.ADMIN_KEY || auth !== `Bearer ${env.ADMIN_KEY}`) {
        return json({ error: "Không có quyền" }, 401, origin);
      }
      let body = {};
      try { body = await request.json(); } catch {
        return json({ error: "Body không hợp lệ" }, 400, origin);
      }
      const { questions } = body;
      if (!Array.isArray(questions) || questions.length === 0) {
        return json({ error: "Cần truyền mảng questions" }, 400, origin);
      }
      try {
        const stmts = questions.map(q =>
          env.DB.prepare(
            `INSERT OR REPLACE INTO game_questions (id, question, option_a, option_b, option_c, option_d, answer, grade, topic, explanation, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            q.id || crypto.randomUUID(),
            q.question, q.option_a, q.option_b, q.option_c, q.option_d,
            q.answer, q.grade || 0, q.topic || null, q.explanation || null, Date.now()
          )
        );
        await env.DB.batch(stmts);
        return json({ success: true, count: questions.length }, 201, origin);
      } catch (err) {
        console.error("[POST /game/questions]", err);
        return json({ error: "Lỗi lưu câu hỏi" }, 500, origin);
      }
    }

    // ── PUT /game/questions/:id (Admin only) ─────────────────────
    if (url.pathname.startsWith("/game/questions/") && request.method === "PUT") {
      const auth = request.headers.get("Authorization") || "";
      if (!env.ADMIN_KEY || auth !== `Bearer ${env.ADMIN_KEY}`) {
        return json({ error: "Không có quyền" }, 401, origin);
      }
      const qId = url.pathname.replace("/game/questions/", "");
      if (!qId) return json({ error: "Thiếu ID" }, 400, origin);
      let body = {};
      try { body = await request.json(); } catch {
        return json({ error: "Body không hợp lệ" }, 400, origin);
      }
      const { question, option_a, option_b, option_c, option_d, answer, grade, topic, explanation } = body;
      if (!question || !option_a || !option_b || !option_c || !option_d || !answer) {
        return json({ error: "Thiếu thông tin bắt buộc" }, 400, origin);
      }
      if (!["A", "B", "C", "D"].includes(answer)) {
        return json({ error: "Đáp án phải là A, B, C hoặc D" }, 400, origin);
      }
      try {
        const info = await env.DB.prepare(
          `UPDATE game_questions
           SET question = ?, option_a = ?, option_b = ?, option_c = ?, option_d = ?,
               answer = ?, grade = ?, topic = ?, explanation = ?
           WHERE id = ?`
        ).bind(
          question, option_a, option_b, option_c, option_d,
          answer, grade || 0, topic || null, explanation || null,
          qId
        ).run();
        if (info.changes === 0) return json({ error: "Không tìm thấy câu hỏi" }, 404, origin);
        return json({ success: true, id: qId }, 200, origin);
      } catch (err) {
        console.error("[PUT /game/questions]", err);
        return json({ error: "Lỗi cập nhật câu hỏi" }, 500, origin);
      }
    }

    // ── DELETE /game/questions/:id (Admin only) ──────────────────
    if (url.pathname.startsWith("/game/questions/") && request.method === "DELETE") {
      const auth = request.headers.get("Authorization") || "";
      if (!env.ADMIN_KEY || auth !== `Bearer ${env.ADMIN_KEY}`) {
        return json({ error: "Không có quyền" }, 401, origin);
      }
      const qId = url.pathname.replace("/game/questions/", "");
      if (!qId) return json({ error: "Thiếu ID" }, 400, origin);
      try {
        const info = await env.DB.prepare("DELETE FROM game_questions WHERE id = ?").bind(qId).run();
        if (info.changes === 0) return json({ error: "Không tìm thấy câu hỏi" }, 404, origin);
        return json({ success: true, deleted_id: qId }, 200, origin);
      } catch (err) {
        console.error("[DELETE /game/questions]", err);
        return json({ error: "Lỗi xóa câu hỏi" }, 500, origin);
      }
    }

    return json({ error: "Route không tồn tại" }, 404, origin);
  },
};
