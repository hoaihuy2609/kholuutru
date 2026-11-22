import { useMemo, useRef, useState, useEffect } from 'react';
import { Printer, Table2 } from 'lucide-react';
import { MatrixDialog } from './MatrixQuestionCard';
import { normalizeMatrixText } from '../src/utils/examMatrix';
import type { MatrixAllocation } from '../src/utils/matrixPlan';
import { buildMatrixExport, defaultMatrixExportSettings, type MatrixExportSelection, type MatrixExportSettings } from '../src/utils/matrixExport';
import { matrixExportHtml, matrixExportNumber } from '../src/utils/matrixExportPrint';

const field = 'block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-amber-700 focus:outline-none focus:ring-1 focus:ring-amber-700';
const button = 'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-stone-100 disabled:opacity-50';
const primary = 'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-amber-800 bg-amber-800 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-900 disabled:opacity-50';
const width = 297 * 96 / 25.4 + 18;

function PrintPreview({ html }: { html: string }) {
    const container = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);
    useEffect(() => {
        const element = container.current;
        if (!element) return;
        const resize = () => setScale(Math.min(1, element.clientWidth / width));
        const observer = new ResizeObserver(resize);
        observer.observe(element);
        resize();
        return () => observer.disconnect();
    }, []);
    return <div ref={container} className="relative h-[65dvh] overflow-hidden rounded-lg border border-stone-200 bg-white">
        <iframe title="Xem trước ma trận và bản đặc tả" sandbox="allow-same-origin" srcDoc={html}
            className="absolute left-0 top-0 origin-top-left border-0"
            style={{ width, height: 100 / scale + '%', transform: 'scale(' + scale + ')' }} />
    </div>;
}

