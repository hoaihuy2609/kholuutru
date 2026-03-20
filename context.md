# CẤU TRÚC DỰ ÁN (FILE TREE)
```text
physivault/
├── App.tsx
├── components
│   ├── AdminBlogEditor.tsx
│   ├── AdminDashboard.tsx
│   ├── AdminGitHubSync.tsx
│   ├── auth
│   │   └── KickedScreen.tsx
│   ├── BlogDetail.tsx
│   ├── BlogList.tsx
│   ├── ChapterView.tsx
│   ├── Chatbot.tsx
│   ├── ContactBook.tsx
│   ├── CountdownTimer.tsx
│   ├── Dashboard.tsx
│   ├── ErrorBoundary.tsx
│   ├── ExamCountdownTimer.tsx
│   ├── ExamListPage.tsx
│   ├── ExamManager.tsx
│   ├── ExamResult.tsx
│   ├── ExamView.tsx
│   ├── FocusTimer.tsx
│   ├── LessonView.tsx
│   ├── Modal.tsx
│   ├── NotificationPage.tsx
│   ├── SearchBar.tsx
│   ├── SettingsModal.tsx
│   ├── Sidebar.tsx
│   ├── SimulationLab.tsx
│   ├── simulations
│   │   ├── CarSimulation.tsx
│   │   ├── IceMeltingSimulation.tsx
│   │   └── WaterBoilingSimulation.tsx
│   ├── StatsPanel.tsx
│   ├── StudyPlanner.tsx
│   ├── Toast.tsx
│   └── WeeklySchedule.tsx
├── constants.ts
├── index.css
├── index.html
├── index.tsx
├── package-lock.json
├── package.json
├── public
│   └── manifest.json
├── src
│   ├── hooks
│   │   ├── exportImport.ts
│   │   └── useCloudStorage.ts
│   ├── lib
│   │   ├── crypto.ts
│   │   ├── db.ts
│   │   ├── supabase.ts
│   │   └── telegram.ts
│   ├── services
│   │   ├── blogService.ts
│   │   ├── examService.ts
│   │   ├── notificationService.ts
│   │   └── plannerService.ts
│   ├── stores
│   │   ├── useContentStore.ts
│   │   ├── useDataStore.ts
│   │   └── useUIStore.ts
│   ├── utils
│   │   └── phone.ts
│   └── __tests__
│       └── crypto.test.ts
├── supabase_rls_policies.sql
├── tsconfig.json
├── types.ts
├── vercel.json
├── vite-env.d.ts
└── vite.config.ts
```

# MÃ NGUỒN CÁC FILE ĐANG XỬ LÝ

>>>>> FILE: supabase_rls_policies.sql
```sql
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

```

