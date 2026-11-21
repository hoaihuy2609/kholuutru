/**
 * Bản đặc tả chương III (Năng lượng, công, công suất) theo bài SGK Kết nối tri thức × 3 mức × dòng yêu cầu cần đạt.
 *
 * Mỗi bài có các dòng YCCĐ ở từng mức Biết, Hiểu, Vận dụng. Câu chữ là nguyên văn mục tiêu bài học trong SGV Vật lí 10
 * (Kết nối tri thức) hoặc vế nguyên văn YCCĐ của Chương trình GDPT 2018 (Thông tư 32), kể cả YCCĐ chương trước mà ý hỗ trợ
 * trong câu dùng tới. Dòng "Đề xuất" do người soạn viết cho phần SGV và Chương trình chưa có câu chữ ở đúng mức; giáo viên đã duyệt.
 * Vế trích từ một câu YCCĐ dài được viết thành câu trọn: viết hoa chữ đầu, kết thúc bằng dấu chấm, không thêm bớt chữ;
 * chữ cần thêm để vế đủ nghĩa (lấy từ chính câu YCCĐ đó) đặt trong ngoặc vuông.
 * Mức của từng câu, từng ý theo quy tắc: nhắc lại là Biết, định tính là Hiểu, có tính toán ra số là Vận dụng.
 * Câu (trắc nghiệm, trả lời ngắn) và từng ý Đúng/Sai trong kho được gắn vào dòng qua trường spec_line.
 */
export type LessonLineSource = 'SGV' | 'CT' | 'CTP' | 'DX';

export interface LessonLine {
    /** Mã ổn định lưu trên câu, ví dụ g10-ch3-23-V2. */
    id: string;
    chapterId: string;
    /** Số bài SGK; 0 là YCCĐ chương trước, dùng chung cho mọi bài. */
    lesson: number;
    /** 1 Biết, 2 Hiểu, 3 Vận dụng; 0 là dòng thực hành, không ra đề trên giấy. */
    level: 0 | 1 | 2 | 3;
    source: LessonLineSource;
    /** Vị trí trong văn bản gốc, ví dụ "YCCĐ 10, vế sau". */
    reference: string;
    text: string;
    /** Dòng CT trùng ý với một dòng SGV: không hiện riêng, câu được tính vào dòng SGV. */
    alias?: string;
}

export interface SpecLesson { id: number; chapterId: string; name: string; periods: number }

export const SPEC_LESSONS: readonly SpecLesson[] = [
    { id: 23, chapterId: 'g10-ch3', name: "Bài 23. Năng lượng. Công cơ học", periods: 2 },
    { id: 24, chapterId: 'g10-ch3', name: "Bài 24. Công suất", periods: 1 },
    { id: 25, chapterId: 'g10-ch3', name: "Bài 25. Động năng, thế năng", periods: 2 },
    { id: 26, chapterId: 'g10-ch3', name: "Bài 26. Cơ năng và định luật bảo toàn cơ năng", periods: 2 },
    { id: 27, chapterId: 'g10-ch3', name: "Bài 27. Hiệu suất", periods: 1 },
];

type LineSpec = [id: string, lesson: number, level: LessonLine['level'], source: LessonLineSource, reference: string, text: string, alias?: string];

