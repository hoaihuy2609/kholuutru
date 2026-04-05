-- ═══════════════════════════════════════════════════════════════════════════
-- PHYSIVAULT — SUPABASE COMPLETE SETUP SCRIPT
-- Gom toàn bộ SQL cấu hình vào 1 file duy nhất để tham khảo sau này
-- Chạy trong Supabase Dashboard → SQL Editor → New Query → Run
--
-- Thứ tự chạy khuyến nghị:
--   1. RLS Policies & Core RPCs    (Bước 0 → 16)
--   2. Exam Result RPC & Index     (submit_exam_result)
--   3. Exam Breakdown Columns      (part_scores, tf_breakdown)
--   4. Admin RPCs Only             (admin_upsert_student v2...)
--   5. Leaderboard Cache Setup     (leaderboard_cache + refresh_leaderboard)
--   6. Reload Schema               (NOTIFY pgrst)
-- ═══════════════════════════════════════════════════════════════════════════


-- ╔═══════════════════════════════════════════════════════════════════════╗
-- ║  PHẦN 1: RLS POLICIES & CORE RPCs  (từ supabase_rls_policies.sql)   ║
-- ╚═══════════════════════════════════════════════════════════════════════╝

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
DROP POLICY IF EXISTS "schedules_write"         ON schedules;

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
--   ✅ Học sinh được ghi lịch cá nhân qua schedules_write
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE POLICY "schedules_select" ON schedules FOR SELECT USING (true);
CREATE POLICY "schedules_write"  ON schedules FOR ALL    USING (true) WITH CHECK (true);


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
-- BƯỚC 14 ⭐ BUG 3 FIX — RPC để Admin upsert vault_index
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
-- BƯỚC 16 ⭐ ADMIN OPS FIX — RPCs cho toàn bộ thao tác Admin
-- anon key bị REVOKE write trên students, classes, notifications
-- → Admin Frontend PHẢI dùng các RPC dưới đây
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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

