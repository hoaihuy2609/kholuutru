import React, { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, FileText, Folder, ListChecks, Pencil, Plus, Scale, TextCursorInput } from 'lucide-react';
import type { BlogPost, StudyLesson, StudyQuestionType, StudySection } from '../types';
import { STUDY_QUESTION_TYPES } from '../src/utils/studyLibrary';

const typeIcons = { trac_nghiem: ListChecks, dung_sai: Scale, tu_luan: TextCursorInput };
const focusStyle = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700';
const titleOrder = new Intl.Collator('vi', { numeric: true, sensitivity: 'base' });
const addButton = 'inline-flex min-h-9 items-center gap-1.5 rounded-md bg-amber-800 px-2.5 text-xs font-semibold text-white hover:bg-amber-900 ' + focusStyle;

function PostRows({ posts, onRead, onEdit }: {
  posts: BlogPost[];
  onRead: (blog: BlogPost) => void;
  onEdit?: (blog: BlogPost) => void;
}) {
  return (
    <ul className="divide-y divide-stone-100">
      {[...posts].sort((first, second) => titleOrder.compare(first.title, second.title)).map(blog => (
        <li key={blog.id} className="flex items-center gap-1 px-2 py-0.5 hover:bg-stone-50">
          <button type="button" onClick={() => onRead(blog)}
            className={'flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-2 text-left ' + focusStyle}>
            <FileText aria-hidden="true" className="size-5 shrink-0 text-amber-800" />
            <span className="min-w-0 flex-1 break-words text-sm font-semibold text-stone-900">{blog.title}</span>
            {onEdit && !blog.is_published && <span className="rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-600">Nháp</span>}
            <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-stone-500" />
          </button>
          {onEdit && (
            <button type="button" aria-label={'Sửa nội dung ' + blog.title} title="Sửa nội dung" onClick={() => onEdit(blog)}
              className={'grid size-9 shrink-0 place-items-center rounded-md text-stone-600 hover:bg-stone-200 ' + focusStyle}>
              <Pencil aria-hidden="true" className="size-4" />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function ChapterStudyList({
  chapter, selectedType, selectedLessonId, blogs, lessons, loading, onSelectType, onSelectLesson,
  onRead, onCreate, onEdit, onSaveLesson, lessonSync, onRetryLessonSync, renderLessonPosts,
}: {
  chapter: { id: string; name: string; grade: number };
  selectedType?: StudyQuestionType;
  selectedLessonId?: string;
  blogs: BlogPost[];
  lessons: StudyLesson[];
  loading: boolean;
  onSelectType: (type: StudyQuestionType) => void;
  onSelectLesson: (id?: string) => void;
  onRead: (blog: BlogPost) => void;
  onCreate?: (section: StudySection) => void;
  onEdit?: (blog: BlogPost) => void;
  renderLessonPosts: (posts: BlogPost[]) => React.ReactNode;
  onSaveLesson?: (section: StudySection, title: string, id?: string) => Promise<StudyLesson | null>;
  lessonSync?: 'syncing' | 'failed';
  onRetryLessonSync?: () => void;
}) {
  const [nameEditor, setNameEditor] = useState<StudyLesson | 'new' | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const savingRef = useRef(false);
  const lessonsById = new Map(lessons.map(lesson => [lesson.id, lesson]));
  const postsByLesson = new Map<string, BlogPost[]>();
  const loosePosts: Record<StudyQuestionType, BlogPost[]> = { trac_nghiem: [], dung_sai: [], tu_luan: [] };
  for (const blog of blogs) {
    const section = blog.studySection;
    if (!section) continue;
    const parent = section.lessonId ? lessonsById.get(section.lessonId) : undefined;
    if (!parent || parent.studySection.questionType !== section.questionType) {
      loosePosts[section.questionType].push(blog);
      continue;
    }
    const posts = postsByLesson.get(parent.id) ?? [];
    posts.push(blog);
    postsByLesson.set(parent.id, posts);
  }
  const type = STUDY_QUESTION_TYPES.find(option => option.value === selectedType);
  const sectionLessons = lessons.filter(lesson => lesson.studySection.questionType === selectedType)
    .sort((first, second) => titleOrder.compare(first.title, second.title));
  const activeLesson = sectionLessons.find(lesson => lesson.id === selectedLessonId);
  const lessonPosts = activeLesson ? postsByLesson.get(activeLesson.id) ?? [] : [];

  const openNameEditor = (lesson: StudyLesson | 'new') => {
    setName(lesson === 'new' ? '' : lesson.title);
    setSaveError(false);
    setNameEditor(lesson);
  };

  const saveName = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!type || !onSaveLesson || !nameEditor || !name.trim() || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError(false);
    try {
      const saved = await onSaveLesson({ chapterId: chapter.id, questionType: type.value }, name.trim(),
        nameEditor === 'new' ? undefined : nameEditor.id);
      if (saved) setNameEditor(null);
      else setSaveError(true);
    } catch {
      setSaveError(true);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

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
                {!loading && <span className="shrink-0 rounded bg-stone-100 px-1.5 py-0.5 text-xs tabular-nums">
                  {lessons.filter(lesson => lesson.studySection.questionType === value).length + loosePosts[value].length}
                </span>}
              </button>
            );
          })}
        </div>
      </section>

      {type && (
        <section aria-labelledby="study-list-title" className="rounded-xl border border-stone-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 px-3.5 py-2.5">
            <div>
              {activeLesson && (
                <button type="button" onClick={() => onSelectLesson()}
                  className={'mb-1 inline-flex items-center gap-1 rounded text-xs font-semibold text-amber-900 hover:underline ' + focusStyle}>
                  <ChevronLeft aria-hidden="true" className="size-3.5" /> Danh sách bài
                </button>
              )}
              <h3 id="study-list-title" className="text-sm font-bold text-stone-900">
                {activeLesson ? activeLesson.title : 'Danh sách bài · ' + type.label}
              </h3>
            </div>
            {!loading && activeLesson && onCreate && (
              <button type="button" className={addButton}
                onClick={() => onCreate({ chapterId: chapter.id, questionType: type.value, lessonId: activeLesson.id })}>
                <Plus aria-hidden="true" className="size-4" /> Viết bài
              </button>
            )}
            {!loading && !activeLesson && onSaveLesson && (
              <button type="button" className={addButton} disabled={saving} onClick={() => openNameEditor('new')}>
                <Plus aria-hidden="true" className="size-4" /> Thêm tên bài
              </button>
            )}
          </div>
          {!activeLesson && nameEditor && (
            <form onSubmit={saveName} className="space-y-2 border-b border-stone-100 bg-amber-50/50 px-3.5 py-3">
              <label htmlFor="study-lesson-name" className="block text-xs font-semibold text-stone-800">
                {nameEditor === 'new' ? 'Tên bài mới' : 'Đổi tên bài'}
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <input id="study-lesson-name" autoFocus required value={name} disabled={saving}
                  onChange={event => setName(event.target.value)} placeholder="Ví dụ: Bài 1. Khái niệm từ trường"
                  className="min-w-40 flex-1 rounded-md border border-stone-300 bg-white px-2.5 py-2 text-sm outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600" />
                <button type="submit" disabled={saving || !name.trim()} className={addButton + ' disabled:opacity-60'}>
                  {saving ? 'Đang lưu…' : 'Lưu tên bài'}
                </button>
                <button type="button" disabled={saving} onClick={() => setNameEditor(null)}
                  className={'min-h-9 rounded-md px-2 text-xs font-semibold text-stone-700 hover:bg-stone-100 ' + focusStyle}>
                  Hủy
                </button>
              </div>
              {saveError && <p role="alert" className="text-xs text-red-700">Chưa lưu được tên bài. Thử lại nhé.</p>}
            </form>
          )}
          {lessonSync && (
            <div role="status" className="flex flex-wrap items-center gap-2 border-b border-stone-100 px-3.5 py-2 text-xs text-stone-700">
              {lessonSync === 'syncing' ? 'Đang đồng bộ tên bài…' : 'Tên bài đã lưu trên máy này. Đồng bộ chưa thành công.'}
              {lessonSync === 'failed' && onRetryLessonSync && (
                <button type="button" onClick={onRetryLessonSync} className="font-semibold text-amber-900 underline">Thử đồng bộ lại</button>
              )}
            </div>
          )}
          {loading ? (
            <p role="status" className="px-3.5 py-8 text-center text-sm text-stone-600">Đang tải danh sách bài…</p>
          ) : activeLesson ? (
            lessonPosts.length ? (
              <div className="p-3.5">
                {renderLessonPosts([...lessonPosts].sort((first, second) => titleOrder.compare(first.title, second.title)))}
              </div>
            )
              : <p className="px-3.5 py-8 text-center text-sm text-stone-600">Bài này chưa có nội dung.</p>
          ) : (
            <>
              {sectionLessons.length > 0 && (
                <ul aria-label="Tên các bài" className="divide-y divide-stone-100">
                  {sectionLessons.map(lesson => (
                    <li key={lesson.id} className="flex items-center gap-1 px-2 py-0.5 hover:bg-stone-50">
                      <button type="button" onClick={() => { setNameEditor(null); onSelectLesson(lesson.id); }}
                        className={'flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-2 text-left ' + focusStyle}>
                        <Folder aria-hidden="true" className="size-5 shrink-0 text-amber-800" />
                        <span className="min-w-0 flex-1 break-words text-sm font-semibold text-stone-900">{lesson.title}</span>
                        <span className="shrink-0 rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-600">
                          {postsByLesson.get(lesson.id)?.length ?? 0} nội dung
                        </span>
                        <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-stone-500" />
                      </button>
                      {onSaveLesson && (
                        <button type="button" title="Đổi tên bài" aria-label={'Đổi tên ' + lesson.title}
                          disabled={saving} onClick={() => openNameEditor(lesson)}
                          className={'grid size-9 shrink-0 place-items-center rounded-md text-stone-600 hover:bg-stone-200 ' + focusStyle}>
                          <Pencil aria-hidden="true" className="size-4" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {loosePosts[type.value].length > 0 && (
                <div className="border-t border-stone-100">
                  <h4 className="px-3.5 py-2 text-xs font-semibold text-stone-600">Nội dung chưa xếp vào tên bài</h4>
                  <PostRows posts={loosePosts[type.value]} onRead={onRead} onEdit={onEdit} />
                </div>
              )}
              {!sectionLessons.length && !loosePosts[type.value].length && (
                <p className="px-3.5 py-8 text-center text-sm text-stone-600">Mục này chưa có tên bài.</p>
              )}
            </>
          )}
        </section>
      )}
    </>
  );
}
