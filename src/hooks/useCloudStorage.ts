
import { useState, useEffect } from 'react';
import { Lesson, StoredFile, FileStorage } from '../../types';

// Storage Keys
const STORAGE_FILES_KEY = 'physivault_files';
const STORAGE_LESSONS_KEY = 'physivault_lessons';
const DB_NAME = 'PhysiVaultDB';
const DB_VERSION = 1;
const STORE_NAME = 'app_data';

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
}

export const useCloudStorage = () => {
    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [storedFiles, setStoredFiles] = useState<FileStorage>({});
    const [loading, setLoading] = useState(true);

    // Initial Load & Migration
    useEffect(() => {
        const initData = async () => {
            setLoading(true);
            try {
                // 1. Try to get data from IndexedDB
                let savedLessons = await dbGet(STORAGE_LESSONS_KEY);
                let savedFiles = await dbGet(STORAGE_FILES_KEY);

                // 2. Migration: If IndexedDB is empty but LocalStorage has data, move it
                if (!savedLessons && !savedFiles) {
                    const localFiles = localStorage.getItem(STORAGE_FILES_KEY);
                    const localLessons = localStorage.getItem(STORAGE_LESSONS_KEY);

                    if (localFiles || localLessons) {
                        console.log("Migrating data from LocalStorage to IndexedDB...");
                        savedLessons = localLessons ? JSON.parse(localLessons) : [];
                        savedFiles = localFiles ? JSON.parse(localFiles) : {};

                        await dbSet(STORAGE_LESSONS_KEY, savedLessons);
                        await dbSet(STORAGE_FILES_KEY, savedFiles);

                        // Optional: Clear localStorage to save space
                        // localStorage.removeItem(STORAGE_FILES_KEY);
                        // localStorage.removeItem(STORAGE_LESSONS_KEY);
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

    // Sync state to IndexedDB whenever it changes
    useEffect(() => {
        if (!loading) {
            dbSet(STORAGE_LESSONS_KEY, lessons);
        }
    }, [lessons, loading]);

    useEffect(() => {
        if (!loading) {
            dbSet(STORAGE_FILES_KEY, storedFiles);
        }
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

    return {
        lessons,
        storedFiles,
        loading,
        addLesson,
        deleteLesson,
        uploadFiles,
        deleteFile
    };
};

// --- Export / Import Helpers (Updated for Async DB) ---

export const exportData = (lessons: Lesson[], files: FileStorage) => {
    const data: ExportData = {
        version: 1,
        exportedAt: Date.now(),
        lessons,
        files
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `physivault_backup_${new Date().toISOString().slice(0, 10)}.json`;
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
                const content = e.target?.result as string;
                const data: ExportData = JSON.parse(content);

                if (!data.lessons || !data.files) {
                    throw new Error("Invalid backup file format");
                }

                // 1. Load current data from IndexedDB
                const currentLessons = await dbGet(STORAGE_LESSONS_KEY) || [];
                const currentFiles = await dbGet(STORAGE_FILES_KEY) || {};

                // 2. Merge Lessons (Dedupe by ID)
                const lessonMap = new Map();
                currentLessons.forEach((l: Lesson) => lessonMap.set(l.id, l));
                data.lessons.forEach((l: Lesson) => lessonMap.set(l.id, l));
                const uniqueLessons = Array.from(lessonMap.values());

                // 3. Merge Files
                const mergedFiles = { ...currentFiles, ...data.files };

                // 4. Save back to IndexedDB
                await dbSet(STORAGE_LESSONS_KEY, uniqueLessons);
                await dbSet(STORAGE_FILES_KEY, mergedFiles);

                resolve();
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsText(file);
    });
};
