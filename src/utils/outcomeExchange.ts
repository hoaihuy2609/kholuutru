import CryptoJS from 'crypto-js';
import type { BlogPost, StudyLesson } from '../../types';
import { getStudyChapter, isStudyQuestionType } from './studyLibrary';
import { questionLevel } from './cognitiveLevels';

type JsonObject = Record<string, any>;
export type OutcomeValue = { present: boolean; value?: unknown };
export type OutcomeSource = {
  question_id: string; blogId: string; index: number; fingerprint: string;
  lesson: string; label: string; type: string; text: string; before: OutcomeValue; rootBefore?: OutcomeValue;
};
export type OutcomeExport = {
  export_id: string; chapter_id: string; created_at: string; sources: OutcomeSource[];
};
export type OutcomeUpdate = { question_id: string; learning_outcomes: string[] };
export type OutcomeResult = {
  schema: 'physivault.outcomes.update.v1'; export_id: string; chapter_id: string; updates: OutcomeUpdate[];
};
export type OutcomeChange = OutcomeSource & { after: OutcomeValue; rootAfter?: OutcomeValue };
export type OutcomePreview = {
  changes: OutcomeChange[]; unchanged: number; omitted: number; errors: string[];
};

const own = (obj: object, key: string) => Object.prototype.hasOwnProperty.call(obj, key);
const object = (value: unknown): value is JsonObject => !!value && typeof value === 'object' && !Array.isArray(value);
const canonical = (value: any): string => JSON.stringify(value, (_key, v) => object(v)
  ? Object.fromEntries(Object.keys(v).sort().map(key => [key, v[key]])) : v);
export const sameOutcome = (a: OutcomeValue, b: OutcomeValue) => canonical(a) === canonical(b);
const outcome = (question: JsonObject): OutcomeValue => own(question, 'learning_outcomes')
  ? { present: true, value: question.learning_outcomes } : { present: false };

export function readOutcomeQuestions(blog: BlogPost): { document: JsonObject; questions: JsonObject[]; array: boolean } {
  const document = JSON.parse(blog.content);
  if (document?.type !== 'physics_solution' || !object(document.data)) throw new Error('Không phải dữ liệu câu hỏi có cấu trúc');
  const array = Array.isArray(document.data.questions) && document.data.questions.length > 0;
  const questions = array ? document.data.questions : [document.data];
  if (questions.some((q: unknown) => !object(q) || !isStudyQuestionType(q.type))) throw new Error('Câu hỏi thiếu loại hoặc sai cấu trúc');
  return { document, questions, array };
}

export function outcomeQuestionFingerprint(blog: BlogPost, question: JsonObject, index: number, count: number) {
  // Classification fields (YCCĐ, level, programme row, lesson line) can change without invalidating a review of the content.
  const { learning_outcomes: _ignored, cognitive_level: _level, programme_row: _row, programme_match: _match, spec_line: _line, ...rest } = question;
  const content = { ...rest, ...(Array.isArray(rest.statements)
    ? { statements: rest.statements.map((statement: unknown) => {
      if (!object(statement)) return statement;
      const { cognitive_level: _statementLevel, spec_line: _statementLine, ...claim } = statement;
      return claim;
    }) } : {}) };
  return CryptoJS.SHA256(canonical({ question: content, index, count, section: blog.studySection,
    title: blog.title, level: blog.level, grade: blog.grade })).toString();
}

// Text-only exchange. Media remains in storage, references are included for human review.
function exportContext(question: JsonObject): JsonObject {
  return JSON.parse(JSON.stringify(question, (key, value) => {
    if (typeof value === 'string' && (/^(data:|blob:|pv-local-image:)/.test(value)
      || /^(imageSvg|image_svg)$/.test(key))) return '[Ảnh nhúng — cần xem ảnh gốc trên web]';
    return value;
  }));
}

