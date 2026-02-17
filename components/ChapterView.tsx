import React, { useState, useRef } from 'react';
import { ArrowLeft, Plus, Folder, Trash2, ChevronRight, ArrowUpDown, FileText, UploadCloud, Eye, BookOpen } from 'lucide-react';
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
  const [sortOption, setSortOption] = useState<'newest' | 'oldest' | 'az' | 'za'>('newest');
  const [previewFile, setPreviewFile] = useState<StoredFile | null>(null);
  const [uploadCategory, setUploadCategory] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (autoCreate) {
      setIsCreating(true);
    }
  }, [autoCreate]);

  // Filter chapter files by category
  const theoryFiles = chapterFiles.filter(f => f.category === "Lý thuyết trọng tâm (Chương)");
  const advancedFiles = chapterFiles.filter(f => f.category === "Bài tập Tính toán Nâng cao");
  const trueFalseFiles = chapterFiles.filter(f => f.category === "Trắc nghiệm Đúng/Sai (Chương)");

  const filteredLessons = lessons
    .filter(lesson => {
      const name = (lesson.name || '').toLowerCase().normalize('NFC');
      const search = searchTerm.toLowerCase().trim().normalize('NFC');
      return name.includes(search);
    })
    .sort((a, b) => {
      switch (sortOption) {
        case 'newest':
          return b.createdAt - a.createdAt;
        case 'oldest':
          return a.createdAt - b.createdAt;
        case 'az':
          return a.name.localeCompare(b.name);
        case 'za':
          return b.name.localeCompare(a.name);
        default:
          return 0;
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
    const sizes = ['B', 'KB', 'MB', 'GB'];
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={onBack}
          className="p-3 bg-white border border-slate-100 shadow-sm rounded-xl text-slate-500 hover:text-indigo-600 hover:shadow-md hover:border-indigo-100 transition-all active:scale-95"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-indigo-100 text-indigo-700 uppercase tracking-wider">
              Chương học
            </span>
          </div>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight leading-tight">{chapter.name}</h2>
              <p className="text-slate-500">{chapter.description}</p>
            </div>
            {isAdmin && !isCreating && (
              <button
                onClick={() => setIsCreating(true)}
                className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 font-bold active:scale-95 whitespace-nowrap"
              >
                <Plus className="w-5 h-5" />
                Tạo bài học mới
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Chapter Special Category: Core Theory */}
      <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl p-8 text-white shadow-xl shadow-orange-200 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl group-hover:scale-110 transition-transform duration-700"></div>
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="max-w-xl">
              <h3 className="text-2xl font-bold mb-2 flex items-center gap-3">
                <span className="p-2 bg-white/20 backdrop-blur-md rounded-xl">
                  <BookOpen className="w-6 h-6" />
                </span>
                Kho Lý thuyết trọng tâm
              </h3>
              <p className="text-amber-50 text-sm leading-relaxed">
                Khu vực lưu trữ các bài giảng lý thuyết, sơ đồ tư duy và kiến thức cốt lõi của chương. Học sinh có thể click xem trực tiếp.
              </p>
            </div>
            {isAdmin && (
              <button
                onClick={() => triggerUpload("Lý thuyết trọng tâm (Chương)")}
                className="flex items-center justify-center gap-2 bg-white text-orange-700 px-6 py-3 rounded-2xl font-bold shadow-lg hover:shadow-xl hover:translate-y-[-2px] transition-all active:scale-95 whitespace-nowrap"
              >
                <UploadCloud className="w-5 h-5" />
                Tải lý thuyết lên
              </button>
            )}
          </div>

          {theoryFiles.length > 0 && (
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {theoryFiles.map(file => (
                <div
                  key={file.id}
                  className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 flex items-center justify-between group/file hover:bg-white/20 transition-all cursor-pointer"
                  onClick={() => setPreviewFile(file)}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <FileText className="w-5 h-5 text-amber-200 shrink-0" />
                    <div className="overflow-hidden">
                      <p className="text-sm font-bold truncate pr-2">{file.name}</p>
                      <p className="text-[10px] text-amber-100 uppercase">{formatSize(file.size)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover/file:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); setPreviewFile(file); }}
                      className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {isAdmin && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onDeleteChapterFile(file.id); }}
                        className="p-1.5 hover:bg-red-400/30 text-red-100 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Lesson Section */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
            <span className="w-1.5 h-6 bg-indigo-600 rounded-full"></span>
            Bài học trong chương
          </h3>
        </div>

        {isCreating && (
          <form onSubmit={handleSubmit} className="flex gap-3 items-center animate-fade-in bg-slate-50 p-4 rounded-2xl mb-6">
            <input
              type="text"
              value={newLessonName}
              onChange={(e) => setNewLessonName(e.target.value)}
              placeholder="Nhập tên bài học (VD: Bài 1: Động lượng)"
              className="flex-1 px-4 py-2.5 rounded-xl border border-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all shadow-sm"
              autoFocus
            />
            <button
              type="submit"
              disabled={!newLessonName.trim()}
              className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:shadow-none shadow-lg shadow-indigo-100 font-bold transition-all"
            >
              Lưu bài
            </button>
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="bg-white text-slate-600 px-6 py-2.5 rounded-xl hover:bg-slate-50 border border-slate-200 font-bold transition-all"
            >
              Hủy
            </button>
          </form>
        )}

        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1">
            <SearchBar onSearch={setSearchTerm} placeholder="Tìm bài học..." />
          </div>
          <div className="relative shrink-0">
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as any)}
              className="appearance-none bg-slate-50 border border-transparent text-slate-700 text-sm font-bold rounded-xl focus:ring-4 focus:ring-indigo-100 block w-full p-2.5 pr-10 outline-none transition-all cursor-pointer"
            >
              <option value="newest">Mới nhất</option>
              <option value="oldest">Cũ nhất</option>
              <option value="az">Tên A-Z</option>
              <option value="za">Tên Z-A</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
              <ArrowUpDown className="h-4 w-4" />
            </div>
          </div>
        </div>

        {filteredLessons.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-3xl">
            <Folder className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-400 font-medium">
              {searchTerm ? 'Không tìm thấy bài học phù hợp.' : 'Chưa có bài học nào.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredLessons.map((lesson) => (
              <div
                key={lesson.id}
                onClick={() => onSelectLesson(lesson)}
                className="group bg-slate-50 p-5 rounded-2xl hover:bg-white hover:shadow-xl hover:shadow-indigo-500/5 border border-transparent hover:border-indigo-100 transition-all cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-4 overflow-hidden">
                  <div className="w-12 h-12 rounded-xl bg-white shadow-sm text-indigo-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <Folder className="w-6 h-6" />
                  </div>
                  <div className="overflow-hidden">
                    <h4 className="font-bold text-slate-800 group-hover:text-indigo-700 transition-colors truncate">
                      {lesson.name}
                    </h4>
                    <p className="text-[10px] text-slate-400 font-medium uppercase mt-1">
                      {new Date(lesson.createdAt).toLocaleDateString('vi-VN')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteLesson(lesson.id); }}
                      className="p-2 text-slate-300 hover:bg-red-50 hover:text-red-500 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".pdf,image/*"
        multiple
        onChange={handleFileChange}
      />

      {/* Chapter Special Category: True/False Theory */}
      <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-3xl p-8 text-white shadow-xl shadow-teal-200 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl group-hover:scale-110 transition-transform duration-700"></div>
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="max-w-xl">
              <h3 className="text-2xl font-bold mb-2 flex items-center gap-3">
                <span className="p-2 bg-white/20 backdrop-blur-md rounded-xl">
                  <FileText className="w-6 h-6" />
                </span>
                Trắc nghiệm Đúng/Sai
              </h3>
              <p className="text-emerald-100 text-sm leading-relaxed">
                Khu vực dành cho các câu hỏi lý thuyết dạng Đúng/Sai của cả chương học.
              </p>
            </div>
            {isAdmin && (
              <button
                onClick={() => triggerUpload("Trắc nghiệm Đúng/Sai (Chương)")}
                className="flex items-center justify-center gap-2 bg-white text-emerald-700 px-6 py-3 rounded-2xl font-bold shadow-lg hover:shadow-xl hover:translate-y-[-2px] transition-all active:scale-95 whitespace-nowrap"
              >
                <UploadCloud className="w-5 h-5" />
                Tải bài tập Đúng/Sai
              </button>
            )}
          </div>

          {trueFalseFiles.length > 0 && (
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {trueFalseFiles.map(file => (
                <div key={file.id} className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 flex items-center justify-between group/file hover:bg-white/20 transition-all">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <FileText className="w-5 h-5 text-emerald-200 shrink-0" />
                    <div className="overflow-hidden">
                      <p className="text-sm font-bold truncate pr-2">{file.name}</p>
                      <p className="text-[10px] text-emerald-200 uppercase">{formatSize(file.size)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover/file:opacity-100 transition-opacity">
                    <button
                      onClick={() => setPreviewFile(file)}
                      className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => onDeleteChapterFile(file.id)}
                        className="p-1.5 hover:bg-red-400/30 text-red-100 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chapter Special Category: Advanced Calculation Quiz */}
      <div className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-3xl p-8 text-white shadow-xl shadow-indigo-200 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl group-hover:scale-110 transition-transform duration-700"></div>
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="max-w-xl">
              <h3 className="text-2xl font-bold mb-2 flex items-center gap-3">
                <span className="p-2 bg-white/20 backdrop-blur-md rounded-xl">
                  <Plus className="w-6 h-6" />
                </span>
                Bài tập Tính toán Nâng cao
              </h3>
              <p className="text-purple-100 text-sm leading-relaxed">
                Khu vực dành riêng cho các bài tập vận dụng cao, tính toán phức tạp của cả chương.
              </p>
            </div>
            {isAdmin && (
              <button
                onClick={() => triggerUpload("Bài tập Tính toán Nâng cao")}
                className="flex items-center justify-center gap-2 bg-white text-indigo-700 px-6 py-3 rounded-2xl font-bold shadow-lg hover:shadow-xl hover:translate-y-[-2px] transition-all active:scale-95 whitespace-nowrap"
              >
                <UploadCloud className="w-5 h-5" />
                Tải tài liệu nâng cao
              </button>
            )}
          </div>

          {advancedFiles.length > 0 && (
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {advancedFiles.map(file => (
                <div key={file.id} className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 flex items-center justify-between group/file hover:bg-white/20 transition-all">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <FileText className="w-5 h-5 text-purple-200 shrink-0" />
                    <div className="overflow-hidden">
                      <p className="text-sm font-bold truncate pr-2">{file.name}</p>
                      <p className="text-[10px] text-purple-200 uppercase">{formatSize(file.size)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover/file:opacity-100 transition-opacity">
                    <button
                      onClick={() => setPreviewFile(file)}
                      className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => onDeleteChapterFile(file.id)}
                        className="p-1.5 hover:bg-red-400/30 text-red-100 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* PDF Preview Modal */}
      <Modal
        isOpen={!!previewFile}
        onClose={() => setPreviewFile(null)}
        title={previewFile?.name || ''}
        maxWidth="1000px"
      >
        {previewFile && (
          <div className="p-5">
            <div className="w-full h-[80vh] bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
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
    </div>
  );
};

export default ChapterView;
