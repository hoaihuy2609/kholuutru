import type { SelectedQuestionItem } from '../services/examLatexService';
import { programmeRow, programmeRowLabel, programmeRows, type ProgrammeMatch, type ProgrammeRow } from '../data/programmeRows';
import { COGNITIVE_LEVELS, questionLevels, readCognitiveLevel } from './cognitiveLevels';
import { matrixPlanSlots, statementCountsLabel, trueFalseCounts, type MatrixAllocation, type StatementCounts } from './matrixPlan';
import type { MatrixExportSelection } from './matrixExport';

/**
 * Bản đặc tả theo YCCĐ chương trình: mỗi nội dung của ma trận có các dòng YCCĐ cố định (programmeRows).
 * Giáo viên chia số câu trắc nghiệm, trả lời ngắn của từng mức vào các dòng, rồi chọn câu đã được rót vào đúng dòng.
 * Câu Đúng/Sai được chọn nguyên câu theo dòng; các ý của chúng cộng lại phải đúng số ý từng mức của nội dung.
 */

export type ProgrammeCellType = 'trac_nghiem' | 'tu_luan';
export type ProgrammeType = ProgrammeCellType | 'dung_sai';
export const PROGRAMME_CELL_TYPES: readonly ProgrammeCellType[] = ['trac_nghiem', 'tu_luan'];
export const PROGRAMME_TYPE_LABELS: Record<ProgrammeType | 'written', string> = {
    trac_nghiem: 'Nhiều lựa chọn', dung_sai: 'Đúng/Sai', tu_luan: 'Trả lời ngắn', written: 'Tự luận',
};
const LEVELS = [1, 2, 3] as const;
type LevelCounts = [number, number, number];

export interface ProgrammeCandidate {
    item: SelectedQuestionItem;
    chapterId?: string;
    grade?: number;
    programmeRow?: string;
    programmeMatch?: ProgrammeMatch;
}

export interface ProgrammeTopic {
    key: string;
    chapterId: string;
    chapter: string;
    topicId: string;
    topic: string;
    rows: readonly ProgrammeRow[];
    /** Câu (trắc nghiệm, trả lời ngắn, tự luận) hoặc ý (Đúng/Sai) mà ma trận cần ở mức 1, 2, 3. */
    need: Record<ProgrammeType | 'written', LevelCounts>;
}

export interface ProgrammeState {
    /** Số câu giáo viên chia vào từng ô (dòng × dạng × mức), chỉ cho trắc nghiệm và trả lời ngắn. */
    counts: Record<string, number>;
    /** Câu đã chọn trong từng ô. */
    picks: Record<string, string[]>;
    /** Câu Đúng/Sai đã chọn của từng dòng. */
    trueFalse: Record<string, string[]>;
}

export const emptyProgrammeState = (): ProgrammeState => ({ counts: {}, picks: {}, trueFalse: {} });
export const programmeCellKey = (rowId: string, type: ProgrammeCellType, level: number) => rowId + '|' + type + '|' + level;
const zero = (): LevelCounts => [0, 0, 0];

/** Nội dung của ma trận kèm các dòng YCCĐ; undefined khi có nội dung chưa có dòng YCCĐ (dùng bản đặc tả cũ). */
export function programmeTopics(allocations: readonly MatrixAllocation[]): ProgrammeTopic[] | undefined {
    const topics = new Map<string, ProgrammeTopic>();
    for (const allocation of allocations) {
        const key = allocation.chapterId + ':' + allocation.topicId;
        let topic = topics.get(key);
        if (!topic) {
            const rows = programmeRows(allocation.chapterId).filter(row => row.topicId === allocation.topicId);
            if (!rows.length) return undefined;
            topic = { key, chapterId: allocation.chapterId, chapter: allocation.chapter, topicId: allocation.topicId,
                topic: allocation.topic, rows, need: { trac_nghiem: zero(), dung_sai: zero(), tu_luan: zero(), written: zero() } };
            topics.set(key, topic);
        }
        const level = readCognitiveLevel(allocation.level);
        if (level) topic.need[allocation.type][level - 1] += allocation.count;
    }
    return topics.size ? [...topics.values()] : undefined;
}

export interface ProgrammePools<C extends ProgrammeCandidate> {
    cells: Map<string, C[]>;
    trueFalse: Map<string, C[]>;
    byId: Map<string, C>;
}

