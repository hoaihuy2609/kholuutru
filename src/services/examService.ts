import type JSZip from 'jszip'; // type-only — runtime import is deferred to call-sites
import { supabase } from '../lib/supabase';
import { dbGet, dbSet } from '../lib/db';
import { fetchViaCloudflareProxy, TELEGRAM_CHAT_ID, CLOUDFLARE_PROXY_URL, ADMIN_AUTH_HEADER } from '../lib/telegram';
import { aesEncrypt, smartDecrypt, fnvHash } from '../lib/crypto';
import { Exam } from '../../types';
import { normalizePhone, getActivatedPhone } from '../utils/phone';

const EXAM_CHUNK_SIZE = 50;
const EXAM_CONCURRENCY = 8;

// ── Private helper: upload a Blob to Telegram, return file_id ──
const uploadBlobToTelegram = async (blob: Blob, fileName: string): Promise<string> => {
    const MAX_RETRIES = 5;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const formData = new FormData();
        formData.append('chat_id', TELEGRAM_CHAT_ID);
        formData.append('document', blob, fileName);
        const result = await new Promise<{ ok: boolean; fileId?: string; retryAfter?: number; error?: string }>((resolve) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', `${CLOUDFLARE_PROXY_URL}/proxy/sendDocument`);
            xhr.setRequestHeader('Authorization', ADMIN_AUTH_HEADER);
            xhr.onload = () => {
                const data = JSON.parse(xhr.responseText);
                if (xhr.status === 200 && data.ok) {
                    resolve({ ok: true, fileId: data.result.document.file_id });
                } else if (xhr.status === 429) {
                    resolve({ ok: false, retryAfter: (data?.parameters?.retry_after || 30) as number });
                } else {
                    resolve({ ok: false, error: `HTTP ${xhr.status}: ${xhr.responseText.slice(0, 150)}` });
                }
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

let _saveExamLock = false;
export const saveExam = async (exams: Exam[]): Promise<void> => {
    if (_saveExamLock) throw new Error('Đang lưu đề thi, vui lòng đợi...');
    _saveExamLock = true;
    try {
    const { default: JSZip } = await import('jszip');
    const examVersions: Record<string, string> = {};
    const chunkContents: Record<string, string[]> = {};
    const zipFileIds: string[] = [];

    for (const exam of exams) {
        examVersions[exam.id] = fnvHash(JSON.stringify(exam));
    }

    // Load previous chunk fingerprint → fileId map
    const prevChunkMap: Record<string, string> = JSON.parse(localStorage.getItem('pv_exam_chunks_map') || '{}');
    const newChunkMap: Record<string, string> = {};

    for (let offset = 0; offset < exams.length; offset += EXAM_CHUNK_SIZE) {
        const chunkExams = exams.slice(offset, offset + EXAM_CHUNK_SIZE);
        const chunkIndex = Math.floor(offset / EXAM_CHUNK_SIZE);

        // Chunk fingerprint: hash of sorted "examId:version" pairs
        const chunkFp = fnvHash(chunkExams.map(e => `${e.id}:${examVersions[e.id]}`).sort().join(','));

        let fileId: string;
        if (prevChunkMap[chunkFp]) {
            // Chunk unchanged — reuse existing fileId
            fileId = prevChunkMap[chunkFp];
        } else {
            // Chunk changed — encrypt each exam and zip
            const currentZip = new JSZip();
            const encryptedEntries = await Promise.all(
                chunkExams.map(async exam => ({
                    id: exam.id,
                    bytes: await aesEncrypt(JSON.stringify(exam)),
                }))
            );
            for (const { id, bytes } of encryptedEntries) {
                currentZip.file(`${id}.bin`, bytes);
            }
            const zipBlob = await currentZip.generateAsync({
                type: 'blob',
                compression: 'DEFLATE',
                compressionOptions: { level: 1 },
            });
            fileId = await uploadBlobToTelegram(zipBlob, `exam_chunk_${chunkIndex + 1}.zip`);
        }

        newChunkMap[chunkFp] = fileId;
        zipFileIds.push(fileId);
        chunkContents[fileId] = chunkExams.map(e => e.id);
    }

    // Upload Master Index
    const masterIndex = { examVersions, chunkContents, zipFileIds, savedAt: Date.now() };
    const indexEncrypted = await aesEncrypt(JSON.stringify(masterIndex));
    const indexBlob = new Blob([indexEncrypted], { type: 'application/octet-stream' });
    const masterFileId = await uploadBlobToTelegram(indexBlob, 'exam_index.bin');

    const { error: sbError } = await supabase
        .from('vault_index')
        .upsert({ grade: 0, telegram_file_id: masterFileId, updated_at: Date.now() }, { onConflict: 'grade' });
    if (sbError) throw new Error('Không thể ghi địa chỉ exam lên Supabase: ' + sbError.message);

    localStorage.setItem('pv_last_fetched_exam_index', masterFileId);
    localStorage.setItem('pv_exam_versions', JSON.stringify(examVersions));
    localStorage.setItem('pv_exam_chunks_map', JSON.stringify(newChunkMap));
    await dbSet('physivault_exams', exams);
    } finally { _saveExamLock = false; }
};

export const loadExams = async (): Promise<Exam[]> => {
    const cachedExams: Exam[] = (await dbGet('physivault_exams')) || [];
    const localExamsMap = new Map<string, Exam>(cachedExams.map(e => [e.id, e]));

    // Resolve master index file_id (Supabase first, localStorage fallback)
    let fileId: string | null = null;
    try {
        const { data } = await supabase.from('vault_index').select('telegram_file_id').eq('grade', 0).single();
        fileId = data?.telegram_file_id || null;
    } catch { /* offline */ }

    const lastFetchedId = localStorage.getItem('pv_last_fetched_exam_index');
    if (!fileId) fileId = lastFetchedId;
    if (!fileId) return cachedExams;

    // Fast path: already up-to-date
    if (fileId === lastFetchedId && cachedExams.length > 0) return cachedExams;

    // Download and decrypt master index
    const arrayBuf = await fetchViaCloudflareProxy(fileId).catch(() => null);
    if (!arrayBuf) return cachedExams;

    const indexData: {
        examVersions: Record<string, string>;
        chunkContents: Record<string, string[]>;
        zipFileIds: string[];
        savedAt: number;
    } = JSON.parse(await smartDecrypt(new Uint8Array(arrayBuf)));

    // Diff: identify changed and deleted exams
    const localVersions: Record<string, string> = JSON.parse(localStorage.getItem('pv_exam_versions') || '{}');
    const changedIds = new Set<string>();
    for (const [id, ver] of Object.entries(indexData.examVersions)) {
        if (localVersions[id] !== ver) changedIds.add(id);
    }
    const remoteIds = new Set(Object.keys(indexData.examVersions));
    const deletedIds = Object.keys(localVersions).filter(id => !remoteIds.has(id));

    for (const id of deletedIds) localExamsMap.delete(id);

    // Only fetch chunks that contain changed exams
    const zIdsToDownload = indexData.zipFileIds.filter(zipId =>
        (indexData.chunkContents[zipId] || []).some(id => changedIds.has(id))
    );

    const processChunk = async (chunkFileId: string): Promise<void> => {
        const { default: JSZip } = await import('jszip');
        const buf = await fetchViaCloudflareProxy(chunkFileId);
        const zip = new JSZip();
        const unzipped = await zip.loadAsync(buf);
        const filePromises: Promise<void>[] = [];
        unzipped.forEach((_, fileObj) => {
            if (!fileObj.dir) {
                filePromises.push(
                    fileObj.async('uint8array').then(async (bytes) => {
                        const decrypted = await smartDecrypt(bytes);
                        const exam: Exam = JSON.parse(decrypted);
                        localExamsMap.set(exam.id, exam);
                    })
                );
            }
        });
        await Promise.all(filePromises);
    };

    // Pooled concurrent downloads (max EXAM_CONCURRENCY in flight)
    const pool = new Set<Promise<void>>();
    for (const chunkFileId of zIdsToDownload) {
        const p: Promise<void> = processChunk(chunkFileId).then(() => { pool.delete(p); });
        pool.add(p);
        if (pool.size >= EXAM_CONCURRENCY) await Promise.race(pool);
    }
    if (pool.size > 0) await Promise.all(pool);

    const finalList = Array.from(localExamsMap.values());

    localStorage.setItem('pv_last_fetched_exam_index', fileId);
    localStorage.setItem('pv_exam_versions', JSON.stringify(indexData.examVersions));
    await dbSet('physivault_exams', finalList);

    return finalList;
};

export const deleteExam = async (examId: string, allExams: Exam[]): Promise<void> => {
    await saveExam(allExams.filter(e => e.id !== examId));
};

export const saveExamResult = async (exam: Exam, score: number, totalQuestions: number, correctAnswers: number): Promise<void> => {
    const normalizedPhone = getActivatedPhone();
    if (!normalizedPhone) return;

    let studentName = 'Học sinh';
    let grade = exam.grade;
    try {
        const { data } = await supabase.from('students').select('name, grade').eq('phone', normalizedPhone).maybeSingle();
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
    // phoneFilter = undefined → admin mode: lấy TẤT CẢ lịch sử, không filter
    // phoneFilter = 'SDT'    → học sinh: chỉ lấy lịch sử của SDT đó
    const normalizedPhone = phoneFilter !== undefined ? normalizePhone(phoneFilter) : null;
    try {
        let query = supabase.from('exam_results').select('*').order('submitted_at', { ascending: false });
        if (normalizedPhone) query = query.eq('student_phone', normalizedPhone);
        const { data, error } = await query;
        if (error) throw error;
        return data || [];
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
