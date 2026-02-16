import React, { useRef, useState, useMemo } from 'react';
import { ArrowLeft, FileText, Trash2, UploadCloud, Download, Eye, ArrowUpDown } from 'lucide-react';
import { Lesson, StoredFile } from '../types';
import SearchBar from './SearchBar';
import Modal from './Modal';

interface LessonViewProps {
  lesson: Lesson;
  files: StoredFile[];
  onBack: () => void;
  onUpload: (files: File[]) => void;
  onDelete: (fileId: string) => void;
}

type SortOption = 'name-asc' | 'name-desc' | 'date-asc' | 'date-desc' | 'size-asc' | 'size-desc';

const LessonView: React.FC<LessonViewProps> = ({ lesson, files, onBack, onUpload, onDelete }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');
  const [previewFile, setPreviewFile] = useState<StoredFile | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUpload(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUpload(Array.from(e.target.files));
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Filter and sort files
  const filteredAndSortedFiles = useMemo(() => {
    let result = [...files];

    // Filter by search query
    if (searchQuery) {
      result = result.filter(file =>
        file.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'date-asc':
          return a.uploadDate - b.uploadDate;
        case 'date-desc':
          return b.uploadDate - a.uploadDate;
        case 'size-asc':
          return a.size - b.size;
        case 'size-desc':
          return b.size - a.size;
        default:
          return 0;
      }
    });

    return result;
  }, [files, searchQuery, sortBy]);

  return (
    <div className="space-y-8 animate-fade-in relative z-0 pb-10">
      {/* Background Decoration */}
      <div className="absolute top-0 right-[-10%] w-[400px] h-[400px] bg-purple-100/40 rounded-full blur-[80px] -z-10 animate-float opacity-50"></div>
      <div className="absolute top-[20%] left-[-10%] w-[300px] h-[300px] bg-blue-100/40 rounded-full blur-[80px] -z-10 animate-float opacity-50" style={{ animationDelay: '2s' }}></div>

      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={onBack}
          className="p-3 bg-white border border-slate-100 shadow-sm rounded-xl text-slate-500 hover:text-indigo-600 hover:shadow-md hover:border-indigo-100 transition-all active:scale-95"
          title="Quay lại"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-gradient-to-r from-indigo-500 to-purple-500 text-white uppercase tracking-wider shadow-sm">
              Bài học
            </span>
          </div>
          <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight leading-tight">
            {lesson.name}
          </h2>
        </div>
      </div>

      {/* Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center text-center transition-all duration-300 cursor-pointer overflow-hidden group
          ${isDragging
            ? 'border-indigo-500 bg-indigo-50/50 scale-[1.01] shadow-xl shadow-indigo-500/10'
            : 'border-slate-200 hover:border-indigo-400 hover:bg-slate-50/50 hover:shadow-lg hover:shadow-indigo-500/5'}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className={`w-20 h-20 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6 transition-transform duration-500 ${isDragging ? 'scale-110' : 'group-hover:scale-110 group-hover:rotate-3'}`}>
          <UploadCloud className={`w-10 h-10 text-indigo-600 transition-colors ${isDragging ? 'text-indigo-700' : ''}`} />
        </div>
        <h3 className="text-xl font-bold text-slate-800 mb-2">
          {isDragging ? 'Thả file vào đây ngay!' : 'Tải tài liệu lên'}
        </h3>
        <p className="text-slate-500 text-sm max-w-sm leading-relaxed">
          Kéo thả file PDF vào đây hoặc click để chọn từ máy tính. Hỗ trợ upload nhiều file cùng lúc.
        </p>
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept=".pdf"
          multiple
          onChange={handleFileChange}
        />

        {/* Decorative Grid */}
        <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#4f46e5_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none"></div>
      </div>

      {/* File List */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-white/60 backdrop-blur-md p-4 rounded-2xl border border-white/50 shadow-sm sticky top-4 z-20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <FileText className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">Tài liệu đã lưu</h3>
              <p className="text-xs text-slate-400 font-medium">{files.length} trên tổng số file</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="w-full sm:w-72">
              <SearchBar onSearch={setSearchQuery} placeholder="Tìm kiếm tài liệu..." />
            </div>
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="w-full appearance-none pl-4 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer hover:border-indigo-300 text-slate-600 shadow-sm"
              >
                <option value="date-desc">Mới nhất</option>
                <option value="date-asc">Cũ nhất</option>
                <option value="name-asc">Tên A-Z</option>
                <option value="name-desc">Tên Z-A</option>
                <option value="size-desc">Kích thước lớn nhất</option>
                <option value="size-asc">Kích thước nhỏ nhất</option>
              </select>
              <ArrowUpDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {filteredAndSortedFiles.length === 0 ? (
          <div className="text-center py-16 bg-white/50 backdrop-blur-sm rounded-3xl border border-dashed border-slate-200">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-slate-50 mb-6 shadow-inner">
              <FileText className="w-10 h-10 text-slate-300" />
            </div>
            <h4 className="text-lg font-semibold text-slate-700 mb-1">Chưa có tài liệu nào</h4>
            <p className="text-slate-500 text-sm">
              {searchQuery ? 'Không tìm thấy kết quả phù hợp.' : 'Hãy tải lên tài liệu đầu tiên của bạn.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredAndSortedFiles.map((file) => (
              <div key={file.id} className="group bg-white rounded-2xl shadow-sm border border-slate-100 hover:shadow-xl hover:shadow-indigo-500/10 hover:border-indigo-200 transition-all duration-300 relative overflow-hidden flex flex-col h-[280px]">
                {/* PDF Preview / Icon Placeholder */}
                <div className="h-36 bg-slate-50 group-hover:bg-indigo-50/30 transition-colors flex items-center justify-center relative border-b border-slate-100">
                  <div className="w-16 h-20 bg-white shadow-md border border-slate-100 rounded flex items-center justify-center transform group-hover:scale-110 group-hover:-rotate-3 transition-all duration-300">
                    <FileText className="w-8 h-8 text-red-500" />
                  </div>
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 gap-3 backdrop-blur-[1px]">
                    <button
                      onClick={(e) => { e.stopPropagation(); setPreviewFile(file); }}
                      className="p-2 bg-white text-indigo-600 rounded-full shadow-lg hover:scale-110 transition-transform active:scale-95"
                      title="Xem trước"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(file.id); }}
                      className="p-2 bg-white text-red-500 rounded-full shadow-lg hover:scale-110 transition-transform active:scale-95"
                      title="Xóa"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-slate-800 line-clamp-2 leading-snug mb-2 group-hover:text-indigo-600 transition-colors" title={file.name}>
                      {file.name}
                    </h4>
                    <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{file.type.split('/')[1].toUpperCase()}</span>
                      <span>•</span>
                      <span>{formatSize(file.size)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 mt-2 border-t border-slate-50">
                    <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">{formatDate(file.uploadDate)}</span>
                    <a
                      href={file.url}
                      download={file.name}
                      className="text-indigo-600 hover:text-indigo-700 p-1.5 hover:bg-indigo-50 rounded-lg transition-colors"
                      onClick={(e) => e.stopPropagation()}
                      title="Tải xuống"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* PDF Preview Modal */}
      <Modal
        isOpen={!!previewFile}
        onClose={() => setPreviewFile(null)}
        title={previewFile?.name || ''}
        maxWidth="1400px"
      >
        {previewFile && (
          <div className="w-full h-[75vh] bg-slate-100 rounded-xl overflow-hidden shadow-inner">
            <iframe
              src={previewFile.url}
              className="w-full h-full border-0"
              title="PDF Preview"
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default LessonView;
