import { normalizeMatrixText } from '../utils/examMatrix';
import { curriculumRequirements, type CurriculumRequirement } from './physics10Curriculum';

// Bài học theo SGK Vật lí 10 – Kết nối tri thức với cuộc sống (mục lục do người dùng cung cấp).
// Chương SGK lệch kho một chương: SGK xếp Mở đầu là Chương I, kho xếp Mở đầu riêng (g10-ch0).
// `requirements`: mã YCCĐ của chương trình mà bài đó dạy. Đây là đối chiếu của tác giả, cần giáo viên thẩm định.

export interface TextbookLesson {
    /** Số bài trong SGK. */
    number: number;
    /** Tên bài đúng như SGK. */
    title: string;
    /** Chương trong kho (STUDY_CHAPTERS). */
    chapterId: string;
    /** Tên chương đúng như SGK. */
    textbookChapter: string;
    requirements: readonly string[];
}

const CHAPTERS: Record<string, string> = {
    'g10-ch0': 'Chương I. Mở đầu',
    'g10-ch1': 'Chương II. Động học',
    'g10-ch2': 'Chương III. Động lực học',
    'g10-ch3': 'Chương IV. Năng lượng, công, công suất',
    'g10-ch4': 'Chương V. Động lượng',
    'g10-ch5': 'Chương VI. Chuyển động tròn',
    'g10-ch6': 'Chương VII. Biến dạng của vật rắn. Áp suất chất lỏng',
};

const rows: [number, string, string, number[]][] = [
    [1, 'Làm quen với Vật lí', 'g10-ch0', [1, 2, 3, 4, 5]],
    [2, 'Các quy tắc an toàn trong phòng thực hành Vật lí', 'g10-ch0', [6]],
    [3, 'Thực hành tính sai số trong phép đo. Ghi kết quả đo', 'g10-ch0', [6]],
    [4, 'Độ dịch chuyển và quãng đường đi được', 'g10-ch1', [2, 3]],
    [5, 'Tốc độ và vận tốc', 'g10-ch1', [1, 4, 7, 8]],
    [6, 'Thực hành: Đo tốc độ của vật chuyển động', 'g10-ch1', [9, 10]],
    [7, 'Đồ thị độ dịch chuyển – thời gian', 'g10-ch1', [5, 6]],
    [8, 'Chuyển động biến đổi. Gia tốc', 'g10-ch1', [11]],
    [9, 'Chuyển động thẳng biến đổi đều', 'g10-ch1', [12, 13, 14, 15]],
    [10, 'Sự rơi tự do', 'g10-ch1', [15]],
    [11, 'Thực hành: Đo gia tốc rơi tự do', 'g10-ch1', [17]],
    [12, 'Chuyển động ném', 'g10-ch1', [16, 18]],
    [13, 'Tổng hợp và phân tích lực. Cân bằng lực', 'g10-ch2', [6, 12, 13]],
    [14, 'Định luật 1 Newton', 'g10-ch2', [3]],
    [15, 'Định luật 2 Newton', 'g10-ch2', [1, 2, 4]],
    [16, 'Định luật 3 Newton', 'g10-ch2', [9]],
    [17, 'Trọng lực và lực căng', 'g10-ch2', [5, 10]],
    [18, 'Lực ma sát', 'g10-ch2', [10]],
    [19, 'Lực cản và lực nâng', 'g10-ch2', [7, 8, 10, 11]],
    [20, 'Một số ví dụ về cách giải các bài toán thuộc phần động lực học', 'g10-ch2', [1, 9]],
    [21, 'Moment lực. Cân bằng của vật rắn', 'g10-ch2', [15, 16, 17]],
    [22, 'Thực hành: Tổng hợp lực', 'g10-ch2', [14, 18]],
    [23, 'Năng lượng. Công cơ học', 'g10-ch3', [1, 2, 3]],
    [24, 'Công suất', 'g10-ch3', [8, 9]],
    [25, 'Động năng, thế năng', 'g10-ch3', [4, 5]],
    [26, 'Cơ năng và định luật bảo toàn cơ năng', 'g10-ch3', [6, 7]],
    [27, 'Hiệu suất', 'g10-ch3', [10]],
    [28, 'Động lượng', 'g10-ch4', [1, 4]],
    [29, 'Định luật bảo toàn động lượng', 'g10-ch4', [2, 3, 5, 6]],
    [30, 'Thực hành: Xác định động lượng của vật trước và sau va chạm', 'g10-ch4', [7]],
    [31, 'Động học của chuyển động tròn đều', 'g10-ch5', [1, 2]],
    [32, 'Lực hướng tâm và gia tốc hướng tâm', 'g10-ch5', [3, 4, 5]],
    [33, 'Biến dạng của vật rắn', 'g10-ch6', [3, 4, 5]],
    [34, 'Khối lượng riêng. Áp suất chất lỏng', 'g10-ch6', [1, 2]],
];

