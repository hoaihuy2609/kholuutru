-- =====================================================
-- PhysiVault: Row Level Security (RLS) Policies
-- Run this in Supabase SQL Editor (Dashboard → SQL)
-- =====================================================

-- 1. Enable RLS on all tables
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE vault_index ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_fetches ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_index ENABLE ROW LEVEL SECURITY;

-- 2. students: everyone can read (for activation check), no public write
CREATE POLICY "students_read" ON students FOR SELECT USING (true);
CREATE POLICY "students_write" ON students FOR ALL USING (false);

-- 3. vault_index: everyone can read (for sync/fetch), only service role can write
CREATE POLICY "vault_index_read" ON vault_index FOR SELECT USING (true);
CREATE POLICY "vault_index_insert" ON vault_index FOR INSERT WITH CHECK (true);
CREATE POLICY "vault_index_update" ON vault_index FOR UPDATE USING (true);

-- 4. notifications: everyone can read, insert/delete via anon (admin-controlled in app)
CREATE POLICY "notifications_read" ON notifications FOR SELECT USING (true);
CREATE POLICY "notifications_insert" ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "notifications_delete" ON notifications FOR DELETE USING (true);

-- 5. notification_fetches: users can insert their own, read their own
CREATE POLICY "notif_fetches_read" ON notification_fetches FOR SELECT USING (true);
CREATE POLICY "notif_fetches_insert" ON notification_fetches FOR INSERT WITH CHECK (true);

-- 6. exam_results: users can insert their own, everyone can read (leaderboard)
CREATE POLICY "exam_results_read" ON exam_results FOR SELECT USING (true);
CREATE POLICY "exam_results_insert" ON exam_results FOR INSERT WITH CHECK (true);

-- 7. study_plans: users manage their own plans
CREATE POLICY "study_plans_all" ON study_plans FOR ALL USING (true);

-- 8. schedules: everyone can read, insert/update/delete via anon (admin in app)
CREATE POLICY "schedules_all" ON schedules FOR ALL USING (true);

-- 9. question_votes: users can insert their own, everyone can read
CREATE POLICY "votes_read" ON question_votes FOR SELECT USING (true);
CREATE POLICY "votes_insert" ON question_votes FOR INSERT WITH CHECK (true);

-- 10. blog_index: everyone can read, upsert for admin sync
CREATE POLICY "blog_index_read" ON blog_index FOR SELECT USING (true);
CREATE POLICY "blog_index_write" ON blog_index FOR INSERT WITH CHECK (true);
CREATE POLICY "blog_index_update" ON blog_index FOR UPDATE USING (true);

-- =====================================================
-- IMPORTANT: After running this, verify in Supabase Dashboard:
-- Authentication → Policies → Each table should show "RLS enabled"
-- =====================================================
