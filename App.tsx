import React, { useState, useMemo } from 'react';
import { GradeLevel, Lesson } from './types';
import { CURRICULUM } from './constants';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ChapterView from './components/ChapterView';
import LessonView from './components/LessonView';
import Toast, { ToastType } from './components/Toast';
import { useCloudStorage } from './src/hooks/useCloudStorage';
import { Menu, FileText, ChevronRight, FolderOpen, RefreshCw, Settings, Plus, Ban, ShieldOff, WifiOff, MessageCircle, X, Send, Bot, User, Copy, Check } from 'lucide-react';
import { getMachineId } from './src/hooks/useCloudStorage';

const Loader2 = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <RefreshCw className={`${className} animate-spin`} style={style} />
);

import SettingsModal from './components/SettingsModal';
import GuideModal from './components/GuideModal';
import Chatbot from './components/Chatbot';
import AdminDashboard from './components/AdminDashboard';
import AdminGitHubSync from './components/AdminGitHubSync';

interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
}

function App() {
  const [currentGrade, setCurrentGrade] = useState<GradeLevel | null>(null);
  const [currentChapterId, setCurrentChapterId] = useState<string | null>(null);
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
  const [autoCreateLesson, setAutoCreateLesson] = useState(false);

  // Replace local state with Cloud Storage hook
  const { lessons, storedFiles, loading, isActivated, activateSystem, addLesson, deleteLesson, uploadFiles, deleteFile, verifyAccess, fetchLessonsFromGitHub, syncToGitHub, syncProgress } = useCloudStorage();

  const [isKicked, setIsKicked] = useState(false);
  const [isOfflineExpired, setIsOfflineExpired] = useState(false);

  // Check access on mount
  React.useEffect(() => {
    const check = async () => {
      if (isActivated) {
        const status = await verifyAccess();
        if (status === 'kicked') {
          setIsKicked(true);
          setIsOfflineExpired(false);
        } else if (status === 'offline_expired') {
          setIsOfflineExpired(true);
        } else {
          setIsOfflineExpired(false);
        }
      }
    };
    check();
    // Check every 5 minutes
    const interval = setInterval(check, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isActivated]);

  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    return localStorage.getItem('physivault_is_admin') === 'true';
  });

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const [showGitHubSync, setShowGitHubSync] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const toggleAdmin = (status: boolean) => {
    setIsAdmin(status);
    localStorage.setItem('physivault_is_admin', status ? 'true' : 'false');
  };

  // Toast helper
  const showToast = (message: string, type: ToastType = 'success') => {
    const id = Math.random().toString(36).substring(7);
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Derived state
  const activeGradeData = useMemo(() =>
    CURRICULUM.find(g => g.level === currentGrade),
    [currentGrade]);

  const activeChapterData = useMemo(() =>
    activeGradeData?.chapters.find(c => c.id === currentChapterId),
    [activeGradeData, currentChapterId]);

  const chapterLessons = useMemo(() =>
    lessons.filter(l => l.chapterId === currentChapterId).sort((a, b) => b.createdAt - a.createdAt),
    [lessons, currentChapterId]);

  // Lesson Actions
  const handleCreateLesson = async (name: string, chapterId: string) => {
    try {
      await addLesson(name, chapterId);
      showToast(`Đã tạo bài học: ${name}`, 'success');
    } catch (error) {
      showToast('Lỗi khi tạo bài học', 'error');
    }
  };

  const handleDeleteLesson = async (lessonId: string) => {
    const lessonToDelete = lessons.find(l => l.id === lessonId);
    if (!lessonToDelete) return;

    if (window.confirm(`Bạn có chắc chắn muốn xóa bài học "${lessonToDelete.name}" và tất cả tài liệu bên trong không?`)) {
      try {
        await deleteLesson(lessonId);
        showToast(`Đã xóa bài học: ${lessonToDelete.name}`, 'success');

        if (currentLesson?.id === lessonId) {
          setCurrentLesson(null);
        }
      } catch (e) {
        showToast('Lỗi khi xóa bài học', 'error');
      }
    }
  };

  // File Actions
  const handleUpload = async (files: File[], category?: string) => {
    if (!currentLesson) return;

    try {
      showToast('Đang tải lên...', 'warning');
      await uploadFiles(files, currentLesson.id, category);
      showToast(`Đã tải lên ${files.length} tài liệu`, 'success');
    } catch (e) {
      showToast('Lỗi tải lên', 'error');
    }
  };

  const handleChapterUpload = async (files: File[], category: string) => {
    if (!currentChapterId) return;

    try {
      showToast('Đang tải lên...', 'warning');
      await uploadFiles(files, currentChapterId, category);
      showToast(`Đã tải lên ${files.length} tài liệu`, 'success');
    } catch (e) {
      showToast('Lỗi tải lên', 'error');
    }
  };

  const handleDeleteFile = async (fileId: string, targetId: string) => {
    const fileToDelete = storedFiles[targetId]?.find(f => f.id === fileId);

    if (window.confirm(`Bạn có chắc chắn muốn xóa tài liệu "${fileToDelete?.name || 'này'}" không?`)) {
      try {
        await deleteFile(fileId, targetId);
        showToast(`Đã xóa tài liệu`, 'success');
      } catch (e) {
        showToast('Lỗi xóa file', 'error');
      }
    }
  };

  const getFileCounts = useMemo(() => {
    const counts = {
      [GradeLevel.Grade10]: 0,
      [GradeLevel.Grade11]: 0,
      [GradeLevel.Grade12]: 0,
    };

    CURRICULUM.forEach(grade => {
      let count = 0;
      grade.chapters.forEach(chapter => {
        const chapterLessons = lessons.filter(l => l.chapterId === chapter.id);
        chapterLessons.forEach(lesson => {
          count += (storedFiles[lesson.id]?.length || 0);
        });
      });
      counts[grade.level] = count;
    });

    return counts;
  }, [storedFiles, lessons]);

  const renderContent = () => {
    const activeGradeData = currentGrade ? CURRICULUM.find((g) => g.level === currentGrade) : null;

    // 1. Lesson View (Deepest level)
    if (currentLesson) {
      const lessonFiles = storedFiles[currentLesson.id] || [];
      return (
        <LessonView
          lesson={currentLesson}
          files={lessonFiles}
          isAdmin={isAdmin}
          onBack={() => setCurrentLesson(null)}
          onUpload={handleUpload}
          onDelete={(fileId) => handleDeleteFile(fileId, currentLesson.id)}
        />
      );
    }

    // 2. Chapter View (List of Lessons)
    if (currentChapterId && activeGradeData) {
      const chapter = activeGradeData.chapters.find((c) => c.id === currentChapterId);
      const chapterLessons = lessons.filter((l) => l.chapterId === currentChapterId);
      const chapterFiles = storedFiles[currentChapterId] || [];

      return (
        <ChapterView
          chapter={chapter!}
          lessons={chapterLessons}
          chapterFiles={chapterFiles}
          isAdmin={isAdmin}
          autoCreate={autoCreateLesson}
          onBack={() => {
            setCurrentChapterId(null);
            setAutoCreateLesson(false);
          }}
          onCreateLesson={(name) => {
            handleCreateLesson(name, currentChapterId);
            setAutoCreateLesson(false);
          }}
          onSelectLesson={setCurrentLesson}
          onDeleteLesson={handleDeleteLesson}
          onUploadChapterFile={handleChapterUpload}
          onDeleteChapterFile={(fileId) => handleDeleteFile(fileId, currentChapterId)}
        />
      );
    }

    // 3. Grade Overview (List of Chapters)
    if (activeGradeData) {
      return (
        <div className="space-y-6 animate-fade-in">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-sm" style={{ color: '#787774' }}>
            <span
              onClick={() => setCurrentGrade(null)}
              className="cursor-pointer transition-colors"
              style={{ color: '#787774' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#6B7CDB'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#787774'}
            >
              Tổng quan
            </span>
            <ChevronRight className="w-3.5 h-3.5" style={{ color: '#CFCFCB' }} />
            <span className="font-medium" style={{ color: '#1A1A1A' }}>{activeGradeData.title}</span>
          </div>

          {/* Title */}
          <div>
            <h1 className="text-2xl font-semibold mb-1" style={{ color: '#1A1A1A' }}>
              {activeGradeData.title}
            </h1>
            <p className="text-sm" style={{ color: '#787774' }}>Quản lý và theo dõi tiến độ học tập</p>
          </div>

          {/* Chapter Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeGradeData.chapters.map((chapter) => {
              const chapterLessons = lessons.filter((l) => l.chapterId === chapter.id);
              const chapterFileCount = chapterLessons.reduce((sum, lesson) => {
                return sum + (storedFiles[lesson.id]?.length || 0);
              }, 0);

              return (
                <div
                  key={chapter.id}
                  onClick={() => setCurrentChapterId(chapter.id)}
                  className="rounded-xl p-5 cursor-pointer group transition-colors"
                  style={{ background: '#FFFFFF', border: '1px solid #E9E9E7' }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = '#CFCFCB';
                    (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = '#E9E9E7';
                    (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                  }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className="p-2.5 rounded-lg"
                      style={{ background: '#EEF0FB' }}
                    >
                      <FolderOpen className="w-5 h-5" style={{ color: '#6B7CDB' }} />
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wider" style={{ color: '#AEACA8' }}>Bài học</div>
                      <div className="text-lg font-semibold" style={{ color: '#1A1A1A' }}>{chapterLessons.length}</div>
                    </div>
                  </div>

                  <h3 className="font-semibold text-sm mb-1 line-clamp-1" style={{ color: '#1A1A1A' }}>
                    {chapter.name}
                  </h3>
                  <p className="text-xs leading-relaxed mb-4 line-clamp-2" style={{ color: '#787774', minHeight: '2.5rem' }}>
                    {chapter.description}
                  </p>

                  <div
                    className="flex items-center justify-between pt-3 text-xs"
                    style={{ borderTop: '1px solid #F1F0EC' }}
                  >
                    <div className="flex items-center gap-1" style={{ color: '#AEACA8' }}>
                      <FileText className="w-3.5 h-3.5" />
                      <span>{chapterFileCount} tài liệu</span>
                    </div>
                    <ChevronRight className="w-4 h-4" style={{ color: '#CFCFCB' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // 4. Dashboard (Default)
    if (loading) {
      return (
        <div className="flex items-center justify-center h-[50vh]">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
          <span className="ml-3 text-lg font-medium text-indigo-600">từ từ nó đang load...</span>
        </div>
      );
    }

    return <Dashboard onSelectGrade={setCurrentGrade} fileCounts={getFileCounts} isAdmin={isAdmin} />;
  };

  // === KICKED SCREEN ===
  if (isKicked && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 font-sans" style={{ background: '#F7F6F3' }}>
        {/* Subtle grid pattern */}
        <div
          className="fixed inset-0 pointer-events-none opacity-[0.025]"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg,#1A1A1A 0,#1A1A1A 1px,transparent 0,transparent 50%),repeating-linear-gradient(90deg,#1A1A1A 0,#1A1A1A 1px,transparent 0,transparent 50%)',
            backgroundSize: '40px 40px',
          }}
        />

        <div className="relative max-w-sm w-full animate-fade-in">
          {/* Brand top */}
          <div className="text-center mb-8">
            <span className="text-[11px] font-bold uppercase tracking-[0.25em]" style={{ color: '#CFCFCB' }}>
              PhysiVault
            </span>
          </div>

          {/* Main card */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: '#FFFFFF', border: '1px solid #E9E9E7', boxShadow: '0 8px 32px rgba(0,0,0,0.06)' }}
          >
            {/* Red accent top bar */}
            <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg,#E03E3E,#F87171)' }} />

            <div className="p-8 text-center space-y-6">
              {/* Icon with ring glow */}
              <div className="mx-auto relative w-fit">
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto"
                  style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}
                >
                  <ShieldOff className="w-9 h-9 text-[#E03E3E]" />
                </div>
                {/* Pulse ring */}
                <div
                  className="absolute inset-0 rounded-2xl animate-ping opacity-10"
                  style={{ background: '#E03E3E' }}
                />
              </div>

              {/* Text */}
              <div className="space-y-2.5">
                <div
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: '#FEF2F2', color: '#E03E3E', border: '1px solid #FECACA' }}
                >
                  <Ban className="w-3 h-3" />
                  Quyền truy cập bị thu hồi
                </div>
                <h1 className="text-xl font-semibold tracking-tight" style={{ color: '#1A1A1A' }}>
                  Thiết bị này đã bị khóa
                </h1>
                <p className="text-sm leading-relaxed" style={{ color: '#787774' }}>
                  Quản trị viên đã thu hồi quyền truy cập của thiết bị bạn.
                  Bạn không thể xem tài liệu trên thiết bị này nữa.
                </p>
              </div>

              {/* Info rows */}
              <div
                className="rounded-xl overflow-hidden text-left"
                style={{ border: '1px solid #E9E9E7' }}
              >
                <div
                  className="flex items-center justify-between px-4 py-3 text-xs"
                  style={{ background: '#F7F6F3', borderBottom: '1px solid #E9E9E7' }}
                >
                  <span style={{ color: '#AEACA8', fontWeight: 600 }}>TRẠNG THÁI</span>
                  <span
                    className="flex items-center gap-1.5 font-bold uppercase tracking-wide"
                    style={{ color: '#E03E3E' }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#E03E3E] animate-pulse inline-block" />
                    Đã bị khóa
                  </span>
                </div>
                <div
                  className="px-4 py-3.5 space-y-1"
                  style={{ background: '#FFFFFF' }}
                >
                  <p className="text-xs font-medium" style={{ color: '#57564F' }}>
                    Nếu bạn cho rằng đây là nhầm lẫn, hãy liên hệ:
                  </p>
                  <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>
                    Thầy Huy — Quản trị viên PhysiVault
                  </p>
                </div>
              </div>

              {/* Contact CTA */}
              <a
                href="https://zalo.me"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                style={{ background: '#1A1A1A', color: '#FFFFFF' }}
              >
                Liên hệ hỗ trợ
              </a>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-6">
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold" style={{ color: '#CFCFCB' }}>
              PhysiVault · Security System
            </p>
          </div>
        </div>
      </div>
    );
  }

  // === OFFLINE EXPIRED SCREEN ===
  if (isOfflineExpired && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 font-sans" style={{ background: '#F7F6F3' }}>
        {/* Subtle grid pattern */}
        <div
          className="fixed inset-0 pointer-events-none opacity-[0.025]"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg,#1A1A1A 0,#1A1A1A 1px,transparent 0,transparent 50%),repeating-linear-gradient(90deg,#1A1A1A 0,#1A1A1A 1px,transparent 0,transparent 50%)',
            backgroundSize: '40px 40px',
          }}
        />

        <div className="relative max-w-sm w-full animate-fade-in">
          {/* Brand top */}
          <div className="text-center mb-8">
            <span className="text-[11px] font-bold uppercase tracking-[0.25em]" style={{ color: '#CFCFCB' }}>
              PhysiVault
            </span>
          </div>

          {/* Main card */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: '#FFFFFF', border: '1px solid #E9E9E7', boxShadow: '0 8px 32px rgba(0,0,0,0.06)' }}
          >
            {/* Orange accent top bar */}
            <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg,#D9730D,#F59E0B)' }} />

            <div className="p-8 text-center space-y-6">
              {/* Icon */}
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto"
                style={{ background: '#FFF7ED', border: '1px solid #FED7AA' }}
              >
                <WifiOff className="w-9 h-9 text-[#D9730D]" />
              </div>

              {/* Text */}
              <div className="space-y-2.5">
                <div
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: '#FFF7ED', color: '#D9730D', border: '1px solid #FED7AA' }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#D9730D] animate-pulse inline-block" />
                  Yêu cầu kết nối mạng
                </div>
                <h1 className="text-xl font-semibold tracking-tight" style={{ color: '#1A1A1A' }}>
                  Phiên xác minh đã hết hạn
                </h1>
                <p className="text-sm leading-relaxed" style={{ color: '#787774' }}>
                  Hệ thống không thể xác minh quyền truy cập của bạn khi offline quá 24 giờ.
                  Vui lòng kết nối mạng để tiếp tục.
                </p>
              </div>

              {/* Info box */}
              <div
                className="rounded-xl p-4 text-left space-y-2"
                style={{ background: '#F7F6F3', border: '1px solid #E9E9E7' }}
              >
                <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#AEACA8' }}>Lưu ý</p>
                <p className="text-xs leading-relaxed" style={{ color: '#57564F' }}>
                  Quyền truy cập vẫn còn hiệu lực. Chỉ cần kết nối WiFi hoặc 4G rồi tải lại trang là tiếp tục học được ngay.
                </p>
              </div>

              {/* Action */}
              <button
                onClick={() => window.location.reload()}
                className="w-full py-3 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                style={{ background: '#D9730D', color: '#FFFFFF' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#c4650b'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#D9730D'}
              >
                Tải lại trang
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-6">
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold" style={{ color: '#CFCFCB' }}>
              PhysiVault · Security System
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans" style={{ background: '#F7F6F3', color: '#1A1A1A' }}>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ background: 'rgba(26,26,26,0.4)' }}
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 shadow-xl transform transition-transform duration-300 ease-out md:hidden ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`} style={{ background: '#F1F0EC', borderRight: '1px solid #E9E9E7' }}>
        <Sidebar
          currentGrade={currentGrade}
          onSelectGrade={(g) => {
            setCurrentGrade(g);
            setCurrentChapterId(null);
            setCurrentLesson(null);
            setIsMobileMenuOpen(false);
          }}
          onOpenSettings={() => {
            setIsSettingsOpen(true);
            setIsMobileMenuOpen(false);
          }}
          onOpenGuide={() => {
            setIsGuideOpen(true);
            setIsMobileMenuOpen(false);
          }}
          className="w-full"
        />
      </div>

      {/* Desktop Sidebar */}
      <Sidebar
        currentGrade={currentGrade}
        onSelectGrade={(g) => {
          setCurrentGrade(g);
          setCurrentChapterId(null);
          setCurrentLesson(null);
        }}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenGuide={() => setIsGuideOpen(true)}
        className="hidden md:flex"
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onShowToast={showToast}
        isAdmin={isAdmin}
        isActivated={isActivated}
        lessons={lessons}
        storedFiles={storedFiles}
        onActivateSystem={activateSystem}
        onFetchLessons={fetchLessonsFromGitHub}
        onToggleAdmin={toggleAdmin}
        onOpenDashboard={() => {
          setShowAdminDashboard(true);
          setIsSettingsOpen(false);
        }}
      />

      <GuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        isAdmin={isAdmin}
      />

      {showAdminDashboard && (
        <AdminDashboard
          onBack={() => setShowAdminDashboard(false)}
          onShowToast={showToast}
          onOpenGitHubSync={() => {
            setShowAdminDashboard(false);
            setShowGitHubSync(true);
          }}
        />
      )}

      {showGitHubSync && (
        <AdminGitHubSync
          onBack={() => setShowGitHubSync(false)}
          onShowToast={showToast}
          lessons={lessons}
          storedFiles={storedFiles}
          onAddLesson={addLesson}
          onDeleteLesson={deleteLesson}
          onUploadFiles={uploadFiles}
          onDeleteFile={deleteFile}
          onSyncToGitHub={syncToGitHub}
          syncProgress={syncProgress}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen transition-all duration-300">

        {/* Mobile Header */}
        <header
          className="p-3.5 flex items-center justify-between md:hidden sticky top-0 z-30"
          style={{ background: '#F1F0EC', borderBottom: '1px solid #E9E9E7' }}
        >
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 rounded-lg transition-colors"
              style={{ color: '#57564F' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#EBEBEA'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
            >
              <Menu className="w-5 h-5" />
            </button>
            <span id="tour-logo" className="font-semibold text-sm" style={{ color: '#1A1A1A' }}>PhysiVault</span>
          </div>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 rounded-lg transition-colors"
            style={{ color: '#57564F' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#EBEBEA'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
          >
            <Settings className="w-5 h-5" />
          </button>
        </header>

        <main className="flex-1 p-4 md:p-8 lg:p-10 max-w-7xl mx-auto w-full">
          {renderContent()}
        </main>
      </div>

      {/* Toast Container */}
      <div className="fixed bottom-0 right-0 p-4 space-y-2 z-50">
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
      {/* Chatbot Component - Only show on Dashboard (Overview) */}
      {!currentGrade && !showAdminDashboard && <Chatbot />}
    </div>
  );
}

export default App;
