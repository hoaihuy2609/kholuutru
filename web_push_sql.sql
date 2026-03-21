-- =====================================================
-- Web Push Notifications — Database Schema & RPCs
-- =====================================================

-- 1. Bảng lưu push subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  student_phone text NOT NULL,
  endpoint      text NOT NULL UNIQUE,
  p256dh        text NOT NULL,
  auth          text NOT NULL,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subs_phone ON push_subscriptions(student_phone);

-- 2. RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_sub_insert" ON push_subscriptions
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "push_sub_select" ON push_subscriptions
  FOR SELECT TO anon USING (true);

CREATE POLICY "push_sub_delete" ON push_subscriptions
  FOR DELETE TO anon USING (true);

-- 3. RPC: upsert subscription
CREATE OR REPLACE FUNCTION upsert_push_subscription(
  p_phone    text,
  p_endpoint text,
  p_p256dh   text,
  p_auth     text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO push_subscriptions (student_phone, endpoint, p256dh, auth, updated_at)
  VALUES (p_phone, p_endpoint, p_p256dh, p_auth)
  ON CONFLICT (endpoint) DO UPDATE SET
    student_phone = EXCLUDED.student_phone,
    p256dh        = p_p256dh,
    auth          = p_auth,
    updated_at    = now();
END;
$$;

-- 4. RPC: lấy subscriptions (theo grade hoặc tất cả), JOIN bảng students
CREATE OR REPLACE FUNCTION admin_get_push_subscriptions(p_grade int DEFAULT NULL)
RETURNS TABLE (
  endpoint text,
  p256dh   text,
  auth     text
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_grade IS NULL THEN
    RETURN QUERY SELECT ps.endpoint, ps.p256dh, ps.auth
    FROM push_subscriptions ps;
  ELSE
    RETURN QUERY SELECT ps.endpoint, ps.p256dh, ps.auth
    FROM push_subscriptions ps
    JOIN students s ON s.phone = ps.student_phone
    WHERE s.grade = p_grade;
  END IF;
END;
$$;

-- 5. RPC: xóa subscription (cleanup expired)
CREATE OR REPLACE FUNCTION admin_remove_push_subscription(p_endpoint text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM push_subscriptions WHERE endpoint = p_endpoint;
END;
$$;

-- 6. GRANT cho anon role
GRANT ALL ON push_subscriptions TO anon;
GRANT EXECUTE ON FUNCTION upsert_push_subscription(text, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION admin_get_push_subscriptions(int) TO anon;
GRANT EXECUTE ON FUNCTION admin_remove_push_subscription(text) TO anon;

-- 7. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