const CHAPTER_III: LineSpec[] = [
    ["23-B1", 23, 1, "SGV", "", "Phát biểu được định nghĩa, viết được công thức tính công và đơn vị đo của công."],
    ["23-H1", 23, 2, "SGV", "", "Xác định được các dạng khác nhau của năng lượng và sự chuyển hoá giữa các dạng năng lượng."],
    ["23-H2", 23, 2, "SGV", "", "Xác định được vai trò của lực sinh công đối với chuyển động của vật bị lực này tác dụng: công kéo, công cản."],
    ["23-H3", 23, 2, "SGV", "", "Hiểu được rằng sinh công là một trong số các cách chuyển hoá năng lượng."],
    ["23-V1", 23, 3, "SGV", "", "Vận dụng để xác định được một quá trình chuyển hoá năng lượng thông qua thực hiện công, truyền nhiệt."],
    ["23-V2", 23, 3, "SGV", "", "Vận dụng được công thức tính công trong các bài tập đơn giản."],
    ["23-T", 23, 0, "SGV", "", "Thiết kế được mô hình đơn giản để kiểm chứng định luật bảo toàn năng lượng."],
    ["24-B1", 24, 1, "SGV", "", "Phát biểu được định nghĩa, viết được công thức tính và biết được đơn vị đo của công suất."],
    ["24-B2", 24, 1, "CT", "YCCĐ 8", "Từ một số tình huống thực tế, thảo luận để nêu được ý nghĩa vật lí và định nghĩa công suất.", "24-B1"],
    ["24-H1", 24, 2, "SGV", "", "Hiểu được ý nghĩa vật lí của công suất chính là tốc độ sinh công."],
    ["24-V1", 24, 3, "SGV", "", "Vận dụng được biểu thức liên hệ giữa công suất với lực và vận tốc vào một số tình huống cụ thể trong đời sống."],
    ["24-V2", 24, 3, "CT", "YCCĐ 9", "Vận dụng được mối liên hệ công suất (hay tốc độ thực hiện công) với tích của lực và vận tốc trong một số tình huống thực tế.", "24-V1"],
    ["25-B1", 25, 1, "SGV", "", "Phát biểu được định nghĩa, viết được công thức tính và biết được đơn vị đo của động năng, thế năng."],
    ["25-B2", 25, 1, "CT", "YCCĐ 5, vế đầu", "Nêu được công thức tính thế năng trong trường trọng lực đều."],
    ["25-H1", 25, 2, "SGV", "", "Hiểu được đơn vị đo của động năng và thế năng."],
    ["25-H2", 25, 2, "CT", "YCCĐ 4", "Từ phương trình chuyển động thẳng biến đổi đều với vận tốc ban đầu bằng không, rút ra được động năng của vật có giá trị bằng công của lực tác dụng lên vật."],
    ["25-V1", 25, 3, "SGV", "", "Vận dụng được biểu thức liên hệ giữa công thực hiện lên vật để vật có động năng, thế năng."],
    ["25-V2", 25, 3, "CT", "YCCĐ 5, vế sau", "Vận dụng được [công thức tính thế năng] trong một số trường hợp đơn giản."],
    ["26-B1", 26, 1, "SGV", "", "Phát biểu được định nghĩa cơ năng và đơn vị đo của cơ năng."],
    ["26-B2", 26, 1, "SGV", "", "Viết được công thức tính cơ năng của vật trong trường trọng lực."],
    ["26-B3", 26, 1, "CT", "YCCĐ 7, vế giữa", "Phát biểu được định luật bảo toàn cơ năng."],
    ["26-H1", 26, 2, "SGV", "", "Phân tích được sự chuyển hoá qua lại giữa động năng và thế năng."],
    ["26-H2", 26, 2, "CT", "YCCĐ 6", "Phân tích được sự chuyển hoá động năng và thế năng của vật trong một số trường hợp đơn giản.", "26-H1"],
    ["26-V1", 26, 3, "SGV", "", "Vận dụng được sự chuyển hoá qua lại giữa động năng, thế năng và định luật bảo toàn cơ năng vào một số tình huống thực tế."],
    ["26-V2", 26, 3, "CT", "YCCĐ 7, vế cuối", "Vận dụng được định luật bảo toàn cơ năng trong một số trường hợp đơn giản."],
    ["27-B1", 27, 1, "SGV", "", "Nhận biết được năng lượng có ích và năng lượng hao phí trong các quá trình chuyển hoá năng lượng."],
    ["27-B2", 27, 1, "CT", "YCCĐ 10, trích vế đầu", "Nêu được định nghĩa hiệu suất."],
    ["27-H1", 27, 2, "SGV", "", "Hiểu được khái niệm hiệu suất."],
    ["27-H2", 27, 2, "CT", "YCCĐ 10, vế đầu", "Từ tình huống thực tế, thảo luận để nêu được định nghĩa hiệu suất."],
    ["27-V1", 27, 3, "SGV", "", "Vận dụng được khái niệm hiệu suất vào một số tình huống thực tế."],
    ["27-V2", 27, 3, "CT", "YCCĐ 10, vế sau", "Vận dụng được hiệu suất trong một số trường hợp thực tế.", "27-V1"],
    ["C1-15", 0, 3, "CTP", "Động học, YCCĐ 15", "Vận dụng được các công thức của chuyển động thẳng biến đổi đều."],
    ["C2-10", 0, 2, "CTP", "Động lực học, YCCĐ 10", "Mô tả được bằng ví dụ thực tiễn và biểu diễn được bằng hình vẽ: Trọng lực; Lực ma sát; Lực cản khi một vật chuyển động trong nước (hoặc trong không khí); Lực nâng (đẩy lên trên) của nước; Lực căng dây."],
    ["C2-03", 0, 2, "CTP", "Động lực học, YCCĐ 3", "Phát biểu định luật 1 Newton và minh hoạ được bằng ví dụ cụ thể."],
    ["C2-01", 0, 2, "CTP", "Động lực học, YCCĐ 1", "Rút ra được biểu thức a = F/m hoặc F = ma (định luật 2 Newton)."],
    ["C2-01V", 0, 3, "CTP", "Động lực học, YCCĐ 1", "Rút ra được biểu thức a = F/m hoặc F = ma (định luật 2 Newton)."],
    ["C2-05", 0, 3, "CTP", "Động lực học, YCCĐ 5", "Nêu được: trọng lượng của vật được tính bằng tích khối lượng của vật với gia tốc rơi tự do."],
    ["C1-16", 0, 3, "CTP", "Động học, YCCĐ 16", "Mô tả và giải thích được chuyển động khi vật có vận tốc không đổi theo một phương và có gia tốc không đổi theo phương vuông góc với phương này."],
    ["C1-07", 0, 3, "CTP", "Động học, YCCĐ 7", "Xác định được độ dịch chuyển tổng hợp, vận tốc tổng hợp."],
    ["P23-B1", 23, 1, "DX", "", "Nhận biết được các dạng năng lượng, tính chất chung của năng lượng; phát biểu được định luật bảo toàn năng lượng."],
    ["P23-B2", 23, 1, "DX", "", "Nêu được thực hiện công là một cách truyền năng lượng."],
    ["P24-H", 24, 2, "DX", "", "Giải thích được mối liên hệ giữa lực phát động, tốc độ và công suất (định tính)."],
    ["P24-V", 24, 3, "DX", "", "Vận dụng được công thức P = A/t để tính công suất, công, thời gian."],
    ["P25-B", 25, 1, "DX", "", "Nêu được định lí động năng: độ biến thiên động năng bằng tổng công của ngoại lực."],
    ["P25-H", 25, 2, "DX", "", "Xác định được thế năng tăng hay giảm và sự phụ thuộc của thế năng vào mốc thế năng."],
];

