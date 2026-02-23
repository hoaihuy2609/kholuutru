import React, { useState, useEffect } from 'react';
import { GradeLevel } from '../types';
import { CURRICULUM } from '../constants';
import { FileText, Folder, Quote, Atom, Zap, Activity } from 'lucide-react';
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

const gradeConfig: Record<string, { icon: React.ElementType; dot: string; label: string }> = {
  [GradeLevel.Grade12]: { icon: Atom, dot: '#9065B0', label: 'Lớp 12' },
  [GradeLevel.Grade11]: { icon: Zap, dot: '#6B7CDB', label: 'Lớp 11' },
  [GradeLevel.Grade10]: { icon: Activity, dot: '#448361', label: 'Lớp 10' },
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
                className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg"
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
                  <div className="text-xl font-semibold" style={{ color: '#1A1A1A' }}>15+</div>
                  <div className="text-[10px] uppercase tracking-wide" style={{ color: '#AEACA8' }}>Chương học</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Einstein portrait */}
          <div className="hidden md:block">
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: '1px solid #E9E9E7', aspectRatio: '4/3' }}
            >
              <img
                src="/einstein.png"
                alt="Albert Einstein"
                className="w-full h-full object-cover"
                style={{ filter: 'saturate(0.9) brightness(1.02)' }}
              />
            </div>
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