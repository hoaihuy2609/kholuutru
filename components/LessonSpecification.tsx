import { useId, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { SelectedQuestionItem } from '../src/services/examLatexService';
import { PHYSICS_10_CURRICULUM_SOURCE } from '../src/data/physics10Curriculum';
import { LESSON_LINES, lessonLineSource, type LessonLine } from '../src/data/lessonLines';
import { COGNITIVE_LEVELS } from '../src/utils/cognitiveLevels';
import { statementCountsLabel, trueFalseCounts, type MatrixAllocation, type StatementCounts } from '../src/utils/matrixPlan';
import { LESSON_TYPE_LABELS, LESSON_TYPES, lessonIssues, lessonPool, lessonSelections, lessonStatus, lessonTotals, suggestLessons,
    type LessonPool, type LessonTopic, type LessonType, type LessonUnit } from '../src/utils/lessonSpec';
import type { MatrixCandidate } from './ExamMatrixBuilder';
import { MatrixDialog, MatrixQuestionCard, MatrixSolutionDialog } from './MatrixQuestionCard';
import MatrixExportDialog from './MatrixExportDialog';

const button = 'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm font-semibold text-stone-800 hover:bg-stone-100 disabled:opacity-50';
const primary = 'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-amber-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-900 disabled:opacity-50';
const LEVELS = [1, 2, 3] as const;
const levelTab = ['', 'aria-pressed:border-sky-600 aria-pressed:bg-sky-50 aria-pressed:text-sky-950',
    'aria-pressed:border-amber-600 aria-pressed:bg-amber-50 aria-pressed:text-amber-950',
    'aria-pressed:border-rose-600 aria-pressed:bg-rose-50 aria-pressed:text-rose-950'];
const codeColor: Record<LessonType, string> = { trac_nghiem: 'bg-blue-50 text-blue-900', dung_sai: 'bg-violet-50 text-violet-900', tu_luan: 'bg-amber-50 text-amber-950' };
const sourceBadge = (line: LessonLine) => line.source === 'SGV' ? null
    : <span className={'ml-1.5 inline-block whitespace-nowrap rounded-full border px-2 py-px align-middle text-[11px] font-semibold '
        + (line.source === 'DX' ? 'border-orange-300 bg-orange-50 text-orange-900' : 'border-stone-300 text-stone-600')}>{lessonLineSource(line)}</span>;

/** Mở chọn câu cho một dòng YCCĐ (hoặc các câu chưa khớp dòng nào, line = undefined) của một bài, ở một mức. */
type Open = { topic: LessonTopic; level: number; line?: LessonLine };

export default function LessonSpecification({ allocations, topics, candidates, onCompose }: {
    allocations: MatrixAllocation[];
    topics: LessonTopic[];
    candidates: MatrixCandidate[];
    onCompose: (questions: SelectedQuestionItem[]) => void;
}) {
    const id = useId();
    const chapterIds = useMemo(() => [...new Set(topics.map(topic => topic.chapterId))], [topics]);
    const pool = useMemo(() => lessonPool(candidates, chapterIds), [candidates, chapterIds]);
    const [chosen, setChosen] = useState<ReadonlySet<string>>(() => new Set());
    const [note, setNote] = useState('');
    const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set(topics.slice(0, 1).map(topic => topic.key)));
    const [levels, setLevels] = useState<Record<string, number>>({});
    const [open, setOpen] = useState<Open>();
    const byId = pool.byId;
    const issues = lessonIssues(topics, chosen, byId);
    const { selections, codes } = lessonSelections(allocations, topics, chosen, byId);
    const types = LESSON_TYPES.filter(type => topics.some(topic => topic.need[type].some(Boolean)));
    const written = topics.reduce((sum, topic) => sum + topic.need.written.reduce((a, b) => a + b, 0), 0);
    const unassigned = candidates.filter(candidate => candidate.chapterId && chapterIds.includes(candidate.chapterId) && !byId.has(candidate.item.id)).length;
    const code = (candidate: MatrixCandidate) => codes.get(candidate.item.id);

    const parts = types.map(type => {
        const need = topics.reduce((sum, topic) => sum + topic.need[type].reduce((a, b) => a + b, 0), 0);
        const done = [...chosen].filter(questionId => byId.get(questionId)?.item.type === type).length;
        return { type, need: type === 'dung_sai' ? Math.floor(need / 4) : need, done };
    });

    function suggest() {
        const next = suggestLessons(topics, pool);
        setChosen(next.chosen);
        setNote(next.notes.length ? next.notes.join(' ') : 'Đã chọn đủ câu theo ma trận. Giáo viên rà lại từng dòng trước khi xuất.');
    }

    function toggle(questionId: string) {
        setChosen(previous => {
            const next = new Set(previous);
            if (next.has(questionId)) next.delete(questionId); else next.add(questionId);
            return next;
        });
    }

    return (
        <section className="space-y-4 rounded-xl border border-stone-200 bg-white p-4 sm:p-5" aria-labelledby={id}>
            <header className="space-y-2">
                <h2 id={id} className="text-lg font-bold">Bản đặc tả theo bài</h2>
                <p className="max-w-3xl text-sm text-stone-600">Mỗi bài có yêu cầu cần đạt ở ba mức. Câu nào thuộc mức nào thì nằm ở mức đó. Bấm vào bài, chọn mức, rồi bấm "Chọn câu" ở dòng yêu cầu để xem và chọn câu trong kho.</p>
                <ol className="flex flex-wrap gap-2 text-sm">
                    {['Mở bài và chọn mức', 'Chọn câu theo từng dòng yêu cầu', 'Xuất ma trận và bản đặc tả'].map((step, index) =>
                        <li key={step} className="inline-flex items-center gap-2 rounded-full border border-stone-200 px-3 py-1">
                            <span className="grid size-5 place-items-center rounded-full bg-amber-800 text-xs font-bold text-white">{index + 1}</span>{step}
                        </li>)}
                </ol>
            </header>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-stone-50 p-3">
                <ul className="flex flex-wrap gap-2" aria-label="Tiến độ chọn câu">
                    {parts.map(part => <li key={part.type} className={'rounded-full px-3 py-1 text-sm font-semibold tabular-nums '
                        + (part.done === part.need ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-950')}>
                        {LESSON_TYPE_LABELS[part.type]} {part.done}/{part.need} câu</li>)}
                    <li className={'rounded-full px-3 py-1 text-sm font-semibold ' + (issues.length ? 'bg-red-100 text-red-900' : 'bg-emerald-100 text-emerald-900')}>
                        {issues.length ? issues.length + ' mục chưa khớp ma trận' : 'Đã khớp ma trận'}</li>
                </ul>
                <div className="flex flex-wrap gap-2">
                    <button type="button" className={primary} onClick={suggest}>Gợi ý chọn câu</button>
                    <button type="button" className={button} disabled={!chosen.size}
                        onClick={() => { setChosen(new Set()); setNote('Đã xóa. Mở từng bài để tự chọn câu.'); }}>Xóa để tự chọn</button>
                </div>
            </div>
            {note && <p className="text-sm text-stone-700" role="status">{note}</p>}

            <div className="space-y-3">
                {topics.map(topic => {
                    const status = lessonStatus(topic, chosen, byId);
                    const needAny = LESSON_TYPES.some(type => topic.need[type].some(Boolean));
                    const isOpen = expanded.has(topic.key);
                    const level = levels[topic.key] ?? 1;
                    const panelId = id + '-' + topic.key;
                    return <section key={topic.key} className="overflow-hidden rounded-xl border border-stone-200">
                        <h3>
                            <button type="button" aria-expanded={isOpen} aria-controls={panelId}
                                className="grid min-h-12 w-full grid-cols-[1.25rem_minmax(0,1fr)] items-center gap-x-2 gap-y-1 px-4 py-2.5 text-left hover:bg-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-amber-700 sm:grid-cols-[1.25rem_minmax(0,1fr)_auto]"
                                onClick={() => setExpanded(previous => {
                                    const next = new Set(previous);
                                    if (next.has(topic.key)) next.delete(topic.key); else next.add(topic.key);
                                    return next;
                                })}>
                                <ChevronDown aria-hidden="true" className={'size-4 text-stone-500 ' + (isOpen ? '' : '-rotate-90')} />
                                <span className="font-bold">{topic.lesson.name}</span>
                                <span className={'col-start-2 text-sm font-semibold sm:col-start-3 ' + (!needAny ? 'text-stone-500' : status.done ? 'text-emerald-800' : 'text-red-700')}>
                                    {!needAny ? 'Không lấy câu' : status.done ? 'Đủ ' + status.questions + ' câu'
                                        : [status.missing.length && 'Còn thiếu ' + status.missing.join(', '), status.over.length && 'Thừa ' + status.over.join(', ')].filter(Boolean).join(' · ')}
                                </span>
                            </button>
                        </h3>
                        <div id={panelId} hidden={!isOpen} className="border-t border-stone-200">
                            <LevelTabs topic={topic} level={level} chosen={chosen} pool={pool} onSelect={value => setLevels(previous => ({ ...previous, [topic.key]: value }))} />
                            <LineList topic={topic} level={level} chosen={chosen} pool={pool} code={code} onOpen={setOpen} />
                        </div>
                    </section>;
                })}
            </div>

            {issues.length > 0 && <details className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-950" open={issues.length <= 6}>
                <summary className="cursor-pointer font-semibold">{issues.length} mục chưa khớp ma trận</summary>
                <ul className="mt-2 list-disc space-y-1 pl-5">{issues.map(issue => <li key={issue}>{issue}</li>)}</ul>
            </details>}

            <ul className="list-disc space-y-1 pl-5 text-xs leading-relaxed text-stone-600">
                <li>Yêu cầu cần đạt lấy nguyên văn mục tiêu bài học SGV Vật lí 10 (Kết nối tri thức). Dòng ghi "CT" là vế nguyên văn YCCĐ của {PHYSICS_10_CURRICULUM_SOURCE}</li>
                <li>Dòng "CT, chương trước" là YCCĐ của chương trước mà ý hỗ trợ trong câu dùng tới. Dòng "Đề xuất, GV đã duyệt" do người soạn viết cho phần SGV và Chương trình chưa có câu chữ ở đúng mức.</li>
                <li>Mức của câu, ý: nhắc lại là Nhận biết; định tính, không tính ra số là Thông hiểu; có tính toán ra số là Vận dụng.</li>
                {unassigned > 0 && <li>{unassigned} câu của chương chưa gắn dòng YCCĐ theo bài hoặc nằm ngoài chương trình nên không hiện ở đây.</li>}
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

            {open && <LinePicker open={open} chosen={chosen} pool={pool} code={code} onToggle={toggle} onClose={() => setOpen(undefined)} />}
        </section>
    );
}

function chosenUnits(units: readonly LessonUnit<MatrixCandidate>[] | undefined, chosen: ReadonlySet<string>) {
    return (units ?? []).filter(unit => chosen.has(unit.candidate.item.id));
}

function LevelTabs({ topic, level, chosen, pool, onSelect }: {
    topic: LessonTopic; level: number; chosen: ReadonlySet<string>; pool: LessonPool<MatrixCandidate>; onSelect: (level: number) => void;
}) {
    const totals = lessonTotals(topic.lesson.id, chosen, pool.byId);
    return <div className="grid grid-cols-3 gap-2 p-3" role="group" aria-label={'Mức độ của ' + topic.lesson.name}>
        {LEVELS.map(value => {
            const need = LESSON_TYPES.reduce((sum, type) => sum + topic.need[type][value - 1], 0);
            const got = LESSON_TYPES.reduce((sum, type) => sum + totals[type][value - 1], 0);
            return <button key={value} type="button" aria-pressed={level === value} onClick={() => onSelect(value)}
                className={'min-h-12 rounded-lg border border-stone-200 bg-white px-3 py-2 text-left hover:bg-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-700 ' + levelTab[value]}>
                <span className="block text-sm font-bold">{COGNITIVE_LEVELS[value]}</span>
                <span className={'block text-xs tabular-nums ' + (need && got !== need ? 'text-amber-800' : 'text-stone-600')}>
                    {need ? 'đã chọn ' + got + '/' + need + ' câu, ý' : got ? 'đã chọn ' + got + ', ma trận không cần' : 'ma trận không cần'}
                </span>
            </button>;
        })}
    </div>;
}

function LineList({ topic, level, chosen, pool, code, onOpen }: {
    topic: LessonTopic; level: number; chosen: ReadonlySet<string>; pool: LessonPool<MatrixCandidate>;
    code: (candidate: MatrixCandidate) => string | undefined; onOpen: (open: Open) => void;
}) {
    const units = (pool.units.get(topic.lesson.id) ?? []).filter(unit => unit.level === level);
    const own = LESSON_LINES.filter(line => line.chapterId === topic.chapterId && line.lesson === topic.lesson.id && line.level === level && !line.alias);
    const extra = LESSON_LINES.filter(line => line.chapterId === topic.chapterId && line.lesson !== topic.lesson.id && line.level === level
        && units.some(unit => unit.line?.id === line.id));
    const others = units.filter(unit => !unit.line);
    const picked = chosenUnits(others, chosen);
    const row = (line: LessonLine) => {
        const mine = units.filter(unit => unit.line?.id === line.id);
        const taken = chosenUnits(mine, chosen);
        return <li key={line.id} className={'grid gap-2 border-b border-stone-200 px-4 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center ' + (line.source === 'DX' ? 'bg-orange-50/50' : '')}>
            <p className="text-sm leading-snug">
                {line.lesson !== topic.lesson.id && <span className="mr-1.5 rounded bg-stone-100 px-1.5 py-px text-[11px] font-semibold text-stone-700">{line.lesson ? 'Bài ' + line.lesson : 'Chương trước'}</span>}
                {line.text}{sourceBadge(line)}
            </p>
            <span className="flex flex-wrap gap-1">{taken.map(unit => <span key={unit.candidate.item.id + unit.label}
                className={'rounded px-1.5 py-px font-mono text-[11px] font-semibold ' + codeColor[unit.candidate.item.type]}>
                {(code(unit.candidate) ?? '·') + unit.label}</span>)}</span>
            {mine.length ? <button type="button" className={button} aria-haspopup="dialog" onClick={() => onOpen({ topic, level, line })}>
                Chọn câu <span className="font-normal text-stone-500">({new Set(mine.map(unit => unit.candidate.item.id)).size})</span></button>
                : <span className="text-xs text-stone-500">kho chưa có câu</span>}
        </li>;
    };
    return <div>
        <ul className="border-t border-stone-200">
            {own.map(row)}
            {extra.length > 0 && <li className="border-b border-stone-200 bg-stone-50 px-4 py-2 text-xs font-semibold text-stone-600">Ý hỗ trợ trong câu của bài này, đo YCCĐ bài khác hoặc chương trước</li>}
            {extra.map(row)}
            {!own.length && !extra.length && <li className="px-4 py-3 text-sm text-stone-600">Bài này không có yêu cầu cần đạt ở mức {COGNITIVE_LEVELS[level]}.</li>}
        </ul>
        {others.length > 0 && <p className="px-4 py-2.5 text-sm">
            <button type="button" className="font-semibold text-amber-900 underline-offset-2 hover:underline" aria-haspopup="dialog"
                onClick={() => onOpen({ topic, level })}>Xem thêm câu cùng mức chưa gắn dòng yêu cầu ({new Set(others.map(unit => unit.candidate.item.id)).size})</button>
            {picked.length > 0 && <span className="text-stone-600"> · đã chọn {picked.map(unit => (code(unit.candidate) ?? '·') + unit.label).join(', ')}</span>}
        </p>}
    </div>;
}

function LinePicker({ open, chosen, pool, code, onToggle, onClose }: {
    open: Open; chosen: ReadonlySet<string>; pool: LessonPool<MatrixCandidate>;
    code: (candidate: MatrixCandidate) => string | undefined; onToggle: (questionId: string) => void; onClose: () => void;
}) {
    const { topic, level, line } = open;
    const units = (pool.units.get(topic.lesson.id) ?? []).filter(unit => unit.level === level && unit.line?.id === line?.id);
    const questions = [...new Map(units.map(unit => [unit.candidate.item.id, unit.candidate])).values()];
    const available = LESSON_TYPES.filter(type => questions.some(candidate => candidate.item.type === type));
    const [type, setType] = useState<LessonType>(available[0] ?? 'trac_nghiem');
    const [preview, setPreview] = useState<MatrixCandidate>();
    const totals = lessonTotals(topic.lesson.id, chosen, pool.byId);
    const status = lessonStatus(topic, chosen, pool.byId);
    const list = questions.filter(candidate => candidate.item.type === type)
        .sort((a, b) => Number(chosen.has(b.item.id)) - Number(chosen.has(a.item.id)) || Number(!!code(a)) - Number(!!code(b)));
    const blocked = (candidate: MatrixCandidate) => {
        if (chosen.has(candidate.item.id)) return undefined;
        const kind = candidate.item.type;
        if (kind === 'dung_sai') {
            const counts = trueFalseCounts(candidate.item)!;
            const left = topic.need.dung_sai.map((value, index) => value - totals.dung_sai[index]);
            return counts.every((value, index) => value <= left[index]) ? undefined : 'Vượt số ý ma trận cần';
        }
        const need = topic.need[kind][level - 1];
        return totals[kind][level - 1] < need ? undefined : need ? 'Bài đã đủ ' + need + ' câu ' + COGNITIVE_LEVELS[level] : 'Ma trận không cần câu này';
    };
    const title = topic.lesson.name.replace(/\..*$/, '') + ' · ' + COGNITIVE_LEVELS[level] + (line && line.source !== 'SGV' ? ' · ' + lessonLineSource(line) : '');
    const subtitle = line ? (line.lesson && line.lesson !== topic.lesson.id ? '(YCCĐ Bài ' + line.lesson + ') ' : '') + line.text
        : 'Câu, ý cùng mức nhưng chưa gắn dòng yêu cầu cần đạt nào.';
    return <MatrixDialog title={title} subtitle={subtitle} closeLabel="Đóng chọn câu" onClose={onClose}>
        <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-stone-200 bg-white p-3 text-sm">
                <span className={'font-semibold ' + (status.done ? 'text-emerald-800' : 'text-red-700')}>
                    {status.done ? 'Bài đã đủ câu theo ma trận' : [status.missing.length && 'Bài còn thiếu ' + status.missing.join(', '), status.over.length && 'Thừa ' + status.over.join(', ')].filter(Boolean).join(' · ')}
                </span>
                {available.length > 1 && <div className="ml-auto inline-flex flex-wrap gap-1" role="group" aria-label="Dạng câu">
                    {available.map(value => <button key={value} type="button" aria-pressed={type === value} onClick={() => setType(value)}
                        className="min-h-9 rounded-lg border border-stone-200 px-3 text-sm font-semibold hover:bg-stone-100 aria-pressed:border-amber-700 aria-pressed:bg-amber-50 aria-pressed:text-amber-950">
                        {LESSON_TYPE_LABELS[value]} ({questions.filter(candidate => candidate.item.type === value).length})</button>)}
                </div>}
            </div>
            {type === 'dung_sai' && <p className="text-xs text-stone-600">Mỗi câu Đúng/Sai có 4 ý; các ý được đếm vào đúng mức của chúng. Ý thuộc dòng này được ghi ở nhãn xanh.</p>}
            {list.length ? <div className="grid items-start gap-3 lg:grid-cols-2">
                {list.map(candidate => {
                    const labels = units.filter(unit => unit.candidate === candidate && unit.label).map(unit => unit.label);
                    const counts = trueFalseCounts(candidate.item);
                    return <MatrixQuestionCard key={candidate.item.id} candidate={candidate} score={0} evidence={[]} showOutcomes
                        selected={chosen.has(candidate.item.id)} used={false} blockedLabel={blocked(candidate)}
                        badges={<>
                            {code(candidate) && <span className="rounded bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-900">{code(candidate)} trong đề</span>}
                            {labels.length > 0 && <span className="rounded bg-sky-50 px-2 py-0.5 font-semibold text-sky-900">ý {labels.join(', ')} ở dòng này</span>}
                            {counts && <span className="rounded bg-violet-50 px-2 py-0.5 font-semibold text-violet-900">{statementCountsLabel(counts as StatementCounts)}</span>}
                            {candidate.programmeMatch === 'extended' && <span className="rounded bg-orange-50 px-2 py-0.5 font-semibold text-orange-900">mở rộng so với YCCĐ</span>}
                        </>}
                        onPreview={() => setPreview(candidate)} onChoose={() => onToggle(candidate.item.id)} />;
                })}
            </div> : <p className="rounded-lg border border-stone-200 bg-white p-4 text-sm text-stone-600">Kho chưa có câu cho dòng này.</p>}
        </div>
        {preview && <MatrixSolutionDialog candidate={preview} onClose={() => setPreview(undefined)} />}
    </MatrixDialog>;
}
