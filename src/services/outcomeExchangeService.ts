import type { BlogPost, StudyLesson } from '../../types';
import { dbGet, dbUpdate, dbUpdateBatch } from '../lib/db';
import { fetchBlogsForEditing, getStudyLibrary, syncBlogs } from './blogService';
import { parseReviewPrintRequest, resolveReviewPrintCards } from '../utils/outcomeReviewPrint';
import { makeOutcomeExport, parseOutcomeResult, patchOutcomeBlogs, previewOutcomeResult, reverseOutcomeChanges, sameOutcome,
  type OutcomeChange, type OutcomeExport, type OutcomePreview, type OutcomeResult } from '../utils/outcomeExchange';
import { parseQuestionCorrections, patchQuestionCorrections, previewQuestionCorrections,
  type QuestionCorrection, type QuestionCorrectionFile } from '../utils/questionCorrections';
import { parseCognitiveResult, previewCognitiveResult, type CognitiveResult } from '../utils/cognitiveExchange';

const BLOGS = 'physivault_blogs_local';
const EXPORTS = 'pv_outcome_exports_v1';
const HISTORY = 'pv_outcome_history_v1';
const CORRECTION_HISTORY = 'pv_question_corrections_v1';
const COGNITIVE_HISTORY = 'pv_cognitive_history_v1';
export const OUTCOME_SYNC_KEY = 'pv_outcome_pending_sync';
type RecordItem = BlogPost | StudyLesson;
const isBlog = (item: RecordItem): item is BlogPost => !('kind' in item && item.kind === 'study_lesson');
export type OutcomeBatch = { id: string; chapter_id: string; created_at: string; export_id: string;
  changes: OutcomeChange[]; corrections?: QuestionCorrection[]; undone_at?: string };
export type ChapterOutcomeResult = OutcomeResult | {
  schema: 'physivault.outcomes.revision.v1'; chapter_id: string; export_id: string;
  updates: OutcomeResult['updates']; corrected_question_ids: string[];
  corrections: QuestionCorrectionFile['updates'];
};
export type ChapterOutcomePreview = OutcomePreview & { corrections?: QuestionCorrection[] };

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

function findManifest(manifests: OutcomeExport[], result: Pick<OutcomeResult, 'chapter_id' | 'export_id'>, chapterId: string) {
  if (result.chapter_id !== chapterId) throw new Error('File thuộc chương khác. Hãy mở đúng chương trước khi nhập.');
  const manifest = manifests.find(item => item.export_id === result.export_id);
  if (!manifest) throw new Error('Không có bản đối chiếu của lượt xuất này. Hãy nhập trên trình duyệt đã xuất file, hoặc xuất lại chương để xử lí.');
  return manifest;
}

export async function prepareOutcomeReviewPrint(chapterId: string, text: string) {
  const request = parseReviewPrintRequest(text);
  const manifest = findManifest(await dbGet(EXPORTS) ?? [], request, chapterId);
  const library = await freshLibrary();
  return resolveReviewPrintCards(library.blogs, manifest, request);
}

export async function reviewChapterOutcomes(chapterId: string, text: string) {
  const result = parseChapterOutcomeResult(text);
  const manifest = findManifest(await dbGet(EXPORTS) ?? [], result, chapterId);
  const library = await freshLibrary();
  const history: CorrectionBatch[] = result.schema === 'physivault.outcomes.revision.v1' ? await dbGet(CORRECTION_HISTORY) ?? [] : [];
  return { result, preview: prepareOutcomeRevision(library.blogs, manifest, result, history).preview };
}

