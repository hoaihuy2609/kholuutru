import { supabase } from '../lib/supabase';
import { NotificationItem } from '../../types';
import { normalizePhone, getActivatedPhone } from '../utils/phone';

// ── Notifications ──

export const getNotifications = async (grade: number): Promise<NotificationItem[]> => {
    try {
        const { data, error } = await supabase.from('notifications').select('*')
            .eq('grade', grade).order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []) as NotificationItem[];
    } catch (e) { console.error('Lỗi tải thông báo:', e); return []; }
};

export const markNotificationFetched = async (notificationId: string): Promise<boolean> => {
    const normalizedPhone = getActivatedPhone();
    if (!normalizedPhone) return false;
    try {
        const { error } = await supabase.from('notification_fetches').insert({
            notification_id: notificationId, student_phone: normalizedPhone,
        });
        if (error) throw error;
        return true;
    } catch (e) { console.error('Lỗi đánh dấu fetch:', e); return false; }
};

export const deleteNotification = async (notificationId: string): Promise<boolean> => {
    try {
        const { error } = await supabase.from('notifications').delete().eq('id', notificationId);
        if (error) throw error;
        return true;
    } catch (e) { console.error('Lỗi xóa thông báo:', e); return false; }
};

export const createCustomNotification = async (message: string, grade: number): Promise<boolean> => {
    try {
        const { error } = await supabase.from('notifications').insert({ message, grade, fetch_enabled: false });
        if (error) throw error;
        return true;
    } catch (e) { console.error('Lỗi tạo thông báo:', e); return false; }
};

export const getFetchedNotificationIds = async (): Promise<Set<string>> => {
    const normalizedPhone = getActivatedPhone();
    if (!normalizedPhone) return new Set();
    try {
        const { data, error } = await supabase.from('notification_fetches')
            .select('notification_id').eq('student_phone', normalizedPhone);
        if (error) throw error;
        return new Set((data || []).map((r: any) => r.notification_id));
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

        // After successful insert, check if over limit and rollback if needed
        const { count, error: countError } = await supabase.from('question_votes')
            .select('id', { count: 'exact', head: true }).eq('exam_id', examId).eq('student_phone', normalizedPhone);
        if (!countError && count !== null && count > 3) {
            await supabase.from('question_votes').delete()
                .eq('exam_id', examId).eq('student_phone', normalizedPhone)
                .eq('part_name', partName).eq('question_number', questionNumber);
            return { success: false, error: 'Bạn đã hết 3 lượt vote cho đề này.' };
        }

        return { success: true };
    } catch (e: any) { console.error('Lỗi khi submit vote:', e); return { success: false, error: e.message || 'Lỗi hệ thống' }; }
};

export const getQuestionVotes = async (examId: string) => {
    try {
        const { data, error } = await supabase.from('question_votes')
            .select('part_name, question_number, student_phone').eq('exam_id', examId);
        if (error) throw error;
        return data || [];
    } catch (e) { console.error('Lỗi lấy dữ liệu vote:', e); return []; }
};
