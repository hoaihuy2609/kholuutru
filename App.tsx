import React, { useState, useEffect, useMemo } from 'react';
import { FileStorage, GradeLevel, StoredFile, Lesson } from './types';
import { CURRICULUM } from './constants';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ChapterView from './components/ChapterView';
import LessonView from './components/LessonView';
import Toast, { ToastType } from './components/Toast';
import { Menu, FileText, ChevronRight, FolderOpen } from 'lucide-react';

const STORAGE_FILES_KEY = 'physivault_files';
const STORAGE_LESSONS_KEY = 'physivault_lessons';

interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
}

function App() {
  const [currentGrade, setCurrentGrade] = useState<GradeLevel | null>(null);
  const [currentChapterId, setCurrentChapterId] = useState<string | null>(null);
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);

  const [storedFiles, setStoredFiles] = useState<FileStorage>({});
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Toast helper
  const showToast = (message: string, type: ToastType = 'success') => {
    const id = Math.random().toString(36).substring(7);
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Load data from localStorage
  useEffect(() => {
    try {
      const savedFiles = localStorage.getItem(STORAGE_FILES_KEY);
      const savedLessons = localStorage.getItem(STORAGE_LESSONS_KEY);

      if (savedFiles) setStoredFiles(JSON.parse(savedFiles));
      if (savedLessons) setLessons(JSON.parse(savedLessons));
    } catch (error) {
      console.error("Failed to load data from local storage", error);
    }
  }, []);

  // Save data to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_FILES_KEY, JSON.stringify(storedFiles));
  }, [storedFiles]);

  useEffect(() => {
    localStorage.setItem(STORAGE_LESSONS_KEY, JSON.stringify(lessons));
  }, [lessons]);

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
  const handleCreateLesson = (name: string) => {
    if (!currentChapterId) return;
    const newLesson: Lesson = {
      id: Math.random().toString(36).substring(7),
      chapterId: currentChapterId,
      name: name,
      createdAt: Date.now()
    };
    setLessons(prev => [newLesson, ...prev]);
    showToast(`Đã tạo bài học "${name}"`, 'success');
  };

  const handleDeleteLesson = (lessonId: string) => {
    const lesson = lessons.find(l => l.id === lessonId);
    if (window.confirm(`Bạn có chắc chắn muốn xóa bài học "${lesson?.name}" và toàn bộ tài liệu bên trong?`)) {
      setLessons(prev => prev.filter(l => l.id !== lessonId));
      // Optionally clean up files associated with this lesson
      setStoredFiles(prev => {
        const copy = { ...prev };
        delete copy[lessonId];
        return copy;
      });
      showToast(`Đã xóa bài học "${lesson?.name}"`, 'success');
    }
  };

  // File Actions
  const handleUpload = (files: File[]) => {
    if (!currentLesson) return;

    const newFiles: StoredFile[] = files.map(file => ({
      id: Math.random().toString(36).substring(7),
      name: file.name,
      size: file.size,
      type: file.type,
      uploadDate: Date.now(),
      url: URL.createObjectURL(file)
    }));

    setStoredFiles(prev => {
      const currentLessonFiles = prev[currentLesson.id] || [];
      return {
        ...prev,
        [currentLesson.id]: [...newFiles, ...currentLessonFiles]
      };
    });

    showToast(`Đã tải lên ${files.length} tài liệu`, 'success');
  };

  const handleDeleteFile = (fileId: string) => {
    if (!currentLesson) return;
    const file = storedFiles[currentLesson.id]?.find(f => f.id === fileId);
    setStoredFiles(prev => ({
      ...prev,
      [currentLesson.id]: prev[currentLesson.id].filter(f => f.id !== fileId)
    }));
    showToast(`Đã xóa "${file?.name}"`, 'success');
  };

  const getFileCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    CURRICULUM.forEach(grade => {
      let count = 0;
      // Get all chapter IDs for this grade
      const gradeChapterIds = grade.chapters.map(c => c.id);
      // Get all lesson IDs belonging to these chapters
      const gradeLessonIds = lessons
        .filter(l => gradeChapterIds.includes(l.chapterId))
        .map(l => l.id);

      // Sum files in these lessons
      gradeLessonIds.forEach(lId => {
        count += (storedFiles[lId] || []).length;
      });
      counts[grade.level] = count;
    });
    return counts;
  }, [storedFiles, lessons]);

  const renderContent = () => {
    // 1. Lesson View (Deepest level)
    if (currentLesson) {
      return (
        <LessonView
          lesson={currentLesson}
          files={storedFiles[currentLesson.id] || []}
          onBack={() => setCurrentLesson(null)}
          onUpload={handleUpload}
          onDelete={handleDeleteFile}
        />
      );
    }

    // 2. Chapter View (List of Lessons)
    if (activeChapterData && currentChapterId) {
      return (
        <ChapterView
          chapter={activeChapterData}
          lessons={chapterLessons}
          onBack={() => setCurrentChapterId(null)}
          onCreateLesson={handleCreateLesson}
          onSelectLesson={setCurrentLesson}
          onDeleteLesson={handleDeleteLesson}
        />
      );
    }

    // 3. Grade Overview (List of Chapters)
    if (activeGradeData) {
      return (
        <div className="space-y-6 animate-fade-in">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
            <span onClick={() => setCurrentGrade(null)} className="cursor-pointer hover:text-indigo-600">Tổng quan</span>
            <ChevronRight className="w-4 h-4" />
            <span className="font-semibold text-gray-800">{activeGradeData.title}</span>
          </div>

          <div className="flex items-end justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">{activeGradeData.title}</h1>
              <p className="text-gray-500 mt-2">Chọn chương để xem danh sách bài học.</p>
            </div>
            <div className="hidden md:block text-sm font-medium text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
              {activeGradeData.chapters.length} chương học
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {activeGradeData.chapters.map((chapter, index) => {
              const chapterLessonCount = lessons.filter(l => l.chapterId === chapter.id).length;
              return (
                <div
                  key={chapter.id}
                  onClick={() => setCurrentChapterId(chapter.id)}
                  className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 rounded-lg bg-gray-50 text-gray-400 font-bold flex items-center justify-center text-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      {index + 1}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-800 group-hover:text-indigo-700 transition-colors">
                        {chapter.name}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">{chapter.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-sm text-gray-500 bg-gray-50 px-3 py-1 rounded-full">
                      <FolderOpen className="w-4 h-4" />
                      <span>{chapterLessonCount} bài</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // 4. Dashboard (Default)
    return <Dashboard onSelectGrade={setCurrentGrade} fileCounts={getFileCounts} />;
  };

  return (
    <div className="min-h-screen bg-[#f3f4f6] flex">
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-30 w-64 bg-white transform transition-transform duration-300 ease-in-out md:hidden ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <Sidebar
          currentGrade={currentGrade}
          onSelectGrade={(g) => {
            setCurrentGrade(g);
            setCurrentChapterId(null);
            setCurrentLesson(null);
            setIsMobileMenuOpen(false);
          }}
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
      />

      {/* Main Content */}
      <main className="flex-1 md:ml-64 transition-all duration-300">
        <header className="bg-white/80 backdrop-blur-md sticky top-0 z-10 border-b border-gray-200 px-6 py-4 flex items-center justify-between md:hidden">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <Menu className="w-6 h-6" />
            </button>
            <span className="font-bold text-lg text-gray-800">PhysiVault</span>
          </div>
        </header>

        <div className="p-6 md:p-10 max-w-6xl mx-auto min-h-[calc(100vh-80px)]">
          {renderContent()}
        </div>
      </main>

      {/* Toast Notifications */}
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
    </div>
  );
}

export default App;
