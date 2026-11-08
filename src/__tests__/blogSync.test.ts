import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { xorObfuscate } from '../lib/crypto';
import { packBlogSnapshot, unpackBlogSnapshot } from '../services/blogSnapshot';
import { useBlogStore } from '../stores/useContentStore';

const mocks = vi.hoisted(() => ({
    records: [] as { id: string }[],
    rpc: vi.fn(),
    proxyDownload: vi.fn(),
    index: vi.fn(),
    cache: new Map<string, unknown>(),
}));

vi.mock('../lib/supabase', () => ({
    supabase: {
        rpc: mocks.rpc,
        from: () => ({ select: () => ({ order: () => ({ limit: () => ({ maybeSingle: mocks.index }) }) }) }),
    },
}));
vi.mock('../lib/db', () => ({
    dbGet: async (key: string) => key === 'physivault_blogs_local' ? [...mocks.records] : mocks.cache.get(key),
    dbSetBatch: async (entries: [string, unknown][]) => {
        for (const [key, value] of entries) mocks.cache.set(key, value);
    },
}));
vi.mock('../lib/telegram', () => ({
    TELEGRAM_CHAT_ID: 'test-chat',
    CLOUDFLARE_PROXY_URL: 'https://telegram.test',
    ADMIN_AUTH_HEADER: '',
    fetchViaCloudflareProxy: mocks.proxyDownload,
}));

import { getStudyLibrary, resumeBlogSync, syncBlogs } from '../services/blogService';

const telegramResponse = (id: string) => Response.json({ result: { document: { file_id: id } } });

describe('blog snapshot sync', () => {
    const storage = new Map<string, string>();
    const send = vi.fn();

    beforeEach(() => {
        vi.stubGlobal('navigator', {});
        vi.stubGlobal('crypto', { randomUUID: () => Math.random().toString() });
        vi.stubGlobal('localStorage', {
            getItem: (key: string) => storage.get(key) ?? null,
            setItem: (key: string, value: string) => storage.set(key, value),
            removeItem: (key: string) => storage.delete(key),
        });
        vi.stubGlobal('fetch', (url: string, init: RequestInit) => url.endsWith('/proxy/sendDocument')
            ? send(init.body) : Promise.resolve(new Response(null)));
        send.mockReset();
        storage.clear();
        mocks.cache.clear();
        mocks.rpc.mockReset().mockResolvedValue({ error: null });
        mocks.index.mockReset();
        mocks.proxyDownload.mockReset();
        useBlogStore.setState({ syncStatus: 'idle' });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('gộp lần lưu gần nhau và gửi lượt tiếp theo nếu có thay đổi khi đang tải', async () => {
        let finishFirstUpload!: (response: Response) => void;
        send.mockImplementationOnce(() => new Promise<Response>(resolve => { finishFirstUpload = resolve; }))
            .mockResolvedValueOnce(telegramResponse('second'));
        mocks.records = [{ id: 'first' }];
        const first = syncBlogs();
        mocks.records.push({ id: 'second' });
        const second = syncBlogs();
        expect(useBlogStore.getState().syncStatus).toBe('syncing');
        expect(send).not.toHaveBeenCalled();

        await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1), { timeout: 5000 });
        mocks.records.push({ id: 'third' });
        const third = syncBlogs();
        finishFirstUpload(telegramResponse('first'));
        expect(await first).toMatchObject({ success: true, blogCount: 2 });
        expect(await second).toMatchObject({ success: true, blogCount: 2 });
        expect(useBlogStore.getState().syncStatus).toBe('syncing');

        expect(await third).toMatchObject({ success: true, blogCount: 3 });
        expect(send).toHaveBeenCalledTimes(2);
        expect(mocks.rpc).toHaveBeenLastCalledWith('admin_upsert_blog_index', {
            p_telegram_file_id: 'second',
            p_blog_count: 3,
        });
        expect(useBlogStore.getState().syncStatus).toBe('synced');
        expect(storage.size).toBe(0);
    }, 10000);

    it('giữ lượt chưa đồng bộ nếu cập nhật chỉ mục lỗi và gửi lại khi mở app', async () => {
        mocks.records = [{ id: 'retry' }];
        send.mockImplementation(async () => telegramResponse('retry'));
        mocks.rpc.mockResolvedValueOnce({ error: new Error('Unavailable') });
        const initial = syncBlogs();
        expect(await initial).toMatchObject({ success: false });
        expect(useBlogStore.getState().syncStatus).toBe('failed');
        expect(storage.size).toBe(1);

        resumeBlogSync();
        await vi.waitFor(() => expect(useBlogStore.getState().syncStatus).toBe('synced'), { timeout: 5000 });
        expect(storage.size).toBe(0);
    }, 10000);

    it('đọc được bản kho nén mới và tải lại khi mã file đổi', async () => {
        const first = [{ id: 'old', is_published: true }];
        const latest = Array.from({ length: 500 }, (_, index) => ({
            id: String(index),
            is_published: index % 5 !== 0,
            content: JSON.stringify({
                type: 'physics_solution',
                data: { question_text: `Câu ${index + 1}. Một vật chuyển động đều trên quãng đường ${(index * 71) % 467} m. Tính vận tốc của vật.` },
            }),
        }));
        const legacyBytes = new TextEncoder().encode(xorObfuscate(JSON.stringify(first)));
        const plainBytes = new TextEncoder().encode(JSON.stringify(first));
        expect(await unpackBlogSnapshot(legacyBytes)).toEqual(first);
        expect(await unpackBlogSnapshot(plainBytes)).toEqual(first);

        const before = performance.now();
        const oldSize = new Blob([xorObfuscate(JSON.stringify(latest))]).size;
        const oldPackMs = performance.now() - before;
        const after = performance.now();
        const { blob, name } = await packBlogSnapshot(latest);
        expect(name).toBe('blog_vault_v2.zip');
        expect(blob.size).toBeLessThan(oldSize);
        console.info(`500 câu thử: ${oldSize} → ${blob.size} byte, đóng gói ${oldPackMs.toFixed(1)} → ${(performance.now() - after).toFixed(1)} ms`);
        mocks.index.mockResolvedValueOnce({ data: { telegram_file_id: 'old' } })
            .mockResolvedValue({ data: { telegram_file_id: 'new' } });
        mocks.proxyDownload.mockResolvedValueOnce(legacyBytes.buffer).mockResolvedValue(await blob.arrayBuffer());
        expect((await getStudyLibrary(false)).blogs).toEqual(first);
        expect((await getStudyLibrary(false)).blogs).toEqual(latest.filter(blog => blog.is_published));
        await getStudyLibrary(false);
        expect(mocks.proxyDownload).toHaveBeenCalledTimes(2);
    });
});
