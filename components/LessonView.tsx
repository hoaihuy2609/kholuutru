import React, { useRef, useState, useMemo, useEffect } from 'react';
import { ArrowLeft, FileText, Trash2, UploadCloud, Download, Eye, ArrowUpDown, X, RotateCcw, ClipboardList } from 'lucide-react';
import { Lesson, StoredFile } from '../types';
import SearchBar from './SearchBar';

interface LessonViewProps {
  lesson: Lesson;
  files: StoredFile[];
  isAdmin: boolean;
  onBack: () => void;
  onUpload: (files: File[], category?: string) => void;
  onDelete: (fileId: string) => void;
}

type SortOption = 'name-asc' | 'name-desc' | 'date-asc' | 'date-desc' | 'size-asc' | 'size-desc';

const LESSON_CATEGORIES = [
  'Trắc nghiệm Lý thuyết (ABCD)',
  'Trắc nghiệm Lý thuyết (Đúng/Sai)',
  'Bài tập Tính toán Cơ bản',
];

// ── Answer Panel State ──────────────────────────────────────────
interface AnswerPanelState {
  numQuestionsInput: string;
  numQuestions: number;
  answers: Record<number, string>;      // TN: 'A'/'B'/'C'/'D'  |  TL: free text
  questionTypes: Record<number, 'TN' | 'TL'>; // default TN
}

