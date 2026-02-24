import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowLeft, Plus, Folder, Trash2, ChevronRight, ArrowUpDown, FileText, UploadCloud, Eye, BookOpen, Zap, CheckCircle2, Circle, X, RotateCcw, ClipboardList, Download } from 'lucide-react';
import SearchBar from './SearchBar';
import { Chapter, Lesson, StoredFile } from '../types';

// ── Progress Types ──────────────────────────────────────────
type ProgressStatus = 'none' | 'done';
interface LessonProgress {
  status: ProgressStatus;
  note: string;
  updatedAt: number;
}
type ProgressMap = Record<string, LessonProgress>;

const STORAGE_KEY = 'physivault_lesson_progress';
const SECTION_NOTE_KEY = 'physivault_section_notes';

function loadSectionNotes(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(SECTION_NOTE_KEY) || '{}'); }
  catch { return {}; }
}
function saveSectionNotes(map: Record<string, string>) {
  localStorage.setItem(SECTION_NOTE_KEY, JSON.stringify(map));
}

function loadProgress(): ProgressMap {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}
function saveProgress(map: ProgressMap) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

// ── Status Button (2 states: none / done) ────────────────────
const StatusBtn: React.FC<{
  status: ProgressStatus;
  onClick: (e: React.MouseEvent) => void;
}> = ({ status, onClick }) => {
  const isDone = status === 'done';
  return (
    <button
      onClick={onClick}
      title={isDone ? 'Hoàn thành — Click để bỏ' : 'Đánh dấu hoàn thành'}
      className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all"
      style={{
        background: isDone ? '#EAF3EE' : '#F1F0EC',
        border: `2px solid ${isDone ? '#44836180' : '#AEACA860'}`,
      }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = 'scale(1.12)'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = 'scale(1)'}
    >
      {isDone
        ? <CheckCircle2 className="w-3.5 h-3.5" style={{ color: '#448361' }} />
        : <Circle className="w-3.5 h-3.5" style={{ color: '#CFCFCB' }} />
      }
    </button>
  );
};

// ── Inline Note — always visible input style ──────────────────
const InlineNote: React.FC<{
  lessonId: string;
  note: string;
  onSave: (id: string, note: string) => void;
}> = ({ lessonId, note, onSave }) => {
  const [draft, setDraft] = useState(note);

  useEffect(() => { setDraft(note); }, [note]);

  const handleBlur = () => onSave(lessonId, draft.trim());

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); (e.currentTarget as HTMLInputElement).blur(); }
    if (e.key === 'Escape') { setDraft(note); (e.currentTarget as HTMLInputElement).blur(); }
  };

  return (
    <input
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onClick={e => e.stopPropagation()}
      maxLength={80}
      placeholder="TN ABCD, FILE 1, CÂU 1"
      className="flex-1 min-w-0 text-xs px-2.5 py-1.5 rounded-lg outline-none transition-colors"
      style={{
        background: '#FFFFFF',
        border: '1px solid #E9E9E7',
        color: '#1A1A1A',
        minWidth: 0,
      }}
      onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = '#6B7CDB'}
    />
  );
};

