import { Fragment, useId, useMemo, useRef, useState, useEffect } from 'react';
import { Printer, Table2 } from 'lucide-react';
import { MatrixDialog } from './MatrixQuestionCard';
import { SolutionQuestionPrompt } from './SolutionRenderer';
import { MATRIX_LEVELS, normalizeMatrixText } from '../src/utils/examMatrix';
import type { MatrixAllocation } from '../src/utils/matrixPlan';
import { buildMatrixExport, defaultMatrixExportSettings, MATRIX_EXPORT_FORMATS, type MatrixExportSelection, type MatrixExportSettings, type MatrixExportUnit } from '../src/utils/matrixExport';
import { matrixExportHtml, matrixExportNumber } from '../src/utils/matrixExportPrint';


const field = 'block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-amber-700 focus:outline-none focus:ring-1 focus:ring-amber-700';
const button = 'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-stone-100 disabled:opacity-50';
const primary = 'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-amber-800 bg-amber-800 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-900 disabled:opacity-50';
const width = 297 * 96 / 25.4 + 18;
/** Phần giáo viên gõ sửa (YCCĐ, thông tin bài kiểm tra) lưu tạm trên máy này, không ghi vào kho. */
const STORAGE_KEY = 'pv_matrix_export_v1';

type Pick = { id: string; from: 'spec' | 'exam' };

function loadSaved(): { settings?: Partial<MatrixExportSettings>; outcomes?: Record<string, string> } {
    try {
        const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
        return value && typeof value === 'object' ? value : {};
    } catch { return {}; }
}

const bodyOf = (html: string) => new DOMParser().parseFromString(html, 'text/html').body.innerHTML;

/** Bản ma trận và đặc tả dạng trang in; ô YCCĐ gõ sửa được, mã câu bấm được. Cập nhật thân trang mà không tải lại khung. */
function SpecFrame({ html, pick, onEditRow, onPick }: {
    html: string;
    pick?: Pick;
    onEditRow: (keys: string[], text: string) => void;
    onPick: (questionId: string) => void;
}) {
    const container = useRef<HTMLDivElement>(null);
    const frame = useRef<HTMLIFrameElement>(null);
    const [scale, setScale] = useState(1);
    // Chỉ nạp khung một lần; các lần sau thay thân trang để giữ vị trí cuộn.
    const [shell] = useState(html);
    const handlers = useRef({ onEditRow, onPick });
    handlers.current = { onEditRow, onPick };
    useEffect(() => {
        const element = container.current;
        if (!element) return;
        const resize = () => { if (element.clientWidth) setScale(Math.min(1, element.clientWidth / width)); };
        const observer = new ResizeObserver(resize);
        observer.observe(element);
        resize();
        return () => observer.disconnect();
    }, []);

    const highlight = () => {
        const doc = frame.current?.contentDocument;
        if (!doc?.body) return;
        doc.querySelectorAll('.hl').forEach(node => node.classList.remove('hl'));
        doc.querySelectorAll('.hl-row').forEach(node => node.classList.remove('hl-row'));
        if (!pick) return;
        const refs = [...doc.querySelectorAll<HTMLElement>('.ref')].filter(node => node.dataset.question === pick.id);
        refs.forEach(node => { node.classList.add('hl'); node.closest('tr')?.classList.add('hl-row'); });
        const view = doc.defaultView;
        if (pick.from === 'exam' && refs[0] && view) {
            const top = refs[0].getBoundingClientRect().top + view.scrollY - view.innerHeight / 3;
            view.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
        }
    };
    const update = () => {
        const doc = frame.current?.contentDocument;
        if (!doc?.body) return;
        if (doc.activeElement?.closest?.('[data-keys]')) return;
        doc.body.innerHTML = bodyOf(html);
        if (!doc.documentElement.dataset.ready) {
            doc.documentElement.dataset.ready = '1';
            const original = new WeakMap<Element, string>();
            doc.addEventListener('focusin', event => {
                const cell = (event.target as Element | null)?.closest?.<HTMLElement>('[data-keys]');
                if (!cell || original.has(cell)) return;
                original.set(cell, cell.innerHTML);
                // Sửa trên chữ gốc (công thức hiện dạng $...$), tránh sửa vào phần đã dựng công thức.
                cell.textContent = cell.dataset.raw ?? '';
            });
            doc.addEventListener('focusout', event => {
                const cell = (event.target as Element | null)?.closest?.<HTMLElement>('[data-keys]');
                if (!cell || !original.has(cell)) return;
                const text = (cell.textContent ?? '').replace(/\s+/g, ' ').trim();
                const before = original.get(cell)!;
                original.delete(cell);
                if (text && text !== (cell.dataset.raw ?? '').trim()) {
                    handlers.current.onEditRow((cell.dataset.keys ?? '').split('\n').filter(Boolean), text);
                } else cell.innerHTML = before;
            });
            doc.addEventListener('keydown', event => {
                const cell = (event.target as Element | null)?.closest?.<HTMLElement>('[data-keys]');
                if (!cell) return;
                if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); cell.blur(); }
                if (event.key === 'Escape') { event.preventDefault(); cell.textContent = cell.dataset.raw ?? ''; cell.blur(); }
            });
            doc.addEventListener('paste', event => {
                if (!(event.target as Element | null)?.closest?.('[data-keys]')) return;
                event.preventDefault();
                doc.execCommand('insertText', false, event.clipboardData?.getData('text/plain').replace(/\s+/g, ' ') ?? '');
            });
            doc.addEventListener('click', event => {
                const ref = (event.target as Element | null)?.closest?.<HTMLElement>('.ref');
                if (ref?.dataset.question) handlers.current.onPick(ref.dataset.question);
            });
        }
        highlight();
    };
    useEffect(update, [html]);
    useEffect(highlight, [pick]);

    return <div ref={container} className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-stone-200 bg-white">
        <iframe ref={frame} title="Ma trận và bản đặc tả (sửa được)" sandbox="allow-same-origin" srcDoc={shell} onLoad={update}
            className="absolute left-0 top-0 origin-top-left border-0"
            style={{ width, height: 100 / scale + '%', transform: 'scale(' + scale + ')' }} />
    </div>;
}

