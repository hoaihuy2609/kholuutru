import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X, FolderOpen, FileText, ClipboardList, BookOpen, ChevronRight, Command } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CURRICULUM } from '../constants';
import { Lesson } from '../types';
import { useDataStore } from '../src/stores/useDataStore';

interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  category: 'chapter' | 'lesson' | 'exam' | 'blog';
  path: string; // navigate path
  grade?: number;
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
  exam: { icon: ClipboardList, label: 'Đề thi', color: '#9065B0', bg: '#F3ECF8' },
  blog: { icon: BookOpen, label: 'Blog', color: '#D9730D', bg: '#FFF7ED' },
};

const GlobalSearch: React.FC<GlobalSearchProps> = ({ isOpen, onClose, onLoadExams, onGetBlogs, isAdmin }) => {
  const [query, setQuery] = useState('');
  const [exams, setExams] = useState<any[]>([]);
  const [blogs, setBlogs] = useState<any[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const lessons = useDataStore(state => state.lessons);

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

  // Filter
  const filtered = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();
    const all = [...chapterResults, ...lessonResults, ...examResults, ...blogResults];
    return all.filter(r =>
      r.title.toLowerCase().includes(q) ||
      r.subtitle.toLowerCase().includes(q)
    ).slice(0, 20); // max 20 results
  }, [query, chapterResults, lessonResults, examResults, blogResults]);

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

  const handleSelect = (result: SearchResult) => {
    onClose();
    navigate(result.path);
  };

  // Close on backdrop click
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[100]"
        style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />

      {/* Search Modal */}
      <div
        className="fixed z-[101] w-[90%] max-w-[580px] animate-scale-in"
        style={{
          top: '15%',
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E9E9E7',
          boxShadow: '0 24px 80px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.04)',
          overflow: 'hidden',
        }}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3.5" style={{ borderBottom: '1px solid #E9E9E7' }}>
          <Search className="w-5 h-5 shrink-0" style={{ color: '#6B7CDB' }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tìm chương, bài học, đề thi, blog..."
            className="flex-1 bg-transparent border-none outline-none text-[15px] font-medium"
            style={{ color: '#1A1A1A' }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded-md transition-colors"
              style={{ color: '#AEACA8' }}
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="flex items-center gap-0.5 px-2 py-1 rounded-md text-[11px] font-semibold"
            style={{ background: '#F1F0EC', color: '#AEACA8', border: '1px solid #E9E9E7' }}
          >
            ESC
          </button>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          className="overflow-y-auto"
          style={{ maxHeight: '400px' }}
        >
          {query.trim() === '' ? (
            <div className="py-12 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Command className="w-4 h-4" style={{ color: '#AEACA8' }} />
                <span className="text-sm font-medium" style={{ color: '#AEACA8' }}>
                  Gõ để tìm kiếm
                </span>
              </div>
              <p className="text-xs" style={{ color: '#CFCFCB' }}>
                Hoặc nhấn Ctrl + K để mở lại
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center">
              <Search className="w-8 h-8 mx-auto mb-2" style={{ color: '#CFCFCB' }} />
              <p className="text-sm font-medium" style={{ color: '#787774' }}>
                Không tìm thấy kết quả
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#AEACA8' }}>
                Thử từ khóa khác nhé
              </p>
            </div>
          ) : (
            <div className="py-1">
              {filtered.map((result, idx) => {
                const cfg = CATEGORY_CONFIG[result.category];
                const Icon = cfg.icon;
                const isActive = idx === selectedIndex;
                return (
                  <button
                    key={result.id}
                    onClick={() => handleSelect(result)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                    style={{
                      background: isActive ? '#F7F6F3' : 'transparent',
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: cfg.bg }}
                    >
                      <Icon className="w-4 h-4" style={{ color: cfg.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: '#1A1A1A' }}>
                        {result.title}
                      </p>
                      <p className="text-xs truncate" style={{ color: '#AEACA8' }}>
                        {result.subtitle}
                      </p>
                    </div>
                    <span
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0"
                      style={{ background: cfg.bg, color: cfg.color }}
                    >
                      {cfg.label}
                    </span>
                    {isActive && (
                      <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: '#CFCFCB' }} />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer hint */}
        {filtered.length > 0 && (
          <div
            className="flex items-center justify-between px-4 py-2 text-[11px]"
            style={{ borderTop: '1px solid #F1F0EC', color: '#AEACA8' }}
          >
            <div className="flex items-center gap-3">
              <span>↑↓ Chọn</span>
              <span>↵ Mở</span>
              <span>Esc Đóng</span>
            </div>
            <span>{filtered.length} kết quả</span>
          </div>
        )}
      </div>
    </>
  );
};

export default GlobalSearch;
