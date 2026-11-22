import type { BlogPost, StudyLesson, StudyQuestionType } from '../../types';
import { lessonLine } from '../data/lessonLines';
import { programmeRow, readProgrammeMatch } from '../data/programmeRows';
import { getStudyChapter, isStudyQuestionType, nextStudyQuestionNumber } from './studyLibrary';

/**
 * Nạp câu mới vào kho từ JSON (physivault.questions.create.v1). Mỗi nhóm là một bài trong kho (theo tên và loại câu);
 * bài chưa có thì được tạo. Mỗi nhóm thành một bài viết chứa các câu, đánh số tiếp theo số câu đã có của bài.
 * Câu được kiểm tra đủ trường theo loại, mức độ, dòng YCCĐ và YCCĐ chương trình trước khi lưu.
 */

export const QUESTION_CREATE_SCHEMA = 'physivault.questions.create.v1';
type Obj = Record<string, any>;
const object = (value: unknown): value is Obj => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown, max = 20000) => typeof value === 'string' && !!value.trim() && value.length <= max;
const level = (value: unknown) => value === 1 || value === 2 || value === 3;

export interface QuestionCreateGroup { lesson_title: string; type: StudyQuestionType; questions: Obj[] }
export interface QuestionCreateFile {
  schema: typeof QUESTION_CREATE_SCHEMA; chapter_id: string; import_id: string; source_note?: string; groups: QuestionCreateGroup[];
}
export interface QuestionCreateBatch {
  id: string; import_id: string; chapter_id: string; created_at: string; blog_ids: string[]; lesson_ids: string[];
  count: number; undone_at?: string;
}

const QUESTION_KEYS = ['type', 'question_text', 'choices', 'correctChoice', 'statements', 'cognitive_level', 'solution',
  'short_answer', 'spec_line', 'programme_row', 'programme_match', 'learning_outcomes', 'image_svg', 'image_layout', 'image_width'];

/** Lỗi của một câu (rỗng khi hợp lệ), viết để giáo viên đọc. */
function questionErrors(question: unknown, type: StudyQuestionType, chapterId: string): string[] {
  if (!object(question)) return ['không phải một câu hỏi.'];
  const errors: string[] = [];
  const unknown = Object.keys(question).filter(key => !QUESTION_KEYS.includes(key));
  if (unknown.length) errors.push('có trường lạ: ' + unknown.join(', ') + '.');
  if (question.type !== type) errors.push('loại câu khác loại của nhóm.');
  if (!text(question.question_text)) errors.push('thiếu đề bài.');
  if (!text(question.solution)) errors.push('thiếu lời giải.');
  const line = (value: unknown, need: number) => {
    const found = lessonLine(value);
    if (!found || found.chapterId !== chapterId) return 'dòng YCCĐ không thuộc chương.';
    return found.level === need ? '' : 'mức của dòng YCCĐ khác mức của câu.';
  };
  if (type === 'dung_sai') {
    const statements = question.statements;
    if (!Array.isArray(statements) || statements.length !== 4) errors.push('cần đủ 4 ý a, b, c, d.');
    else statements.forEach((item: unknown, index: number) => {
      const label = 'abcd'[index];
      if (!object(item) || item.label !== label || !text(item.claim, 3000) || typeof item.verdict !== 'boolean' || !level(item.cognitive_level)) {
        errors.push('ý ' + label + ' thiếu nội dung, đáp án Đúng/Sai hoặc mức độ.');
      } else if (item.spec_line !== undefined) {
        const problem = line(item.spec_line, item.cognitive_level);
        if (problem) errors.push('ý ' + label + ': ' + problem);
      }
    });
  } else {
    if (!level(question.cognitive_level)) errors.push('thiếu mức độ 1, 2 hoặc 3.');
    if (question.spec_line !== undefined) {
      const problem = line(question.spec_line, question.cognitive_level);
      if (problem) errors.push(problem);
    }
  }
  if (type === 'trac_nghiem') {
    if (!Array.isArray(question.choices) || question.choices.length !== 4 || !question.choices.every((choice: unknown) => text(choice, 3000))) {
      errors.push('cần đủ 4 phương án A, B, C, D.');
    }
    if (!['A', 'B', 'C', 'D'].includes(question.correctChoice)) errors.push('thiếu đáp án đúng A, B, C hoặc D.');
  }
  if (type === 'tu_luan' && !text(question.short_answer, 40)) errors.push('thiếu đáp số trả lời ngắn.');
  if (question.programme_row !== undefined && (programmeRow(question.programme_row)?.chapterId !== chapterId
    || !readProgrammeMatch(question.programme_match))) errors.push('YCCĐ chương trình không thuộc chương hoặc thiếu mức khớp.');
  if (question.image_svg !== undefined && !(typeof question.image_svg === 'string' && /^<svg[\s>]/.test(question.image_svg.trim())
    && question.image_svg.length <= 200000)) errors.push('hình vẽ phải là mã SVG.');
  if (question.image_layout !== undefined && !['auto', 'right', 'bottom'].includes(question.image_layout)) errors.push('kiểu đặt hình không hợp lệ.');
  if (question.learning_outcomes !== undefined && !(Array.isArray(question.learning_outcomes)
    && question.learning_outcomes.every((item: unknown) => text(item, 3000)))) errors.push('YCCĐ của câu không hợp lệ.');
  return errors;
}

