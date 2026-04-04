import { supabase } from '../lib/supabase';
import { NotificationItem } from '../../types';
import { getActivatedPhone } from '../utils/phone';

// ── Cloudflare Worker URL (dùng chung Worker API Gateway) ──
const VAULT_WORKER_URL = import.meta.env.VITE_VAULT_WORKER_URL || '';
const PURGE_SECRET = import.meta.env.VITE_VAULT_PURGE_SECRET || 'physivault-purge-2025';

// In-memory inflight lock theo từng grade
const _notifInflight = new Map<number, Promise<NotificationItem[]>>();

async function getNotificationsFromWorker(grade: number): Promise<NotificationItem[] | null> {
    if (!VAULT_WORKER_URL) return null;
    try {
        const res = await fetch(`${VAULT_WORKER_URL}/notifications?grade=${grade}`);
        if (!res.ok) return null;
        const data = await res.json();
        return Array.isArray(data) ? data as NotificationItem[] : null;
    } catch { return null; }
}

async function purgeNotificationsCache(grade: number): Promise<void> {
    if (!VAULT_WORKER_URL) return;
    try {
        await fetch(`${VAULT_WORKER_URL}/purge`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-purge-secret': PURGE_SECRET },
            body: JSON.stringify({ target: 'notifications', grade }),
        });
    } catch { /* purge lỗi không ảnh hưởng luồng chính */ }
}

// ── Notifications ──

// ✅ PERF: Client cache 10 phút + Cloudflare Worker edge cache 30s
const _notifCache: Record<number, { data: NotificationItem[]; ts: number }> = {};
export const getNotifications = async (grade: number): Promise<NotificationItem[]> => {
    // 1️⃣ Client-side cache 10 phút
    const cached = _notifCache[grade];
    if (cached && Date.now() - cached.ts < 10 * 60 * 1000) return cached.data;

    // 2️⃣ Inflight lock — tránh nhiều tab cùng bắn vào Worker
    if (_notifInflight.has(grade)) return _notifInflight.get(grade)!;

    const p = (async (): Promise<NotificationItem[]> => {
        // 3️⃣ Ưu tiên: Cloudflare Worker Cache (30s TTL)
        const workerData = await getNotificationsFromWorker(grade);
        if (workerData) {
            _notifCache[grade] = { data: workerData, ts: Date.now() };
            return workerData;
        }
        // 4️⃣ Fallback: hỏi Supabase trực tiếp
        try {
            const { data, error } = await supabase.from('notifications')
                .select('id, title, message, type, grade, fetch_enabled, created_at')
                .eq('grade', grade).order('created_at', { ascending: false }).limit(20);
            if (error) throw error;
            const result = (data || []) as NotificationItem[];
            _notifCache[grade] = { data: result, ts: Date.now() };
            return result;
        } catch (e) { console.error('Lỗi tải thông báo:', e); return []; }
    })();

    _notifInflight.set(grade, p);
    p.finally(() => _notifInflight.delete(grade));
    return p;
};

// ✅ PERF: Cache danh sách đã fetch 10 phút
// ⚠️ Khai báo trước markNotificationFetched — tránh Temporal Dead Zone
let _fetchedIdsCache: { data: Set<string>; ts: number; phone: string } | null = null;

// FIX (Row-Lock Contention): Khoá in-memory theo từng notificationId
// Nếu học sinh spam click, chỉ request đầu tiên được phép gọi DB.
// Các request sau bị bỏ qua ngay tại client → Không tạo Row Lock trong Supabase.
const _markingInProgress = new Set<string>();

export const markNotificationFetched = async (notificationId: string): Promise<boolean> => {
    const normalizedPhone = getActivatedPhone();
    if (!normalizedPhone) return false;

    const lockKey = `${normalizedPhone}::${notificationId}`;

    // Nếu đang có request gọi DB cho cặp (phone, notifId) này → bỏ qua luôn
    if (_markingInProgress.has(lockKey)) return false;

    _markingInProgress.add(lockKey);
    try {
        const { error } = await supabase.from('notification_fetches').insert({
            notification_id: notificationId, student_phone: normalizedPhone,
        });
        // Lỗi 23505 = đã tồn tại (đã đọc rồi) → Không phải lỗi thật, ignore
        if (error && error.code !== '23505') throw error;
        _fetchedIdsCache = null; // Invalidate cache
        return true;
    } catch (e) { console.error('Lỗi đánh dấu fetch:', e); return false; }
    finally { _markingInProgress.delete(lockKey); }
};

export const deleteNotification = async (notificationId: string, grade?: number): Promise<boolean> => {
    try {
        const { error } = await supabase.rpc('admin_delete_notification', { p_id: notificationId });
        if (error) throw error;
        // Purge cache sau khi xóa
        if (grade !== undefined) {
            _notifCache[grade] = { data: [], ts: 0 };
            purgeNotificationsCache(grade).catch(() => {});
        }
        return true;
    } catch (e) { console.error('Lỗi xóa thông báo:', e); return false; }
};

export const createCustomNotification = async (message: string, grade: number): Promise<boolean> => {
    try {
        const { error } = await supabase.rpc('admin_create_custom_notification', { p_message: message, p_grade: grade });
        if (error) throw error;
        // Purge cache để học sinh thấy thông báo mới ngay lập tức
        _notifCache[grade] = { data: [], ts: 0 };
        purgeNotificationsCache(grade).catch(() => {});
        return true;
    } catch (e) { console.error('Lỗi tạo thông báo:', e); return false; }
};