-- [4] Xóa học sinh (AdminDashboard)
DROP FUNCTION IF EXISTS admin_delete_student(text);
CREATE OR REPLACE FUNCTION admin_delete_student(p_phone text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    DELETE FROM students WHERE phone = p_phone;
END;
$$;
GRANT EXECUTE ON FUNCTION admin_delete_student(text) TO anon;

-- [5] Kick học sinh (AdminDashboard)
DROP FUNCTION IF EXISTS admin_kick_student(text);
CREATE OR REPLACE FUNCTION admin_kick_student(p_phone text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE students SET is_active = false WHERE phone = p_phone;
END;
$$;
GRANT EXECUTE ON FUNCTION admin_kick_student(text) TO anon;

-- [6] Unkick học sinh (AdminDashboard)
DROP FUNCTION IF EXISTS admin_unkick_student(text);
CREATE OR REPLACE FUNCTION admin_unkick_student(p_phone text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE students SET is_active = true, machine_id = '', activation_key = '' WHERE phone = p_phone;
END;
$$;
GRANT EXECUTE ON FUNCTION admin_unkick_student(text) TO anon;

-- [7] Quản lý lớp học (AdminDashboard)
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

-- [8] Xóa / Tạo thông báo tùy chỉnh (notificationService)
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


-- ╔═══════════════════════════════════════════════════════════════════════╗
-- ║  PHẦN 2b: BẢNG EXAMS METADATA  (exam closing & duration)            ║
-- ╚═══════════════════════════════════════════════════════════════════════╝

-- Bảng metadata đề thi — lưu closed_at và duration để backend validate
CREATE TABLE IF NOT EXISTS exams (
  id          TEXT PRIMARY KEY,
  closed_at   TIMESTAMPTZ,
  duration    INT NOT NULL DEFAULT 50
);

-- RLS: Cho phép anon đọc (danh sách đề hiển thị trạng thái)
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "exams_select" ON exams;
CREATE POLICY "exams_select" ON exams FOR SELECT USING (true);

-- Admin upsert metadata qua RPC (anon bị REVOKE write trực tiếp)
DROP FUNCTION IF EXISTS admin_upsert_exam_metadata(TEXT, TIMESTAMPTZ, INT);
CREATE OR REPLACE FUNCTION admin_upsert_exam_metadata(
  p_id         TEXT,
  p_closed_at  TIMESTAMPTZ,
  p_duration   INT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO exams (id, closed_at, duration)
  VALUES (p_id, p_closed_at, p_duration)
  ON CONFLICT (id) DO UPDATE SET
    closed_at = EXCLUDED.closed_at,
    duration  = EXCLUDED.duration;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_upsert_exam_metadata(TEXT, TIMESTAMPTZ, INT) TO anon;


-- ╔═══════════════════════════════════════════════════════════════════════╗
-- ║  PHẦN 2: EXAM SUBMISSION RPC & INDEX  (exam_result_rpc_and_index)   ║
-- ╚═══════════════════════════════════════════════════════════════════════╝

-- ───────────────────────────────────────────────────────────
-- BƯỚC 0: Dọn dữ liệu trùng lặp từ Load Test
-- (Giữ lại bài nộp SỚM NHẤT cho mỗi cặp student_phone + exam_id)
-- ───────────────────────────────────────────────────────────
DELETE FROM exam_results
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY student_phone, exam_id
             ORDER BY submitted_at ASC  -- Giữ bài nộp đầu tiên
           ) AS rn
    FROM exam_results
  ) ranked
  WHERE rn > 1  -- Xóa tất cả bản sao thừa
);

-- ───────────────────────────────────────────────────────────
-- FIX 2: Index & Unique Constraint
-- ───────────────────────────────────────────────────────────

-- Index cho FK column — ngăn Row Lock khi 2000 INSERT đồng thời
CREATE INDEX IF NOT EXISTS idx_exam_results_student_phone
  ON exam_results (student_phone);

-- Unique index cho (student_phone, exam_id) —
-- điều kiện BẮT BUỘC để ON CONFLICT bên dưới hoạt động
CREATE UNIQUE INDEX IF NOT EXISTS idx_exam_results_phone_exam_id
  ON exam_results (student_phone, exam_id);


-- ───────────────────────────────────────────────────────────
-- FIX 1: RPC Stored Procedure — bỏ qua RLS, ghi thẳng bằng quyền root
-- + Validate closed_at và duration để chống gian lận giờ giấc
-- ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION submit_exam_result(
  p_student_phone   TEXT,
  p_exam_id         TEXT,
  p_exam_title      TEXT,
  p_grade           INT,
  p_score           NUMERIC,
  p_student_name    TEXT,
  p_correct_answers INT,
  p_total_questions INT,
  p_part_scores     JSONB    DEFAULT NULL,
  p_tf_breakdown    JSONB    DEFAULT NULL,
  p_submitted_at    TIMESTAMPTZ DEFAULT now(),
  p_time_taken      INT     DEFAULT 0  -- Thời gian làm bài thực tế (giây)
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER  -- Chạy với quyền root, bỏ qua RLS overhead
AS $$
DECLARE
  v_exam RECORD;
BEGIN
  -- Đọc metadata đề thi (có thể NULL nếu admin chưa sync)
  SELECT closed_at, duration INTO v_exam FROM exams WHERE id = p_exam_id;

  -- Check 1: Chặn nếu đã quá giờ đóng chung (ân huệ 60s để xử lý network lag)
  IF v_exam.closed_at IS NOT NULL AND now() > v_exam.closed_at + interval '60 seconds' THEN
    RAISE EXCEPTION 'EXAM_CLOSED';
  END IF;

  -- Check 2: Chặn nếu làm bài quá thời gian quy định (ân huệ 60s)
  IF v_exam.duration IS NOT NULL AND p_time_taken > v_exam.duration * 60 + 60 THEN
    RAISE EXCEPTION 'TIME_LIMIT_EXCEEDED';
  END IF;

  INSERT INTO exam_results (
    student_phone, exam_id, exam_title, grade,
    score, student_name,
    correct_answers, total_questions,
    part_scores, tf_breakdown, submitted_at
  )
  VALUES (
    p_student_phone, p_exam_id, p_exam_title, p_grade,
    p_score, p_student_name,
    p_correct_answers, p_total_questions,
    p_part_scores, p_tf_breakdown, p_submitted_at
  )
  -- Chặn double-submit tại tầng DB — kể cả nếu client gửi 2 lần
  ON CONFLICT (student_phone, exam_id) DO NOTHING;
END;
$$;

-- ───────────────────────────────────────────────────────────
-- BƯỚC 4: Cấp quyền (Crucial!)
-- ───────────────────────────────────────────────────────────

-- Cho phép cả User vãng lai (anon) và đã đăng nhập được phép gọi hàm này
GRANT EXECUTE ON FUNCTION submit_exam_result TO anon, authenticated;


-- ╔═══════════════════════════════════════════════════════════════════════╗
-- ║  PHẦN 3: EXAM BREAKDOWN COLUMNS  (add_exam_breakdown_columns)        ║
-- ╚═══════════════════════════════════════════════════════════════════════╝

-- CHẠY SQL NÀY TRONG SUPABASE SQL EDITOR ĐỂ HỖ TRỢ HIỂN THỊ CHI TIẾT KẾT QUẢ
ALTER TABLE exam_results
ADD COLUMN IF NOT EXISTS part_scores jsonb,
ADD COLUMN IF NOT EXISTS tf_breakdown jsonb;


-- ╔═══════════════════════════════════════════════════════════════════════╗
-- ║  PHẦN 4: LEADERBOARD CACHE SETUP  (leaderboard_cache_setup)         ║
-- ╚═══════════════════════════════════════════════════════════════════════╝

-- 1. Tạo bảng cache leaderboard (chỉ lưu điểm tổng hợp mỗi học sinh)
CREATE TABLE IF NOT EXISTS leaderboard_cache (
  grade          INT,
  student_phone  TEXT,
  student_name   TEXT,
  avg_score      NUMERIC,
  exam_count     INT,
  best_score     NUMERIC,
  recent_scores  JSONB,
  updated_at     TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (grade, student_phone)
);

-- Enable RLS + cho phép anon đọc (chỉ đọc, không ghi)
ALTER TABLE leaderboard_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read leaderboard_cache" ON leaderboard_cache;
CREATE POLICY "Public read leaderboard_cache"
  ON leaderboard_cache FOR SELECT USING (true);

-- 2. Index tăng tốc query cơ sở (exam_results)
CREATE INDEX IF NOT EXISTS idx_exam_results_phone_submitted
  ON exam_results(student_phone, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_exam_results_grade_submitted
  ON exam_results(grade, submitted_at DESC);

-- 3. Function refresh cache — dùng UPSERT để không bị trắng bảng trong lúc refresh
--    SECURITY DEFINER nhưng KHÔNG GRANT cho anon — chỉ gọi qua service_role (cron)
CREATE OR REPLACE FUNCTION refresh_leaderboard()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO leaderboard_cache (grade, student_phone, student_name, avg_score, exam_count, best_score, recent_scores, updated_at)
  SELECT
    r.grade,
    r.student_phone,
    MAX(r.student_name)                                               AS student_name,
    ROUND(AVG(r.score)::numeric, 4)                                   AS avg_score,
    COUNT(*)                                                          AS exam_count,
    MAX(r.score)                                                      AS best_score,
    (
      SELECT jsonb_agg(s ORDER BY s)
      FROM (
        SELECT score AS s FROM exam_results e2
        WHERE e2.student_phone = r.student_phone AND e2.grade = r.grade
        ORDER BY submitted_at DESC LIMIT 6
      ) sub
    )                                                                 AS recent_scores,
    now()                                                             AS updated_at
  FROM exam_results r
  GROUP BY r.grade, r.student_phone
  ON CONFLICT (grade, student_phone) DO UPDATE SET
    student_name  = EXCLUDED.student_name,
    avg_score     = EXCLUDED.avg_score,
    exam_count    = EXCLUDED.exam_count,
    best_score    = EXCLUDED.best_score,
    recent_scores = EXCLUDED.recent_scores,
    updated_at    = now();
END;
$$;

-- KHÔNG GRANT cho anon — chỉ service_role mới chạy được
-- REVOKE nếu đã grant trước đó
REVOKE EXECUTE ON FUNCTION refresh_leaderboard() FROM anon;
REVOKE EXECUTE ON FUNCTION refresh_leaderboard() FROM authenticated;

-- 4. Chạy lần đầu để điền dữ liệu vào bảng cache ngay
SELECT refresh_leaderboard();

-- 5. (Tuỳ chọn) Nếu Supabase project của bạn có pg_cron, thêm cron chạy mỗi 5 phút:
-- SELECT cron.schedule('refresh-leaderboard', '*/5 * * * *', 'SELECT refresh_leaderboard()');


-- ╔═══════════════════════════════════════════════════════════════════════╗
-- ║  PHẦN 5: RELOAD SCHEMA  (reload_schema)                             ║
-- ╚═══════════════════════════════════════════════════════════════════════╝

-- Reload PostgREST schema cache để nhận các hàm RPC mới
NOTIFY pgrst, 'reload schema';


-- ═══════════════════════════════════════════════════════════════════════════
-- XONG! Verify bằng cách kiểm tra trong Dashboard:
--   Authentication → Policies → mỗi bảng phải có RLS enabled
--   Database → Functions → phải thấy các hàm RPC:
--     activate_device, admin_upsert_vault_index, admin_insert_notification,
--     admin_upsert_student, admin_add_student, admin_update_student_class,
--     admin_delete_student, admin_kick_student, admin_unkick_student,
--     admin_add_class, admin_update_class, admin_delete_class,
--     admin_delete_notification, admin_create_custom_notification,
--     admin_clear_all_notifications, submit_exam_result, refresh_leaderboard
-- ═══════════════════════════════════════════════════════════════════════════
