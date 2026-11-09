import { useEffect, useId, useRef, useState } from 'react';
import { FileText, X } from 'lucide-react';
import type { StudyQuestionType } from '../types';
import { STUDY_GRADES, STUDY_QUESTION_TYPES } from '../src/utils/studyLibrary';
import { pdfSolutionText, type PdfExamQuestion } from '../src/utils/pdfExamQuestions';
import { convertPdfMathToLatex } from '../src/utils/pdfMathLatex';
import { SolutionQuestions } from './SolutionRenderer';

export interface ReviewedPdfQuestion extends PdfExamQuestion {
    imageFile?: File;
}

interface Props {
    fixedGrade?: number;
    requiredType?: StudyQuestionType;
    onClose: () => void;
    onSave: (source: string, grade: number, questions: ReviewedPdfQuestion[]) => Promise<void>;
}

const labels = ['A', 'B', 'C', 'D'];
const statementLabels = ['a', 'b', 'c', 'd'] as const;
const field = 'w-full rounded-lg border border-stone-300 bg-white p-2 text-sm';
const button = 'inline-flex items-center rounded-lg border border-stone-300 px-3 py-2 text-sm font-semibold hover:bg-stone-100 disabled:opacity-50';

function hasAnswer(question: PdfExamQuestion) {
    return question.type === 'dung_sai' ? question.verdicts.every(verdict => verdict !== null) : !!question.answer.trim();
}

function isComplete(question: PdfExamQuestion) {
    return !!question.text.trim() && (question.type === 'tu_luan' || question.options.every(option => option.trim()));
}

