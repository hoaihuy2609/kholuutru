import type { SelectedQuestionItem } from '../services/examLatexService';
import { questionLevels } from './cognitiveLevels';
import { TRUE_FALSE_POINTS } from './matrixPoints';
import { fitsCounts, matrixPlanSlots, statementCountsLabel, trueFalseCounts, type MatrixAllocation, type MatrixPlanSlot, type StatementCounts } from './matrixPlan';

export const MATRIX_EXPORT_FORMATS = [
    { type: 'trac_nghiem', label: 'Nhiều lựa chọn', part: 'I' },
    { type: 'dung_sai', label: '“Đúng – Sai”', part: 'II' },
    { type: 'tu_luan', label: 'Trả lời ngắn', part: 'III' },
    { type: 'written', label: 'Tự luận', part: 'IV' },
] as const;
export type MatrixExportType = typeof MATRIX_EXPORT_FORMATS[number]['type'];

export interface MatrixExportSettings {
    title: string;
    school: string;
    duration: number;
    assessmentTime: string;
    scope: string;
    examCode: string;
    targetScore: number;
    points: Record<MatrixExportType, number>;
    periods: Record<string, number>;
}

export function defaultMatrixExportSettings(): MatrixExportSettings {
    return { title: 'KIỂM TRA ĐỊNH KÌ - VẬT LÍ 10', school: '', duration: 45,
        assessmentTime: '', scope: '', examCode: '', targetScore: 10,
        points: { trac_nghiem: 0.25, dung_sai: 1, tu_luan: 0.25, written: 1 }, periods: {} };
}

export interface MatrixExportSelection {
    slot: MatrixPlanSlot;
    item: SelectedQuestionItem;
    outcome: string;
    /** All YCCĐ stored on the question, offered when reviewing each true-false statement. */
    outcomeOptions?: readonly string[];
    curriculumSource?: string;
    /** The outcome is the programme requirement row, so it also applies to every true-false statement. */
    fixedOutcome?: boolean;
    /** True-false only: the requirement line of each statement a, b, c, d (empty when the statement has none). */
    statementOutcomes?: readonly string[];
    /** Nội dung câu (JSON physics_solution) để hiện đề bài cạnh bản đặc tả. */
    preview?: () => string;
}

export interface MatrixExportUnit {
    key: string;
    slotId: string;
    questionId: string;
    chapterId: string;
    chapter: string;
    topicId: string;
    topic: string;
    type: MatrixExportType;
    level: number;
    reference: string;
    fullReference: string;
    outcome: string;
    curriculumSource?: string;
    claim?: string;
    points: number;
}

export interface MatrixExportTopic {
    key: string;
    chapterId: string;
    chapter: string;
    topicId: string;
    topic: string;
    periods?: number;
    planned: Record<MatrixExportType, number[]>;
    actual: Record<MatrixExportType, number[]>;
    units: MatrixExportUnit[];
}

export interface MatrixSpecificationRow {
    level: number;
    outcome: string;
    references: Record<MatrixExportType, string[]>;
    /** Các câu/ý thuộc dòng này, theo thứ tự mã câu. */
    units: MatrixExportUnit[];
}

export interface MatrixExportDocument {
    settings: MatrixExportSettings;
    topics: MatrixExportTopic[];
    formats: typeof MATRIX_EXPORT_FORMATS[number][];
    units: MatrixExportUnit[];
    issues: string[];
    invalidSettings: boolean;
    questionCount: number;
    unitCount: number;
    totalScore: number;
    levelCounts: number[];
    levelScores: number[];
    typeQuestionCounts: Record<MatrixExportType, number>;
}

const emptyCounts = (): Record<MatrixExportType, number[]> => ({
    trac_nghiem: [0, 0, 0, 0], dung_sai: [0, 0, 0, 0], tu_luan: [0, 0, 0, 0], written: [0, 0, 0, 0],
});
export const matrixExportTopicKey = (chapterId: string, topicId: string) => chapterId + ':' + topicId;
const round = (value: number) => Math.round((value + Number.EPSILON) * 10000) / 10000;

