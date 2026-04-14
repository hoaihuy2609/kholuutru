import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowLeft, Trophy, Crown, CheckCircle2, XCircle,
  Star, Flame, RotateCcw, ChevronRight, Medal, Zap, BookOpen, Lock,
  GraduationCap, Dumbbell, School, Gamepad2, Target, Clock, Award, TrendingUp, Sparkles, Info
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

interface TopicEntry {
  topic: string;
  grade: number;
}

interface TheoryKingProps {
  onBack: () => void;
  studentGrade?: number | null;
  workerUrl?: string;
}

interface WeeklyRecord {
  week: string;
  score: number;
  correct: number;
  total: number;
  grade: string;
  completedAt: number;
  examGrade?: number;
}

type GameMode = 'practice' | 'exam';
type GameState = 'hub' | 'mode_practice' | 'mode_exam' | 'loading' | 'playing' | 'review' | 'finished';

// ── Constants ──────────────────────────────────────────────────────
const MAX_EXAM_QUESTIONS = 40;
const STREAK_THRESHOLD = 5;
const BASE_POINT = 15;
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

const GRADE_CONFIG: Record<string, { color: string; bg: string; border: string; label: string; icon: React.ElementType }> = {
  S: { color: '#B45309', bg: '#FFFBEB', border: '#F59E0B', label: 'Xuất sắc', icon: Crown },
  A: { color: '#166534', bg: '#F0FDF4', border: '#448361', label: 'Giỏi', icon: Medal },
  B: { color: '#3B4FA0', bg: '#EEF0FB', border: '#6B7CDB', label: 'Khá', icon: Award },
  C: { color: '#92400E', bg: '#FFF7ED', border: '#D9730D', label: 'Trung bình', icon: Star },
  D: { color: '#9F1239', bg: '#FFF1F2', border: '#E03E3E', label: 'Cần cố gắng', icon: TrendingUp },
};

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

  // ── Core state ─────────────────────────────────────────────────
  const [gameState, setGameState] = useState<GameState>('hub');
  const [gameMode, setGameMode] = useState<GameMode>('exam');
  const [questions, setQuestions] = useState<GameQuestion[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState<AnsweredQ[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answerResult, setAnswerResult] = useState<'correct' | 'wrong' | null>(null);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [score, setScore] = useState(0);
  const [storage, setStorage] = useState(loadStorage);

  // ── Practice/Exam selection state ──────────────────────────────
  const [topics, setTopics] = useState<TopicEntry[]>([]);
  const [selectedPracticeGrade, setSelectedPracticeGrade] = useState<number>(studentGrade || 12);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [selectedExamGrade, setSelectedExamGrade] = useState<number>(studentGrade || 12);
  const [loadingTopics, setLoadingTopics] = useState(false);

  const answerLock = useRef(false);
  const scoreRef = useRef(0);
  const answersRef = useRef<AnsweredQ[]>([]);

  const weekDone = storage.weekDone === thisWeek;
  const thisWeekRecord = storage.history.find(h => h.week === thisWeek) ?? null;

  // ── Fetch topics for practice mode ────────────────────────────
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

  // ── Start game ────────────────────────────────────────────────
  const startGame = useCallback(async (mode: GameMode, grade: number, topic?: string) => {
    setGameMode(mode);
    setGameState('loading');
    let pool: GameQuestion[] = [];
    if (workerUrl) {
      try {
        let url = '';
        if (mode === 'practice') {
          // Luyện tập: lấy tất cả câu của chương, không shuffle
          const topicParam = topic ? `&topic=${encodeURIComponent(topic)}` : '';
          url = `${workerUrl}/game/questions?grade=${grade}&limit=500${topicParam}&shuffle=false`;
        } else {
          // Thi: bốc ngẫu nhiên 40 câu theo khối
          url = `${workerUrl}/game/questions?grade=${grade}&limit=500&shuffle=true`;
        }
        const res = await fetch(url, {
          headers: { Referer: window.location.origin },
        });
        if (res.ok) {
          const data: GameQuestion[] = await res.json();
          if (data && data.length > 0) pool = data;
        }
      } catch { /* fall through */ }
    }

    if (pool.length === 0) {
      alert('Chưa có câu hỏi nào. Vui lòng thêm câu hỏi qua Admin Panel.');
      setGameState(mode === 'practice' ? 'mode_practice' : 'mode_exam');
      return;
    }

    // Exam: shuffle và lấy tối đa MAX_EXAM_QUESTIONS câu
    // Practice: giữ thứ tự gốc, lấy tất cả
    const selected = mode === 'exam'
      ? shuffle(pool).slice(0, MAX_EXAM_QUESTIONS)
      : pool;

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
  }, [workerUrl]);

  // ── Handle answer ─────────────────────────────────────────────
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

  // ── Next / Finish ─────────────────────────────────────────────
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

  // ── Save on finish (exam mode only) ──────────────────────────
  useEffect(() => {
    if (gameState !== 'finished' || gameMode !== 'exam') return;
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
      examGrade: selectedExamGrade,
    };
    const curStorage = loadStorage();
    const newHistory = [record, ...curStorage.history.filter(h => h.week !== thisWeek)].slice(0, 10);
    const newStorage = { history: newHistory, weekDone: thisWeek };
    setStorage(newStorage);
    saveStorage(newStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState]);

  // ──────────────────────────────────────────────────────────────
  // HUB: chọn chế độ
  // ──────────────────────────────────────────────────────────────
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
            <div className="flex items-center gap-2">
              <Gamepad2 className="w-7 h-7" style={{ color: '#9065B0' }} />
              <h2 className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>Vua Lý Thuyết</h2>
            </div>
          </div>
        </div>

        {/* Mode selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Luyện tập */}
          <button
            onClick={() => {
              // Nếu học sinh có grade, dùng grade đó; admin thì dùng selectedPracticeGrade
              const gradeToFetch = studentGrade || selectedPracticeGrade;
              setSelectedPracticeGrade(gradeToFetch);
              setGameState('mode_practice');
              fetchTopics(gradeToFetch);
            }}
            className="group relative rounded-[20px] p-6 text-left transition-all hover:-translate-y-1 active:scale-[0.98] overflow-hidden"
            style={{ background: '#FFFFFF', border: '1px solid #E9E9E7', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}
          >
            <div className="absolute top-0 right-0 w-32 h-32 opacity-5 pointer-events-none transition-transform group-hover:scale-110" style={{ background: 'radial-gradient(circle, #6B7CDB 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} />
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 transition-transform group-hover:scale-105" style={{ background: 'linear-gradient(135deg, #EEF0FB, #DDE3F8)' }}>
              <Dumbbell className="w-7 h-7" style={{ color: '#6B7CDB' }} />
            </div>
            <h3 className="text-lg font-extrabold mb-1.5" style={{ color: '#1A1A1A' }}>Luyện tập</h3>
            <p className="text-xs leading-relaxed mb-6 block min-h-[36px]" style={{ color: '#787774' }}>
              Chọn chương cụ thể, ôn toàn bộ câu hỏi. Không giới hạn số lần, không tính điểm tuần.
            </p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-sm font-bold transition-colors" style={{ color: '#6B7CDB' }}>
                Bắt đầu <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          </button>

          {/* Thi */}
          <button
            onClick={() => setGameState('mode_exam')}
            className="group relative rounded-[20px] p-6 text-left transition-all hover:-translate-y-1 active:scale-[0.98] overflow-hidden"
            style={{ background: '#FFFFFF', border: '1px solid #E9E9E7', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}
          >
            <div className="absolute top-0 right-0 w-32 h-32 opacity-5 pointer-events-none transition-transform group-hover:scale-110" style={{ background: 'radial-gradient(circle, #9065B0 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} />
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 transition-transform group-hover:scale-105" style={{ background: 'linear-gradient(135deg, #F3ECF8, #E8D5F5)' }}>
              <Crown className="w-7 h-7" style={{ color: '#9065B0' }} />
            </div>
            <h3 className="text-lg font-extrabold mb-1.5 flex items-center gap-2" style={{ color: '#1A1A1A' }}>
              Thi tuần
              {weekDone && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#F3ECF8', color: '#9065B0' }}>ĐÃ THI</span>}
            </h3>
            <p className="text-xs leading-relaxed mb-6 block min-h-[36px]" style={{ color: '#787774' }}>
              Bốc ngẫu nhiên {MAX_EXAM_QUESTIONS} câu. Mỗi tuần chỉ thi một lần, để xếp hạng.
            </p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-sm font-bold transition-colors" style={{ color: '#9065B0' }}>
                {weekDone ? 'Xem kết quả' : 'Vào thi ngay'} <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          </button>
        </div>

        {/* All-time stats */}
        {storage.history.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Tổng điểm thi', value: allTimeScore, color: '#9065B0', bg: '#F3ECF8', icon: <Star className="w-4 h-4" /> },
              { label: 'Tuần đã thi', value: storage.history.length, color: '#6B7CDB', bg: '#EEF0FB', icon: <Trophy className="w-4 h-4" /> },
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
              <span className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>Lịch sử thi</span>
            </div>
            <div className="divide-y" style={{ borderColor: '#E9E9E7' }}>
              {pastWeeks.map((rec) => {
                const cfg = GRADE_CONFIG[rec.grade] ?? GRADE_CONFIG['D'];
                return (
                  <div key={rec.week} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: cfg.bg }}>
                      <cfg.icon className="w-5 h-5" style={{ color: cfg.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium" style={{ color: '#57564F' }}>
                        Tuần {rec.week.split('-W')[1]} · {rec.examGrade ? `Khối ${rec.examGrade}` : 'Tổng'} · {new Date(rec.completedAt).toLocaleDateString('vi-VN')}
                      </p>
                      <p className="text-[11px]" style={{ color: '#AEACA8' }}>{rec.correct}/{rec.total} đúng</p>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-black" style={{ color: cfg.color }}>{rec.score}</div>
                      <div className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: cfg.bg, color: cfg.color }}>
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

  // ──────────────────────────────────────────────────────────────
  // PRACTICE MODE SELECTION: chọn khối + chương
  // ──────────────────────────────────────────────────────────────
  if (gameState === 'mode_practice') {
    const filteredTopics = topics.filter(t => t.grade === selectedPracticeGrade || t.grade === 0);
    const gradeColor = (g: number) => g === 12 ? '#9065B0' : g === 11 ? '#6B7CDB' : g === 10 ? '#448361' : '#787774';
    const gradeBg = (g: number) => g === 12 ? '#F3ECF8' : g === 11 ? '#EEF0FB' : g === 10 ? '#EAF3EE' : '#F1F0EC';

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
          <div>
            <div className="flex items-center gap-2">
              <Dumbbell className="w-6 h-6" style={{ color: '#6B7CDB' }} />
              <h2 className="text-xl font-bold" style={{ color: '#1A1A1A' }}>Luyện tập</h2>
            </div>
            <p className="text-xs mt-1" style={{ color: '#787774' }}>Chọn khối và chương cần ôn</p>
          </div>
        </div>

        {/* Grade filter */}
        <div>
          {/* Students only see their own grade; admins see all 3 */}
          {!studentGrade && (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#AEACA8' }}>Chọn khối</p>
              <div className="flex gap-2 flex-wrap">
                {([10, 11, 12] as const).map(g => (
                  <button
                    key={g}
                    onClick={() => {
                      setSelectedPracticeGrade(g);
                      setSelectedTopic(null);
                      fetchTopics(g);
                    }}
                    className="px-4 py-2 text-xs font-bold rounded-xl transition-all active:scale-[0.98]"
                    style={{
                      background: selectedPracticeGrade === g ? gradeColor(g) : '#F7F6F3',
                      color: selectedPracticeGrade === g ? '#FFFFFF' : '#787774',
                      border: `1px solid ${selectedPracticeGrade === g ? gradeColor(g) : '#E9E9E7'}`,
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
              <p className="text-xs mt-1" style={{ color: '#AEACA8' }}>Thêm câu hỏi kèm tên chương qua Admin Panel.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTopics.map((t) => (
                <button
                  key={t.topic}
                  onClick={() => startGame('practice', selectedPracticeGrade, t.topic)}
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
  // EXAM MODE SELECTION: chọn khối rồi thi
  // ──────────────────────────────────────────────────────────────
  if (gameState === 'mode_exam') {
    const gradeColor = (g: number) => g === 12 ? '#9065B0' : g === 11 ? '#6B7CDB' : g === 10 ? '#448361' : '#787774';
    const gradeBg = (g: number) => g === 12 ? '#F3ECF8' : g === 11 ? '#EEF0FB' : g === 10 ? '#EAF3EE' : '#F1F0EC';

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
          <div>
            <div className="flex items-center gap-2">
              <Crown className="w-6 h-6" style={{ color: '#9065B0' }} />
              <h2 className="text-xl font-bold" style={{ color: '#1A1A1A' }}>Thi tuần</h2>
            </div>
            <p className="text-xs mt-1" style={{ color: '#787774' }}>Bốc {MAX_EXAM_QUESTIONS} câu ngẫu nhiên theo khối</p>
          </div>
        </div>

        {/* If already done this week */}
        {weekDone && thisWeekRecord ? (
          <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E9E9E7', boxShadow: '0 8px 32px rgba(144, 101, 176, 0.08)' }}>
            <div className="h-1.5" style={{ background: 'linear-gradient(90deg, #9065B0, #6B7CDB)' }} />
            <div className="p-8 text-center flex flex-col items-center">
              <div className="flex justify-center mb-5">
                <div className="w-24 h-24 rounded-full flex items-center justify-center relative" style={{ background: GRADE_CONFIG[thisWeekRecord.grade]?.bg ?? '#F3ECF8', boxShadow: `0 0 50px ${GRADE_CONFIG[thisWeekRecord.grade]?.color ?? '#9065B0'}33` }}>
                  <div className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ background: GRADE_CONFIG[thisWeekRecord.grade]?.color ?? '#9065B0' }}></div>
                  {(() => {
                    const RecordIcon = GRADE_CONFIG[thisWeekRecord.grade]?.icon ?? Trophy;
                    return <RecordIcon className="w-12 h-12 relative z-10" style={{ color: GRADE_CONFIG[thisWeekRecord.grade]?.color ?? '#9065B0' }} />;
                  })()}
                </div>
              </div>
              <h3 className="text-2xl font-black mb-1" style={{ color: '#1A1A1A' }}>Tuyệt vời</h3>
              <p className="text-sm font-medium mb-6" style={{ color: '#787774' }}>Bạn đã hoàn thành bài thi tuần này!</p>
              
              <div className="inline-block px-10 py-5 rounded-[24px] mb-8 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #F3ECF8, #FFFFFF)', border: '1px solid #9065B033' }}>
                <div className="text-sm font-bold mb-1 tracking-wider uppercase" style={{ color: '#9065B0' }}>Điểm số</div>
                <div className="text-6xl font-black" style={{ color: '#9065B0', textShadow: '0 4px 16px rgba(144, 101, 176, 0.25)' }}>{thisWeekRecord.score}</div>
              </div>
              <div className="flex justify-center items-center gap-4 text-xs font-semibold mb-8" style={{ color: '#57564F' }}>
                <span className="px-4 py-2 rounded-xl" style={{ background: '#F7F6F3' }}>{thisWeekRecord.correct}/{thisWeekRecord.total} đúng</span>
                <span className="px-4 py-2 rounded-xl" style={{ background: GRADE_CONFIG[thisWeekRecord.grade]?.bg ?? '#F7F6F3', color: GRADE_CONFIG[thisWeekRecord.grade]?.color ?? '#57564F' }}>Hạng {GRADE_CONFIG[thisWeekRecord.grade]?.label}</span>
              </div>

              <div className="flex items-center justify-center gap-2 p-3 rounded-xl mb-6 w-full max-w-sm" style={{ background: '#FFFBEB', border: '1px solid #F59E0B33' }}>
                <Clock className="w-4 h-4" style={{ color: '#D97706' }} />
                <span className="text-xs font-bold" style={{ color: '#D97706' }}>Vòng mới sẽ mở vào thứ Hai tuần sau</span>
              </div>
              <button
                onClick={() => setGameState('review')}
                className="w-full max-w-sm flex items-center justify-center gap-2 py-4 rounded-xl text-sm font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #9065B0, #6B7CDB)', boxShadow: '0 8px 24px rgba(144, 101, 176, 0.3)' }}
              >
                <BookOpen className="w-5 h-5" />
                Xem lại đáp án
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Grade selection */}
            <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E9E9E7' }}>
              <div className="px-4 py-3" style={{ borderBottom: '1px solid #E9E9E7', background: '#FAFAF9' }}>
                <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>Chọn khối thi</p>
              </div>
              <div className="p-4 grid grid-cols-3 gap-3">
                {([10, 11, 12] as const).map(g => (
                  <button
                    key={g}
                    onClick={() => setSelectedExamGrade(g)}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl transition-all"
                    style={{
                      background: selectedExamGrade === g ? gradeBg(g) : '#F7F6F3',
                      border: `2px solid ${selectedExamGrade === g ? gradeColor(g) : '#E9E9E7'}`,
                    }}
                  >
                    <School className="w-6 h-6" style={{ color: selectedExamGrade === g ? gradeColor(g) : '#AEACA8' }} />
                    <span className="text-sm font-bold" style={{ color: selectedExamGrade === g ? gradeColor(g) : '#787774' }}>
                      Lớp {g}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Info */}
            {/* Info */}
            <div className="rounded-2xl p-5" style={{ background: '#FAFAF9', border: '1px solid #E9E9E7' }}>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { icon: <Target className="w-6 h-6" style={{ color: '#6B7CDB' }} />, label: `${MAX_EXAM_QUESTIONS} câu`, sub: 'Ngẫu nhiên' },
                  { icon: <Clock className="w-6 h-6" style={{ color: '#448361' }} />, label: 'Thoải mái', sub: 'Không tính giờ' },
                  { icon: <Flame className="w-6 h-6" style={{ color: '#F59E0B' }} />, label: 'Streak ×2', sub: '5 câu đúng' },
                ].map(r => (
                  <div key={r.label} className="text-center flex flex-col items-center">
                    <div className="w-10 h-10 mb-2 rounded-full flex items-center justify-center bg-white shadow-sm">{r.icon}</div>
                    <div className="text-xs font-bold" style={{ color: '#1A1A1A' }}>{r.label}</div>
                    <div className="text-[10px] mt-0.5" style={{ color: '#787774' }}>{r.sub}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Start button */}
            <button
              onClick={() => {
                if (!selectedExamGrade) { alert('Vui lòng chọn khối!'); return; }
                startGame('exam', selectedExamGrade);
              }}
              className="relative w-full overflow-hidden py-4 rounded-[16px] text-white font-bold text-base transition-all hover:scale-[1.02] active:scale-[0.98] group"
              style={{
                background: `linear-gradient(135deg, ${gradeColor(selectedExamGrade)}, #6B7CDB)`,
                boxShadow: `0 8px 24px ${gradeColor(selectedExamGrade)}66`,
              }}
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)', transform: 'skewX(-20deg) translateX(-150%)', animation: 'shimmer 2s infinite' }} />
              <div className="flex items-center justify-center gap-2">
                <Sparkles className="w-5 h-5" />
                Bắt đầu thi {selectedExamGrade > 0 ? `Lớp ${selectedExamGrade}` : ''}
              </div>
            </button>
          </>
        )}
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────
  // Loading
  // ──────────────────────────────────────────────────────────────
  if (gameState === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 animate-fade-in">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #F3ECF8, #E8D5F5)' }}>
          <Crown className="w-10 h-10" style={{ color: '#9065B0' }} />
        </div>
        <p className="text-base font-semibold" style={{ color: '#787774' }}>
          {gameMode === 'practice' ? 'Đang tải câu hỏi luyện tập...' : 'Đang bốc đề thi...'}
        </p>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────
  // Playing
  // ──────────────────────────────────────────────────────────────
  if (gameState === 'playing' && questions.length > 0) {
    const q = questions[qIndex];
    const isStreakActive = streak >= STREAK_THRESHOLD;
    const progress = (qIndex / questions.length) * 100;
    const modeColor = gameMode === 'exam' ? '#9065B0' : '#6B7CDB';

    return (
      <div className="animate-fade-in space-y-4 pb-10">
        {/* Mode badge */}
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase px-2.5 py-1 rounded" style={{ background: gameMode === 'exam' ? '#F3ECF8' : '#EEF0FB', color: modeColor }}>
            {gameMode === 'exam' ? <><Crown className="w-3.5 h-3.5" /> Thi tuần</> : <><Dumbbell className="w-3.5 h-3.5" /> Luyện tập</>}
          </span>
          {q.topic && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded" style={{ background: '#F7F6F3', color: '#787774' }}>
              {q.topic}
            </span>
          )}
        </div>

        {/* HUD */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="flex items-center justify-between text-xs mb-1" style={{ color: '#AEACA8' }}>
              <span>Câu {qIndex + 1} / {questions.length}</span>
              <span className="font-semibold" style={{ color: modeColor }}>{score} điểm</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: '#F1F0EC' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progress}%`, background: gameMode === 'exam' ? 'linear-gradient(90deg, #9065B0, #6B7CDB)' : 'linear-gradient(90deg, #6B7CDB, #448361)' }}
              />
            </div>
          </div>

          {/* Streak */}
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl shrink-0 transition-all"
            style={{ background: isStreakActive ? '#F3ECF8' : '#FFFFFF', border: `1px solid ${isStreakActive ? '#9065B0' : '#E9E9E7'}` }}
          >
            <Flame className="w-3.5 h-3.5" style={{ color: isStreakActive ? '#9065B0' : '#AEACA8' }} />
            <span className="text-sm font-bold" style={{ color: isStreakActive ? '#9065B0' : '#AEACA8' }}>{streak}</span>
            {isStreakActive && <Zap className="w-3 h-3" style={{ color: '#9065B0' }} />}
          </div>
        </div>

        {/* Question */}
        <div
          className="rounded-2xl p-6 transition-all"
          style={{
            background: '#FFFFFF',
            border: `2px solid ${answerResult === 'correct' ? '#44836144' : answerResult === 'wrong' ? '#E03E3E44' : `${modeColor}22`}`,
            boxShadow: answerResult === 'correct' ? '0 4px 20px rgba(68,131,97,0.12)' : answerResult === 'wrong' ? '0 4px 20px rgba(224,62,62,0.12)' : `0 2px 12px ${modeColor}14`,
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded" style={{ background: gameMode === 'exam' ? '#F3ECF8' : '#EEF0FB', color: modeColor }}>
              Câu {qIndex + 1}
            </span>
            {isStreakActive && (
              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded animate-pulse" style={{ background: '#FEF3C7', color: '#D97706' }}>
                <Flame className="w-3 h-3" /> STREAK ×2
              </span>
            )}
          </div>
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
                onMouseEnter={e => { if (!answerResult) (e.currentTarget as HTMLElement).style.borderColor = modeColor; }}
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

        {/* Next button */}
        {answerResult !== null && (
          <button
            onClick={handleNext}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold text-sm transition-all active:scale-95 animate-fade-in"
            style={{ background: `linear-gradient(135deg, ${modeColor}, #6B7CDB)`, boxShadow: `0 4px 16px ${modeColor}44` }}
          >
            {qIndex >= questions.length - 1 ? (
              <><Trophy className="w-4 h-4" />{gameMode === 'exam' ? 'Xem kết quả' : 'Hoàn thành'}</>
            ) : (
              <><ChevronRight className="w-4 h-4" />Câu tiếp theo</>
            )}
          </button>
        )}
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────
  // Review
  // ──────────────────────────────────────────────────────────────
  if (gameState === 'review') {
    const reviewData = answers.length > 0 ? answers : [];
    return (
      <div className="animate-fade-in space-y-5 pb-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setGameState(gameMode === 'exam' ? 'mode_exam' : 'hub')}
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
                <div key={i} className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${ans.correct ? '#44836122' : '#E03E3E22'}`, background: '#FFFFFF' }}>
                  <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: ans.correct ? '#EAF3EE' : '#FEF2F2' }}>
                    {ans.correct ? <CheckCircle2 className="w-4 h-4" style={{ color: '#448361' }} /> : <XCircle className="w-4 h-4" style={{ color: '#E03E3E' }} />}
                    <span className="text-xs font-semibold" style={{ color: ans.correct ? '#448361' : '#E03E3E' }}>
                      Câu {i + 1} · {ans.correct ? `+${ans.points} điểm` : 'Sai'}
                    </span>
                    {q.topic && <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#F3ECF8', color: '#9065B0' }}>{q.topic}</span>}
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
                            style={{ background: isCorrect ? '#EAF3EE' : isChosen && !isCorrect ? '#FEF2F2' : '#F7F6F3', border: isCorrect ? '1px solid #44836133' : isChosen && !isCorrect ? '1px solid #E03E3E22' : '1px solid transparent' }}
                          >
                            <span className="font-bold shrink-0" style={{ color: isCorrect ? '#448361' : isChosen && !isCorrect ? '#E03E3E' : '#AEACA8' }}>{letter}.</span>
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

  // ──────────────────────────────────────────────────────────────
  // Finished
  // ──────────────────────────────────────────────────────────────
  if (gameState === 'finished') {
    const correct = answers.filter(a => a.correct).length;
    const wrong = answers.filter(a => !a.correct).length;
    const accuracy = answers.length > 0 ? Math.round((correct / answers.length) * 100) : 0;
    const grade = calcGrade(score, answers.length);
    const cfg = GRADE_CONFIG[grade] ?? GRADE_CONFIG['D'];
    const modeColor = gameMode === 'exam' ? '#9065B0' : '#6B7CDB';

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
          <h2 className="text-2xl font-semibold" style={{ color: '#1A1A1A' }}>
            {gameMode === 'exam' ? 'Kết quả thi tuần' : 'Kết quả luyện tập'}
          </h2>
        </div>

        {/* Score card */}
        <div className="rounded-2xl overflow-hidden text-center" style={{ background: '#FFFFFF', border: '1px solid #E9E9E7' }}>
          <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${modeColor}, #6B7CDB)` }} />
          <div className="p-8">
            <div className="flex justify-center mb-5">
              <div className="w-24 h-24 rounded-full flex items-center justify-center relative shadow-sm" style={{ background: cfg.bg }}>
                 <cfg.icon className="w-12 h-12" style={{ color: cfg.color }} />
              </div>
            </div>
            <div
              className="inline-block px-4 py-1.5 rounded-full text-sm font-bold mb-4"
              style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}33` }}
            >
              Hạng {grade} · {cfg.label}
            </div>
            <div className="text-6xl font-black mb-1" style={{ color: '#1A1A1A' }}>{score}</div>
            <div className="text-sm mb-6" style={{ color: '#AEACA8' }}>điểm</div>

            <div className="grid grid-cols-3 gap-3 mb-5">
              {[
                { icon: <CheckCircle2 className="w-5 h-5 mx-auto" style={{ color: '#448361' }} />, label: 'Đúng', value: correct, color: '#448361', bg: '#EAF3EE' },
                { icon: <XCircle className="w-5 h-5 mx-auto" style={{ color: '#E03E3E' }} />, label: 'Sai', value: wrong, color: '#E03E3E', bg: '#FEF2F2' },
                { icon: <Target className="w-5 h-5 mx-auto" style={{ color: '#6B7CDB' }} />, label: 'Chính xác', value: accuracy + '%', color: '#6B7CDB', bg: '#EEF0FB' },
              ].map(s => (
                <div key={s.label} className="rounded-xl p-3" style={{ background: s.bg }}>
                  <div className="mb-2">{s.icon}</div>
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

            {gameMode === 'practice' && (
              <div className="mt-4 text-xs" style={{ color: '#AEACA8' }}>Chế độ luyện tập · Không tính vào kết quả tuần</div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => setGameState('review')}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all"
            style={{ background: `linear-gradient(135deg, ${modeColor}, #6B7CDB)`, color: '#fff', boxShadow: `0 4px 16px ${modeColor}44` }}
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