function parseChapterOutcomeResult(text: string): ChapterOutcomeResult {
  const value = JSON.parse(text.replace(/^\uFEFF/, ''));
  if (value?.schema !== 'physivault.outcomes.revision.v1') return parseOutcomeResult(text);
  const { schema, chapter_id, export_id, updates, corrections, corrected_question_ids, ...extra } = value;
  if (Object.keys(extra).length || !Array.isArray(corrected_question_ids) || !corrected_question_ids.length
    || corrected_question_ids.some(id => typeof id !== 'string' || !id)
    || new Set(corrected_question_ids).size !== corrected_question_ids.length) throw new Error('Danh sách mã câu đã sửa không hợp lệ.');
  const outcomes = parseOutcomeResult(JSON.stringify({ schema: 'physivault.outcomes.update.v1', chapter_id, export_id, updates }));
  const patch = parseQuestionCorrections(JSON.stringify({ schema: 'physivault.questions.update.v1', chapter_id, export_id, updates: corrections }));
  const ids = new Set(outcomes.updates.map(update => update.question_id));
  const priorIds = new Set(corrected_question_ids);
  if (corrected_question_ids.some(id => !ids.has(id)) || patch.updates.some(edit => !priorIds.has(edit.question_id))) {
    throw new Error('Mã cần sửa thêm phải thuộc đợt sửa trước và có YCCĐ trong file.');
  }
  return { schema, chapter_id, export_id, updates: outcomes.updates, corrections: patch.updates, corrected_question_ids };
}

function prepareOutcomeRevision(blogs: BlogPost[], manifest: OutcomeExport, result: ChapterOutcomeResult, history: CorrectionBatch[])
  : { blogs: BlogPost[]; preview: ChapterOutcomePreview } {
  if (result.schema === 'physivault.outcomes.update.v1') return { blogs, preview: previewOutcomeResult(blogs, manifest, result) };
  const expectedIds = new Set(result.corrected_question_ids);
  const prior = history.find(batch => !batch.undone_at && batch.chapter_id === result.chapter_id && batch.export_id === result.export_id
    && batch.changes.length === expectedIds.size && batch.changes.every(change => expectedIds.has(change.source.question_id)));
  if (!prior) throw new Error('Không thấy đợt sửa nội dung trước trên trình duyệt này. Dùng trình duyệt đã áp dụng đợt sửa.');
  const repairedIds = new Map(prior.changes.map(change => [change.source.question_id, change]));
  const rebased = { ...manifest, sources: manifest.sources.map(source => {
    const repair = repairedIds.get(source.question_id);
    if (!repair) return source;
    if (repair.source.fingerprint !== source.fingerprint) throw new Error('Lịch sử sửa câu không khớp lượt xuất.');
    return { ...source, fingerprint: repair.afterFingerprint };
  }) };
  const correctionFile: QuestionCorrectionFile = { schema: 'physivault.questions.update.v1',
    chapter_id: result.chapter_id, export_id: result.export_id, updates: result.corrections };
  const { changes: corrections, errors } = previewQuestionCorrections(blogs, rebased, correctionFile);
  if (errors.length) return { blogs, preview: { changes: [], unchanged: 0, omitted: 0, errors, corrections } };
  const staged = patchQuestionCorrections(blogs, result.chapter_id, corrections);
  const corrected = new Map(corrections.map(change => [change.source.question_id, change.afterFingerprint]));
  const current = new Map(makeOutcomeExport(staged, [], result.chapter_id, result.export_id).manifest.sources.map(source => [source.question_id, source]));
  const updates = new Map(result.updates.map(update => [update.question_id, update.learning_outcomes]));
  const updatedManifest = { ...rebased, sources: rebased.sources.map(source => {
    const live = current.get(source.question_id);
    const target = updates.get(source.question_id);
    const desired = { present: true, value: target };
    return { ...source, fingerprint: corrected.get(source.question_id) ?? source.fingerprint,
      text: live?.text ?? source.text,
      before: live && target && sameOutcome(live.before, desired) ? live.before : source.before,
      rootBefore: live?.rootBefore && target && sameOutcome(live.rootBefore, desired) ? live.rootBefore : source.rootBefore };
  }) };
  const outcomeFile: OutcomeResult = { schema: 'physivault.outcomes.update.v1',
    chapter_id: result.chapter_id, export_id: result.export_id, updates: result.updates };
  return { blogs: staged, preview: { ...previewOutcomeResult(staged, updatedManifest, outcomeFile), corrections } };
}