export const LESSON_LINES: readonly LessonLine[] = CHAPTER_III.map(([id, lesson, level, source, reference, text, alias]) => ({
    id: 'g10-ch3-' + id, chapterId: 'g10-ch3', lesson, level, source, reference, text,
    ...(alias ? { alias: 'g10-ch3-' + alias } : {}),
}));
const BY_ID = new Map(LESSON_LINES.map(line => [line.id, line]));

export const lessonLine = (id: unknown) => typeof id === 'string' ? BY_ID.get(id) : undefined;
export const specLessons = (chapterId: string | undefined) => SPEC_LESSONS.filter(lesson => lesson.chapterId === chapterId);
/** Mã nội dung của bài trong ma trận. */
export const lessonTopicId = (lesson: number) => 'lesson-' + lesson;
export function topicLesson(topicId: string) {
    const match = /^lesson-(\d+)$/.exec(topicId);
    return match ? Number(match[1]) : undefined;
}

/** Bài của câu theo YCCĐ chương trình mà câu được rót vào (programme_row). */
const LESSON_OF_REQUIREMENT: Record<string, Record<number, number>> = {
    'g10-ch3': { 1: 23, 2: 23, 3: 23, 8: 24, 9: 24, 4: 25, 5: 25, 6: 26, 7: 26, 10: 27 },
};
export function lessonOfProgrammeRow(chapterId: string | undefined, rowId: unknown) {
    if (!chapterId || typeof rowId !== 'string' || !rowId.startsWith(chapterId + '-yc')) return undefined;
    const match = /^(\d+)[ab]?$/.exec(rowId.slice(chapterId.length + 3));
    return match ? LESSON_OF_REQUIREMENT[chapterId]?.[Number(match[1])] : undefined;
}

/** Nguồn ghi sau dòng trong bản đặc tả, ví dụ "CT, YCCĐ 10, vế sau". */
export function lessonLineSource(line: LessonLine) {
    if (line.source === 'SGV') return 'SGV';
    if (line.source === 'DX') return 'Đề xuất, GV đã duyệt';
    return 'CT, ' + line.reference + (line.source === 'CTP' ? ' (chương trước)' : '');
}

/** Nhãn ngắn của dòng, ví dụ "Bài 23 · Vận dụng · Vận dụng được công thức tính công…". */
export function lessonLineLabel(line: LessonLine) {
    const level = ['Thực hành', 'Biết', 'Hiểu', 'Vận dụng'][line.level];
    return (line.lesson ? 'Bài ' + line.lesson : 'Chương trước') + ' · ' + level + ' · ' + line.text + ' (' + lessonLineSource(line) + ')';
}
