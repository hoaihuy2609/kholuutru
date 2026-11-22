import { describe, expect, it } from 'vitest';
import { LESSON_LINES, lessonLine, lessonOfProgrammeRow } from '../data/lessonLines';
import { lessonIssues, lessonPool, lessonSelections, lessonStatus, lessonTopics, lessonUnits, suggestLessons, type LessonCandidate } from '../utils/lessonSpec';
import { buildMatrixExport, defaultMatrixExportSettings } from '../utils/matrixExport';
import type { MatrixAllocation } from '../utils/matrixPlan';

const chapter = 'g10-ch3';
let next = 0;
function question(lesson: number, type: 'trac_nghiem' | 'tu_luan', level: number, line?: string): LessonCandidate;
function question(lesson: number, type: 'dung_sai', levels: number[], lines: (string | undefined)[]): LessonCandidate;
function question(lesson: number, type: LessonCandidate['item']['type'], level: number | number[], line?: string | (string | undefined)[]): LessonCandidate {
    const id = 'q' + ++next;
    const statements = Array.isArray(level) ? level.map((value, index) => ({ label: 'abcd'[index], claim: id + 'abcd'[index], cognitive_level: value })) : undefined;
    return { chapterId: chapter, grade: 10, lesson, programmeMatch: 'direct',
        specLines: Array.isArray(line) ? line.map(value => value && 'g10-ch3-' + value) : [line && 'g10-ch3-' + line],
        item: { id, questionNo: id, type, level: Array.isArray(level) ? 0 : level, statements } as unknown as LessonCandidate['item'] };
}
const allocation = (lesson: number, type: MatrixAllocation['type'], level: number, count: number): MatrixAllocation =>
    ({ chapterId: chapter, chapter: 'Công, năng lượng, công suất', topicId: 'lesson-' + lesson, topic: 'Bài ' + lesson, type, level, count });

describe('lesson lines', () => {
    it('keeps the approved lines verbatim and finds the lesson of a programme row', () => {
        expect(LESSON_LINES.filter(line => line.source === 'DX')).toHaveLength(6);
        expect(LESSON_LINES.filter(line => line.source === 'CTP').map(line => line.id)).toHaveLength(8);
        expect(lessonLine('g10-ch3-23-V2')?.text).toBe('Vận dụng được công thức tính công trong các bài tập đơn giản.');
        expect(lessonLine('g10-ch3-C1-15')?.text).toBe('Vận dụng được các công thức của chuyển động thẳng biến đổi đều.');
        expect(lessonOfProgrammeRow(chapter, 'g10-ch3-yc07b')).toBe(26);
        expect(lessonOfProgrammeRow(chapter, 'g10-ch3-yc10a')).toBe(27);
        expect(lessonOfProgrammeRow(chapter, 'g10-ch2-yc01')).toBeUndefined();
    });

    it('drops a line whose level differs from the unit and counts alias lines under the SGV line', () => {
        const units = lessonUnits(question(24, 'dung_sai', [1, 3, 2, 3], ['24-B2', '24-V2', '24-V1', undefined]));
        expect(units.map(unit => unit.line?.id)).toEqual(['g10-ch3-24-B1', 'g10-ch3-24-V1', undefined, undefined]);
    });
});

