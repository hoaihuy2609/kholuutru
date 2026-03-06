-- =================================================================
-- Table: blog_index
-- Mục đích: Lưu file_id Telegram của file JSON chứa toàn bộ bài viết
-- Chỉ có 1 row (id=1), cực kỳ nhỏ — không tốn Supabase storage đáng kể
-- =================================================================
CREATE TABLE IF NOT EXISTS blog_index (
    id          INTEGER PRIMARY KEY DEFAULT 1,
    telegram_file_id TEXT NOT NULL,
    blog_count  INTEGER DEFAULT 0,
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chặn thêm row thứ 2 (chỉ cho phép id=1)
ALTER TABLE blog_index ADD CONSTRAINT blog_index_single_row CHECK (id = 1);

-- RLS: Học sinh (anon) chỉ được đọc, chỉ admin mới được ghi
ALTER TABLE blog_index ENABLE ROW LEVEL SECURITY;

-- Tất cả người dùng có thể đọc file_id để fetch blog
CREATE POLICY "blog_index_read_all" ON blog_index
    FOR SELECT USING (true);

-- Chỉ service_role (backend/admin) mới được upsert
CREATE POLICY "blog_index_write_admin" ON blog_index
    FOR ALL USING (auth.role() = 'service_role');

-- =================================================================
-- Ghi chú:
-- • Admin viết blog trong app → lưu local IndexedDB
-- • Admin bấm "Sync Blog" trong Cloud Sync → upload JSON lên Telegram
--   → Cloudflare Worker nhận → trả file_id → upsert vào bảng này
-- • Học sinh fetch: đọc telegram_file_id từ bảng này → tải JSON về
-- • Không còn bảng "blogs" (xóa nếu đã tạo trước đó)
-- =================================================================

-- Xóa bảng blogs cũ nếu có (optional, chỉ chạy nếu cần)
-- DROP TABLE IF EXISTS blogs;
