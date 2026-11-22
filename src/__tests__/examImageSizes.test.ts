import { describe, expect, it } from 'vitest';
import type { SelectedQuestionItem } from '../services/examLatexService';
import { applyExamImageWidths, examImageKey, examImageWidth } from '../utils/examImageSizes';

const question: SelectedQuestionItem = {
    id: 'blog:0', questionNo: 'Câu 1', qText: 'Đồ thị nào đúng? [image:h1]', type: 'trac_nghiem', choices: ['A', 'B', 'C', 'D'],
    imageUrl: 'https://example.test/main.png', imageWidth: 70,
    questionImages: [{ key: 'h1', url: 'https://example.test/graph.png', width: 40 }],
};

describe('image sizes chosen for one exam', () => {
    it('reads the stored width, then overrides each image of the question without touching the original', () => {
        expect(examImageWidth(question, 'https://example.test/main.png', {})).toBe(70);
        expect(examImageWidth(question, 'https://example.test/graph.png', {})).toBe(40);
        const widths = { [examImageKey('blog:0', 'https://example.test/graph.png')]: 85, [examImageKey('blog:0', 'https://example.test/main.png')]: 30 };
        const [sized] = applyExamImageWidths([question], widths);
        expect(sized.imageWidth).toBe(30);
        expect(sized.questionImages?.[0].width).toBe(85);
        expect(question.imageWidth).toBe(70);
        expect(question.questionImages?.[0].width).toBe(40);
        expect(examImageWidth(question, 'https://example.test/graph.png', widths)).toBe(85);
        expect(applyExamImageWidths([question], { [examImageKey('other:0', 'https://example.test/graph.png')]: 50 })[0]).toBe(question);
    });

});
