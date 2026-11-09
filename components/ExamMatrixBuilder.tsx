import React, { useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronLeft, FileUp, Plus, Trash2 } from 'lucide-react';
import { STUDY_GRADES, STUDY_QUESTION_TYPES } from '../src/utils/studyLibrary';
import { MATRIX_LEVELS, matrixMatchScore, matrixReferences, matrixSlots, normalizeMatrixText, type MatrixQuestionType, type MatrixRow } from '../src/utils/examMatrix';
import type { SelectedQuestionItem } from '../src/services/examLatexService';
import SolutionRenderer from './SolutionRenderer';

export interface MatrixCandidate {
    item: SelectedQuestionItem;
    grade?: number;
    topic: string;
    outcomes: string[];
    preview: () => string;
}

interface Props {
    candidates: MatrixCandidate[];
    onClose: () => void;
    onCompose: (questions: SelectedQuestionItem[]) => void;
}

const questionTypes = [
    { value: '', label: 'Chưa rõ loại' },
    ...STUDY_QUESTION_TYPES,
    { value: 'written', label: 'Tự luận (chưa có trong kho)' },
];
const typeLabel = (type: MatrixQuestionType) => questionTypes.find(option => option.value === type)?.label;
const input = 'w-full rounded-md border border-stone-200 bg-white px-2.5 py-2 text-sm text-stone-900';
const growingInput = input + ' min-w-0 whitespace-pre-wrap [grid-area:1/1] [overflow-wrap:anywhere]';

function MatrixTextarea({ value, ...props }: Pick<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'aria-label' | 'onChange'> & { value: string }) {
    return (
        <div className="grid">
            {/* The hidden copy sizes the grid even when the table changes width. */}
            <div aria-hidden="true" className={growingInput + ' invisible'}>{value + ' '}</div>
            <textarea {...props} value={value} rows={1} className={growingInput + ' resize-none overflow-hidden'} />
        </div>
    );
}
const button = 'inline-flex items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-stone-100 disabled:opacity-50';
const primary = 'rounded-lg bg-amber-800 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-900 disabled:opacity-50';
let rowKey = 0;
const editable = (row: MatrixRow) => ({ ...row, key: ++rowKey, referenceText: row.references.join(', ') });
const emptyRow = () => editable({ section: '', topic: '', outcome: '', type: '', level: 0, count: 1, references: [] });

