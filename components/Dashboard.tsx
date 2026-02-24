import React, { useState, useEffect } from 'react';
import { GradeLevel } from '../types';
import { CURRICULUM } from '../constants';
import { FileText, Folder, Quote, Atom, Zap, Activity, ArrowRight } from 'lucide-react';
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

const gradeConfig: Record<string, { icon: React.ElementType; dot: string; label: string; gradient: string }> = {
  [GradeLevel.Grade12]: { icon: Atom, dot: '#9065B0', label: 'Lớp 12', gradient: 'linear-gradient(135deg,#9065B0,#C084FC)' },
  [GradeLevel.Grade11]: { icon: Zap, dot: '#6B7CDB', label: 'Lớp 11', gradient: 'linear-gradient(135deg,#6B7CDB,#818CF8)' },
  [GradeLevel.Grade10]: { icon: Activity, dot: '#448361', label: 'Lớp 10', gradient: 'linear-gradient(135deg,#448361,#34D399)' },
};

const Dashboard: React.FC<DashboardProps> = ({ onSelectGrade, fileCounts, isAdmin }) => {
  const [quote, setQuote] = useState('');

  useEffect(() => {
    setQuote(EinsteinQuotes[Math.floor(Math.random() * EinsteinQuotes.length)]);
  }, []);

  const totalFiles = Object.values(fileCounts).reduce((a: number, b: number) => a + b, 0);

  return (
    <div className="space-y-8 animate-fade-in pb-10">

      {/* ── Hero Section ── */}
      <div>
        {/* Badge */}
        <div className="flex items-center gap-2 mb-5">
          <span
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: '#EEF0FB', color: '#6B7CDB', border: '1px solid #DDE2F7' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#6B7CDB] inline-block animate-pulse" />
            Hệ thống quản lý thông minh
          </span>
        </div>

        <div className="grid md:grid-cols-2 gap-8 items-start">
          {/* Left: Title + info */}
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-1" style={{ color: '#1A1A1A', lineHeight: 1.25 }}>
              Chào mừng đến với
            </h1>
            <h1
              className="text-3xl md:text-4xl font-bold mb-5"
              style={{
                lineHeight: 1.25,
                background: 'linear-gradient(135deg, #6B7CDB 0%, #9065B0 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              PhysiVault
            </h1>

            {/* Quote box */}
            <div
              className="flex gap-2.5 p-4 rounded-xl mb-5"
              style={{
                background: '#FFFFFF',
                borderLeft: '3px solid #6B7CDB',
                border: '1px solid #E4E3E0',
                borderLeftWidth: '3px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
              }}
            >
              <Quote className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#6B7CDB' }} />
              <p className="text-sm italic leading-relaxed" style={{ color: '#6B6A65' }}>
                {quote}
              </p>
            </div>

            {/* Attribution */}
            <div className="space-y-2 mb-6">
              <div
                className="flex items-center gap-2 text-sm px-3.5 py-2.5 rounded-xl"
                style={{ background: '#FFFFFF', border: '1px solid #E4E3E0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
              >
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md" style={{ background: '#EEF0FB', color: '#6B7CDB' }}>
                  Dev
                </span>
                <span style={{ color: '#6B6A65' }}>Phát triển bởi:</span>
                <a
                  href="https://www.facebook.com/hoaihuy2609"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold transition-colors ml-auto"
                  style={{ color: '#1A1A1A' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#6B7CDB'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#1A1A1A'}
                >
                  Nguyễn Trần Hoài Huy
                </a>
              </div>

              <div
                className="flex flex-wrap items-center gap-2 text-sm px-3.5 py-2.5 rounded-xl"
                style={{ background: '#FFFFFF', border: '1px solid #E4E3E0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
              >
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md" style={{ background: '#EAF3EE', color: '#448361' }}>
                  Tài liệu
                </span>
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
                <span style={{ color: '#E4E3E0' }}>·</span>
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
                className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{ background: '#FFFFFF', border: '1px solid #E4E3E0', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: 'linear-gradient(135deg,#EEF0FB,#DDE2F7)' }}
                >
                  <FileText className="w-4 h-4" style={{ color: '#6B7CDB' }} />
                </div>
                <div>
                  <div className="text-xl font-bold" style={{ color: '#1A1A1A' }}>{totalFiles}</div>
                  <div className="text-[10px] uppercase tracking-wider font-medium" style={{ color: '#A8A5A0' }}>Tài liệu</div>
                </div>
              </div>
              <div
                className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{ background: '#FFFFFF', border: '1px solid #E4E3E0', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: 'linear-gradient(135deg,#EAF3EE,#D1FAE5)' }}
                >
                  <Folder className="w-4 h-4" style={{ color: '#448361' }} />
                </div>
                <div>
                  <div className="text-xl font-bold" style={{ color: '#1A1A1A' }}>15+</div>
                  <div className="text-[10px] uppercase tracking-wider font-medium" style={{ color: '#A8A5A0' }}>Chương học</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Einstein portrait */}
          <div className="hidden md:block">
            <div
              className="rounded-2xl overflow-hidden"
              style={{ border: '1px solid #E4E3E0', aspectRatio: '4/3', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
            >
              <img
                src="/einstein.png"
                alt="Albert Einstein"
                className="w-full h-full object-cover"
                style={{ filter: 'saturate(0.85) brightness(1.03)' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Countdown Timer ── */}
      <CountdownTimer isAdmin={isAdmin} />

      {/* ── Grade Selection ── */}
      <div>
        <div className="flex items-center gap-3 mb-5">
          <h2 className="text-base font-semibold" style={{ color: '#1A1A1A' }}>
            Khối Lớp
          </h2>
          <div className="flex-1 h-px" style={{ background: '#E4E3E0' }} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {CURRICULUM.map((grade) => {
            const config = gradeConfig[grade.level] ?? { icon: FileText, dot: '#A8A5A0', label: grade.title, gradient: '#A8A5A0' };
            const { icon: Icon, dot, gradient } = config;

            return (
              <button
                key={grade.level}
                onClick={() => onSelectGrade(grade.level)}
                className="group text-left rounded-2xl p-5 transition-all duration-200"
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E4E3E0',
                  borderLeft: `3px solid ${dot}`,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 28px rgba(0,0,0,0.10)';
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)';
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                }}
              >
                {/* Icon + file count row */}
                <div className="flex items-center justify-between mb-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: gradient }}
                  >
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <span
                    className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                    style={{ background: `${dot}18`, color: dot }}
                  >
                    {fileCounts[grade.level] || 0} file
                  </span>
                </div>

                {/* Title */}
                <h3 className="font-bold mb-1" style={{ color: '#1A1A1A', fontSize: '1rem' }}>
                  {grade.title}
                </h3>
                <p className="text-sm leading-relaxed mb-4" style={{ color: '#6B6A65' }}>
                  Khám phá kho tàng kiến thức {grade.title.toLowerCase()}.
                </p>

                {/* CTA */}
                <div
                  className="flex items-center gap-1.5 text-sm font-semibold"
                  style={{ color: dot }}
                >
                  Truy cập
                  <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-1" />
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