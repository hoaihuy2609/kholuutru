-- ═══════════════════════════════════════════════════════════════════════════
-- PHYSIVAULT — LIVE & BÀI GIẢNG MIGRATION
-- Chạy trong Supabase Dashboard → SQL Editor → New Query → Run
-- ═══════════════════════════════════════════════════════════════════════════

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- BƯỚC 1: Tạo các bảng
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- 1. Cấu hình Live Stream (chỉ 1 row duy nhất, id = 1)
CREATE TABLE IF NOT EXISTS live_config (
  id           int PRIMARY KEY DEFAULT 1,
  is_live      boolean DEFAULT false,
  youtube_url  text DEFAULT '',
  chat_url     text DEFAULT '',     -- YouTube Live Chat embed URL (để sẵn cho nâng cấp sau)
  title        text DEFAULT '',
  updated_at   timestamptz DEFAULT now()
);

-- Seed row mặc định
INSERT INTO live_config (id, is_live, youtube_url, chat_url, title)
VALUES (1, false, '', '', '')
ON CONFLICT (id) DO NOTHING;

-- 2. Chương bài giảng
CREATE TABLE IF NOT EXISTS lecture_chapters (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  description  text DEFAULT '',
  "order"      int DEFAULT 0,
  grade        int DEFAULT 0,  -- 0 = tất cả, 10/11/12 = theo khối
  created_at   timestamptz DEFAULT now()
);

-- 3. Bài giảng (video) trong từng chương
CREATE TABLE IF NOT EXISTS lecture_videos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id       uuid NOT NULL REFERENCES lecture_chapters(id) ON DELETE CASCADE,
  title            text NOT NULL,
  description      text DEFAULT '',
  youtube_url      text NOT NULL DEFAULT '',
  duration_seconds int DEFAULT 0,
  "order"          int DEFAULT 0,
  created_at       timestamptz DEFAULT now()
);

