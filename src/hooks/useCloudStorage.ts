
import { useState, useEffect } from 'react';
import { Lesson, StoredFile, FileStorage } from '../../types';

// Keys for LocalStorage
const STORAGE_FILES_KEY = 'physivault_files';
const STORAGE_LESSONS_KEY = 'physivault_lessons';

// Helper to get data from local storage
const getLocalData = () => {
    try {
        const savedFiles = localStorage.getItem(STORAGE_FILES_KEY);
        const savedLessons = localStorage.getItem(STORAGE_LESSONS_KEY);
        return {
            lessons: savedLessons ? JSON.parse(savedLessons) : [],
            files: savedFiles ? JSON.parse(savedFiles) : {}
        };
    } catch (e) {
        console.error("Error reading local storage", e);
        return { lessons: [], files: {} };
    }
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

    // Initial state from localStorage
    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [storedFiles, setStoredFiles] = useState<FileStorage>({});
    const [loading, setLoading] = useState(false); // Local storage is instant

    // Load data only on mount
    useEffect(() => {
        const data = getLocalData();
        setLessons(data.lessons);
        setStoredFiles(data.files);
    }, []);

    // Save changes to localStorage
    useEffect(() => {
        if (lessons.length > 0) localStorage.setItem(STORAGE_LESSONS_KEY, JSON.stringify(lessons));
    }, [lessons]);

    useEffect(() => {
        if (Object.keys(storedFiles).length > 0) localStorage.setItem(STORAGE_FILES_KEY, JSON.stringify(storedFiles));
    }, [storedFiles]);

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

    const uploadFiles = async (files: File[], lessonId: string) => {
        // Convert files to Base64 to store in LocalStorage
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
                        url: result, // Base64 Data URL
                        uploadDate: Date.now(),
                    });
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        });

        const newStoredFiles = await Promise.all(filePromises);

        setStoredFiles(prev => ({
            ...prev,
            [lessonId]: [...(prev[lessonId] || []), ...newStoredFiles]
        }));
    };

    const deleteFile = async (fileId: string, lessonId: string) => {
        setStoredFiles(prev => ({
            ...prev,
            [lessonId]: prev[lessonId]?.filter(f => f.id !== fileId) || []
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

// --- Export / Import Helpers ---

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
        reader.onload = (e) => {
            try {
                const content = e.target?.result as string;
                const data: ExportData = JSON.parse(content);

                if (!data.lessons || !data.files) {
                    throw new Error("Invalid backup file format");
                }

                // Merge with existing data
                // Strategy: Add all imported lessons. If ID exists, we might overwrite or duplicate?
                // Let's overwrite to ensure sync state.

                // 1. Update Lessons
                const currentLessons = JSON.parse(localStorage.getItem(STORAGE_LESSONS_KEY) || '[]');
                const mergedLessons = [...data.lessons];
                // Add existing lessons that are NOT in the import?
                // Usually sync means "take this state".
                // But let's simple merge: Combine and deduplicate by ID?
                // For "Manual Sync", usually we want the imported file to become the source of truth OR add to it.
                // Let's dedupe by ID.
                const lessonMap = new Map();
                currentLessons.forEach((l: Lesson) => lessonMap.set(l.id, l));
                data.lessons.forEach((l: Lesson) => lessonMap.set(l.id, l));
                const uniqueLessons = Array.from(lessonMap.values());

                // 2. Update Files
                const currentFiles = JSON.parse(localStorage.getItem(STORAGE_FILES_KEY) || '{}');
                const mergedFiles = { ...currentFiles, ...data.files };

                // Save to LocalStorage
                localStorage.setItem(STORAGE_LESSONS_KEY, JSON.stringify(uniqueLessons));
                localStorage.setItem(STORAGE_FILES_KEY, JSON.stringify(mergedFiles));

                resolve();
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsText(file);
    });
};
