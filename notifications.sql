-- ========================================================
-- PHYSIVAULT — Hệ Thống Thông Báo & Gọi Bài
-- Chạy script này trong Supabase SQL Editor
-- ========================================================

-- Bảng thông báo (Admin tạo tự động sau mỗi lần Sync)
CREATE TABLE IF NOT EXISTS notifications (
    id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    message      text NOT NULL,
    grade        int NOT NULL,       -- 10, 11, hoặc 12
    fetch_enabled boolean DEFAULT true,
    created_at   timestamptz DEFAULT now()
);

-- Bảng tracking học sinh đã fetch rồi (mỗi HS chỉ fetch 1 lần/ thông báo)
CREATE TABLE IF NOT EXISTS notification_fetches (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    notification_id uuid REFERENCES notifications(id) ON DELETE CASCADE,
    student_phone   text NOT NULL,
    fetched_at      timestamptz DEFAULT now(),
    UNIQUE(notification_id, student_phone)
);

-- RLS: Cho phép đọc notifications (học sinh cần đọc), cho phép insert, delete (Admin/Hệ thống cần thao tác)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read notifications" ON notifications FOR SELECT USING (true);
CREATE POLICY "Allow insert notifications" ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow delete notifications" ON notifications FOR DELETE USING (true);

-- RLS: Cho phép học sinh insert fetch record của chính mình
ALTER TABLE notification_fetches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read fetches" ON notification_fetches FOR SELECT USING (true);
CREATE POLICY "Allow insert fetches" ON notification_fetches FOR INSERT WITH CHECK (true);