-- 4. Tiến độ xem của học sinh
CREATE TABLE IF NOT EXISTS lecture_progress (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_phone    text NOT NULL,
  video_id         uuid NOT NULL REFERENCES lecture_videos(id) ON DELETE CASCADE,
  watched_seconds  int DEFAULT 0,
  completed        boolean DEFAULT false,
  updated_at       timestamptz DEFAULT now(),
  UNIQUE(student_phone, video_id)
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- BƯỚC 2: Enable RLS
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ALTER TABLE live_config        ENABLE ROW LEVEL SECURITY;
ALTER TABLE lecture_chapters   ENABLE ROW LEVEL SECURITY;
ALTER TABLE lecture_videos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE lecture_progress   ENABLE ROW LEVEL SECURITY;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- BƯỚC 3: RLS Policies
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- live_config: anon đọc được (học viên xem trạng thái live)
DROP POLICY IF EXISTS "live_config_read" ON live_config;
CREATE POLICY "live_config_read" ON live_config FOR SELECT USING (true);

-- lecture_chapters: anon đọc được
DROP POLICY IF EXISTS "lecture_chapters_read" ON lecture_chapters;
CREATE POLICY "lecture_chapters_read" ON lecture_chapters FOR SELECT USING (true);

-- lecture_videos: anon đọc được
DROP POLICY IF EXISTS "lecture_videos_read" ON lecture_videos;
CREATE POLICY "lecture_videos_read" ON lecture_videos FOR SELECT USING (true);

-- lecture_progress: học sinh đọc/ghi row của mình (qua anon key, lọc theo phone)
DROP POLICY IF EXISTS "lecture_progress_read" ON lecture_progress;
CREATE POLICY "lecture_progress_read" ON lecture_progress FOR SELECT USING (true);

DROP POLICY IF EXISTS "lecture_progress_write" ON lecture_progress;
CREATE POLICY "lecture_progress_write" ON lecture_progress FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "lecture_progress_update" ON lecture_progress;
CREATE POLICY "lecture_progress_update" ON lecture_progress FOR UPDATE USING (true);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- BƯỚC 4: Admin RPCs (viết qua RPC để bypass RLS)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- RPC: Cập nhật live config
CREATE OR REPLACE FUNCTION admin_update_live_config(
  p_is_live     boolean,
  p_youtube_url text,
  p_chat_url    text,
  p_title       text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO live_config (id, is_live, youtube_url, chat_url, title, updated_at)
  VALUES (1, p_is_live, p_youtube_url, p_chat_url, p_title, now())
  ON CONFLICT (id) DO UPDATE
    SET is_live      = EXCLUDED.is_live,
        youtube_url  = EXCLUDED.youtube_url,
        chat_url     = EXCLUDED.chat_url,
        title        = EXCLUDED.title,
        updated_at   = now();
END;
$$;

-- RPC: Tạo chương mới
CREATE OR REPLACE FUNCTION admin_create_lecture_chapter(
  p_title       text,
  p_description text,
  p_pos         int,
  p_grade       int
) RETURNS lecture_chapters
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  result lecture_chapters;
BEGIN
  INSERT INTO lecture_chapters (title, description, "order", grade)
  VALUES (p_title, p_description, p_pos, p_grade)
  RETURNING * INTO result;
  RETURN result;
END;
$$;

-- RPC: Cập nhật chương
CREATE OR REPLACE FUNCTION admin_update_lecture_chapter(
  p_id          uuid,
  p_title       text,
  p_description text,
  p_pos         int,
  p_grade       int
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE lecture_chapters
  SET title = p_title, description = p_description, "order" = p_pos, grade = p_grade
  WHERE id = p_id;
END;
$$;

-- RPC: Xóa chương (cascade xóa videos)
CREATE OR REPLACE FUNCTION admin_delete_lecture_chapter(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM lecture_chapters WHERE id = p_id;
END;
$$;

-- RPC: Tạo video mới
CREATE OR REPLACE FUNCTION admin_create_lecture_video(
  p_chapter_id       uuid,
  p_title            text,
  p_description      text,
  p_youtube_url      text,
  p_duration_seconds int,
  p_pos              int
) RETURNS lecture_videos
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  result lecture_videos;
BEGIN
  INSERT INTO lecture_videos (chapter_id, title, description, youtube_url, duration_seconds, "order")
  VALUES (p_chapter_id, p_title, p_description, p_youtube_url, p_duration_seconds, p_pos)
  RETURNING * INTO result;
  RETURN result;
END;
$$;

-- RPC: Cập nhật video
CREATE OR REPLACE FUNCTION admin_update_lecture_video(
  p_id               uuid,
  p_title            text,
  p_description      text,
  p_youtube_url      text,
  p_duration_seconds int,
  p_pos              int
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE lecture_videos
  SET title = p_title, description = p_description, youtube_url = p_youtube_url,
      duration_seconds = p_duration_seconds, "order" = p_pos
  WHERE id = p_id;
END;
$$;

-- RPC: Xóa video
CREATE OR REPLACE FUNCTION admin_delete_lecture_video(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM lecture_videos WHERE id = p_id;
END;
$$;

-- RPC: Upsert tiến độ học sinh
CREATE OR REPLACE FUNCTION upsert_lecture_progress(
  p_student_phone   text,
  p_video_id        uuid,
  p_watched_seconds int,
  p_completed       boolean
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO lecture_progress (student_phone, video_id, watched_seconds, completed, updated_at)
  VALUES (p_student_phone, p_video_id, p_watched_seconds, p_completed, now())
  ON CONFLICT (student_phone, video_id) DO UPDATE
    SET watched_seconds = GREATEST(lecture_progress.watched_seconds, EXCLUDED.watched_seconds),
        completed       = lecture_progress.completed OR EXCLUDED.completed,
        updated_at      = now();
END;
$$;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- BƯỚC 5: Reload Supabase schema
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NOTIFY pgrst, 'reload schema';