export function parseQuestionCreateFile(input: string): QuestionCreateFile {
  const data = JSON.parse(input.replace(/^﻿/, ''));
  if (!object(data) || data.schema !== QUESTION_CREATE_SCHEMA || typeof data.chapter_id !== 'string' || !getStudyChapter(data.chapter_id)
    || !text(data.import_id, 200) || !Array.isArray(data.groups) || !data.groups.length || data.groups.length > 100
    || (data.source_note !== undefined && !text(data.source_note, 500))) {
    throw new Error('Cần file câu mới với schema ' + QUESTION_CREATE_SCHEMA + ', chapter_id, import_id và groups.');
  }
  const errors: string[] = [];
  data.groups.forEach((group: unknown, index: number) => {
    const name = 'Nhóm ' + (index + 1);
    if (!object(group) || !text(group.lesson_title, 200) || !isStudyQuestionType(group.type)
      || !Array.isArray(group.questions) || !group.questions.length || group.questions.length > 200) {
      errors.push(name + ': cần tên bài, loại câu và danh sách câu.');
      return;
    }
    group.questions.forEach((question: unknown, at: number) => {
      for (const problem of questionErrors(question, group.type, data.chapter_id)) errors.push(group.lesson_title + ' · câu ' + (at + 1) + ': ' + problem);
    });
  });
  if (errors.length) throw new Error(errors.slice(0, 20).join('\n') + (errors.length > 20 ? '\n… và ' + (errors.length - 20) + ' lỗi khác.' : ''));
  return data as QuestionCreateFile;
}

/** Câu lưu trong kho, cùng cách ghi với câu soạn trên web: lời giải chép sang các bước; trả lời ngắn ghi đáp số cuối lời giải. */
function storedQuestion(question: Obj, number: number, sourceNote?: string): Obj {
  const steps = (body: string) => [{ title: '', text: body, formula: '', formula2: '' }];
  const solution = question.type === 'tu_luan' ? question.solution.trim() + '\nTrả lời ngắn: ' + question.short_answer.trim() + '.' : question.solution;
  const stored: Obj = {
    question_no: 'Câu ' + number, question_text: question.question_text, question_latex: '', type: question.type,
    solution, tikz_code: '', image_svg: question.image_svg ?? '', image_url: '', image_telegram_file_id: '',
    image_layout: question.image_layout ?? 'auto',
    steps: question.type === 'tu_luan' ? steps(solution) : [],
    statements: question.type === 'dung_sai' ? question.statements.map((item: Obj) => ({
      label: item.label, claim: item.claim, claim_latex: '', verdict: item.verdict, steps: steps(''), cognitive_level: item.cognitive_level,
      ...(item.spec_line ? { spec_line: item.spec_line } : {}),
    })) : [],
    choices: question.type === 'trac_nghiem' ? question.choices : [],
    correctChoice: question.type === 'trac_nghiem' ? question.correctChoice : '',
    solutionSteps: question.type === 'trac_nghiem' ? steps(solution) : [],
  };
  if (question.type !== 'dung_sai') stored.cognitive_level = question.cognitive_level;
  if (question.spec_line) stored.spec_line = question.spec_line;
  if (question.programme_row) { stored.programme_row = question.programme_row; stored.programme_match = question.programme_match; }
  if (question.learning_outcomes) stored.learning_outcomes = question.learning_outcomes;
  if (typeof question.image_width === 'number') stored.image_width = question.image_width;
  if (sourceNote) stored.source_note = sourceNote;
  return stored;
}