/** Câu dùng được cho từng ô: đã gắn dòng YCCĐ của đúng chương, không nằm ngoài chương trình, có mức độ hợp lệ. */
export function programmePools<C extends ProgrammeCandidate>(candidates: readonly C[]): ProgrammePools<C> {
    const cells = new Map<string, C[]>();
    const trueFalse = new Map<string, C[]>();
    const byId = new Map<string, C>();
    const push = (map: Map<string, C[]>, key: string, candidate: C) => {
        const list = map.get(key);
        if (list) list.push(candidate); else map.set(key, [candidate]);
    };
    for (const candidate of candidates) {
        const row = programmeRow(candidate.programmeRow);
        if (!row || candidate.chapterId !== row.chapterId || (candidate.grade && candidate.grade !== 10)
            || candidate.programmeMatch === 'outside' || byId.has(candidate.item.id)) continue;
        if (candidate.item.type === 'dung_sai') {
            if (!trueFalseCounts(candidate.item)) continue;
            push(trueFalse, row.id, candidate);
        } else {
            const level = readCognitiveLevel(candidate.item.level);
            if (!level) continue;
            push(cells, programmeCellKey(row.id, candidate.item.type, level), candidate);
        }
        byId.set(candidate.item.id, candidate);
    }
    return { cells, trueFalse, byId };
}

export function programmeUsedIds(state: ProgrammeState) {
    return new Set([...Object.values(state.picks), ...Object.values(state.trueFalse)].flat());
}

/** Ý Đúng/Sai ở mức không thuộc mức mà động từ của dòng hướng tới. */
export function levelMismatch(row: ProgrammeRow, levels: readonly number[]) {
    return row.levels.length ? levels.filter(level => !row.levels.includes(level as 1 | 2 | 3)).length : 0;
}

export function programmeTopicTotals(topic: ProgrammeTopic, state: ProgrammeState, byId: ReadonlyMap<string, ProgrammeCandidate>) {
    const totals: Record<ProgrammeType, LevelCounts> = { trac_nghiem: zero(), dung_sai: zero(), tu_luan: zero() };
    for (const row of topic.rows) {
        for (const type of PROGRAMME_CELL_TYPES) for (const level of LEVELS) {
            totals[type][level - 1] += state.counts[programmeCellKey(row.id, type, level)] ?? 0;
        }
        for (const id of state.trueFalse[row.id] ?? []) {
            const counts = byId.get(id) && trueFalseCounts(byId.get(id)!.item);
            counts?.forEach((value, index) => { totals.dung_sai[index] += value; });
        }
    }
    return totals;
}

/** Số câu của một dòng: các ô trắc nghiệm, trả lời ngắn đã chia và các câu Đúng/Sai đã chọn. */
export function programmeRowQuestions(row: ProgrammeRow, state: ProgrammeState) {
    return PROGRAMME_CELL_TYPES.reduce((sum, type) => sum + LEVELS.reduce((count, level) =>
        count + (state.counts[programmeCellKey(row.id, type, level)] ?? 0), 0), 0) + (state.trueFalse[row.id]?.length ?? 0);
}

function shuffle<T>(list: readonly T[], rng: () => number) {
    return list.map(value => [rng(), value] as const).sort((a, b) => a[0] - b[0]).map(([, value]) => value);
}

/** Điền câu cho các ô còn thiếu (giữ câu đã chọn), ưu tiên câu khớp trực tiếp rồi mới đến câu mở rộng. */
export function fillProgrammeCells<C extends ProgrammeCandidate>(state: ProgrammeState, pools: ProgrammePools<C>,
    keys: Iterable<string> = Object.keys(state.counts), rng: () => number = Math.random): ProgrammeState {
    const used = programmeUsedIds(state);
    const picks = { ...state.picks };
    for (const key of keys) {
        const need = state.counts[key] ?? 0;
        const list = (picks[key] ?? []).filter(id => pools.byId.has(id)).slice(0, need);
        const options = shuffle((pools.cells.get(key) ?? []).filter(candidate => !used.has(candidate.item.id)), rng)
            .sort((a, b) => Number(a.programmeMatch === 'extended') - Number(b.programmeMatch === 'extended'));
        while (list.length < need && options.length) {
            const id = options.shift()!.item.id;
            list.push(id);
            used.add(id);
        }
        picks[key] = list;
    }
    return { ...state, picks };
}

/**
 * Câu Đúng/Sai của một nội dung có tổng số ý từng mức đúng bằng ma trận. Thử theo thứ tự ít lệch mức trước;
 * bỏ qua các câu có cùng cơ cấu mức để không thử lại tổ hợp tương đương.
 */
