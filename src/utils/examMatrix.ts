import type { StudyLesson, StudyQuestionType, StudySection } from '../../types';
import { STUDY_CHAPTERS } from './studyLibrary';

export type MatrixQuestionType = StudyQuestionType | 'written' | '';

export interface MatrixRow {
    section: string;
    topic: string;
    outcome: string;
    type: MatrixQuestionType;
    level: number;
    count: number;
    references: string[];
    page?: number;
    sourceNote?: string;
    countUnit?: 'statement';
}

export interface MatrixQuestionDraft {
    slotId: string;
    label: string;
    grade: number;
    type: StudyQuestionType;
    level: number;
    topic: string;
    outcomes: string[];
    rows: MatrixRow[];
}

export const MATRIX_LEVELS = ['Chưa rõ', 'Nhận biết', 'Thông hiểu', 'Vận dụng', 'Vận dụng cao'];

export function normalizeMatrixText(text: string) {
    return text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd')
        .replace(/[^a-z0-9]+/g, ' ').trim();
}

export function questionOutcomes(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return [...new Map(value.flatMap(item => {
        if (typeof item !== 'string') return [];
        const trimmed = item.trim();
        const normalized = normalizeMatrixText(trimmed);
        return normalized ? [[normalized, trimmed] as const] : [];
    })).values()];
}

export function matrixQuestionType(text: string): MatrixQuestionType {
    const key = normalizeMatrixText(text);
    if (/\b(?:4 (?:phuong an|dap an|pa|lua chon)|nhieu (?:lua chon|phuong an))\b/.test(key)) return 'trac_nghiem';
    if (/\b(?:dung sai|d s)\b/.test(key)) return 'dung_sai';
    if (/\b(?:tra loi ngan|tln|tl ngan)\b/.test(key)) return 'tu_luan';
    if (/\btu luan\b/.test(key)) return 'written';
    return '';
}

export function matrixLevel(text: string) {
    const key = normalizeMatrixText(text);
    if (/^(?:nhan biet|biet|nb|muc 1)$/.test(key)) return 1;
    if (/^(?:thong hieu|hieu|th|muc 2)$/.test(key)) return 2;
    if (/^(?:van dung|vd|muc 3)$/.test(key)) return 3;
    if (/^(?:van dung cao|vdc|vd cao|muc 4)$/.test(key)) return 4;
    return 0;
}

export function isMatrixLevelHeading(text: string) {
    return matrixLevel(text) > 0
        || /^(?:nhan biet|thong hieu|van dung(?: cao)?)(?: (?:va )?(?:nhan biet|thong hieu|van dung(?: cao)?))+$/.test(normalizeMatrixText(text));
}

export function matrixOutcomeOptions(outcome: string) {
    return questionOutcomes(outcome.split('\n')
        .map(line => line.trim().replace(/^[-–•]\s*/, ''))
        .filter(line => !isMatrixLevelHeading(line)));
}

export function matrixDraftPlacement(draft: MatrixQuestionDraft, lessons: StudyLesson[]): StudySection | undefined {
    const cleanTitle = (value: string) => normalizeMatrixText(value).replace(/^(?:bai|chuong) (?:\d+(?: \d+)?|[ivx]+) /, '');
    const topics = draft.topic.split('·').map(cleanTitle).filter(Boolean);
    const chapters = STUDY_CHAPTERS.filter(chapter => !draft.grade || chapter.grade === draft.grade);
    const chapterIds = new Set(chapters.map(chapter => chapter.id));
    const matchingLessons = lessons.filter(lesson =>
        lesson.studySection.questionType === draft.type && chapterIds.has(lesson.studySection.chapterId)
        && topics.includes(cleanTitle(lesson.title)));
    if (matchingLessons.length === 1) return { ...matchingLessons[0].studySection, lessonId: matchingLessons[0].id };
    const matchingChapters = chapters.filter(chapter => {
        const name = cleanTitle(chapter.name);
        return topics.some(topic => ` ${topic} `.includes(` ${name} `));
    });
    if (matchingChapters.length === 1) return { chapterId: matchingChapters[0].id, questionType: draft.type };
}

