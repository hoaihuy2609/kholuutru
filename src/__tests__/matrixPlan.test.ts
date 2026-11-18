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

    it('suggests standardized formula and unit questions while preserving the independent level filter', () => {
        const goals = energyCurriculumGoals('work');
        const formula = goals.find(goal => goal.id === 'work-expression')!;
        const unit = goals.find(goal => goal.id === 'work-unit')!;
        const transfer = goals.find(goal => goal.id === 'work-transfer')!;
        const formulaOutcome = 'Nhận biết được biểu thức công của lực không đổi và sự phụ thuộc của công vào lực, độ dịch chuyển, góc giữa chúng.';
        const unitOutcome = 'Nhận biết được đơn vị đo công và năng lượng, thực hiện được phép đổi đơn vị tương ứng.';
        const transferOutcome = 'Xác định được tình huống truyền năng lượng giữa các vật thông qua thực hiện công.';
        const candidates = [
            { chapterId: allocation.chapterId, energyTopic: 'work' as const,
                item: { type: 'trac_nghiem' as const, level: 1 }, outcomes: [formulaOutcome] },
            { chapterId: allocation.chapterId, energyTopic: 'work' as const,
                item: { type: 'trac_nghiem' as const, level: 1 }, outcomes: [unitOutcome] },
            { chapterId: allocation.chapterId, energyTopic: 'work' as const,
                item: { type: 'trac_nghiem' as const, level: 2 }, outcomes: [transferOutcome] },
        ];
        const [slot] = matrixPlanSlots([allocation]);
        const count = (goal: typeof formula, target = slot) => candidates.filter(candidate =>
            matchesMatrixPlanSlot(target, candidate) && matchEnergyCurriculumGoal(goal, candidate.outcomes).score > 0).length;
        expect(count(formula)).toBe(1);
        expect(count(unit)).toBe(1);
        expect(count(transfer)).toBe(0);
        const [understanding] = matrixPlanSlots([{ ...allocation, level: 2 }]);
        expect(count(transfer, understanding)).toBe(1);
        expect(matchEnergyCurriculumGoal(formula, [unitOutcome]).score).toBe(0);
        expect(matchEnergyCurriculumGoal(unit, [formulaOutcome]).score).toBe(0);
        expect(matchEnergyCurriculumGoal(formula, [formulaOutcome]).evidence).toEqual([{
            rowIndex: 0, lineIndex: 0, requirement: formula.label, outcome: formulaOutcome, score: 0.9,
        }]);
    });

    it('links standardized outcomes in the other two topics without equating conceptual questions with constructing or deriving', () => {
        const cases: [string, string, string][] = [
            ['mechanical-energy', 'potential-expression', 'Nhận biết được khái niệm và biểu thức thế năng trọng trường trong trọng trường đều.'],
            ['mechanical-energy', 'potential-apply', 'Tính được thế năng trọng trường hoặc đại lượng liên quan bằng biểu thức Wt = mgh.'],
            ['mechanical-energy', 'energy-conversion', 'Phân tích được sự chuyển hóa giữa động năng và thế năng, xác định vị trí các dạng năng lượng đạt cực trị.'],
            ['mechanical-energy', 'mechanical-definition', 'Nhận biết được cơ năng là tổng động năng và thế năng của vật.'],
            ['mechanical-energy', 'mechanical-law', 'Xác định được điều kiện và nội dung của định luật bảo toàn cơ năng.'],
            ['mechanical-energy', 'mechanical-apply', 'Vận dụng bảo toàn cơ năng cho con lắc đơn để xác định tốc độ, độ cao, góc lệch hoặc năng lượng.'],
            ['power', 'power-meaning', 'Nhận biết được ý nghĩa vật lí, định nghĩa và biểu thức công suất trung bình.'],
            ['power', 'power-definition', 'Nhận biết được ý nghĩa vật lí, định nghĩa và biểu thức công suất trung bình.'],
            ['power', 'power-force-velocity', 'Vận dụng mối liên hệ giữa công suất, lực và vận tốc để giải bài toán chuyển động trong tình huống thực tế.'],
            ['power', 'efficiency-definition', 'Nhận biết được ý nghĩa, biểu thức và giới hạn giá trị của hiệu suất.'],
            ['power', 'efficiency-apply', 'Vận dụng được hiệu suất để xác định phần có ích, phần hao phí, hiệu suất hoặc đại lượng liên quan trong tình huống cụ thể.'],
        ];
        for (const [topic, id, outcome] of cases) {
            const goal = energyCurriculumGoals(topic).find(goal => goal.id === id)!;
            expect(matchEnergyCurriculumGoal(goal, [outcome]).score).toBe(0.9);
        }
        const model = energyCurriculumGoals('work').find(goal => goal.id === 'energy-model')!;
        expect(matchEnergyCurriculumGoal(model, [
            'Vận dụng được nguyên lí bảo toàn năng lượng để nhận xét sự chuyển hóa, truyền và phân tán năng lượng.',
            'Xác định được các dạng năng lượng chuyển hóa trong một hiện tượng hoặc thiết bị cụ thể.',
        ]).score).toBe(0);
        const derive = energyCurriculumGoals('mechanical-energy').find(goal => goal.id === 'work-kinetic')!;
        expect(matchEnergyCurriculumGoal(derive, [
            'Nhận biết được mối liên hệ giữa độ biến thiên động năng và tổng công của các lực tác dụng lên vật.',
        ]).score).toBe(0);
        const kinetic = energyCurriculumGoals('mechanical-energy').find(goal => goal.id === 'kinetic-apply')!;
        expect(matchEnergyCurriculumGoal(kinetic, [
            'Nhận biết được mối liên hệ giữa độ biến thiên động năng và tổng công của các lực tác dụng lên vật.',
        ]).score).toBe(0.9);
    });
});