function pickTrueFalse<C extends ProgrammeCandidate>(topic: ProgrammeTopic, pools: ProgrammePools<C>, used: ReadonlySet<string>,
    reserved: StatementCounts, rng: () => number) {
    const target = topic.need.dung_sai.map((value, index) => value - reserved[index]);
    const total = target.reduce((sum, value) => sum + value, 0);
    if (total <= 0 || total % 4 || target.some(value => value < 0)) return [];
    const options = topic.rows.flatMap(row => shuffle(pools.trueFalse.get(row.id) ?? [], rng)
        .filter(candidate => !used.has(candidate.item.id))
        .map(candidate => ({ candidate, row, counts: trueFalseCounts(candidate.item)! })))
        .sort((a, b) => levelMismatch(a.row, questionLevels(a.candidate.item)) - levelMismatch(b.row, questionLevels(b.candidate.item))
            || Number(a.candidate.programmeMatch === 'extended') - Number(b.candidate.programmeMatch === 'extended'));
    const chosen: typeof options = [];
    let steps = 0;
    const search = (left: number[], start: number): boolean => {
        if (left.every(value => value === 0)) return true;
        if (++steps > 20000) return false;
        const tried = new Set<string>();
        for (let index = start; index < options.length; index++) {
            const { counts } = options[index];
            const signature = counts.join(',');
            if (tried.has(signature) || counts.some((value, level) => value > left[level])) continue;
            tried.add(signature);
            chosen.push(options[index]);
            if (search(left.map((value, level) => value - counts[level]), index + 1)) return true;
            chosen.pop();
        }
        return false;
    };
    return search(target, 0) ? chosen : [];
}

/**
 * Gợi ý chia và chọn câu cho cả bản đặc tả: mỗi câu của ma trận vào dòng có động từ hợp mức và còn nhiều câu trong kho,
 * rồi chọn câu ngẫu nhiên cho từng ô. Câu Đúng/Sai được chọn sao cho tổng ý từng mức khớp ma trận.
 */
export function suggestProgramme<C extends ProgrammeCandidate>(topics: readonly ProgrammeTopic[], pools: ProgrammePools<C>,
    rng: () => number = Math.random): ProgrammeState {
    const state = emptyProgrammeState();
    for (const topic of topics) {
        for (const type of PROGRAMME_CELL_TYPES) for (const level of LEVELS) {
            for (let need = topic.need[type][level - 1]; need > 0; need--) {
                let best: { key: string; score: number } | undefined;
                for (const row of topic.rows) {
                    const key = programmeCellKey(row.id, type, level);
                    const have = pools.cells.get(key)?.length ?? 0;
                    const taken = state.counts[key] ?? 0;
                    if (have <= taken) continue;
                    const score = (row.levels.includes(level) ? 1000 : 0) + (have - taken) / (taken + 1) + rng() * 0.01;
                    if (!best || score > best.score) best = { key, score };
                }
                if (!best) break;
                state.counts[best.key] = (state.counts[best.key] ?? 0) + 1;
            }
        }
        for (const { candidate, row } of pickTrueFalse(topic, pools, programmeUsedIds(state), [0, 0, 0], rng)) {
            (state.trueFalse[row.id] ??= []).push(candidate.item.id);
        }
    }
    return fillProgrammeCells(state, pools, Object.keys(state.counts), rng);
}

/** Chọn lại câu Đúng/Sai của một nội dung, giữ nguyên các phần khác. */
export function suggestTrueFalse<C extends ProgrammeCandidate>(topic: ProgrammeTopic, state: ProgrammeState, pools: ProgrammePools<C>,
    rng: () => number = Math.random): ProgrammeState | undefined {
    const trueFalse = { ...state.trueFalse };
    for (const row of topic.rows) delete trueFalse[row.id];
    const picked = pickTrueFalse(topic, pools, programmeUsedIds({ ...state, trueFalse }), [0, 0, 0], rng);
    if (!picked.length) return undefined;
    for (const { candidate, row } of picked) (trueFalse[row.id] ??= []).push(candidate.item.id);
    return { ...state, trueFalse };
}

