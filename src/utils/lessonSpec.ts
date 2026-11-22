import type { SelectedQuestionItem } from '../services/examLatexService';
import { LESSON_LINES, lessonLine, lessonLineSource, specLessons, topicLesson, type LessonLine, type SpecLesson } from '../data/lessonLines';
import type { ProgrammeMatch } from '../data/programmeRows';
import { COGNITIVE_LEVELS, questionLevels, readCognitiveLevel } from './cognitiveLevels';
import { matrixPlanSlots, trueFalseCounts, type MatrixAllocation } from './matrixPlan';
import type { MatrixExportSelection } from './matrixExport';

/**
 * Bản đặc tả theo bài: mỗi bài của ma trận có các dòng YCCĐ ở ba mức (lessonLines). Câu, ý trong kho đã được gắn vào
 * dòng của đúng bài và đúng mức. Trắc nghiệm, trả lời ngắn chọn theo dòng; số câu từng bài × dạng × mức khớp ma trận.
 * Đúng/Sai chọn nguyên câu theo bài, đủ số câu của ma trận; các ý tự nằm ở mức và dòng của chúng khi xuất bản đặc tả.
 * Ý Đúng/Sai đo YCCĐ của bài khác (hoặc chương trước) vẫn tính vào bài của câu, nhưng nằm ở đúng dòng của nó.
 */

export type LessonType = 'trac_nghiem' | 'dung_sai' | 'tu_luan';
/** Dạng câu chọn theo mức và dòng YCCĐ. */
export type LevelType = 'trac_nghiem' | 'tu_luan';
export const LEVEL_TYPES: readonly LevelType[] = ['trac_nghiem', 'tu_luan'];
export const LESSON_TYPE_LABELS: Record<LessonType | 'written', string> = {
    trac_nghiem: 'Nhiều lựa chọn', dung_sai: 'Đúng/Sai', tu_luan: 'Trả lời ngắn', written: 'Tự luận',
};
const LEVELS = [1, 2, 3] as const;
export type LevelCounts = [number, number, number];
const zero = (): LevelCounts => [0, 0, 0];

export interface LessonCandidate {
    item: SelectedQuestionItem;
    chapterId?: string;
    grade?: number;
    programmeMatch?: ProgrammeMatch;
    lesson?: number;
    specLines?: readonly (string | undefined)[];
    outcomes?: readonly string[];
}

export interface LessonTopic {
    key: string;
    chapterId: string;
    chapter: string;
    topicId: string;
    lesson: SpecLesson;
    /** Câu trắc nghiệm, trả lời ngắn, tự luận mà ma trận cần ở mức 1, 2, 3. */
    need: Record<LevelType | 'written', LevelCounts>;
    /** Số câu Đúng/Sai (nguyên câu) mà ma trận cần. */
    trueFalse: number;
}

/** Một đơn vị đánh giá: câu trắc nghiệm, trả lời ngắn, hoặc một ý của câu Đúng/Sai. */
export interface LessonUnit<C extends LessonCandidate = LessonCandidate> {
    candidate: C;
    index: number;
    /** a, b, c, d của câu Đúng/Sai; rỗng với câu khác. */
    label: string;
    level: number;
    /** Dòng YCCĐ của đơn vị; rỗng khi chưa gắn hoặc mức của dòng khác mức của đơn vị. */
    line?: LessonLine;
}

/** Bài của ma trận kèm số câu cần; undefined khi có nội dung không phải bài có dòng YCCĐ. */
export function lessonTopics(allocations: readonly MatrixAllocation[]): LessonTopic[] | undefined {
    const topics = new Map<string, LessonTopic>();
    for (const allocation of allocations) {
        const key = allocation.chapterId + ':' + allocation.topicId;
        let topic = topics.get(key);
        if (!topic) {
            const id = topicLesson(allocation.topicId);
            const lesson = specLessons(allocation.chapterId).find(item => item.id === id);
            if (!lesson) return undefined;
            topic = { key, chapterId: allocation.chapterId, chapter: allocation.chapter, topicId: allocation.topicId, lesson,
                need: { trac_nghiem: zero(), tu_luan: zero(), written: zero() }, trueFalse: 0 };
            topics.set(key, topic);
        }
        if (allocation.type === 'dung_sai') {
            // Ma trận theo bài nhập Đúng/Sai theo câu (level 0).
            if (allocation.level) return undefined;
            topic.trueFalse += allocation.count;
            continue;
        }
        const level = readCognitiveLevel(allocation.level);
        if (level) topic.need[allocation.type][level - 1] += allocation.count;
    }
    return topics.size ? [...topics.values()] : undefined;
}

/** Dòng dùng để hiện: dòng CT trùng ý một dòng SGV được tính vào dòng SGV. */
const shown = (line: LessonLine | undefined) => line?.alias ? lessonLine(line.alias) : line;

export function lessonUnits<C extends LessonCandidate>(candidate: C): LessonUnit<C>[] {
    const levels = questionLevels(candidate.item);
    return levels.map((level, index) => {
        const line = shown(lessonLine(candidate.specLines?.[index]));
        return { candidate, index, level, label: candidate.item.type === 'dung_sai' ? 'abcd'[index] : '',
            line: line && line.chapterId === candidate.chapterId && line.level === level ? line : undefined };
    });
}

