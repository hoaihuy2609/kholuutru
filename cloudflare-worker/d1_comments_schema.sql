-- =========================================================
-- Cloudflare D1 Migration: Tạo bảng exam_comments
-- Chạy lệnh: wrangler d1 execute physivault-comments --file=./cloudflare-worker/d1_comments_schema.sql
-- =========================================================

CREATE TABLE IF NOT EXISTS exam_comments (
    id          TEXT PRIMARY KEY,       -- UUID
    exam_id     TEXT NOT NULL,          -- ID của đề thi
    author_id   TEXT NOT NULL,          -- machine_id của học sinh (ẩn danh)
    author_name TEXT NOT NULL,          -- Nickname tự đặt
    text        TEXT NOT NULL DEFAULT '',
    image_url   TEXT,                   -- URL ảnh trên Cloudflare R2 (nullable)
    created_at  INTEGER NOT NULL,       -- Timestamp milliseconds
    is_deleted  INTEGER NOT NULL DEFAULT 0  -- 0 = hiển thị, 1 = đã xóa (soft delete)
);

-- Index để query nhanh theo exam_id
CREATE INDEX IF NOT EXISTS idx_comments_exam_id ON exam_comments(exam_id, is_deleted, created_at DESC);