/** Ô YCCĐ của một câu/ý: gõ xong, rời ô (hoặc Enter) mới cập nhật bản đặc tả. */
function OutcomeField({ unit, label, edited, onSet }: {
    unit: MatrixExportUnit;
    label: string;
    edited: boolean;
    onSet: (key: string, text: string | undefined) => void;
}) {
    const [draft, setDraft] = useState<string>();
    const id = useId();
    const commit = () => {
        if (draft === undefined) return;
        const text = draft.replace(/\s+/g, ' ').trim();
        setDraft(undefined);
        if (text && text !== unit.outcome) onSet(unit.key, text);
    };
    return <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-stone-700">
            <label htmlFor={id}>{label}</label>
            {edited && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-900">Đã sửa tay</span>}
            {edited && <button type="button" className="font-semibold text-amber-900 underline-offset-2 hover:underline"
                onClick={() => { setDraft(undefined); onSet(unit.key, undefined); }}>Trả lại YCCĐ gốc</button>}
        </div>
        <textarea id={id} rows={2} className={field + ' resize-y leading-snug' + (edited ? ' !border-amber-500' : '')}
            value={draft ?? unit.outcome} placeholder="Gõ YCCĐ mà câu này đánh giá"
            onChange={event => setDraft(event.target.value)} onBlur={commit}
            onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.blur(); } }} />
    </div>;
}

