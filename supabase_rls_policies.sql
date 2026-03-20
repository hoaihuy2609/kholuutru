-- =====================================================
-- PhysiVault: Row Level Security (RLS) Policies
-- ⚠️  CHÚ Ý: Chạy file này trong Supabase SQL Editor
--      Dashboard → SQL Editor → New Query
-- =====================================================

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- BƯỚC 0: Dọn sạch policies cũ (chạy nếu đã init rồi)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DROP POLICY IF EXISTS "students_read"           ON students;
DROP POLICY IF EXISTS "students_select"         ON students;
DROP POLICY IF EXISTS "students_update"         ON students;
DROP POLICY IF EXISTS "students_insert"         ON students;
DROP POLICY IF EXISTS "students_delete"         ON students;
DROP POLICY IF EXISTS "students_write"          ON students;
DROP POLICY IF EXISTS "students_no_insert"      ON students;
DROP POLICY IF EXISTS "students_no_delete"      ON students;

DROP POLICY IF EXISTS "vault_index_read"        ON vault_index;
DROP POLICY IF EXISTS "vault_index_select"      ON vault_index;
DROP POLICY IF EXISTS "vault_select"            ON vault_index;
DROP POLICY IF EXISTS "vault_index_insert"      ON vault_index;
DROP POLICY IF EXISTS "vault_index_update"      ON vault_index;

DROP POLICY IF EXISTS "notifications_read"      ON notifications;
DROP POLICY IF EXISTS "notifications_select"    ON notifications;
DROP POLICY IF EXISTS "notif_select"            ON notifications;
DROP POLICY IF EXISTS "notifications_insert"    ON notifications;
DROP POLICY IF EXISTS "notifications_delete"    ON notifications;

DROP POLICY IF EXISTS "notif_fetches_read"      ON notification_fetches;
DROP POLICY IF EXISTS "notif_fetches_select"    ON notification_fetches;
DROP POLICY IF EXISTS "notif_fetches_insert"    ON notification_fetches;

DROP POLICY IF EXISTS "exam_results_read"       ON exam_results;
DROP POLICY IF EXISTS "exam_results_select"     ON exam_results;
DROP POLICY IF EXISTS "exam_results_insert"     ON exam_results;

DROP POLICY IF EXISTS "study_plans_all"         ON study_plans;
DROP POLICY IF EXISTS "schedules_all"           ON schedules;
DROP POLICY IF EXISTS "schedules_select"        ON schedules;

DROP POLICY IF EXISTS "votes_read"              ON question_votes;
DROP POLICY IF EXISTS "votes_select"            ON question_votes;
DROP POLICY IF EXISTS "votes_insert"            ON question_votes;

DROP POLICY IF EXISTS "blog_index_read"         ON blog_index;
DROP POLICY IF EXISTS "blog_index_select"       ON blog_index;
DROP POLICY IF EXISTS "blog_index_write"        ON blog_index;
DROP POLICY IF EXISTS "blog_index_update"       ON blog_index;
DROP POLICY IF EXISTS "blog_index_insert"       ON blog_index;

DROP POLICY IF EXISTS "classes_read"            ON classes;
DROP POLICY IF EXISTS "classes_select"          ON classes;
DROP POLICY IF EXISTS "classes_write"           ON classes;
DROP POLICY IF EXISTS "classes_all"             ON classes;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- BƯỚC 1: Enable RLS trên tất cả bảng
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALTER TABLE students             ENABLE ROW LEVEL SECURITY;
ALTER TABLE vault_index          ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications        ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_fetches ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_results         ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_plans          ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules            ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_votes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_index           ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes              ENABLE ROW LEVEL SECURITY;


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- BƯỚC 2: Revoke quyền write nguy hiểm từ anon
--   students, vault_index, notifications: chỉ đọc
--   schedules, classes: chỉ đọc (⚠️ Tech Debt Fix)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REVOKE INSERT, UPDATE, DELETE ON students       FROM anon;
REVOKE INSERT, UPDATE, DELETE ON vault_index    FROM anon;
REVOKE INSERT, UPDATE, DELETE ON notifications  FROM anon;
REVOKE INSERT, UPDATE, DELETE ON schedules      FROM anon;
REVOKE INSERT, UPDATE, DELETE ON classes        FROM anon;


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- BƯỚC 3: students — chỉ SELECT cho anon
--   ✅ Write do RPC SECURITY DEFINER (xem Bước 5)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE POLICY "students_select" ON students
    FOR SELECT USING (true);


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- BƯỚC 4: vault_index — chỉ SELECT
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE POLICY "vault_index_select" ON vault_index
    FOR SELECT USING (true);


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- BƯỚC 5: notifications — chỉ SELECT
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE POLICY "notifications_select" ON notifications
    FOR SELECT USING (true);


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- BƯỚC 6: notification_fetches — học sinh đọc/ghi của mình
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE POLICY "notif_fetches_select" ON notification_fetches
    FOR SELECT USING (true);
