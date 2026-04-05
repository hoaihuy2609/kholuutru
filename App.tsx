import React, { useEffect, useMemo, useCallback, Suspense, useState, useRef } from 'react';
import { Routes, Route, useNavigate, useParams, Navigate, useLocation } from 'react-router-dom';
import { GradeLevel, Lesson, Exam } from './types';
import { CURRICULUM } from './constants';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Toast from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';
import { useCloudStorage } from './src/hooks/useCloudStorage';
import { getActivatedPhone } from './src/utils/phone';
import { FileText, ChevronRight, FolderOpen, RefreshCw, Atom, Bell, Menu } from 'lucide-react';
import KickedScreen from './components/auth/KickedScreen';
import { useUIStore } from './src/stores/useUIStore';
import { useDataStore } from './src/stores/useDataStore';
import { useExamStore, useBlogStore } from './src/stores/useContentStore';
import { useShallow } from 'zustand/react/shallow';
import { syncPendingOnStartup } from './src/services/examService';
import { syncServerTime } from './src/lib/serverTime';

const ChapterView = React.lazy(() => import('./components/ChapterView'));
const LessonView = React.lazy(() => import('./components/LessonView'));
const SettingsModal = React.lazy(() => import('./components/SettingsModal'));
const Chatbot = React.lazy(() => import('./components/Chatbot'));
const AdminDashboard = React.lazy(() => import('./components/AdminDashboard'));
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
const GlobalSearch = React.lazy(() => import('./components/GlobalSearch'));
const SolutionEditor = React.lazy(() => import('./components/SolutionEditor'));

const LazyFallback = () => (
  <div className="flex items-center justify-center h-[40vh]">
    <RefreshCw className="w-8 h-8 animate-spin" style={{ color: '#6B7CDB' }} />
  </div>
);

