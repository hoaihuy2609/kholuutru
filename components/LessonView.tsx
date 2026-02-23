import React, { useRef, useState, useMemo } from 'react';
import { ArrowLeft, FileText, Trash2, UploadCloud, Download, Eye, ArrowUpDown } from 'lucide-react';
import { Lesson, StoredFile } from '../types';
import SearchBar from './SearchBar';
import Modal from './Modal';

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

const LessonView: React.FC<LessonViewProps> = ({ lesson, files, isAdmin, onBack, onUpload, onDelete }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');
  const [previewFile, setPreviewFile] = useState<StoredFile | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(LESSON_CATEGORIES[0]);

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
        <div className="flex flex-wrap gap-1" style={{ borderBottom: '1px solid #E9E9E7', paddingBottom: '0' }}>
          {LESSON_CATEGORIES.map(cat => {
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className="relative px-3 py-2 text-sm font-medium transition-colors rounded-t-md"
                style={{
                  color: isActive ? '#6B7CDB' : '#787774',
                  background: isActive ? '#FFFFFF' : 'transparent',
                  borderBottom: isActive ? '2px solid #6B7CDB' : '2px solid transparent',
                  marginBottom: '-1px',
                }}
              >
                {cat}
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
            className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4"
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
              <div className="w-60">
                <SearchBar onSearch={setSearchQuery} placeholder="Tìm tài liệu..." />
              </div>
              <div className="relative">
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
              {filteredAndSortedFiles.map(file => (
                <div
                  key={file.id}
                  className="group rounded-xl overflow-hidden flex flex-col transition-colors"
                  style={{ border: '1px solid #E9E9E7', height: '260px', background: '#FFFFFF' }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = '#CFCFCB';
                    (e.currentTarget as HTMLElement).style.background = '#FAFAF9';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = '#E9E9E7';
                    (e.currentTarget as HTMLElement).style.background = '#FFFFFF';
                  }}
                >
                  {/* Preview Area */}
                  <div
                    className="flex-none h-32 flex items-center justify-center relative"
                    style={{ background: '#F7F6F3', borderBottom: '1px solid #E9E9E7' }}
                  >
                    {/* File icon */}
                    <div
                      className="w-14 h-18 rounded-lg flex items-center justify-center transition-transform group-hover:scale-105"
                      style={{ background: '#FFFFFF', border: '1px solid #E9E9E7', padding: '10px 12px' }}
                    >
                      <FileText className="w-8 h-8" style={{ color: '#E03E3E' }} />
                    </div>

                    {/* Hover overlay with actions */}
                    <div
                      className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity rounded-t-xl"
                      style={{ background: 'rgba(247,246,243,0.85)' }}
                    >
                      <button
                        onClick={e => { e.stopPropagation(); setPreviewFile(file); }}
                        className="p-2 rounded-lg transition-colors"
                        style={{ background: '#FFFFFF', border: '1px solid #E9E9E7', color: '#6B7CDB' }}
                        title="Xem trước"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {isAdmin && (
                        <button
                          onClick={e => { e.stopPropagation(); onDelete(file.id); }}
                          className="p-2 rounded-lg transition-colors"
                          style={{ background: '#FFFFFF', border: '1px solid #E9E9E7', color: '#E03E3E' }}
                          title="Xóa"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* File Info */}
                  <div className="flex-1 p-3 flex flex-col justify-between">
                    <div>
                      <h4
                        className="text-sm font-medium line-clamp-2 leading-snug mb-1.5"
                        style={{ color: '#1A1A1A' }}
                        title={file.name}
                      >
                        {file.name}
                      </h4>
                      <div className="flex items-center gap-1.5 text-xs" style={{ color: '#AEACA8' }}>
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                          style={{ background: '#F1F0EC', color: '#787774' }}
                        >
                          {file.type.split('/')[1]?.toUpperCase() || 'FILE'}
                        </span>
                        <span>·</span>
                        <span>{formatSize(file.size)}</span>
                      </div>
                    </div>

                    <div
                      className="flex items-center justify-between pt-2.5 mt-2"
                      style={{ borderTop: '1px solid #F1F0EC' }}
                    >
                      <span className="text-[10px]" style={{ color: '#AEACA8' }}>
                        {formatDate(file.uploadDate)}
                      </span>
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

      {/* PDF Preview Modal */}
      <Modal
        isOpen={!!previewFile}
        onClose={() => setPreviewFile(null)}
        title={previewFile?.name || ''}
        maxWidth="1200px"
      >
        {previewFile && (
          <div className="w-full h-full flex items-center justify-center p-0 md:p-6" style={{ background: '#F1F0EC' }}>
            <div
              className="w-full h-[82vh] md:h-[85vh] bg-white rounded-xl overflow-hidden"
              style={{ border: '1px solid #E9E9E7' }}
            >
              <iframe
                src={`${previewFile.url}${!isAdmin ? '#toolbar=0' : ''}`}
                className="w-full h-full border-0 block"
                title="PDF Preview"
              />
            </div>
          </div>
        )}
      </Modal>
    </>
  );
};

export default LessonView;
