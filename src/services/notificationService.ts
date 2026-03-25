import { supabase } from '../lib/supabase';
import { NotificationItem } from '../../types';
import { getActivatedPhone } from '../utils/phone';

// ── Notifications ──

// ✅ PERF: Cache thông báo 10 phút — giảm tải SELECT notifications
const _notifCache: Record<number, { data: NotificationItem[]; ts: number }> = {};
export const getNotifications = async (grade: number): Promise<NotificationItem[]> => {
    const cached = _notifCache[grade];
    if (cached && Date.now() - cached.ts < 10 * 60 * 1000) return cached.data;
    try {
        const { data, error } = await supabase.from('notifications').select('*')
            .eq('grade', grade).order('created_at', { ascending: false });
        if (error) throw error;
        const result = (data || []) as NotificationItem[];
        _notifCache[grade] = { data: result, ts: Date.now() };
        return result;
    } catch (e) { console.error('Lỗi tải thông báo:', e); return []; }
};

// ✅ PERF: Cache danh sách đã fetch 10 phút
// ⚠️ Khai báo trước markNotificationFetched — tránh Temporal Dead Zone
let _fetchedIdsCache: { data: Set<string>; ts: number; phone: string } | null = null;

export const markNotificationFetched = async (notificationId: string): Promise<boolean> => {
    const normalizedPhone = getActivatedPhone();
    if (!normalizedPhone) return false;
    try {
        const { error } = await supabase.from('notification_fetches').insert({
            notification_id: notificationId, student_phone: normalizedPhone,
        });
        if (error) throw error;
        _fetchedIdsCache = null; // Invalidate cache
        return true;
    } catch (e) { console.error('Lỗi đánh dấu fetch:', e); return false; }
};

export const deleteNotification = async (notificationId: string): Promise<boolean> => {
    try {
        // ✅ Admin Ops Fix: dùng RPC SECURITY DEFINER
        const { error } = await supabase.rpc('admin_delete_notification', { p_id: notificationId });
        if (error) throw error;
        return true;
    } catch (e) { console.error('Lỗi xóa thông báo:', e); return false; }
};

export const createCustomNotification = async (message: string, grade: number): Promise<boolean> => {
    try {
        // ✅ Admin Ops Fix: dùng RPC SECURITY DEFINER
        const { error } = await supabase.rpc('admin_create_custom_notification', { p_message: message, p_grade: grade });
        if (error) throw error;
        return true;
    } catch (e) { console.error('Lỗi tạo thông báo:', e); return false; }
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

export const submitQuestionVote = async (examId: string, partName: string, questionNumber: number) => {
    const normalizedPhone = getActivatedPhone();
    if (!normalizedPhone) return { success: false, error: 'Chưa kích hoạt' };

    try {
        // Insert first — rely on DB unique constraint to prevent duplicates (race-safe)
        const { error: insertError } = await supabase.from('question_votes').insert({
            exam_id: examId, student_phone: normalizedPhone, part_name: partName, question_number: questionNumber
        });
        if (insertError) {
            if (insertError.code === '23505') return { success: false, error: 'Bạn đã vote cho câu này rồi.' };
            throw insertError;
        }

        const { count, error: countError } = await supabase.from('question_votes')
            .select('id', { count: 'exact', head: true }).eq('exam_id', examId).eq('student_phone', normalizedPhone);
        if (!countError && count !== null && count > 3) {
            await supabase.from('question_votes').delete()
                .eq('exam_id', examId).eq('student_phone', normalizedPhone)
                .eq('part_name', partName).eq('question_number', questionNumber);
            return { success: false, error: 'Bạn đã hết 3 lượt vote cho đề này.' };
        }

        // ✅ Invalidate caches sau khi vote thành công
        delete _questionVotesCache[examId];
        _allTopVotesCache = null;
        return { success: true };
    } catch (e: any) { console.error('Lỗi khi submit vote:', e); return { success: false, error: e.message || 'Lỗi hệ thống' }; }
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
