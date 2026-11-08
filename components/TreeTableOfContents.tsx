import React, { useEffect, useState } from 'react';
import { ChevronRight, Folder, FolderOpen, Layers, Search, X } from 'lucide-react';
import { getStudyChapter, STUDY_CHAPTERS } from '../src/utils/studyLibrary';

export function normalizeSearchText(text: string) {
  return text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd').replace(/\s+/g, ' ').trim();
}

interface TreeTableOfContentsProps {
  grades: number[];
  chapterCounts: Map<string, number>;
  gradeCounts: Map<number, number>;
  totalCount: number;
  selectedId?: string;
  onSelect: (id?: string) => void;
}

const treeFocus = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-600';

function FolderRow({ label, count, selected, icon: Icon, onSelect }: {
  label: string;
  count: number;
  selected: boolean;
  icon: typeof Folder;
  onSelect: () => void;
}) {
  return (
    <button type="button" aria-pressed={selected} onClick={onSelect}
      className={'flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm font-medium '
        + treeFocus + (selected ? ' bg-amber-50 text-amber-950 ring-1 ring-inset ring-amber-200' : ' text-stone-700 hover:bg-stone-50')}>
      <Icon aria-hidden="true" className="size-4 shrink-0 text-amber-700" />
      <span className="min-w-0 flex-1 break-words leading-snug">{label}</span>
      <span className="rounded bg-stone-100 px-1.5 py-0.5 text-xs tabular-nums text-stone-600">{count}</span>
    </button>
  );
}

export default function TreeTableOfContents({ grades, chapterCounts, gradeCounts, totalCount, selectedId, onSelect }: TreeTableOfContentsProps) {
  const [search, setSearch] = useState('');
  const [openGrades, setOpenGrades] = useState(() => new Set<number>());
  const selectedGrade = getStudyChapter(selectedId)?.grade
    ?? grades.find(grade => selectedId === 'grade-' + grade);
  const query = normalizeSearchText(search);

  useEffect(() => {
    if (selectedGrade) setOpenGrades(previous => new Set([...previous, selectedGrade]));
  }, [selectedGrade]);

  const visibleGrades = grades.flatMap(grade => {
    const name = 'VẬT LÝ ' + grade;
    const gradeMatches = normalizeSearchText(name).includes(query);
    const chapters = STUDY_CHAPTERS.filter(chapter =>
      chapter.grade === grade && (gradeMatches || normalizeSearchText(chapter.name).includes(query))
    );
    return gradeMatches || chapters.length > 0 ? [{ grade, name, chapters }] : [];
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-2 border-b border-stone-100 px-3 pb-3">
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3 size-4 text-stone-500" />
          <input type="text" aria-label="Tìm chương" placeholder="Tìm chương..."
            value={search} onChange={event => setSearch(event.target.value)}
            className="h-10 w-full rounded-lg border border-stone-200 bg-stone-50 pl-9 pr-10 text-sm text-stone-900 outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600" />
          {search && (
            <button type="button" aria-label="Xóa tìm kiếm chương" onClick={() => setSearch('')}
              className={'absolute right-1 top-1 grid size-8 place-items-center rounded-md text-stone-500 hover:bg-stone-100 ' + treeFocus}>
              <X aria-hidden="true" className="size-4" />
            </button>
          )}
        </div>
        <div className="flex">
          <FolderRow label="Tất cả" count={totalCount} selected={!selectedId} icon={Layers} onSelect={() => onSelect()} />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
        {visibleGrades.length > 0 ? (
          <ul aria-label="Các chương Vật lý" className="space-y-0.5">
            {visibleGrades.map(({ grade, name, chapters }) => {
              const id = 'grade-' + grade;
              const expanded = !!query || openGrades.has(grade);
              return (
                <li key={id}>
                  <div className="flex items-center">
                    <button type="button" aria-expanded={expanded} aria-label={(expanded ? 'Thu gọn ' : 'Mở ') + name}
                      disabled={!!query}
                      className={'grid size-8 shrink-0 place-items-center rounded-md text-stone-500 hover:bg-stone-100 ' + treeFocus}
                      onClick={() => setOpenGrades(previous => {
                        const next = new Set(previous);
                        if (next.has(grade)) next.delete(grade);
                        else next.add(grade);
                        return next;
                      })}>
                      <ChevronRight aria-hidden="true" className={'size-4 ' + (expanded ? 'rotate-90' : '')} />
                    </button>
                    <FolderRow label={name} count={gradeCounts.get(grade) ?? 0} selected={selectedId === id}
                      icon={expanded ? FolderOpen : Folder} onSelect={() => {
                        setOpenGrades(previous => new Set([...previous, grade]));
                        onSelect(id);
                      }} />
                  </div>
                  {expanded && (
                    <ul className="ml-4 space-y-0.5 border-l border-stone-200 pl-2">
                      {chapters.map(chapter => (
                        <li key={chapter.id} className="flex">
                          <FolderRow label={chapter.name} count={chapterCounts.get(chapter.id) ?? 0}
                            selected={selectedId === chapter.id} icon={Folder} onSelect={() => onSelect(chapter.id)} />
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p role="status" className="px-3 py-6 text-center text-sm text-stone-600">Không tìm thấy chương phù hợp.</p>
        )}
      </div>

      <div className="border-t border-stone-100 px-3 py-2 text-xs text-stone-600">Chương trình GDPT 2018</div>
    </div>
  );
}
