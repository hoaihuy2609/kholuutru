
import { useState, useEffect } from 'react';
import CryptoJS from 'crypto-js';
import { Lesson, StoredFile, FileStorage } from '../../types';

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

    const activateSystem = (key: string, sdt: string = "", grade?: number): boolean => {
        const machineId = getMachineId();
        const expectedKey = generateActivationKey(machineId, sdt);
        if (key === expectedKey) {
            localStorage.setItem(STORAGE_ACTIVATION_KEY, 'true');
            if (sdt) localStorage.setItem('pv_activated_sdt', sdt);
            if (grade) localStorage.setItem(STORAGE_GRADE_KEY, grade.toString());
            setIsActivated(true);
            return true;
        }
        return false;
    };

    // --- Telegram Cloud Sync: Fetch bài giảng theo grade (Tải toàn bộ các chương trong 1 lượt) ---
    // --- Telegram Cloud Sync: Fetch bài giảng theo grade (Tải toàn bộ các chương trong 1 lượt) ---
    const fetchLessonsFromGitHub = async (grade: number): Promise<{ success: boolean; lessonCount: number; fileCount: number }> => {
        const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwnnT7SdQmDy9nJsGytSYtOviOl8zYLDFTT1Kc2qZ26hu1yfinIE6LIgpCzVKvZSGsv/exec";
        console.log(`[CloudSync] Đang hỏi Google cho Lớp ${grade} tại URL: ${GOOGLE_SCRIPT_URL}`);

        // 1. Hỏi Google Sheets xem địa chỉ ID mới nhất của lớp này là gì
        try {
            const latestIndexRes = await fetch(`${GOOGLE_SCRIPT_URL}?action=get_latest_index&grade=${grade}`);
            const latestIndexResult = await latestIndexRes.json();

            const indexFileId = latestIndexResult.file_id || localStorage.getItem(`pv_sync_file_id_${grade}`);
            if (!indexFileId) throw new Error(`Hệ thống chưa có dữ liệu cho Lớp ${grade}. Thầy vui lòng Sync trước nhé!`);

            // 2. Tải file MỤC LỤC trước để biết có bao nhiêu chương cần kéo về
            const indexRes = await fetch(`${GOOGLE_SCRIPT_URL}?action=get_vault_data&file_id=${indexFileId}`);
            const indexResult = await indexRes.json();
            if (!indexResult.success) throw new Error("Không thể tải Mục lục lớp " + grade);

            const indexData = JSON.parse(xorDeobfuscate(indexResult.data));
            const chapterFileIds = indexData.chapterFileIds as Record<string, string>;

            const currentLessons = await dbGet(STORAGE_LESSONS_KEY) || [];
            const currentFiles = await dbGet(STORAGE_FILES_KEY) || {};

            const newLessonsMap = new Map();
            currentLessons.forEach((l: Lesson) => newLessonsMap.set(l.id, l));
            const newFiles = { ...currentFiles };

            // 3. Tải tất cả các Chương (Dùng Promise.all để tải song song cho nhanh)
            const chapterIds = Object.keys(chapterFileIds);
            const chapterPromises = chapterIds.map(async (chId) => {
                const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=get_vault_data&file_id=${chapterFileIds[chId]}`);
                const result = await res.json();
                if (result.success) {
                    return JSON.parse(xorDeobfuscate(result.data));
                }
                return null;
            });

            const allChaptersData = await Promise.all(chapterPromises);
            let totalLessonCount = 0;
            let totalFileCount = 0;

            allChaptersData.forEach(chapterData => {
                if (chapterData) {
                    chapterData.lessons.forEach((l: Lesson) => newLessonsMap.set(l.id, l));
                    Object.assign(newFiles, chapterData.files);
                    totalLessonCount += chapterData.lessons.length;
                    totalFileCount += Object.values(chapterData.files as FileStorage).flat().length;
                }
            });

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

    // --- Telegram Cloud Sync: Push bài giảng lên Telegram (TÁCH NHỎ THEO CHƯƠNG) ---
    const syncToGitHub = async (grade: number, lessonsToSync: Lesson[], filesToSync: FileStorage): Promise<string> => {
        if (!TELEGRAM_TOKEN) throw new Error('Chưa cấu hình Telegram');
        setSyncProgress(1); // Bắt đầu: 1%

        if (lessonsToSync.length === 0) {
            throw new Error('Này bro, chưa có bài giảng nào để Sync đâu! Hãy thêm ít nhất 1 bài nhé.');
        }

        const chapterIds = Array.from(new Set(lessonsToSync.map(l => l.chapterId)));
        const chapterFileIds: Record<string, string> = {};

        // 1. Chuẩn bị các Blob dữ liệu và tính tổng dung lượng để track progress
        const chapterBlobs: { chId: string, blob: Blob }[] = [];
        let totalUploadSize = 0;

        for (const chId of chapterIds) {
            const chLessons = lessonsToSync.filter(l => l.chapterId === chId);
            const chFiles: FileStorage = {};
            chLessons.forEach(l => { if (filesToSync[l.id]) chFiles[l.id] = filesToSync[l.id]; });
            if (chLessons.length === 0) continue;

            const payload = { chapterId: chId, lessons: chLessons, files: chFiles, syncedAt: Date.now() };
            const content = xorObfuscate(JSON.stringify(payload));
            const blob = new Blob([content], { type: 'application/json' });
            chapterBlobs.push({ chId, blob });
            totalUploadSize += blob.size;
        }

        // 2. Gửi từng Chương và track progress thực tế
        let totalBytesSentOverall = 0;
        for (const { chId, blob } of chapterBlobs) {
            const formData = new FormData();
            formData.append('chat_id', TELEGRAM_CHAT_ID);
            formData.append('document', blob, `grade${grade}_${chId}.json`);

            const chapterRes = await new Promise<any>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendDocument`);
                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) {
                        const currentSent = totalBytesSentOverall + e.loaded;
                        const percent = Math.floor((currentSent / totalUploadSize) * 95);
                        setSyncProgress(percent);
                    }
                };
                xhr.onload = () => {
                    if (xhr.status === 200) resolve(JSON.parse(xhr.responseText));
                    else reject(new Error(xhr.statusText));
                };
                xhr.onerror = () => reject(new Error("Network Error"));
                xhr.send(formData);
            });

            chapterFileIds[chId] = chapterRes.result.document.file_id;
            totalBytesSentOverall += blob.size;
        }

        // 3. Gửi file Index cuối cùng
        const indexPayload = { grade, chapterFileIds, updatedAt: Date.now() };
        const indexContent = xorObfuscate(JSON.stringify(indexPayload));
        const indexBlob = new Blob([indexContent], { type: 'application/json' });
        const indexFormData = new FormData();
        indexFormData.append('chat_id', TELEGRAM_CHAT_ID);
        indexFormData.append('document', indexBlob, `index_grade${grade}.json`);
        indexFormData.append('caption', `[INDEX] Lớp ${grade} - Đã tách thành ${chapterIds.length} tệp chương`);

        const indexRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendDocument`, {
            method: 'POST',
            body: indexFormData
        });

        if (indexRes.ok) {
            const data = await indexRes.json();
            const finalFileId = data.result.document.file_id;

            // Ghi lại File ID này lên Google Sheets (Bỏ no-cors để Cốc Cốc không chặn)
            const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwnnT7SdQmDy9nJsGytSYtOviOl8zYLDFTT1Kc2qZ26hu1yfinIE6LIgpCzVKvZSGsv/exec";
            try {
                await fetch(`${GOOGLE_SCRIPT_URL}?action=update_vault_index&grade=${grade}&file_id=${finalFileId}`);
            } catch (e) {
                console.error("[CloudSync] Không thể lưu địa chỉ lên Sheets, vui lòng kiểm tra lại Script!", e);
            }

            localStorage.setItem(`pv_sync_file_id_${grade}`, finalFileId);
            setSyncProgress(100);
            setTimeout(() => setSyncProgress(0), 1000);
            return finalFileId;
        } else {
            setSyncProgress(0);
            throw new Error(`Lỗi upload Index: ${indexRes.statusText}`);
        }
    };

    const verifyAccess = async (): Promise<'ok' | 'kicked' | 'offline_expired'> => {
        const sdt = localStorage.getItem('pv_activated_sdt');
        const isCurrentlyActivated = localStorage.getItem(STORAGE_ACTIVATION_KEY) === 'true';

        if (!isCurrentlyActivated || !sdt) return 'ok';

        const machineId = getMachineId();
        const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwnnT7SdQmDy9nJsGytSYtOviOl8zYLDFTT1Kc2qZ26hu1yfinIE6LIgpCzVKvZSGsv/exec";
        try {
            const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=check&sdt=${sdt}&machineId=${machineId}`);
            const result = await response.json();
            if (!result.success) {
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
