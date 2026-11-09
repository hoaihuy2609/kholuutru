import { describe, expect, it } from 'vitest';
import { matrixMatchScore, matrixReferences, matrixSlots, type MatrixRow } from '../utils/examMatrix';
import { parsePdfMatrix, type MatrixPage } from '../utils/pdfExamMatrix';

describe('exam matrix', () => {
    it('reads counts from named columns without requiring question numbers', () => {
        const columns = [0, 125, 380, 475, 585];
        const page: MatrixPage = {
            rules: [
                ...columns.map(x => [x, 0, x, 90]),
                ...[0, 45, 90].map(y => [0, y, 585, y]),
            ],
            fragments: [
                [8, 64, 'Chủ đề'], [132, 64, 'Yêu cầu cần đạt'], [390, 64, 'Mức độ'],
                [480, 64, 'TN 4 PA'], [8, 19, 'Điện trường'], [132, 19, 'Nêu được khái niệm điện trường'],
                [390, 19, 'NB'], [480, 19, '2'],
            ].map(([x, y, text]) => ({ x: Number(x), y: Number(y), text: String(text), width: 45, height: 11 })),
        };
        const { rows } = parsePdfMatrix([page]);
        expect(rows).toEqual([{
            page: 1, section: '', topic: 'Điện trường', outcome: 'Nêu được khái niệm điện trường',
            level: 1, type: 'trac_nghiem', count: 2, references: [],
        }]);
        expect(matrixSlots(rows).slots).toHaveLength(2);
        const genericPage = {
            ...page,
            fragments: page.fragments.map(fragment => fragment.text === 'TN 4 PA' ? { ...fragment, text: 'TNKQ' } : fragment),
        };
        expect(parsePdfMatrix([genericPage]).rows[0]).toMatchObject({ section: 'TNKQ', type: '', count: 2 });
    });

    it('groups subparts within a section and keeps question numbers from different sections separate', () => {
        const base: MatrixRow = {
            section: 'Phần I', topic: 'Điện trường', outcome: 'Nêu được khái niệm điện trường',
            type: 'trac_nghiem', level: 1, count: 1, references: ['C1'],
        };
        expect(matrixSlots([
            base,
            { ...base, section: 'Phần II', type: 'written', references: ['C1a'] },
            { ...base, section: 'Phần II', type: 'written', references: ['C1b'] },
        ]).slots.map(slot => slot.rows.length)).toEqual([1, 2]);
        expect(matrixReferences('Câu 6–8, C 9 a')).toEqual(['C6', 'C7', 'C8', 'C9a']);
    });

    it('reads counts from a part header and holds true/false statements until all four have positions', () => {
        const fragments = [
            { x: 5, y: 104, text: '+ Phần II. Trắc nghiệm đúng sai: 2 Câu = 8 ý' },
            { x: 5, y: 66, text: 'Mức độ đánh giá' },
            { x: 305, y: 66, text: 'Phần II' },
            { x: 5, y: 20, text: 'Nêu được khái niệm điện trường' },
            { x: 305, y: 20, text: '4' },
        ].map(fragment => ({ ...fragment, width: 40, height: 11 }));
        const { rows } = parsePdfMatrix([{
            fragments,
            rules: [
                ...[0, 300, 400].map(x => [x, 0, x, 90]),
                ...[0, 45, 90].map(y => [0, y, 400, y]),
            ],
        }]);
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ type: 'dung_sai', count: 4, countUnit: 'statement' });
        expect(matrixSlots(rows)).toEqual({ slots: [], pendingStatements: 4 });
        expect(matrixSlots([{ ...rows[0], count: 2, references: ['C1a', 'C1b'] }]).pendingStatements).toBe(2);
        const grouped = matrixSlots([{ ...rows[0], references: ['C1a', 'C1b', 'C1c', 'C1d'] }]);
        expect(grouped.pendingStatements).toBe(0);
        expect(grouped.slots).toHaveLength(1);
    });

    it('reads Arabic-numbered parts with Roman-numbered notes and continues tables without repeated headers', () => {
        const columns = [0, 100, 350, 450];
        const gridPage = (top: number, edges: number[], items: [number, number, string][]): MatrixPage => ({
            rules: [
                ...columns.map(x => [x, 0, x, top]),
                ...edges.map(y => [0, y, 450, y]),
            ],
            fragments: items.map(([x, y, text]) => ({ x, y, text, width: 32, height: 10 })),
        });
        const notes = gridPage(0, [], [
            [10, 90, 'Phần I:'],
            [10, 72, 'Câu hỏi trắc nghiệm có 4 phương án lựa chọn'],
        ]);
        const start = gridPage(100, [0, 50, 100], [
            [8, 69, 'Nội dung'],
            [107, 69, 'Mức độ đánh giá'],
            [355, 83, 'Câu hỏi'],
            [355, 58, 'Phần 1'],
            [8, 33, 'Bài 14'],
            [107, 39, 'Nhận biết:'],
            [107, 25, '- Nêu được khái niệm từ'],
            [355, 30, 'C1, C2'],
        ]);
        start.rules.push([350, 75, 450, 75]);
        const continuation = gridPage(70, [0, 45, 70], [
            [107, 53, 'trường.'],
            [8, 25, 'Bài 15'],
            [107, 35, 'Nhận biết:'],
            [107, 21, '- Định nghĩa được cảm ứng từ.'],
            [355, 25, 'C3'],
        ]);
        const { rows } = parsePdfMatrix([notes, start, continuation]);
        expect(rows.map(row => row.references)).toEqual([['C1', 'C2'], ['C3']]);
        expect(rows.every(row => row.type === 'trac_nghiem' && row.level === 1)).toBe(true);
        expect(rows[0].outcome).toContain('khái niệm từ trường.');
        expect(rows[1].page).toBe(3);
    });

    it('enforces type and level before comparing requirements that use different wording', () => {
        const row: MatrixRow = {
            section: 'Phần I', topic: 'Điện trường', outcome: 'Nêu được biểu thức tính cường độ điện trường',
            type: 'trac_nghiem', level: 1, count: 1, references: [],
        };
        const candidate = { type: 'trac_nghiem' as const, level: 1, outcomes: ['Viết công thức tính cường độ điện trường'] };
        expect(matrixMatchScore([row], candidate)).toBeGreaterThan(0);
        expect(matrixMatchScore([row], { ...candidate, type: 'dung_sai' })).toBe(0);
        expect(matrixMatchScore([row], { ...candidate, level: 2 })).toBe(0);
        expect(matrixMatchScore([row], { ...candidate, outcomes: ['Tính cường độ điện trường'] })).toBe(0);
        expect(matrixMatchScore([{
            ...row, outcome: '- Nêu được đơn vị đo điện dung.\n- Nêu được biểu thức tính cường độ điện trường',
        }], candidate)).toBeGreaterThan(0);
    });
});
