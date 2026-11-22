import type { SelectedQuestionItem } from '../services/examLatexService';

/**
 * Trộn đề: từ một đề gốc tạo nhiều mã đề. Câu chỉ đổi chỗ trong phần của nó (I trắc nghiệm, II Đúng/Sai,
 * III trả lời ngắn); phương án A–D đổi chỗ và đáp án đúng đổi chữ theo. Cùng `seed` luôn ra cùng kết quả.
 */

export const SHUFFLE_PARTS = [
    { type: 'trac_nghiem', part: 'I', label: 'Trắc nghiệm 4 phương án' },
    { type: 'dung_sai', part: 'II', label: 'Đúng/Sai' },
    { type: 'tu_luan', part: 'III', label: 'Trả lời ngắn' },
] as const;
export type ShufflePartType = typeof SHUFFLE_PARTS[number]['type'];

export interface ExamShuffleOptions {
    /** Số mã đề (1–24). */
    count: number;
    /** Mã đề đầu tiên, ví dụ "101"; các mã sau tăng dần. */
    firstCode: string;
    questions: boolean;
    choices: boolean;
    statements: boolean;
    seed: number;
    /** Vị trí (đánh số từ 1 trong từng phần) giữ nguyên, không đổi chỗ. */
    keep: Partial<Record<ShufflePartType, readonly number[]>>;
}

export interface ExamVariantEntry {
    question: SelectedQuestionItem;
    /** Thứ tự của câu trong phần ở đề gốc (từ 1). */
    original: number;
}

export interface ExamVariant {
    code: string;
    /** Câu theo thứ tự in: hết phần I rồi phần II, phần III. */
    questions: SelectedQuestionItem[];
    parts: Record<ShufflePartType, ExamVariantEntry[]>;
}

export const MAX_EXAM_VARIANTS = 24;

/** Số ngẫu nhiên có hạt giống (mulberry32): cùng hạt giống cho cùng dãy số. */
export function seededRandom(seed: number) {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index--) {
        const other = Math.floor(random() * (index + 1));
        [result[index], result[other]] = [result[other], result[index]];
    }
    return result;
}

/** Các mã đề: "101" → 101, 102…; mã không phải số thì thêm hậu tố -1, -2… */
export function examCodes(firstCode: string, count: number): string[] {
    const code = firstCode.trim() || '101';
    const total = Math.max(1, Math.min(MAX_EXAM_VARIANTS, Math.floor(count) || 1));
    if (/^\d+$/.test(code)) {
        const start = Number(code);
        return Array.from({ length: total }, (_, index) => String(start + index).padStart(code.length, '0'));
    }
    return total === 1 ? [code] : Array.from({ length: total }, (_, index) => code + '-' + (index + 1));
}

/** Phương án nhắc tới phương án khác ("Cả A và B", "Tất cả đều đúng"…) thì giữ nguyên thứ tự A–D. */
export function choicesLocked(choices: readonly string[] = []) {
    return choices.length !== 4 || choices.some(choice => !choice?.trim()) || choices.some(choice =>
        /(?<!\p{L})(cả|tất cả|các (phương án|đáp án|câu|ý) (trên|đã nêu)|không (có )?(phương án|đáp án|câu) nào)(?!\p{L})/iu.test(choice)
        || /\b[A-D]\s*(và|,|hoặc|&)\s*[A-D]\b/.test(choice)
        || /^\s*[A-D]\s*[.)]?\s*$/.test(choice));
}

const LETTERS = ['A', 'B', 'C', 'D'];

/** Đổi chữ đáp án trong lời giải ("Chọn B", "Đáp án: B") theo phương án đã trộn. */
function remapSolution(text: string | undefined, letterOf: Record<string, string>) {
    return text?.replace(/((?:chọn|đáp án)\s*(?:đáp án\s*)?:?\s*)([A-D])\b/gi, (match, prefix: string, letter: string) =>
        prefix + (letterOf[letter.toUpperCase()] ?? letter));
}

function shuffleChoices(question: SelectedQuestionItem, random: () => number): SelectedQuestionItem {
    const choices = question.choices ?? [];
    if (choicesLocked(choices)) return question;
    const order = shuffled([0, 1, 2, 3], random);
    // order[newIndex] = oldIndex.
    const letterOf: Record<string, string> = {};
    order.forEach((oldIndex, newIndex) => { letterOf[LETTERS[oldIndex]] = LETTERS[newIndex]; });
    const correct = question.correctChoice?.trim().toUpperCase();
    return { ...question, choices: order.map(index => choices[index]),
        correctChoice: correct && letterOf[correct] ? letterOf[correct] : question.correctChoice,
        solution: remapSolution(question.solution, letterOf) };
}

function shuffleStatements(question: SelectedQuestionItem, random: () => number): SelectedQuestionItem {
    const statements = question.statements ?? [];
    if (statements.length < 2) return question;
    const labels = statements.map(statement => statement.label);
    return { ...question, statements: shuffled(statements, random).map((statement, index) => ({ ...statement, label: labels[index] })) };
}

/** Đổi chỗ các câu không bị giữ, câu giữ đứng nguyên vị trí. */
function arrange<T>(items: readonly T[], keep: readonly number[] = [], random: () => number): T[] {
    const fixed = new Set(keep.filter(position => position >= 1 && position <= items.length).map(position => position - 1));
    const movable = shuffled(items.filter((_, index) => !fixed.has(index)), random);
    return items.map((item, index) => fixed.has(index) ? item : movable.shift()!);
}

