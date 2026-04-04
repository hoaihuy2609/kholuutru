import { supabase } from '../lib/supabase';
import { dbGet, dbSet } from '../lib/db';
import { fetchViaCloudflareProxy, TELEGRAM_CHAT_ID, CLOUDFLARE_PROXY_URL, ADMIN_AUTH_HEADER } from '../lib/telegram';
import { aesEncrypt, smartDecrypt, fnvHash } from '../lib/crypto';
import { Exam } from '../../types';
import { normalizePhone, getActivatedPhone } from '../utils/phone';

const EXAM_CHUNK_SIZE = 50;
const EXAM_CONCURRENCY = 8;

// ── Cloudflare Worker URL (vault-index cache layer) ──
// VITE_VAULT_WORKER_URL = URL Worker bạn deploy ở Cloudflare
// Ví dụ: https://vault-index-cache.yourname.workers.dev
const VAULT_WORKER_URL = import.meta.env.VITE_VAULT_WORKER_URL || '';

// In-memory inflight lock — khi 2000 user cùng load, chỉ 1 request đi thật
const _inflightByGrade = new Map<number, Promise<string | null>>();

/**
 * Lấy telegram_file_id từ vault_index.
 * Ưu tiên: Cloudflare Worker (cache 60s) → Supabase trực tiếp (fallback)
 */
async function getVaultIndexFileId(grade: number): Promise<string | null> {
    // Nếu đang có request cùng grade, dùng chung kết quả
    if (_inflightByGrade.has(grade)) return _inflightByGrade.get(grade)!;

    const p = (async (): Promise<string | null> => {
        // Thử Cloudflare Worker trước
        if (VAULT_WORKER_URL) {
            try {
                const res = await fetch(`${VAULT_WORKER_URL}/vault-index?grade=${grade}`);
                if (res.ok) {
                    const data = await res.json();
                    const fileId = Array.isArray(data) ? data[0]?.telegram_file_id : data?.telegram_file_id;
                    if (fileId) return fileId as string;
                }
            } catch { /* Worker không khả dụng, fallback Supabase */ }
        }
        // Fallback: hỏi Supabase trực tiếp
        try {
            const { data } = await supabase.from('vault_index').select('telegram_file_id').eq('grade', grade).maybeSingle();
            return data?.telegram_file_id || null;
        } catch { return null; }
    })();

    _inflightByGrade.set(grade, p);
    p.finally(() => _inflightByGrade.delete(grade));
    return p;
}

/**
 * Purge cache Cloudflare Worker sau khi đăng đề mới.
 * Gọi sau khi admin_upsert_vault_index thành công.
 */
export async function purgeVaultIndexCache(grade: number): Promise<void> {
    if (!VAULT_WORKER_URL) return;
    const PURGE_SECRET = import.meta.env.VITE_VAULT_PURGE_SECRET || 'physivault-purge-2025';
    try {
        await fetch(`${VAULT_WORKER_URL}/purge`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-purge-secret': PURGE_SECRET },
            body: JSON.stringify({ grade }),
        });
    } catch { /* Purge lỗi không ảnh hưởng luồng chính */ }
}

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

    const { error: sbError } = await supabase.rpc('admin_upsert_vault_index', {
        p_grade: 0,
        p_telegram_file_id: masterFileId,
    });
    if (sbError) throw new Error('Không thể ghi địa chỉ exam lên Supabase: ' + sbError.message);

    localStorage.setItem('pv_last_fetched_exam_index', masterFileId);
    localStorage.setItem('pv_exam_versions', JSON.stringify(examVersions));
    localStorage.setItem('pv_exam_chunks_map', JSON.stringify(newChunkMap));
    await dbSet('physivault_exams', exams);
    } finally { _saveExamLock = false; }
};