// ── Progress Bar ─────────────────────────────────────────────
const ProgressBar: React.FC<{ total: number; done: number; inProgress: number }> = ({ total, done, inProgress }) => {
  if (total === 0) return null;
  const donePct = (done / total) * 100;
  const inProgPct = (inProgress / total) * 100;
  const none = total - done - inProgress;

  return (
    <div className="rounded-xl px-4 py-3" style={{ background: '#FFFFFF', border: '1px solid #E9E9E7' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold" style={{ color: '#1A1A1A' }}>Tiến độ bài học</span>
        <span className="text-xs" style={{ color: '#787774' }}>
          <span className="font-bold" style={{ color: '#448361' }}>{done}</span>/{total} hoàn thành
          {inProgress > 0 && <> · <span className="font-bold" style={{ color: '#6B7CDB' }}>{inProgress}</span> đang làm</>}
          {none > 0 && <> · <span style={{ color: '#AEACA8' }}>{none}</span> còn lại</>}
        </span>
      </div>
      {/* Track */}
      <div className="h-2 rounded-full overflow-hidden" style={{ background: '#F1F0EC' }}>
        <div
          className="h-full transition-all duration-500 rounded-full"
          style={{ width: `${donePct}%`, background: '#448361' }}
        />
      </div>
      {/* Legend dots */}
      <div className="flex items-center gap-4 mt-2">
        {[
          { color: '#448361', label: 'Hoàn thành' },
          { color: '#D5D3CE', label: 'Chưa làm' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ background: color }} />
            <span className="text-[10px]" style={{ color: '#AEACA8' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Main Component ───────────────────────────────────────────
interface ChapterViewProps {
  chapter: Chapter;
  lessons: Lesson[];
  chapterFiles: StoredFile[];
  isAdmin: boolean;
  autoCreate?: boolean;
  onBack: () => void;
  onCreateLesson: (name: string) => void;
  onSelectLesson: (lesson: Lesson) => void;
  onDeleteLesson: (lessonId: string) => void;
  onUploadChapterFile: (files: File[], category: string) => void;
  onDeleteChapterFile: (fileId: string) => void;
}

const ChapterView: React.FC<ChapterViewProps> = ({
  chapter,
  lessons,
  chapterFiles,
  isAdmin,
  autoCreate,
  onBack,
  onCreateLesson,
  onSelectLesson,
  onDeleteLesson,
  onUploadChapterFile,
  onDeleteChapterFile
}) => {
  const [newLessonName, setNewLessonName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState<'newest' | 'oldest' | 'az' | 'za'>('az');
  const [trueFalseSort, setTrueFalseSort] = useState<'newest' | 'oldest' | 'az' | 'za'>('az');
  const [advancedSort, setAdvancedSort] = useState<'newest' | 'oldest' | 'az' | 'za'>('az');
  const [previewFile, setPreviewFile] = useState<StoredFile | null>(null);
  const [uploadCategory, setUploadCategory] = useState<string>('');
  const [progress, setProgress] = useState<ProgressMap>(loadProgress);
  const [sectionNotes, setSectionNotes] = useState<Record<string, string>>(loadSectionNotes);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const saveSectionNote = useCallback((key: string, note: string) => {
    setSectionNotes(prev => {
      const updated = { ...prev, [key]: note };
      saveSectionNotes(updated);
      return updated;
    });
  }, []);

  // ── Answer Panel State ───────────────────────────────────────
  interface AnswerPanelState {
    numQuestionsInput: string;
    numQuestions: number;
    answers: Record<number, string>;
    questionTypes: Record<number, 'TN' | 'TL'>;
  }
  const [panel, setPanel] = useState<AnswerPanelState>({
    numQuestionsInput: '', numQuestions: 0, answers: {}, questionTypes: {},
  });

  useEffect(() => {
    if (previewFile) setPanel({ numQuestionsInput: '', numQuestions: 0, answers: {}, questionTypes: {} });
  }, [previewFile?.id]);

  useEffect(() => {
    if (previewFile) { document.body.style.overflow = 'hidden'; }
    else { document.body.style.overflow = ''; }
    return () => { document.body.style.overflow = ''; };
  }, [!!previewFile]);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => { if (e.key === 'Escape') setPreviewFile(null); };
    if (previewFile) window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [!!previewFile]);

  const confirmNumQuestions = () => {
    const n = parseInt(panel.numQuestionsInput, 10);
    if (!isNaN(n) && n > 0 && n <= 200)
      setPanel(p => ({ ...p, numQuestions: n, answers: {}, questionTypes: {} }));
  };
  const toggleAnswer = (q: number, letter: string) =>
    setPanel(p => ({ ...p, answers: { ...p.answers, [q]: p.answers[q] === letter ? '' : letter } }));
  const setTextAnswer = (q: number, text: string) =>
    setPanel(p => ({ ...p, answers: { ...p.answers, [q]: text } }));
  const toggleQuestionType = (q: number) =>
    setPanel(p => {
      const next = (p.questionTypes[q] || 'TN') === 'TN' ? 'TL' : 'TN';
      return { ...p, questionTypes: { ...p.questionTypes, [q]: next }, answers: { ...p.answers, [q]: '' } };
    });
  const resetPanel = () =>
    setPanel({ numQuestionsInput: '', numQuestions: 0, answers: {}, questionTypes: {} });

  useEffect(() => {
    if (autoCreate) setIsCreating(true);
  }, [autoCreate]);

  // ── Progress helpers ────────────────────────
  const getLP = useCallback((id: string): LessonProgress =>
    progress[id] ?? { status: 'none', note: '', updatedAt: 0 }
    , [progress]);

  const cycleStatus = useCallback((e: React.MouseEvent, lessonId: string) => {
    e.stopPropagation();
    setProgress(prev => {
      const cur = prev[lessonId] ?? { status: 'none', note: '', updatedAt: 0 };
      const next: ProgressStatus = cur.status === 'done' ? 'none' : 'done';
      const updated = { ...prev, [lessonId]: { ...cur, status: next, updatedAt: Date.now() } };
      saveProgress(updated);
      return updated;
    });
  }, []);

  const saveNote = useCallback((lessonId: string, note: string) => {
    setProgress(prev => {
      const cur = prev[lessonId] ?? { status: 'none', note: '', updatedAt: 0 };
      const updated = { ...prev, [lessonId]: { ...cur, note, updatedAt: Date.now() } };
      saveProgress(updated);
      return updated;
    });
  }, []);

  // ── Util ─────────────────────────────────────
  const sortFiles = (files: StoredFile[], option: 'newest' | 'oldest' | 'az' | 'za') =>
    [...files].sort((a, b) => {
      switch (option) {
        case 'newest': return b.uploadDate - a.uploadDate;
        case 'oldest': return a.uploadDate - b.uploadDate;
        case 'az': return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
        case 'za': return b.name.localeCompare(a.name, undefined, { numeric: true, sensitivity: 'base' });
        default: return 0;
      }
    });

  const theoryFiles = sortFiles(chapterFiles.filter(f => f.category === 'Lý thuyết trọng tâm (Chương)'), 'az');
  const trueFalseFiles = sortFiles(chapterFiles.filter(f => f.category === 'Trắc nghiệm Đúng/Sai (Chương)'), trueFalseSort);
  const advancedFiles = sortFiles(chapterFiles.filter(f => f.category === 'Bài tập Tính toán Nâng cao'), advancedSort);

  const filteredLessons = lessons
    .filter(l => (l.name || '').toLowerCase().normalize('NFC').includes(searchTerm.toLowerCase().trim().normalize('NFC')))
    .sort((a, b) => {
      switch (sortOption) {
        case 'newest': return b.createdAt - a.createdAt;
        case 'oldest': return a.createdAt - b.createdAt;
        case 'az': return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
        case 'za': return b.name.localeCompare(a.name, undefined, { numeric: true, sensitivity: 'base' });
        default: return 0;
      }
    });

  // Progress summary
  const doneCount = lessons.filter(l => getLP(l.id).status === 'done').length;
  const inProgressCount = 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newLessonName.trim()) {
      onCreateLesson(newLessonName.trim());
      setNewLessonName('');
      setIsCreating(false);
    }
  };

  const triggerUpload = (category: string) => {
    setUploadCategory(category);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && uploadCategory) {
      onUploadChapterFile(Array.from(e.target.files), uploadCategory);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
    setUploadCategory('');
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + ['B', 'KB', 'MB', 'GB'][i];
  };

  /* ── Reusable file row ── */
  const FileRow = ({ file, accentColor }: { file: StoredFile; accentColor: string }) => (
    <div
      className="flex items-center justify-between px-3 md:px-4 py-2.5 rounded-lg cursor-pointer transition-colors group/file"
      style={{ border: '1px solid #E9E9E7' }}
      onClick={() => setPreviewFile(file)}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F7F6F3'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#FFFFFF'}
    >
      <div className="flex items-center gap-2.5 overflow-hidden">
        <FileText className="w-4 h-4 shrink-0" style={{ color: accentColor }} />
        <div className="overflow-hidden">
          <p className="text-sm font-medium truncate pr-2" style={{ color: '#1A1A1A' }}>{file.name}</p>
          <p className="text-[10px] uppercase" style={{ color: '#AEACA8' }}>{formatSize(file.size)}</p>
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover/file:opacity-100 transition-opacity shrink-0">
        <button
          onClick={e => { e.stopPropagation(); setPreviewFile(file); }}
          className="p-1.5 rounded-md transition-colors"
          style={{ color: '#787774' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#E9E9E7'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
        {isAdmin && (
          <button
            onClick={e => { e.stopPropagation(); onDeleteChapterFile(file.id); }}
            className="p-1.5 rounded-md transition-colors"
            style={{ color: '#E03E3E' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#FEE2E2'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );

  /* ── Section Note Input ── */
  const SectionNoteInput = ({ noteKey, accentColor }: { noteKey: string; accentColor: string }) => {
    const [draft, setDraft] = useState(sectionNotes[noteKey] || '');

    useEffect(() => { setDraft(sectionNotes[noteKey] || ''); }, [noteKey]);

    const handleBlur = () => saveSectionNote(noteKey, draft.trim());
    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') { e.preventDefault(); (e.currentTarget as HTMLInputElement).blur(); }
      if (e.key === 'Escape') { setDraft(sectionNotes[noteKey] || ''); (e.currentTarget as HTMLInputElement).blur(); }
    };

    return (
      <div className="relative">
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          maxLength={40}
          placeholder="FILE 1, CÂU 1"
          className="text-xs px-2.5 py-1.5 rounded-md outline-none transition-colors w-32"
          style={{
            background: draft ? '#FFFFFF' : '#F1F0EC',
            border: `1px solid ${draft ? accentColor + '60' : '#E9E9E7'}`,
            color: '#1A1A1A',
          }}
          onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = accentColor; (e.currentTarget as HTMLElement).style.background = '#FFFFFF'; }}
          title="Ghi chú tiến độ (VD: FILE 1, CÂU 1)"
        />
        {draft && (
          <span
            className="absolute -top-1.5 -right-1.5 w-2 h-2 rounded-full"
            style={{ background: accentColor }}
            title="Đã có ghi chú"
          />
        )}
      </div>
    );
  };

  /* ── Reusable category section ── */
  const CategorySection = ({
    title, description, icon: Icon, accentColor, accentBg,
    files, sortValue, onSortChange, uploadLabel, uploadCategory: cat,
    showSort = false, noteKey,
  }: {
    title: string; description: string;
    icon: React.ElementType; accentColor: string; accentBg: string;
    files: StoredFile[]; sortValue?: string;
    onSortChange?: (v: any) => void; uploadLabel: string; uploadCategory: string;
    showSort?: boolean; noteKey?: string;
  }) => (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E9E9E7', background: '#FFFFFF' }}>
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-2 sm:gap-0"
        style={{ borderBottom: '1px solid #E9E9E7', borderLeft: `3px solid ${accentColor}` }}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: accentBg }}>
            <Icon className="w-4 h-4" style={{ color: accentColor }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>{title}</h3>
            <p className="text-xs mt-0.5" style={{ color: '#787774' }}>{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          {/* Note input — chỉ học sinh thấy */}
          {!isAdmin && noteKey && (
            <SectionNoteInput noteKey={noteKey} accentColor={accentColor} />
          )}
          {showSort && onSortChange && (
            <div className="relative">
              <select
                value={sortValue}
                onChange={e => onSortChange(e.target.value as any)}
                className="appearance-none text-xs px-2.5 py-1.5 pr-7 rounded-md outline-none cursor-pointer transition-colors"
                style={{ background: '#F1F0EC', border: '1px solid #E9E9E7', color: '#57564F' }}
              >
                <option value="newest">Mới nhất</option>
                <option value="oldest">Cũ nhất</option>
                <option value="az">Tên A-Z</option>
                <option value="za">Tên Z-A</option>
              </select>
              <ArrowUpDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#AEACA8' }} />
            </div>
          )}
          {isAdmin && (
            <button
              onClick={() => triggerUpload(cat)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
              style={{ background: accentBg, color: accentColor, border: `1px solid ${accentColor}22` }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.8'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
            >
              <UploadCloud className="w-3.5 h-3.5" />
              {uploadLabel}
            </button>
          )}
        </div>
      </div>

      {files.length > 0 ? (
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2" style={{ background: '#FAFAF9' }}>
          {files.map(file => (
            <React.Fragment key={file.id}>
              <FileRow file={file} accentColor={accentColor} />
            </React.Fragment>
          ))}
        </div>
      ) : (
        <div className="py-8 text-center text-sm" style={{ color: '#AEACA8', background: '#FAFAF9' }}>
          Chưa có tài liệu nào
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className="space-y-6 animate-fade-in pb-10">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg transition-colors"
            style={{ background: '#F1F0EC', border: '1px solid #E9E9E7', color: '#57564F' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#E9E9E7'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#F1F0EC'}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <span
              className="inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded mb-1"
              style={{ background: '#EEF0FB', color: '#6B7CDB' }}
            >
              Chương học
            </span>
            <h2 className="text-2xl font-semibold" style={{ color: '#1A1A1A' }}>{chapter.name}</h2>
            {chapter.description && (
              <p className="text-sm mt-0.5" style={{ color: '#787774' }}>{chapter.description}</p>
            )}
          </div>
        </div>

        {/* ── Core Theory ── */}
        <CategorySection
          title="Kho Lý thuyết trọng tâm"
          description="Bài giảng, sơ đồ tư duy và kiến thức cốt lõi của chương"
          icon={BookOpen}
          accentColor="#D9730D"
          accentBg="#FFF3E8"
          files={theoryFiles}
          uploadLabel="Tải lý thuyết lên"
          uploadCategory="Lý thuyết trọng tâm (Chương)"
        />

        {/* ── Lessons in Chapter ── */}
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E9E9E7', background: '#FFFFFF' }}>
          {/* Header */}
          <div
            className="flex items-center justify-between p-4"
            style={{ borderBottom: '1px solid #E9E9E7', borderLeft: '3px solid #6B7CDB' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#EEF0FB' }}>
                <Folder className="w-4 h-4" style={{ color: '#6B7CDB' }} />
              </div>
              <h3 className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>Bài học trong chương</h3>
            </div>
            {isAdmin && !isCreating && (
              <button
                onClick={() => setIsCreating(true)}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
                style={{ background: '#EEF0FB', color: '#6B7CDB', border: '1px solid #6B7CDB22' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.8'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
              >
                <Plus className="w-3.5 h-3.5" />
                Tạo bài học mới
              </button>
            )}
          </div>

          <div className="p-4" style={{ background: '#FAFAF9' }}>
            {/* Create lesson form */}
            {isCreating && (
              <form onSubmit={handleSubmit} className="flex gap-2 items-center animate-fade-in mb-4">
                <input
                  type="text"
                  value={newLessonName}
                  onChange={e => setNewLessonName(e.target.value)}
                  placeholder="Nhập tên bài học (VD: Bài 1: Động lượng)"
                  className="flex-1 px-3 py-2 rounded-lg text-sm outline-none transition-all"
                  style={{ border: '1px solid #CFCFCB', background: '#FFFFFF', color: '#1A1A1A' }}
                  onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = '#6B7CDB'}
                  onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = '#CFCFCB'}
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!newLessonName.trim()}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-40"
                  style={{ background: '#6B7CDB' }}
                >
                  Lưu
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{ background: '#F1F0EC', color: '#57564F', border: '1px solid #E9E9E7' }}
                >
                  Hủy
                </button>
              </form>
            )}

            {/* ── Progress Bar (chỉ hiện khi học sinh dùng) ── */}
            {!isAdmin && lessons.length > 0 && (
              <div className="mb-4">
                <ProgressBar total={lessons.length} done={doneCount} inProgress={inProgressCount} />
              </div>
            )}

            {/* Search + Sort controls */}
            <div className="flex flex-col md:flex-row gap-3 mb-4">
              <div className="flex-1">
                <SearchBar onSearch={setSearchTerm} placeholder="Tìm bài học..." />
              </div>
              <div className="relative shrink-0">
                <select
                  value={sortOption}
                  onChange={e => setSortOption(e.target.value as any)}
                  className="appearance-none text-sm px-3 py-2 pr-8 rounded-lg outline-none cursor-pointer"
                  style={{ background: '#FFFFFF', border: '1px solid #E9E9E7', color: '#57564F' }}
                >
                  <option value="newest">Mới nhất</option>
                  <option value="oldest">Cũ nhất</option>
                  <option value="az">Tên A-Z</option>
                  <option value="za">Tên Z-A</option>
                </select>
                <ArrowUpDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#AEACA8' }} />
              </div>
            </div>

            {/* Lesson list */}
            {filteredLessons.length === 0 ? (
              <div
                className="text-center py-10 rounded-lg text-sm"
                style={{ border: '1px dashed #E9E9E7', color: '#AEACA8' }}
              >
                {searchTerm ? 'Không tìm thấy bài học phù hợp.' : 'Chưa có bài học nào.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {filteredLessons.map(lesson => {
                  const lp = getLP(lesson.id);
                  const isDone = lp.status === 'done';

                  return (
                    <div
                      key={lesson.id}
                      onClick={() => onSelectLesson(lesson)}
                      className="flex items-center gap-3 px-3 py-3 rounded-lg cursor-pointer transition-colors group"
                      style={{
                        background: isDone ? '#F7FBF8' : '#FFFFFF',
                        border: '1px solid #E9E9E7',
                        opacity: isDone ? 0.82 : 1,
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.background = isDone ? '#EEF7F3' : '#F7F6F3';
                        (e.currentTarget as HTMLElement).style.borderColor = '#CFCFCB';
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.background = isDone ? '#F7FBF8' : '#FFFFFF';
                        (e.currentTarget as HTMLElement).style.borderColor = '#E9E9E7';
                      }}
                    >
                      {/* Status button — chỉ học sinh thấy */}
                      {!isAdmin && (
                        <StatusBtn status={lp.status} onClick={e => cycleStatus(e, lesson.id)} />
                      )}

                      {/* Folder icon */}
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: isDone ? '#EAF3EE' : '#F1F0EC' }}
                      >
                        <Folder className="w-4 h-4" style={{ color: isDone ? '#448361' : '#787774' }} />
                      </div>

                      {/* Name + date */}
                      <div className="overflow-hidden min-w-0" style={{ minWidth: 80 }}>
                        <h4
                          className="text-sm font-medium truncate"
                          style={{
                            color: isDone ? '#448361' : '#1A1A1A',
                            textDecoration: isDone ? 'line-through' : 'none',
                            textDecorationColor: '#44836180',
                          }}
                        >
                          {lesson.name}
                        </h4>
                        <p className="text-[10px] uppercase mt-0.5" style={{ color: '#AEACA8' }}>
                          {new Date(lesson.createdAt).toLocaleDateString('vi-VN')}
                        </p>
                      </div>

                      {/* Inline note (chỉ học sinh, không hiện khi done) */}
                      {!isAdmin && !isDone && (
                        <InlineNote
                          lessonId={lesson.id}
                          note={lp.note}
                          onSave={saveNote}
                        />
                      )}

                      {/* Done badge */}
                      {!isAdmin && isDone && (
                        <span
                          className="flex-1 text-right text-[10px] font-semibold"
                          style={{ color: '#448361' }}
                        >
                          ✓ Xong
                        </span>
                      )}

                      {/* Right side actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        {isAdmin && (
                          <button
                            onClick={e => { e.stopPropagation(); onDeleteLesson(lesson.id); }}
                            className="p-1.5 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                            style={{ color: '#E03E3E' }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#FEE2E2'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <ChevronRight className="w-4 h-4" style={{ color: '#AEACA8' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── True/False ── */}
        <CategorySection
          title="Trắc nghiệm Đúng/Sai"
          description="Câu hỏi lý thuyết dạng Đúng/Sai của cả chương học"
          icon={FileText}
          accentColor="#448361"
          accentBg="#EAF3EE"
          files={trueFalseFiles}
          sortValue={trueFalseSort}
          onSortChange={setTrueFalseSort}
          uploadLabel="Tải bài Đúng/Sai"
          uploadCategory="Trắc nghiệm Đúng/Sai (Chương)"
          showSort
          noteKey={`${chapter.id}__trueFalse`}
        />

        {/* ── Advanced Calculation ── */}
        <CategorySection
          title="Bài tập Tính toán Nâng cao"
          description="Bài tập vận dụng cao, tính toán phức tạp của cả chương"
          icon={Zap}
          accentColor="#9065B0"
          accentBg="#F3ECF8"
          files={advancedFiles}
          sortValue={advancedSort}
          onSortChange={setAdvancedSort}
          uploadLabel="Tải tài liệu nâng cao"
          uploadCategory="Bài tập Tính toán Nâng cao"
          showSort
          noteKey={`${chapter.id}__advanced`}
        />

        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept=".pdf,image/*"
          multiple
          onChange={handleFileChange}
        />
      </div>

      {/* ── PDF / Image Preview Overlay ── */}
      {previewFile && (
        <div className="fixed inset-0 z-[100] flex flex-col" style={{ background: '#1A1A1A' }}>

          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-2.5 shrink-0" style={{ background: '#242424', borderBottom: '1px solid #333' }}>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded flex items-center justify-center shrink-0" style={{ background: '#3B3B3B' }}>
                <FileText className="w-3.5 h-3.5" style={{ color: '#E03E3E' }} />
              </div>
              <span className="text-sm font-medium truncate" style={{ color: '#E5E5E4' }}>{previewFile.name}</span>
              {!isAdmin && (
                <span className="hidden md:inline-flex text-[10px] font-semibold px-2 py-0.5 rounded" style={{ background: '#3B3B3B', color: '#AEACA8' }}>Chỉ xem</span>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {isAdmin && (
                <a href={previewFile.url} download={previewFile.name} onClick={e => e.stopPropagation()}
                  className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: '#3B3B3B', color: '#C7C4B8' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#4A4A4A'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#3B3B3B'}
                >
                  <Download className="w-3.5 h-3.5" /> Tải xuống
                </a>
              )}
              <button onClick={() => setPreviewFile(null)}
                className="p-2 rounded-lg transition-colors" style={{ color: '#787774' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#3B3B3B'; (e.currentTarget as HTMLElement).style.color = '#fff'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#787774'; }}
                title="Đóng (Esc)"
              ><X className="w-4 h-4" /></button>
            </div>
          </div>

          {/* Body */}
          <div className="flex flex-1 overflow-hidden">

            {/* Viewer */}
            <div className="flex-1 overflow-hidden">
              {previewFile.type.includes('pdf') ? (
                <iframe src={`${previewFile.url}${!isAdmin ? '#toolbar=0' : ''}`} className="w-full h-full border-0 block" title="PDF Preview" />
              ) : (
                <img src={previewFile.url} alt={previewFile.name} className="w-full h-full object-contain" />
              )}
            </div>

            {/* Answer Panel — PDF only, desktop only */}
            {previewFile.type.includes('pdf') && (
              <div className="hidden md:flex flex-col shrink-0" style={{ width: '220px', background: '#1E1E1E', borderLeft: '1px solid #333' }}>

                {/* Header */}
                <div className="flex items-center justify-between px-3 py-2.5 shrink-0" style={{ borderBottom: '1px solid #2D2D2D' }}>
                  <div className="flex items-center gap-1.5">
                    <ClipboardList className="w-3.5 h-3.5" style={{ color: '#6B7CDB' }} />
                    <span className="text-xs font-semibold" style={{ color: '#C7C4B8' }}>Phiếu trả lời</span>
                  </div>
                  {panel.numQuestions > 0 && (
                    <button onClick={resetPanel} className="p-1 rounded transition-colors" style={{ color: '#787774' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#E03E3E'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#787774'}
                      title="Nhập lại"
                    ><RotateCcw className="w-3 h-3" /></button>
                  )}
                </div>

                {panel.numQuestions === 0 ? (
                  <div className="p-3 space-y-2.5">
                    <p className="text-[11px] leading-relaxed" style={{ color: '#787774' }}>Xem đề có bao nhiêu câu, rồi nhập vào để bắt đầu điền đáp án.</p>
                    <div className="flex gap-1.5">
                      <input type="number" min={1} max={200}
                        value={panel.numQuestionsInput}
                        onChange={e => setPanel(p => ({ ...p, numQuestionsInput: e.target.value }))}
                        onKeyDown={e => e.key === 'Enter' && confirmNumQuestions()}
                        placeholder="Số câu..."
                        className="flex-1 min-w-0 text-xs px-2.5 py-1.5 rounded-lg outline-none"
                        style={{ background: '#2A2A2A', border: '1px solid #3B3B3B', color: '#E5E5E4' }}
                      />
                      <button onClick={confirmNumQuestions}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold shrink-0"
                        style={{ background: '#6B7CDB', color: '#fff' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#5A6BC9'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#6B7CDB'}
                      >OK</button>
                    </div>
                    <div className="flex items-start gap-1.5 rounded-lg px-2 py-1.5" style={{ background: '#2A2A2A', border: '1px solid #3B3B3B' }}>
                      <span className="text-[10px] shrink-0 mt-px" style={{ color: '#F59E0B' }}>💡</span>
                      <p className="text-[10px] leading-relaxed" style={{ color: '#787774' }}>
                        Có câu <span style={{ color: '#C7C4B8', fontWeight: 600 }}>tự luận</span>? Click vào{' '}
                        <span style={{ color: '#F59E0B', fontWeight: 700 }}>số câu</span> để chuyển sang ô gõ tự do.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Stats */}
                    <div className="flex items-center justify-between px-3 py-1.5 shrink-0 text-[10px]" style={{ background: '#1A1A1A', borderBottom: '1px solid #2D2D2D', color: '#787774' }}>
                      <span>{panel.numQuestions} câu</span>
                      <span style={{ color: '#6B7CDB' }}>{Object.values(panel.answers).filter(Boolean).length} đã điền</span>
                    </div>

                    {/* Question list */}
                    <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#3B3B3B #1E1E1E' }}>
                      {Array.from({ length: panel.numQuestions }, (_, i) => i + 1).map(q => {
                        const chosen = panel.answers[q] || '';
                        const isTL = (panel.questionTypes[q] || 'TN') === 'TL';
                        return (
                          <div key={q} className="flex items-center gap-1 px-2 py-1" style={{ borderBottom: '1px solid #252525' }}>
                            <button onClick={() => toggleQuestionType(q)}
                              className="text-[10px] font-mono w-6 shrink-0 text-center rounded transition-colors"
                              style={{ color: isTL ? '#F59E0B' : '#57564F', background: 'transparent' }}
                              title={isTL ? 'Đang ở chế độ Tự luận — click để chuyển sang Trắc nghiệm' : 'Click để chuyển sang Tự luận'}
                            >{q}.</button>
                            {isTL ? (
                              <input type="text" value={chosen}
                                onChange={e => setTextAnswer(q, e.target.value)}
                                placeholder="Đáp án..."
                                className="flex-1 min-w-0 text-[11px] px-1.5 py-0.5 rounded outline-none"
                                style={{ background: '#2A2A2A', border: '1px solid #F59E0B', color: '#E5E5E4' }}
                              />
                            ) : (
                              <div className="flex gap-0.5 flex-1">
                                {['A', 'B', 'C', 'D'].map(letter => {
                                  const active = chosen === letter;
                                  return (
                                    <button key={letter} onClick={() => toggleAnswer(q, letter)}
                                      className="flex-1 text-[11px] font-bold py-0.5 rounded transition-colors"
                                      style={{
                                        background: active ? '#6B7CDB' : '#2A2A2A',
                                        color: active ? '#fff' : '#57564F',
                                        border: active ? '1px solid #6B7CDB' : '1px solid #333',
                                      }}
                                    >{letter}</button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <div className="h-4" />
                    </div>
                  </>
                )}
              </div>
            )}

          </div>
        </div>
      )}
    </>
  );
};

export default ChapterView;