/** One assessed unit has exactly one row assignment. Grouping never adds to the totals twice. */
export function matrixSpecificationRows(units: MatrixExportUnit[]): MatrixSpecificationRow[] {
    const rows = new Map<string, MatrixSpecificationRow>();
    for (const unit of units) {
        // Preserve mathematical symbols: A > 0 and A < 0 must remain different requirements.
        const key = unit.level + ':' + unit.outcome.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi');
        const row = rows.get(key) ?? { level: unit.level, outcome: unit.outcome,
            references: { trac_nghiem: [], dung_sai: [], tu_luan: [], written: [] }, units: [] };
        row.references[unit.type].push(unit.reference);
        row.units.push(unit);
        rows.set(key, row);
    }
    return [...rows.values()].sort((a, b) => a.level - b.level);
}

export function buildMatrixExport(allocations: MatrixAllocation[], selections: MatrixExportSelection[],
    settings: MatrixExportSettings, outcomes: Record<string, string> = {}): MatrixExportDocument {
    const issues: string[] = [];
    const topics = new Map<string, MatrixExportTopic>();
    let invalidSettings = false;
    if (!settings.title.trim() || !Number.isInteger(settings.duration) || settings.duration <= 0
        || !Number.isFinite(settings.targetScore) || settings.targetScore <= 0) {
        invalidSettings = true;
        issues.push('Nhập tên bài kiểm tra, thời gian nguyên dương và tổng điểm lớn hơn 0.');
    }
    const validAllocations = allocations.filter(row => {
        const valid = Number.isInteger(row.count) && row.count > 0 && row.count <= 99
            && (row.points === undefined || (Number.isFinite(row.points) && row.points > 0))
            && ([1, 2, 3].includes(row.level) || (row.type === 'dung_sai' && row.level === 0)) && MATRIX_EXPORT_FORMATS.some(format => format.type === row.type);
        if (!valid) issues.push('Phân bổ không hợp lệ: ' + row.topic + '.');
        return valid;
    });
    for (const row of validAllocations) {
        const key = matrixExportTopicKey(row.chapterId, row.topicId);
        const topic = topics.get(key) ?? { key, chapterId: row.chapterId, chapter: row.chapter,
            topicId: row.topicId, topic: row.topic, periods: settings.periods[key],
            planned: emptyCounts(), actual: emptyCounts(), units: [] };
        topic.planned[row.type][row.level] += row.count;
        topics.set(key, topic);
    }
    const formats = MATRIX_EXPORT_FORMATS.filter(format => validAllocations.some(row => row.type === format.type));
    if (!formats.length) issues.push('Chưa có phân bổ câu hỏi.');
    for (const format of formats) {
        if (!Number.isFinite(settings.points[format.type]) || settings.points[format.type] <= 0) {
            invalidSettings = true;
            issues.push('Điểm mỗi câu ' + format.label + ' phải lớn hơn 0.');
        }
    }
    for (const topic of topics.values()) {
        if (topic.periods !== undefined && (!Number.isInteger(topic.periods) || topic.periods < 0 || topic.periods > 999)) {
            invalidSettings = true;
            issues.push('Số tiết không hợp lệ: ' + topic.topic + '.');
        }
    }
    const slots = matrixPlanSlots(validAllocations);
    const selectionMap = new Map(selections.map(selection => [selection.slot.id, selection]));
    const seen = new Set<string>();
    const numbers = { trac_nghiem: 0, dung_sai: 0, tu_luan: 0, written: 0 };
    const typeQuestionCounts = { ...numbers };
    const units: MatrixExportUnit[] = [];
    for (const slot of slots) {
        if (slot.type === 'written') {
            issues.push(slot.topic + ': tự luận chưa có câu trong kho để chốt bản xuất.');
            continue;
        }
        if (!slot.canChoose) {
            issues.push(slot.topic + ': dư ' + slot.units + ' ý Đúng/Sai, tổng số ý Đúng/Sai của nội dung phải chia hết cho 4.');
            continue;
        }
        const number = ++numbers[slot.type];
        const format = MATRIX_EXPORT_FORMATS.find(format => format.type === slot.type)!;
        const fullReference = 'Phần ' + format.part + ' - C' + number;
        const selection = selectionMap.get(slot.id);
        if (!selection) { issues.push(fullReference + ': chưa chọn câu.'); continue; }
        const { item } = selection;
        const levels = questionLevels(item);
        const counts = slot.type === 'dung_sai' ? trueFalseCounts(item) : undefined;
        if (item.type !== slot.type || (slot.type === 'dung_sai'
            ? !counts || (!!slot.statementBudget && !fitsCounts(slot.statementBudget, counts))
            : levels[0] !== slot.level)) {
            issues.push(fullReference + ': câu đã chọn không còn đúng loại hoặc mức độ phân bổ.');
            continue;
        }
        if (seen.has(item.id)) { issues.push(fullReference + ': câu bị chọn trùng.'); continue; }
        seen.add(item.id);
        typeQuestionCounts[slot.type]++;
        const topic = topics.get(matrixExportTopicKey(slot.chapterId, slot.topicId))!;
        for (const [index, level] of levels.entries()) {
            const suffix = slot.type === 'dung_sai' ? String.fromCharCode(97 + index) : '';
            const key = slot.id + '|' + item.id + '|' + index;
            // A question-level outcome does not establish what each true-false statement assesses.
            const outcome = (outcomes[key] ?? selection.statementOutcomes?.[index]
                ?? (slot.type === 'dung_sai' && !selection.fixedOutcome ? '' : selection.outcome)).trim();
            // Điểm mỗi câu đặt trên ma trận cho từng ô; Đúng/Sai luôn 1 điểm theo quy định.
            const questionScore = slot.type === 'dung_sai' ? TRUE_FALSE_POINTS : slot.points ?? settings.points[slot.type];
            const rawPoints = questionScore / levels.length;
            const unit: MatrixExportUnit = { key, slotId: slot.id, questionId: item.id,
                chapterId: slot.chapterId, chapter: slot.chapter, topicId: slot.topicId, topic: slot.topic,
                type: slot.type, level, reference: 'C' + number + suffix, fullReference: fullReference + suffix,
                outcome, curriculumSource: selection.curriculumSource,
                claim: item.statements?.[index]?.claim,
                points: Number.isFinite(rawPoints) && rawPoints > 0 ? rawPoints : 0 };
            if (!outcome) issues.push(unit.fullReference + ': chưa xác định YCCĐ cụ thể.');
            topic.actual[slot.type][level]++;
            topic.units.push(unit);
            units.push(unit);
        }
    }
    // True-false questions take any mix of levels; together they must match the content's statements per level.
    for (const topic of topics.values()) {
        const planned = [1, 2, 3].map(level => topic.planned.dung_sai[level]) as unknown as StatementCounts;
        const actual = [1, 2, 3].map(level => topic.actual.dung_sai[level]) as unknown as StatementCounts;
        const total = planned[0] + planned[1] + planned[2];
        const chosen = actual[0] + actual[1] + actual[2];
        if (total && total % 4 === 0 && chosen === total && planned.some((value, index) => value !== actual[index])) {
            issues.push(topic.topic + ': các câu Đúng/Sai đã chọn gồm ' + statementCountsLabel(actual)
                + ', ma trận cần ' + statementCountsLabel(planned) + '.');
        }
    }
    const levelCounts = [0, 0, 0, 0];
    const levelScores = [0, 0, 0, 0];
    for (const unit of units) { levelCounts[unit.level]++; levelScores[unit.level] += unit.points; }
    const totalScore = round(units.reduce((sum, unit) => sum + unit.points, 0));
    if (Number.isFinite(settings.targetScore) && Math.abs(totalScore - settings.targetScore) > 0.0001) {
        const comma = (value: number) => String(value).replace('.', ',');
        issues.push('Tổng điểm câu đã chọn là ' + comma(totalScore) + ', chưa bằng thang điểm ' + comma(settings.targetScore) + '.');
    }
    // Match all allocation cells, rather than only the total number of selected questions. True-false entered as whole
    // questions (planned at level 0) matches by question count; its statements take the levels of the chosen questions.
    const mismatch = [...topics.values()].some(topic => formats.some(({ type }) => type === 'dung_sai' && topic.planned.dung_sai[0]
        ? topic.planned.dung_sai[0] * 4 !== [1, 2, 3].reduce((sum, level) => sum + topic.actual.dung_sai[level], 0)
        : [1, 2, 3].some(level => topic.planned[type][level] !== topic.actual[type][level])));
    if (mismatch && !issues.length) issues.push('Câu đã chọn chưa khớp toàn bộ phân bổ ma trận.');
    return { settings, topics: [...topics.values()], formats, units, issues: [...new Set(issues)], invalidSettings,
        questionCount: seen.size, unitCount: units.length, totalScore, levelCounts,
        levelScores: levelScores.map(round), typeQuestionCounts };
}
