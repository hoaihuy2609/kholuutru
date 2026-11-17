import type { BlogPost } from '../../types';
import { outcomeQuestionFingerprint, readOutcomeQuestions, type OutcomeExport } from './outcomeExchange';
import { readStudyImages, studyImageSrc } from './studyImages';
import { STUDY_QUESTION_GROUPS } from './studyLibrary';

export const reviewSections = {
  image: 'Cần xem hình',
  content: 'Cần rà đề hoặc lời giải',
};
type ReviewEntry = { question_id: string; group: keyof typeof reviewSections; note: string };
export type ReviewPrintRequest = { chapter_id: string; export_id: string; questions: ReviewEntry[] };
export type ReviewPrintCard = ReviewEntry & {
  lesson: string; label: string; type: string; questionGroups: string[]; content: string; missingImage: boolean;
};

export function parseReviewPrintRequest(text: string): ReviewPrintRequest {
  const value = JSON.parse(text.replace(/^\uFEFF/, ''));
  if (value?.schema !== 'physivault.outcomes.print-review.v1'
    || typeof value.chapter_id !== 'string' || !value.chapter_id
    || typeof value.export_id !== 'string' || !value.export_id
    || !Array.isArray(value.questions) || !value.questions.length || value.questions.length > 1000) {
    throw new Error('Hãy chọn file danh sách câu để in PDF rà.');
  }
  const seen = new Set<string>();
  for (const entry of value.questions) {
    if (typeof entry?.question_id !== 'string' || !entry.question_id
      || (entry.group !== 'image' && entry.group !== 'content')
      || typeof entry.note !== 'string' || !entry.note.trim() || entry.note.length > 3000) {
      throw new Error('Danh sách có dòng thiếu mã câu, nhóm hoặc ghi chú hợp lệ.');
    }
    if (seen.has(entry.question_id)) throw new Error(`Mã câu bị trùng: ${entry.question_id}.`);
    seen.add(entry.question_id);
  }
  return value;
}

export function resolveReviewPrintCards(blogs: BlogPost[], manifest: OutcomeExport, request: ReviewPrintRequest) {
  if (request.chapter_id !== manifest.chapter_id || request.export_id !== manifest.export_id) {
    throw new Error('Danh sách khác chương hoặc khác lượt xuất.');
  }
  const sources = new Map(manifest.sources.map(source => [source.question_id, source]));
  const posts = new Map(blogs.map(blog => [blog.id, blog]));
  if (posts.size !== blogs.length) throw new Error('Kho có mã bài trùng.');
  const cards: ReviewPrintCard[] = [];
  const issues: string[] = [];
  for (const entry of request.questions) {
    const source = sources.get(entry.question_id);
    if (!source) { issues.push(`${entry.question_id} không có trong lượt xuất này.`); continue; }
    const name = `${source.lesson} · ${source.label} · ${entry.question_id}`;
    const blog = posts.get(source.blogId);
    if (!blog || blog.studySection?.chapterId !== manifest.chapter_id) {
      issues.push(`${name} đã bị xóa hoặc chuyển chương.`); continue;
    }
    try {
      const { document, questions, array } = readOutcomeQuestions(blog);
      const question = questions[source.index];
      if (!question || outcomeQuestionFingerprint(blog, question, source.index, questions.length) !== source.fingerprint) {
        issues.push(`${name} đã đổi nội dung hoặc vị trí kể từ lúc xuất.`); continue;
      }
      const images = [...readStudyImages(question.question_images), ...readStudyImages(question.solution_images)];
      const primary = {
        file_id: question.image_telegram_file_id || question.imageTelegramFileId,
        url: question.image_url || question.imageUrl,
        svg: question.image_svg || question.imageSvg,
      };
      const hasPrimary = Boolean(studyImageSrc(primary));
      const missingImage = images.some(img => !studyImageSrc(img))
        || Boolean((primary.file_id || question.tikz_code || question.tikzCode) && !hasPrimary)
        || (entry.group === 'image' && !hasPrimary && !images.some(studyImageSrc));
      cards.push({ ...entry, lesson: source.lesson, label: source.label, type: source.type, missingImage,
        questionGroups: STUDY_QUESTION_GROUPS.filter(group => Array.isArray(question.question_groups)
          && question.question_groups.includes(group.value)).map(group => group.label),
        content: JSON.stringify(array ? { ...document, data: { ...document.data, questions: [question] } } : document) });
    } catch {
      issues.push(`${name} không đọc được nội dung.`);
    }
  }
  return { cards, issues, total: request.questions.length };
}
