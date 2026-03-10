import { Lesson, StoredFile, FileStorage } from '../../types';
import { dbGet, dbSet } from '../lib/db';

const STORAGE_FILES_KEY = 'physivault_files';
const STORAGE_LESSONS_KEY = 'physivault_lessons';

interface ExportData {
    version: number;
    exportedAt: number;
    lessons: Lesson[];
    files: { [lessonId: string]: StoredFile[] };
    isEncrypted?: boolean;
}

export const exportData = (lessons: Lesson[], files: FileStorage) => {
    // Strip transient blob URLs — they're session-specific and invalid after import
    const sanitizedFiles: FileStorage = {};
    for (const [key, arr] of Object.entries(files)) {
        sanitizedFiles[key] = arr.map(({ url, ...rest }) => rest as StoredFile);
    }
    const rawData: ExportData = { version: 1.1, exportedAt: Date.now(), lessons, files: sanitizedFiles };
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
                if (!Array.isArray(data.lessons) || typeof data.files !== 'object' || data.files === null)
                    throw new Error("INVALID_FORMAT");

                const currentLessons = await dbGet(STORAGE_LESSONS_KEY) || [];
                const currentFiles = await dbGet(STORAGE_FILES_KEY) || {};

                const lessonMap = new Map();
                currentLessons.forEach((l: Lesson) => lessonMap.set(l.id, l));
                data.lessons.forEach((l: Lesson) => lessonMap.set(l.id, l));

                await dbSet(STORAGE_LESSONS_KEY, Array.from(lessonMap.values()));
                await dbSet(STORAGE_FILES_KEY, { ...currentFiles, ...data.files });
                resolve();
            } catch (err) { reject(err); }
        };
        reader.onerror = () => reject(new Error("READ_ERROR"));
        reader.readAsText(file);
    });
};
