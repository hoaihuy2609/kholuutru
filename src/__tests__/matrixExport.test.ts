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
    it('groups shared outcomes, counts every question once and assigns new per-section references', () => {
        const allocations = [allocation, { ...allocation, type: 'tu_luan' as const, count: 1 }];
        const settings = { ...defaultMatrixExportSettings(), targetScore: 1 };
        const selections = makeSelections(allocations);
        const result = buildMatrixExport(allocations, selections, settings);
        expect(result.issues).toEqual([]);
        expect(result).toMatchObject({ questionCount: 3, unitCount: 3, totalScore: 1, levelCounts: [0, 3, 0, 0] });
        const rows = matrixSpecificationRows(result.units);
        expect(rows).toHaveLength(1);
        expect(rows[0].references).toEqual({ trac_nghiem: ['C1', 'C2'], dung_sai: [], tu_luan: ['C1'], written: [] });
        expect(result.units.map(unit => unit.fullReference)).toEqual(['Phần I - C1', 'Phần I - C2', 'Phần III - C1']);
        expect(selections[0].item.questionNo).toBe('Câu 90');
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
        expect(matrixExportHtml(result, true)).toContain('BẢN NHÁP');
        expect(html).not.toContain('BẢN NHÁP');
    });
});
