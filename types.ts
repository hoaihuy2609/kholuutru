export enum GradeLevel {
  Grade10 = 10,
  Grade11 = 11,
  Grade12 = 12,
}

export interface Chapter {
  id: string;
  name: string;
  description?: string;
}

export interface Lesson {
  id: string;
  chapterId: string;
  name: string;
  createdAt: number;
}

export interface StoredFile {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadDate: number; // Timestamp
  url?: string; // In a real app, this is the download link. In demo, likely a blob URL.
}

export interface GradeData {
  level: GradeLevel;
  title: string;
  chapters: Chapter[];
}

export type FileStorage = Record<string, StoredFile[]>; // Key is "lessonId" (previously chapterId)