export async function applyChapterOutcomes(chapterId: string, input: ChapterOutcomeResult): Promise<OutcomeBatch> {
  // Validate again at commit, including imports supplied by callers other than this UI.
  const result = parseChapterOutcomeResult(JSON.stringify(input));
  await freshLibrary();
  let batch!: OutcomeBatch;
  await dbUpdateBatch([BLOGS, EXPORTS, HISTORY, CORRECTION_HISTORY, OUTCOME_SYNC_KEY], values => {
    const records: RecordItem[] = values[BLOGS] ?? [];
    const manifest = findManifest(values[EXPORTS] ?? [], result, chapterId);
    const { blogs, preview } = prepareOutcomeRevision(records.filter(isBlog), manifest, result, values[CORRECTION_HISTORY] ?? []);
    if (preview.errors.length) throw new Error(preview.errors.join('\n'));
    if (!preview.changes.length && !preview.corrections?.length) throw new Error('Không có thay đổi để áp dụng.');
    const patched = new Map(patchOutcomeBlogs(blogs, chapterId, preview.changes).map(blog => [blog.id, blog]));
    batch = { id: crypto.randomUUID(), chapter_id: chapterId, export_id: result.export_id,
      created_at: new Date().toISOString(), changes: preview.changes, corrections: preview.corrections };
    return {
      [BLOGS]: records.map(record => isBlog(record) ? patched.get(record.id)! : record),
      [HISTORY]: [...(values[HISTORY] ?? []), batch], [OUTCOME_SYNC_KEY]: batch.id,
    };
  });
  void syncBlogs();
  return batch;
}

export async function reviewOutcomeUndo(chapterId: string, batchId: string): Promise<ChapterOutcomePreview> {
  const library = await freshLibrary();
  const batch = (await getOutcomeHistory(chapterId)).find(item => item.id === batchId && !item.undone_at);
  if (!batch) throw new Error('Không tìm thấy đợt cập nhật còn có thể hoàn tác.');
  const changes = reverseOutcomeChanges(batch.changes);
  // Reuse the guarded patch without writing anything.
  try {
    const restored = patchOutcomeBlogs(library.blogs, chapterId, changes);
    if (batch.corrections) patchQuestionCorrections(restored, chapterId, batch.corrections, true);
  }
  catch (error) { return { changes, unchanged: 0, omitted: 0, errors: [String((error as Error).message)] }; }
  return { changes, corrections: batch.corrections, unchanged: 0, omitted: 0, errors: [] };
}

export async function undoChapterOutcomes(chapterId: string, batchId: string) {
  await freshLibrary();
  await dbUpdateBatch([BLOGS, HISTORY, OUTCOME_SYNC_KEY], values => {
    const history: OutcomeBatch[] = values[HISTORY] ?? [];
    const batch = history.find(item => item.id === batchId && item.chapter_id === chapterId && !item.undone_at);
    if (!batch) throw new Error('Đợt cập nhật đã được hoàn tác hoặc không thuộc chương này.');
    const records: RecordItem[] = values[BLOGS] ?? [];
    const restored = patchOutcomeBlogs(records.filter(isBlog), chapterId, reverseOutcomeChanges(batch.changes));
    const next = batch.corrections ? patchQuestionCorrections(restored, chapterId, batch.corrections, true) : restored;
    const patched = new Map(next.map(blog => [blog.id, blog]));
    return {
      [BLOGS]: records.map(record => isBlog(record) ? patched.get(record.id)! : record),
      [HISTORY]: history.map(item => item.id === batchId ? { ...item, undone_at: new Date().toISOString() } : item),
      [OUTCOME_SYNC_KEY]: crypto.randomUUID(),
    };
  });
  void syncBlogs();
}

