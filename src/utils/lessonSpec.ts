import type { SelectedQuestionItem } from '../services/examLatexService';
import { LESSON_LINES, lessonLine, lessonLineSource, specLessons, topicLesson, type LessonLine, type SpecLesson } from '../data/lessonLines';
import type { ProgrammeMatch } from '../data/programmeRows';
import { COGNITIVE_LEVELS, questionLevels, readCognitiveLevel } from './cognitiveLevels';
import { matrixPlanSlots, statementCountsLabel, trueFalseCounts, type MatrixAllocation, type StatementCounts } from './matrixPlan';
import type { MatrixExportSelection } from './matrixExport';

/**
 * Bản đặc tả theo bài: mỗi bài của ma trận có các dòng YCCĐ ở ba mức (lessonLines). Câu, ý trong kho đã được gắn vào
 * dòng của đúng bài và đúng mức. Giáo viên chọn câu theo dòng; số câu, số ý của từng bài × dạng × mức phải khớp ma trận.
 * Ý Đúng/Sai đo YCCĐ của bài khác (hoặc chương trước) vẫn tính vào bài của câu, nhưng nằm ở đúng dòng của nó.
 */

export type LessonType = 'trac_nghiem' | 'dung_sai' | 'tu_luan';
export const LESSON_TYPES: readonly LessonType[] = ['trac_nghiem', 'dung_sai', 'tu_luan'];
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
    /** Câu (trắc nghiệm, trả lời ngắn, tự luận) hoặc ý (Đúng/Sai) mà ma trận cần ở mức 1, 2, 3. */
    need: Record<LessonType | 'written', LevelCounts>;
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
                need: { trac_nghiem: zero(), dung_sai: zero(), tu_luan: zero(), written: zero() } };
            topics.set(key, topic);
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

/** Số câu (ý với Đúng/Sai) đã chọn của bài theo dạng và mức. */
export function lessonTotals(lesson: number, chosen: ReadonlySet<string>, byId: ReadonlyMap<string, LessonCandidate>) {
    const totals: Record<LessonType, LevelCounts> = { trac_nghiem: zero(), dung_sai: zero(), tu_luan: zero() };
    for (const id of chosen) {
        const candidate = byId.get(id);
        if (!candidate || candidate.lesson !== lesson) continue;
        for (const level of questionLevels(candidate.item)) if (level >= 1 && level <= 3) totals[candidate.item.type][level - 1]++;
    }
    return totals;
}

/** Phần còn thiếu, phần thừa của bài so với ma trận, viết để giáo viên đọc. */
export function lessonStatus(topic: LessonTopic, chosen: ReadonlySet<string>, byId: ReadonlyMap<string, LessonCandidate>) {
    const totals = lessonTotals(topic.lesson.id, chosen, byId);
    const missing: string[] = [];
    const over: string[] = [];
    for (const type of LESSON_TYPES) for (const level of LEVELS) {
        const gap = topic.need[type][level - 1] - totals[type][level - 1];
        const text = (count: number) => count + (type === 'dung_sai' ? ' ý ' : ' câu ') + LESSON_TYPE_LABELS[type] + ' ' + COGNITIVE_LEVELS[level];
        if (gap > 0) missing.push(text(gap));
        if (gap < 0) over.push(text(-gap));
    }
    const questions = [...chosen].filter(id => byId.get(id)?.lesson === topic.lesson.id).length;
    return { missing, over, questions, done: !missing.length && !over.length };
}

