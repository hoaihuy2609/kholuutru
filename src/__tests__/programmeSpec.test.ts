import { describe, expect, it } from 'vitest';
import { programmeRow, programmeRows } from '../data/programmeRows';
import { PHYSICS_10_REQUIREMENTS } from '../data/physics10Curriculum';
import type { MatrixAllocation } from '../utils/matrixPlan';
import { buildMatrixExport, defaultMatrixExportSettings } from '../utils/matrixExport';
import { emptyProgrammeState, fillProgrammeCells, programmeCellKey, programmeIssues, programmePools, programmeSelections,
    programmeTopics, suggestProgramme, suggestTrueFalse, type ProgrammeCandidate } from '../utils/programmeSpec';

const chapterId = 'g10-ch3';
const allocation = (topicId: string, type: MatrixAllocation['type'], level: number, count: number): MatrixAllocation =>
    ({ chapterId, chapter: 'Công, năng lượng, công suất', topicId, topic: topicId === 'work' ? 'Công và năng lượng' : topicId, type, level, count });

let next = 0;
function question(row: string, type: 'trac_nghiem' | 'tu_luan' | 'dung_sai', level: number | number[], match: 'direct' | 'extended' | 'outside' = 'direct'): ProgrammeCandidate {
    const id = 'q' + ++next;
    const levels = Array.isArray(level) ? level : [level];
    return { chapterId, grade: 10, programmeRow: row, programmeMatch: match, item: {
        id, questionNo: 'Câu ' + next, qText: id, type, level: type === 'dung_sai' ? 0 : levels[0],
        statements: type === 'dung_sai' ? levels.map((value, index) => ({ label: 'abcd'[index], claim: 'ý', cognitive_level: value })) : undefined,
    } };
}
const sequence = () => { let seed = 1; return () => (seed = (seed * 16807) % 2147483647) / 2147483647; };

describe('programme rows', () => {
    it('keeps the 10 chapter III requirements, splitting 3, 5, 7 and 10 into a and b', () => {
        const rows = programmeRows(chapterId);
        expect(rows).toHaveLength(14);
        expect(new Set(rows.map(row => row.requirement.id)).size).toBe(10);
        expect(rows.filter(row => row.part).map(row => row.id)).toEqual([
            'g10-ch3-yc03a', 'g10-ch3-yc03b', 'g10-ch3-yc05a', 'g10-ch3-yc05b', 'g10-ch3-yc07a', 'g10-ch3-yc07b', 'g10-ch3-yc10a', 'g10-ch3-yc10b']);
        // Each split is cut from the programme text, never reworded beyond the verb of the second half.
        for (const row of rows.filter(row => !row.part)) expect(row.text).toBe(row.requirement.text);
        expect(PHYSICS_10_REQUIREMENTS.find(item => item.id === 'g10-ch3-yc03')!.text).toContain(programmeRow('g10-ch3-yc03b')!.text.replace(/\.$/, ''));
        expect(rows.map(row => row.topicId)).toEqual(['work', 'work', 'work', 'work', 'mechanical-energy', 'mechanical-energy', 'mechanical-energy',
            'mechanical-energy', 'mechanical-energy', 'mechanical-energy', 'power', 'power', 'power', 'power']);
    });
});

