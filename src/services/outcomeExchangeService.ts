import type { BlogPost, StudyLesson } from '../../types';
import { dbGet, dbUpdate, dbUpdateBatch } from '../lib/db';
import { fetchBlogsForEditing, getStudyLibrary, syncBlogs } from './blogService';
import { makeOutcomeExport, parseOutcomeResult, patchOutcomeBlogs, previewOutcomeResult, reverseOutcomeChanges,
  type OutcomeChange, type OutcomeExport, type OutcomePreview, type OutcomeResult } from '../utils/outcomeExchange';

const BLOGS = 'physivault_blogs_local';
const EXPORTS = 'pv_outcome_exports_v1';
const HISTORY = 'pv_outcome_history_v1';
export const OUTCOME_SYNC_KEY = 'pv_outcome_pending_sync';
type RecordItem = BlogPost | StudyLesson;
const isBlog = (item: RecordItem): item is BlogPost => !('kind' in item && item.kind === 'study_lesson');
export type OutcomeBatch = { id: string; chapter_id: string; created_at: string; export_id: string;
  changes: OutcomeChange[]; undone_at?: string };

// Refresh the complete library, never the visible tab, search results or pagination.
async function freshLibrary() {
  const result = await fetchBlogsForEditing();
  if (!result.loaded) throw new Error('Chưa xác nhận được bản kho mới nhất. Hãy đợi ảnh và câu đồng bộ xong, kiểm tra mạng rồi thử lại.');
  return getStudyLibrary(true);
}

export async function exportChapterOutcomes(chapterId: string) {
  const library = await freshLibrary();
  const prepared = makeOutcomeExport(library.blogs, library.lessons, chapterId, crypto.randomUUID());
  if (!prepared.manifest.sources.length) throw new Error('Chương chưa có câu hỏi có cấu trúc để xuất.');
  await dbUpdate<OutcomeExport[]>(EXPORTS, (existing = []) => [...existing, prepared.manifest]);
  return prepared;
}

export async function getOutcomeHistory(chapterId: string): Promise<OutcomeBatch[]> {
  const history: OutcomeBatch[] = await dbGet(HISTORY) ?? [];
  return history.filter(batch => batch.chapter_id === chapterId).reverse();
}

function findManifest(manifests: OutcomeExport[], result: OutcomeResult, chapterId: string) {
  if (result.chapter_id !== chapterId) throw new Error('File thuộc chương khác. Hãy mở đúng chương trước khi nhập.');
  const manifest = manifests.find(item => item.export_id === result.export_id);
  if (!manifest) throw new Error('Không có bản đối chiếu của lượt xuất này. Hãy nhập trên trình duyệt đã xuất file, hoặc xuất lại chương để xử lí.');
  return manifest;
}

export async function reviewChapterOutcomes(chapterId: string, text: string) {
  const result = parseOutcomeResult(text);
  const manifest = findManifest(await dbGet(EXPORTS) ?? [], result, chapterId);
  const library = await freshLibrary();
  return { result, preview: previewOutcomeResult(library.blogs, manifest, result) };
}

export async function applyChapterOutcomes(chapterId: string, input: OutcomeResult): Promise<OutcomeBatch> {
  // Validate again at commit, including imports supplied by callers other than this UI.
  const result = parseOutcomeResult(JSON.stringify(input));
  await freshLibrary();
  let batch!: OutcomeBatch;
  await dbUpdateBatch([BLOGS, EXPORTS, HISTORY, OUTCOME_SYNC_KEY], values => {
    const records: RecordItem[] = values[BLOGS] ?? [];
    const manifest = findManifest(values[EXPORTS] ?? [], result, chapterId);
    const blogs = records.filter(isBlog);
    const preview = previewOutcomeResult(blogs, manifest, result);
    if (preview.errors.length) throw new Error(preview.errors.join('\n'));
    if (!preview.changes.length) throw new Error('Không có YCCĐ thay đổi để áp dụng.');
    const patched = new Map(patchOutcomeBlogs(blogs, chapterId, preview.changes).map(blog => [blog.id, blog]));
    batch = { id: crypto.randomUUID(), chapter_id: chapterId, export_id: result.export_id,
      created_at: new Date().toISOString(), changes: preview.changes };
    return {
      [BLOGS]: records.map(record => isBlog(record) ? patched.get(record.id)! : record),
      [HISTORY]: [...(values[HISTORY] ?? []), batch], [OUTCOME_SYNC_KEY]: batch.id,
    };
  });
  void syncBlogs();
  return batch;
}

export async function reviewOutcomeUndo(chapterId: string, batchId: string): Promise<OutcomePreview> {
  const library = await freshLibrary();
  const batch = (await getOutcomeHistory(chapterId)).find(item => item.id === batchId && !item.undone_at);
  if (!batch) throw new Error('Không tìm thấy đợt cập nhật còn có thể hoàn tác.');
  const changes = reverseOutcomeChanges(batch.changes);
  // Reuse the guarded patch without writing anything.
  try { patchOutcomeBlogs(library.blogs, chapterId, changes); }
  catch (error) { return { changes, unchanged: 0, omitted: 0, errors: [String((error as Error).message)] }; }
  return { changes, unchanged: 0, omitted: 0, errors: [] };
}

export async function undoChapterOutcomes(chapterId: string, batchId: string) {
  await freshLibrary();
  await dbUpdateBatch([BLOGS, HISTORY, OUTCOME_SYNC_KEY], values => {
    const history: OutcomeBatch[] = values[HISTORY] ?? [];
    const batch = history.find(item => item.id === batchId && item.chapter_id === chapterId && !item.undone_at);
    if (!batch) throw new Error('Đợt cập nhật đã được hoàn tác hoặc không thuộc chương này.');
    const records: RecordItem[] = values[BLOGS] ?? [];
    const patched = new Map(patchOutcomeBlogs(records.filter(isBlog), chapterId,
      reverseOutcomeChanges(batch.changes)).map(blog => [blog.id, blog]));
    return {
      [BLOGS]: records.map(record => isBlog(record) ? patched.get(record.id)! : record),
      [HISTORY]: history.map(item => item.id === batchId ? { ...item, undone_at: new Date().toISOString() } : item),
      [OUTCOME_SYNC_KEY]: crypto.randomUUID(),
    };
  });
  void syncBlogs();
}
