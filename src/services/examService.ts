import { supabase } from '../lib/supabase';
import { dbGet, dbSet } from '../lib/db';
import { fetchViaCloudflareProxy, TELEGRAM_CHAT_ID, CLOUDFLARE_PROXY_URL, ADMIN_AUTH_HEADER } from '../lib/telegram';
import { xorObfuscate, xorDeobfuscate } from '../lib/crypto';
import { Exam } from '../../types';

export const uploadExamPdf = async (file: File, onProgress?: (pct: number) => void): Promise<{ fileId: string; fileName: string }> => {
    const formData = new FormData();
    formData.append('chat_id', TELEGRAM_CHAT_ID);
    formData.append('document', file, file.name);
    formData.append('caption', `[EXAM-PDF] ${file.name}`);

    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${CLOUDFLARE_PROXY_URL}/proxy/sendDocument`);
        xhr.setRequestHeader('Authorization', ADMIN_AUTH_HEADER);
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
            const data = JSON.parse(xhr.responseText);
            if (xhr.status === 200 && data.ok) {
                resolve({ fileId: data.result.document.file_id, fileName: file.name });
            } else {
                reject(new Error(`Upload thất bại: ${xhr.responseText.slice(0, 100)}`));
            }
        };
        xhr.onerror = () => reject(new Error('Lỗi mạng khi upload PDF'));
        xhr.send(formData);
    });
};

export const saveExam = async (exams: Exam[]): Promise<void> => {
    const content = xorObfuscate(JSON.stringify({ exams, savedAt: Date.now() }));
    const blob = new Blob([content], { type: 'application/json' });

    const formData = new FormData();
    formData.append('chat_id', TELEGRAM_CHAT_ID);
    formData.append('document', blob, 'exam_index.json');
    formData.append('caption', `[EXAM-INDEX] ${exams.length} đề thi`);

    const res = await fetch(`${CLOUDFLARE_PROXY_URL}/proxy/sendDocument`, {
        method: 'POST',
        headers: { 'Authorization': ADMIN_AUTH_HEADER },
        body: formData
    });
    if (!res.ok) throw new Error('Upload exam index thất bại');
    const data = await res.json();
    const fileId = data.result.document.file_id;

    const { error: sbError } = await supabase
        .from('vault_index')
        .upsert({ grade: 0, telegram_file_id: fileId, updated_at: Date.now() }, { onConflict: 'grade' });
    if (sbError) throw new Error('Không thể ghi địa chỉ exam lên Supabase');

    localStorage.setItem('pv_exam_index_file_id', fileId);
    await dbSet('physivault_exams', exams);
};

export const loadExams = async (): Promise<Exam[]> => {
    const cached = await dbGet('physivault_exams');
    try {
        const { data } = await supabase.from('vault_index').select('telegram_file_id').eq('grade', 0).single();
        const fileId = data?.telegram_file_id || localStorage.getItem('pv_exam_index_file_id');
        const savedFileId = localStorage.getItem('pv_exam_index_file_id');
        if (!fileId) return cached || [];
        if (fileId === savedFileId && cached && cached.length > 0) return cached;

        const arrayBuf = await fetchViaCloudflareProxy(fileId).catch(() => null);
        if (!arrayBuf) return cached || [];

        const parsed = JSON.parse(xorDeobfuscate(new TextDecoder().decode(arrayBuf)));
        const exams: Exam[] = parsed.exams || [];
        await dbSet('physivault_exams', exams);
        localStorage.setItem('pv_exam_index_file_id', fileId);
        return exams;
    } catch {
        return cached || [];
    }
};

export const deleteExam = async (examId: string, allExams: Exam[]): Promise<void> => {
    await saveExam(allExams.filter(e => e.id !== examId));
};

export const saveExamResult = async (exam: Exam, score: number, totalQuestions: number, correctAnswers: number): Promise<void> => {
    const sdtStr = localStorage.getItem('pv_activated_sdt');
    if (!sdtStr) return;
    let normalizedPhone = sdtStr.trim();
    if (normalizedPhone.length === 9 && !normalizedPhone.startsWith('0')) normalizedPhone = '0' + normalizedPhone;

    let studentName = 'Học sinh';
    let grade = exam.grade;
    try {
        const { data } = await supabase.from('students').select('name, grade').eq('phone', normalizedPhone).single();
        if (data?.name) studentName = data.name;
        if (data?.grade) grade = data.grade;
    } catch (e) { console.error('Không lấy được thông tin học sinh', e); }

    try {
        const { error } = await supabase.from('exam_results').insert({
            student_phone: normalizedPhone, student_name: studentName,
            exam_id: exam.id, exam_title: exam.title, score,
            total_questions: totalQuestions, correct_answers: correctAnswers,
            submitted_at: new Date().toISOString(), grade
        });
        if (error) console.error('Lỗi Insert Supabase:', error);
    } catch (e) { console.error('Lỗi khi lưu kết quả bài thi:', e); }
};

export const getExamHistory = async (phoneFilter?: string) => {
    try {
        let query = supabase.from('exam_results').select('*').order('submitted_at', { ascending: false });
        if (phoneFilter) query = query.eq('student_phone', phoneFilter);
        const { data, error } = await query;
        if (error) throw error;
        return data;
    } catch (e) { console.error('Lỗi khi lấy lịch sử làm bài:', e); return []; }
};

export const getLeaderboard = async (minExams: number = 1) => {
    try {
        const { data, error } = await supabase.from('exam_results')
            .select('student_phone, student_name, score, grade, submitted_at')
            .order('submitted_at', { ascending: true });
        if (error) throw error;
        if (!data || data.length === 0) return [[], [], []];

        const map: Record<string, { name: string; phone: string; grade: number; scores: number[] }> = {};
        for (const r of data) {
            const key = `${r.grade}__${r.student_phone}`;
            if (!map[key]) map[key] = { name: r.student_name || 'Ẩn danh', phone: r.student_phone, grade: r.grade, scores: [] };
            map[key].scores.push(r.score);
        }

        const byGrade: Record<number, any[]> = { 10: [], 11: [], 12: [] };
        for (const entry of Object.values(map)) {
            if (entry.scores.length < minExams) continue;
            const avg = entry.scores.reduce((a, b) => a + b, 0) / entry.scores.length;
            if (byGrade[entry.grade]) {
                byGrade[entry.grade].push({
                    name: entry.name, phone: entry.phone, avgScore: avg,
                    examCount: entry.scores.length, recentScores: entry.scores.slice(-6),
                    bestScore: Math.max(...entry.scores)
                });
            }
        }

        const top = (arr: any[]) => arr.sort((a: any, b: any) => b.avgScore - a.avgScore).slice(0, 5);
        return [top(byGrade[10]), top(byGrade[11]), top(byGrade[12])];
    } catch (e) { console.error('Lỗi khi lấy leaderboard:', e); return [[], [], []]; }
};
