import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, FileText, Folder, ListChecks, Pencil, Plus, Scale, TextCursorInput } from 'lucide-react';
import type { BlogPost, StudyLesson, StudyQuestionGroup, StudyQuestionType, StudySection } from '../types';
import { isStudyQuestionGroup, STUDY_QUESTION_GROUPS, STUDY_QUESTION_TYPES, supportsStudyGroups } from '../src/utils/studyLibrary';

export type ChapterStudyGroup = StudyQuestionGroup | 'unclassified';

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
  chapter, selectedType, selectedLessonId, selectedGroup, matchesByGroup, blogs, lessons, loading,
  onSelectType, onSelectLesson,
  onRead, onCreate, onEdit, onSaveLesson, onDeleteEmptyLesson, countQuestions, renderLessonPosts,
}: {
  chapter: { id: string; name: string; grade: number };
  selectedType?: StudyQuestionType;
  selectedLessonId?: string;
  selectedGroup?: ChapterStudyGroup;
  matchesByGroup: Record<ChapterStudyGroup, ReadonlyMap<string, ReadonlySet<number>>>;
  blogs: BlogPost[];
  lessons: StudyLesson[];
  loading: boolean;
  onSelectType: (type: StudyQuestionType) => void;
  onSelectLesson: (id?: string, group?: ChapterStudyGroup) => void;
  onRead: (blog: BlogPost, group?: ChapterStudyGroup) => void;
  onCreate?: (section: StudySection) => void;
  onEdit?: (blog: BlogPost) => void;
  countQuestions: (blog: BlogPost, group?: ChapterStudyGroup) => number;
  renderLessonPosts: (posts: BlogPost[]) => React.ReactNode;
  onSaveLesson?: (section: StudySection, title: string, id?: string, group?: StudyQuestionGroup) => Promise<StudyLesson | null>;
  onDeleteEmptyLesson?: (id: string) => Promise<'deleted' | 'not_empty' | 'failed'>;
}) {
  const [nameEditor, setNameEditor] = useState<StudyLesson | 'new' | null>(null);
  const [editorGroup, setEditorGroup] = useState<ChapterStudyGroup>();
  const [name, setName] = useState('');
  const [pendingAction, setPendingAction] = useState<'save' | 'delete' | null>(null);
  const saving = pendingAction !== null;
  const [error, setError] = useState('');
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
  const matchingPosts = (posts: BlogPost[], group?: ChapterStudyGroup) =>
    group ? posts.filter(post => matchesByGroup[group].has(post.id)) : posts;
  const sectionLessons = lessons.filter(lesson => lesson.studySection.questionType === selectedType)
    .sort((first, second) => titleOrder.compare(first.title, second.title));
  const lessonsInGroup = (group: ChapterStudyGroup) => sectionLessons.filter(lesson => {
    const posts = postsByLesson.get(lesson.id) ?? [];
    return matchingPosts(posts, group).length > 0
      || (onSaveLesson && posts.length === 0 && (lesson.questionGroup ?? 'unclassified') === group);
  });
  const activeLesson = sectionLessons.find(lesson => lesson.id === selectedLessonId);
  const activeLessonId = activeLesson?.id;
  const lessonHeading = useRef<HTMLHeadingElement>(null);
  const lessonPosts = activeLesson ? matchingPosts(postsByLesson.get(activeLesson.id) ?? [], selectedGroup) : [];
  const activeGroupLabel = selectedGroup === 'unclassified' ? 'Chưa phân loại'
    : STUDY_QUESTION_GROUPS.find(group => group.value === selectedGroup)?.label;
  const canDelete = onDeleteEmptyLesson && nameEditor && nameEditor !== 'new'
    && (postsByLesson.get(nameEditor.id)?.length ?? 0) === 0;

  useEffect(() => {
    if (!activeLessonId) return;
    lessonHeading.current?.focus({ preventScroll: true });
    lessonHeading.current?.scrollIntoView({ block: 'start' });
  }, [activeLessonId]);

  const openNameEditor = (lesson: StudyLesson | 'new', group?: ChapterStudyGroup) => {
    setName(lesson === 'new' ? '' : lesson.title);
    setError('');
    setEditorGroup(group);
    setNameEditor(lesson);
  };

  const saveName = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!type || !onSaveLesson || !nameEditor || !name.trim() || savingRef.current) return;
    savingRef.current = true;
    setPendingAction('save');
    setError('');
    try {
      const saved = await onSaveLesson({ chapterId: chapter.id, questionType: type.value }, name.trim(),
        nameEditor === 'new' ? undefined : nameEditor.id, isStudyQuestionGroup(editorGroup) ? editorGroup : undefined);
      if (saved) setNameEditor(null);
      else setError('Chưa lưu được tên bài. Thử lại nhé.');
    } catch {
      setError('Chưa lưu được tên bài. Thử lại nhé.');
    } finally {
      savingRef.current = false;
      setPendingAction(null);
    }
  };

  const deleteName = async () => {
    if (!canDelete || savingRef.current) return;
    if (!window.confirm(`Xóa bài trống “${nameEditor.title}”?`)) return;
    savingRef.current = true;
    setPendingAction('delete');
    setError('');
    try {
      const result = await onDeleteEmptyLesson(nameEditor.id);
      if (result === 'deleted') setNameEditor(null);
      else setError(result === 'not_empty' ? 'Bài đã có nội dung. Hãy chuyển câu sang bài khác trước khi xóa.'
        : 'Chưa xóa được bài. Thử lại nhé.');
    } catch {
      setError('Chưa xóa được bài. Thử lại nhé.');
    } finally {
      savingRef.current = false;
      setPendingAction(null);
    }
  };

  const nameForm = nameEditor && (
    <form onSubmit={saveName} className="space-y-2 border-b border-stone-100 bg-amber-50/50 px-3.5 py-3">
      <label htmlFor="study-lesson-name" className="block text-xs font-semibold text-stone-800">
        {nameEditor === 'new' ? 'Tên bài mới' : 'Đổi tên bài'}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input id="study-lesson-name" autoFocus required value={name} disabled={saving}
          onChange={event => setName(event.target.value)} placeholder="Ví dụ: Bài 1. Khái niệm từ trường"
          className="min-w-0 flex-1 rounded-md border border-stone-300 bg-white px-2.5 py-2 text-sm outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600" />
        <button type="submit" disabled={saving || !name.trim()} className={addButton + ' disabled:opacity-60'}>
          {pendingAction === 'save' ? 'Đang lưu…' : 'Lưu tên bài'}
        </button>
        <button type="button" disabled={saving} onClick={() => setNameEditor(null)}
          className={'min-h-9 rounded-md px-2 text-xs font-semibold text-stone-700 hover:bg-stone-100 ' + focusStyle}>
          Hủy
        </button>
        {canDelete && (
          <button type="button" disabled={saving} onClick={deleteName}
            className={'min-h-9 rounded-md px-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60 ' + focusStyle}>
            {pendingAction === 'delete' ? 'Đang xóa…' : 'Xóa bài trống'}
          </button>
        )}
      </div>
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    </form>
  );
  const panelClass = 'min-w-0 rounded-xl border border-stone-200 bg-white';
  const loadingMessage = <p role="status" className="px-3.5 py-8 text-center text-sm text-stone-600">Đang tải danh sách bài…</p>;

  const renderLessonList = (title: string, group?: ChapterStudyGroup) => {
    if (!type) return null;
    const headingId = 'study-list-' + (group ?? 'all');
    const visibleLessons = group ? lessonsInGroup(group) : sectionLessons;
    const visibleLoosePosts = matchingPosts(loosePosts[type.value], group);
    if (group === 'unclassified' && !visibleLessons.length && !visibleLoosePosts.length) return null;

    return (
      <section key={headingId} aria-labelledby={headingId} className={panelClass}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 px-3.5 py-2.5">
          <h3 id={headingId} className="text-sm font-bold text-stone-900">{title}</h3>
          {onSaveLesson && group !== 'unclassified' && (
            <button type="button" className={addButton} disabled={saving} onClick={() => openNameEditor('new', group)}>
              <Plus aria-hidden="true" className="size-4" /> Thêm tên bài
            </button>
          )}
        </div>
        {editorGroup === group && nameForm}
        {visibleLessons.length > 0 && (
          <ul aria-label="Tên các bài" className="divide-y divide-stone-100">
            {visibleLessons.map(lesson => (
              <li key={lesson.id} className="flex items-center gap-1 px-2 py-0.5 hover:bg-stone-50">
                <button type="button" onClick={() => { setNameEditor(null); onSelectLesson(lesson.id, group); }}
                  className={'flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-2 text-left ' + focusStyle}>
                  <Folder aria-hidden="true" className="size-5 shrink-0 text-amber-800" />
                  <span className="min-w-0 flex-1 break-words text-sm font-semibold text-stone-900">{lesson.title}</span>
                  <span className="shrink-0 rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-600">
                    {(postsByLesson.get(lesson.id) ?? []).reduce((total, post) => total + countQuestions(post, group), 0)} câu
                  </span>
                  <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-stone-500" />
                </button>
                {onSaveLesson && (
                  <button type="button" title="Đổi tên bài" aria-label={'Đổi tên ' + lesson.title}
                    disabled={saving} onClick={() => openNameEditor(lesson, group)}
                    className={'grid size-9 shrink-0 place-items-center rounded-md text-stone-600 hover:bg-stone-200 ' + focusStyle}>
                    <Pencil aria-hidden="true" className="size-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {visibleLoosePosts.length > 0 && (
          <div className="border-t border-stone-100">
            <h4 className="px-3.5 py-2 text-xs font-semibold text-stone-600">Nội dung chưa xếp vào tên bài</h4>
            <PostRows posts={visibleLoosePosts} onRead={post => onRead(post, group)} onEdit={onEdit} />
          </div>
        )}
        {!visibleLessons.length && !visibleLoosePosts.length && (
          <p className="px-3.5 py-8 text-center text-sm text-stone-600">Mục này chưa có tên bài.</p>
        )}
      </section>
    );
  };

  return (
    <>
      {!activeLesson && (
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
                  className={'flex min-h-12 w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-sm font-semibold '
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
      )}

      {type && (activeLesson ? (
        <section aria-labelledby="study-list-title" className={panelClass}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 px-3.5 py-2.5 sm:px-5 sm:py-4">
            <div className="min-w-0">
              <button type="button" onClick={() => onSelectLesson()}
                className={'mb-1 inline-flex items-center gap-1 rounded text-xs font-semibold text-amber-900 hover:underline ' + focusStyle}>
                <ChevronLeft aria-hidden="true" className="size-3.5" /> Danh sách bài
              </button>
              <h1 id="study-list-title" ref={lessonHeading} tabIndex={-1}
                className="scroll-mt-28 break-words text-lg font-bold text-stone-900 sm:text-xl">
                {activeLesson.title}
              </h1>
              {activeGroupLabel && <p className="mt-1 text-xs font-semibold text-amber-800">{activeGroupLabel}</p>}
            </div>
            {!loading && onCreate && (
              <button type="button" className={addButton}
                onClick={() => onCreate({ chapterId: chapter.id, questionType: type.value, lessonId: activeLesson.id })}>
                <Plus aria-hidden="true" className="size-4" /> Viết bài
              </button>
            )}
          </div>
          {loading ? loadingMessage : lessonPosts.length ? (
            <div className="p-3.5 sm:p-5">
              {renderLessonPosts([...lessonPosts].sort((first, second) => titleOrder.compare(first.title, second.title)))}
            </div>
          ) : <p className="px-3.5 py-8 text-center text-sm text-stone-600">Bài này chưa có nội dung.</p>}
        </section>
      ) : loading ? (
        <div className={panelClass}>{loadingMessage}</div>
      ) : supportsStudyGroups(type.value) ? (
        <>
          <div className="grid items-start gap-3 lg:grid-cols-2">
            {STUDY_QUESTION_GROUPS.map(({ label, value }) => renderLessonList(label, value))}
          </div>
          {renderLessonList('Chưa phân loại', 'unclassified')}
        </>
      ) : renderLessonList('Danh sách bài · ' + type.label))}
    </>
  );
}
