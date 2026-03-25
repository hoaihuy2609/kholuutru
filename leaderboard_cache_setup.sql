-- ════════════════════════════════════════════════════════
-- LEADERBOARD CACHE — Setup Script
-- Chạy toàn bộ file này trong Supabase SQL Editor
-- ════════════════════════════════════════════════════════

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

NOTIFY pgrst, 'reload schema';
