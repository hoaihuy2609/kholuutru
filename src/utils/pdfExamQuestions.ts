import type { StudyQuestionType } from '../../types';

export interface PdfQuestionSource {
    label: string;
    page: number;
    part?: string;
    answerPage?: number;
    solutionPage?: number;
}

export interface PdfExamQuestion {
    source: PdfQuestionSource;
    type: StudyQuestionType;
    text: string;
    options: string[];
    answer: string;
    solution: string;
    verdicts: (boolean | null)[];
    needsVisualReview: boolean;
    needsMatchReview?: boolean;
}

const partPattern = /^Phần\s+(III|II|I|[123])\b/i;
const questionPattern = /^(?:Câu(?:\s+hỏi)?|Bài)\s*(\d+)\s*(?:[.:)：]\s*(.*))?$/i;
const inlineSolutionPattern = /^(?:Lời giải|Giải chi tiết|Hướng dẫn giải)(?: chi tiết)?(?:\s*[:：.]\s*(.*))?$/i;
const solutionHeading = /^(?:Hướng dẫn giải(?: chi tiết)?|Lời giải chi tiết|Đáp án và (?:lời giải|hướng dẫn giải)(?: chi tiết)?)\s*[:：.]?$/i;
const answerHeading = /^(?:Bảng\s+)?Đáp án(?:\s+(?:tham khảo|chi tiết|trắc nghiệm))?\s*[:：.]?$/i;
const answerLine = /^(?:Đáp án(?: đúng)?|Trả lời)\s*[:：]\s*(.+)$/i;

function partNumber(line?: string) {
    const part = line?.match(partPattern)?.[1].toUpperCase();
    if (part === 'I') return '1';
    if (part === 'II') return '2';
    if (part === 'III') return '3';
    return part;
}

function sectionType(line: string): StudyQuestionType | undefined {
    switch (partNumber(line)) {
        case '1': return 'trac_nghiem';
        case '2': return 'dung_sai';
        case '3': return 'tu_luan';
    }
}

function answerFields(type: StudyQuestionType, value: string) {
    const answer = value.trim();
    if (type === 'dung_sai') {
        const labels = [...answer.matchAll(/\b([a-d])\s*[).:=]/gi)].map(match => match[1].toLowerCase()).join('');
        if (labels && labels !== 'abcd') return undefined;
        const unlabelled = answer.replace(/\b[a-d]\s*[).:=]\s*/gi, '');
        const verdicts = unlabelled.match(/Đúng|Sai|[ĐS]/gi) ?? [];
        const remainder = unlabelled.replace(/Đúng|Sai|[ĐS]|[\s,;/.\-]/gi, '');
        return verdicts.length === 4 && !remainder
            ? { answer: '', verdicts: verdicts.map(verdict => /^đ/i.test(verdict)) } : undefined;
    }
    if (type === 'trac_nghiem') {
        const choice = answer.match(/^(?:Chọn\s+)?([A-D])[.]?$/i)?.[1].toUpperCase();
        return choice ? { answer: choice, verdicts: [null, null, null, null] } : undefined;
    }
    return answer ? { answer, verdicts: [null, null, null, null] } : undefined;
}

function parseQuestion(source: PdfQuestionSource, lines: PdfLine[]): PdfExamQuestion {
    const solutionStart = lines.findIndex(({ text }) => inlineSolutionPattern.test(text));
    const prompt = solutionStart < 0 ? lines : lines.slice(0, solutionStart);
    const inlineSolution = solutionStart < 0 ? [] : lines.slice(solutionStart);
    const answer = lines.find(({ text }) => answerLine.test(text));
    const body = prompt.filter(line => line !== answer).map(line => line.text).join('\n').trim();
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
    const type = inferred ?? sectionType(source.part ?? '') ?? 'tu_luan';
    const fields = answer && answerFields(type, answer.text.match(answerLine)![1]);
    const solution = inlineSolution.map((line, index) =>
        index === 0 ? line.text.match(inlineSolutionPattern)?.[1] ?? '' : line === answer && fields ? '' : line.text).join('\n').trim();
    return {
        source: { ...source, answerPage: answer?.page, solutionPage: solution ? inlineSolution[0].page : undefined },
        type, text, options, solution,
        answer: fields?.answer ?? '',
        verdicts: fields?.verdicts ?? [null, null, null, null],
        needsMatchReview: !!answer && !fields,
        needsVisualReview: needsVisualReview(body + '\n' + solution),
    };
}

function needsVisualReview(text: string) {
    return /(?:\bhình\b|đồ thị|sơ đồ|bảng số liệu|vectơ|vector)/i.test(text)
        || /[\u2070-\u209F\u20D0-\u20FF\uFFFD\uE000-\uF8FF]/u.test(text);
}

export function pdfSolutionText(question: PdfExamQuestion) {
    if (question.type !== 'tu_luan' || !question.answer.trim()) return question.solution.trim();
    return [question.solution.trim(), 'Đáp án: ' + question.answer.trim()].filter(Boolean).join('\n\n');
}

interface PdfLine { page: number; text: string }
interface Supplement { number: string; part?: string; page: number; answer?: string; solution?: string }