describe('programme specification', () => {
    const allocations = [
        allocation('work', 'trac_nghiem', 1, 2), allocation('work', 'trac_nghiem', 3, 1),
        allocation('work', 'dung_sai', 2, 1), allocation('work', 'dung_sai', 3, 3),
        allocation('work', 'tu_luan', 3, 1),
    ];
    const candidates = [
        question('g10-ch3-yc03a', 'trac_nghiem', 1), question('g10-ch3-yc03a', 'trac_nghiem', 1), question('g10-ch3-yc02', 'trac_nghiem', 1),
        question('g10-ch3-yc03b', 'trac_nghiem', 3), question('g10-ch3-yc03b', 'trac_nghiem', 3, 'outside'),
        question('g10-ch3-yc03b', 'tu_luan', 3), question('g10-ch3-yc01', 'trac_nghiem', 1, 'extended'),
        question('g10-ch3-yc03b', 'dung_sai', [2, 2, 3, 3]), question('g10-ch3-yc03b', 'dung_sai', [2, 3, 3, 3]),
        question('g10-ch4-yc01', 'trac_nghiem', 1),
    ];

    it('builds the topics only when every content has requirement rows', () => {
        const topics = programmeTopics(allocations)!;
        expect(topics).toHaveLength(1);
        expect(topics[0].rows).toHaveLength(4);
        expect(topics[0].need).toMatchObject({ trac_nghiem: [2, 0, 1], dung_sai: [0, 1, 3], tu_luan: [0, 0, 1] });
        expect(programmeTopics([{ ...allocations[0], chapterId: 'g10-ch4', topicId: 'momentum' }])).toBeUndefined();
    });

    it('only offers questions placed in a row of the same chapter and not outside the programme', () => {
        const pools = programmePools(candidates);
        expect(pools.cells.get(programmeCellKey('g10-ch3-yc03b', 'trac_nghiem', 3))).toHaveLength(1);
        expect(pools.byId.size).toBe(8);
    });

    it('suggests a split that matches the matrix, preferring rows whose verb fits the level and direct matches', () => {
        const topics = programmeTopics(allocations)!;
        const pools = programmePools(candidates);
        const state = suggestProgramme(topics, pools, sequence());
        expect(programmeIssues(topics, state, pools.byId)).toEqual([]);
        expect(state.counts[programmeCellKey('g10-ch3-yc03a', 'trac_nghiem', 1)]).toBe(2);
        expect(state.counts[programmeCellKey('g10-ch3-yc01', 'trac_nghiem', 1)]).toBeUndefined();
        expect(state.trueFalse['g10-ch3-yc03b']).toEqual([candidates[8].item.id]);

        const { selections, codes } = programmeSelections(allocations, topics, state, pools.byId);
        expect(selections).toHaveLength(5);
        expect(selections.every(selection => selection.outcome === selection.row.text)).toBe(true);
        expect(codes.get(candidates[8].item.id)).toBe('C1');
        const exported = buildMatrixExport(allocations, selections, { ...defaultMatrixExportSettings(), targetScore: 2 });
        expect(exported.units.filter(unit => unit.type === 'dung_sai').map(unit => unit.outcome))
            .toEqual(Array(4).fill('Tính được công trong một số trường hợp đơn giản.'));
        expect(exported.issues).toEqual([]);
    });

    it('reports cells that are not split, not chosen, and true-false statements that do not add up', () => {
        const topics = programmeTopics(allocations)!;
        const pools = programmePools(candidates);
        let state = emptyProgrammeState();
        state.counts[programmeCellKey('g10-ch3-yc03a', 'trac_nghiem', 1)] = 2;
        state.trueFalse['g10-ch3-yc03b'] = [candidates[7].item.id];
        const issues = programmeIssues(topics, state, pools.byId);
        expect(issues).toContain('Công và năng lượng · Nhiều lựa chọn Vận dụng: đã chia 0/1 câu vào các dòng YCCĐ.');
        expect(issues).toContain('Công và năng lượng · YCCĐ 3a · Nhiều lựa chọn Nhận biết: còn 2 câu chưa chọn.');
        expect(issues).toContain('Công và năng lượng · Đúng/Sai: các câu đã chọn gồm 2 Thông hiểu · 2 Vận dụng, ma trận cần 1 Thông hiểu · 3 Vận dụng.');
        state = fillProgrammeCells(state, pools, undefined, sequence());
        expect(state.picks[programmeCellKey('g10-ch3-yc03a', 'trac_nghiem', 1)]).toHaveLength(2);
        expect(suggestTrueFalse(topics[0], state, pools, sequence())!.trueFalse['g10-ch3-yc03b']).toEqual([candidates[8].item.id]);
    });
});
