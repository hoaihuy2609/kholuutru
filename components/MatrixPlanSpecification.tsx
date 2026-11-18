import { useEffect, useId, useMemo, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import type { StudyQuestionGroup } from '../types';
import type { SelectedQuestionItem } from '../src/services/examLatexService';
import { lessonRequirements, textbookLessonFor, textbookLessonLabel, textbookLessons, type TextbookLesson } from '../src/data/physics10Lessons';
import { ENERGY_MATRIX_CHAPTER_ID, normalizeMatrixText } from '../src/utils/examMatrix';
import { energyCurriculumGoals, matchEnergyCurriculumGoal } from '../src/utils/energyCurriculum';
import { autoPickMatrixPlan } from '../src/utils/matrixAutoPick';
import { questionLevels } from '../src/utils/cognitiveLevels';
import { matrixPlanSlots, matrixPlanLevelLabel, matchesMatrixPlanSlot, plannedOutcome, type MatrixAllocation, type MatrixPlanSlot } from '../src/utils/matrixPlan';
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

/** A question fits a slot when it has the slot's content, format and level, and the lesson the teacher picked, if any. */
function fitsSlot(slot: MatrixPlanSlot, lessonNumber: number | undefined, candidate: MatrixCandidate) {
    return matchesMatrixPlanSlot(slot, candidate) && (!lessonNumber || lessonOf(candidate)?.number === lessonNumber);
}

const LEVEL_SHORT = ['?', 'NB', 'TH', 'VD'];

/** True-false level patterns the bank holds for a slot's content, e.g. ["TH TH VD VD", 27], most common first. */
function trueFalsePatterns(slot: MatrixPlanSlot, candidates: readonly MatrixCandidate[]) {
    const probe: MatrixPlanSlot = { ...slot, type: 'trac_nghiem', level: 1, statementLevels: undefined };
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

function MatrixPlanPicker({ slot, lesson, candidates, selectedId, usedIds, onChoose, onClose }: {
    slot: MatrixPlanSlot;
    lesson?: TextbookLesson;
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
    const matches = useMemo(() => candidates.filter(candidate => fitsSlot(slot, lesson?.number, candidate)).map(candidate => {
        const label = lessonOf(candidate);
        return {
            candidate: label ? { ...candidate, topic: textbookLessonLabel(label) } : candidate,
            text: normalizeMatrixText([candidate.preview(), ...candidate.outcomes].join(' ')),
        };
    }), [candidates, slot, lesson]);
    const needle = normalizeMatrixText(query);
    const visible = matches.filter(({ candidate, text }) => (!group || candidate.groups?.includes(group)) && (!needle || text.includes(needle)));

    return (
        <MatrixDialog title={'Chọn câu · ' + slot.label}
            subtitle={[lesson ? textbookLessonLabel(lesson) : slot.topic, typeLabel(slot.type), matrixPlanLevelLabel(slot)].join(' · ')}
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
    const [openTopic, setOpenTopic] = useState<string | null>();
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
    const open = openTopic === null ? undefined : openTopic && topics.has(openTopic) ? openTopic : topics.keys().next().value;
    const selectedSlots = slots.flatMap(slot => {
        const questionId = choices[slot.id]?.questionId;
        const candidate = slot.canChoose && questionId ? byId.get(questionId) : undefined;
        return candidate && matchesMatrixPlanSlot(slot, candidate) ? [{ slot, candidate }] : [];
    });
    const chosenBySlot = new Map(selectedSlots.map(({ slot, candidate }) => [slot.id, candidate]));
    const usedIds = new Set(selectedSlots.map(({ candidate }) => candidate.item.id));
    const activeSlot = slots.find(slot => slot.id === activeId && slot.canChoose);
    const pendingIdeas = slots.reduce((sum, slot) => sum + (slot.type === 'dung_sai' && !slot.canChoose ? slot.units : 0), 0);
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
        const { picks, unfilled } = autoPickMatrixPlan(targets, candidates, {
            used: kept.map(({ candidate }) => candidate.item.id), avoid,
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

    return (
        <section className="space-y-4 rounded-xl border border-stone-200 bg-white p-4" aria-labelledby={id}>
            <header className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 id={id} className="text-lg font-bold">Bản đặc tả</h2>
                    <p className="mt-0.5 text-sm text-stone-600">Chọn bài theo SGK rồi chọn câu. YCCĐ lấy từ câu đã chọn.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <MatrixExportDialog allocations={allocations} selections={selectedSlots.map(({ slot, candidate }) => {
                        const outcome = outcomeFor(slot.id, candidate);
                        return { slot, item: candidate.item, outcome, outcomeOptions: candidate.outcomes, curriculumSource: programmeSource(slot, outcome) };
                    })} />
                    <span className="rounded-md bg-amber-50 px-2.5 py-1.5 text-sm font-semibold tabular-nums text-amber-950" role="status">
                        Đã chọn {selectedSlots.length}/{selectableCount} câu
                    </span>
                    <button type="button" className={button} disabled={selectedSlots.length >= selectableCount}
                        onClick={() => autoPick(slots.filter(slot => slot.canChoose && !chosenBySlot.has(slot.id)))}>Tự chọn câu</button>
                    {selectedSlots.length > 0 && <button type="button" className={button}
                        onClick={() => autoPick(slots.filter(slot => slot.canChoose))}>Chọn lại ngẫu nhiên</button>}
                    <button type="button" className={primary} disabled={!selectedSlots.length}
                        onClick={() => onCompose(selectedSlots.map(({ candidate }) => candidate.item))}>Biên soạn câu đã chọn</button>
                </div>
            </header>
            {autoNote && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-950" role="status">{autoNote}</p>}
            {pendingIdeas > 0 && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950">
                {pendingIdeas} ý Đúng/Sai đang chờ ghép. Mỗi câu cần 4 ý cùng nội dung, có thể gồm nhiều mức độ.
            </p>}
            <div className="space-y-2">
                {[...topics].map(([topicId, rows]) => {
                    const expanded = open === topicId;
                    const panelId = id + '-' + topicId;
                    const chosen = rows.filter(row => chosenBySlot.has(row.id)).length;
                    const count = rows.filter(row => row.canChoose).length;
                    return <div key={topicId} className="overflow-hidden rounded-lg border border-stone-200">
                        <button type="button" aria-expanded={expanded} aria-controls={panelId}
                            className="flex w-full items-center gap-3 bg-stone-50 px-3 py-2.5 text-left hover:bg-stone-100"
                            onClick={() => setOpenTopic(expanded ? null : topicId)}>
                            <ChevronDown aria-hidden="true" className={'size-4 shrink-0 text-amber-800 ' + (expanded ? '' : '-rotate-90')} />
                            <span className="min-w-0 flex-1">
                                <span className="block font-semibold">{rows[0].topic}</span>
                                <span className="block text-xs text-stone-600">{rows[0].chapter}</span>
                            </span>
                            {count > 0 && <span className="shrink-0 rounded bg-white px-2 py-1 text-xs font-semibold tabular-nums text-stone-700">{chosen}/{count} câu</span>}
                        </button>
                        <div id={panelId} hidden={!expanded} className="divide-y divide-stone-100 border-t border-stone-200">
                            {expanded && rows.map(slot => {
                                const candidate = chosenBySlot.get(slot.id);
                                const outcome = outcomeFor(slot.id, candidate);
                                const source = programmeSource(slot, outcome);
                                const fieldId = id + '-' + slot.id;
                                const lesson = lessonFor(slot);
                                const lessons = slot.canChoose ? textbookLessons(slot.chapterId).map(option => ({
                                    option, available: candidates.filter(item => fitsSlot(slot, option.number, item)).length,
                                })).filter(({ option, available }) => available > 0 || option.number === lesson?.number) : [];
                                const chosenLesson = candidate && lessonOf(candidate);
                                const missingTrueFalse = slot.type === 'dung_sai' && slot.canChoose && !candidate
                                    && !candidates.some(item => fitsSlot(slot, undefined, item));
                                const patterns = missingTrueFalse ? trueFalsePatterns(slot, candidates) : [];
                                return <div key={slot.id} className="grid gap-3 px-3 py-3 md:grid-cols-[minmax(9.5rem,0.7fr)_minmax(0,2fr)_minmax(8rem,0.6fr)]">
                                    <div className="space-y-0.5">
                                        <p className="text-sm font-semibold">{typeLabel(slot.type)}</p>
                                        <p className="text-xs text-stone-600">{slot.label} · {matrixPlanLevelLabel(slot)}</p>
                                    </div>
                                    <div className="min-w-0 space-y-1.5">
                                        {lessons.length > 0 && <label className="block space-y-1">
                                            <span className="text-xs font-semibold text-stone-700">Bài (SGK Kết nối tri thức)</span>
                                            <select className={input} value={lesson?.number ?? ''}
                                                onChange={event => updateChoice(slot.id, { lessonNumber: Number(event.target.value) || undefined })}>
                                                <option value="">Tất cả bài của nội dung này</option>
                                                {lessons.map(({ option, available }) => <option key={option.number} value={option.number}>
                                                    {textbookLessonLabel(option)} ({available} câu)
                                                </option>)}
                                            </select>
                                        </label>}
                                        {lesson && <details className="text-xs text-stone-600">
                                            <summary className="cursor-pointer font-semibold text-amber-900">YCCĐ chương trình của bài này</summary>
                                            <ul className="mt-1 list-disc space-y-1 rounded bg-stone-50 p-2 pl-6 leading-relaxed">
                                                {lessonRequirements(lesson).map(requirement => <li key={requirement.id} className="whitespace-pre-wrap">{requirement.text}</li>)}
                                            </ul>
                                        </details>}
                                        {missingTrueFalse && <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-950" role="note">
                                            <p className="font-semibold">Kho chưa có câu Đúng/Sai gồm {matrixPlanLevelLabel(slot)} ở nội dung này.</p>
                                            {patterns.length ? <p className="mt-1">Kho đang có: {patterns.slice(0, 4).map(([pattern, count]) => pattern + ' (' + count + ' câu)').join(' · ')}. Chỉnh mức độ các ý Đúng/Sai trong ma trận theo một tổ hợp này.</p>
                                                : <p className="mt-1">Nội dung này chưa có câu Đúng/Sai nào trong kho.</p>}
                                        </div>}
                                        <label htmlFor={fieldId} className="block text-xs font-semibold text-stone-700">Yêu cầu cần đạt</label>
                                        <textarea id={fieldId} rows={2} className={input + ' resize-y'} value={outcome}
                                            placeholder={slot.canChoose ? 'Chọn câu để lấy YCCĐ của câu' : 'Nhập yêu cầu cần đạt'}
                                            onChange={event => updateChoice(slot.id, { outcome: event.target.value })} />
                                        {candidate && candidate.outcomes.length > 1 && <select aria-label={'Lấy YCCĐ từ ' + slot.label}
                                            value={candidate.outcomes.includes(outcome) ? outcome : ''}
                                            className={input} onChange={event => {
                                                const pickedOutcome = event.target.value;
                                                if (pickedOutcome) updateChoice(slot.id, { pickedOutcome, outcome: undefined });
                                            }}>
                                            <option value="">Câu này có {candidate.outcomes.length} YCCĐ, chọn một…</option>
                                            {candidate.outcomes.map(value => <option key={value} value={value}>{value}</option>)}
                                        </select>}
                                        {candidate?.outcomes.length === 1 && outcome !== candidate.outcomes[0] && (
                                            <button type="button" className="text-xs font-semibold text-amber-900 underline underline-offset-2"
                                                onClick={() => updateChoice(slot.id, { outcome: undefined, pickedOutcome: undefined })}>
                                                Dùng YCCĐ của câu đã chọn
                                            </button>
                                        )}
                                        {source && <details className="text-xs text-stone-600">
                                            <summary className="cursor-pointer font-semibold text-amber-900">Đối chiếu YCCĐ chương trình</summary>
                                            <p className="mt-1 rounded bg-stone-50 p-2 leading-relaxed">{source}</p>
                                        </details>}
                                    </div>
                                    <div className="flex flex-wrap items-start gap-2 md:flex-col">
                                        {slot.canChoose ? <>
                                            <button type="button" className={candidate ? button : primary} aria-haspopup="dialog"
                                                onClick={() => setActiveId(slot.id)}>{candidate ? 'Đổi câu' : 'Chọn câu'}</button>
                                            {candidate && <>
                                                <button type="button" className="text-xs font-semibold text-amber-900 underline underline-offset-2"
                                                    onClick={() => autoPick([slot])}>Câu khác (ngẫu nhiên)</button>
                                                <p className="flex items-center gap-1 text-xs font-semibold text-emerald-800"><Check aria-hidden="true" className="size-3.5 shrink-0" />
                                                    {candidate.item.questionNo} · {chosenLesson ? textbookLessonLabel(chosenLesson) : candidate.lessonTitle ?? candidate.topic}
                                                </p>
                                                <button type="button" className="text-xs text-stone-600 underline underline-offset-2 hover:text-stone-900"
                                                    onClick={() => updateChoice(slot.id, { questionId: undefined, pickedOutcome: undefined, outcome: undefined })}>Bỏ chọn</button>
                                            </>}
                                        </> : slot.type === 'written' && <p className="text-xs text-stone-600">Dạng này chưa có trong kho.</p>}
                                    </div>
                                </div>;
                            })}
                        </div>
                    </div>;
                })}
            </div>
            {activeSlot && <MatrixPlanPicker key={activeSlot.id + ':' + (choices[activeSlot.id]?.lessonNumber ?? '')} slot={activeSlot}
                lesson={lessonFor(activeSlot)} candidates={candidates} selectedId={chosenBySlot.get(activeSlot.id)?.item.id} usedIds={usedIds}
                onClose={() => setActiveId(undefined)} onChoose={candidate => choose(activeSlot.id, candidate)} />}
        </section>
    );
}
