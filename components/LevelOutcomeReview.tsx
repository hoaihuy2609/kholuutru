import { useEffect, useMemo, useState } from 'react';
import { Download, FileJson, ListChecks } from 'lucide-react';
import { SolutionQuestionPrompt } from './SolutionRenderer';
import { exportChapterOutcomes } from '../src/services/outcomeExchangeService';
import { textbookLessonFor, textbookLessonLabel } from '../src/data/physics10Lessons';
import { applyLevelSuggestions, buildLevelReview, currentDecision, DECISION_LABELS, decisionKind, levelReviewCsv, levelReviewSummary, levelReviewUpdate,
    REVIEW_LEVELS, type ReviewDecision, type ReviewItem } from '../src/utils/levelOutcomeReview';

const button = 'inline-flex items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-stone-50 disabled:opacity-50';
const primary = button + ' !border-amber-800 !bg-amber-800 !text-white';
const field = 'block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none focus:border-amber-700 focus:ring-1 focus:ring-amber-700';
const pageSize = 10;

function download(name: string, text: string, type: string) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const link = document.createElement('a');
    link.href = url; link.download = name; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const storageKey = (chapterId: string) => 'physivault:level-review:' + chapterId;
function loadDecisions(chapterId: string): Record<string, ReviewDecision> {
    try { return JSON.parse(localStorage.getItem(storageKey(chapterId)) ?? '{}') ?? {}; } catch { return {}; }
}

