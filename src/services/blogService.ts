import { supabase } from '../lib/supabase';
import { dbGet, dbSet, dbUpdate } from '../lib/db';
import { fetchViaCloudflareProxy, TELEGRAM_CHAT_ID, CLOUDFLARE_PROXY_URL, ADMIN_AUTH_HEADER } from '../lib/telegram';
import { xorObfuscate, xorDeobfuscate } from '../lib/crypto';
import { BlogPost, StudyLesson, StudyLibrary, StudySection } from '../../types';
import { getStudyChapter, isStudyQuestionType } from '../utils/studyLibrary';

const BLOG_LOCAL_KEY = 'physivault_blogs_local';
const BLOG_READER_KEY = 'physivault_blogs_reader';
type BlogRecord = BlogPost | StudyLesson;

const isStudyLesson = (record: BlogRecord): record is StudyLesson =>
    'kind' in record && record.kind === 'study_lesson';
const isBlogPost = (record: BlogRecord): record is BlogPost => !isStudyLesson(record);

// ── Cloudflare Worker URL (dùng chung Worker với vault-index) ──
const VAULT_WORKER_URL = import.meta.env.VITE_VAULT_WORKER_URL || '';
const PURGE_SECRET = import.meta.env.VITE_VAULT_PURGE_SECRET || 'physivault-purge-2025';

// In-memory inflight lock — tránh nhiều tab cùng bắn vào Worker
let _blogInflight: Promise<string | null> | null = null;

async function getBlogIndexFileId(): Promise<string | null> {
    if (_blogInflight) return _blogInflight;
    _blogInflight = (async (): Promise<string | null> => {
        // Ưu tiên: Cloudflare Worker (cache 300s)
        if (VAULT_WORKER_URL) {
            try {
                const res = await fetch(`${VAULT_WORKER_URL}/blog-index`);
                if (res.ok) {
                    const data = await res.json();
                    const fid = Array.isArray(data) ? data[0]?.telegram_file_id : data?.telegram_file_id;
                    if (fid) return fid as string;
                }
            } catch { /* fallback Supabase */ }
        }
        // Fallback: hỏi Supabase trực tiếp
        try {
            const { data } = await supabase.from('blog_index')
                .select('telegram_file_id').order('updated_at', { ascending: false }).limit(1).maybeSingle();
            return data?.telegram_file_id || null;
        } catch { return null; }
    })();
    _blogInflight.finally(() => { _blogInflight = null; });
    return _blogInflight;
}

async function purgeBlogCache(): Promise<void> {
    if (!VAULT_WORKER_URL) return;
    try {
        await fetch(`${VAULT_WORKER_URL}/purge`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-purge-secret': PURGE_SECRET },
            body: JSON.stringify({ target: 'blog-index' }),
        });
    } catch { /* purge lỗi không ảnh hưởng luồng chính */ }
}

const getBlogRecords = async (isAdmin: boolean): Promise<BlogRecord[]> => {
    const cacheKey = isAdmin ? BLOG_LOCAL_KEY : BLOG_READER_KEY;
    const getCached = async (): Promise<BlogRecord[]> => {
        const cached: BlogRecord[] | undefined = await dbGet(cacheKey);
        if (cached || isAdmin) return cached ?? [];
        const oldCache: BlogRecord[] = await dbGet(BLOG_LOCAL_KEY) ?? [];
        return oldCache.filter(record => isBlogPost(record) && record.is_published);
    };
    try {
        const cached = await getCached();
        const lastFetch = Number(localStorage.getItem('pv_blog_last_fetch') || '0');
        if (cached.length && (isAdmin || Date.now() - lastFetch < 15 * 60 * 1000)) return cached;

        const fileId = await getBlogIndexFileId();
        if (!fileId) return cached;

        const records = await fetchBlogRecords(fileId);
        if (isAdmin) {
            // A local edit from another tab can land while the remote index loads.
            let current = records;
            await dbUpdate<BlogRecord[]>(cacheKey, local => {
                current = local?.length ? local : records;
                return current;
            });
            return current;
        }
        await dbSet(cacheKey, records);
        localStorage.setItem('pv_blog_last_fetch', String(Date.now()));
        return records;
    } catch (error) {
        console.warn('[Blog] Fetch thất bại, dùng cache local:', error);
        return getCached();
    }
};