function ExamQuestion({ units, selection, edited, picked, onSet, onPick }: {
    units: MatrixExportUnit[];
    selection?: MatrixExportSelection;
    edited: ReadonlySet<string>;
    picked: boolean;
    onSet: (key: string, text: string | undefined) => void;
    onPick: () => void;
}) {
    const first = units[0];
    const content = useMemo(() => selection?.preview?.() ?? '', [selection]);
    const trueFalse = first.type === 'dung_sai';
    return <article data-question={first.questionId}
        className={'scroll-mt-3 space-y-3 rounded-xl border bg-white p-4 ' + (picked ? 'border-amber-500 ring-2 ring-amber-200' : 'border-stone-200')}>
        <button type="button" onClick={onPick} title="Xem dòng YCCĐ của câu này trong bản đặc tả"
            className="flex w-full flex-wrap items-baseline gap-x-2 text-left text-sm">
            <strong className="text-stone-900">Phần {MATRIX_EXPORT_FORMATS.find(format => format.type === first.type)?.part} · Câu {first.reference.replace(/[a-d]$/, '').slice(1)}</strong>
            <span className="text-stone-600">{trueFalse ? units.map(unit => unit.reference.slice(-1) + ') ' + MATRIX_LEVELS[unit.level]).join(' · ') : MATRIX_LEVELS[first.level]}</span>
            {selection && <span className="text-xs text-stone-500">· Kho: {selection.item.questionNo}</span>}
        </button>
        {content ? <SolutionQuestionPrompt content={content} />
            : <p className="whitespace-pre-wrap text-sm">{selection?.item.qText}</p>}
        <div className="space-y-2 rounded-lg bg-stone-50 p-3">
            {units.map(unit => <OutcomeField key={unit.key} unit={unit} edited={edited.has(unit.key)} onSet={onSet}
                label={trueFalse ? 'YCCĐ ý ' + unit.reference.slice(-1) + ' (' + MATRIX_LEVELS[unit.level] + ')' : 'YCCĐ của câu này'} />)}
        </div>
    </article>;
}

