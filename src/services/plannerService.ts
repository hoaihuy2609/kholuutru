import { supabase } from '../lib/supabase';
import { StudyPlanItem, ScheduleItem } from '../../types';
import { getActivatedPhone } from '../utils/phone';

// ── Cloudflare Worker URL (dùng chung Worker API Gateway) ──
const VAULT_WORKER_URL = import.meta.env.VITE_VAULT_WORKER_URL || '';
const PURGE_SECRET = import.meta.env.VITE_VAULT_PURGE_SECRET || 'physivault-purge-2025';

// Inflight lock theo grade — tránh nhiều tab cùng bắn
const _scheduleInflight = new Map<number, Promise<ScheduleItem[]>>();

async function purgeScheduleCache(grade: number): Promise<void> {
    if (!VAULT_WORKER_URL) return;
    try {
        await fetch(`${VAULT_WORKER_URL}/purge`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-purge-secret': PURGE_SECRET },
            body: JSON.stringify({ target: 'schedule', grade }),
        });
    } catch { /* purge lỗi không ảnh hưởng luồng chính */ }
}

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
        const { data, error } = await supabase.from('study_plans')
            .select('id, student_phone, task_name, is_completed, due_date, color')
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
    // 1️⃣ Client-side localStorage cache 10 phút
    const cacheKey = `pv_schedules_${grade}`;
    const cacheTs = parseInt(localStorage.getItem(`${cacheKey}_ts`) || '0', 10);
    if (Date.now() - cacheTs < 10 * 60 * 1000) {
        const local = localStorage.getItem(cacheKey);
        if (local) return JSON.parse(local);
    }

    // 2️⃣ Inflight lock — tránh nhiều tab bắn cùng lúc
    if (_scheduleInflight.has(grade)) return _scheduleInflight.get(grade)!;

    const p = (async (): Promise<ScheduleItem[]> => {
        // 3️⃣ Ưu tiên: Cloudflare Worker Cache (300s TTL)
        if (VAULT_WORKER_URL) {
            try {
                const res = await fetch(`${VAULT_WORKER_URL}/schedule?grade=${grade}`);
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data)) {
                        localStorage.setItem(cacheKey, JSON.stringify(data));
                        localStorage.setItem(`${cacheKey}_ts`, String(Date.now()));
                        return data as ScheduleItem[];
                    }
                }
            } catch { /* fallback Supabase */ }
        }
        // 4️⃣ Fallback: hỏi Supabase trực tiếp
        try {
            const { data, error } = await supabase.from('schedules')
                .select('id, title, description, date, start_time, end_time, grade, created_at')
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
    })();

    _scheduleInflight.set(grade, p);
    p.finally(() => _scheduleInflight.delete(grade));
    return p;
};

export const getAllSchedules = async (): Promise<ScheduleItem[]> => {
    const [g10, g11, g12] = await Promise.all([
        getSchedules(10),
        getSchedules(11),
        getSchedules(12),
    ]);
    return [...g10, ...g11, ...g12].sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.start_time.localeCompare(b.start_time);
    });
};

export const saveSchedule = async (schedule: Omit<ScheduleItem, 'id' | 'created_at'>) => {
    try {
        const { data, error } = await supabase.from('schedules').insert([schedule]).select().single();
        if (error) throw error;
        // Purge Edge cache + localStorage cache
        localStorage.removeItem(`pv_schedules_${schedule.grade}_ts`);
        purgeScheduleCache(schedule.grade).catch(() => {});
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
        // Purge Edge cache + localStorage cache
        localStorage.removeItem(`pv_schedules_${grade}_ts`);
        purgeScheduleCache(grade).catch(() => {});
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
        // Purge Edge cache + localStorage cache
        localStorage.removeItem(`pv_schedules_${grade}_ts`);
        purgeScheduleCache(grade).catch(() => {});
        return true;
    } catch (e) {
        console.error('Lỗi xóa lịch học:', e);
        const local = JSON.parse(localStorage.getItem(`pv_schedules_${grade}`) || '[]');
        localStorage.setItem(`pv_schedules_${grade}`, JSON.stringify(local.filter((s: ScheduleItem) => s.id !== id)));
        return true;
    }
};
