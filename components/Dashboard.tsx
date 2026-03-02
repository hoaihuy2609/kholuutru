import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GradeLevel } from '../types';
import { CURRICULUM } from '../constants';
import { FileText, Folder, Quote, Atom, Zap, Activity, Trophy, ChevronLeft, ChevronRight, Medal } from 'lucide-react';
import CountdownTimer from './CountdownTimer';

interface LeaderEntry {
  name: string;
  phone: string;
  avgScore: number;
  examCount: number;
}

interface DashboardProps {
  onSelectGrade: (grade: GradeLevel) => void;
  fileCounts: Record<string, number>;
  isAdmin: boolean;
  onLoadLeaderboard: () => Promise<LeaderEntry[][]>;
}

const EinsteinQuotes = [
  "Logic đưa ta từ A đến B, trí tưởng tượng đưa ta đến mọi nơi.",
  "Học từ hôm qua, sống cho hôm nay, hy vọng cho ngày mai.",
  "Thư viện là kho tàng tàng trữ mọi giá trị tinh thần của loài người.",
  "Vật lý không chỉ là các phương trình, nó là cách ta nhìn thế giới.",
  "Cuộc đời giống như lái một chiếc xe đạp. Để giữ thăng bằng, bạn phải tiếp tục di chuyển."
];

const gradeConfig: Record<string, { icon: React.ElementType; dot: string; label: string }> = {
  [GradeLevel.Grade12]: { icon: Atom, dot: '#9065B0', label: 'Lớp 12' },
  [GradeLevel.Grade11]: { icon: Zap, dot: '#6B7CDB', label: 'Lớp 11' },
  [GradeLevel.Grade10]: { icon: Activity, dot: '#448361', label: 'Lớp 10' },
};

// Slide config: mỗi slide tương ứng 1 khối lớp
const SLIDES = [
  { grade: 10, label: 'Lớp 10', color: '#448361', bg: '#EAF3EE', border: '#C5DECC', idx: 0 },
  { grade: 11, label: 'Lớp 11', color: '#6B7CDB', bg: '#EEF0FB', border: '#C5CBEF', idx: 1 },
  { grade: 12, label: 'Lớp 12', color: '#9065B0', bg: '#F3ECF8', border: '#D8BFE8', idx: 2 },
];

const RANK_MEDAL = [
  { icon: '🥇', color: '#D4A017', bg: '#FFFBEB', border: '#FDE68A' },
  { icon: '🥈', color: '#6B7280', bg: '#F9FAFB', border: '#D1D5DB' },
  { icon: '🥉', color: '#B45309', bg: '#FFF7ED', border: '#FED7AA' },
];

// Hàm che số điện thoại
const maskPhone = (phone: string) => {
  if (!phone || phone.length < 6) return phone;
  return phone.slice(0, 4) + '****' + phone.slice(-2);
};

interface LeaderboardSliderProps {
  onLoad: () => Promise<LeaderEntry[][]>;
}