export default function MatrixExportDialog({ allocations, selections, scale = 10 }: {
    allocations: MatrixAllocation[];
    selections: MatrixExportSelection[];
    /** Thang điểm đặt trên ma trận. */
    scale?: number;
}) {
    const [open, setOpen] = useState(false);
    const [view, setView] = useState<'spec' | 'exam' | 'settings'>('spec');
    const [settings, setSettings] = useState<MatrixExportSettings>(() => ({ ...defaultMatrixExportSettings(), ...loadSaved().settings }));
    const [outcomes, setOutcomes] = useState<Record<string, string>>(() => loadSaved().outcomes ?? {});
    const [pick, setPick] = useState<Pick>();
    const [error, setError] = useState('');
    const [printing, setPrinting] = useState(false);
    const examList = useRef<HTMLDivElement>(null);
    useEffect(() => {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ settings, outcomes })); } catch { /* bộ nhớ trình duyệt bị chặn: vẫn dùng được, chỉ không lưu */ }
    }, [settings, outcomes]);
    const document = useMemo(() => buildMatrixExport(allocations, selections, { ...settings, targetScore: scale }, outcomes),
        [allocations, selections, settings, scale, outcomes]);
    const edited = useMemo(() => new Set(document.units.filter(unit => outcomes[unit.key] !== undefined).map(unit => unit.key)), [document, outcomes]);
    const html = useMemo(() => open ? matrixExportHtml(document, false, { editable: true, edited }) : '', [open, document, edited]);
    const bySlot = useMemo(() => new Map(selections.map(selection => [selection.slot.id, selection])), [selections]);
    /** Câu trong đề theo thứ tự phần I, II, III rồi số câu; mỗi câu gồm các ý của nó. */
    const questions = useMemo(() => {
        const groups = new Map<string, MatrixExportUnit[]>();
        for (const unit of document.units) {
            const list = groups.get(unit.questionId);
            if (list) list.push(unit); else groups.set(unit.questionId, [unit]);
        }
        const part = (unit: MatrixExportUnit) => MATRIX_EXPORT_FORMATS.findIndex(format => format.type === unit.type);
        const number = (unit: MatrixExportUnit) => Number.parseInt(unit.reference.slice(1), 10);
        return [...groups.values()].sort((a, b) => part(a[0]) - part(b[0]) || number(a[0]) - number(b[0]));
    }, [document]);
    const missingSuffix = ': chưa xác định YCCĐ cụ thể.';
    const missingOutcomes = document.issues.filter(issue => issue.endsWith(missingSuffix)).map(issue => issue.slice(0, -missingSuffix.length));
    const otherIssues = document.issues.filter(issue => !issue.endsWith(missingSuffix));
    /** Suggested YCCĐ for a true-false statement: the question's only YCCĐ, or the one sharing most words with the statement. */
    function suggestOutcome(unit: MatrixExportUnit) {
        const selection = bySlot.get(unit.slotId);
        const options = selection?.outcomeOptions?.length ? selection.outcomeOptions : selection?.outcome ? [selection.outcome] : [];
        if (options.length <= 1) return options[0] ?? '';
        const words = new Set(normalizeMatrixText(unit.claim ?? '').split(' ').filter(word => word.length > 1));
        const score = (option: string) => normalizeMatrixText(option).split(' ').filter(word => words.has(word)).length;
        return options.reduce((best, option) => score(option) > score(best) ? option : best, options[0]);
    }
    const fillableStatements = document.units.filter(unit => unit.type === 'dung_sai' && !unit.outcome && suggestOutcome(unit)).length;
    function fillTrueFalse() {
        setOutcomes(previous => {
            const next = { ...previous };
            for (const unit of document.units) {
                const suggestion = unit.type === 'dung_sai' && !unit.outcome ? suggestOutcome(unit) : '';
                if (suggestion) next[unit.key] = suggestion;
            }
            return next;
        });
    }
    const setOutcome = (key: string, text: string | undefined) => setOutcomes(previous => {
        const next = { ...previous };
        if (text === undefined) delete next[key]; else next[key] = text;
        return next;
    });
    const editRow = (keys: string[], text: string) => setOutcomes(previous => {
        const next = { ...previous };
        for (const key of keys) next[key] = text;
        return next;
    });
    function pickFromSpec(id: string) {
        setPick({ id, from: 'spec' });
        if (!wide()) setView('exam');
        requestAnimationFrame(() => examList.current?.querySelector(`[data-question="${CSS.escape(id)}"]`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
    const set = <K extends keyof MatrixExportSettings>(key: K, value: MatrixExportSettings[K]) =>
        setSettings(previous => ({ ...previous, [key]: value }));

    async function print() {
        if (document.invalidSettings) return;
        const popup = window.open('', '_blank');
        if (!popup) { setError('Trình duyệt đang chặn cửa sổ in. Cho phép cửa sổ bật lên rồi thử lại.'); return; }
        setPrinting(true);
        setError('');
        try {
            popup.opener = null;
            popup.document.open();
            popup.document.write(matrixExportHtml(document));
            popup.document.close();
            await popup.document.fonts.ready;
            // Allow the table layout and font substitutions to settle before pagination.
            await new Promise<void>(resolve => popup.requestAnimationFrame(() => popup.requestAnimationFrame(() => resolve())));
            if (!popup.closed) { popup.focus(); popup.print(); }
        } catch {
            if (!popup.closed) popup.close();
            setError('Không mở được trang in. Hãy thử lại.');
        } finally { setPrinting(false); }
    }

    const wide = () => window.matchMedia('(min-width: 1024px)').matches;
    function pickFromExam(id: string) {
        setPick({ id, from: 'exam' });
        if (!wide()) setView('spec');
    }

    return <>
        <button type="button" className={button} onClick={() => { setOpen(true); setError(''); }}>
            <Table2 aria-hidden="true" className="size-4" />Xuất ma trận & đặc tả
        </button>
        {open && <MatrixDialog full title="Rà soát và xuất ma trận, bản đặc tả"
            subtitle={`${document.questionCount} câu · ${document.unitCount} câu/ý · ${matrixExportNumber(document.totalScore)}/${matrixExportNumber(scale)} điểm`}
            onClose={() => setOpen(false)} closeLabel="Đóng xuất ma trận và đặc tả"
            actions={<button type="button" className={primary} disabled={printing || document.invalidSettings}
                onClick={() => void print()}><Printer className="size-4" aria-hidden="true" />{printing ? 'Đang mở trang in…' : 'In / Lưu PDF'}</button>}>
            <div className="shrink-0 space-y-2 border-b border-stone-200 bg-white px-3 py-2 text-sm sm:px-4">
                {error && <p role="alert" className="rounded-lg bg-red-50 p-2 text-red-800">{error}</p>}
                {document.issues.length > 0 ? <details className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-950">
                    <summary className="cursor-pointer font-semibold">Vẫn in được ngay. Có {missingOutcomes.length ? otherIssues.length + 1 : otherIssues.length} mục nên rà lại trước khi nộp</summary>
                    <ul className="mt-2 max-h-40 list-disc space-y-1.5 overflow-auto pl-5">
                        {missingOutcomes.length > 0 && <li>
                            <span className="font-semibold">{missingOutcomes.length} câu/ý chưa có YCCĐ</span>: {missingOutcomes.join(', ')}.
                            {fillableStatements > 0 && <span className="mt-1.5 flex flex-wrap gap-2">
                                <button type="button" className={button} onClick={fillTrueFalse}>Gợi ý YCCĐ cho {fillableStatements} ý Đúng/Sai (rà lại sau)</button>
                            </span>}
                        </li>}
                        {otherIssues.map(issue => <li key={issue}>{issue}</li>)}
                    </ul>
                </details> : <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 font-semibold text-emerald-900">Số câu/ý, mức độ và tổng điểm đã khớp ma trận.</p>}
                <p className="text-xs text-stone-600">
                    Bấm vào chữ YCCĐ trong bản đặc tả để sửa <strong>cả dòng</strong>. Sửa ô YCCĐ ở <strong>từng câu</strong> trong đề để tách câu đó ra dòng riêng (gõ trùng chữ dòng khác thì câu vào dòng đó). Bấm mã câu (C1, C2…) để xem câu. Phần đã sửa lưu tạm trên máy này, không đổi kho câu hỏi.
                    {edited.size > 0 && <> <button type="button" className="font-semibold text-amber-900 underline-offset-2 hover:underline"
                        onClick={() => setOutcomes(previous => Object.fromEntries(Object.entries(previous).filter(([key]) => !edited.has(key))))}>
                        Bỏ {edited.size} chỗ đã sửa tay</button></>}
                </p>
            </div>
            <div className="grid min-h-0 flex-1 gap-3 p-3 sm:p-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
                <section className={'min-h-0 flex-col gap-2 ' + (view === 'exam' ? 'hidden lg:flex' : 'flex')} aria-label="Ma trận và bản đặc tả">
                    <div className="flex flex-wrap gap-2" role="group" aria-label="Nội dung bên trái">
                        <button type="button" aria-pressed={view !== 'settings'} className={view !== 'settings' ? primary : button}
                            onClick={() => setView('spec')}>Ma trận & đặc tả</button>
                        <button type="button" className={button + ' lg:hidden'} onClick={() => setView('exam')}>Đề bài</button>
                        <button type="button" aria-pressed={view === 'settings'} className={view === 'settings' ? primary : button}
                            onClick={() => setView('settings')}>Thông tin bài kiểm tra</button>
                    </div>
                    {view === 'settings' ? <div className="min-h-0 flex-1 space-y-4 overflow-auto">
                        <div className="grid gap-3 rounded-lg border border-stone-200 bg-white p-3 sm:grid-cols-2">
                            <label className="text-sm font-semibold sm:col-span-2">Tên bài kiểm tra<input className={field + ' mt-1'} value={settings.title} onChange={event => set('title', event.target.value)} /></label>
                            <label className="text-sm font-semibold">Trường / đơn vị (tùy chọn)<input className={field + ' mt-1'} value={settings.school} onChange={event => set('school', event.target.value)} /></label>
                            <label className="text-sm font-semibold">Mã đề (tùy chọn)<input className={field + ' mt-1'} value={settings.examCode} onChange={event => set('examCode', event.target.value)} /></label>
                            <label className="text-sm font-semibold">Thời gian làm bài (phút)<input className={field + ' mt-1'} type="number" min={1} step={1} value={Number.isNaN(settings.duration) ? '' : settings.duration} onChange={event => set('duration', event.target.valueAsNumber)} /></label>
                            <label className="text-sm font-semibold sm:col-span-2">Thời điểm kiểm tra (tùy chọn)<input className={field + ' mt-1'} placeholder="Ví dụ: Giữa học kì II, năm học 2026–2027" value={settings.assessmentTime} onChange={event => set('assessmentTime', event.target.value)} /></label>
                            <label className="text-sm font-semibold sm:col-span-2">Phạm vi kiến thức<textarea className={field + ' mt-1'} rows={2} placeholder="Để trống để lấy tên các chương đã chọn" value={settings.scope} onChange={event => set('scope', event.target.value)} /></label>
                        </div>
                        <p className="rounded-lg bg-stone-50 p-3 text-sm text-stone-700">Điểm mỗi câu và thang điểm lấy theo ma trận đề. Muốn đổi điểm, chỉnh ở bảng ma trận phía trên. Tổng hiện tại: <strong className="tabular-nums">{matrixExportNumber(document.totalScore)} / {matrixExportNumber(document.settings.targetScore)} điểm</strong>.</p>
                        <fieldset className="rounded-lg border border-stone-200 bg-white p-3">
                            <legend className="px-1 text-sm font-bold">Số tiết từng nội dung (tùy chọn)</legend>
                            <div className="space-y-2">{document.topics.map(topic => <label key={topic.key} className="flex items-center justify-between gap-3 text-sm">
                                <span>{topic.chapter} · <strong>{topic.topic}</strong></span>
                                <input aria-label={'Số tiết ' + topic.topic} type="number" min={0} max={999} step={1} className={field + ' max-w-24'} value={settings.periods[topic.key] ?? ''}
                                    onChange={event => {
                                        const periods = { ...settings.periods };
                                        if (event.target.value === '') delete periods[topic.key];
                                        else periods[topic.key] = event.target.valueAsNumber;
                                        set('periods', periods);
                                    }} />
                            </label>)}</div>
                        </fieldset>
                        <p className="text-xs leading-relaxed text-stone-600">Mã câu theo thứ tự đề đã chọn, đánh số lại trong từng phần I, II, III. Khi xuất đề, giữ chế độ tiêu đề từng phần để mã câu khớp bản đặc tả. Nếu đổi thứ tự hoặc đổi câu, cần rà và xuất lại.</p>
                    </div> : <SpecFrame html={html} pick={pick} onEditRow={editRow} onPick={pickFromSpec} />}
                </section>
                <section className={'min-h-0 flex-col gap-2 ' + (view === 'exam' ? 'flex' : 'hidden lg:flex')} aria-label="Đề bài">
                    <div className="flex flex-wrap items-center gap-2">
                        <button type="button" className={button + ' lg:hidden'} onClick={() => setView('spec')}>← Ma trận & đặc tả</button>
                        <h3 className="font-bold">Đề bài · {questions.length} câu</h3>
                    </div>
                    <div ref={examList} className="min-h-0 flex-1 space-y-3 overflow-auto overscroll-contain pr-1">
                        {questions.map((units, index) => {
                            const format = MATRIX_EXPORT_FORMATS.find(item => item.type === units[0].type);
                            return <Fragment key={units[0].questionId}>
                                {(index === 0 || questions[index - 1][0].type !== units[0].type) && format
                                    && <h4 className="pt-1 text-sm font-bold text-stone-800">Phần {format.part}. {format.label}</h4>}
                                <ExamQuestion units={units} selection={bySlot.get(units[0].slotId)}
                                    edited={edited} picked={pick?.id === units[0].questionId} onSet={setOutcome}
                                    onPick={() => pickFromExam(units[0].questionId)} />
                            </Fragment>;
                        })}
                        {!questions.length && <p className="rounded-lg bg-white p-4 text-sm text-stone-600">Chưa chọn câu nào.</p>}
                    </div>
                </section>
            </div>
        </MatrixDialog>}
    </>;
}
