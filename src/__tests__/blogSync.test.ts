import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { xorObfuscate } from '../lib/crypto';
import { packBlogSnapshot, unpackBlogSnapshot } from '../services/blogSnapshot';
import { useBlogStore } from '../stores/useContentStore';
import { classifyImportedQuestion } from '../utils/studyJsonImport';
import { getBlogImageReference } from '../utils/blogImageUploads';

const mocks = vi.hoisted(() => ({
    records: [] as { id: string }[],
    rpc: vi.fn(),
    proxyDownload: vi.fn(),
    index: vi.fn(),
    uploadImage: vi.fn(),
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
    dbUpdate: async (key: string, update: (value: any) => any) => {
        if (key === 'physivault_blogs_local') mocks.records = update(mocks.records);
        else mocks.cache.set(key, update(mocks.cache.get(key)));
    },
    dbSetBatch: async (entries: [string, unknown][]) => {
        for (const [key, value] of entries) mocks.cache.set(key, value);
    },
    dbUpdateBatch: async (keys: string[], update: (values: Record<string, unknown>) => Record<string, unknown>) => {
        const next = update(Object.fromEntries(keys.map(key => [key, key === 'physivault_blogs_local' ? mocks.records : mocks.cache.get(key)])));
        for (const [key, value] of Object.entries(next)) {
            if (key === 'physivault_blogs_local') mocks.records = value as typeof mocks.records;
            else mocks.cache.set(key, value);
        }
    },
}));
vi.mock('../lib/telegram', () => ({
    TELEGRAM_CHAT_ID: 'test-chat',
    CLOUDFLARE_PROXY_URL: 'https://telegram.test',
    ADMIN_AUTH_HEADER: '',
    fetchViaCloudflareProxy: mocks.proxyDownload,
}));
vi.mock('../services/tikzService', () => ({ uploadQuestionImageToTelegram: mocks.uploadImage }));

