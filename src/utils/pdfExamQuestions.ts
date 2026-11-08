import type { StudyQuestionType } from '../../types';

export interface PdfQuestionSource {
    label: string;
    page: number;
    part?: string;
}

export interface PdfExamQuestion {
    source: PdfQuestionSource;
    type: StudyQuestionType;
    text: string;
    options: string[];
    answer: string;
    verdicts: (boolean | null)[];
    needsVisualReview: boolean;
}

function sectionType(line: string): StudyQuestionType | undefined {
    const heading = line.match(/^Phần\s+(III|II|I|[123])\b/i)?.[1].toUpperCase();
    if (heading === 'I' || heading === '1') return 'trac_nghiem';
    if (heading === 'II' || heading === '2') return 'dung_sai';
    if (heading === 'III' || heading === '3') return 'tu_luan';
}

function parseQuestion(source: PdfQuestionSource, raw: string, hint?: StudyQuestionType): PdfExamQuestion {
    const answerMatch = raw.match(/(?:^|\n)[ \t]*(?:Đáp án(?: đúng)?|Trả lời)[ \t]*[:：][ \t]*([^\n]*)/i);
    const answer = answerMatch?.[1].trim() ?? '';
    const body = answerMatch ? raw.slice(0, answerMatch.index).trim() : raw.trim();
    // Cho phép các lựa chọn nằm cùng một dòng nhưng cần đủ thứ tự A–D hoặc a–d
    // để tránh tách nhầm điểm A, B, C, D trong phần đề.
    const markers = [...body.matchAll(/(?:^|\s)([A-Da-d])[.)]\s+/g)];
    const options = ['', '', '', ''];
    let text = body;
    let inferred: StudyQuestionType | undefined;
    const start = markers.findIndex((marker, index) => {
        const label = marker[1] === 'A' ? 'ABCD' : 'abcd';
        return markers.slice(index, index + 4).map(item => item[1]).join('') === label;
    });
    if (start >= 0) {
        const choices = markers.slice(start, start + 4);
        inferred = choices[0][1] === 'A' ? 'trac_nghiem' : 'dung_sai';
        text = body.slice(0, choices[0].index).trim();
        choices.forEach((choice, index) => {
            const from = choice.index! + choice[0].length;
            options[index] = body.slice(from, choices[index + 1]?.index).trim();
        });
    }
    const type = inferred ?? hint ?? 'tu_luan';
    const verdictTokens = answer.match(/Đúng|Sai|[ĐS]/gi) ?? [];
    const hasVerdicts = type === 'dung_sai' && verdictTokens.length === 4
        && /^[\s,;/.\-ĐSđs]*(?:(?:Đúng|Sai)[\s,;/.\-ĐSđs]*)*$/i.test(answer);
    return {
        source, type, text, options,
        answer: type === 'trac_nghiem' ? answer.match(/^[A-D]$/i)?.[0].toUpperCase() ?? '' : answer,
        verdicts: options.map((_, index) => hasVerdicts ? /^đ/i.test(verdictTokens[index]) : null),
        needsVisualReview: /(?:hình|đồ thị|sơ đồ|bảng số liệu)/i.test(body) || /[\uFFFD\uE000-\uF8FF]/u.test(body),
    };
}

export function parsePdfExam(pages: string[]): PdfExamQuestion[] {
    const questions: PdfExamQuestion[] = [];
    let part: string | undefined;
    let hint: StudyQuestionType | undefined;
    let current: { source: PdfQuestionSource; lines: string[]; hint?: StudyQuestionType } | undefined;
    const finish = () => {
        if (current) questions.push(parseQuestion(current.source, current.lines.join('\n'), current.hint));
        current = undefined;
    };
    for (const [index, page] of pages.entries()) {
        for (const rawLine of page.split(/\r?\n/)) {
            const line = rawLine.normalize('NFC').trim();
            if (!line || /^(?:Trang|Page)\s+\d+\b/i.test(line)) continue;
            if (/^(?:(?:Bảng\s+)?Đáp án(?:\s*(?:tham khảo|chi tiết))?\s*[:.]?$|Hết\s*$|[-–—]+\s*Hết\s*[-–—]+$|Hướng dẫn giải\s*$)/i.test(line)) {
                finish();
                return questions;
            }
            const type = sectionType(line);
            if (type) {
                finish();
                hint = type;
                part = line;
                continue;
            }
            const header = line.match(/^(?:Câu(?:\s+hỏi)?|Bài)\s*(\d+)\s*([.:)])\s*(.*)$/i);
            if (header) {
                finish();
                current = { source: { label: 'Câu ' + header[1], page: index + 1, part }, lines: [header[3]], hint };
            } else if (current) {
                current.lines.push(line);
            }
        }
    }
    finish();
    return questions;
}
