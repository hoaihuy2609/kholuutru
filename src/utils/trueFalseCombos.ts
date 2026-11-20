import { COGNITIVE_LEVELS } from './cognitiveLevels';
import type { StatementCounts } from './matrixPlan';

/**
 * Tổ hợp câu Đúng/Sai mà kho đáp ứng được. Mỗi câu Đúng/Sai có 4 ý, mỗi ý một mức; một "kiểu" là số ý
 * Biết, Hiểu, Vận dụng của câu (ví dụ 0·2·2). Ghép n câu thì số ý từng mức là tổng các kiểu đã chọn.
 */
export interface TrueFalsePattern {
    counts: StatementCounts;
    /** Số câu trong kho có kiểu này. */
    available: number;
}

export interface TrueFalseCombo {
    /** Số ý Biết, Hiểu, Vận dụng của cả nhóm câu. */
    total: StatementCounts;
    /** Số cách chọn câu trong kho cho ra đúng tổng này. */
    ways: number;
    /** Một cách ghép nhiều lựa chọn nhất, để hiển thị và để chọn câu. */
    patterns: { counts: StatementCounts; times: number }[];
}

const key = (counts: readonly number[]) => counts.join(',');
const sameCounts = (a: readonly number[], b: readonly number[]) => a.every((value, index) => value === b[index]);

export function trueFalsePatterns(list: readonly StatementCounts[]): TrueFalsePattern[] {
    const map = new Map<string, TrueFalsePattern>();
    for (const counts of list) {
        const pattern = map.get(key(counts));
        if (pattern) pattern.available++;
        else map.set(key(counts), { counts, available: 1 });
    }
    return [...map.values()];
}

function choose(n: number, k: number) {
    let result = 1;
    for (let index = 1; index <= k; index++) result = result * (n - k + index) / index;
    return Math.round(result);
}

/** Một cách ghép: dùng `times` câu của mỗi kiểu. */
export interface TrueFalseFill {
    total: StatementCounts;
    ways: number;
    patterns: { counts: StatementCounts; times: number }[];
}

/** Mọi cách ghép `questions` câu từ các kiểu trong kho (không dùng một câu hai lần), chỉ giữ đúng `target` nếu có. */
export function trueFalseFills(patterns: readonly TrueFalsePattern[], questions: number, target?: StatementCounts): TrueFalseFill[] {
    if (questions <= 0 || questions > 8) return [];
    const fills: TrueFalseFill[] = [];
    const times = patterns.map(() => 0);
    const walk = (start: number, left: number, sum: number[]) => {
        if (target && sum.some((value, level) => value > target[level])) return;
        if (left === 0) {
            if (target && !sameCounts(sum, target)) return;
            const used = times.flatMap((count, index) => count ? [{ index, count }] : []);
            fills.push({ total: sum as unknown as StatementCounts,
                ways: used.reduce((product, { index, count }) => product * choose(patterns[index].available, count), 1),
                patterns: used.map(({ index, count }) => ({ counts: patterns[index].counts, times: count })) });
            return;
        }
        for (let index = start; index < patterns.length; index++) {
            if (times[index] >= patterns[index].available) continue;
            times[index]++;
            walk(index, left - 1, sum.map((value, level) => value + patterns[index].counts[level]));
            times[index]--;
        }
    };
    walk(0, questions, [0, 0, 0]);
    return fills;
}

/**
 * Các tổng số ý mà `questions` câu ghép được, gộp theo tổng. `ways` là tổng số cách chọn câu cho tổng đó;
 * `patterns` là cách ghép có nhiều lựa chọn nhất, để hiển thị.
 */
export function trueFalseCombos(patterns: readonly TrueFalsePattern[], questions: number, target?: StatementCounts): TrueFalseCombo[] {
    const totals = new Map<string, TrueFalseCombo & { best: number }>();
    for (const fill of trueFalseFills(patterns, questions, target)) {
        const entry = totals.get(key(fill.total));
        if (!entry) totals.set(key(fill.total), { ...fill, best: fill.ways });
        else {
            entry.ways += fill.ways;
            if (fill.ways > entry.best) { entry.best = fill.ways; entry.patterns = fill.patterns; }
        }
    }
    return [...totals.values()].map(({ best: _best, ...combo }) => combo);
}

/** Tỉ lệ mức độ của Công văn 7991: khoảng 40% Biết, 30% Hiểu, 30% Vận dụng. */
const RATIO = [0.4, 0.3, 0.3];

/** Xếp tổ hợp gần tỉ lệ 4-3-3 lên trước; cùng mức gần thì tổ hợp có nhiều cách chọn câu hơn đứng trước. */
export function rankTrueFalseCombos(combos: readonly TrueFalseCombo[]) {
    const distance = ({ total }: TrueFalseCombo) => {
        const sum = total[0] + total[1] + total[2];
        return total.reduce((value, count, level) => value + Math.abs(count - RATIO[level] * sum), 0);
    };
    return [...combos].sort((a, b) => distance(a) - distance(b) || b.ways - a.ways);
}

export const levelCountsLabel = (counts: readonly number[]) =>
    counts.map((value, index) => value + ' ' + ['Biết', 'Hiểu', 'VD'][index]).join(' · ');

export const patternLabel = (counts: readonly number[]) =>
    counts.flatMap((value, index) => Array(value).fill(['B', 'H', 'VD'][index])).join(' ');

export const fullLevelCountsLabel = (counts: readonly number[]) =>
    counts.flatMap((value, index) => value ? [value + ' ' + COGNITIVE_LEVELS[index + 1]] : []).join(', ') || '0 ý';
