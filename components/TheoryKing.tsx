import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowLeft, Trophy, Crown, CheckCircle2, XCircle,
  Star, Flame, RotateCcw, ChevronRight, Medal, Zap, BookOpen, Lock,
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
}

interface TheoryKingProps {
  onBack: () => void;
  studentGrade?: number | null;
  workerUrl?: string;
}

interface WeeklyRecord {
  week: string;      // "2024-W15"
  score: number;
  correct: number;
  total: number;
  grade: string;     // 'S' | 'A' | 'B' | 'C' | 'D'
  completedAt: number;
}

type GameState = 'hub' | 'loading' | 'playing' | 'review' | 'finished';

// ── Constants ──────────────────────────────────────────────────────
const MAX_QUESTIONS_PER_SESSION = 20;
const STREAK_THRESHOLD = 5;   // streak to get x2
const BASE_POINT = 15;        // more than Blitz per question
const STORAGE_KEY = 'pv_theoryking';

// ── Helpers ────────────────────────────────────────────────────────
function getWeekId(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function calcGrade(score: number, total: number): string {
  const pct = total > 0 ? score / (total * BASE_POINT * 2) : 0;
  if (pct >= 0.85) return 'S';
  if (pct >= 0.70) return 'A';
  if (pct >= 0.55) return 'B';
  if (pct >= 0.35) return 'C';
  return 'D';
}

function loadStorage(): { history: WeeklyRecord[]; weekDone: string | null } {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') ?? { history: [], weekDone: null };
  } catch { return { history: [], weekDone: null }; }
}

function saveStorage(data: { history: WeeklyRecord[]; weekDone: string | null }) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

const OPTIONS: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D'];

const optionText = (q: GameQuestion, letter: 'A' | 'B' | 'C' | 'D') => {
  if (letter === 'A') return q.option_a;
  if (letter === 'B') return q.option_b;
  if (letter === 'C') return q.option_c;
  return q.option_d;
};

// ── Grade config ───────────────────────────────────────────────────
const GRADE_CONFIG: Record<string, { color: string; bg: string; border: string; label: string; emoji: string }> = {
  S: { color: '#B45309', bg: '#FFFBEB', border: '#F59E0B', label: 'Xuất sắc', emoji: '👑' },
  A: { color: '#166534', bg: '#F0FDF4', border: '#448361', label: 'Giỏi', emoji: '🥇' },
  B: { color: '#3B4FA0', bg: '#EEF0FB', border: '#6B7CDB', label: 'Khá', emoji: '🥈' },
  C: { color: '#92400E', bg: '#FFF7ED', border: '#D9730D', label: 'Trung bình', emoji: '🥉' },
  D: { color: '#9F1239', bg: '#FFF1F2', border: '#E03E3E', label: 'Cần cố gắng', emoji: '💪' },
};

// ── Review card answer state ───────────────────────────────────────
interface AnsweredQ {
  question: GameQuestion;
  chosen: string;
  correct: boolean;
  points: number;
}