export function parsePdfExam(pages: string[]) {
    const questions: PdfExamQuestion[] = [];
    const supplements: Supplement[] = [];
    const lines = pages.flatMap((page, index) => page.split(/\r?\n/).flatMap(raw => {
        const text = raw.normalize('NFC').trim();
        return !text || /^(?:Trang|Page)\s+\d+\b/i.test(text) ? [] : [{ page: index + 1, text }];
    }));
    let mode: 'questions' | 'answers' | 'solutions' | 'between' = 'questions';
    let part: string | undefined;
    let current: { source: PdfQuestionSource; number: string; lines: PdfLine[] } | undefined;
    let answerColumns: string[] | undefined;
    let unparsedAnswers = 0;
    const finish = () => {
        if (!current) return;
        const { number, source, lines: content } = current;
        if (mode === 'questions') questions.push(parseQuestion(source, content));
        if (mode === 'solutions') {
            const answer = content.find(line => answerLine.test(line.text) || /^Chọn\s+[A-D][.]?$/i.test(line.text));
            const solution = content.filter(line => line !== answer)
                .map(line => {
                    const marker = line.text.match(inlineSolutionPattern);
                    return marker ? marker[1] ?? '' : line.text;
                }).join('\n').trim();
            supplements.push({
                number, part: source.part, page: source.page, solution,
                answer: answer && (answer.text.match(answerLine)?.[1] ?? answer.text),
            });
        }
        current = undefined;
    };
    for (const [index, line] of lines.entries()) {
        const { text, page } = line;
        const next = lines[index + 1]?.text ?? '';
        const isEnd = /^(?:[-–—]+\s*)?Hết(?:\s*[-–—]+)?$/i.test(text);
        const isSolutions = solutionHeading.test(text) && (!current
            || /^Hướng dẫn giải chi tiết/i.test(text) || partPattern.test(next) || questionPattern.test(next));
        if (isEnd || isSolutions || answerHeading.test(text)) {
            finish();
            mode = isEnd ? 'between' : isSolutions ? 'solutions' : 'answers';
            part = undefined;
            answerColumns = undefined;
            continue;
        }
        if (mode === 'between') continue;
        if (partNumber(text)) {
            finish();
            part = text;
            answerColumns = undefined;
            continue;
        }
        const header = text.match(questionPattern);
        if (mode === 'answers') {
            const row = text.replace(/\|/g, ' ').trim();
            const columns = row.match(/^Câu(?:\s+hỏi)?\s+((?:\d+\s+)+\d+)$/i)?.[1];
            const values = row.match(/^Đáp án\s*[:：]?\s+(.+)$/i)?.[1].split(/\s+/);
            if (columns) {
                answerColumns = columns.split(/\s+/);
            } else if (values && answerColumns && values.length === answerColumns.length) {
                answerColumns.forEach((number, position) => supplements.push({ number, part, page, answer: values[position] }));
                answerColumns = undefined;
            } else if (header?.[2]) {
                supplements.push({ number: header[1], part, page, answer: header[2] });
            } else {
                const pairs = [...row.matchAll(/(?:^|[\s;]+)(\d+)\s*[.):](?!\d)/g)];
                if (pairs.length) {
                    pairs.forEach((pair, position) => {
                        const answer = row.slice(pair.index + pair[0].length, pairs[position + 1]?.index).trim();
                        if (answer) supplements.push({ number: pair[1], part, page, answer });
                        else unparsedAnswers++;
                    });
                } else {
                    unparsedAnswers++;
                }
            }
        } else if (header) {
            finish();
            current = {
                number: header[1], source: { label: 'Câu ' + header[1], page, part },
                lines: header[2] ? [{ text: header[2], page }] : [],
            };
        } else {
            current?.lines.push(line);
        }
    }
    finish();
    return { questions, unmatchedEntries: matchSupplements(questions, supplements) + unparsedAnswers };
}

function matchSupplements(questions: PdfExamQuestion[], supplements: Supplement[]) {
    let unmatched = 0;
    for (const entry of supplements) {
        const part = partNumber(entry.part);
        const candidates = questions.filter(question => Number(question.source.label.slice(4)) === Number(entry.number)
            && (!part || partNumber(question.source.part) === part));
        if (candidates.length !== 1) {
            unmatched++;
            for (const question of candidates) question.needsMatchReview = true;
            continue;
        }
        const [question] = candidates;
        if (entry.answer) {
            const fields = answerFields(question.type, entry.answer);
            const hasAnswer = !!question.answer || question.verdicts.some(verdict => verdict !== null);
            if (!fields || (hasAnswer && (question.answer !== fields.answer
                || question.verdicts.some((verdict, index) => verdict !== fields.verdicts[index])))) {
                question.needsMatchReview = true;
            } else if (!hasAnswer) {
                Object.assign(question, fields);
                question.source.answerPage = entry.page;
            }
        }
        if (entry.solution) {
            if (question.solution && question.solution !== entry.solution) question.needsMatchReview = true;
            if (!question.solution) {
                question.solution = entry.solution;
                question.source.solutionPage = entry.page;
                question.needsVisualReview ||= needsVisualReview(entry.solution);
            }
        }
    }
    return unmatched;
}
