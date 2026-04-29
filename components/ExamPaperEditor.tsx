import React, { useState, useRef, useCallback } from 'react';
import { BlogPost } from '../types';
import { Plus, Trash2, Image as ImageIcon, AlignLeft, AlignCenter, AlignRight, ChevronUp, ChevronDown, Save, Upload, X, CheckCircle, AlertCircle } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────
type ContentBlock =
  | { kind: 'text'; id: string; value: string }
  | { kind: 'image'; id: string; url: string; align: 'left' | 'center' | 'right'; widthPct: number };

interface Statement { label: string; text: string }

interface ExamQuestion {
  type: 'tu_luan' | 'dung_sai';
  content: ContentBlock[];
  statements?: Statement[]; // chỉ dùng cho đúng/sai
}

interface ExamPaperData {
  type: 'exam_paper';
  grade: number;
  week: string; // ISO week, e.g. "2026-W18"
  questions: ExamQuestion[];
}

// ── KaTeX inline render ────────────────────────────────────────────
function renderMath(text: string): React.ReactNode {
  const parts = text.split(/(\$[^$]+\$)/g);
  return parts.map((part, i) => {
    if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
      const math = part.slice(1, -1);
      try {
        const katex = (window as any).katex;
        if (katex) {
          const html = katex.renderToString(math, { throwOnError: false });
          return <span key={i} dangerouslySetInnerHTML={{ __html: html }} />;
        }
      } catch { /* fallback */ }
      return <span key={i} style={{ color: '#9065B0', fontStyle: 'italic' }}>{part}</span>;
    }
    return <span key={i}>{part}</span>;
  });
}

