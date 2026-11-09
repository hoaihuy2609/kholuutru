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
        expect(matrixSlots(rows)).toHaveLength(2);
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
        ]).map(slot => slot.rows.length)).toEqual([1, 2]);
        expect(matrixReferences('Câu 6–8, C 9 a')).toEqual(['C6', 'C7', 'C8', 'C9a']);
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
    });
});
