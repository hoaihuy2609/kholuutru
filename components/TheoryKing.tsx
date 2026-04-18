import React, { useState, useCallback, useRef } from 'react';
import {
  ArrowLeft, BookOpen, CheckCircle2, XCircle,
  RotateCcw, ChevronRight, GraduationCap, Lightbulb,
  School, Dumbbell, ChevronLeft
} from 'lucide-react';
import MathText from './MathText';

// ── Types ──────────────────────────────────────────────────────────
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

interface TopicEntry {
  topic: string;
  grade: number;
}

interface TheoryKingProps {
  onBack: () => void;
  studentGrade?: number | null;
  workerUrl?: string;
}

type GameState = 'select' | 'loading' | 'playing' | 'finished';

// ── Helpers ────────────────────────────────────────────────────────
const OPTIONS: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D'];

const optionText = (q: GameQuestion, letter: 'A' | 'B' | 'C' | 'D') => {
  if (letter === 'A') return q.option_a;
  if (letter === 'B') return q.option_b;
  if (letter === 'C') return q.option_c;
  return q.option_d;
};

const gradeColor = (g: number) =>
  g === 12 ? '#9065B0' : g === 11 ? '#6B7CDB' : g === 10 ? '#448361' : '#787774';
const gradeBg = (g: number) =>
  g === 12 ? '#F3ECF8' : g === 11 ? '#EEF0FB' : g === 10 ? '#EAF3EE' : '#F1F0EC';

