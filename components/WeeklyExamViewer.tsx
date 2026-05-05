import React, { useState, useEffect, useRef } from 'react';
import { BlogPost } from '../types';
import { FileText, ChevronRight, X, BookOpen, CheckSquare, ChevronLeft } from 'lucide-react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// ── Types (mirrors ExamPaperEditor) ───────────────────────────────
type ContentBlock =
  | { kind: 'text'; id: string; value: string }
  | { kind: 'image'; id: string; url: string; align: 'left' | 'center' | 'right'; widthPct: number };

interface Statement { label: string; text: string }

interface ExamQuestion {
  type: 'tu_luan' | 'dung_sai';
  content: ContentBlock[];
  statements?: Statement[];
}

interface ExamPaperData {
  type: 'exam_paper';
  grade: number;
  week: string;
  questions: ExamQuestion[];
}

// ── KaTeX render helper ────────────────────────────────────────────
function renderMath(text: string): React.ReactNode {
  const parts = text.split(/(\$[^$]+\$)/g);
  return parts.map((part, i) => {
    if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
      const math = part.slice(1, -1);
      try {
        const html = katex.renderToString(math, { throwOnError: false });
        return <span key={i} dangerouslySetInnerHTML={{ __html: html }} />;
      } catch {
        return <span key={i} style={{ color: '#9065B0', fontStyle: 'italic' }}>{part}</span>;
      }
    }
    return <span key={i}>{part}</span>;
  });
}