export function matrixReferences(text: string) {
    const compact = text.trim()
        .replace(/(\d[a-d]?)\s+(?=c(?:âu)?\s*\d)/gi, '$1,')
        .replace(/\s+/g, '');
    const parts = compact.split(/[,;/]+/).filter(Boolean);
    const references: string[] = [];
    for (const part of parts) {
        const match = /^(?:c(?:âu)?)?(\d+)([a-d])?(?:[-–—](?:c(?:âu)?)?(\d+))?$/i.exec(part);
        if (!match) return [];
        const first = Number(match[1]);
        const last = match[3] ? Number(match[3]) : first;
        if (first < 1 || last < first || last > 999 || last - first >= 99 || (match[2] && match[3])) return [];
        for (let number = first; number <= last; number++) {
            references.push(`C${number}${match[2]?.toLowerCase() ?? ''}`);
        }
    }
    return [...new Set(references)];
}

const actions: [RegExp, string][] = [
    [/^(?:neu|phat bieu|trinh bay|viet|liet ke|ke ten)\b/, 'state'],
    [/^(?:giai thich|ly giai)\b/, 'explain'],
    [/^(?:tinh|tinh toan)\b/, 'calculate'],
    [/^(?:nhan dang|nhan biet|nhan ra)\b/, 'recognize'],
    [/^(?:phan tich)\b/, 'analyze'],
    [/^(?:so sanh)\b/, 'compare'],
];
const ignored = new Set(['duoc', 've', 'cua', 'cho', 'do', 'va', 'mot', 'cac', 'la', 'tu', 'trong', 'tai', 'den', 'bang']);

function outcomeKey(value: string) {
    const text = normalizeMatrixText(value);
    const [prefix, action] = actions.find(([pattern]) => pattern.test(text)) ?? [];
    const subject = (prefix ? text.replace(prefix, '') : text)
        .replace(/\b(?:bieu thuc|he thuc)\b/g, 'cong thuc');
    return { action, words: new Set(subject.split(' ').filter(word => word && !ignored.has(word))) };
}

export function outcomeScore(requirement: string, annotation: string) {
    const requirementKey = normalizeMatrixText(requirement);
    const annotationKey = normalizeMatrixText(annotation);
    if (!requirementKey || !annotationKey) return 0;
    if (requirementKey === annotationKey) return 1;
    const a = outcomeKey(requirement);
    const b = outcomeKey(annotation);
    if (a.action !== b.action) return 0;
    const shared = [...a.words].filter(word => b.words.has(word)).length;
    const score = (2 * shared) / (a.words.size + b.words.size);
    // A longer description may add context, but a generic two-word label is too weak.
    return (score >= 0.76 && shared >= 2) || (a.action && shared >= 4 && shared === Math.min(a.words.size, b.words.size))
        ? Math.min(0.99, score) : 0;
}

export function matrixMatchScore(rows: MatrixRow[], candidate: {
    type: StudyQuestionType;
    level?: number;
    outcomes: string[];
}) {
    if (!rows.length || rows.some(row => row.type !== candidate.type || (row.level && row.level !== candidate.level))) return 0;
    return Math.min(...rows.map(row => {
        const requirements = row.outcome.split('\n');
        return Math.max(0, ...requirements.flatMap(requirement =>
            candidate.outcomes.map(outcome => outcomeScore(requirement, outcome))));
    }));
}

export function matrixSlots(rows: MatrixRow[]) {
    const slots = new Map<string, { id: string; label: string; number?: number; rows: MatrixRow[]; statements: string[] }>();
    let pendingStatements = 0;
    rows.forEach((row, index) => {
        if (row.countUnit === 'statement' && !row.references.length) {
            pendingStatements += row.count;
            return;
        }
        const section = normalizeMatrixText(row.section) || row.type || 'unspecified';
        for (let i = 0; i < (row.references.length || row.count); i++) {
            const reference = row.references[i];
            const number = reference?.match(/\d+/)?.[0];
            const id = number ? `${section}:C${Number(number)}` : `row:${index}:${i}`;
            const label = [row.section, number ? `Câu ${Number(number)}` : `Mục ${index + 1} · Câu ${i + 1}`].filter(Boolean).join(' · ');
            const slot = slots.get(id) ?? { id, label, number: number ? Number(number) : undefined, rows: [], statements: [] };
            if (!slot.rows.includes(row)) slot.rows.push(row);
            if (row.countUnit === 'statement' && reference) slot.statements.push(reference);
            slots.set(id, slot);
        }
    });
    const complete = [...slots.values()].filter(({ statements }) => {
        if (!statements.length || (statements.length === 4 && new Set(statements).size === 4)) return true;
        pendingStatements += statements.length;
        return false;
    });
    complete.sort((a, b) => a.label.localeCompare(b.label, 'vi', { numeric: true }));
    return { slots: complete, pendingStatements };
}
