import { expect, it } from 'vitest';
import { DEFAULT_EXAM_STYLE, generateExamLatex, SHORT_ANSWER_BOX_COUNT, type SelectedQuestionItem } from '../services/examLatexService';

const questions: SelectedQuestionItem[] = [
  { id: 'a', questionNo: 'Câu 1', qText: 'Tính công của lực kéo (J).', type: 'tu_luan' },
  { id: 'b', questionNo: 'Câu 2', qText: 'Chọn đáp án đúng.', type: 'trac_nghiem', choices: ['1', '2', '3', '4'], correctChoice: 'A' },
];
const count = (text: string, part: string) => text.split(part).length - 1;

it('draws four answer boxes under each short-answer question in the LaTeX source', () => {
  expect(SHORT_ANSWER_BOX_COUNT).toBe(4);
  const tex = generateExamLatex(questions, DEFAULT_EXAM_STYLE);
  expect(count(tex, '\\textbf{Đáp án:}')).toBe(1);
  expect(tex).toContain('\\begin{tabular}{|p{5mm}|p{5mm}|p{5mm}|p{5mm}|}\\hline\\rule{0pt}{6mm}&&&\\\\\\hline\\end{tabular}');
});

it('leaves the boxes out when the option is off', () => {
  expect(generateExamLatex(questions, { ...DEFAULT_EXAM_STYLE, shortAnswerBoxes: false })).not.toContain('\\textbf{Đáp án:}');
});
