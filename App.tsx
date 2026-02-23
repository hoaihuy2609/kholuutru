import React, { useState, useMemo } from 'react';
import { GradeLevel, Lesson } from './types';
import { CURRICULUM } from './constants';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ChapterView from './components/ChapterView';
import LessonView from './components/LessonView';
import Toast, { ToastType } from './components/Toast';
import { useCloudStorage } from './src/hooks/useCloudStorage';
import { Menu, FileText, ChevronRight, FolderOpen, Loader2, Settings, Plus, Ban, ShieldOff, WifiOff } from 'lucide-react';

import SettingsModal from './components/SettingsModal';
import GuideModal from './components/GuideModal';
import Chatbot from './components/Chatbot';
import AdminDashboard from './components/AdminDashboard';

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
  const { lessons, storedFiles, loading, isActivated, addLesson, deleteLesson, uploadFiles, deleteFile, verifyAccess } = useCloudStorage();

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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-red-950 to-slate-900 flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full text-center space-y-8 animate-fade-in">
          {/* Icon */}
          <div className="relative mx-auto w-28 h-28">
            <div className="absolute inset-0 bg-red-500/20 rounded-full animate-ping" />
            <div className="relative w-28 h-28 bg-red-500/10 backdrop-blur-xl rounded-full flex items-center justify-center border-2 border-red-500/30">
              <ShieldOff className="w-14 h-14 text-red-400" />
            </div>
          </div>

          {/* Title */}
          <div className="space-y-3">
            <h1 className="text-3xl font-black text-white tracking-tight">TRUY CẬP BỊ TỪ CHỐI</h1>
            <p className="text-red-300/80 text-sm leading-relaxed font-medium">
              Thiết bị của bạn đã bị thu hồi quyền truy cập bởi Quản trị viên.<br />
              Bạn không thể xem tài liệu trên thiết bị này nữa.
            </p>
          </div>

          {/* Info Card */}
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-bold uppercase tracking-wider">Trạng thái</span>
              <span className="flex items-center gap-1.5 text-red-400 font-black">
                <Ban className="w-3.5 h-3.5" /> ĐÃ BỊ KICK
              </span>
            </div>
            <div className="h-px bg-white/10" />
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Nếu bạn cho rằng đây là nhầm lẫn, vui lòng liên hệ trực tiếp với Thầy Huy để được hỗ trợ.
            </p>
          </div>

          {/* Branding */}
          <div className="pt-4">
            <p className="text-[10px] text-slate-600 font-bold uppercase tracking-[0.3em]">
              PhysiVault Security System
            </p>
          </div>
        </div>
      </div>
    );
  }

  // === OFFLINE EXPIRED SCREEN ===
  if (isOfflineExpired && !isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full text-center space-y-8 animate-fade-in">
          {/* Icon */}
          <div className="relative mx-auto w-28 h-28">
            <div className="absolute inset-0 bg-amber-500/20 rounded-full animate-pulse" />
            <div className="relative w-28 h-28 bg-amber-500/10 backdrop-blur-xl rounded-full flex items-center justify-center border-2 border-amber-500/30">
              <WifiOff className="w-14 h-14 text-amber-400" />
            </div>
          </div>

          {/* Title */}
          <div className="space-y-3">
            <h1 className="text-2xl font-black text-white tracking-tight">CẦN KẾT NỐI MẠNG</h1>
            <p className="text-amber-300/80 text-sm leading-relaxed font-medium">
              Phiên xác minh offline của bạn đã hết hạn.<br />
              Vui lòng kết nối mạng để tiếp tục sử dụng.
            </p>
          </div>

          {/* Info Card */}
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 space-y-3">
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Hệ thống cần xác minh quyền truy cập của bạn mỗi 24 giờ. Sau khi có mạng, hãy tải lại trang.
            </p>
          </div>

          {/* Retry Button */}
          <button
            onClick={() => window.location.reload()}
            className="px-8 py-3 bg-amber-500 hover:bg-amber-400 text-slate-900 font-black rounded-2xl transition-all active:scale-95 shadow-lg shadow-amber-500/20"
          >
            Thử lại
          </button>

          {/* Branding */}
          <div className="pt-2">
            <p className="text-[10px] text-slate-600 font-bold uppercase tracking-[0.3em]">
              PhysiVault Security System
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
