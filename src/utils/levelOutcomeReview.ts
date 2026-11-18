import { normalizeMatrixText } from './examMatrix';

/**
 * Rà sự nhất quán giữa mức độ của câu (Nhận biết, Thông hiểu, Vận dụng) và động từ mở đầu YCCĐ của câu.
 * Chỉ dùng các động từ có mức rõ ràng; động từ dùng được ở nhiều mức ("Xác định", "Tính", "Phân tích",
 * "Trình bày") không được dùng để gắn cờ, nên số câu bị gắn cờ là cận dưới của số câu lệch.
 */
const VERB_LEVELS: [RegExp, 1 | 2 | 3][] = [
    [/^(?:nhan biet|neu|phat bieu|viet|ke ten|liet ke|nhac lai)\b/, 1],
    [/^(?:giai thich|so sanh|phan biet|mo ta)\b/, 2],
    [/^(?:van dung|ket hop|giai bai toan|thiet ke|de xuat)\b/, 3],
];
export const REVIEW_LEVELS = ['', 'Nhận biết', 'Thông hiểu', 'Vận dụng'] as const;

export function outcomeVerbLevel(outcome: string): 1 | 2 | 3 | undefined {
    const text = normalizeMatrixText(outcome);
    return VERB_LEVELS.find(([pattern]) => pattern.test(text))?.[1];
}

export interface ReviewQuestion {
    question_id: string;
    lesson: string;
    level: number;
    context: { type: string; question_no?: string; learning_outcomes?: unknown; [key: string]: unknown };
}

export interface ReviewItem {
    questionId: string;
    label: string;
    lesson: string;
    type: string;
    level: number;
    outcomes: string[];
    /** Why the item is flagged; undefined when level and YCCĐ agree or cannot be judged. */
    flag?: string;
    question: ReviewQuestion;
}

const outcomesOf = (value: unknown) => Array.isArray(value) ? value.filter((line): line is string => typeof line === 'string' && !!line.trim()) : [];

/** Multiple-choice and short-answer questions of an outcome export, flagged when the level contradicts the YCCĐ verbs. */
export function buildLevelReview(questions: readonly ReviewQuestion[]): ReviewItem[] {
    return questions.filter(question => question.context.type === 'trac_nghiem' || question.context.type === 'tu_luan').map(question => {
        const outcomes = outcomesOf(question.context.learning_outcomes);
        const level = [1, 2, 3].includes(question.level) ? question.level : 0;
        let flag: string | undefined;
        if (!level) flag = 'Câu chưa có mức độ.';
        else if (!outcomes.length) flag = 'Câu chưa có YCCĐ.';
        else {
            const expected = [...new Set(outcomes.flatMap(outcome => outcomeVerbLevel(outcome) ?? []))];
            if (expected.length && !expected.includes(level as 1 | 2 | 3)) {
                flag = 'Gắn mức ' + REVIEW_LEVELS[level] + ' nhưng YCCĐ dùng động từ của mức '
                    + expected.map(value => REVIEW_LEVELS[value]).join(' / ') + '.';
            }
        }
        return { questionId: question.question_id, label: String(question.context.question_no || question.question_id),
            lesson: question.lesson, type: question.context.type, level, outcomes, flag, question };
    });
}

export interface ReviewDecision {
    /** Snapshot when the decision was made; a decision whose snapshot no longer matches the bank is ignored. */
    fromLevel: number;
    fromOutcomes: string[];
    level: number;
    outcomes: string[];
    reason: string;
    reviewed: boolean;
}

export type DecisionKind = 'keep' | 'level' | 'outcomes' | 'both';
export const DECISION_LABELS: Record<DecisionKind, string> = {
    keep: 'Giữ nguyên', level: 'Sửa mức độ', outcomes: 'Sửa YCCĐ', both: 'Sửa cả mức độ và YCCĐ',
};

const cleanLines = (lines: readonly string[]) => lines.map(line => line.trim()).filter(Boolean);
const sameLines = (a: readonly string[], b: readonly string[]) => JSON.stringify(cleanLines(a)) === JSON.stringify(cleanLines(b));

export function decisionKind(item: Pick<ReviewItem, 'level' | 'outcomes'>, decision: Pick<ReviewDecision, 'level' | 'outcomes'>): DecisionKind {
    const level = decision.level !== item.level;
    const outcomes = !sameLines(decision.outcomes, item.outcomes);
    return level && outcomes ? 'both' : level ? 'level' : outcomes ? 'outcomes' : 'keep';
}

