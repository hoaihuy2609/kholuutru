import React, { useState, useRef, useEffect } from 'react';
import { Atom, Home, Settings, BookOpenCheck, Zap, Activity, ClipboardList, Bell, FlaskConical, ChevronDown, Shield, Search, FileText, Users, FileCheck, CalendarDays, Library } from 'lucide-react';
import { GradeLevel } from '../types';

// ── Hover Prefetch: tải ngầm chunk khi user lướt chuột qua nút ──────────
// Mỗi route chỉ được prefetch 1 lần duy nhất, không tải lại nữa.
const prefetched = new Set<string>();
const prefetch = (key: string, importer: () => Promise<unknown>) => {
  if (prefetched.has(key)) return;
  prefetched.add(key);
  // requestIdleCallback để không chặn main thread
  const run = () => void importer().catch(() => prefetched.delete(key));
  if ('requestIdleCallback' in window) {
    requestIdleCallback(run, { timeout: 2000 });
  } else {
    setTimeout(run, 0);
  }
};

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
  onOpenSimLab?: () => void;
  showSimLab?: boolean;
  onOpenBlog?: () => void;
  showBlog?: boolean;
  onOpenCommunity?: () => void;
  showCommunity?: boolean;
  className?: string;
  isAdmin?: boolean;
  previewMode?: GradeLevel | null;
  onSetPreviewMode?: (mode: GradeLevel | null) => void;
  studentGrade?: number | null;
  onOpenSearch?: () => void;
  onOpenSolutionEditor?: () => void;
}

// ── Custom dropdown options ──────────────────────────────────────────
const PREVIEW_OPTIONS = [
  { value: 'admin', label: 'Admin (Mặc định)', color: '#1A1A1A', bg: '#F1F0EC', border: '#E9E9E7', dot: '#AEACA8', icon: Shield },
  { value: String(GradeLevel.Grade12), label: 'Học sinh Lớp 12', color: '#9065B0', bg: '#F3ECF8', border: '#C8A8DC', dot: '#9065B0', icon: Atom },
  { value: String(GradeLevel.Grade11), label: 'Học sinh Lớp 11', color: '#6B7CDB', bg: '#EEF0FB', border: '#B8C1EF', dot: '#6B7CDB', icon: Zap },
  { value: String(GradeLevel.Grade10), label: 'Học sinh Lớp 10', color: '#448361', bg: '#EAF3EE', border: '#B7D9C4', dot: '#448361', icon: Activity },
];

