import React, { useState, useMemo } from 'react';
import { GradeLevel, Lesson } from './types';
import { CURRICULUM } from './constants';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ChapterView from './components/ChapterView';
import LessonView from './components/LessonView';
import Toast, { ToastType } from './components/Toast';
import { useCloudStorage } from './src/hooks/useCloudStorage';
import { Menu, FileText, ChevronRight, FolderOpen, Loader2, Settings, Plus } from 'lucide-react';

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
  const { lessons, storedFiles, loading, addLesson, deleteLesson, uploadFiles, deleteFile } = useCloudStorage();

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
        <div className="space-y-8 animate-fade-in relative z-0">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-6 backdrop-blur-sm bg-white/30 w-fit px-4 py-2 rounded-full border border-white/50 shadow-sm">
            <span onClick={() => setCurrentGrade(null)} className="cursor-pointer hover:text-indigo-600 font-medium transition-colors">Tổng quan</span>
            <ChevronRight className="w-4 h-4" />
            <span className="font-semibold text-indigo-700">{activeGradeData.title}</span>
          </div>

          <div className="flex items-end justify-between relative">
            <div className="relative z-10">
              <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 mb-3 tracking-tight">
                {activeGradeData.title}
              </h1>
              <p className="text-slate-500 text-lg font-light">Quản lý và theo dõi tiến độ học tập</p>
            </div>
            {/* Decoration */}
            <div className="absolute -top-10 -left-10 w-32 h-32 bg-purple-200/50 rounded-full blur-3xl -z-10"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
            {activeGradeData.chapters.map((chapter) => {
              const chapterLessons = lessons.filter((l) => l.chapterId === chapter.id);
              const chapterFileCount = chapterLessons.reduce((sum, lesson) => {
                return sum + (storedFiles[lesson.id]?.length || 0);
              }, 0);

              return (
                <div
                  key={chapter.id}
                  onClick={() => setCurrentChapterId(chapter.id)}
                  className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/60 shadow-sm hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1 hover:border-indigo-200 transition-all duration-300 cursor-pointer group relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 rounded-bl-full -z-0 group-hover:scale-150 transition-transform duration-500"></div>

                  <div className="flex items-start justify-between mb-5 relative z-10">
                    <div className="p-3.5 bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl group-hover:from-indigo-600 group-hover:to-purple-600 transition-all duration-300 shadow-inner group-hover:shadow-lg group-hover:shadow-indigo-500/30">
                      <FolderOpen className="w-6 h-6 text-indigo-600 group-hover:text-white transition-colors" />
                    </div>
                    <div className="flex items-center gap-3">

                      <div className="flex flex-col items-end gap-0.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bài học</span>
                        <span className="text-2xl font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{chapterLessons.length}</span>
                      </div>
                    </div>
                  </div>

                  <h3 className="font-bold text-lg text-slate-800 mb-2 group-hover:text-indigo-700 transition-colors line-clamp-1">
                    {chapter.name}
                  </h3>
                  <p className="text-sm text-slate-500 mb-6 line-clamp-2 h-10 leading-relaxed font-light">{chapter.description}</p>

                  <div className="flex items-center gap-4 text-xs font-medium text-slate-500 pt-4 border-t border-slate-100 group-hover:border-indigo-100 transition-colors relative z-10">
                    <div className="flex items-center gap-1.5 bg-slate-100/50 px-2 py-1 rounded-md group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                      <FileText className="w-3.5 h-3.5" />
                      <span>{chapterFileCount} tài liệu</span>
                    </div>
                    <ChevronRight className="w-4 h-4 ml-auto text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-transform" />
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

  return (
    <div className="min-h-screen bg-slate-50 relative overflow-hidden font-sans text-slate-900">
      {/* Background Decoration */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-purple-200/30 rounded-full blur-[100px] animate-float opacity-60"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-indigo-200/30 rounded-full blur-[100px] animate-float opacity-60" style={{ animationDelay: '2s' }}></div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-2xl transform transition-transform duration-300 ease-out md:hidden ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
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
        <header className="bg-white/80 backdrop-blur-md border-b border-gray-200/50 p-4 flex items-center justify-between md:hidden sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 active:scale-95 transition-transform"
            >
              <Menu className="w-6 h-6" />
            </button>
            <span id="tour-logo" className="font-bold text-lg text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">PhysiVault</span>
          </div>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 active:scale-95 transition-transform"
          >
            <Settings className="w-6 h-6" />
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
      {/* Chatbot Component */}
      <Chatbot />
    </div>
  );
}

export default App;
