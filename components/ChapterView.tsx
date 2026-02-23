import React, { useState, useRef } from 'react';
import { ArrowLeft, Plus, Folder, Trash2, ChevronRight, ArrowUpDown, FileText, UploadCloud, Eye, BookOpen, Zap } from 'lucide-react';
import SearchBar from './SearchBar';
import Modal from './Modal';
import { Chapter, Lesson, StoredFile } from '../types';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (autoCreate) setIsCreating(true);
  }, [autoCreate]);

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
      className="flex items-center justify-between px-4 py-2.5 rounded-lg cursor-pointer transition-colors group/file"
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
      <div className="flex items-center gap-1 opacity-0 group-hover/file:opacity-100 transition-opacity shrink-0">
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

  /* ── Reusable category section ── */
  const CategorySection = ({
    title, description, icon: Icon, accentColor, accentBg,
    files, sortValue, onSortChange, uploadLabel, uploadCategory: cat,
    showSort = false
  }: {
    title: string; description: string;
    icon: React.ElementType; accentColor: string; accentBg: string;
    files: StoredFile[]; sortValue?: string;
    onSortChange?: (v: any) => void; uploadLabel: string; uploadCategory: string;
    showSort?: boolean;
  }) => (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E9E9E7', background: '#FFFFFF' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between p-4"
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
        <div className="flex items-center gap-2 shrink-0">
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

      {/* File list */}
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
                {filteredLessons.map(lesson => (
                  <div
                    key={lesson.id}
                    onClick={() => onSelectLesson(lesson)}
                    className="flex items-center justify-between px-4 py-3 rounded-lg cursor-pointer transition-colors group"
                    style={{ background: '#FFFFFF', border: '1px solid #E9E9E7' }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.background = '#F7F6F3';
                      (e.currentTarget as HTMLElement).style.borderColor = '#CFCFCB';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = '#FFFFFF';
                      (e.currentTarget as HTMLElement).style.borderColor = '#E9E9E7';
                    }}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: '#F1F0EC' }}
                      >
                        <Folder className="w-4 h-4" style={{ color: '#787774' }} />
                      </div>
                      <div className="overflow-hidden">
                        <h4 className="text-sm font-medium truncate" style={{ color: '#1A1A1A' }}>
                          {lesson.name}
                        </h4>
                        <p className="text-[10px] uppercase mt-0.5" style={{ color: '#AEACA8' }}>
                          {new Date(lesson.createdAt).toLocaleDateString('vi-VN')}
                        </p>
                      </div>
                    </div>

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
                ))}
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

      {/* PDF Preview Modal */}
      <Modal
        isOpen={!!previewFile}
        onClose={() => setPreviewFile(null)}
        title={previewFile?.name || ''}
        maxWidth="1200px"
      >
        {previewFile && (
          <div className="w-full h-full flex items-center justify-center p-0 md:p-6" style={{ background: '#F1F0EC' }}>
            <div className="w-full h-[82vh] md:h-[85vh] bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E9E9E7' }}>
              {previewFile.type.includes('pdf') ? (
                <iframe
                  src={`${previewFile.url}${!isAdmin ? '#toolbar=0' : ''}`}
                  className="w-full h-full border-0"
                  title="PDF Preview"
                />
              ) : (
                <img
                  src={previewFile.url}
                  alt={previewFile.name}
                  className="w-full h-full object-contain"
                />
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
};

export default ChapterView;
