import { describe, expect, it } from 'vitest';
import type { SelectedQuestionItem } from '../services/examLatexService';
import { answerOf, choicesLocked, examCodes, examVariantsSheetHtml, shortAnswerOf, shuffleExam, type ExamShuffleOptions } from '../utils/examShuffle';

const choice = (index: number): SelectedQuestionItem => ({ id: 'tn' + index, questionNo: 'Câu ' + index, qText: 'Câu trắc nghiệm ' + index,
    type: 'trac_nghiem', choices: ['một ' + index, 'hai ' + index, 'ba ' + index, 'bốn ' + index], correctChoice: 'B',
    solution: 'Tính được hai. Chọn B.' });
const trueFalse = (index: number): SelectedQuestionItem => ({ id: 'ds' + index, questionNo: 'Câu ' + index, qText: 'Đúng sai ' + index, type: 'dung_sai',
    statements: ['a', 'b', 'c', 'd'].map((label, i) => ({ label, claim: label + index, verdict: i % 2 === 0 })) });
const short = (index: number): SelectedQuestionItem => ({ id: 'tl' + index, questionNo: 'Câu ' + index, qText: 'Trả lời ngắn ' + index, type: 'tu_luan',
    solution: 'A = 20 J.\nTrả lời ngắn: ' + index * 10 + '.' });
const exam = [...Array.from({ length: 12 }, (_, i) => choice(i + 1)), ...Array.from({ length: 4 }, (_, i) => trueFalse(i + 1)), ...Array.from({ length: 6 }, (_, i) => short(i + 1))];
const options: ExamShuffleOptions = { count: 4, firstCode: '101', questions: true, choices: true, statements: false, seed: 42, keep: {} };

describe('exam shuffle', () => {
    it('numbers codes from the first code', () => {
        expect(examCodes('101', 4)).toEqual(['101', '102', '103', '104']);
        expect(examCodes('009', 2)).toEqual(['009', '010']);
        expect(examCodes('A', 2)).toEqual(['A-1', 'A-2']);
        expect(examCodes('101', 99)).toHaveLength(24);
    });

    it('keeps each part together, moves questions only within their part and is repeatable', () => {
        const variants = shuffleExam(exam, options);
        expect(variants.map(variant => variant.code)).toEqual(['101', '102', '103', '104']);
        for (const variant of variants) {
            expect(variant.questions.map(question => question.type)).toEqual(exam.map(question => question.type));
            expect(new Set(variant.questions.map(question => question.id))).toEqual(new Set(exam.map(question => question.id)));
            expect(variant.parts.trac_nghiem.map(entry => entry.question.id)).toEqual(variant.parts.trac_nghiem.map(entry => 'tn' + entry.original));
        }
        expect(new Set(variants.map(variant => variant.questions.map(question => question.id).join()))).toHaveProperty('size', 4);
        expect(shuffleExam(exam, options)).toEqual(variants);
        expect(shuffleExam(exam, { ...options, seed: 43 })).not.toEqual(variants);
    });

    it('moves the correct letter, and the solution letter, with the shuffled choices', () => {
        for (const variant of shuffleExam(exam, options)) for (const { question, original } of variant.parts.trac_nghiem) {
            const letter = question.correctChoice!;
            expect(question.choices!['ABCD'.indexOf(letter)]).toBe('hai ' + original);
            expect(question.solution).toBe('Tính được hai. Chọn ' + letter + '.');
        }
    });

    it('locks choices that refer to other choices, and positions the teacher keeps', () => {
        expect(choicesLocked(['1 J', '2 J', 'Cả A và B đều đúng', '4 J'])).toBe(true);
        expect(choicesLocked(['1 J', '2 J', '3 J', 'Tất cả đều sai'])).toBe(true);
        expect(choicesLocked(['1 J', '2 J', '3 J', '4 J'])).toBe(false);
        for (const variant of shuffleExam(exam, { ...options, keep: { trac_nghiem: [1, 12] } })) {
            expect(variant.parts.trac_nghiem[0].original).toBe(1);
            expect(variant.parts.trac_nghiem[11].original).toBe(12);
        }
    });

    it('leaves true/false statements in order unless asked, and keeps verdicts with their statement', () => {
        for (const variant of shuffleExam(exam, options)) for (const { question, original } of variant.parts.dung_sai) {
            expect(question.statements!.map(statement => statement.claim)).toEqual(['a', 'b', 'c', 'd'].map(label => label + original));
        }
        for (const variant of shuffleExam(exam, { ...options, statements: true })) for (const { question } of variant.parts.dung_sai) {
            expect(question.statements!.map(statement => statement.label)).toEqual(['a', 'b', 'c', 'd']);
            for (const statement of question.statements!) expect(statement.verdict).toBe(['a', 'c'].includes(statement.claim[0]));
        }
    });

    it('reads answers for the key and builds the answer and mapping sheets', () => {
        expect(shortAnswerOf(short(3))).toBe('30');
        expect(answerOf(trueFalse(1))).toBe('ĐSĐS');
        const variants = shuffleExam(exam, options);
        const html = examVariantsSheetHtml(variants);
        expect(html).toContain('BẢNG ĐÁP ÁN CÁC MÃ ĐỀ');
        expect(html).toContain('BẢNG ĐỐI CHIẾU VỚI ĐỀ GỐC');
        expect(html).toContain('PHẦN III. TRẢ LỜI NGẮN');
        expect(html).toContain('>104<');
    });
});
