import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GradeLevel } from '../types';
import { CURRICULUM } from '../constants';
import { FileText, Folder, Quote, Atom, Zap, Activity, Trophy, ChevronLeft, ChevronRight, Star } from 'lucide-react';
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
    gradFrom: '#448361', gradTo: '#6BA88A',
    WatermarkIcon: Activity,
  },
  {
    grade: 11, label: 'Lớp 11', idx: 1,
    color: '#6B7CDB', colorLight: '#EEF0FB', colorBorder: '#B8C1EF',
    gradFrom: '#6B7CDB', gradTo: '#8F9CE0',
    WatermarkIcon: Zap,
  },
  {
    grade: 12, label: 'Lớp 12', idx: 2,
    color: '#9065B0', colorLight: '#F3ECF8', colorBorder: '#C8A8DC',
    gradFrom: '#9065B0', gradTo: '#B080CC',
    WatermarkIcon: Atom,
  },
];

const maskPhone = (phone: string) => {
  if (!phone || phone.length < 6) return phone;
  return phone.slice(0, 3) + ' **** ' + phone.slice(-2);
};

// Avatar từ tên (lấy chữ cái đầu)
const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

// Mini Sparkline SVG
const Sparkline: React.FC<{ scores: number[]; color: string }> = ({ scores, color }) => {
  if (!scores || scores.length < 2) return null;
  const W = 120, H = 36, pad = 4;
  const w = W - pad * 2, h = H - pad * 2;
  const pts = scores.map((s, i) => {
    const x = pad + (i / (scores.length - 1)) * w;
    const y = pad + h - (s / 10) * h;
    return [x, y] as [number, number];
  });
  const trend = scores[scores.length - 1] >= scores[0];
  const lineColor = trend ? color : '#E03E3E';
  const polyline = pts.map(p => p.join(',')).join(' ');
  const area = [`${pad},${pad + h}`, ...pts.map(p => p.join(',')), `${pad + w},${pad + h}`].join(' ');

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none">
      <defs>
        <linearGradient id="spk-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lineColor} stopOpacity={0.22} />
          <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#spk-area)" />
      <polyline points={polyline} stroke={lineColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={3} fill={lineColor} />
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
  const inTrans = useRef(false);

  useEffect(() => {
    let mounted = true;
    onLoad().then(res => { if (mounted) { setData(res || [[], [], []]); setLoading(false); } })
      .catch(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const switchTo = useCallback((next: number) => {
    if (inTrans.current) return;
    inTrans.current = true;
    setVisible(false);
    setTimeout(() => { setSlide(next); setVisible(true); inTrans.current = false; }, 280);
  }, []);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setSlide(s => { const next = (s + 1) % 3; switchTo(next); return s; });
    }, 5500);
  }, [switchTo]);

  useEffect(() => { resetTimer(); return () => { if (timerRef.current) clearInterval(timerRef.current); }; }, []);

  const prev = () => { switchTo((slide + 2) % 3); resetTimer(); };
  const next = () => { switchTo((slide + 1) % 3); resetTimer(); };

  const cfg = SLIDES[slide];
  const top1 = (data[cfg.idx] || [])[0] ?? null;
  const { WatermarkIcon } = cfg;
  const initials = top1 ? getInitials(top1.name) : '';

  return (
    <div
      className="rounded-2xl overflow-hidden relative"
      style={{
        border: `1px solid ${cfg.colorBorder}`,
        background: '#FFFFFF',
        boxShadow: `0 6px 28px ${cfg.color}1A`,
        minHeight: '272px',
        transition: 'box-shadow 0.4s ease, border-color 0.4s ease',
      }}
    >
      {/* Gradient top accent bar */}
      <div className="h-[3px] w-full" style={{ background: `linear-gradient(90deg,${cfg.gradFrom},${cfg.gradTo})` }} />

      {/* Watermark background icon */}
      <div className="absolute inset-0 flex items-end justify-end pointer-events-none select-none overflow-hidden" style={{ opacity: 0.05 }}>
        <WatermarkIcon style={{ width: 160, height: 160, color: cfg.color, marginBottom: -24, marginRight: -24 }} />
      </div>

      {/* Header bar */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ background: cfg.colorLight, borderBottom: `1px solid ${cfg.colorBorder}80` }}
      >
        <div className="flex items-center gap-2">
          <Trophy className="w-3.5 h-3.5" style={{ color: cfg.color }} />
          <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: cfg.color }}>
            Bảng Xếp Hạng
          </span>
        </div>

        {/* Slide controls */}
        <div className="flex items-center gap-1.5">
          <button onClick={prev} className="w-5 h-5 rounded flex items-center justify-center transition-colors"
            style={{ color: cfg.color, background: `${cfg.color}18` }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = `${cfg.color}30`}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = `${cfg.color}18`}>
            <ChevronLeft className="w-3 h-3" />
          </button>
          {SLIDES.map((_, i) => (
            <button key={i} onClick={() => { switchTo(i); resetTimer(); }}
              className="rounded-full transition-all duration-300"
              style={{ width: i === slide ? '18px' : '5px', height: '5px', background: i === slide ? cfg.color : cfg.colorBorder }} />
          ))}
          <button onClick={next} className="w-5 h-5 rounded flex items-center justify-center transition-colors"
            style={{ color: cfg.color, background: `${cfg.color}18` }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = `${cfg.color}30`}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = `${cfg.color}18`}>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* ── Main content area ── */}
      <div
        className="flex flex-col items-center justify-center px-5 py-5 relative z-10"
        style={{
          minHeight: '220px',
          transition: 'opacity 0.28s ease, transform 0.28s ease',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(8px)',
        }}
      >
        {loading ? (
          /* Skeleton */
          <div className="flex flex-col items-center gap-3 w-full animate-pulse">
            <div className="w-16 h-16 rounded-2xl" style={{ background: '#F1F0EC' }} />
            <div className="h-4 rounded w-36" style={{ background: '#F1F0EC' }} />
            <div className="h-3 rounded w-24" style={{ background: '#F1F0EC' }} />
            <div className="h-3 rounded w-28 mt-1" style={{ background: '#F1F0EC' }} />
          </div>
        ) : !top1 ? (
          /* Empty state */
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: cfg.colorLight, border: `1px dashed ${cfg.colorBorder}` }}>
              <Trophy className="w-6 h-6" style={{ color: cfg.colorBorder }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#787774' }}>Chưa có dữ liệu · {cfg.label}</p>
              <p className="text-xs mt-0.5" style={{ color: '#AEACA8' }}>Hoàn thành bài thi để lên bảng xếp hạng!</p>
            </div>
          </div>
        ) : (
          /* ── Champion card ── */
          <div className="flex flex-col items-center w-full gap-4">

            {/* Grade label + crown */}
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full"
                style={{ background: `${cfg.color}14`, color: cfg.color, border: `1px solid ${cfg.colorBorder}` }}
              >
                <span className="w-1 h-1 rounded-full inline-block" style={{ background: cfg.color }} />
                {cfg.label}
              </span>
              <Star className="w-3.5 h-3.5" style={{ color: '#D4A017', fill: '#D4A017' }} />
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#D4A017' }}>Quán quân</span>
            </div>

            {/* Avatar */}
            <div className="relative">
              {/* Glow ring */}
              <div
                className="absolute inset-0 rounded-2xl blur-sm opacity-40"
                style={{ background: `linear-gradient(135deg,${cfg.gradFrom},${cfg.gradTo})`, transform: 'scale(1.1)' }}
              />
              <div
                className="relative w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold text-white"
                style={{ background: `linear-gradient(135deg,${cfg.gradFrom},${cfg.gradTo})`, letterSpacing: '-0.02em' }}
              >
                {initials}
              </div>
              {/* Crown badge */}
              <div
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-sm"
                style={{ background: '#FFFBEB', border: '2px solid #FDE68A', boxShadow: '0 2px 6px #D4A01740' }}
              >
                👑
              </div>
            </div>

            {/* Name */}
            <div className="text-center">
              <h3 className="text-lg font-bold leading-tight" style={{ color: '#1A1A1A', letterSpacing: '-0.01em' }}>
                {top1.name}
              </h3>
              <p className="text-xs mt-0.5" style={{ color: '#AEACA8' }}>
                {maskPhone(top1.phone)} · {top1.examCount} bài thi
              </p>
            </div>

            {/* Score + Sparkline row */}
            <div className="flex items-center gap-4 w-full justify-center">
              {/* Score block */}
              <div className="text-center">
                <div
                  className="text-3xl font-black tabular-nums leading-none"
                  style={{ color: cfg.color, letterSpacing: '-0.03em' }}
                >
                  {top1.avgScore.toFixed(2)}
                </div>
                <div className="text-[10px] uppercase tracking-widest mt-1" style={{ color: '#AEACA8' }}>
                  Điểm TB
                </div>
              </div>

              {/* Divider */}
              <div className="w-px h-10 self-center" style={{ background: cfg.colorBorder }} />

              {/* Best score */}
              <div className="text-center">
                <div className="text-xl font-bold tabular-nums leading-none" style={{ color: '#1A1A1A' }}>
                  {top1.bestScore.toFixed(2)}
                </div>
                <div className="text-[10px] uppercase tracking-widest mt-1" style={{ color: '#AEACA8' }}>
                  Cao nhất
                </div>
              </div>

              {/* Divider */}
              {top1.recentScores && top1.recentScores.length >= 2 && (
                <>
                  <div className="w-px h-10 self-center" style={{ background: cfg.colorBorder }} />
                  {/* Sparkline */}
                  <div className="flex flex-col items-center gap-0.5">
                    <Sparkline scores={top1.recentScores} color={cfg.color} />
                    <span className="text-[10px] uppercase tracking-widest" style={{ color: '#AEACA8' }}>
                      Xu hướng
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Score progress bar */}
            <div className="w-full">
              <div className="w-full rounded-full overflow-hidden" style={{ height: '5px', background: `${cfg.colorBorder}60` }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(top1.avgScore / 10) * 100}%`,
                    background: `linear-gradient(90deg,${cfg.gradFrom},${cfg.gradTo})`,
                    transition: 'width 0.7s ease',
                  }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[9px]" style={{ color: '#CFCFCB' }}>0</span>
                <span className="text-[9px]" style={{ color: '#CFCFCB' }}>10</span>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

// ─── Dashboard ──────────────────────────────────────────────────────────────

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
          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded"
            style={{ background: '#EEF0FB', color: '#6B7CDB' }}>
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

            <div className="flex gap-2.5 p-3 md:p-4 rounded-lg mb-4 md:mb-6"
              style={{ background: '#F7F6F3', borderLeft: '3px solid #CFCFCB' }}>
              <Quote className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0 mt-0.5" style={{ color: '#AEACA8' }} />
              <p className="text-xs md:text-sm italic leading-relaxed" style={{ color: '#787774' }}>{quote}</p>
            </div>

            <div className="space-y-2 mb-6">
              <div className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg"
                style={{ background: '#F1F0EC', border: '1px solid #E9E9E7' }}>
                <span className="text-xs font-medium px-1.5 py-0.5 rounded"
                  style={{ background: '#E9E9E7', color: '#57564F' }}>Hệ thống</span>
                <span style={{ color: '#787774' }}>Phát triển bởi:</span>
                <a href="https://www.facebook.com/hoaihuy2609" target="_blank" rel="noopener noreferrer"
                  className="font-semibold transition-colors" style={{ color: '#1A1A1A' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#6B7CDB'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#1A1A1A'}>
                  Nguyễn Trần Hoài Huy
                </a>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm px-3 py-2 rounded-lg"
                style={{ background: '#F1F0EC', border: '1px solid #E9E9E7' }}>
                <span style={{ color: '#787774' }}>Tài liệu:</span>
                <a href="https://www.facebook.com/groups/1657860147904528" target="_blank" rel="noopener noreferrer"
                  className="transition-colors" style={{ color: '#6B7CDB' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#5a6bc9'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#6B7CDB'}>
                  Group Vật Lý Physics
                </a>
                <span style={{ color: '#E9E9E7' }}>·</span>
                <span style={{ color: '#787774' }}>Tác giả:</span>
                <a href="https://www.facebook.com/groups/1657860147904528/user/100079937809863"
                  target="_blank" rel="noopener noreferrer"
                  className="font-medium transition-colors" style={{ color: '#1A1A1A' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#6B7CDB'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#1A1A1A'}>
                  Thái Văn Thành
                </a>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg"
                style={{ background: '#FFFFFF', border: '1px solid #E9E9E7' }}>
                <FileText className="w-4 h-4" style={{ color: '#6B7CDB' }} />
                <div>
                  <div className="text-xl font-semibold" style={{ color: '#1A1A1A' }}>{totalFiles}</div>
                  <div className="text-[10px] uppercase tracking-wide" style={{ color: '#AEACA8' }}>Tài liệu</div>
                </div>
              </div>
              <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg"
                style={{ background: '#FFFFFF', border: '1px solid #E9E9E7' }}>
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
                  <span className="text-xs font-medium px-2 py-0.5 rounded"
                    style={{ background: '#F1F0EC', color: '#787774' }}>
                    {fileCounts[grade.level] || 0} file
                  </span>
                </div>
                <h3 className="font-semibold mb-1" style={{ color: '#1A1A1A' }}>{grade.title}</h3>
                <p className="text-sm leading-relaxed mb-4" style={{ color: '#787774' }}>
                  Khám phá kho tàng kiến thức {grade.title.toLowerCase()}.
                </p>
                <div className="flex items-center gap-1.5 text-sm font-medium" style={{ color: dot }}>
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