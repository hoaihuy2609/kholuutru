import React from 'react';
import { Atom, Home, Settings, BookOpen, Zap, Activity } from 'lucide-react';
import { GradeLevel } from '../types';

interface SidebarProps {
  currentGrade: GradeLevel | null;
  onSelectGrade: (grade: GradeLevel | null) => void;
  onOpenSettings?: () => void;
  onOpenGuide: () => void;
  className?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ currentGrade, onSelectGrade, onOpenSettings, onOpenGuide, className }) => {
  const gradeConfig = {
    [GradeLevel.Grade12]: { icon: Atom, label: 'Lớp 12', dot: '#9065B0' },
    [GradeLevel.Grade11]: { icon: Zap, label: 'Lớp 11', dot: '#6B7CDB' },
    [GradeLevel.Grade10]: { icon: Activity, label: 'Lớp 10', dot: '#448361' },
  };

  return (
    <div
      className={`w-64 h-full flex flex-col fixed left-0 top-0 z-10 ${className}`}
      style={{ background: '#E8E7E2', borderRight: '1px solid #D5D3CE' }}
    >
      {/* Logo — có accent line trên cùng */}
      <div
        onClick={() => onSelectGrade(null)}
        className="px-5 pt-5 pb-4 flex items-center gap-2.5 cursor-pointer group/logo"
        style={{ borderBottom: '1px solid #D5D3CE' }}
        title="Quay về Trang tổng quan"
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg, #6B7CDB, #9065B0)' }}
        >
          <Atom className="w-4 h-4 text-white" />
        </div>
        <div>
          <h1
            id="tour-logo"
            className="font-semibold text-sm leading-tight"
            style={{ color: '#1A1A1A' }}
          >
            PhysiVault
          </h1>
          <p className="text-[11px] leading-tight" style={{ color: '#A8A5A0' }}>
            Kho lưu trữ vật lý
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 overflow-y-auto space-y-0.5">

        {/* Home */}
        <button
          onClick={() => onSelectGrade(null)}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors text-left relative overflow-hidden"
          style={{
            background: currentGrade === null ? '#DDDBD6' : 'transparent',
            color: currentGrade === null ? '#1A1A1A' : '#57564F',
            fontWeight: currentGrade === null ? 500 : 400,
          }}
          onMouseEnter={e => { if (currentGrade !== null) (e.currentTarget as HTMLElement).style.background = '#E0DED9'; }}
          onMouseLeave={e => { if (currentGrade !== null) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          {/* Left accent bar */}
          {currentGrade === null && (
            <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full" style={{ background: '#6B7CDB' }} />
          )}
          <Home className="w-4 h-4 shrink-0 ml-1" style={{ color: currentGrade === null ? '#6B7CDB' : '#A8A5A0' }} />
          Tổng quan
        </button>

        {/* Guide */}
        <button
          onClick={onOpenGuide}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors text-left"
          style={{ color: '#57564F', fontWeight: 400 }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#E0DED9'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
        >
          <BookOpen className="w-4 h-4 shrink-0 ml-1" style={{ color: '#A8A5A0' }} />
          Hướng dẫn sử dụng
        </button>

        {/* Section label */}
        <div className="pt-4 pb-1 px-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#A8A5A0' }}>
            Khối Lớp
          </p>
        </div>

        {/* Grade items */}
        {[GradeLevel.Grade12, GradeLevel.Grade11, GradeLevel.Grade10].map((grade) => {
          const isSelected = currentGrade === grade;
          const { icon: Icon, label, dot } = gradeConfig[grade];

          return (
            <button
              key={grade}
              onClick={() => onSelectGrade(grade)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors text-left relative overflow-hidden"
              style={{
                background: isSelected ? '#DDDBD6' : 'transparent',
                color: isSelected ? '#1A1A1A' : '#57564F',
                fontWeight: isSelected ? 500 : 400,
              }}
              onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = '#E0DED9'; }}
              onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              {/* Left accent bar — màu theo khối lớp */}
              {isSelected && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full" style={{ background: dot }} />
              )}
              <span
                className="w-2 h-2 rounded-full shrink-0 ml-1"
                style={{ background: dot, opacity: isSelected ? 1 : 0.45 }}
              />
              <Icon className="w-4 h-4 shrink-0" style={{ color: isSelected ? dot : '#A8A5A0' }} />
              {label}
            </button>
          );
        })}
      </nav>

      {/* Settings */}
      <div className="hidden md:block p-2 pt-1" style={{ borderTop: '1px solid #D5D3CE' }}>
        <button
          id="tour-settings-btn"
          onClick={onOpenSettings}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors"
          style={{ color: '#57564F' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#E0DED9'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
        >
          <Settings className="w-4 h-4 shrink-0 ml-1" style={{ color: '#A8A5A0' }} />
          Cài đặt &amp; Đồng bộ
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