// ── Rich Content Block Editor ──────────────────────────────────────
const BlockEditor: React.FC<{
  blocks: ContentBlock[];
  onChange: (blocks: ContentBlock[]) => void;
  allowImages: boolean;
  workerUrl: string;
}> = ({ blocks, onChange, allowImages, workerUrl }) => {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const uid = () => Math.random().toString(36).slice(2);

  const addText = () => onChange([...blocks, { kind: 'text', id: uid(), value: '' }]);

  const uploadImage = async (file: File) => {
    if (!workerUrl) { alert('Chưa cấu hình VITE_COMMENT_WORKER_URL'); return; }
    setUploading(true);
    try {
      const res = await fetch(`${workerUrl}/upload-image`, {
        method: 'POST',
        headers: { 'Content-Type': file.type, 'x-file-name': encodeURIComponent(`exam/${Date.now()}-${file.name}`) },
        body: file,
      });
      if (!res.ok) throw new Error(await res.text());
      const { url } = await res.json();
      onChange([...blocks, { kind: 'image', id: uid(), url, align: 'center', widthPct: 80 }]);
    } catch (e: any) {
      alert('Upload thất bại: ' + e.message);
    } finally { setUploading(false); }
  };

  const update = (id: string, patch: Partial<ContentBlock>) =>
    onChange(blocks.map(b => b.id === id ? { ...b, ...patch } as ContentBlock : b));

  const remove = (id: string) => onChange(blocks.filter(b => b.id !== id));
  const move = (id: string, dir: -1 | 1) => {
    const idx = blocks.findIndex(b => b.id === id);
    if (idx + dir < 0 || idx + dir >= blocks.length) return;
    const nb = [...blocks];
    [nb[idx], nb[idx + dir]] = [nb[idx + dir], nb[idx]];
    onChange(nb);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {blocks.map((block, idx) => (
        <div key={block.id} style={{ border: '1px solid #E9E9E7', borderRadius: '10px', overflow: 'hidden', background: '#fff' }}>
          {/* Block toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px', background: '#F7F6F3', borderBottom: '1px solid #E9E9E7' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#AEACA8', textTransform: 'uppercase', flex: 1 }}>
              {block.kind === 'text' ? '✏️ Văn bản / LaTeX' : '🖼 Ảnh'}
            </span>
            <button onClick={() => move(block.id, -1)} disabled={idx === 0} title="Lên" style={iconBtn}><ChevronUp className="w-3 h-3" /></button>
            <button onClick={() => move(block.id, 1)} disabled={idx === blocks.length - 1} title="Xuống" style={iconBtn}><ChevronDown className="w-3 h-3" /></button>
            <button onClick={() => remove(block.id)} title="Xóa block" style={{ ...iconBtn, color: '#E03E3E' }}><Trash2 className="w-3 h-3" /></button>
          </div>

          {/* Block content */}
          <div style={{ padding: '10px' }}>
            {block.kind === 'text' ? (
              <div style={{ display: 'flex', gap: '8px' }}>
                <textarea
                  value={block.value}
                  onChange={e => update(block.id, { value: e.target.value })}
                  placeholder="Nhập text hoặc LaTeX inline: $E = mc^2$"
                  rows={3}
                  style={{ flex: 1, border: 'none', outline: 'none', resize: 'vertical', fontSize: '13px', fontFamily: 'monospace', color: '#1A1A1A', background: 'transparent', lineHeight: 1.6 }}
                />
                {block.value.includes('$') && (
                  <div style={{ flex: 1, fontSize: '13px', lineHeight: 1.8, borderLeft: '2px solid #EEF0FB', paddingLeft: '8px', color: '#1A1A1A' }}>
                    {renderMath(block.value)}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <img src={block.url} alt="" style={{ display: 'block', width: `${block.widthPct}%`, margin: block.align === 'center' ? '0 auto' : block.align === 'right' ? '0 0 0 auto' : '0', borderRadius: '6px' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '11px', color: '#787774' }}>Căn:</span>
                  {(['left', 'center', 'right'] as const).map(a => (
                    <button key={a} onClick={() => update(block.id, { align: a })}
                      style={{ ...iconBtn, background: block.align === a ? '#6B7CDB' : '#F1F0EC', color: block.align === a ? '#fff' : '#787774' }}>
                      {a === 'left' ? <AlignLeft className="w-3 h-3" /> : a === 'center' ? <AlignCenter className="w-3 h-3" /> : <AlignRight className="w-3 h-3" />}
                    </button>
                  ))}
                  <span style={{ fontSize: '11px', color: '#787774', marginLeft: '8px' }}>Kích thước: {block.widthPct}%</span>
                  <input type="range" min={20} max={100} step={5} value={block.widthPct}
                    onChange={e => update(block.id, { widthPct: Number(e.target.value) })}
                    style={{ width: '100px' }} />
                </div>
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Add block buttons */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={addText} style={addBtn}>
          <Plus className="w-3.5 h-3.5" /> Thêm đoạn văn bản / LaTeX
        </button>
        {allowImages && (
          <button onClick={() => fileRef.current?.click()} disabled={uploading} style={addBtn}>
            {uploading ? <Upload className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
            {uploading ? 'Đang upload...' : 'Chèn ảnh'}
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = ''; }} />
      </div>
    </div>
  );
};

// ── Styles ─────────────────────────────────────────────────────────
const iconBtn: React.CSSProperties = {
  padding: '4px', borderRadius: '5px', border: 'none', background: '#F1F0EC',
  cursor: 'pointer', color: '#787774', display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const addBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '6px',
  padding: '7px 14px', borderRadius: '8px', border: '1.5px dashed #CFCFCB',
  background: 'transparent', cursor: 'pointer', fontSize: '12px', color: '#787774',
  transition: 'all 0.15s',
};

// ── Helpers ────────────────────────────────────────────────────────
function getWeekString(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function emptyQuestion(type: ExamQuestion['type']): ExamQuestion {
  const q: ExamQuestion = { type, content: [{ kind: 'text', id: Math.random().toString(36).slice(2), value: '' }] };
  if (type === 'dung_sai') q.statements = [
    { label: 'a', text: '' }, { label: 'b', text: '' },
    { label: 'c', text: '' }, { label: 'd', text: '' },
  ];
  return q;
}

// ── Main Component ─────────────────────────────────────────────────
interface ExamPaperEditorProps {
  saveBlog: (blog: Partial<BlogPost>) => Promise<BlogPost | null>;
  syncBlogs: (onProgress?: (pct: number) => void) => Promise<{ success: boolean; fileId?: string; blogCount: number }>;
  existingBlog?: BlogPost | null; // dùng khi edit bài cũ
  onSaved?: () => void;
}

const GRADE_COLORS: Record<number, string> = { 10: '#448361', 11: '#6B7CDB', 12: '#9065B0' };

const ExamPaperEditor: React.FC<ExamPaperEditorProps> = ({ saveBlog, syncBlogs, existingBlog, onSaved }) => {
  const WORKER_URL = import.meta.env.VITE_COMMENT_WORKER_URL || '';

  // ── Parse existing data ──
  const parseExisting = (): ExamPaperData | null => {
    if (!existingBlog) return null;
    try {
      const d = JSON.parse(existingBlog.content);
      if (d.type === 'exam_paper') return d as ExamPaperData;
    } catch { /* ignore */ }
    return null;
  };

  const existing = parseExisting();

  const [grade, setGrade] = useState<number>(existing?.grade ?? 12);
  const [week, setWeek] = useState<string>(existing?.week ?? getWeekString(new Date()));
  const [questions, setQuestions] = useState<ExamQuestion[]>(
    existing?.questions ?? [emptyQuestion('tu_luan'), emptyQuestion('dung_sai')]
  );
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncPct, setSyncPct] = useState(0);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const updateQ = useCallback((idx: number, patch: Partial<ExamQuestion>) => {
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, ...patch } : q));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const data: ExamPaperData = { type: 'exam_paper', grade, week, questions };
    const title = `Đề cuối tuần ${week} – Lớp ${grade}`;
    const blog: Partial<BlogPost> = {
      ...(existingBlog?.id ? { id: existingBlog.id } : {}),
      title,
      summary: `1 câu tự luận + 1 câu đúng/sai – Lớp ${grade}`,
      content: JSON.stringify(data),
      category: 'exam_paper',
      tags: [`lop-${grade}`, 'de-cuoi-tuan'],
      grade,
      is_published: true,
      cover_image: '',
    };
    const saved = await saveBlog(blog);
    setSaving(false);
    if (saved) {
      showToast('Đã lưu đề! Nhấn "Sync" để học sinh thấy ngay.', true);
    } else {
      showToast('Lưu thất bại, thử lại!', false);
    }
  };

  const handleSync = async () => {
    // Luôn lưu trước khi sync để đảm bảo nội dung hiện tại được đẩy lên
    setSaving(true);
    const data: ExamPaperData = { type: 'exam_paper', grade, week, questions };
    const title = `Đề cuối tuần ${week} – Lớp ${grade}`;
    const blog: Partial<BlogPost> = {
      ...(existingBlog?.id ? { id: existingBlog.id } : {}),
      title,
      summary: `1 câu tự luận + 1 câu đúng/sai – Lớp ${grade}`,
      content: JSON.stringify(data),
      category: 'exam_paper',
      tags: [`lop-${grade}`, 'de-cuoi-tuan'],
      grade,
      is_published: true,
      cover_image: '',
    };
    const saved = await saveBlog(blog);
    setSaving(false);
    if (!saved) {
      showToast('Lưu thất bại, không thể sync!', false);
      return;
    }
    // Xóa cache 15 phút để học sinh thấy ngay sau sync
    localStorage.removeItem('pv_blog_last_fetch');

    setSyncing(true);
    setSyncPct(0);
    const result = await syncBlogs((pct) => setSyncPct(pct));
    setSyncing(false);
    setSyncPct(0);
    if (result.success) {
      showToast(`Sync thành công! ${result.blogCount} bài đã lên Telegram.`, true);
      onSaved?.();
    } else {
      showToast('Sync thất bại!', false);
    }
  };

  const gradeColor = GRADE_COLORS[grade] ?? '#6B7CDB';

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', padding: '16px', fontFamily: "'Inter', sans-serif" }}>

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1A1A1A', margin: 0 }}>📝 Soạn Đề Cuối Tuần</h2>
          {/* Grade selector */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {[10, 11, 12].map(g => (
              <button key={g} onClick={() => setGrade(g)}
                style={{
                  padding: '5px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, border: 'none', cursor: 'pointer',
                  background: grade === g ? GRADE_COLORS[g] : '#F1F0EC',
                  color: grade === g ? '#fff' : '#787774',
                  transition: 'all 0.15s',
                }}>
                Lớp {g}
              </button>
            ))}
          </div>
          {/* Week */}
          <input type="week" value={week} onChange={e => setWeek(e.target.value)}
            style={{ padding: '5px 10px', borderRadius: '8px', border: '1px solid #E9E9E7', fontSize: '12px', color: '#1A1A1A' }} />
        </div>
        <div style={{ height: '3px', borderRadius: '2px', background: `linear-gradient(90deg, ${gradeColor}, ${gradeColor}88)` }} />
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '10px', marginBottom: '16px',
          background: toast.ok ? '#EAF3EE' : '#FEF2F2', border: `1px solid ${toast.ok ? '#B7D9C4' : '#FECACA'}`,
          color: toast.ok ? '#448361' : '#E03E3E', fontSize: '13px', fontWeight: 500,
        }}>
          {toast.ok ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Questions */}
      {questions.map((q, qi) => (
        <div key={qi} style={{ marginBottom: '24px', border: '1px solid #E9E9E7', borderRadius: '14px', overflow: 'hidden', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          {/* Question header */}
          <div style={{ padding: '12px 16px', background: '#F7F6F3', borderBottom: '1px solid #E9E9E7', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: gradeColor }}>
              Câu {qi + 1}: {q.type === 'tu_luan' ? 'Tự Luận' : 'Đúng / Sai'}
            </span>
            <span style={{
              fontSize: '10px', padding: '2px 8px', borderRadius: '5px', fontWeight: 600,
              background: q.type === 'tu_luan' ? '#EEF0FB' : '#F3ECF8',
              color: q.type === 'tu_luan' ? '#6B7CDB' : '#9065B0',
            }}>
              {q.type === 'tu_luan' ? 'Tự luận (mở)' : 'Mệnh đề đúng/sai'}
            </span>
          </div>

          <div style={{ padding: '16px' }}>
            {/* Context / Problem description */}
            <p style={{ fontSize: '11px', fontWeight: 700, color: '#AEACA8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
              Mô tả đề bài
            </p>
            <BlockEditor
              blocks={q.content}
              onChange={blocks => updateQ(qi, { content: blocks })}
              allowImages={true}
              workerUrl={WORKER_URL}
            />

            {/* Đúng/Sai statements */}
            {q.type === 'dung_sai' && q.statements && (
              <div style={{ marginTop: '20px' }}>
                <p style={{ fontSize: '11px', fontWeight: 700, color: '#AEACA8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                  Các mệnh đề (a, b, c, d)
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {q.statements.map((stmt, si) => (
                    <div key={stmt.label} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px', borderRadius: '10px', background: '#F7F6F3', border: '1px solid #E9E9E7' }}>
                      <span style={{ fontWeight: 700, fontSize: '13px', color: gradeColor, minWidth: '18px' }}>{stmt.label.toUpperCase()}.</span>
                      <div style={{ flex: 1 }}>
                        <textarea
                          value={stmt.text}
                          onChange={e => {
                            const newStmts = q.statements!.map((s, i) => i === si ? { ...s, text: e.target.value } : s);
                            updateQ(qi, { statements: newStmts });
                          }}
                          placeholder={`Mệnh đề ${stmt.label.toUpperCase()} — hỗ trợ LaTeX: $...$`}
                          rows={2}
                          style={{ width: '100%', border: 'none', outline: 'none', resize: 'vertical', fontSize: '13px', fontFamily: 'monospace', background: 'transparent', color: '#1A1A1A' }}
                        />
                        {stmt.text.includes('$') && (
                          <div style={{ fontSize: '13px', lineHeight: 1.8, color: '#1A1A1A', marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #E9E9E7' }}>
                            {renderMath(stmt.text)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Action bar */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', paddingTop: '8px' }}>
        <button onClick={handleSave} disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 22px', borderRadius: '10px', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', background: '#1A1A1A', color: '#fff', fontSize: '13px', fontWeight: 600, opacity: saving ? 0.6 : 1 }}>
          <Save className="w-4 h-4" /> {saving ? 'Đang lưu...' : 'Lưu đề'}
        </button>
        <button onClick={handleSync} disabled={syncing}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 22px', borderRadius: '10px', border: 'none', cursor: syncing ? 'not-allowed' : 'pointer', background: gradeColor, color: '#fff', fontSize: '13px', fontWeight: 600, opacity: syncing ? 0.7 : 1 }}>
          <Upload className="w-4 h-4" />
          {syncing ? `Sync... ${syncPct}%` : 'Lưu & Sync lên Telegram'}
        </button>
      </div>
    </div>
  );
};

export default ExamPaperEditor;
