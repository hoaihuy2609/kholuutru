import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GradeLevel } from '../types';
import { CURRICULUM } from '../constants';
import { FileText, Folder, Quote, Atom, Zap, Activity, Trophy, ChevronLeft, ChevronRight } from 'lucide-react';
import CountdownTimer from './CountdownTimer';

interface LeaderEntry {
  name: string;
  phone: string;
  avgScore: number;
  examCount: number;
  recentScores: number[];
  bestScore: number;
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

const SLIDES = [
  {
    grade: 10, label: 'Lớp 10', idx: 0,
    color: '#448361', colorLight: '#EAF3EE', colorBorder: '#B7D9C4',
    gradientFrom: '#448361', gradientTo: '#6BA88A',
    WatermarkIcon: Activity,
  },
  {
    grade: 11, label: 'Lớp 11', idx: 1,
    color: '#6B7CDB', colorLight: '#EEF0FB', colorBorder: '#B8C1EF',
    gradientFrom: '#6B7CDB', gradientTo: '#8F9CE0',
    WatermarkIcon: Zap,
  },
  {
    grade: 12, label: 'Lớp 12', idx: 2,
    color: '#9065B0', colorLight: '#F3ECF8', colorBorder: '#C8A8DC',
    gradientFrom: '#9065B0', gradientTo: '#B080CC',
    WatermarkIcon: Atom,
  },
];

// Mask số điện thoại
const maskPhone = (phone: string) => {
  if (!phone || phone.length < 6) return phone;
  return phone.slice(0, 3) + '****' + phone.slice(-2);
};

// Sparkline SVG component
const Sparkline: React.FC<{ scores: number[]; color: string; width?: number; height?: number }> = ({
  scores, color, width = 56, height = 22,
}) => {
  if (!scores || scores.length < 2) return null;
  const min = 0;
  const max = 10;
  const pad = 2;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const pts = scores.map((s, i) => {
    const x = pad + (i / (scores.length - 1)) * w;
    const y = pad + h - ((s - min) / (max - min)) * h;
    return `${x},${y}`;
  });
  const trend = scores[scores.length - 1] - scores[0];
  const areapts = [
    `${pad},${pad + h}`,
    ...pts,
    `${pad + w},${pad + h}`,
  ].join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none">
      <defs>
        <linearGradient id={`spark-grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.18} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon
        points={areapts}
        fill={`url(#spark-grad-${color.replace('#', '')})`}
      />
      <polyline
        points={pts.join(' ')}
        stroke={trend >= 0 ? color : '#E03E3E'}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Last dot */}
      <circle
        cx={pts[pts.length - 1].split(',')[0]}
        cy={pts[pts.length - 1].split(',')[1]}
        r={2.5}
        fill={trend >= 0 ? color : '#E03E3E'}
      />
    </svg>
  );
};

interface LeaderboardSliderProps {
  onLoad: () => Promise<LeaderEntry[][]>;
}

const LeaderboardSlider: React.FC<LeaderboardSliderProps> = ({ onLoad }) => {
  const [data, setData] = useState<LeaderEntry[][]>([[], [], []]);
  const [slide, setSlide] = useState(0);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transitionRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    onLoad().then(res => {
      if (mounted) { setData(res || [[], [], []]); setLoading(false); }
    }).catch(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const switchTo = useCallback((next: number) => {
    if (transitionRef.current) return;
    transitionRef.current = true;
    setVisible(false);
    setTimeout(() => {
      setSlide(next);
      setVisible(true);
      transitionRef.current = false;
    }, 260);
  }, []);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setSlide(s => {
        const next = (s + 1) % 3;
        transitionRef.current = true;
        setVisible(false);
        setTimeout(() => { setVisible(true); transitionRef.current = false; }, 260);
        return next;
      });
    }, 5000);
  }, []);

  useEffect(() => {
    resetTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const handlePrev = () => { switchTo((slide + 2) % 3); resetTimer(); };
  const handleNext = () => { switchTo((slide + 1) % 3); resetTimer(); };

  const cfg = SLIDES[slide];
  const list = data[cfg.idx] || [];
  const { WatermarkIcon } = cfg;

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{
        border: `1px solid ${cfg.colorBorder}`,
        background: '#FFFFFF',
        minHeight: '280px',
        position: 'relative',
        boxShadow: `0 4px 20px ${cfg.color}18`,
      }}
    >
      {/* Watermark Icon */}
      <div
        className="absolute bottom-3 right-3 pointer-events-none select-none"
        style={{ opacity: 0.04, transition: 'opacity 0.4s' }}
      >
        <WatermarkIcon style={{ width: 110, height: 110, color: cfg.color }} />
      </div>

      {/* Gradient top bar */}
      <div
        className="h-1 w-full"
        style={{ background: `linear-gradient(90deg, ${cfg.gradientFrom}, ${cfg.gradientTo})` }}
      />

      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ background: cfg.colorLight, borderBottom: `1px solid ${cfg.colorBorder}` }}
      >
        <div className="flex items-center gap-2">
          <Trophy className="w-3.5 h-3.5" style={{ color: cfg.color }} />
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: cfg.color }}>
            Bảng Xếp Hạng
          </span>
          <span
            className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
            style={{ background: cfg.color + '18', color: cfg.color }}
          >
            <span className="w-1 h-1 rounded-full inline-block" style={{ background: cfg.color }} />
            {cfg.label}
          </span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handlePrev}
            className="w-5 h-5 rounded flex items-center justify-center transition-all"
            style={{ color: cfg.color, background: cfg.colorBorder + '60' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = cfg.colorBorder}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = cfg.colorBorder + '60'}
          >
            <ChevronLeft className="w-3 h-3" />
          </button>
          {SLIDES.map((s, i) => (
            <button
              key={i}
              onClick={() => { switchTo(i); resetTimer(); }}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === slide ? '20px' : '5px',
                height: '5px',
                background: i === slide ? cfg.color : cfg.colorBorder,
              }}
            />
          ))}
          <button
            onClick={handleNext}
            className="w-5 h-5 rounded flex items-center justify-center transition-all"
            style={{ color: cfg.color, background: cfg.colorBorder + '60' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = cfg.colorBorder}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = cfg.colorBorder + '60'}
          >
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div
        className="flex-1 flex flex-col px-3 py-3 gap-1.5"
        style={{
          transition: 'opacity 0.26s ease, transform 0.26s ease',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(6px)',
        }}
      >
        {loading ? (
          /* Skeleton */
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2.5 py-2 px-2.5 rounded-xl animate-pulse" style={{ background: '#F7F6F3' }}>
              <div className="w-6 h-6 rounded-full" style={{ background: '#EBEBEB' }} />
              <div className="flex-1 space-y-1.5">
                <div className="h-2.5 rounded w-3/4" style={{ background: '#EBEBEB' }} />
                <div className="h-2 rounded w-1/2" style={{ background: '#EBEBEB' }} />
              </div>
              <div className="w-10 h-5 rounded" style={{ background: '#EBEBEB' }} />
            </div>
          ))
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 py-8 text-center">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
              style={{ background: cfg.colorLight, border: `1px solid ${cfg.colorBorder}` }}
            >
              <Trophy className="w-5 h-5" style={{ color: cfg.colorBorder }} />
            </div>
            <p className="text-sm font-medium" style={{ color: '#787774' }}>Chưa có dữ liệu cho {cfg.label}</p>
            <p className="text-xs mt-1" style={{ color: '#AEACA8' }}>Hoàn thành bài thi để lên bảng xếp hạng!</p>
          </div>
        ) : (
          list.map((entry, i) => {
            const isTop1 = i === 0;
            const scoreBarWidth = (entry.avgScore / 10) * 100;
            const rankLabels = ['👑', '②', '③', '④', '⑤'];

            return (
              <div
                key={entry.phone}
                className="flex items-center gap-2.5 rounded-xl px-2.5 transition-all"
                style={{
                  paddingTop: isTop1 ? '10px' : '7px',
                  paddingBottom: isTop1 ? '10px' : '7px',
                  background: isTop1 ? cfg.colorLight : 'transparent',
                  border: isTop1 ? `1px solid ${cfg.colorBorder}` : '1px solid transparent',
                  boxShadow: isTop1 ? `0 2px 10px ${cfg.color}14` : 'none',
                  animationDelay: `${i * 60}ms`,
                }}
              >
                {/* Rank badge */}
                <div
                  className="shrink-0 w-6 h-6 flex items-center justify-center text-[13px] font-bold rounded-full"
                  style={{
                    background: isTop1 ? cfg.color : '#F1F0EC',
                    color: isTop1 ? '#fff' : cfg.color,
                    fontSize: isTop1 ? '13px' : '11px',
                  }}
                >
                  {rankLabels[i] || i + 1}
                </div>

                {/* Name + score bar + phone */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5 mb-1">
                    <span
                      className="font-semibold truncate leading-tight"
                      style={{
                        color: isTop1 ? cfg.color : '#1A1A1A',
                        fontSize: isTop1 ? '14px' : '12.5px',
                      }}
                    >
                      {entry.name}
                    </span>
                    {isTop1 && (
                      <span
                        className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0"
                        style={{ background: cfg.color, color: '#fff' }}
                      >
                        #1
                      </span>
                    )}
                  </div>

                  {/* Score bar */}
                  <div className="flex items-center gap-1.5">
                    <div
                      className="flex-1 rounded-full overflow-hidden"
                      style={{ height: '4px', background: cfg.colorBorder + '60' }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${scoreBarWidth}%`,
                          background: `linear-gradient(90deg, ${cfg.gradientFrom}, ${cfg.gradientTo})`,
                          transition: 'width 0.6s ease',
                        }}
                      />
                    </div>
                    <span className="text-[10px]" style={{ color: '#AEACA8' }}>
                      {maskPhone(entry.phone)} · {entry.examCount} bài
                    </span>
                  </div>
                </div>

                {/* Sparkline + Score */}
                <div className="shrink-0 flex flex-col items-end gap-0.5">
                  <span
                    className="font-bold tabular-nums leading-none"
                    style={{
                      fontSize: isTop1 ? '17px' : '14px',
                      color: isTop1 ? cfg.color : '#1A1A1A',
                    }}
                  >
                    {entry.avgScore.toFixed(2)}
                  </span>
                  {entry.recentScores && entry.recentScores.length >= 2 && (
                    <Sparkline scores={entry.recentScores} color={cfg.color} width={52} height={20} />
                  )}
                </div>
              </div>
            );
          })
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
          {/* Left */}
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold mb-1" style={{ color: '#1A1A1A', lineHeight: 1.3 }}>
              Chào mừng đến với
            </h1>
            <h1 className="text-2xl md:text-3xl font-semibold mb-4 md:mb-5" style={{ color: '#6B7CDB', lineHeight: 1.3 }}>
              PhysiVault
            </h1>

            <div
              className="flex gap-2.5 p-3 md:p-4 rounded-lg mb-4 md:mb-6"
              style={{ background: '#F7F6F3', borderLeft: '3px solid #CFCFCB' }}
            >
              <Quote className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0 mt-0.5" style={{ color: '#AEACA8' }} />
              <p className="text-xs md:text-sm italic leading-relaxed" style={{ color: '#787774' }}>
                {quote}
              </p>
            </div>

            <div className="space-y-2 mb-6">
              <div className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg" style={{ background: '#F1F0EC', border: '1px solid #E9E9E7' }}>
                <span className="text-xs font-medium px-1.5 py-0.5 rounded" style={{ background: '#E9E9E7', color: '#57564F' }}>Hệ thống</span>
                <span style={{ color: '#787774' }}>Phát triển bởi:</span>
                <a href="https://www.facebook.com/hoaihuy2609" target="_blank" rel="noopener noreferrer"
                  className="font-semibold transition-colors" style={{ color: '#1A1A1A' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#6B7CDB'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#1A1A1A'}>
                  Nguyễn Trần Hoài Huy
                </a>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm px-3 py-2 rounded-lg" style={{ background: '#F1F0EC', border: '1px solid #E9E9E7' }}>
                <span style={{ color: '#787774' }}>Tài liệu:</span>
                <a href="https://www.facebook.com/groups/1657860147904528" target="_blank" rel="noopener noreferrer"
                  className="transition-colors" style={{ color: '#6B7CDB' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#5a6bc9'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#6B7CDB'}>
                  Group Vật Lý Physics
                </a>
                <span style={{ color: '#E9E9E7' }}>·</span>
                <span style={{ color: '#787774' }}>Tác giả:</span>
                <a href="https://www.facebook.com/groups/1657860147904528/user/100079937809863" target="_blank" rel="noopener noreferrer"
                  className="font-medium transition-colors" style={{ color: '#1A1A1A' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#6B7CDB'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#1A1A1A'}>
                  Thái Văn Thành
                </a>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg" style={{ background: '#FFFFFF', border: '1px solid #E9E9E7' }}>
                <FileText className="w-4 h-4" style={{ color: '#6B7CDB' }} />
                <div>
                  <div className="text-xl font-semibold" style={{ color: '#1A1A1A' }}>{totalFiles}</div>
                  <div className="text-[10px] uppercase tracking-wide" style={{ color: '#AEACA8' }}>Tài liệu</div>
                </div>
              </div>
              <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg" style={{ background: '#FFFFFF', border: '1px solid #E9E9E7' }}>
                <Folder className="w-4 h-4" style={{ color: '#448361' }} />
                <div>
                  <div className="text-xl font-semibold" style={{ color: '#1A1A1A' }}>{totalChapters}</div>
                  <div className="text-[10px] uppercase tracking-wide" style={{ color: '#AEACA8' }}>Chương học</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Leaderboard Slider */}
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
          <h2 className="text-base font-semibold" style={{ color: '#1A1A1A' }}>Khối Lớp</h2>
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
                style={{ background: '#FFFFFF', border: '1px solid #E9E9E7', borderTop: `3px solid ${dot}` }}
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
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${dot}15` }}>
                    <Icon className="w-5 h-5" style={{ color: dot }} />
                  </div>
                  <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ background: '#F1F0EC', color: '#787774' }}>
                    {fileCounts[grade.level] || 0} file
                  </span>
                </div>
                <h3 className="font-semibold mb-1" style={{ color: '#1A1A1A' }}>{grade.title}</h3>
                <p className="text-sm leading-relaxed mb-4" style={{ color: '#787774' }}>
                  Khám phá kho tàng kiến thức {grade.title.toLowerCase()}.
                </p>
                <div className="flex items-center gap-1.5 text-sm font-medium transition-colors" style={{ color: dot }}>
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