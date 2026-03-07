import { supabase } from '../lib/supabase';

import { useState, useEffect } from 'react';
import JSZip from 'jszip';
import CryptoJS from 'crypto-js';
import { Lesson, StoredFile, FileStorage, Exam, StudyPlanItem, NotificationItem, BlogPost, ScheduleItem } from '../../types';

// Storage Keys
const STORAGE_FILES_KEY = 'physivault_files';
const STORAGE_LESSONS_KEY = 'physivault_lessons';
const STORAGE_ACTIVATION_KEY = 'physivault_activated';
const STORAGE_GRADE_KEY = 'physivault_grade';
const DB_NAME = 'PhysiVaultDB';
const DB_VERSION = 1;
const STORE_NAME = 'app_data';

const TELEGRAM_CHAT_ID = '-1003889339240';

const CLOUDFLARE_PROXY_URL = 'https://physivault-proxy.hoaihuy2609.workers.dev';

export const fetchViaCloudflareProxy = async (fileId: string): Promise<ArrayBuffer> => {
    const maxRetries = 3;
    // Timeout 60s mỗi lần thử — file ZIP lớn nhất ~18MB vẫn đủ thời gian tải
    const FETCH_TIMEOUT_MS = 60_000;
    let lastError: any = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        try {
            const proxyRes = await fetch(`${CLOUDFLARE_PROXY_URL}/getFile/${fileId}`, {
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (!proxyRes.ok) {
                let errorMsg = proxyRes.statusText;
                try { const errData = await proxyRes.json(); if (errData.error) errorMsg = errData.error; } catch { }
                // 429 = Telegram rate-limit → đợi lâu hơn
                if (proxyRes.status === 429) {
                    await new Promise(r => setTimeout(r, 5000));
                } else {
                    throw new Error(`Cloudflare Proxy Error: ${proxyRes.status} - ${errorMsg}`);
                }
                continue;
            }
            return await proxyRes.arrayBuffer();
        } catch (e: any) {
            clearTimeout(timeoutId);
            lastError = e;
            const isTimeout = e.name === 'AbortError';
            console.warn(`[Cloudflare] Lần thử ${attempt + 1}/${maxRetries} ${isTimeout ? '(timeout)' : ''} thất bại:`, e.message);
            if (attempt < maxRetries - 1) {
                // Retry delay ngắn (500ms) thay vì exponential backoff chậm
                await new Promise(r => setTimeout(r, 500));
            }
        }
    }
    throw lastError || new Error("Không thể kết nối đến Cloudflare Server.");
};

// --- Security Salts ---
const SYSTEM_SALT = "PHV_SECURITY_2026_BY_HUY";

// --- XOR Obfuscation for content ---
const XOR_KEY = 'PHV2026';
// Pre-compute key bytes một lần duy nhất (tránh tạo lại mỗi lần gọi hàm)
const XOR_KEY_BYTES = new TextEncoder().encode(XOR_KEY);
const XOR_KEY_LEN = XOR_KEY_BYTES.length;

export const xorObfuscate = (data: string): string => {
    // Encode UTF-8 string → bytes để tránh lỗi với ký tự tiếng Việt
    const bytes = new TextEncoder().encode(data);
    const result = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
        result[i] = bytes[i] ^ XOR_KEY_BYTES[i % XOR_KEY_LEN];
    }

    // Tối ưu hiệu năng: Xử lý theo khối (chunking) để tránh treo trình duyệt và stack limit
    const CHUNK_SIZE = 0x8000; // 32KB mỗi khối
    let binaryParts: string[] = [];
    for (let i = 0; i < result.length; i += CHUNK_SIZE) {
        const chunk = result.subarray(i, i + CHUNK_SIZE);
        // @ts-ignore - Dùng apply để chuyển chunk sang argument list một cách an toàn
        binaryParts.push(String.fromCharCode.apply(null, chunk));
    }
    return btoa(binaryParts.join(''));
};

export const xorDeobfuscate = (encoded: string): string => {
    try {
        // Tối ưu: dùng pre-computed key bytes, chỉ 1 Uint8Array duy nhất (trước đây tạo 2)
        const binaryStr = atob(encoded);
        const len = binaryStr.length;
        const result = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            result[i] = binaryStr.charCodeAt(i) ^ XOR_KEY_BYTES[i % XOR_KEY_LEN];
        }
        return new TextDecoder().decode(result);
    } catch {
        return encoded; // Nếu không phải XOR-encoded, trả về nguyên bản
    }
};

// --- IndexedDB Helper ---
const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

const dbGet = async (key: string): Promise<any> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

const dbSet = async (key: string, value: any): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(value, key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

interface ExportData {
    version: number;
    exportedAt: number;
    lessons: Lesson[];
    files: {
        [lessonId: string]: StoredFile[]
    };
    isEncrypted?: boolean;
}

// --- Security Helpers ---

export const getMachineId = (): string => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const txt = 'PhysiVault_Fingerprint_2026';
    if (ctx) {
        ctx.textBaseline = "top";
        ctx.font = "14px 'Arial'";
        ctx.textBaseline = "alphabetic";
        ctx.fillStyle = "#f60";
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = "#069";
        ctx.fillText(txt, 2, 15);
        ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
        ctx.fillText(txt, 4, 17);
    }
    const fingerprint = canvas.toDataURL();
    const hash = CryptoJS.SHA256(fingerprint + (navigator.userAgent || '') + (screen.height * screen.width)).toString();
    return hash.substring(0, 12).toUpperCase().replace(/(.{4})/g, '$1-').slice(0, -1);
};

export const generateActivationKey = (machineId: string, sdt: string = ""): string => {
    // Chuẩn hóa SĐT: Loại bỏ số 0 ở đầu để khớp với logic trên Google Sheets
    const normalizedSdt = sdt.replace(/^0+/, "");
    const rawData = machineId + normalizedSdt + SYSTEM_SALT;
    const hash = CryptoJS.SHA256(rawData).toString();

    // Lấy 12 ký tự đầu của hash để tạo mã PV-XXXX-YYYY
    return "PV-" + hash.substring(0, 12).toUpperCase().replace(/(.{4})/g, '$1-').slice(0, -1);
};