export default function MatrixExportDialog({ allocations, selections }: {
    allocations: MatrixAllocation[];
    selections: MatrixExportSelection[];
}) {
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState<'settings' | 'preview'>('settings');
    const [settings, setSettings] = useState(defaultMatrixExportSettings);
    const [outcomes, setOutcomes] = useState<Record<string, string>>({});
    const [error, setError] = useState('');
    const [printing, setPrinting] = useState(false);
    const document = useMemo(() => buildMatrixExport(allocations, selections, settings, outcomes), [allocations, selections, settings, outcomes]);
    const html = useMemo(() => open ? matrixExportHtml(document) : '', [open, document]);
    const missingSuffix = ': chưa xác định YCCĐ cụ thể.';
    const missingOutcomes = document.issues.filter(issue => issue.endsWith(missingSuffix)).map(issue => issue.slice(0, -missingSuffix.length));
    const otherIssues = document.issues.filter(issue => !issue.endsWith(missingSuffix));
    /** Suggested YCCĐ for a true-false statement: the question's only YCCĐ, or the one sharing most words with the statement. */
    function suggestOutcome(unit: (typeof document.units)[number]) {
        const selection = selections.find(item => item.slot.id === unit.slotId);
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

    return <>
        <button type="button" className={button} onClick={() => { setOpen(true); setError(''); }}>
            <Table2 aria-hidden="true" className="size-4" />Xuất ma trận & đặc tả
        </button>
        {open && <MatrixDialog title="Rà soát và xuất ma trận, bản đặc tả"
            subtitle="A4 ngang · 3 mức nhận thức · mã câu theo từng phần của đề"
            onClose={() => setOpen(false)} closeLabel="Đóng xuất ma trận và đặc tả">
            <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-stone-200 bg-white p-3">
                    <p className="text-sm font-semibold tabular-nums">{document.questionCount} câu · {document.unitCount} câu/ý · {matrixExportNumber(document.totalScore)}/{matrixExportNumber(settings.targetScore)} điểm</p>
                    <div className="flex flex-wrap gap-2">
                        <button type="button" className={primary} disabled={printing || document.invalidSettings}
                            onClick={() => void print()}><Printer className="size-4" aria-hidden="true" />{printing ? 'Đang mở trang in…' : 'In / Lưu PDF'}</button>
                    </div>
                </div>
                {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
                {document.issues.length > 0 ? <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                    <p className="font-semibold">Vẫn in được ngay. Nên rà lại {missingOutcomes.length && otherIssues.length ? 'các mục' : 'mục'} dưới đây trước khi nộp.</p>
                    <ul className="max-h-48 list-disc space-y-1.5 overflow-auto pl-5">
                        {missingOutcomes.length > 0 && <li>
                            <span className="font-semibold">{missingOutcomes.length} câu/ý chưa có YCCĐ</span>: {missingOutcomes.join(', ')}.
                            <span className="mt-1.5 flex flex-wrap gap-2">
                                {fillableStatements > 0 && <button type="button" className={button} onClick={fillTrueFalse}>
                                    Gợi ý YCCĐ cho {fillableStatements} ý Đúng/Sai (rà lại sau)</button>}
                            </span>
                        </li>}
                        {otherIssues.map(issue => <li key={issue}>{issue}</li>)}
                    </ul>
                </div> : <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">Số câu/ý, mức độ và tổng điểm đã khớp phân bổ. YCCĐ đã điền đủ; giáo viên rà lại nội dung trước khi xuất.</p>}
                <div className="flex flex-wrap gap-2" role="group" aria-label="Nội dung rà soát bản xuất">
                    {([{ key: 'settings', label: '1. Thông tin & điểm' }, { key: 'preview', label: '2. Xem bản xuất' }] as const).map(item =>
                        <button type="button" key={item.key} aria-pressed={tab === item.key} className={tab === item.key ? primary : button}
                            onClick={() => setTab(item.key)}>{item.label}</button>)}
                </div>
                {tab === 'settings' && <div className="space-y-4">
                    <div className="grid gap-3 rounded-lg border border-stone-200 bg-white p-3 sm:grid-cols-2">
                        <label className="text-sm font-semibold sm:col-span-2">Tên bài kiểm tra<input className={field + ' mt-1'} value={settings.title} onChange={event => set('title', event.target.value)} /></label>
                        <label className="text-sm font-semibold">Trường / đơn vị (tùy chọn)<input className={field + ' mt-1'} value={settings.school} onChange={event => set('school', event.target.value)} /></label>
                        <label className="text-sm font-semibold">Mã đề (tùy chọn)<input className={field + ' mt-1'} value={settings.examCode} onChange={event => set('examCode', event.target.value)} /></label>
                        <label className="text-sm font-semibold">Thời gian làm bài (phút)<input className={field + ' mt-1'} type="number" min={1} step={1} value={Number.isNaN(settings.duration) ? '' : settings.duration} onChange={event => set('duration', event.target.valueAsNumber)} /></label>
                        <label className="text-sm font-semibold">Thang điểm<input className={field + ' mt-1'} type="number" min={0.1} step="any" value={Number.isNaN(settings.targetScore) ? '' : settings.targetScore} onChange={event => set('targetScore', event.target.valueAsNumber)} /></label>
                        <label className="text-sm font-semibold sm:col-span-2">Thời điểm kiểm tra (tùy chọn)<input className={field + ' mt-1'} placeholder="Ví dụ: Giữa học kì II, năm học 2026–2027" value={settings.assessmentTime} onChange={event => set('assessmentTime', event.target.value)} /></label>
                        <label className="text-sm font-semibold sm:col-span-2">Phạm vi kiến thức<textarea className={field + ' mt-1'} rows={2} placeholder="Để trống để lấy tên các chương đã chọn" value={settings.scope} onChange={event => set('scope', event.target.value)} /></label>
                    </div>
                    <fieldset className="rounded-lg border border-stone-200 bg-white p-3">
                        <legend className="px-1 text-sm font-bold">Điểm phân bổ trong ma trận</legend>
                        <div className="grid gap-3 sm:grid-cols-2">{document.formats.map(({ type, label }) => <label key={type} className="text-sm font-semibold">{label} · điểm/câu
                            <input type="number" min={0.01} step="any" className={field + ' mt-1'} value={Number.isNaN(settings.points[type]) ? '' : settings.points[type]}
                                onChange={event => set('points', { ...settings.points, [type]: event.target.valueAsNumber })} />
                        </label>)}</div>
                        {document.formats.some(format => format.type === 'dung_sai') && <p className="mt-2 text-xs leading-relaxed text-stone-600">Điểm mỗi câu Đúng/Sai được phân bổ đều cho 4 ý để tính tỉ lệ mức độ trong ma trận. Đây không phải quy tắc chấm theo số ý đúng.</p>}
                    </fieldset>
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
                </div>}
                {tab === 'preview' && <><PrintPreview html={html} /><p className="text-xs text-stone-600">Trang in dùng A4 ngang, lặp tiêu đề bảng và đánh số trang. Chọn “Lưu dưới dạng PDF” trong hộp thoại in; tắt đầu trang/chân trang của trình duyệt để tránh in thêm URL.</p></>}
            </div>
        </MatrixDialog>}
    </>;
}
