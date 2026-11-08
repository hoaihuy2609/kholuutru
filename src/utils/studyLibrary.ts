import type { BlogPost, StudyQuestionType, StudySection } from '../../types';

export const STUDY_GRADES = [10, 11, 12];

export const STUDY_CHAPTERS = [
  { id: "g10-ch0", name: "MỞ ĐẦU. GIỚI THIỆU MÔN VẬT LÍ", grade: 10 },
  { id: "g10-ch1", name: "CHƯƠNG I. ĐỘNG HỌC", grade: 10 },
  { id: "g10-ch2", name: "CHƯƠNG II. ĐỘNG LỰC HỌC", grade: 10 },
  { id: "g10-ch3", name: "CHƯƠNG III. NĂNG LƯỢNG, CÔNG, CÔNG SUẤT", grade: 10 },
  { id: "g10-ch4", name: "CHƯƠNG IV. ĐỘNG LƯỢNG VÀ VA CHẠM", grade: 10 },
  { id: "g10-ch5", name: "CHƯƠNG V. CHUYỂN ĐỘNG TRÒN", grade: 10 },
  { id: "g10-ch6", name: "CHƯƠNG VI. BIẾN DẠNG CỦA VẬT RẮN & ÁP SUẤT", grade: 10 },
  { id: "g11-ch1", name: "CHƯƠNG I. DAO ĐỘNG", grade: 11 },
  { id: "g11-ch2", name: "CHƯƠNG II. SÓNG", grade: 11 },
  { id: "g11-ch3", name: "CHƯƠNG III. ĐIỆN TRƯỜNG", grade: 11 },
  { id: "g11-ch4", name: "CHƯƠNG IV. DÒNG ĐIỆN KHÔNG ĐỔI & MẠCH ĐIỆN", grade: 11 },
  { id: "g12-ch1", name: "CHƯƠNG I. VẬT LÝ NHIỆT", grade: 12 },
  { id: "g12-ch2", name: "CHƯƠNG II. KHÍ LÝ TƯỞNG", grade: 12 },
  { id: "g12-ch3", name: "CHƯƠNG III. TỪ TRƯỜNG", grade: 12 },
  { id: "g12-ch4", name: "CHƯƠNG IV. VẬT LÝ HẠT NHÂN", grade: 12 },
];

export function getStudyChapter(id?: string | null) {
  return STUDY_CHAPTERS.find(chapter => chapter.id === id);
}

export const STUDY_QUESTION_TYPES: { value: StudyQuestionType; label: string }[] = [
  { value: 'trac_nghiem', label: 'Trắc nghiệm 4 đáp án' },
  { value: 'dung_sai', label: 'Đúng/Sai' },
  { value: 'tu_luan', label: 'Trả lời ngắn' },
];

export function isStudyQuestionType(value?: string | null): value is StudyQuestionType {
  return STUDY_QUESTION_TYPES.some(option => option.value === value);
}

export function studySectionParams(section: StudySection) {
  return {
    folder: section.chapterId,
    type: section.questionType,
    ...(section.lessonId ? { lesson: section.lessonId } : {}),
  };
}

export function nextStudyQuestionNumber(blogs: BlogPost[], section: StudySection) {
  let count = 0;
  let highest = 0;
  for (const blog of blogs) {
    const placement = blog.studySection;
    if (placement?.chapterId !== section.chapterId || placement.questionType !== section.questionType
      || placement.lessonId !== section.lessonId) continue;

    try {
      const { type, data } = JSON.parse(blog.content);
      if (type !== 'physics_solution' || !data) continue;
      const questions = Array.isArray(data.questions) && data.questions.length ? data.questions : [data];
      count += questions.length;
      for (const question of questions) {
        const match = /^(?:Câu\s+)?(\d+)$/i.exec(String(question?.question_no ?? '').trim());
        const number = match ? Number(match[1]) : 0;
        if (Number.isSafeInteger(number) && number < Number.MAX_SAFE_INTEGER) highest = Math.max(highest, number);
      }
    } catch { /* Other article formats do not reserve a question number. */ }
  }
  return Math.max(count, highest) + 1;
}
