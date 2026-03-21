-- =====================================================
-- CHỈ TẠO CÁC HÀM RPC ADMIN MỚI (v2 — fix uuid cast)
-- Copy toàn bộ file này vào Supabase SQL Editor → RUN
-- =====================================================

-- [1] Upsert student (SettingsModal: tạo mã kích hoạt)
DROP FUNCTION IF EXISTS admin_upsert_student(text, text, text, text, boolean, int);
CREATE OR REPLACE FUNCTION admin_upsert_student(
    p_phone          text,
    p_name           text,
    p_machine_id     text,
    p_activation_key text,
    p_is_active      boolean,
    p_grade          int
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO students (phone, name, machine_id, activation_key, is_active, grade)
    VALUES (p_phone, p_name, p_machine_id, p_activation_key, p_is_active, p_grade)
    ON CONFLICT (phone) DO UPDATE SET
        name           = EXCLUDED.name,
        machine_id     = EXCLUDED.machine_id,
        activation_key = EXCLUDED.activation_key,
        is_active      = EXCLUDED.is_active,
        grade          = EXCLUDED.grade;
END;
$$;
GRANT EXECUTE ON FUNCTION admin_upsert_student(text, text, text, text, boolean, int) TO anon;

-- [2] Thêm học sinh mới (AdminDashboard) — ép class_id sang uuid
DROP FUNCTION IF EXISTS admin_add_student(text, text, int, text);
CREATE OR REPLACE FUNCTION admin_add_student(
    p_phone    text,
    p_name     text,
    p_grade    int,
    p_class_id text DEFAULT ''
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF p_class_id IS NULL OR p_class_id = '' THEN
        INSERT INTO students (phone, name, grade, class_id, is_active, activation_key, machine_id)
        VALUES (p_phone, p_name, p_grade, NULL, true, '', '');
    ELSE
        INSERT INTO students (phone, name, grade, class_id, is_active, activation_key, machine_id)
        VALUES (p_phone, p_name, p_grade, p_class_id::uuid, true, '', '');
    END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION admin_add_student(text, text, int, text) TO anon;

-- [3] Cập nhật lớp cho học sinh — ép class_id sang uuid
DROP FUNCTION IF EXISTS admin_update_student_class(text, text);
CREATE OR REPLACE FUNCTION admin_update_student_class(
    p_phone    text,
    p_class_id text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF p_class_id IS NULL OR p_class_id = '' THEN
        UPDATE students SET class_id = NULL WHERE phone = p_phone;
    ELSE
        UPDATE students SET class_id = p_class_id::uuid WHERE phone = p_phone;
    END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION admin_update_student_class(text, text) TO anon;

-- [4] Xóa học sinh
DROP FUNCTION IF EXISTS admin_delete_student(text);
CREATE OR REPLACE FUNCTION admin_delete_student(p_phone text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    DELETE FROM students WHERE phone = p_phone;
END;
$$;
GRANT EXECUTE ON FUNCTION admin_delete_student(text) TO anon;

-- [5] Kick học sinh
DROP FUNCTION IF EXISTS admin_kick_student(text);
CREATE OR REPLACE FUNCTION admin_kick_student(p_phone text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE students SET is_active = false WHERE phone = p_phone;
END;
$$;
GRANT EXECUTE ON FUNCTION admin_kick_student(text) TO anon;

-- [6] Unkick học sinh
DROP FUNCTION IF EXISTS admin_unkick_student(text);
CREATE OR REPLACE FUNCTION admin_unkick_student(p_phone text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE students SET is_active = true, machine_id = '', activation_key = '' WHERE phone = p_phone;
END;
$$;
GRANT EXECUTE ON FUNCTION admin_unkick_student(text) TO anon;

-- [7] Quản lý lớp học
DROP FUNCTION IF EXISTS admin_add_class(text, int);
CREATE OR REPLACE FUNCTION admin_add_class(p_name text, p_grade int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO classes (name, grade) VALUES (p_name, p_grade);
END;
$$;
GRANT EXECUTE ON FUNCTION admin_add_class(text, int) TO anon;

DROP FUNCTION IF EXISTS admin_update_class(text, text, int);
CREATE OR REPLACE FUNCTION admin_update_class(p_id text, p_name text, p_grade int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE classes SET name = p_name, grade = p_grade WHERE id::text = p_id;
END;
$$;
GRANT EXECUTE ON FUNCTION admin_update_class(text, text, int) TO anon;

DROP FUNCTION IF EXISTS admin_delete_class(text);
CREATE OR REPLACE FUNCTION admin_delete_class(p_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    DELETE FROM classes WHERE id::text = p_id;
END;
$$;
GRANT EXECUTE ON FUNCTION admin_delete_class(text) TO anon;

-- [8] Xóa / Tạo thông báo tùy chỉnh
DROP FUNCTION IF EXISTS admin_delete_notification(text);
CREATE OR REPLACE FUNCTION admin_delete_notification(p_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    DELETE FROM notifications WHERE id::text = p_id;
END;
$$;
GRANT EXECUTE ON FUNCTION admin_delete_notification(text) TO anon;

DROP FUNCTION IF EXISTS admin_create_custom_notification(text, int);
CREATE OR REPLACE FUNCTION admin_create_custom_notification(p_message text, p_grade int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO notifications (message, grade, fetch_enabled) VALUES (p_message, p_grade, false);
END;
$$;
GRANT EXECUTE ON FUNCTION admin_create_custom_notification(text, int) TO anon;

-- [9] Xóa toàn bộ thông báo
DROP FUNCTION IF EXISTS admin_clear_all_notifications();
CREATE OR REPLACE FUNCTION admin_clear_all_notifications()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    DELETE FROM notifications;
END;
$$;
GRANT EXECUTE ON FUNCTION admin_clear_all_notifications() TO anon;

-- Force reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