function ReviewCard({ item, chapterId, decision, onChange }: {
    item: ReviewItem; chapterId: string; decision?: ReviewDecision; onChange: (decision: ReviewDecision) => void;
}) {
    const value: ReviewDecision = decision ?? { fromLevel: item.level, fromOutcomes: item.outcomes, level: item.level,
        outcomes: item.outcomes, reason: '', reviewed: false };
    const update = (changes: Partial<ReviewDecision>) => onChange({ ...value, ...changes });
    const kind = decisionKind(item, value);
    const content = useMemo(() => JSON.stringify({ type: 'physics_solution', data: { questions: [item.question.context] } }), [item]);
    const lesson = textbookLessonFor(chapterId, item.lesson);
    const solution = typeof item.question.context.solution === 'string' ? item.question.context.solution : '';
    const answer = typeof item.question.context.correctChoice === 'string' ? item.question.context.correctChoice : '';
    return <article className={'space-y-3 rounded-xl border bg-white p-4 ' + (value.reviewed ? 'border-emerald-300' : 'border-stone-200')}>
        <header className="flex flex-wrap items-center gap-2 text-xs text-stone-600">
            <span className="font-bold text-stone-900">{item.label}</span>
            <span>{lesson ? textbookLessonLabel(lesson) : item.lesson}</span>
            <span>· {item.type === 'tu_luan' ? 'Trả lời ngắn' : 'Trắc nghiệm'}</span>
            {value.reviewed && <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-900">Đã rà · {DECISION_LABELS[kind]}</span>}
        </header>
        {item.flag && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950">{item.flag}</p>}
        <div className="rounded-lg border border-stone-100 p-3"><SolutionQuestionPrompt content={content} /></div>
        {(solution || answer) && <details className="text-sm text-stone-700">
            <summary className="cursor-pointer font-semibold text-stone-800">Xem đáp án, lời giải</summary>
            {answer && <p className="mt-1 font-semibold">Đáp án: {answer}</p>}
            {solution && <p className="mt-1 whitespace-pre-wrap rounded bg-stone-50 p-2">{solution}</p>}
        </details>}
        <div className="grid gap-3 sm:grid-cols-[11rem_minmax(0,1fr)]">
            <label className="space-y-1">
                <span className="text-xs font-semibold text-stone-700">Mức độ (hiện tại: {REVIEW_LEVELS[item.level] || 'chưa có'})</span>
                <select className={field} value={value.level} onChange={event => update({ level: Number(event.target.value), reviewed: false })}>
                    {!item.level && <option value={0}>Chưa có</option>}
                    {[1, 2, 3].map(level => <option key={level} value={level}>{REVIEW_LEVELS[level]}</option>)}
                </select>
            </label>
            <label className="space-y-1">
                <span className="text-xs font-semibold text-stone-700">YCCĐ của câu (mỗi dòng một YCCĐ)</span>
                <textarea className={field + ' resize-y'} rows={Math.max(2, value.outcomes.length)} value={value.outcomes.join('\n')}
                    onChange={event => update({ outcomes: event.target.value.split('\n'), reviewed: false })} />
            </label>
        </div>
        <label className="block space-y-1">
            <span className="text-xs font-semibold text-stone-700">Lý do (ghi vào báo cáo)</span>
            <input className={field} value={value.reason} placeholder="Ví dụ: đề chỉ hỏi đơn vị, không cần suy luận"
                onChange={event => update({ reason: event.target.value })} />
        </label>
        <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={value.reviewed ? button : primary} disabled={!value.level}
                onClick={() => update({ reviewed: !value.reviewed })}>
                {value.reviewed ? 'Bỏ đánh dấu' : 'Xác nhận: ' + DECISION_LABELS[kind]}
            </button>
            {kind !== 'keep' && <button type="button" className={button}
                onClick={() => update({ level: item.level, outcomes: item.outcomes, reviewed: false })}>Trả về như cũ</button>}
        </div>
    </article>;
}

export default function LevelOutcomeReview({ chapterId, busy, run, onUpdateReady }: {
    chapterId: string; busy: boolean; run: (task: () => Promise<void>) => Promise<void>;
    onUpdateReady: (text: string) => void;
}) {
    const [source, setSource] = useState<{ exportId: string; items: ReviewItem[] }>();
    const [decisions, setDecisions] = useState<Record<string, ReviewDecision>>(() => loadDecisions(chapterId));
    const [showAll, setShowAll] = useState(false);
    const [onlyOpen, setOnlyOpen] = useState(false);
    const [limit, setLimit] = useState(pageSize);
    const [loadNote, setLoadNote] = useState('');
    useEffect(() => {
        try { localStorage.setItem(storageKey(chapterId), JSON.stringify(decisions)); } catch { /* progress stays in memory */ }
    }, [chapterId, decisions]);

    const items = source?.items ?? [];
    const summary = levelReviewSummary(items, decisions);
    const update = source ? levelReviewUpdate(source.exportId, chapterId, items, decisions) : undefined;
    const visible = items.filter(item => (showAll || item.flag)
        && (!onlyOpen || !currentDecision(item, decisions[item.questionId])?.reviewed));

    return <section className="space-y-4">
        <div className="space-y-2 rounded-xl border bg-white p-4">
            <h3 className="font-bold">Rà mức độ ↔ YCCĐ (trắc nghiệm, trả lời ngắn)</h3>
            <p className="text-sm text-stone-600">
                Công cụ gắn cờ các câu có mức độ mâu thuẫn với động từ mở đầu YCCĐ (ví dụ gắn Thông hiểu nhưng YCCĐ viết “Nhận biết được…”).
                Với mỗi câu, đọc đề và lời giải, rồi sửa mức độ hoặc sửa YCCĐ cho đúng với việc học sinh thực sự phải làm. Chỉ dùng các động từ có mức rõ ràng,
                nên số câu bị gắn cờ là cận dưới.
            </p>
            <p className="text-xs text-stone-600">Kho chưa thay đổi cho tới khi nhập file cập nhật ở bước “Nhập mức độ” và xác nhận. Tiến độ rà được lưu trên trình duyệt này.</p>
            <button type="button" className={source ? button : primary} disabled={busy} onClick={() => void run(async () => {
                const prepared = await exportChapterOutcomes(chapterId);
                setSource({ exportId: prepared.manifest.export_id, items: buildLevelReview(prepared.file.questions as never) });
                setLimit(pageSize);
            })}><ListChecks className="size-4" />{source ? 'Lấy lại câu hỏi mới nhất' : 'Lấy câu hỏi của chương để rà'}</button>
        </div>

        {source && <>
            <div className="grid gap-2 rounded-xl bg-stone-50 p-3 text-sm sm:grid-cols-4">
                <p><span className="block text-xs text-stone-600">Câu TN + TLN</span><strong className="tabular-nums">{summary.total}</strong></p>
                <p><span className="block text-xs text-stone-600">Bị gắn cờ</span><strong className="tabular-nums">{summary.flagged}</strong></p>
                <p><span className="block text-xs text-stone-600">Đã rà</span><strong className="tabular-nums">{summary.reviewed}/{summary.flagged}</strong></p>
                <p><span className="block text-xs text-stone-600">Kết quả</span><span className="tabular-nums">
                    Giữ {summary.counts.keep} · Mức {summary.counts.level} · YCCĐ {summary.counts.outcomes} · Cả hai {summary.counts.both}</span></p>
            </div>
            <div className="space-y-1 rounded-xl border border-dashed border-stone-300 p-3 text-sm">
                <label className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">Nạp đề xuất (JSON):</span>
                    <input type="file" accept=".json,application/json" disabled={busy} onChange={event => {
                        const file = event.target.files?.[0]; event.target.value = '';
                        if (!file) return;
                        void run(async () => {
                            const result = applyLevelSuggestions(items, decisions, await file.text());
                            setDecisions(result.decisions);
                            setLoadNote('Đã điền sẵn ' + result.applied + ' câu theo đề xuất' + (result.skipped ? ', bỏ qua ' + result.skipped + ' câu (đã xác nhận, không còn trong kho hoặc không hợp lệ)' : '')
                                + '. Đề xuất chưa được tính là đã rà: đọc từng câu rồi bấm Xác nhận hoặc sửa lại.');
                        });
                    }} />
                </label>
                <p className="text-xs text-stone-600">Đề xuất chỉ điền sẵn mức độ, YCCĐ và lý do; người rà vẫn phải xác nhận từng câu.</p>
                {loadNote && <p role="status" className="text-emerald-900">{loadNote}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" checked={onlyOpen} onChange={event => { setOnlyOpen(event.target.checked); setLimit(pageSize); }} />Chỉ hiện câu chưa rà</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={showAll} onChange={event => { setShowAll(event.target.checked); setLimit(pageSize); }} />Hiện cả câu không bị gắn cờ</label>
            </div>
            <div className="space-y-3">
                {visible.slice(0, limit).map(item => <ReviewCard key={item.questionId} item={item} chapterId={chapterId}
                    decision={currentDecision(item, decisions[item.questionId])}
                    onChange={decision => setDecisions(previous => ({ ...previous, [item.questionId]: decision }))} />)}
                {!visible.length && <p className="rounded-lg border border-stone-200 bg-white p-4 text-sm text-stone-600">Không còn câu nào trong danh sách này.</p>}
                {visible.length > limit && <button type="button" className={button} onClick={() => setLimit(previous => previous + pageSize)}>
                    Xem thêm ({visible.length - limit} câu)</button>}
            </div>
            <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
                <p className="text-sm text-stone-700">{update?.updates.length ? update.updates.length + ' câu đã xác nhận sẽ được sửa trong kho.'
                    : summary.reviewed ? 'Các câu đã xác nhận đều giữ nguyên, kho không cần sửa.'
                    : 'Chưa xác nhận câu nào. Bấm nút "Xác nhận" ở cuối từng câu; nút bên phải sẽ sáng khi có câu cần sửa.'}</p>
                <div className="flex flex-wrap gap-2">
                    <button type="button" className={button} disabled={!summary.reviewed}
                        onClick={() => download('ra-muc-do-yccd-' + chapterId + '.csv', levelReviewCsv(items, decisions), 'text/csv;charset=utf-8')}>
                        <Download className="size-4" />Báo cáo CSV</button>
                    <button type="button" className={primary} disabled={!update?.updates.length}
                        onClick={() => onUpdateReady(JSON.stringify(update, null, 2))}>
                        <FileJson className="size-4" />Chuyển {update?.updates.length ?? 0} câu sang bước Nhập mức độ</button>
                </div>
            </div>
        </>}
    </section>;
}