export function shuffleExam(questions: readonly SelectedQuestionItem[], options: ExamShuffleOptions): ExamVariant[] {
    return examCodes(options.firstCode, options.count).map((code, variant) => {
        const random = seededRandom(options.seed * 7919 + variant * 104729 + 17);
        const parts = {} as Record<ShufflePartType, ExamVariantEntry[]>;
        for (const { type } of SHUFFLE_PARTS) {
            const entries = questions.filter(question => question.type === type).map((question, index) => ({ question, original: index + 1 }));
            const ordered = options.questions ? arrange(entries, options.keep[type], random) : entries;
            parts[type] = ordered.map(({ question, original }) => ({ original,
                question: type === 'trac_nghiem' && options.choices ? shuffleChoices(question, random)
                    : type === 'dung_sai' && options.statements ? shuffleStatements(question, random) : question }));
        }
        return { code, parts, questions: SHUFFLE_PARTS.flatMap(({ type }) => parts[type].map(entry => entry.question)) };
    });
}

/** Đáp số câu trả lời ngắn, lấy từ dòng "Trả lời ngắn: …" / "Đáp số: …" của lời giải. */
export function shortAnswerOf(question: SelectedQuestionItem) {
    const match = question.solution?.match(/(?:trả lời ngắn|đáp số|đáp án)\s*[:：]\s*([^\n]+?)\s*\.?\s*$/im);
    return match?.[1].trim() ?? '';
}

/** Đáp án một câu trong bảng đáp án: chữ cái, chuỗi Đ/S theo ý, hoặc đáp số. */
export function answerOf(question: SelectedQuestionItem) {
    if (question.type === 'trac_nghiem') return question.correctChoice?.trim().toUpperCase() || '';
    if (question.type === 'dung_sai') return (question.statements ?? []).map(statement =>
        statement.verdict === true ? 'Đ' : statement.verdict === false ? 'S' : '?').join('');
    return shortAnswerOf(question);
}

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, char =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

/**
 * Bảng đáp án tất cả mã đề và bảng đối chiếu với đề gốc (HTML để in cuối file PDF).
 * `continuous`: đánh số câu liên tục qua các phần (khi tắt tiêu đề phần thi); mặc định mỗi phần đánh lại từ 1.
 */
export function examVariantsSheetHtml(variants: readonly ExamVariant[], { continuous = false, color = '#920000' } = {}) {
    if (!variants.length) return '';
    const parts = SHUFFLE_PARTS.filter(({ type }) => variants[0].parts[type].length);
    const offsets = new Map<ShufflePartType, number>();
    let offset = 0;
    for (const { type } of parts) { offsets.set(type, continuous ? offset : 0); offset += variants[0].parts[type].length; }
    const cell = 'border: 1px solid #333; padding: 4px 3px; text-align: center;';
    const table = (type: ShufflePartType, value: (entry: ExamVariantEntry) => string) => {
        const count = variants[0].parts[type].length;
        const start = offsets.get(type) ?? 0;
        const perRow = type === 'dung_sai' ? 8 : 20;
        const chunks = Array.from({ length: Math.ceil(count / perRow) }, (_, index) => index * perRow);
        return chunks.map(from => {
            const indices = Array.from({ length: Math.min(perRow, count - from) }, (_, index) => from + index);
            return `<table style="width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 10pt; margin: 4px 0 8px; break-inside: avoid;">
                <tr style="background: #f5f5f5;"><th style="${cell} width: 9%;">Mã đề</th>${indices.map(index => `<th style="${cell}">${start + index + 1}</th>`).join('')}</tr>
                ${variants.map(variant => `<tr><th style="${cell}">${escapeHtml(variant.code)}</th>${indices.map(index =>
                    `<td style="${cell} font-weight: bold;">${escapeHtml(value(variant.parts[type][index]) || '–')}</td>`).join('')}</tr>`).join('')}
            </table>`;
        }).join('');
    };
    const heading = (text: string) => `<div style="text-align: center; font-weight: bold; font-size: 12pt; color: ${color}; margin: 0 0 10px;">${text}</div>`;
    const section = (value: (entry: ExamVariantEntry) => string) => parts.map(({ type, part, label }) =>
        `<div style="font-weight: bold; margin-top: 8px;">PHẦN ${part}. ${escapeHtml(label.toUpperCase())}</div>${table(type, value)}`).join('');
    return `<div style="page-break-before: always;">
        ${heading('BẢNG ĐÁP ÁN CÁC MÃ ĐỀ')}
        ${section(entry => answerOf(entry.question))}
        ${parts.some(({ type }) => type === 'dung_sai') ? '<p style="font-size: 9.5pt; font-style: italic;">Phần II ghi Đ (đúng) / S (sai) lần lượt cho các ý a, b, c, d của câu trong mã đề đó.</p>' : ''}
    </div>
    <div style="page-break-before: always;">
        ${heading('BẢNG ĐỐI CHIẾU VỚI ĐỀ GỐC')}
        <p style="font-size: 10pt; margin: 0 0 6px;">Mỗi ô ghi số thứ tự của câu đó trong đề gốc (đề dùng để lập ma trận và bản đặc tả).</p>
        ${section(entry => String(entry.original + (offsets.get(entry.question.type as ShufflePartType) ?? 0)))}
    </div>`;
}
