import { supabase } from '../lib/supabase';
import { StudyPlanItem, ScheduleItem } from '../../types';

// ── Study Plans ──

export const getStudyPlans = async (): Promise<StudyPlanItem[]> => {
    const sdtStr = localStorage.getItem('pv_activated_sdt');
    if (!sdtStr) return [];
    let normalizedPhone = sdtStr.trim();
    if (normalizedPhone.length === 9 && !normalizedPhone.startsWith('0')) normalizedPhone = '0' + normalizedPhone;

    try {
        const { data, error } = await supabase.from('study_plans').select('*')
            .eq('student_phone', normalizedPhone).order('due_date', { ascending: true });
        if (error) throw error;
        return data as StudyPlanItem[];
    } catch (e) { console.error('Lỗi tải kế hoạch:', e); return []; }
};

export const saveStudyPlan = async (taskName: string, dueDate: string, color: string = '#6B7CDB') => {
    const sdtStr = localStorage.getItem('pv_activated_sdt');
    if (!sdtStr) return null;
    let normalizedPhone = sdtStr.trim();
    if (normalizedPhone.length === 9 && !normalizedPhone.startsWith('0')) normalizedPhone = '0' + normalizedPhone;

    try {
        const { data, error } = await supabase.from('study_plans').insert({
            student_phone: normalizedPhone, task_name: taskName, due_date: dueDate, color
        }).select().single();
        if (error) throw error;
        return data as StudyPlanItem;
    } catch (e) { console.error('Lỗi tạo kế hoạch:', e); return null; }
};

export const updateStudyPlan = async (id: string, updates: Partial<StudyPlanItem>) => {
    try {
        const { error } = await supabase.from('study_plans').update(updates).eq('id', id);
        if (error) throw error;
        return true;
    } catch (e) { console.error('Lỗi cập nhật kế hoạch:', e); return false; }
};

export const deleteStudyPlan = async (id: string) => {
    try {
        const { error } = await supabase.from('study_plans').delete().eq('id', id);
        if (error) throw error;
        return true;
    } catch (e) { console.error('Lỗi xóa kế hoạch:', e); return false; }
};

// ── Schedules ──

export const getSchedules = async (grade: number): Promise<ScheduleItem[]> => {
    try {
        const { data, error } = await supabase.from('schedules').select('*')
            .eq('grade', grade).order('date', { ascending: true }).order('start_time', { ascending: true });
        if (error) throw error;
        return data as ScheduleItem[];
    } catch (e) {
        console.error('Lỗi tải thời khóa biểu từ Supabase, fall back local:', e);
        const local = localStorage.getItem(`pv_schedules_${grade}`);
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