import { deleteEmptyStudyLesson, fetchBlogsForEditing, getStudyLibrary, resumeBlogImageUploads, resumeBlogSync, saveBlog, saveStudyLesson, saveStudyQuestionImport, syncBlogs } from '../services/blogService';

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
        mocks.uploadImage.mockReset();
        useBlogStore.setState({ syncStatus: 'idle', imageSyncStatus: 'idle' });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('khôi phục hàng đợi YCCĐ từ IndexedDB và xóa dấu chờ sau khi phát hành thành công', async () => {
        mocks.records = [{ id: 'outcome-edited' }];
        mocks.cache.set('pv_outcome_pending_sync', 'batch-recover');
        send.mockResolvedValue(telegramResponse('outcome-snapshot'));
        resumeBlogSync();
        await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1), { timeout: 5000 });
        await vi.waitFor(() => expect(mocks.cache.get('pv_outcome_pending_sync')).toBeNull());
        expect(mocks.records).toEqual([{ id: 'outcome-edited' }]);
    }, 10000);

    it('không thay bản YCCĐ mới bằng bản tải cũ khi cập nhật xảy ra trong lúc tải', async () => {
        mocks.records = [{ id: 'local-before' }];
        mocks.index.mockResolvedValue({ data: { telegram_file_id: 'remote-snapshot' }, error: null });
        let complete!: (buffer: ArrayBuffer) => void;
        mocks.proxyDownload.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
        const loading = fetchBlogsForEditing();
        await vi.waitFor(() => expect(complete).toBeDefined());
        mocks.records = [{ id: 'local-after-outcome-edit' }];
        mocks.cache.set('pv_outcome_pending_sync', 'new-batch');
        const snapshot = await packBlogSnapshot([{ id: 'remote-before' }]);
        complete(await snapshot.blob.arrayBuffer());
        expect(await loading).toMatchObject({ loaded: false, blogs: [{ id: 'local-after-outcome-edit' }] });
        expect(mocks.records).toEqual([{ id: 'local-after-outcome-edit' }]);
    });

    it('xóa đúng mục trống trùng tên và giữ mục còn câu hỏi nháp', async () => {
        const lesson = { id: 'populated', kind: 'study_lesson', title: 'Bài 4' };
        const emptyLesson = { ...lesson, id: 'empty' };
        const draft = { id: 'draft', is_published: false, studySection: { lessonId: lesson.id } };
        mocks.records = [emptyLesson, lesson, draft];

        expect(await deleteEmptyStudyLesson(lesson.id)).toBe('not_empty');
        expect(await deleteEmptyStudyLesson(emptyLesson.id)).toBe('deleted');
        expect(await deleteEmptyStudyLesson('missing')).toBe('failed');
        expect(mocks.records).toEqual([lesson, draft]);
    });

    it('lưu riêng hai tên bài trùng nhau theo nhóm và giữ nhóm khi đổi tên', async () => {
        mocks.records = [];
        const section = { chapterId: 'g10-ch4', questionType: 'trac_nghiem' } as const;
        const theory = await saveStudyLesson(section, 'Bài 1', undefined, 'ly_thuyet');
        const calculation = await saveStudyLesson(section, 'Bài 1', undefined, 'tinh_toan');
        const renamed = await saveStudyLesson(section, 'Bài 1. Động lượng', calculation!.id);

        expect(theory?.questionGroup).toBe('ly_thuyet');
        expect(renamed).toMatchObject({ id: calculation!.id, questionGroup: 'tinh_toan', title: 'Bài 1. Động lượng' });
        expect((await getStudyLibrary(true)).lessons).toEqual([theory, renamed]);
    });

    it('lưu trước khi ảnh tải xong và chỉ phát hành nội dung mới sau khi có mã Telegram', async () => {
        mocks.records = [];
        send.mockImplementation(async () => telegramResponse('snapshot'));
        let finishUpload!: (id: string) => void;
        mocks.uploadImage.mockImplementationOnce(() => new Promise<string>(resolve => { finishUpload = resolve; }));
        const old = await saveBlog({ title: 'Bản cũ', content: 'Nội dung cũ', is_published: true });
        const token = 'pv-local-image:force-test';
        const content = JSON.stringify({ file_id: token });
        const file = new File(['png'], 'force.png', { type: 'image/png' });
        const saved = await saveBlog({ id: old!.id, title: 'Bản mới', content, imageUploads: [{ token, file }] });
        expect(saved?.title).toBe('Bản mới');
        expect(getBlogImageReference(token).localUrl).toMatch(/^blob:/);
        expect((await getStudyLibrary(true)).blogs[0].content).toBe(content);
        await syncBlogs();
        const first = await unpackBlogSnapshot(new Uint8Array(await send.mock.calls[0][0].get('document').arrayBuffer()));
        expect(first).toEqual([old]);
        const latest = await saveBlog({ id: old!.id, title: 'Sửa tiếp khi chờ ảnh', content });
        expect(latest?.content).toBe(content);
        finishUpload('telegram-force');
        await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(2), { timeout: 5000 });
        await vi.waitFor(() => expect(useBlogStore.getState().syncStatus).toBe('synced'), { timeout: 5000 });
        const published = await unpackBlogSnapshot(new Uint8Array(await send.mock.calls.at(-1)![0].get('document').arrayBuffer()));
        expect(published).toEqual([expect.objectContaining({
            title: 'Sửa tiếp khi chờ ảnh', content: JSON.stringify({ file_id: 'telegram-force' }),
        })]);
        expect(JSON.stringify(published)).not.toMatch(/pendingImages|uploadedImages|pv-local-image/);
        expect(await saveBlog({ id: old!.id, content })).toMatchObject({ content: JSON.stringify({ file_id: 'telegram-force' }) });
        expect(mocks.uploadImage).toHaveBeenCalledTimes(1);
    }, 10000);

    it('giữ file khi lỗi và tiếp tục tải ở lần thử lại', async () => {
        mocks.records = [];
        send.mockResolvedValue(telegramResponse('snapshot'));
        mocks.uploadImage.mockResolvedValueOnce(null).mockResolvedValueOnce('telegram-retry');
        const token = 'pv-local-image:retry-test';
        const file = new File(['jpeg'], 'retry.jpg', { type: 'image/jpeg' });
        await saveBlog({ title: 'Câu mới', content: JSON.stringify({ file_id: token }), imageUploads: [{ token, file }] });
        await vi.waitFor(() => expect(useBlogStore.getState().imageSyncStatus).toBe('failed'));
        expect((await getStudyLibrary(true)).blogs[0].content).toContain(token);
        expect(send).not.toHaveBeenCalled();
        await resumeBlogImageUploads();
        expect(mocks.uploadImage.mock.calls).toEqual([[file], [file]]);
        expect((await getStudyLibrary(true)).blogs[0].content).toContain('telegram-retry');
        await vi.waitFor(() => expect(useBlogStore.getState().syncStatus).toBe('synced'), { timeout: 5000 });
    }, 10000);

    it('tách lô theo loại, tạo bài cùng tên rồi dùng lại và đánh số tiếp khi nhập thêm', async () => {
        const multipleChoice = { type: 'trac_nghiem', choices: ['A', 'B', 'C', 'D'], question_text: 'Câu trắc nghiệm' } as const;
        const shortAnswer = { type: 'tu_luan', question_text: 'Câu trả lời ngắn' } as const;
        expect(classifyImportedQuestion({ ...multipleChoice, choices: [...multipleChoice.choices] }).type).toBe('trac_nghiem');
        expect(classifyImportedQuestion(shortAnswer).type).toBe('tu_luan');
        expect(classifyImportedQuestion({ ...shortAnswer, choices: ['A', 'B', 'C', 'D'] }).type).toBeUndefined();
        expect(classifyImportedQuestion({ ...multipleChoice, choices: ['A', 'B'] }).type).toBeUndefined();

        const source = { id: 'source', kind: 'study_lesson', title: 'Bài 4', grade: 10,
            studySection: { chapterId: 'g10-ch4', questionType: 'trac_nghiem' }, is_published: false };
        mocks.records = [source];
        const options = { category: 'Lời giải', level: 2, published: true };
        const groups = [
            { type: 'trac_nghiem', questions: [multipleChoice] },
            { type: 'tu_luan', questions: [shortAnswer] },
        ] as const;
        const [mc, short] = await saveStudyQuestionImport(source.id,
            groups.map(group => ({ ...group, questions: [...group.questions] })), options);
        expect(mc.studySection?.lessonId).toBe(source.id);
        expect(short.studySection).toMatchObject({ chapterId: 'g10-ch4', questionType: 'tu_luan' });
        expect(short.studySection?.lessonId).not.toBe(source.id);
        const [next] = await saveStudyQuestionImport(source.id, [{ type: 'tu_luan', questions: [shortAnswer] }], options);
        expect(next.studySection?.lessonId).toBe(short.studySection?.lessonId);
        expect(JSON.parse(next.content).data.questions[0].question_no).toBe('Câu 2');
        expect((await getStudyLibrary(true)).lessons).toHaveLength(2);
        await expect(saveStudyQuestionImport(source.id, [
            { type: 'trac_nghiem', questions: [multipleChoice] },
            { type: 'tu_luan', lessonId: 'missing', questions: [shortAnswer] },
        ], options)).rejects.toThrow();
        expect((await getStudyLibrary(true)).blogs).toHaveLength(3);
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