const LessonView: React.FC<LessonViewProps> = ({ lesson, files, isAdmin, onBack, onUpload, onDelete }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');
  const [previewFile, setPreviewFile] = useState<StoredFile | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(LESSON_CATEGORIES[0]);

  // Answer panel (only meaningful on desktop, wiped each time PDF opens)
  const [panel, setPanel] = useState<AnswerPanelState>({
    numQuestionsInput: '',
    numQuestions: 0,
    answers: {},
    questionTypes: {},
  });

  // Reset panel whenever a new file is opened
  useEffect(() => {
    if (previewFile) {
      setPanel({ numQuestionsInput: '', numQuestions: 0, answers: {}, questionTypes: {} });
    }
  }, [previewFile?.id]);

  // Lock body scroll while preview is open
  useEffect(() => {
    if (previewFile) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [!!previewFile]);

  // Escape key closes preview
  useEffect(() => {
    const handle = (e: KeyboardEvent) => { if (e.key === 'Escape') setPreviewFile(null); };
    if (previewFile) window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [!!previewFile]);

  const confirmNumQuestions = () => {
    const n = parseInt(panel.numQuestionsInput, 10);
    if (!isNaN(n) && n > 0 && n <= 200) {
      setPanel(p => ({ ...p, numQuestions: n, answers: {}, questionTypes: {} }));
    }
  };

  const toggleAnswer = (q: number, letter: string) => {
    setPanel(p => ({
      ...p,
      answers: { ...p.answers, [q]: p.answers[q] === letter ? '' : letter },
    }));
  };

  const setTextAnswer = (q: number, text: string) => {
    setPanel(p => ({ ...p, answers: { ...p.answers, [q]: text } }));
  };

  const toggleQuestionType = (q: number) => {
    setPanel(p => {
      const current = p.questionTypes[q] || 'TN';
      const next = current === 'TN' ? 'TL' : 'TN';
      return {
        ...p,
        questionTypes: { ...p.questionTypes, [q]: next },
        answers: { ...p.answers, [q]: '' }, // clear answer when switching
      };
    });
  };

  const resetAnswers = () => {
    setPanel(p => ({ ...p, answers: {}, numQuestionsInput: '', numQuestions: 0, questionTypes: {} }));
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files?.length > 0) onUpload(Array.from(e.dataTransfer.files), selectedCategory || undefined);
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length > 0) onUpload(Array.from(e.target.files), selectedCategory || undefined);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024; const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + ['B', 'KB', 'MB', 'GB'][i];
  };

  const formatDate = (ts: number) => new Date(ts).toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

  const filteredAndSortedFiles = useMemo(() => {
    let result = [...files];
    if (selectedCategory) result = result.filter(f => f.category === selectedCategory);
    if (searchQuery) {
      const q = searchQuery.toLowerCase().trim().normalize('NFC');
      result = result.filter(f => (f.name || '').toLowerCase().normalize('NFC').includes(q));
    }
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name-asc': return a.name.localeCompare(b.name);
        case 'name-desc': return b.name.localeCompare(a.name);
        case 'date-asc': return a.uploadDate - b.uploadDate;
        case 'date-desc': return b.uploadDate - a.uploadDate;
        case 'size-asc': return a.size - b.size;
        case 'size-desc': return b.size - a.size;
        default: return 0;
      }
    });
    return result;
  }, [files, searchQuery, sortBy, selectedCategory]);

  const categoriesWithCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    LESSON_CATEGORIES.forEach(cat => (counts[cat] = 0));
    files.forEach(f => {
      if (f.category && LESSON_CATEGORIES.includes(f.category)) counts[f.category]++;
      else counts['Khác'] = (counts['Khác'] || 0) + 1;
    });
    return counts;
  }, [files]);

  return (
    <>
      <div className="space-y-6 animate-fade-in relative pb-10">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg transition-colors"
            style={{ background: '#F1F0EC', border: '1px solid #E9E9E7', color: '#57564F' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#E9E9E7'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#F1F0EC'}
            title="Quay lại"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <span
              className="inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded mb-1"
              style={{ background: '#EEF0FB', color: '#6B7CDB' }}
            >
              Bài học
            </span>
            <h2 className="text-2xl font-semibold" style={{ color: '#1A1A1A' }}>
              {lesson.name}
            </h2>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-0.5 overflow-x-auto" style={{ borderBottom: '1px solid #E9E9E7' }}>
          {LESSON_CATEGORIES.map(cat => {
            const isActive = selectedCategory === cat;
            const mobileLabel: Record<string, string> = {
              'Trắc nghiệm Lý thuyết (ABCD)': 'TN ABCD',
              'Trắc nghiệm Lý thuyết (Đúng/Sai)': 'Đúng/Sai',
              'Bài tập Tính toán Cơ bản': 'Tính toán',
            };
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className="relative px-2.5 md:px-3 py-2 text-xs md:text-sm font-medium transition-colors rounded-t-md shrink-0 whitespace-nowrap"
                style={{
                  color: isActive ? '#6B7CDB' : '#787774',
                  background: isActive ? '#FFFFFF' : 'transparent',
                  borderBottom: isActive ? '2px solid #6B7CDB' : '2px solid transparent',
                  marginBottom: '-1px',
                }}
              >
                <span className="md:hidden">{mobileLabel[cat] || cat}</span>
                <span className="hidden md:inline">{cat}</span>
                <span
                  className="ml-1.5 text-xs px-1.5 py-0.5 rounded"
                  style={{
                    background: isActive ? '#EEF0FB' : '#F1F0EC',
                    color: isActive ? '#6B7CDB' : '#AEACA8',
                  }}
                >
                  {categoriesWithCounts[cat] || 0}
                </span>
              </button>
            );
          })}
        </div>

        {/* Upload Area (Admin only) */}
        {isAdmin && (
          <div
            className="border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors"
            style={{
              borderColor: isDragging ? '#6B7CDB' : '#E9E9E7',
              background: isDragging ? '#EEF0FB' : '#FAFAF9',
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
              style={{ background: isDragging ? '#EEF0FB' : '#F1F0EC' }}
            >
              <UploadCloud className="w-6 h-6" style={{ color: isDragging ? '#6B7CDB' : '#AEACA8' }} />
            </div>
            <p className="text-sm font-medium mb-1" style={{ color: '#1A1A1A' }}>
              {isDragging ? 'Thả file vào đây!' : `Tải tài liệu lên${selectedCategory ? ` vào "${selectedCategory}"` : ''}`}
            </p>
            <p className="text-xs" style={{ color: '#AEACA8' }}>
              Kéo thả hoặc click để chọn file PDF
            </p>
            <input ref={fileInputRef} type="file" className="hidden" accept=".pdf" multiple onChange={handleFileChange} />
          </div>
        )}

        {/* File List Section */}
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: '1px solid #E9E9E7', background: '#FFFFFF' }}
        >
          {/* Toolbar */}
          <div
            className="flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-3 p-3 md:p-4"
            style={{ borderBottom: '1px solid #E9E9E7', background: '#FAFAF9' }}
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" style={{ color: '#6B7CDB' }} />
              <span className="text-sm font-medium" style={{ color: '#1A1A1A' }}>
                {selectedCategory || 'Tất cả tài liệu'}
              </span>
              <span className="text-xs" style={{ color: '#AEACA8' }}>
                {filteredAndSortedFiles.length} file
              </span>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 md:w-60">
                <SearchBar onSearch={setSearchQuery} placeholder="Tìm tài liệu..." />
              </div>
              <div className="relative shrink-0">
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as SortOption)}
                  className="appearance-none text-sm px-3 py-2 pr-8 rounded-lg outline-none cursor-pointer"
                  style={{ background: '#FFFFFF', border: '1px solid #E9E9E7', color: '#57564F' }}
                >
                  <option value="date-desc">Mới nhất</option>
                  <option value="date-asc">Cũ nhất</option>
                  <option value="name-asc">Tên A-Z</option>
                  <option value="name-desc">Tên Z-A</option>
                  <option value="size-desc">Dung lượng lớn</option>
                  <option value="size-asc">Dung lượng nhỏ</option>
                </select>
                <ArrowUpDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#AEACA8' }} />
              </div>
            </div>
          </div>

          {/* File Grid */}
          {filteredAndSortedFiles.length === 0 ? (
            <div
              className="py-16 text-center text-sm"
              style={{ color: '#AEACA8' }}
            >
              <div
                className="w-14 h-14 rounded-xl mx-auto mb-3 flex items-center justify-center"
                style={{ background: '#F1F0EC' }}
              >
                <FileText className="w-7 h-7" style={{ color: '#CFCFCB' }} />
              </div>
              <p className="font-medium mb-1" style={{ color: '#787774' }}>Chưa có tài liệu nào</p>
              <p style={{ color: '#AEACA8' }}>
                {searchQuery
                  ? 'Không tìm thấy kết quả phù hợp.'
                  : selectedCategory
                    ? `Chưa có tài liệu trong mục này.`
                    : 'Hãy tải lên tài liệu đầu tiên.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 md:gap-4 p-3 md:p-4">
              {filteredAndSortedFiles.map(file => (
                <div
                  key={file.id}
                  className="group rounded-xl overflow-hidden transition-colors
                             flex items-center gap-3 p-3
                             md:flex-col md:items-stretch md:gap-0 md:p-0 md:h-[260px]"
                  style={{ border: '1px solid #E9E9E7', background: '#FFFFFF' }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = '#CFCFCB';
                    (e.currentTarget as HTMLElement).style.background = '#FAFAF9';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = '#E9E9E7';
                    (e.currentTarget as HTMLElement).style.background = '#FFFFFF';
                  }}
                >
                  {/* ── Mobile: compact icon ── */}
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 md:hidden"
                    style={{ background: '#FEF2F2', border: '1px solid #fecaca' }}
                  >
                    <FileText className="w-5 h-5" style={{ color: '#E03E3E' }} />
                  </div>

                  {/* ── Desktop: preview area with hover overlay ── */}
                  <div
                    className="hidden md:flex flex-none h-32 items-center justify-center relative"
                    style={{ background: '#F7F6F3', borderBottom: '1px solid #E9E9E7' }}
                  >
                    <div
                      className="w-14 rounded-lg flex items-center justify-center transition-transform group-hover:scale-105"
                      style={{ background: '#FFFFFF', border: '1px solid #E9E9E7', padding: '10px 12px' }}
                    >
                      <FileText className="w-8 h-8" style={{ color: '#E03E3E' }} />
                    </div>
                    <div
                      className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity rounded-t-xl"
                      style={{ background: 'rgba(247,246,243,0.85)' }}
                    >
                      <button
                        onClick={e => { e.stopPropagation(); setPreviewFile(file); }}
                        className="p-2 rounded-lg"
                        style={{ background: '#FFFFFF', border: '1px solid #E9E9E7', color: '#6B7CDB' }}
                        title="Xem trước"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {isAdmin && (
                        <button
                          onClick={e => { e.stopPropagation(); onDelete(file.id); }}
                          className="p-2 rounded-lg"
                          style={{ background: '#FFFFFF', border: '1px solid #E9E9E7', color: '#E03E3E' }}
                          title="Xóa"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* ── Mobile: file info inline ── */}
                  <div className="flex-1 min-w-0 md:hidden">
                    <h4 className="text-sm font-medium truncate" style={{ color: '#1A1A1A' }} title={file.name}>
                      {file.name}
                    </h4>
                    <p className="text-[10px] mt-0.5" style={{ color: '#AEACA8' }}>
                      {file.type.split('/')[1]?.toUpperCase() || 'FILE'} · {formatSize(file.size)} · {formatDate(file.uploadDate)}
                    </p>
                  </div>

                  {/* ── Mobile: action buttons always visible ── */}
                  <div className="flex items-center gap-1.5 shrink-0 md:hidden">
                    <button
                      onClick={e => { e.stopPropagation(); setPreviewFile(file); }}
                      className="p-2 rounded-lg"
                      style={{ background: '#EEF0FB', color: '#6B7CDB' }}
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {isAdmin && (
                      <button
                        onClick={e => { e.stopPropagation(); onDelete(file.id); }}
                        className="p-2 rounded-lg"
                        style={{ background: '#FEF2F2', color: '#E03E3E' }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* ── Desktop: file info bottom section ── */}
                  <div className="hidden md:flex flex-1 p-3 flex-col justify-between">
                    <div>
                      <h4
                        className="text-sm font-medium line-clamp-2 leading-snug mb-1.5"
                        style={{ color: '#1A1A1A' }}
                        title={file.name}
                      >
                        {file.name}
                      </h4>
                      <div className="flex items-center gap-1.5 text-xs" style={{ color: '#AEACA8' }}>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: '#F1F0EC', color: '#787774' }}>
                          {file.type.split('/')[1]?.toUpperCase() || 'FILE'}
                        </span>
                        <span>·</span>
                        <span>{formatSize(file.size)}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2.5 mt-2" style={{ borderTop: '1px solid #F1F0EC' }}>
                      <span className="text-[10px]" style={{ color: '#AEACA8' }}>{formatDate(file.uploadDate)}</span>
                      {isAdmin && (
                        <a
                          href={file.url}
                          download={file.name}
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color: '#6B7CDB' }}
                          onClick={e => e.stopPropagation()}
                          title="Tải xuống"
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#EEF0FB'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── PDF Preview Overlay ───────────────────────────────────────── */}
      {previewFile && (
        <div className="fixed inset-0 z-[100] flex flex-col" style={{ background: '#1A1A1A' }}>

          {/* ── Top bar ── */}
          <div
            className="flex items-center justify-between px-4 py-2.5 shrink-0"
            style={{ background: '#242424', borderBottom: '1px solid #333' }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded flex items-center justify-center shrink-0" style={{ background: '#3B3B3B' }}>
                <FileText className="w-3.5 h-3.5" style={{ color: '#E03E3E' }} />
              </div>
              <span className="text-sm font-medium truncate" style={{ color: '#E5E5E4' }}>{previewFile.name}</span>
              {!isAdmin && (
                <span
                  className="hidden md:inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded"
                  style={{ background: '#3B3B3B', color: '#AEACA8' }}
                >
                  Chỉ xem
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {isAdmin && (
                <a
                  href={previewFile.url}
                  download={previewFile.name}
                  onClick={e => e.stopPropagation()}
                  className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{ background: '#3B3B3B', color: '#C7C4B8' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#4A4A4A'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#3B3B3B'}
                >
                  <Download className="w-3.5 h-3.5" />
                  Tải xuống
                </a>
              )}
              <button
                onClick={() => setPreviewFile(null)}
                className="p-2 rounded-lg transition-colors"
                style={{ color: '#787774' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#3B3B3B'; (e.currentTarget as HTMLElement).style.color = '#fff'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#787774'; }}
                title="Đóng (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── Body: PDF + Answer Panel ── */}
          <div className="flex flex-1 overflow-hidden">

            {/* PDF Viewer */}
            <div className="flex-1 overflow-hidden">
              <iframe
                src={`${previewFile.url}${!isAdmin ? '#toolbar=0' : ''}`}
                className="w-full h-full border-0 block"
                title="PDF Preview"
              />
            </div>

            {/* ── Answer Panel — desktop only ── */}
            <div
              className="hidden md:flex flex-col shrink-0"
              style={{
                width: '220px',
                background: '#1E1E1E',
                borderLeft: '1px solid #333',
              }}
            >
              {/* Panel header */}
              <div
                className="flex items-center justify-between px-3 py-2.5 shrink-0"
                style={{ borderBottom: '1px solid #2D2D2D' }}
              >
                <div className="flex items-center gap-1.5">
                  <ClipboardList className="w-3.5 h-3.5" style={{ color: '#6B7CDB' }} />
                  <span className="text-xs font-semibold" style={{ color: '#C7C4B8' }}>Phiếu trả lời</span>
                </div>
                {panel.numQuestions > 0 && (
                  <button
                    onClick={resetAnswers}
                    className="p-1 rounded transition-colors"
                    style={{ color: '#787774' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#E03E3E'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#787774'}
                    title="Nhập lại"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Setup: input number of questions */}
              {panel.numQuestions === 0 ? (
                <div className="p-3 space-y-2.5">
                  <p className="text-[11px] leading-relaxed" style={{ color: '#787774' }}>
                    Xem đề có bao nhiêu câu, rồi nhập vào để bắt đầu điền đáp án.
                  </p>
                  <div className="flex gap-1.5">
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={panel.numQuestionsInput}
                      onChange={e => setPanel(p => ({ ...p, numQuestionsInput: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && confirmNumQuestions()}
                      placeholder="Số câu..."
                      className="flex-1 min-w-0 text-xs px-2.5 py-1.5 rounded-lg outline-none"
                      style={{
                        background: '#2A2A2A',
                        border: '1px solid #3B3B3B',
                        color: '#E5E5E4',
                      }}
                    />
                    <button
                      onClick={confirmNumQuestions}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0"
                      style={{ background: '#6B7CDB', color: '#fff' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#5A6BC9'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#6B7CDB'}
                    >
                      OK
                    </button>
                  </div>
                  {/* Tip */}
                  <div
                    className="flex items-start gap-1.5 rounded-lg px-2 py-1.5"
                    style={{ background: '#2A2A2A', border: '1px solid #3B3B3B' }}
                  >
                    <span className="text-[10px] shrink-0 mt-px" style={{ color: '#F59E0B' }}>💡</span>
                    <p className="text-[10px] leading-relaxed" style={{ color: '#787774' }}>
                      Có câu <span style={{ color: '#C7C4B8', fontWeight: 600 }}>tự luận, đúng/sai</span>? Click vào{' '}
                      <span style={{ color: '#F59E0B', fontWeight: 700 }}>số câu</span> để chuyển sang ô gõ tự do.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Stats bar */}
                  <div
                    className="flex items-center justify-between px-3 py-1.5 shrink-0 text-[10px]"
                    style={{ background: '#1A1A1A', borderBottom: '1px solid #2D2D2D', color: '#787774' }}
                  >
                    <span>{panel.numQuestions} câu</span>
                    <span style={{ color: '#6B7CDB' }}>
                      {Object.values(panel.answers).filter(Boolean).length} đã điền
                    </span>
                  </div>

                  {/* Scrollable question list */}
                  <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#3B3B3B #1E1E1E' }}>
                    {Array.from({ length: panel.numQuestions }, (_, i) => i + 1).map(q => {
                      const chosen = panel.answers[q] || '';
                      const qType = panel.questionTypes[q] || 'TN';
                      const isTL = qType === 'TL';
                      return (
                        <div
                          key={q}
                          className="flex items-center gap-1 px-2 py-1"
                          style={{ borderBottom: '1px solid #252525' }}
                        >
                          {/* Question number + TN/TL toggle */}
                          <button
                            onClick={() => toggleQuestionType(q)}
                            className="text-[10px] font-mono w-6 shrink-0 text-center rounded transition-colors"
                            style={{
                              color: isTL ? '#F59E0B' : '#57564F',
                              background: 'transparent',
                            }}
                            title={isTL ? 'Đang ở chế độ Tự luận — click để chuyển sang Trắc nghiệm' : 'Click để chuyển sang Tự luận'}
                          >
                            {q}.
                          </button>

                          {isTL ? (
                            /* ── TL: free-text input ── */
                            <input
                              type="text"
                              value={chosen}
                              onChange={e => setTextAnswer(q, e.target.value)}
                              placeholder="Đáp án..."
                              className="flex-1 min-w-0 text-[11px] px-1.5 py-0.5 rounded outline-none"
                              style={{
                                background: '#2A2A2A',
                                border: '1px solid #F59E0B',
                                color: '#E5E5E4',
                              }}
                            />
                          ) : (
                            /* ── TN: ABCD buttons ── */
                            <div className="flex gap-0.5 flex-1">
                              {['A', 'B', 'C', 'D'].map(letter => {
                                const active = chosen === letter;
                                return (
                                  <button
                                    key={letter}
                                    onClick={() => toggleAnswer(q, letter)}
                                    className="flex-1 text-[11px] font-bold py-0.5 rounded transition-colors"
                                    style={{
                                      background: active ? '#6B7CDB' : '#2A2A2A',
                                      color: active ? '#fff' : '#57564F',
                                      border: active ? '1px solid #6B7CDB' : '1px solid #333',
                                    }}
                                  >
                                    {letter}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {/* Bottom padding */}
                    <div className="h-4" />
                  </div>
                </>
              )}
            </div>

          </div>
        </div>
      )}
    </>
  );
};

export default LessonView;