// ──────────────────────────────────────────────────────────────────
// AppDataSync: bridges useCloudStorage data → Zustand stores
// ──────────────────────────────────────────────────────────────────
function AppDataSync({ cloud }: { cloud: ReturnType<typeof useCloudStorage> }) {
  const setLessons = useDataStore(state => state.setLessons);
  const setStoredFiles = useDataStore(state => state.setStoredFiles);
  const setLoading = useDataStore(state => state.setLoading);
  const setIsActivated = useDataStore(state => state.setIsActivated);
  const setStudentGradeValue = useDataStore(state => state.setStudentGradeValue);
  const isAdmin = useUIStore(state => state.isAdmin);
  const setKicked = useUIStore(state => state.setKicked);
  const setNotificationUnreadCount = useUIStore(state => state.setNotificationUnreadCount);
  const { getFetchedNotificationIds, getNotifications, verifyAccess } = cloud;

  useEffect(() => { setLessons(cloud.lessons); }, [cloud.lessons, setLessons]);
  useEffect(() => { setStoredFiles(cloud.storedFiles); }, [cloud.storedFiles, setStoredFiles]);
  useEffect(() => { setLoading(cloud.loading); }, [cloud.loading, setLoading]);
  
  // ── Migration Runner — bump MIGRATION_VER and add a new if-block below for future migrations
  useEffect(() => {
    const MIGRATION_VER = 3;
    // Backward compat: học sinh cũ đã có key cũ 'pv_v3_migrated_safe'
    if (localStorage.getItem('pv_v3_migrated_safe') && !localStorage.getItem('pv_migration_ver')) {
      localStorage.setItem('pv_migration_ver', '3');
      localStorage.removeItem('pv_v3_migrated_safe');
    }
    const lastRan = parseInt(localStorage.getItem('pv_migration_ver') || '0', 10);
    if (lastRan >= MIGRATION_VER) return;

    // v3: Xóa legacy IndexedDB và metadata từ bản cũ
    if (lastRan < 3) {
      indexedDB.deleteDatabase('PhysiVaultDB');
      indexedDB.deleteDatabase('pv_pdf_cache');
      localStorage.removeItem('pv_exam_versions');
      localStorage.removeItem('pv_exam_chunks_map');
      localStorage.removeItem('pv_last_fetched_exam_index');
      localStorage.setItem('pv_last_sync_time', '0');
      console.log('[Migration v3] Cleared legacy databases.');
    }
    // Để thêm migration mới: tăng MIGRATION_VER lên 4 và thêm: if (lastRan < 4) { ... }

    localStorage.setItem('pv_migration_ver', String(MIGRATION_VER));
  }, []);

  useEffect(() => {
    setIsActivated(cloud.isActivated);
    if (cloud.isActivated) {
      const g = parseInt(localStorage.getItem('physivault_grade') || '0', 10);
      setStudentGradeValue(g === 10 || g === 11 || g === 12 ? g : null);
      
      // ✅ Vớt bài thi chưa sync khi vừa vào App
      syncPendingOnStartup();
    }
  }, [cloud.isActivated, setIsActivated, setStudentGradeValue]);

  // ✅ PERF: verifyAccess cooldown 10 phút — giảm 50% Supabase queries
  const lastVerifyRef = useRef(0);
  useEffect(() => {
    const VERIFY_COOLDOWN = 10 * 60 * 1000;
    const check = async () => {
      if (!cloud.isActivated || document.hidden) return;
      if (Date.now() - lastVerifyRef.current < VERIFY_COOLDOWN) return;
      lastVerifyRef.current = Date.now();
      const status = await verifyAccess();
      if (status === 'kicked') setKicked(true);
    };
    check();
    const iv = setInterval(check, VERIFY_COOLDOWN);
    document.addEventListener('visibilitychange', check);
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', check); };
  }, [cloud.isActivated, verifyAccess, setKicked]);

  // ✅ PERF: notification polling cooldown 15 phút — giảm 87% notification queries
  const lastUnreadRef = useRef(0);
  useEffect(() => {
    if (!cloud.isActivated) return;
    const UNREAD_COOLDOWN = 15 * 60 * 1000;
    const loadUnread = async () => {
      if (document.hidden) return;
      if (Date.now() - lastUnreadRef.current < UNREAD_COOLDOWN) return;
      lastUnreadRef.current = Date.now();
      try {
        if (isAdmin) {
          const [n10, n11, n12, fetched] = await Promise.all([getNotifications(10), getNotifications(11), getNotifications(12), getFetchedNotificationIds()]);
          setNotificationUnreadCount([...n10, ...n11, ...n12].filter(n => n.fetch_enabled && !fetched.has(n.id)).length);
        } else {
          let grade = parseInt(localStorage.getItem('physivault_grade') || '0', 10);
          // ✅ BUG 3C FIX: fallback lấy grade từ Supabase nếu localStorage bị xóa
          if (grade < 10 || grade > 12) {
            const phone = localStorage.getItem('pv_activated_sdt');
            if (!phone) return;
            try {
              const { supabase: sb } = await import('./src/lib/supabase');
              const { data } = await sb.from('students').select('grade').eq('phone', phone).maybeSingle();
              if (data?.grade) {
                grade = data.grade;
                localStorage.setItem('physivault_grade', String(grade)); // re-cache
              } else return;
            } catch { return; }
          }
          const [notifs, fetched] = await Promise.all([getNotifications(grade), getFetchedNotificationIds()]);
          setNotificationUnreadCount(notifs.filter(n => n.fetch_enabled && !fetched.has(n.id)).length);
        }
      } catch { /* silent */ }
    };
    loadUnread();
    const iv = setInterval(loadUnread, UNREAD_COOLDOWN);
    document.addEventListener('visibilitychange', loadUnread);
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', loadUnread); };
  }, [cloud.isActivated, isAdmin, getNotifications, getFetchedNotificationIds, setNotificationUnreadCount]);

  return null;
}

