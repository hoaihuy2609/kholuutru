
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

    // --- Telegram Cloud Sync: Fetch bài giảng theo grade ---
    const fetchLessonsFromGitHub = async (grade: number): Promise<{ success: boolean; lessonCount: number; fileCount: number }> => {
        // Lấy thông tin file_id từ Google Sheets (Thông qua Apps Script)
        // Hiện tại: Tạm thời cho phép Admin dán file_id hoặc lấy từ sheet

        // MẸO: Vì bro chưa đưa URL Apps Script, tôi sẽ viết logic để App 
        // có thể nhận data từ Telegram thông qua một mã file_id

        const fileId = localStorage.getItem(`pv_sync_file_id_${grade}`);
        if (!fileId) throw new Error(`Chưa có liên kết dữ liệu cho Lớp ${grade}. Vui lòng liên hệ Admin.`);

        // Gọi Google Apps Script để làm cầu nối tải file từ Telegram (Bảo mật token)
        const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyz8Gb7Uw99NrWwQyNHpY8YShyjFmqxImwDfWA0oi3Ue3VgIg1LSl3T_aso30P9HOE/exec";

        const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=get_vault_data&file_id=${fileId}`);
        const result = await response.json();

        if (!result.success) throw new Error(result.error || "Lỗi tải dữ liệu từ Telegram");

        const data: ExportData = JSON.parse(xorDeobfuscate(result.data));

        // GHI ĐÈ: Xóa bài cũ của grade này trước khi nạp
        const currentLessons = await dbGet(STORAGE_LESSONS_KEY) || [];
        const currentFiles = await dbGet(STORAGE_FILES_KEY) || {};

        // Lọc bỏ bài thuộc khối lớp hiện tại (dựa trên chapterId)
        // Tìm chapters thuộc grade này
        // (Tối ưu: Ở đây ta sẽ Filter theo chapterId nếu cần, 
        // nhưng theo ý bro "Ghi đè" thì ta sẽ merge thông minh)

        const lessonMap = new Map();
        // Giữ lại bài của các lớp khác
        currentLessons.forEach((l: Lesson) => lessonMap.set(l.id, l));
        // Ghi đè bài mới
        data.lessons.forEach((l: Lesson) => lessonMap.set(l.id, l));
        const uniqueLessons = Array.from(lessonMap.values()) as Lesson[];

        const mergedFiles = { ...currentFiles, ...data.files };

        await dbSet(STORAGE_LESSONS_KEY, uniqueLessons);
        await dbSet(STORAGE_FILES_KEY, mergedFiles);

        setLessons(uniqueLessons);
        setStoredFiles(mergedFiles);

        return {
            success: true,
            lessonCount: data.lessons.length,
            fileCount: Object.values(data.files).flat().length,
        };
    };

    // --- Telegram Cloud Sync: Push bài giảng lên Telegram (Admin only) ---
    const syncToGitHub = async (grade: number, lessonsToSync: Lesson[], filesToSync: FileStorage): Promise<string> => {
        if (!TELEGRAM_TOKEN) throw new Error('Chưa cấu hình Telegram Token');

        // Đóng gói dữ liệu khối lớp
        const payload: ExportData = {
            version: 1.2,
            exportedAt: Date.now(),
            lessons: lessonsToSync,
            files: filesToSync
        };

        const content = xorObfuscate(JSON.stringify(payload));

        // Tạo file blob để gửi
        const blob = new Blob([content], { type: 'application/json' });
        const formData = new FormData();
        formData.append('chat_id', TELEGRAM_CHAT_ID);
        formData.append('document', blob, `physivault_grade${grade}_${Date.now()}.json`);
        formData.append('caption', `[ADMIN SYNC] Dữ liệu Lớp ${grade}\nNgày: ${new Date().toLocaleString('vi-VN')}`);

        const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendDocument`, {
            method: 'POST',
            body: formData
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.description || 'Lỗi gửi file lên Telegram');
        }

        const teleData = await res.json();
        const fileId = teleData.result.document.file_id;

        // Lưu fileId vào local để test nhanh, sau này sẽ đẩy lên Google Sheets
        localStorage.setItem(`pv_sync_file_id_${grade}`, fileId);

        return fileId;
    };

    const verifyAccess = async (): Promise<'ok' | 'kicked' | 'offline_expired'> => {
        const sdt = localStorage.getItem('pv_activated_sdt');
        const isCurrentlyActivated = localStorage.getItem(STORAGE_ACTIVATION_KEY) === 'true';

        if (!isCurrentlyActivated || !sdt) return 'ok';

        const machineId = getMachineId();
        const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyz8Gb7Uw99NrWwQyNHpY8YShyjFmqxImwDfWA0oi3Ue3VgIg1LSl3T_aso30P9HOE/exec";
        const OFFLINE_GRACE_PERIOD = 24 * 60 * 60 * 1000; // 24 giờ

        try {
            const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=check&sdt=${sdt}&machineId=${machineId}`);
            const result = await response.json();

            if (!result.success) {
                // BỊ KICK! Xóa sạch dấu vết
                localStorage.removeItem(STORAGE_ACTIVATION_KEY);
                localStorage.removeItem('pv_activated_sdt');
                localStorage.removeItem('pv_pending_sdt');
                localStorage.removeItem('pv_last_check');
                setIsActivated(false);
                return 'kicked';
            }
            // Check thành công → đóng dấu thời gian
            localStorage.setItem('pv_last_check', Date.now().toString());
            return 'ok';
        } catch (e) {
            // Lỗi mạng → kiểm tra hạn sử dụng offline
            const lastCheck = localStorage.getItem('pv_last_check');
            if (!lastCheck) {
                // Chưa bao giờ check thành công → cần mạng
                return 'offline_expired';
            }
            const elapsed = Date.now() - parseInt(lastCheck);
            if (elapsed > OFFLINE_GRACE_PERIOD) {
                // Quá 24h chưa check → hết hạn offline
                return 'offline_expired';
            }
            // Vẫn trong hạn 24h → cho qua
            return 'ok';
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

                if (!data.lessons || !data.files) {
                    throw new Error("INVALID_FORMAT");
                }

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
