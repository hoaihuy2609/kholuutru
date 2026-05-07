import React, { useState, useEffect, useCallback } from 'react';
import { Zap, Plus, Trash2, RefreshCw, CheckCircle2, AlertCircle, BookOpen, ChevronDown, ChevronUp, Lightbulb, Edit2, X as XIcon } from 'lucide-react';
import { CURRICULUM } from '../constants';

interface GameQuestion {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  answer: string;
  grade: number;
  topic?: string;
  explanation?: string;
}

interface AdminGameManagerProps {
  onShowToast: (msg: string, type: 'success' | 'error' | 'warning') => void;
  workerUrl: string;
  adminKey: string;
}

// ── Parser: text → structured questions ──────────────────────────
function parseQuestions(raw: string, grade: number, topic: string): Omit<GameQuestion, 'id'>[] {
  const questions: Omit<GameQuestion, 'id'>[] = [];
  const blocks = raw.split(/\n(?=\d+\.\s)/);

  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 6) continue;

    const qLine = lines[0].replace(/^\d+\.\s*/, '').trim();
    if (!qLine) continue;

    const optA = lines.find(l => /^A[.)]\s*/i.test(l))?.replace(/^A[.)]\s*/i, '').trim();
    const optB = lines.find(l => /^B[.)]\s*/i.test(l))?.replace(/^B[.)]\s*/i, '').trim();
    const optC = lines.find(l => /^C[.)]\s*/i.test(l))?.replace(/^C[.)]\s*/i, '').trim();
    const optD = lines.find(l => /^D[.)]\s*/i.test(l))?.replace(/^D[.)]\s*/i, '').trim();

    const ansLine = lines.find(l => /^(đa|đáp án|answer)\s*[:：]\s*[ABCD]/i.test(l));
    const answer = ansLine?.match(/[ABCD]/i)?.[0]?.toUpperCase();

    // Giải thích là tùy chọn: "Giải thích: ..." hoặc "GT: ..." hoặc "Explanation: ..."
    const expLine = lines.find(l => /^(giải thích|gt|explanation)\s*[:：]/i.test(l));
    const explanation = expLine?.replace(/^(giải thích|gt|explanation)\s*[:：]\s*/i, '').trim();

    if (optA && optB && optC && optD && answer && ['A', 'B', 'C', 'D'].includes(answer)) {
      questions.push({
        question: qLine,
        option_a: optA,
        option_b: optB,
        option_c: optC,
        option_d: optD,
        answer,
        grade,
        topic: topic.trim() || undefined,
        explanation: explanation || undefined,
      });
    }
  }
  return questions;
}

