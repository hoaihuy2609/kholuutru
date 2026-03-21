import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X, FolderOpen, FileText, ClipboardList, BookOpen, ChevronRight, Command, History, ArrowRight, File, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CURRICULUM } from '../constants';
import { Lesson } from '../types';
import { useDataStore } from '../src/stores/useDataStore';
import { useExamStore } from '../src/stores/useContentStore';

interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  category: 'chapter' | 'lesson' | 'exam' | 'blog' | 'file';
  fileCategory?: string; // Optional document specific category
  path: string; // navigate path
  grade?: number;
  url?: string; // used to open files
}

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadExams?: () => Promise<any[]>;
  onGetBlogs?: (isAdmin: boolean) => Promise<any[]>;
  isAdmin?: boolean;
}

const CATEGORY_CONFIG = {
  chapter: { icon: FolderOpen, label: 'Chương', color: '#6B7CDB', bg: '#EEF0FB' },
  lesson: { icon: FileText, label: 'Bài học', color: '#6B7CDB', bg: '#EEF0FB' },
  file: { icon: File, label: 'Tài liệu', color: '#787774', bg: '#F1F0EC' },
  exam: { icon: ClipboardList, label: 'Đề thi', color: '#D9730D', bg: '#FFF3E8' },
  blog: { icon: BookOpen, label: 'Blog', color: '#D9730D', bg: '#FFF3E8' },
};

