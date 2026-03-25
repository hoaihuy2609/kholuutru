import { supabase } from '../lib/supabase';
import { StudyPlanItem, ScheduleItem } from '../../types';
import { getActivatedPhone } from '../utils/phone';

// ── Study Plans ──

// ✅ PERF: Cache kế hoạch 5 phút — invalidate khi CRUD
let _studyPlansCache: { data: StudyPlanItem[]; ts: number; phone: string } | null = null;
export const getStudyPlans = async (): Promise<StudyPlanItem[]> => {
    const normalizedPhone = getActivatedPhone();
    if (!normalizedPhone) return [];
    if (_studyPlansCache && _studyPlansCache.phone === normalizedPhone && Date.now() - _studyPlansCache.ts < 5 * 60 * 1000) {
        return _studyPlansCache.data;
    }
    try {
        const { data, error } = await supabase.from('study_plans').select('*')
            .eq('student_phone', normalizedPhone).order('due_date', { ascending: true });
        if (error) throw error;
        _studyPlansCache = { data: data as StudyPlanItem[], ts: Date.now(), phone: normalizedPhone };
        return data as StudyPlanItem[];
    } catch (e) { console.error('Lỗi tải kế hoạch:', e); return []; }
};

export const saveStudyPlan = async (taskName: string, dueDate: string, color: string = '#6B7CDB') => {
    const normalizedPhone = getActivatedPhone();
    if (!normalizedPhone) return null;

    try {
        const { data, error } = await supabase.from('study_plans').insert({
            student_phone: normalizedPhone, task_name: taskName, due_date: dueDate, color
        }).select().single();
        if (error) throw error;
        _studyPlansCache = null;
        return data as StudyPlanItem;
    } catch (e) { console.error('Lỗi tạo kế hoạch:', e); return null; }
};

export const updateStudyPlan = async (id: string, updates: Partial<StudyPlanItem>) => {
    const normalizedPhone = getActivatedPhone();
    if (!normalizedPhone) return false;
    try {
        const { error } = await supabase.from('study_plans').update(updates).eq('id', id).eq('student_phone', normalizedPhone);
        if (error) throw error;
        _studyPlansCache = null;
        return true;
    } catch (e) { console.error('Lỗi cập nhật kế hoạch:', e); return false; }
};

export const deleteStudyPlan = async (id: string) => {
    const normalizedPhone = getActivatedPhone();
    if (!normalizedPhone) return false;
    try {
        const { error } = await supabase.from('study_plans').delete().eq('id', id).eq('student_phone', normalizedPhone);
        if (error) throw error;
        _studyPlansCache = null;
        return true;
    } catch (e) { console.error('Lỗi xóa kế hoạch:', e); return false; }
};

// ── Schedules ──

export const getSchedules = async (grade: number): Promise<ScheduleItem[]> => {
    // ✅ PERF: Cache 10 phút — thời khóa biểu ít thay đổi
    const cacheKey = `pv_schedules_${grade}`;
    const cacheTs = parseInt(localStorage.getItem(`${cacheKey}_ts`) || '0', 10);
    if (Date.now() - cacheTs < 10 * 60 * 1000) {
        const local = localStorage.getItem(cacheKey);
        if (local) return JSON.parse(local);
    }
    try {
        const { data, error } = await supabase.from('schedules').select('*')
            .eq('grade', grade).order('date', { ascending: true }).order('start_time', { ascending: true });
        if (error) throw error;
        localStorage.setItem(cacheKey, JSON.stringify(data));
        localStorage.setItem(`${cacheKey}_ts`, String(Date.now()));
        return data as ScheduleItem[];
    } catch (e) {
        console.error('Lỗi tải thời khóa biểu từ Supabase, fall back local:', e);
        const local = localStorage.getItem(cacheKey);
        return local ? JSON.parse(local) : [];
    }
};

export const saveSchedule = async (schedule: Omit<ScheduleItem, 'id' | 'created_at'>) => {
    try {
        const { data, error } = await supabase.from('schedules').insert([schedule]).select().single();
        if (error) throw error;
        return data as ScheduleItem;
    } catch (e) {
        console.error('Lỗi tạo lịch học:', e);
        const newSchedule = { id: crypto.randomUUID ? crypto.randomUUID() : `sch_${Date.now()}`, ...schedule, created_at: new Date().toISOString() };
        const local = JSON.parse(localStorage.getItem(`pv_schedules_${schedule.grade}`) || '[]');
        localStorage.setItem(`pv_schedules_${schedule.grade}`, JSON.stringify([...local, newSchedule]));
        return newSchedule as ScheduleItem;
    }
};

export const updateSchedule = async (id: string, updates: Partial<ScheduleItem>, grade: number) => {
    try {
        const { error } = await supabase.from('schedules').update(updates).eq('id', id);
        if (error) throw error;
        return true;
    } catch (e) {
        console.error('Lỗi cập nhật lịch học:', e);
        const local = JSON.parse(localStorage.getItem(`pv_schedules_${grade}`) || '[]');
        const idx = local.findIndex((s: ScheduleItem) => s.id === id);
        if (idx !== -1) { local[idx] = { ...local[idx], ...updates }; localStorage.setItem(`pv_schedules_${grade}`, JSON.stringify(local)); }
        return true;
    }
};

export const deleteSchedule = async (id: string, grade: number) => {
    try {
        const { error } = await supabase.from('schedules').delete().eq('id', id);
        if (error) throw error;
        return true;
    } catch (e) {
        console.error('Lỗi xóa lịch học:', e);
        const local = JSON.parse(localStorage.getItem(`pv_schedules_${grade}`) || '[]');
        localStorage.setItem(`pv_schedules_${grade}`, JSON.stringify(local.filter((s: ScheduleItem) => s.id !== id)));
        return true;
    }
};
