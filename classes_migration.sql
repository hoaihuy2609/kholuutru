-- ============================================================
-- MIGRATION: Tạo bảng classes & cập nhật bảng students
-- Chạy script này trên Supabase SQL Editor
-- ============================================================

-- 1. Tạo bảng classes (Danh sách lớp học)
CREATE TABLE IF NOT EXISTS classes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,           -- Tên lớp: 12A1, 11B2, ...
    grade INTEGER NOT NULL,       -- Khối: 10, 11, 12
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Thêm cột class_id vào bảng students (cho phép NULL = chưa xếp lớp)
ALTER TABLE students ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES classes(id) ON DELETE SET NULL;

-- 3. Bật RLS cho bảng classes
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

-- 4. Tạo policy cho phép mọi thao tác (vì chúng ta dùng anon key cho admin)
CREATE POLICY "Allow all operations on classes" ON classes
    FOR ALL USING (true) WITH CHECK (true);

-- 5. Thêm một vài lớp mẫu (tuỳ chọn, có thể bỏ qua)
-- INSERT INTO classes (name, grade) VALUES
--     ('12A1', 12), ('12A2', 12), ('12A3', 12),
--     ('11A1', 11), ('11A2', 11),
--     ('10A1', 10), ('10A2', 10);