export const PHYSICS_10_LESSONS: readonly TextbookLesson[] = rows.map(([number, title, chapterId, requirements]) => ({
    number, title, chapterId, textbookChapter: CHAPTERS[chapterId],
    requirements: requirements.map(index => chapterId + '-yc' + String(index).padStart(2, '0')),
}));

export function textbookLessonLabel(lesson: TextbookLesson) {
    return 'Bài ' + lesson.number + '. ' + lesson.title;
}

export function textbookLessons(chapterId: string) {
    return PHYSICS_10_LESSONS.filter(lesson => lesson.chapterId === chapterId);
}

export function lessonRequirements(lesson: TextbookLesson): CurriculumRequirement[] {
    const byId = new Map(curriculumRequirements(lesson.chapterId).map(requirement => [requirement.id, requirement]));
    return lesson.requirements.flatMap(id => byId.get(id) ?? []);
}

// Tên bài đang lưu trong kho → số bài SGK. Chỉ đổi cách hiển thị và gom nhóm; dữ liệu gốc giữ nguyên.
const LEGACY_TITLES: Record<string, number> = {
    'BÀI 1: NĂNG LƯỢNG VÀ CÔNG CƠ HỌC': 23,
    'BÀI 1.1: NĂNG LƯỢNG': 23,
    'BÀI 1.2: CÔNG CƠ HỌC': 23,
    'BÀI 2: CÔNG SUẤT': 24,
    'BÀI 3: ĐỘNG NĂNG': 25,
    'BÀI 3.1: ĐỘNG NĂNG': 25,
    'BÀI 3.2: THẾ NĂNG': 25,
    'BÀI 4: THẾ NĂNG': 25,
    'BÀI 4.1: CƠ NĂNG': 26,
    'BÀI 4.1: CƠ NĂNG - ĐỊNH LUẬT BẢO TOÀN CƠ NĂNG': 26,
    'BÀI 4.2: ĐỊNH LUẬT BẢO TOÀN CƠ NĂNG': 26,
    'BÀI 4.2: CON LẮC ĐƠN': 26,
    'BÀI 5: HIỆU SUẤT': 27,
};
const legacy = new Map(Object.entries(LEGACY_TITLES).map(([title, number]) => [normalizeMatrixText(title), number]));
const lessonByTitle = new Map(PHYSICS_10_LESSONS.map(lesson => [normalizeMatrixText(textbookLessonLabel(lesson)), lesson]));

/** Bài SGK của một câu, từ tên bài đang lưu trong kho (tên cũ hoặc đã đúng tên SGK). */
export function textbookLessonFor(chapterId: string | undefined, storedTitle: string | undefined): TextbookLesson | undefined {
    if (!chapterId || !storedTitle) return undefined;
    const key = normalizeMatrixText(storedTitle);
    const number = legacy.get(key);
    const lesson = number ? PHYSICS_10_LESSONS.find(row => row.number === number) : lessonByTitle.get(key);
    return lesson?.chapterId === chapterId ? lesson : undefined;
}
