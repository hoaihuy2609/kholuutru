import type { BlogPost } from '../../types';
import { outcomeQuestionFingerprint, readOutcomeQuestions, sameOutcome,
  type OutcomeExport, type OutcomeSource, type OutcomeValue } from './outcomeExchange';

type StatementEdit = { index: number; claim?: string; verdict?: boolean };
type Fields = { question_text?: string; solution?: string; choices?: string[]; correctChoice?: string; statements?: StatementEdit[] };
type StoredFields = Record<string, unknown>;
export type QuestionCorrectionFile = {
  schema: 'physivault.questions.update.v1'; chapter_id: string; export_id: string;
  updates: { question_id: string; set: Fields }[];
};
export type FieldChange = { key: string; before: OutcomeValue; after: OutcomeValue };
export type QuestionCorrection = {
  source: OutcomeSource; afterFingerprint: string; fields: FieldChange[]; rootFields: FieldChange[];
};
export type QuestionCorrectionPreview = { changes: QuestionCorrection[]; errors: string[] };

const allowedFields = ['question_text', 'solution', 'choices', 'correctChoice', 'statements'];
const isObject = (value: unknown): value is StoredFields => !!value && typeof value === 'object' && !Array.isArray(value);
const hasOnly = (value: StoredFields, keys: string[]) => Object.keys(value).every(key => keys.includes(key));
const validText = (value: unknown) => typeof value === 'string' && !!value.trim() && value.length <= 30000;
const answer = (value: unknown) => typeof value === 'string' && /^[ABCD]$/.test(value);

export function parseQuestionCorrections(text: string): QuestionCorrectionFile {
  const data = JSON.parse(text.replace(/^\uFEFF/, ''));
  if (!isObject(data) || !hasOnly(data, ['schema', 'chapter_id', 'export_id', 'updates'])
    || data.schema !== 'physivault.questions.update.v1' || !validText(data.chapter_id) || !validText(data.export_id)
    || !Array.isArray(data.updates) || !data.updates.length || data.updates.length > 1000) {
    throw new Error('File sửa câu cần có schema physivault.questions.update.v1, chapter_id, export_id và updates.');
  }
  const ids = new Set<string>();
  for (const entry of data.updates) {
    if (!isObject(entry) || !hasOnly(entry, ['question_id', 'set']) || typeof entry.question_id !== 'string'
      || !entry.question_id.trim() || ids.has(entry.question_id)) {
      throw new Error('File có mã câu trùng, thiếu mã hoặc có trường ngoài mẫu.');
    }
    ids.add(entry.question_id);
    const patch = entry.set;
    const validStatements = (items: unknown) => {
      if (!Array.isArray(items) || !items.length || items.length > 4) return false;
      const indices = new Set<number>();
      for (const item of items) {
        if (!isObject(item) || !hasOnly(item, ['index', 'claim', 'verdict'])
          || typeof item.index !== 'number' || !Number.isInteger(item.index) || item.index < 0 || item.index > 3
          || indices.has(item.index) || (!('claim' in item) && !('verdict' in item))
          || ('claim' in item && !validText(item.claim)) || ('verdict' in item && typeof item.verdict !== 'boolean')) return false;
        indices.add(item.index);
      }
      return true;
    };
    if (!isObject(patch) || !Object.keys(patch).length || !hasOnly(patch, allowedFields)
      || ('question_text' in patch && !validText(patch.question_text))
      || ('solution' in patch && !validText(patch.solution))
      || ('correctChoice' in patch && !answer(patch.correctChoice))
      || ('choices' in patch && (!Array.isArray(patch.choices) || patch.choices.length !== 4 || !patch.choices.every(validText)))
      || ('statements' in patch && !validStatements(patch.statements))) {
      throw new Error(`Mã ${entry.question_id} có trường sửa không hợp lệ.`);
    }
  }
  return data as QuestionCorrectionFile;
}

const valueAt = (record: StoredFields, key: string): OutcomeValue => Object.hasOwn(record, key)
  ? { present: true, value: record[key] } : { present: false };
const newValue = (value: unknown): OutcomeValue => ({ present: true, value });

function changedFields(record: StoredFields, patch: StoredFields): FieldChange[] {
  return Object.entries(patch).flatMap(([key, value]) => {
    const before = valueAt(record, key);
    const after = newValue(value);
    return sameOutcome(before, after) ? [] : [{ key, before, after }];
  });
}

function writeFields(record: StoredFields, fields: FieldChange[], reverse = false) {
  for (const { key, before, after } of fields) {
    if (!sameOutcome(valueAt(record, key), reverse ? after : before)) throw new Error('Trường cần sửa đã thay đổi.');
    const next = reverse ? before : after;
    if (next.present) record[key] = next.value;
    else delete record[key];
  }
}

function checkMedia(before: unknown, after: string) {
  const assets = (value: unknown) => typeof value === 'string'
    ? value.match(/\[image(?::[^\]\r\n]+)?\]|!\[[^\]]*\]\([^\r\n]*?\)|<img\b[^>]*>/gi) ?? [] : [];
  if (JSON.stringify(assets(before)) !== JSON.stringify(assets(after))
    || /(?:pv-local-image:|data:image\/|blob:)/i.test(after)) {
    throw new Error('Nội dung sửa làm đổi vị trí hoặc tham chiếu ảnh.');
  }
}

