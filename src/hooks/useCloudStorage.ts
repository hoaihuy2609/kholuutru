
import { useState, useEffect } from 'react';
import CryptoJS from 'crypto-js';
import { Lesson, StoredFile, FileStorage } from '../../types';

// Storage Keys
const STORAGE_FILES_KEY = 'physivault_files';
const STORAGE_LESSONS_KEY = 'physivault_lessons';
const STORAGE_ACTIVATION_KEY = 'physivault_activated';
const DB_NAME = 'PhysiVaultDB';
const DB_VERSION = 1;
const STORE_NAME = 'app_data';

// --- System Security Salts ---
const SYSTEM_SALT = "PHV_SECURITY_2026_BY_HUY"; // Chìa khóa hệ thống nội bộ

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
    // Thuật toán tạo mã kích hoạt bí mật dựa trên mã máy và SĐT
    // Nếu sdt trống (dùng cho admin gen tay cho máy cũ), logic cũ vẫn chạy hoặc sdt được coi là chuỗi rỗng
    const rawData = machineId + sdt + SYSTEM_SALT;
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

    const activateSystem = (key: string, sdt: string = ""): boolean => {
        const machineId = getMachineId();
        const expectedKey = generateActivationKey(machineId, sdt);
        if (key === expectedKey) {
            localStorage.setItem(STORAGE_ACTIVATION_KEY, 'true');
            if (sdt) localStorage.setItem('pv_activated_sdt', sdt);
            setIsActivated(true);
            return true;
        }
        return false;
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
        activateSystem
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
