import { supabase } from '../lib/supabase';

import { useState, useEffect } from 'react';
import JSZip from 'jszip';
import CryptoJS from 'crypto-js';
import { Lesson, StoredFile, FileStorage, Exam } from '../../types';

// Storage Keys
const STORAGE_FILES_KEY = 'physivault_files';
const STORAGE_LESSONS_KEY = 'physivault_lessons';
const STORAGE_ACTIVATION_KEY = 'physivault_activated';
const STORAGE_GRADE_KEY = 'physivault_grade';
const DB_NAME = 'PhysiVaultDB';
const DB_VERSION = 1;
const STORE_NAME = 'app_data';

const TELEGRAM_TOKEN = '7985901918:AAFK33yVAEPPKiAbiaMFCdz78TpOhBXeRr0';
const TELEGRAM_CHAT_ID = '-1003889339240';

// --- Security Salts ---
const SYSTEM_SALT = "PHV_SECURITY_2026_BY_HUY";

// --- XOR Obfuscation for content ---
const XOR_KEY = 'PHV2026';

export const xorObfuscate = (data: string): string => {
    // Encode UTF-8 string → bytes để tránh lỗi với ký tự tiếng Việt
    const encoder = new TextEncoder();
    const bytes = encoder.encode(data);
    const keyBytes = encoder.encode(XOR_KEY);
    const result = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
        result[i] = bytes[i] ^ keyBytes[i % keyBytes.length];
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
        const encoder = new TextEncoder();
        const keyBytes = encoder.encode(XOR_KEY);
        // base64 → bytes
        const binaryStr = atob(encoded);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
        }
        // XOR ngược lại
        const result = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) {
            result[i] = bytes[i] ^ keyBytes[i % keyBytes.length];
        }
        // Decode bytes → UTF-8 string
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

            try {
                const { data, error } = await supabase.from('students').select('is_active').eq('phone', phoneStr).single();
                if (error || !data || !data.is_active) {
                    return false; // Student is kicked or doesn't exist
                }
            } catch (err) {
                // If offline or network error, fallback to local activation if key is correct
                console.warn("Supabase check failed during activation, falling back to local verification.");
            }

            localStorage.setItem(STORAGE_ACTIVATION_KEY, 'true');
            if (sdt) localStorage.setItem('pv_activated_sdt', sdt);
            if (grade) localStorage.setItem(STORAGE_GRADE_KEY, grade.toString());
            setIsActivated(true);
            return true;
        }
        return false;
    };

    // --- Telegram Cloud Sync: Fetch bài giảng theo grade ---
    const fetchLessonsFromGitHub = async (grade: number, onProgress?: (pct: number) => void): Promise<{ success: boolean; lessonCount: number; fileCount: number }> => {
        console.log(`[CloudSync] Đang truy vấn Supabase cho Lớp ${grade}`);

        try {

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
            if (!indexFileId) throw new Error(`Hệ thống chưa có dữ liệu cho Lớp ${grade}. Thầy vui lòng Sync trước nhé!`);

            // Dùng Public CORS Proxy để fetch trực tiếp file từ Telegram
            const fetchViaPublicProxy = async (fileId: string): Promise<ArrayBuffer> => {
                const maxRetries = 3;
                let lastError = null;
                for (let attempt = 0; attempt < maxRetries; attempt++) {
                    try {
                        // 1. Phân giải Path của File trực tiếp từ Telegram API (API này đã mở CORS sẵn)
                        const pathRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getFile?file_id=${fileId}`);
                        const pathResult = await pathRes.json();

                        if (!pathResult.ok) {
                            if (pathResult.error_code === 429) {
                                await new Promise(resolve => setTimeout(resolve, (pathResult.parameters?.retry_after || 5) * 1000));
                                continue;
                            }
                            throw new Error(`Lỗi cấp phép file trên Telegram: ${pathResult.description}`);
                        }

                        // 2. Tải File Natively qua CORS Proxy (do api.telegram.org/file chặn CORS)
                        const directUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${pathResult.result.file_path}`;
                        const proxyUrl = `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(directUrl)}`;

                        const fileRes = await fetch(proxyUrl);
                        if (!fileRes.ok) throw new Error("Public Proxy từ chối tải file");
                        return await fileRes.arrayBuffer();
                    } catch (e: any) {
                        lastError = e;
                        await new Promise(r => setTimeout(r, 2000 + (attempt * 1000)));
                    }
                }
                throw lastError || new Error("Lỗi tải cấu trúc dữ liệu, quá giới hạn thử lại");
            };

            const indexRaw = await fetchViaPublicProxy(indexFileId);
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
                // Format V3: Offline Archive ZIP (Có hỗ trợ chia nhỏ ZIP nếu > 20MB)
                const zIds: string[] = indexData.zipFileIds || [indexData.zipFileId];
                if (onProgress) onProgress(10);

                // Tải file ZIP TỪNG FILE MỘT qua Public Proxy
                let downloadedParts = 0;

                for (let i = 0; i < zIds.length; i++) {
                    const fileId = zIds[i];
                    try {
                        const arrayBuf = await fetchViaPublicProxy(fileId);
                        const zip = new JSZip();

                        const unzipped = await zip.loadAsync(arrayBuf); // Nạp thẳng mảng Byte (Binary)

                        const filePromises: Promise<void>[] = [];
                        unzipped.forEach((relativePath, fileObj) => {
                            if (!fileObj.dir) {
                                filePromises.push(
                                    fileObj.async("string").then(content => {
                                        let parsedData;
                                        try { parsedData = JSON.parse(content); }
                                        catch { parsedData = JSON.parse(xorDeobfuscate(content)); }
                                        mergePayload(parsedData);
                                    })
                                );
                            }
                        });
                        await Promise.all(filePromises);
                    } catch (err: any) {
                        console.error('Error fetching zip chunk with proxy:', err);
                        throw new Error(`Tải đoạn dữ liệu thất bại. Vui lòng thử tải lại.`);
                    }
                    downloadedParts++;
                    // Tiến độ tải từng file zip (10% -> 90%)
                    if (onProgress) onProgress(Math.floor(10 + (downloadedParts / zIds.length) * 80));
                }

                if (onProgress) onProgress(90); // Finished merging 
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

            const uniqueLessons = Array.from(newLessonsMap.values()) as Lesson[];
            await dbSet(STORAGE_LESSONS_KEY, uniqueLessons);
            await dbSet(STORAGE_FILES_KEY, newFiles);
            setLessons(uniqueLessons);
            setStoredFiles(newFiles);

            return { success: true, lessonCount: totalLessonCount, fileCount: totalFileCount };
        } catch (err: any) {
            throw new Error(`Sync thất bại: ${err.message}`);
        }
    };

    // --- Telegram Cloud Sync: Push lên Telegram (V2 — 1 file/lesson, tránh vượt 20MB) ---
    const syncToGitHub = async (grade: number, lessonsToSync: Lesson[], filesToSync: FileStorage): Promise<string> => {
        if (!TELEGRAM_TOKEN) throw new Error('Chưa cấu hình Telegram');
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

        // Chuẩn bị blobs
        const blobs: Blob[] = [];
        let totalUploadSize = 0;
        for (const p of payloads) {
            const content = xorObfuscate(JSON.stringify({ ...p, syncedAt: Date.now() }));
            const blob = new Blob([content], { type: 'application/json' });
            blobs.push(blob);
            totalUploadSize += blob.size;
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
                    xhr.open('POST', `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendDocument`);
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

        // --- V3 Zip Archive Chunking (Giới hạn tải xuống của Telegram File API là 20MB, ta chia 18MB một cục chưa nén) ---
        const MAX_CHUNK_SIZE = 18 * 1024 * 1024;
        const zipChunks: JSZip[] = [];
        let currentZip = new JSZip();
        let currentChunkSize = 0;

        for (const p of payloads) {
            const content = xorObfuscate(JSON.stringify({ ...p, syncedAt: Date.now() }));
            const fileName = `g${grade}_${p.chapterId}_${p.lessons[0]?.id || 'ch'}.json`;
            const contentBytes = new Blob([content]).size;

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

        const zipBlobs: Blob[] = [];
        // 1. Phân bổ 0% -> 20% cho việc nén ZIP
        for (let i = 0; i < zipChunks.length; i++) {
            const z = zipChunks[i];
            const zipBlob = await z.generateAsync({ type: 'blob', compression: "DEFLATE", compressionOptions: { level: 6 } }, (meta) => {
                const globalPercent = Math.floor(i * (20 / zipChunks.length) + meta.percent * (0.2 / zipChunks.length));
                setSyncProgress(globalPercent);
            });
            zipBlobs.push(zipBlob);
        }

        const finalZipFileIds: string[] = [];
        const totalZipSize = zipBlobs.reduce((acc, curr) => acc + curr.size, 0);
        let currentUploadedSize = 0;

        // 2. Phân bổ 20% -> 95% cho việc upload file
        for (let i = 0; i < zipBlobs.length; i++) {
            const zipBlob = zipBlobs[i];
            const fileId = await uploadBlob(zipBlob, `vault_g${grade}_v3_part${i + 1}.zip`, (loaded) => {
                const totalLoaded = currentUploadedSize + loaded;
                const globalPercent = 20 + Math.floor((totalLoaded / totalZipSize) * 75);
                setSyncProgress(Math.min(globalPercent, 95));
            });
            currentUploadedSize += zipBlob.size;
            finalZipFileIds.push(fileId);
        }

        // Gửi file Index V3
        setSyncProgress(95);
        const indexPayload = { grade, zipFileIds: finalZipFileIds, totalLessons: lessonsToSync.length, updatedAt: Date.now() };
        const indexBlob = new Blob([xorObfuscate(JSON.stringify(indexPayload))], { type: 'application/json' });
        const indexForm = new FormData();
        indexForm.append('chat_id', TELEGRAM_CHAT_ID);
        indexForm.append('document', indexBlob, `index_grade${grade}_v3.json`);
        indexForm.append('caption', `[INDEX-V3-ZIP] Lớp ${grade} | ${finalZipFileIds.length} phần`);

        const indexRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendDocument`, {
            method: 'POST', body: indexForm
        });
        if (!indexRes.ok) { setSyncProgress(0); throw new Error(`Lỗi upload Index: ${indexRes.statusText}`); }

        const finalFileId = (await indexRes.json()).result.document.file_id;

        // Lưu vào Supabase thay vì Google Sheets
        const { error: sbError } = await supabase
            .from('vault_index')
            .upsert({ grade, telegram_file_id: finalFileId, updated_at: Date.now() }, { onConflict: 'grade' });

        if (sbError) throw new Error("Supabase từ chối lưu: " + sbError.message);

        localStorage.setItem(`pv_sync_file_id_${grade}`, finalFileId);
        setSyncProgress(100);
        setTimeout(() => setSyncProgress(0), 1000);
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
            xhr.open('POST', `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendDocument`);
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

        const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendDocument`, {
            method: 'POST', body: formData
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
            if (!fileId) return cached || [];

            // Tải file index exam từ Telegram
            const pathRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getFile?file_id=${fileId}`);
            const pathData = await pathRes.json();
            if (!pathData.ok) return cached || [];

            const directUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${pathData.result.file_path}`;
            const proxyUrl = `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(directUrl)}`;

            const fileRes = await fetch(proxyUrl);
            if (!fileRes.ok) return cached || [];
            const arrayBuf = await fileRes.arrayBuffer();
            const indexStr = new TextDecoder().decode(arrayBuf);

            const parsed = JSON.parse(xorDeobfuscate(indexStr));
            const exams: Exam[] = parsed.exams || [];
            await dbSet('physivault_exams', exams);
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
