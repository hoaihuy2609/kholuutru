import { describe, expect, it } from 'vitest';
import { applyLevelSuggestions, buildLevelReview, levelReviewCsv, levelReviewSummary, levelReviewUpdate, outcomeVerbLevel, type ReviewDecision } from '../utils/levelOutcomeReview';
import { parseCognitiveResult } from '../utils/cognitiveExchange';

const question = (id: string, level: number, outcomes: string[], type = 'trac_nghiem') =>
    ({ question_id: id, lesson: 'BÀI 2: CÔNG SUẤT', level, context: { type, question_no: 'Câu ' + id, learning_outcomes: outcomes } });

describe('level and YCCĐ review', () => {
    it('reads only verbs whose level is unambiguous', () => {
        expect(outcomeVerbLevel('Nhận biết được đơn vị đo công.')).toBe(1);
        expect(outcomeVerbLevel('Nêu được định nghĩa công suất.')).toBe(1);
        expect(outcomeVerbLevel('Giải thích được sự biến đổi cơ năng.')).toBe(2);
        expect(outcomeVerbLevel('Vận dụng được định luật bảo toàn cơ năng.')).toBe(3);
        expect(outcomeVerbLevel('Xác định được công dương, công âm.')).toBeUndefined();
        expect(outcomeVerbLevel('Tính được công suất trung bình.')).toBeUndefined();
    });

    it('flags multiple-choice and short-answer questions whose level contradicts every YCCĐ verb', () => {
        const items = buildLevelReview([
            question('a', 2, ['Nhận biết được đơn vị đo công.']),
            question('b', 1, ['Nhận biết được đơn vị đo công.']),
            question('c', 2, ['Xác định được công dương.']),
            question('d', 2, ['Nhận biết được đơn vị.', 'Giải thích được hiện tượng.']),
            question('e', 3, ['Nêu được định nghĩa.'], 'tu_luan'),
            question('f', 0, ['Nêu được định nghĩa.']),
            question('g', 2, ['Nêu được định nghĩa.'], 'dung_sai'),
        ]);
        expect(items.map(item => item.questionId)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
        expect(items.filter(item => item.flag).map(item => item.questionId)).toEqual(['a', 'e', 'f']);
        expect(items[0].flag).toBe('Gắn mức Thông hiểu nhưng YCCĐ dùng động từ của mức Nhận biết.');
    });

    it('writes an update the level import accepts, holding only reviewed changes', () => {
        const items = buildLevelReview([question('a', 2, ['Nhận biết được đơn vị đo công.']), question('b', 2, ['Nhận biết và quy đổi được đơn vị.']),
            question('c', 3, ['Nêu được định nghĩa.']), question('d', 2, ['Nhận biết được A.'])]);
        const base = (item: typeof items[number]): ReviewDecision => ({ fromLevel: item.level, fromOutcomes: item.outcomes,
            level: item.level, outcomes: item.outcomes, reason: '', reviewed: true });
        const decisions = {
            a: { ...base(items[0]), level: 1, reason: 'Chỉ hỏi đơn vị' },
            b: { ...base(items[1]), outcomes: ['Quy đổi được các đơn vị công suất.'] },
            c: { ...base(items[2]), reason: 'Đúng là vận dụng' },
            d: { ...base(items[3]), level: 1, reviewed: false },
        };
        const update = levelReviewUpdate('export-1', 'g10-ch3', items, decisions);
        expect(update.updates).toEqual([
            { question_id: 'a', cognitive_level: 1 },
            { question_id: 'b', cognitive_level: 2, learning_outcomes: ['Quy đổi được các đơn vị công suất.'] },
        ]);
        expect(parseCognitiveResult(JSON.stringify(update)).updates).toHaveLength(2);
        expect(levelReviewSummary(items, decisions)).toEqual({ total: 4, flagged: 4, reviewed: 3, counts: { keep: 1, level: 1, outcomes: 1, both: 0 } });
        const csv = levelReviewCsv(items, decisions);
        expect(csv.startsWith('﻿Mã câu,')).toBe(true);
        expect(csv).toContain('Sửa mức độ,Chỉ hỏi đơn vị');
        expect(csv.split('\r\n')).toHaveLength(4);
        // A decision made for an older level is ignored once the bank changes.
        const moved = buildLevelReview([question('a', 1, ['Nhận biết được đơn vị đo công.'])]);
        expect(levelReviewUpdate('export-2', 'g10-ch3', moved, decisions).updates).toEqual([]);
    });
});

describe('level review suggestions', () => {
    it('pre-fills unconfirmed decisions and never overrides a confirmed one', () => {
        const items = buildLevelReview([question('a', 2, ['Nhận biết được đơn vị đo công.']), question('b', 2, ['Nêu được định nghĩa.'])]);
        const confirmed = { b: { fromLevel: 2, fromOutcomes: ['Nêu được định nghĩa.'], level: 2, outcomes: ['Nêu được định nghĩa.'], reason: '', reviewed: true } };
        const text = JSON.stringify({ schema: 'physivault.level-review.suggestions.v1', suggestions: [
            { question_id: 'a', level: 1, reason: 'Chỉ hỏi đơn vị' },
            { question_id: 'b', level: 1, learning_outcomes: ['Khác'], reason: 'x' },
            { question_id: 'missing', level: 1, reason: 'x' },
        ] });
        const result = applyLevelSuggestions(items, confirmed, text);
        expect(result).toMatchObject({ applied: 1, skipped: 2 });
        expect(result.decisions.a).toEqual({ fromLevel: 2, fromOutcomes: ['Nhận biết được đơn vị đo công.'], level: 1,
            outcomes: ['Nhận biết được đơn vị đo công.'], reason: 'AI đề xuất: Chỉ hỏi đơn vị', reviewed: false });
        expect(result.decisions.b).toBe(confirmed.b);
        expect(levelReviewUpdate('e', 'g10-ch3', items, result.decisions).updates).toEqual([]);
        expect(() => applyLevelSuggestions(items, {}, '{}')).toThrow('physivault.level-review.suggestions.v1');
    });
});
