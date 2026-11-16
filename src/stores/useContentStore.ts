import { create } from 'zustand';
import { Exam, ExamSubmission, BlogPost } from '../../types';

interface ExamStore {
  activeExam: Exam | null;
  examSubmission: ExamSubmission | null;

  setActiveExam: (exam: Exam | null) => void;
  setExamSubmission: (sub: ExamSubmission | null) => void;
  clearExam: () => void;
}

export const useExamStore = create<ExamStore>((set) => ({
  activeExam: null,
  examSubmission: null,

  setActiveExam: (activeExam) => set({ activeExam }),
  setExamSubmission: (examSubmission) => set({ examSubmission }),
  clearExam: () => set({ activeExam: null, examSubmission: null }),
}));

interface BlogStore {
  activeBlog: BlogPost | null;
  activeAdminBlog: BlogPost | null;
  isCreatingBlog: boolean;
  allBlogs: BlogPost[];
  syncStatus: 'idle' | 'syncing' | 'synced' | 'failed';
  imageSyncStatus: 'idle' | 'uploading' | 'failed';

  setActiveBlog: (b: BlogPost | null) => void;
  setActiveAdminBlog: (b: BlogPost | null) => void;
  setIsCreatingBlog: (v: boolean) => void;
  setAllBlogs: (blogs: BlogPost[]) => void;
}

export const useBlogStore = create<BlogStore>((set) => ({
  activeBlog: null,
  activeAdminBlog: null,
  isCreatingBlog: false,
  allBlogs: [],
  syncStatus: 'idle',
  imageSyncStatus: 'idle',

  setActiveBlog: (activeBlog) => set({ activeBlog }),
  setActiveAdminBlog: (activeAdminBlog) => set({ activeAdminBlog }),
  setIsCreatingBlog: (isCreatingBlog) => set({ isCreatingBlog }),
  setAllBlogs: (allBlogs) => set({ allBlogs }),
}));
