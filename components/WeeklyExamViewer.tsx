import React, { useState, useEffect } from 'react';
import { BlogPost } from '../types';
import { FileText, ChevronRight, X, BookOpen, CheckSquare } from 'lucide-react';
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
      <div style={{ margin: '8px 0', textAlign: block.align }}>
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
    <p style={{ margin: '6px 0', fontSize: '14px', lineHeight: 1.8, color: '#1A1A1A' }}>
      {renderMath(block.value)}
    </p>
  );
}

// ── Full exam detail modal ─────────────────────────────────────────
const ExamDetailModal: React.FC<{ paper: ExamPaperData; title: string; gradeColor: string; onClose: () => void }> = ({ paper, title, gradeColor, onClose }) => {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '720px', maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 16px 48px rgba(0,0,0,0.18)' }}>
        {/* Modal header */}
        <div style={{ position: 'sticky', top: 0, background: '#fff', borderBottom: '1px solid #E9E9E7', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 1, borderRadius: '16px 16px 0 0' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#1A1A1A', margin: 0 }}>{title}</h2>
            <p style={{ fontSize: '12px', color: '#AEACA8', margin: '2px 0 0' }}>
              Lớp {paper.grade} · {paper.week}
            </p>
          </div>
          <button onClick={onClose} style={{ padding: '6px', borderRadius: '8px', border: 'none', background: '#F1F0EC', cursor: 'pointer', color: '#787774', display: 'flex' }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Questions */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {paper.questions.map((q, qi) => (
            <div key={qi}>
              {/* Question label */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: gradeColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {q.type === 'tu_luan'
                    ? <BookOpen className="w-4 h-4 text-white" style={{ color: '#fff' }} />
                    : <CheckSquare className="w-4 h-4" style={{ color: '#fff' }} />}
                </div>
                <div>
                  <span style={{ fontWeight: 700, fontSize: '14px', color: '#1A1A1A' }}>Câu {qi + 1}: </span>
                  <span style={{ fontSize: '13px', color: gradeColor, fontWeight: 600 }}>
                    {q.type === 'tu_luan' ? 'Tự Luận' : 'Đúng / Sai'}
                  </span>
                </div>
              </div>

              {/* Content blocks */}
              <div style={{ padding: '14px 16px', background: '#F7F6F3', borderRadius: '10px', marginBottom: q.type === 'dung_sai' ? '12px' : 0 }}>
                {q.content.map(block => <RenderBlock key={block.id} block={block} />)}
              </div>

              {/* Statements for đúng/sai */}
              {q.type === 'dung_sai' && q.statements && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {q.statements.map(stmt => (
                    <div key={stmt.label} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 14px', borderRadius: '10px', background: '#fff', border: '1px solid #E9E9E7' }}>
                      <span style={{ fontWeight: 700, fontSize: '14px', color: gradeColor, minWidth: '20px' }}>{stmt.label.toUpperCase()}.</span>
                      <span style={{ fontSize: '14px', lineHeight: 1.7, color: '#1A1A1A' }}>{renderMath(stmt.text)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
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
          {/* Grade tabs — admin sees all, student locked to their grade */}
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
                  border: 'none', cursor: 'pointer', transition: 'background 0.15s',
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
                    1 tự luận · 1 đúng/sai
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
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
};

export default WeeklyExamViewer;