describe('specification by lesson', () => {
    it('uses lessons only when every content is a lesson with lines, counting true-false by question', () => {
        expect(lessonTopics([allocation(23, 'trac_nghiem', 1, 2), allocation(23, 'dung_sai', 0, 3)])?.[0])
            .toMatchObject({ lesson: { id: 23 }, need: { trac_nghiem: [2, 0, 0] }, trueFalse: 3 });
        expect(lessonTopics([allocation(23, 'trac_nghiem', 1, 2), { ...allocation(23, 'trac_nghiem', 1, 1), topicId: 'work' }])).toBeUndefined();
        expect(lessonTopics([allocation(23, 'dung_sai', 2, 4)])).toBeUndefined();
    });

    it('suggests questions spread over lines, true-false statements matching the matrix, and exports each statement at its own line', () => {
        const bank = [
            question(23, 'trac_nghiem', 1, '23-B1'), question(23, 'trac_nghiem', 1, '23-B1'), question(23, 'trac_nghiem', 1, 'P23-B1'),
            question(23, 'trac_nghiem', 1), question(23, 'tu_luan', 3, '23-V2'),
            question(23, 'dung_sai', [1, 1, 2, 3], ['23-B1', '23-B1', '23-H2', '26-V1']),
            question(23, 'dung_sai', [2, 2, 3, 3], ['23-H2', '23-H1', '23-V2', 'C1-15']),
            question(23, 'dung_sai', [1, 1, 1, 1], ['23-B1', '23-B1', '23-B1', '23-B1']),
            question(24, 'trac_nghiem', 1, '24-B1'),
        ];
        const allocations = [allocation(23, 'trac_nghiem', 1, 2), allocation(23, 'tu_luan', 3, 1), allocation(23, 'dung_sai', 0, 2)];
        const topics = lessonTopics(allocations)!;
        const pool = lessonPool(bank, [chapter]);
        const { chosen, notes } = suggestLessons(topics, pool, () => 0.5);
        expect(notes).toEqual([]);
        const picked = [...chosen].map(id => pool.byId.get(id)!);
        const lines = picked.filter(item => item.item.type === 'trac_nghiem').map(item => item.specLines![0]);
        expect(new Set(lines).size).toBe(2);
        expect(lines).not.toContain(undefined);
        // Đúng/Sai lấy đủ số câu của bài; ở đây giáo viên đổi sang hai câu có ý thuộc bài khác và chương trước.
        expect(picked.filter(item => item.item.type === 'dung_sai')).toHaveLength(2);
        for (const item of bank.filter(item => item.item.type === 'dung_sai')) chosen.delete(item.item.id);
        for (const item of [bank[5], bank[6]]) chosen.add(item.item.id);
        expect(lessonStatus(topics[0], chosen, pool.byId)).toMatchObject({ done: true, questions: 5 });
        expect(lessonIssues(topics, chosen, pool.byId)).toEqual([]);

        const { selections, codes } = lessonSelections(allocations, topics, chosen, pool.byId);
        expect(selections).toHaveLength(5);
        const doc = buildMatrixExport(allocations, selections, defaultMatrixExportSettings());
        const first = doc.units.filter(unit => unit.questionId === bank[5].item.id);
        expect(first.map(unit => unit.reference)).toEqual(['C1a', 'C1b', 'C1c', 'C1d'].map(ref => ref.replace('1', codes.get(bank[5].item.id)!.slice(1))));
        expect(first[0].outcome).toBe('Phát biểu được định nghĩa, viết được công thức tính công và đơn vị đo của công.');
        expect(first[3].outcome).toBe(lessonLine('g10-ch3-26-V1')!.text);
        const second = doc.units.filter(unit => unit.questionId === bank[6].item.id);
        expect(second[3].outcome).toBe(lessonLine('g10-ch3-C1-15')!.text);
        expect(doc.units.every(unit => unit.outcome)).toBe(true);
    });

    it('suggests true-false questions whose statements all have a line first', () => {
        const loose = question(26, 'dung_sai', [2, 2, 3, 3], ['26-H1', undefined, '26-V2', '26-V2']);
        const lined = question(26, 'dung_sai', [1, 2, 2, 3], ['26-B1', '26-H1', '26-H1', '26-V1']);
        const topics = lessonTopics([allocation(26, 'dung_sai', 0, 1)])!;
        for (const rng of [() => 0.1, () => 0.9]) {
            expect([...suggestLessons(topics, lessonPool([loose, lined], [chapter]), rng).chosen]).toEqual([lined.item.id]);
        }
        expect(suggestLessons(lessonTopics([allocation(26, 'dung_sai', 0, 3)])!, lessonPool([loose, lined], [chapter])).notes)
            .toEqual(['Bài 26. Cơ năng và định luật bảo toàn cơ năng · Đúng/Sai: kho thiếu 1 câu.']);
    });

    it('reports what is missing or over for a lesson', () => {
        const bank = [question(25, 'trac_nghiem', 2, '25-H2'), question(25, 'trac_nghiem', 2, '25-H2')];
        const topics = lessonTopics([allocation(25, 'trac_nghiem', 2, 1)])!;
        const pool = lessonPool(bank, [chapter]);
        const status = lessonStatus(topics[0], new Set(bank.map(item => item.item.id)), pool.byId);
        expect(status).toMatchObject({ done: false, missing: [], over: ['1 câu Nhiều lựa chọn Thông hiểu'] });
        expect(lessonStatus(topics[0], new Set(), pool.byId)).toMatchObject({ missing: ['1 câu Nhiều lựa chọn Thông hiểu'], questions: 0, needed: 1 });
        const trueFalse = lessonTopics([allocation(25, 'dung_sai', 0, 1)])!;
        expect(lessonStatus(trueFalse[0], new Set(), pool.byId).missing).toEqual(['1 câu Đúng/Sai']);
    });
});