/** Những điểm còn lệch giữa bản đặc tả và ma trận, viết để giáo viên biết cần làm gì. */
export function programmeIssues(topics: readonly ProgrammeTopic[], state: ProgrammeState, byId: ReadonlyMap<string, ProgrammeCandidate>) {
    const issues: string[] = [];
    for (const topic of topics) {
        const totals = programmeTopicTotals(topic, state, byId);
        for (const type of PROGRAMME_CELL_TYPES) for (const level of LEVELS) {
            const need = topic.need[type][level - 1];
            const got = totals[type][level - 1];
            if (got !== need) issues.push(topic.topic + ' · ' + PROGRAMME_TYPE_LABELS[type] + ' ' + COGNITIVE_LEVELS[level]
                + ': đã chia ' + got + '/' + need + ' câu vào các dòng YCCĐ.');
        }
        for (const row of topic.rows) for (const type of PROGRAMME_CELL_TYPES) for (const level of LEVELS) {
            const key = programmeCellKey(row.id, type, level);
            const missing = (state.counts[key] ?? 0) - (state.picks[key]?.filter(id => byId.has(id)).length ?? 0);
            if (missing > 0) issues.push(topic.topic + ' · ' + programmeRowLabel(row) + ' · ' + PROGRAMME_TYPE_LABELS[type] + ' '
                + COGNITIVE_LEVELS[level] + ': còn ' + missing + ' câu chưa chọn.');
        }
        const need = topic.need.dung_sai;
        const total = need[0] + need[1] + need[2];
        const got = totals.dung_sai;
        if (total % 4) issues.push(topic.topic + ': ma trận có ' + total + ' ý Đúng/Sai, cần là bội của 4 (mỗi câu 4 ý).');
        else if (got.some((value, index) => value !== need[index])) {
            issues.push(topic.topic + ' · Đúng/Sai: các câu đã chọn gồm ' + (statementCountsLabel(got as unknown as StatementCounts) || '0 ý')
                + ', ma trận cần ' + statementCountsLabel(need as unknown as StatementCounts) + '.');
        }
        const written = topic.need.written.reduce((sum, value) => sum + value, 0);
        if (written) issues.push(topic.topic + ': ' + written + ' câu tự luận chưa có trong kho, cần soạn riêng.');
    }
    return issues;
}

/**
 * Gán câu đã chọn vào các vị trí của ma trận (matrixPlanSlots) theo thứ tự dòng, để dùng chung phần xuất ma trận và đặc tả.
 * YCCĐ ghi vào bản đặc tả là chữ của dòng YCCĐ chương trình. Trả kèm mã câu trong đề (C1, C2…) theo từng phần.
 */
export function programmeSelections(allocations: readonly MatrixAllocation[], topics: readonly ProgrammeTopic[],
    state: ProgrammeState, byId: ReadonlyMap<string, ProgrammeCandidate>) {
    const queues = new Map<string, { candidate: ProgrammeCandidate; row: ProgrammeRow }[]>();
    const enqueue = (key: string, entry: { candidate: ProgrammeCandidate; row: ProgrammeRow }) => {
        const list = queues.get(key);
        if (list) list.push(entry); else queues.set(key, [entry]);
    };
    for (const topic of topics) for (const row of topic.rows) {
        for (const type of PROGRAMME_CELL_TYPES) for (const level of LEVELS) {
            for (const id of state.picks[programmeCellKey(row.id, type, level)] ?? []) {
                const candidate = byId.get(id);
                if (candidate) enqueue(topic.key + '|' + type + '|' + level, { candidate, row });
            }
        }
        for (const id of state.trueFalse[row.id] ?? []) {
            const candidate = byId.get(id);
            if (candidate) enqueue(topic.key + '|dung_sai', { candidate, row });
        }
    }
    const selections: (MatrixExportSelection & { row: ProgrammeRow })[] = [];
    const codes = new Map<string, string>();
    const numbers = { trac_nghiem: 0, dung_sai: 0, tu_luan: 0, written: 0 };
    for (const slot of matrixPlanSlots([...allocations])) {
        if (slot.type === 'written' || !slot.canChoose) continue;
        const number = ++numbers[slot.type];
        const key = slot.chapterId + ':' + slot.topicId + '|' + slot.type + (slot.type === 'dung_sai' ? '' : '|' + readCognitiveLevel(slot.level));
        const entry = queues.get(key)?.shift();
        if (!entry) continue;
        const { candidate, row } = entry;
        codes.set(candidate.item.id, 'C' + number);
        selections.push({ slot, item: candidate.item, row, outcome: row.text, fixedOutcome: true,
            curriculumSource: programmeRowLabel(row) + ': ' + row.requirement.text
                + (candidate.programmeMatch === 'extended' ? ' (câu mở rộng so với YCCĐ)' : '') });
    }
    return { selections, codes };
}