// ═══════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════
const TheoryKing: React.FC<TheoryKingProps> = ({ onBack, studentGrade, workerUrl }) => {
  // ── State ──────────────────────────────────────────────────────
  const [gameState, setGameState] = useState<GameState>('select');
  const [questions, setQuestions] = useState<GameQuestion[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answerResult, setAnswerResult] = useState<'correct' | 'wrong' | null>(null);
  const [correctCount, setCorrectCount] = useState(0);

  // ── Selection state ────────────────────────────────────────────
  const [topics, setTopics] = useState<TopicEntry[]>([]);
  const [selectedGrade, setSelectedGrade] = useState<number>(studentGrade || 12);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [currentTopic, setCurrentTopic] = useState<string>('');

  const answerLock = useRef(false);

  // ── Fetch topics ───────────────────────────────────────────────
  const fetchTopics = useCallback(async (grade: number) => {
    if (!workerUrl) return;
    setLoadingTopics(true);
    try {
      const res = await fetch(`${workerUrl}/game/topics?grade=${grade}`, {
        headers: { Referer: window.location.origin },
      });
      if (res.ok) {
        const data: TopicEntry[] = await res.json();
        setTopics(data);
      }
    } catch { /* ignore */ }
    finally { setLoadingTopics(false); }
  }, [workerUrl]);

  // Fetch topics khi mount
  React.useEffect(() => {
    fetchTopics(selectedGrade);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Start practice ─────────────────────────────────────────────
  const startPractice = useCallback(async (grade: number, topic: string) => {
    setGameState('loading');
    setCurrentTopic(topic);
    let pool: GameQuestion[] = [];
    if (workerUrl) {
      try {
        const url = `${workerUrl}/game/questions?grade=${grade}&limit=500&topic=${encodeURIComponent(topic)}&shuffle=false`;
        const res = await fetch(url, { headers: { Referer: window.location.origin } });
        if (res.ok) {
          const data: GameQuestion[] = await res.json();
          if (data && data.length > 0) pool = data;
        }
      } catch { /* fall through */ }
    }

    if (pool.length === 0) {
      alert('Chưa có câu hỏi nào cho chương này. Vui lòng liên hệ Admin.');
      setGameState('select');
      return;
    }

    setQuestions(pool);
    setQIndex(0);
    setSelectedAnswer(null);
    setAnswerResult(null);
    setCorrectCount(0);
    answerLock.current = false;
    setGameState('playing');
  }, [workerUrl]);

  // ── Handle answer ──────────────────────────────────────────────
  const handleAnswer = useCallback((letter: string) => {
    if (gameState !== 'playing' || answerLock.current || answerResult !== null) return;
    answerLock.current = true;
    setSelectedAnswer(letter);
    const q = questions[qIndex];
    const isCorrect = letter === q.answer;
    if (isCorrect) setCorrectCount(c => c + 1);
    setAnswerResult(isCorrect ? 'correct' : 'wrong');
  }, [gameState, questions, qIndex, answerResult]);

  // ── Next question ──────────────────────────────────────────────
  const handleNext = useCallback(() => {
    const isLast = qIndex >= questions.length - 1;
    if (isLast) {
      setGameState('finished');
    } else {
      setQIndex(i => i + 1);
      setSelectedAnswer(null);
      setAnswerResult(null);
      answerLock.current = false;
    }
  }, [qIndex, questions.length]);

  // ── Previous question (chỉ khi chưa chọn đáp án) ─────────────
  const handlePrev = useCallback(() => {
    if (qIndex <= 0) return;
    setQIndex(i => i - 1);
    setSelectedAnswer(null);
    setAnswerResult(null);
    answerLock.current = false;
  }, [qIndex]);

  // ── Restart same topic ────────────────────────────────────────
  const handleRestart = useCallback(() => {
    startPractice(selectedGrade, currentTopic);
  }, [startPractice, selectedGrade, currentTopic]);

  // ──────────────────────────────────────────────────────────────
  // SELECT: chọn khối + chương
  // ──────────────────────────────────────────────────────────────
  if (gameState === 'select') {
    const filteredTopics = topics.filter(t => t.grade === selectedGrade || t.grade === 0);

    return (
      <div className="animate-fade-in space-y-5 pb-10">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg transition-colors"
            style={{ background: '#F1F0EC', border: '1px solid #E9E9E7', color: '#57564F' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#E9E9E7'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#F1F0EC'}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <Dumbbell className="w-6 h-6" style={{ color: '#6B7CDB' }} />
              <h2 className="text-xl font-bold" style={{ color: '#1A1A1A' }}>Luyện tập lý thuyết</h2>
            </div>
            <p className="text-xs mt-0.5" style={{ color: '#787774' }}>Chọn khối và chương cần ôn tập</p>
          </div>
        </div>

        {/* Grade filter */}
        <div>
          {!studentGrade && (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#AEACA8' }}>Chọn khối</p>
              <div className="flex gap-2 flex-wrap">
                {([10, 11, 12] as const).map(g => (
                  <button
                    key={g}
                    onClick={() => {
                      setSelectedGrade(g);
                      setTopics([]);
                      fetchTopics(g);
                    }}
                    className="px-4 py-2 text-xs font-bold rounded-xl transition-all active:scale-[0.98]"
                    style={{
                      background: selectedGrade === g ? gradeColor(g) : '#F7F6F3',
                      color: selectedGrade === g ? '#FFFFFF' : '#787774',
                      border: `1px solid ${selectedGrade === g ? gradeColor(g) : '#E9E9E7'}`,
                    }}
                  >
                    Lớp {g}
                  </button>
                ))}
              </div>
            </>
          )}
          {studentGrade && (
            <div className="flex items-center gap-2">
              <span
                className="px-4 py-2 text-xs font-bold rounded-xl"
                style={{ background: gradeColor(studentGrade), color: '#FFFFFF' }}
              >
                Lớp {studentGrade}
              </span>
              <span className="text-xs" style={{ color: '#AEACA8' }}>· Tài nguyên dành riêng cho khối bạn</span>
            </div>
          )}
        </div>

        {/* Topics list */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#AEACA8' }}>Chọn chương</p>
          {loadingTopics ? (
            <div className="py-8 flex justify-center">
              <RotateCcw className="w-6 h-6 animate-spin" style={{ color: '#6B7CDB' }} />
            </div>
          ) : filteredTopics.length === 0 ? (
            <div className="rounded-xl p-6 text-center" style={{ background: '#F7F6F3', border: '1px solid #E9E9E7' }}>
              <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm" style={{ color: '#AEACA8' }}>Chưa có chương nào cho khối này.</p>
              <p className="text-xs mt-1" style={{ color: '#AEACA8' }}>Liên hệ Admin để thêm câu hỏi.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTopics.map(t => (
                <button
                  key={t.topic}
                  onClick={() => startPractice(selectedGrade, t.topic)}
                  className="w-full flex items-center gap-3 p-4 rounded-xl text-left transition-all"
                  style={{ background: '#FFFFFF', border: '2px solid #E9E9E7' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = '#6B7CDB'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = '#E9E9E7'}
                >
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: gradeBg(t.grade) }}>
                    <GraduationCap className="w-4 h-4" style={{ color: gradeColor(t.grade) }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: '#1A1A1A' }}>{t.topic}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: gradeBg(t.grade), color: gradeColor(t.grade) }}>
                        Lớp {t.grade === 0 ? 'Tất cả' : t.grade}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 shrink-0" style={{ color: '#AEACA8' }} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────
  // LOADING
  // ──────────────────────────────────────────────────────────────
  if (gameState === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 animate-fade-in">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #EEF0FB, #DDE3F8)' }}>
          <Dumbbell className="w-10 h-10" style={{ color: '#6B7CDB' }} />
        </div>
        <p className="text-base font-semibold" style={{ color: '#787774' }}>Đang tải câu hỏi...</p>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────
  // FINISHED
  // ──────────────────────────────────────────────────────────────
  if (gameState === 'finished') {
    const total = questions.length;
    const pct = Math.round((correctCount / total) * 100);

    return (
      <div className="animate-fade-in space-y-5 pb-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setGameState('select')}
            className="p-2 rounded-lg transition-colors"
            style={{ background: '#F1F0EC', border: '1px solid #E9E9E7', color: '#57564F' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#E9E9E7'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#F1F0EC'}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h2 className="text-xl font-bold" style={{ color: '#1A1A1A' }}>Kết quả luyện tập</h2>
        </div>

        <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E9E9E7', boxShadow: '0 8px 32px rgba(107,124,219,0.08)' }}>
          <div className="h-1.5" style={{ background: 'linear-gradient(90deg, #6B7CDB, #9065B0)' }} />
          <div className="p-8 text-center flex flex-col items-center">
            <div className="w-24 h-24 rounded-full flex items-center justify-center mb-5" style={{ background: '#EEF0FB' }}>
              <span className="text-4xl font-black" style={{ color: '#6B7CDB' }}>{pct}%</span>
            </div>
            <h3 className="text-2xl font-black mb-1" style={{ color: '#1A1A1A' }}>
              {pct >= 80 ? 'Xuất sắc! 🎉' : pct >= 60 ? 'Khá tốt! 💪' : 'Cần ôn thêm! 📚'}
            </h3>
            <p className="text-sm mb-6" style={{ color: '#787774' }}>
              Bạn trả lời đúng <strong style={{ color: '#6B7CDB' }}>{correctCount}/{total}</strong> câu trong chương <strong>"{currentTopic}"</strong>
            </p>

            <div className="flex gap-3 w-full max-w-sm">
              <button
                onClick={handleRestart}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: '#EEF0FB', color: '#6B7CDB', border: '2px solid #6B7CDB33' }}
              >
                <RotateCcw className="w-4 h-4" />
                Làm lại
              </button>
              <button
                onClick={() => setGameState('select')}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #6B7CDB, #9065B0)', boxShadow: '0 8px 24px rgba(107,124,219,0.3)' }}
              >
                <GraduationCap className="w-4 h-4" />
                Chương khác
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────
  // PLAYING
  // ──────────────────────────────────────────────────────────────
  if (gameState === 'playing' && questions.length > 0) {
    const q = questions[qIndex];
    const progress = ((qIndex + 1) / questions.length) * 100;

    return (
      <div className="animate-fade-in space-y-4 pb-10">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setGameState('select')}
            className="p-2 rounded-lg transition-colors"
            style={{ background: '#F1F0EC', border: '1px solid #E9E9E7', color: '#57564F' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#E9E9E7'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#F1F0EC'}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate" style={{ color: '#787774' }}>{currentTopic}</p>
          </div>
          <span className="text-xs font-semibold shrink-0" style={{ color: '#6B7CDB' }}>
            {qIndex + 1} / {questions.length}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#F1F0EC' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #6B7CDB, #9065B0)' }}
          />
        </div>

        {/* Question card */}
        <div
          className="rounded-2xl p-6 transition-all"
          style={{
            background: '#FFFFFF',
            border: `2px solid ${answerResult === 'correct' ? '#44836144' : answerResult === 'wrong' ? '#E03E3E44' : '#6B7CDB22'}`,
            boxShadow: answerResult === 'correct' ? '0 4px 20px rgba(68,131,97,0.12)' : answerResult === 'wrong' ? '0 4px 20px rgba(224,62,62,0.12)' : '0 2px 12px rgba(107,124,219,0.08)',
          }}
        >
          <span className="inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded mb-3" style={{ background: '#EEF0FB', color: '#6B7CDB' }}>
            Câu {qIndex + 1}
          </span>
          <MathText content={q.question} className="text-base font-medium leading-relaxed" style={{ color: '#1A1A1A' }} />
        </div>

        {/* Options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {OPTIONS.map(letter => {
            const text = optionText(q, letter);
            const isSelected = selectedAnswer === letter;
            const isCorrectAnswer = letter === q.answer;

            let bg = '#FFFFFF', border = '#E9E9E7', color = '#1A1A1A';
            if (answerResult && isSelected) {
              if (answerResult === 'correct') { bg = '#EAF3EE'; border = '#448361'; color = '#448361'; }
              else { bg = '#FEF2F2'; border = '#E03E3E'; color = '#E03E3E'; }
            } else if (answerResult === 'wrong' && isCorrectAnswer) {
              bg = '#EAF3EE'; border = '#448361'; color = '#448361';
            }

            return (
              <button
                key={letter}
                onClick={() => handleAnswer(letter)}
                disabled={!!answerResult}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all active:scale-[0.98] disabled:cursor-default"
                style={{ background: bg, border: `2px solid ${border}`, color }}
                onMouseEnter={e => { if (!answerResult) (e.currentTarget as HTMLElement).style.borderColor = '#6B7CDB'; }}
                onMouseLeave={e => { if (!answerResult) (e.currentTarget as HTMLElement).style.borderColor = '#E9E9E7'; }}
              >
                <span
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
                  style={{
                    background: isSelected || (answerResult === 'wrong' && isCorrectAnswer) ? 'transparent' : '#F7F6F3',
                    color: isSelected || (answerResult === 'wrong' && isCorrectAnswer) ? color : '#AEACA8',
                  }}
                >
                  {letter}
                </span>
                <MathText content={text} className="text-sm font-medium flex-1" />
                {isSelected && answerResult === 'correct' && <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: '#448361' }} />}
                {isSelected && answerResult === 'wrong' && <XCircle className="w-4 h-4 shrink-0" style={{ color: '#E03E3E' }} />}
                {answerResult === 'wrong' && isCorrectAnswer && !isSelected && <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: '#448361' }} />}
              </button>
            );
          })}
        </div>

        {/* Explanation box — hiện sau khi chọn đáp án */}
        {answerResult !== null && q.explanation && (
          <div
            className="rounded-xl p-4 animate-fade-in"
            style={{ background: '#FFFBEB', border: '1px solid #F59E0B33' }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="w-4 h-4 shrink-0" style={{ color: '#D97706' }} />
              <span className="text-xs font-bold uppercase tracking-wide" style={{ color: '#D97706' }}>Giải thích</span>
            </div>
            <MathText content={q.explanation} className="text-sm leading-relaxed" style={{ color: '#57564F' }} />
          </div>
        )}

        {/* Navigation buttons */}
        {answerResult !== null && (
          <div className="flex gap-3 animate-fade-in">
            {qIndex > 0 && (
              <button
                onClick={handlePrev}
                className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95"
                style={{ background: '#F1F0EC', color: '#57564F', border: '1px solid #E9E9E7' }}
              >
                <ChevronLeft className="w-4 h-4" />
                Câu trước
              </button>
            )}
            <button
              onClick={handleNext}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold text-sm transition-all active:scale-95"
              style={{ background: 'linear-gradient(135deg, #6B7CDB, #9065B0)', boxShadow: '0 4px 16px rgba(107,124,219,0.35)' }}
            >
              {qIndex >= questions.length - 1 ? (
                <>Xem kết quả <CheckCircle2 className="w-4 h-4" /></>
              ) : (
                <>Câu tiếp theo <ChevronRight className="w-4 h-4" /></>
              )}
            </button>
          </div>
        )}
      </div>
    );
  }

  return null;
};

export default TheoryKing;
