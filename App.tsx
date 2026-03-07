import React, { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { GradeLevel, Lesson, Exam, ExamSubmission, BlogPost } from './types';
import { CURRICULUM } from './constants';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Toast, { ToastType } from './components/Toast';
import { useCloudStorage } from './src/hooks/useCloudStorage';
import { FileText, ChevronRight, FolderOpen, RefreshCw, Settings, Ban, ShieldOff, WifiOff, Atom, Home, Bell, FlaskConical, Video } from 'lucide-react';
import { getMachineId, verifyAdminToken, setAdminToken, clearAdminToken } from './src/lib/crypto';

const Loader2 = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <RefreshCw className={`${className} animate-spin`} style={style} />
);

// ── Lazy-loaded components (code-split) ──
const ChapterView = React.lazy(() => import('./components/ChapterView'));
const LessonView = React.lazy(() => import('./components/LessonView'));
const SettingsModal = React.lazy(() => import('./components/SettingsModal'));
const Chatbot = React.lazy(() => import('./components/Chatbot'));
const AdminDashboard = React.lazy(() => import('./components/AdminDashboard'));
const AdminGitHubSync = React.lazy(() => import('./components/AdminGitHubSync'));
const ExamListPage = React.lazy(() => import('./components/ExamListPage'));
const ExamView = React.lazy(() => import('./components/ExamView'));
const ExamResult = React.lazy(() => import('./components/ExamResult'));
const ContactBook = React.lazy(() => import('./components/ContactBook'));
const StudyPlanner = React.lazy(() => import('./components/StudyPlanner'));
const NotificationPage = React.lazy(() => import('./components/NotificationPage'));
const SimulationLab = React.lazy(() => import('./components/SimulationLab'));
const BlogList = React.lazy(() => import('./components/BlogList'));
const BlogDetail = React.lazy(() => import('./components/BlogDetail'));
const AdminBlogEditor = React.lazy(() => import('./components/AdminBlogEditor'));
// Suspense fallback
const LazyFallback = () => (
  <div className="flex items-center justify-center h-[40vh]">
    <RefreshCw className="w-8 h-8 animate-spin" style={{ color: '#6B7CDB' }} />
  </div>
);

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

  const { lessons, storedFiles, loading, isActivated, activateSystem, addLesson, deleteLesson, uploadFiles, deleteFile, verifyAccess, fetchLessonsFromGitHub, syncToGitHub, syncProgress, uploadExamPdf, saveExam, loadExams, deleteExam, saveExamResult, getExamHistory, getLeaderboard, getStudyPlans, saveStudyPlan, updateStudyPlan, deleteStudyPlan, getSchedules, saveSchedule, updateSchedule, deleteSchedule, getNotifications, deleteNotification, createCustomNotification, markNotificationFetched, getFetchedNotificationIds, submitQuestionVote, getQuestionVotes, getBlogs, saveBlog, deleteBlog, syncBlogs, fetchBlogsForEditing } = useCloudStorage();

  const [isAdmin, setIsAdmin] = useState<boolean>(() => verifyAdminToken());

  const toggleAdmin = useCallback((status: boolean) => {
    if (status) {
      setAdminToken();
    } else {
      clearAdminToken();
    }
    setIsAdmin(status);
  }, []);

  const [isKicked, setIsKicked] = useState(false);
  const [isOfflineExpired, setIsOfflineExpired] = useState(false);

  // Check access on mount — pauses when tab is hidden to avoid wasted requests
  React.useEffect(() => {
    const check = async () => {
      if (isActivated && !document.hidden) {
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
    // Check every 5 minutes, but only when tab is visible
    const interval = setInterval(check, 5 * 60 * 1000);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', check);
    };
  }, [isActivated]);

  // ── Tính unread notification badge — pauses when tab is hidden ──
  React.useEffect(() => {
    if (!isActivated) return;
    const loadUnread = async () => {
      // Skip network call when tab is not visible
      if (document.hidden) return;
      try {
        if (isAdmin) {
          // Admin: count unread across all 3 grades
          const [notifs10, notifs11, notifs12, fetched] = await Promise.all([
            getNotifications(10),
            getNotifications(11),
            getNotifications(12),
            getFetchedNotificationIds(),
          ]);
          const allNotifs = [...notifs10, ...notifs11, ...notifs12];
          const unread = allNotifs.filter(n => n.fetch_enabled && !fetched.has(n.id)).length;
          setNotificationUnreadCount(unread);
        } else {
          const grade = parseInt(localStorage.getItem('physivault_grade') || '12', 10);
          const [notifs, fetched] = await Promise.all([
            getNotifications(grade),
            getFetchedNotificationIds(),
          ]);
          const unread = notifs.filter(n => n.fetch_enabled && !fetched.has(n.id)).length;
          setNotificationUnreadCount(unread);
        }
      } catch { /* silent */ }
    };
    loadUnread();
    // Reload badge count every 2 minutes; also refresh when user returns to tab
    const interval = setInterval(loadUnread, 2 * 60 * 1000);
    document.addEventListener('visibilitychange', loadUnread);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', loadUnread);
    };
  }, [isActivated, isAdmin]);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const [showGitHubSync, setShowGitHubSync] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  // Exam state
  const [showExamList, setShowExamList] = useState(false);
  const [showContactBook, setShowContactBook] = useState(false);
  const [showStudyPlanner, setShowStudyPlanner] = useState(false);
  const [activeExam, setActiveExam] = useState<Exam | null>(null);
  const [examSubmission, setExamSubmission] = useState<ExamSubmission | null>(null);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
  const [showSimLab, setShowSimLab] = useState(false);
  const [showBlog, setShowBlog] = useState(false);
  const [activeBlog, setActiveBlog] = useState<BlogPost | null>(null);
  const [activeAdminBlog, setActiveAdminBlog] = useState<BlogPost | null>(null);
  const [isCreatingBlog, setIsCreatingBlog] = useState(false);
  const [allBlogs, setAllBlogs] = useState<BlogPost[]>([]); // cache bài viết cho related posts

  // --- PREVENT OVERLAPPING STATES ---
  const [previewMode, setPreviewMode] = useState<GradeLevel | null>(null);
  const effectiveIsAdmin = isAdmin && !previewMode;
  const [studentGradeValue, setStudentGradeValue] = useState<number | null>(() => {
    const g = parseInt(localStorage.getItem('physivault_grade') || '0', 10);
    return g === 10 || g === 11 || g === 12 ? g : null;
  });

  // Re-read grade from localStorage after activation (grade is set during activateSystem)
  useEffect(() => {
    if (isActivated) {
      const g = parseInt(localStorage.getItem('physivault_grade') || '0', 10);
      setStudentGradeValue(g === 10 || g === 11 || g === 12 ? g : null);
    }
  }, [isActivated]);

  // ── Centralized navigation helper (memoized to prevent child re-renders) ──
  const resetNavigation = useCallback(() => {
    setShowExamList(false);
    setShowContactBook(false);
    setShowStudyPlanner(false);
    setShowNotification(false);
    setShowSimLab(false);
    setShowBlog(false);
    setActiveExam(null);
    setExamSubmission(null);
    setCurrentGrade(null);
    setCurrentChapterId(null);
    setCurrentLesson(null);
    setActiveBlog(null);
    setActiveAdminBlog(null);
    setIsCreatingBlog(false);
  }, []);

  type NavTarget = 'home' | 'examList' | 'contactBook' | 'studyPlanner' | 'notification' | 'simLab' | 'blog';
  const navigateTo = useCallback((target: NavTarget) => {
    resetNavigation();
    switch (target) {
      case 'examList': setShowExamList(true); break;
      case 'contactBook': setShowContactBook(true); break;
      case 'studyPlanner': setShowStudyPlanner(true); break;
      case 'notification': setShowNotification(true); break;
      case 'simLab': setShowSimLab(true); break;
      case 'blog': setShowBlog(true); break;
    }
    setIsMobileMenuOpen(false);
  }, [resetNavigation]);

  const selectGrade = useCallback((g: GradeLevel | null) => {
    resetNavigation();
    setCurrentGrade(g);
    setIsMobileMenuOpen(false);
  }, [resetNavigation]);

  const handlePreviewMode = useCallback((mode: GradeLevel | null) => {
    setPreviewMode(mode);
    if (mode) {
      resetNavigation();
      setCurrentGrade(mode);
    } else {
      setCurrentGrade(null);
    }
  }, [resetNavigation]);

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Math.random().toString(36).substring(7);
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

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

  const fileCounts = useMemo(() => {
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

    // 0. Exam Result
    if (activeExam && examSubmission) {
      return (
        <ExamResult
          exam={activeExam}
          submission={examSubmission}
          onRetry={() => { setExamSubmission(null); }}
          onBack={() => { setActiveExam(null); setExamSubmission(null); setShowExamList(true); }}
          onSubmitVote={(part, qNum) => submitQuestionVote(activeExam.id, part, qNum)}
          onShowToast={showToast}
        />
      );
    }

    // 0b. Exam View
    if (activeExam && !examSubmission) {
      return (
        <ExamView
          exam={activeExam}
          isPreviewMode={!!previewMode}
          onShowToast={showToast}
          onBack={() => { setActiveExam(null); setShowExamList(true); }}
          onSubmit={async (sub) => {
            setExamSubmission(sub);
            const { calcScore } = await import('./components/ExamView');
            const score = calcScore(sub, activeExam.answers);
            saveExamResult(activeExam, score.total, 28, score.correctCount);
          }}
        />
      );
    }

    // 0c. Exam List
    if (showExamList) {
      return (
        <ExamListPage
          isAdmin={isAdmin} // true admin status needed to see all exams when not previewing
          previewMode={previewMode}
          onLoadExams={loadExams}
          onLoadHistory={getExamHistory}
          onSelectExam={(exam) => { setActiveExam(exam); setExamSubmission(null); setShowExamList(false); }}
        />
      );
    }


    // 0d. Contact Book (Exam History)
    if (showContactBook) {
      return (
        <ContactBook
          isAdmin={effectiveIsAdmin}
          onLoadHistory={getExamHistory}
        />
      );
    }

    // 0e. Study Planner
    if (showStudyPlanner) {
      return (
        <StudyPlanner
          isAdmin={effectiveIsAdmin}
          studentGrade={studentGradeValue}
          onLoadPlans={getStudyPlans}
          onSavePlan={saveStudyPlan}
          onUpdatePlan={updateStudyPlan}
          onDeletePlan={deleteStudyPlan}
          onLoadSchedules={getSchedules}
          onSaveSchedule={saveSchedule}
          onUpdateSchedule={updateSchedule}
          onDeleteSchedule={deleteSchedule}
        />
      );
    }

    // 0f. Notification Page
    if (showNotification) {
      return (
        <NotificationPage
          onGetNotifications={getNotifications}
          onGetFetchedIds={getFetchedNotificationIds}
          onMarkFetched={markNotificationFetched}
          onFetchLessons={fetchLessonsFromGitHub}
          onShowToast={showToast}
          isAdmin={effectiveIsAdmin}
          onDeleteNotification={deleteNotification}
          onCreateNotification={createCustomNotification}
        />
      );
    }

    // 0g. Simulation Lab
    if (showSimLab) {
      return (
        <SimulationLab
          onBack={() => setShowSimLab(false)}
        />
      );
    }

    if (showBlog) {
      if (activeAdminBlog || isCreatingBlog) {
        return (
          <AdminBlogEditor
            blog={activeAdminBlog}
            saveBlog={saveBlog}
            deleteBlog={deleteBlog}
            syncBlogs={syncBlogs}
            onBack={() => {
              setActiveAdminBlog(null);
              setIsCreatingBlog(false);
              // Force BlogList re-mount để phản ánh bài đã xóa/thay đổi
              setShowBlog(false);
              setTimeout(() => setShowBlog(true), 0);
            }}
            onSaved={(_savedBlog) => {
              setActiveAdminBlog(null);
              setIsCreatingBlog(false);
              setShowBlog(false);
              setTimeout(() => setShowBlog(true), 0);
            }}
          />
        );
      }
      if (activeBlog) {
        // Tính related blogs: cùng category hoặc chung tags, bỏ bài hiện tại
        const related = allBlogs
          .filter(b => b.id !== activeBlog.id && b.is_published)
          .filter(b => b.category === activeBlog.category || (b.tags || []).some(t => (activeBlog.tags || []).includes(t)))
          .slice(0, 4);
        return <BlogDetail blog={activeBlog} onBack={() => setActiveBlog(null)} relatedBlogs={related} onReadRelated={(b) => setActiveBlog(b)} />;
      }
      return (
        <BlogList
          isAdmin={effectiveIsAdmin}
          onReadBlog={(blog) => { setActiveBlog(blog); }}
          onEditBlog={effectiveIsAdmin ? setActiveAdminBlog : undefined}
          onCreateBlog={effectiveIsAdmin ? () => setIsCreatingBlog(true) : undefined}
          onBlogsLoaded={setAllBlogs}
          getBlogs={getBlogs}
        />
      );

    }

    // 1. Lesson View (Deepest level)
    if (currentLesson) {
      const lessonFiles = storedFiles[currentLesson.id] || [];
      return (
        <LessonView
          lesson={currentLesson}
          files={lessonFiles}
          isAdmin={effectiveIsAdmin}
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
          isAdmin={effectiveIsAdmin}
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

    return <Dashboard onSelectGrade={setCurrentGrade} fileCounts={fileCounts} isAdmin={effectiveIsAdmin} onLoadLeaderboard={getLeaderboard} previewMode={previewMode} studentGrade={studentGradeValue} />;
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
          onSelectGrade={selectGrade}
          onOpenSettings={() => { setIsSettingsOpen(true); setIsMobileMenuOpen(false); }}
          onOpenExamList={(isActivated || isAdmin) ? () => navigateTo('examList') : undefined}
          onOpenContactBook={(isActivated || isAdmin) ? () => navigateTo('contactBook') : undefined}
          onOpenStudyPlanner={(isActivated || isAdmin) ? () => navigateTo('studyPlanner') : undefined}
          onOpenNotification={(isActivated || isAdmin) ? () => navigateTo('notification') : undefined}
          onOpenSimLab={(isActivated || isAdmin) ? () => navigateTo('simLab') : undefined}
          onOpenBlog={(isActivated || isAdmin) ? () => navigateTo('blog') : undefined}
          showExamList={showExamList}
          showContactBook={showContactBook}
          showStudyPlanner={showStudyPlanner}
          showNotification={showNotification}
          notificationUnreadCount={notificationUnreadCount}
          showSimLab={showSimLab}
          showBlog={showBlog}
          isAdmin={isAdmin}
          previewMode={previewMode}
          onSetPreviewMode={handlePreviewMode}
          studentGrade={studentGradeValue}
          className="w-full"
        />
      </div>

      {/* Desktop Sidebar */}
      <Sidebar
        currentGrade={currentGrade}
        onSelectGrade={selectGrade}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenExamList={(isActivated || isAdmin) ? () => navigateTo('examList') : undefined}
        onOpenContactBook={(isActivated || isAdmin) ? () => navigateTo('contactBook') : undefined}
        onOpenStudyPlanner={(isActivated || isAdmin) ? () => navigateTo('studyPlanner') : undefined}
        onOpenNotification={(isActivated || isAdmin) ? () => navigateTo('notification') : undefined}
        onOpenSimLab={(isActivated || isAdmin) ? () => navigateTo('simLab') : undefined}
        onOpenBlog={(isActivated || isAdmin) ? () => navigateTo('blog') : undefined}
        showExamList={showExamList}
        showContactBook={showContactBook}
        showStudyPlanner={showStudyPlanner}
        showNotification={showNotification}
        notificationUnreadCount={notificationUnreadCount}
        showSimLab={showSimLab}
        showBlog={showBlog}
        isAdmin={isAdmin}
        previewMode={previewMode}
        onSetPreviewMode={handlePreviewMode}
        studentGrade={studentGradeValue}
        className="hidden md:flex"
      />

      {/* Settings Modal */}
      <Suspense fallback={null}>
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
          onLoadExams={loadExams}
        />
      </Suspense>


      {showAdminDashboard && (
        <Suspense fallback={<LazyFallback />}>
          <AdminDashboard
            onBack={() => setShowAdminDashboard(false)}
            onShowToast={showToast}
            onOpenGitHubSync={() => {
              setShowAdminDashboard(false);
              setShowGitHubSync(true);
            }}
            onUploadExamPdf={uploadExamPdf}
            onSaveExam={saveExam}
            onDeleteExam={deleteExam}
            onLoadExams={loadExams}
          />
        </Suspense>
      )}

      {showGitHubSync && (
        <Suspense fallback={<LazyFallback />}>
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
        </Suspense>
      )}

      {/* Main Content */}
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen transition-all duration-300 relative">

        {/* Mobile Header — simplified */}
        <header
          className="p-3.5 flex items-center justify-center md:hidden sticky top-0 z-30"
          style={{ background: '#F1F0EC', borderBottom: '1px solid #E9E9E7' }}
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: '#6B7CDB' }}>
              <Atom className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-sm" style={{ color: '#1A1A1A' }}>PhysiVault</span>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8 lg:p-10 pb-24 md:pb-10 max-w-7xl mx-auto w-full">
          <Suspense fallback={<LazyFallback />}>
            <div
              key={`${showExamList}-${showContactBook}-${showStudyPlanner}-${showNotification}-${showSimLab}-${currentGrade}-${currentChapterId}-${currentLesson?.id}-${activeExam?.id}`}
            >
              {renderContent()}
            </div>
          </Suspense>
        </main>
      </div>

      {/* Toast Container — trên mobile đẩy lên trên bottom nav */}
      <div className="fixed bottom-20 md:bottom-0 right-0 p-4 space-y-2 z-50">
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>

      {/* ── Mobile Bottom Navigation Bar ── */}
      {(isActivated || isAdmin) && (
        <nav
          className="fixed bottom-0 left-0 right-0 z-40 md:hidden flex items-stretch"
          style={{ background: '#FFFFFF', borderTop: '1px solid #E9E9E7', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          {/* Home */}
          <button
            onClick={() => navigateTo('home')}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors"
            style={{ color: (!currentGrade && !showExamList && !showContactBook && !showStudyPlanner && !showNotification && !showSimLab) ? '#6B7CDB' : '#AEACA8' }}
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px] font-medium">Tổng quan</span>
          </button>

          {/* Khối lớp — mở menu chọn lớp */}
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors"
            style={{ color: currentGrade ? '#6B7CDB' : '#AEACA8' }}
          >
            <FolderOpen className="w-5 h-5" />
            <span className="text-[10px] font-medium">{currentGrade ? `Lớp ${currentGrade}` : 'Khối lớp'}</span>
          </button>

          {/* Thi thử */}
          <button
            onClick={() => navigateTo('examList')}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors"
            style={{ color: showExamList ? '#6B7CDB' : '#AEACA8' }}
          >
            <FileText className="w-5 h-5" />
            <span className="text-[10px] font-medium">Thi thử</span>
          </button>

          {/* Thông báo */}
          <button
            onClick={() => navigateTo('notification')}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors relative"
            style={{ color: showNotification ? '#E03E3E' : '#AEACA8' }}
          >
            <div className="relative">
              <Bell className="w-5 h-5" />
              {notificationUnreadCount > 0 && (
                <span
                  className="absolute -top-1 -right-1.5 min-w-[14px] h-[14px] rounded-full flex items-center justify-center text-[8px] font-black"
                  style={{ background: '#E03E3E', color: '#fff', lineHeight: 1 }}
                >
                  {notificationUnreadCount > 9 ? '9+' : notificationUnreadCount}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium">Thông báo</span>
          </button>

          {/* Cài đặt */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors"
            style={{ color: '#AEACA8' }}
          >
            <Settings className="w-5 h-5" />
            <span className="text-[10px] font-medium">Cài đặt</span>
          </button>

          {/* Phòng TN */}
          <button
            onClick={() => navigateTo('simLab')}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors"
            style={{ color: showSimLab ? '#2878BD' : '#AEACA8' }}
          >
            <FlaskConical className="w-5 h-5" />
            <span className="text-[10px] font-medium">Phòng TN</span>
          </button>
        </nav>
      )}

      {/* Chatbot Component - Only show on Dashboard (Overview) */}
      {!currentGrade && !showAdminDashboard && !showStudyPlanner && !showExamList && !activeExam && !showContactBook && !showNotification && !showSimLab && !showBlog && <Suspense fallback={null}><Chatbot /></Suspense>}
    </div>
  );
}

export default App;