// ── Main Component ─────────────────────────────────────────────────
const AdminGameManager: React.FC<AdminGameManagerProps> = ({ onShowToast, workerUrl, adminKey }) => {
  const [rawText, setRawText] = useState('');
  const [parsedQuestions, setParsedQuestions] = useState<Omit<GameQuestion, 'id'>[]>([]);
  const [existingQuestions, setExistingQuestions] = useState<GameQuestion[]>([]);
  const [selectedGrade, setSelectedGrade] = useState<0 | 10 | 11 | 12>(0);
  const [selectedTopic, setSelectedTopic] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [parseError, setParseError] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [showExisting, setShowExisting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<GameQuestion | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const authHeader = { Authorization: `Bearer ${adminKey}`, 'Content-Type': 'application/json', Referer: window.location.origin };

  const loadExisting = useCallback(async () => {
    if (!workerUrl) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${workerUrl}/game/questions?grade=0&limit=200`, {
        headers: { Referer: window.location.origin },
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data: GameQuestion[] = await res.json();
      setExistingQuestions(data);
    } catch (e: any) {
      onShowToast('Lỗi tải câu hỏi: ' + e.message, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [workerUrl, onShowToast]);

  useEffect(() => { loadExisting(); }, [loadExisting]);

  const handleParse = () => {
    if (!rawText.trim()) return;
    setParseError('');
    if (selectedGrade === 0) {
      setParseError('Vui lòng chọn khối trước khi Parse!');
      setParsedQuestions([]);
      return;
    }
    const result = parseQuestions(rawText, selectedGrade, selectedTopic);
    if (result.length === 0) {
      setParseError('Không parse được câu hỏi nào. Kiểm tra lại định dạng!');
      setParsedQuestions([]);
      return;
    }
    setParsedQuestions(result);
    setShowPreview(true);
  };

  const handleSave = async () => {
    if (parsedQuestions.length === 0) return;
    setIsSaving(true);
    try {
      const questionsWithId = parsedQuestions.map(q => ({
        id: crypto.randomUUID(),
        question: q.question,
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c,
        option_d: q.option_d,
        answer: q.answer,
        grade: q.grade,
        topic: q.topic,
        explanation: q.explanation,
      }));
      const res = await fetch(`${workerUrl}/game/questions`, {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify({ questions: questionsWithId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || 'HTTP ' + res.status);
      }
      onShowToast(`✅ Đã lưu ${parsedQuestions.length} câu hỏi!`, 'success');
      setRawText('');
      setParsedQuestions([]);
      setShowPreview(false);
      loadExisting();
    } catch (e: any) {
      onShowToast('Lỗi lưu: ' + e.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (qId: string, question: string) => {
    if (!window.confirm(`Xóa câu hỏi:\n"${question.slice(0, 100)}..."?`)) return;
    try {
      const res = await fetch(`${workerUrl}/game/questions/${qId}`, {
        method: 'DELETE',
        headers: authHeader,
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      onShowToast('Đã xóa câu hỏi!', 'warning');
      setExistingQuestions(prev => prev.filter(q => q.id !== qId));
    } catch (e: any) {
      onShowToast('Lỗi xóa: ' + e.message, 'error');
    }
  };

  const openEdit = (q: GameQuestion) => {
    setEditingId(q.id);
    setEditDraft({ ...q });
  };

  const cancelEdit = () => { setEditingId(null); setEditDraft(null); };

  const handleSaveEdit = async () => {
    if (!editDraft || !editingId) return;
    setIsSavingEdit(true);
    try {
      const res = await fetch(`${workerUrl}/game/questions/${editingId}`, {
        method: 'PUT',
        headers: authHeader,
        body: JSON.stringify(editDraft),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || 'HTTP ' + res.status);
      }
      onShowToast('✅ Đã cập nhật câu hỏi!', 'success');
      setExistingQuestions(prev => prev.map(q => q.id === editingId ? { ...editDraft } : q));
      cancelEdit();
    } catch (e: any) {
      onShowToast('Lỗi lưu: ' + e.message, 'error');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const gradeName = (g: number) => g === 0 ? 'Tất cả khối' : `Khối ${g}`;
  const gradeColor = (g: number) => g === 12 ? '#9065B0' : g === 11 ? '#6B7CDB' : g === 10 ? '#448361' : '#787774';
  const gradeBg = (g: number) => g === 12 ? '#F3ECF8' : g === 11 ? '#EEF0FB' : g === 10 ? '#EAF3EE' : '#F1F0EC';

  const EXAMPLE = `1. Phát biểu nào sau đây về gia tốc là đúng?
A. Gia tốc luôn cùng chiều với vận tốc
B. Gia tốc đặc trưng cho sự thay đổi vận tốc theo thời gian
C. Gia tốc chỉ xuất hiện trong chuyển động thẳng
D. Gia tốc luôn có giá trị dương
ĐA: B
Giải thích: Gia tốc là đại lượng đặc trưng cho sự thay đổi vận tốc, a = Δv/Δt.

2. Trong hệ SI, đơn vị của lực là gì?
A. kg
B. m/s
C. N
D. J
ĐA: C`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#FFFBEB' }}>
            <Zap className="w-5 h-5" style={{ color: '#F59E0B' }} />
          </div>
          <div>
            <h3 className="text-base font-semibold" style={{ color: '#1A1A1A' }}>Quản lý câu hỏi Luyện tập</h3>
            <p className="text-xs" style={{ color: '#787774' }}>
              {existingQuestions.length} câu hỏi · Hỗ trợ giải thích đáp án
            </p>
          </div>
        </div>
        <button
          onClick={loadExisting}
          className="p-2 rounded-lg transition-colors"
          style={{ color: '#787774' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F1F0EC'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
          title="Tải lại"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Import section */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E9E9E7', background: '#FFFFFF' }}>
        <div className="p-4 flex items-center gap-3" style={{ borderBottom: '1px solid #E9E9E7', background: '#FAFAF9' }}>
          <Plus className="w-4 h-4" style={{ color: '#6B7CDB' }} />
          <h4 className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>Thêm câu hỏi mới (Import hàng loạt)</h4>
        </div>
        <div className="p-5 space-y-4">
          {/* Grade selector */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider mb-2 block" style={{ color: '#AEACA8' }}>
              Áp dụng cho khối
            </label>
            <div className="flex gap-2 flex-wrap">
              {([12, 11, 10] as const).map(g => (
                <button
                  key={g}
                  onClick={() => setSelectedGrade(g)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all"
                  style={{
                    background: selectedGrade === g ? gradeColor(g) : '#F7F6F3',
                    color: selectedGrade === g ? '#FFFFFF' : '#787774',
                    border: `1px solid ${selectedGrade === g ? gradeColor(g) : '#E9E9E7'}`,
                  }}
                >
                  {gradeName(g)}
                </button>
              ))}
            </div>
          </div>

          {/* Topic input */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider mb-2 block" style={{ color: '#AEACA8' }}>
              Chương / Chủ đề
            </label>
            <select
              value={selectedTopic}
              onChange={e => setSelectedTopic(e.target.value)}
              className="w-full text-sm px-3 py-2 rounded-lg outline-none cursor-pointer"
              style={{ background: '#F7F6F3', border: '1px solid #E9E9E7', color: '#1A1A1A' }}
              onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = '#9065B0'}
              onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = '#E9E9E7'}
              disabled={selectedGrade === 0}
            >
              <option value="">-- {selectedGrade === 0 ? 'Vui lòng chọn khối trước' : 'Không gán (để trống)'} --</option>
              {selectedGrade !== 0 && CURRICULUM.find(c => c.level === selectedGrade)?.chapters.map(ch => (
                <option key={ch.id} value={ch.name}>{ch.name}</option>
              ))}
            </select>
            <p className="text-[10px] mt-1" style={{ color: '#AEACA8' }}>Tất cả câu hỏi trong batch này sẽ được gán chương này.</p>
          </div>

          {/* Format hint */}
          <div className="rounded-xl p-3" style={{ background: '#F7F6F3', border: '1px solid #E9E9E7' }}>
            <div className="flex items-center gap-1.5 mb-1">
              <BookOpen className="w-3.5 h-3.5" style={{ color: '#6B7CDB' }} />
              <span className="text-[11px] font-semibold" style={{ color: '#6B7CDB' }}>Định dạng chuẩn</span>
            </div>
            <div className="flex items-center gap-1.5 mb-2">
              <Lightbulb className="w-3.5 h-3.5" style={{ color: '#D97706' }} />
              <span className="text-[10px]" style={{ color: '#D97706' }}>Dòng "Giải thích:" là không bắt buộc</span>
            </div>
            <pre className="text-[11px] leading-relaxed whitespace-pre-wrap" style={{ color: '#57564F', fontFamily: 'monospace' }}>
              {EXAMPLE}
            </pre>
          </div>

          {/* Textarea */}
          <textarea
            value={rawText}
            onChange={e => { setRawText(e.target.value); setParseError(''); setParsedQuestions([]); setShowPreview(false); }}
            placeholder={`Paste câu hỏi vào đây...\n\n${EXAMPLE}`}
            rows={12}
            className="w-full text-sm p-3 rounded-lg outline-none resize-y font-mono"
            style={{
              background: '#F7F6F3',
              border: parseError ? '1px solid #E03E3E' : '1px solid #E9E9E7',
              color: '#1A1A1A',
            }}
            onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = '#6B7CDB'}
            onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = parseError ? '#E03E3E' : '#E9E9E7'}
          />

          {parseError && (
            <div className="flex items-center gap-2 text-sm" style={{ color: '#E03E3E' }}>
              <AlertCircle className="w-4 h-4 shrink-0" />
              {parseError}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleParse}
              disabled={!rawText.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-40"
              style={{ background: '#6B7CDB' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#5A6BC9'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#6B7CDB'}
            >
              <CheckCircle2 className="w-4 h-4" />
              Parse & Xem trước
            </button>
            {parsedQuestions.length > 0 && (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-60"
                style={{ background: '#448361' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#3A7254'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#448361'}
              >
                {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                Lưu {parsedQuestions.length} câu hỏi
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Preview */}
      {showPreview && parsedQuestions.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #44836133', background: '#FFFFFF' }}>
          <button
            onClick={() => setShowPreview(v => !v)}
            className="w-full flex items-center justify-between p-4"
            style={{ borderBottom: showPreview ? '1px solid #E9E9E7' : 'none', background: '#EAF3EE' }}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" style={{ color: '#448361' }} />
              <span className="text-sm font-semibold" style={{ color: '#448361' }}>
                Parse thành công: {parsedQuestions.length} câu hỏi
                {parsedQuestions.filter(q => q.explanation).length > 0 && (
                  <span className="ml-2 text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: '#FFFBEB', color: '#D97706' }}>
                    {parsedQuestions.filter(q => q.explanation).length} có giải thích
                  </span>
                )}
              </span>
            </div>
            {showPreview ? <ChevronUp className="w-4 h-4" style={{ color: '#448361' }} /> : <ChevronDown className="w-4 h-4" style={{ color: '#448361' }} />}
          </button>
          {showPreview && (
            <div className="divide-y" style={{ borderColor: '#E9E9E7', maxHeight: '360px', overflowY: 'auto' }}>
              {parsedQuestions.map((q, i) => (
                <div key={i} className="p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-xs font-bold px-2 py-0.5 rounded shrink-0" style={{ background: gradeBg(q.grade), color: gradeColor(q.grade) }}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium mb-2" style={{ color: '#1A1A1A' }}>{q.question}</p>
                      <div className="grid grid-cols-2 gap-1.5 mb-2">
                        {(['A', 'B', 'C', 'D'] as const).map(letter => {
                          const text = letter === 'A' ? q.option_a : letter === 'B' ? q.option_b : letter === 'C' ? q.option_c : q.option_d;
                          const isAnswer = q.answer === letter;
                          return (
                            <div key={letter} className="flex items-start gap-1.5 rounded-md px-2 py-1"
                              style={{ background: isAnswer ? '#EAF3EE' : '#F7F6F3' }}>
                              <span className="text-[11px] font-bold shrink-0" style={{ color: isAnswer ? '#448361' : '#AEACA8' }}>{letter}.</span>
                              <span className="text-[11px]" style={{ color: isAnswer ? '#448361' : '#57564F' }}>{text}</span>
                            </div>
                          );
                        })}
                      </div>
                      {q.explanation && (
                        <div className="rounded-lg px-2 py-1.5 flex items-start gap-1.5" style={{ background: '#FFFBEB' }}>
                          <Lightbulb className="w-3 h-3 shrink-0 mt-0.5" style={{ color: '#D97706' }} />
                          <span className="text-[11px]" style={{ color: '#92400E' }}>{q.explanation}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Existing questions */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E9E9E7', background: '#FFFFFF' }}>
        <button
          onClick={() => setShowExisting(v => !v)}
          className="w-full flex items-center justify-between p-4"
          style={{ borderBottom: showExisting ? '1px solid #E9E9E7' : 'none' }}
        >
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" style={{ color: '#6B7CDB' }} />
            <span className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>
              Ngân hàng câu hỏi ({existingQuestions.length} câu)
            </span>
          </div>
          {showExisting ? <ChevronUp className="w-4 h-4" style={{ color: '#AEACA8' }} /> : <ChevronDown className="w-4 h-4" style={{ color: '#AEACA8' }} />}
        </button>

        {showExisting && (
          isLoading ? (
            <div className="py-10 flex justify-center">
              <RefreshCw className="w-6 h-6 animate-spin" style={{ color: '#6B7CDB' }} />
            </div>
          ) : existingQuestions.length === 0 ? (
            <div className="py-10 text-center text-sm" style={{ color: '#AEACA8' }}>
              Chưa có câu hỏi nào. Hãy import câu hỏi ở trên!
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: '#E9E9E7', maxHeight: '480px', overflowY: 'auto' }}>
              {existingQuestions.map((q, i) => (
                <div key={q.id}>
                  {/* ── View row ── */}
                  <div className="p-4 flex items-start gap-3 group/qrow hover:bg-[#FAFAF9] transition-colors">
                    <span className="text-xs font-bold px-2 py-0.5 rounded shrink-0 mt-0.5" style={{ background: gradeBg(q.grade), color: gradeColor(q.grade) }}>
                      {gradeName(q.grade)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm" style={{ color: '#1A1A1A' }}>
                        <span className="font-medium text-[#AEACA8] mr-1">{i + 1}.</span>
                        {q.question}
                      </p>
                      {q.topic && (
                        <span className="inline-block text-[10px] mt-1 px-1.5 py-0.5 rounded" style={{ background: '#F3ECF8', color: '#9065B0' }}>
                          {q.topic}
                        </span>
                      )}
                      <p className="text-[11px] mt-1" style={{ color: '#448361' }}>
                        ✓ {q.answer === 'A' ? q.option_a : q.answer === 'B' ? q.option_b : q.answer === 'C' ? q.option_c : q.option_d}
                      </p>
                      {q.explanation && (
                        <p className="text-[10px] mt-0.5 flex items-center gap-1" style={{ color: '#D97706' }}>
                          <Lightbulb className="w-3 h-3" /> Có giải thích
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => openEdit(q)}
                        className="p-2 rounded-lg transition-colors opacity-0 group-hover/qrow:opacity-100"
                        style={{ color: '#6B7CDB' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#EEF0FB'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                        title="Chỉnh sửa câu hỏi"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(q.id, q.question)}
                        className="p-2 rounded-lg transition-colors opacity-0 group-hover/qrow:opacity-100"
                        style={{ color: '#E03E3E' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#FEF2F2'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                        title="Xóa câu hỏi"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* ── Inline edit form ── */}
                  {editingId === q.id && editDraft && (
                    <div className="px-4 pb-5 pt-2 border-t" style={{ background: '#F7F6F3', borderColor: '#E9E9E7' }}>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#6B7CDB' }}>✏️ Đang chỉnh sửa câu {i + 1}</span>
                        <button onClick={cancelEdit} className="p-1 rounded" style={{ color: '#AEACA8' }}><XIcon className="w-4 h-4" /></button>
                      </div>

                      {/* Question */}
                      <div className="space-y-2 mb-3">
                        <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#AEACA8' }}>Câu hỏi</label>
                        <textarea
                          rows={3}
                          value={editDraft.question}
                          onChange={e => setEditDraft(d => d ? { ...d, question: e.target.value } : d)}
                          className="w-full text-sm p-2.5 rounded-lg outline-none resize-y"
                          style={{ border: '1px solid #E9E9E7', background: '#fff', color: '#1A1A1A' }}
                          onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = '#6B7CDB'}
                          onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = '#E9E9E7'}
                        />
                      </div>

                      {/* Options grid */}
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        {(['A', 'B', 'C', 'D'] as const).map(letter => {
                          const fieldKey = `option_${letter.toLowerCase()}` as 'option_a' | 'option_b' | 'option_c' | 'option_d';
                          const isAnswer = editDraft.answer === letter;
                          return (
                            <div key={letter} className="space-y-1">
                              <label className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1" style={{ color: isAnswer ? '#448361' : '#AEACA8' }}>
                                {letter}
                                {isAnswer && <span className="text-[9px] px-1 rounded" style={{ background: '#EAF3EE', color: '#448361' }}>✓ Đúng</span>}
                              </label>
                              <input
                                type="text"
                                value={editDraft[fieldKey]}
                                onChange={e => setEditDraft(d => d ? { ...d, [fieldKey]: e.target.value } : d)}
                                className="w-full text-sm px-2.5 py-1.5 rounded-lg outline-none"
                                style={{
                                  border: `1px solid ${isAnswer ? '#44836155' : '#E9E9E7'}`,
                                  background: isAnswer ? '#EAF3EE' : '#fff',
                                  color: '#1A1A1A',
                                }}
                                onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = '#6B7CDB'}
                                onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = isAnswer ? '#44836155' : '#E9E9E7'}
                              />
                            </div>
                          );
                        })}
                      </div>

                      {/* Answer selector + explanation */}
                      <div className="grid grid-cols-2 gap-2 mb-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#AEACA8' }}>Đáp án đúng</label>
                          <div className="flex gap-2">
                            {(['A', 'B', 'C', 'D'] as const).map(letter => (
                              <button
                                key={letter}
                                type="button"
                                onClick={() => setEditDraft(d => d ? { ...d, answer: letter } : d)}
                                className="w-9 h-9 rounded-lg text-sm font-bold transition-all"
                                style={{
                                  background: editDraft.answer === letter ? '#448361' : '#F1F0EC',
                                  color: editDraft.answer === letter ? '#fff' : '#787774',
                                  border: `1px solid ${editDraft.answer === letter ? '#448361' : '#E9E9E7'}`,
                                }}
                              >
                                {letter}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#AEACA8' }}>Giải thích (tuỳ chọn)</label>
                          <input
                            type="text"
                            placeholder="Giải thích đáp án..."
                            value={editDraft.explanation || ''}
                            onChange={e => setEditDraft(d => d ? { ...d, explanation: e.target.value || undefined } : d)}
                            className="w-full text-sm px-2.5 py-1.5 rounded-lg outline-none"
                            style={{ border: '1px solid #E9E9E7', background: '#fff', color: '#1A1A1A' }}
                            onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = '#6B7CDB'}
                            onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = '#E9E9E7'}
                          />
                        </div>
                      </div>

                      {/* Save / Cancel */}
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveEdit}
                          disabled={isSavingEdit}
                          className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-60"
                          style={{ background: '#448361' }}
                          onMouseEnter={e => { if (!isSavingEdit) (e.currentTarget as HTMLElement).style.background = '#3A7254'; }}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#448361'}
                        >
                          {isSavingEdit ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          {isSavingEdit ? 'Đang lưu...' : 'Lưu thay đổi'}
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                          style={{ background: '#F1F0EC', color: '#57564F', border: '1px solid #E9E9E7' }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#E9E9E7'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#F1F0EC'}
                        >
                          Hủy
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default AdminGameManager;
