import React, { useState, useEffect, useRef, useMemo } from 'react';
import { GradeLevel } from '../types';
import { CURRICULUM } from '../constants';
import { BookOpen, FileText, Activity, Zap, Atom, TrendingUp, Users, Folder, Quote } from 'lucide-react';
import CountdownTimer from './CountdownTimer';

interface DashboardProps {
  onSelectGrade: (grade: GradeLevel) => void;
  fileCounts: Record<string, number>;
  isAdmin: boolean;
}

const EinsteinQuotes = [
  "Logic đưa ta từ A đến B, trí tưởng tượng đưa ta đến mọi nơi.",
  "Học từ hôm qua, sống cho hôm nay, hy vọng cho ngày mai.",
  "Thư viện là kho tàng tàng trữ mọi giá trị tinh thần của loài người.",
  "Vật lý không chỉ là các phương trình, nó là cách ta nhìn thế giới.",
  "Cuộc đời giống như lái một chiếc xe đạp. Để giữ thăng bằng, bạn phải tiếp tục di chuyển."
];

const Dashboard: React.FC<DashboardProps> = ({ onSelectGrade, fileCounts, isAdmin }) => {
  const [quote, setQuote] = useState('');
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuote(EinsteinQuotes[Math.floor(Math.random() * EinsteinQuotes.length)]);
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setMousePos({ x, y });
  };

  // Generate random particles
  const particles = useMemo(() => {
    return Array.from({ length: 15 }).map((_, i) => ({
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      size: Math.random() * 6 + 2,
      duration: Math.random() * 15 + 10,
      delay: Math.random() * 5
    }));
  }, []);

  const getGradeInfo = (grade: GradeLevel) => {
    switch (grade) {
      case GradeLevel.Grade12: return {
        icon: Atom,
        gradient: 'from-violet-500 to-fuchsia-600',
        shadow: 'shadow-fuchsia-500/20',
        bg: 'bg-fuchsia-50',
        neon: 'text-fuchsia-600'
      };
      case GradeLevel.Grade11: return {
        icon: Zap,
        gradient: 'from-blue-500 to-cyan-500',
        shadow: 'shadow-cyan-500/20',
        bg: 'bg-cyan-50',
        neon: 'text-blue-600'
      };
      case GradeLevel.Grade10: return {
        icon: Activity,
        gradient: 'from-emerald-500 to-teal-600',
        shadow: 'shadow-teal-500/20',
        bg: 'bg-teal-50',
        neon: 'text-teal-600'
      };
      default: return {
        icon: BookOpen,
        gradient: 'from-slate-500 to-slate-600',
        shadow: 'shadow-slate-500/20',
        bg: 'bg-slate-50',
        neon: 'text-slate-400'
      };
    }
  };

  const totalFiles = Object.values(fileCounts).reduce((a: number, b: number) => a + b, 0);

  return (
    <div className="space-y-10 animate-fade-in pb-10" ref={containerRef} onMouseMove={handleMouseMove}>
      {/* Background Particles Layer */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        {particles.map((p, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-indigo-500/10 animate-float-particle"
            style={{
              left: p.left,
              top: p.top,
              width: p.size,
              height: p.size,
              animationDuration: `${p.duration}s`,
              animationDelay: `${p.delay}s`
            }}
          />
        ))}
      </div>

      {/* Hero Section */}
      <div className="relative rounded-3xl p-8 md:p-10 overflow-hidden shadow-2xl shadow-indigo-500/10 border border-white/40 isolate">
        {/* Background Mesh Gradient */}
        <div className="absolute inset-0 -z-10 bg-white/60 backdrop-blur-xl"></div>
        <div className="absolute top-0 right-0 -z-20 w-[600px] h-[600px] bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full blur-3xl opacity-60 translate-x-1/3 -translate-y-1/4"></div>
        <div className="absolute bottom-0 left-0 -z-20 w-[500px] h-[500px] bg-gradient-to-tr from-blue-100 to-cyan-100 rounded-full blur-3xl opacity-60 -translate-x-1/4 translate-y-1/4"></div>

        <div className="relative z-10 grid md:grid-cols-2 gap-8 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-bold uppercase tracking-wider mb-4 shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
              </span>
              Hệ thống quản lý thông minh
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-slate-800 mb-4 tracking-tight leading-tight">
              Chào mừng đến với <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">PhysiVault</span>
            </h1>

            {/* Dynamic Quote Box */}
            <div className="bg-white/40 backdrop-blur-sm border border-white/60 rounded-2xl p-4 mb-8 max-w-lg shadow-sm group">
              <div className="flex gap-3">
                <Quote className="w-5 h-5 text-indigo-400 shrink-0 mt-1" />
                <div className="relative overflow-hidden">
                  <p className="text-slate-600 italic font-medium leading-relaxed animate-typing">
                    {quote}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 mb-10">
              {/* Developer Box */}
              <div className="flex items-center gap-3 px-5 py-2.5 bg-indigo-50/50 border border-indigo-100/50 rounded-2xl w-fit shadow-sm hover:shadow-md transition-all">
                <div className="p-1 px-2 bg-indigo-100 rounded-lg text-indigo-700 text-[10px] font-bold uppercase tracking-wider">
                  Hệ thống
                </div>
                <span className="text-slate-600 text-sm font-medium">Phát triển bởi:</span>
                <a
                  href="https://www.facebook.com/hoaihuy2609"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-900 font-bold text-sm hover:text-indigo-600 transition-colors"
                >
                  Nguyễn Trần Hoài Huy
                </a>
              </div>

              {/* Source & Author Box */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-2.5 bg-indigo-50/50 border border-indigo-100/50 rounded-2xl w-fit shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-white rounded-lg text-indigo-600 shadow-sm">
                    <Users className="w-4 h-4" />
                  </div>
                  <span className="text-slate-600 font-medium text-sm">
                    Tài liệu: <a
                      href="https://www.facebook.com/groups/1657860147904528"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:text-indigo-700 hover:underline transition-all"
                    >
                      Group Vật Lý Physics
                    </a>
                  </span>
                </div>
                <div className="hidden sm:block w-1.5 h-1.5 rounded-full bg-indigo-200"></div>
                <div className="text-slate-500 font-medium text-sm">
                  Tác giả: <a
                    href="https://www.facebook.com/groups/1657860147904528/user/100079937809863"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-800 font-bold hover:text-indigo-700 transition-all"
                  >
                    Thái Văn Thành
                  </a>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-3 px-5 py-3 bg-white/80 rounded-2xl shadow-sm border border-white/50 backdrop-blur-sm hover:scale-105 transition-transform">
                <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-800">{totalFiles}</div>
                  <div className="text-xs text-slate-400 font-medium uppercase">Tài liệu</div>
                </div>
              </div>

              <div className="flex items-center gap-3 px-5 py-3 bg-white/80 rounded-2xl shadow-sm border border-white/50 backdrop-blur-sm hover:scale-105 transition-transform">
                <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                  <Folder className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-800">15+</div>
                  <div className="text-xs text-slate-400 font-medium uppercase">Chương học</div>
                </div>
              </div>
            </div>
          </div>

          {/* Parallax Einstein Portrait */}
          <div className="hidden md:block relative overflow-visible">
            <div
              className="relative group transition-all duration-200 ease-out"
              style={{
                transform: `perspective(1000px) rotateY(${mousePos.x * 12}deg) rotateX(${-mousePos.y * 12}deg)`,
              }}
            >
              <div className="relative w-full aspect-[4/3] rounded-3xl overflow-hidden shadow-2xl border-4 border-white/50 bg-slate-900">
                <img
                  src="/einstein.png"
                  alt="Albert Einstein"
                  className="w-full h-full object-cover filter saturate-[1.1] brightness-[1.05]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-indigo-900/40 via-transparent to-transparent"></div>
              </div>

              {/* Floating Atom around Einstein */}
              <div
                className="absolute -top-10 -right-10 text-indigo-500 animate-neon-glow transition-transform duration-300"
                style={{ transform: `translateX(${mousePos.x * 30}px) translateY(${mousePos.y * 30}px)` }}
              >
                <Atom className="w-20 h-20 drop-shadow-2xl" />
              </div>
            </div>

            <div className={`absolute -inset-10 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-full blur-3xl -z-10 opacity-60`}></div>
          </div>
        </div>
      </div>

      {/* Countdown Timer */}
      <CountdownTimer isAdmin={isAdmin} />

      {/* Grade Selection with Neon Glow */}
      <div>
        <div className="flex items-center justify-between mb-8 px-2">
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <span className="w-1.5 h-8 bg-indigo-600 rounded-full block"></span>
            Khối Lớp
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {CURRICULUM.map((grade) => {
            const { icon: Icon, gradient, shadow, bg, neon } = getGradeInfo(grade.level);

            return (
              <button
                key={grade.level}
                onClick={() => onSelectGrade(grade.level)}
                className="group relative flex flex-col rounded-3xl overflow-hidden transition-all duration-500 bg-white hover:-translate-y-2"
              >
                {/* Card Glow Effect */}
                <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl`}></div>

                {/* Card Content Wrapper */}
                <div className="relative m-[2px] bg-white rounded-[22px] flex flex-col h-full overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-500">
                  {/* Top Gradient Banner */}
                  <div className={`h-32 bg-gradient-to-br ${gradient} p-6 relative overflow-hidden transition-all duration-500 group-hover:h-36`}>
                    <div className="relative z-10 flex justify-between items-start">
                      <div className={`p-3 bg-white/20 backdrop-blur-md rounded-2xl border border-white/30 text-white shadow-lg animate-pulse`}>
                        <Icon className="w-8 h-8" />
                      </div>
                      <span className="px-3 py-1 bg-white/20 backdrop-blur-md border border-white/30 rounded-full text-white text-xs font-bold shadow-sm">
                        {fileCounts[grade.level] || 0} FILE
                      </span>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-6 flex-1 flex flex-col">
                    <h3 className={`text-2xl font-bold mb-2 transition-all ${neon} group-hover:animate-neon-glow`}>
                      {grade.title}
                    </h3>
                    <p className="text-sm text-slate-500 line-clamp-3 mb-6 flex-1 leading-relaxed">
                      Khám phá kho tàng kiến thức {grade.title.toLowerCase()}.
                    </p>

                    <div className={`mt-auto flex items-center justify-center p-3 rounded-xl ${bg} group-hover:bg-indigo-600 group-hover:text-white transition-all`}>
                      <span className="text-sm font-bold">Truy cập ngay</span>
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  );
};
export default Dashboard;