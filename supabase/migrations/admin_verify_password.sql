-- ============================================================
-- admin_verify_password RPC
-- Mục đích: Xác thực admin password SERVER-SIDE (SECURITY DEFINER)
--           Frontend chỉ nhận boolean — không bao giờ thấy raw password
-- ============================================================
-- Chạy script này trong Supabase Dashboard > SQL Editor
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_verify_password(p_password TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER  -- Chạy với quyền owner, không phải anon key
SET search_path = public
AS $$
DECLARE
    v_stored_hash TEXT;
BEGIN
    -- Lấy hash password từ bảng app_config (hoặc secrets)
    -- Cách 1: Dùng bảng app_config (khuyến nghị)
    SELECT value INTO v_stored_hash
    FROM app_config
    WHERE key = 'admin_password_hash'
    LIMIT 1;

    IF v_stored_hash IS NULL THEN
        RETURN FALSE;
    END IF;

    -- So sánh dùng crypt() với bcrypt
    -- Nếu chưa có extension pgcrypto: CREATE EXTENSION IF NOT EXISTS pgcrypto;
    RETURN (crypt(p_password, v_stored_hash) = v_stored_hash);
END;
$$;

-- Chỉ cho phép anon/authenticated gọi RPC này (không expose data nội bộ)
GRANT EXECUTE ON FUNCTION public.admin_verify_password(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.admin_verify_password(TEXT) TO authenticated;

-- ============================================================
-- Thiết lập admin password lần đầu (chạy 1 lần duy nhất):
-- Thay 'YOUR_ADMIN_PASSWORD' bằng mật khẩu thực tế
-- ============================================================
-- CREATE EXTENSION IF NOT EXISTS pgcrypto;
--
-- CREATE TABLE IF NOT EXISTS app_config (
--     key TEXT PRIMARY KEY,
--     value TEXT NOT NULL,
--     updated_at TIMESTAMPTZ DEFAULT NOW()
-- );
--
-- INSERT INTO app_config (key, value)
-- VALUES ('admin_password_hash', crypt('YOUR_ADMIN_PASSWORD', gen_salt('bf')))
-- ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
