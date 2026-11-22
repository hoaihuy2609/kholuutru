import { describe, expect, it } from 'vitest';
import { buildMatrixExport, defaultMatrixExportSettings, matrixSpecificationRows, type MatrixExportSelection } from '../utils/matrixExport';
import { matrixExportHtml } from '../utils/matrixExportPrint';
import { matrixPlanSlots, type MatrixAllocation } from '../utils/matrixPlan';

const allocation: MatrixAllocation = { chapterId: 'g10-ch3', chapter: 'Công, năng lượng, công suất',
    topicId: 'work', topic: 'Công và năng lượng', type: 'trac_nghiem', level: 1, count: 2 };
const makeSelections = (allocations: MatrixAllocation[]): MatrixExportSelection[] => matrixPlanSlots(allocations)
    .filter(slot => slot.canChoose).map((slot, index) => ({ slot, outcome: 'Nêu được đơn vị đo công.', item: {
        id: 'question-' + index, questionNo: 'Câu ' + (90 + index), qText: 'Đề',
        type: slot.type as 'trac_nghiem' | 'dung_sai' | 'tu_luan', level: slot.level,
        ...(slot.type === 'dung_sai' ? { statements: [2, 1, 3, 1].map((level, index) => ({
            label: String.fromCharCode(97 + index), claim: 'Mệnh đề ' + index, cognitive_level: level,
        })) } : {}),
    } }));