/** A stored decision applies only while the question still has the level and YCCĐ it was made for. */
export function currentDecision(item: ReviewItem, decision: ReviewDecision | undefined) {
    return decision && decision.fromLevel === item.level && sameLines(decision.fromOutcomes, item.outcomes) ? decision : undefined;
}

/** Update file for the "Nhập mức độ" import, holding only questions whose level or YCCĐ changed. */
export function levelReviewUpdate(exportId: string, chapterId: string, items: readonly ReviewItem[],
    decisions: Readonly<Record<string, ReviewDecision>>) {
    const updates = items.flatMap(item => {
        const decision = currentDecision(item, decisions[item.questionId]);
        if (!decision?.reviewed || ![1, 2, 3].includes(decision.level)) return [];
        const kind = decisionKind(item, decision);
        const outcomes = cleanLines(decision.outcomes);
        const withOutcomes = kind === 'outcomes' || kind === 'both';
        if (kind === 'keep' || (withOutcomes && !outcomes.length)) return [];
        return [{ question_id: item.questionId, cognitive_level: decision.level, ...(withOutcomes ? { learning_outcomes: outcomes } : {}) }];
    });
    return { schema: 'physivault.cognitive.update.v1' as const, chapter_id: chapterId, export_id: exportId, updates };
}

const csvCell = (value: string | number) => {
    const text = String(value);
    return /[",\n;]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
};

/** Report for the thesis: one row per reviewed question, opened directly by Excel (UTF-8 with BOM). */
export function levelReviewCsv(items: readonly ReviewItem[], decisions: Readonly<Record<string, ReviewDecision>>) {
    const rows = [['Mã câu', 'Câu', 'Bài', 'Dạng', 'Cờ phát hiện', 'Mức cũ', 'YCCĐ cũ', 'Mức mới', 'YCCĐ mới', 'Quyết định', 'Lý do']];
    for (const item of items) {
        const decision = currentDecision(item, decisions[item.questionId]);
        if (!decision?.reviewed) continue;
        rows.push([item.questionId, item.label, item.lesson, item.type === 'tu_luan' ? 'Trả lời ngắn' : 'Trắc nghiệm',
            item.flag ?? '', REVIEW_LEVELS[item.level] || 'Chưa có', item.outcomes.join(' | '),
            REVIEW_LEVELS[decision.level] || 'Chưa có', cleanLines(decision.outcomes).join(' | '),
            DECISION_LABELS[decisionKind(item, decision)], decision.reason.trim()]);
    }
    return '﻿' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
}

export function levelReviewSummary(items: readonly ReviewItem[], decisions: Readonly<Record<string, ReviewDecision>>) {
    const flagged = items.filter(item => item.flag);
    const counts: Record<DecisionKind, number> = { keep: 0, level: 0, outcomes: 0, both: 0 };
    let reviewed = 0;
    for (const item of flagged) {
        const decision = currentDecision(item, decisions[item.questionId]);
        if (!decision?.reviewed) continue;
        reviewed++;
        counts[decisionKind(item, decision)]++;
    }
    return { total: items.length, flagged: flagged.length, reviewed, counts };
}

/**
 * Loads suggested decisions (for example an AI first pass) into the review without confirming them:
 * every suggestion still needs the reviewer's own confirmation. Questions already confirmed are left untouched.
 */
export function applyLevelSuggestions(items: readonly ReviewItem[], decisions: Readonly<Record<string, ReviewDecision>>, text: string) {
    const input = JSON.parse(text.replace(/^﻿/, ''));
    if (!input || input.schema !== 'physivault.level-review.suggestions.v1' || !Array.isArray(input.suggestions)) {
        throw new Error('Cần file đề xuất với schema physivault.level-review.suggestions.v1.');
    }
    const label = typeof input.source === 'string' && input.source.trim() ? input.source.trim() : 'AI đề xuất';
    const byId = new Map(items.map(item => [item.questionId, item]));
    const next = { ...decisions };
    let applied = 0, skipped = 0;
    for (const suggestion of input.suggestions) {
        const item = byId.get(suggestion?.question_id);
        const outcomes = Array.isArray(suggestion?.learning_outcomes) ? outcomesOf(suggestion.learning_outcomes) : item?.outcomes;
        if (!item || ![1, 2, 3].includes(suggestion.level) || !outcomes?.length || currentDecision(item, decisions[item.questionId])?.reviewed) {
            skipped++;
            continue;
        }
        next[item.questionId] = { fromLevel: item.level, fromOutcomes: item.outcomes, level: suggestion.level, outcomes,
            reason: label + ': ' + String(suggestion.reason ?? '').trim(), reviewed: false };
        applied++;
    }
    return { decisions: next, applied, skipped };
}