// ──────────────────────────────────────────────────────────────────
// Route pages
// ──────────────────────────────────────────────────────────────────
function GradeOverviewPage({ cloud }: { cloud: ReturnType<typeof useCloudStorage> }) {
  const { level } = useParams<{ level: string }>();
  const navigate = useNavigate();
  const lessons = useDataStore(state => state.lessons);
  const storedFiles = useDataStore(state => state.storedFiles);
  const grade = Number(level) as GradeLevel;
  const gradeData = useMemo(() => CURRICULUM.find(g => g.level === grade), [grade]);
  if (!gradeData) return <Navigate to="/" replace />;
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-1.5 text-sm" style={{ color: '#787774' }}>
        <span onClick={() => navigate('/')} className="cursor-pointer hover:text-[#6B7CDB] transition-colors">Tổng quan</span>
        <ChevronRight className="w-3.5 h-3.5" style={{ color: '#CFCFCB' }} />
        <span className="font-medium" style={{ color: '#1A1A1A' }}>{gradeData.title}</span>
      </div>
      <div>
        <h1 className="text-2xl font-semibold mb-1" style={{ color: '#1A1A1A' }}>{gradeData.title}</h1>
        <p className="text-sm" style={{ color: '#787774' }}>Quản lý và theo dõi tiến độ học tập</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {gradeData.chapters.map((chapter) => {
          const cl = lessons.filter(l => l.chapterId === chapter.id);
          const fc = cl.reduce((s, l) => s + (storedFiles[l.id]?.length || 0), 0);
          return (
            <div key={chapter.id} onClick={() => navigate(`/grade/${grade}/chapter/${chapter.id}`)} className="rounded-xl p-5 cursor-pointer group pv-chapter-card">
              <div className="flex items-start justify-between mb-3">
                <div className="p-2.5 rounded-lg" style={{ background: '#EEF0FB' }}><FolderOpen className="w-5 h-5" style={{ color: '#6B7CDB' }} /></div>
                <div className="text-right"><div className="text-[10px] uppercase tracking-wider" style={{ color: '#AEACA8' }}>Bài học</div><div className="text-lg font-semibold" style={{ color: '#1A1A1A' }}>{cl.length}</div></div>
              </div>
              <h3 className="font-semibold text-sm mb-1 line-clamp-1" style={{ color: '#1A1A1A' }}>{chapter.name}</h3>
              <p className="text-xs leading-relaxed mb-4 line-clamp-2" style={{ color: '#787774', minHeight: '2.5rem' }}>{chapter.description}</p>
              <div className="flex items-center justify-between pt-3 text-xs" style={{ borderTop: '1px solid #F1F0EC' }}>
                <div className="flex items-center gap-1" style={{ color: '#AEACA8' }}><FileText className="w-3.5 h-3.5" /><span>{fc} tài liệu</span></div>
                <ChevronRight className="w-4 h-4" style={{ color: '#CFCFCB' }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChapterPage({ cloud }: { cloud: ReturnType<typeof useCloudStorage> }) {
  const { level, chapterId } = useParams<{ level: string; chapterId: string }>();
  const navigate = useNavigate();
  const lessons = useDataStore(state => state.lessons);
  const storedFiles = useDataStore(state => state.storedFiles);
  const isAdmin = useUIStore(state => state.isAdmin);
  const previewMode = useUIStore(state => state.previewMode);
  const showToast = useUIStore(state => state.showToast);
  const effectiveIsAdmin = isAdmin && !previewMode;
  const grade = Number(level) as GradeLevel;
  const gradeData = useMemo(() => CURRICULUM.find(g => g.level === grade), [grade]);
  const chapter = gradeData?.chapters.find(c => c.id === chapterId);
  const chapterLessons = useMemo(() => lessons.filter(l => l.chapterId === chapterId), [lessons, chapterId]);
  const chapterFiles = storedFiles[chapterId!] || [];
  if (!chapter || !chapterId) return <Navigate to={`/grade/${level}`} replace />;
  const handleCreateLesson = async (name: string) => { try { await cloud.addLesson(name, chapterId); showToast(`Đã tạo bài học: ${name}`, 'success'); } catch { showToast('Lỗi khi tạo bài học', 'error'); } };
  const handleDeleteLesson = async (lessonId: string) => { const l = lessons.find(x => x.id === lessonId); if (!l) return; if (window.confirm(`Xóa bài học "${l.name}" và tất cả tài liệu?`)) { try { await cloud.deleteLesson(lessonId); showToast(`Đã xóa: ${l.name}`, 'success'); } catch { showToast('Lỗi xóa bài học', 'error'); } } };
  const handleChapterUpload = async (files: File[], category: string) => { try { showToast('Đang tải lên...', 'warning'); await cloud.uploadFiles(files, chapterId, category); showToast(`Đã tải lên ${files.length} tài liệu`, 'success'); } catch { showToast('Lỗi tải lên', 'error'); } };
  const handleDeleteChapterFile = async (fileId: string) => { const f = chapterFiles.find(x => x.id === fileId); if (window.confirm(`Xóa tài liệu "${f?.name || 'này'}"?`)) { try { await cloud.deleteFile(fileId, chapterId); showToast('Đã xóa', 'success'); } catch { showToast('Lỗi xóa file', 'error'); } } };
  return (
    <ErrorBoundary><Suspense fallback={<LazyFallback />}>
      <ChapterView chapter={chapter} lessons={chapterLessons} chapterFiles={chapterFiles} isAdmin={effectiveIsAdmin} autoCreate={false} onBack={() => navigate(`/grade/${level}`)} onCreateLesson={handleCreateLesson} onSelectLesson={(lesson: Lesson) => navigate(`/grade/${level}/chapter/${chapterId}/lesson/${lesson.id}`)} onDeleteLesson={handleDeleteLesson} onUploadChapterFile={handleChapterUpload} onDeleteChapterFile={handleDeleteChapterFile} />
    </Suspense></ErrorBoundary>
  );
}

function LessonPage({ cloud }: { cloud: ReturnType<typeof useCloudStorage> }) {
  const { level, chapterId, lessonId } = useParams<{ level: string; chapterId: string; lessonId: string }>();
  const navigate = useNavigate();
  const lessons = useDataStore(state => state.lessons);
  const storedFiles = useDataStore(state => state.storedFiles);
  const isAdmin = useUIStore(state => state.isAdmin);
  const previewMode = useUIStore(state => state.previewMode);
  const showToast = useUIStore(state => state.showToast);
  const effectiveIsAdmin = isAdmin && !previewMode;
  const lesson = lessons.find(l => l.id === lessonId);
  const lessonFiles = storedFiles[lessonId!] || [];
  if (!lesson) return <Navigate to={`/grade/${level}/chapter/${chapterId}`} replace />;
  const handleUpload = async (files: File[], category?: string) => { try { showToast('Đang tải lên...', 'warning'); await cloud.uploadFiles(files, lesson.id, category); showToast(`Đã tải lên ${files.length} tài liệu`, 'success'); } catch { showToast('Lỗi tải lên', 'error'); } };
  const handleDelete = async (fileId: string) => { const f = lessonFiles.find(x => x.id === fileId); if (window.confirm(`Xóa tài liệu "${f?.name || 'này'}"?`)) { try { await cloud.deleteFile(fileId, lesson.id); showToast('Đã xóa', 'success'); } catch { showToast('Lỗi xóa file', 'error'); } } };
  return (
    <ErrorBoundary><Suspense fallback={<LazyFallback />}>
      <LessonView lesson={lesson} files={lessonFiles} isAdmin={effectiveIsAdmin} onBack={() => navigate(`/grade/${level}/chapter/${chapterId}`)} onUpload={handleUpload} onDelete={handleDelete} />
    </Suspense></ErrorBoundary>
  );
}

function ExamRoutes({ cloud }: { cloud: ReturnType<typeof useCloudStorage> }) {
  const navigate = useNavigate();
  const isAdmin = useUIStore(state => state.isAdmin);
  const previewMode = useUIStore(state => state.previewMode);
  const { activeExam, examSubmission, setActiveExam, setExamSubmission, clearExam } = useExamStore(useShallow(state => ({
    activeExam: state.activeExam,
    examSubmission: state.examSubmission,
    setActiveExam: state.setActiveExam,
    setExamSubmission: state.setExamSubmission,
    clearExam: state.clearExam,
  })));
  if (activeExam && examSubmission) {
    return (
      <ErrorBoundary><Suspense fallback={<LazyFallback />}>
        <ExamResult exam={activeExam} submission={examSubmission} onRetry={() => setExamSubmission(null)} onBack={() => { clearExam(); navigate('/exams'); }} onSubmitVote={(part, qNum) => cloud.submitQuestionVote(activeExam.id, part, qNum)} onShowToast={useUIStore.getState().showToast} />
      </Suspense></ErrorBoundary>
    );
  }
  if (activeExam) {
    return (
      <ErrorBoundary><Suspense fallback={<LazyFallback />}>
        <ExamView exam={activeExam} isPreviewMode={!!previewMode} onShowToast={useUIStore.getState().showToast} onBack={() => { clearExam(); navigate('/exams'); }} onSubmit={async (sub) => { 
          setExamSubmission(sub); 
          const { calcScore } = await import('./components/ExamView'); 
          const score = calcScore(sub, activeExam.answers); 
          const totalQ = (activeExam.answers.mc?.length ?? 0) + (activeExam.answers.tf?.length ?? 0) + (activeExam.answers.sa?.length ?? 0); 
          cloud.saveExamResult(activeExam, score.total, totalQ, score.correctCount, { mc: score.mc, tf: score.tf, sa: score.sa }, score.tfBreakdown, sub.timeTaken); 
        }} />
      </Suspense></ErrorBoundary>
    );
  }
  return (
    <ErrorBoundary><Suspense fallback={<LazyFallback />}>
      <ExamListPage isAdmin={isAdmin} previewMode={previewMode} onLoadExams={cloud.loadExams} onLoadHistory={(isAdmin && !previewMode) ? cloud.getExamHistory : () => { const phone = getActivatedPhone(); if (!phone) return Promise.resolve([]); return cloud.getExamHistory(phone); }} onSelectExam={(exam: Exam) => { setActiveExam(exam); setExamSubmission(null); }} />
    </Suspense></ErrorBoundary>
  );
}

function BlogRoutes({ cloud }: { cloud: ReturnType<typeof useCloudStorage> }) {
  const navigate = useNavigate();
  const isAdmin = useUIStore(state => state.isAdmin);
  const previewMode = useUIStore(state => state.previewMode);
  const effectiveIsAdmin = isAdmin && !previewMode;
  const { activeBlog, activeAdminBlog, isCreatingBlog, allBlogs, setActiveBlog, setActiveAdminBlog, setIsCreatingBlog, setAllBlogs } = useBlogStore(useShallow(state => ({
    activeBlog: state.activeBlog,
    activeAdminBlog: state.activeAdminBlog,
    isCreatingBlog: state.isCreatingBlog,
    allBlogs: state.allBlogs,
    setActiveBlog: state.setActiveBlog,
    setActiveAdminBlog: state.setActiveAdminBlog,
    setIsCreatingBlog: state.setIsCreatingBlog,
    setAllBlogs: state.setAllBlogs,
  })));
  if ((activeAdminBlog || isCreatingBlog) && effectiveIsAdmin) {
    const back = () => { setActiveAdminBlog(null); setIsCreatingBlog(false); navigate('/blog', { replace: true }); };
    return (
      <ErrorBoundary><Suspense fallback={<LazyFallback />}>
        <AdminBlogEditor blog={activeAdminBlog} saveBlog={cloud.saveBlog} deleteBlog={cloud.deleteBlog} syncBlogs={cloud.syncBlogs} onBack={back} onSaved={() => { setActiveAdminBlog(null); setIsCreatingBlog(false); navigate('/blog', { replace: true }); }} />
      </Suspense></ErrorBoundary>
    );
  }
  if (activeBlog) {
    const related = allBlogs.filter(b => b.id !== activeBlog.id && b.is_published).filter(b => b.category === activeBlog.category || (b.tags || []).some(t => (activeBlog.tags || []).includes(t))).slice(0, 4);
    return (
      <ErrorBoundary><Suspense fallback={<LazyFallback />}>
        <BlogDetail blog={activeBlog} onBack={() => setActiveBlog(null)} relatedBlogs={related} onReadRelated={setActiveBlog} />
      </Suspense></ErrorBoundary>
    );
  }
  return (
    <ErrorBoundary><Suspense fallback={<LazyFallback />}>
      <BlogList isAdmin={effectiveIsAdmin} onReadBlog={setActiveBlog} onEditBlog={effectiveIsAdmin ? setActiveAdminBlog : undefined} onCreateBlog={effectiveIsAdmin ? () => setIsCreatingBlog(true) : undefined} onBlogsLoaded={setAllBlogs} getBlogs={cloud.getBlogs} />
    </Suspense></ErrorBoundary>
  );
}

// ──────────────────────────────────────────────────────────────────
// AppShell: layout (sidebar + mobile nav + modals)
// ──────────────────────────────────────────────────────────────────
function AppShell({ cloud }: { cloud: ReturnType<typeof useCloudStorage> }) {
  const navigate = useNavigate();
  const { pathname: path } = useLocation(); // ✅ reactive với React Router
  const [isSearchOpen, setSearchOpen] = useState(false);

  // ── Ctrl+K / Cmd+K global shortcut for search ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);
  const {
    isSettingsOpen, setSettingsOpen, isMobileMenuOpen, setMobileMenuOpen,
    showAdminDashboard, setShowAdminDashboard,
    toasts, removeToast, isAdmin, previewMode, setPreviewMode,
    isKicked, notificationUnreadCount, toggleAdmin, isSimulationFullscreen, isForumTopicActive,
  } = useUIStore(useShallow(state => ({
    isSettingsOpen: state.isSettingsOpen,
    setSettingsOpen: state.setSettingsOpen,
    isMobileMenuOpen: state.isMobileMenuOpen,
    setMobileMenuOpen: state.setMobileMenuOpen,
    toasts: state.toasts,
    removeToast: state.removeToast,
    isAdmin: state.isAdmin,
    previewMode: state.previewMode,
    setPreviewMode: state.setPreviewMode,
    isKicked: state.isKicked,
    notificationUnreadCount: state.notificationUnreadCount,
    toggleAdmin: state.toggleAdmin,
    isSimulationFullscreen: state.isSimulationFullscreen,
    isForumTopicActive: state.isForumTopicActive,
  })));
  const { lessons, storedFiles, loading, isActivated, studentGradeValue } = useDataStore(useShallow(state => ({
    lessons: state.lessons,
    storedFiles: state.storedFiles,
    loading: state.loading,
    isActivated: state.isActivated,
    studentGradeValue: state.studentGradeValue,
  })));
  const { isCreatingBlog, activeAdminBlog } = useBlogStore(useShallow(state => ({
    isCreatingBlog: state.isCreatingBlog,
    activeAdminBlog: state.activeAdminBlog,
  })));
  const effectiveIsAdmin = isAdmin && !previewMode;


  const fileCounts = useMemo(() => {
    const counts = { [GradeLevel.Grade10]: 0, [GradeLevel.Grade11]: 0, [GradeLevel.Grade12]: 0 };
    CURRICULUM.forEach(grade => {
      let c = 0;
      grade.chapters.forEach(ch => { lessons.filter(l => l.chapterId === ch.id).forEach(l => { c += storedFiles[l.id]?.length || 0; }); });
      counts[grade.level] = c;
    });
    return counts;
  }, [storedFiles, lessons]);

  const handlePreviewMode = useCallback((mode: GradeLevel | null) => {
    setPreviewMode(mode);
    navigate(mode ? `/grade/${mode}` : '/');
  }, [setPreviewMode, navigate]);

  const urlGradeMatch = path.match(/\/grade\/(\d+)/);
  const currentGradeFromUrl = urlGradeMatch ? (Number(urlGradeMatch[1]) as GradeLevel) : null;
  const isOnHome = path === '/';
  const isOnGrade = path.startsWith('/grade/');
  const isOnExams = path.startsWith('/exams');
  const isOnNotification = path === '/notifications';
  const isOnSimLab = path === '/lab';

  const hideSidebar = isSimulationFullscreen || isForumTopicActive || path === '/admin/editor' || path === '/admin' || (effectiveIsAdmin && (isCreatingBlog || !!activeAdminBlog));

  if (isKicked && !isAdmin) return <KickedScreen />;

  const sidebarCommonProps = {
    currentGrade: currentGradeFromUrl,
    onSelectGrade: (g: GradeLevel | null) => navigate(g ? `/grade/${g}` : '/'),
    onOpenSettings: () => setSettingsOpen(true),
    onOpenExamList: (isActivated || isAdmin) ? () => navigate('/exams') : undefined,
    onOpenContactBook: (isActivated || isAdmin) ? () => navigate('/contact-book') : undefined,
    onOpenStudyPlanner: (isActivated || isAdmin) ? () => navigate('/planner') : undefined,
    onOpenNotification: (isActivated || isAdmin) ? () => navigate('/notifications') : undefined,
    onOpenSimLab: (isActivated || isAdmin) ? () => navigate('/lab') : undefined,
    onOpenBlog: (isActivated || isAdmin) ? () => navigate('/blog') : undefined,
    showExamList: isOnExams,
    showContactBook: path === '/contact-book',
    showStudyPlanner: path === '/planner',
    showNotification: isOnNotification,
    notificationUnreadCount,
    showSimLab: isOnSimLab,
    showBlog: path.startsWith('/blog'),
    isAdmin,
    previewMode,
    onSetPreviewMode: handlePreviewMode,
    studentGrade: studentGradeValue,
    onOpenSearch: (isActivated || isAdmin) ? () => setSearchOpen(true) : undefined,
    onOpenSolutionEditor: effectiveIsAdmin ? () => navigate('/admin/editor') : undefined,
  };

  return (
    <div className="min-h-screen font-sans" style={{ background: '#F7F6F3', color: '#1A1A1A' }}>
      {isMobileMenuOpen && <div className="fixed inset-0 z-40 md:hidden" style={{ background: 'rgba(26,26,26,0.4)' }} onClick={() => setMobileMenuOpen(false)} />}

      {/* Mobile Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 shadow-xl transform transition-transform duration-300 ease-out md:hidden ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`} style={{ background: '#F1F0EC', borderRight: '1px solid #E9E9E7' }}>
        <Sidebar {...sidebarCommonProps} onSelectGrade={(g) => { navigate(g ? `/grade/${g}` : '/'); setMobileMenuOpen(false); }} onOpenSettings={() => { setSettingsOpen(true); setMobileMenuOpen(false); }} onOpenExamList={(isActivated || isAdmin) ? () => { navigate('/exams'); setMobileMenuOpen(false); } : undefined} onOpenContactBook={(isActivated || isAdmin) ? () => { navigate('/contact-book'); setMobileMenuOpen(false); } : undefined} onOpenStudyPlanner={(isActivated || isAdmin) ? () => { navigate('/planner'); setMobileMenuOpen(false); } : undefined} onOpenNotification={(isActivated || isAdmin) ? () => { navigate('/notifications'); setMobileMenuOpen(false); } : undefined} onOpenSimLab={(isActivated || isAdmin) ? () => { navigate('/lab'); setMobileMenuOpen(false); } : undefined} onOpenBlog={(isActivated || isAdmin) ? () => { navigate('/blog'); setMobileMenuOpen(false); } : undefined} className="w-full" />
      </div>

      {/* Desktop Sidebar */}
      {!hideSidebar && <Sidebar {...sidebarCommonProps} className="hidden md:flex" />}

      {/* Settings Modal */}
      <ErrorBoundary>
        <Suspense fallback={null}>
          <SettingsModal isOpen={isSettingsOpen} onClose={() => setSettingsOpen(false)} onShowToast={useUIStore.getState().showToast} isAdmin={isAdmin} isActivated={isActivated} lessons={lessons} storedFiles={storedFiles} onActivateSystem={cloud.activateSystem} onFetchLessons={cloud.fetchLessonsFromCloud} onToggleAdmin={toggleAdmin} onOpenDashboard={() => { navigate('/admin'); setSettingsOpen(false); }} onLoadExams={cloud.loadExams} />
        </Suspense>
      </ErrorBoundary>

      {/* Main Content */}
      <div className={`flex-1 flex flex-col min-h-screen transition-all duration-300 relative ${hideSidebar ? '' : 'md:ml-64'}`}>
        {/* Mobile Header: Hamburger | Logo | Bell */}
        <header className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4" style={{ background: '#F1F0EC', borderBottom: '1px solid #E9E9E7', height: '52px' }}>
          {/* Hamburger */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors"
            style={{ color: '#57564F' }}
            aria-label="Mở menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Logo giữa */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: '#6B7CDB' }}>
              <Atom className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-sm" style={{ color: '#1A1A1A' }}>PhysiVault</span>
          </div>

          {/* Bell với badge thông báo */}
          <button
            onClick={() => navigate('/notifications')}
            className="relative flex items-center justify-center w-9 h-9 rounded-lg transition-colors"
            style={{ color: isOnNotification ? '#E03E3E' : '#57564F' }}
            aria-label="Thông báo"
          >
            <Bell className="w-5 h-5" />
            {notificationUnreadCount > 0 && (
              <span
                className="absolute top-1 right-1 min-w-[14px] h-[14px] rounded-full flex items-center justify-center text-[8px] font-black"
                style={{ background: '#E03E3E', color: '#fff', lineHeight: 1 }}
              >
                {notificationUnreadCount > 9 ? '9+' : notificationUnreadCount}
              </span>
            )}
          </button>
        </header>

        <main className={`flex-1 p-4 md:p-8 lg:p-10 pb-10 mx-auto w-full ${hideSidebar ? 'max-w-[1920px] px-4 md:px-8 lg:px-12' : 'max-w-7xl'}`}>
          <Routes>
            <Route path="/" element={
              loading
                ? <div className="flex items-center justify-center h-[50vh]"><RefreshCw className="w-10 h-10 animate-spin" style={{ color: '#6B7CDB' }} /><span className="ml-3 text-lg font-medium" style={{ color: '#6B7CDB' }}>từ từ nó đang load...</span></div>
                : <Dashboard onSelectGrade={(g) => navigate(g ? `/grade/${g}` : '/')} fileCounts={fileCounts} isAdmin={effectiveIsAdmin} onLoadLeaderboard={cloud.getLeaderboard} previewMode={previewMode} studentGrade={studentGradeValue} />
            } />
            <Route path="/admin" element={
              effectiveIsAdmin ? (
                <ErrorBoundary>
                  <Suspense fallback={<LazyFallback />}>
                    <AdminDashboard onBack={() => navigate('/')} onShowToast={useUIStore.getState().showToast} onUploadExamPdf={cloud.uploadExamPdf} onSaveExam={cloud.saveExam} onDeleteExam={cloud.deleteExam} onLoadExams={cloud.loadExams} lessons={lessons} storedFiles={storedFiles} onAddLesson={cloud.addLesson} onDeleteLesson={cloud.deleteLesson} onUploadFiles={cloud.uploadFiles} onDeleteFile={cloud.deleteFile} onSyncToGitHub={cloud.syncToCloud} syncProgress={cloud.syncProgress} />
                  </Suspense>
                </ErrorBoundary>
              ) : <Navigate to="/" replace />
            } />
            <Route path="/grade/:level" element={<GradeOverviewPage cloud={cloud} />} />
            <Route path="/grade/:level/chapter/:chapterId" element={<ChapterPage cloud={cloud} />} />
            <Route path="/grade/:level/chapter/:chapterId/lesson/:lessonId" element={<LessonPage cloud={cloud} />} />
            <Route path="/exams" element={<ExamRoutes cloud={cloud} />} />
            <Route path="/contact-book" element={<ErrorBoundary><Suspense fallback={<LazyFallback />}><ContactBook isAdmin={effectiveIsAdmin} onLoadHistory={cloud.getExamHistory} /></Suspense></ErrorBoundary>} />
            <Route path="/planner" element={<ErrorBoundary><Suspense fallback={<LazyFallback />}><StudyPlanner isAdmin={effectiveIsAdmin} studentGrade={studentGradeValue} onLoadPlans={cloud.getStudyPlans} onSavePlan={cloud.saveStudyPlan} onUpdatePlan={cloud.updateStudyPlan} onDeletePlan={cloud.deleteStudyPlan} onLoadSchedules={cloud.getSchedules} onLoadAllSchedules={cloud.getAllSchedules} onSaveSchedule={cloud.saveSchedule} onUpdateSchedule={cloud.updateSchedule} onDeleteSchedule={cloud.deleteSchedule} /></Suspense></ErrorBoundary>} />
            <Route path="/notifications" element={<ErrorBoundary><Suspense fallback={<LazyFallback />}><NotificationPage onGetNotifications={cloud.getNotifications} onGetFetchedIds={cloud.getFetchedNotificationIds} onMarkFetched={cloud.markNotificationFetched} onFetchLessons={cloud.fetchLessonsFromCloud} onShowToast={useUIStore.getState().showToast} isAdmin={effectiveIsAdmin} onDeleteNotification={cloud.deleteNotification} onCreateNotification={cloud.createCustomNotification} /></Suspense></ErrorBoundary>} />
            <Route path="/lab" element={<ErrorBoundary><Suspense fallback={<LazyFallback />}><SimulationLab onBack={() => navigate('/')} /></Suspense></ErrorBoundary>} />
            <Route path="/blog/*" element={<BlogRoutes cloud={cloud} />} />
            <Route path="/admin/editor" element={effectiveIsAdmin ? <ErrorBoundary><Suspense fallback={<LazyFallback />}><SolutionEditor /></Suspense></ErrorBoundary> : <Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>

      {/* Toasts */}
      <div className="fixed bottom-0 right-0 p-4 space-y-2 z-50">
        {toasts.map(t => <Toast key={t.id} message={t.message} type={t.type} onClose={() => removeToast(t.id)} />)}
      </div>



      {isOnHome && !isActivated && !isAdmin && (
        <ErrorBoundary><Suspense fallback={null}><Chatbot /></Suspense></ErrorBoundary>
      )}

      {/* Global Search (Ctrl+K) */}
      <ErrorBoundary>
        <Suspense fallback={null}>
          <GlobalSearch isOpen={isSearchOpen} onClose={() => setSearchOpen(false)} onLoadExams={cloud.loadExams} onGetBlogs={cloud.getBlogs} isAdmin={effectiveIsAdmin} />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Root
// ──────────────────────────────────────────────────────────────────
function App() {
  const cloud = useCloudStorage();
  
  useEffect(() => {
    syncServerTime();
  }, []);

  return (
    <>
      <AppDataSync cloud={cloud} />
      <AppShell cloud={cloud} />
    </>
  );
}

export default App;
