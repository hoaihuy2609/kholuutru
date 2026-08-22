import { create } from 'zustand';
import { Lesson, FileStorage, GradeData } from '../../types';

/**
 * Read-only mirror of the data that lives in useCloudStorage.
 * Components read from here; mutations still go through the useCloudStorage hook
 * callbacks passed down as needed.
 *
 * ⚠️ IMPORTANT: This store does NOT contain any sync/fetch logic.
 * All IndexedDB / Telegram / GitHub logic remains exclusively in useCloudStorage.
 */
interface DataStore {
  curriculum: GradeData[];
  lessons: Lesson[];
  storedFiles: FileStorage;
  loading: boolean;
  isActivated: boolean;
  studentGradeValue: number | null;

  // Setters — called by the root AppDataSync component
  setCurriculum: (curriculum: GradeData[]) => void;
  setLessons: (lessons: Lesson[]) => void;
  setStoredFiles: (files: FileStorage) => void;
  setLoading: (v: boolean) => void;
  setIsActivated: (v: boolean) => void;
  setStudentGradeValue: (v: number | null) => void;
}

export const useDataStore = create<DataStore>((set) => ({
  curriculum: [],
  lessons: [],
  storedFiles: {},
  loading: true,
  isActivated: false,
  studentGradeValue: null,

  setCurriculum: (curriculum) => set({ curriculum }),
  setLessons: (lessons) => set({ lessons }),
  setStoredFiles: (storedFiles) => set({ storedFiles }),
  setLoading: (loading) => set({ loading }),
  setIsActivated: (isActivated) => set({ isActivated }),
  setStudentGradeValue: (studentGradeValue) => set({ studentGradeValue }),
}));