let _lastLoadExamsTs = 0;
export const loadExams = async (): Promise<Exam[]> => {
    const cachedExams: Exam[] = (await dbGet('physivault_exams')) || [];
    // ✅ PERF: Debounce 30s — tránh spam Supabase khi navigate qua lại
    if (Date.now() - _lastLoadExamsTs < 30_000 && cachedExams.length > 0) return cachedExams;
    _lastLoadExamsTs = Date.now();

    const localExamsMap = new Map<string, Exam>(cachedExams.map(e => [e.id, e]));

    // Resolve master index file_id
    // Ưu tiên: Cloudflare Worker Cache → Supabase trực tiếp → localStorage
    let fileId: string | null = await getVaultIndexFileId(0);

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

export const saveExamResult = async (
    exam: Exam,
    score: number,
    totalQuestions: number,
    correctAnswers: number,
    partScores?: { mc: number; tf: number; sa: number },
    tfBreakdown?: number[]
): Promise<void> => {
    const normalizedPhone = getActivatedPhone();
    if (!normalizedPhone) return;

    const studentName = localStorage.getItem('pv_student_name') || 'Học sinh';
    const grade = parseInt(localStorage.getItem('physivault_grade') || '0', 10) || exam.grade;

    const payload = {
        student_phone: normalizedPhone,
        student_name: studentName,
        exam_id: exam.id,
        exam_title: exam.title,
        score,
        total_questions: totalQuestions,
        correct_answers: correctAnswers,
        submitted_at: new Date().toISOString(),
        grade,
        part_scores: partScores,
        tf_breakdown: tfBreakdown,
    };

    // ✅ OPTIMISTIC SUBMIT — Lá chắn 1: lưu localStorage TRƯỚC khi đụng mạng
    // Dedup theo exam_id — tránh ghi trùng nếu học sinh bấm Nộp 2 lần
    const existingQueue: any[] = JSON.parse(localStorage.getItem('pv_pending_results') || '[]');
    const dedupedQueue = existingQueue.filter(p => p.exam_id !== exam.id);
    localStorage.setItem('pv_pending_results', JSON.stringify([
        ...dedupedQueue,
        { ...payload, _synced: false },
    ]));

    // Lá chắn 2: ghi Supabase ngầm — KHÔNG block UI, hàm trả về ngay
    _syncWithRetry(payload);
};

// FIX 1: Ghi qua RPC (SECURITY DEFINER) — bỏ qua RLS overhead, ~300 req/s
const _syncToSupabase = async (payload: any): Promise<void> => {
    const { error } = await supabase.rpc('submit_exam_result', {
        p_student_phone:   payload.student_phone,
        p_exam_id:         payload.exam_id,
        p_exam_title:      payload.exam_title,
        p_grade:           payload.grade,
        p_score:           payload.score,
        p_student_name:    payload.student_name,
        p_correct_answers: payload.correct_answers,
        p_total_questions: payload.total_questions,
        p_part_scores:     payload.part_scores ?? null,
        p_tf_breakdown:    payload.tf_breakdown ?? null,
        p_submitted_at:    payload.submitted_at,
    });
    if (error) throw new Error(error.message);
};

// FIX 3: Wide Jitter Retry — 2000 máy rải đều 5–45s, không bao giờ gom "bầy đàn"
const _syncWithRetry = (payload: any, attempt = 0): void => {
    _syncToSupabase(payload)
        .then(() => {
            _markSynced(payload.exam_id);
            _flushPendingResults();
        })
        .catch(() => {
            if (attempt >= 4) {
                // Hết 5 lần → giữ _synced: false, syncPendingOnStartup vớt sau
                console.warn(`[SaveResult] Sync thất bại sau 5 lần, sẽ thử lại lần sau`);
                return;
            }
            // Jitter rộng 5s–45s: 2000 máy rải đều, không bao giờ gom lại 1 tích tắc
            const jitter = Math.random() * 40_000 + 5_000;
            setTimeout(() => _syncWithRetry(payload, attempt + 1), jitter);
        });
};

// Đánh dấu bài đã lên DB thành công
const _markSynced = (examId: string): void => {
    const queue: any[] = JSON.parse(localStorage.getItem('pv_pending_results') || '[]');
    localStorage.setItem('pv_pending_results', JSON.stringify(
        queue.map(p => p.exam_id === examId ? { ...p, _synced: true } : p)
    ));
};

// Gọi khi app khởi động — vớt lại các bài chưa sync (mất mạng lúc nộp)
export const syncPendingOnStartup = async (): Promise<void> => {
    const queue: any[] = JSON.parse(localStorage.getItem('pv_pending_results') || '[]');
    const unsyncedQueue = queue.filter(p => !p._synced);
    if (unsyncedQueue.length === 0) return;
    for (const p of unsyncedQueue) {
        try {
            await _syncToSupabase(p);
            _markSynced(p.exam_id);
            await new Promise(r => setTimeout(r, 300)); // Không bắn cùng lúc
        } catch { break; } // Mạng vẫn lỗi → dừng, thử lần sau
    }
};

// Background flush: vớt hàng đợi sau khi 1 bài thành công
const _flushPendingResults = async (): Promise<void> => {
    const queue: any[] = JSON.parse(localStorage.getItem('pv_pending_results') || '[]');
    const unsyncedQueue = queue.filter(p => !p._synced);
    if (unsyncedQueue.length === 0) return;
    for (const p of unsyncedQueue) {
        try {
            await _syncToSupabase(p);
            _markSynced(p.exam_id);
        } catch { /* không break, cố gắng hết queue */ }
    }
};

// ✅ PERF: Cache lịch sử thi 60s cho học sinh — admin vẫn realtime
let _examHistoryCache: { data: any[]; ts: number; key: string } | null = null;
export const getExamHistory = async (phoneFilter?: string) => {
    const normalizedPhone = phoneFilter !== undefined ? normalizePhone(phoneFilter) : null;
    const cacheKey = normalizedPhone || '__admin__';
    if (normalizedPhone && _examHistoryCache && _examHistoryCache.key === cacheKey && Date.now() - _examHistoryCache.ts < 60_000) {
        return _examHistoryCache.data;
    }
    try {
        let query = supabase.from('exam_results')
            .select('id, student_phone, student_name, exam_id, exam_title, score, total_questions, correct_answers, submitted_at, grade, part_scores, tf_breakdown')
            .order('submitted_at', { ascending: false });
        if (normalizedPhone) {
            query = query.eq('student_phone', normalizedPhone).limit(200);
        } else {
            query = query.limit(3000);
        }
        const { data, error } = await query;
        if (error) throw error;
        const dbData = data || [];

        // ✅ OPTIMISTIC MERGE: Gộp bài chưa sync từ localStorage lên đầu
        // Chỉ áp dụng khi lấy lịch sử của 1 học sinh cụ thể (không áp dụng cho Admin)
        if (normalizedPhone) {
            const queue: any[] = JSON.parse(localStorage.getItem('pv_pending_results') || '[]');
            const dbIds = new Set(dbData.map((d: any) => d.exam_id));
            // Chỉ lấy bài chưa sync VÀ chưa có trong DB (dedup tránh hiện trùng)
            const pendingOnly = queue.filter(p =>
                p.student_phone === normalizedPhone && !p._synced && !dbIds.has(p.exam_id)
            );
            const merged = [
                ...pendingOnly.map(p => ({ ...p, _isPending: true })),
                ...dbData,
            ];
            _examHistoryCache = { data: merged, ts: Date.now(), key: cacheKey };
            return merged;
        }

        if (!normalizedPhone) return dbData; // Admin: dữ liệu thực, không merge pending
        _examHistoryCache = { data: dbData, ts: Date.now(), key: cacheKey };
        return dbData;
    } catch (e) { console.error('Lỗi khi lấy lịch sử làm bài:', e); return []; }
};

// ✅ PERF: Cache bảng xếp hạng 5 phút
// Đọc từ leaderboard_cache (pre-calculated) thay vì full scan exam_results
let _leaderboardCache: { data: any; ts: number } | null = null;
export const getLeaderboard = async (minExams: number = 1) => {
    if (_leaderboardCache && Date.now() - _leaderboardCache.ts < 5 * 60 * 1000) return _leaderboardCache.data;
    try {
        const { data, error } = await supabase
            .from('leaderboard_cache')
            .select('grade, student_phone, student_name, avg_score, exam_count, best_score, recent_scores')
            .gte('exam_count', minExams)
            .order('avg_score', { ascending: false });

        if (error) throw error;
        if (!data || data.length === 0) return [[], [], []];

        const byGrade: Record<number, any[]> = { 10: [], 11: [], 12: [] };
        for (const row of data) {
            if (byGrade[row.grade]) {
                byGrade[row.grade].push({
                    name: row.student_name || 'Ẩn danh',
                    phone: row.student_phone,
                    avgScore: parseFloat(row.avg_score),
                    examCount: row.exam_count,
                    bestScore: parseFloat(row.best_score),
                    recentScores: Array.isArray(row.recent_scores) ? row.recent_scores.slice(-6) : [],
                });
            }
        }

        const top = (arr: any[]) => arr.sort((a: any, b: any) => b.avgScore - a.avgScore).slice(0, 5);
        const result = [top(byGrade[10]), top(byGrade[11]), top(byGrade[12])];
        _leaderboardCache = { data: result, ts: Date.now() };
        return result;
    } catch (e) { console.error('Lỗi khi lấy leaderboard:', e); return [[], [], []]; }
};
