-- ============================================================
-- PHYSIVAULT — EXAM SUBMISSION PERFORMANCE HARDENING
-- Chạy toàn bộ file này trong Supabase Dashboard → SQL Editor
-- ============================================================

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
  p_submitted_at    TIMESTAMPTZ DEFAULT now()
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER  -- Chạy với quyền root, bỏ qua RLS overhead
AS $$
BEGIN
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

