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
                    } else if (lowerCat.includes('lý thuyết (đúng/sai)')) {
                      itemColor = '#6B7CDB'; itemBg = '#EEF0FB';   // Xanh nước biển
                      Icon = FileText;
                    } else if (lowerCat.includes('đúng/sai')) {
                      itemColor = '#448361'; itemBg = '#EAF3EE';   // Xanh lá (chương & khác)
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
    </>
  );
};
export default GlobalSearch;
