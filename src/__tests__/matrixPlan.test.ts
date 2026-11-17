import { describe, expect, it } from 'vitest';
import { energyCurriculumGoals, matchEnergyCurriculumGoal } from '../utils/energyCurriculum';
import { matrixPlanSlots, matchesMatrixPlanSlot, plannedOutcome, type MatrixAllocation } from '../utils/matrixPlan';

const allocation: MatrixAllocation = {
    chapterId: 'g10-ch3', chapter: 'Công, năng lượng, công suất',
    topicId: 'work', topic: 'Công và năng lượng',
    type: 'trac_nghiem', level: 1, count: 1,
};

describe('matrix planner specification', () => {
    it('keeps question positions stable and groups four true-false statements at a time', () => {
        const slots = matrixPlanSlots([
            allocation,
            { ...allocation, type: 'dung_sai', count: 5 },
            { ...allocation, type: 'dung_sai', level: 2, count: 3 },
            { ...allocation, type: 'written' },
        ]);
        expect(slots.map(({ type, units, canChoose }) => [type, units, canChoose])).toEqual([
            ['trac_nghiem', 1, true], ['dung_sai', 4, true], ['dung_sai', 4, true], ['written', 1, false],
        ]);
        expect(matrixPlanSlots([{ ...allocation, count: 2 }])[0].id).toBe(slots[0].id);
        expect(slots.slice(1, 3).map(slot => slot.statementLevels)).toEqual([[1, 1, 1, 2], [1, 1, 2, 2]]);
        expect(matchesMatrixPlanSlot(slots[1], {
            chapterId: allocation.chapterId, energyTopic: 'work',
            item: { type: 'dung_sai', level: 0, statements: [1, 1, 1, 2].map(cognitive_level => ({ cognitive_level })) },
        })).toBe(true);
        expect(matchesMatrixPlanSlot(slots[1], {
            chapterId: allocation.chapterId, energyTopic: 'work',
            item: { type: 'dung_sai', level: 1, statements: [{}, {}, {}] },
        })).toBe(false);
    });

    it('matches the exact mix of true-false levels without requiring their order to match the allocation', () => {
        const [slot] = matrixPlanSlots([
            { ...allocation, type: 'dung_sai', level: 1, count: 1 },
            { ...allocation, type: 'dung_sai', level: 2, count: 2 },
            { ...allocation, type: 'dung_sai', level: 3, count: 1 },
        ]);
        expect(slot).toMatchObject({ level: 0, statementLevels: [1, 2, 2, 3], canChoose: true });
        const candidate = {
            chapterId: allocation.chapterId, energyTopic: 'work' as const,
            item: { type: 'dung_sai' as const, level: 0,
                statements: [2, 1, 3, 2].map(cognitive_level => ({ cognitive_level })) },
        };
        expect(matchesMatrixPlanSlot(slot, candidate)).toBe(true);
        expect(matchesMatrixPlanSlot(slot, { ...candidate, item: { ...candidate.item,
            statements: [1, 1, 2, 3].map(cognitive_level => ({ cognitive_level })) } })).toBe(false);
    });

    it('filters by chapter, content, type and stored level without requiring a YCCĐ or question group', () => {
        const [slot] = matrixPlanSlots([allocation]);
        const candidate = {
            chapterId: allocation.chapterId, energyTopic: 'work' as const,
            item: { type: 'trac_nghiem' as const, level: 1 },
        };
        expect(matchesMatrixPlanSlot(slot, candidate)).toBe(true);
        expect(matchesMatrixPlanSlot(slot, { ...candidate, energyTopic: 'power' })).toBe(false);
        expect(matchesMatrixPlanSlot(slot, { ...candidate, chapterId: 'g10-ch2' })).toBe(false);
        expect(matchesMatrixPlanSlot(slot, { ...candidate, item: { type: 'tu_luan', level: 1 } })).toBe(false);
        expect(matchesMatrixPlanSlot(slot, { ...candidate, item: { type: 'trac_nghiem', level: 2 } })).toBe(false);
        expect(matchesMatrixPlanSlot(slot, { ...candidate, item: { type: 'trac_nghiem' } })).toBe(false);
        const [other] = matrixPlanSlots([{ ...allocation, chapterId: 'g10-ch1', topic: 'Mô tả chuyển động' }]);
        expect(matchesMatrixPlanSlot(other, {
            chapterId: 'g10-ch1', lessonTitle: 'Bài 1.1. Mô tả chuyển động', item: candidate.item,
        })).toBe(true);
    });

    it('keeps an entered YCCĐ, fills a single saved YCCĐ, and waits for a choice when there are several', () => {
        const first = 'Tính công của lực';
        const second = 'Xác định dấu của công';
        expect(plannedOutcome(undefined, undefined, [first])).toBe(first);
        expect(plannedOutcome(undefined, undefined, [])).toBe('');
        expect(plannedOutcome(undefined, undefined, [first, second])).toBe('');
        expect(plannedOutcome(undefined, second, [first, second])).toBe(second);
        expect(plannedOutcome('YCCĐ giáo viên nhập', undefined, [first])).toBe('YCCĐ giáo viên nhập');
        expect(plannedOutcome('', second, [first, second])).toBe('');
    });

    it('keeps the curriculum source while matching each assessed action at the allocated level', () => {
        const goals = energyCurriculumGoals('work');
        const formula = goals.find(goal => goal.id === 'work-expression')!;
        const unit = goals.find(goal => goal.id === 'work-unit')!;
        const calculation = goals.find(goal => goal.id === 'work-calculate')!;
        expect(formula.source).toBe(unit.source);
        expect(calculation.source).toBe(unit.source);
        expect(matchEnergyCurriculumGoal(formula, [formula.label]).score).toBe(1);
        expect(matchEnergyCurriculumGoal(formula, ['Nêu được đơn vị đo công']).score).toBe(0);
        expect(matchEnergyCurriculumGoal(unit, ['Nêu được đơn vị đo công']).score).toBeGreaterThan(0);
        expect(matchEnergyCurriculumGoal(calculation, ['Tính được công của lực kéo']).score).toBeGreaterThan(0);

        const transfer = goals.find(goal => goal.id === 'work-transfer')!;
        const recognized = 'Nhận biết được ví dụ truyền năng lượng bằng cách thực hiện công';
        expect(matchEnergyCurriculumGoal(transfer, [recognized])).toMatchObject({
            score: 0.9, evidence: [{ outcome: recognized, requirement: transfer.label }],
        });
        const [slot] = matrixPlanSlots([{ ...allocation, level: 2 }]);
        const candidates = [1, 2, 3].map(level => ({
            chapterId: allocation.chapterId, energyTopic: 'work' as const,
            item: { type: 'trac_nghiem' as const, level }, outcomes: [recognized],
        }));
        expect(candidates.filter(candidate => matchesMatrixPlanSlot(slot, candidate)
            && matchEnergyCurriculumGoal(transfer, candidate.outcomes).score > 0)).toEqual([candidates[1]]);
        expect(energyCurriculumGoals('other')).toEqual([]);
    });
});
