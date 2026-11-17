import type { StudyQuestionType } from '../../types';
import { cleanMatrixTitle, ENERGY_MATRIX_CHAPTER_ID, type EnergyMatrixTopic, type MatrixQuestionType } from './examMatrix';

export interface MatrixAllocation {
    chapterId: string;
    chapter: string;
    topicId: string;
    topic: string;
    type: Exclude<MatrixQuestionType, ''>;
    level: number;
    count: number;
}

export interface MatrixPlanSlot extends Omit<MatrixAllocation, 'count'> {
    id: string;
    units: number;
    label: string;
    canChoose: boolean;
}

export function matrixPlanSlots(allocations: MatrixAllocation[]): MatrixPlanSlot[] {
    const numbers = { trac_nghiem: 0, dung_sai: 0, tu_luan: 0, written: 0 };
    return allocations.flatMap(({ count, ...entry }) => {
        const key = entry.topicId + ':' + entry.type + ':' + entry.level;
        const trueFalse = entry.type === 'dung_sai';
        const questions = trueFalse ? Math.floor(count / 4) : count;
        const remainder = trueFalse ? count % 4 : 0;
        const slots: MatrixPlanSlot[] = Array.from({ length: questions }, (_, index) => ({
            ...entry,
            id: key + ':q' + index,
            units: trueFalse ? 4 : 1,
            label: 'Câu ' + ++numbers[entry.type],
            canChoose: entry.type !== 'written',
        }));
        if (remainder) slots.push({
            ...entry, id: key + ':remainder', units: remainder, label: remainder + ' ý chờ ghép', canChoose: false,
        });
        return slots;
    });
}

export function matchesMatrixPlanSlot(slot: MatrixPlanSlot, candidate: {
    chapterId?: string;
    grade?: number;
    energyTopic?: EnergyMatrixTopic;
    lessonTitle?: string;
    item: { type: StudyQuestionType; level?: number; statements?: readonly unknown[] };
}) {
    if (!slot.canChoose || slot.chapterId !== candidate.chapterId || (candidate.grade && candidate.grade !== 10)
        || slot.type !== candidate.item.type || slot.level !== candidate.item.level
        || (slot.type === 'dung_sai' && candidate.item.statements?.length !== 4)) return false;
    if (slot.chapterId === ENERGY_MATRIX_CHAPTER_ID) return slot.topicId === candidate.energyTopic;
    return !!candidate.lessonTitle && cleanMatrixTitle(slot.topic) === cleanMatrixTitle(candidate.lessonTitle);
}

export function plannedOutcome(draft: string | undefined, picked: string | undefined, outcomes: readonly string[]) {
    return draft ?? (picked && outcomes.includes(picked) ? picked : outcomes.length === 1 ? outcomes[0] : '');
}
