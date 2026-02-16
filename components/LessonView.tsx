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
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={onBack}
          className="p-2 hover:bg-white hover:shadow-md rounded-full transition-all text-gray-500"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-700 uppercase tracking-wide">Bài học</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mt-1">{lesson.name}</h2>
        </div>
      </div>

      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all cursor-pointer bg-white
          ${isDragging ? 'border-indigo-500 bg-indigo-50 scale-[1.01]' : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-4">
          <UploadCloud className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-semibold text-gray-800">Tải tài liệu lên</h3>
        <p className="text-gray-500 mt-2 text-sm max-w-sm">
          Kéo thả file PDF vào đây hoặc click để chọn file từ máy tính.
        </p>
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept=".pdf"
          multiple
          onChange={handleFileChange}
        />
      </div>

      {/* File List */}
      <div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-sm">{files.length}</span>
            Tài liệu đã lưu
          </h3>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="w-full sm:w-64">
              <SearchBar onSearch={setSearchQuery} placeholder="Tìm kiếm tài liệu..." />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            >
              <option value="date-desc">Mới nhất</option>
              <option value="date-asc">Cũ nhất</option>
              <option value="name-asc">Tên A-Z</option>
              <option value="name-desc">Tên Z-A</option>
              <option value="size-desc">Kích thước lớn nhất</option>
              <option value="size-asc">Kích thước nhỏ nhất</option>
            </select>
          </div>
        </div>

        {filteredAndSortedFiles.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
              <FileText className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500 font-medium">
              {searchQuery ? 'Không tìm thấy tài liệu phù hợp.' : 'Chưa có tài liệu nào trong bài này.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAndSortedFiles.map((file) => (
              <div key={file.id} className="group bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all flex flex-col justify-between h-36 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); setPreviewFile(file); }}
                    className="p-1.5 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 transition-colors"
                    title="Xem trước"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(file.id); }}
                    className="p-1.5 bg-red-50 text-red-500 rounded hover:bg-red-100 transition-colors"
                    title="Xóa file"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-red-50 rounded-lg text-red-500">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-800 truncate" title={file.name}>{file.name}</h4>
                    <p className="text-xs text-gray-400 mt-1">{formatSize(file.size)}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-50">
                  <span className="text-xs text-gray-400">{formatDate(file.uploadDate)}</span>
                  <a
                    href={file.url}
                    download={file.name}
                    className="text-indigo-600 text-xs font-semibold hover:underline flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Download className="w-3 h-3" />
                    Tải xuống
                  </a>
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
        maxWidth="900px"
      >
        {previewFile && (
          <div className="w-full h-[70vh]">
            <iframe
              src={previewFile.url}
              className="w-full h-full border-0 rounded-lg"
              title="PDF Preview"
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default LessonView;
