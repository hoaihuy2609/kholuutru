import { expect, it } from 'vitest';
import { parsePdfExam } from '../utils/pdfExamQuestions';

it('keeps page provenance, repeated numbering and all three question types', () => {
    const questions = parsePdfExam([
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
    const [question] = parsePdfExam(['Phần I\nCâu 3. Điểm A. nằm trên đoạn thẳng.\nA. 3 B. 4\nĐáp án']);
    expect(question.type).toBe('trac_nghiem');
    expect(question.text).toContain('Điểm A.');
    expect(question.options).toEqual(['', '', '', '']);
    expect(question.answer).toBe('');
});
