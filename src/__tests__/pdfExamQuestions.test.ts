import { expect, it } from 'vitest';
import { parsePdfExam } from '../utils/pdfExamQuestions';
import { layoutPdfText } from '../utils/pdfTextLayout';
import { convertPdfMathToLatex } from '../utils/pdfMathLatex';
import katex from 'katex';

it('keeps page provenance, repeated numbering and all three question types', () => {
    const { questions } = parsePdfExam([
        'PHẦN I. TRẮC NGHIỆM\nCâu 1. Vật chuyển động thế nào?\nA. Đứng yên B. Chuyển động đều',
        'Trang 2 / 2\nC. Rơi tự do D. Dao động\nĐáp án: B\nPHẦN II. ĐÚNG SAI\nCâu 1: Quan sát hình.\na) Một\nb) Hai\nc) Ba\nd) Bốn\nĐáp án: Đúng, Sai, Đ, S\nPHẦN III. TRẢ LỜI NGẮN\nCâu 1. Tính vận tốc.\nĐáp án: 12 m/s\n--- Hết ---\nCâu 2. Không phải câu của đề',
    ]);
    expect(questions).toHaveLength(3);
    expect(questions[0]).toMatchObject({
        source: { label: 'Câu 1', page: 1 }, type: 'trac_nghiem', text: 'Vật chuyển động thế nào?',
        options: ['Đứng yên', 'Chuyển động đều', 'Rơi tự do', 'Dao động'], answer: 'B',
    });
    expect(questions[1]).toMatchObject({
        source: { label: 'Câu 1', page: 2 }, type: 'dung_sai', needsVisualReview: true,
        verdicts: [true, false, true, false],
    });
    expect(questions[2]).toMatchObject({ type: 'tu_luan', answer: '12 m/s' });
});

it('leaves an incomplete question editable and does not guess its answer', () => {
    const { questions: [question] } = parsePdfExam(['Phần I\nCâu 3. Điểm A. nằm trên đoạn thẳng.\nA. 3 B. 4\nĐáp án']);
    expect(question.type).toBe('trac_nghiem');
    expect(question.text).toContain('Điểm A.');
    expect(question.options).toEqual(['', '', '', '']);
    expect(question.answer).toBe('');
});

it('joins a 28-question exam to answer tables and solutions by part and original number', () => {
    const parts = [
        { name: 'I', count: 18, choices: 'A. Một B. Hai C. Ba D. Bốn', answer: 'B' },
        { name: 'II', count: 4, choices: 'a) Một b) Hai c) Ba d) Bốn', answer: 'ĐSĐS' },
        { name: 'III', count: 6, choices: '', answer: '12.5 m/s' },
    ];
    const entries = (count: number, format: (number: number) => string) =>
        Array.from({ length: count }, (_, index) => format(index + 1)).join('\n');
    const exam = parts.map(part => 'PHẦN ' + part.name + '\n' + entries(part.count, number =>
        'Câu ' + number + '. Đề ' + part.name + '-' + number + '\n' + part.choices)).join('\n');
    const answers = 'BẢNG ĐÁP ÁN\n' + parts.map(part => 'PHẦN ' + part.name + '\n'
        + (part.name === 'I'
            ? 'Câu 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18\nĐáp án ' + Array(18).fill('B').join(' ')
            : entries(part.count, number => number + '. ' + part.answer))).join('\n');
    const solutions = 'HƯỚNG DẪN GIẢI CHI TIẾT\n' + parts.map(part => 'PHẦN ' + part.name + '\n'
        + entries(part.count, number => 'Câu ' + number + '.\nGiải chi tiết: Giải ' + part.name + '-' + number)).join('\n');

    const result = parsePdfExam([exam, '--- Hết ---\n' + answers, solutions]);
    expect(result.unmatchedEntries).toBe(0);
    expect(result.questions).toHaveLength(28);
    const [choice, trueFalse, short] = [result.questions[0], result.questions[18], result.questions[22]];
    expect(choice).toMatchObject({ answer: 'B', solution: 'Giải I-1', source: { page: 1, answerPage: 2, solutionPage: 3 } });
    expect(trueFalse).toMatchObject({ verdicts: [true, false, true, false], solution: 'Giải II-1', options: ['Một', 'Hai', 'Ba', 'Bốn'] });
    expect(short).toMatchObject({ answer: '12.5 m/s', solution: 'Giải III-1' });
    expect(result.questions[27].solution).toBe('Giải III-6');
});

it('preserves inline explanations and flags ambiguous entries instead of assigning them to repeated numbers', () => {
    const { questions, unmatchedEntries } = parsePdfExam([
        'PHẦN I\nCâu 1. Chọn đáp án.\nA. A B. B C. C D. D\nLời giải: Áp dụng công thức.\nĐáp án: A\nPHẦN II\nCâu 1. Quan sát vectơ.\na) Một b) Hai c) Ba d) Bốn',
        'ĐÁP ÁN\nCâu 1. B\nHƯỚNG DẪN GIẢI CHI TIẾT\nPHẦN I\nCâu 1. Chọn C\nGiải khác với bản trong đề.',
    ]);
    expect(unmatchedEntries).toBe(1);
    expect(questions[0]).toMatchObject({ answer: 'A', solution: 'Áp dụng công thức.', needsMatchReview: true });
    expect(questions[1]).toMatchObject({ options: ['Một', 'Hai', 'Ba', 'Bốn'], verdicts: [null, null, null, null], needsMatchReview: true });
});

it('places text emitted later back on its visual line and flags a shifted glyph', () => {
    const fragment = (text: string, x: number, y: number, width: number, height = 10) => ({ text, x, y, width, height });
    expect(layoutPdfText([
        fragment('c) Vectơ', 20, 100, 45), fragment('hướng xuống.', 82, 100, 65),
        fragment('d) Mệnh đề sau.', 20, 85, 80), fragment('B', 70, 100, 7),
        fragment('₁', 77, 97, 4, 6),
    ])).toEqual({ text: 'c) Vectơ B₁ hướng xuống.\nd) Mệnh đề sau.', needsReview: true });
});

it('converts explicit Unicode scripts and vector marks into renderable LaTeX', () => {
    const converted = convertPdfMathToLatex('B⃗₁, B₂⃗, x², 10⁻⁶ và cm²');
    expect(converted).toBe('$\\vec{B}_{1}$, $\\vec{B}_{2}$, $x^{2}$, $10^{-6}$ và $\\mathrm{cm}^{2}$');
    for (const match of converted.matchAll(/\$([^$]+)\$/g)) {
        expect(() => katex.renderToString(match[1], { throwOnError: true })).not.toThrow();
    }
    expect(convertPdfMathToLatex(converted)).toBe(converted);
});

it('preserves existing math, prose footnotes and notation whose glyphs are absent', () => {
    const original = 'Vectơ B1. Chữ có chú thích². $x₁$ và \\(x²\\).';
    expect(convertPdfMathToLatex(original)).toBe(original);
});