export const replaceSyncNotification = async (grade: number, title: string, message: string): Promise<boolean> => {
    try {
        const { error } = await supabase.rpc('admin_replace_sync_notification', { 
            p_grade: grade, 
            p_title: title, 
            p_message: message 
        });
        if (error) throw error;
        // Purge cache để học sinh thấy thông báo mới ngay lập tức
        _notifCache[grade] = { data: [], ts: 0 };
        purgeNotificationsCache(grade).catch(() => {});
        return true;
    } catch (e) { 
        console.error('Lỗi thay thế thông báo sync:', e); 
        return false; 
    }
};

// getFetchedNotificationIds — dùng _fetchedIdsCache khai báo bên trên
export const getFetchedNotificationIds = async (): Promise<Set<string>> => {
    const normalizedPhone = getActivatedPhone();
    if (!normalizedPhone) return new Set();
    if (_fetchedIdsCache && _fetchedIdsCache.phone === normalizedPhone && Date.now() - _fetchedIdsCache.ts < 10 * 60 * 1000) {
        return _fetchedIdsCache.data;
    }
    try {
        const { data, error } = await supabase.from('notification_fetches')
            .select('notification_id').eq('student_phone', normalizedPhone);
        if (error) throw error;
        const result = new Set((data || []).map((r: any) => r.notification_id));
        _fetchedIdsCache = { data: result, ts: Date.now(), phone: normalizedPhone };
        return result;
    } catch (e) { console.error('Lỗi tải danh sách đã fetch:', e); return new Set(); }
};

// ── Voting ──

// FIX (Debounce + Edge Lock): 2 lớp phòng thủ chống spam Vote
// Lớp 1: Debounce 800ms tại Client — click 10 lần liên tục chỉ gửi 1 request
// Lớp 2: Worker /vote với Edge Lock — Cloudflare chặn, Supabase không bị chạm
const _voteTimers = new Map<string, ReturnType<typeof setTimeout>>();

export const submitQuestionVote = (examId: string, partName: string, questionNumber: number): Promise<{ success: boolean; error?: string }> => {
    const normalizedPhone = getActivatedPhone();
    if (!normalizedPhone) return Promise.resolve({ success: false, error: 'Chưa kích hoạt' });

    const voteKey = `${examId}::${partName}::${questionNumber}`;

    // Hủy timer cũ nếu học sinh click liên tục
    if (_voteTimers.has(voteKey)) {
        clearTimeout(_voteTimers.get(voteKey)!);
    }

    return new Promise((resolve) => {
        const timer = setTimeout(async () => {
            _voteTimers.delete(voteKey);
            try {
                // Gửi qua Worker /vote thay vì Supabase trực tiếp
                // Worker sẽ kiểm tra Edge Lock và chặn duplicate hoàn toàn
                const res = await fetch(`${VAULT_WORKER_URL}/vote`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        exam_id: examId,
                        part_name: partName,
                        question_number: questionNumber,
                        student_phone: normalizedPhone,
                    }),
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    return resolve({ success: false, error: (err as any).error || 'Lỗi hệ thống' });
                }
                // Invalidate cache vote sau khi vote thành công
                delete _questionVotesCache[examId];
                _allTopVotesCache = null;
                resolve({ success: true });
            } catch (e: any) {
                console.error('Lỗi khi submit vote:', e);
                resolve({ success: false, error: e.message || 'Lỗi hệ thống' });
            }
        }, 800); // 800ms debounce

        _voteTimers.set(voteKey, timer);
    });
};

// ✅ PERF: Cache vote theo examId 60s — invalidate khi có vote mới
const _questionVotesCache: Record<string, { data: any[]; ts: number }> = {};
export const getQuestionVotes = async (examId: string) => {
    const cached = _questionVotesCache[examId];
    if (cached && Date.now() - cached.ts < 60_000) return cached.data;
    try {
        const { data, error } = await supabase.from('question_votes')
            .select('part_name, question_number, student_phone').eq('exam_id', examId);
        if (error) throw error;
        const result = data || [];
        _questionVotesCache[examId] = { data: result, ts: Date.now() };
        return result;
    } catch (e) { console.error('Lỗi lấy dữ liệu vote:', e); return []; }
};

// ✅ PERF: Cache getAllExamTopVotes 5 phút — full table scan nặng, chỉ admin gọi
let _allTopVotesCache: { data: Record<string, any[]>; ts: number } | null = null;
export const getAllExamTopVotes = async (): Promise<Record<string, { part: string; num: number; count: number }[]>> => {
    if (_allTopVotesCache && Date.now() - _allTopVotesCache.ts < 5 * 60 * 1000) return _allTopVotesCache.data;
    try {
        const { data, error } = await supabase.from('question_votes')
            .select('exam_id, part_name, question_number');
        if (error) throw error;

        // map of exam_id -> grouped votes array
        const examMap: Record<string, Record<string, number>> = {};
        (data || []).forEach(row => {
            if (row.part_name === 'blog') return;
            if (!examMap[row.exam_id]) examMap[row.exam_id] = {};
            const key = `${row.part_name}|${row.question_number}`;
            examMap[row.exam_id][key] = (examMap[row.exam_id][key] || 0) + 1;
        });

        const result: Record<string, { part: string; num: number; count: number }[]> = {};
        for (const [examId, counts] of Object.entries(examMap)) {
            const arr = Object.keys(counts).map(key => {
                const parts = key.split('|');
                return { part: parts[0], num: parseInt(parts[1]), count: counts[key] };
            });
            arr.sort((a, b) => b.count - a.count);
            result[examId] = arr;
        }
        _allTopVotesCache = { data: result, ts: Date.now() };
        return result;
    } catch (e) {
        console.error('Lỗi lấy top votes các đề:', e);
        return {};
    }
};