const LeaderboardSlider: React.FC<LeaderboardSliderProps> = ({ onLoad }) => {
  const [data, setData] = useState<LeaderEntry[][]>([[], [], []]);
  const [slide, setSlide] = useState(0);
  const [loading, setLoading] = useState(true);
  const [animating, setAnimating] = useState(false);
  const [direction, setDirection] = useState<'left' | 'right'>('right');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    onLoad().then(res => {
      if (mounted) { setData(res || [[], [], []]); setLoading(false); }
    }).catch(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const goTo = useCallback((next: number, dir: 'left' | 'right') => {
    if (animating) return;
    setDirection(dir);
    setAnimating(true);
    setTimeout(() => {
      setSlide(next);
      setAnimating(false);
    }, 280);
  }, [animating]);

  const prev = () => {
    const next = (slide + 2) % 3;
    goTo(next, 'left');
    resetTimer();
  };

  const next = () => {
    const nextSlide = (slide + 1) % 3;
    goTo(nextSlide, 'right');
    resetTimer();
  };

  const resetTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setSlide(s => {
        const nextSlide = (s + 1) % 3;
        setDirection('right');
        setAnimating(true);
        setTimeout(() => setAnimating(false), 280);
        return nextSlide;
      });
    }, 5000);
  };

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setDirection('right');
      setAnimating(true);
      setTimeout(() => {
        setSlide(s => (s + 1) % 3);
        setAnimating(false);
      }, 280);
    }, 5000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const cfg = SLIDES[slide];
  const list = data[cfg.idx] || [];

  return (
    <div
      className="rounded-xl overflow-hidden flex flex-col"
      style={{
        border: '1px solid #E9E9E7',
        background: '#FFFFFF',
        minHeight: '240px',
        position: 'relative',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{
          background: cfg.bg,
          borderBottom: `1px solid ${cfg.border}`,
          borderLeft: `3px solid ${cfg.color}`,
        }}
      >
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4" style={{ color: cfg.color }} />
          <span className="text-sm font-semibold" style={{ color: cfg.color }}>
            Bảng Xếp Hạng
          </span>
        </div>
        {/* Dots + Arrows */}
        <div className="flex items-center gap-2">
          <button
            onClick={prev}
            className="w-6 h-6 rounded-md flex items-center justify-center transition-all"
            style={{ background: 'transparent', border: `1px solid ${cfg.border}`, color: cfg.color }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = cfg.border; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <div className="flex items-center gap-1">
            {SLIDES.map((s, i) => (
              <button
                key={i}
                onClick={() => { goTo(i, i > slide ? 'right' : 'left'); resetTimer(); }}
                className="rounded-full transition-all duration-300"
                style={{
                  width: i === slide ? '16px' : '6px',
                  height: '6px',
                  background: i === slide ? cfg.color : '#D8D8D4',
                }}
              />
            ))}
          </div>
          <button
            onClick={next}
            className="w-6 h-6 rounded-md flex items-center justify-center transition-all"
            style={{ background: 'transparent', border: `1px solid ${cfg.border}`, color: cfg.color }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = cfg.border; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Grade label badge */}
      <div className="px-4 pt-3 pb-0">
        <span
          className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
          style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
        >
          <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: cfg.color }} />
          {cfg.label}
        </span>
      </div>

      {/* Content area */}
      <div
        className="flex-1 px-4 py-3 overflow-hidden"
        style={{
          transition: animating ? 'opacity 0.28s ease, transform 0.28s ease' : 'none',
          opacity: animating ? 0 : 1,
          transform: animating
            ? `translateX(${direction === 'right' ? '-12px' : '12px'})`
            : 'translateX(0)',
        }}
      >
        {loading ? (
          <div className="flex flex-col gap-2.5">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-6 h-6 rounded-full" style={{ background: '#F1F0EC' }} />
                <div className="flex-1 h-3 rounded" style={{ background: '#F1F0EC' }} />
                <div className="w-10 h-3 rounded" style={{ background: '#F1F0EC' }} />
              </div>
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Medal className="w-7 h-7 mb-2" style={{ color: '#CFCFCB' }} />
            <p className="text-xs font-medium" style={{ color: '#AEACA8' }}>Chưa có dữ liệu</p>
            <p className="text-[11px] mt-0.5" style={{ color: '#CFCFCB' }}>
              Hoàn thành bài thi để lên bảng vàng!
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {list.map((entry, i) => {
              const medal = RANK_MEDAL[i];
              return (
                <div
                  key={entry.phone}
                  className="flex items-center gap-3 py-1.5 px-2.5 rounded-lg transition-colors"
                  style={{
                    background: i < 3 ? medal.bg : 'transparent',
                    border: i < 3 ? `1px solid ${medal.border}` : '1px solid transparent',
                  }}
                >
                  {/* Rank */}
                  {i < 3 ? (
                    <span className="text-base shrink-0 w-6 text-center">{medal.icon}</span>
                  ) : (
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                      style={{ background: '#F1F0EC', color: '#AEACA8' }}
                    >
                      {i + 1}
                    </span>
                  )}

                  {/* Name + phone */}
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-sm font-semibold truncate"
                      style={{ color: i < 3 ? medal.color : '#1A1A1A' }}
                    >
                      {entry.name}
                    </div>
                    <div className="text-[11px]" style={{ color: '#AEACA8' }}>
                      {maskPhone(entry.phone)} · {entry.examCount} bài
                    </div>
                  </div>

                  {/* Score */}
                  <div
                    className="text-sm font-bold tabular-nums shrink-0"
                    style={{ color: i < 3 ? medal.color : cfg.color }}
                  >
                    {entry.avgScore.toFixed(2)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ onSelectGrade, fileCounts, isAdmin, onLoadLeaderboard }) => {
  const [quote, setQuote] = useState('');

  useEffect(() => {
    setQuote(EinsteinQuotes[Math.floor(Math.random() * EinsteinQuotes.length)]);
  }, []);

  const totalFiles = Object.values(fileCounts).reduce((a: number, b: number) => a + b, 0);
  const totalChapters = CURRICULUM.reduce((acc, g) => acc + g.chapters.length, 0);

  return (
    <div className="space-y-8 animate-fade-in pb-10">

      {/* ── Hero Section ── */}
      <div>
        {/* Breadcrumb label */}
        <div className="flex items-center gap-2 mb-5">
          <span
            className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded"
            style={{ background: '#EEF0FB', color: '#6B7CDB' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#6B7CDB] inline-block" />
            Hệ thống quản lý thông minh
          </span>
        </div>

        <div className="grid md:grid-cols-2 gap-8 items-start">
          {/* Left: Title + info */}
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold mb-1" style={{ color: '#1A1A1A', lineHeight: 1.3 }}>
              Chào mừng đến với
            </h1>
            <h1 className="text-2xl md:text-3xl font-semibold mb-4 md:mb-5" style={{ color: '#6B7CDB', lineHeight: 1.3 }}>
              PhysiVault
            </h1>

            {/* Quote box */}
            <div
              className="flex gap-2.5 p-3 md:p-4 rounded-lg mb-4 md:mb-6"
              style={{ background: '#F7F6F3', borderLeft: '3px solid #CFCFCB' }}
            >
              <Quote className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0 mt-0.5" style={{ color: '#AEACA8' }} />
              <p className="text-xs md:text-sm italic leading-relaxed" style={{ color: '#787774' }}>
                {quote}
              </p>
            </div>

            {/* Attribution */}
            <div className="space-y-2 mb-6">
              <div
                className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg"
                style={{ background: '#F1F0EC', border: '1px solid #E9E9E7' }}
              >
                <span className="text-xs font-medium px-1.5 py-0.5 rounded" style={{ background: '#E9E9E7', color: '#57564F' }}>
                  Hệ thống
                </span>
                <span style={{ color: '#787774' }}>Phát triển bởi:</span>
                <a
                  href="https://www.facebook.com/hoaihuy2609"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold transition-colors"
                  style={{ color: '#1A1A1A' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#6B7CDB'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#1A1A1A'}
                >
                  Nguyễn Trần Hoài Huy
                </a>
              </div>

              <div
                className="flex flex-wrap items-center gap-2 text-sm px-3 py-2 rounded-lg"
                style={{ background: '#F1F0EC', border: '1px solid #E9E9E7' }}
              >
                <span style={{ color: '#787774' }}>Tài liệu:</span>
                <a
                  href="https://www.facebook.com/groups/1657860147904528"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors"
                  style={{ color: '#6B7CDB' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#5a6bc9'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#6B7CDB'}
                >
                  Group Vật Lý Physics
                </a>
                <span style={{ color: '#E9E9E7' }}>·</span>
                <span style={{ color: '#787774' }}>Tác giả:</span>
                <a
                  href="https://www.facebook.com/groups/1657860147904528/user/100079937809863"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium transition-colors"
                  style={{ color: '#1A1A1A' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#6B7CDB'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#1A1A1A'}
                >
                  Thái Văn Thành
                </a>
              </div>
            </div>

            {/* Stats row */}
            <div className="flex flex-wrap gap-3">
              <div
                className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg"
                style={{ background: '#FFFFFF', border: '1px solid #E9E9E7' }}
              >
                <FileText className="w-4 h-4" style={{ color: '#6B7CDB' }} />
                <div>
                  <div className="text-xl font-semibold" style={{ color: '#1A1A1A' }}>{totalFiles}</div>
                  <div className="text-[10px] uppercase tracking-wide" style={{ color: '#AEACA8' }}>Tài liệu</div>
                </div>
              </div>
              <div
                className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg"
                style={{ background: '#FFFFFF', border: '1px solid #E9E9E7' }}
              >
                <Folder className="w-4 h-4" style={{ color: '#448361' }} />
                <div>
                  <div className="text-xl font-semibold" style={{ color: '#1A1A1A' }}>{totalChapters}</div>
                  <div className="text-[10px] uppercase tracking-wide" style={{ color: '#AEACA8' }}>Chương học</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Leaderboard Slider (thay Einstein) */}
          <div className="hidden md:block">
            <LeaderboardSlider onLoad={onLoadLeaderboard} />
          </div>
        </div>
      </div>

      {/* ── Countdown Timer ── */}
      <CountdownTimer isAdmin={isAdmin} />

      {/* ── Grade Selection ── */}
      <div>
        <div className="flex items-center gap-2 mb-5">
          <h2 className="text-base font-semibold" style={{ color: '#1A1A1A' }}>
            Khối Lớp
          </h2>
          <div className="flex-1 h-px" style={{ background: '#E9E9E7' }} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
          {CURRICULUM.map((grade) => {
            const config = gradeConfig[grade.level] ?? { icon: FileText, dot: '#AEACA8', label: grade.title };
            const { icon: Icon, dot } = config;

            return (
              <button
                key={grade.level}
                onClick={() => onSelectGrade(grade.level)}
                className="group text-left rounded-xl p-5 transition-all"
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E9E9E7',
                  borderTop: `3px solid ${dot}`,
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = '#CFCFCB';
                  (e.currentTarget as HTMLElement).style.borderTopColor = dot;
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.border = `1px solid #E9E9E7`;
                  (e.currentTarget as HTMLElement).style.borderTopColor = dot;
                  (e.currentTarget as HTMLElement).style.borderTop = `3px solid ${dot}`;
                  (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                }}
              >
                {/* Icon + file count row */}
                <div className="flex items-center justify-between mb-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ background: `${dot}15` }}
                  >
                    <Icon className="w-5 h-5" style={{ color: dot }} />
                  </div>
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded"
                    style={{ background: '#F1F0EC', color: '#787774' }}
                  >
                    {fileCounts[grade.level] || 0} file
                  </span>
                </div>

                {/* Title */}
                <h3 className="font-semibold mb-1" style={{ color: '#1A1A1A' }}>
                  {grade.title}
                </h3>
                <p className="text-sm leading-relaxed mb-4" style={{ color: '#787774' }}>
                  Khám phá kho tàng kiến thức {grade.title.toLowerCase()}.
                </p>

                {/* CTA */}
                <div
                  className="flex items-center gap-1.5 text-sm font-medium transition-colors"
                  style={{ color: dot }}
                >
                  Truy cập
                  <span className="transition-transform group-hover:translate-x-0.5">→</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;