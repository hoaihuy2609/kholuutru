import { useEffect, useId, useMemo, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import type { StudyQuestionGroup } from '../types';
import type { SelectedQuestionItem } from '../src/services/examLatexService';
import { MATRIX_LEVELS, matrixMatch, type MatrixRow } from '../src/utils/examMatrix';
import { matrixPlanSlots, matchesMatrixPlanSlot, plannedOutcome, type MatrixAllocation, type MatrixPlanSlot } from '../src/utils/matrixPlan';
import { STUDY_QUESTION_GROUPS, STUDY_QUESTION_TYPES } from '../src/utils/studyLibrary';
import type { MatrixCandidate } from './ExamMatrixBuilder';
import { MatrixDialog, MatrixQuestionCard, MatrixSolutionDialog } from './MatrixQuestionCard';

const typeLabel = (type: MatrixAllocation['type']) => STUDY_QUESTION_TYPES.find(format => format.value === type)?.label ?? 'Tự luận';
const button = 'inline-flex min-h-9 items-center justify-center rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm font-semibold text-stone-800 hover:bg-stone-100';
const primary = 'inline-flex min-h-9 items-center justify-center rounded-lg bg-amber-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-900 disabled:opacity-50';
const input = 'block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm leading-5 text-stone-900 outline-none focus:border-amber-700 focus:ring-1 focus:ring-amber-700';
const pageSize = 12;

type Choice = { questionId?: string; outcome?: string; pickedOutcome?: string };

function MatrixPlanPicker({ slot, outcome, candidates, selectedId, usedIds, onChoose, onClose }: {
    slot: MatrixPlanSlot;
    outcome: string;
    candidates: MatrixCandidate[];
    selectedId?: string;
    usedIds: ReadonlySet<string>;
    onChoose: (candidate: MatrixCandidate) => void;
    onClose: () => void;
}) {
    const [group, setGroup] = useState<StudyQuestionGroup | ''>('');
    const [limit, setLimit] = useState(pageSize);
    const [preview, setPreview] = useState<MatrixCandidate>();
    const matches = useMemo(() => {
        const row: MatrixRow = { ...slot, section: '', count: 1, references: [], outcome };
        return candidates.filter(candidate => matchesMatrixPlanSlot(slot, candidate))
            .map(candidate => ({
                candidate,
                ...matrixMatch([row], { type: candidate.item.type, level: candidate.item.level, outcomes: candidate.outcomes }),
            }))
            .sort((a, b) => b.score - a.score);
    }, [candidates, slot, outcome]);
    const visible = group ? matches.filter(({ candidate }) => candidate.groups?.includes(group)) : matches;

    return (
        <MatrixDialog title={'Chọn câu · ' + slot.label}
            subtitle={[slot.topic, typeLabel(slot.type), MATRIX_LEVELS[slot.level]].join(' · ')}
            closeLabel="Đóng bộ chọn câu" onClose={onClose}>
            <div className="space-y-3">
                {outcome.trim() && <div className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                    <p className="font-semibold">YCCĐ của vị trí này</p>
                    <p className="whitespace-pre-wrap break-words">{outcome}</p>
                </div>}
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-stone-700" role="status">{visible.length} câu trong kho</p>
                    {slot.type === 'trac_nghiem' && <div className="flex flex-wrap gap-1.5" role="group" aria-label="Lọc nhóm trắc nghiệm">
                        {[{ value: '' as const, label: 'Tất cả' }, ...STUDY_QUESTION_GROUPS].map(({ value, label }) => (
                            <button key={value} type="button" aria-pressed={group === value}
                                className={group === value ? primary : button}
                                onClick={() => { setGroup(value); setLimit(pageSize); }}>{label}</button>
                        ))}
                    </div>}
                </div>
                {visible.length ? <div className="grid items-start gap-3 lg:grid-cols-2">
                    {visible.slice(0, limit).map(({ candidate, score, evidence }) => (
                        <MatrixQuestionCard key={candidate.item.id} candidate={candidate} score={score} evidence={evidence}
                            selected={candidate.item.id === selectedId} used={candidate.item.id !== selectedId && usedIds.has(candidate.item.id)}
                            showOutcomes onPreview={() => setPreview(candidate)} onChoose={() => onChoose(candidate)} />
                    ))}
                </div> : <p className="rounded-lg border border-stone-200 bg-white p-4 text-sm text-stone-600">
                    {group ? 'Nhóm này chưa có câu phù hợp. Xem Tất cả để rà các nhóm còn lại.'
                        : 'Kho chưa có câu được gắn đúng nội dung, loại câu và mức độ của vị trí này.'}
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

    function updateChoice(slotId: string, changes: Partial<Choice>) {
        setChoices(previous => ({ ...previous, [slotId]: { ...previous[slotId], ...changes } }));
    }

    function choose(slotId: string, candidate: MatrixCandidate) {
        const current = choices[slotId];
        if (current?.questionId === candidate.item.id) updateChoice(slotId, { questionId: undefined, pickedOutcome: undefined });
        else if (!usedIds.has(candidate.item.id)) {
            updateChoice(slotId, {
                questionId: candidate.item.id,
                pickedOutcome: undefined,
                outcome: current?.outcome?.trim() ? current.outcome : undefined,
            });
        }
        setActiveId(undefined);
    }

    if (!slots.length) return null;

    return (
        <section className="space-y-4 rounded-xl border border-stone-200 bg-white p-4" aria-labelledby={id}>
            <header className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 id={id} className="text-lg font-bold">Bản đặc tả</h2>
                    <p className="mt-0.5 text-sm text-stone-600">Điền YCCĐ để ưu tiên câu phù hợp hoặc chọn câu trước.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-amber-50 px-2.5 py-1.5 text-sm font-semibold tabular-nums text-amber-950" role="status">
                        Đã chọn {selectedSlots.length}/{selectableCount} câu
                    </span>
                    <button type="button" className={primary} disabled={!selectedSlots.length}
                        onClick={() => onCompose(selectedSlots.map(({ candidate }) => candidate.item))}>Biên soạn câu đã chọn</button>
                </div>
            </header>
            {pendingIdeas > 0 && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950">
                {pendingIdeas} ý Đúng/Sai đang chờ ghép. Bộ chọn ghép 4 ý cùng nội dung và mức độ thành một câu.
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
                                const fieldId = id + '-' + slot.id;
                                return <div key={slot.id} className="grid gap-3 px-3 py-3 md:grid-cols-[minmax(9.5rem,0.7fr)_minmax(0,2fr)_minmax(8rem,0.6fr)]">
                                    <div className="space-y-0.5">
                                        <p className="text-sm font-semibold">{typeLabel(slot.type)}</p>
                                        <p className="text-xs text-stone-600">{slot.label} · {MATRIX_LEVELS[slot.level]}{slot.units === 4 ? ' · 4 ý' : ''}</p>
                                    </div>
                                    <div className="min-w-0 space-y-1.5">
                                        <label htmlFor={fieldId} className="text-xs font-semibold text-stone-700">Yêu cầu cần đạt</label>
                                        <textarea id={fieldId} rows={2} className={input + ' resize-y'} value={outcome}
                                            placeholder="Nhập yêu cầu cần đạt"
                                            onChange={event => updateChoice(slot.id, { outcome: event.target.value })} />
                                        {candidate && candidate.outcomes.length > 1 && <select aria-label={'Lấy YCCĐ từ ' + slot.label}
                                            value={candidate.outcomes.includes(outcome) ? outcome : ''}
                                            className={input} onChange={event => {
                                                const pickedOutcome = event.target.value;
                                                if (pickedOutcome) updateChoice(slot.id, { pickedOutcome, outcome: undefined });
                                            }}>
                                            <option value="">Lấy một YCCĐ từ câu đã chọn…</option>
                                            {candidate.outcomes.map(value => <option key={value} value={value}>{value}</option>)}
                                        </select>}
                                        {candidate?.outcomes.length === 1 && outcome !== candidate.outcomes[0] && (
                                            <button type="button" className="text-xs font-semibold text-amber-900 underline underline-offset-2"
                                                onClick={() => updateChoice(slot.id, { outcome: undefined, pickedOutcome: undefined })}>
                                                Dùng YCCĐ của câu đã chọn
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap items-start gap-2 md:flex-col">
                                        {slot.canChoose ? <>
                                            <button type="button" className={candidate ? button : primary} aria-haspopup="dialog"
                                                onClick={() => setActiveId(slot.id)}>{candidate ? 'Đổi câu' : 'Chọn câu'}</button>
                                            {candidate && <>
                                                <p className="flex items-center gap-1 text-xs font-semibold text-emerald-800"><Check aria-hidden="true" className="size-3.5 shrink-0" />
                                                    {candidate.item.questionNo} · {candidate.lessonTitle ?? candidate.topic}
                                                </p>
                                                <button type="button" className="text-xs text-stone-600 underline underline-offset-2 hover:text-stone-900"
                                                    onClick={() => updateChoice(slot.id, { questionId: undefined, pickedOutcome: undefined })}>Bỏ chọn</button>
                                            </>}
                                        </> : slot.type === 'written' && <p className="text-xs text-stone-600">Dạng này chưa có trong kho.</p>}
                                    </div>
                                </div>;
                            })}
                        </div>
                    </div>;
                })}
            </div>
            {activeSlot && <MatrixPlanPicker key={activeSlot.id} slot={activeSlot}
                outcome={outcomeFor(activeSlot.id, chosenBySlot.get(activeSlot.id))}
                candidates={candidates} selectedId={chosenBySlot.get(activeSlot.id)?.item.id} usedIds={usedIds}
                onClose={() => setActiveId(undefined)} onChoose={candidate => choose(activeSlot.id, candidate)} />}
        </section>
    );
}