type CorrectionBatch = Omit<OutcomeBatch, 'changes'> & { changes: QuestionCorrection[] };

export async function getCorrectionHistory(chapterId: string): Promise<CorrectionBatch[]> {
  const history: CorrectionBatch[] = await dbGet(CORRECTION_HISTORY) ?? [];
  return history.filter(batch => batch.chapter_id === chapterId).reverse();
}

export async function reviewChapterCorrections(chapterId: string, text: string) {
  const input = parseQuestionCorrections(text);
  const manifest = findManifest(await dbGet(EXPORTS) ?? [], input, chapterId);
  const { blogs } = await freshLibrary();
  return { input, ...previewQuestionCorrections(blogs, manifest, input) };
}

export async function applyChapterCorrections(chapterId: string, input: QuestionCorrectionFile) {
  const result = parseQuestionCorrections(JSON.stringify(input));
  await freshLibrary();
  await dbUpdateBatch([BLOGS, EXPORTS, CORRECTION_HISTORY, OUTCOME_SYNC_KEY], values => {
    const records: RecordItem[] = values[BLOGS] ?? [];
    const manifest = findManifest(values[EXPORTS] ?? [], result, chapterId);
    const blogs = records.filter(isBlog);
    const { changes, errors } = previewQuestionCorrections(blogs, manifest, result);
    if (errors.length) throw new Error(errors.join('\n'));
    if (!changes.length) throw new Error('File không có nội dung thay đổi để áp dụng.');
    const patched = new Map(patchQuestionCorrections(blogs, chapterId, changes).map(blog => [blog.id, blog]));
    const batch: CorrectionBatch = {
      id: crypto.randomUUID(), chapter_id: chapterId, export_id: result.export_id,
      created_at: new Date().toISOString(), changes,
    };
    return {
      [BLOGS]: records.map(record => isBlog(record) ? patched.get(record.id)! : record),
      [CORRECTION_HISTORY]: [...(values[CORRECTION_HISTORY] ?? []), batch],
      [OUTCOME_SYNC_KEY]: batch.id,
    };
  });
  void syncBlogs();
}

export async function reviewCorrectionUndo(chapterId: string, batchId: string) {
  const batch = (await getCorrectionHistory(chapterId)).find(item => item.id === batchId && !item.undone_at);
  if (!batch) throw new Error('Không tìm thấy đợt sửa còn có thể hoàn tác.');
  const { blogs } = await freshLibrary();
  patchQuestionCorrections(blogs, chapterId, batch.changes, true);
  return batch.changes;
}

export async function undoChapterCorrections(chapterId: string, batchId: string) {
  await freshLibrary();
  await dbUpdateBatch([BLOGS, CORRECTION_HISTORY, OUTCOME_SYNC_KEY], values => {
    const history: CorrectionBatch[] = values[CORRECTION_HISTORY] ?? [];
    const batch = history.find(item => item.id === batchId && item.chapter_id === chapterId && !item.undone_at);
    if (!batch) throw new Error('Đợt sửa đã được hoàn tác hoặc không thuộc chương này.');
    const records: RecordItem[] = values[BLOGS] ?? [];
    const patched = new Map(patchQuestionCorrections(records.filter(isBlog), chapterId, batch.changes, true)
      .map(blog => [blog.id, blog]));
    return {
      [BLOGS]: records.map(record => isBlog(record) ? patched.get(record.id)! : record),
      [CORRECTION_HISTORY]: history.map(item => item.id === batch.id ? { ...item, undone_at: new Date().toISOString() } : item),
      [OUTCOME_SYNC_KEY]: crypto.randomUUID(),
    };
  });
  void syncBlogs();
}

