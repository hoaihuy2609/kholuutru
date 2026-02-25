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
  category?: string; // Optional category for organization
}

export interface GradeData {
  level: GradeLevel;
  title: string;
  chapters: Chapter[];
}

export type FileStorage = Record<string, StoredFile[]>; // Key is "lessonId" or "chapterId"

// ── Exam (Thi Thử) Types ──────────────────────────────────────────

export interface ExamTFAnswer {
  a: 'D' | 'S' | '';
  b: 'D' | 'S' | '';
  c: 'D' | 'S' | '';
  d: 'D' | 'S' | '';
}

export interface ExamAnswers {
  mc: string[];          // 18 đáp án ABCD (index 0-17)
  tf: ExamTFAnswer[];    // 4 câu Đúng/Sai (index 0-3)
  sa: string[];          // 6 trả lời ngắn (index 0-5)
}

export interface Exam {
  id: string;
  title: string;
  pdfTelegramFileId: string;  // file_id PDF trên Telegram
  pdfFileName: string;        // tên file PDF gốc
  duration: number;           // phút
  createdAt: number;
  answers: ExamAnswers;
}

export interface ExamSubmission {
  examId: string;
  mc: string[];           // đáp án học sinh chọn
  tf: ExamTFAnswer[];     // đáp án học sinh chọn
  sa: string[];           // trả lời ngắn học sinh
  submittedAt: number;
  timeTaken: number;      // giây
}