>>>>> FILE: src/hooks/useCloudStorage.ts
```typescript
import { supabase } from '../lib/supabase';
import { useState, useEffect, useRef } from 'react';
import { Lesson, StoredFile, FileStorage } from '../../types';
import CryptoJS from 'crypto-js';

// Shared utilities (extracted)
import { dbGet, dbSet, dbSetBatch } from '../lib/db';
import { fnvHash, getMachineId, generateActivationKey, checkActivationStatus, aesEncrypt, smartDecrypt } from '../lib/crypto';
import { fetchViaCloudflareProxy, TELEGRAM_CHAT_ID, CLOUDFLARE_PROXY_URL, ADMIN_AUTH_HEADER } from '../lib/telegram';
import { normalizePhone } from '../utils/phone';

// Service modules (extracted)
import * as examService from '../services/examService';
import * as plannerService from '../services/plannerService';
import * as notificationService from '../services/notificationService';
import * as blogService from '../services/blogService';

// Re-export utilities for external consumers
export { getMachineId, generateActivationKey, checkActivationStatus } from '../lib/crypto';
export { exportData, importData } from './exportImport';

// Storage Keys
const STORAGE_FILES_KEY = 'physivault_files';
const STORAGE_LESSONS_KEY = 'physivault_lessons';
const STORAGE_ACTIVATION_KEY = 'physivault_activated';
const STORAGE_GRADE_KEY = 'physivault_grade';


export const useCloudStorage = () => {
    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [storedFiles, setStoredFiles] = useState<FileStorage>({});
    const [loading, setLoading] = useState(true);
    const [syncProgress, setSyncProgress] = useState<number>(0);
    const [isActivated, setIsActivated] = useState(checkActivationStatus());

    // Initial Load & Migration
    useEffect(() => {
        const initData = async () => {
            setLoading(true);
            try {
                let savedLessons = await dbGet(STORAGE_LESSONS_KEY);
                let savedFiles = await dbGet(STORAGE_FILES_KEY);

                if (!savedLessons && !savedFiles) {
                    const localFiles = localStorage.getItem(STORAGE_FILES_KEY);
                    const localLessons = localStorage.getItem(STORAGE_LESSONS_KEY);
                    if (localFiles || localLessons) {
                        savedLessons = localLessons ? JSON.parse(localLessons) : [];
                        savedFiles = localFiles ? JSON.parse(localFiles) : {};
                        await dbSet(STORAGE_LESSONS_KEY, savedLessons);
                        await dbSet(STORAGE_FILES_KEY, savedFiles);
                    }
                }

                setLessons(savedLessons || []);
                setStoredFiles(savedFiles || {});
            } catch (e) {
                console.error("Error initializing persistent storage", e);
            } finally {
                setLoading(false);
            }
        };
        initData();
    }, []);

    // Sync state to IndexedDB (debounced)
    const _dbSyncTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
    useEffect(() => {
        if (!loading) {
            clearTimeout(_dbSyncTimers.current[STORAGE_LESSONS_KEY]);
            _dbSyncTimers.current[STORAGE_LESSONS_KEY] = setTimeout(() => dbSet(STORAGE_LESSONS_KEY, lessons), 300);
        }
        return () => clearTimeout(_dbSyncTimers.current[STORAGE_LESSONS_KEY]);
    }, [lessons, loading]);

    useEffect(() => {
        if (!loading) {
            clearTimeout(_dbSyncTimers.current[STORAGE_FILES_KEY]);
            _dbSyncTimers.current[STORAGE_FILES_KEY] = setTimeout(() => dbSet(STORAGE_FILES_KEY, storedFiles), 300);
        }
        return () => clearTimeout(_dbSyncTimers.current[STORAGE_FILES_KEY]);
    }, [storedFiles, loading]);

    // Lock refs to prevent concurrent fetch/sync race conditions
    const _fetchLock = useRef<Record<number, boolean>>({});
    const _syncLock = useRef<Record<number, boolean>>({});

    // ── Lesson CRUD ──

    const addLesson = async (name: string, chapterId: string) => {
        const newLesson: Lesson = { id: crypto.randomUUID(), name, chapterId, createdAt: Date.now() };
        setLessons(prev => [newLesson, ...prev]);
    };

    const deleteLesson = async (lessonId: string) => {
        setLessons(prev => prev.filter(l => l.id !== lessonId));
        setStoredFiles(prev => { const newFiles = { ...prev }; delete newFiles[lessonId]; return newFiles; });
    };

    const uploadFiles = async (files: File[], targetId: string, category?: string) => {
        const filePromises = files.map(file => new Promise<StoredFile>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                // Dùng ArrayBuffer + createObjectURL thay vì base64 (tiết kiệm ~33% bộ nhớ)
                const arrayBuffer = e.target?.result as ArrayBuffer;
                const blob = new Blob([arrayBuffer], { type: file.type });
                const url = URL.createObjectURL(blob);
                resolve({
                    id: crypto.randomUUID(),
                    name: file.name, type: file.type, size: file.size,
                    url, uploadDate: Date.now(), category,
                });
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        }));
        const newStoredFiles = await Promise.all(filePromises);
        setStoredFiles(prev => ({ ...prev, [targetId]: [...(prev[targetId] || []), ...newStoredFiles] }));
    };

    const deleteFile = async (fileId: string, targetId: string) => {
        // Revoke Object URL để giải phóng bộ nhớ
        const file = storedFiles[targetId]?.find(f => f.id === fileId);
        if (file?.url?.startsWith('blob:')) URL.revokeObjectURL(file.url);
        setStoredFiles(prev => ({ ...prev, [targetId]: prev[targetId]?.filter(f => f.id !== fileId) || [] }));
    };

    // ── Activation & Verification ──

    const activateSystem = async (key: string, sdt: string = "", grade?: number): Promise<boolean> => {
        const machineId = getMachineId();
        const expectedKey = generateActivationKey(machineId, sdt);
        if (key !== expectedKey) return false;

        const phoneStr = normalizePhone(sdt);
        if (!phoneStr) return false;

        let dbGrade = grade;
        try {
            const { data, error } = await supabase.from('students').select('is_active, grade').eq('phone', phoneStr).maybeSingle();
            if (error) {
                console.error('[activateSystem] Supabase error:', error);
                // Network error — key đã khớp, cho phép kích hoạt offline
            } else if (data === null) {
                // Không tìm thấy SĐT trong DB — chưa đăng ký
                return false;
            } else {
                if (data.is_active === false) return false;
                if (data.grade) dbGrade = data.grade;
                // ✅ BUG 1 FIX: Dùng RPC SECURITY DEFINER thay vì UPDATE trực tiếp
                // anon key không còn cần quyền UPDATE trên bảng students nữa
                await supabase.rpc('activate_device', {
                    p_phone: phoneStr,
                    p_machine_id: machineId,
                    p_activation_key: CryptoJS.SHA256(key).toString(),
                });
            }
        } catch (err) {
            console.error('[activateSystem] unexpected error:', err);
            // Lỗi mạng — key đã khớp, tiếp tục kích hoạt
        }

        localStorage.setItem(STORAGE_ACTIVATION_KEY, 'true');
        if (sdt) localStorage.setItem('pv_activated_sdt', phoneStr || sdt);
        if (dbGrade) localStorage.setItem(STORAGE_GRADE_KEY, dbGrade.toString());
        setIsActivated(true);
        return true;
    };

    const verifyAccess = async (): Promise<'ok' | 'kicked'> => {
        const sdt = localStorage.getItem('pv_activated_sdt');
        const isCurrentlyActivated = localStorage.getItem(STORAGE_ACTIVATION_KEY) === 'true';
        if (!isCurrentlyActivated || !sdt) return 'ok';
        const machineId = getMachineId();
        try {
            const phoneStr = normalizePhone(sdt);
            if (!phoneStr) return 'ok';
            const { data, error } = await supabase.from('students').select('is_active, machine_id').eq('phone', phoneStr).maybeSingle();
            // Lỗi mạng hoặc Supabase timeout — không phạt học viên
            if (error) return 'ok';
            // Không tìm thấy record (bị xóa khỏi DB) hoặc bị vô hiệu hóa rõ ràng
            if (data === null || data.is_active === false) {
                localStorage.removeItem(STORAGE_ACTIVATION_KEY);
                setIsActivated(false);
                return 'kicked';
            }
            // machine_id không khớp — thiết bị khác
            if (data.machine_id && data.machine_id !== machineId) {
                localStorage.removeItem(STORAGE_ACTIVATION_KEY);
                setIsActivated(false);
                return 'kicked';
            }
            return 'ok';
        } catch {
            // Network error — transient, don't penalize
            return 'ok';
        }
    };

    // ── Telegram Cloud Sync: Fetch ──

    const fetchLessonsFromCloud = async (grade: number, onProgress?: (pct: number) => void): Promise<{ success: boolean; lessonCount: number; fileCount: number; skipped?: boolean }> => {
        if (_fetchLock.current[grade]) return { success: true, lessonCount: 0, fileCount: 0, skipped: true };
        _fetchLock.current[grade] = true;
        console.log(`[Fetch] Bắt đầu fetch Lớp ${grade}`);
        const t_fetch_total = performance.now();

        try {
            const localDataPromise = Promise.all([dbGet(STORAGE_LESSONS_KEY), dbGet(STORAGE_FILES_KEY)]);

            const cachedIndexFileId = localStorage.getItem(`pv_sync_file_id_${grade}`);
            let speculativeIndexPromise: Promise<ArrayBuffer> | null = null;
            if (cachedIndexFileId) speculativeIndexPromise = fetchViaCloudflareProxy(cachedIndexFileId);

            const t1 = performance.now();
            let indexFileId = cachedIndexFileId;
            try {
                const { data } = await supabase.from('vault_index').select('telegram_file_id').eq('grade', grade).maybeSingle();
                if (data?.telegram_file_id) indexFileId = data.telegram_file_id;
            } catch (e) { console.error("Lỗi lấy index từ Supabase", e); }
            console.log(`[Fetch] Giai đoạn 1 (Supabase): ${(performance.now() - t1).toFixed(0)}ms`);
            if (!indexFileId) throw new Error(`Hệ thống chưa có dữ liệu cho Lớp ${grade}. Thầy vui lòng Sync trước nhé!`);

            const lastFetchedId = localStorage.getItem(`pv_last_fetched_index_${grade}`);
            if (lastFetchedId && lastFetchedId === indexFileId) {
                speculativeIndexPromise?.catch(() => { });
                console.log(`[Fetch] ⚡ Skip — đã có bản mới nhất (${(performance.now() - t_fetch_total).toFixed(0)}ms)`);
                if (onProgress) onProgress(100);
                return { success: true, lessonCount: 0, fileCount: 0, skipped: true };
            }

            const t2 = performance.now();
            let indexRaw: ArrayBuffer;
            if (indexFileId === cachedIndexFileId && speculativeIndexPromise) {
                indexRaw = await speculativeIndexPromise;
                console.log(`[Fetch] Giai đoạn 2 (Speculative HIT): ${(performance.now() - t2).toFixed(0)}ms`);
            } else {
                indexRaw = await fetchViaCloudflareProxy(indexFileId);
                console.log(`[Fetch] Giai đoạn 2 (Fresh download): ${(performance.now() - t2).toFixed(0)}ms`);
            }
            const indexData = JSON.parse(await smartDecrypt(new Uint8Array(indexRaw)));

            const [rawLessons, rawFiles] = await localDataPromise;
            const newLessonsMap = new Map();
            (rawLessons || []).forEach((l: Lesson) => newLessonsMap.set(l.id, l));
            const newFiles = { ...(rawFiles || {}) };
            let totalLessonCount = 0;
            let totalFileCount = 0;

            const mergePayload = (data: any) => {
                if (!data) return;
                (data.lessons || []).forEach((l: Lesson) => newLessonsMap.set(l.id, l));
                Object.assign(newFiles, data.files || {});
                totalLessonCount += (data.lessons || []).length;
                totalFileCount += Object.values((data.files || {}) as FileStorage).flat().length;
            };

            let allIds: string[] = [];
            if (indexData.zipFileIds || indexData.zipFileId) {
                const allZipIds: string[] = indexData.zipFileIds || [indexData.zipFileId];
                if (onProgress) onProgress(10);

                const CONCURRENCY = 8;
                let downloadedParts = 0;
                let zIdsToDownload: string[] = allZipIds;

                if (indexData.chunkContents && indexData.lessonVersions) {
                    const localVersions: Record<string, string> = JSON.parse(localStorage.getItem(`pv_lesson_versions_${grade}`) || '{}');
                    const changedIds = new Set<string>();
                    for (const [id, ver] of Object.entries(indexData.lessonVersions as Record<string, string>)) {
                        if (localVersions[id] !== ver) changedIds.add(id);
                    }
                    const remoteIds = new Set(Object.keys(indexData.lessonVersions as Record<string, string>));
                    const deletedIds = Object.keys(localVersions).filter(id => !remoteIds.has(id));

                    if (changedIds.size === 0 && deletedIds.length === 0) {
                        localStorage.setItem(`pv_last_fetched_index_${grade}`, indexFileId!);
                        localStorage.setItem(`pv_lesson_versions_${grade}`, JSON.stringify(indexData.lessonVersions));
                        if (onProgress) onProgress(100);
                        return { success: true, lessonCount: 0, fileCount: 0, skipped: true };
                    }

                    const chunkContents = indexData.chunkContents as Record<string, string[]>;
                    zIdsToDownload = allZipIds.filter(zipId => (chunkContents[zipId] || []).some(id => changedIds.has(id)));
                    for (const id of deletedIds) { newLessonsMap.delete(id); delete newFiles[id]; if (id.startsWith('ch_')) delete newFiles[id.substring(3)]; }
                    console.log(`[Fetch] Incremental: ${changedIds.size} thay đổi, ${deletedIds.length} xóa → tải ${zIdsToDownload.length}/${allZipIds.length} chunk(s)`);
                }

                const totalChunks = zIdsToDownload.length;
                const processZipPart = async (fileId: string): Promise<void> => {
                    const { default: JSZip } = await import('jszip');
                    const arrayBuf = await fetchViaCloudflareProxy(fileId);
                    const zip = new JSZip();
                    const unzipped = await zip.loadAsync(arrayBuf);
                    const filePromises: Promise<void>[] = [];
                    unzipped.forEach((_, fileObj) => {
                        if (!fileObj.dir) {
                            filePromises.push(fileObj.async("uint8array").then(async (bytes) => {
                                const decrypted = await smartDecrypt(bytes);
                                mergePayload(JSON.parse(decrypted));
                            }));
                        }
                    });
                    await Promise.all(filePromises);
                    downloadedParts++;
                    if (onProgress) onProgress(Math.floor(10 + (downloadedParts / totalChunks) * 80));
                };

                const t3 = performance.now();
                try {
                    const pool = new Set<Promise<void>>();
                    for (const id of zIdsToDownload) {
                        const p = processZipPart(id).then(() => { pool.delete(p); });
                        pool.add(p);
                        if (pool.size >= CONCURRENCY) await Promise.race(pool);
                    }
                    if (pool.size > 0) await Promise.all(pool);
                } catch (err: any) { throw new Error(`Tải đoạn dữ liệu thất bại. Vui lòng thử tải lại.`); }
                console.log(`[Fetch] Giai đoạn 3: ${(performance.now() - t3).toFixed(0)}ms`);
                if (onProgress) onProgress(90);
            } else if (indexData.lessonFileIds) {
                allIds = indexData.lessonFileIds as string[];
            } else if (indexData.chapterFileIds) {
                allIds = Object.values(indexData.chapterFileIds as Record<string, string>);
            }

            if (allIds.length > 0) {
                const CONCURRENCY = 8;
                const pool = new Set<Promise<void>>();
                for (const id of allIds) {
                    const p = (async () => {
                        const buf = await fetchViaCloudflareProxy(id);
                        mergePayload(JSON.parse(await smartDecrypt(new Uint8Array(buf))));
                    })().then(() => { pool.delete(p); });
                    pool.add(p);
                    if (pool.size >= CONCURRENCY) await Promise.race(pool);
                }
                if (pool.size > 0) await Promise.all(pool);
            }

            const t4 = performance.now();
            const uniqueLessons = Array.from(newLessonsMap.values()) as Lesson[];
            await dbSetBatch([[STORAGE_LESSONS_KEY, uniqueLessons], [STORAGE_FILES_KEY, newFiles]]);
            setLessons(uniqueLessons);
            setStoredFiles(newFiles);
            console.log(`[Fetch] Giai đoạn 4: ${(performance.now() - t4).toFixed(0)}ms`);
            console.log(`[Fetch] ✅ Tổng: ${((performance.now() - t_fetch_total) / 1000).toFixed(2)}s | ${totalLessonCount} bài, ${totalFileCount} file`);

            localStorage.setItem(`pv_last_fetched_index_${grade}`, indexFileId!);
            if (indexData.lessonVersions) localStorage.setItem(`pv_lesson_versions_${grade}`, JSON.stringify(indexData.lessonVersions));

            return { success: true, lessonCount: totalLessonCount, fileCount: totalFileCount };
        } catch (err: any) { throw new Error(`Sync thất bại: ${err.message}`); }
        finally { _fetchLock.current[grade] = false; }
    };

    // ── Telegram Cloud Sync: Push ──

    const syncToCloud = async (grade: number, lessonsToSync: Lesson[], filesToSync: FileStorage): Promise<string> => {
        if (_syncLock.current[grade]) throw new Error('Đang sync, vui lòng đợi...');
        _syncLock.current[grade] = true;
        try {
        setSyncProgress(1);
        if (lessonsToSync.length === 0 && Object.keys(filesToSync).length === 0) {
            throw new Error('Này bro, chưa có bài giảng hay tài liệu nào để Sync đâu! Hãy thêm ít nhất 1 bài nhé.');
        }

        const lessonIds = new Set(lessonsToSync.map(l => l.id));
        const fileOnlyChapterIds = Object.keys(filesToSync).filter(k => !lessonIds.has(k));

        type PayloadEntry = { chapterId: string; lessons: Lesson[]; files: FileStorage };
        const payloads: PayloadEntry[] = [];
        for (const chId of fileOnlyChapterIds) {
            if (filesToSync[chId]?.length) payloads.push({ chapterId: chId, lessons: [], files: { [chId]: filesToSync[chId] } });
        }
        for (const lesson of lessonsToSync) {
            const lessonFiles: FileStorage = {};
            if (filesToSync[lesson.id]?.length) lessonFiles[lesson.id] = filesToSync[lesson.id];
            payloads.push({ chapterId: lesson.chapterId, lessons: [lesson], files: lessonFiles });
        }

        payloads.sort((a, b) => {
            const idA = a.lessons[0]?.id || `ch_${a.chapterId}`;
            const idB = b.lessons[0]?.id || `ch_${b.chapterId}`;
            return idA < idB ? -1 : idA > idB ? 1 : 0;
        });

        const uploadBlob = async (blob: Blob, fileName: string, onProgress?: (loaded: number) => void): Promise<string> => {
            const MAX_RETRIES = 5;
            for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
                const formData = new FormData();
                formData.append('chat_id', TELEGRAM_CHAT_ID);
                formData.append('document', blob, fileName);
                const result = await new Promise<{ ok: boolean; fileId?: string; retryAfter?: number; error?: string }>((resolve) => {
                    const xhr = new XMLHttpRequest();
                    xhr.open('POST', `${CLOUDFLARE_PROXY_URL}/proxy/sendDocument`);
                    xhr.setRequestHeader('Authorization', ADMIN_AUTH_HEADER);
                    xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded); };
                    xhr.onload = () => {
                        const data = JSON.parse(xhr.responseText);
                        if (xhr.status === 200 && data.ok) resolve({ ok: true, fileId: data.result.document.file_id });
                        else if (xhr.status === 429) resolve({ ok: false, retryAfter: (data?.parameters?.retry_after || 30) as number });
                        else resolve({ ok: false, error: `HTTP ${xhr.status}: ${xhr.responseText.slice(0, 150)}` });
                    };
                    xhr.onerror = () => resolve({ ok: false, error: 'Network Error' });
                    xhr.send(formData);
                });
                if (result.ok && result.fileId) return result.fileId;
                if (result.retryAfter) { await new Promise(r => setTimeout(r, (result.retryAfter! + 1) * 1000)); continue; }
                throw new Error(result.error || 'Upload thất bại');
            }
            throw new Error('Quá 5 lần thử lại — Telegram đang bị giới hạn.');
        };

        const MAX_CHUNK_SIZE = 18 * 1024 * 1024;
        const { default: JSZip } = await import('jszip');
        const zipChunks: InstanceType<typeof JSZip>[] = [];
        let currentZip = new JSZip();
        let currentChunkSize = 0;
        const chunkPayloadIds: string[][] = [];
        let currentPayloadIds: string[] = [];
        const lessonVersions: Record<string, string> = {};

        // AES encrypt all payloads in parallel for speed
        const payloadJsons = payloads.map(p => JSON.stringify({ ...p, syncedAt: Date.now() }));
        const encryptedPayloads = await Promise.all(payloadJsons.map(json => aesEncrypt(json)));

        for (let pi = 0; pi < payloads.length; pi++) {
            const p = payloads[pi];
            const payloadId = p.lessons[0]?.id || `ch_${p.chapterId}`;
            const vParts = [p.chapterId, ...p.lessons.map(l => `${l.id}:${l.name}:${l.createdAt}`), ...Object.values(p.files).flat().map(f => `${f.id}:${f.size}`)];
            lessonVersions[payloadId] = fnvHash(vParts.join('|'));

            const encrypted = encryptedPayloads[pi];
            const fileName = `g${grade}_${p.chapterId}_${p.lessons[0]?.id || 'ch'}.bin`;
            const contentBytes = encrypted.byteLength;

            if (currentChunkSize + contentBytes > MAX_CHUNK_SIZE && currentChunkSize > 0) {
                chunkPayloadIds.push(currentPayloadIds);
                currentPayloadIds = [];
                zipChunks.push(currentZip);
                currentZip = new JSZip();
                currentChunkSize = 0;
            }
            currentPayloadIds.push(payloadId);
            currentZip.file(fileName, encrypted);
            currentChunkSize += contentBytes;
        }
        if (currentChunkSize > 0) { chunkPayloadIds.push(currentPayloadIds); zipChunks.push(currentZip); }

        const prevChunkMap: Record<string, string> = JSON.parse(localStorage.getItem(`pv_sync_chunks_${grade}`) || '{}');
        const chunkFingerprints: string[] = chunkPayloadIds.map(ids => fnvHash(ids.map(id => `${id}:${lessonVersions[id]}`).sort().join(',')));

        const finalZipFileIds: string[] = new Array(zipChunks.length);
        const chunksToUpload: number[] = [];
        for (let i = 0; i < zipChunks.length; i++) {
            const fp = chunkFingerprints[i];
            if (prevChunkMap[fp]) { finalZipFileIds[i] = prevChunkMap[fp]; } else { chunksToUpload.push(i); }
        }

        let _peakProgress = 0;
        const setMonotonicProgress = (pct: number) => { if (pct > _peakProgress) { _peakProgress = pct; setSyncProgress(pct); } };

        if (chunksToUpload.length > 0) {
            const uploadedPerPart: number[] = new Array(chunksToUpload.length).fill(0);
            let estimatedTotalSize = chunksToUpload.length * 5 * 1024 * 1024;

            const uploadPromises: Promise<void>[] = [];
            for (let u = 0; u < chunksToUpload.length; u++) {
                const i = chunksToUpload[u];
                const zipBlob = await zipChunks[i].generateAsync(
                    { type: 'blob', compression: "DEFLATE", compressionOptions: { level: 1 } },
                    (meta) => { setMonotonicProgress(Math.floor((u + meta.percent / 100) * (20 / chunksToUpload.length))); }
                );
                estimatedTotalSize = Math.max(estimatedTotalSize, zipBlob.size * chunksToUpload.length);
                const uploadIdx = u;
                const chunkIdx = i;
                uploadPromises.push(
                    uploadBlob(zipBlob, `vault_g${grade}_v3_part${i + 1}.zip`, (loaded) => {
                        uploadedPerPart[uploadIdx] = loaded;
                        const totalLoaded = uploadedPerPart.reduce((a, b) => a + b, 0);
                        setMonotonicProgress(Math.min(20 + Math.floor((totalLoaded / estimatedTotalSize) * 75), 95));
                    }).then(fileId => { finalZipFileIds[chunkIdx] = fileId; })
                );
            }
            await Promise.all(uploadPromises);
        } else {
            setMonotonicProgress(95);
        }

        setSyncProgress(95);
        const indexPayload = {
            grade, zipFileIds: finalZipFileIds, totalLessons: lessonsToSync.length, updatedAt: Date.now(),
            chunkContents: Object.fromEntries(finalZipFileIds.map((id, i) => [id, chunkPayloadIds[i]])),
            lessonVersions,
        };
        const indexEncrypted = await aesEncrypt(JSON.stringify(indexPayload));
        const indexBlob = new Blob([indexEncrypted], { type: 'application/octet-stream' });
        const indexForm = new FormData();
        indexForm.append('chat_id', TELEGRAM_CHAT_ID);
        indexForm.append('document', indexBlob, `index_grade${grade}_v3.json`);
        indexForm.append('caption', `[INDEX-V3-ZIP] Lớp ${grade} | ${finalZipFileIds.length} phần`);

        const indexRes = await fetch(`${CLOUDFLARE_PROXY_URL}/proxy/sendDocument`, {
            method: 'POST', headers: { 'Authorization': ADMIN_AUTH_HEADER }, body: indexForm
        });
        if (!indexRes.ok) { setSyncProgress(0); throw new Error(`Lỗi upload Index: ${indexRes.statusText}`); }

        const finalFileId = (await indexRes.json()).result.document.file_id;
        // ✅ BUG 3 FIX: Dùng RPC SECURITY DEFINER để admin upsert vault_index
        // anon key bị REVOKE INSERT/UPDATE trên vault_index nên KHÔNG thể gọi trực tiếp
        const { error: sbError } = await supabase.rpc('admin_upsert_vault_index', {
            p_grade: grade,
            p_telegram_file_id: finalFileId,
            // updated_at tự được fill bởi DEFAULT now() phía Postgres
        });
        if (sbError) throw new Error("Supabase từ chối lưu: " + sbError.message);

        localStorage.setItem(`pv_sync_file_id_${grade}`, finalFileId);
        const newChunkMap: Record<string, string> = {};
        chunkFingerprints.forEach((fp, i) => { newChunkMap[fp] = finalZipFileIds[i]; });
        localStorage.setItem(`pv_sync_chunks_${grade}`, JSON.stringify(newChunkMap));

        setSyncProgress(100);
        setTimeout(() => setSyncProgress(0), 1000);

        // Cache warming (background)
        (async () => {
            try {
                const newChunkIds = chunksToUpload.map(i => finalZipFileIds[i]);
                const allWarmIds = [finalFileId, ...newChunkIds];
                for (const id of allWarmIds) {
                    try {
                        const ctrl = new AbortController();
                        const tid = setTimeout(() => ctrl.abort(), 30_000);
                        await fetch(`${CLOUDFLARE_PROXY_URL}/getFile/${id}`, { signal: ctrl.signal });
                        clearTimeout(tid);
                    } catch { }
                }
            } catch { }
        })();

        // Auto-create notification
        try {
            const gradeLabel = grade === 12 ? 'Lớp 12' : grade === 11 ? 'Lớp 11' : 'Lớp 10';
            // ✅ BUG 4 FIX: Dùng RPC SECURITY DEFINER để admin insert notification
            // anon key bị REVOKE INSERT trên notifications nên KHÔNG thể gọi trực tiếp
            await supabase.rpc('admin_insert_notification', {
                p_message: `Thầy vừa cập nhật tài liệu mới cho ${gradeLabel}! Hãy bấm nút bên dưới để tải về ngay nhé.`,
                p_grade: grade,
                p_fetch_enabled: true,
            });
        } catch (notifErr) { console.error('[Notification] Không tạo được thông báo:', notifErr); }

        return finalFileId;
        } finally { _syncLock.current[grade] = false; }
    };

    return {
        lessons, storedFiles, loading, isActivated, syncProgress,
        addLesson, deleteLesson, uploadFiles, deleteFile,
        activateSystem, verifyAccess,
        fetchLessonsFromCloud, syncToCloud,
        // Re-exported from services (backward compatible API)
        uploadExamPdf: examService.uploadExamPdf,
        saveExam: examService.saveExam,
        loadExams: examService.loadExams,
        deleteExam: examService.deleteExam,
        saveExamResult: examService.saveExamResult,
        getExamHistory: examService.getExamHistory,
        getLeaderboard: examService.getLeaderboard,
        getStudyPlans: plannerService.getStudyPlans,
        saveStudyPlan: plannerService.saveStudyPlan,
        updateStudyPlan: plannerService.updateStudyPlan,
        deleteStudyPlan: plannerService.deleteStudyPlan,
        getSchedules: plannerService.getSchedules,
        saveSchedule: plannerService.saveSchedule,
        updateSchedule: plannerService.updateSchedule,
        deleteSchedule: plannerService.deleteSchedule,
        getNotifications: notificationService.getNotifications,
        deleteNotification: notificationService.deleteNotification,
        createCustomNotification: notificationService.createCustomNotification,
        markNotificationFetched: notificationService.markNotificationFetched,
        getFetchedNotificationIds: notificationService.getFetchedNotificationIds,
        submitQuestionVote: notificationService.submitQuestionVote,
        getQuestionVotes: notificationService.getQuestionVotes,
        getBlogs: blogService.getBlogs,
        saveBlog: blogService.saveBlog,
        deleteBlog: blogService.deleteBlog,
        syncBlogs: blogService.syncBlogs,
        fetchBlogsForEditing: blogService.fetchBlogsForEditing,
    };
};

```

