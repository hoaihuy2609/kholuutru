import type { SelectedQuestionItem } from '../services/examLatexService';
import { studyImageSrc } from './studyImages';
import { normalizeQuestionImageWidth } from './questionImage';

/** Cỡ hình chỉnh riêng cho đề đang soạn, theo mã câu và đường dẫn hình; không đổi câu trong kho. */
export type ExamImageWidths = Readonly<Record<string, number>>;

export const examImageKey = (questionId: string, src: string) => questionId + '|' + src;

const legacySrc = (question: SelectedQuestionItem) =>
    studyImageSrc({ svg: question.imageSvg, url: question.imageUrl, file_id: question.imageTelegramFileId });

/** Độ rộng (%) đang dùng của một hình trong câu: cỡ đã chỉnh, cỡ lưu trong kho, hoặc undefined (mặc định). */
export function examImageWidth(question: SelectedQuestionItem, src: string, widths: ExamImageWidths) {
    const chosen = widths[examImageKey(question.id, src)];
    if (chosen !== undefined) return chosen;
    if (src && src === legacySrc(question)) return normalizeQuestionImageWidth(question.imageWidth);
    return normalizeQuestionImageWidth(question.questionImages?.find(image => studyImageSrc(image) === src)?.width);
}

/** Câu hỏi với cỡ hình đã chỉnh, dùng cho xem trước và xuất đề. */
export function applyExamImageWidths(questions: readonly SelectedQuestionItem[], widths: ExamImageWidths): SelectedQuestionItem[] {
    if (!Object.keys(widths).length) return [...questions];
    return questions.map(question => {
        const width = (src: string) => src ? widths[examImageKey(question.id, src)] : undefined;
        const legacy = width(legacySrc(question));
        const images = question.questionImages?.map(image => {
            const chosen = width(studyImageSrc(image));
            return chosen === undefined ? image : { ...image, width: chosen };
        });
        const changed = legacy !== undefined || images?.some((image, index) => image !== question.questionImages![index]);
        return changed ? { ...question, ...(legacy !== undefined ? { imageWidth: legacy } : {}), ...(images ? { questionImages: images } : {}) } : question;
    });
}
