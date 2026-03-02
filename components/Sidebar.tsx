import React from 'react';
import { Atom, Home, Settings, BookOpenCheck, Zap, Activity, ClipboardList, Bell } from 'lucide-react';
import { GradeLevel } from '../types';

interface SidebarProps {
  currentGrade: GradeLevel | null;
  onSelectGrade: (grade: GradeLevel | null) => void;
  onOpenSettings?: () => void;
  onOpenExamList?: () => void;
  showExamList?: boolean;
  onOpenContactBook?: () => void;
  showContactBook?: boolean;
  onOpenStudyPlanner?: () => void;
  showStudyPlanner?: boolean;
  onOpenNotification?: () => void;
  showNotification?: boolean;
  notificationUnreadCount?: number;
  className?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ currentGrade, onSelectGrade, onOpenSettings, onOpenExamList, showExamList, onOpenContactBook, showContactBook, onOpenStudyPlanner, showStudyPlanner, onOpenNotification, showNotification, notificationUnreadCount, className }) => {
  const gradeConfig = {
    [GradeLevel.Grade12]: { icon: Atom, label: 'Lớp 12', dot: '#9065B0' },
    [GradeLevel.Grade11]: { icon: Zap, label: 'Lớp 11', dot: '#6B7CDB' },
    [GradeLevel.Grade10]: { icon: Activity, label: 'Lớp 10', dot: '#448361' },
  };

  return (
    <div
      className={`w-64 h-full flex flex-col fixed left-0 top-0 z-10 ${className}`}
      style={{ background: '#F1F0EC', borderRight: '1px solid #E9E9E7' }}
    >
      {/* Logo */}
      <div
        onClick={() => onSelectGrade(null)}
        className="p-5 flex items-center gap-2.5 cursor-pointer group/logo transition-colors"
        style={{ borderBottom: '1px solid #E9E9E7' }}
        title="Quay về Trang tổng quan"
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: '#6B7CDB' }}
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
          <p className="text-[11px] leading-tight" style={{ color: '#AEACA8' }}>
            Kho lưu trữ vật lý
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 overflow-y-auto space-y-0.5">

        {/* Home */}
        <button
          onClick={() => onSelectGrade(null)}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors text-left"
          style={{
            background: currentGrade === null ? '#E3E2DE' : 'transparent',
            color: currentGrade === null ? '#1A1A1A' : '#57564F',
            fontWeight: currentGrade === null ? 500 : 400,
          }}
          onMouseEnter={e => { if (currentGrade !== null) (e.currentTarget as HTMLElement).style.background = '#EBEBEA'; }}
          onMouseLeave={e => { if (currentGrade !== null) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          <Home className="w-4 h-4 shrink-0" style={{ color: currentGrade === null ? '#1A1A1A' : '#AEACA8' }} />
          Tổng quan
        </button>


        {/* Thi Thử */}
        {onOpenExamList && (
          <button
            onClick={() => { onOpenExamList(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors text-left"
            style={{
              background: showExamList ? '#EEF0FB' : 'transparent',
              color: showExamList ? '#6B7CDB' : '#57564F',
              fontWeight: showExamList ? 500 : 400,
            }}
            onMouseEnter={e => { if (!showExamList) (e.currentTarget as HTMLElement).style.background = '#EBEBEA'; }}
            onMouseLeave={e => { if (!showExamList) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <ClipboardList className="w-4 h-4 shrink-0" style={{ color: showExamList ? '#6B7CDB' : '#AEACA8' }} />
            <span>Thi Thử</span>
          </button>
        )}

        {/* Sổ liên lạc */}
        {onOpenContactBook && (
          <button
            onClick={() => { onOpenContactBook(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors text-left"
            style={{
              background: showContactBook ? '#F3ECF8' : 'transparent',
              color: showContactBook ? '#9065B0' : '#57564F',
              fontWeight: showContactBook ? 500 : 400,
            }}
            onMouseEnter={e => { if (!showContactBook) (e.currentTarget as HTMLElement).style.background = '#EBEBEA'; }}
            onMouseLeave={e => { if (!showContactBook) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <BookOpenCheck className="w-4 h-4 shrink-0" style={{ color: showContactBook ? '#9065B0' : '#AEACA8' }} />
            <span>Sổ liên lạc</span>
          </button>
        )}

        {/* Lịch trình (Study Planner) */}
        {onOpenStudyPlanner && (
          <button
            onClick={() => { onOpenStudyPlanner(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors text-left"
            style={{
              background: showStudyPlanner ? '#EAF3EE' : 'transparent',
              color: showStudyPlanner ? '#448361' : '#57564F',
              fontWeight: showStudyPlanner ? 500 : 400,
            }}
            onMouseEnter={e => { if (!showStudyPlanner) (e.currentTarget as HTMLElement).style.background = '#EBEBEA'; }}
            onMouseLeave={e => { if (!showStudyPlanner) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <ClipboardList className="w-4 h-4 shrink-0" style={{ color: showStudyPlanner ? '#448361' : '#AEACA8' }} />
            <span>Mục Tiêu &amp; Lịch Trình</span>
          </button>
        )}

        {/* Thông Báo */}
        {onOpenNotification && (
          <button
            onClick={() => { onOpenNotification(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors text-left"
            style={{
              background: showNotification ? '#FEF2F2' : 'transparent',
              color: showNotification ? '#E03E3E' : '#57564F',
              fontWeight: showNotification ? 500 : 400,
            }}
            onMouseEnter={e => { if (!showNotification) (e.currentTarget as HTMLElement).style.background = '#EBEBEA'; }}
            onMouseLeave={e => { if (!showNotification) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <div className="relative shrink-0">
              <Bell className="w-4 h-4" style={{ color: showNotification ? '#E03E3E' : '#AEACA8' }} />
              {(notificationUnreadCount ?? 0) > 0 && (
                <span
                  className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] rounded-full flex items-center justify-center text-[8px] font-black"
                  style={{ background: '#E03E3E', color: '#fff', lineHeight: 1 }}
                >
                  {notificationUnreadCount! > 9 ? '9+' : notificationUnreadCount}
                </span>
              )}
            </div>
            <span>Thông Báo</span>
            {(notificationUnreadCount ?? 0) > 0 && (
              <span
                className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: '#FEF2F2', color: '#E03E3E' }}
              >
                {notificationUnreadCount} MỚI
              </span>
            )}
          </button>
        )}

        {/* Section label */}
        <div className="pt-4 pb-1 px-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#AEACA8' }}>
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
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors text-left"
              style={{
                background: isSelected ? '#E3E2DE' : 'transparent',
                color: isSelected ? '#1A1A1A' : '#57564F',
                fontWeight: isSelected ? 500 : 400,
              }}
              onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = '#EBEBEA'; }}
              onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: dot, opacity: isSelected ? 1 : 0.5 }}
              />
              <Icon className="w-4 h-4 shrink-0" style={{ color: isSelected ? '#1A1A1A' : '#AEACA8' }} />
              {label}
            </button>
          );
        })}
      </nav>

      {/* Settings — ẩn trên mobile (dùng gear icon ở header thay thế) */}
      <div className="hidden md:block p-2" style={{ borderTop: '1px solid #E9E9E7' }}>
        <button
          id="tour-settings-btn"
          onClick={onOpenSettings}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors"
          style={{ color: '#57564F' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#EBEBEA'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
        >
          <Settings className="w-4 h-4 shrink-0" style={{ color: '#AEACA8' }} />
          Cài đặt &amp; Đồng bộ
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