>>>>> FILE: components/StatsPanel.tsx
```tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../src/lib/supabase';
import {
    BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer, ReferenceLine, AreaChart, Area,
} from 'recharts';
import {
    TrendingUp, TrendingDown, Users, Award, AlertTriangle,
    Search, Download, RefreshCw, BarChart2, UserX,
    ChevronRight, ChevronUp, ChevronDown, Minus, BookOpen, CheckCircle, ArrowLeft, X,
    Sparkles, Target, Zap, Star, Brain, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { ExamResultRecord } from '../types';
import { useUIStore } from '../src/stores/useUIStore';

// ── Grade config ──────────────────────────────────────────────────
const GRADE_CFG = {
    10: { label: 'Lớp 10', color: '#448361', bg: '#EAF3EE' },
    11: { label: 'Lớp 11', color: '#6B7CDB', bg: '#EEF0FB' },
    12: { label: 'Lớp 12', color: '#9065B0', bg: '#F3ECF8' },
} as const;

const GRADE_OPTIONS = [
    { value: 10 as const, label: 'Lớp 10', color: '#448361', bg: '#EAF3EE' },
    { value: 11 as const, label: 'Lớp 11', color: '#6B7CDB', bg: '#EEF0FB' },
    { value: 12 as const, label: 'Lớp 12', color: '#9065B0', bg: '#F3ECF8' },
];

// Legacy score buckets (overview tab)
const SCORE_BUCKETS = [
    { label: '0–2', min: 0, max: 2, fill: '#E03E3E' },
    { label: '2–4', min: 2, max: 4, fill: '#E03E3E' },
    { label: '4–5', min: 4, max: 5, fill: '#D9730D' },
    { label: '5–6', min: 5, max: 6, fill: '#D9730D' },
    { label: '6–7', min: 6, max: 7, fill: '#6B7CDB' },
    { label: '7–8', min: 7, max: 8, fill: '#6B7CDB' },
    { label: '8–9', min: 8, max: 9, fill: '#448361' },
    { label: '9–10', min: 9, max: 10.1, fill: '#448361' },
];
// New score buckets for exam analysis (6 bands as required)
const SCORE_BUCKETS_NEW = [
    { label: '0–2', min: 0, max: 2, fill: '#EF4444' },
    { label: '2–4', min: 2, max: 4, fill: '#F97316' },
    { label: '4–6', min: 4, max: 6, fill: '#FBBF24' },
    { label: '6–8', min: 6, max: 8, fill: '#60A5FA' },
    { label: '8–9', min: 8, max: 9, fill: '#34D399' },
    { label: '9–10', min: 9, max: 10.1, fill: '#10B981' },
];

const TOOLTIP_STYLE: React.CSSProperties = {
    borderRadius: '10px',
    border: '1px solid #E9E9E7',
    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
    fontSize: '13px',
    background: '#fff',
};

function scoreColor(s: number) {
    if (s >= 8) return '#448361';
    if (s >= 5) return '#D9730D';
    return '#E03E3E';
}
function scoreBg(s: number) {
    if (s >= 8) return '#EAF3EE';
    if (s >= 5) return '#FFF3E8';
    return '#FEF0F0';
}
function scoreCellBg(s: number): string {
    if (s >= 8) return '#dcfce7';
    if (s < 5) return '#fee2e2';
    return 'transparent';
}
function scoreTextColor(s: number): string {
    if (s >= 8) return '#166534';
    if (s < 5) return '#991b1b';
    return '#1a1a1a';
}

// ── StudentProfile ────────────────────────────────────────────────
interface StudentProfile {
    phone: string;
    name: string;
    grade: number;
    scores: number[];
    exams: string[];
    dates: string[];
    avg: number;
    best: number;
    worst: number;
    trend: number;
}

function buildProfiles(records: ExamResultRecord[]): StudentProfile[] {
    const map: Record<string, StudentProfile> = {};
    for (const r of records) {
        if (!map[r.student_phone]) {
            map[r.student_phone] = {
                phone: r.student_phone,
                name: r.student_name,
                grade: r.grade,
                scores: [], exams: [], dates: [],
                avg: 0, best: 0, worst: 0, trend: 0,
            };
        }
        map[r.student_phone].scores.push(r.score);
        map[r.student_phone].exams.push(r.exam_title);
        map[r.student_phone].dates.push(r.submitted_at);
    }
    return Object.values(map).map(s => {
        const avg = s.scores.reduce((a, b) => a + b, 0) / s.scores.length;
        const trend = s.scores.length >= 2 ? s.scores[s.scores.length - 1] - s.scores[0] : 0;
        return { ...s, avg, best: Math.max(...s.scores), worst: Math.min(...s.scores), trend };
    });
}

// ── StudentDetailModal ────────────────────────────────────────────
interface StudentDetailModalProps {
    studentName: string;
    studentPhone: string;
    records: ExamResultRecord[];
    onClose: () => void;
}
const StudentDetailModal: React.FC<StudentDetailModalProps> = ({ studentName, studentPhone, records, onClose }) => {
    const sorted = useMemo(
        () => [...records].sort((a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()),
        [records],
    );
    const avg = sorted.length > 0 ? sorted.reduce((s, r) => s + r.score, 0) / sorted.length : 0;
    const best = sorted.length > 0 ? Math.max(...sorted.map(r => r.score)) : 0;
    const worst = sorted.length > 0 ? Math.min(...sorted.map(r => r.score)) : 0;
    const initials = studentName.trim().split(/\s+/).filter(Boolean).map(p => p[0]).join('').toUpperCase().slice(0, 2);
    const maskedPhone = studentPhone.length >= 6 ? studentPhone.slice(0, 3) + ' **** ' + studentPhone.slice(-2) : studentPhone;

    useEffect(() => {
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prevOverflow; };
    }, []);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [onClose]);

    const portalTarget = typeof document !== 'undefined' ? document.body : null;
    if (!portalTarget) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 animate-fade-in"
            style={{ background: 'rgba(26,26,26,0.45)' }}
        >
            <div
                className="w-full overflow-hidden animate-scale-in"
                style={{
                    maxWidth: '560px',
                    background: '#FFFFFF',
                    border: '1px solid #E9E9E7',
                    borderRadius: '16px',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
                    maxHeight: '80vh',
                    display: 'flex',
                    flexDirection: 'column',
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #E9E9E7', background: '#EEF0FB' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0" style={{ background: '#6B7CDB' }}>
                            {initials}
                        </div>
                        <div>
                            <h3 className="text-base font-bold" style={{ color: '#1A1A1A' }}>{studentName}</h3>
                            <p className="text-xs mt-0.5" style={{ color: '#787774' }}>{maskedPhone} · {sorted.length} bài thi</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex gap-4">
                            <div className="text-center">
                                <div className="text-xl font-bold" style={{ color: scoreTextColor(avg) }}>{avg.toFixed(2)}</div>
                                <div className="text-[10px] uppercase tracking-wider" style={{ color: '#AEACA8' }}>Điểm TB</div>
                            </div>
                            <div className="text-center">
                                <div className="text-xl font-bold" style={{ color: scoreTextColor(best) }}>{best.toFixed(1)}</div>
                                <div className="text-[10px] uppercase tracking-wider" style={{ color: '#AEACA8' }}>Cao nhất</div>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ color: '#787774' }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#E9E9E7'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                            title="Đóng (Esc)"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Table */}
                <div style={{ overflowY: 'auto', flex: 1 }}>
                    {sorted.length === 0 ? (
                        <div className="py-12 text-center">
                            <BookOpen className="w-8 h-8 mx-auto mb-2" style={{ color: '#CFCFCB' }} />
                            <p className="text-sm" style={{ color: '#AEACA8' }}>Chưa có bài thi nào</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr style={{ background: '#F7F6F3', borderBottom: '2px solid #E9E9E7' }}>
                                    <th className="px-4 py-2.5 text-center text-xs font-semibold" style={{ color: '#787774', width: 40 }}>#</th>
                                    <th className="px-4 py-2.5 text-left text-xs font-semibold" style={{ color: '#787774' }}>Bài Thi</th>
                                    <th className="px-4 py-2.5 text-center text-xs font-semibold" style={{ color: '#787774', width: 75 }}>Điểm</th>
                                    <th className="px-4 py-2.5 text-center text-xs font-semibold" style={{ color: '#787774', width: 105 }}>Ngày Thi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sorted.map((r, idx) => (
                                    <tr key={`${r.exam_id}-${idx}`} style={{ borderBottom: '1px solid #F1F0EC', background: idx % 2 === 0 ? '#fff' : '#FAFAF9' }}>
                                        <td className="px-4 py-2.5 text-center text-xs" style={{ color: '#AEACA8' }}>{idx + 1}</td>
                                        <td className="px-4 py-2.5 text-sm" style={{ color: '#1A1A1A' }}>{r.exam_title}</td>
                                        <td className="px-4 py-2.5 text-center">
                                            <span className="inline-block px-2 py-0.5 rounded text-xs font-bold" style={{ background: scoreCellBg(r.score), color: scoreTextColor(r.score) }}>
                                                {r.score.toFixed(1)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5 text-center text-xs" style={{ color: '#AEACA8' }}>
                                            {new Date(r.submitted_at).toLocaleDateString('vi-VN')}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 flex items-center justify-between text-xs" style={{ borderTop: '1px solid #E9E9E7', background: '#FAFAF9' }}>
                    <span style={{ color: '#AEACA8' }}>
                        {sorted.length} bài · Thấp nhất:{' '}
                        <span style={{ color: scoreTextColor(worst), fontWeight: 600 }}>{worst.toFixed(1)}</span>
                    </span>
                    <button
                        onClick={onClose}
                        className="px-4 py-1.5 rounded-lg text-xs font-medium transition-colors"
                        style={{ background: '#EEF0FB', color: '#6B7CDB' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#DDE1F8'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#EEF0FB'}
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>,
        portalTarget,
    );
};
// ── Main component ────────────────────────────────────────────────
// ── GradebookTable child component ───────────────────────────────
interface GradebookRow {
    phone: string;
    name: string;
    scores: Record<string, number>;
    avg: number;
}
interface GradebookTableProps {
    rows: GradebookRow[];
    examColumns: { id: string; title: string }[];
    sortAsc: boolean;
    onToggleSort: () => void;
    onSelectStudent?: (phone: string, name: string) => void;
}
const GradebookTable: React.FC<GradebookTableProps> = ({ rows, examColumns, sortAsc, onToggleSort, onSelectStudent }) => {
    if (rows.length === 0) {
        return (
            <div className="rounded-xl py-16 text-center" style={{ background: '#fff', border: '1px solid #E9E9E7' }}>
                <BookOpen className="w-10 h-10 mx-auto mb-3" style={{ color: '#CFCFCB' }} />
                <p className="text-sm font-medium" style={{ color: '#57564F' }}>Lớp này chưa có dữ liệu bài thi</p>
                <p className="text-xs mt-1" style={{ color: '#AEACA8' }}>Học sinh cần hoàn thành ít nhất 1 bài thi</p>
            </div>
        );
    }
    return (
        <div className="rounded-xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E9E9E7' }}>
            {/* Legend */}
            <div className="px-4 py-2 flex items-center gap-4 text-[11px]" style={{ borderBottom: '1px solid #F1F0EC', background: '#FAFAF9', color: '#AEACA8' }}>
                <span className="font-semibold" style={{ color: '#57564F' }}>Chú thích:</span>
                <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#dcfce7' }} />
                    <span style={{ color: '#166534' }}>≥ 8 — Giỏi</span>
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#fee2e2' }} />
                    <span style={{ color: '#991b1b' }}>&lt; 5 — Chưa đạt</span>
                </span>
            </div>
            {/* Scrollable table */}
            <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse" style={{ minWidth: 'max-content' }}>
                    <thead>
                        <tr style={{ background: '#F7F6F3', borderBottom: '2px solid #E9E9E7' }}>
                            <th className="px-3 py-3 text-center font-semibold text-xs" style={{ color: '#787774', position: 'sticky', left: 0, background: '#F7F6F3', zIndex: 20, width: 48, boxShadow: '2px 0 4px rgba(0,0,0,0.04)' }}>
                                STT
                            </th>
                            <th className="px-4 py-3 text-left font-semibold text-xs" style={{ color: '#787774', position: 'sticky', left: 48, background: '#F7F6F3', zIndex: 20, minWidth: 160, boxShadow: '2px 0 4px rgba(0,0,0,0.04)' }}>
                                Tên Học Sinh
                            </th>
                            {examColumns.map(col => (
                                <th key={col.id} className="px-3 py-3 text-center font-semibold text-xs" style={{ color: '#787774', minWidth: 100 }} title={col.title}>
                                    <div className="max-w-[88px] mx-auto truncate">{col.title}</div>
                                </th>
                            ))}
                            <th
                                className="px-3 py-3 text-center font-semibold text-xs cursor-pointer select-none"
                                style={{ color: '#6B7CDB', background: '#EEF0FB', position: 'sticky', right: 0, zIndex: 20, minWidth: 105, boxShadow: '-2px 0 4px rgba(0,0,0,0.04)', whiteSpace: 'nowrap' }}
                                onClick={onToggleSort}
                            >
                                <span className="flex items-center justify-center gap-1">
                                    Điểm TB
                                    {sortAsc ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                </span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, idx) => {
                            const rowBase = idx % 2 === 0 ? '#fff' : '#FAFAF9';
                            const avgBg = scoreCellBg(row.avg) !== 'transparent' ? scoreCellBg(row.avg) : rowBase;
                            return (
                                <tr key={row.phone} style={{ borderBottom: '1px solid #F1F0EC' }}>
                                    <td className="px-3 py-2.5 text-xs text-center" style={{ color: '#AEACA8', position: 'sticky', left: 0, background: rowBase, zIndex: 10, boxShadow: '2px 0 4px rgba(0,0,0,0.04)' }}>
                                        {idx + 1}
                                    </td>
                                    <td
                                        className="px-4 py-2.5 font-medium text-sm cursor-pointer"
                                        style={{ color: '#6B7CDB', position: 'sticky', left: 48, background: rowBase, zIndex: 10, boxShadow: '2px 0 4px rgba(0,0,0,0.04)', textDecoration: 'underline', textDecorationColor: '#6B7CDB66' }}
                                        onClick={() => onSelectStudent?.(row.phone, row.name)}
                                        title="Xem bảng điểm cá nhân"
                                    >
                                        {row.name}
                                    </td>
                                    {examColumns.map(col => {
                                        const score = row.scores[col.id];
                                        return (
                                            <td key={col.id} className="px-3 py-2.5 text-center" style={{ background: rowBase }}>
                                                {score !== undefined ? (
                                                    <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold" style={{ background: scoreCellBg(score), color: scoreTextColor(score) }}>
                                                        {score.toFixed(1)}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs" style={{ color: '#D1D0CB' }}>—</span>
                                                )}
                                            </td>
                                        );
                                    })}
                                    <td className="px-3 py-2.5 text-center font-bold text-sm" style={{ color: scoreTextColor(row.avg), background: avgBg, position: 'sticky', right: 0, zIndex: 10, boxShadow: '-2px 0 4px rgba(0,0,0,0.04)' }}>
                                        {row.avg.toFixed(2)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <div className="px-4 py-2.5 text-xs" style={{ borderTop: '1px solid #F1F0EC', color: '#AEACA8' }}>
                {rows.length} học sinh · {examColumns.length} bài kiểm tra
            </div>
        </div>
    );
};

// ── ExamAnalysis child component ──────────────────────────────────
interface ExamAnalysisProps {
    examRecords: ExamResultRecord[];
    totalStudentsInGrade: number;
}
const ExamAnalysis: React.FC<ExamAnalysisProps> = ({ examRecords, totalStudentsInGrade }) => {
    const studentBestScores = useMemo(() => {
        const map = new Map<string, { name: string; phone: string; score: number }>();
        for (const r of examRecords) {
            const existing = map.get(r.student_phone);
            if (!existing || r.score > existing.score) {
                map.set(r.student_phone, { name: r.student_name, phone: r.student_phone, score: r.score });
            }
        }
        return Array.from(map.values());
    }, [examRecords]);
    const count = studentBestScores.length;
    const scores = useMemo(() => studentBestScores.map(s => s.score), [studentBestScores]);
    const avgScore = count > 0 ? scores.reduce((a, b) => a + b, 0) / count : 0;
    const maxScore = count > 0 ? Math.max(...scores) : 0;
    const minScore = count > 0 ? Math.min(...scores) : 0;
    const distribution = useMemo(
        () => SCORE_BUCKETS_NEW.map(b => ({ label: b.label, count: scores.filter(s => s >= b.min && s < b.max).length, fill: b.fill })),
        [scores],
    );
    const topStudents = useMemo(
        () => [...studentBestScores].filter(s => s.score >= 8).sort((a, b) => b.score - a.score),
        [studentBestScores],
    );
    const concernStudents = useMemo(
        () => [...studentBestScores].filter(s => s.score < 5).sort((a, b) => a.score - b.score),
        [studentBestScores],
    );
    if (count === 0) {
        return (
            <div className="rounded-xl py-16 text-center" style={{ background: '#fff', border: '1px solid #E9E9E7' }}>
                <BarChart2 className="w-10 h-10 mx-auto mb-3" style={{ color: '#CFCFCB' }} />
                <p className="text-sm font-medium" style={{ color: '#57564F' }}>Chưa có kết quả cho bài thi này</p>
                <p className="text-xs mt-1" style={{ color: '#AEACA8' }}>Hãy chọn một bài kiểm tra khác hoặc chờ học sinh nộp bài</p>
            </div>
        );
    }
    const statCards = [
        { label: 'Sĩ số lớp', value: String(totalStudentsInGrade), sub: 'học sinh', color: '#9065B0', bg: '#F3ECF8', Icon: Users },
        { label: 'Tham gia', value: String(count), sub: 'bài nộp', color: '#6B7CDB', bg: '#EEF0FB', Icon: BookOpen },
        { label: 'Điểm cao nhất', value: maxScore.toFixed(1), sub: '/ 10', color: '#448361', bg: '#EAF3EE', Icon: Award },
        { label: 'Điểm thấp nhất', value: minScore.toFixed(1), sub: '/ 10', color: '#E03E3E', bg: '#FEF0F0', Icon: TrendingDown },
        { label: 'Điểm TB đề', value: avgScore.toFixed(2), sub: '/ 10', color: avgScore >= 5 ? '#D9730D' : '#E03E3E', bg: avgScore >= 5 ? '#FFF3E8' : '#FEF0F0', Icon: BarChart2 },
    ] as const;
    return (
        <div className="space-y-4">
            {/* Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {statCards.map(card => (
                    <div key={card.label} className="rounded-xl p-4" style={{ background: '#fff', border: '1px solid #E9E9E7', borderLeft: `3px solid ${card.color}` }}>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-semibold uppercase tracking-wider leading-tight" style={{ color: '#AEACA8' }}>{card.label}</span>
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: card.bg }}>
                                <card.Icon className="w-3.5 h-3.5" style={{ color: card.color }} />
                            </div>
                        </div>
                        <div className="text-2xl font-bold" style={{ color: card.color }}>{card.value}</div>
                        <div className="text-[11px] mt-0.5" style={{ color: '#AEACA8' }}>{card.sub}</div>
                    </div>
                ))}
            </div>
            {/* Score Distribution */}
            <div className="rounded-xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E9E9E7' }}>
                <div className="px-4 py-3" style={{ borderBottom: '1px solid #E9E9E7', borderLeft: '3px solid #D9730D', background: '#FFF3E8' }}>
                    <h3 className="text-sm font-semibold" style={{ color: '#D9730D' }}>Phổ Điểm Bài Thi</h3>
                    <p className="text-[11px]" style={{ color: '#AEACA8' }}>Phân bố điểm số của {count} học sinh</p>
                </div>
                <div className="p-4">
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={distribution} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F1F0EC" vertical={false} />
                            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#AEACA8' }} axisLine={{ stroke: '#E9E9E7' }} tickLine={false} />
                            <YAxis tick={{ fontSize: 11, fill: '#AEACA8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`${v} học sinh`, 'Số lượng']} />
                            <Bar dataKey="count" name="Số học sinh" radius={[5, 5, 0, 0]}>
                                {distribution.map((entry, i) => <Cell key={i} fill={entry.fill} fillOpacity={0.85} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
            {/* Vinh Danh & Cần Chú Ý */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Top scorers */}
                <div className="rounded-xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E9E9E7' }}>
                    <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #E9E9E7', borderLeft: '3px solid #448361', background: '#EAF3EE' }}>
                        <Star className="w-4 h-4 shrink-0" style={{ color: '#448361' }} />
                        <div>
                            <h3 className="text-sm font-semibold" style={{ color: '#448361' }}>Bảng Vinh Danh</h3>
                            <p className="text-[11px]" style={{ color: '#6B9B7B' }}>Học sinh đạt ≥ 8 điểm · {topStudents.length} em</p>
                        </div>
                    </div>
                    <div>
                        {topStudents.length === 0 ? (
                            <p className="px-4 py-8 text-sm text-center" style={{ color: '#AEACA8' }}>Không có học sinh đạt ≥ 8 điểm</p>
                        ) : topStudents.map((s, idx) => (
                            <div key={s.phone} className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: idx < topStudents.length - 1 ? '1px solid #F1F0EC' : 'none' }}>
                                <div className="flex items-center gap-2.5">
                                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: idx === 0 ? '#FEF9C3' : '#EAF3EE', color: idx === 0 ? '#854D0E' : '#448361' }}>
                                        {idx + 1}
                                    </span>
                                    <span className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{s.name}</span>
                                </div>
                                <span className="text-sm font-bold px-2.5 py-0.5 rounded-lg" style={{ background: '#dcfce7', color: '#166534' }}>{s.score.toFixed(1)}</span>
                            </div>
                        ))}
                    </div>
                </div>
                {/* Concern students */}
                <div className="rounded-xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E9E9E7' }}>
                    <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #E9E9E7', borderLeft: '3px solid #E03E3E', background: '#FEF0F0' }}>
                        <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: '#E03E3E' }} />
                        <div>
                            <h3 className="text-sm font-semibold" style={{ color: '#E03E3E' }}>Nhóm Cần Chú Ý</h3>
                            <p className="text-[11px]" style={{ color: '#C97C7C' }}>Điểm dưới 5 · {concernStudents.length} em</p>
                        </div>
                    </div>
                    <div>
                        {concernStudents.length === 0 ? (
                            <div className="px-4 py-8 text-center">
                                <p className="text-sm font-medium" style={{ color: '#448361' }}>Tuyệt vời! 🎉</p>
                                <p className="text-xs mt-1" style={{ color: '#AEACA8' }}>Không có học sinh nào dưới 5 điểm</p>
                            </div>
                        ) : concernStudents.map((s, idx) => (
                            <div key={s.phone} className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: idx < concernStudents.length - 1 ? '1px solid #F1F0EC' : 'none' }}>
                                <div className="flex items-center gap-2.5">
                                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: '#FEF0F0', color: '#E03E3E' }}>
                                        {idx + 1}
                                    </span>
                                    <span className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{s.name}</span>
                                </div>
                                <span className="text-sm font-bold px-2.5 py-0.5 rounded-lg" style={{ background: '#fee2e2', color: '#991b1b' }}>{s.score.toFixed(1)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ── StatsPanel (Main) ─────────────────────────────────────────────
const StatsPanel: React.FC = () => {
    const [records, setRecords] = useState<ExamResultRecord[]>([]);
    const [loading, setLoading] = useState(true);
    // classMap: id -> name
    const [classMap, setClassMap] = useState<Record<string, string>>({});
    // studentClassMap: phone -> class_id
    const [studentClassMap, setStudentClassMap] = useState<Record<string, string>>({});
    // allStudents: danh sách toàn bộ học sinh (dùng để tính sĩ số thực)
    const [allStudents, setAllStudents] = useState<Array<{ phone: string; class_id: string | null; grade: number }>>([]);

    // ── DATA FETCHING — PRESERVED EXACTLY, DO NOT MODIFY ─────────

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [resultsRes, classesRes, studentsRes] = await Promise.all([
                supabase
                    .from('exam_results')
                    .select('*')
                    .order('submitted_at', { ascending: true }),
                supabase
                    .from('classes')
                    .select('id, name'),
                supabase
                    .from('students')
                    .select('phone, class_id, grade'),
            ]);
            setRecords((resultsRes.data as ExamResultRecord[]) || []);
            const newClassMap: Record<string, string> = {};
            for (const c of (classesRes.data || [])) {
                newClassMap[(c as { id: string; name: string }).id] = (c as { id: string; name: string }).name;
            }
            setClassMap(newClassMap);
            const newStudentClassMap: Record<string, string> = {};
            const newAllStudents: Array<{ phone: string; class_id: string | null; grade: number }> = [];
            for (const s of (studentsRes.data || [])) {
                const row = s as { phone: string; class_id: string | null; grade: number };
                if (row.phone && row.class_id) newStudentClassMap[row.phone] = row.class_id;
                if (row.phone && row.grade != null) newAllStudents.push({ phone: row.phone, class_id: row.class_id ?? null, grade: row.grade });
            }
            setStudentClassMap(newStudentClassMap);
            setAllStudents(newAllStudents);
        } catch (e) {
            console.error(e);
            useUIStore.getState().showToast(
                navigator.onLine ? 'Lỗi tải dữ liệu, thử lại sau.' : 'Mất kết nối mạng.',
                'error',
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    // ── NEW VIEW STATE ────────────────────────────────────────────
    const [selectedGrade, setSelectedGrade] = useState<10 | 11 | 12>(10);
    const [activeView, setActiveView] = useState<'gradebook' | 'exam-analysis'>('gradebook');
    const [selectedExamId, setSelectedExamId] = useState<string>('');
    const [sortAsc, setSortAsc] = useState(false);
    const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');
    const [selectedStudentPhone, setSelectedStudentPhone] = useState<string>('');
    const [selectedStudentName, setSelectedStudentName] = useState<string>('');

    // ── NEW VIEW: Derived data (useMemo only, no extra fetches) ───
    const gradeRecords = useMemo(
        () => records.filter(r => r.grade === selectedGrade),
        [records, selectedGrade],
    );

    const uniqueClasses = useMemo(() => {
        const set = new Set<string>();
        // ✅ BUG 2A FIX: Class dropdown giờ lấy data từ allStudents thay vì gradeRecords,
        // giúp hiển thị tất cả các lớp của khối, không chỉ các lớp có học sinh tham gia thi.
        for (const s of allStudents) {
            if (s.grade !== selectedGrade) continue;
            const className = s.class_id ? classMap[s.class_id] : undefined;
            if (className) set.add(className);
        }
        return Array.from(set).sort();
    }, [allStudents, selectedGrade, classMap]);

    // Reset class filter when grade changes
    useEffect(() => { setSelectedClassFilter('all'); }, [selectedGrade]);

    const filteredByClassRecords = useMemo(
        () => selectedClassFilter === 'all'
            ? gradeRecords
            : gradeRecords.filter(r => {
                const classId = studentClassMap[r.student_phone];
                const className = classId ? classMap[classId] : undefined;
                return className === selectedClassFilter;
            }),
        [gradeRecords, selectedClassFilter, studentClassMap, classMap],
    );

    const examList = useMemo(() => {
        const map = new Map<string, string>();
        for (const r of filteredByClassRecords) {
            if (!map.has(r.exam_id)) map.set(r.exam_id, r.exam_title);
        }
        return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
    }, [filteredByClassRecords]);
    useEffect(() => {
        if (examList.length > 0 && !examList.some(e => e.id === selectedExamId)) {
            setSelectedExamId(examList[0].id);
        } else if (examList.length === 0) {
            setSelectedExamId('');
        }
    }, [examList, selectedExamId]);
    const gradebookData = useMemo(() => {
        const studentMap = new Map<string, { name: string; scores: Record<string, number> }>();
        for (const r of filteredByClassRecords) {
            if (!studentMap.has(r.student_phone)) {
                studentMap.set(r.student_phone, { name: r.student_name, scores: {} });
            }
            studentMap.get(r.student_phone)!.scores[r.exam_id] = r.score;
        }
        const rows = Array.from(studentMap.entries()).map(([phone, data]) => {
            const vals = Object.values(data.scores);
            const avg = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
            return { phone, name: data.name, scores: data.scores, avg };
        });
        const sorted = [...rows].sort((a, b) => sortAsc ? a.avg - b.avg : b.avg - a.avg);
        return { rows: sorted, examColumns: examList };
    }, [filteredByClassRecords, examList, sortAsc]);
    const selectedExamRecords = useMemo(
        () => filteredByClassRecords.filter(r => r.exam_id === selectedExamId),
        [filteredByClassRecords, selectedExamId],
    );
    // ✅ BUG 2A FIX: Sĩ số thực lấy từ bảng students (có filter theo khối và lớp đang chọn)
    const totalStudentsInGrade = useMemo(() => {
        return allStudents.filter(s => {
            if (s.grade !== selectedGrade) return false;
            if (selectedClassFilter === 'all') return true;
            const studentClassName = s.class_id ? classMap[s.class_id] : null;
            return studentClassName === selectedClassFilter;
        }).length;
    }, [allStudents, selectedGrade, selectedClassFilter, classMap]);
    const gradeCfg = GRADE_OPTIONS.find(g => g.value === selectedGrade)!;
    const escapeCsv = (s: string) => `"${String(s).replace(/"/g, '""')}"`;

    const exportCSVNew = () => {
        const { examColumns, rows } = gradebookData;

        // Escape tên đề thi trong header — tránh CSV injection
        const headerCols = [escapeCsv('Họ tên'), ...examColumns.map(e => escapeCsv(e.title)), escapeCsv('Điểm TB')];
        const header = headerCols.join(',') + '\n';

        const csvRows = rows.map(row => {
            const scores = examColumns.map(exam => {
                const score = row.scores[exam.id];
                return score !== undefined ? score.toFixed(2) : '';
            });
            return [
                escapeCsv(row.name),   // ✅ BUG 3A FIX: escape tên học sinh
                ...scores,
                row.avg.toFixed(2),
            ].join(',');
        }).join('\n');

        const classNameDisplay = selectedClassFilter === 'all' ? 'TatCa' : selectedClassFilter.replace(/\s+/g, '_');
        const fileName = `Diem_Lop${selectedGrade}_${classNameDisplay}_${new Date().toISOString().slice(0, 10)}.csv`;

        const blob = new Blob(['\uFEFF' + header + csvRows], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = fileName;
        a.click(); URL.revokeObjectURL(url);
    };


    // ── Render ────────────────────────────────────────────────────
    return (
        <div className="space-y-5 pb-10 animate-fade-in">

            {/* ══════════════════════════════════════════════════════════
                SECTION A — Header & Global Controls
            ══════════════════════════════════════════════════════════ */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div>
                    <h2
                        className="text-2xl font-bold tracking-tight"
                        style={{ color: '#1A1A1A' }}
                    >
                        Sổ Điểm &amp; Quản Lý Học Sinh
                    </h2>
                    <p className="text-sm mt-1.5" style={{ color: '#787774' }}>
                        {loading ? (
                            'Đang tải dữ liệu…'
                        ) : (
                            <>
                                <span className="font-semibold" style={{ color: gradeCfg.color }}>
                                    {gradeCfg.label}
                                </span>
                                {' · '}
                                <span>{gradeRecords.length} bản ghi</span>
                                {' · '}
                                <span>{totalStudentsInGrade} học sinh</span>
                            </>
                        )}
                    </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={fetchData}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-80 disabled:opacity-50"
                        style={{
                            background: '#fff',
                            border: '1px solid #E9E9E7',
                            color: '#57564F',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                        }}
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Làm mới
                    </button>
                    <button
                        onClick={exportCSVNew}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
                        style={{
                            background: '#448361',
                            color: '#fff',
                            boxShadow: '0 2px 6px rgba(68,131,97,0.25)',
                        }}
                    >
                        <Download className="w-4 h-4" />
                        Xuất CSV
                    </button>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════
                SECTION B — Cascading Toolbar
            ══════════════════════════════════════════════════════════ */}
            <div
                className="rounded-2xl flex flex-wrap items-center gap-2 p-2"
                style={{
                    background: '#fff',
                    border: '1px solid #E9E9E7',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                }}
            >
                {/* ── Group 1: Grade Selector ── */}
                <div
                    className="flex items-center gap-1 p-1 rounded-xl"
                    style={{ background: '#F7F6F3' }}
                >
                    {GRADE_OPTIONS.map(g => {
                        const isActive = selectedGrade === g.value;
                        return (
                            <button
                                key={g.value}
                                onClick={() => setSelectedGrade(g.value)}
                                className="px-4 py-1.5 rounded-lg text-[13px] font-semibold transition-all"
                                style={{
                                    background: isActive ? g.color : 'transparent',
                                    color: isActive ? '#fff' : '#787774',
                                    boxShadow: isActive ? `0 2px 6px ${g.color}40` : 'none',
                                }}
                            >
                                {g.label}
                            </button>
                        );
                    })}
                </div>

                {/* Divider */}
                <div className="self-stretch w-px" style={{ background: '#E9E9E7' }} />

                {/* ── Group 1b: Class Selector ── */}
                <div className="flex items-center gap-2">
                    <span
                        className="text-[11px] font-semibold uppercase tracking-wider shrink-0"
                        style={{ color: '#AEACA8' }}
                    >
                        Lớp:
                    </span>
                    <select
                        value={selectedClassFilter}
                        onChange={e => setSelectedClassFilter(e.target.value)}
                        className="text-[13px] font-semibold rounded-xl px-3 py-1.5 outline-none cursor-pointer transition-all"
                        style={{
                            background: selectedClassFilter === 'all' ? '#F7F6F3' : '#EEF0FB',
                            border: `1px solid ${selectedClassFilter === 'all' ? '#E9E9E7' : '#6B7CDB44'}`,
                            color: selectedClassFilter === 'all' ? '#787774' : '#6B7CDB',
                        }}
                    >
                        <option value="all">Tất cả lớp</option>
                        {uniqueClasses.map(cls => (
                            <option key={cls} value={cls}>{cls}</option>
                        ))}
                        {uniqueClasses.length === 0 && (
                            <option disabled value="">— Chưa phân lớp —</option>
                        )}
                    </select>
                </div>

                {/* Divider */}
                <div className="self-stretch w-px" style={{ background: '#E9E9E7' }} />

                {/* ── Group 2: View Mode Toggle ── */}
                <div
                    className="flex items-center gap-1 p-1 rounded-xl"
                    style={{ background: '#F7F6F3' }}
                >
                    {(
                        [
                            {
                                key: 'gradebook' as const,
                                label: 'Sổ Điểm Lớp',
                                Icon: BookOpen,
                                activeColor: '#6B7CDB',
                                activeBg: '#EEF0FB',
                            },
                            {
                                key: 'exam-analysis' as const,
                                label: 'Phân Tích Đề Thi',
                                Icon: BarChart2,
                                activeColor: '#D9730D',
                                activeBg: '#FFF3E8',
                            },
                        ] as const
                    ).map(tab => {
                        const isActive = activeView === tab.key;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setActiveView(tab.key)}
                                className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-[13px] font-semibold transition-all"
                                style={{
                                    background: isActive ? tab.activeBg : 'transparent',
                                    color: isActive ? tab.activeColor : '#787774',
                                    border: isActive
                                        ? `1px solid ${tab.activeColor}33`
                                        : '1px solid transparent',
                                }}
                            >
                                <tab.Icon className="w-3.5 h-3.5" />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* ── Group 3: Exam Selector (exam-analysis only) ── */}
                {activeView === 'exam-analysis' && (
                    <>
                        <div className="self-stretch w-px" style={{ background: '#E9E9E7' }} />
                        <div className="flex items-center gap-2 px-1 flex-1 min-w-0">
                            <span
                                className="text-[11px] font-semibold uppercase tracking-wider shrink-0"
                                style={{ color: '#AEACA8' }}
                            >
                                Đề thi:
                            </span>
                            <select
                                value={selectedExamId}
                                onChange={e => setSelectedExamId(e.target.value)}
                                className="flex-1 min-w-0 text-sm font-medium rounded-xl px-3 py-1.5 outline-none transition-all cursor-pointer"
                                style={{
                                    background: '#FFF3E8',
                                    border: '1px solid #D9730D33',
                                    color: '#92400E',
                                    maxWidth: '340px',
                                }}
                            >
                                {examList.length === 0 ? (
                                    <option value="">— Chưa có bài thi nào —</option>
                                ) : (
                                    examList.map(e => (
                                        <option key={e.id} value={e.id}>{e.title}</option>
                                    ))
                                )}
                            </select>
                        </div>
                    </>
                )}
            </div>

            {/* ══════════════════════════════════════════════════════════
                SECTION C — Dynamic Main Content
            ══════════════════════════════════════════════════════════ */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-32 gap-3">
                    <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center"
                        style={{ background: '#EEF0FB' }}
                    >
                        <RefreshCw className="w-6 h-6 animate-spin" style={{ color: '#6B7CDB' }} />
                    </div>
                    <div className="text-center">
                        <p className="text-sm font-semibold" style={{ color: '#57564F' }}>
                            Đang tải dữ liệu
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: '#AEACA8' }}>
                            Vui lòng chờ trong giây lát…
                        </p>
                    </div>
                </div>
            ) : activeView === 'gradebook' ? (
                <GradebookTable
                    rows={gradebookData.rows}
                    examColumns={gradebookData.examColumns}
                    sortAsc={sortAsc}
                    onToggleSort={() => setSortAsc(s => !s)}
                    onSelectStudent={(phone, name) => { setSelectedStudentPhone(phone); setSelectedStudentName(name); }}
                />
            ) : (
                <ExamAnalysis
                    examRecords={selectedExamRecords}
                    totalStudentsInGrade={totalStudentsInGrade}
                />
            )}

            {/* Student detail modal */}
            {selectedStudentPhone && (
                <StudentDetailModal
                    studentName={selectedStudentName}
                    studentPhone={selectedStudentPhone}
                    records={filteredByClassRecords.filter(r => r.student_phone === selectedStudentPhone)}
                    onClose={() => setSelectedStudentPhone('')}
                />
            )}
        </div>
    );
};