/** Những điểm còn lệch giữa bản đặc tả và ma trận. */
export function lessonIssues(topics: readonly LessonTopic[], chosen: ReadonlySet<string>, byId: ReadonlyMap<string, LessonCandidate>) {
    const issues: string[] = [];
    for (const topic of topics) {
        const status = lessonStatus(topic, chosen, byId);
        if (status.missing.length) issues.push(topic.lesson.name + ': còn thiếu ' + status.missing.join(', ') + '.');
        if (status.over.length) issues.push(topic.lesson.name + ': thừa ' + status.over.join(', ') + '.');
        const statements = topic.need.dung_sai.reduce((sum, value) => sum + value, 0);
        if (statements % 4) issues.push(topic.lesson.name + ': ma trận có ' + statements + ' ý Đúng/Sai, cần là bội của 4 (mỗi câu 4 ý).');
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
 * khớp dòng nào lấy sau cùng. Câu Đúng/Sai được ghép sao cho tổng ý từng mức khớp ma trận, ưu tiên câu có mọi ý đã gắn dòng.
 */
export function suggestLessons<C extends LessonCandidate>(topics: readonly LessonTopic[], pool: LessonPool<C>,
    rng: () => number = Math.random) {
    const chosen = new Set<string>();
    const notes: string[] = [];
    for (const topic of topics) {
        const units = pool.units.get(topic.lesson.id) ?? [];
        for (const type of ['trac_nghiem', 'tu_luan'] as const) for (const level of LEVELS) {
            let need = topic.need[type][level - 1];
            if (!need) continue;
            const queues = new Map<string, C[]>();
            for (const unit of shuffle(units.filter(unit => unit.candidate.item.type === type && unit.level === level), rng)
                .sort((a, b) => Number(a.candidate.programmeMatch === 'extended') - Number(b.candidate.programmeMatch === 'extended'))) {
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
        const target = topic.need.dung_sai;
        const total = target[0] + target[1] + target[2];
        if (!total || total % 4) continue;
        const trueFalse = new Map(units.filter(unit => unit.candidate.item.type === 'dung_sai').map(unit => [unit.candidate.item.id, unit.candidate]));
        const options = shuffle([...trueFalse.values()], rng)
            .map(candidate => ({ candidate, counts: trueFalseCounts(candidate.item)!,
                off: lessonUnits(candidate).filter(unit => !unit.line).length }))
            .sort((a, b) => a.off - b.off || Number(a.candidate.programmeMatch === 'extended') - Number(b.candidate.programmeMatch === 'extended'));
        const picked: C[] = [];
        let steps = 0;
        const search = (left: number[], start: number): boolean => {
            if (left.every(value => value === 0)) return true;
            if (++steps > 20000) return false;
            const tried = new Set<string>();
            for (let index = start; index < options.length; index++) {
                const { candidate, counts } = options[index];
                const signature = counts.join(',');
                if (tried.has(signature) || counts.some((value, level) => value > left[level])) continue;
                tried.add(signature);
                picked.push(candidate);
                if (search(left.map((value, level) => value - counts[level]), index + 1)) return true;
                picked.pop();
            }
            return false;
        };
        if (search([...target], 0)) picked.forEach(candidate => chosen.add(candidate.item.id));
        else notes.push(topic.lesson.name + ' · Đúng/Sai: kho không có tổ hợp câu cho ' + statementCountsLabel(target as unknown as StatementCounts) + '.');
    }
    return { chosen, notes };
}

/** Chữ của dòng ghi vào bản đặc tả, kèm nguồn; dòng của bài khác ghi rõ bài. */
export function lessonOutcome(line: LessonLine, lesson: number) {
    return (line.lesson && line.lesson !== lesson ? '(YCCĐ Bài ' + line.lesson + ') ' : '') + line.text + ' (' + lessonLineSource(line) + ')';
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
        const lesson = candidate.lesson!;
        const outcomes = lessonUnits(candidate).map(unit => unit.line ? lessonOutcome(unit.line, lesson)
            : candidate.item.type === 'dung_sai' ? '' : candidate.outcomes?.[0] ?? '');
        const sources = [...new Set(lessonUnits(candidate).flatMap(unit => unit.line ? [lessonLineSource(unit.line)] : []))];
        selections.push({ slot, item: candidate.item, outcome: outcomes[0], fixedOutcome: true,
            statementOutcomes: candidate.item.type === 'dung_sai' ? outcomes : undefined,
            curriculumSource: sources.join('; ') || undefined });
    }
    return { selections, codes };
}

