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

-- =========================================================
-- Game Questions Table — dùng cho Physics Blitz và các game
-- =========================================================
CREATE TABLE IF NOT EXISTS game_questions (
    id          TEXT PRIMARY KEY,       -- UUID
    question    TEXT NOT NULL,          -- Nội dung câu hỏi
    option_a    TEXT NOT NULL,          -- Đáp án A
    option_b    TEXT NOT NULL,          -- Đáp án B
    option_c    TEXT NOT NULL,          -- Đáp án C
    option_d    TEXT NOT NULL,          -- Đáp án D
    answer      TEXT NOT NULL,          -- Đáp án đúng: 'A' | 'B' | 'C' | 'D'
    grade       INTEGER NOT NULL DEFAULT 0, -- 10, 11, 12 hoặc 0 = tất cả
    topic       TEXT,                   -- Chủ đề (tùy chọn)
    created_at  INTEGER NOT NULL        -- Timestamp milliseconds
);

-- Index để query nhanh theo grade
CREATE INDEX IF NOT EXISTS idx_game_questions_grade ON game_questions(grade, created_at DESC);