export const checkActivationStatus = (): boolean => {
    const status = localStorage.getItem(STORAGE_ACTIVATION_KEY);
    return status === 'true';
};

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

    // Sync state to IndexedDB
    useEffect(() => {
        if (!loading) dbSet(STORAGE_LESSONS_KEY, lessons);
    }, [lessons, loading]);

    useEffect(() => {
        if (!loading) dbSet(STORAGE_FILES_KEY, storedFiles);
    }, [storedFiles, loading]);

    const addLesson = async (name: string, chapterId: string) => {
        const newLesson: Lesson = {
            id: Date.now().toString(),
            name,
            chapterId,
            createdAt: Date.now()
        };
        setLessons(prev => [newLesson, ...prev]);
        return Promise.resolve();
    };

    const deleteLesson = async (lessonId: string) => {
        setLessons(prev => prev.filter(l => l.id !== lessonId));
        setStoredFiles(prev => {
            const newFiles = { ...prev };
            delete newFiles[lessonId];
            return newFiles;
        });
        return Promise.resolve();
    };

    const uploadFiles = async (files: File[], targetId: string, category?: string) => {
        const filePromises = files.map(file => {
            return new Promise<StoredFile>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const result = e.target?.result as string;
                    resolve({
                        id: Date.now().toString() + Math.random().toString(36).substring(7),
                        name: file.name,
                        type: file.type,
                        size: file.size,
                        url: result,
                        uploadDate: Date.now(),
                        category: category,
                    });
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        });

        const newStoredFiles = await Promise.all(filePromises);
        setStoredFiles(prev => ({
            ...prev,
            [targetId]: [...(prev[targetId] || []), ...newStoredFiles]
        }));
    };

    const deleteFile = async (fileId: string, targetId: string) => {
        setStoredFiles(prev => ({
            ...prev,
            [targetId]: prev[targetId]?.filter(f => f.id !== fileId) || []
        }));
        return Promise.resolve();
    };

    const activateSystem = async (key: string, sdt: string = "", grade?: number): Promise<boolean> => {
        const machineId = getMachineId();
        const expectedKey = generateActivationKey(machineId, sdt);
        if (key === expectedKey) {
            let phoneStr = String(sdt).trim();
            if (phoneStr.length === 9 && !phoneStr.startsWith('0')) phoneStr = '0' + phoneStr;

            let dbGrade = grade;

            try {
                const { data, error } = await supabase.from('students').select('is_active, grade').eq('phone', phoneStr).single();
                if (error || !data || !data.is_active) {
                    return false; // Student is kicked or doesn't exist
                }
                if (data.grade) dbGrade = data.grade;
            } catch (err) {
                // If offline or network error, fallback to local activation if key is correct
                console.warn("Supabase check failed during activation, falling back to local verification.");
            }

            localStorage.setItem(STORAGE_ACTIVATION_KEY, 'true');
            if (sdt) localStorage.setItem('pv_activated_sdt', sdt);
            if (dbGrade) localStorage.setItem(STORAGE_GRADE_KEY, dbGrade.toString());
            setIsActivated(true);
            return true;
        }
        return false;
    };

    // --- Telegram Cloud Sync: Fetch bài giảng theo grade ---
    const fetchLessonsFromGitHub = async (grade: number, onProgress?: (pct: number) => void): Promise<{ success: boolean; lessonCount: number; fileCount: number }> => {
        console.log(`[Fetch] Bắt đầu fetch Lớp ${grade}`);
        const t_fetch_total = performance.now();

        try {
            // Giai đoạn 1: Lấy file ID từ Supabase
            const t1 = performance.now();
            let indexFileId = localStorage.getItem(`pv_sync_file_id_${grade}`);
            try {
                const { data, error } = await supabase
                    .from('vault_index')
                    .select('telegram_file_id')
                    .eq('grade', grade)
                    .single();
                if (data && data.telegram_file_id) {
                    indexFileId = data.telegram_file_id;
                }
            } catch (e) {
                console.error("Lỗi lấy index từ Supabase", e);
            }
            console.log(`[Fetch] Giai đoạn 1 (Supabase): ${(performance.now() - t1).toFixed(0)}ms`);
            if (!indexFileId) throw new Error(`Hệ thống chưa có dữ liệu cho Lớp ${grade}. Thầy vui lòng Sync trước nhé!`);

            const fetchViaPublicProxy = fetchViaCloudflareProxy;

            // Giai đoạn 2: Tải file index từ Cloudflare
            const t2 = performance.now();
            const indexRaw = await fetchViaPublicProxy(indexFileId);
            console.log(`[Fetch] Giai đoạn 2 (Tải index từ CF): ${(performance.now() - t2).toFixed(0)}ms`);
            const indexStr = new TextDecoder().decode(indexRaw);
            const indexData = JSON.parse(xorDeobfuscate(indexStr));

            const currentLessons = await dbGet(STORAGE_LESSONS_KEY) || [];
            const currentFiles = await dbGet(STORAGE_FILES_KEY) || {};
            const newLessonsMap = new Map();
            currentLessons.forEach((l: Lesson) => newLessonsMap.set(l.id, l));
            const newFiles = { ...currentFiles };
            let totalLessonCount = 0;
            let totalFileCount = 0;

            // Helper: fetch 1 file JSON đơn lẻ từ Telegram qua Proxy
            const fetchOneFile = async (fileId: string) => {
                const buf = await fetchViaPublicProxy(fileId);
                const str = new TextDecoder().decode(buf);
                return JSON.parse(xorDeobfuscate(str));
            };

            // Helper: gộp dữ liệu từ 1 payload vào state
            const mergePayload = (data: any) => {
                if (!data) return;
                (data.lessons || []).forEach((l: Lesson) => newLessonsMap.set(l.id, l));
                Object.assign(newFiles, data.files || {});
                totalLessonCount += (data.lessons || []).length;
                totalFileCount += Object.values((data.files || {}) as FileStorage).flat().length;
            };

            // --- Lấy tất cả file IDs cần fetch ---
            let allIds: string[] = [];
            if (indexData.zipFileIds || indexData.zipFileId) {
                // Format V3: Offline Archive ZIP
                const zIds: string[] = indexData.zipFileIds || [indexData.zipFileId];
                if (onProgress) onProgress(10);

                const CONCURRENCY = 5;
                let downloadedParts = 0;

                const processZipPart = async (fileId: string): Promise<void> => {
                    const t_part = performance.now();
                    const arrayBuf = await fetchViaPublicProxy(fileId);
                    console.log(`[Fetch]   └ Tải ZIP part (${(arrayBuf.byteLength / 1024 / 1024).toFixed(2)} MB): ${(performance.now() - t_part).toFixed(0)}ms`);

                    const t_unzip = performance.now();
                    const zip = new JSZip();
                    const unzipped = await zip.loadAsync(arrayBuf);
                    console.log(`[Fetch]   └ Giải nén ZIP: ${(performance.now() - t_unzip).toFixed(0)}ms`);

                    const t_decode = performance.now();
                    const filePromises: Promise<void>[] = [];
                    unzipped.forEach((relativePath, fileObj) => {
                        if (!fileObj.dir) {
                            filePromises.push(
                                fileObj.async("string").then(content => {
                                    // Phát hiện format: JSON bắt đầu bằng '{' hoặc '['
                                    // XOR-encoded (base64) bắt đầu bằng ký tự khác
                                    // Tránh try/catch tốn kém — chỉ throw exception khi cần
                                    const firstChar = content.charCodeAt(0);
                                    const parsedData = (firstChar === 123 || firstChar === 91) // '{' = 123, '[' = 91
                                        ? JSON.parse(content)
                                        : JSON.parse(xorDeobfuscate(content));
                                    mergePayload(parsedData);
                                })
                            );
                        }
                    });
                    await Promise.all(filePromises);
                    console.log(`[Fetch]   └ Decode + merge: ${(performance.now() - t_decode).toFixed(0)}ms`);

                    downloadedParts++;
                    if (onProgress) onProgress(Math.floor(10 + (downloadedParts / zIds.length) * 80));
                };

                // Giai đoạn 3: Tải ZIP chunks
                const t3 = performance.now();
                console.log(`[Fetch] Giai đoạn 3: Bắt đầu tải ${zIds.length} ZIP chunk(s)`);
                try {
                    for (let i = 0; i < zIds.length; i += CONCURRENCY) {
                        const batch = zIds.slice(i, i + CONCURRENCY);
                        await Promise.all(batch.map(id => processZipPart(id)));
                    }
                } catch (err: any) {
                    console.error('Error fetching zip chunks:', err);
                    throw new Error(`Tải đoạn dữ liệu thất bại. Vui lòng thử tải lại.`);
                }
                console.log(`[Fetch] Giai đoạn 3 (Tải + giải nén ZIP): ${(performance.now() - t3).toFixed(0)}ms`);

                if (onProgress) onProgress(90);
            } else if (indexData.lessonFileIds) {
                // Format mới V2: flat array
                allIds = indexData.lessonFileIds as string[];
            } else if (indexData.chapterFileIds) {
                // Format cũ V1: { chId: fileId }
                allIds = Object.values(indexData.chapterFileIds as Record<string, string>);
            }

            // Fetch song song theo batch 8 để tránh rate-limit (chỉ cho cấu trúc V1, V2 cũ)
            if (allIds.length > 0) {
                const BATCH = 8;
                for (let i = 0; i < allIds.length; i += BATCH) {
                    const chunk = allIds.slice(i, i + BATCH);
                    const results = await Promise.all(chunk.map(fetchOneFile));
                    results.forEach(mergePayload);
                }
            }

            // Giai đoạn 4: Lưu vào IndexedDB
            const t4 = performance.now();
            const uniqueLessons = Array.from(newLessonsMap.values()) as Lesson[];
            await dbSet(STORAGE_LESSONS_KEY, uniqueLessons);
            await dbSet(STORAGE_FILES_KEY, newFiles);
            setLessons(uniqueLessons);
            setStoredFiles(newFiles);
            console.log(`[Fetch] Giai đoạn 4 (Lưu IndexedDB): ${(performance.now() - t4).toFixed(0)}ms`);
            console.log(`[Fetch] ✅ Tổng thời gian: ${((performance.now() - t_fetch_total) / 1000).toFixed(2)}s | ${totalLessonCount} bài, ${totalFileCount} file`);

            return { success: true, lessonCount: totalLessonCount, fileCount: totalFileCount };
        } catch (err: any) {
            throw new Error(`Sync thất bại: ${err.message}`);
        }
    };

    // --- Telegram Cloud Sync: Push lên Telegram (V3 — ZIP Archive) ---
    const syncToGitHub = async (grade: number, lessonsToSync: Lesson[], filesToSync: FileStorage): Promise<string> => {
        setSyncProgress(1);

        if (lessonsToSync.length === 0 && Object.keys(filesToSync).length === 0) {
            throw new Error('Này bro, chưa có bài giảng hay tài liệu nào để Sync đâu! Hãy thêm ít nhất 1 bài nhé.');
        }


        // Xác định file cấp chương (key không phải lessonId)
        const lessonIds = new Set(lessonsToSync.map(l => l.id));
        const fileOnlyChapterIds = Object.keys(filesToSync).filter(k => !lessonIds.has(k));

        // Tạo danh sách payloads: 1 payload/lesson (+ riêng cho file cấp chương)
        type PayloadEntry = { chapterId: string; lessons: Lesson[]; files: FileStorage };
        const payloads: PayloadEntry[] = [];

        for (const chId of fileOnlyChapterIds) {
            if (filesToSync[chId]?.length) {
                payloads.push({ chapterId: chId, lessons: [], files: { [chId]: filesToSync[chId] } });
            }
        }
        for (const lesson of lessonsToSync) {
            const lessonFiles: FileStorage = {};
            if (filesToSync[lesson.id]?.length) lessonFiles[lesson.id] = filesToSync[lesson.id];
            payloads.push({ chapterId: lesson.chapterId, lessons: [lesson], files: lessonFiles });
        }

        // Helper upload 1 blob lên Telegram với retry khi 429
        const uploadBlob = async (blob: Blob, fileName: string, onProgress?: (loaded: number) => void): Promise<string> => {
            const MAX_RETRIES = 5;
            for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
                const formData = new FormData();
                formData.append('chat_id', TELEGRAM_CHAT_ID);
                formData.append('document', blob, fileName);
                const result = await new Promise<{ ok: boolean; fileId?: string; retryAfter?: number; error?: string }>((resolve) => {
                    const xhr = new XMLHttpRequest();
                    xhr.open('POST', `https://physivault-proxy.hoaihuy2609.workers.dev/proxy/sendDocument`);
                    xhr.setRequestHeader('Authorization', 'Bearer PV_ADMIN_SECURE_KEY_2026');
                    xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded); };
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
                if (result.retryAfter) {
                    await new Promise(r => setTimeout(r, (result.retryAfter! + 1) * 1000));
                    continue;
                }
                throw new Error(result.error || 'Upload thất bại');
            }
            throw new Error('Quá 5 lần thử lại — Telegram đang bị giới hạn.');
        };

        // --- V3 Zip Archive Chunking ---
        // Mỗi payload chỉ XOR encode 1 lần (trước đây encode 2 lần = lãng phí CPU)
        const MAX_CHUNK_SIZE = 18 * 1024 * 1024;
        const zipChunks: JSZip[] = [];
        let currentZip = new JSZip();
        let currentChunkSize = 0;

        console.time('[Sync] Giai đoạn 1: XOR encode + pack ZIP');
        for (const p of payloads) {
            // XOR chỉ gọi 1 lần — dùng lại cho cả chunk size check và zip.file()
            const content = xorObfuscate(JSON.stringify({ ...p, syncedAt: Date.now() }));
            const fileName = `g${grade}_${p.chapterId}_${p.lessons[0]?.id || 'ch'}.json`;
            // Dùng content.length thay vì new Blob().size (nhanh hơn vì tránh tạo object)
            const contentBytes = content.length;

            if (currentChunkSize > 0 && currentChunkSize + contentBytes > MAX_CHUNK_SIZE) {
                zipChunks.push(currentZip);
                currentZip = new JSZip();
                currentChunkSize = 0;
            }

            currentZip.file(fileName, content);
            currentChunkSize += contentBytes;
        }
        if (currentChunkSize > 0) {
            zipChunks.push(currentZip);
        }
        console.timeEnd('[Sync] Giai đoạn 1: XOR encode + pack ZIP');
        console.log(`[Sync] Số chunk ZIP: ${zipChunks.length}`);

        const zipBlobs: Blob[] = [];
        // 1. Phân bổ 0% -> 20% cho việc generate ZIP blob
        console.time('[Sync] Giai đoạn 2: generateAsync ZIP');
        for (let i = 0; i < zipChunks.length; i++) {
            const z = zipChunks[i];
            const zipBlob = await z.generateAsync({ type: 'blob', compression: "STORE" }, (meta) => {
                // meta.percent từ JSZip là 0–100, chia 100 để normalize về 0–1 trước khi nhân
                const globalPercent = Math.floor((i + meta.percent / 100) * (20 / zipChunks.length));
                setSyncProgress(globalPercent);
            });
            console.log(`[Sync] ZIP part ${i + 1}: ${(zipBlob.size / 1024 / 1024).toFixed(2)} MB`);
            zipBlobs.push(zipBlob);
        }
        console.timeEnd('[Sync] Giai đoạn 2: generateAsync ZIP');

        // 2. Phân bổ 20% -> 95%: Upload SONG SONG tất cả các phần ZIP
        const totalZipSize = zipBlobs.reduce((acc, curr) => acc + curr.size, 0);
        // Track bytes đã upload của từng part riêng lẻ
        const uploadedPerPart: number[] = new Array(zipBlobs.length).fill(0);

        console.time('[Sync] Giai đoạn 3: Upload ZIP lên Telegram');
        console.log(`[Sync] Tổng kích thước upload: ${(totalZipSize / 1024 / 1024).toFixed(2)} MB`);
        const uploadResults = await Promise.all(
            zipBlobs.map((zipBlob, i) =>
                uploadBlob(zipBlob, `vault_g${grade}_v3_part${i + 1}.zip`, (loaded) => {
                    uploadedPerPart[i] = loaded;
                    const totalLoaded = uploadedPerPart.reduce((a, b) => a + b, 0);
                    const globalPercent = 20 + Math.floor((totalLoaded / totalZipSize) * 75);
                    setSyncProgress(Math.min(globalPercent, 95));
                })
            )
        );
        console.timeEnd('[Sync] Giai đoạn 3: Upload ZIP lên Telegram');
        const finalZipFileIds: string[] = uploadResults;

        // Gửi file Index V3
        console.time('[Sync] Giai đoạn 4: Upload index + Supabase');
        setSyncProgress(95);
        const indexPayload = { grade, zipFileIds: finalZipFileIds, totalLessons: lessonsToSync.length, updatedAt: Date.now() };
        const indexBlob = new Blob([xorObfuscate(JSON.stringify(indexPayload))], { type: 'application/json' });
        const indexForm = new FormData();
        indexForm.append('chat_id', TELEGRAM_CHAT_ID);
        indexForm.append('document', indexBlob, `index_grade${grade}_v3.json`);
        indexForm.append('caption', `[INDEX-V3-ZIP] Lớp ${grade} | ${finalZipFileIds.length} phần`);

        const indexRes = await fetch(`https://physivault-proxy.hoaihuy2609.workers.dev/proxy/sendDocument`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer PV_ADMIN_SECURE_KEY_2026' },
            body: indexForm
        });
        if (!indexRes.ok) { setSyncProgress(0); throw new Error(`Lỗi upload Index: ${indexRes.statusText}`); }

        const finalFileId = (await indexRes.json()).result.document.file_id;

        // Lưu vào Supabase
        const { error: sbError } = await supabase
            .from('vault_index')
            .upsert({ grade, telegram_file_id: finalFileId, updated_at: Date.now() }, { onConflict: 'grade' });

        if (sbError) throw new Error("Supabase từ chối lưu: " + sbError.message);
        console.timeEnd('[Sync] Giai đoạn 4: Upload index + Supabase');

        localStorage.setItem(`pv_sync_file_id_${grade}`, finalFileId);
        setSyncProgress(100);
        setTimeout(() => setSyncProgress(0), 1000);

        // Warm cache cho học sinh: tải sẵn các ZIP qua Cloudflare để cache ngay
        // Chạy nền, không block return
        (async () => {
            try {
                console.log('[Sync] 🔥 Warming Cloudflare cache cho học sinh...');
                // Prime cache cho index + từng zip chunk song song
                await Promise.all([
                    fetch(`${CLOUDFLARE_PROXY_URL}/getFile/${finalFileId}`).catch(() => null),
                    ...finalZipFileIds.map(id =>
                        fetch(`${CLOUDFLARE_PROXY_URL}/getFile/${id}`).catch(() => null)
                    )
                ]);
                console.log('[Sync] ✅ Cache warming xong — học sinh fetch lần đầu sẽ nhanh hơn!');
            } catch { /* nếu fail cũng không sao */ }
        })();

        // ── Auto-tạo Thông Báo sau Sync thành công ──
        try {
            const gradeLabel = grade === 12 ? 'Lớp 12' : grade === 11 ? 'Lớp 11' : 'Lớp 10';
            await supabase.from('notifications').insert({
                message: `Thầy vừa cập nhật tài liệu mới cho ${gradeLabel}! Hãy bấm nút bên dưới để tải về ngay nhé.`,
                grade,
                fetch_enabled: true,
            });
        } catch (notifErr) {
            console.error('[Notification] Không tạo được thông báo:', notifErr);
        }

        return finalFileId;
    };
    const verifyAccess = async (): Promise<'ok' | 'kicked' | 'offline_expired'> => {
        const sdt = localStorage.getItem('pv_activated_sdt');
        const isCurrentlyActivated = localStorage.getItem(STORAGE_ACTIVATION_KEY) === 'true';

        if (!isCurrentlyActivated || !sdt) return 'ok';

        const machineId = getMachineId();
        try {
            let phoneStr = String(sdt).trim();
            if (phoneStr.length === 9 && !phoneStr.startsWith('0')) phoneStr = '0' + phoneStr;

            const { data, error } = await supabase
                .from('students')
                .select('is_active, machine_id')
                .eq('phone', phoneStr)
                .single();

            if (error || !data || !data.is_active || data.machine_id !== machineId) {
                localStorage.removeItem(STORAGE_ACTIVATION_KEY);
                setIsActivated(false);
                return 'kicked';
            }
            localStorage.setItem('pv_last_check', Date.now().toString());
            return 'ok';
        } catch (e) {
            const lastCheck = localStorage.getItem('pv_last_check');
            if (!lastCheck) return 'offline_expired';
            const elapsed = Date.now() - parseInt(lastCheck);
            return elapsed > 24 * 60 * 60 * 1000 ? 'offline_expired' : 'ok';
        }
    };

    // ── Exam Functions ─────────────────────────────────────────

    // Upload PDF lên Telegram, trả về file_id
    const uploadExamPdf = async (file: File, onProgress?: (pct: number) => void): Promise<{ fileId: string; fileName: string }> => {
        const formData = new FormData();
        formData.append('chat_id', TELEGRAM_CHAT_ID);
        formData.append('document', file, file.name);
        formData.append('caption', `[EXAM-PDF] ${file.name}`);

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', `https://physivault-proxy.hoaihuy2609.workers.dev/proxy/sendDocument`);
            xhr.setRequestHeader('Authorization', 'Bearer PV_ADMIN_SECURE_KEY_2026');
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

    // Lưu danh sách đề thi lên Telegram + ghi file_id vào Supabase
    const saveExam = async (exams: Exam[]): Promise<void> => {
        const content = xorObfuscate(JSON.stringify({ exams, savedAt: Date.now() }));
        const blob = new Blob([content], { type: 'application/json' });

        const formData = new FormData();
        formData.append('chat_id', TELEGRAM_CHAT_ID);
        formData.append('document', blob, 'exam_index.json');
        formData.append('caption', `[EXAM-INDEX] ${exams.length} đề thi`);

        const res = await fetch(`https://physivault-proxy.hoaihuy2609.workers.dev/proxy/sendDocument`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer PV_ADMIN_SECURE_KEY_2026' },
            body: formData
        });
        if (!res.ok) throw new Error('Upload exam index thất bại');
        const data = await res.json();
        const fileId = data.result.document.file_id;

        // Ghi file_id vào Supabase
        const { error: sbError } = await supabase
            .from('vault_index')
            .upsert({ grade: 0, telegram_file_id: fileId, updated_at: Date.now() }, { onConflict: 'grade' });
        if (sbError) throw new Error('Không thể ghi địa chỉ exam lên Supabase');

        localStorage.setItem('pv_exam_index_file_id', fileId);

        // Lưu local IndexedDB
        await dbSet('physivault_exams', exams);
    };

    // Tải danh sách đề thi từ Telegram
    const loadExams = async (): Promise<Exam[]> => {
        // 1. Ưu tiên dùng cache local
        const cached = await dbGet('physivault_exams');

        // 2. Lấy file_id mới nhất từ Supabase
        try {
            const { data, error } = await supabase
                .from('vault_index')
                .select('telegram_file_id')
                .eq('grade', 0)
                .single();

            const fileId = data?.telegram_file_id || localStorage.getItem('pv_exam_index_file_id');
            const savedFileId = localStorage.getItem('pv_exam_index_file_id');

            if (!fileId) return cached || [];

            // Nếu dữ liệu local đã MỚI NHẤT -> Không cần cất công tải lại từ Proxy
            if (fileId === savedFileId && cached && cached.length > 0) {
                return cached;
            }

            // Tải file index exam qua Cloudflare Proxy
            const arrayBuf = await fetchViaCloudflareProxy(fileId).catch(() => null);

            if (!arrayBuf) return cached || [];
            const indexStr = new TextDecoder().decode(arrayBuf);

            const parsed = JSON.parse(xorDeobfuscate(indexStr));
            const exams: Exam[] = parsed.exams || [];
            await dbSet('physivault_exams', exams);
            localStorage.setItem('pv_exam_index_file_id', fileId); // Update local track state
            return exams;
        } catch {
            return cached || [];
        }
    };

    // Xóa 1 đề thi (cập nhật lại list)
    const deleteExam = async (examId: string, allExams: Exam[]): Promise<void> => {
        const updated = allExams.filter(e => e.id !== examId);
        await saveExam(updated);
    };

    // Lưu kết quả bài thi
    const saveExamResult = async (
        exam: Exam,
        score: number,
        totalQuestions: number,
        correctAnswers: number
    ): Promise<void> => {
        const sdtStr = localStorage.getItem('pv_activated_sdt');
        if (!sdtStr) return; // Không lưu nếu không có SĐT
        let normalizedPhone = sdtStr.trim();
        if (normalizedPhone.length === 9 && !normalizedPhone.startsWith('0')) {
            normalizedPhone = '0' + normalizedPhone;
        }

        // Lấy tên và lớp học sinh
        let studentName = 'Học sinh';
        let grade = exam.grade;
        try {
            const { data } = await supabase
                .from('students')
                .select('name, grade')
                .eq('phone', normalizedPhone)
                .single();
            if (data?.name) studentName = data.name;
            if (data?.grade) grade = data.grade;
        } catch (e) {
            console.error('Không lấy được thông tin học sinh', e);
        }

        try {
            const { error } = await supabase.from('exam_results').insert({
                student_phone: normalizedPhone,
                student_name: studentName,
                exam_id: exam.id,
                exam_title: exam.title,
                score,
                total_questions: totalQuestions,
                correct_answers: correctAnswers,
                submitted_at: new Date().toISOString(),
                grade: grade
            });
            if (error) {
                console.error('Lỗi Insert Supabase:', error);
            }
        } catch (e) {
            console.error('Lỗi khi lưu kết quả bài thi:', e);
        }
    };

    // Lấy lịch sử làm bài (nếu phone trống -> lấy tất cả cho Admin)
    const getExamHistory = async (phoneFilter?: string) => {
        try {
            let query = supabase.from('exam_results').select('*').order('submitted_at', { ascending: false });
            if (phoneFilter) {
                query = query.eq('student_phone', phoneFilter);
            }
            const { data, error } = await query;
            if (error) throw error;
            return data;
        } catch (e) {
            console.error('Lỗi khi lấy lịch sử làm bài:', e);
            return [];
        }
    };

    // Lấy bảng xếp hạng tổng hợp theo khối (trung bình điểm, tối thiểu MIN_EXAMS bài)
    const getLeaderboard = async (minExams: number = 1): Promise<{ name: string; phone: string; avgScore: number; examCount: number; recentScores: number[]; bestScore: number }[][]> => {
        try {
            const { data, error } = await supabase
                .from('exam_results')
                .select('student_phone, student_name, score, grade, submitted_at')
                .order('submitted_at', { ascending: true });
            if (error) throw error;
            if (!data || data.length === 0) return [[], [], []];

            // Nhóm theo (grade, phone), giữ thứ tự thời gian
            const map: Record<string, { name: string; phone: string; grade: number; scores: number[] }> = {};
            for (const r of data) {
                const key = `${r.grade}__${r.student_phone}`;
                if (!map[key]) map[key] = { name: r.student_name || 'Ẩn danh', phone: r.student_phone, grade: r.grade, scores: [] };
                map[key].scores.push(r.score);
            }

            const byGrade: Record<number, { name: string; phone: string; avgScore: number; examCount: number; recentScores: number[]; bestScore: number }[]> = { 10: [], 11: [], 12: [] };
            for (const entry of Object.values(map)) {
                if (entry.scores.length < minExams) continue;
                const avg = entry.scores.reduce((a, b) => a + b, 0) / entry.scores.length;
                const best = Math.max(...entry.scores);
                const recent = entry.scores.slice(-6); // lấy 6 bài gần nhất cho sparkline
                if (byGrade[entry.grade]) {
                    byGrade[entry.grade].push({ name: entry.name, phone: entry.phone, avgScore: avg, examCount: entry.scores.length, recentScores: recent, bestScore: best });
                }
            }

            // Sort desc và lấy top 5 mỗi khối
            const top = (arr: typeof byGrade[10]) => arr.sort((a, b) => b.avgScore - a.avgScore).slice(0, 5);
            return [top(byGrade[10]), top(byGrade[11]), top(byGrade[12])];
        } catch (e) {
            console.error('Lỗi khi lấy leaderboard:', e);
            return [[], [], []];
        }
    };

    // ── Study Planner Functions ──────────────────────────────────
    const getStudyPlans = async () => {
        const sdtStr = localStorage.getItem('pv_activated_sdt');
        if (!sdtStr) return [];
        let normalizedPhone = sdtStr.trim();
        if (normalizedPhone.length === 9 && !normalizedPhone.startsWith('0')) {
            normalizedPhone = '0' + normalizedPhone;
        }

        try {
            const { data, error } = await supabase
                .from('study_plans')
                .select('*')
                .eq('student_phone', normalizedPhone)
                .order('due_date', { ascending: true });
            if (error) throw error;
            return data as StudyPlanItem[];
        } catch (e) {
            console.error('Lỗi tải kế hoạch:', e);
            return [];
        }
    };

    const saveStudyPlan = async (taskName: string, dueDate: string, color: string = '#6B7CDB') => {
        const sdtStr = localStorage.getItem('pv_activated_sdt');
        if (!sdtStr) return null;
        let normalizedPhone = sdtStr.trim();
        if (normalizedPhone.length === 9 && !normalizedPhone.startsWith('0')) {
            normalizedPhone = '0' + normalizedPhone;
        }

        try {
            const { data, error } = await supabase.from('study_plans').insert({
                student_phone: normalizedPhone,
                task_name: taskName,
                due_date: dueDate,
                color: color
            }).select().single();

            if (error) throw error;
            return data as StudyPlanItem;
        } catch (e) {
            console.error('Lỗi tạo kế hoạch:', e);
            return null;
        }
    };

    const updateStudyPlan = async (id: string, updates: Partial<StudyPlanItem>) => {
        try {
            const { error } = await supabase.from('study_plans').update(updates).eq('id', id);
            if (error) throw error;
            return true;
        } catch (e) {
            console.error('Lỗi cập nhật kế hoạch:', e);
            return false;
        }
    };

    const deleteStudyPlan = async (id: string) => {
        try {
            const { error } = await supabase.from('study_plans').delete().eq('id', id);
            if (error) throw error;
            return true;
        } catch (e) {
            console.error('Lỗi xóa kế hoạch:', e);
            return false;
        }
    };

    // ── Schedule Functions ──────────────────────────────────
    const getSchedules = async (grade: number) => {
        try {
            const { data, error } = await supabase
                .from('schedules')
                .select('*')
                .eq('grade', grade)
                .order('date', { ascending: true })
                .order('start_time', { ascending: true });
            if (error) throw error;
            return data as ScheduleItem[];
        } catch (e) {
            console.error('Lỗi tải thời khóa biểu từ Supabase, fall back local:', e);
            const localSchedules = localStorage.getItem(`pv_schedules_${grade}`);
            return localSchedules ? JSON.parse(localSchedules) : [];
        }
    };

    const saveSchedule = async (schedule: Omit<ScheduleItem, 'id' | 'created_at'>) => {
        try {
            const { data, error } = await supabase.from('schedules').insert([schedule]).select().single();
            if (error) throw error;
            return data as ScheduleItem;
        } catch (e) {
            console.error('Lỗi tạo lịch học:', e);
            // Fallback local limit
            const newSchedule = { id: crypto.randomUUID ? crypto.randomUUID() : `sch_${Date.now()}`, ...schedule, created_at: new Date().toISOString() };
            const local = JSON.parse(localStorage.getItem(`pv_schedules_${schedule.grade}`) || '[]');
            localStorage.setItem(`pv_schedules_${schedule.grade}`, JSON.stringify([...local, newSchedule]));
            return newSchedule as ScheduleItem;
        }
    };

    const updateSchedule = async (id: string, updates: Partial<ScheduleItem>, grade: number) => {
        try {
            const { error } = await supabase.from('schedules').update(updates).eq('id', id);
            if (error) throw error;
            return true;
        } catch (e) {
            console.error('Lỗi cập nhật lịch học:', e);
            const local = JSON.parse(localStorage.getItem(`pv_schedules_${grade}`) || '[]');
            const idx = local.findIndex((s: ScheduleItem) => s.id === id);
            if (idx !== -1) {
                local[idx] = { ...local[idx], ...updates };
                localStorage.setItem(`pv_schedules_${grade}`, JSON.stringify(local));
            }
            return true;
        }
    };

    const deleteSchedule = async (id: string, grade: number) => {
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

    // ── Notification Functions ────────────────────────────────

    // Lấy danh sách thông báo theo lớp của học sinh
    const getNotifications = async (grade: number): Promise<NotificationItem[]> => {
        try {
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('grade', grade)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return (data || []) as NotificationItem[];
        } catch (e) {
            console.error('Lỗi tải thông báo:', e);
            return [];
        }
    };

    // Đánh dấu học sinh này đã fetch thông báo
    const markNotificationFetched = async (notificationId: string): Promise<boolean> => {
        const sdtStr = localStorage.getItem('pv_activated_sdt');
        if (!sdtStr) return false;
        let normalizedPhone = sdtStr.trim();
        if (normalizedPhone.length === 9 && !normalizedPhone.startsWith('0')) {
            normalizedPhone = '0' + normalizedPhone;
        }
        try {
            const { error } = await supabase.from('notification_fetches').insert({
                notification_id: notificationId,
                student_phone: normalizedPhone,
            });
            if (error) throw error;
            return true;
        } catch (e) {
            console.error('Lỗi đánh dấu fetch:', e);
            return false;
        }
    };

    // Xóa thông báo (Dành cho Admin)
    const deleteNotification = async (notificationId: string): Promise<boolean> => {
        try {
            const { error } = await supabase.from('notifications').delete().eq('id', notificationId);
            if (error) throw error;
            return true;
        } catch (e) {
            console.error('Lỗi xóa thông báo:', e);
            return false;
        }
    };

    // Tạo thông báo tùy ý (Dành cho Admin — không liên quan sync tài liệu)
    const createCustomNotification = async (message: string, grade: number): Promise<boolean> => {
        try {
            const { error } = await supabase.from('notifications').insert({
                message,
                grade,
                fetch_enabled: false, // Thông báo chung, không cần nút "Lấy bài về"
            });
            if (error) throw error;
            return true;
        } catch (e) {
            console.error('Lỗi tạo thông báo:', e);
            return false;
        }
    };

    // Kiểm tra học sinh này đã fetch thông báo nào rồi (trả về Set các notification_id đã fetch)
    const getFetchedNotificationIds = async (): Promise<Set<string>> => {
        const sdtStr = localStorage.getItem('pv_activated_sdt');
        if (!sdtStr) return new Set();
        let normalizedPhone = sdtStr.trim();
        if (normalizedPhone.length === 9 && !normalizedPhone.startsWith('0')) {
            normalizedPhone = '0' + normalizedPhone;
        }
        try {
            const { data, error } = await supabase
                .from('notification_fetches')
                .select('notification_id')
                .eq('student_phone', normalizedPhone);
            if (error) throw error;
            return new Set((data || []).map((r: any) => r.notification_id));
        } catch (e) {
            console.error('Lỗi tải danh sách đã fetch:', e);
            return new Set();
        }
    };

    // ── Voting Functions ──────────────────────────────────────

    const submitQuestionVote = async (examId: string, partName: string, questionNumber: number) => {
        const sdtStr = localStorage.getItem('pv_activated_sdt');
        if (!sdtStr) return { success: false, error: 'Chưa kích hoạt' };
        let normalizedPhone = sdtStr.trim();
        if (normalizedPhone.length === 9 && !normalizedPhone.startsWith('0')) {
            normalizedPhone = '0' + normalizedPhone;
        }

        try {
            // Kiểm tra xem user này đã vote cho đề này bao nhiêu lần rồi (limit 3 lần)
            const { data: existingVotes, error: countError } = await supabase
                .from('question_votes')
                .select('id, part_name, question_number')
                .eq('exam_id', examId)
                .eq('student_phone', normalizedPhone);

            if (countError) throw countError;

            if (existingVotes && existingVotes.length >= 3) {
                return { success: false, error: 'Bạn đã hết 3 lượt vote cho đề này.' };
            }

            // Kiểm tra trùng
            const alreadyVoted = existingVotes?.find(v => v.part_name === partName && v.question_number === questionNumber);
            if (alreadyVoted) {
                return { success: false, error: 'Bạn đã vote cho câu này rồi.' };
            }

            const { error } = await supabase.from('question_votes').insert({
                exam_id: examId,
                student_phone: normalizedPhone,
                part_name: partName,
                question_number: questionNumber
            });

            if (error) {
                if (error.code === '23505') { // unique violation
                    return { success: false, error: 'Bạn đã vote cho câu này rồi.' };
                }
                throw error;
            }

            return { success: true };
        } catch (e: any) {
            console.error('Lỗi khi submit vote:', e);
            return { success: false, error: e.message || 'Lỗi hệ thống' };
        }
    };

    const getQuestionVotes = async (examId: string) => {
        try {
            const { data, error } = await supabase
                .from('question_votes')
                .select('part_name, question_number, student_phone')
                .eq('exam_id', examId);
            if (error) throw error;
            return data || [];
        } catch (e) {
            console.error('Lỗi lấy dữ liệu vote:', e);
            return [];
        }
    };

    // ── Blog (Góc Học Tập) — Telegram-based (không dùng Supabase DB) ────────────

    const BLOG_LOCAL_KEY = 'physivault_blogs_local';
    const BLOG_UPLOAD_AUTH = 'Bearer PV_ADMIN_SECURE_KEY_2026';

    /** Lấy danh sách blog từ Telegram (học sinh fetch) hoặc IndexedDB cache */
    const getBlogs = async (isAdmin: boolean): Promise<BlogPost[]> => {
        try {
            // Admin luôn đọc từ IndexedDB local (source of truth cho việc chỉnh sửa)
            // Học sinh mới fetch từ Telegram để lấy bản mới nhất đã sync
            if (isAdmin) {
                const local: BlogPost[] = await dbGet(BLOG_LOCAL_KEY) || [];
                // Nếu local có data → dùng luôn
                if (local.length > 0) {
                    console.log(`[Blog] Admin: đọc ${local.length} bài từ local IndexedDB`);
                    return local;
                }
                // Nếu local trống → thử kéo từ Telegram về để có dữ liệu ban đầu
                console.log('[Blog] Admin: local trống, thử kéo từ Telegram...');
            }

            // Bước 1: Lấy file_id từ Supabase (chỉ lưu 1 row nhỏ)
            const { data: indexRow } = await supabase
                .from('blog_index')
                .select('telegram_file_id')
                .order('updated_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (!indexRow?.telegram_file_id) {
                // Chưa có blog nào được sync lên → fallback local
                const local: BlogPost[] = await dbGet(BLOG_LOCAL_KEY) || [];
                return isAdmin ? local : local.filter(b => b.is_published);
            }

            // Bước 2: Tải JSON file từ Telegram qua Cloudflare
            const t0 = performance.now();
            const arrayBuf = await fetchViaCloudflareProxy(indexRow.telegram_file_id);
            console.log(`[Blog] Tải file từ Telegram: ${(performance.now() - t0).toFixed(0)}ms`);

            const str = new TextDecoder().decode(arrayBuf);
            const firstChar = str.charCodeAt(0);
            const blogs: BlogPost[] = (firstChar === 91 || firstChar === 123)
                ? JSON.parse(str)
                : JSON.parse(xorDeobfuscate(str));

            // Cache vào IndexedDB
            await dbSet(BLOG_LOCAL_KEY, blogs);

            return isAdmin ? blogs : blogs.filter(b => b.is_published);
        } catch (e) {
            console.warn('[Blog] Fetch thất bại, dùng cache local:', e);
            const local: BlogPost[] = await dbGet(BLOG_LOCAL_KEY) || [];
            return isAdmin ? local : local.filter(b => b.is_published);
        }
    };

    /** [ADMIN] Lưu blog vào IndexedDB local (chưa sync lên Telegram) */
    const saveBlog = async (blog: Partial<BlogPost>): Promise<BlogPost | null> => {
        try {
            const localBlogs: BlogPost[] = await dbGet(BLOG_LOCAL_KEY) || [];
            let saved: BlogPost;

            if (blog.id) {
                // Cập nhật bài có sẵn
                const idx = localBlogs.findIndex(b => b.id === blog.id);
                if (idx !== -1) {
                    saved = { ...localBlogs[idx], ...blog, updated_at: new Date().toISOString() };
                    localBlogs[idx] = saved;
                } else {
                    return null;
                }
            } else {
                // Tạo bài mới
                saved = {
                    id: crypto.randomUUID ? crypto.randomUUID() : `blog_${Date.now()}`,
                    title: blog.title || '',
                    summary: blog.summary || '',
                    content: blog.content || '',
                    cover_image: blog.cover_image || '',
                    category: blog.category || '',
                    tags: blog.tags || [],
                    is_published: blog.is_published || false,
                    grade: blog.grade ?? 0, // Đảm bảo grade luôn được lưu
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                };
                localBlogs.unshift(saved);
            }

            await dbSet(BLOG_LOCAL_KEY, localBlogs);
            console.log(`[Blog] Đã lưu local: "${saved.title}" — Nhớ bấm Sync Blog để cập nhật!`);
            return saved;
        } catch (e) {
            console.error('[Blog] Lỗi saveBlog:', e);
            return null;
        }
    };

    /** [ADMIN] Xóa blog khỏi IndexedDB local */
    const deleteBlog = async (id: string): Promise<boolean> => {
        try {
            let localBlogs: BlogPost[] = await dbGet(BLOG_LOCAL_KEY) || [];
            localBlogs = localBlogs.filter(b => b.id !== id);
            await dbSet(BLOG_LOCAL_KEY, localBlogs);
            console.log(`[Blog] Đã xóa local ID=${id} — Nhớ bấm Sync Blog!`);
            return true;
        } catch (e) {
            console.error('[Blog] Lỗi deleteBlog:', e);
            return false;
        }
    };

    /** [ADMIN] Sync tất cả blog local lên Telegram */
    const syncBlogs = async (onProgress?: (pct: number) => void): Promise<{ success: boolean; fileId?: string; blogCount: number }> => {
        try {
            if (onProgress) onProgress(5);
            const localBlogs: BlogPost[] = await dbGet(BLOG_LOCAL_KEY) || [];
            console.log(`[Blog Sync] Bắt đầu sync ${localBlogs.length} bài viết`);

            // Serialize + XOR encode
            const t1 = performance.now();
            const jsonStr = xorObfuscate(JSON.stringify(localBlogs));
            console.log(`[Blog Sync] XOR encode: ${(performance.now() - t1).toFixed(0)}ms | ${(jsonStr.length / 1024).toFixed(1)} KB`);
            if (onProgress) onProgress(20);

            // Upload lên Telegram qua Cloudflare
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const formData = new FormData();
            formData.append('chat_id', TELEGRAM_CHAT_ID);
            formData.append('document', blob, `blog_vault_v1.json`);
            formData.append('caption', `[BLOG-V1] ${localBlogs.length} bài viết | ${new Date().toLocaleString('vi-VN')}`);

            const t2 = performance.now();
            const uploadRes = await fetch(
                `${CLOUDFLARE_PROXY_URL}/proxy/sendDocument`,
                { method: 'POST', headers: { 'Authorization': BLOG_UPLOAD_AUTH }, body: formData }
            );
            if (!uploadRes.ok) throw new Error(`Upload thất bại: ${uploadRes.statusText}`);
            const uploadData = await uploadRes.json();
            const newFileId: string = uploadData.result.document.file_id;
            console.log(`[Blog Sync] Upload xong: ${(performance.now() - t2).toFixed(0)}ms | file_id: ${newFileId}`);
            if (onProgress) onProgress(80);

            // Cập nhật file_id vào Supabase blog_index (chỉ lưu 1 row nhỏ metadata)
            const { error: upsertErr } = await supabase
                .from('blog_index')
                .upsert({
                    id: 1, // always row 1
                    telegram_file_id: newFileId,
                    blog_count: localBlogs.length,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'id' });
            if (upsertErr) throw upsertErr;
            if (onProgress) onProgress(95);

            // Warm CF cache
            try {
                fetchViaCloudflareProxy(newFileId).catch(() => { });
            } catch { /* ignore */ }

            if (onProgress) onProgress(100);
            console.log(`[Blog Sync] ✅ Hoàn thành! ${localBlogs.length} bài viết đã được sync.`);
            return { success: true, fileId: newFileId, blogCount: localBlogs.length };
        } catch (e: any) {
            console.error('[Blog Sync] ❌ Lỗi:', e);
            return { success: false, blogCount: 0 };
        }
    };

    /** [ADMIN] Load blogs từ Telegram về local (trước khi chỉnh sửa) */
    const fetchBlogsForEditing = async (): Promise<{ blogs: BlogPost[]; loaded: boolean }> => {
        try {
            const { data: indexRow } = await supabase
                .from('blog_index')
                .select('telegram_file_id, blog_count, updated_at')
                .order('updated_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (!indexRow?.telegram_file_id) {
                const local: BlogPost[] = await dbGet(BLOG_LOCAL_KEY) || [];
                return { blogs: local, loaded: false };
            }

            const arrayBuf = await fetchViaCloudflareProxy(indexRow.telegram_file_id);
            const str = new TextDecoder().decode(arrayBuf);
            const firstChar = str.charCodeAt(0);
            const blogs: BlogPost[] = (firstChar === 91 || firstChar === 123)
                ? JSON.parse(str)
                : JSON.parse(xorDeobfuscate(str));

            await dbSet(BLOG_LOCAL_KEY, blogs);
            console.log(`[Blog] Đã tải ${blogs.length} bài viết từ Telegram về local.`);
            return { blogs, loaded: true };
        } catch (e) {
            console.warn('[Blog] fetchBlogsForEditing thất bại, dùng local:', e);
            const local: BlogPost[] = await dbGet(BLOG_LOCAL_KEY) || [];
            return { blogs: local, loaded: false };
        }
    };

    return {
        lessons,
        storedFiles,
        loading,
        isActivated,
        addLesson,
        deleteLesson,
        uploadFiles,
        deleteFile,
        activateSystem,
        verifyAccess,
        fetchLessonsFromGitHub,
        syncToGitHub,
        syncProgress,
        uploadExamPdf,
        saveExam,
        loadExams,
        deleteExam,
        saveExamResult,
        getExamHistory,
        getLeaderboard,
        getStudyPlans,
        saveStudyPlan,
        updateStudyPlan,
        deleteStudyPlan,
        getSchedules,
        saveSchedule,
        updateSchedule,
        deleteSchedule,
        getNotifications,
        deleteNotification,
        createCustomNotification,
        markNotificationFetched,
        getFetchedNotificationIds,
        submitQuestionVote,
        getQuestionVotes,
        // Blog — Telegram-based
        getBlogs,
        saveBlog,
        deleteBlog,
        syncBlogs,
        fetchBlogsForEditing,
    };
};


