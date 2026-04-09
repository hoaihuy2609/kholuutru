import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, Zap, CheckCircle2, XCircle, Clock, Trophy, RotateCcw, Flame, ChevronRight } from 'lucide-react';
import MathText from './MathText';

// ── Types ──────────────────────────────────────────────────────────
interface GameQuestion {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  answer: string; // 'A' | 'B' | 'C' | 'D'
  grade: number;
  topic?: string;
}

interface PhysicsBlitzProps {
  onBack: () => void;
  studentGrade?: number | null;
  workerUrl?: string;
}

type GameState = 'idle' | 'loading' | 'countdown' | 'playing' | 'finished';

const GAME_DURATION = 60; // seconds
const STREAK_THRESHOLD = 3; // streak to get x2 bonus

// ── Sample questions (fallback khi chưa có DB) ─────────────────────
const FALLBACK_QUESTIONS: GameQuestion[] = [
  { id: 'f1', question: 'Định luật nào của Newton phát biểu: "Lực tác dụng bằng tích của khối lượng và gia tốc"?', option_a: 'Định luật I Newton', option_b: 'Định luật II Newton', option_c: 'Định luật III Newton', option_d: 'Định luật vạn vật hấp dẫn', answer: 'B', grade: 0 },
  { id: 'f2', question: 'Đơn vị của lực trong hệ SI là gì?', option_a: 'kg', option_b: 'J', option_c: 'N', option_d: 'Pa', answer: 'C', grade: 0 },
  { id: 'f3', question: 'Tốc độ ánh sáng trong chân không xấp xỉ bao nhiêu?', option_a: '3×10⁵ km/s', option_b: '3×10⁸ m/s', option_c: '3×10⁶ m/s', option_d: 'A và B đều đúng', answer: 'D', grade: 0 },
  { id: 'f4', question: 'Trong chuyển động tròn đều, gia tốc hướng về phía nào?', option_a: 'Tiếp tuyến với quỹ đạo', option_b: 'Hướng ra ngoài tâm', option_c: 'Hướng vào tâm', option_d: 'Dọc theo trục quay', answer: 'C', grade: 0 },
  { id: 'f5', question: 'Hiện tượng quang điện xảy ra khi ánh sáng chiếu vào kim loại có tần số như thế nào?', option_a: 'Bất kỳ tần số nào', option_b: 'Nhỏ hơn tần số giới hạn', option_c: 'Lớn hơn hoặc bằng tần số giới hạn', option_d: 'Bằng đúng tần số giới hạn', answer: 'C', grade: 0 },
  { id: 'f6', question: 'Công thức tính động năng của một vật là gì?', option_a: 'Wđ = mgh', option_b: 'Wđ = ½mv²', option_c: 'Wđ = mv', option_d: 'Wđ = F·d', answer: 'B', grade: 0 },
  { id: 'f7', question: 'Nguyên lý bảo toàn năng lượng phát biểu điều gì?', option_a: 'Năng lượng luôn tăng dần', option_b: 'Năng lượng không thể biến đổi dạng', option_c: 'Năng lượng không tự sinh ra và không tự mất đi', option_d: 'Năng lượng luôn bằng nhau ở mọi điểm', answer: 'C', grade: 0 },
  { id: 'f8', question: 'Điện trở của một dây dẫn phụ thuộc vào yếu tố nào?', option_a: 'Chỉ vật liệu làm dây', option_b: 'Chỉ chiều dài dây', option_c: 'Vật liệu, chiều dài và tiết diện', option_d: 'Nhiệt độ và hiệu điện thế', answer: 'C', grade: 0 },
  { id: 'f9', question: 'Sóng ngang là sóng có phương dao động như thế nào?', option_a: 'Song song với phương truyền sóng', option_b: 'Vuông góc với phương truyền sóng', option_c: 'Tạo góc 45° với phương truyền sóng', option_d: 'Ngẫu nhiên', answer: 'B', grade: 0 },
  { id: 'f10', question: 'Hạt nhân nguyên tử gồm những hạt nào?', option_a: 'Proton và electron', option_b: 'Neutron và electron', option_c: 'Proton và neutron', option_d: 'Proton, neutron và electron', answer: 'C', grade: 0 },
];

