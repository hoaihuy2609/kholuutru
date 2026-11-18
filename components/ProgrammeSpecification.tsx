import { Fragment, useId, useMemo, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import type { SelectedQuestionItem } from '../src/services/examLatexService';
import { PHYSICS_10_CURRICULUM_SOURCE } from '../src/data/physics10Curriculum';
import { programmeRowLabel, type ProgrammeRow } from '../src/data/programmeRows';
import { COGNITIVE_LEVELS, questionLevels } from '../src/utils/cognitiveLevels';
import { statementCountsLabel, trueFalseCounts, type MatrixAllocation, type StatementCounts } from '../src/utils/matrixPlan';
import { emptyProgrammeState, fillProgrammeCells, levelMismatch, programmeCellKey, programmeIssues, programmePools,
    programmeRowQuestions, programmeSelections, programmeTopicTotals, programmeUsedIds, suggestProgramme, suggestTrueFalse,
    PROGRAMME_TYPE_LABELS, type ProgrammeCellType, type ProgrammePools, type ProgrammeState, type ProgrammeTopic, type ProgrammeType } from '../src/utils/programmeSpec';
import type { MatrixCandidate } from './ExamMatrixBuilder';
import { MatrixDialog, MatrixQuestionCard, MatrixSolutionDialog } from './MatrixQuestionCard';
import MatrixExportDialog from './MatrixExportDialog';

const button = 'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm font-semibold text-stone-800 hover:bg-stone-100 disabled:opacity-50';
const primary = 'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-amber-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-900 disabled:opacity-50';
const LEVELS = [1, 2, 3] as const;
const SHORT = ['', 'Biết', 'Hiểu', 'VD'];
const TYPES: readonly ProgrammeType[] = ['trac_nghiem', 'dung_sai', 'tu_luan'];
const levelBand = ['', 'bg-sky-50', 'bg-amber-50', 'bg-rose-50'];
const levelHead = ['', 'bg-sky-100 text-sky-950', 'bg-amber-100 text-amber-950', 'bg-rose-100 text-rose-950'];
const td = 'border border-stone-200 p-0 align-top';
const th = 'border border-stone-200 px-2 py-1.5 text-xs font-semibold';
/** Mã năng lực ghi tạm theo mức: Biết, Hiểu → NLa (nhận thức vật lí); Vận dụng → NLc (vận dụng kiến thức, kĩ năng). */
const competence = (level: number) => level === 3 ? 'NLc' : 'NLa';

type Open = { row: ProgrammeRow; topic: ProgrammeTopic; type: ProgrammeCellType; level: number } | { row: ProgrammeRow; topic: ProgrammeTopic; type: 'dung_sai' };

export default function ProgrammeSpecification({ allocations, topics, candidates, onCompose }: {
    allocations: MatrixAllocation[];
    topics: ProgrammeTopic[];
    candidates: MatrixCandidate[];
    onCompose: (questions: SelectedQuestionItem[]) => void;
}) {
    const id = useId();
    const [state, setState] = useState<ProgrammeState>(emptyProgrammeState);
    const [open, setOpen] = useState<Open>();
    const [note, setNote] = useState('');
    const pools = useMemo(() => programmePools(candidates), [candidates]);
    const byId = pools.byId;
    const issues = programmeIssues(topics, state, byId);
    const { selections, codes } = programmeSelections(allocations, topics, state, byId);
    const used = programmeUsedIds(state);
    const types = TYPES.filter(type => topics.some(topic => topic.need[type].some(Boolean)));
    const written = topics.reduce((sum, topic) => sum + topic.need.written.reduce((a, b) => a + b, 0), 0);
    const assigned = new Set([...pools.byId.keys()]);
    const unassigned = candidates.filter(candidate => topics.some(topic => topic.chapterId === candidate.chapterId) && !assigned.has(candidate.item.id)).length;

    const parts = types.map(type => {
        const need = topics.reduce((sum, topic) => sum + topic.need[type].reduce((a, b) => a + b, 0), 0);
        const done = type === 'dung_sai'
            ? topics.reduce((sum, topic) => sum + topic.rows.reduce((count, row) => count + (state.trueFalse[row.id]?.length ?? 0), 0), 0)
            : selections.filter(selection => selection.slot.type === type).length;
        return { type, need: type === 'dung_sai' ? Math.floor(need / 4) : need, done };
    });

    function suggest() {
        const next = suggestProgramme(topics, pools);
        setState(next);
        const left = programmeIssues(topics, next, byId).length;
        setNote(left ? 'Đã chia và chọn câu. Còn ' + left + ' mục chưa khớp, xem khung đỏ bên dưới.' : 'Đã chia và chọn đủ câu theo ma trận. Giáo viên rà lại từng dòng trước khi xuất.');
    }

    return (
        <section className="space-y-4 rounded-xl border border-stone-200 bg-white p-4 sm:p-5" aria-labelledby={id}>
            <header className="space-y-2">
                <h2 id={id} className="text-lg font-bold">Bản đặc tả theo yêu cầu cần đạt</h2>
                <p className="max-w-3xl text-sm text-stone-600">Mỗi dòng là một YCCĐ của chương trình (Thông tư 32/2018), cố định. Chia số câu của ma trận vào từng dòng, rồi bấm vào ô để chọn câu trong kho đã được rót vào đúng dòng đó.</p>
                <ol className="flex flex-wrap gap-2 text-sm">
                    {['Chia số câu vào từng dòng YCCĐ', 'Bấm vào ô để chọn câu', 'Xuất ma trận và bản đặc tả'].map((step, index) =>
                        <li key={step} className="inline-flex items-center gap-2 rounded-full border border-stone-200 px-3 py-1">
                            <span className="grid size-5 place-items-center rounded-full bg-amber-800 text-xs font-bold text-white">{index + 1}</span>{step}
                        </li>)}
                </ol>
            </header>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-stone-50 p-3">
                <ul className="flex flex-wrap gap-2" aria-label="Tiến độ chọn câu">
                    {parts.map(part => <li key={part.type} className={'rounded-full px-3 py-1 text-sm font-semibold tabular-nums '
                        + (part.done === part.need ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-950')}>
                        {PROGRAMME_TYPE_LABELS[part.type]} {part.done}/{part.need} câu</li>)}
                    <li className={'rounded-full px-3 py-1 text-sm font-semibold ' + (issues.length ? 'bg-red-100 text-red-900' : 'bg-emerald-100 text-emerald-900')}>
                        {issues.length ? issues.length + ' mục chưa khớp ma trận' : 'Đã khớp ma trận'}</li>
                </ul>
                <div className="flex flex-wrap gap-2">
                    <button type="button" className={primary} onClick={suggest}>Gợi ý chia và chọn câu</button>
                    <button type="button" className={button} disabled={!Object.keys(state.counts).length && !Object.keys(state.trueFalse).length}
                        onClick={() => { setState(emptyProgrammeState()); setNote('Đã xóa. Bấm vào từng ô để tự chia.'); }}>Xóa để tự chia</button>
                </div>
            </div>
            {note && <p className="text-sm text-stone-700" role="status">{note}</p>}

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-600" aria-label="Chú thích">
                {LEVELS.map(level => <span key={level} className="inline-flex items-center gap-1.5"><span className={'size-3 rounded-sm border border-stone-300 ' + levelBand[level]} />{COGNITIVE_LEVELS[level]}</span>)}
                <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-sm border border-stone-300 bg-[repeating-linear-gradient(45deg,#e7e5e4_0_2px,transparent_2px_5px)]" />Kho không có câu cho ô này</span>
                <span>Mã xanh: câu đã chọn · chữ cam: còn thiếu</span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-stone-200">
                <table className="w-full min-w-[56rem] border-collapse text-sm">
                    <thead className="bg-stone-100 text-center">
                        <tr>
                            <th rowSpan={2} className={th + ' w-28'}>Nội dung</th>
                            <th rowSpan={2} className={th + ' min-w-[16rem] text-left'}>Yêu cầu cần đạt</th>
                            <th rowSpan={2} className={th + ' w-12'}>Câu</th>
                            {types.map(type => <th key={type} colSpan={3} className={th}>{PROGRAMME_TYPE_LABELS[type]}{type === 'dung_sai' ? ' (ý)' : ''}</th>)}
                        </tr>
                        <tr>{types.map(type => LEVELS.map(level => <th key={type + level} className={th + ' w-20 ' + levelHead[level]}>{SHORT[level]}</th>))}</tr>
                    </thead>
                    <tbody>
                        {topics.map(topic => {
                            const totals = programmeTopicTotals(topic, state, byId);
                            return <Fragment key={topic.key}>
                                {topic.rows.map((row, index) => <tr key={row.id}>
                                    {index === 0 && <th scope="rowgroup" rowSpan={topic.rows.length + 1} className={th + ' bg-white text-left align-top'}>{topic.topic}</th>}
                                    <td className={td + ' px-2 py-2'}>
                                        <p className="font-mono text-[11px] text-stone-500">{programmeRowLabel(row)} · {row.levels.length ? 'mức theo động từ: ' + row.levels.map(level => COGNITIVE_LEVELS[level]).join(', ') : 'thực hành; câu trên giấy là mở rộng'}</p>
                                        <p className="leading-snug">{row.text}</p>
                                    </td>
                                    <td className={td + ' px-2 py-2 text-center font-semibold tabular-nums'}>{programmeRowQuestions(row, state) || ''}</td>
                                    {types.map(type => LEVELS.map(level => <td key={type + level} className={td + ' ' + levelBand[level]}>
                                        {type === 'dung_sai' ? trueFalseCell(topic, row, level) : cell(topic, row, type, level)}
                                    </td>))}
                                </tr>)}
                                <tr className="bg-stone-50 text-center text-xs tabular-nums">
                                    <th scope="row" colSpan={2} className={th + ' text-right font-normal text-stone-600'}>Đã chia / ma trận cần</th>
                                    {types.map(type => LEVELS.map(level => {
                                        const need = topic.need[type][level - 1];
                                        const got = totals[type][level - 1];
                                        return <td key={type + level} className={'border border-stone-200 px-1 py-1 font-semibold '
                                            + (!need && !got ? '' : got === need ? 'text-emerald-800' : got < need ? 'text-amber-800' : 'text-red-700')}>
                                            {need || got ? got + '/' + need : ''}</td>;
                                    }))}
                                </tr>
                            </Fragment>;
                        })}
                    </tbody>
                </table>
            </div>

            {issues.length > 0 && <details className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-950" open={issues.length <= 6}>
                <summary className="cursor-pointer font-semibold">{issues.length} mục chưa khớp ma trận</summary>
                <ul className="mt-2 list-disc space-y-1 pl-5">{issues.map(issue => <li key={issue}>{issue}</li>)}</ul>
            </details>}

            <ul className="list-disc space-y-1 pl-5 text-xs leading-relaxed text-stone-600">
                <li>Dòng YCCĐ lấy nguyên văn từ {PHYSICS_10_CURRICULUM_SOURCE} YCCĐ có hai vế ở hai mức được tách thành dòng a (nêu) và b (vận dụng).</li>
                <li>Mã năng lực ghi tạm: Biết, Hiểu → NLa (nhận thức vật lí); Vận dụng → NLc (vận dụng kiến thức, kĩ năng).</li>
                <li>"Lệch mức": mức của ô khác mức mà động từ của YCCĐ hướng tới. Vẫn chọn được, giáo viên tự quyết.</li>
                {unassigned > 0 && <li>{unassigned} câu của chương chưa gắn dòng YCCĐ hoặc nằm ngoài chương trình nên không hiện trong bảng.</li>}
                {written > 0 && <li>Ma trận có {written} câu tự luận; kho chưa có câu tự luận nên cần soạn riêng.</li>}
            </ul>

            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-4">
                <p className="text-sm text-stone-700">{issues.length ? 'Đã chọn ' + selections.length + ' câu. Có thể xuất bản nháp để xem trước.' : 'Đã chọn đủ câu. Bước tiếp: xuất ma trận, bản đặc tả và biên soạn đề.'}</p>
                <div className="flex flex-wrap gap-2">
                    <MatrixExportDialog allocations={allocations} selections={selections} />
                    <button type="button" className={issues.length ? button : primary} disabled={!selections.length}
                        onClick={() => onCompose(selections.map(selection => selection.item))}>Biên soạn đề ({selections.length} câu)</button>
                </div>
            </footer>

            {open && <CellPicker open={open} state={state} pools={pools} codes={codes} used={used}
                onChange={setState} onClose={() => setOpen(undefined)} />}
        </section>
    );

    function cell(topic: ProgrammeTopic, row: ProgrammeRow, type: ProgrammeCellType, level: number) {
        const key = programmeCellKey(row.id, type, level);
        const count = state.counts[key] ?? 0;
        const have = pools.cells.get(key)?.length ?? 0;
        if (!count && !have) return <div aria-label="Kho không có câu cho ô này" className="h-full min-h-14 bg-[repeating-linear-gradient(45deg,#e7e5e4_0_2px,transparent_2px_6px)]" />;
        const chosen = (state.picks[key] ?? []).filter(id => byId.has(id));
        const missing = count - chosen.length;
        const offLevel = count > 0 && row.levels.length > 0 && !row.levels.includes(level as 1 | 2 | 3);
        return <button type="button" aria-haspopup="dialog" onClick={() => setOpen({ row, topic, type, level })}
            aria-label={programmeRowLabel(row) + ', ' + PROGRAMME_TYPE_LABELS[type] + ' ' + COGNITIVE_LEVELS[level] + ': ' + count + ' câu, kho có ' + have}
            className="flex min-h-14 w-full flex-col items-center justify-start gap-0.5 px-1 py-1.5 text-center hover:bg-white/80 focus-visible:outline-2 focus-visible:outline-amber-700">
            {count > 0 && <>
                <span className="text-base font-bold leading-none">{count}</span>
                <span className="text-[11px] text-stone-600">({competence(level)})</span>
                <span className="font-mono text-[11px] leading-tight text-emerald-800">{chosen.map(id => codes.get(id) ?? '·').join(', ')}</span>
                {missing > 0 && <span className="text-[11px] font-semibold text-amber-800">{missing} chưa chọn</span>}
                {offLevel && <span className="text-[11px] font-semibold text-orange-700">lệch mức</span>}
            </>}
            <span className="text-[11px] text-stone-500">kho {have}</span>
        </button>;
    }

    function trueFalseCell(topic: ProgrammeTopic, row: ProgrammeRow, level: number) {
        const items = (state.trueFalse[row.id] ?? []).flatMap(questionId => {
            const candidate = byId.get(questionId);
            return candidate ? questionLevels(candidate.item).flatMap((value, index) =>
                value === level ? [(codes.get(questionId) ?? 'C') + 'abcd'[index]] : []) : [];
        });
        const available = (pools.trueFalse.get(row.id) ?? []).some(candidate => questionLevels(candidate.item).includes(level));
        if (!items.length && !available) return <div aria-label="Kho không có ý Đúng/Sai ở mức này" className="h-full min-h-14 bg-[repeating-linear-gradient(45deg,#e7e5e4_0_2px,transparent_2px_6px)]" />;
        const offLevel = items.length > 0 && row.levels.length > 0 && !row.levels.includes(level as 1 | 2 | 3);
        return <button type="button" aria-haspopup="dialog" onClick={() => setOpen({ row, topic, type: 'dung_sai' })}
            aria-label={programmeRowLabel(row) + ', Đúng/Sai ' + COGNITIVE_LEVELS[level] + ': ' + items.length + ' ý'}
            className="flex min-h-14 w-full flex-col items-center justify-start gap-0.5 px-1 py-1.5 text-center hover:bg-white/80 focus-visible:outline-2 focus-visible:outline-amber-700">
            {items.length ? <>
                <span className="text-base font-bold leading-none">{items.length}</span>
                <span className="text-[11px] text-stone-600">({competence(level)})</span>
                <span className="font-mono text-[11px] leading-tight text-emerald-800">{items.join(', ')}</span>
                {offLevel && <span className="text-[11px] font-semibold text-orange-700">lệch mức</span>}
            </> : <span className="text-[11px] text-stone-500">chọn câu</span>}
        </button>;
    }
}

function CellPicker({ open, state, pools, codes, used, onChange, onClose }: {
    open: Open;
    state: ProgrammeState;
    pools: ProgrammePools<MatrixCandidate>;
    codes: ReadonlyMap<string, string>;
    used: ReadonlySet<string>;
    onChange: (state: ProgrammeState) => void;
    onClose: () => void;
}) {
    const [preview, setPreview] = useState<MatrixCandidate>();
    const { row, topic } = open;
    const totals = programmeTopicTotals(topic, state, pools.byId);
    const extended = (candidate: MatrixCandidate) => candidate.programmeMatch === 'extended'
        ? <span className="rounded bg-orange-50 px-2 py-0.5 font-semibold text-orange-900">mở rộng so với YCCĐ</span> : null;
    const codeBadge = (candidate: MatrixCandidate) => codes.get(candidate.item.id)
        ? <span className="rounded bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-900">{codes.get(candidate.item.id)} trong đề</span> : null;

    if (open.type === 'dung_sai') {
        const mine = new Set(state.trueFalse[row.id] ?? []);
        const need = topic.need.dung_sai;
        const left = need.map((value, index) => value - totals.dung_sai[index]) as unknown as StatementCounts;
        const options = (pools.trueFalse.get(row.id) ?? []).filter(candidate => mine.has(candidate.item.id) || !used.has(candidate.item.id))
            .sort((a, b) => Number(mine.has(b.item.id)) - Number(mine.has(a.item.id))
                || levelMismatch(row, questionLevels(a.item)) - levelMismatch(row, questionLevels(b.item)));
        const toggle = (questionId: string) => {
            const list = state.trueFalse[row.id] ?? [];
            onChange({ ...state, trueFalse: { ...state.trueFalse, [row.id]: list.includes(questionId) ? list.filter(item => item !== questionId) : [...list, questionId] } });
        };
        return <MatrixDialog title={programmeRowLabel(row) + ' · Đúng/Sai'} subtitle={topic.topic + ' · ' + row.text} closeLabel="Đóng chọn câu" onClose={onClose}>
            <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-200 bg-white p-3 text-sm">
                    <p>Nội dung còn cần <strong>{statementCountsLabel(left.map(value => Math.max(0, value)) as unknown as StatementCounts) || '0 ý'}</strong>
                        <span className="text-stone-600"> · ma trận cần {statementCountsLabel(need as unknown as StatementCounts) || '0 ý'}</span></p>
                    <button type="button" className={button} onClick={() => {
                        const next = suggestTrueFalse(topic, state, pools);
                        if (next) onChange(next);
                    }}>Gợi ý lại Đúng/Sai cho cả nội dung</button>
                </div>
                <p className="text-xs text-stone-600">Mỗi câu Đúng/Sai có 4 ý; các ý được đếm vào cột đúng mức của chúng. Câu của các dòng khác trong cùng nội dung cũng được tính.</p>
                {options.length ? <div className="grid items-start gap-3 lg:grid-cols-2">
                    {options.map(candidate => {
                        const counts = trueFalseCounts(candidate.item)!;
                        const fits = mine.has(candidate.item.id) || counts.every((value, index) => value <= left[index]);
                        return <MatrixQuestionCard key={candidate.item.id} candidate={candidate} score={0} evidence={[]} showOutcomes
                            selected={mine.has(candidate.item.id)} used={false} blockedLabel={fits ? undefined : 'Vượt số ý ma trận cần'}
                            badges={<>{codeBadge(candidate)}{extended(candidate)}
                                <span className={'rounded px-2 py-0.5 font-semibold ' + (fits ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-900')}>{statementCountsLabel(counts)}</span>
                                {levelMismatch(row, questionLevels(candidate.item)) > 0 && <span className="rounded bg-orange-50 px-2 py-0.5 font-semibold text-orange-900">lệch mức</span>}</>}
                            onPreview={() => setPreview(candidate)} onChoose={() => toggle(candidate.item.id)} />;
                    })}
                </div> : <p className="rounded-lg border border-stone-200 bg-white p-4 text-sm text-stone-600">Dòng này chưa có câu Đúng/Sai trong kho.</p>}
            </div>
            {preview && <MatrixSolutionDialog candidate={preview} onClose={() => setPreview(undefined)} />}
        </MatrixDialog>;
    }

    const { type, level } = open;
    const key = programmeCellKey(row.id, type, level);
    const count = state.counts[key] ?? 0;
    const pool = pools.cells.get(key) ?? [];
    const chosen = new Set(state.picks[key] ?? []);
    const options = pool.filter(candidate => chosen.has(candidate.item.id) || !used.has(candidate.item.id))
        .sort((a, b) => Number(chosen.has(b.item.id)) - Number(chosen.has(a.item.id))
            || Number(a.programmeMatch === 'extended') - Number(b.programmeMatch === 'extended'));
    const need = topic.need[type][level - 1];
    const setCount = (value: number) => {
        const next = Math.max(0, Math.min(pool.length, value));
        onChange({ ...state, counts: { ...state.counts, [key]: next }, picks: { ...state.picks, [key]: (state.picks[key] ?? []).slice(0, next) } });
    };
    const toggle = (questionId: string) => {
        const list = state.picks[key] ?? [];
        if (list.includes(questionId)) onChange({ ...state, picks: { ...state.picks, [key]: list.filter(item => item !== questionId) } });
        else if (list.length < count) onChange({ ...state, picks: { ...state.picks, [key]: [...list, questionId] } });
    };
    return <MatrixDialog title={programmeRowLabel(row) + ' · ' + PROGRAMME_TYPE_LABELS[type] + ' · ' + COGNITIVE_LEVELS[level]}
        subtitle={topic.topic + ' · ' + row.text} closeLabel="Đóng chọn câu" onClose={onClose}>
        <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-stone-200 bg-white p-3 text-sm">
                <span className="font-semibold">Số câu của ô</span>
                <div className="inline-flex items-center overflow-hidden rounded-lg border border-stone-300" role="group" aria-label="Số câu của ô">
                    <button type="button" className="grid size-9 place-items-center hover:bg-stone-100 disabled:opacity-40" aria-label="Bớt một câu"
                        disabled={count <= 0} onClick={() => setCount(count - 1)}><Minus aria-hidden="true" className="size-4" /></button>
                    <output className="w-10 text-center font-bold tabular-nums">{count}</output>
                    <button type="button" className="grid size-9 place-items-center hover:bg-stone-100 disabled:opacity-40" aria-label="Thêm một câu"
                        disabled={count >= pool.length} onClick={() => setCount(count + 1)}><Plus aria-hidden="true" className="size-4" /></button>
                </div>
                <span className="text-stone-600">Nội dung đã chia {totals[type][level - 1]}/{need} câu {COGNITIVE_LEVELS[level]} · kho có {pool.length} câu cho ô này</span>
                {row.levels.length > 0 && !row.levels.includes(level as 1 | 2 | 3) && <span className="rounded bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-900">Lệch mức: động từ của YCCĐ hướng tới {row.levels.map(value => COGNITIVE_LEVELS[value]).join(', ')}</span>}
                <button type="button" className={button + ' ml-auto'} disabled={!count || chosen.size >= count}
                    onClick={() => onChange(fillProgrammeCells(state, pools, [key]))}>Tự chọn cho đủ {count} câu</button>
            </div>
            {options.length ? <div className="grid items-start gap-3 lg:grid-cols-2">
                {options.map(candidate => <MatrixQuestionCard key={candidate.item.id} candidate={candidate} score={0} evidence={[]} showOutcomes
                    selected={chosen.has(candidate.item.id)} used={false}
                    blockedLabel={count === 0 ? 'Tăng số câu của ô trước' : chosen.size >= count ? 'Ô đã đủ ' + count + ' câu' : undefined}
                    badges={<>{codeBadge(candidate)}{extended(candidate)}</>}
                    onPreview={() => setPreview(candidate)} onChoose={() => toggle(candidate.item.id)} />)}
            </div> : <p className="rounded-lg border border-stone-200 bg-white p-4 text-sm text-stone-600">Kho không còn câu cho ô này.</p>}
        </div>
        {preview && <MatrixSolutionDialog candidate={preview} onClose={() => setPreview(undefined)} />}
    </MatrixDialog>;
}