async function fetchBlogRecords(fileId: string): Promise<BlogRecord[]> {
    const buffer = await fetchViaCloudflareProxy(fileId);
    const text = new TextDecoder().decode(buffer);
    const firstChar = text.charCodeAt(0);
    return (firstChar === 91 || firstChar === 123) ? JSON.parse(text) : JSON.parse(xorDeobfuscate(text));
}

export const getStudyLibrary = async (isAdmin: boolean): Promise<StudyLibrary> => {
    const records = await getBlogRecords(isAdmin);
    return {
        blogs: records.filter(isBlogPost).filter(blog => isAdmin || blog.is_published),
        lessons: records.filter(isStudyLesson),
    };
};

export const getBlogs = async (isAdmin: boolean): Promise<BlogPost[]> =>
    (await getStudyLibrary(isAdmin)).blogs;

export const saveBlog = async (blog: Partial<BlogPost>): Promise<BlogPost | null> => {
    try {
        let saved: BlogPost | null = null;
        await dbUpdate<BlogRecord[]>(BLOG_LOCAL_KEY, (records = []) => {
            const section = blog.studySection;
            if (section?.lessonId && !records.some(record => isStudyLesson(record)
                && record.id === section.lessonId && record.studySection.chapterId === section.chapterId
                && record.studySection.questionType === section.questionType)) return records;

            const now = new Date().toISOString();
            if (blog.id) {
                return records.map(record => {
                    if (!isBlogPost(record) || record.id !== blog.id) return record;
                    saved = { ...record, ...blog, updated_at: now };
                    return saved;
                });
            }
            saved = {
                id: crypto.randomUUID ? crypto.randomUUID() : 'blog_' + Date.now(),
                title: blog.title || '', summary: blog.summary || '', content: blog.content || '',
                cover_image: blog.cover_image || '', category: blog.category || '',
                tags: blog.tags || [], is_published: blog.is_published || false,
                grade: blog.grade ?? 0, level: blog.level ?? 0,
                ...(section ? { studySection: section } : {}),
                created_at: now, updated_at: now,
            };
            return [saved, ...records];
        });
        return saved;
    } catch (error) {
        console.error('[Blog] Lỗi saveBlog:', error);
        return null;
    }
};

export const saveStudyLesson = async (section: StudySection, title: string, id?: string): Promise<StudyLesson | null> => {
    const chapter = getStudyChapter(section.chapterId);
    const name = title.trim();
    if (!chapter || !name || !isStudyQuestionType(section.questionType)) return null;
    try {
        let saved: StudyLesson | null = null;
        await dbUpdate<BlogRecord[]>(BLOG_LOCAL_KEY, (records = []) => {
            if (id) {
                return records.map(record => {
                    if (!isStudyLesson(record) || record.id !== id || record.studySection.chapterId !== chapter.id
                        || record.studySection.questionType !== section.questionType) return record;
                    saved = { ...record, title: name };
                    return saved;
                });
            }
            saved = {
                kind: 'study_lesson', id: crypto.randomUUID(), title: name, grade: chapter.grade,
                studySection: { chapterId: chapter.id, questionType: section.questionType }, is_published: false,
            };
            return [...records, saved];
        });
        return saved;
    } catch (error) {
        console.error('[Blog] Lỗi lưu tên bài:', error);
        return null;
    }
};