// ═══════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════
const TheoryKing: React.FC<TheoryKingProps> = ({ onBack, studentGrade, workerUrl }) => {
  const thisWeek = getWeekId();

  const [gameState, setGameState] = useState<GameState>('hub');
  const [questions, setQuestions] = useState<GameQuestion[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState<AnsweredQ[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answerResult, setAnswerResult] = useState<'correct' | 'wrong' | null>(null);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [score, setScore] = useState(0);
  const [storage, setStorage] = useState(loadStorage);

  const answerLock = useRef(false);
  const scoreRef = useRef(0);
  const answersRef = useRef<AnsweredQ[]>([]);
  const weekDone = storage.weekDone === thisWeek;
  const thisWeekRecord = storage.history.find(h => h.week === thisWeek) ?? null;

  // ── Load questions ────────────────────────────────────────────────
  const startGame = useCallback(async () => {
    setGameState('loading');
    let pool: GameQuestion[] = [];
    if (workerUrl) {
      try {
        const grade = studentGrade || 0;
        const res = await fetch(`${workerUrl}/game/questions?grade=${grade}&limit=60`, {
          headers: { 'Referer': window.location.origin },
        });
        if (res.ok) {
          const data: GameQuestion[] = await res.json();
          if (data && data.length > 0) pool = data;
        }
      } catch { /* fall through */ }
    }
    
    if (pool.length === 0) {
      alert("Chưa có đủ dữ liệu câu hỏi để chơi game này. Vui lòng thêm câu hỏi qua Admin Panel.");
      setGameState('hub');
      return;
    }

    const selected = shuffle(pool).slice(0, MAX_QUESTIONS_PER_SESSION);
    setQuestions(selected);
    setQIndex(0);
    setAnswers([]);
    setSelectedAnswer(null);
    setAnswerResult(null);
    setStreak(0);
    setMaxStreak(0);
    setScore(0);
    scoreRef.current = 0;
    answersRef.current = [];
    answerLock.current = false;
    setGameState('playing');
  }, [workerUrl, studentGrade]);

  // ── Handle answer ─────────────────────────────────────────────────
  const handleAnswer = useCallback((letter: string) => {
    if (gameState !== 'playing' || answerLock.current || answerResult !== null) return;
    answerLock.current = true;
    setSelectedAnswer(letter);

    const q = questions[qIndex];
    const isCorrect = letter === q.answer;
    const newStreak = isCorrect ? streak + 1 : 0;
    const multiplier = isCorrect && newStreak >= STREAK_THRESHOLD ? 2 : 1;
    const pts = isCorrect ? BASE_POINT * multiplier : 0;

    setStreak(newStreak);
    if (isCorrect) setMaxStreak(ms => Math.max(ms, newStreak));
    const newScore = scoreRef.current + pts;
    scoreRef.current = newScore;
    setScore(newScore);
    setAnswerResult(isCorrect ? 'correct' : 'wrong');
    const newAnswered: AnsweredQ = { question: q, chosen: letter, correct: isCorrect, points: pts };
    answersRef.current = [...answersRef.current, newAnswered];
    setAnswers(answersRef.current);
  }, [gameState, questions, qIndex, streak, answerResult]);

  // ── Next / Finish ─────────────────────────────────────────────────
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
  }, [qIndex]);

  // ── Save on finish ─────────────────────────────────────────────────
  useEffect(() => {
    if (gameState !== 'finished') return;
    const allAnswers = answersRef.current;
    const finalScore = scoreRef.current;
    const correct = allAnswers.filter(a => a.correct).length;
    const grade = calcGrade(finalScore, allAnswers.length);
    const record: WeeklyRecord = {
      week: thisWeek,
      score: finalScore,
      correct,
      total: allAnswers.length,
      grade,
      completedAt: Date.now(),
    };
    const curStorage = loadStorage();
    const newHistory = [record, ...curStorage.history.filter(h => h.week !== thisWeek)].slice(0, 10);
    const newStorage = { history: newHistory, weekDone: thisWeek };
    setStorage(newStorage);
    saveStorage(newStorage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState]);

  // ═══════════════════════════════════
  // HUB Screen
  // ═══════════════════════════════════
  if (gameState === 'hub') {
    const pastWeeks = storage.history.filter(h => h.week !== thisWeek).slice(0, 5);
    const allTimeScore = storage.history.reduce((s, h) => s + h.score, 0);

    return (
      <div className="animate-fade-in space-y-6 pb-10">
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
            <span className="inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded mb-1" style={{ background: '#F3ECF8', color: '#9065B0' }}>
              Game · Vua Lý Thuyết
            </span>
            <h2 className="text-2xl font-semibold" style={{ color: '#1A1A1A' }}>👑 Vua Lý Thuyết</h2>
          </div>
        </div>

        {/* This week card */}
        <div className="rounded-2xl overflow-hidden" style={{ border: '2px solid #9065B033', background: '#FFFFFF' }}>
          <div className="h-1.5" style={{ background: 'linear-gradient(90deg, #9065B0, #6B7CDB)' }} />
          <div className="p-6">
            {weekDone && thisWeekRecord ? (
              // Already completed this week
              <div className="text-center">
                <div className="text-4xl mb-3">{GRADE_CONFIG[thisWeekRecord.grade]?.emoji ?? '🏅'}</div>
                <p className="text-sm font-medium mb-1" style={{ color: '#787774' }}>Bài thi tuần này đã hoàn thành!</p>
                <div className="text-4xl font-black my-2" style={{ color: '#9065B0' }}>{thisWeekRecord.score}</div>
                <p className="text-xs mb-4" style={{ color: '#AEACA8' }}>điểm · {thisWeekRecord.correct}/{thisWeekRecord.total} đúng · Hạng {GRADE_CONFIG[thisWeekRecord.grade]?.label}</p>
                <div className="flex items-center justify-center gap-2 p-3 rounded-xl mb-4" style={{ background: '#F3ECF8' }}>
                  <Lock className="w-4 h-4" style={{ color: '#9065B0' }} />
                  <span className="text-sm" style={{ color: '#9065B0' }}>Tuần mới sẽ mở vào thứ Hai!</span>
                </div>
                <button
                  onClick={() => setGameState('review')}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
                  style={{ background: '#F3ECF8', color: '#9065B0', border: '1px solid #9065B033' }}
                >
                  <BookOpen className="w-4 h-4" />
                  Xem lại đáp án
                </button>
              </div>
            ) : (
              // Ready to play
              <div className="text-center">
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: 'linear-gradient(135deg, #F3ECF8, #E8D5F5)' }}
                >
                  <Crown className="w-10 h-10" style={{ color: '#9065B0' }} />
                </div>
                <h3 className="text-xl font-semibold mb-2" style={{ color: '#1A1A1A' }}>Thách thức tuần này</h3>
                <p className="text-sm leading-relaxed mb-5 max-w-sm mx-auto" style={{ color: '#787774' }}>
                  Trả lời <strong>tối đa {MAX_QUESTIONS_PER_SESSION} câu hỏi lý thuyết</strong> không giới hạn thời gian. Liên tiếp đúng 5 câu nhận <strong>điểm x2</strong>. Mỗi tuần chỉ chơi một lần!
                </p>

                {/* Rules */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                  {[
                    { icon: '📚', label: `Tối đa ${MAX_QUESTIONS_PER_SESSION} câu`, sub: 'Mỗi tuần' },
                    { icon: '⏳', label: 'Thoải mái', sub: 'Không tính giờ' },
                    { icon: '🔥', label: 'Streak ×2', sub: '5 câu đúng liên tiếp' },
                  ].map(r => (
                    <div key={r.label} className="rounded-xl p-3" style={{ background: '#F3ECF8', border: '1px solid #E8D5F5' }}>
                      <div className="text-2xl mb-1">{r.icon}</div>
                      <div className="font-semibold text-xs" style={{ color: '#6B3FA0' }}>{r.label}</div>
                      <div className="text-[10px]" style={{ color: '#9065B0' }}>{r.sub}</div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={startGame}
                  className="px-10 py-3.5 rounded-2xl text-white font-bold text-base transition-all active:scale-95"
                  style={{
                    background: 'linear-gradient(135deg, #9065B0, #6B7CDB)',
                    boxShadow: '0 8px 24px rgba(144,101,176,0.4)',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.9'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
                >
                  👑 Bắt đầu chinh phục
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Stats row */}
        {storage.history.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Tổng điểm', value: allTimeScore, color: '#9065B0', bg: '#F3ECF8', icon: <Star className="w-4 h-4" /> },
              { label: 'Tuần đã chơi', value: storage.history.length, color: '#6B7CDB', bg: '#EEF0FB', icon: <Trophy className="w-4 h-4" /> },
              { label: 'Điểm cao nhất', value: Math.max(...storage.history.map(h => h.score)), color: '#448361', bg: '#EAF3EE', icon: <Crown className="w-4 h-4" /> },
            ].map(s => (
              <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: s.bg }}>
                <div className="flex justify-center mb-1" style={{ color: s.color }}>{s.icon}</div>
                <div className="text-xl font-black" style={{ color: s.color }}>{s.value}</div>
                <div className="text-[10px]" style={{ color: '#AEACA8' }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* History */}
        {pastWeeks.length > 0 && (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E9E9E7', background: '#FFFFFF' }}>
            <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #E9E9E7', background: '#FAFAF9' }}>
              <Medal className="w-4 h-4" style={{ color: '#9065B0' }} />
              <span className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>Lịch sử các tuần</span>
            </div>
            <div className="divide-y" style={{ borderColor: '#E9E9E7' }}>
              {pastWeeks.map((rec, i) => {
                const cfg = GRADE_CONFIG[rec.grade] ?? GRADE_CONFIG['D'];
                return (
                  <div key={rec.week} className="flex items-center gap-3 px-4 py-3">
                    <span className="text-lg">{cfg.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium" style={{ color: '#57564F' }}>
                        Tuần {rec.week.split('-W')[1]} · {new Date(rec.completedAt).toLocaleDateString('vi-VN')}
                      </p>
                      <p className="text-[11px]" style={{ color: '#AEACA8' }}>{rec.correct}/{rec.total} đúng</p>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-black" style={{ color: cfg.color }}>{rec.score}</div>
                      <div
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                        style={{ background: cfg.bg, color: cfg.color }}
                      >
                        {rec.grade}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════
  // Loading
  // ═══════════════════════════════════
  if (gameState === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 animate-fade-in">
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #F3ECF8, #E8D5F5)' }}
        >
          <Crown className="w-10 h-10" style={{ color: '#9065B0' }} />
        </div>
        <p className="text-base font-semibold" style={{ color: '#787774' }}>Đang chuẩn bị câu hỏi...</p>
      </div>
    );
  }

  // ═══════════════════════════════════
  // Playing
  // ═══════════════════════════════════
  if (gameState === 'playing' && questions.length > 0) {
    const q = questions[qIndex];
    const isStreakActive = streak >= STREAK_THRESHOLD;
    const progress = ((qIndex) / questions.length) * 100;

    return (
      <div className="animate-fade-in space-y-4 pb-10">
        {/* HUD */}
        <div className="flex items-center gap-3">
          {/* Progress */}
          <div className="flex-1">
            <div className="flex items-center justify-between text-xs mb-1" style={{ color: '#AEACA8' }}>
              <span>Câu {qIndex + 1} / {questions.length}</span>
              <span className="font-semibold" style={{ color: '#9065B0' }}>{score} điểm</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: '#F1F0EC' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #9065B0, #6B7CDB)' }}
              />
            </div>
          </div>

          {/* Streak indicator */}
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl shrink-0 transition-all"
            style={{
              background: isStreakActive ? '#F3ECF8' : '#FFFFFF',
              border: `1px solid ${isStreakActive ? '#9065B0' : '#E9E9E7'}`,
            }}
          >
            <Flame className="w-3.5 h-3.5" style={{ color: isStreakActive ? '#9065B0' : '#AEACA8' }} />
            <span className="text-sm font-bold" style={{ color: isStreakActive ? '#9065B0' : '#AEACA8' }}>
              {streak}
            </span>
            {isStreakActive && <Zap className="w-3 h-3" style={{ color: '#9065B0' }} />}
          </div>
        </div>

        {/* Question */}
        <div
          className="rounded-2xl p-6 transition-all"
          style={{
            background: '#FFFFFF',
            border: `2px solid ${answerResult === 'correct' ? '#44836144' : answerResult === 'wrong' ? '#E03E3E44' : '#9065B022'}`,
            boxShadow: answerResult === 'correct'
              ? '0 4px 20px rgba(68,131,97,0.12)'
              : answerResult === 'wrong'
              ? '0 4px 20px rgba(224,62,62,0.12)'
              : '0 2px 12px rgba(144,101,176,0.08)',
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span
              className="text-[10px] font-bold uppercase px-2 py-0.5 rounded"
              style={{ background: '#F3ECF8', color: '#9065B0' }}
            >
              Câu {qIndex + 1}
            </span>
            {isStreakActive && (
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded animate-pulse"
                style={{ background: '#FEF3C7', color: '#D97706' }}
              >
                🔥 STREAK ×2
              </span>
            )}
          </div>
          <MathText
            content={q.question}
            className="text-base font-medium leading-relaxed"
            style={{ color: '#1A1A1A' }}
          />
        </div>

        {/* Options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {OPTIONS.map(letter => {
            const text = optionText(q, letter);
            const isSelected = selectedAnswer === letter;
            const isCorrectAnswer = letter === q.answer;

            let bg = '#FFFFFF';
            let border = '#E9E9E7';
            let color = '#1A1A1A';

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
                onMouseEnter={e => {
                  if (!answerResult) (e.currentTarget as HTMLElement).style.borderColor = '#9065B0';
                }}
                onMouseLeave={e => {
                  if (!answerResult) (e.currentTarget as HTMLElement).style.borderColor = '#E9E9E7';
                }}
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

        {/* Next button (only shows after answering) */}
        {answerResult !== null && (
          <button
            onClick={handleNext}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold text-sm transition-all active:scale-95 animate-fade-in"
            style={{
              background: 'linear-gradient(135deg, #9065B0, #6B7CDB)',
              boxShadow: '0 4px 16px rgba(144,101,176,0.3)',
            }}
          >
            {qIndex >= questions.length - 1 ? (
              <><Trophy className="w-4 h-4" />Xem kết quả</>
            ) : (
              <><ChevronRight className="w-4 h-4" />Câu tiếp theo</>
            )}
          </button>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════
  // Review (xem lại đáp án)
  // ═══════════════════════════════════
  if (gameState === 'review') {
    const reviewData = answers.length > 0 ? answers : (thisWeekRecord ? [] : []);
    return (
      <div className="animate-fade-in space-y-5 pb-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setGameState('hub')}
            className="p-2 rounded-lg transition-colors"
            style={{ background: '#F1F0EC', border: '1px solid #E9E9E7', color: '#57564F' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#E9E9E7'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#F1F0EC'}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h2 className="text-xl font-semibold" style={{ color: '#1A1A1A' }}>📋 Xem lại đáp án</h2>
        </div>

        {reviewData.length === 0 ? (
          <div className="py-16 text-center" style={{ color: '#AEACA8' }}>
            <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>Không có dữ liệu để xem lại.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reviewData.map((ans, i) => {
              const q = ans.question;
              return (
                <div
                  key={i}
                  className="rounded-2xl overflow-hidden"
                  style={{
                    border: `1px solid ${ans.correct ? '#44836122' : '#E03E3E22'}`,
                    background: '#FFFFFF',
                  }}
                >
                  <div
                    className="px-4 py-2.5 flex items-center gap-2"
                    style={{ background: ans.correct ? '#EAF3EE' : '#FEF2F2' }}
                  >
                    {ans.correct
                      ? <CheckCircle2 className="w-4 h-4" style={{ color: '#448361' }} />
                      : <XCircle className="w-4 h-4" style={{ color: '#E03E3E' }} />
                    }
                    <span className="text-xs font-semibold" style={{ color: ans.correct ? '#448361' : '#E03E3E' }}>
                      Câu {i + 1} · {ans.correct ? `+${ans.points} điểm` : 'Sai'}
                    </span>
                  </div>
                  <div className="p-4 space-y-3">
                    <MathText content={q.question} className="text-sm font-medium" style={{ color: '#1A1A1A' }} />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {OPTIONS.map(letter => {
                        const text = optionText(q, letter);
                        const isCorrect = letter === q.answer;
                        const isChosen = letter === ans.chosen;
                        return (
                          <div
                            key={letter}
                            className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs"
                            style={{
                              background: isCorrect ? '#EAF3EE' : isChosen && !isCorrect ? '#FEF2F2' : '#F7F6F3',
                              border: isCorrect ? '1px solid #44836133' : isChosen && !isCorrect ? '1px solid #E03E3E22' : '1px solid transparent',
                            }}
                          >
                            <span className="font-bold shrink-0" style={{ color: isCorrect ? '#448361' : isChosen && !isCorrect ? '#E03E3E' : '#AEACA8' }}>
                              {letter}.
                            </span>
                            <MathText content={text} style={{ color: isCorrect ? '#448361' : isChosen && !isCorrect ? '#E03E3E' : '#57564F' }} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════
  // Finished
  // ═══════════════════════════════════
  if (gameState === 'finished') {
    const correct = answers.filter(a => a.correct).length;
    const wrong = answers.filter(a => !a.correct).length;
    const accuracy = answers.length > 0 ? Math.round((correct / answers.length) * 100) : 0;
    const grade = calcGrade(score, answers.length);
    const cfg = GRADE_CONFIG[grade] ?? GRADE_CONFIG['D'];

    return (
      <div className="animate-fade-in space-y-5 pb-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setGameState('hub')}
            className="p-2 rounded-lg transition-colors"
            style={{ background: '#F1F0EC', border: '1px solid #E9E9E7', color: '#57564F' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#E9E9E7'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#F1F0EC'}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h2 className="text-2xl font-semibold" style={{ color: '#1A1A1A' }}>Kết quả tuần này</h2>
        </div>

        {/* Score card */}
        <div className="rounded-2xl overflow-hidden text-center" style={{ background: '#FFFFFF', border: '1px solid #E9E9E7' }}>
          <div className="h-1.5" style={{ background: 'linear-gradient(90deg, #9065B0, #6B7CDB)' }} />
          <div className="p-8">
            {/* Grade badge */}
            <div className="text-5xl mb-2">{cfg.emoji}</div>
            <div
              className="inline-block px-4 py-1.5 rounded-full text-sm font-bold mb-4"
              style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}33` }}
            >
              Hạng {grade} · {cfg.label}
            </div>

            <div className="text-6xl font-black mb-1" style={{ color: '#1A1A1A' }}>{score}</div>
            <div className="text-sm mb-6" style={{ color: '#AEACA8' }}>điểm</div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[
                { icon: '✅', label: 'Đúng', value: correct, color: '#448361', bg: '#EAF3EE' },
                { icon: '❌', label: 'Sai', value: wrong, color: '#E03E3E', bg: '#FEF2F2' },
                { icon: '🎯', label: 'Chính xác', value: accuracy + '%', color: '#6B7CDB', bg: '#EEF0FB' },
              ].map(s => (
                <div key={s.label} className="rounded-xl p-3" style={{ background: s.bg }}>
                  <div className="text-xl mb-0.5">{s.icon}</div>
                  <div className="text-lg font-black" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-[10px]" style={{ color: '#AEACA8' }}>{s.label}</div>
                </div>
              ))}
            </div>

            {maxStreak > 0 && (
              <div className="flex items-center justify-center gap-2 text-sm" style={{ color: '#787774' }}>
                <Flame className="w-4 h-4" style={{ color: '#F59E0B' }} />
                Streak dài nhất: <strong style={{ color: '#D97706' }}>{maxStreak} câu liên tiếp</strong>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => setGameState('review')}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: 'linear-gradient(135deg, #9065B0, #6B7CDB)',
              color: '#fff',
              boxShadow: '0 4px 16px rgba(144,101,176,0.3)',
            }}
          >
            <BookOpen className="w-4 h-4" />
            Xem lại đáp án
          </button>
          <button
            onClick={() => setGameState('hub')}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-medium transition-all"
            style={{ background: '#F1F0EC', color: '#57564F', border: '1px solid #E9E9E7' }}
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
            Về menu
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default TheoryKing;
