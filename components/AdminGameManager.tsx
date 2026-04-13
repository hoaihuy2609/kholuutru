import React, { useState, useEffect, useCallback } from 'react';
import { Zap, Plus, Trash2, RefreshCw, CheckCircle2, AlertCircle, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';

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
}

interface AdminGameManagerProps {
  onShowToast: (msg: string, type: 'success' | 'error' | 'warning') => void;
  workerUrl: string;
  adminKey: string;
}

// ── Parser: text → structured questions ──────────────────────────
function parseQuestions(raw: string, grade: number): Omit<GameQuestion, 'id'>[] {
  const questions: Omit<GameQuestion, 'id'>[] = [];
  // Split by question number pattern: "1." "2." etc at start of line
  const blocks = raw.split(/\n(?=\d+\.\s)/);

  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 6) continue;

    // Question text: first line (may start with "1. ")
    const qLine = lines[0].replace(/^\d+\.\s*/, '').trim();
    if (!qLine) continue;

    // Find options
    const optA = lines.find(l => /^A[\.\)]\s*/i.test(l))?.replace(/^A[\.\)]\s*/i, '').trim();
    const optB = lines.find(l => /^B[\.\)]\s*/i.test(l))?.replace(/^B[\.\)]\s*/i, '').trim();
    const optC = lines.find(l => /^C[\.\)]\s*/i.test(l))?.replace(/^C[\.\)]\s*/i, '').trim();
    const optD = lines.find(l => /^D[\.\)]\s*/i.test(l))?.replace(/^D[\.\)]\s*/i, '').trim();

    // Find answer: "ĐA: B" or "Đáp án: B"
    const ansLine = lines.find(l => /^(đa|đáp án|answer)\s*[:：]\s*[ABCD]/i.test(l));
    const answer = ansLine?.match(/[ABCD]$/i)?.[0]?.toUpperCase();

    if (optA && optB && optC && optD && answer && ['A', 'B', 'C', 'D'].includes(answer)) {
      questions.push({
        question: qLine,
        option_a: optA,
        option_b: optB,
        option_c: optC,
        option_d: optD,
        answer,
        grade,
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
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [parseError, setParseError] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [showExisting, setShowExisting] = useState(false);

  const authHeader = { Authorization: `Bearer ${adminKey}`, 'Content-Type': 'application/json', Referer: window.location.origin };

  // ── Load existing questions ──────────────────────────────────
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

  // ── Parse ────────────────────────────────────────────────────
  const handleParse = () => {
    if (!rawText.trim()) return;
    setParseError('');
    const result = parseQuestions(rawText, selectedGrade);
    if (result.length === 0) {
      setParseError('Không parse được câu hỏi nào. Kiểm tra lại định dạng!');
      setParsedQuestions([]);
      return;
    }
    setParsedQuestions(result);
    setShowPreview(true);
  };

  // ── Save ─────────────────────────────────────────────────────
  const handleSave = async () => {
    if (parsedQuestions.length === 0) return;
    setIsSaving(true);
    try {
      const questionsWithId = parsedQuestions.map(q => ({
        ...q,
        id: crypto.randomUUID(),
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

  // ── Delete ────────────────────────────────────────────────────
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

  const gradeName = (g: number) => g === 0 ? 'Tất cả khối' : `Khối ${g}`;
  const gradeColor = (g: number) => g === 12 ? '#9065B0' : g === 11 ? '#6B7CDB' : g === 10 ? '#448361' : '#787774';
  const gradeBg = (g: number) => g === 12 ? '#F3ECF8' : g === 11 ? '#EEF0FB' : g === 10 ? '#EAF3EE' : '#F1F0EC';

  const EXAMPLE = `1. Phát biểu nào sau đây về gia tốc là đúng?
A. Gia tốc luôn cùng chiều với vận tốc
B. Gia tốc đặc trưng cho sự thay đổi vận tốc theo thời gian
C. Gia tốc chỉ xuất hiện trong chuyển động thẳng
D. Gia tốc luôn có giá trị dương
ĐA: B

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
            <h3 className="text-base font-semibold" style={{ color: '#1A1A1A' }}>Quản lý câu hỏi Game</h3>
            <p className="text-xs" style={{ color: '#787774' }}>
              {existingQuestions.length} câu hỏi · Dùng cho Vua Lý Thuyết
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
              {([0, 12, 11, 10] as const).map(g => (
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

          {/* Format hint */}
          <div className="rounded-xl p-3" style={{ background: '#F7F6F3', border: '1px solid #E9E9E7' }}>
            <div className="flex items-center gap-1.5 mb-2">
              <BookOpen className="w-3.5 h-3.5" style={{ color: '#6B7CDB' }} />
              <span className="text-[11px] font-semibold" style={{ color: '#6B7CDB' }}>Định dạng chuẩn</span>
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
                      <div className="grid grid-cols-2 gap-1.5">
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
                <div key={q.id} className="p-4 flex items-start gap-3 group/qrow hover:bg-[#FAFAF9] transition-colors">
                  <span className="text-xs font-bold px-2 py-0.5 rounded shrink-0 mt-0.5" style={{ background: gradeBg(q.grade), color: gradeColor(q.grade) }}>
                    {gradeName(q.grade)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm" style={{ color: '#1A1A1A' }}>
                      <span className="font-medium text-[#AEACA8] mr-1">{i + 1}.</span>
                      {q.question}
                    </p>
                    <p className="text-[11px] mt-1" style={{ color: '#448361' }}>
                      ✓ {q['answer'] === 'A' ? q.option_a : q['answer'] === 'B' ? q.option_b : q['answer'] === 'C' ? q.option_c : q.option_d}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(q.id, q.question)}
                    className="p-2 rounded-lg transition-colors opacity-0 group-hover/qrow:opacity-100 shrink-0"
                    style={{ color: '#E03E3E' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#FEF2F2'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                    title="Xóa câu hỏi"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
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
