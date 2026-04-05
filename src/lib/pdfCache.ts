// src/lib/pdfCache.ts
// Shared IndexedDB PDF cache — dùng chung cho ExamView & ExamListPage
// Lưu Blob nguyên thủy thay vì chuỗi Base64 để tăng tốc độ và giảm RAM

export const PDF_CACHE_DB = 'pv_pdf_cache';
export const PDF_CACHE_STORE = 'pdfs';

// ✅ FIX BUG 5: Giới hạn số lượng PDF cache tối đa để tránh IndexedDB phình to trên mobile
// Browser có thể xóa sạch IndexedDB khi bộ nhớ đầy → mất cache toàn bộ
// LRU: khi vượt MAX_CACHE_ENTRIES, xóa entry CŨ NHẤT (theo thứ tự key)
const MAX_CACHE_ENTRIES = 15;

/**
 * Tạo cache key gồm examId + pdfTelegramFileId.
 * Khi admin upload đề mới, fileId thay đổi → cache key mới → tự động invalidate entry cũ.
 */
export const makeCacheKey = (examId: string, fileId?: string): string =>
    fileId ? `${examId}__${fileId}` : examId;

// ✅ PERF FIX: Cache DB connection — tránh tạo IDBOpenDBRequest mới mỗi lần gọi
// Pattern giống db.ts, đảm bảo chỉ mở 1 kết nối duy nhất cho toàn bộ session
let _pdfCacheDB: IDBDatabase | null = null;

export const openPdfCacheDB = (): Promise<IDBDatabase> => {
    if (_pdfCacheDB) return Promise.resolve(_pdfCacheDB);
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(PDF_CACHE_DB, 2); // version 2: migrate từ base64 string → Blob
        req.onupgradeneeded = (e) => {
            const db = (e.target as IDBOpenDBRequest).result;
            // Xoá store cũ (chứa base64 string) nếu tồn tại để tránh lẫn lộn kiểu dữ liệu
            if (db.objectStoreNames.contains(PDF_CACHE_STORE)) {
                db.deleteObjectStore(PDF_CACHE_STORE);
            }
            db.createObjectStore(PDF_CACHE_STORE);
        };
        req.onsuccess = () => {
            _pdfCacheDB = req.result;
            // Reset cache khi connection đóng hoặc version thay đổi (pattern giống db.ts)
            _pdfCacheDB.onclose = () => { _pdfCacheDB = null; };
            _pdfCacheDB.onversionchange = () => { _pdfCacheDB?.close(); _pdfCacheDB = null; };
            resolve(_pdfCacheDB);
        };
        req.onerror = () => reject(req.error);
    });
};

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

// ✅ RELIABILITY FIX: await transaction để đảm bảo commit trước khi trả về
// Trước đây: không await tx.oncomplete → silent data loss nếu tab đóng ngay sau khi gọi
export const savePdfToCache = async (examId: string, pdfBlob: Blob, fileId?: string): Promise<void> => {
    try {
        const db = await openPdfCacheDB();
        const key = makeCacheKey(examId, fileId);

        // ✅ FIX BUG 5: LRU Eviction — xóa entry cũ nhất nếu vượt MAX_CACHE_ENTRIES
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(PDF_CACHE_STORE, 'readwrite');
            const store = tx.objectStore(PDF_CACHE_STORE);

            // Lấy danh sách tất cả key hiện có
            const keysReq = store.getAllKeys();
            keysReq.onsuccess = () => {
                const allKeys = keysReq.result as string[];
                // Xóa các entry cũ nếu đã đạt giới hạn (giữ MAX_CACHE_ENTRIES - 1 slot cho entry mới)
                const keysToDelete = allKeys
                    .filter(k => k !== key) // không xóa key hiện tại nếu đã tồn tại
                    .slice(0, Math.max(0, allKeys.length - MAX_CACHE_ENTRIES + 1));
                for (const k of keysToDelete) {
                    store.delete(k);
                    console.log(`[PdfCache] 🗑️ Evicted: ${k.substring(0, 20)}... (LRU limit ${MAX_CACHE_ENTRIES})`);
                }
                // Lưu blob mới
                store.put(pdfBlob, key);
            };
            keysReq.onerror = () => {
                // Fallback: save anyway nếu không đọc được keys
                store.put(pdfBlob, key);
            };

            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
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
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(PDF_CACHE_STORE, 'readwrite');
            tx.objectStore(PDF_CACHE_STORE).delete(key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch { /* silent */ }
};
