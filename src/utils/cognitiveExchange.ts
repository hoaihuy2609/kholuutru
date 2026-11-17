import type { BlogPost } from '../../types';
import { outcomeQuestionFingerprint, readOutcomeQuestions, sameOutcome, type OutcomeExport, type OutcomeValue } from './outcomeExchange';
import type { FieldChange, QuestionCorrection } from './questionCorrections';

type LevelUpdate = { question_id: string; cognitive_level?: number; statement_levels?: number[]; learning_outcomes?: string[] };
export type CognitiveResult = {
  schema: 'physivault.cognitive.update.v1'; chapter_id: string; export_id: string; updates: LevelUpdate[];
};
export type CognitivePreview = { changes: QuestionCorrection[]; errors: string[]; unchanged: number };
type History = { export_id: string; chapter_id: string; created_at: string; undone_at?: string; changes: QuestionCorrection[] };
const object = (value: unknown): value is Record<string, any> => !!value && typeof value === 'object' && !Array.isArray(value);
const only = (value: Record<string, any>, keys: string[]) => Object.keys(value).every(key => keys.includes(key));
const validLevel = (value: unknown) => typeof value === 'number' && [1, 2, 3].includes(value);
const snapshot = (value: Record<string, any>, key: string): OutcomeValue => Object.hasOwn(value, key)
  ? { present: true, value: value[key] } : { present: false };

export function parseCognitiveResult(text: string): CognitiveResult {
  const input = JSON.parse(text.replace(/^\uFEFF/, ''));
  if (!object(input) || !only(input, ['schema', 'chapter_id', 'export_id', 'updates'])
    || input.schema !== 'physivault.cognitive.update.v1' || typeof input.chapter_id !== 'string'
    || typeof input.export_id !== 'string' || !Array.isArray(input.updates) || !input.updates.length || input.updates.length > 10000) {
    throw new Error('Cần file mức độ với schema physivault.cognitive.update.v1, chapter_id, export_id và updates.');
  }
  const seen = new Set<string>();
  for (const update of input.updates) {
    if (!object(update) || !only(update, ['question_id', 'cognitive_level', 'statement_levels', 'learning_outcomes'])
      || typeof update.question_id !== 'string' || !update.question_id || seen.has(update.question_id)
      || (('cognitive_level' in update) === ('statement_levels' in update))
      || ('cognitive_level' in update && !validLevel(update.cognitive_level))
      || ('statement_levels' in update && (!Array.isArray(update.statement_levels)
        || update.statement_levels.length !== 4 || !update.statement_levels.every(validLevel)))
      || ('learning_outcomes' in update && (!Array.isArray(update.learning_outcomes) || !update.learning_outcomes.length
        || update.learning_outcomes.length > 30 || update.learning_outcomes.some((line: unknown) =>
          typeof line !== 'string' || !line.trim() || line.length > 3000)))) {
      throw new Error('Mã câu hoặc mức độ không hợp lệ. Dùng 1, 2, 3. Đúng/Sai cần đủ mức độ của a, b, c, d.');
    }
    seen.add(update.question_id);
  }
  return input as CognitiveResult;
}

export function previewCognitiveResult(blogs: BlogPost[], manifest: OutcomeExport, result: CognitiveResult, history: History[]): CognitivePreview {
  if (result.chapter_id !== manifest.chapter_id || result.export_id !== manifest.export_id) throw new Error('File không thuộc chương hoặc lượt xuất này.');
  const sources = new Map(manifest.sources.map(source => [source.question_id, source]));
  const fingerprints = new Map(manifest.sources.map(source => [source.question_id, source.fingerprint]));
  const sourceErrors = new Set<string>();
  // Advance the original export only through corrections whose before/after fingerprints form a chain.
  for (const batch of [...history].filter(batch => !batch.undone_at
    && batch.export_id === result.export_id && batch.chapter_id === result.chapter_id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    for (const change of batch.changes) {
      const id = change.source.question_id;
      if (fingerprints.get(id) !== change.source.fingerprint) sourceErrors.add(id);
      else fingerprints.set(id, change.afterFingerprint);
    }
  }
  const blogMap = new Map(blogs.map(blog => [blog.id, blog]));
  if (blogs.length !== blogMap.size) throw new Error('Kho có mã bài trùng.');
  const changes: QuestionCorrection[] = [];
  const errors: string[] = [];
  let unchanged = 0;
  for (const update of result.updates) {
    const source = sources.get(update.question_id);
    if (!source) { errors.push('Mã câu không có trong lượt xuất: ' + update.question_id); continue; }
    try {
      if (sourceErrors.has(update.question_id)) throw new Error('Lịch sử sửa nội dung không liên tục. Cần xuất lại câu để rà.');
      const blog = blogMap.get(source.blogId);
      if (!blog || blog.studySection?.chapterId !== result.chapter_id) throw new Error('Câu đã xóa hoặc chuyển chương.');
      if ('pendingImages' in blog && blog.pendingImages) throw new Error('Ảnh đang chờ đồng bộ.');
      const { document, questions, array } = readOutcomeQuestions(blog);
      const question = questions[source.index];
      const fingerprint = question && outcomeQuestionFingerprint(blog, question, source.index, questions.length);
      if (fingerprint !== fingerprints.get(source.question_id)) throw new Error('Nội dung đã đổi ngoài các đợt sửa đã đối chiếu.');
      const patch: Record<string, unknown> = {};
      if (question.type === 'dung_sai') {
        if (!update.statement_levels || !Array.isArray(question.statements) || question.statements.length !== 4
          || question.statements.some((st: any, index: number) => String(st.label).toLowerCase() !== 'abcd'[index])) {
          throw new Error('Không khớp bốn mệnh đề a, b, c, d.');
        }
        patch.statements = question.statements.map((statement: any, index: number) =>
          ({ ...statement, cognitive_level: update.statement_levels![index] }));
      } else {
        if (update.cognitive_level === undefined) throw new Error('Trắc nghiệm và trả lời ngắn cần cognitive_level.');
        patch.cognitive_level = update.cognitive_level;
      }
      if (update.learning_outcomes) patch.learning_outcomes = update.learning_outcomes;
      const fields: FieldChange[] = Object.entries(patch).flatMap(([key, value]) => {
        const before = snapshot(question, key);
        const after = { present: true, value };
        return sameOutcome(before, after) ? [] : [{ key, before, after }];
      });
      if (!fields.length) { unchanged++; continue; }
      const rootFields = array && source.index === 0 ? fields.filter(field =>
        sameOutcome(snapshot(document.data, field.key), field.before) && (field.before.present
          || document.data.type === question.type)) : [];
      changes.push({ source: { ...source, fingerprint }, afterFingerprint: fingerprint, fields, rootFields });
    } catch (error) {
      errors.push(source.lesson + ' · ' + source.label + ' · ' + (error as Error).message);
    }
  }
  return { changes, errors, unchanged };
}
