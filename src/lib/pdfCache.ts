// src/lib/pdfCache.ts
// Shared IndexedDB PDF cache — dùng chung cho ExamView & ExamListPage
// Lưu Blob nguyên thủy thay vì chuỗi Base64 để tăng tốc độ và giảm RAM

export const PDF_CACHE_DB = 'pv_pdf_cache';
export const PDF_CACHE_STORE = 'pdfs';

/**
 * Tạo cache key gồm examId + pdfTelegramFileId.
 * Khi admin upload đề mới, fileId thay đổi → cache key mới → tự động invalidate entry cũ.
 */
export const makeCacheKey = (examId: string, fileId?: string): string =>
    fileId ? `${examId}__${fileId}` : examId;

export const openPdfCacheDB = (): Promise<IDBDatabase> =>
    new Promise((resolve, reject) => {
        const req = indexedDB.open(PDF_CACHE_DB, 2); // version 2: migrate từ base64 string → Blob
        req.onupgradeneeded = (e) => {
            const db = (e.target as IDBOpenDBRequest).result;
            // Xoá store cũ (chứa base64 string) nếu tồn tại để tránh lẫn lộn kiểu dữ liệu
            if (db.objectStoreNames.contains(PDF_CACHE_STORE)) {
                db.deleteObjectStore(PDF_CACHE_STORE);
            }
            db.createObjectStore(PDF_CACHE_STORE);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });

export const getCachedPdf = async (examId: string, fileId?: string): Promise<Blob | null> => {
    try {
        const db = await openPdfCacheDB();
        const key = makeCacheKey(examId, fileId);
        return new Promise(resolve => {
            const req = db.transaction(PDF_CACHE_STORE, 'readonly').objectStore(PDF_CACHE_STORE).get(key);
            req.onsuccess = () => {
                const result = req.result;
                // Guard: chỉ trả về nếu là Blob thực sự (tránh trả về string base64 cũ)
                resolve(result instanceof Blob ? result : null);
            };
            req.onerror = () => resolve(null);
        });
    } catch { return null; }
};

export const savePdfToCache = async (examId: string, pdfBlob: Blob, fileId?: string): Promise<void> => {
    try {
        const db = await openPdfCacheDB();
        const key = makeCacheKey(examId, fileId);
        db.transaction(PDF_CACHE_STORE, 'readwrite').objectStore(PDF_CACHE_STORE).put(pdfBlob, key);
    } catch { /* silent */ }
};

export const isPdfCached = async (examId: string, fileId?: string): Promise<boolean> => {
    try {
        const db = await openPdfCacheDB();
        const key = makeCacheKey(examId, fileId);
        return new Promise(resolve => {
            const req = db.transaction(PDF_CACHE_STORE, 'readonly').objectStore(PDF_CACHE_STORE).getKey(key);
            req.onsuccess = () => resolve(!!req.result);
            req.onerror = () => resolve(false);
        });
    } catch { return false; }
};

/** Xóa 1 entry khỏi cache (dùng khi admin xóa đề hoặc cần invalidate thủ công) */
export const deletePdfFromCache = async (examId: string, fileId?: string): Promise<void> => {
    try {
        const db = await openPdfCacheDB();
        const key = makeCacheKey(examId, fileId);
        db.transaction(PDF_CACHE_STORE, 'readwrite').objectStore(PDF_CACHE_STORE).delete(key);
    } catch { /* silent */ }
};