export const deleteBlog = async (id: string): Promise<boolean> => {
    try {
        await dbUpdate<BlogRecord[]>(BLOG_LOCAL_KEY, (records = []) =>
            records.filter(record => isStudyLesson(record) || record.id !== id));
        return true;
    } catch (error) {
        console.error('[Blog] Lỗi deleteBlog:', error);
        return false;
    }
};

const uploadBlogRecords = async (onProgress?: (pct: number) => void): Promise<{ success: boolean; fileId?: string; blogCount: number }> => {
    try {
        if (onProgress) onProgress(5);
        const records: BlogRecord[] = await dbGet(BLOG_LOCAL_KEY) ?? [];
        const blogCount = records.filter(isBlogPost).length;
        const jsonStr = xorObfuscate(JSON.stringify(records));
        if (onProgress) onProgress(20);

        const blob = new Blob([jsonStr], { type: 'application/json' });
        const formData = new FormData();
        formData.append('chat_id', TELEGRAM_CHAT_ID);
        formData.append('document', blob, `blog_vault_v1.json`);
        formData.append('caption', `[BLOG-V1] ${blogCount} bài viết | ${new Date().toLocaleString('vi-VN')}`);

        const uploadRes = await fetch(`${CLOUDFLARE_PROXY_URL}/proxy/sendDocument`, {
            method: 'POST', headers: { 'Authorization': ADMIN_AUTH_HEADER }, body: formData
        });
        if (!uploadRes.ok) throw new Error(`Upload thất bại: ${uploadRes.statusText}`);
        const newFileId: string = (await uploadRes.json()).result.document.file_id;
        if (onProgress) onProgress(80);

        const { error: upsertErr } = await supabase.rpc('admin_upsert_blog_index', {
            p_telegram_file_id: newFileId,
            p_blog_count: blogCount,
        });
        if (upsertErr) throw upsertErr;
        if (onProgress) onProgress(95);
        // Keep this browser's reader preview in step with a successful publication.
        try {
            await dbSet(BLOG_READER_KEY, records);
            localStorage.setItem('pv_blog_last_fetch', String(Date.now()));
        } catch { /* The remote index has already been saved. */ }

        // Purge Cloudflare Worker cache ngay sau khi đăng bài mới
        purgeBlogCache().catch(() => {});

        try { fetchViaCloudflareProxy(newFileId).catch(() => { }); } catch { }

        if (onProgress) onProgress(100);
        return { success: true, fileId: newFileId, blogCount };
    } catch (e: any) {
        console.error('[Blog Sync] Lỗi:', e);
        return { success: false, blogCount: 0 };
    }
};

let pendingBlogSync: ReturnType<typeof uploadBlogRecords> | undefined;

export const syncBlogs = (onProgress?: (pct: number) => void) => {
    const sync = (pendingBlogSync ?? Promise.resolve()).then(() => uploadBlogRecords(onProgress));
    pendingBlogSync = sync;
    void sync.then(() => { if (pendingBlogSync === sync) pendingBlogSync = undefined; });
    return sync;
};

export const fetchBlogsForEditing = async (): Promise<{ blogs: BlogPost[]; loaded: boolean }> => {
    try {
        // Ưu tiên: Cloudflare Worker Cache (300s TTL) → Supabase fallback
        const fileId = await getBlogIndexFileId();
        if (!fileId) {
            const local: BlogRecord[] = await dbGet(BLOG_LOCAL_KEY) ?? [];
            return { blogs: local.filter(isBlogPost), loaded: false };
        }
        const records = await fetchBlogRecords(fileId);
        await dbSet(BLOG_LOCAL_KEY, records);
        return { blogs: records.filter(isBlogPost), loaded: true };
    } catch (e) {
        console.warn('[Blog] fetchBlogsForEditing thất bại, dùng local:', e);
        const local: BlogRecord[] = await dbGet(BLOG_LOCAL_KEY) ?? [];
        return { blogs: local.filter(isBlogPost), loaded: false };
    }
};
