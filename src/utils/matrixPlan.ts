import type { StudyQuestionType } from '../../types';
import { cleanMatrixTitle, ENERGY_MATRIX_CHAPTER_ID, type EnergyMatrixTopic, type MatrixQuestionType } from './examMatrix';
import { COGNITIVE_LEVELS, questionLevels, readCognitiveLevel } from './cognitiveLevels';

export interface MatrixAllocation {
    chapterId: string;
    chapter: string;
    topicId: string;
    topic: string;
    type: Exclude<MatrixQuestionType, ''>;
    level: number;
    count: number;
}

/** Statements per level for levels 1 (Nhận biết), 2 (Thông hiểu) and 3 (Vận dụng). */
export type StatementCounts = readonly [number, number, number];

export interface MatrixPlanSlot extends Omit<MatrixAllocation, 'count'> {
    /**
     * True-false only: statements per level that ALL true-false questions of this content must add up to.
     * Each question can take any mix of levels, as long as the chosen questions together match this total.
     */
    statementBudget?: StatementCounts;
    id: string;
    units: number;
    label: string;
    canChoose: boolean;
}

export function statementCounts(levels: readonly number[]): StatementCounts {
    return [1, 2, 3].map(level => levels.filter(value => value === level).length) as unknown as StatementCounts;
}

/** Content key shared by every true-false slot of the same content. */
export function trueFalseGroup(slot: Pick<MatrixPlanSlot, 'chapterId' | 'topicId'>) {
    return slot.chapterId + ':' + slot.topicId;
}

export function subtractCounts(budget: StatementCounts, used: readonly StatementCounts[]): StatementCounts {
    return budget.map((value, index) => value - used.reduce((sum, counts) => sum + counts[index], 0)) as unknown as StatementCounts;
}

export function fitsCounts(budget: StatementCounts, counts: StatementCounts) {
    return counts.every((value, index) => value <= budget[index]);
}

export function matrixPlanSlots(allocations: MatrixAllocation[]): MatrixPlanSlot[] {
    const numbers = { trac_nghiem: 0, dung_sai: 0, tu_luan: 0, written: 0 };
    const budgets = new Map<string, [number, number, number]>();
    for (const entry of allocations.filter(row => row.type === 'dung_sai')) {
        const key = trueFalseGroup(entry);
        const budget = budgets.get(key) ?? [0, 0, 0];
        const level = readCognitiveLevel(entry.level);
        if (level) budget[level - 1] += entry.count;
        budgets.set(key, budget);
    }
    const visited = new Set<string>();
    return allocations.flatMap(({ count, ...entry }) => {
        if (entry.type === 'dung_sai') {
            const groupId = trueFalseGroup(entry);
            if (visited.has(groupId)) return [];
            visited.add(groupId);
            const statementBudget = budgets.get(groupId)! as unknown as StatementCounts;
            const total = statementBudget[0] + statementBudget[1] + statementBudget[2];
            const slots: MatrixPlanSlot[] = Array.from({ length: Math.floor(total / 4) }, (_, index) => ({
                ...entry, id: groupId + ':dung_sai:' + index, level: 0, statementBudget, units: 4,
                label: 'Câu ' + ++numbers.dung_sai, canChoose: true,
            }));
            if (total % 4) slots.push({ ...entry, id: groupId + ':dung_sai:pending', level: 0, statementBudget,
                units: total % 4, label: total % 4 + ' ý chờ ghép', canChoose: false });
            return slots;
        }
        const key = entry.topicId + ':' + entry.type + ':' + entry.level;
        return Array.from({ length: count }, (_, index): MatrixPlanSlot => ({
            ...entry,
            id: key + ':q' + index,
            units: 1,
            label: 'Câu ' + ++numbers[entry.type],
            canChoose: entry.type !== 'written',
        }));
    });
}

export function statementCountsLabel(counts: StatementCounts) {
    return [1, 2, 3].flatMap(level => counts[level - 1] ? [counts[level - 1] + ' ' + COGNITIVE_LEVELS[level]] : []).join(' · ');
}

export function matrixPlanLevelLabel(slot: MatrixPlanSlot) {
    return slot.statementBudget
        ? 'ghép theo cả nội dung: ' + statementCountsLabel(slot.statementBudget)
        : COGNITIVE_LEVELS[readCognitiveLevel(slot.level)];
}

type PlanCandidate = {
    chapterId?: string;
    grade?: number;
    energyTopic?: EnergyMatrixTopic;
    lessonTitle?: string;
    item: { type: StudyQuestionType; level?: number; statements?: readonly { cognitive_level?: unknown }[] };
};

/** Statement levels of a true-false question, or undefined when it does not have four leveled statements. */
export function trueFalseCounts(item: PlanCandidate['item']): StatementCounts | undefined {
    if (item.type !== 'dung_sai' || item.statements?.length !== 4) return undefined;
    const levels = questionLevels(item);
    return levels.every(level => level >= 1 && level <= 3) ? statementCounts(levels) : undefined;
}

/**
 * Whether a question can fill the slot on its own: same chapter, content, format and level. For true-false,
 * the question's statements must fit the content's total; whether it still fits next to the other chosen
 * true-false questions is checked with the remaining budget (see subtractCounts).
 */
export function matchesMatrixPlanSlot(slot: MatrixPlanSlot, candidate: PlanCandidate) {
    if (!slot.canChoose || slot.chapterId !== candidate.chapterId || (candidate.grade && candidate.grade !== 10)
        || slot.type !== candidate.item.type) return false;
    if (slot.statementBudget) {
        const counts = trueFalseCounts(candidate.item);
        if (!counts || !fitsCounts(slot.statementBudget, counts)) return false;
    } else if (readCognitiveLevel(slot.level) !== readCognitiveLevel(candidate.item.level)) return false;
    if (slot.chapterId === ENERGY_MATRIX_CHAPTER_ID) return slot.topicId === candidate.energyTopic;
    return !!candidate.lessonTitle && cleanMatrixTitle(slot.topic) === cleanMatrixTitle(candidate.lessonTitle);
}

export function plannedOutcome(draft: string | undefined, picked: string | undefined, outcomes: readonly string[]) {
    return draft ?? (picked && outcomes.includes(picked) ? picked : outcomes.length === 1 ? outcomes[0] : '');
}