const Sidebar: React.FC<SidebarProps> = ({ currentGrade, onSelectGrade, onOpenSettings, onOpenExamList, showExamList, onOpenContactBook, showContactBook, onOpenStudyPlanner, showStudyPlanner, onOpenNotification, showNotification, notificationUnreadCount, onOpenSimLab, showSimLab, onOpenBlog, showBlog, onOpenCommunity, showCommunity, className, isAdmin, previewMode, onSetPreviewMode, studentGrade, onOpenSearch, onOpenSolutionEditor }) => {
  const gradeConfig = {
    [GradeLevel.Grade12]: { icon: Atom, label: 'Lớp 12', dot: '#9065B0' },
    [GradeLevel.Grade11]: { icon: Zap, label: 'Lớp 11', dot: '#6B7CDB' },
    [GradeLevel.Grade10]: { icon: Activity, label: 'Lớp 10', dot: '#448361' },
  };

  // ── Custom dropdown state ──
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  const currentValue = previewMode ? String(previewMode) : 'admin';
  const selectedOption = PREVIEW_OPTIONS.find(o => o.value === currentValue) ?? PREVIEW_OPTIONS[0];
  const SelectedIcon = selectedOption.icon;

  const handleSelect = (value: string) => {
    if (onSetPreviewMode) {
      onSetPreviewMode(value === 'admin' ? null : Number(value) as GradeLevel);
    }
    setDropdownOpen(false);
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
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left"
          style={{
            background: currentGrade === null && !showExamList && !showContactBook && !showStudyPlanner && !showNotification && !showSimLab && !showBlog && !showCommunity ? '#E3E2DE' : 'transparent',
            color: currentGrade === null && !showExamList && !showContactBook && !showStudyPlanner && !showNotification && !showSimLab && !showBlog && !showCommunity ? '#1A1A1A' : '#57564F',
            fontWeight: currentGrade === null && !showExamList && !showContactBook && !showStudyPlanner && !showNotification && !showSimLab && !showBlog && !showCommunity ? 500 : 400,
          }}
          onMouseEnter={e => { if (!(currentGrade === null && !showExamList && !showContactBook && !showStudyPlanner && !showNotification && !showSimLab && !showBlog && !showCommunity)) (e.currentTarget as HTMLElement).style.background = '#EBEBEA'; }}
          onMouseLeave={e => { if (!(currentGrade === null && !showExamList && !showContactBook && !showStudyPlanner && !showNotification && !showSimLab && !showBlog && !showCommunity)) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          <Home className="w-4 h-4 shrink-0" style={{ color: currentGrade === null && !showExamList && !showContactBook && !showStudyPlanner && !showNotification && !showSimLab && !showBlog && !showCommunity ? '#1A1A1A' : '#AEACA8' }} />
          Tổng quan
        </button>

        {/* Search */}
        {onOpenSearch && (
          <button
            onClick={onOpenSearch}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left"
            style={{ color: '#57564F' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#EBEBEA'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
          >
            <Search className="w-4 h-4 shrink-0" style={{ color: '#AEACA8' }} />
            <span className="flex-1">Tìm kiếm</span>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: '#F1F0EC', color: '#AEACA8', border: '1px solid #E9E9E7' }}>Ctrl+K</span>
          </button>
        )}


        {/* Thi Thử */}
        {onOpenExamList && (
          <button
            onClick={() => { onOpenExamList(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left"
            style={{
              background: showExamList ? '#EEF0FB' : 'transparent',
              color: showExamList ? '#6B7CDB' : '#57564F',
              fontWeight: showExamList ? 500 : 400,
            }}
            onMouseEnter={e => {
              prefetch('ExamListPage', () => import('./ExamListPage'));
              prefetch('ExamView', () => import('./ExamView'));
              if (!showExamList) (e.currentTarget as HTMLElement).style.background = '#EBEBEA';
            }}
            onMouseLeave={e => { if (!showExamList) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <FileCheck className="w-4 h-4 shrink-0" style={{ color: showExamList ? '#6B7CDB' : '#AEACA8' }} />
            <span>Thi Thử</span>
          </button>
        )}

        {/* Sổ liên lạc */}
        {onOpenContactBook && (
          <button
            onClick={() => { onOpenContactBook(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left"
            style={{
              background: showContactBook ? '#F3ECF8' : 'transparent',
              color: showContactBook ? '#9065B0' : '#57564F',
              fontWeight: showContactBook ? 500 : 400,
            }}
            onMouseEnter={e => {
              prefetch('ContactBook', () => import('./ContactBook'));
              if (!showContactBook) (e.currentTarget as HTMLElement).style.background = '#EBEBEA';
            }}
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
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left"
            style={{
              background: showStudyPlanner ? '#EAF3EE' : 'transparent',
              color: showStudyPlanner ? '#448361' : '#57564F',
              fontWeight: showStudyPlanner ? 500 : 400,
            }}
            onMouseEnter={e => {
              prefetch('StudyPlanner', () => import('./StudyPlanner'));
              if (!showStudyPlanner) (e.currentTarget as HTMLElement).style.background = '#EBEBEA';
            }}
            onMouseLeave={e => { if (!showStudyPlanner) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <CalendarDays className="w-4 h-4 shrink-0" style={{ color: showStudyPlanner ? '#448361' : '#AEACA8' }} />
            <span>Mục Tiêu &amp; Lịch Trình</span>
          </button>
        )}

        {/* Thông Báo */}
        {onOpenNotification && (
          <button
            onClick={() => { onOpenNotification(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left"
            style={{
              background: showNotification ? '#FEF2F2' : 'transparent',
              color: showNotification ? '#E03E3E' : '#57564F',
              fontWeight: showNotification ? 500 : 400,
            }}
            onMouseEnter={e => {
              prefetch('NotificationPage', () => import('./NotificationPage'));
              if (!showNotification) (e.currentTarget as HTMLElement).style.background = '#EBEBEA';
            }}
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

        {/* Phòng Thí Nghiệm */}
        {onOpenSimLab && (
          <button
            onClick={() => { onOpenSimLab(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left"
            style={{
              background: showSimLab ? '#E8F4F8' : 'transparent',
              color: showSimLab ? '#2878BD' : '#57564F',
              fontWeight: showSimLab ? 500 : 400,
            }}
            onMouseEnter={e => {
              prefetch('SimulationLab', () => import('./SimulationLab'));
              if (!showSimLab) (e.currentTarget as HTMLElement).style.background = '#EBEBEA';
            }}
            onMouseLeave={e => { if (!showSimLab) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <FlaskConical className="w-4 h-4 shrink-0" style={{ color: showSimLab ? '#2878BD' : '#AEACA8' }} />
            <span>Phòng TN</span>
          </button>
        )}

        {/* Góc Học Tập / Blog */}
        {onOpenBlog && (
          <button
            onClick={() => { onOpenBlog(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left"
            style={{
              background: showBlog ? '#FFF7ED' : 'transparent',
              color: showBlog ? '#D9730D' : '#57564F',
              fontWeight: showBlog ? 500 : 400,
            }}
            onMouseEnter={e => {
              prefetch('BlogList', () => import('./BlogList'));
              prefetch('BlogDetail', () => import('./BlogDetail'));
              if (!showBlog) (e.currentTarget as HTMLElement).style.background = '#EBEBEA';
            }}
            onMouseLeave={e => { if (!showBlog) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <Library className="w-4 h-4 shrink-0" style={{ color: showBlog ? '#D9730D' : '#AEACA8' }} />
            <span>Góc Học Tập</span>
          </button>
        )}

        {/* Cộng Đồng Hỏi Đáp */}
        {onOpenCommunity && (
          <button
            onClick={() => { onOpenCommunity(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left"
            style={{
              background: showCommunity ? '#F0FDFA' : 'transparent',
              color: showCommunity ? '#0D9488' : '#57564F',
              fontWeight: showCommunity ? 500 : 400,
            }}
            onMouseEnter={e => {
              prefetch('CommunityPage', () => import('./CommunityPage'));
              if (!showCommunity) (e.currentTarget as HTMLElement).style.background = '#EBEBEA';
            }}
            onMouseLeave={e => { if (!showCommunity) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <Users className="w-4 h-4 shrink-0" style={{ color: showCommunity ? '#0D9488' : '#AEACA8' }} />
            <span>Cộng Đồng Hỏi Đáp</span>
          </button>
        )}

        {/* Section label */}
        <div className="pt-4 pb-1 px-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#AEACA8' }}>
            Khối Lớp
          </p>
        </div>

        {/* Grade items */}
        {(previewMode
          ? [previewMode]
          : !isAdmin && studentGrade
            ? [studentGrade as GradeLevel]
            : [GradeLevel.Grade12, GradeLevel.Grade11, GradeLevel.Grade10]
        ).map((grade) => {
          const isSelected = currentGrade === grade;
          const { icon: Icon, label, dot } = gradeConfig[grade];

          return (
            <button
              key={grade}
              onClick={() => onSelectGrade(grade)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left"
              style={{
                background: isSelected ? '#E3E2DE' : 'transparent',
                color: isSelected ? '#1A1A1A' : '#57564F',
                fontWeight: isSelected ? 500 : 400,
              }}
              onMouseEnter={e => {
                prefetch('ChapterView', () => import('./ChapterView'));
                if (!isSelected) (e.currentTarget as HTMLElement).style.background = '#EBEBEA';
              }}
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

      {/* Admin Panel & Settings */}
      {isAdmin && (
        <div className="p-3" style={{ borderTop: '1px solid #E9E9E7' }}>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-[#AEACA8] mb-2 px-1">
            Quản trị viên
          </div>

          {/* ── Custom Dropdown ── */}
          <div className="space-y-1 mb-3" ref={dropdownRef}>
            <label className="text-[11px] font-medium text-[#787774] px-1">Xem với tư cách:</label>
            <div className="relative">
              {/* Trigger button */}
              <button
                onClick={() => setDropdownOpen(prev => !prev)}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm transition-all"
                style={{
                  background: selectedOption.bg,
                  border: `1px solid ${selectedOption.border}`,
                  color: selectedOption.color,
                }}
              >
                <SelectedIcon className="w-3.5 h-3.5 shrink-0" style={{ color: selectedOption.dot }} />
                <span className="flex-1 text-left font-medium text-[13px]">{selectedOption.label}</span>
                <ChevronDown
                  className="w-3.5 h-3.5 shrink-0 transition-transform duration-200"
                  style={{
                    color: selectedOption.dot,
                    transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}
                />
              </button>

              {/* Dropdown list */}
              {dropdownOpen && (
                <div
                  className="absolute bottom-full left-0 w-full mb-1 rounded-xl overflow-hidden z-50"
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E9E9E7',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
                  }}
                >
                  {PREVIEW_OPTIONS.map(opt => {
                    const OptIcon = opt.icon;
                    const isActive = opt.value === currentValue;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => handleSelect(opt.value)}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors"
                        style={{
                          background: isActive ? opt.bg : 'transparent',
                          color: isActive ? opt.color : '#57564F',
                          fontWeight: isActive ? 600 : 400,
                          borderLeft: isActive ? `3px solid ${opt.dot}` : '3px solid transparent',
                        }}
                        onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = '#F7F6F3'; }}
                        onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                      >
                        <OptIcon className="w-4 h-4 shrink-0" style={{ color: isActive ? opt.dot : '#AEACA8' }} />
                        <span>{opt.label}</span>
                        {isActive && (
                          <span
                            className="ml-auto w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ background: opt.dot }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {!previewMode && (
            <>
              <button
                id="tour-settings-btn"
                onClick={onOpenSettings}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors"
                style={{ color: '#57564F' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#EBEBEA'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                <Settings className="w-4 h-4 shrink-0" style={{ color: '#AEACA8' }} />
                Cài đặt &amp; Đồng bộ
              </button>
            </>
          )}
        </div>
      )}

      {/* Settings for normal user */}
      {!isAdmin && (
        <div className="p-2" style={{ borderTop: '1px solid #E9E9E7' }}>
          <button
            id="tour-settings-btn"
            onClick={onOpenSettings}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors"
            style={{ color: '#57564F' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#EBEBEA'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
          >
            <Settings className="w-4 h-4 shrink-0" style={{ color: '#AEACA8' }} />
            <span className="flex-1 text-left">Cài đặt &amp; Đồng bộ</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default React.memo(Sidebar);
