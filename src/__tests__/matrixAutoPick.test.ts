import { describe, expect, it } from 'vitest';
import { autoPickMatrixPlan } from '../utils/matrixAutoPick';
import { matrixPlanSlots, type MatrixAllocation } from '../utils/matrixPlan';

const transfer = 'Nêu được ví dụ về sự truyền năng lượng bằng cách thực hiện công';
const unit = 'Nêu được đơn vị đo công';
const candidate = (id: string, outcome: string, level = 1, type: 'trac_nghiem' | 'tu_luan' = 'trac_nghiem') => ({
    item: { id, type, level }, chapterId: 'g10-ch3', energyTopic: 'work' as const, topic: 'Công', outcomes: [outcome],
});
const allocation = (count: number, level = 1): MatrixAllocation => ({
    chapterId: 'g10-ch3', chapter: 'Chương III', topicId: 'work', topic: 'Công và năng lượng', type: 'trac_nghiem', level, count,
});

describe('autoPickMatrixPlan', () => {
    const pool = [candidate('a1', transfer), candidate('a2', transfer), candidate('b1', unit), candidate('b2', unit),
        candidate('hard', unit, 3), candidate('essay', unit, 1, 'tu_luan')];

    it('fills every slot with distinct questions of the right level and format', () => {
        const slots = matrixPlanSlots([allocation(4)]);
        const { picks, unfilled } = autoPickMatrixPlan(slots, pool, { rng: () => 0.3 });
        expect(unfilled).toEqual([]);
        const ids = [...picks.values()].map(pick => pick.questionId);
        expect(new Set(ids).size).toBe(4);
        expect(ids.sort()).toEqual(['a1', 'a2', 'b1', 'b2']);
    });

    it('spreads picks over different curriculum goals', () => {
        const slots = matrixPlanSlots([allocation(2)]);
        for (const value of [0, 0.5, 0.99]) {
            const { picks } = autoPickMatrixPlan(slots, pool, { rng: () => value });
            expect(new Set([...picks.values()].map(pick => pick.curriculumId)).size).toBe(2);
        }
    });

    it('skips used questions and reports slots with no valid question', () => {
        const slots = matrixPlanSlots([allocation(3)]);
        const { picks, unfilled } = autoPickMatrixPlan(slots, pool, { used: ['a1', 'a2', 'b1'] });
        expect([...picks.values()].map(pick => pick.questionId)).toEqual(['b2']);
        expect(unfilled).toHaveLength(2);
    });

    it('re-rolls to a different question when one exists and honours a preferred goal', () => {
        const [slot] = matrixPlanSlots([allocation(1)]);
        const again = autoPickMatrixPlan([slot], pool, { avoid: ['a1'], preferredGoal: new Map([[slot.id, 'work-transfer']]), rng: () => 0 });
        expect(again.picks.get(slot.id)).toMatchObject({ questionId: 'a2', curriculumId: 'work-transfer' });
        const only = autoPickMatrixPlan([slot], [candidate('only', unit)], { avoid: ['only'] });
        expect(only.picks.get(slot.id)?.questionId).toBe('only');
    });

    it('respects an extra per-slot condition such as the chosen lesson', () => {
        const slots = matrixPlanSlots([allocation(2)]);
        const { picks, unfilled } = autoPickMatrixPlan(slots, pool, { accepts: (_, candidate) => candidate.item.id.startsWith('b') });
        expect([...picks.values()].map(pick => pick.questionId).sort()).toEqual(['b1', 'b2']);
        expect(unfilled).toEqual([]);
    });

    it('combines true-false questions whose statement levels add up to the content total', () => {
        const trueFalse = (id: string, levels: number[]) => ({ item: { id, type: 'dung_sai' as const, level: 0,
            statements: levels.map(cognitive_level => ({ cognitive_level })) }, chapterId: 'g10-ch3', energyTopic: 'work' as const,
            topic: 'Công', outcomes: [] as string[] });
        const bank = [trueFalse('mixed', [1, 1, 2, 2]), trueFalse('easy', [1, 1, 1, 1]), trueFalse('th', [2, 2, 2, 2]),
            trueFalse('hard', [3, 3, 3, 3]), trueFalse('thvd', [2, 2, 3, 3])];
        const slots = matrixPlanSlots([
            { ...allocation(0), type: 'dung_sai', level: 2, count: 6 },
            { ...allocation(0), type: 'dung_sai', level: 3, count: 2 },
        ]);
        for (const value of [0, 0.4, 0.99]) {
            const { picks, unfilled } = autoPickMatrixPlan(slots, bank, { rng: () => value });
            expect(unfilled).toEqual([]);
            expect([...picks.values()].map(pick => pick.questionId).sort()).toEqual(['th', 'thvd']);
        }
        // Nothing in the bank adds up to 2 NB + 2 VD.
        const none = matrixPlanSlots([{ ...allocation(0), type: 'dung_sai', level: 1, count: 2 }, { ...allocation(0), type: 'dung_sai', level: 3, count: 2 }]);
        expect(autoPickMatrixPlan(none, bank).unfilled).toHaveLength(1);
        // Re-rolling one question keeps what the other chosen question already uses.
        const [first] = slots;
        const again = autoPickMatrixPlan([first], [...bank, trueFalse('thvd2', [3, 2, 3, 2])],
            { used: ['th'], reservedStatements: new Map([['g10-ch3:work', [0, 4, 0]]]), avoid: ['thvd'] });
        expect(again.picks.get(first.id)?.questionId).toBe('thvd2');
    });
});