function buildFields(question: StoredFields, input: Fields): FieldChange[] {
  const { statements, ...rest } = input;
  const patch: StoredFields = { ...rest };
  if (input.choices || input.correctChoice) {
    const current = question.choices;
    if (question.type !== 'trac_nghiem' || !Array.isArray(current) || current.length !== 4
      || !answer(input.correctChoice ?? question.correctChoice)) throw new Error('Câu không có đủ bốn phương án hoặc thiếu đáp án A–D.');
    input.choices?.forEach((item, index) => checkMedia(current[index], item));
  }
  if (statements) {
    const current = question.statements;
    if (question.type !== 'dung_sai' || !Array.isArray(current)) throw new Error('Câu không có mệnh đề Đúng/Sai.');
    const next = [...current];
    for (const { index, ...edit } of statements) {
      const statement = current[index];
      if (!isObject(statement) || String(statement.label).toLowerCase() !== 'abcd'[index]) {
        throw new Error(`Không đối chiếu được mệnh đề ${'abcd'[index]}.`);
      }
      if (edit.claim !== undefined) checkMedia(statement.claim, edit.claim);
      next[index] = { ...statement, ...edit };
    }
    patch.statements = next;
  }
  if (input.question_text !== undefined) checkMedia(question.question_text, input.question_text);
  if (input.solution !== undefined) {
    checkMedia(question.solution, input.solution);
    // Serializing a question also keeps a copy of its solution for older readers.
    for (const key of ['steps', 'solutionSteps']) {
      const steps = question[key];
      if (Array.isArray(steps) && steps.length === 1 && isObject(steps[0])
        && steps[0].text === question.solution && !steps[0].title && !steps[0].formula && !steps[0].formula2) {
        patch[key] = [{ ...steps[0], text: input.solution }];
      }
    }
  }
  return changedFields(question, patch);
}

function getQuestion(blog: BlogPost | undefined, source: OutcomeSource, chapterId: string, fingerprint: string) {
  if (!blog || blog.studySection?.chapterId !== chapterId) throw new Error('Câu đã bị xóa hoặc chuyển chương.');
  if ('pendingImages' in blog && blog.pendingImages) throw new Error('Ảnh đang chờ đồng bộ.');
  const parsed = readOutcomeQuestions(blog);
  const question = parsed.questions[source.index];
  if (!question || outcomeQuestionFingerprint(blog, question, source.index, parsed.questions.length) !== fingerprint) {
    throw new Error('Nội dung câu đã đổi kể từ khi đối chiếu.');
  }
  return { ...parsed, question };
}

function indexBlogs<T extends BlogPost>(blogs: T[]) {
  const map = new Map(blogs.map(blog => [blog.id, blog]));
  if (map.size !== blogs.length) throw new Error('Kho có mã bài trùng.');
  return map;
}

export function previewQuestionCorrections(blogs: BlogPost[], manifest: OutcomeExport, input: QuestionCorrectionFile): QuestionCorrectionPreview {
  if (manifest.chapter_id !== input.chapter_id || manifest.export_id !== input.export_id) throw new Error('File không khớp chương hoặc lượt xuất.');
  const sources = new Map(manifest.sources.map(source => [source.question_id, source]));
  const byId = indexBlogs(blogs);
  const changes: QuestionCorrection[] = [];
  const errors: string[] = [];
  for (const entry of input.updates) {
    const source = sources.get(entry.question_id);
    if (!source) { errors.push(`Mã ${entry.question_id} không có trong lượt xuất này.`); continue; }
    try {
      const blog = byId.get(source.blogId);
      const { question, questions, array, document } = getQuestion(blog, source, manifest.chapter_id, source.fingerprint);
      const fields = buildFields(question, entry.set);
      if (!fields.length) continue;
      const next = { ...question };
      writeFields(next, fields);
      const rootFields = array && source.index === 0 ? fields.filter(field => {
        const root = valueAt(document.data, field.key);
        return root.present && sameOutcome(root, field.before);
      }) : [];
      changes.push({ source, fields, rootFields,
        afterFingerprint: outcomeQuestionFingerprint(blog!, next, source.index, questions.length) });
    } catch (error) {
      errors.push(`${source.lesson} · ${source.label} · ${(error as Error).message}`);
    }
  }
  return { changes, errors };
}

export function patchQuestionCorrections<T extends BlogPost>(blogs: T[], chapterId: string, changes: QuestionCorrection[], reverse = false): T[] {
  const byId = indexBlogs(blogs);
  const documents = new Map<string, ReturnType<typeof readOutcomeQuestions>['document']>();
  for (const { source, fields, rootFields, afterFingerprint } of changes) {
    const blog = byId.get(source.blogId);
    const { document } = getQuestion(blog, source, chapterId, reverse ? afterFingerprint : source.fingerprint);
    const next = documents.get(source.blogId) ?? document;
    writeFields(next.data.questions?.length ? next.data.questions[source.index] : next.data, fields, reverse);
    writeFields(next.data, rootFields, reverse);
    documents.set(source.blogId, next);
  }
  const now = new Date().toISOString();
  return blogs.map(blog => documents.has(blog.id)
    ? { ...blog, content: JSON.stringify(documents.get(blog.id)), updated_at: now } : blog);
}