const GlobalSearch: React.FC<GlobalSearchProps> = ({ isOpen, onClose, onLoadExams, onGetBlogs, isAdmin }) => {
  const [query, setQuery] = useState('');
  const [exams, setExams] = useState<any[]>([]);
  const [blogs, setBlogs] = useState<any[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('physivault_search_history');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const lessons = useDataStore(state => state.lessons);
  const storedFiles = useDataStore(state => state.storedFiles);
  const studentGradeValue = useDataStore(state => state.studentGradeValue);

  // Load exams & blogs once when opened
  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setSelectedIndex(0);
    setTimeout(() => inputRef.current?.focus(), 50);

    // Load exams
    if (onLoadExams && exams.length === 0) {
      onLoadExams().then(data => setExams(data || [])).catch(() => {});
    }
    // Load blogs
    if (onGetBlogs && blogs.length === 0) {
      onGetBlogs(!!isAdmin).then(data => setBlogs(data || [])).catch(() => {});
    }
  }, [isOpen]);

  // Build static chapter results
  const chapterResults: SearchResult[] = useMemo(() => {
    const allowedCurriculum = isAdmin || !studentGradeValue
      ? CURRICULUM
      : CURRICULUM.filter(grade => grade.level === studentGradeValue);

    return allowedCurriculum.flatMap(grade =>
      grade.chapters.map(ch => ({
        id: `ch-${ch.id}`,
        title: ch.name,
        subtitle: `${grade.title} · ${ch.description || ''}`,
        category: 'chapter' as const,
        path: `/grade/${grade.level}/chapter/${ch.id}`,
        grade: grade.level,
      }))
    );
  }, [isAdmin, studentGradeValue]);

  // Build lesson results
  const lessonResults: SearchResult[] = useMemo(() => {
    const allowedCurriculum = isAdmin || !studentGradeValue
      ? CURRICULUM
      : CURRICULUM.filter(grade => grade.level === studentGradeValue);

    return lessons.map((l: Lesson) => {
      // Find which grade/chapter this lesson belongs to
      let gradeLvl = 0;
      let chapterName = '';
      for (const g of allowedCurriculum) {
        for (const ch of g.chapters) {
          if (ch.id === l.chapterId) {
            gradeLvl = g.level;
            chapterName = ch.name;
            break;
          }
        }
        if (gradeLvl) break;
      }
      
      if (!gradeLvl) return null; // Filter out lessons from unallowed grades

      return {
        id: `ls-${l.id}`,
        title: l.name,
        subtitle: `${chapterName} · Lớp ${gradeLvl}`,
        category: 'lesson' as const,
        path: `/grade/${gradeLvl}/chapter/${l.chapterId}/lesson/${l.id}`,
        grade: gradeLvl,
      };
    }).filter(Boolean) as SearchResult[];
  }, [lessons, isAdmin, studentGradeValue]);

  // Build exam results
  const examResults: SearchResult[] = useMemo(() => {
    const validExams = isAdmin || !studentGradeValue
      ? exams
      : exams.filter(e => e.grade === studentGradeValue || !e.grade);

    return validExams.map(e => ({
      id: `ex-${e.id}`,
      title: e.title,
      subtitle: `Lớp ${e.grade || '?'} · ${e.duration || 0} phút`,
      category: 'exam' as const,
      path: '/exams',
      grade: e.grade,
    }));
  }, [exams, isAdmin, studentGradeValue]);

  // Build blog results
  const blogResults: SearchResult[] = useMemo(() => {
    return blogs.map(b => ({
      id: `bl-${b.id}`,
      title: b.title,
      subtitle: `${b.category || 'Chung'} · ${b.summary?.slice(0, 60) || ''}`,
      category: 'blog' as const,
      path: '/blog',
    }));
  }, [blogs]);

  // Build file results
  const fileResults: SearchResult[] = useMemo(() => {
    if (!storedFiles) return [];
    
    const allowedCurriculum = isAdmin || !studentGradeValue
      ? CURRICULUM
      : CURRICULUM.filter(grade => grade.level === studentGradeValue);

    return Object.entries(storedFiles).flatMap(([parentId, files]) => {
      let path = '/';
      let parentName = 'Tài liệu đính kèm';
      
      const lesson = lessons.find((l: Lesson) => l.id === parentId);
      let isAllowed = false;
      
      if (lesson) {
        parentName = `Bài: ${lesson.name}`;
        let gradeLvl = 0;
        for (const g of allowedCurriculum) {
          for (const ch of g.chapters) {
            if (ch.id === lesson.chapterId) { gradeLvl = g.level; isAllowed = true; break; }
          }
          if (gradeLvl) break;
        }
        if (gradeLvl) path = `/grade/${gradeLvl}/chapter/${lesson.chapterId}/lesson/${lesson.id}`;
      } else {
        // Maybe it's attached to a chapter?
        for (const g of allowedCurriculum) {
          for (const ch of g.chapters) {
            if (ch.id === parentId) {
              parentName = `Chương: ${ch.name}`;
              path = `/grade/${g.level}/chapter/${ch.id}`;
              isAllowed = true;
              break;
            }
          }
          if (isAllowed) break;
        }
      }

      if (!isAllowed && !isAdmin) return []; // Skip files from unallowed grades

      return files.map((f: any) => {
        const catStr = f.category ? `${f.category} · ` : '';
        return {
          id: `file-${f.id}`,
          title: f.name,
          subtitle: `${catStr}${parentName} · ${(f.size / 1024 / 1024).toFixed(1)} MB`,
          category: 'file' as const,
          fileCategory: f.category,
          path: path,
          url: f.url,
        };
      });
    });
  }, [storedFiles, lessons, isAdmin, studentGradeValue]);

  // Filter
  const filtered = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();
    const all = [...chapterResults, ...lessonResults, ...examResults, ...blogResults, ...fileResults];
    return all.filter(r =>
      r.title.toLowerCase().includes(q) ||
      r.subtitle.toLowerCase().includes(q)
    ).slice(0, 20); // max 20 results
  }, [query, chapterResults, lessonResults, examResults, blogResults, fileResults]);

  // Keyboard navigation
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    // Scroll active item into view
    if (listRef.current && filtered.length > 0) {
      const active = listRef.current.children[selectedIndex] as HTMLElement;
      active?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      handleSelect(filtered[selectedIndex]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const addToHistory = (term: string) => {
    if (!term.trim()) return;
    const cleanTerm = term.trim();
    setSearchHistory(prev => {
      const filtered = prev.filter(t => t !== cleanTerm);
      const updated = [cleanTerm, ...filtered].slice(0, 8); // Keep last 8 searches
      localStorage.setItem('physivault_search_history', JSON.stringify(updated));
      return updated;
    });
  };

  const removeFromHistory = (term: string) => {
    setSearchHistory(prev => {
      const updated = prev.filter(t => t !== term);
      localStorage.setItem('physivault_search_history', JSON.stringify(updated));
      return updated;
    });
  };

  const clearHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem('physivault_search_history');
  };

  const handleSelect = (result: SearchResult) => {
    addToHistory(query);
    onClose();
    if (result.category === 'file') {
      navigate(result.path, { state: { previewFileId: result.id.replace('file-', '') } });
    } else if (result.category === 'exam') {
      const examId = result.id.replace('ex-', '');
      const exam = exams.find(e => e.id === examId);
      if (exam) {
        useExamStore.getState().setActiveExam(exam);
        useExamStore.getState().setExamSubmission(null);
        navigate('/exams');
      } else {
        navigate('/exams', { state: { selectedExamId: examId } });
      }
    } else {
      navigate(result.path);
    }
  };

  // Close on backdrop click
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 z-[100] transition-all duration-200"
        style={{ background: 'rgba(0, 0, 0, 0.2)' }}
        onClick={onClose}
      />

      {/* GlobalSearch Modal */}
      <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="w-full max-w-xl max-h-[85vh] bg-white overflow-hidden flex flex-col relative animate-scale-in pointer-events-auto"
          style={{ 
            borderRadius: '20px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05)'
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header Area */}
          <div className="bg-[#EEF2FC] px-4 py-4 border-b border-[#E2E8F0] relative shrink-0" style={{ borderTopLeftRadius: '20px', borderTopRightRadius: '20px' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm" style={{ background: '#6B7CDB' }}>
                <Search className="w-[18px] h-[18px] text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <input
                   ref={inputRef}
                   type="text"
                   value={query}
                   onChange={e => setQuery(e.target.value)}
                   onKeyDown={handleKeyDown}
                   placeholder="Tìm kiếm tài liệu, chương, bài học..."
                   className="w-full bg-transparent border-transparent outline-none focus:outline-none focus:ring-0 focus:border-transparent text-[15px] font-bold placeholder-[#8E9BBA] p-0"
                   style={{ color: '#1A1A1A' }}
                />
                <div className="text-[12px] font-medium mt-0.5" style={{ color: query ? '#6B7CDB' : '#8E9BBA' }}>
                   {query ? 'Đang tìm kiếm trên toàn hệ thống...' : 'Hãy nhập từ khóa để khám phá'}
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg transition-all text-[#8E9BBA] hover:text-[#E03E3E] hover:bg-white/50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* New Search Content Area */}
          <div className="overflow-y-auto bg-white flex-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {query.trim() === '' ? (
              searchHistory.length > 0 ? (
                <section className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Lịch sử tìm kiếm</h3>
                    <button onClick={clearHistory} className="text-[13px] font-medium text-[#AEACA8] hover:text-[#E03E3E] transition-colors">Xóa tất cả</button>
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    {searchHistory.map((term) => (
                      <div
                        key={term}
                        className="flex items-center bg-[#E1F4E6] hover:bg-[#D3EBD9] rounded-[8px] text-[14px] font-bold transition-all group shadow-sm"
                      >
                        <button
                          onClick={() => setQuery(term)}
                          className="flex items-center gap-2 pl-3.5 pr-1.5 py-1 text-[#136C38]"
                        >
                          <History className="w-3.5 h-3.5 text-[#136C38]/60" />
                          {term}
                        </button>
                        <button
                          onClick={() => removeFromHistory(term)}
                          className="pr-2.5 pl-1 py-1 text-[#136C38]/50 hover:text-[#E03E3E] hover:opacity-100 transition-colors"
                        >
                          <X className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              ) : (
                <div className="py-20 text-center">
                  <div className="w-16 h-16 bg-[#EEF0FB] rounded-[18px] flex items-center justify-center mx-auto mb-3 shadow-[0_0_15px_rgba(107,124,219,0.2)]">
                    <Search className="w-8 h-8 text-[#6B7CDB]" />
                  </div>
                  <p className="text-[16px] font-bold text-[#1A1A1A]">Sẵn sàng tìm kiếm</p>
                  <p className="text-[13px] text-[#AEACA8] mt-1">Nội dung học tập đa màu sắc đang chờ bạn</p>
                </div>
              )
            ) : filtered.length === 0 ? (
              <div className="py-20 text-center">
                <div className="w-16 h-16 bg-[#FEF2F2] rounded-[18px] flex items-center justify-center mx-auto mb-3 shadow-[0_0_15px_rgba(224,62,62,0.15)]">
                  <Search className="w-8 h-8 text-[#E03E3E]" />
                </div>
                <p className="text-[16px] font-bold text-[#1A1A1A]">Không có kết quả</p>
                <p className="text-[13px] text-[#AEACA8] mt-1">Thử thay đổi từ khoá nhé</p>
              </div>
            ) : (
              <div className="flex flex-col rounded-b-2xl overflow-hidden bg-white" ref={listRef}>
                {filtered.map((result, index) => {
                  const cfg = CATEGORY_CONFIG[result.category] || CATEGORY_CONFIG.file;
                  
                  let itemColor = cfg.color;
                  let itemBg = cfg.bg;
                  let Icon = cfg.icon;

                  // Apply distinctive colors
                  if (result.category === 'exam') {
                    itemColor = '#27AE60'; itemBg = '#EAF3EE'; // Green
                    Icon = ClipboardList;
                  } else if (result.category === 'blog') {
                    itemColor = '#F2994A'; itemBg = '#FFF5EB'; // Orange
                    Icon = BookOpen;
                  } else if (result.category === 'chapter') {
                    itemColor = '#6B7CDB'; itemBg = '#EEF0FB'; // Blue
                    Icon = FolderOpen;
                  } else if (result.category === 'lesson') {
                    itemColor = '#9B51E0'; itemBg = '#F4EAFC'; // Purple
                    Icon = BookOpen;
                  } else if (result.category === 'file') {
                    itemColor = '#00BFA5'; itemBg = '#E0F2F1'; // Teal
                    Icon = FileText;
                  }

                  // Overrides if specific file categories exist
                  if (result.fileCategory) {
                    const lowerCat = result.fileCategory.toLowerCase();
                    if (lowerCat.includes('lý thuyết trọng tâm')) {
                      itemColor = '#F2994A'; itemBg = '#FFF5EB'; // Orange
                      Icon = BookOpen;
                    } else if (lowerCat.includes('đúng/sai')) {
                      itemColor = '#27AE60'; itemBg = '#EAF3EE'; // Green
                      Icon = FileText;
                    } else if (lowerCat.includes('nâng cao')) {
                      itemColor = '#9B51E0'; itemBg = '#F4EAFC'; // Purple
                      Icon = Zap;
                    }
                  }

                  const isActive = index === selectedIndex;
                  return (
                    <div
                      key={result.id}
                      className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-all border-b border-[#F1F0EC] last:border-b-0 ${isActive ? 'bg-[#F8F9FE]' : 'bg-white hover:bg-[#F8F9FE]'}`}
                      style={{ borderLeft: isActive ? `3px solid ${itemColor}` : '3px solid transparent' }}
                      onClick={() => handleSelect(result)}
                      onMouseEnter={() => setSelectedIndex(index)}
                    >
                      <div
                        className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 transition-all font-bold"
                        style={{ background: itemBg }}
                      >
                        <Icon className="w-[18px] h-[18px]" style={{ color: itemColor }} />
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <h4 className="text-[14px] font-bold truncate leading-tight transition-colors text-[#1A1A1A]">
                          {result.title}
                        </h4>
                        <p className="text-[12px] mt-0.5 truncate font-medium text-[#AEACA8]">
                          {result.subtitle}
                        </p>
                      </div>
                      <div className="shrink-0 flex items-center pl-2">
                        <span 
                          className="text-[11px] font-bold px-2.5 py-1 rounded-lg shrink-0 uppercase tracking-wide border" 
                          style={{ 
                            background: isActive ? itemBg : '#FFFFFF', 
                            color: itemColor,
                            borderColor: isActive ? 'transparent' : `${itemBg}`,
                          }}
                        >
                          {cfg.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer Area */}
          <div className="px-4 py-3 bg-white border-t border-[#F1F0EC] flex items-center justify-between shrink-0 rounded-b-2xl">
            <span className="text-[13px] font-medium text-[#AEACA8]">
              {query.trim() !== '' && filtered.length > 0 ? (
                <span className="flex items-center gap-2">Tìm thấy <strong className="text-[#6B7CDB]">{filtered.length}</strong> kết quả</span>
              ) : 'Nhập từ khóa ngay'}
            </span>
            <button 
              onClick={onClose}
              className="px-5 py-1.5 rounded-lg font-bold text-[13px] shadow-sm transition-all hover:bg-[#E2E5F3] text-[#6B7CDB] bg-[#EEF0FB]"
            >
              Đóng
            </button>
          </div>

        </div>
      </div>
    </>
  );
};
export default GlobalSearch;