CREATE POLICY "notif_fetches_insert" ON notification_fetches
    FOR INSERT WITH CHECK (true);


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- BƯỚC 7: exam_results — học sinh tự INSERT/SELECT
--   DELETE và UPDATE bị chặn hoàn toàn với anon
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE POLICY "exam_results_select" ON exam_results
    FOR SELECT USING (true);
CREATE POLICY "exam_results_insert" ON exam_results
    FOR INSERT WITH CHECK (true);  -- giữ nguyên để ghi điểm


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- BƯỚC 8: study_plans — học sinh quản lý kế hoạch của mình
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE POLICY "study_plans_all" ON study_plans FOR ALL USING (true);


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- BƯỚC 9: schedules — chỉ SELECT cho anon (⚠️ Tech Debt Fix)
--   Admin ghi dữ liệu thời khóa biểu qua service_role
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE POLICY "schedules_select" ON schedules FOR SELECT USING (true);


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- BƯỚC 10: question_votes — học sinh vote, không xóa
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE POLICY "votes_select" ON question_votes FOR SELECT USING (true);
CREATE POLICY "votes_insert" ON question_votes FOR INSERT WITH CHECK (true);


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- BƯỚC 11: blog_index — đọc công khai; upsert cho admin
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE POLICY "blog_index_select" ON blog_index FOR SELECT USING (true);
CREATE POLICY "blog_index_insert" ON blog_index FOR INSERT WITH CHECK (true);
CREATE POLICY "blog_index_update" ON blog_index FOR UPDATE USING (true);


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- BƯỚC 12: classes — chỉ SELECT cho anon (⚠️ Tech Debt Fix)
--   Admin ghi dữ liệu lớp học qua service_role
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE POLICY "classes_select" ON classes FOR SELECT USING (true);


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- BƯỚC 13 ⭐ (QUAN TRỌNG NHẤT — BUG 1 FIX)
-- Tạo RPC SECURITY DEFINER để học sinh tự activate
-- mà không cần quyền UPDATE trực tiếp trên bảng students
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE OR REPLACE FUNCTION activate_device(
    p_phone         text,
    p_machine_id    text,
    p_activation_key text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER   -- chạy với quyền owner (vượt RLS), không phải anon
AS $$
BEGIN
    -- Chỉ update nếu:
    --   1. SĐT tồn tại trong DB
    --   2. Tài khoản đang kích hoạt (is_active = true)
    --   3. machine_id chưa được set (lần đầu kích hoạt)
    --      HOẶC machine_id đã trùng (cùng thiết bị đăng nhập lại)
    UPDATE students
    SET
        machine_id      = p_machine_id,
        activation_key  = p_activation_key
    WHERE
        phone     = p_phone
        AND is_active = true
        AND (machine_id IS NULL OR machine_id = p_machine_id);
END;
$$;

-- Đảm bảo function chạy được từ anon role
GRANT EXECUTE ON FUNCTION activate_device(text, text, text) TO anon;


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- BƯỚC 14 ⭐ BUG 3 FIX — RPC đểAdmin upsert vault_index
-- ⚠️ Tech Debt Fix: Bỏ tham số p_updated_at kiểu bigint
-- vì nếu schema dùng timestamptz sẽ crash. Thay bằng now() nội bộ.
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DROP FUNCTION IF EXISTS admin_upsert_vault_index(int, text, bigint);
DROP FUNCTION IF EXISTS admin_upsert_vault_index(int, text);
CREATE OR REPLACE FUNCTION admin_upsert_vault_index(
    p_grade            int,
    p_telegram_file_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO vault_index (grade, telegram_file_id)
    VALUES (p_grade, p_telegram_file_id)
    ON CONFLICT (grade)
    DO UPDATE SET
        telegram_file_id = EXCLUDED.telegram_file_id;
    -- updated_at sẽ tự được fill bởi DEFAULT now() trong schema Postgres
END;
$$;

GRANT EXECUTE ON FUNCTION admin_upsert_vault_index(int, text) TO anon;


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- BƯỚC 15 ⭐ BUG 4 FIX — RPC để Admin insert notification
-- anon key đã bị REVOKE INSERT trên notifications
-- → Bắt buộc phải đi qua RPC SECURITY DEFINER này
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DROP FUNCTION IF EXISTS admin_insert_notification(text, int, boolean);
CREATE OR REPLACE FUNCTION admin_insert_notification(
    p_message       text,
    p_grade         int,
    p_fetch_enabled boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO notifications (message, grade, fetch_enabled)
    VALUES (p_message, p_grade, p_fetch_enabled);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_insert_notification(text, int, boolean) TO anon;


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- XONG! Verify bằng cách kiểm tra trong Dashboard:
--   Authentication → Policies → mỗi bảng phải có RLS enabled
--   Database → Functions → phải thấy 3 hàm RPC:
--     activate_device, admin_upsert_vault_index, admin_insert_notification
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
