import { supabase } from '../lib/supabase';
import { useState, useEffect, useRef } from 'react';
import CryptoJS from 'crypto-js';
import type JSZip from 'jszip'; // type-only — runtime import is deferred to call-sites
import { Lesson, StoredFile, FileStorage } from '../../types';

// Shared utilities (extracted)
import { dbGet, dbSet, dbSetBatch } from '../lib/db';
import { xorObfuscate, xorDeobfuscate, fnvHash, getMachineId, generateActivationKey, checkActivationStatus, aesEncrypt, smartDecrypt } from '../lib/crypto';
import { fetchViaCloudflareProxy, TELEGRAM_CHAT_ID, CLOUDFLARE_PROXY_URL, ADMIN_AUTH_HEADER } from '../lib/telegram';
import { normalizePhone } from '../utils/phone';

// Service modules (extracted)
import * as examService from '../services/examService';
import * as plannerService from '../services/plannerService';
import * as notificationService from '../services/notificationService';
import * as blogService from '../services/blogService';

// Re-export utilities for external consumers
export { fetchViaCloudflareProxy } from '../lib/telegram';
export { xorObfuscate, xorDeobfuscate, getMachineId, generateActivationKey, checkActivationStatus } from '../lib/crypto';
export { exportData, importData } from './exportImport';

// Storage Keys
const STORAGE_FILES_KEY = 'physivault_files';
const STORAGE_LESSONS_KEY = 'physivault_lessons';
const STORAGE_ACTIVATION_KEY = 'physivault_activated';
const STORAGE_GRADE_KEY = 'physivault_grade';

interface ExportData {
    version: number;
    exportedAt: number;
    lessons: Lesson[];
    files: { [lessonId: string]: StoredFile[] };
    isEncrypted?: boolean;
}

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
            }
            // Lưu machine_id và activation_key lên Supabase
            await supabase.from('students').update({
                machine_id: machineId,
                activation_key: CryptoJS.SHA256(key).toString(),
            }).eq('phone', phoneStr);
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

    const fetchLessonsFromGitHub = async (grade: number, onProgress?: (pct: number) => void): Promise<{ success: boolean; lessonCount: number; fileCount: number; skipped?: boolean }> => {
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
                const { data } = await supabase.from('vault_index').select('telegram_file_id').eq('grade', grade).single();
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
                let isIncremental = false;

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
                    isIncremental = true;
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

    const syncToGitHub = async (grade: number, lessonsToSync: Lesson[], filesToSync: FileStorage): Promise<string> => {
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
        const indexBlob = new Blob([indexEncrypted.buffer as ArrayBuffer], { type: 'application/octet-stream' });
        const indexForm = new FormData();
        indexForm.append('chat_id', TELEGRAM_CHAT_ID);
        indexForm.append('document', indexBlob, `index_grade${grade}_v3.json`);
        indexForm.append('caption', `[INDEX-V3-ZIP] Lớp ${grade} | ${finalZipFileIds.length} phần`);

        const indexRes = await fetch(`${CLOUDFLARE_PROXY_URL}/proxy/sendDocument`, {
            method: 'POST', headers: { 'Authorization': ADMIN_AUTH_HEADER }, body: indexForm
        });
        if (!indexRes.ok) { setSyncProgress(0); throw new Error(`Lỗi upload Index: ${indexRes.statusText}`); }

        const finalFileId = (await indexRes.json()).result.document.file_id;
        const { error: sbError } = await supabase.from('vault_index').upsert({ grade, telegram_file_id: finalFileId, updated_at: Date.now() }, { onConflict: 'grade' });
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
            await supabase.from('notifications').insert({
                message: `Thầy vừa cập nhật tài liệu mới cho ${gradeLabel}! Hãy bấm nút bên dưới để tải về ngay nhé.`,
                grade, fetch_enabled: true,
            });
        } catch (notifErr) { console.error('[Notification] Không tạo được thông báo:', notifErr); }

        return finalFileId;
        } finally { _syncLock.current[grade] = false; }
    };

    return {
        lessons, storedFiles, loading, isActivated, syncProgress,
        addLesson, deleteLesson, uploadFiles, deleteFile,
        activateSystem, verifyAccess,
        fetchLessonsFromGitHub, syncToGitHub,
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
