import type { BlogPost, StudyLesson } from '../../types';
import { readOutcomeQuestions } from './outcomeExchange';

/** Công khai hàng loạt các bài câu hỏi đang để nháp của một chương, và hoàn tác. */
type Record_ = BlogPost | StudyLesson;
const isLesson = (record: Record_): record is StudyLesson => 'kind' in record && record.kind === 'study_lesson';
export interface DraftPost { id: string; title: string; type: string; count: number; pendingImages: boolean }
export interface PublishBatch { id: string; chapter_id: string; created_at: string; blog_ids: string[]; count: number; undone_at?: string }

/** Bài câu hỏi đang nháp của chương; bài còn ảnh đang tải lên được đánh dấu để bỏ qua. */
export function chapterDrafts(records: readonly Record_[], chapterId: string): DraftPost[] {
  return records.flatMap(record => {
    if (isLesson(record) || record.is_published || record.studySection?.chapterId !== chapterId || record.category === 'exam_paper') return [];
    let count = 0;
    try { count = readOutcomeQuestions(record).questions.length; } catch { count = 0; }
    return [{ id: record.id, title: record.title, type: record.studySection.questionType, count,
      pendingImages: !!(record as { pendingImages?: unknown }).pendingImages }];
  });
}

export function setPublished<T extends Record_>(records: readonly T[], ids: ReadonlySet<string>, published: boolean, now: string): T[] {
  return records.map(record => !isLesson(record) && ids.has(record.id) && record.is_published !== published
    ? { ...record, is_published: published, updated_at: now } : record);
}