export default StatsPanel;






```

>>>>> FILE: components/AdminGitHubSync.tsx
```tsx

import React, { useState, useRef, useMemo } from 'react';
import {
    CloudUpload, Send, CheckCircle2, RefreshCw, AlertCircle,
    FileText, Trash2, Upload,
    BookOpen, X, MessageCircle, Tag, ChevronDown, ChevronRight,
    BarChart3, AlertTriangle
} from 'lucide-react';

const Loader2 = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
    <RefreshCw className={`${className} animate-spin`} style={style} />
);

import { CURRICULUM } from '../constants';
import { Lesson, StoredFile, FileStorage } from '../types';


const LESSON_CATEGORIES = [
    'Trắc nghiệm Lý thuyết (ABCD)',
    'Trắc nghiệm Lý thuyết (Đúng/Sai)',
    'Bài tập Tính toán Cơ bản',
];

const CAT_CONFIG: Record<string, { short: string; color: string; bg: string }> = {
    'Trắc nghiệm Lý thuyết (ABCD)': { short: 'TN ABCD', color: '#4F5FBE', bg: '#DDE2F7' },
    'Trắc nghiệm Lý thuyết (Đúng/Sai)': { short: 'Đúng/Sai', color: '#7C4FAE', bg: '#E8DAFC' },
    'Bài tập Tính toán Cơ bản': { short: 'Tính toán', color: '#C4630A', bg: '#FFE4C8' },
};

