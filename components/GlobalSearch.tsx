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
          fileCategory: f.category,
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
      <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="w-full max-w-2xl max-h-[85vh] bg-white overflow-hidden flex flex-col relative animate-scale-in pointer-events-auto"
          style={{ 
            borderRadius: '28px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05)'
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header Area */}
          <div className="bg-white px-6 py-5 border-b border-[#E9E9E7] relative">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0">
                <Search className="w-5 h-5 text-[#8E8C85]" />
              </div>
              <div className="flex-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Bạn muốn tìm gì hôm nay?..."
                  className="w-full bg-transparent border-transparent outline-none focus:outline-none focus:ring-0 focus:border-transparent text-[17px] font-semibold placeholder-[#8E8C85]"
                  style={{ color: '#1A1A1A' }}
                />
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-[#F3F2F0] transition-colors text-[#8E8C85] hover:text-[#1A1A1A]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* New Search Content Area */}
          <div className="overflow-y-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <div className="p-2">
              {query.trim() === '' ? (
                searchHistory.length > 0 ? (
                  <section className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#797771]">Lịch sử tìm kiếm</h3>
                      <button onClick={clearHistory} className="text-[10px] font-bold uppercase tracking-wider text-[#797771] hover:text-[#E03E3E] transition-colors">Xóa tất cả</button>
                    </div>
                    <div className="flex flex-wrap gap-2.5">
                      {searchHistory.map((term) => (
                        <div
                          key={term}
                          className="flex items-center bg-[#F1F0EC] hover:bg-[#E3E2DE] rounded-xl text-[13px] font-semibold transition-all group border border-transparent hover:border-[#E9E9E7]"
                        >
                          <button
                            onClick={() => setQuery(term)}
                            className="flex items-center gap-2 pl-4 pr-1 py-2 text-[#57564F] hover:text-[#6B7CDB]"
                          >
                            <History className="w-4 h-4 opacity-40" />
                            {term}
                          </button>
                          <button
                            onClick={() => removeFromHistory(term)}
                            className="pr-3 pl-1 py-2 text-[#AEACA8] hover:text-[#E03E3E] transition-colors"
                          >
                            <X className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : (
                  <div className="py-24 text-center">
                    <div className="w-16 h-16 bg-[#F8F9FD] rounded-full flex items-center justify-center mx-auto mb-4">
                      <Search className="w-8 h-8 text-[#AEACA8] opacity-30" />
                    </div>
                    <p className="text-lg font-bold text-[#1A1A1A]">Khám phá kiến thức Vật Lý</p>
                    <p className="text-sm text-[#AEACA8] mt-1">Gõ gợi ý: "Sóng cơ", "Đề HK1"...</p>
                  </div>
                )
              ) : filtered.length === 0 ? (
                <div className="py-24 text-center">
                  <div className="w-16 h-16 bg-[#FEF2F2] rounded-full flex items-center justify-center mx-auto mb-4">
                    <Search className="w-8 h-8 text-[#E03E3E] opacity-30" />
                  </div>
                  <p className="text-lg font-bold text-[#1A1A1A]">Không có kết quả</p>
                  <p className="text-sm text-[#AEACA8] mt-1">Không tìm thấy nội dung nào khớp với "{query}"</p>
                </div>
              ) : (
                <div className="divide-y divide-[#F1F0EC]" ref={listRef}>
                  {filtered.map((result, index) => {
                    const cfg = CATEGORY_CONFIG[result.category] || CATEGORY_CONFIG.file;
                    
                    let itemColor = cfg.color;
                    let itemBg = cfg.bg;
                    let Icon = cfg.icon;

                    // Mặc định màu xanh dương
                    itemColor = '#6B7CDB'; itemBg = '#EEF0FB';
                    
                    if (result.category === 'exam') {
                      itemColor = '#787774'; itemBg = '#F1F0EC'; // Xám
                      Icon = ClipboardList;
                    } else if (result.category === 'blog') {
                      itemColor = '#D9730D'; itemBg = '#FFF3E8'; // Cam
                      Icon = BookOpen;
                    } else if (result.category === 'chapter') {
                      Icon = FolderOpen;
                    } else if (result.category === 'lesson') {
                      Icon = BookOpen;
                    }

                    if (result.fileCategory) {
                      const lowerCat = result.fileCategory.toLowerCase();
                      if (lowerCat.includes('lý thuyết trọng tâm')) {
                        itemColor = '#D9730D'; itemBg = '#FFF3E8';   // Cam
                        Icon = BookOpen;
                      } else if (lowerCat.includes('đúng/sai')) {
                        itemColor = '#448361'; itemBg = '#EAF3EE';   // Xanh lá
                        Icon = FileText;
                      } else if (lowerCat.includes('nâng cao')) {
                        itemColor = '#9065B0'; itemBg = '#F3ECF8';   // Tím
                        Icon = Zap;
                      } else {
                        // Trắc nghiệm bình thường, bài tập cơ bản
                        Icon = FileText;
                      }
                    }

                    const isActive = index === selectedIndex;
                    return (
                      <div
                        key={result.id}
                        className={`flex items-center gap-3 px-5 py-3 cursor-pointer transition-all ${isActive ? 'bg-[#FAFAF9]' : 'hover:bg-[#FAFAF9]'}`}
                        style={{
                          borderLeft: isActive ? `4px solid ${itemColor}` : '4px solid transparent',
                        }}
                        onClick={() => handleSelect(result)}
                        onMouseEnter={() => setSelectedIndex(index)}
                      >
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all"
                          style={{ background: itemBg }}
                        >
                          <Icon className="w-4 h-4" style={{ color: itemColor }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-[14px] font-semibold truncate leading-tight transition-colors" style={{ color: isActive ? itemColor : '#1A1A1A' }}>
                            {result.title}
                          </h4>
                          <p className="text-[12px] mt-0.5 truncate font-medium text-[#AEACA8]">
                            {result.subtitle}
                          </p>
                        </div>
                        <span 
                          className="text-[10px] font-bold px-3 py-1.5 rounded-lg shrink-0 uppercase tracking-widest border transition-all" 
                          style={{ 
                            background: isActive ? itemBg : '#FFFFFF', 
                            color: itemColor,
                            borderColor: isActive ? 'transparent' : `${itemColor}30`,
                            boxShadow: isActive ? 'none' : '0 1px 2px rgba(0,0,0,0.02)'
                          }}
                        >
                          {cfg.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </>
  );
};
export default GlobalSearch;
