import { describe, expect, it } from 'vitest';
import type { StatementCounts } from '../utils/matrixPlan';
import { rankTrueFalseCombos, trueFalseCombos, trueFalseFills, trueFalsePatterns } from '../utils/trueFalseCombos';
import { applyTrueFalseFill, programmePools, programmeTopics, trueFalseFillOptions, trueFalseRemaining, emptyProgrammeState, type ProgrammeCandidate } from '../utils/programmeSpec';

const bank: StatementCounts[] = [[0, 4, 0], [0, 4, 0], [0, 2, 2], [0, 2, 2], [0, 2, 2], [4, 0, 0], [0, 1, 3]];

describe('true-false combinations', () => {
    it('lists only the level splits the bank can make, with the number of ways to pick questions', () => {
        const patterns = trueFalsePatterns(bank);
        expect(patterns).toHaveLength(4);
        const combos = trueFalseCombos(patterns, 2);
        const byTotal = new Map(combos.map(combo => [combo.total.join(), combo.ways]));
        // Only two of the three "0·2·2" questions make 0·4·4: C(3, 2) = 3 ways.
        expect(byTotal.get('0,4,4')).toBe(3);
        expect(byTotal.get('0,6,2')).toBe(2 * 3);
        expect(byTotal.get('4,2,2')).toBe(3);
        expect(byTotal.has('2,3,3')).toBe(false);
        // The single 4·0·0 question cannot be used twice.
        expect(byTotal.has('8,0,0')).toBe(false);
        expect(trueFalseCombos(patterns, 2, [2, 3, 3])).toEqual([]);
        expect(trueFalseCombos(patterns, 2, [4, 2, 2])).toHaveLength(1);
    });

    it('puts the split closest to 4 : 3 : 3 first', () => {
        const ranked = rankTrueFalseCombos(trueFalseCombos(trueFalsePatterns(bank), 2));
        expect(ranked[0].total).toEqual([4, 2, 2]);
        expect(trueFalseFills(trueFalsePatterns(bank), 2, [0, 3, 5])).toEqual([
            { total: [0, 3, 5], ways: 3, patterns: [{ counts: [0, 2, 2], times: 1 }, { counts: [0, 1, 3], times: 1 }] },
        ]);
    });
});

describe('true-false fills in the specification', () => {
    let next = 0;
    const question = (row: string, levels: number[]): ProgrammeCandidate => ({ chapterId: 'g10-ch3', grade: 10, programmeRow: row, programmeMatch: 'direct',
        item: { id: 'q' + ++next, questionNo: 'Câu', qText: '', type: 'dung_sai', level: 0,
            statements: levels.map((value, index) => ({ label: 'abcd'[index], claim: 'ý', cognitive_level: value })) } });
    const candidates = [question('g10-ch3-yc03b', [2, 2, 3, 3]), question('g10-ch3-yc03b', [2, 3, 3, 3]),
        question('g10-ch3-yc03a', [1, 1, 2, 2]), question('g10-ch3-yc02', [1, 2, 3, 3])];
    const allocation = (level: number, count: number) => ({ chapterId: 'g10-ch3', chapter: 'Năng lượng', topicId: 'work', topic: 'Công và năng lượng',
        type: 'dung_sai' as const, level, count });

    it('offers whole groups of questions that fill exactly what is still missing, preferring the open row', () => {
        const topics = programmeTopics([allocation(1, 2), allocation(2, 3), allocation(3, 3)])!;
        const pools = programmePools(candidates);
        const fills = trueFalseFillOptions(topics[0], emptyProgrammeState(), pools);
        // 2 Biết · 3 Hiểu · 3 VD: only the 2·2·0 question with the 0·1·3 question adds up (1·1·2 would need a 1·2·1).
        expect(fills).toEqual([{ total: [2, 3, 3], ways: 1, patterns: [{ counts: [2, 2, 0], times: 1 }, { counts: [0, 1, 3], times: 1 }] }]);
        const state = applyTrueFalseFill(topics[0], emptyProgrammeState(), pools, fills[0], 'g10-ch3-yc03b', () => 0.5)!;
        expect(trueFalseRemaining(topics[0], state, pools.byId)).toEqual([0, 0, 0]);
        // Each question goes into the row it was placed in.
        expect(state.trueFalse).toEqual({ 'g10-ch3-yc03b': [candidates[1].item.id], 'g10-ch3-yc03a': [candidates[2].item.id] });
        expect(trueFalseFillOptions(topics[0], state, pools)).toEqual([]);
    });
});