interface AdminGitHubSyncProps {
    onBack: () => void;
    onShowToast: (msg: string, type: 'success' | 'error' | 'warning') => void;
    lessons: Lesson[];
    storedFiles: FileStorage;
    onAddLesson: (name: string, chapterId: string) => Promise<void>;
    onDeleteLesson: (id: string) => Promise<void>;
    onUploadFiles: (files: File[], targetId: string, category?: string) => Promise<void>;
    onDeleteFile: (fileId: string, targetId: string) => Promise<void>;
    onSyncToGitHub: (grade: number, lessons: Lesson[], files: FileStorage) => Promise<string>;
    syncProgress: number;
}

type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

const GRADE_COLORS: Record<number, { accent: string; bg: string; label: string }> = {
    12: { accent: '#9065B0', bg: '#F3ECF8', label: 'Vật Lý 12' },
    11: { accent: '#6B7CDB', bg: '#EEF0FB', label: 'Vật Lý 11' },
    10: { accent: '#448361', bg: '#EAF3EE', label: 'Vật Lý 10' },
};

const AdminGitHubSync: React.FC<AdminGitHubSyncProps> = ({
    onBack, onShowToast, lessons, storedFiles,
    onAddLesson, onDeleteLesson, onUploadFiles, onDeleteFile, onSyncToGitHub, syncProgress
}) => {


    const [selectedGrade, setSelectedGrade] = useState<number>(12);
    const [syncStatus, setSyncStatus] = useState<Record<number, SyncStatus>>({ 10: 'idle', 11: 'idle', 12: 'idle' });
    const [syncMsg, setSyncMsg] = useState<Record<number, string>>({});
    const [uploadingLesson, setUploadingLesson] = useState<string | null>(null);
    const [newLessonName, setNewLessonName] = useState('');
    const [newLessonChapter, setNewLessonChapter] = useState('');
    const [showAddLesson, setShowAddLesson] = useState(false);
    const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
    const [expandedLessons, setExpandedLessons] = useState<Set<string>>(new Set());
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [selectedUploadCategory, setSelectedUploadCategory] = useState<string>(LESSON_CATEGORIES[0]);
    const [pendingUploadLessonId, setPendingUploadLessonId] = useState<string | null>(null);


    const fileInputRef = useRef<HTMLInputElement>(null);
    const uploadTargetRef = useRef<string | null>(null);
    const uploadCategoryRef = useRef<string>(LESSON_CATEGORIES[0]);

    const color = GRADE_COLORS[selectedGrade];
    const gradeData = CURRICULUM.find(g => g.level === selectedGrade);
    const gradeLessons = lessons.filter(l => gradeData?.chapters.map(c => c.id).includes(l.chapterId));

    // Tổng hợp số file theo category cho toàn grade (cả file cấp bài và cấp chương)
    const categorySummary = useMemo(() => {
        const counts: Record<string, number> = {};
        let uncategorized = 0;
        LESSON_CATEGORIES.forEach(cat => counts[cat] = 0);
        // File cấp bài giảng
        gradeLessons.forEach(l => {
            (storedFiles[l.id] || []).forEach(f => {
                if (f.category && LESSON_CATEGORIES.includes(f.category)) counts[f.category]++;
                else uncategorized++;
            });
        });
        // File cấp chương
        gradeData?.chapters.forEach(ch => {
            (storedFiles[ch.id] || []).forEach(f => {
                if (f.category && LESSON_CATEGORIES.includes(f.category)) counts[f.category]++;
                else uncategorized++;
            });
        });
        return { counts, uncategorized };
    }, [gradeLessons, gradeData, storedFiles]);

    const gradeFiles: FileStorage = {};
    gradeLessons.forEach(l => { if (storedFiles[l.id]) gradeFiles[l.id] = storedFiles[l.id]; });
    // ✅ Bao gồm file cấp chương trong tổng count
    gradeData?.chapters.forEach(ch => { if (storedFiles[ch.id]?.length) gradeFiles[ch.id] = storedFiles[ch.id]; });
    const totalFiles = Object.values(gradeFiles).flat().length;
    const totalSize = Object.values(gradeFiles).flat().reduce((acc, f) => acc + f.size, 0);

    const handleSyncGrade = async (grade: number) => {
        const gData = CURRICULUM.find(g => g.level === grade);
        if (!gData) return;
        const gLessons = lessons.filter(l => gData.chapters.map(c => c.id).includes(l.chapterId));
        const gFiles: FileStorage = {};
        // Bao gồm file cấp bài giảng
        gLessons.forEach(l => { if (storedFiles[l.id]) gFiles[l.id] = storedFiles[l.id]; });
        // ✅ Bao gồm file cấp chương (storedFiles[chapterId]) — trước đây bị bỏ sót!
        gData.chapters.forEach(ch => { if (storedFiles[ch.id]?.length) gFiles[ch.id] = storedFiles[ch.id]; });
        const hasChapterFiles = gData.chapters.some(ch => (storedFiles[ch.id]?.length ?? 0) > 0);
        if (gLessons.length === 0 && !hasChapterFiles) { onShowToast(`Lớp ${grade} chưa có tài liệu nào!`, 'warning'); return; }
        setSyncStatus(prev => ({ ...prev, [grade]: 'syncing' }));
        setSyncMsg(prev => ({ ...prev, [grade]: '' }));
        try {
            const fileId = await onSyncToGitHub(grade, gLessons, gFiles);
            setSyncStatus(prev => ({ ...prev, [grade]: 'success' }));
            setSyncMsg(prev => ({ ...prev, [grade]: `✓ ID: ...${fileId.slice(-6)}` }));
            onShowToast(`Đã Sync Lớp ${grade} lên Telegram!`, 'success');
            setTimeout(() => setSyncStatus(prev => ({ ...prev, [grade]: 'idle' })), 10000);
        } catch (err: any) {
            setSyncStatus(prev => ({ ...prev, [grade]: 'error' }));
            setSyncMsg(prev => ({ ...prev, [grade]: err.message }));
            onShowToast(`Lỗi Sync Lớp ${grade}: ${err.message}`, 'error');
        }
    };

    const handleUploadTrigger = (lessonId: string) => {
        setPendingUploadLessonId(lessonId);
        setSelectedUploadCategory(LESSON_CATEGORIES[0]);
        setShowCategoryModal(true);
    };

    const handleCategoryConfirm = () => {
        uploadTargetRef.current = pendingUploadLessonId;
        uploadCategoryRef.current = selectedUploadCategory;
        setShowCategoryModal(false);
        setTimeout(() => fileInputRef.current?.click(), 50);
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []) as File[];
        const targetId = uploadTargetRef.current;
        const category = uploadCategoryRef.current;
        if (!files.length || !targetId) return;
        setUploadingLesson(targetId);
        try {
            await onUploadFiles(files, targetId, category);
            onShowToast(`Đã thêm ${files.length} file vào "${category}"!`, 'success');
            setExpandedLessons(prev => new Set([...prev, targetId]));
        } catch { onShowToast('Lỗi khi thêm file', 'error'); }
        finally {
            setUploadingLesson(null);
            uploadTargetRef.current = null;
            setPendingUploadLessonId(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleAddLesson = async () => {
        if (!newLessonName.trim() || !newLessonChapter) { onShowToast('Vui lòng nhập tên bài và chọn chương!', 'warning'); return; }
        await onAddLesson(newLessonName.trim(), newLessonChapter);
        onShowToast(`Đã thêm: ${newLessonName}`, 'success');
        setNewLessonName(''); setNewLessonChapter(''); setShowAddLesson(false);
    };

    const handleDeleteLesson = async (lessonId: string, name: string) => {
        if (!window.confirm(`Xóa bài giảng "${name}"?`)) return;
        await onDeleteLesson(lessonId);
        onShowToast(`Đã xóa: ${name}`, 'success');
    };

    const handleDeleteFile = async (fileId: string, lessonId: string, fileName: string) => {
        if (!window.confirm(`Xóa file "${fileName}"?`)) return;
        await onDeleteFile(fileId, lessonId);
        onShowToast('Đã xóa file', 'success');
    };

    const toggleChapter = (chId: string) => {
        setExpandedChapters(prev => {
            const s = new Set(prev);
            s.has(chId) ? s.delete(chId) : s.add(chId);
            return s;
        });
    };

    const toggleLesson = (lessonId: string) => {
        setExpandedLessons(prev => {
            const s = new Set(prev);
            s.has(lessonId) ? s.delete(lessonId) : s.add(lessonId);
            return s;
        });
    };

    const expandAll = () => {
        setExpandedChapters(new Set(gradeData?.chapters.map(c => c.id) || []));
    };
    const collapseAll = () => {
        setExpandedChapters(new Set());
        setExpandedLessons(new Set());
    };

    return (
        <div className="fixed inset-0 z-[60] flex flex-col font-sans overflow-hidden animate-fade-in" style={{ background: '#F7F6F3' }}>

            {/* ── Top Nav ── */}
            <div className="flex items-center justify-between px-5 py-3" style={{ background: '#FFFFFF', borderBottom: '1px solid #E9E9E7' }}>
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-1.5 rounded-lg transition-colors" style={{ color: '#787774' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F1F0EC'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                        <X className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg" style={{ background: '#EEF0FB' }}>
                            <MessageCircle className="w-4 h-4" style={{ color: '#6B7CDB' }} />
                        </div>
                        <div>
                            <h1 className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>Telegram Cloud Sync</h1>
                            <p className="text-[10px] uppercase tracking-widest" style={{ color: '#AEACA8' }}>Quản lý & Phân phối tài liệu</p>
                        </div>
                    </div>
                </div>

            </div>

            {/* ── Main ── */}
            <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4 custom-scrollbar">


                {/* Grade Tabs */}
                <div className="flex items-center gap-0.5 p-1 rounded-lg" style={{ background: '#EBEBEA', width: 'fit-content' }}>
                    {([12, 11, 10] as const).map(grade => {
                        const c = GRADE_COLORS[grade];
                        const gLessons = lessons.filter(l => CURRICULUM.find(g => g.level === grade)?.chapters.map(ch => ch.id).includes(l.chapterId));
                        const gFileCount = gLessons.reduce((s, l) => s + (storedFiles[l.id]?.length || 0), 0);
                        const isActive = selectedGrade === grade;
                        return (
                            <button key={grade} onClick={() => setSelectedGrade(grade)}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors"
                                style={{
                                    background: isActive ? '#FFFFFF' : 'transparent',
                                    color: isActive ? '#1A1A1A' : '#57564F',
                                    fontWeight: isActive ? 600 : 400,
                                    boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                                }}
                                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.04)'; }}
                                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                            >
                                {/* Dot màu đặc trưng của lớp */}
                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.accent, opacity: isActive ? 1 : 0.65 }} />
                                Lớp {grade}
                                {isActive && (
                                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: `${c.accent}18`, color: c.accent }}>
                                        {gLessons.length}b · {gFileCount}f
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Category Summary Bar */}
                <div className="rounded-xl px-4 py-3 flex items-center gap-3"
                    style={{ background: '#FFFFFF', border: '1px solid #E9E9E7' }}>
                    {/* Label */}
                    <div className="flex items-center gap-1.5 shrink-0 pr-3" style={{ borderRight: '1px solid #E9E9E7' }}>
                        <BarChart3 className="w-3.5 h-3.5 shrink-0" style={{ color: '#AEACA8' }} />
                        <span className="text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: '#AEACA8' }}>Phân loại</span>
                    </div>
                    {/* 3 category ô */}
                    {LESSON_CATEGORIES.map(cat => {
                        const cfg = CAT_CONFIG[cat];
                        const count = categorySummary.counts[cat] || 0;
                        return (
                            <div key={cat} className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg min-w-0"
                                style={{ background: cfg.bg, border: `1px solid ${cfg.color}30` }}>
                                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cfg.color }} />
                                <div className="min-w-0">
                                    <div className="text-[10px] font-semibold leading-tight truncate" style={{ color: cfg.color }}>{cfg.short}</div>
                                    <div className="text-sm font-bold leading-tight tabular-nums" style={{ color: '#1A1A1A' }}>{count}</div>
                                </div>
                            </div>
                        );
                    })}
                    {/* Ô chưa phân loại */}
                    <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg min-w-0"
                        style={{
                            background: categorySummary.uncategorized > 0 ? '#FDE68A' : '#F7F6F3',
                            border: categorySummary.uncategorized > 0 ? '1px solid #F59E0B40' : '1px solid transparent',
                            opacity: categorySummary.uncategorized > 0 ? 1 : 0.5,
                        }}>
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" style={{ color: categorySummary.uncategorized > 0 ? '#D97706' : '#CFCFCB' }} />
                        <div className="min-w-0">
                            <div className="text-[10px] font-semibold leading-tight truncate" style={{ color: categorySummary.uncategorized > 0 ? '#B45309' : '#AEACA8' }}>Chưa PL</div>
                            <div className="text-sm font-bold leading-tight tabular-nums" style={{ color: '#1A1A1A' }}>{categorySummary.uncategorized}</div>
                        </div>
                    </div>
                </div>

                {/* Sync Card */}
                <div className="rounded-xl overflow-hidden"
                    style={{ background: '#FFFFFF', border: `1px solid ${color.accent}33`, borderLeft: `3px solid ${color.accent}` }}>
                    <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl shrink-0" style={{ background: color.bg }}>
                                <CloudUpload className="w-5 h-5" style={{ color: color.accent }} />
                            </div>
                            <div>
                                <div className="font-semibold text-sm" style={{ color: '#1A1A1A' }}>Sync {color.label} lên Telegram</div>
                                <div className="text-xs mt-0.5 flex flex-wrap gap-x-3" style={{ color: '#787774' }}>
                                    <span>{gradeLessons.length} bài giảng</span>
                                    <span>{totalFiles} tài liệu</span>
                                    <span className="font-medium" style={{ color: '#1A1A1A' }}>~{(totalSize / 1024 / 1024).toFixed(1)}MB</span>
                                    {syncMsg[selectedGrade] && (
                                        <span className="font-medium" style={{ color: syncStatus[selectedGrade] === 'success' ? '#448361' : '#E03E3E' }}>
                                            {syncMsg[selectedGrade]}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <button onClick={() => handleSyncGrade(selectedGrade)} disabled={syncStatus[selectedGrade] === 'syncing'}
                            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-xl transition-all disabled:opacity-60 active:scale-[0.98] shrink-0"
                            style={{ background: syncStatus[selectedGrade] === 'success' ? '#448361' : color.accent }}>
                            {syncStatus[selectedGrade] === 'syncing'
                                ? <><Loader2 className="w-4 h-4 animate-spin" /> Đang Sync...</>
                                : syncStatus[selectedGrade] === 'success' ? <><CheckCircle2 className="w-4 h-4" /> Đã Sync!</>
                                    : syncStatus[selectedGrade] === 'error' ? <><AlertCircle className="w-4 h-4" /> Thử lại</>
                                        : <><Send className="w-4 h-4" /> Sync lên Telegram</>}
                        </button>
                    </div>

                    {/* Progress Bar — chỉ hiện khi đang sync */}
                    {syncStatus[selectedGrade] === 'syncing' && (
                        <div className="px-4 pb-4">
                            {/* Track */}
                            <div className="relative h-2 rounded-full overflow-hidden" style={{ background: '#F1F0EC' }}>
                                {/* Fill */}
                                <div
                                    className="absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out"
                                    style={{
                                        width: `${syncProgress || 2}%`,
                                        background: `linear-gradient(90deg, ${color.accent}BB, ${color.accent})`,
                                    }}
                                />
                                {/* Shimmer sweep — chạy liên tục qua phần fill */}
                                <div
                                    className="absolute inset-y-0 left-0 rounded-full overflow-hidden pointer-events-none"
                                    style={{ width: `${syncProgress || 2}%` }}
                                >
                                    <div
                                        style={{
                                            position: 'absolute',
                                            inset: 0,
                                            width: '40%',
                                            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)',
                                            animation: 'shimmer-sweep 1.6s ease-in-out infinite',
                                        }}
                                    />
                                </div>
                            </div>
                            {/* Labels */}
                            <div className="flex items-center justify-between mt-1.5">
                                <span className="text-[11px]" style={{ color: '#AEACA8' }}>
                                    Đang tải lên Telegram…
                                </span>
                                <span className="text-[11px] font-semibold tabular-nums" style={{ color: color.accent }}>
                                    {syncProgress > 0 ? `${Math.round(syncProgress)}%` : '···'}
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Lesson List */}
                <div className="rounded-xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E9E9E7' }}>
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid #E9E9E7' }}>
                        <div className="flex items-center gap-2">
                            <BookOpen className="w-4 h-4" style={{ color: color.accent }} />
                            <h3 className="font-semibold text-sm" style={{ color: '#1A1A1A' }}>Danh sách bài giảng — {color.label}</h3>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: color.bg, color: color.accent }}>{gradeLessons.length}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={expandAll} className="text-[11px] px-2 py-1 rounded transition-colors" style={{ color: '#787774' }}
                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F1F0EC'}
                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>Mở tất cả</button>
                            <button onClick={collapseAll} className="text-[11px] px-2 py-1 rounded transition-colors" style={{ color: '#787774' }}
                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F1F0EC'}
                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>Thu gọn</button>
                            <button onClick={() => setShowAddLesson(!showAddLesson)}
                                className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                                style={{ background: showAddLesson ? color.bg : '#F1F0EC', color: showAddLesson ? color.accent : '#57564F', border: '1px solid #E9E9E7' }}>
                                {showAddLesson ? <X className="w-3 h-3" /> : <Upload className="w-3 h-3" />}
                                {showAddLesson ? 'Đóng' : 'Thêm bài'}
                            </button>
                        </div>
                    </div>

                    {/* Add Lesson Form */}
                    {showAddLesson && (
                        <div className="px-5 py-3 grid grid-cols-1 md:grid-cols-3 gap-2 animate-fade-in" style={{ borderBottom: '1px solid #E9E9E7', background: '#FAFAF9' }}>
                            <select value={newLessonChapter} onChange={e => setNewLessonChapter(e.target.value)}
                                className="text-sm rounded-lg px-3 py-2 outline-none" style={{ background: '#FFFFFF', border: '1px solid #E9E9E7', color: '#1A1A1A' }}>
                                <option value="">-- Chọn chương --</option>
                                {gradeData?.chapters.map(ch => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
                            </select>
                            <input value={newLessonName} onChange={e => setNewLessonName(e.target.value)}
                                placeholder="Tên bài giảng..." onKeyDown={e => e.key === 'Enter' && handleAddLesson()}
                                className="text-sm rounded-lg px-3 py-2 outline-none" style={{ background: '#FFFFFF', border: '1px solid #E9E9E7', color: '#1A1A1A' }} />
                            <button onClick={handleAddLesson} className="text-sm font-semibold text-white rounded-lg px-4 py-2 transition-colors active:scale-[0.98]"
                                style={{ background: color.accent }}>＋ Tạo bài giảng</button>
                        </div>
                    )}

                    {/* Chapters */}
                    {gradeLessons.length === 0 && !gradeData?.chapters.some(ch => (storedFiles[ch.id]?.length ?? 0) > 0) ? (
                        <div className="py-12 text-center">
                            <BookOpen className="w-10 h-10 mx-auto mb-3" style={{ color: '#CFCFCB' }} />
                            <p className="text-sm font-medium" style={{ color: '#787774' }}>Chưa có tài liệu nào</p>
                        </div>
                    ) : (
                        <div>
                            {gradeData?.chapters.map(chapter => {
                                const chapterLessons = gradeLessons.filter(l => l.chapterId === chapter.id)
                                    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
                                const chapterDirectFiles = storedFiles[chapter.id] || [];
                                if (chapterLessons.length === 0 && chapterDirectFiles.length === 0) return null;
                                const isExpanded = expandedChapters.has(chapter.id);
                                const chFileCount = chapterLessons.reduce((s, l) => s + (storedFiles[l.id]?.length || 0), 0) + chapterDirectFiles.length;

                                // Category counts for chapter
                                const chCatCounts: Record<string, number> = {};
                                LESSON_CATEGORIES.forEach(cat => chCatCounts[cat] = 0);
                                let chUncategorized = 0;
                                chapterLessons.forEach(l => {
                                    (storedFiles[l.id] || []).forEach(f => {
                                        if (f.category && LESSON_CATEGORIES.includes(f.category)) chCatCounts[f.category]++;
                                        else chUncategorized++;
                                    });
                                });

                                return (
                                    <div key={chapter.id} style={{ borderBottom: '1px solid #F1F0EC' }}>
                                        {/* Chapter Header - Clickable */}
                                        <div className="flex items-center justify-between px-5 py-3 cursor-pointer group"
                                            style={{ background: isExpanded ? '#FAFAF9' : '#FFFFFF' }}
                                            onClick={() => toggleChapter(chapter.id)}>
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="p-1.5 rounded-lg shrink-0" style={{ background: color.bg }}>
                                                    <BookOpen className="w-3.5 h-3.5" style={{ color: color.accent }} />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="text-sm font-bold uppercase tracking-wide truncate" style={{ color: '#1A1A1A' }}>{chapter.name}</div>
                                                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                        <span className="text-[11px]" style={{ color: '#AEACA8' }}>{chapterLessons.length} bài · {chFileCount} file</span>
                                                        {LESSON_CATEGORIES.map(cat => {
                                                            const cfg = CAT_CONFIG[cat];
                                                            const cnt = chCatCounts[cat];
                                                            if (!cnt) return null;
                                                            return (
                                                                <span key={cat} className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                                                                    style={{ background: cfg.bg, color: cfg.color }}>
                                                                    {cfg.short}: {cnt}
                                                                </span>
                                                            );
                                                        })}
                                                        {chUncategorized > 0 && (
                                                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-600">
                                                                ⚠ Chưa PL: {chUncategorized}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-gray-400 shrink-0 ml-2">
                                                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                            </div>
                                        </div>

                                        {/* Lesson Rows */}
                                        {isExpanded && (
                                            <div style={{ borderTop: '1px solid #F1F0EC' }}>
                                                {/* ✅ BUG 2B FIX: Chapter-level files section */}
                                                {chapterDirectFiles.length > 0 && (
                                                    <div style={{ borderBottom: '1px solid #F1F0EC', background: '#FFFDF5' }}>
                                                        <div className="flex items-center gap-2 px-5 py-2" style={{ borderBottom: '1px solid #F8F7F5' }}>
                                                            <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: '#D97706' }}>
                                                                📁 File cấp Chương ({chapterDirectFiles.length})
                                                            </span>
                                                            <span className="text-[10px]" style={{ color: '#AEACA8' }}>— Hiển thị cho toàn bộ bài trong chương này</span>
                                                        </div>
                                                        {chapterDirectFiles.map(file => (
                                                            <div
                                                                key={file.id}
                                                                className="flex items-center gap-2 group/cf"
                                                                style={{ padding: '6px 20px 6px 52px', borderBottom: '1px solid #F8F7F5' }}
                                                            >
                                                                <FileText className="w-3 h-3 shrink-0" style={{ color: '#D97706' }} />
                                                                <span className="text-[12px] flex-1 truncate" style={{ color: '#57564F' }}>{file.name}</span>
                                                                <span className="text-[10px] shrink-0" style={{ color: '#AEACA8' }}>{(file.size / 1024 / 1024).toFixed(1)}MB</span>
                                                                <button
                                                                    onClick={() => handleDeleteFile(file.id, chapter.id, file.name)}
                                                                    className="opacity-0 group-hover/cf:opacity-100 p-1 rounded hover:text-red-500 transition-all"
                                                                    title="Xóa file"
                                                                >
                                                                    <Trash2 className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                {chapterLessons.map(lesson => {
                                                    const lessonFiles = storedFiles[lesson.id] || [];
                                                    const isLessonExpanded = expandedLessons.has(lesson.id);
                                                    const isUploading = uploadingLesson === lesson.id;

                                                    // Count by category
                                                    const lCatFiles: Record<string, StoredFile[]> = {};
                                                    let lUncategorized: StoredFile[] = [];
                                                    LESSON_CATEGORIES.forEach(cat => lCatFiles[cat] = []);
                                                    lessonFiles.forEach(f => {
                                                        if (f.category && LESSON_CATEGORIES.includes(f.category)) lCatFiles[f.category].push(f);
                                                        else lUncategorized.push(f);
                                                    });

                                                    return (
                                                        <div key={lesson.id} style={{ borderBottom: '1px solid #F8F7F5' }}>
                                                            {/* Lesson Row */}
                                                            <div className="flex items-center gap-3 px-5 py-2.5 group" style={{ paddingLeft: '52px' }}>
                                                                <button onClick={() => toggleLesson(lesson.id)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                                                                    <FileText className="w-3.5 h-3.5 shrink-0" style={{ color: '#AEACA8' }} />
                                                                    <span className="text-sm font-medium truncate" style={{ color: '#1A1A1A' }}>{lesson.name}</span>
                                                                </button>

                                                                {/* Category Badges */}
                                                                <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                                                                    {LESSON_CATEGORIES.map(cat => {
                                                                        const cfg = CAT_CONFIG[cat];
                                                                        const cnt = lCatFiles[cat].length;
                                                                        return (
                                                                            <span key={cat}
                                                                                className="text-[10px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap"
                                                                                style={{
                                                                                    background: cnt > 0 ? cfg.bg : '#F1F0EC',
                                                                                    color: cnt > 0 ? cfg.color : '#CFCFCB',
                                                                                }}>
                                                                                {cfg.short}: {cnt}
                                                                            </span>
                                                                        );
                                                                    })}
                                                                    {lUncategorized.length > 0 && (
                                                                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-500">
                                                                            ⚠{lUncategorized.length}
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                {/* Actions */}
                                                                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <button onClick={() => handleUploadTrigger(lesson.id)}
                                                                        className="p-1.5 rounded-lg hover:bg-[#EEF0FB] text-gray-400 hover:text-[#6B7CDB] transition-colors"
                                                                        title="Upload file">
                                                                        {isUploading ? <Loader2 className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5" />}
                                                                    </button>
                                                                    <button onClick={() => handleDeleteLesson(lesson.id, lesson.name)}
                                                                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                                                                        title="Xóa bài">
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                    <button onClick={() => toggleLesson(lesson.id)}
                                                                        className="p-1.5 rounded-lg transition-colors"
                                                                        style={{ color: '#AEACA8' }}>
                                                                        {isLessonExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                                                    </button>
                                                                </div>
                                                                {/* Show expand toggle always on mobile */}
                                                                <button onClick={() => toggleLesson(lesson.id)} className="p-1.5 rounded-lg md:hidden" style={{ color: '#AEACA8' }}>
                                                                    {isLessonExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                                                </button>
                                                            </div>

                                                            {/* Expanded: Files grouped by category */}
                                                            {isLessonExpanded && (
                                                                <div className="pb-3 space-y-2 animate-fade-in" style={{ paddingLeft: '52px', paddingRight: '16px' }}>
                                                                    {LESSON_CATEGORIES.map(cat => {
                                                                        const cfg = CAT_CONFIG[cat];
                                                                        const catFiles = lCatFiles[cat];
                                                                        return (
                                                                            <div key={cat}>
                                                                                <div className="flex items-center gap-1.5 mb-1">
                                                                                    <div className="w-2 h-2 rounded-full" style={{ background: cfg.color }} />
                                                                                    <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: cfg.color }}>{cfg.short}</span>
                                                                                    <span className="text-[10px]" style={{ color: '#AEACA8' }}>({catFiles.length})</span>
                                                                                </div>
                                                                                {catFiles.length === 0 ? (
                                                                                    <div className="text-[11px] italic px-3 py-1.5 rounded" style={{ color: '#CFCFCB', background: '#FAFAF9' }}>
                                                                                        Chưa có file — nhấn ↑ để upload
                                                                                    </div>
                                                                                ) : (
                                                                                    <div className="space-y-1">
                                                                                        {catFiles.map(file => (
                                                                                            <div key={file.id} className="flex items-center gap-2 text-[11px] px-2 py-1.5 rounded-lg group/f"
                                                                                                style={{ background: cfg.bg + '60', color: '#57564F' }}>
                                                                                                <FileText className="w-3 h-3 shrink-0" style={{ color: cfg.color }} />
                                                                                                <span className="flex-1 truncate">{file.name}</span>
                                                                                                <span className="text-[10px] shrink-0" style={{ color: '#AEACA8' }}>{(file.size / 1024 / 1024).toFixed(1)}MB</span>
                                                                                                <button onClick={() => handleDeleteFile(file.id, lesson.id, file.name)}
                                                                                                    className="opacity-0 group-hover/f:opacity-100 p-0.5 hover:text-red-500 transition-all">
                                                                                                    <Trash2 className="w-3 h-3" />
                                                                                                </button>
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                    {lUncategorized.length > 0 && (
                                                                        <div>
                                                                            <div className="flex items-center gap-1.5 mb-1">
                                                                                <AlertTriangle className="w-2.5 h-2.5 text-amber-500" />
                                                                                <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-600">Chưa phân loại ({lUncategorized.length})</span>
                                                                            </div>
                                                                            {lUncategorized.map(file => (
                                                                                <div key={file.id} className="flex items-center gap-2 text-[11px] px-2 py-1.5 rounded-lg group/f bg-amber-50" style={{ color: '#57564F' }}>
                                                                                    <FileText className="w-3 h-3 shrink-0 text-amber-400" />
                                                                                    <span className="flex-1 truncate">{file.name}</span>
                                                                                    <span className="text-[10px] shrink-0" style={{ color: '#AEACA8' }}>{(file.size / 1024 / 1024).toFixed(1)}MB</span>
                                                                                    <button onClick={() => handleDeleteFile(file.id, lesson.id, file.name)}
                                                                                        className="opacity-0 group-hover/f:opacity-100 p-0.5 hover:text-red-500 transition-all">
                                                                                        <Trash2 className="w-3 h-3" />
                                                                                    </button>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                    <button onClick={() => handleUploadTrigger(lesson.id)}
                                                                        className="flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-lg transition-colors mt-1"
                                                                        style={{ border: `1px dashed ${color.accent}66`, color: color.accent, background: color.bg + '40' }}
                                                                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = color.bg}
                                                                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = color.bg + '40'}>
                                                                        <Upload className="w-3 h-3" />
                                                                        Upload thêm file vào bài này
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Category Picker Modal ── */}
            {showCategoryModal && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4"
                    style={{ background: 'rgba(26,26,26,0.5)' }}
                    onClick={() => setShowCategoryModal(false)}>
                    <div className="w-full max-w-sm rounded-2xl overflow-hidden animate-fade-in"
                        style={{ background: '#FFFFFF', border: '1px solid #E9E9E7', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}
                        onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #E9E9E7' }}>
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg" style={{ background: color.bg }}>
                                    <Tag className="w-4 h-4" style={{ color: color.accent }} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>Chọn loại tài liệu</h3>
                                    <p className="text-[10px]" style={{ color: '#AEACA8' }}>File sẽ hiển thị trong tab tương ứng</p>
                                </div>
                            </div>
                            <button onClick={() => setShowCategoryModal(false)} className="p-1.5 rounded-lg transition-colors"
                                style={{ color: '#787774' }}
                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F1F0EC'}
                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-4 space-y-2">
                            {LESSON_CATEGORIES.map(cat => {
                                const cfg = CAT_CONFIG[cat];
                                const isSelected = selectedUploadCategory === cat;
                                return (
                                    <button key={cat} onClick={() => setSelectedUploadCategory(cat)}
                                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-left transition-all"
                                        style={{ background: isSelected ? cfg.bg : '#F7F6F3', border: `1.5px solid ${isSelected ? cfg.color : 'transparent'}`, color: isSelected ? cfg.color : '#57564F', fontWeight: isSelected ? 600 : 400 }}>
                                        <div className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center"
                                            style={{ border: `2px solid ${isSelected ? cfg.color : '#CFCFCB'}`, background: isSelected ? cfg.color : 'transparent' }}>
                                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                        </div>
                                        {cat}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="px-4 pb-4">
                            <button onClick={handleCategoryConfirm}
                                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all active:scale-[0.98]"
                                style={{ background: color.accent }}>
                                Chọn file →
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Hidden file input */}
            <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.pptx,.docx,.jpg,.png" multiple onChange={handleFileChange} />
        </div>
    );
};

export default AdminGitHubSync;

```

>>>>> FILE: App.tsx
```tsx
import React, { useEffect, useMemo, useCallback, Suspense } from 'react';
import { Routes, Route, useNavigate, useParams, Navigate, useLocation } from 'react-router-dom';
import { GradeLevel, Lesson, Exam } from './types';
import { CURRICULUM } from './constants';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Toast from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';
import { useCloudStorage } from './src/hooks/useCloudStorage';
import { getActivatedPhone } from './src/utils/phone';
import { FileText, ChevronRight, FolderOpen, RefreshCw, Atom, Home, Bell, FlaskConical, Settings } from 'lucide-react';
import KickedScreen from './components/auth/KickedScreen';
import { useUIStore } from './src/stores/useUIStore';
import { useDataStore } from './src/stores/useDataStore';
import { useExamStore, useBlogStore } from './src/stores/useContentStore';
import { useShallow } from 'zustand/react/shallow';

const ChapterView = React.lazy(() => import('./components/ChapterView'));
const LessonView = React.lazy(() => import('./components/LessonView'));
const SettingsModal = React.lazy(() => import('./components/SettingsModal'));
const Chatbot = React.lazy(() => import('./components/Chatbot'));
const AdminDashboard = React.lazy(() => import('./components/AdminDashboard'));
const AdminGitHubSync = React.lazy(() => import('./components/AdminGitHubSync'));
const ExamListPage = React.lazy(() => import('./components/ExamListPage'));
const ExamView = React.lazy(() => import('./components/ExamView'));
const ExamResult = React.lazy(() => import('./components/ExamResult'));
const ContactBook = React.lazy(() => import('./components/ContactBook'));
const StudyPlanner = React.lazy(() => import('./components/StudyPlanner'));
const NotificationPage = React.lazy(() => import('./components/NotificationPage'));
const SimulationLab = React.lazy(() => import('./components/SimulationLab'));
const BlogList = React.lazy(() => import('./components/BlogList'));
const BlogDetail = React.lazy(() => import('./components/BlogDetail'));
const AdminBlogEditor = React.lazy(() => import('./components/AdminBlogEditor'));

const LazyFallback = () => (
  <div className="flex items-center justify-center h-[40vh]">
    <RefreshCw className="w-8 h-8 animate-spin" style={{ color: '#6B7CDB' }} />
  </div>
);

// ──────────────────────────────────────────────────────────────────
// AppDataSync: bridges useCloudStorage data → Zustand stores
// ──────────────────────────────────────────────────────────────────
function AppDataSync({ cloud }: { cloud: ReturnType<typeof useCloudStorage> }) {
  const setLessons = useDataStore(state => state.setLessons);
  const setStoredFiles = useDataStore(state => state.setStoredFiles);
  const setLoading = useDataStore(state => state.setLoading);
  const setIsActivated = useDataStore(state => state.setIsActivated);
  const setStudentGradeValue = useDataStore(state => state.setStudentGradeValue);
  const isAdmin = useUIStore(state => state.isAdmin);
  const setKicked = useUIStore(state => state.setKicked);
  const setNotificationUnreadCount = useUIStore(state => state.setNotificationUnreadCount);
  const { getFetchedNotificationIds, getNotifications, verifyAccess } = cloud;

  useEffect(() => { setLessons(cloud.lessons); }, [cloud.lessons, setLessons]);
  useEffect(() => { setStoredFiles(cloud.storedFiles); }, [cloud.storedFiles, setStoredFiles]);
  useEffect(() => { setLoading(cloud.loading); }, [cloud.loading, setLoading]);
  useEffect(() => {
    setIsActivated(cloud.isActivated);
    if (cloud.isActivated) {
      const g = parseInt(localStorage.getItem('physivault_grade') || '0', 10);
      setStudentGradeValue(g === 10 || g === 11 || g === 12 ? g : null);
    }
  }, [cloud.isActivated, setIsActivated, setStudentGradeValue]);

  useEffect(() => {
    const check = async () => {
      if (cloud.isActivated && !document.hidden) {
        const status = await verifyAccess();
        if (status === 'kicked') setKicked(true);
      }
    };
    check();
    const iv = setInterval(check, 5 * 60 * 1000);
    document.addEventListener('visibilitychange', check);
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', check); };
  }, [cloud.isActivated, verifyAccess, setKicked]);

  useEffect(() => {
    if (!cloud.isActivated) return;
    const loadUnread = async () => {
      if (document.hidden) return;
      try {
        if (isAdmin) {
          const [n10, n11, n12, fetched] = await Promise.all([getNotifications(10), getNotifications(11), getNotifications(12), getFetchedNotificationIds()]);
          setNotificationUnreadCount([...n10, ...n11, ...n12].filter(n => n.fetch_enabled && !fetched.has(n.id)).length);
        } else {
          let grade = parseInt(localStorage.getItem('physivault_grade') || '0', 10);
          // ✅ BUG 3C FIX: fallback lấy grade từ Supabase nếu localStorage bị xóa
          if (grade < 10 || grade > 12) {
            const phone = localStorage.getItem('pv_activated_sdt');
            if (!phone) return;
            try {
              const { supabase: sb } = await import('./src/lib/supabase');
              const { data } = await sb.from('students').select('grade').eq('phone', phone).maybeSingle();
              if (data?.grade) {
                grade = data.grade;
                localStorage.setItem('physivault_grade', String(grade)); // re-cache
              } else return;
            } catch { return; }
          }
          const [notifs, fetched] = await Promise.all([getNotifications(grade), getFetchedNotificationIds()]);
          setNotificationUnreadCount(notifs.filter(n => n.fetch_enabled && !fetched.has(n.id)).length);
        }
      } catch { /* silent */ }
    };
    loadUnread();
    const iv = setInterval(loadUnread, 2 * 60 * 1000);
    document.addEventListener('visibilitychange', loadUnread);
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', loadUnread); };
  }, [cloud.isActivated, isAdmin, getNotifications, getFetchedNotificationIds, setNotificationUnreadCount]);

  return null;
}

// ──────────────────────────────────────────────────────────────────
// Route pages
// ──────────────────────────────────────────────────────────────────
function GradeOverviewPage({ cloud }: { cloud: ReturnType<typeof useCloudStorage> }) {
  const { level } = useParams<{ level: string }>();
  const navigate = useNavigate();
  const lessons = useDataStore(state => state.lessons);
  const storedFiles = useDataStore(state => state.storedFiles);
  const grade = Number(level) as GradeLevel;
  const gradeData = useMemo(() => CURRICULUM.find(g => g.level === grade), [grade]);
  if (!gradeData) return <Navigate to="/" replace />;
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-1.5 text-sm" style={{ color: '#787774' }}>
        <span onClick={() => navigate('/')} className="cursor-pointer hover:text-[#6B7CDB] transition-colors">Tổng quan</span>
        <ChevronRight className="w-3.5 h-3.5" style={{ color: '#CFCFCB' }} />
        <span className="font-medium" style={{ color: '#1A1A1A' }}>{gradeData.title}</span>
      </div>
      <div>
        <h1 className="text-2xl font-semibold mb-1" style={{ color: '#1A1A1A' }}>{gradeData.title}</h1>
        <p className="text-sm" style={{ color: '#787774' }}>Quản lý và theo dõi tiến độ học tập</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {gradeData.chapters.map((chapter) => {
          const cl = lessons.filter(l => l.chapterId === chapter.id);
          const fc = cl.reduce((s, l) => s + (storedFiles[l.id]?.length || 0), 0);
          return (
            <div key={chapter.id} onClick={() => navigate(`/grade/${grade}/chapter/${chapter.id}`)} className="rounded-xl p-5 cursor-pointer group pv-chapter-card">
              <div className="flex items-start justify-between mb-3">
                <div className="p-2.5 rounded-lg" style={{ background: '#EEF0FB' }}><FolderOpen className="w-5 h-5" style={{ color: '#6B7CDB' }} /></div>
                <div className="text-right"><div className="text-[10px] uppercase tracking-wider" style={{ color: '#AEACA8' }}>Bài học</div><div className="text-lg font-semibold" style={{ color: '#1A1A1A' }}>{cl.length}</div></div>
              </div>
              <h3 className="font-semibold text-sm mb-1 line-clamp-1" style={{ color: '#1A1A1A' }}>{chapter.name}</h3>
              <p className="text-xs leading-relaxed mb-4 line-clamp-2" style={{ color: '#787774', minHeight: '2.5rem' }}>{chapter.description}</p>
              <div className="flex items-center justify-between pt-3 text-xs" style={{ borderTop: '1px solid #F1F0EC' }}>
                <div className="flex items-center gap-1" style={{ color: '#AEACA8' }}><FileText className="w-3.5 h-3.5" /><span>{fc} tài liệu</span></div>
                <ChevronRight className="w-4 h-4" style={{ color: '#CFCFCB' }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChapterPage({ cloud }: { cloud: ReturnType<typeof useCloudStorage> }) {
  const { level, chapterId } = useParams<{ level: string; chapterId: string }>();
  const navigate = useNavigate();
  const lessons = useDataStore(state => state.lessons);
  const storedFiles = useDataStore(state => state.storedFiles);
  const isAdmin = useUIStore(state => state.isAdmin);
  const previewMode = useUIStore(state => state.previewMode);
  const showToast = useUIStore(state => state.showToast);
  const effectiveIsAdmin = isAdmin && !previewMode;
  const grade = Number(level) as GradeLevel;
  const gradeData = useMemo(() => CURRICULUM.find(g => g.level === grade), [grade]);
  const chapter = gradeData?.chapters.find(c => c.id === chapterId);
  const chapterLessons = useMemo(() => lessons.filter(l => l.chapterId === chapterId), [lessons, chapterId]);
  const chapterFiles = storedFiles[chapterId!] || [];
  if (!chapter || !chapterId) return <Navigate to={`/grade/${level}`} replace />;
  const handleCreateLesson = async (name: string) => { try { await cloud.addLesson(name, chapterId); showToast(`Đã tạo bài học: ${name}`, 'success'); } catch { showToast('Lỗi khi tạo bài học', 'error'); } };
  const handleDeleteLesson = async (lessonId: string) => { const l = lessons.find(x => x.id === lessonId); if (!l) return; if (window.confirm(`Xóa bài học "${l.name}" và tất cả tài liệu?`)) { try { await cloud.deleteLesson(lessonId); showToast(`Đã xóa: ${l.name}`, 'success'); } catch { showToast('Lỗi xóa bài học', 'error'); } } };
  const handleChapterUpload = async (files: File[], category: string) => { try { showToast('Đang tải lên...', 'warning'); await cloud.uploadFiles(files, chapterId, category); showToast(`Đã tải lên ${files.length} tài liệu`, 'success'); } catch { showToast('Lỗi tải lên', 'error'); } };
  const handleDeleteChapterFile = async (fileId: string) => { const f = chapterFiles.find(x => x.id === fileId); if (window.confirm(`Xóa tài liệu "${f?.name || 'này'}"?`)) { try { await cloud.deleteFile(fileId, chapterId); showToast('Đã xóa', 'success'); } catch { showToast('Lỗi xóa file', 'error'); } } };
  return (
    <ErrorBoundary><Suspense fallback={<LazyFallback />}>
      <ChapterView chapter={chapter} lessons={chapterLessons} chapterFiles={chapterFiles} isAdmin={effectiveIsAdmin} autoCreate={false} onBack={() => navigate(`/grade/${level}`)} onCreateLesson={handleCreateLesson} onSelectLesson={(lesson: Lesson) => navigate(`/grade/${level}/chapter/${chapterId}/lesson/${lesson.id}`)} onDeleteLesson={handleDeleteLesson} onUploadChapterFile={handleChapterUpload} onDeleteChapterFile={handleDeleteChapterFile} />
    </Suspense></ErrorBoundary>
  );
}

function LessonPage({ cloud }: { cloud: ReturnType<typeof useCloudStorage> }) {
  const { level, chapterId, lessonId } = useParams<{ level: string; chapterId: string; lessonId: string }>();
  const navigate = useNavigate();
  const lessons = useDataStore(state => state.lessons);
  const storedFiles = useDataStore(state => state.storedFiles);
  const isAdmin = useUIStore(state => state.isAdmin);
  const previewMode = useUIStore(state => state.previewMode);
  const showToast = useUIStore(state => state.showToast);
  const effectiveIsAdmin = isAdmin && !previewMode;
  const lesson = lessons.find(l => l.id === lessonId);
  const lessonFiles = storedFiles[lessonId!] || [];
  if (!lesson) return <Navigate to={`/grade/${level}/chapter/${chapterId}`} replace />;
  const handleUpload = async (files: File[], category?: string) => { try { showToast('Đang tải lên...', 'warning'); await cloud.uploadFiles(files, lesson.id, category); showToast(`Đã tải lên ${files.length} tài liệu`, 'success'); } catch { showToast('Lỗi tải lên', 'error'); } };
  const handleDelete = async (fileId: string) => { const f = lessonFiles.find(x => x.id === fileId); if (window.confirm(`Xóa tài liệu "${f?.name || 'này'}"?`)) { try { await cloud.deleteFile(fileId, lesson.id); showToast('Đã xóa', 'success'); } catch { showToast('Lỗi xóa file', 'error'); } } };
  return (
    <ErrorBoundary><Suspense fallback={<LazyFallback />}>
      <LessonView lesson={lesson} files={lessonFiles} isAdmin={effectiveIsAdmin} onBack={() => navigate(`/grade/${level}/chapter/${chapterId}`)} onUpload={handleUpload} onDelete={handleDelete} />
    </Suspense></ErrorBoundary>
  );
}

function ExamRoutes({ cloud }: { cloud: ReturnType<typeof useCloudStorage> }) {
  const navigate = useNavigate();
  const isAdmin = useUIStore(state => state.isAdmin);
  const previewMode = useUIStore(state => state.previewMode);
  const { activeExam, examSubmission, setActiveExam, setExamSubmission, clearExam } = useExamStore(useShallow(state => ({
    activeExam: state.activeExam,
    examSubmission: state.examSubmission,
    setActiveExam: state.setActiveExam,
    setExamSubmission: state.setExamSubmission,
    clearExam: state.clearExam,
  })));
  if (activeExam && examSubmission) {
    return (
      <ErrorBoundary><Suspense fallback={<LazyFallback />}>
        <ExamResult exam={activeExam} submission={examSubmission} onRetry={() => setExamSubmission(null)} onBack={() => { clearExam(); navigate('/exams'); }} onSubmitVote={(part, qNum) => cloud.submitQuestionVote(activeExam.id, part, qNum)} onShowToast={useUIStore.getState().showToast} />
      </Suspense></ErrorBoundary>
    );
  }
  if (activeExam) {
    return (
      <ErrorBoundary><Suspense fallback={<LazyFallback />}>
        <ExamView exam={activeExam} isPreviewMode={!!previewMode} onShowToast={useUIStore.getState().showToast} onBack={() => { clearExam(); navigate('/exams'); }} onSubmit={async (sub) => { setExamSubmission(sub); const { calcScore } = await import('./components/ExamView'); const score = calcScore(sub, activeExam.answers); const totalQ = (activeExam.answers.mc?.length ?? 0) + (activeExam.answers.tf?.length ?? 0) * 4 + (activeExam.answers.sa?.length ?? 0); cloud.saveExamResult(activeExam, score.total, totalQ, score.correctCount); }} />
      </Suspense></ErrorBoundary>
    );
  }
  return (
    <ErrorBoundary><Suspense fallback={<LazyFallback />}>
      <ExamListPage isAdmin={isAdmin} previewMode={previewMode} onLoadExams={cloud.loadExams} onLoadHistory={(isAdmin && !previewMode) ? cloud.getExamHistory : () => { const phone = getActivatedPhone(); if (!phone) return Promise.resolve([]); return cloud.getExamHistory(phone); }} onSelectExam={(exam: Exam) => { setActiveExam(exam); setExamSubmission(null); }} />
    </Suspense></ErrorBoundary>
  );
}

function BlogRoutes({ cloud }: { cloud: ReturnType<typeof useCloudStorage> }) {
  const navigate = useNavigate();
  const isAdmin = useUIStore(state => state.isAdmin);
  const previewMode = useUIStore(state => state.previewMode);
  const effectiveIsAdmin = isAdmin && !previewMode;
  const { activeBlog, activeAdminBlog, isCreatingBlog, allBlogs, setActiveBlog, setActiveAdminBlog, setIsCreatingBlog, setAllBlogs } = useBlogStore(useShallow(state => ({
    activeBlog: state.activeBlog,
    activeAdminBlog: state.activeAdminBlog,
    isCreatingBlog: state.isCreatingBlog,
    allBlogs: state.allBlogs,
    setActiveBlog: state.setActiveBlog,
    setActiveAdminBlog: state.setActiveAdminBlog,
    setIsCreatingBlog: state.setIsCreatingBlog,
    setAllBlogs: state.setAllBlogs,
  })));
  if ((activeAdminBlog || isCreatingBlog) && effectiveIsAdmin) {
    const back = () => { setActiveAdminBlog(null); setIsCreatingBlog(false); navigate('/blog', { replace: true }); };
    return (
      <ErrorBoundary><Suspense fallback={<LazyFallback />}>
        <AdminBlogEditor blog={activeAdminBlog} saveBlog={cloud.saveBlog} deleteBlog={cloud.deleteBlog} syncBlogs={cloud.syncBlogs} onBack={back} onSaved={() => { setActiveAdminBlog(null); setIsCreatingBlog(false); navigate('/blog', { replace: true }); }} />
      </Suspense></ErrorBoundary>
    );
  }
  if (activeBlog) {
    const related = allBlogs.filter(b => b.id !== activeBlog.id && b.is_published).filter(b => b.category === activeBlog.category || (b.tags || []).some(t => (activeBlog.tags || []).includes(t))).slice(0, 4);
    return (
      <ErrorBoundary><Suspense fallback={<LazyFallback />}>
        <BlogDetail blog={activeBlog} onBack={() => setActiveBlog(null)} relatedBlogs={related} onReadRelated={setActiveBlog} />
      </Suspense></ErrorBoundary>
    );
  }
  return (
    <ErrorBoundary><Suspense fallback={<LazyFallback />}>
      <BlogList isAdmin={effectiveIsAdmin} onReadBlog={setActiveBlog} onEditBlog={effectiveIsAdmin ? setActiveAdminBlog : undefined} onCreateBlog={effectiveIsAdmin ? () => setIsCreatingBlog(true) : undefined} onBlogsLoaded={setAllBlogs} getBlogs={cloud.getBlogs} />
    </Suspense></ErrorBoundary>
  );
}

// ──────────────────────────────────────────────────────────────────
// AppShell: layout (sidebar + mobile nav + modals)
// ──────────────────────────────────────────────────────────────────
function AppShell({ cloud }: { cloud: ReturnType<typeof useCloudStorage> }) {
  const navigate = useNavigate();
  const { pathname: path } = useLocation(); // ✅ reactive với React Router
  const {
    isSettingsOpen, setSettingsOpen, isMobileMenuOpen, setMobileMenuOpen,
    showAdminDashboard, setShowAdminDashboard, showGitHubSync, setShowGitHubSync,
    toasts, removeToast, isAdmin, previewMode, setPreviewMode,
    isKicked, notificationUnreadCount, toggleAdmin, isSimulationFullscreen,
  } = useUIStore(useShallow(state => ({
    isSettingsOpen: state.isSettingsOpen,
    setSettingsOpen: state.setSettingsOpen,
    isMobileMenuOpen: state.isMobileMenuOpen,
    setMobileMenuOpen: state.setMobileMenuOpen,
    showAdminDashboard: state.showAdminDashboard,
    setShowAdminDashboard: state.setShowAdminDashboard,
    showGitHubSync: state.showGitHubSync,
    setShowGitHubSync: state.setShowGitHubSync,
    toasts: state.toasts,
    removeToast: state.removeToast,
    isAdmin: state.isAdmin,
    previewMode: state.previewMode,
    setPreviewMode: state.setPreviewMode,
    isKicked: state.isKicked,
    notificationUnreadCount: state.notificationUnreadCount,
    toggleAdmin: state.toggleAdmin,
    isSimulationFullscreen: state.isSimulationFullscreen,
  })));
  const { lessons, storedFiles, loading, isActivated, studentGradeValue } = useDataStore(useShallow(state => ({
    lessons: state.lessons,
    storedFiles: state.storedFiles,
    loading: state.loading,
    isActivated: state.isActivated,
    studentGradeValue: state.studentGradeValue,
  })));
  const effectiveIsAdmin = isAdmin && !previewMode;

  const fileCounts = useMemo(() => {
    const counts = { [GradeLevel.Grade10]: 0, [GradeLevel.Grade11]: 0, [GradeLevel.Grade12]: 0 };
    CURRICULUM.forEach(grade => {
      let c = 0;
      grade.chapters.forEach(ch => { lessons.filter(l => l.chapterId === ch.id).forEach(l => { c += storedFiles[l.id]?.length || 0; }); });
      counts[grade.level] = c;
    });
    return counts;
  }, [storedFiles, lessons]);

  const handlePreviewMode = useCallback((mode: GradeLevel | null) => {
    setPreviewMode(mode);
    navigate(mode ? `/grade/${mode}` : '/');
  }, [setPreviewMode, navigate]);

  const urlGradeMatch = path.match(/\/grade\/(\d+)/);
  const currentGradeFromUrl = urlGradeMatch ? (Number(urlGradeMatch[1]) as GradeLevel) : null;
  const isOnHome = path === '/';
  const isOnGrade = path.startsWith('/grade/');
  const isOnExams = path.startsWith('/exams');
  const isOnNotification = path === '/notifications';
  const isOnSimLab = path === '/lab';

  if (isKicked && !isAdmin) return <KickedScreen />;

  const sidebarCommonProps = {
    currentGrade: currentGradeFromUrl,
    onSelectGrade: (g: GradeLevel | null) => navigate(g ? `/grade/${g}` : '/'),
    onOpenSettings: () => setSettingsOpen(true),
    onOpenExamList: (isActivated || isAdmin) ? () => navigate('/exams') : undefined,
    onOpenContactBook: (isActivated || isAdmin) ? () => navigate('/contact-book') : undefined,
    onOpenStudyPlanner: (isActivated || isAdmin) ? () => navigate('/planner') : undefined,
    onOpenNotification: (isActivated || isAdmin) ? () => navigate('/notifications') : undefined,
    onOpenSimLab: (isActivated || isAdmin) ? () => navigate('/lab') : undefined,
    onOpenBlog: (isActivated || isAdmin) ? () => navigate('/blog') : undefined,
    showExamList: isOnExams,
    showContactBook: path === '/contact-book',
    showStudyPlanner: path === '/planner',
    showNotification: isOnNotification,
    notificationUnreadCount,
    showSimLab: isOnSimLab,
    showBlog: path.startsWith('/blog'),
    isAdmin,
    previewMode,
    onSetPreviewMode: handlePreviewMode,
    studentGrade: studentGradeValue,
  };

  return (
    <div className="min-h-screen font-sans" style={{ background: '#F7F6F3', color: '#1A1A1A' }}>
      {isMobileMenuOpen && <div className="fixed inset-0 z-40 md:hidden" style={{ background: 'rgba(26,26,26,0.4)' }} onClick={() => setMobileMenuOpen(false)} />}

      {/* Mobile Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 shadow-xl transform transition-transform duration-300 ease-out md:hidden ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`} style={{ background: '#F1F0EC', borderRight: '1px solid #E9E9E7' }}>
        <Sidebar {...sidebarCommonProps} onSelectGrade={(g) => { navigate(g ? `/grade/${g}` : '/'); setMobileMenuOpen(false); }} onOpenSettings={() => { setSettingsOpen(true); setMobileMenuOpen(false); }} onOpenExamList={(isActivated || isAdmin) ? () => { navigate('/exams'); setMobileMenuOpen(false); } : undefined} onOpenContactBook={(isActivated || isAdmin) ? () => { navigate('/contact-book'); setMobileMenuOpen(false); } : undefined} onOpenStudyPlanner={(isActivated || isAdmin) ? () => { navigate('/planner'); setMobileMenuOpen(false); } : undefined} onOpenNotification={(isActivated || isAdmin) ? () => { navigate('/notifications'); setMobileMenuOpen(false); } : undefined} onOpenSimLab={(isActivated || isAdmin) ? () => { navigate('/lab'); setMobileMenuOpen(false); } : undefined} onOpenBlog={(isActivated || isAdmin) ? () => { navigate('/blog'); setMobileMenuOpen(false); } : undefined} className="w-full" />
      </div>

      {/* Desktop Sidebar */}
      {!isSimulationFullscreen && <Sidebar {...sidebarCommonProps} className="hidden md:flex" />}

      {/* Settings Modal */}
      <ErrorBoundary>
        <Suspense fallback={null}>
          <SettingsModal isOpen={isSettingsOpen} onClose={() => setSettingsOpen(false)} onShowToast={useUIStore.getState().showToast} isAdmin={isAdmin} isActivated={isActivated} lessons={lessons} storedFiles={storedFiles} onActivateSystem={cloud.activateSystem} onFetchLessons={cloud.fetchLessonsFromCloud} onToggleAdmin={toggleAdmin} onOpenDashboard={() => { setShowAdminDashboard(true); setSettingsOpen(false); }} onLoadExams={cloud.loadExams} />
        </Suspense>
      </ErrorBoundary>

      {showAdminDashboard && (
        <ErrorBoundary>
          <Suspense fallback={<LazyFallback />}>
            <AdminDashboard onBack={() => setShowAdminDashboard(false)} onShowToast={useUIStore.getState().showToast} onOpenGitHubSync={() => { setShowAdminDashboard(false); setShowGitHubSync(true); }} onUploadExamPdf={cloud.uploadExamPdf} onSaveExam={cloud.saveExam} onDeleteExam={cloud.deleteExam} onLoadExams={cloud.loadExams} />
          </Suspense>
        </ErrorBoundary>
      )}

      {showGitHubSync && (
        <ErrorBoundary>
          <Suspense fallback={<LazyFallback />}>
            <AdminGitHubSync onBack={() => setShowGitHubSync(false)} onShowToast={useUIStore.getState().showToast} lessons={lessons} storedFiles={storedFiles} onAddLesson={cloud.addLesson} onDeleteLesson={cloud.deleteLesson} onUploadFiles={cloud.uploadFiles} onDeleteFile={cloud.deleteFile} onSyncToGitHub={cloud.syncToCloud} syncProgress={cloud.syncProgress} />
          </Suspense>
        </ErrorBoundary>
      )}

      {/* Main Content */}
      <div className={`flex-1 flex flex-col min-h-screen transition-all duration-300 relative ${isSimulationFullscreen ? '' : 'md:ml-64'}`}>
        <header className="p-3.5 flex items-center justify-center md:hidden sticky top-0 z-30" style={{ background: '#F1F0EC', borderBottom: '1px solid #E9E9E7' }}>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: '#6B7CDB' }}><Atom className="w-3.5 h-3.5 text-white" /></div>
            <span className="font-semibold text-sm" style={{ color: '#1A1A1A' }}>PhysiVault</span>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8 lg:p-10 pb-24 md:pb-10 max-w-7xl mx-auto w-full">
          <Routes>
            <Route path="/" element={
              loading
                ? <div className="flex items-center justify-center h-[50vh]"><RefreshCw className="w-10 h-10 animate-spin" style={{ color: '#6B7CDB' }} /><span className="ml-3 text-lg font-medium" style={{ color: '#6B7CDB' }}>từ từ nó đang load...</span></div>
                : <Dashboard onSelectGrade={(g) => navigate(g ? `/grade/${g}` : '/')} fileCounts={fileCounts} isAdmin={effectiveIsAdmin} onLoadLeaderboard={cloud.getLeaderboard} previewMode={previewMode} studentGrade={studentGradeValue} />
            } />
            <Route path="/grade/:level" element={<GradeOverviewPage cloud={cloud} />} />
            <Route path="/grade/:level/chapter/:chapterId" element={<ChapterPage cloud={cloud} />} />
            <Route path="/grade/:level/chapter/:chapterId/lesson/:lessonId" element={<LessonPage cloud={cloud} />} />
            <Route path="/exams" element={<ExamRoutes cloud={cloud} />} />
            <Route path="/contact-book" element={<ErrorBoundary><Suspense fallback={<LazyFallback />}><ContactBook isAdmin={effectiveIsAdmin} onLoadHistory={cloud.getExamHistory} /></Suspense></ErrorBoundary>} />
            <Route path="/planner" element={<ErrorBoundary><Suspense fallback={<LazyFallback />}><StudyPlanner isAdmin={effectiveIsAdmin} studentGrade={studentGradeValue} onLoadPlans={cloud.getStudyPlans} onSavePlan={cloud.saveStudyPlan} onUpdatePlan={cloud.updateStudyPlan} onDeletePlan={cloud.deleteStudyPlan} onLoadSchedules={cloud.getSchedules} onSaveSchedule={cloud.saveSchedule} onUpdateSchedule={cloud.updateSchedule} onDeleteSchedule={cloud.deleteSchedule} /></Suspense></ErrorBoundary>} />
            <Route path="/notifications" element={<ErrorBoundary><Suspense fallback={<LazyFallback />}><NotificationPage onGetNotifications={cloud.getNotifications} onGetFetchedIds={cloud.getFetchedNotificationIds} onMarkFetched={cloud.markNotificationFetched} onFetchLessons={cloud.fetchLessonsFromCloud} onShowToast={useUIStore.getState().showToast} isAdmin={effectiveIsAdmin} onDeleteNotification={cloud.deleteNotification} onCreateNotification={cloud.createCustomNotification} /></Suspense></ErrorBoundary>} />
            <Route path="/lab" element={<ErrorBoundary><Suspense fallback={<LazyFallback />}><SimulationLab onBack={() => navigate('/')} /></Suspense></ErrorBoundary>} />
            <Route path="/blog/*" element={<BlogRoutes cloud={cloud} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>

      {/* Toasts */}
      <div className="fixed bottom-20 md:bottom-0 right-0 p-4 space-y-2 z-50">
        {toasts.map(t => <Toast key={t.id} message={t.message} type={t.type} onClose={() => removeToast(t.id)} />)}
      </div>

      {/* Mobile Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden flex items-stretch" style={{ background: '#FFFFFF', borderTop: '1px solid #E9E9E7', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <button onClick={() => navigate('/')} className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors" style={{ color: isOnHome ? '#6B7CDB' : '#AEACA8' }}>
          <Home className="w-5 h-5" /><span className="text-[10px] font-medium">Tổng quan</span>
        </button>
        {(isActivated || isAdmin) && (
          <button onClick={() => setMobileMenuOpen(true)} className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors" style={{ color: isOnGrade ? '#6B7CDB' : '#AEACA8' }}>
            <FolderOpen className="w-5 h-5" /><span className="text-[10px] font-medium">{currentGradeFromUrl ? `Lớp ${currentGradeFromUrl}` : 'Khối lớp'}</span>
          </button>
        )}
        {(isActivated || isAdmin) && (
          <button onClick={() => navigate('/exams')} className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors" style={{ color: isOnExams ? '#6B7CDB' : '#AEACA8' }}>
            <FileText className="w-5 h-5" /><span className="text-[10px] font-medium">Thi thử</span>
          </button>
        )}
        {(isActivated || isAdmin) && (
          <button onClick={() => navigate('/notifications')} className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors relative" style={{ color: isOnNotification ? '#E03E3E' : '#AEACA8' }}>
            <div className="relative"><Bell className="w-5 h-5" />{notificationUnreadCount > 0 && <span className="absolute -top-1 -right-1.5 min-w-[14px] h-[14px] rounded-full flex items-center justify-center text-[8px] font-black" style={{ background: '#E03E3E', color: '#fff', lineHeight: 1 }}>{notificationUnreadCount > 9 ? '9+' : notificationUnreadCount}</span>}</div>
            <span className="text-[10px] font-medium">Thông báo</span>
          </button>
        )}
        {(isActivated || isAdmin) && (
          <button onClick={() => navigate('/lab')} className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors" style={{ color: isOnSimLab ? '#2878BD' : '#AEACA8' }}>
            <FlaskConical className="w-5 h-5" /><span className="text-[10px] font-medium">Phòng TN</span>
          </button>
        )}
        <button onClick={() => setSettingsOpen(true)} className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors" style={{ color: '#AEACA8' }}>
          <Settings className="w-5 h-5" /><span className="text-[10px] font-medium">Cài đặt</span>
        </button>
      </nav>

      {isOnHome && !showAdminDashboard && !isActivated && !isAdmin && (
        <ErrorBoundary><Suspense fallback={null}><Chatbot /></Suspense></ErrorBoundary>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Root
// ──────────────────────────────────────────────────────────────────
function App() {
  const cloud = useCloudStorage();
  return (
    <>
      <AppDataSync cloud={cloud} />
      <AppShell cloud={cloud} />
    </>
  );
}

export default App;

```
