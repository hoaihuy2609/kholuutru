-- Xóa hàng loạt học viên từ trang quản trị.
-- Chạy migration này trên Supabase trước khi triển khai giao diện mới.

DROP FUNCTION IF EXISTS admin_delete_students(text[]);

CREATE OR REPLACE FUNCTION admin_delete_students(p_phones text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM students
    WHERE phone = ANY(p_phones);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_delete_students(text[]) TO anon;
