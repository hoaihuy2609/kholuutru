const DB_NAME = 'PhysiVaultDB';
const DB_VERSION = 1;
const STORE_NAME = 'app_data';

let _dbCache: IDBDatabase | null = null;

export const openDB = (): Promise<IDBDatabase> => {
    if (_dbCache) return Promise.resolve(_dbCache);
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = () => {
            _dbCache = request.result;
            _dbCache.onclose = () => { _dbCache = null; };
            _dbCache.onversionchange = () => { _dbCache?.close(); _dbCache = null; };
            resolve(_dbCache);
        };
        request.onerror = () => reject(request.error);
    });
};

export const dbGet = async (key: string): Promise<any> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

export const dbSet = async (key: string, value: any): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(value, key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

export const dbUpdate = async <T>(key: string, update: (current: T | undefined) => T): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(key);
        request.onsuccess = () => {
            try {
                store.put(update(request.result), key);
            } catch (error) {
                reject(error);
                tx.abort();
            }
        };
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(tx.error);
    });
};

export const dbSetBatch = async (entries: [string, any][]): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        for (const [key, value] of entries) {
            store.put(value, key);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
};

// Read/validate/write related keys in one transaction, including the rollback journal.
export const dbUpdateBatch = async (
    keys: string[], update: (values: Record<string, any>) => Record<string, any>,
): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const values: Record<string, any> = {};
        let remaining = keys.length;
        for (const key of keys) {
            const request = store.get(key);
            request.onsuccess = () => {
                values[key] = request.result;
                if (--remaining) return;
                try {
                    const next = update(values);
                    for (const [name, value] of Object.entries(next)) {
                        if (!keys.includes(name)) throw new Error('Transaction key was not declared');
                        store.put(value, name);
                    }
                } catch (error) {
                    reject(error);
                    tx.abort();
                }
            };
        }
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(tx.error ?? new Error('Không lưu được giao dịch. Chưa áp dụng thay đổi.'));
        tx.onerror = () => reject(tx.error);
    });
};