export function makeOutcomeExport(blogs: BlogPost[], lessons: StudyLesson[], chapterId: string, exportId: string) {
  const chapter = getStudyChapter(chapterId);
  if (!chapter) throw new Error('Không tìm thấy chương.');
  const sources: OutcomeSource[] = [];
  const questions: JsonObject[] = [];
  const skipped: string[] = [];
  const seen = new Set<string>();
  const titles = new Map(lessons.map(lesson => [lesson.id, lesson.title]));
  for (const blog of blogs.filter(b => b.studySection?.chapterId === chapterId && b.category !== 'exam_paper')) {
    if (seen.has(blog.id)) throw new Error('Kho có mã bài trùng. Cần kiểm tra trước khi xuất.');
    seen.add(blog.id);
    let parsed: ReturnType<typeof readOutcomeQuestions>;
    try { parsed = readOutcomeQuestions(blog); }
    catch { skipped.push(blog.title + ' (' + blog.id + ')'); continue; }
    parsed.questions.forEach((q, index) => {
      const source: OutcomeSource = {
        question_id: `${blog.id}:${index}`, blogId: blog.id, index,
        fingerprint: outcomeQuestionFingerprint(blog, q, index, parsed.questions.length),
        lesson: titles.get(blog.studySection?.lessonId ?? '') ?? blog.title,
        label: String(q.question_no || `Câu ${index + 1}`), type: q.type,
        text: String(q.question_text ?? q.question_latex ?? ''), before: outcome(q),
        ...(parsed.array && index === 0 ? { rootBefore: outcome(parsed.document.data) } : {}),
      };
      sources.push(source);
      questions.push({ question_id: source.question_id, lesson: source.lesson, level: questionLevel(q, blog.level),
        is_published: blog.is_published, context: exportContext(q) });
    });
  }
  const manifest: OutcomeExport = { export_id: exportId, chapter_id: chapterId, created_at: new Date().toISOString(), sources };
  return {
    manifest, skipped,
    file: {
      schema: 'physivault.outcomes.review.v1', export_id: exportId, chapter_id: chapterId,
      chapter_name: chapter.name, created_at: manifest.created_at, question_count: sources.length,
      instructions: [
        'Chỉ rà và chuẩn hóa learning_outcomes. Giữ nguyên export_id, chapter_id, question_id.',
        'Đọc đề, đáp án và lời giải. Dùng cách diễn đạt nhất quán cho các câu cùng yêu cầu đánh giá.',
        'Không sửa mức độ, đề, đáp án, lời giải, ảnh hoặc mã câu. Không coi mã/tham chiếu ảnh là đã xem ảnh.',
        'Với Đúng/Sai, đọc từng mệnh đề để tổng hợp YCCĐ cho cả câu theo cấu trúc hiện tại.',
        'Câu thiếu dữ kiện hoặc cần ảnh chưa xem: bỏ khỏi updates, báo riêng cho người rà. Không đoán.',
        'Chỉ trả JSON theo result_format. Có thể trả một phần câu. Không trả mảng rỗng để xóa YCCĐ.',
      ],
      result_format: { schema: 'physivault.outcomes.update.v1', export_id: exportId, chapter_id: chapterId,
        updates: [{ question_id: sources[0]?.question_id ?? 'ID từ questions', learning_outcomes: ['Yêu cầu đánh giá cụ thể đã rà.'] }] },
      skipped_posts: skipped, questions,
    },
  };
}

function onlyKeys(value: JsonObject, allowed: string[]) {
  if (Object.keys(value).some(key => !allowed.includes(key))) throw new Error('File có trường ngoài mẫu cập nhật YCCĐ. Hãy dùng đúng result_format trong file xuất.');
}

export function parseOutcomeResult(text: string): OutcomeResult {
  const value = JSON.parse(text.replace(/^\uFEFF/, ''));
  if (!object(value) || value.schema !== 'physivault.outcomes.update.v1'
    || typeof value.export_id !== 'string' || typeof value.chapter_id !== 'string'
    || !Array.isArray(value.updates) || !value.updates.length || value.updates.length > 10000) {
    throw new Error('Không đúng file cập nhật YCCĐ. Cần schema, export_id, chapter_id và updates theo mẫu trong file xuất.');
  }
  onlyKeys(value, ['schema', 'export_id', 'chapter_id', 'updates']);
  const seen = new Set<string>();
  for (const update of value.updates) {
    if (!object(update)) throw new Error('Một dòng cập nhật không hợp lệ.');
    onlyKeys(update, ['question_id', 'learning_outcomes']);
    if (typeof update.question_id !== 'string' || !update.question_id || seen.has(update.question_id)) {
      throw new Error('File thiếu mã câu hoặc có mã câu trùng. Chưa cập nhật câu nào.');
    }
    seen.add(update.question_id);
    const list = update.learning_outcomes;
    if (!Array.isArray(list) || !list.length || list.length > 30
      || list.some(item => typeof item !== 'string' || !item.trim() || item.length > 3000)) {
      throw new Error(`YCCĐ của ${update.question_id} phải là danh sách 1–30 ý, mỗi ý không rỗng và tối đa 3.000 ký tự.`);
    }
    update.learning_outcomes = [...new Set(list.map(item => item.trim()))];
  }
  return value as OutcomeResult;
}

