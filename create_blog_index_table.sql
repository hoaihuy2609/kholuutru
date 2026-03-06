-- =================================================================
-- FIX: Tạo bảng blog_index với RLS cho phép anon ghi
-- (Vì app dùng anon key, không phải service_role key)
-- =================================================================

-- Tạo bảng nếu chưa có
CREATE TABLE IF NOT EXISTS blog_index (
    id          INTEGER PRIMARY KEY DEFAULT 1,
    telegram_file_id TEXT NOT NULL,
    blog_count  INTEGER DEFAULT 0,
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chặn thêm row thứ 2 (chỉ cho phép id=1)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'blog_index_single_row'
    ) THEN
        ALTER TABLE blog_index ADD CONSTRAINT blog_index_single_row CHECK (id = 1);
    END IF;
END $$;

-- Bật RLS
ALTER TABLE blog_index ENABLE ROW LEVEL SECURITY;

-- XÓA policies cũ nếu có
DROP POLICY IF EXISTS "blog_index_read_all" ON blog_index;
DROP POLICY IF EXISTS "blog_index_write_admin" ON blog_index;

-- ✅ FIX: Cho phép TẤT CẢ đọc (anon + authenticated)
CREATE POLICY "blog_index_read_all" ON blog_index
    FOR SELECT USING (true);

-- ✅ FIX: Cho phép anon ghi (app dùng anon key)
-- blog_index chỉ chứa telegram_file_id, không phải dữ liệu nhạy cảm
CREATE POLICY "blog_index_write_all" ON blog_index
    FOR ALL USING (true) WITH CHECK (true);

-- =================================================================
-- Ghi chú:
-- Bảng này chỉ có 1 row duy nhất chứa telegram_file_id của file JSON blog.
-- Không phải dữ liệu nhạy cảm → cho phép anon ghi là OK.
-- =================================================================
