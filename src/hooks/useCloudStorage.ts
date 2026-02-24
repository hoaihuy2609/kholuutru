
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

// --- System Security Salts ---
const SYSTEM_SALT = "PHV_SECURITY_2026_BY_HUY"; // Chìa khóa hệ thống nội bộ

// --- GitHub Cloud Sync Config ---
// Các biến này được đọc từ .env.local
const GITHUB_TOKEN = import.meta.env.VITE_GITHUB_TOKEN || (process.env as any).VITE_GITHUB_TOKEN || '';
const GITHUB_REPO = import.meta.env.VITE_GITHUB_REPO || (process.env as any).VITE_GITHUB_REPO || ''; // format: "username/repo"
const GITHUB_BRANCH = import.meta.env.VITE_GITHUB_BRANCH || (process.env as any).VITE_GITHUB_BRANCH || 'main';

// --- XOR Obfuscation for GitHub content ---
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

    // --- GitHub Cloud Sync: Fetch bài giảng theo grade ---
    const fetchLessonsFromGitHub = async (grade: number): Promise<{ success: boolean; lessonCount: number; fileCount: number }> => {
        const fileName = `kho-${grade}.json`;
        const rawUrl = GITHUB_REPO
            ? `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/${fileName}`
            : '';

        if (!rawUrl) {
            throw new Error('Chưa cấu hình GitHub Repo. Liên hệ Admin để được hỗ trợ.');
        }

        const response = await fetch(rawUrl + '?t=' + Date.now()); // Cache-bust
        if (!response.ok) {
            throw new Error(`Không tìm thấy dữ liệu cho Lớp ${grade} trên hệ thống.`);
        }

        const rawText = await response.text();

        // Thử giải mã XOR, nếu thất bại thì parse trực tiếp
        let data: { lessons: Lesson[]; files: FileStorage };
        try {
            const decoded = xorDeobfuscate(rawText);
            data = JSON.parse(decoded);
        } catch {
            data = JSON.parse(rawText);
        }

        if (!data.lessons || !data.files) {
            throw new Error('Dữ liệu từ GitHub không hợp lệ.');
        }

        // Merge vào IndexedDB (giữ nguyên bài giảng cũ, thêm mới)
        const currentLessons = await dbGet(STORAGE_LESSONS_KEY) || [];
        const currentFiles = await dbGet(STORAGE_FILES_KEY) || {};

        const lessonMap = new Map();
        currentLessons.forEach((l: Lesson) => lessonMap.set(l.id, l));
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

    // --- GitHub Cloud Sync: Push bài giảng lên GitHub (Admin only) ---
    const syncToGitHub = async (grade: number, lessonsToSync: Lesson[], filesToSync: FileStorage): Promise<void> => {
        if (!GITHUB_TOKEN) throw new Error('Chưa cấu hình GitHub Token trong .env.local');
        if (!GITHUB_REPO) throw new Error('Chưa cấu hình GitHub Repo trong .env.local');

        const fileName = `kho-${grade}.json`;
        const payload = { lessons: lessonsToSync, files: filesToSync, syncedAt: Date.now() };
        const rawContent = JSON.stringify(payload);
        // xorObfuscate đã trả về base64 string sẵn - dùng trực tiếp
        const base64Content = xorObfuscate(rawContent);

        // Kiểm tra file cũ để lấy SHA (cần để update)
        const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${fileName}`;
        let sha: string | undefined;

        try {
            const checkRes = await fetch(apiUrl, {
                headers: { Authorization: `token ${GITHUB_TOKEN}` },
            });
            if (checkRes.ok) {
                const checkData = await checkRes.json();
                sha = checkData.sha;
            }
        } catch { /* File chưa tồn tại - OK */ }

        const body: Record<string, unknown> = {
            message: `[PhysiVault] Sync bài giảng Lớp ${grade} - ${new Date().toLocaleString('vi-VN')}`,
            content: base64Content,
            branch: GITHUB_BRANCH,
        };
        if (sha) body.sha = sha;

        const res = await fetch(apiUrl, {
            method: 'PUT',
            headers: {
                Authorization: `token ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.message || `GitHub API error: ${res.status}`);
        }
    };

    const verifyAccess = async (): Promise<'ok' | 'kicked' | 'offline_expired'> => {
        const sdt = localStorage.getItem('pv_activated_sdt');
        const isCurrentlyActivated = localStorage.getItem(STORAGE_ACTIVATION_KEY) === 'true';

        if (!isCurrentlyActivated || !sdt) return 'ok';

        const machineId = getMachineId();
        const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw1gPydkWrJLGmRPAxjEJQ3JCkWYRG3c67I28jmZvh6aiF5UqslfoHw4l24OHXKPMQj/exec";
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