const OPTIONS: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D'];

// ── Shuffle array ──────────────────────────────────────────────────
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Main Component ─────────────────────────────────────────────────
const PhysicsBlitz: React.FC<PhysicsBlitzProps> = ({ onBack, studentGrade, workerUrl }) => {
  const [gameState, setGameState] = useState<GameState>('idle');
  const [questions, setQuestions] = useState<GameQuestion[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [countdown, setCountdown] = useState(3);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answerResult, setAnswerResult] = useState<'correct' | 'wrong' | null>(null);
  const [highScore, setHighScore] = useState(() => parseInt(localStorage.getItem('pv_blitz_highscore') || '0', 10));
  const [isNewHighScore, setIsNewHighScore] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const answerLockRef = useRef(false);

  // ── Load questions ─────────────────────────────────────────────
  const loadQuestions = useCallback(async (): Promise<GameQuestion[]> => {
    if (!workerUrl) return shuffle(FALLBACK_QUESTIONS);
    try {
      const grade = studentGrade || 0;
      const res = await fetch(`${workerUrl}/game/questions?grade=${grade}&limit=50`, {
        headers: { 'Referer': window.location.origin },
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data: GameQuestion[] = await res.json();
      if (!data || data.length === 0) return shuffle(FALLBACK_QUESTIONS);
      return shuffle(data);
    } catch {
      return shuffle(FALLBACK_QUESTIONS);
    }
  }, [workerUrl, studentGrade]);

  // ── Start Game ─────────────────────────────────────────────────
  const startGame = useCallback(async () => {
    setGameState('loading');
    const qs = await loadQuestions();
    // Loop questions if not enough
    const looped: GameQuestion[] = [];
    while (looped.length < 99) looped.push(...qs);
    setQuestions(looped);
    setQIndex(0);
    setScore(0);
    setStreak(0);
    setMaxStreak(0);
    setCorrectCount(0);
    setWrongCount(0);
    setSelectedAnswer(null);
    setAnswerResult(null);
    setTimeLeft(GAME_DURATION);
    setIsNewHighScore(false);
    answerLockRef.current = false;

    // Countdown 3..2..1
    setCountdown(3);
    setGameState('countdown');
  }, [loadQuestions]);

  // ── Countdown ──────────────────────────────────────────────────
  useEffect(() => {
    if (gameState !== 'countdown') return;
    if (countdown <= 0) {
      setGameState('playing');
      return;
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [gameState, countdown]);

  // ── Game Timer ─────────────────────────────────────────────────
  useEffect(() => {
    if (gameState !== 'playing') return;
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          setGameState('finished');
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [gameState]);

  // ── Save high score on finish ──────────────────────────────────
  useEffect(() => {
    if (gameState !== 'finished') return;
    if (score > highScore) {
      setHighScore(score);
      setIsNewHighScore(true);
      localStorage.setItem('pv_blitz_highscore', String(score));
    }
  }, [gameState, score, highScore]);

  // ── Answer ─────────────────────────────────────────────────────
  const handleAnswer = useCallback((letter: string) => {
    if (gameState !== 'playing' || answerLockRef.current) return;
    answerLockRef.current = true;
    setSelectedAnswer(letter);

    const q = questions[qIndex];
    const isCorrect = letter === q.answer;

    if (isCorrect) {
      const newStreak = streak + 1;
      setStreak(newStreak);
      setMaxStreak(ms => Math.max(ms, newStreak));
      const multiplier = newStreak >= STREAK_THRESHOLD ? 2 : 1;
      setScore(s => s + 10 * multiplier);
      setCorrectCount(c => c + 1);
      setAnswerResult('correct');
    } else {
      setStreak(0);
      setWrongCount(w => w + 1);
      setAnswerResult('wrong');
    }

    // Next question after short delay
    setTimeout(() => {
      setQIndex(i => i + 1);
      setSelectedAnswer(null);
      setAnswerResult(null);
      answerLockRef.current = false;
    }, 600);
  }, [gameState, questions, qIndex, streak]);

  // ── UI Helpers ─────────────────────────────────────────────────
  const timerColor = timeLeft > 20 ? '#448361' : timeLeft > 10 ? '#D9730D' : '#E03E3E';
  const timerPct = (timeLeft / GAME_DURATION) * 100;

  const optionText = (q: GameQuestion, letter: 'A' | 'B' | 'C' | 'D') => {
    if (letter === 'A') return q.option_a;
    if (letter === 'B') return q.option_b;
    if (letter === 'C') return q.option_c;
    return q.option_d;
  };

  // ── IDLE screen ────────────────────────────────────────────────
  if (gameState === 'idle') {
    return (
      <div className="animate-fade-in space-y-6 pb-10">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-lg transition-colors" style={{ background: '#F1F0EC', border: '1px solid #E9E9E7', color: '#57564F' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#E9E9E7'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#F1F0EC'}>
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <span className="inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded mb-1" style={{ background: '#FFFBEB', color: '#F59E0B' }}>
              Game · Physics Blitz
            </span>
            <h2 className="text-2xl font-semibold" style={{ color: '#1A1A1A' }}>⚡ Physics Blitz</h2>
          </div>
        </div>

        <div className="rounded-2xl overflow-hidden" style={{ border: '2px solid #F59E0B33', background: '#FFFFFF' }}>
          <div className="h-1.5" style={{ background: 'linear-gradient(90deg, #F59E0B, #EF4444)' }} />
          <div className="p-8 text-center">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5"
              style={{ background: 'linear-gradient(135deg, #FEF3C7, #FDE68A)' }}>
              <Zap className="w-10 h-10" style={{ color: '#F59E0B' }} />
            </div>
            <h3 className="text-xl font-semibold mb-2" style={{ color: '#1A1A1A' }}>Sẵn sàng chưa?</h3>
            <p className="text-sm leading-relaxed mb-6 max-w-sm mx-auto" style={{ color: '#787774' }}>
              Trả lời các câu hỏi lý thuyết vật lý trong <strong>60 giây</strong>.
              Liên tiếp đúng 3 câu sẽ nhận <strong>điểm x2</strong>!
            </p>

            {/* Rules */}
            <div className="grid grid-cols-3 gap-3 mb-8 text-sm">
              {[
                { icon: '⏱️', label: '60 giây', sub: 'Thời gian chơi' },
                { icon: '🎯', label: '+10 điểm', sub: 'Mỗi câu đúng' },
                { icon: '🔥', label: 'Streak ×2', sub: '3 câu đúng liên tiếp' },
              ].map(r => (
                <div key={r.label} className="rounded-xl p-3" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
                  <div className="text-2xl mb-1">{r.icon}</div>
                  <div className="font-semibold text-xs" style={{ color: '#92400E' }}>{r.label}</div>
                  <div className="text-[10px]" style={{ color: '#B45309' }}>{r.sub}</div>
                </div>
              ))}
            </div>

            {highScore > 0 && (
              <div className="flex items-center justify-center gap-2 mb-5 text-sm" style={{ color: '#787774' }}>
                <Trophy className="w-4 h-4" style={{ color: '#F59E0B' }} />
                Kỷ lục của bạn: <strong style={{ color: '#F59E0B' }}>{highScore} điểm</strong>
              </div>
            )}

            <button
              onClick={startGame}
              className="px-10 py-3.5 rounded-2xl text-white font-bold text-base transition-all active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #F59E0B, #EF4444)',
                boxShadow: '0 8px 24px rgba(245,158,11,0.4)',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.9'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
            >
              ⚡ Bắt đầu
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── LOADING / COUNTDOWN screen ─────────────────────────────────
  if (gameState === 'loading' || gameState === 'countdown') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 animate-fade-in">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #FEF3C7, #FDE68A)' }}>
          <Zap className="w-10 h-10" style={{ color: '#F59E0B' }} />
        </div>
        {gameState === 'loading'
          ? <p className="text-lg font-semibold" style={{ color: '#787774' }}>Đang tải câu hỏi...</p>
          : (
            <div className="text-center">
              <p className="text-sm mb-3 font-medium" style={{ color: '#AEACA8' }}>Chuẩn bị...</p>
              <div
                className="text-8xl font-black transition-all"
                style={{ color: '#F59E0B', textShadow: '0 4px 24px rgba(245,158,11,0.4)' }}
              >
                {countdown === 0 ? '⚡' : countdown}
              </div>
            </div>
          )}
      </div>
    );
  }

  // ── PLAYING screen ─────────────────────────────────────────────
  if (gameState === 'playing' && questions.length > 0) {
    const q = questions[qIndex];
    const isStreakActive = streak >= STREAK_THRESHOLD;

    return (
      <div className="animate-fade-in space-y-4 pb-10">
        {/* HUD */}
        <div className="flex items-center justify-between gap-3">
          {/* Score */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl" style={{ background: '#FFFFFF', border: '1px solid #E9E9E7' }}>
            <Zap className="w-4 h-4" style={{ color: '#F59E0B' }} />
            <span className="text-lg font-black" style={{ color: '#1A1A1A' }}>{score}</span>
            <span className="text-xs" style={{ color: '#AEACA8' }}>điểm</span>
          </div>

          {/* Timer */}
          <div className="flex flex-col items-center flex-1 mx-2">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock className="w-3.5 h-3.5" style={{ color: timerColor }} />
              <span className="text-2xl font-black transition-colors" style={{ color: timerColor }}>{timeLeft}</span>
              <span className="text-xs" style={{ color: '#AEACA8' }}>giây</span>
            </div>
            {/* Timer bar */}
            <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: '#F1F0EC' }}>
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{ width: `${timerPct}%`, background: timerColor }}
              />
            </div>
          </div>

          {/* Streak */}
          <div
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all"
            style={{
              background: isStreakActive ? '#FEF3C7' : '#FFFFFF',
              border: `1px solid ${isStreakActive ? '#F59E0B' : '#E9E9E7'}`,
            }}
          >
            <Flame className="w-4 h-4" style={{ color: isStreakActive ? '#F59E0B' : '#AEACA8' }} />
            <span className="text-sm font-bold" style={{ color: isStreakActive ? '#D97706' : '#AEACA8' }}>
              {streak}
            </span>
            {isStreakActive && (
              <span className="text-[10px] font-bold" style={{ color: '#D97706' }}>×2</span>
            )}
          </div>
        </div>

        {/* Question Card */}
        <div
          className="rounded-2xl p-6 transition-all"
          style={{
            background: '#FFFFFF',
            border: `2px solid ${answerResult === 'correct' ? '#44836144' : answerResult === 'wrong' ? '#E03E3E44' : '#E9E9E7'}`,
            boxShadow: answerResult === 'correct' ? '0 4px 20px rgba(68,131,97,0.15)' : answerResult === 'wrong' ? '0 4px 20px rgba(224,62,62,0.15)' : 'none',
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded" style={{ background: '#FFFBEB', color: '#D97706' }}>
              Câu {qIndex + 1}
            </span>
            {isStreakActive && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded animate-pulse" style={{ background: '#FEF3C7', color: '#D97706' }}>
                🔥 STREAK ×2
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
                  if (!answerResult) (e.currentTarget as HTMLElement).style.borderColor = '#F59E0B';
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
      </div>
    );
  }

  // ── FINISHED screen ────────────────────────────────────────────
  if (gameState === 'finished') {
    const accuracy = correctCount + wrongCount > 0
      ? Math.round((correctCount / (correctCount + wrongCount)) * 100)
      : 0;

    const grade = score >= 150 ? 'S' : score >= 100 ? 'A' : score >= 60 ? 'B' : score >= 30 ? 'C' : 'D';
    const gradeColor = grade === 'S' ? '#F59E0B' : grade === 'A' ? '#448361' : grade === 'B' ? '#6B7CDB' : grade === 'C' ? '#D9730D' : '#E03E3E';
    const gradeBg = grade === 'S' ? '#FFFBEB' : grade === 'A' ? '#EAF3EE' : grade === 'B' ? '#EEF0FB' : grade === 'C' ? '#FFF3E8' : '#FEF2F2';

    return (
      <div className="animate-fade-in space-y-5 pb-10">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-lg transition-colors" style={{ background: '#F1F0EC', border: '1px solid #E9E9E7', color: '#57564F' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#E9E9E7'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#F1F0EC'}>
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h2 className="text-2xl font-semibold" style={{ color: '#1A1A1A' }}>Kết quả</h2>
        </div>

        {/* Score Card */}
        <div className="rounded-2xl overflow-hidden text-center" style={{ background: '#FFFFFF', border: '1px solid #E9E9E7' }}>
          <div className="h-1.5" style={{ background: 'linear-gradient(90deg, #F59E0B, #EF4444)' }} />
          <div className="p-8">
            {isNewHighScore && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-4 animate-pulse"
                style={{ background: '#FFFBEB', color: '#D97706', border: '1px solid #FDE68A' }}>
                🏆 KỶ LỤC MỚI!
              </div>
            )}

            {/* Grade */}
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: gradeBg, border: `2px solid ${gradeColor}33` }}>
              <span className="text-4xl font-black" style={{ color: gradeColor }}>{grade}</span>
            </div>

            <div className="text-5xl font-black mb-1" style={{ color: '#1A1A1A' }}>{score}</div>
            <div className="text-sm mb-6" style={{ color: '#AEACA8' }}>điểm</div>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { icon: '✅', label: 'Đúng', value: correctCount, color: '#448361', bg: '#EAF3EE' },
                { icon: '❌', label: 'Sai', value: wrongCount, color: '#E03E3E', bg: '#FEF2F2' },
                { icon: '🎯', label: 'Chính xác', value: accuracy + '%', color: '#6B7CDB', bg: '#EEF0FB' },
              ].map(s => (
                <div key={s.label} className="rounded-xl p-3" style={{ background: s.bg }}>
                  <div className="text-xl mb-0.5">{s.icon}</div>
                  <div className="text-lg font-black" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-[10px]" style={{ color: '#AEACA8' }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Streak info */}
            {maxStreak > 0 && (
              <div className="flex items-center justify-center gap-2 mb-6 text-sm" style={{ color: '#787774' }}>
                <Flame className="w-4 h-4" style={{ color: '#F59E0B' }} />
                Streak dài nhất: <strong style={{ color: '#D97706' }}>{maxStreak} câu liên tiếp</strong>
              </div>
            )}

            {/* High score */}
            <div className="flex items-center justify-center gap-2 text-sm" style={{ color: '#787774' }}>
              <Trophy className="w-4 h-4" style={{ color: '#F59E0B' }} />
              Kỷ lục: <strong style={{ color: '#F59E0B' }}>{highScore} điểm</strong>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={startGame}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-white font-bold text-sm transition-all active:scale-95"
            style={{ background: 'linear-gradient(135deg, #F59E0B, #EF4444)', boxShadow: '0 4px 16px rgba(245,158,11,0.35)' }}
          >
            <RotateCcw className="w-4 h-4" />
            Chơi lại
          </button>
          <button
            onClick={onBack}
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

export default PhysicsBlitz;
