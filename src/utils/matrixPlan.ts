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

export interface MatrixPlanSlot extends Omit<MatrixAllocation, 'count'> {
    statementLevels?: number[];
    id: string;
    units: number;
    label: string;
    canChoose: boolean;
}

export function matrixPlanSlots(allocations: MatrixAllocation[]): MatrixPlanSlot[] {
    const numbers = { trac_nghiem: 0, dung_sai: 0, tu_luan: 0, written: 0 };
    const grouped = new Map<string, MatrixAllocation[]>();
    for (const entry of allocations.filter(row => row.type === 'dung_sai')) {
        const key = entry.chapterId + ':' + entry.topicId;
        grouped.set(key, [...(grouped.get(key) ?? []), entry]);
    }
    const visited = new Set<string>();
    return allocations.flatMap(({ count, ...entry }) => {
        if (entry.type === 'dung_sai') {
            const groupId = entry.chapterId + ':' + entry.topicId;
            if (visited.has(groupId)) return [];
            visited.add(groupId);
            const levels = grouped.get(groupId)!.flatMap(row => Array.from({ length: row.count }, () => readCognitiveLevel(row.level)));
            const buckets: number[][] = Array.from({ length: Math.ceil(levels.length / 4) }, () => []);
            let cursor = 0;
            for (const level of levels) {
                while (buckets[cursor].length >= Math.min(4, levels.length - cursor * 4)) cursor = (cursor + 1) % buckets.length;
                buckets[cursor].push(level);
                cursor = (cursor + 1) % buckets.length;
            }
            const slots: MatrixPlanSlot[] = [];
            for (const [index, statementLevels] of buckets.entries()) {
                const level = statementLevels.every(value => value === statementLevels[0]) ? statementLevels[0] : 0;
                slots.push({ ...entry, id: groupId + ':dung_sai:' + statementLevels.join('') + ':' + index,
                    level, statementLevels, units: statementLevels.length,
                    label: statementLevels.length === 4 ? 'Câu ' + ++numbers.dung_sai : statementLevels.length + ' ý chờ ghép',
                    canChoose: statementLevels.length === 4 });
            }
            return slots;
        }
        const key = entry.topicId + ':' + entry.type + ':' + entry.level;
        const slots: MatrixPlanSlot[] = Array.from({ length: count }, (_, index) => ({
            ...entry,
            id: key + ':q' + index,
            units: 1,
            label: 'Câu ' + ++numbers[entry.type],
            canChoose: entry.type !== 'written',
        }));
        return slots;
    });
}

export function matrixPlanLevelLabel(slot: MatrixPlanSlot) {
    return slot.statementLevels
        ? [1, 2, 3].flatMap(level => {
            const count = slot.statementLevels!.filter(value => value === level).length;
            return count ? [count + ' ' + COGNITIVE_LEVELS[level]] : [];
        }).join(' · ')
        : COGNITIVE_LEVELS[readCognitiveLevel(slot.level)];
}

export function matchesMatrixPlanSlot(slot: MatrixPlanSlot, candidate: {
    chapterId?: string;
    grade?: number;
    energyTopic?: EnergyMatrixTopic;
    lessonTitle?: string;
    item: { type: StudyQuestionType; level?: number; statements?: readonly { cognitive_level?: unknown }[] };
}) {
    if (!slot.canChoose || slot.chapterId !== candidate.chapterId || (candidate.grade && candidate.grade !== 10)
        || slot.type !== candidate.item.type
        || (slot.type === 'dung_sai' && candidate.item.statements?.length !== 4)) return false;
    if (slot.statementLevels) {
        const actual = questionLevels(candidate.item);
        if (![1, 2, 3].every(level => actual.filter(value => value === level).length
            === slot.statementLevels!.filter(value => value === level).length)) return false;
    } else if (readCognitiveLevel(slot.level) !== readCognitiveLevel(candidate.item.level)) return false;
    if (slot.chapterId === ENERGY_MATRIX_CHAPTER_ID) return slot.topicId === candidate.energyTopic;
    return !!candidate.lessonTitle && cleanMatrixTitle(slot.topic) === cleanMatrixTitle(candidate.lessonTitle);
}

export function plannedOutcome(draft: string | undefined, picked: string | undefined, outcomes: readonly string[]) {
    return draft ?? (picked && outcomes.includes(picked) ? picked : outcomes.length === 1 ? outcomes[0] : '');
}
