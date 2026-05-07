import React, { useState, useRef, useCallback } from 'react';
import { BlogPost } from '../types';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import {
  Plus, Trash2, Image as ImageIcon, AlignLeft, AlignCenter, AlignRight,
  ChevronUp, ChevronDown, Save, Upload, CheckCircle, AlertCircle, RefreshCw,
  FileText, ToggleLeft, ToggleRight,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────
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

// ── KaTeX inline render ────────────────────────────────────────────
function renderMath(text: string): React.ReactNode {
  const parts = text.split(/(\$[^$]+\$)/g);
  return parts.map((part, i) => {
    if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
      const math = part.slice(1, -1);
      try {
        const html = katex.renderToString(math, { throwOnError: false });
        return <span key={i} dangerouslySetInnerHTML={{ __html: html }} />;
      } catch {
        return <span key={i} className="text-indigo-500 italic">{part}</span>;
      }
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
    <div className="flex flex-col gap-3">
      {blocks.map((block, idx) => (
        /* Block card — matches StepEditor in SolutionEditor */
        <div key={block.id} className="bg-white border border-[#E9E9E7] rounded-xl overflow-hidden shadow-sm transition-all focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-50">
          {/* Block toolbar */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-[#FCFCFA] border-b border-[#E9E9E7]">
            <span className="text-[10px] font-bold text-[#AEACA8] uppercase tracking-wider">
              {block.kind === 'text' ? 'Văn bản / LaTeX' : 'Ảnh'}
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => move(block.id, -1)} disabled={idx === 0}
                className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded disabled:opacity-30 transition-colors">
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => move(block.id, 1)} disabled={idx === blocks.length - 1}
                className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded disabled:opacity-30 transition-colors">
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => remove(block.id)}
                className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded ml-1 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Block content */}
          <div className="p-4">
            {block.kind === 'text' ? (
              <div className="flex gap-3">
                <textarea
                  value={block.value}
                  onChange={e => update(block.id, { value: e.target.value })}
                  placeholder="Nhập text hoặc LaTeX inline: $E = mc^2$"
                  rows={3}
                  className="flex-1 outline-none resize-vertical text-sm font-mono text-[#1A1A1A] bg-transparent leading-relaxed"
                />
                {block.value.includes('$') && (
                  <div className="flex-1 text-sm leading-relaxed border-l-2 border-[#EEF0FB] pl-3 text-[#1A1A1A]">
                    {renderMath(block.value)}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <img src={block.url} alt="" className="block rounded-lg"
                  style={{ width: `${block.widthPct}%`, margin: block.align === 'center' ? '0 auto' : block.align === 'right' ? '0 0 0 auto' : '0' }} />
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <span className="text-xs text-[#787774]">Căn:</span>
                  {(['left', 'center', 'right'] as const).map(a => (
                    <button key={a} onClick={() => update(block.id, { align: a })}
                      className={`p-1.5 rounded flex items-center justify-center transition-colors ${block.align === a ? 'bg-[#6B7CDB] text-white' : 'bg-[#F1F0EC] text-[#787774] hover:bg-[#E9E9E7]'}`}>
                      {a === 'left' ? <AlignLeft className="w-3 h-3" /> : a === 'center' ? <AlignCenter className="w-3 h-3" /> : <AlignRight className="w-3 h-3" />}
                    </button>
                  ))}
                  <span className="text-xs text-[#787774] ml-2">Kích thước: {block.widthPct}%</span>
                  <input type="range" min={20} max={100} step={5} value={block.widthPct}
                    onChange={e => update(block.id, { widthPct: Number(e.target.value) })}
                    className="w-24" />
                </div>
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Add block buttons — matches "Thêm bước tiếp theo" style */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={addText}
          className="flex items-center gap-1.5 py-2.5 px-4 rounded-xl border-2 border-dashed border-[#DCDCDA] text-[#787774] text-xs font-semibold hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all">
          <Plus className="w-3.5 h-3.5" /> Thêm đoạn văn bản / LaTeX
        </button>
        {allowImages && (
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="flex items-center gap-1.5 py-2.5 px-4 rounded-xl border-2 border-dashed border-[#DCDCDA] text-[#787774] text-xs font-semibold hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all disabled:opacity-50">
            {uploading ? <Upload className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
            {uploading ? 'Đang upload...' : 'Chèn ảnh'}
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = ''; }} />
      </div>
    </div>
  );
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
  existingBlog?: BlogPost | null;
  onSaved?: () => void;
}

const ExamPaperEditor: React.FC<ExamPaperEditorProps> = ({ saveBlog, syncBlogs, existingBlog, onSaved }) => {
  const WORKER_URL = import.meta.env.VITE_COMMENT_WORKER_URL || '';

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

  // Toast — kiểu giống SolutionEditor (3 loại: success/error/warning)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' | 'warning' = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    if (type !== 'warning') {
      toastTimer.current = setTimeout(() => setToast(null), 5000);
    }
  };

  const updateQ = useCallback((idx: number, patch: Partial<ExamQuestion>) => {
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, ...patch } : q));
  }, []);

  const buildBlogPayload = (): Partial<BlogPost> => {
    const data: ExamPaperData = { type: 'exam_paper', grade, week, questions };
    return {
      ...(existingBlog?.id ? { id: existingBlog.id } : {}),
      title: `Đề cuối tuần ${week} – Lớp ${grade}`,
      summary: `${questions.length} câu – Lớp ${grade}`,
      content: JSON.stringify(data),
      category: 'exam_paper',
      tags: [`lop-${grade}`, 'de-cuoi-tuan'],
      grade,
      is_published: true,
      cover_image: '',
    };
  };

  const handleSave = async () => {
    setSaving(true);
    const saved = await saveBlog(buildBlogPayload());
    setSaving(false);
    if (saved) {
      showToast('Đã lưu đề! Nhấn "Lưu & Sync" để học sinh thấy ngay.', 'success');
    } else {
      showToast('Lưu thất bại, thử lại!', 'error');
    }
  };

  const handleSync = async () => {
    setSaving(true);
    showToast('Đang lưu & sync lên Telegram...', 'warning');
    const saved = await saveBlog(buildBlogPayload());
    setSaving(false);
    if (!saved) {
      showToast('Lưu thất bại, không thể sync!', 'error');
      return;
    }
    localStorage.removeItem('pv_blog_last_fetch');
    setSyncing(true);
    setSyncPct(0);
    const result = await syncBlogs(pct => setSyncPct(pct));
    setSyncing(false);
    setSyncPct(0);
    if (result.success) {
      showToast(`Sync thành công! ${result.blogCount} bài đã lên Telegram.`, 'success');
      onSaved?.();
    } else {
      showToast('Sync thất bại!', 'error');
    }
  };

  const toggleQType = (qi: number) => {
    const q = questions[qi];
    const next: ExamQuestion['type'] = q.type === 'tu_luan' ? 'dung_sai' : 'tu_luan';
    const patch: Partial<ExamQuestion> = { type: next };
    if (next === 'dung_sai' && !q.statements?.length) {
      patch.statements = [
        { label: 'a', text: '' }, { label: 'b', text: '' },
        { label: 'c', text: '' }, { label: 'd', text: '' },
      ];
    }
    updateQ(qi, patch);
  };

  const addQuestion = () => setQuestions(prev => [...prev, emptyQuestion('tu_luan')]);
  const removeQuestion = (qi: number) => {
    if (questions.length <= 1) return;
    if (!window.confirm('Xóa câu hỏi này?')) return;
    setQuestions(prev => prev.filter((_, i) => i !== qi));
  };

  return (
    <div className="space-y-6 font-sans">
      <style>{`.katex { color: #1A1A1A !important; }`}</style>

      {/* ── Publish settings bar — giống SolutionEditor ── */}
      <div className="bg-white p-4 rounded-2xl border border-[#E9E9E7] shadow-sm flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
        {/* Tiêu đề */}
        <div className="flex items-center gap-2 shrink-0">
          <FileText className="w-5 h-5 text-indigo-500" />
          <span className="text-sm font-bold text-[#1A1A1A]">Soạn Đề Cuối Tuần</span>
        </div>

        <div className="hidden lg:block w-px h-6 bg-[#E9E9E7]" />

        {/* Grade selector — giống SolutionEditor */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-bold text-[#AEACA8] uppercase shrink-0">Khối</span>
          <div className="flex bg-[#F7F6F3] p-1 rounded-lg border border-[#E9E9E7]">
            {[{ lab: 'Tất cả', val: 0 }, { lab: '12', val: 12 }, { lab: '11', val: 11 }, { lab: '10', val: 10 }].map(g => (
              <button key={g.val} type="button" onClick={() => setGrade(g.val)}
                className="px-3 py-1.5 text-xs font-semibold rounded-md transition-all"
                style={{ background: grade === g.val ? '#6B7CDB' : 'transparent', color: grade === g.val ? '#fff' : '#787774' }}>
                {g.lab === 'Tất cả' ? 'Tất cả' : `Lớp ${g.lab}`}
              </button>
            ))}
          </div>
        </div>

        <div className="hidden lg:block w-px h-6 bg-[#E9E9E7]" />

        {/* Week picker */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-bold text-[#AEACA8] uppercase shrink-0">Tuần</span>
          <input type="week" value={week} onChange={e => setWeek(e.target.value)}
            className="p-2.5 rounded-lg border border-[#E9E9E7] outline-none focus:border-indigo-500 text-sm text-[#1A1A1A]" />
        </div>
      </div>

      {/* ── Questions ── */}
      <div className="space-y-6">
        {questions.map((q, qi) => (
          <div key={qi} className="p-6 rounded-2xl bg-white border border-[#E9E9E7] shadow-sm space-y-5">

            {/* Question header — giống card "Thông tin đề thi" */}
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-[#1A1A1A] flex items-center gap-2 text-lg">
                <span className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-600 shrink-0">
                  {qi + 1}
                </span>
                {q.type === 'tu_luan' ? 'Câu Tự Luận' : 'Câu Đúng / Sai'}
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ml-1 ${q.type === 'tu_luan' ? 'bg-[#EEF0FB] text-[#6B7CDB]' : 'bg-amber-100 text-amber-700'}`}>
                  {q.type === 'tu_luan' ? 'Tự luận (mở)' : 'Mệnh đề đúng/sai'}
                </span>
              </h3>
              <div className="flex items-center gap-2">
                {/* Toggle type — giống SolutionEditor */}
                <button onClick={() => toggleQType(qi)}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${q.type === 'dung_sai' ? 'bg-amber-500 text-white' : 'bg-indigo-600 text-white'}`}>
                  {q.type === 'dung_sai'
                    ? <><ToggleRight className="w-4 h-4" /> Đúng / Sai</>
                    : <><ToggleLeft className="w-4 h-4" /> Tự luận</>}
                </button>
                {questions.length > 1 && (
                  <button onClick={() => removeQuestion(qi)}
                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-[#E9E9E7]" />

            {/* Mô tả đề bài */}
            <div>
              <label className="block text-[10px] font-bold mb-3 text-[#787774] uppercase tracking-wider">
                Mô tả đề bài
              </label>
              <BlockEditor
                blocks={q.content}
                onChange={blocks => updateQ(qi, { content: blocks })}
                allowImages={true}
                workerUrl={WORKER_URL}
              />
            </div>

            {/* Đúng/Sai statements */}
            {q.type === 'dung_sai' && q.statements && (
              <div className="pt-2 border-t border-[#E9E9E7]">
                <label className="block text-[10px] font-bold mb-3 text-[#787774] uppercase tracking-wider">
                  Các mệnh đề (A, B, C, D)
                </label>
                <div className="space-y-3">
                  {q.statements.map((stmt, si) => (
                    /* Statement card — giống StatementEditor trong SolutionEditor */
                    <div key={stmt.label} className="bg-white border border-[#E9E9E7] rounded-xl overflow-hidden shadow-sm">
                      <div className="flex items-center px-4 py-2.5 bg-[#FCFCFA] border-b border-[#E9E9E7]">
                        <span className="font-bold text-sm text-indigo-700 tracking-wide">
                          Mệnh đề {stmt.label.toUpperCase()}
                        </span>
                      </div>
                      <div className="p-4">
                        <textarea
                          value={stmt.text}
                          onChange={e => {
                            const newStmts = q.statements!.map((s, i) => i === si ? { ...s, text: e.target.value } : s);
                            updateQ(qi, { statements: newStmts });
                          }}
                          placeholder={`Mệnh đề ${stmt.label.toUpperCase()} — hỗ trợ LaTeX: $...$`}
                          rows={2}
                          className="w-full outline-none resize-vertical text-sm font-mono text-[#1A1A1A] bg-transparent leading-relaxed"
                        />
                        {stmt.text.includes('$') && (
                          <div className="text-sm leading-relaxed text-[#1A1A1A] mt-2 pt-2 border-t border-[#E9E9E7]">
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
        ))}

        {/* Add question — giống "Thêm câu" trong SolutionEditor */}
        <button onClick={addQuestion}
          className="w-full py-3 rounded-2xl border-2 border-dashed border-[#DCDCDA] text-[#787774] font-semibold text-sm hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" /> Thêm câu hỏi
        </button>
      </div>

      {/* ── Action bar + Toast — giống SolutionEditor ── */}
      <div className="mt-6 pt-5 border-t border-[#E9E9E7] space-y-3">

        {/* Toast */}
        {toast && (
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium"
            style={{
              background: toast.type === 'success' ? '#EAF3EE' : toast.type === 'error' ? '#FEE2E2' : '#EEF0FB',
              border: `1px solid ${toast.type === 'success' ? '#B7D9C4' : toast.type === 'error' ? '#FECACA' : '#C5CAFA'}`,
              color: toast.type === 'success' ? '#448361' : toast.type === 'error' ? '#E03E3E' : '#3D3D8D',
            }}
          >
            {toast.type === 'success' && <CheckCircle className="w-4 h-4 shrink-0" />}
            {toast.type === 'error'   && <AlertCircle className="w-4 h-4 shrink-0" />}
            {toast.type === 'warning' && <RefreshCw className="w-4 h-4 shrink-0 animate-spin" />}
            {toast.msg}
          </div>
        )}

        {/* Buttons — giống SolutionEditor action bar */}
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={handleSave} disabled={saving || syncing}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 border border-[#E9E9E7] bg-white text-[#1A1A1A] hover:bg-[#F7F6F3] transition-colors disabled:opacity-50">
            <Save className="w-4 h-4" />
            {saving ? 'Đang lưu...' : 'Lưu đề'}
          </button>
          <button onClick={handleSync} disabled={saving || syncing}
            className="px-8 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-60 shadow-sm">
            <Upload className="w-4 h-4" />
            {syncing ? `Đang sync... ${syncPct}%` : 'Lưu & Sync lên Telegram'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExamPaperEditor;