// --- Export / Import Helpers ---

export const exportData = (lessons: Lesson[], files: FileStorage) => {
    const rawData: ExportData = {
        version: 1.1,
        exportedAt: Date.now(),
        lessons,
        files
    };

    const finalContent = JSON.stringify(rawData);
    const blob = new Blob([finalContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `physivault_data_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

export const importData = async (file: File) => {
    return new Promise<void>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                let content = e.target?.result as string;
                let data: ExportData = JSON.parse(content);
                if (!data.lessons || !data.files) throw new Error("INVALID_FORMAT");

                const currentLessons = await dbGet(STORAGE_LESSONS_KEY) || [];
                const currentFiles = await dbGet(STORAGE_FILES_KEY) || {};

                const lessonMap = new Map();
                currentLessons.forEach((l: Lesson) => lessonMap.set(l.id, l));
                data.lessons.forEach((l: Lesson) => lessonMap.set(l.id, l));
                const uniqueLessons = Array.from(lessonMap.values());
                const mergedFiles = { ...currentFiles, ...data.files };

                await dbSet(STORAGE_LESSONS_KEY, uniqueLessons);
                await dbSet(STORAGE_FILES_KEY, mergedFiles);
                resolve();
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(new Error("READ_ERROR"));
        reader.readAsText(file);
    });
};