export default function ExamMatrixBuilder({ candidates, onClose, onCompose }: Props) {
    const [rows, setRows] = useState(() => [emptyRow()]);
    const [grade, setGrade] = useState(0);
    const [reviewing, setReviewing] = useState(true);
    const [source, setSource] = useState<File>();
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState('');
    const [selection, setSelection] = useState<Record<string, string>>({});
    const [activeId, setActiveId] = useState('');
    const [openSection, setOpenSection] = useState<string | null>(null);
    const [previewId, setPreviewId] = useState('');
    const [limit, setLimit] = useState(15);

    const { slots, pendingStatements } = useMemo(() => matrixSlots(rows), [rows]);
    const slotSections = useMemo(() => {
        const groups = new Map<string, { section: string; entries: typeof slots }>();
        for (const entry of slots) {
            const { section, type } = entry.rows[0];
            const key = normalizeMatrixText(section) || type;
            const group = groups.get(key) ?? { section: section.trim(), entries: [] };
            group.entries.push(entry);
            groups.set(key, group);
        }
        return [...groups].map(([key, { section, entries }]) => ({
            key, entries,
            label: [section, ...new Set(entries.flatMap(entry => entry.rows.map(row => typeLabel(row.type))))]
                .filter(Boolean).join(' · '),
        }));
    }, [slots]);
    const slot = slots.find(entry => entry.id === activeId) ?? slots[0];
    const mixedLevels = new Set(slot?.rows.map(row => row.level).filter(Boolean)).size > 1;
    const candidatesById = useMemo(() => new Map(candidates.map(candidate => [candidate.item.id, candidate])), [candidates]);
    const chosenIds = useMemo(() => new Set(Object.values(selection)), [selection]);
    const chosen = slots.flatMap(entry => {
        const candidate = candidatesById.get(selection[entry.id]);
        return candidate ? [candidate.item] : [];
    });
    const available = useMemo(() => {
        if (reviewing || !slot) return [];
        return candidates.flatMap(candidate => {
            const { item } = candidate;
            if (grade && candidate.grade !== grade) return [];
            const score = matrixMatchScore(slot.rows, { type: item.type, level: item.level, outcomes: candidate.outcomes });
            if (!score) return [];
            const topic = normalizeMatrixText(candidate.topic);
            const topicMatch = slot.rows.some(row => row.topic && topic.includes(normalizeMatrixText(row.topic)));
            return [{ candidate, score, topicMatch }];
        }).sort((a, b) => b.score - a.score || Number(b.topicMatch) - Number(a.topicMatch));
    }, [candidates, grade, reviewing, slot]);
    const sections = [...new Set(rows.filter(row => !row.type && row.section).map(row => row.section))];
    const incomplete = rows.some(row => !row.outcome.trim() || !row.type || row.count < 1
        || (!!row.referenceText.trim() && (row.references.length !== row.count
            || (row.countUnit === 'statement' && row.references.some(reference => !/[a-d]$/.test(reference))))));

    function reviseRows(update: (current: ReturnType<typeof editable>[]) => ReturnType<typeof editable>[]) {
        setRows(update);
        setSelection({});
    }

    const updateRow = (key: number, update: Partial<ReturnType<typeof editable>>) =>
        reviseRows(current => current.map(row => row.key === key ? { ...row, ...update } : row));

    async function importPdf(file: File) {
        setBusy(true);
        setNotice('');
        try {
            const { readPdfMatrix } = await import('../src/services/pdfExamReader');
            const result = await readPdfMatrix(file);
            setSource(file);
            if (result.rows.length) {
                setRows(result.rows.map(editable));
                setGrade(result.grades.length === 1 ? result.grades[0] : 0);
                setSelection({});
                setActiveId('');
            }
            const summary = result.rows.length
                ? `Đọc được ${result.rows.length} dòng yêu cầu. Hãy đối chiếu với PDF, nhất là loại và số lượng câu.`
                : 'Chưa nhận diện được bảng đặc tả trong PDF này. Bạn có thể nhập hoặc sửa các dòng bên dưới.';
            const gradeNote = result.grades.length > 1
                ? ` PDF ghi nhiều khối (${result.grades.join(', ')}). Hãy chọn khối theo phạm vi đề.` : '';
            const pageNote = result.unreadPages.length ? ` Trang không có lớp chữ: ${result.unreadPages.join(', ')}.` : '';
            setNotice(summary + gradeNote + pageNote);
        } catch {
            setNotice('Không đọc được PDF. Hãy thử lại hoặc nhập yêu cầu trong bảng.');
        } finally {
            setBusy(false);
        }
    }

    function openSource() {
        if (!source) return;
        const url = URL.createObjectURL(source);
        window.open(url, '_blank', 'noopener,noreferrer');
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }

    function activate(id: string) {
        setActiveId(id);
        setOpenSection(slotSections.find(group => group.entries.some(entry => entry.id === id))?.key ?? null);
        setPreviewId('');
        setLimit(15);
    }

    function choose(id: string) {
        if (!slot) return;
        setSelection(previous => {
            if (previous[slot.id] === id) {
                const next = { ...previous };
                delete next[slot.id];
                return next;
            }
            return Object.values(previous).includes(id) ? previous : { ...previous, [slot.id]: id };
        });
        if (selection[slot.id] !== id) {
            const navigation = slotSections.flatMap(group => group.entries);
            const next = navigation.slice(navigation.indexOf(slot) + 1).find(entry => !selection[entry.id]);
            if (next) activate(next.id);
        }
    }

    return (
        <main className="mx-auto max-w-[1720px] space-y-5 p-4 text-stone-900 md:p-8">
            <button className={button} onClick={onClose}><ChevronLeft className="size-4" /> Góc Học Tập</button>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold">Soạn đề theo ma trận</h1>
                    <p className="mt-1 text-sm text-stone-600">Rà bản đặc tả, rồi chọn câu trong kho cho từng vị trí.</p>
                </div>
                {!reviewing && <button className={button} onClick={() => setReviewing(true)}>Rà lại ma trận</button>}
            </div>

            {reviewing ? <section className="space-y-4 rounded-xl border border-stone-200 bg-white p-4">
                <div className="flex flex-wrap items-center gap-3">
                    <label className={button + (busy ? ' pointer-events-none opacity-50' : ' cursor-pointer')}>
                        <FileUp className="size-4" aria-hidden="true" /> {busy ? 'Đang đọc PDF…' : 'Nạp ma trận PDF'}
                        <input type="file" className="sr-only" accept=".pdf,application/pdf" disabled={busy}
                            onChange={event => {
                                const file = event.currentTarget.files?.[0];
                                if (file) void importPdf(file);
                                event.currentTarget.value = '';
                            }} />
                    </label>
                    {source && <button className={button} onClick={openSource}>Mở PDF gốc</button>}
                    <label className="flex items-center gap-2 text-sm font-semibold">
                        Khối lớp
                        <select className={input} value={grade} onChange={event => {
                            setGrade(Number(event.target.value));
                            setSelection({});
                        }}>
                            <option value={0}>Tất cả</option>
                            {STUDY_GRADES.map(value => <option key={value} value={value}>Lớp {value}</option>)}
                        </select>
                    </label>
                </div>
                {notice && <p role="status" className="rounded-md bg-amber-50 p-2 text-sm text-amber-950">{notice}</p>}
                {pendingStatements > 0 && <p className="rounded-md bg-amber-50 p-2 text-sm text-amber-950">
                    Còn {pendingStatements} ý Đúng/Sai chưa được ghép thành câu. Mỗi câu cần đủ bốn mã, ví dụ C1a, C1b, C1c, C1d.
                </p>}
                {sections.map(section => <label className="flex flex-wrap items-center gap-2 text-sm" key={section}>
                    Gán loại cho các dòng chưa rõ của {section}
                    <select className={input + ' max-w-xs'} value="" onChange={event => {
                        const type = event.target.value as MatrixQuestionType;
                        if (type) reviseRows(current => current.map(row => row.section === section && !row.type ? { ...row, type } : row));
                    }}>
                        {questionTypes.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                </label>)}
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                        <thead className="bg-stone-100 text-stone-700"><tr>
                            {['Phần', 'Chủ đề', 'Yêu cầu cần đạt', 'Loại câu', 'Mức độ', 'Số câu / ý', 'Vị trí', ''].map(label =>
                                <th className="px-2 py-2 font-semibold" key={label}>{label}</th>)}
                        </tr></thead>
                        <tbody>
                            {rows.map((row, index) => <tr key={row.key} className="border-b border-stone-100 align-top">
                                <td className="w-24 p-1"><input className={input} aria-label={`Phần dòng ${index + 1}`} value={row.section}
                                    onChange={event => updateRow(row.key, { section: event.target.value })} />
                                    {row.page && <span className="px-1 text-xs text-stone-500">Trang {row.page}</span>}</td>
                                <td className="w-44 p-1"><MatrixTextarea aria-label={`Chủ đề dòng ${index + 1}`} value={row.topic}
                                    onChange={event => updateRow(row.key, { topic: event.target.value })} /></td>
                                <td className="min-w-52 p-1"><MatrixTextarea aria-label={`Yêu cầu cần đạt dòng ${index + 1}`} value={row.outcome}
                                    onChange={event => updateRow(row.key, { outcome: event.target.value })} />
                                    {row.sourceNote && <p className="text-xs text-amber-900">{row.sourceNote}</p>}</td>
                                <td className="w-44 p-1"><select className={input} aria-label={`Loại câu dòng ${index + 1}`} value={row.type}
                                    onChange={event => updateRow(row.key, { type: event.target.value as MatrixQuestionType })}>
                                    {questionTypes.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                                </select></td>
                                <td className="w-36 p-1"><select className={input} aria-label={`Mức độ dòng ${index + 1}`} value={row.level}
                                    onChange={event => updateRow(row.key, { level: Number(event.target.value) })}>
                                    {MATRIX_LEVELS.map((level, value) => <option key={level} value={value}>{level}</option>)}
                                </select></td>
                                <td className="w-20 p-1"><input type="number" min={1} max={99} className={input} aria-label={`Số câu dòng ${index + 1}`}
                                    value={row.count || ''} onChange={event => updateRow(row.key, { count: Math.min(99, Math.max(0, Math.trunc(Number(event.target.value)))) })} /></td>
                                <td className="w-28 p-1"><input className={input} placeholder="C6, C7" aria-label={`Vị trí dòng ${index + 1}`} value={row.referenceText}
                                    onChange={event => {
                                        const referenceText = event.target.value;
                                        updateRow(row.key, { referenceText, references: matrixReferences(referenceText) });
                                    }} /></td>
                                <td className="p-1"><button className={button} aria-label={`Xóa dòng ${index + 1}`}
                                    onClick={() => reviseRows(current => current.filter(entry => entry.key !== row.key))}><Trash2 className="size-4" /></button></td>
                            </tr>)}
                        </tbody>
                    </table>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <button className={button} onClick={() => reviseRows(current => [...current, emptyRow()])}><Plus className="size-4" /> Thêm dòng</button>
                    {incomplete && <span className="text-sm text-stone-600">Kiểm tra yêu cầu, loại câu và số lượng vị trí. Với các dòng đếm theo ý, dùng mã như C1a, C1b.</span>}
                    <button className={primary} disabled={busy || !slots.length || incomplete} onClick={() => {
                        activate(slot?.id ?? slots[0].id);
                        setReviewing(false);
                    }}>Tìm câu theo ma trận</button>
                </div>
            </section> : slot && <div className="grid items-start gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
                <aside className="rounded-xl border border-stone-200 bg-white">
                    <p className="border-b border-stone-200 px-4 py-3 text-sm font-bold" role="status">Đã chọn {chosen.length}/{slots.length} câu</p>
                    <div className="max-h-64 space-y-2 overflow-y-auto p-2 lg:max-h-[65vh]">
                        {slotSections.map((group, groupIndex) => {
                            const expanded = openSection === group.key;
                            const selectedCount = group.entries.filter(entry => candidatesById.has(selection[entry.id])).length;
                            const panelId = `matrix-section-${groupIndex}`;
                            return <div key={group.key} className="rounded-lg border border-stone-200">
                                <button type="button" aria-expanded={expanded} aria-controls={panelId}
                                    onClick={() => setOpenSection(expanded ? null : group.key)}
                                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2.5 text-left text-sm font-semibold hover:bg-stone-50">
                                    <ChevronDown aria-hidden="true" className={'size-4 shrink-0 text-stone-500 ' + (expanded ? '' : '-rotate-90')} />
                                    <span className="min-w-0 flex-1">{group.label}</span>
                                    <span className="shrink-0 rounded bg-stone-100 px-1.5 py-0.5 text-xs tabular-nums text-stone-700">{selectedCount}/{group.entries.length}</span>
                                </button>
                                <div id={panelId} hidden={!expanded}
                                    className={expanded ? 'grid grid-cols-[repeat(auto-fill,minmax(2.5rem,1fr))] gap-1.5 border-t border-stone-100 p-2' : undefined}>
                                    {expanded && group.entries.map((entry, index) => {
                                        const current = entry.id === slot.id;
                                        const selected = candidatesById.has(selection[entry.id]);
                                        const label = `${entry.label}${selected ? ', đã chọn' : ''}`;
                                        return <button key={entry.id} type="button" onClick={() => activate(entry.id)}
                                            aria-current={current ? 'step' : undefined} aria-label={label} title={label}
                                            className={'flex min-h-9 items-center justify-center gap-0.5 rounded-md border px-1 text-sm font-semibold tabular-nums ' +
                                                (current ? 'border-amber-600 bg-amber-100 text-amber-950'
                                                    : selected ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                                        : 'border-stone-200 text-stone-800 hover:bg-stone-100')}>
                                            <span>{entry.number ?? `#${index + 1}`}</span>
                                            {selected && <Check aria-hidden="true" className="size-3 shrink-0" />}
                                        </button>;
                                    })}
                                </div>
                            </div>;
                        })}
                    </div>
                    <div className="space-y-2 border-t border-stone-200 p-3">
                        <button className={primary + ' w-full'} disabled={!chosen.length} onClick={() => onCompose(chosen)}>
                            Biên soạn {chosen.length} câu đã chọn
                        </button>
                        {chosen.length < slots.length && <p className="text-xs text-stone-600">Còn {slots.length - chosen.length} vị trí chưa có câu.</p>}
                        {pendingStatements > 0 && <p className="text-xs text-amber-900">Còn {pendingStatements} ý Đúng/Sai cần ghép câu trong bảng rà soát.</p>}
                    </div>
                </aside>
                <section className="space-y-3">
                    <div className="space-y-2 rounded-xl border border-stone-200 bg-white p-4">
                        <h2 className="text-lg font-bold">{slot.label}</h2>
                        {slot.rows.map(row => <div className="text-sm" key={rows.indexOf(row as typeof rows[number])}>
                            <p className="text-stone-600">{[row.topic, typeLabel(row.type), row.level ? MATRIX_LEVELS[row.level] : 'Mọi mức độ'].filter(Boolean).join(' · ')}</p>
                            <p className="mt-0.5 whitespace-pre-line font-semibold">{row.outcome}</p>
                        </div>)}
                    </div>
                    {!available.length && <p className="rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-600">
                        {slot.rows.some(row => row.type === 'written')
                            ? 'Kho câu hỏi hiện chưa có dạng tự luận. Vị trí này được giữ trong ma trận để theo dõi.'
                            : mixedLevels
                            ? 'Câu này có nhiều mức độ theo từng ý. Kho hiện chỉ lưu một mức độ cho mỗi câu.'
                            : 'Chưa có câu phù hợp. Kiểm tra lại yêu cầu của vị trí này hoặc gắn yêu cầu cần đạt cho câu trong kho.'}
                    </p>}
                    {available.slice(0, limit).map(({ candidate, score }) => {
                        const { item } = candidate;
                        const selected = selection[slot.id] === item.id;
                        const used = chosenIds.has(item.id) && !selected;
                        return <article key={item.id} className="space-y-2 rounded-xl border border-stone-200 bg-white p-4">
                            <p className="text-sm text-stone-600">{[candidate.topic, candidate.grade && `Lớp ${candidate.grade}`,
                                item.level && MATRIX_LEVELS[item.level], score < 1 ? 'Yêu cầu gần khớp' : 'Khớp yêu cầu'].filter(Boolean).join(' · ')}</p>
                            <p className="whitespace-pre-line text-base">{item.qText || item.qFormula}</p>
                            <p className="text-xs text-stone-600">{candidate.outcomes.join(' · ')}</p>
                            <div className="flex flex-wrap gap-2">
                                <button className={button} aria-expanded={previewId === item.id}
                                    onClick={() => setPreviewId(previewId === item.id ? '' : item.id)}>Xem câu và lời giải</button>
                                <button className={selected ? button : primary} disabled={used} onClick={() => choose(item.id)}>
                                    {used ? 'Đã dùng ở vị trí khác' : selected ? 'Bỏ câu này' : 'Chọn câu này'}
                                </button>
                            </div>
                            {previewId === item.id && <SolutionRenderer content={candidate.preview()} />}
                        </article>;
                    })}
                    {available.length > limit && <button className={button} onClick={() => setLimit(limit + 15)}>Xem thêm câu phù hợp</button>}
                </section>
            </div>}
        </main>
    );
}