// ── Render a single content block ─────────────────────────────────
function RenderBlock({ block }: { block: ContentBlock }) {
  if (block.kind === 'image') {
    return (
      <div style={{ margin: '10px 0', textAlign: block.align }}>
        <img
          src={block.url}
          alt=""
          style={{
            display: 'inline-block',
            width: `${block.widthPct}%`,
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}
        />
      </div>
    );
  }
  return (
    <p style={{ margin: '6px 0', fontSize: '14.5px', lineHeight: 1.85, color: '#1A1A1A' }}>
      {renderMath(block.value)}
    </p>
  );
}

// ── Full exam detail modal ─────────────────────────────────────────
const ExamDetailModal: React.FC<{
  paper: ExamPaperData;
  title: string;
  gradeColor: string;
  gradeBg: string;
  gradeBorder: string;
  onClose: () => void;
}> = ({ paper, title, gradeColor, gradeBg, gradeBorder, onClose }) => {
  const [activeQ, setActiveQ] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  const q = paper.questions[activeQ];
  const total = paper.questions.length;

  // Scroll content to top whenever question changes
  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [activeQ]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && activeQ > 0) setActiveQ(p => p - 1);
      if (e.key === 'ArrowRight' && activeQ < total - 1) setActiveQ(p => p + 1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeQ, total, onClose]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 999,
        background: 'rgba(26,26,26,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
        backdropFilter: 'blur(2px)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E9E9E7',
          borderRadius: '14px',
          boxShadow: '0 16px 48px rgba(0,0,0,0.15)',
          width: '100%',
          maxWidth: '960px',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '88vh',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Modal Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px',
          borderBottom: '1px solid #E9E9E7',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '8px',
              background: gradeColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <FileText style={{ width: '14px', height: '14px', color: '#fff' }} />
            </div>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#1A1A1A', margin: 0, lineHeight: 1.3 }}>{title}</h2>
              <p style={{ fontSize: '11px', color: '#AEACA8', margin: 0 }}>
                Lớp {paper.grade} · {paper.week} · {total} câu
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '7px', borderRadius: '8px', border: 'none',
              background: 'transparent', cursor: 'pointer', color: '#787774',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#F1F0EC')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            title="Đóng (Esc)"
          >
            <X style={{ width: '16px', height: '16px' }} />
          </button>
        </div>

        {/* ── Modal Body: Sidebar + Content ── */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>

          {/* Sidebar - Question List */}
          <div style={{
            width: '170px', flexShrink: 0,
            borderRight: '1px solid #E9E9E7',
            background: '#FAFAF9',
            overflowY: 'auto',
            padding: '10px 8px',
            display: 'flex', flexDirection: 'column', gap: '4px',
          }}>
            <div style={{
              fontSize: '10px', fontWeight: 700, color: '#AEACA8',
              textTransform: 'uppercase', letterSpacing: '0.06em',
              padding: '0 6px 6px',
            }}>
              Danh sách câu
            </div>
            {paper.questions.map((q, qi) => {
              const isActive = qi === activeQ;
              return (
                <button
                  key={qi}
                  onClick={() => setActiveQ(qi)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 10px', borderRadius: '8px',
                    border: `1px solid ${isActive ? gradeColor : 'transparent'}`,
                    background: isActive ? gradeBg : 'transparent',
                    cursor: 'pointer', textAlign: 'left',
                    transition: 'all 0.15s',
                    width: '100%',
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#F1F0EC'; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{
                    width: '24px', height: '24px', borderRadius: '6px', flexShrink: 0,
                    background: isActive ? gradeColor : '#E9E9E7',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {q.type === 'tu_luan'
                      ? <BookOpen style={{ width: '12px', height: '12px', color: isActive ? '#fff' : '#787774' }} />
                      : <CheckSquare style={{ width: '12px', height: '12px', color: isActive ? '#fff' : '#787774' }} />}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontSize: '12px', fontWeight: 600,
                      color: isActive ? gradeColor : '#1A1A1A',
                      lineHeight: 1.2,
                    }}>
                      Câu {qi + 1}
                    </div>
                    <div style={{ fontSize: '10px', color: isActive ? gradeColor : '#AEACA8', opacity: 0.85 }}>
                      {q.type === 'tu_luan' ? 'Tự luận' : 'Đúng / Sai'}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Question Content */}
          <div
            ref={contentRef}
            style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', minWidth: 0 }}
          >
            {/* Question header badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '9px',
                background: gradeColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {q.type === 'tu_luan'
                  ? <BookOpen style={{ width: '16px', height: '16px', color: '#fff' }} />
                  : <CheckSquare style={{ width: '16px', height: '16px', color: '#fff' }} />}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span style={{ fontWeight: 700, fontSize: '16px', color: '#1A1A1A' }}>
                  Câu {activeQ + 1}
                </span>
                <span style={{
                  fontSize: '12px', fontWeight: 600, color: gradeColor,
                  padding: '2px 8px', borderRadius: '6px', background: gradeBg,
                  border: `1px solid ${gradeBorder}`,
                }}>
                  {q.type === 'tu_luan' ? 'Tự Luận' : 'Đúng / Sai'}
                </span>
              </div>
            </div>

            {/* Content blocks */}
            <div style={{
              padding: '16px 18px', background: '#F7F6F3',
              borderRadius: '10px',
              marginBottom: q.type === 'dung_sai' && q.statements?.length ? '14px' : 0,
            }}>
              {q.content.map(block => <RenderBlock key={block.id} block={block} />)}
            </div>

            {/* Statements for đúng/sai */}
            {q.type === 'dung_sai' && q.statements && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {q.statements.map(stmt => (
                  <div key={stmt.label} style={{
                    display: 'flex', alignItems: 'flex-start', gap: '12px',
                    padding: '12px 16px', borderRadius: '10px',
                    background: '#fff', border: '1px solid #E9E9E7',
                  }}>
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0,
                      background: gradeColor, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', marginTop: '1px',
                    }}>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: '#fff', lineHeight: 1 }}>
                        {stmt.label.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ flex: 1, fontSize: '14.5px', lineHeight: '26px', color: '#1A1A1A', wordBreak: 'break-word' }}>
                      {renderMath(stmt.text)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Modal Footer: Navigation ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 20px',
          borderTop: '1px solid #E9E9E7',
          flexShrink: 0,
          background: '#FAFAF9',
        }}>
          {/* Câu trước */}
          <button
            onClick={() => setActiveQ(p => Math.max(0, p - 1))}
            disabled={activeQ === 0}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px', borderRadius: '8px',
              border: '1px solid #E9E9E7',
              background: activeQ === 0 ? '#F7F6F3' : '#fff',
              color: activeQ === 0 ? '#CFCFCB' : '#1A1A1A',
              fontSize: '13px', fontWeight: 600, cursor: activeQ === 0 ? 'default' : 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { if (activeQ > 0) e.currentTarget.style.background = '#F1F0EC'; }}
            onMouseLeave={e => { if (activeQ > 0) e.currentTarget.style.background = '#fff'; }}
          >
            <ChevronLeft style={{ width: '15px', height: '15px' }} />
            Câu trước
          </button>

          {/* Dot indicators */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {paper.questions.map((_, qi) => (
              <button
                key={qi}
                onClick={() => setActiveQ(qi)}
                style={{
                  width: qi === activeQ ? '20px' : '7px',
                  height: '7px', borderRadius: '4px', border: 'none',
                  background: qi === activeQ ? gradeColor : '#D9D9D4',
                  cursor: 'pointer', padding: 0,
                  transition: 'all 0.2s ease',
                }}
              />
            ))}
          </div>

          {/* Câu sau */}
          <button
            onClick={() => setActiveQ(p => Math.min(total - 1, p + 1))}
            disabled={activeQ === total - 1}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px', borderRadius: '8px',
              border: '1px solid #E9E9E7',
              background: activeQ === total - 1 ? '#F7F6F3' : '#fff',
              color: activeQ === total - 1 ? '#CFCFCB' : '#1A1A1A',
              fontSize: '13px', fontWeight: 600, cursor: activeQ === total - 1 ? 'default' : 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { if (activeQ < total - 1) e.currentTarget.style.background = '#F1F0EC'; }}
            onMouseLeave={e => { if (activeQ < total - 1) e.currentTarget.style.background = '#fff'; }}
          >
            Câu sau
            <ChevronRight style={{ width: '15px', height: '15px' }} />
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Grade config ───────────────────────────────────────────────────
const GRADE_COLORS: Record<number, { color: string; bg: string; border: string }> = {
  10: { color: '#448361', bg: '#EAF3EE', border: '#B7D9C4' },
  11: { color: '#6B7CDB', bg: '#EEF0FB', border: '#B8C1EF' },
  12: { color: '#9065B0', bg: '#F3ECF8', border: '#C8A8DC' },
};

// ── Main Widget ────────────────────────────────────────────────────
interface WeeklyExamViewerProps {
  getBlogs: (isAdmin: boolean) => Promise<BlogPost[]>;
  studentGrade: number | null; // null = admin (thấy tất cả)
  isAdmin?: boolean;
}

const WeeklyExamViewer: React.FC<WeeklyExamViewerProps> = ({ getBlogs, studentGrade, isAdmin = false }) => {
  const [papers, setPapers] = useState<{ blog: BlogPost; data: ExamPaperData }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<{ blog: BlogPost; data: ExamPaperData } | null>(null);
  const [gradeTab, setGradeTab] = useState<number>(studentGrade ?? 12);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getBlogs(isAdmin).then(blogs => {
      if (!mounted) return;
      const parsed = blogs
        .filter(b => b.category === 'exam_paper' && (isAdmin || b.is_published))
        .map(b => {
          try {
            const data = JSON.parse(b.content) as ExamPaperData;
            if (data.type === 'exam_paper') return { blog: b, data };
          } catch { /* skip */ }
          return null;
        })
        .filter(Boolean) as { blog: BlogPost; data: ExamPaperData }[];

      // Sort newest first
      parsed.sort((a, b) => new Date(b.blog.created_at).getTime() - new Date(a.blog.created_at).getTime());
      setPapers(parsed);
      setLoading(false);
    }).catch(() => setLoading(false));
    return () => { mounted = false; };
  }, []);

  // Filter by current tab grade
  const visible = papers.filter(p => p.data.grade === gradeTab);
  const gc = GRADE_COLORS[gradeTab] ?? GRADE_COLORS[12];

  if (loading) {
    return (
      <div style={{ padding: '20px', borderRadius: '14px', background: '#fff', border: '1px solid #E9E9E7' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: '2px solid #EEF0FB', borderTopColor: '#6B7CDB', animation: 'spin 0.8s linear infinite' }} />
          <span style={{ fontSize: '13px', color: '#AEACA8' }}>Đang tải đề thi...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={{ borderRadius: '14px', background: '#fff', border: '1px solid #E9E9E7', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        {/* Header */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #E9E9E7', background: '#F7F6F3' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <FileText className="w-4 h-4" style={{ color: '#6B7CDB' }} />
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#1A1A1A' }}>Đề Cuối Tuần</span>
          </div>
          {/* Grade tabs */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {(isAdmin ? [10, 11, 12] : [studentGrade ?? 12]).map(g => {
              const c = GRADE_COLORS[g] ?? GRADE_COLORS[12];
              return (
                <button key={g} onClick={() => setGradeTab(g)}
                  style={{
                    padding: '4px 12px', borderRadius: '7px', fontSize: '11px', fontWeight: 600,
                    border: `1px solid ${gradeTab === g ? c.color : '#E9E9E7'}`,
                    background: gradeTab === g ? c.color : '#fff',
                    color: gradeTab === g ? '#fff' : '#787774',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}>
                  Lớp {g}
                </button>
              );
            })}
          </div>
        </div>

        {/* Paper list */}
        <div style={{ maxHeight: '260px', overflowY: 'auto' }}>
          {visible.length === 0 ? (
            <div style={{ padding: '28px', textAlign: 'center' }}>
              <p style={{ fontSize: '13px', color: '#AEACA8' }}>Chưa có đề tuần nào cho Lớp {gradeTab} 📭</p>
            </div>
          ) : (
            visible.map(({ blog, data }) => (
              <button key={blog.id}
                onClick={() => setSelected({ blog, data })}
                style={{
                  width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '12px 16px', borderBottom: '1px solid #F1F0EC', background: 'transparent',
                  border: 'none', borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: '#F1F0EC',
                  cursor: 'pointer', transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = gc.bg)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {/* Week badge */}
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: gc.bg, border: `1px solid ${gc.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: '8px', fontWeight: 700, color: gc.color, textTransform: 'uppercase' }}>Tuần</span>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: gc.color, lineHeight: 1 }}>
                    {data.week.split('-W')[1]}
                  </span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#1A1A1A', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {blog.title}
                  </p>
                  <p style={{ fontSize: '11px', color: '#AEACA8', margin: '2px 0 0' }}>
                    {data.questions.filter(q => q.type === 'tu_luan').length} tự luận · {data.questions.filter(q => q.type === 'dung_sai').length} đúng/sai
                  </p>
                </div>
                <ChevronRight className="w-4 h-4" style={{ color: '#CFCFCB', flexShrink: 0 }} />
              </button>
            ))
          )}
        </div>
      </div>

      {/* Detail modal */}
      {selected && (
        <ExamDetailModal
          paper={selected.data}
          title={selected.blog.title}
          gradeColor={GRADE_COLORS[selected.data.grade]?.color ?? '#6B7CDB'}
          gradeBg={GRADE_COLORS[selected.data.grade]?.bg ?? '#EEF0FB'}
          gradeBorder={GRADE_COLORS[selected.data.grade]?.border ?? '#B8C1EF'}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
};

export default WeeklyExamViewer;
