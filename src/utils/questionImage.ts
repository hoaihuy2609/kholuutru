export const MIN_QUESTION_IMAGE_WIDTH = 20;
export const MAX_QUESTION_IMAGE_WIDTH = 100;

export function normalizeQuestionImageWidth(value: unknown): number | undefined {
    if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
    return Math.max(MIN_QUESTION_IMAGE_WIDTH, Math.min(MAX_QUESTION_IMAGE_WIDTH, Math.round(value)));
}
