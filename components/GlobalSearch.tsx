import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X, FolderOpen, FileText, ClipboardList, BookOpen, ChevronRight, Command, History, ArrowRight, File } from 'lucide-react';
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
  lesson: { icon: FileText, label: 'Bài học', color: '#448361', bg: '#EAF3EE' },
  file: { icon: File, label: 'Tài liệu', color: '#0284c7', bg: '#e0f2fe' },
  exam: { icon: ClipboardList, label: 'Đề thi', color: '#9065B0', bg: '#F3ECF8' },
  blog: { icon: BookOpen, label: 'Blog', color: '#D9730D', bg: '#FFF7ED' },
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
    return CURRICULUM.flatMap(grade =>
      grade.chapters.map(ch => ({
        id: `ch-${ch.id}`,
        title: ch.name,
        subtitle: `${grade.title} · ${ch.description || ''}`,
        category: 'chapter' as const,
        path: `/grade/${grade.level}/chapter/${ch.id}`,
        grade: grade.level,
      }))
    );
  }, []);

  // Build lesson results
  const lessonResults: SearchResult[] = useMemo(() => {
    return lessons.map((l: Lesson) => {
      // Find which grade/chapter this lesson belongs to
      let gradeLvl = 0;
      let chapterName = '';
      for (const g of CURRICULUM) {
        for (const ch of g.chapters) {
          if (ch.id === l.chapterId) {
            gradeLvl = g.level;
            chapterName = ch.name;
            break;
          }
        }
        if (gradeLvl) break;
      }
      return {
        id: `ls-${l.id}`,
        title: l.name,
        subtitle: `${chapterName || 'Chương không xác định'} · Lớp ${gradeLvl || '?'}`,
        category: 'lesson' as const,
        path: gradeLvl ? `/grade/${gradeLvl}/chapter/${l.chapterId}/lesson/${l.id}` : '/',
        grade: gradeLvl,
      };
    });
  }, [lessons]);

  // Build exam results
  const examResults: SearchResult[] = useMemo(() => {
    return exams.map(e => ({
      id: `ex-${e.id}`,
      title: e.title,
      subtitle: `Lớp ${e.grade || '?'} · ${e.duration || 0} phút`,
      category: 'exam' as const,
      path: '/exams',
      grade: e.grade,
    }));
  }, [exams]);

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
    return Object.entries(storedFiles).flatMap(([parentId, files]) => {
      let path = '/';
      let parentName = 'Tài liệu đính kèm';
      
      const lesson = lessons.find((l: Lesson) => l.id === parentId);
      if (lesson) {
        parentName = `Bài: ${lesson.name}`;
        let gradeLvl = 0;
        for (const g of CURRICULUM) {
          for (const ch of g.chapters) {
            if (ch.id === lesson.chapterId) { gradeLvl = g.level; break; }
          }
          if (gradeLvl) break;
        }
        if (gradeLvl) path = `/grade/${gradeLvl}/chapter/${lesson.chapterId}/lesson/${lesson.id}`;
      } else {
        // Maybe it's attached to a chapter?
        let isChapter = false;
        for (const g of CURRICULUM) {
          for (const ch of g.chapters) {
            if (ch.id === parentId) {
              parentName = `Chương: ${ch.name}`;
              path = `/grade/${g.level}/chapter/${ch.id}`;
              isChapter = true;
              break;
            }
          }
          if (isChapter) break;
        }
      }

      return files.map((f: any) => {
        const catStr = f.category ? `${f.category} · ` : '';
        return {
          id: `file-${f.id}`,
          title: f.name,
          subtitle: `${catStr}${parentName} · ${(f.size / 1024 / 1024).toFixed(1)} MB`,
          category: 'file' as const,
          path: path,
          url: f.url,
        };
      });
    });
  }, [storedFiles, lessons]);

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
      <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none overflow-y-auto">
        <div className="w-full bg-white relative flex flex-col pointer-events-auto transition-all duration-300 overflow-hidden"
             style={{ 
               maxWidth: '580px',
               borderRadius: '12px', 
               maxHeight: '80vh',
               border: '1px solid #E9E9E7',
               boxShadow: '0 8px 32px rgba(0,0,0,0.12)'
             }}>
          
          {/* Header Section */}
          <header className="flex items-center px-6 py-4 shrink-0" style={{ borderBottom: '1px solid #E9E9E7' }}>
            <div className="flex items-center gap-4 flex-1">
              <Search className="w-6 h-6 shrink-0" style={{ color: '#6B7CDB' }} />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Tìm kiến thức, khóa học, đề thi..."
                className="w-full bg-transparent border-0 focus:ring-0 focus:border-transparent text-[17px] font-medium outline-none placeholder-[#AEACA8]"
                style={{ color: '#1A1A1A', boxShadow: 'none', outline: 'none' }}
              />
            </div>
            <div className="flex items-center gap-3 shrink-0 ml-4">
              <div className="hidden sm:flex items-center px-2 py-1 bg-[#F8F9FD] rounded border border-[#E9E9E7]">
                <span className="text-[10px] font-bold text-[#AEACA8] uppercase tracking-wider">ESC</span>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-full transition-colors hover:bg-[#F8F9FD] text-[#AEACA8] hover:text-[#787774]">
                <X className="w-5 h-5" />
              </button>
            </div>
          </header>

          {/* Search Content Area */}
          <div className="overflow-y-auto p-6" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {query.trim() === '' ? (
              searchHistory.length > 0 ? (
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: '#AEACA8' }}>Lịch sử tìm kiếm</h3>
                    <button onClick={clearHistory} className="text-[10px] font-bold uppercase tracking-wider transition-colors hover:text-[#1A1A1A]" style={{ color: '#AEACA8' }}>Xóa</button>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[#787774]">
                    {searchHistory.map((term) => (
                      <div
                        key={term}
                        className="flex items-center bg-[#F8F9FD] hover:bg-[#EEF0FB] rounded-full text-[13px] font-medium transition-all group border border-[#E9E9E7]/60"
                      >
                        <button
                          onClick={() => setQuery(term)}
                          className="flex items-center gap-2 pl-4 pr-1 py-1.5 text-[#787774] hover:text-[#6B7CDB] transition-colors"
                        >
                          <History className="w-4 h-4" style={{ opacity: 0.5 }} />
                          {term}
                        </button>
                        <button
                          onClick={() => removeFromHistory(term)}
                          className="pr-3 pl-1 py-1.5 text-[#AEACA8] hover:text-[#E03E3E] transition-colors"
                          title="Xóa từ khóa này"
                        >
                          <X className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              ) : (
                <div className="py-16 text-center">
                  <Search className="w-10 h-10 mx-auto mb-4 opacity-20" />
                  <p className="text-base font-semibold" style={{ color: '#1A1A1A' }}>Bạn muốn tìm gì hôm nay?</p>
                </div>
              )
            ) : filtered.length === 0 ? (
               <div className="py-16 text-center">
                  <Search className="w-10 h-10 mx-auto mb-4 opacity-20" />
                  <p className="text-base font-semibold" style={{ color: '#1A1A1A' }}>Không tìm thấy kết quả cho "{query}"</p>
                  <p className="text-sm mt-1" style={{ color: '#787774' }}>Vui lòng kiểm tra lại lỗi chính tả hoặc dùng từ khóa khác.</p>
               </div>
            ) : (
              <section ref={listRef} className="space-y-4">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: '#AEACA8' }}>Kết quả nổi bật</h3>
                <div className="space-y-1">
                  {filtered.map((result, idx) => {
                    const cfg = CATEGORY_CONFIG[result.category];
                    const Icon = cfg.icon;
                    const isActive = idx === selectedIndex;
                    return (
                      <div
                        key={result.id}
                        onClick={() => handleSelect(result)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className="group flex items-center gap-4 p-3.5 rounded-2xl cursor-pointer transition-all duration-200"
                        style={{ background: isActive ? '#F8F9FD' : 'transparent' }}
                      >
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform" style={{ background: cfg.bg }}>
                          <Icon className="w-6 h-6" style={{ color: cfg.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-[15px] font-bold truncate transition-colors" style={{ color: isActive ? '#6B7CDB' : '#1A1A1A' }}>
                            {result.title}
                          </h4>
                          <p className="text-[13px] truncate mt-0.5" style={{ color: '#AEACA8' }}>
                            {result.subtitle}
                          </p>
                        </div>
                        <span className="text-[9px] font-bold px-2 py-1.5 rounded shrink-0 uppercase tracking-widest transition-colors" style={{ background: isActive ? cfg.bg : '#F8F9FD', color: isActive ? cfg.color : '#AEACA8' }}>
                          {cfg.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>

          {/* Footer Section */}
          <footer className="px-6 py-4 flex items-center justify-between shrink-0" style={{ background: '#F8F9FD', borderTop: '1px solid #E9E9E7' }}>
            <div className="flex items-center gap-2" style={{ color: '#787774' }}>
              {filtered.length > 0 ? (
                <span className="text-[13px] font-medium">Tìm thấy <span className="font-bold" style={{ color: '#1A1A1A' }}>{filtered.length}</span> kết quả phù hợp</span>
              ) : (
                // When 0 results, we can show standard prompt
                <span className="text-[13px] font-medium">Tìm kiếm nâng cao</span>
              )}
            </div>
            {filtered.length > 0 && (
              <button 
                onClick={() => handleSelect(filtered[selectedIndex])}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold text-sm shadow-sm transition-all hover:brightness-110 active:scale-95"
                style={{ background: '#6B7CDB', color: 'white' }}
              >
                Mở tài liệu
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </footer>
        </div>
      </div>
    </>
  );
};
export default GlobalSearch;