describe('matrix and specification export', () => {
    it('scores the national physics paper structure 18 + 4 + 6 at 10 points by default', () => {
        const { points } = defaultMatrixExportSettings();
        expect(18 * points.trac_nghiem + 4 * points.dung_sai + 6 * points.tu_luan).toBe(10);
    });

    it('groups shared outcomes, counts every question once and assigns new per-section references', () => {
        const allocations = [allocation, { ...allocation, type: 'tu_luan' as const, count: 1 }];
        const settings = { ...defaultMatrixExportSettings(), targetScore: 0.75 };
        const selections = makeSelections(allocations);
        const result = buildMatrixExport(allocations, selections, settings);
        expect(result.issues).toEqual([]);
        expect(result).toMatchObject({ questionCount: 3, unitCount: 3, totalScore: 0.75, levelCounts: [0, 3, 0, 0] });
        const rows = matrixSpecificationRows(result.units);
        expect(rows).toHaveLength(1);
        expect(rows[0].references).toEqual({ trac_nghiem: ['C1', 'C2'], dung_sai: [], tu_luan: ['C1'], written: [] });
        expect(result.units.map(unit => unit.fullReference)).toEqual(['Phần I - C1', 'Phần I - C2', 'Phần III - C1']);
        expect(selections[0].item.questionNo).toBe('Câu 90');
    });

    it('scores each question with the points of its matrix cell and true-false at 1 point', () => {
        const allocations = [{ ...allocation, count: 2, points: 0.75 }, { ...allocation, type: 'dung_sai' as const, level: 0, count: 1, points: 3 }];
        const selections = makeSelections(allocations);
        const settings = { ...defaultMatrixExportSettings(), targetScore: 2.5 };
        const result = buildMatrixExport(allocations, selections, settings);
        expect(result.totalScore).toBe(2.5);
        expect(result.issues.some(issue => issue.includes('Tổng điểm'))).toBe(false);
        expect(buildMatrixExport([{ ...allocation, points: 0 }], [], settings).issues).toContain('Phân bổ không hợp lệ: Công và năng lượng.');
    });

    it('takes true-false entered as whole questions and counts their statements at their own levels', () => {
        const allocations = [{ ...allocation, type: 'dung_sai' as const, level: 0, count: 2 }];
        const slots = matrixPlanSlots(allocations);
        expect(slots.map(slot => [slot.type, slot.canChoose, slot.statementBudget])).toEqual([['dung_sai', true, undefined], ['dung_sai', true, undefined]]);
        const selections = makeSelections(allocations).map(selection => ({ ...selection, statementOutcomes: ['A', 'B', 'C', 'D'] }));
        const result = buildMatrixExport(allocations, selections, { ...defaultMatrixExportSettings(), targetScore: 2 });
        expect(result.issues).toEqual([]);
        expect(result.topics[0].actual.dung_sai).toEqual([0, 4, 2, 2]);
        expect(result.units.map(unit => unit.outcome).slice(0, 4)).toEqual(['A', 'B', 'C', 'D']);
        const short = buildMatrixExport(allocations, selections.slice(0, 1), { ...defaultMatrixExportSettings(), targetScore: 1 });
        expect(short.issues).toContain('Phần II - C2: chưa chọn câu.');
    });

    it('uses the actual statement order for mixed levels and requires a separate reviewed outcome for every statement', () => {
        const allocations = [
            { ...allocation, type: 'dung_sai' as const, level: 1, count: 2 },
            { ...allocation, type: 'dung_sai' as const, level: 2, count: 1 },
            { ...allocation, type: 'dung_sai' as const, level: 3, count: 1 },
        ];
        const selections = makeSelections(allocations);
        const settings = { ...defaultMatrixExportSettings(), targetScore: 1 };
        const draft = buildMatrixExport(allocations, selections, settings);
        expect(draft.units.map(unit => [unit.reference, unit.level, unit.outcome])).toEqual([
            ['C1a', 2, ''], ['C1b', 1, ''], ['C1c', 3, ''], ['C1d', 1, ''],
        ]);
        expect(draft.issues).toHaveLength(4);
        const outcomes = Object.fromEntries(draft.units.map(unit => [unit.key, 'Yêu cầu của mức ' + unit.level]));
        const result = buildMatrixExport(allocations, selections, settings, outcomes);
        expect(result.issues).toEqual([]);
        expect(result).toMatchObject({ questionCount: 1, unitCount: 4, totalScore: 1, levelScores: [0, 0.5, 0.25, 0.25] });
        expect(matrixSpecificationRows(result.units)[0].references.dung_sai).toEqual(['C1b', 'C1d']);
        expect(result.topics[0].actual.dung_sai).toEqual([0, 2, 1, 1]);
    });

    it('does not silently finalize missing selections, incomplete true-false groups or unsupported essay allocations', () => {
        const allocations = [allocation, { ...allocation, type: 'dung_sai' as const, count: 3 },
            { ...allocation, type: 'written' as const, count: 1 }];
        const result = buildMatrixExport(allocations, [], defaultMatrixExportSettings());
        expect(result.issues.join(' ')).toContain('Phần I - C1: chưa chọn câu');
        expect(result.issues.join(' ')).toContain('3 ý Đúng/Sai');
        expect(result.issues.join(' ')).toContain('tự luận');
        expect(result.questionCount).toBe(0);
        expect(result.totalScore).toBe(0);
    });

    it('rejects changed levels and duplicate questions, and never reuses edits for a replacement question', () => {
        const selections = makeSelections([allocation]);
        const settings = { ...defaultMatrixExportSettings(), targetScore: 0.5 };
        const original = buildMatrixExport([allocation], selections, settings);
        const outcomes = { [original.units[0].key]: 'YCCĐ riêng đã sửa' };
        const replacement = buildMatrixExport([allocation], [{ ...selections[0], item: { ...selections[0].item, id: 'replacement' } }, selections[1]], settings, outcomes);
        expect(replacement.units[0].outcome).toBe(selections[0].outcome);
        const duplicate = buildMatrixExport([allocation], [selections[0], { ...selections[1], item: selections[0].item }], settings);
        expect(duplicate.issues.join(' ')).toContain('trùng');
        expect(duplicate.questionCount).toBe(1);
        const changed = buildMatrixExport([allocation], [{ ...selections[0], item: { ...selections[0].item, level: 2 } }, selections[1]], settings);
        expect(changed.issues.join(' ')).toContain('không còn đúng loại hoặc mức độ');
    });

    it('validates points, periods and score target without rewriting question data', () => {
        const selections = makeSelections([allocation]);
        const before = JSON.stringify(selections);
        const settings = defaultMatrixExportSettings();
        settings.points.trac_nghiem = NaN;
        settings.periods['g10-ch3:work'] = -1;
        const result = buildMatrixExport([allocation], selections, settings);
        expect(result.invalidSettings).toBe(true);
        expect(result.issues.join(' ')).toContain('Số tiết không hợp lệ');
        expect(result.issues.join(' ')).toContain('Điểm mỗi câu');
        expect(JSON.stringify(selections)).toBe(before);
    });

    it('keeps distinct mathematical requirements separate and escapes user content in the print document', () => {
        const selections = makeSelections([allocation]);
        selections[0].outcome = 'Xác định A > 0';
        selections[1].outcome = 'Xác định A < 0';
        const settings = { ...defaultMatrixExportSettings(), title: '<script>alert(1)</script>', targetScore: 0.5 };
        const result = buildMatrixExport([allocation], selections, settings);
        expect(matrixSpecificationRows(result.units)).toHaveLength(2);
        const html = matrixExportHtml(result);
        expect(html).not.toContain('<script>');
        expect(html).toContain('&lt;script&gt;');
        expect(html).toContain('A &gt; 0');
        expect(html).toContain('A &lt; 0');
        expect(html).toContain('A4 landscape');
        expect(html).toContain('table-header-group');
        expect(html).toContain('rowspan="2"');
        // A content keeps one frame: the second row of the same content leaves its number and name cells empty.
        expect(html).toContain('<td class="merged"></td>');
        expect(html).not.toContain('(tiếp)');
        expect(matrixExportHtml(result, true)).toContain('BẢN NHÁP');
        expect(html).not.toContain('BẢN NHÁP');
    });

    it('splits one question into its own requirement row when its outcome is typed differently, and merges it back on equal text', () => {
        const selections = makeSelections([allocation]);
        const settings = { ...defaultMatrixExportSettings(), targetScore: 0.5 };
        const shared = buildMatrixExport([allocation], selections, settings);
        expect(matrixSpecificationRows(shared.units)).toHaveLength(1);
        const second = shared.units[1].key;
        const split = buildMatrixExport([allocation], selections, settings, { [second]: 'Yêu cầu riêng của câu 2' });
        const rows = matrixSpecificationRows(split.units);
        expect(rows.map(row => row.references.trac_nghiem)).toEqual([['C1'], ['C2']]);
        expect(rows[1].units.map(unit => unit.key)).toEqual([second]);
        const merged = buildMatrixExport([allocation], selections, settings, { [second]: 'Nêu được đơn vị đo công.' });
        expect(matrixSpecificationRows(merged.units)).toHaveLength(1);
        // Only the on-screen review is editable; the printed document is plain.
        const editable = matrixExportHtml(split, false, { editable: true, edited: new Set([second]) });
        expect(editable).toContain('contenteditable="true"');
        expect(editable).toContain('class="edited"');
        expect(editable).toContain('data-question="question-1"');
        expect(matrixExportHtml(split)).not.toContain('contenteditable');
    });

    it('accepts true-false questions with different level mixes when together they match the content', () => {
        const allocations = [
            { ...allocation, type: 'dung_sai' as const, level: 2, count: 6 },
            { ...allocation, type: 'dung_sai' as const, level: 3, count: 2 },
        ];
        const settings = { ...defaultMatrixExportSettings(), targetScore: 2 };
        const build = (mixes: number[][]) => {
            const slots = matrixPlanSlots(allocations).filter(slot => slot.canChoose);
            const selections = slots.map((slot, index): MatrixExportSelection => ({ slot, outcome: 'YCCĐ', item: {
                id: 'tf-' + index, questionNo: 'Câu ' + index, qText: 'Đề', type: 'dung_sai', level: 0,
                statements: mixes[index].map((level, statement) => ({ label: 'abcd'[statement], claim: 'Ý', cognitive_level: level })),
            } }));
            const outcomes = Object.fromEntries(slots.flatMap((slot, index) => [0, 1, 2, 3].map(statement =>
                [slot.id + '|tf-' + index + '|' + statement, 'YCCĐ ý'])));
            return buildMatrixExport(allocations, selections, settings, outcomes);
        };
        expect(build([[2, 2, 2, 2], [2, 2, 3, 3]]).issues).toEqual([]);
        expect(build([[2, 2, 2, 3], [3, 2, 2, 2]]).issues).toEqual([]);
        expect(build([[2, 2, 2, 2], [2, 2, 2, 2]]).issues).toEqual(
            ['Công và năng lượng: các câu Đúng/Sai đã chọn gồm 8 Thông hiểu, ma trận cần 6 Thông hiểu · 2 Vận dụng.']);
        expect(build([[2, 2, 2, 2], [1, 2, 2, 2]]).issues.join(' ')).toContain('không còn đúng loại hoặc mức độ');
        expect(build([[2, 2, 3, 3], [2, 2, 3, 2]]).issues).toEqual(
            ['Công và năng lượng: các câu Đúng/Sai đã chọn gồm 5 Thông hiểu · 3 Vận dụng, ma trận cần 6 Thông hiểu · 2 Vận dụng.']);
    });
});