export interface LessonPool<C extends LessonCandidate> {
    byId: Map<string, C>;
    /** Đơn vị của mọi câu dùng được, theo bài của câu. */
    units: Map<number, LessonUnit<C>[]>;
}

/** Câu dùng được: đã biết bài, đúng chương, lớp 10, không nằm ngoài chương trình, mức độ hợp lệ, đã gắn dòng YCCĐ. */
export function lessonPool<C extends LessonCandidate>(candidates: readonly C[], chapterIds: readonly string[]): LessonPool<C> {
    const byId = new Map<string, C>();
    const units = new Map<number, LessonUnit<C>[]>();
    for (const candidate of candidates) {
        if (!candidate.lesson || !candidate.chapterId || !chapterIds.includes(candidate.chapterId)
            || (candidate.grade && candidate.grade !== 10) || candidate.programmeMatch === 'outside'
            || !candidate.specLines?.some(Boolean) || byId.has(candidate.item.id)) continue;
        if (candidate.item.type === 'dung_sai' ? !trueFalseCounts(candidate.item) : !readCognitiveLevel(candidate.item.level)) continue;
        byId.set(candidate.item.id, candidate);
        const list = units.get(candidate.lesson);
        const own = lessonUnits(candidate);
        if (list) list.push(...own); else units.set(candidate.lesson, own);
    }
    return { byId, units };
}

/** Câu đã chọn của bài: trắc nghiệm, trả lời ngắn theo mức; Đúng/Sai theo số câu. */
export function lessonTotals(lesson: number, chosen: ReadonlySet<string>, byId: ReadonlyMap<string, LessonCandidate>) {
    const totals = { trac_nghiem: zero(), tu_luan: zero(), trueFalse: 0 };
    for (const id of chosen) {
        const candidate = byId.get(id);
        if (!candidate || candidate.lesson !== lesson) continue;
        if (candidate.item.type === 'dung_sai') { totals.trueFalse++; continue; }
        const level = readCognitiveLevel(candidate.item.level);
        if (level) totals[candidate.item.type][level - 1]++;
    }
    return totals;
}

/** Phần còn thiếu, phần thừa của bài so với ma trận, viết để giáo viên đọc. */
export function lessonStatus(topic: LessonTopic, chosen: ReadonlySet<string>, byId: ReadonlyMap<string, LessonCandidate>) {
    const totals = lessonTotals(topic.lesson.id, chosen, byId);
    const missing: string[] = [];
    const over: string[] = [];
    const add = (gap: number, label: string) => {
        if (gap > 0) missing.push(gap + ' câu ' + label);
        if (gap < 0) over.push(-gap + ' câu ' + label);
    };
    for (const type of LEVEL_TYPES) for (const level of LEVELS) {
        add(topic.need[type][level - 1] - totals[type][level - 1], LESSON_TYPE_LABELS[type] + ' ' + COGNITIVE_LEVELS[level]);
        if (type === 'trac_nghiem' && level === 3) add(topic.trueFalse - totals.trueFalse, LESSON_TYPE_LABELS.dung_sai);
    }
    const questions = [...chosen].filter(id => byId.get(id)?.lesson === topic.lesson.id).length;
    const needed = topic.trueFalse + LEVEL_TYPES.reduce((sum, type) => sum + topic.need[type].reduce((a, b) => a + b, 0), 0);
    return { missing, over, questions, needed, done: !missing.length && !over.length };
}

/** Những điểm còn lệch giữa bản đặc tả và ma trận. */
export function lessonIssues(topics: readonly LessonTopic[], chosen: ReadonlySet<string>, byId: ReadonlyMap<string, LessonCandidate>) {
    const issues: string[] = [];
    for (const topic of topics) {
        const status = lessonStatus(topic, chosen, byId);
        if (status.missing.length) issues.push(topic.lesson.name + ': còn thiếu ' + status.missing.join(', ') + '.');
        if (status.over.length) issues.push(topic.lesson.name + ': thừa ' + status.over.join(', ') + '.');
        const written = topic.need.written.reduce((sum, value) => sum + value, 0);
        if (written) issues.push(topic.lesson.name + ': ' + written + ' câu tự luận chưa có trong kho, cần soạn riêng.');
    }
    return issues;
}

function shuffle<T>(list: readonly T[], rng: () => number) {
    return list.map(value => [rng(), value] as const).sort((a, b) => a[0] - b[0]).map(([, value]) => value);
}

const lineOrder = new Map(LESSON_LINES.map((line, index) => [line.id, index]));
const order = (line: LessonLine | undefined) => line ? lineOrder.get(line.id)! : LESSON_LINES.length;

/**
 * Gợi ý chọn câu cho mọi bài: trắc nghiệm, trả lời ngắn lấy lần lượt từ các dòng YCCĐ để phủ được nhiều dòng; câu chưa
 * khớp dòng nào lấy sau cùng. Câu Đúng/Sai lấy ngẫu nhiên đủ số câu của bài, ưu tiên câu có mọi ý đã gắn dòng.
 */
