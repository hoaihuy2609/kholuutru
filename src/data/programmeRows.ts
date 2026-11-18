import { PHYSICS_10_REQUIREMENTS, type CurriculumRequirement } from './physics10Curriculum';

/**
 * Dòng của bản đặc tả theo YCCĐ chương trình. Mỗi YCCĐ là một dòng; YCCĐ gồm hai vế ở hai mức
 * ("Nêu được…; Vận dụng được…") được tách thành hai dòng a, b, cắt đúng chữ của văn bản gốc.
 * Câu hỏi trong kho được gắn vào một dòng qua trường programme_row.
 */
export interface ProgrammeRow {
    /** Mã ổn định lưu trên câu hỏi, ví dụ g10-ch3-yc03b. */
    id: string;
    chapterId: string;
    requirement: CurriculumRequirement;
    /** Số thứ tự YCCĐ trong chương. */
    number: number;
    part?: 'a' | 'b';
    text: string;
    /** Nội dung của ma trận (chủ đề) mà dòng thuộc về. */
    topicId: string;
    /** Mức độ mà động từ của YCCĐ hướng tới. Rỗng: YCCĐ thực hành, chỉ có câu mở rộng trên giấy. */
    levels: readonly (1 | 2 | 3)[];
}

export type ProgrammeMatch = 'direct' | 'extended' | 'outside';
export const PROGRAMME_MATCH_LABELS: Record<ProgrammeMatch, string> = {
    direct: 'trực tiếp', extended: 'mở rộng', outside: 'ngoài chương trình',
};
export const readProgrammeMatch = (value: unknown): ProgrammeMatch | undefined =>
    value === 'direct' || value === 'extended' || value === 'outside' ? value : undefined;

type RowSpec = [number, (1 | 2 | 3)[], string?, ('a' | 'b')?];

/** Chương III. Năng lượng, công, công suất: 10 YCCĐ, tách YCCĐ 3, 5, 7, 10 thành a (nêu) và b (vận dụng). */
const CHAPTER_ROWS: Record<string, { topics: Record<string, string>; rows: RowSpec[] }> = {
    'g10-ch3': {
        topics: { 'Công và năng lượng': 'work', 'Động năng và thế năng': 'mechanical-energy', 'Công suất và hiệu suất': 'power' },
        rows: [
            [1, []],
            [2, [2]],
            [3, [1], 'Nêu được biểu thức tính công bằng tích của lực tác dụng và độ dịch chuyển theo phương của lực, nêu được đơn vị đo công là đơn vị đo năng lượng (với 1 J = 1 Nm).', 'a'],
            [3, [2, 3], 'Tính được công trong một số trường hợp đơn giản.', 'b'],
            [4, [2]],
            [5, [1], 'Nêu được công thức tính thế năng trong trường trọng lực đều.', 'a'],
            [5, [2, 3], 'Vận dụng được công thức tính thế năng trong một số trường hợp đơn giản.', 'b'],
            [6, [2]],
            [7, [1], 'Nêu được khái niệm cơ năng; phát biểu được định luật bảo toàn cơ năng.', 'a'],
            [7, [2, 3], 'Vận dụng được định luật bảo toàn cơ năng trong một số trường hợp đơn giản.', 'b'],
            [8, [1, 2]],
            [9, [2, 3]],
            [10, [1], 'Từ tình huống thực tế, thảo luận để nêu được định nghĩa hiệu suất.', 'a'],
            [10, [2, 3], 'Vận dụng được hiệu suất trong một số trường hợp thực tế.', 'b'],
        ],
    },
};

const ROWS: readonly ProgrammeRow[] = Object.entries(CHAPTER_ROWS).flatMap(([chapterId, { topics, rows }]) =>
    rows.map(([number, levels, text, part]) => {
        const id = chapterId + '-yc' + String(number).padStart(2, '0');
        const requirement = PHYSICS_10_REQUIREMENTS.find(item => item.id === id);
        if (!requirement) throw new Error('Thiếu YCCĐ ' + id);
        const topicId = topics[requirement.topic];
        if (!topicId) throw new Error('YCCĐ ' + id + ' chưa thuộc nội dung nào của ma trận.');
        return { id: id + (part ?? ''), chapterId, requirement, number, part, text: text ?? requirement.text, topicId, levels };
    }));
const BY_ID = new Map(ROWS.map(row => [row.id, row]));

export function programmeRows(chapterId: string | undefined): readonly ProgrammeRow[] {
    return ROWS.filter(row => row.chapterId === chapterId);
}

export const programmeRow = (id: unknown) => typeof id === 'string' ? BY_ID.get(id) : undefined;

export const programmeRowLabel = (row: ProgrammeRow) => 'YCCĐ ' + row.number + (row.part ?? '');