export default function PdfExamImport({ fixedGrade, requiredType, onClose, onSave }: Props) {
    const dialog = useRef<HTMLDialogElement>(null);
    const titleId = useId();
    const [file, setFile] = useState<File>();
    const [sourceUrl, setSourceUrl] = useState('');
    const [source, setSource] = useState('');
    const [grade, setGrade] = useState(fixedGrade || 12);
    const [questions, setQuestions] = useState<ReviewedPdfQuestion[]>([]);
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [reviewed, setReviewed] = useState<Set<number>>(new Set());
    const [active, setActive] = useState(0);
    const [view, setView] = useState<'page' | 'answerPage' | 'solutionPage'>('page');
    const [emptyPages, setEmptyPages] = useState<number[]>([]);
    const [unmatchedEntries, setUnmatchedEntries] = useState(0);
    const [progress, setProgress] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [latexNotice, setLatexNotice] = useState('');
    const busy = !!progress || saving;
    const current = questions[active];
    const isSelected = (question: PdfExamQuestion, index: number) => selected.has(index) && (!requiredType || question.type === requiredType);
    const approved = questions.filter(isSelected);
    const pendingReview = questions.filter((question, index) => isSelected(question, index) && !reviewed.has(index)).length;
    const incomplete = approved.filter(question => !isComplete(question)).length;

    useEffect(() => {
        const element = dialog.current;
        element?.showModal();
        return () => element?.close();
    }, []);

    useEffect(() => {
        if (!file) return;
        const url = URL.createObjectURL(file);
        setSourceUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [file]);

    async function loadPdf(pdf: File) {
        setError('');
        setLatexNotice('');
        setFile(pdf);
        setSource(pdf.name.replace(/\.pdf$/i, ''));
        setQuestions([]);
        setSelected(new Set());
        setReviewed(new Set());
        setActive(0);
        setView('page');
        setEmptyPages([]);
        setUnmatchedEntries(0);
        setProgress('Đang mở PDF…');
        try {
            const { readPdfExam } = await import('../src/services/pdfExamReader');
            const result = await readPdfExam(pdf, (page, total) => setProgress('Đang đọc trang ' + page + '/' + total + '…'));
            setQuestions(result.questions);
            setEmptyPages(result.emptyPages);
            setUnmatchedEntries(result.unmatchedEntries);
            setSelected(new Set(result.questions.flatMap((question, index) =>
                !requiredType || question.type === requiredType ? [index] : [])));
            if (!result.questions.length) {
                setError('Chưa tách được câu hỏi. Hãy dùng PDF có thể copy chữ và có số câu dạng “Câu 1.”.');
            }
        } catch (err) {
            console.error('[PDF import]', err);
            setError('Không đọc được PDF. Kiểm tra xem file có mở được và có cần mật khẩu không.');
        } finally {
            setProgress('');
        }
    }

    const edit = (patch: Partial<ReviewedPdfQuestion>) => {
        setQuestions(previous => previous.map((question, index) => index === active ? { ...question, ...patch } : question));
        setReviewed(previous => {
            if (!previous.has(active)) return previous;
            const next = new Set(previous);
            next.delete(active);
            return next;
        });
    };

    function openQuestion(index: number) {
        setActive(index);
        setView('page');
        setLatexNotice('');
    }

    function convertMath() {
        if (!current) return;
        const patch = {
            text: convertPdfMathToLatex(current.text),
            options: current.options.map(convertPdfMathToLatex),
            answer: convertPdfMathToLatex(current.answer),
            solution: convertPdfMathToLatex(current.solution),
        };
        const changed = patch.text !== current.text || patch.answer !== current.answer || patch.solution !== current.solution
            || patch.options.some((value, index) => value !== current.options[index]);
        if (changed) edit(patch);
        setLatexNotice(changed
            ? 'Đã chuyển các ký hiệu nhận diện được. Mở bản xem trước để đối chiếu với PDF.'
            : 'Chưa thấy ký hiệu Unicode có thể chuyển trong câu này. Có thể nhập công thức giữa hai dấu $ để xem trước.');
    }

    async function save() {
        if (!approved.length || incomplete || pendingReview || !source.trim() || busy) return;
        setSaving(true);
        setError('');
        try {
            await onSave(source.trim(), fixedGrade || grade, approved);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Chưa lưu được lô câu hỏi.');
        } finally {
            setSaving(false);
        }
    }

    const pdfPageUrl = sourceUrl ? sourceUrl + '#page=' + (current?.source[view] ?? current?.source.page ?? 1) : '';

    return (
        <dialog ref={dialog} aria-labelledby={titleId}
            onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
            className="m-auto h-[min(92dvh,920px)] w-[min(96vw,1400px)] max-h-none max-w-none overflow-hidden rounded-xl border border-stone-200 bg-stone-50 p-0 backdrop:bg-black/50 open:flex open:flex-col">
            <header className="flex items-center justify-between gap-2 border-b border-stone-200 bg-white px-4 py-3">
                <h2 id={titleId} className="flex items-center gap-2 font-bold text-stone-900"><FileText className="size-4 text-amber-800" /> Nhập câu hỏi từ PDF</h2>
                <button type="button" aria-label="Đóng nhập PDF" disabled={busy} onClick={onClose} className={button}><X className="size-4" /></button>
            </header>
            <div className="grid min-h-0 flex-1 overflow-auto lg:grid-cols-2 lg:overflow-hidden">
                <section aria-label="Đề gốc" className="flex min-h-0 min-w-0 flex-col gap-2 border-stone-200 p-3 lg:border-r">
                    <label className="grid gap-1 text-sm font-semibold">Chọn file PDF có thể copy chữ
                        <input type="file" accept="application/pdf,.pdf" disabled={busy} className={field}
                            onChange={event => { const pdf = event.target.files?.[0]; if (pdf) void loadPdf(pdf); event.target.value = ''; }} />
                    </label>
                    {progress && <p role="status" className="text-sm text-stone-700">{progress}</p>}
                    {pdfPageUrl && <>
                        {current && <div className="flex flex-wrap gap-2" aria-label="Trang đối chiếu">
                            {([
                                ['page', 'Đề'],
                                ['answerPage', 'Đáp án'],
                                ['solutionPage', 'Lời giải'],
                            ] as const).map(([key, label]) => current.source[key] && (
                                <button key={key} type="button" aria-pressed={view === key}
                                    className={button + (view === key ? ' border-amber-300 bg-amber-50' : '')}
                                    onClick={() => setView(key)}>{label} · Trang {current.source[key]}</button>
                            ))}
                        </div>}
                        <a href={pdfPageUrl} target="_blank" rel="noreferrer" className="self-start text-sm text-amber-900 underline">Mở PDF gốc ở tab mới</a>
                        <iframe key={pdfPageUrl} title="PDF gốc" src={pdfPageUrl} className="h-56 w-full rounded-lg border border-stone-200 bg-white lg:h-auto lg:flex-1" />
                    </>}
                </section>
                <section aria-label="Duyệt câu hỏi" className="min-h-0 min-w-0 space-y-3 p-3 lg:overflow-auto">
                    {error && <p role="alert" className="rounded-lg bg-red-50 p-2 text-sm text-red-800">{error}</p>}
                    {emptyPages.length > 0 && <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
                        Không đọc được chữ ở trang {emptyPages.join(', ')}. Đối chiếu PDF gốc để kiểm tra câu bị thiếu.
                    </p>}
                    {unmatchedEntries > 0 && <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
                        Có {unmatchedEntries} mục đáp án hoặc lời giải chưa ghép được. Kiểm tra phần cuối PDF.
                    </p>}
                    {current && <>
                        <fieldset disabled={busy} className="space-y-3">
                            <div className="grid grid-cols-[1fr_auto] gap-2">
                                <label className="text-sm font-semibold">Nguồn đề<input className={field} value={source} onChange={event => setSource(event.target.value)} /></label>
                                <label className="text-sm font-semibold">Lớp
                                    <select className={field} value={fixedGrade || grade} disabled={!!fixedGrade} onChange={event => setGrade(Number(event.target.value))}>
                                        {STUDY_GRADES.map(item => <option key={item} value={item}>{item}</option>)}
                                    </select>
                                </label>
                            </div>
                            {requiredType && <p className="text-sm text-stone-600">Chỉ lưu câu thuộc loại đã chọn ở vị trí trong kho. Mở đợt nhập khác để lưu các loại còn lại.</p>}
                            <label className="grid gap-1 text-sm font-semibold">Câu đang duyệt · {questions.length} câu tìm được
                                <select className={field} value={active} onChange={event => openQuestion(Number(event.target.value))}>
                                    {questions.map((question, index) => <option key={index} value={index}>
                                        {index + 1}. {question.source.label} · Trang {question.source.page}
                                        {!isSelected(question, index) ? ' · Bỏ qua' : reviewed.has(index) ? ' · Đã đối chiếu' : ' · Cần đối chiếu'}
                                    </option>)}
                                </select>
                            </label>
                            <div className="flex flex-wrap items-center gap-2">
                                <button type="button" className={button} disabled={active === 0} onClick={() => openQuestion(active - 1)}>Câu trước</button>
                                <button type="button" className={button} disabled={active === questions.length - 1} onClick={() => openQuestion(active + 1)}>Câu sau</button>
                                <label className="flex items-center gap-1.5 text-sm">
                                    <input type="checkbox" checked={selected.has(active)} onChange={event => {
                                        const include = event.target.checked;
                                        setSelected(previous => {
                                            const next = new Set(previous);
                                            if (include) next.add(active); else next.delete(active);
                                            return next;
                                        });
                                    }} />
                                    Lưu câu này
                                </label>
                            </div>
                            {current.source.part && <p className="text-xs text-stone-600">{current.source.part}</p>}
                            {current.needsVisualReview && <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900">Đối chiếu hình và công thức với PDF gốc.</p>}
                            {current.needsMatchReview && <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900">Có đáp án hoặc lời giải bị trùng, mâu thuẫn hoặc thiếu phần. Kiểm tra bản gốc trước khi xác nhận.</p>}
                            {!hasAnswer(current) && <p className="text-sm text-amber-900">Chưa có đáp án đầy đủ. Có thể đối chiếu và nhập ngay hoặc bổ sung sau khi lưu nháp.</p>}
                            <label className="grid gap-1 text-sm font-semibold">Loại câu
                                <select className={field} value={current.type} onChange={event => edit({ type: event.target.value as StudyQuestionType, answer: '', verdicts: labels.map(() => null) })}>
                                    {STUDY_QUESTION_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
                                </select>
                            </label>
                            {requiredType && current.type !== requiredType && <p className="text-sm text-amber-900">Câu này nằm ngoài loại đã chọn cho đợt nhập.</p>}
                            <label className="grid gap-1 text-sm font-semibold">Nội dung câu hỏi
                                <textarea className={field} rows={4} value={current.text} onChange={event => edit({ text: event.target.value })} />
                            </label>
                            {current.type !== 'tu_luan' && current.options.map((option, index) => (
                                <div key={index} className="flex items-end gap-2">
                                    <label className="grid min-w-0 flex-1 gap-1 text-sm font-semibold">{labels[index]}.
                                        <textarea className={field} rows={2} value={option}
                                            onChange={event => edit({ options: current.options.map((value, position) => index === position ? event.target.value : value) })} />
                                    </label>
                                    {current.type === 'dung_sai' && <select aria-label={'Đáp án ' + labels[index]} className={field + ' !w-auto'}
                                        value={current.verdicts[index] === null ? '' : String(current.verdicts[index])}
                                        onChange={event => {
                                            const value = event.target.value;
                                            edit({ verdicts: current.verdicts.map((verdict, position) => index === position ? value === '' ? null : value === 'true' : verdict) });
                                        }}>
                                        <option value="">Chưa có</option><option value="true">Đúng</option><option value="false">Sai</option>
                                    </select>}
                                </div>
                            ))}
                            {current.type === 'trac_nghiem' && <label className="grid gap-1 text-sm font-semibold">Đáp án đúng
                                <select className={field} value={current.answer} onChange={event => edit({ answer: event.target.value })}>
                                    <option value="">Chưa có</option>
                                    {labels.map(label => <option key={label}>{label}</option>)}
                                </select>
                            </label>}
                            {current.type === 'tu_luan' && <label className="grid gap-1 text-sm font-semibold">Đáp án
                                <textarea className={field} rows={2} value={current.answer} onChange={event => edit({ answer: event.target.value })} />
                            </label>}
                            <label className="grid gap-1 text-sm font-semibold">Lời giải chi tiết
                                <textarea className={field} rows={5} value={current.solution} onChange={event => edit({ solution: event.target.value })} />
                            </label>
                            <div className="space-y-1">
                                <button type="button" className={button} onClick={convertMath}>Chuyển ký hiệu sang LaTeX</button>
                                <p role="status" className="text-xs text-stone-600">{latexNotice || 'Chuyển số mũ, chỉ số và dấu vectơ còn trong lớp chữ PDF.'}</p>
                            </div>
                            <details className="rounded-lg border border-stone-200 bg-white p-2">
                                <summary className="cursor-pointer text-sm font-semibold">Xem trước đề và LaTeX</summary>
                                <SolutionQuestions className="mt-2" questions={[{
                                    question_no: current.source.label, question_text: current.text, question_latex: '',
                                    type: current.type, choices: current.options, correctChoice: current.answer,
                                    solution: pdfSolutionText(current), steps: [],
                                    statements: current.options.map((claim, index) => ({
                                        label: statementLabels[index], claim, claim_latex: '', verdict: current.verdicts[index], steps: [],
                                    })),
                                }]} />
                            </details>
                            <label className="grid gap-1 text-sm font-semibold">Hình minh họa PNG/JPG, tối đa 5 MB
                                <input key={active} className={field} type="file" accept="image/png,image/jpeg" onChange={event => {
                                    const image = event.target.files?.[0];
                                    event.target.value = '';
                                    if (!image) return;
                                    if (!['image/png', 'image/jpeg'].includes(image.type) || !image.size || image.size > 5 * 1024 * 1024) {
                                        setError('Chọn ảnh PNG/JPG hợp lệ, tối đa 5 MB.');
                                        return;
                                    }
                                    setError('');
                                    edit({ imageFile: image });
                                }} />
                            </label>
                            {current.imageFile && <div className="flex items-center gap-2 text-xs text-stone-700">
                                <span className="break-all">{current.imageFile.name}</span>
                                <button type="button" className="shrink-0 underline" onClick={() => edit({ imageFile: undefined })}>Bỏ ảnh</button>
                            </div>}
                            <label className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white p-2 text-sm font-semibold">
                                <input type="checkbox" checked={reviewed.has(active)} disabled={!isSelected(current, active) || !isComplete(current)}
                                    onChange={event => {
                                        const checked = event.target.checked;
                                        setReviewed(previous => {
                                            const next = new Set(previous);
                                            if (checked) next.add(active); else next.delete(active);
                                            return next;
                                        });
                                    }} />
                                Đã đối chiếu đề, đáp án và lời giải
                            </label>
                        </fieldset>
                    </>}
                </section>
            </div>
            <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-200 bg-white p-3">
                <span className="text-sm text-stone-600">Đã đối chiếu {approved.length - pendingReview}/{approved.length} câu được chọn
                    {incomplete > 0 && ' · ' + incomplete + ' câu còn thiếu nội dung hoặc lựa chọn'}
                </span>
                <button type="button" className={button + ' border-amber-800 bg-amber-800 text-white hover:bg-amber-900'}
                    disabled={busy || !approved.length || !!incomplete || !!pendingReview || !source.trim()} onClick={() => void save()}>
                    {saving ? 'Đang lưu…' : 'Lưu ' + approved.length + ' câu dưới dạng nháp'}
                </button>
            </footer>
        </dialog>
    );
}