export function suggestLessons<C extends LessonCandidate>(topics: readonly LessonTopic[], pool: LessonPool<C>,
    rng: () => number = Math.random) {
    const chosen = new Set<string>();
    const notes: string[] = [];
    for (const topic of topics) {
        const units = pool.units.get(topic.lesson.id) ?? [];
        for (const type of LEVEL_TYPES) for (const level of LEVELS) {
            let need = topic.need[type][level - 1];
            if (!need) continue;
            const queues = new Map<string, C[]>();
            for (const unit of shuffle(units.filter(unit => unit.candidate.item.type === type && unit.level === level), rng)) {
                const key = unit.line?.id ?? '';
                const list = queues.get(key);
                if (list) list.push(unit.candidate); else queues.set(key, [unit.candidate]);
            }
            const lists = [...queues.entries()].sort((a, b) => Number(!a[0]) - Number(!b[0])).map(([, list]) => list);
            while (need > 0 && lists.some(list => list.length)) {
                for (const list of lists) if (need > 0 && list.length) { chosen.add(list.shift()!.item.id); need--; }
            }
            if (need > 0) notes.push(topic.lesson.name + ' · ' + LESSON_TYPE_LABELS[type] + ' ' + COGNITIVE_LEVELS[level] + ': kho thiếu ' + need + ' câu.');
        }
        if (!topic.trueFalse) continue;
        const trueFalse = new Map(units.filter(unit => unit.candidate.item.type === 'dung_sai').map(unit => [unit.candidate.item.id, unit.candidate]));
        const options = shuffle([...trueFalse.values()], rng)
            .sort((a, b) => lessonUnits(a).filter(unit => !unit.line).length - lessonUnits(b).filter(unit => !unit.line).length)
            .slice(0, topic.trueFalse);
        options.forEach(candidate => chosen.add(candidate.item.id));
        if (options.length < topic.trueFalse) notes.push(topic.lesson.name + ' · Đúng/Sai: kho thiếu ' + (topic.trueFalse - options.length) + ' câu.');
    }
    return { chosen, notes };
}

/** Chữ của dòng ghi vào bản đặc tả: đúng câu chữ YCCĐ, không kèm nguồn hay tên bài. */
export function lessonOutcome(line: LessonLine) {
    return line.text;
}

/**
 * Gán câu đã chọn vào các vị trí của ma trận (matrixPlanSlots) theo thứ tự dòng YCCĐ, để dùng chung phần xuất ma trận và
 * bản đặc tả. Trả kèm mã câu trong đề (C1, C2…) theo từng phần.
 */
export function lessonSelections(allocations: readonly MatrixAllocation[], topics: readonly LessonTopic[],
    chosen: ReadonlySet<string>, byId: ReadonlyMap<string, LessonCandidate>) {
    const queues = new Map<string, LessonCandidate[]>();
    const sorted = [...chosen].flatMap(id => byId.get(id) ?? []).map(candidate => ({ candidate, units: lessonUnits(candidate) }))
        .sort((a, b) => Math.min(...a.units.map(unit => unit.level)) - Math.min(...b.units.map(unit => unit.level))
            || order(a.units[0]?.line) - order(b.units[0]?.line));
    for (const { candidate } of sorted) {
        const topic = topics.find(item => item.chapterId === candidate.chapterId && item.lesson.id === candidate.lesson);
        if (!topic) continue;
        const key = topic.key + '|' + candidate.item.type + (candidate.item.type === 'dung_sai' ? '' : '|' + readCognitiveLevel(candidate.item.level));
        const list = queues.get(key);
        if (list) list.push(candidate); else queues.set(key, [candidate]);
    }
    const selections: MatrixExportSelection[] = [];
    const codes = new Map<string, string>();
    const numbers = { trac_nghiem: 0, dung_sai: 0, tu_luan: 0, written: 0 };
    for (const slot of matrixPlanSlots([...allocations])) {
        if (slot.type === 'written' || !slot.canChoose) continue;
        const number = ++numbers[slot.type];
        const key = slot.chapterId + ':' + slot.topicId + '|' + slot.type + (slot.type === 'dung_sai' ? '' : '|' + readCognitiveLevel(slot.level));
        const candidate = queues.get(key)?.shift();
        if (!candidate) continue;
        codes.set(candidate.item.id, 'C' + number);
        const outcomes = lessonUnits(candidate).map(unit => unit.line ? lessonOutcome(unit.line)
            : candidate.item.type === 'dung_sai' ? '' : candidate.outcomes?.[0] ?? '');
        const sources = [...new Set(lessonUnits(candidate).flatMap(unit => unit.line ? [lessonLineSource(unit.line)] : []))];
        selections.push({ slot, item: candidate.item, outcome: outcomes[0], fixedOutcome: true,
            statementOutcomes: candidate.item.type === 'dung_sai' ? outcomes : undefined,
            curriculumSource: sources.join('; ') || undefined });
    }
    return { selections, codes };
}