function cognitivePreview(blogs: BlogPost[], manifest: OutcomeExport, result: CognitiveResult, values: Record<string, any>) {
  const outcomes: OutcomeBatch[] = values[HISTORY] ?? [];
  const history = [...(values[CORRECTION_HISTORY] ?? []),
    ...outcomes.filter(batch => batch.corrections?.length).map(batch => ({ ...batch, changes: batch.corrections! }))];
  return previewCognitiveResult(blogs, manifest, result, history);
}

export async function reviewChapterCognitive(chapterId: string, text: string) {
  const result = parseCognitiveResult(text);
  const manifest = findManifest(await dbGet(EXPORTS) ?? [], result, chapterId);
  const { blogs } = await freshLibrary();
  const values = { [HISTORY]: await dbGet(HISTORY), [CORRECTION_HISTORY]: await dbGet(CORRECTION_HISTORY) };
  return { result, preview: cognitivePreview(blogs, manifest, result, values) };
}

export async function getCognitiveHistory(chapterId: string): Promise<CorrectionBatch[]> {
  const history: CorrectionBatch[] = await dbGet(COGNITIVE_HISTORY) ?? [];
  return history.filter(batch => batch.chapter_id === chapterId).reverse();
}

export async function applyChapterCognitive(chapterId: string, input: CognitiveResult, reviewed?: QuestionCorrection[]) {
  const result = parseCognitiveResult(JSON.stringify(input));
  await freshLibrary();
  await dbUpdateBatch([BLOGS, EXPORTS, HISTORY, CORRECTION_HISTORY, COGNITIVE_HISTORY, OUTCOME_SYNC_KEY], values => {
    const records: RecordItem[] = values[BLOGS] ?? [];
    const blogs = records.filter(isBlog);
    if (reviewed) patchQuestionCorrections(blogs, chapterId, reviewed);
    const manifest = findManifest(values[EXPORTS] ?? [], result, chapterId);
    const preview = cognitivePreview(blogs, manifest, result, values);
    if (preview.errors.length) throw new Error(preview.errors.join('\n'));
    if (!preview.changes.length) throw new Error('Mức độ của các câu đã khớp file.');
    const patched = new Map(patchQuestionCorrections(blogs, chapterId, preview.changes).map(blog => [blog.id, blog]));
    const batch: CorrectionBatch = { id: crypto.randomUUID(), chapter_id: chapterId, export_id: result.export_id,
      created_at: new Date().toISOString(), changes: preview.changes };
    return {
      [BLOGS]: records.map(record => isBlog(record) ? patched.get(record.id)! : record),
      [COGNITIVE_HISTORY]: [...(values[COGNITIVE_HISTORY] ?? []), batch],
      [OUTCOME_SYNC_KEY]: batch.id,
    };
  });
  void syncBlogs();
}

export async function undoChapterCognitive(chapterId: string, batchId: string) {
  await freshLibrary();
  await dbUpdateBatch([BLOGS, COGNITIVE_HISTORY, OUTCOME_SYNC_KEY], values => {
    const history: CorrectionBatch[] = values[COGNITIVE_HISTORY] ?? [];
    const batch = history.find(item => item.chapter_id === chapterId && item.id === batchId && !item.undone_at);
    if (!batch) throw new Error('Không tìm thấy đợt mức độ còn có thể hoàn tác.');
    const records: RecordItem[] = values[BLOGS] ?? [];
    const patched = new Map(patchQuestionCorrections(records.filter(isBlog), chapterId, batch.changes, true)
      .map(blog => [blog.id, blog]));
    return {
      [BLOGS]: records.map(record => isBlog(record) ? patched.get(record.id)! : record),
      [COGNITIVE_HISTORY]: history.map(item => item.id === batch.id ? { ...item, undone_at: new Date().toISOString() } : item),
      [OUTCOME_SYNC_KEY]: crypto.randomUUID(),
    };
  });
  void syncBlogs();
}