export interface QuestionCreatePlan {
  lessons: StudyLesson[];
  blogs: BlogPost[];
  groups: { title: string; type: StudyQuestionType; newLesson: boolean; first: number; questions: Obj[] }[];
}

/** Bài, bài viết và câu sẽ thêm vào kho; không đổi bản ghi nào đã có. */
export function planQuestionCreate(records: readonly (BlogPost | StudyLesson)[], file: QuestionCreateFile,
  history: readonly QuestionCreateBatch[], now = new Date().toISOString(), newId: () => string = () => crypto.randomUUID()): QuestionCreatePlan {
  if (history.some(batch => batch.import_id === file.import_id && batch.chapter_id === file.chapter_id && !batch.undone_at)) {
    throw new Error('File này đã được nạp. Hoàn tác đợt trước nếu muốn nạp lại.');
  }
  const chapter = getStudyChapter(file.chapter_id)!;
  const existing = records.filter((record): record is StudyLesson => 'kind' in record && record.kind === 'study_lesson');
  const blogs = records.filter((record): record is BlogPost => !('kind' in record && record.kind === 'study_lesson'));
  const plan: QuestionCreatePlan = { lessons: [], blogs: [], groups: [] };
  for (const group of file.groups) {
    const same = (lesson: StudyLesson) => lesson.studySection.chapterId === chapter.id && lesson.studySection.questionType === group.type
      && lesson.title.trim() === group.lesson_title.trim();
    let lesson = existing.find(same) ?? plan.lessons.find(same);
    const newLesson = !lesson;
    if (!lesson) {
      lesson = { kind: 'study_lesson', id: newId(), title: group.lesson_title.trim(), grade: chapter.grade,
        studySection: { chapterId: chapter.id, questionType: group.type }, is_published: false };
      plan.lessons.push(lesson);
    }
    const studySection = { ...lesson.studySection, lessonId: lesson.id };
    const first = nextStudyQuestionNumber([...blogs, ...plan.blogs], studySection);
    const questions = group.questions.map((question, index) => storedQuestion(question, first + index, file.source_note));
    plan.blogs.push({ id: newId(), title: lesson.title, summary: questions[0].question_text.slice(0, 150),
      content: JSON.stringify({ type: 'physics_solution', data: { exam_name: lesson.title, ...questions[0], questions } }),
      cover_image: '', category: 'Lời giải', tags: file.source_note ? [file.source_note] : [], is_published: true,
      grade: chapter.grade, level: 0, studySection, created_at: now, updated_at: now });
    plan.groups.push({ title: lesson.title, type: group.type, newLesson, first, questions });
  }
  return plan;
}

/** Gỡ một đợt câu mới: xóa các bài viết của đợt (còn nguyên như lúc nạp) và các bài đã tạo nếu không còn câu nào khác. */
export function undoQuestionCreate(records: readonly (BlogPost | StudyLesson)[], batch: QuestionCreateBatch) {
  const isLesson = (record: BlogPost | StudyLesson): record is StudyLesson => 'kind' in record && record.kind === 'study_lesson';
  const ours = new Set(batch.blog_ids);
  const changed = records.filter(record => !isLesson(record) && ours.has(record.id) && record.updated_at !== batch.created_at);
  if (changed.length) throw new Error('Có ' + changed.length + ' bài của đợt này đã được sửa sau khi nạp. Hãy xóa tay các câu đó.');
  const kept = records.filter(record => isLesson(record) || !ours.has(record.id));
  const lessons = new Set(batch.lesson_ids);
  return kept.filter(record => !isLesson(record) || !lessons.has(record.id)
    || kept.some(other => !isLesson(other) && other.studySection?.lessonId === record.id));
}
