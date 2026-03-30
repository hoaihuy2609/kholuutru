// src/lib/pdfCache.ts
// Shared IndexedDB PDF cache — dùng chung cho ExamView & ExamListPage

export const PDF_CACHE_DB = 'pv_pdf_cache';
export const PDF_CACHE_STORE = 'pdfs';

export const openPdfCacheDB = (): Promise<IDBDatabase> =>
    new Promise((resolve, reject) => {
        const req = indexedDB.open(PDF_CACHE_DB, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(PDF_CACHE_STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });

export const getCachedPdf = async (examId: string): Promise<string | null> => {
    try {
        const db = await openPdfCacheDB();
        return new Promise(resolve => {
            const req = db.transaction(PDF_CACHE_STORE, 'readonly').objectStore(PDF_CACHE_STORE).get(examId);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => resolve(null);
        });
    } catch { return null; }
};

export const savePdfToCache = async (examId: string, base64Str: string): Promise<void> => {
    try {
        const db = await openPdfCacheDB();
        db.transaction(PDF_CACHE_STORE, 'readwrite').objectStore(PDF_CACHE_STORE).put(base64Str, examId);
    } catch { /* silent */ }
};

export const isPdfCached = async (examId: string): Promise<boolean> => {
    try {
        const db = await openPdfCacheDB();
        return new Promise(resolve => {
            const req = db.transaction(PDF_CACHE_STORE, 'readonly').objectStore(PDF_CACHE_STORE).getKey(examId);
            req.onsuccess = () => resolve(!!req.result);
            req.onerror = () => resolve(false);
        });
    } catch { return false; }
};