export function validateOutcomeChanges(blogs: BlogPost[], chapterId: string, changes: OutcomeChange[]) {
  const errors: string[] = [];
  const blogMap = new Map(blogs.map(blog => [blog.id, blog]));
  if (blogMap.size !== blogs.length) return ['Kho có mã bài trùng, cần kiểm tra trước khi cập nhật.'];
  for (const change of changes) {
    const label = `${change.lesson} · ${change.label}`;
    const blog = blogMap.get(change.blogId);
    if (!blog || blog.studySection?.chapterId !== chapterId) { errors.push(`${label}: câu đã bị xóa hoặc chuyển chương.`); continue; }
    if ((blog as any).pendingImages) { errors.push(`${label}: ảnh đang chờ đồng bộ.`); continue; }
    try {
      const { questions, document } = readOutcomeQuestions(blog);
      const q = questions[change.index];
      if (!q || outcomeQuestionFingerprint(blog, q, change.index, questions.length) !== change.fingerprint
        || !sameOutcome(outcome(q), change.before)
        || (change.rootBefore && !sameOutcome(outcome(document.data), change.rootBefore))) errors.push(`${label}: nội dung hoặc YCCĐ đã đổi. Hãy xuất lại để rà.`);
    } catch { errors.push(`${label}: cấu trúc câu đã đổi.`); }
  }
  return errors;
}

export function previewOutcomeResult(blogs: BlogPost[], manifest: OutcomeExport, result: OutcomeResult): OutcomePreview {
  if (manifest.export_id !== result.export_id || manifest.chapter_id !== result.chapter_id) throw new Error('File không thuộc lượt xuất/chương này.');
  const sources = new Map(manifest.sources.map(source => [source.question_id, source]));
  const candidates: OutcomeChange[] = [];
  const errors: string[] = [];
  for (const update of result.updates) {
    const source = sources.get(update.question_id);
    if (!source) errors.push(`Mã câu ${update.question_id} không có trong lượt xuất này.`);
    else candidates.push({ ...source, after: { present: true, value: update.learning_outcomes } });
  }
  errors.push(...validateOutcomeChanges(blogs, manifest.chapter_id, candidates));
  const changes = candidates.filter(change => !sameOutcome(change.before, change.after));
  return { changes, unchanged: candidates.length - changes.length,
    omitted: manifest.sources.length - candidates.length, errors };
}

function setOutcome(question: JsonObject, next: OutcomeValue) {
  if (next.present) question.learning_outcomes = next.value;
  else delete question.learning_outcomes;
}

// Apply only to freshly loaded records. No imported context or media is copied back.
export function patchOutcomeBlogs<T extends BlogPost>(blogs: T[], chapterId: string, changes: OutcomeChange[]): T[] {
  const errors = validateOutcomeChanges(blogs, chapterId, changes);
  if (errors.length) throw new Error(errors.join('\n'));
  const byBlog = new Map<string, OutcomeChange[]>();
  for (const change of changes) byBlog.set(change.blogId, [...(byBlog.get(change.blogId) ?? []), change]);
  return blogs.map(blog => {
    const edits = byBlog.get(blog.id);
    if (!edits) return blog;
    const { document, questions, array } = readOutcomeQuestions(blog);
    for (const edit of edits) {
      setOutcome(questions[edit.index], edit.after);
      // The editor stores the first question at data root too. Keep its mirror in step.
      if (array && edit.index === 0) setOutcome(document.data, edit.rootAfter ?? edit.after);
    }
    return { ...blog, content: JSON.stringify(document), updated_at: new Date().toISOString() };
  });
}

export const reverseOutcomeChanges = (changes: OutcomeChange[]): OutcomeChange[] => changes.map(change => ({
  ...change, before: change.after, after: change.before,
  ...(change.rootBefore ? { rootBefore: change.rootAfter ?? change.after, rootAfter: change.rootBefore } : {}),
}));
