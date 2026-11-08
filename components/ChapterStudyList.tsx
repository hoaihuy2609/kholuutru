import React from 'react';
import { ChevronRight, FileText, ListChecks, Pencil, Plus, Scale, TextCursorInput } from 'lucide-react';
import type { BlogPost, StudyQuestionType, StudySection } from '../types';
import { STUDY_QUESTION_TYPES } from '../src/utils/studyLibrary';

const typeIcons = { trac_nghiem: ListChecks, dung_sai: Scale, tu_luan: TextCursorInput };
const focusStyle = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700';
const titleOrder = new Intl.Collator('vi', { numeric: true, sensitivity: 'base' });

export default function ChapterStudyList({
  chapter, selectedType, blogs, loading, onSelectType, onRead, onCreate, onEdit,
}: {
  chapter: { id: string; name: string; grade: number };
  selectedType?: StudyQuestionType;
  blogs: BlogPost[];
  loading: boolean;
  onSelectType: (type: StudyQuestionType) => void;
  onRead: (blog: BlogPost) => void;
  onCreate?: (section: StudySection) => void;
  onEdit?: (blog: BlogPost) => void;
}) {
  const byType: Record<StudyQuestionType, BlogPost[]> = { trac_nghiem: [], dung_sai: [], tu_luan: [] };
  for (const blog of blogs) {
    if (blog.studySection) byType[blog.studySection.questionType].push(blog);
  }
  const type = STUDY_QUESTION_TYPES.find(option => option.value === selectedType);

  return (
    <>
      <section aria-labelledby="study-chapter-title" className="space-y-3 rounded-xl border border-stone-200 bg-white p-3.5 sm:p-4">
        <div>
          <p className="text-xs font-semibold text-amber-800">Vật lý {chapter.grade}</p>
          <h2 id="study-chapter-title" className="mt-1 text-base font-bold text-stone-900">{chapter.name}</h2>
        </div>
        <div role="group" aria-label="Loại câu trong chương" className="grid gap-2 sm:grid-cols-3">
          {STUDY_QUESTION_TYPES.map(({ value, label }) => {
            const Icon = typeIcons[value];
            const active = value === selectedType;
            return (
              <button key={value} type="button" aria-pressed={active} onClick={() => onSelectType(value)}
                className={'flex min-h-12 items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-sm font-semibold '
                  + focusStyle + (active ? ' border-amber-300 bg-amber-50 text-amber-950' : ' border-stone-200 text-stone-700 hover:bg-stone-50')}>
                <Icon aria-hidden="true" className="size-4 shrink-0 text-amber-800" />
                <span className="flex-1">{label}</span>
                {!loading && <span className="shrink-0 rounded bg-stone-100 px-1.5 py-0.5 text-xs tabular-nums">{byType[value].length}</span>}
              </button>
            );
          })}
        </div>
      </section>

      {type && (
        <section aria-labelledby="study-list-title" className="rounded-xl border border-stone-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 px-3.5 py-2.5">
            <h3 id="study-list-title" className="text-sm font-bold text-stone-900">Danh sách bài · {type.label}</h3>
            {onCreate && (
              <button type="button" onClick={() => onCreate({ chapterId: chapter.id, questionType: type.value })}
                className={'inline-flex min-h-9 items-center gap-1.5 rounded-md bg-amber-800 px-2.5 text-xs font-semibold text-white hover:bg-amber-900 ' + focusStyle}>
                <Plus aria-hidden="true" className="size-4" /> Thêm bài
              </button>
            )}
          </div>
          {loading || byType[type.value].length === 0 ? (
            <p role="status" className="px-3.5 py-8 text-center text-sm text-stone-600">
              {loading ? 'Đang tải danh sách bài…' : 'Mục này chưa có bài.'}
            </p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {byType[type.value].sort((first, second) => titleOrder.compare(first.title, second.title)).map(blog => (
                <li key={blog.id} className="flex items-center gap-1 px-2 py-0.5 last:rounded-b-xl hover:bg-stone-50">
                  <button type="button" onClick={() => onRead(blog)}
                    className={'flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-2 text-left ' + focusStyle}>
                    <FileText aria-hidden="true" className="size-5 shrink-0 text-amber-800" />
                    <span className="min-w-0 flex-1 break-words text-sm font-semibold text-stone-900">{blog.title}</span>
                    {onEdit && !blog.is_published && <span className="rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-600">Nháp</span>}
                    <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-stone-500" />
                  </button>
                  {onEdit && (
                    <button type="button" aria-label={'Sửa ' + blog.title} title="Sửa bài" onClick={() => onEdit(blog)}
                      className={'grid size-9 shrink-0 place-items-center rounded-md text-stone-600 hover:bg-stone-200 ' + focusStyle}>
                      <Pencil aria-hidden="true" className="size-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}
