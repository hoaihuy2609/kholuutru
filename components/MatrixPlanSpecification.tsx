import { useEffect, useId, useMemo, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import type { StudyQuestionGroup } from '../types';
import type { SelectedQuestionItem } from '../src/services/examLatexService';
import { lessonRequirements, textbookLessonFor, textbookLessonLabel, textbookLessons, type TextbookLesson } from '../src/data/physics10Lessons';
import { ENERGY_MATRIX_CHAPTER_ID, normalizeMatrixText } from '../src/utils/examMatrix';
import { energyCurriculumGoals, matchEnergyCurriculumGoal } from '../src/utils/energyCurriculum';
import { autoPickMatrixPlan } from '../src/utils/matrixAutoPick';
import { questionLevels } from '../src/utils/cognitiveLevels';
import { fitsCounts, matrixPlanSlots, matrixPlanLevelLabel, matchesMatrixPlanSlot, plannedOutcome, statementCountsLabel, subtractCounts, trueFalseCounts, trueFalseGroup, type MatrixAllocation, type MatrixPlanSlot, type StatementCounts } from '../src/utils/matrixPlan';
import { STUDY_QUESTION_GROUPS, STUDY_QUESTION_TYPES } from '../src/utils/studyLibrary';
import type { MatrixCandidate } from './ExamMatrixBuilder';
import { MatrixDialog, MatrixQuestionCard, MatrixSolutionDialog } from './MatrixQuestionCard';
import MatrixExportDialog from './MatrixExportDialog';

const typeLabel = (type: MatrixAllocation['type']) => STUDY_QUESTION_TYPES.find(format => format.value === type)?.label ?? 'Tự luận';
const button = 'inline-flex min-h-9 items-center justify-center rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm font-semibold text-stone-800 hover:bg-stone-100 disabled:opacity-50';
const primary = 'inline-flex min-h-9 items-center justify-center rounded-lg bg-amber-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-900 disabled:opacity-50';
const input = 'block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm leading-5 text-stone-900 outline-none focus:border-amber-700 focus:ring-1 focus:ring-amber-700';
const pageSize = 12;

type Choice = { questionId?: string; outcome?: string; pickedOutcome?: string; lessonNumber?: number };

const lessonOf = (candidate: MatrixCandidate) => textbookLessonFor(candidate.chapterId, candidate.lessonTitle);

/**
 * A question fits a slot when it has the slot's content, format and level, and the lesson the teacher picked, if any.
 * A true-false question must also fit the statements its content still needs next to the other chosen true-false questions.
 */
function fitsSlot(slot: MatrixPlanSlot, lessonNumber: number | undefined, candidate: MatrixCandidate, remaining?: StatementCounts) {
    if (!matchesMatrixPlanSlot(slot, candidate) || (lessonNumber && lessonOf(candidate)?.number !== lessonNumber)) return false;
    const counts = remaining && trueFalseCounts(candidate.item);
    return !remaining || (!!counts && fitsCounts(remaining, counts));
}

const LEVEL_SHORT = ['?', 'NB', 'TH', 'VD'];

/** True-false level patterns the bank holds for a slot's content, e.g. ["TH TH VD VD", 27], most common first. */
function trueFalsePatterns(slot: MatrixPlanSlot, candidates: readonly MatrixCandidate[]) {
    const probe: MatrixPlanSlot = { ...slot, type: 'trac_nghiem', level: 1, statementBudget: undefined };
    const counts = new Map<string, number>();
    for (const candidate of candidates) {
        if (candidate.item.type !== 'dung_sai' || candidate.item.statements?.length !== 4) continue;
        // Same chapter and content as the slot, ignoring format and level.
        if (!matchesMatrixPlanSlot(probe, { ...candidate, item: { type: 'trac_nghiem', level: 1 } })) continue;
        const pattern = questionLevels(candidate.item).sort().map(level => LEVEL_SHORT[level]).join(' ');
        counts.set(pattern, (counts.get(pattern) ?? 0) + 1);
    }
    return [...counts].sort((a, b) => b[1] - a[1]);
}

/** Programme requirement the chosen YCCĐ most likely belongs to. Shown for reference only; it never hides a question. */
function programmeSource(slot: MatrixPlanSlot, outcome: string) {
    if (slot.chapterId !== ENERGY_MATRIX_CHAPTER_ID || !outcome.trim()) return undefined;
    let best: { score: number; source: string } | undefined;
    for (const goal of energyCurriculumGoals(slot.topicId)) {
        const { score } = matchEnergyCurriculumGoal(goal, [outcome]);
        if (score > (best?.score ?? 0)) best = { score, source: goal.source };
    }
    return best?.source;
}

const PARTS = [
    { type: 'trac_nghiem', label: 'Phần I · Trắc nghiệm', short: 'Phần I' },
    { type: 'dung_sai', label: 'Phần II · Đúng/Sai', short: 'Phần II' },
    { type: 'tu_luan', label: 'Phần III · Trả lời ngắn', short: 'Phần III' },
    { type: 'written', label: 'Tự luận', short: 'Tự luận' },
] as const;
const partOf = (type: MatrixPlanSlot['type']) => PARTS.find(part => part.type === type) ?? PARTS[3];
const LEVEL_TONES = ['bg-violet-100 text-violet-950', 'bg-sky-100 text-sky-950', 'bg-amber-100 text-amber-950', 'bg-rose-100 text-rose-950'];
const levelTone = (slot: MatrixPlanSlot) => LEVEL_TONES[slot.statementBudget ? 0 : slot.level] ?? LEVEL_TONES[0];

function MatrixPlanPicker({ slot, lesson, remaining, candidates, selectedId, usedIds, onChoose, onClose }: {
    slot: MatrixPlanSlot;
    lesson?: TextbookLesson;
    remaining?: StatementCounts;
    candidates: MatrixCandidate[];
    selectedId?: string;
    usedIds: ReadonlySet<string>;
    onChoose: (candidate: MatrixCandidate) => void;
    onClose: () => void;
}) {
    const [group, setGroup] = useState<StudyQuestionGroup | ''>('');
    const [query, setQuery] = useState('');
    const [limit, setLimit] = useState(pageSize);
    const [preview, setPreview] = useState<MatrixCandidate>();
    const matches = useMemo(() => candidates.filter(candidate => fitsSlot(slot, lesson?.number, candidate, remaining)).map(candidate => {
        const label = lessonOf(candidate);
        return {
            candidate: label ? { ...candidate, topic: textbookLessonLabel(label) } : candidate,
            text: normalizeMatrixText([candidate.preview(), ...candidate.outcomes].join(' ')),
        };
    }), [candidates, slot, lesson, remaining]);
    const needle = normalizeMatrixText(query);
    const visible = matches.filter(({ candidate, text }) => (!group || candidate.groups?.includes(group)) && (!needle || text.includes(needle)));

    return (
        <MatrixDialog title={'Chọn câu · ' + slot.label}
            subtitle={[lesson ? textbookLessonLabel(lesson) : slot.topic, typeLabel(slot.type),
                remaining ? 'còn cần ' + statementCountsLabel(remaining) : matrixPlanLevelLabel(slot)].join(' · ')}
            closeLabel="Đóng bộ chọn câu" onClose={onClose}>
            <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-stone-700" role="status">{visible.length} câu phù hợp</p>
                    {slot.type === 'trac_nghiem' && <div className="flex flex-wrap gap-1.5" role="group" aria-label="Lọc nhóm trắc nghiệm">
                        {[{ value: '' as const, label: 'Tất cả' }, ...STUDY_QUESTION_GROUPS].map(({ value, label }) => (
                            <button key={value} type="button" aria-pressed={group === value}
                                className={group === value ? primary : button}
                                onClick={() => { setGroup(value); setLimit(pageSize); }}>{label}</button>
                        ))}
                    </div>}
                </div>
                <label className="block space-y-1">
                    <span className="text-xs font-semibold text-stone-700">Tìm trong đề bài và YCCĐ</span>
                    <input type="search" className={input} value={query} placeholder="Ví dụ: công suất trung bình"
                        onChange={event => { setQuery(event.target.value); setLimit(pageSize); }} />
                </label>
                {visible.length ? <div className="grid items-start gap-3 lg:grid-cols-2">
                    {visible.slice(0, limit).map(({ candidate }) => (
                        <MatrixQuestionCard key={candidate.item.id} candidate={candidate} score={0} evidence={[]}
                            selected={candidate.item.id === selectedId} used={candidate.item.id !== selectedId && usedIds.has(candidate.item.id)}
                            showOutcomes onPreview={() => setPreview(candidate)} onChoose={() => onChoose(candidate)} />
                    ))}
                </div> : <p className="rounded-lg border border-stone-200 bg-white p-4 text-sm text-stone-600">
                    {needle ? 'Không có câu nào chứa cụm từ này.'
                        : group ? 'Nhóm này chưa có câu phù hợp. Xem Tất cả để rà các nhóm còn lại.'
                        : lesson ? 'Bài này chưa có câu đúng dạng và mức độ của vị trí này. Thử chọn "Tất cả bài".'
                        : 'Kho chưa có câu đúng nội dung, dạng câu và mức độ của vị trí này.'}
                </p>}
                {visible.length > limit && <button type="button" className={button} onClick={() => setLimit(previous => previous + pageSize)}>Xem thêm câu</button>}
            </div>
            {preview && <MatrixSolutionDialog candidate={preview} onClose={() => setPreview(undefined)} />}
        </MatrixDialog>
    );
}

export default function MatrixPlanSpecification({ allocations, candidates, onCompose }: {
    allocations: MatrixAllocation[];
    candidates: MatrixCandidate[];
    onCompose: (questions: SelectedQuestionItem[]) => void;
}) {
    const id = useId();
    const [choices, setChoices] = useState<Record<string, Choice>>({});
    const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
    const [detailId, setDetailId] = useState<string>();
    const [activeId, setActiveId] = useState<string>();
    const [autoNote, setAutoNote] = useState('');
    const slots = useMemo(() => matrixPlanSlots(allocations), [allocations]);
    const byId = useMemo(() => new Map(candidates.map(candidate => [candidate.item.id, candidate])), [candidates]);
    const topics = new Map<string, MatrixPlanSlot[]>();
    for (const slot of slots) {
        const rows = topics.get(slot.topicId);
        if (rows) rows.push(slot);
        else topics.set(slot.topicId, [slot]);
    }
    const selectedSlots = slots.flatMap(slot => {
        const questionId = choices[slot.id]?.questionId;
        const candidate = slot.canChoose && questionId ? byId.get(questionId) : undefined;
        return candidate && matchesMatrixPlanSlot(slot, candidate) ? [{ slot, candidate }] : [];
    });
    const chosenBySlot = new Map(selectedSlots.map(({ slot, candidate }) => [slot.id, candidate]));
    const usedIds = new Set(selectedSlots.map(({ candidate }) => candidate.item.id));
    const activeSlot = slots.find(slot => slot.id === activeId && slot.canChoose);
    /** Statements a true-false slot may still take: the content's total minus the other chosen true-false questions. */
    function remainingFor(slot: MatrixPlanSlot): StatementCounts | undefined {
        if (!slot.statementBudget) return undefined;
        return subtractCounts(slot.statementBudget, selectedSlots.flatMap(({ slot: other, candidate }) =>
            other.id !== slot.id && trueFalseGroup(other) === trueFalseGroup(slot) ? [trueFalseCounts(candidate.item) ?? [0, 0, 0]] : []));
    }
    const selectableCount = slots.filter(slot => slot.canChoose).length;
    const slotIds = useMemo(() => new Set(slots.map(slot => slot.id)), [slots]);

    useEffect(() => {
        setChoices(previous => {
            const entries = Object.entries(previous);
            return entries.some(([key]) => !slotIds.has(key))
                ? Object.fromEntries(entries.filter(([key]) => slotIds.has(key))) : previous;
        });
    }, [slotIds]);

    function outcomeFor(slotId: string, candidate?: MatrixCandidate) {
        const choice = choices[slotId];
        return plannedOutcome(choice?.outcome, choice?.pickedOutcome, candidate?.outcomes ?? []);
    }

    function lessonFor(slot: MatrixPlanSlot) {
        const number = choices[slot.id]?.lessonNumber;
        return number ? textbookLessons(slot.chapterId).find(lesson => lesson.number === number) : undefined;
    }

    function updateChoice(slotId: string, changes: Partial<Choice>) {
        setChoices(previous => ({ ...previous, [slotId]: { ...previous[slotId], ...changes } }));
    }

    function autoPick(targets: MatrixPlanSlot[]) {
        const targetIds = new Set(targets.map(slot => slot.id));
        const kept = selectedSlots.filter(({ slot }) => !targetIds.has(slot.id));
        const avoid = targets.flatMap(slot => chosenBySlot.get(slot.id)?.item.id ?? []);
        const reservedStatements = new Map<string, StatementCounts>();
        for (const { slot, candidate } of kept) {
            const counts = slot.statementBudget && trueFalseCounts(candidate.item);
            if (!counts) continue;
            const previous = reservedStatements.get(trueFalseGroup(slot)) ?? [0, 0, 0];
            reservedStatements.set(trueFalseGroup(slot), previous.map((value, index) => value + counts[index]) as unknown as StatementCounts);
        }
        const { picks, unfilled } = autoPickMatrixPlan(targets, candidates, {
            used: kept.map(({ candidate }) => candidate.item.id), avoid, reservedStatements,
            accepts: (slot, candidate) => fitsSlot(slot, choices[slot.id]?.lessonNumber, candidate as MatrixCandidate),
        });
        setChoices(previous => {
            const next = { ...previous };
            for (const [slotId, pick] of picks) {
                next[slotId] = { ...previous[slotId], questionId: pick.questionId, pickedOutcome: pick.pickedOutcome, outcome: undefined };
            }
            return next;
        });
        setAutoNote(picks.size + ' câu đã được chọn tự động'
            + (unfilled.length ? ', còn ' + unfilled.length + ' ô chưa có câu phù hợp trong kho.' : '.'));
    }

    function choose(slotId: string, candidate: MatrixCandidate) {
        if (choices[slotId]?.questionId === candidate.item.id) updateChoice(slotId, { questionId: undefined, pickedOutcome: undefined, outcome: undefined });
        else if (!usedIds.has(candidate.item.id)) updateChoice(slotId, { questionId: candidate.item.id, pickedOutcome: undefined, outcome: undefined });
        setActiveId(undefined);
    }

    if (!slots.length) return null;

    const emptySlots = slots.filter(slot => slot.canChoose && !chosenBySlot.has(slot.id));
    const leftovers = slots.filter(slot => slot.type === 'dung_sai' && !slot.canChoose);
    /** Empty slots the bank cannot fill at all with what is still allowed. */
    const blocked = emptySlots.filter(slot => !candidates.some(item => !usedIds.has(item.item.id)
        && fitsSlot(slot, choices[slot.id]?.lessonNumber, item, remainingFor(slot))));
    const parts = PARTS.flatMap(part => {
        const rows = slots.filter(slot => slot.type === part.type && (slot.canChoose || part.type === 'written'));
        return rows.length ? [{ ...part, total: rows.length, done: rows.filter(slot => chosenBySlot.has(slot.id)).length }] : [];
    });
    const complete = !emptySlots.length && !leftovers.length;

    return (
        <section className="space-y-5 rounded-xl border border-stone-200 bg-white p-4 sm:p-5" aria-labelledby={id}>
            <header className="space-y-1">
                <h2 id={id} className="text-lg font-bold">Bản đặc tả</h2>
                <p className="text-sm text-stone-600">Mỗi dòng dưới đây là một vị trí câu hỏi lấy từ ma trận. Chọn một câu trong kho cho từng vị trí; YCCĐ của câu sẽ được ghi vào bản đặc tả.</p>
            </header>

            <div className="grid gap-3 rounded-xl bg-stone-50 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <ul className="grid gap-2 sm:grid-cols-3" aria-label="Tiến độ chọn câu">
                    {parts.map(part => <li key={part.type} className="min-w-0 space-y-1">
                        <div className="flex items-baseline justify-between gap-2 text-sm">
                            <span className="truncate font-semibold text-stone-800">{part.label}</span>
                            <span className="shrink-0 tabular-nums text-stone-700">{part.done}/{part.total} câu</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-stone-200" aria-hidden="true">
                            <div className={'h-full rounded-full ' + (part.done === part.total ? 'bg-emerald-600' : 'bg-amber-600')}
                                style={{ width: (part.total ? (part.done / part.total) * 100 : 0) + '%' }} />
                        </div>
                    </li>)}
                </ul>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                    {emptySlots.length > 0 && <button type="button" className={primary}
                        onClick={() => autoPick(emptySlots)}>Tự chọn {emptySlots.length} vị trí còn trống</button>}
                    {selectedSlots.length > 0 && <button type="button" className={button}
                        onClick={() => autoPick(slots.filter(slot => slot.canChoose))}>Chọn lại tất cả</button>}
                </div>
            </div>

            {autoNote && <p className="text-sm text-stone-700" role="status">{autoNote}</p>}

            {(leftovers.length > 0 || blocked.length > 0) && <div className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-950" role="alert">
                <p className="font-semibold">Cần sửa trước khi xuất</p>
                <ul className="list-disc space-y-1.5 pl-5">
                    {leftovers.map(slot => <li key={slot.id}>
                        <strong>{slot.topic}</strong>: dư {slot.units} ý Đúng/Sai. Mỗi câu Đúng/Sai có 4 ý, nên quay lại ma trận và chỉnh tổng số ý Đúng/Sai của nội dung này thành bội của 4.
                    </li>)}
                    {blocked.map(slot => {
                        const remaining = remainingFor(slot);
                        const patterns = slot.type === 'dung_sai' ? trueFalsePatterns(slot, candidates) : [];
                        return <li key={slot.id}>
                            <strong>{partOf(slot.type).short} · {slot.label}</strong> ({slot.topic}): kho không còn câu phù hợp
                            {remaining ? ' với phần ý còn thiếu (' + statementCountsLabel(remaining) + ')' : ' ở mức ' + matrixPlanLevelLabel(slot)}.
                            {patterns.length > 0 && <> Kho có các câu Đúng/Sai: {patterns.slice(0, 5).map(([pattern, count]) => pattern + ' (' + count + ')').join(', ')}.</>}
                        </li>;
                    })}
                </ul>
            </div>}

            <div className="space-y-3">
                {[...topics].map(([topicId, rows]) => {
                    const expanded = !collapsed.has(topicId);
                    const panelId = id + '-' + topicId;
                    const selectable = rows.filter(row => row.canChoose);
                    const chosen = selectable.filter(row => chosenBySlot.has(row.id)).length;
                    const missing = selectable.length - chosen;
                    const extra = rows.filter(row => row.type === 'dung_sai' && !row.canChoose).reduce((sum, row) => sum + row.units, 0);
                    return <div key={topicId} className="overflow-hidden rounded-xl border border-stone-200">
                        <button type="button" aria-expanded={expanded} aria-controls={panelId}
                            className="flex w-full items-center gap-3 bg-stone-50 px-3 py-3 text-left hover:bg-stone-100"
                            onClick={() => setCollapsed(previous => {
                                const next = new Set(previous);
                                if (next.has(topicId)) next.delete(topicId); else next.add(topicId);
                                return next;
                            })}>
                            <ChevronDown aria-hidden="true" className={'size-4 shrink-0 text-stone-500 ' + (expanded ? '' : '-rotate-90')} />
                            <span className="min-w-0 flex-1 font-semibold">{rows[0].topic}</span>
                            <span className={'shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums '
                                + (missing || extra ? 'bg-amber-100 text-amber-950' : 'bg-emerald-100 text-emerald-900')}>
                                {missing ? 'Còn trống ' + missing + '/' + selectable.length : 'Đủ ' + chosen + ' câu'}{extra ? ' · dư ' + extra + ' ý' : ''}
                            </span>
                        </button>
                        <div id={panelId} hidden={!expanded} className="border-t border-stone-200">
                            {expanded && PARTS.map(part => {
                                const partRows = rows.filter(row => row.type === part.type);
                                if (!partRows.length) return null;
                                return <div key={part.type}>
                                    <p className="bg-white px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-stone-500">{part.label}</p>
                                    <ul className="divide-y divide-stone-100">
                                        {partRows.map(slot => renderRow(slot))}
                                    </ul>
                                </div>;
                            })}
                        </div>
                    </div>;
                })}
            </div>

            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-4">
                <p className="text-sm text-stone-700">
                    {complete ? 'Đã chọn đủ câu. Bước tiếp: rà YCCĐ và xuất ma trận, bản đặc tả.'
                        : 'Đã chọn ' + selectedSlots.length + '/' + selectableCount + ' câu. Có thể xuất bản nháp để xem trước.'}
                </p>
                <div className="flex flex-wrap gap-2">
                    <MatrixExportDialog allocations={allocations} selections={selectedSlots.map(({ slot, candidate }) => {
                        const outcome = outcomeFor(slot.id, candidate);
                        return { slot, item: candidate.item, outcome, outcomeOptions: candidate.outcomes, curriculumSource: programmeSource(slot, outcome) };
                    })} />
                    <button type="button" className={complete ? primary : button} disabled={!selectedSlots.length}
                        onClick={() => onCompose(selectedSlots.map(({ candidate }) => candidate.item))}>Biên soạn đề ({selectedSlots.length} câu)</button>
                </div>
            </footer>

            {activeSlot && <MatrixPlanPicker key={activeSlot.id + ':' + (choices[activeSlot.id]?.lessonNumber ?? '')} slot={activeSlot}
                lesson={lessonFor(activeSlot)} remaining={remainingFor(activeSlot)} candidates={candidates}
                selectedId={chosenBySlot.get(activeSlot.id)?.item.id} usedIds={usedIds}
                onClose={() => setActiveId(undefined)} onChoose={candidate => choose(activeSlot.id, candidate)} />}
        </section>
    );

    function renderRow(slot: MatrixPlanSlot) {
        const candidate = chosenBySlot.get(slot.id);
        const outcome = outcomeFor(slot.id, candidate);
        const source = programmeSource(slot, outcome);
        const fieldId = id + '-' + slot.id;
        const lesson = lessonFor(slot);
        const remaining = remainingFor(slot);
        const showDetail = detailId === slot.id;
        const chosenLesson = candidate && lessonOf(candidate);
        const levelText = slot.statementBudget
            ? candidate ? statementCountsLabel(trueFalseCounts(candidate.item) ?? [0, 0, 0])
                : slot.canChoose && remaining ? 'còn cần ' + statementCountsLabel(remaining) : statementCountsLabel(slot.statementBudget)
            : matrixPlanLevelLabel(slot);
        if (!slot.canChoose) return <li key={slot.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-sm text-stone-600">
            <span className="font-semibold text-stone-800">{slot.label}</span>
            <span>{slot.type === 'written' ? 'Tự luận chưa có trong kho, cần soạn riêng.' : 'Không ghép được thành câu 4 ý, xem mục cần sửa ở trên.'}</span>
        </li>;
        const lessons = textbookLessons(slot.chapterId).map(option => ({
            option, available: candidates.filter(item => fitsSlot(slot, option.number, item)).length,
        })).filter(({ option, available }) => available > 0 || option.number === lesson?.number);
        return <li key={slot.id} className={candidate ? 'bg-white' : 'bg-amber-50/40'}>
            <div className="grid gap-2 px-3 py-3 sm:grid-cols-[7.5rem_minmax(0,1fr)_auto] sm:items-start">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 sm:block sm:space-y-1">
                    <p className="text-sm font-bold">{slot.label}</p>
                    <span className={'inline-block rounded px-1.5 py-0.5 text-xs font-semibold ' + levelTone(slot)}>{levelText}</span>
                </div>
                <div className="min-w-0 space-y-1">
                    {candidate ? <>
                        <p className="flex flex-wrap items-center gap-x-2 text-sm font-semibold text-stone-900">
                            <Check aria-hidden="true" className="size-4 shrink-0 text-emerald-700" />
                            <span className="font-normal text-stone-600">Lấy từ kho:</span>
                            {chosenLesson ? textbookLessonLabel(chosenLesson) : candidate.lessonTitle ?? candidate.topic}
                            <span className="font-normal text-stone-600">· {candidate.item.questionNo}</span>
                        </p>
                        {slot.type === 'dung_sai'
                            ? <p className="text-sm text-stone-700">YCCĐ ghi riêng cho từng ý ở bước Xuất (tab "Rà YCCĐ từng câu/ý").</p>
                            : <p className={'text-sm ' + (outcome ? 'text-stone-700' : 'italic text-amber-900')}>
                                {outcome ? 'YCCĐ: ' + outcome : 'Câu có ' + candidate.outcomes.length + ' YCCĐ, mở "Chi tiết" để chọn một.'}
                            </p>}
                    </> : <p className="text-sm text-amber-900">Chưa chọn câu{lesson ? ' · lọc theo ' + textbookLessonLabel(lesson) : ''}</p>}
                </div>
                <div className="flex flex-wrap gap-1.5 sm:justify-end">
                    <button type="button" className={candidate ? button : button + ' border-amber-700 text-amber-900'} aria-haspopup="dialog"
                        onClick={() => setActiveId(slot.id)}>{candidate ? 'Đổi câu' : 'Chọn câu'}</button>
                    <button type="button" className={button} onClick={() => autoPick([slot])}>{candidate ? 'Câu khác' : 'Ngẫu nhiên'}</button>
                    <button type="button" className={button} aria-expanded={showDetail} aria-controls={fieldId + '-detail'}
                        onClick={() => setDetailId(showDetail ? undefined : slot.id)}>Chi tiết</button>
                </div>
            </div>
            <div id={fieldId + '-detail'} hidden={!showDetail} className="space-y-2 border-t border-dashed border-stone-200 bg-stone-50 px-3 py-3 sm:pl-[8.5rem]">
                {showDetail && <>
                    {lessons.length > 0 && <label className="block max-w-xl space-y-1">
                        <span className="text-xs font-semibold text-stone-700">Lọc theo bài (SGK Kết nối tri thức)</span>
                        <select className={input} value={lesson?.number ?? ''}
                            onChange={event => updateChoice(slot.id, { lessonNumber: Number(event.target.value) || undefined })}>
                            <option value="">Tất cả bài của nội dung này</option>
                            {lessons.map(({ option, available }) => <option key={option.number} value={option.number}>
                                {textbookLessonLabel(option)} ({available} câu)
                            </option>)}
                        </select>
                    </label>}
                    {lesson && <details className="text-xs text-stone-600">
                        <summary className="cursor-pointer font-semibold text-stone-800">YCCĐ chương trình của {textbookLessonLabel(lesson)}</summary>
                        <ul className="mt-1 list-disc space-y-1 pl-5 leading-relaxed">
                            {lessonRequirements(lesson).map(requirement => <li key={requirement.id} className="whitespace-pre-wrap">{requirement.text}</li>)}
                        </ul>
                    </details>}
                    <label htmlFor={fieldId} className="block text-xs font-semibold text-stone-700">YCCĐ ghi vào bản đặc tả</label>
                    <textarea id={fieldId} rows={2} className={input + ' resize-y'} value={outcome}
                        placeholder="Chọn câu để lấy YCCĐ của câu, hoặc tự nhập"
                        onChange={event => updateChoice(slot.id, { outcome: event.target.value })} />
                    {candidate && candidate.outcomes.length > 1 && <select aria-label={'Lấy YCCĐ từ ' + slot.label}
                        value={candidate.outcomes.includes(outcome) ? outcome : ''} className={input}
                        onChange={event => { if (event.target.value) updateChoice(slot.id, { pickedOutcome: event.target.value, outcome: undefined }); }}>
                        <option value="">Câu này có {candidate.outcomes.length} YCCĐ, chọn một…</option>
                        {candidate.outcomes.map(value => <option key={value} value={value}>{value}</option>)}
                    </select>}
                    {candidate?.outcomes.length === 1 && outcome !== candidate.outcomes[0] && <button type="button"
                        className="text-xs font-semibold text-amber-900 underline underline-offset-2"
                        onClick={() => updateChoice(slot.id, { outcome: undefined, pickedOutcome: undefined })}>Dùng lại YCCĐ của câu</button>}
                    {source && <p className="text-xs leading-relaxed text-stone-600"><span className="font-semibold text-stone-800">Đối chiếu YCCĐ chương trình: </span>{source}</p>}
                    {candidate && <button type="button" className="text-xs text-stone-600 underline underline-offset-2 hover:text-stone-900"
                        onClick={() => updateChoice(slot.id, { questionId: undefined, pickedOutcome: undefined, outcome: undefined })}>Bỏ chọn câu này</button>}
                </>}
            </div>
        </li>;
    }
}
