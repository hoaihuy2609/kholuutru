import { describe, expect, it } from 'vitest';
import type { StatementCounts } from '../utils/matrixPlan';
import { rankTrueFalseCombos, trueFalseCombos, trueFalseFills, trueFalsePatterns } from '../utils/trueFalseCombos';

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
