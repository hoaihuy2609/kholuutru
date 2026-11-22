import { describe, expect, it } from 'vitest';
import { splitColumnPoints } from '../utils/matrixPoints';

const col = (key: string, type: string, level: number, count: number) => ({ key, type, level, count });
const total = (columns: ReturnType<typeof col>[], points: Record<string, number>) =>
    columns.reduce((sum, column) => sum + column.count * (column.type === 'dung_sai' ? 1 : points[column.key] ?? 0), 0);

describe('round points per matrix cell', () => {
    it('gives the national 18 + 4 + 6 paper a quarter point per question and true-false 1 point', () => {
        const columns = [col('tn1', 'trac_nghiem', 1, 8), col('tn2', 'trac_nghiem', 2, 6), col('tn3', 'trac_nghiem', 3, 4),
            col('ds', 'dung_sai', 0, 4), col('tl3', 'tu_luan', 3, 6)];
        const points = splitColumnPoints(columns, 10);
        expect(points).toEqual({ tn1: 0.25, tn2: 0.25, tn3: 0.25, tl3: 0.25 });
        expect(total(columns, points)).toBe(10);
    });

    it('adds whole quarter steps to harder cells first and reaches the scale when the counts allow it', () => {
        const columns = [col('b', 'trac_nghiem', 1, 4), col('h', 'trac_nghiem', 2, 4), col('v', 'trac_nghiem', 3, 4), col('ds', 'dung_sai', 0, 2), col('t', 'tu_luan', 3, 2)];
        const points = splitColumnPoints(columns, 10);
        expect(total(columns, points)).toBe(10);
        expect(Object.values(points).every(value => value % 0.25 === 0)).toBe(true);
        expect(points.v).toBeGreaterThanOrEqual(points.b);
    });

    it('spreads extra quarter points over cells instead of piling them on one', () => {
        const columns = [col('b', 'trac_nghiem', 1, 4), col('h', 'trac_nghiem', 2, 4), col('v', 'trac_nghiem', 3, 4), col('ds', 'dung_sai', 0, 2), col('t', 'tu_luan', 3, 2)];
        expect(splitColumnPoints(columns, 10)).toEqual({ b: 0.5, h: 0.5, v: 0.75, t: 0.5 });
    });

    it('stays at or below the scale when no round split reaches it exactly', () => {
        const columns = [col('b', 'trac_nghiem', 1, 10), col('h', 'trac_nghiem', 2, 10), col('v', 'trac_nghiem', 3, 8)];
        const points = splitColumnPoints(columns, 10);
        expect(total(columns, points)).toBeLessThanOrEqual(10);
        expect(total(columns, points)).toBe(9.5);
        expect(splitColumnPoints([col('ds', 'dung_sai', 0, 4)], 10)).toEqual({});
    });
});
