import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Check, X } from 'lucide-react';
import { MATRIX_LEVELS, type MatrixMatchEvidence } from '../src/utils/examMatrix';
import { STUDY_QUESTION_GROUPS } from '../src/utils/studyLibrary';
import { questionLevelLabel, questionLevels } from '../src/utils/cognitiveLevels';
import SolutionRenderer, { SolutionQuestionPrompt } from './SolutionRenderer';
import type { MatrixCandidate } from './ExamMatrixBuilder';

const action = 'rounded-lg border border-stone-200 px-3 py-2 text-sm font-semibold hover:bg-stone-50';

interface CardProps {
    candidate: MatrixCandidate;
    score: number;
    evidence: MatrixMatchEvidence[];
    selected: boolean;
    used: boolean;
    recent?: boolean;
    showOutcomes?: boolean;
    /** Why the question cannot be chosen here, shown on the disabled button instead of the default text. */
    blockedLabel?: string;
    /** Extra labels shown in the card header, e.g. how the question matches its programme requirement. */
    badges?: ReactNode;
    /** Requirement lines shown instead of the question's own stored outcomes, e.g. its lines in the specification by lesson. */
    requirements?: ReactNode;
    onPreview: () => void;
    onChoose: () => void;
}

export function MatrixQuestionCard({ candidate, score, evidence, selected, used, recent, showOutcomes, blockedLabel, badges, requirements, onPreview, onChoose }: CardProps) {
    const { item } = candidate;
    const [expanded, setExpanded] = useState(false);
    const [clipped, setClipped] = useState(false);
    const viewport = useRef<HTMLDivElement>(null);
    const prompt = useRef<HTMLDivElement>(null);
    const promptId = useId();
    const content = useMemo(candidate.preview, [candidate]);
    const matchedOutcomes = new Set(evidence.map(match => match.outcome));
    const otherOutcomes = candidate.outcomes.filter(outcome => !matchedOutcomes.has(outcome));

    useEffect(() => {
        const element = prompt.current;
        const frame = viewport.current;
        if (!element || !frame || expanded) return;
        const measure = () => setClipped(element.scrollHeight > frame.clientHeight + 1);
        const observer = new ResizeObserver(measure);
        observer.observe(element);
        observer.observe(frame);
        measure();
        return () => observer.disconnect();
    }, [expanded, content]);

    return (
        <article className={'min-w-0 space-y-3 rounded-xl border bg-white p-4 ' + (selected ? 'border-amber-500' : 'border-stone-200')}>
            <div className="flex flex-wrap items-center gap-2 text-xs text-stone-600">
                <span className="font-bold text-stone-900">{item.questionNo}</span>
                <span>{[candidate.topic, candidate.grade && `Lớp ${candidate.grade}`, questionLevelLabel(item)].filter(Boolean).join(' · ')}</span>
                {showOutcomes && item.type === 'trac_nghiem' && STUDY_QUESTION_GROUPS.filter(group => candidate.groups?.includes(group.value))
                    .map(group => <span key={group.value} className="rounded bg-stone-100 px-2 py-0.5">{group.label}</span>)}
                {recent && <span className="rounded bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-900">Vừa soạn</span>}
                {selected && <span className="inline-flex items-center gap-1 font-semibold text-emerald-800"><Check aria-hidden="true" className="size-3.5" /> Đã chọn</span>}
                {badges}
            </div>
            {item.type === 'dung_sai' && <p className="text-xs text-stone-600">
                {questionLevels(item).map((level, index) => `${'abcd'[index]}) ${MATRIX_LEVELS[level]}`).join(' · ')}
            </p>}

            {evidence.length > 0 ? <div className="space-y-1.5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950">
                <p className="text-xs font-semibold">{score === 1 ? 'Khớp trực tiếp' : 'Gần khớp'} · {evidence.length} yêu cầu</p>
                <ul className="space-y-1.5">
                    {evidence.map(match => <li key={`${match.rowIndex}:${match.lineIndex}`}>
                        {match.score === 1 ? <strong>{match.requirement}</strong> : <>
                            <p>Ma trận yêu cầu <strong>{match.requirement}</strong></p>
                            <p>Câu trong kho đánh giá <strong>{match.outcome}</strong></p>
                        </>}
                    </li>)}
                </ul>
            </div> : !showOutcomes && (
                <p className="rounded-lg bg-stone-100 px-3 py-2 text-xs font-semibold text-stone-700">
                    Cùng nội dung · Chưa xác nhận khớp yêu cầu cần đạt
                </p>
            )}

            <div id={promptId} ref={viewport} className={'relative min-w-0 ' + (expanded ? '' : 'max-h-64 overflow-hidden')}>
                <div ref={prompt}><SolutionQuestionPrompt content={content} /></div>
                {clipped && !expanded && <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-7 bg-gradient-to-t from-white to-transparent" />}
            </div>
            {clipped && <button type="button" aria-expanded={expanded} aria-controls={promptId} onClick={() => setExpanded(value => !value)}
                className="text-sm font-semibold text-amber-900 underline-offset-2 hover:underline">
                {expanded ? 'Thu gọn đề bài' : 'Xem đầy đủ đề bài'}
            </button>}
            {showOutcomes && <div className="space-y-1 rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-700">
                <p className="text-xs font-semibold text-stone-900">Yêu cầu cần đạt</p>
                {requirements ?? (candidate.outcomes.length ? <ul className="list-disc space-y-1 pl-4">
                    {candidate.outcomes.map(outcome => <li key={outcome}>{outcome}</li>)}
                </ul> : <p className="text-xs text-stone-500">Câu này chưa có YCCĐ.</p>)}
            </div>}

            <div className="flex flex-wrap items-center gap-2 border-t border-stone-100 pt-3">
                <button type="button" className="rounded-lg bg-amber-800 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-900 disabled:opacity-50"
                    disabled={used || (!selected && !!blockedLabel)} onClick={onChoose}>
                    {used ? 'Đã dùng ở vị trí khác' : selected ? 'Bỏ câu này' : blockedLabel ?? 'Chọn câu này'}</button>
                <button type="button" className={action} aria-haspopup="dialog" onClick={onPreview}>Xem lời giải</button>
                {!showOutcomes && otherOutcomes.length > 0 && <details className="basis-full text-sm text-stone-600">
                    <summary className="cursor-pointer py-1">Xem {otherOutcomes.length} yêu cầu khác của câu</summary>
                    <ul className="list-disc space-y-1 pl-5">{otherOutcomes.map(outcome => <li key={outcome}>{outcome}</li>)}</ul>
                </details>}
            </div>
        </article>
    );
}

export function MatrixDialog({ title, subtitle, closeLabel = 'Đóng', children, onClose, full = false, actions }: {
    title: string;
    subtitle?: string;
    closeLabel?: string;
    children: ReactNode;
    onClose: () => void;
    /** Toàn màn hình; phần thân tự lo cuộn (không thêm padding, không cuộn chung). */
    full?: boolean;
    /** Nút đặt trên thanh tiêu đề, cạnh nút đóng. */
    actions?: ReactNode;
}) {
    const dialog = useRef<HTMLDialogElement>(null);
    const titleId = useId();
    useEffect(() => {
        const element = dialog.current;
        const trigger = document.activeElement;
        const overflow = document.body.style.overflow;
        element?.showModal();
        document.body.style.overflow = 'hidden';
        return () => {
            element?.close();
            document.body.style.overflow = overflow;
            if (trigger instanceof HTMLElement) trigger.focus({ preventScroll: true });
        };
    }, []);

    return (
        <dialog ref={dialog} aria-labelledby={titleId}
            onCancel={event => { event.preventDefault(); onClose(); }}
            onClick={event => { if (event.target === event.currentTarget) onClose(); }}
            className={full
                ? 'fixed inset-0 m-0 h-[100dvh] max-h-none w-screen max-w-none overflow-hidden border-0 bg-stone-50 p-0 backdrop:bg-black/25 open:flex open:flex-col'
                : 'fixed inset-auto left-1/2 top-1/2 m-0 h-[94dvh] max-h-none w-[min(96vw,1100px)] max-w-none -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-stone-200 bg-stone-50 p-0 shadow-xl backdrop:bg-black/25 open:flex open:flex-col sm:h-[min(90dvh,900px)]'}>
            <header className="flex items-center justify-between gap-3 border-b border-stone-200 bg-white px-4 py-3">
                <div>
                    <h2 id={titleId} className="font-bold">{title}</h2>
                    {subtitle && <p className="mt-0.5 text-sm text-stone-600">{subtitle}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    {actions}
                    <button type="button" aria-label={closeLabel} className={action} onClick={onClose}><X aria-hidden="true" className="size-4" /></button>
                </div>
            </header>
            {full ? <div className="flex min-h-0 flex-1 flex-col">{children}</div>
                : <div className="min-h-0 flex-1 overflow-auto overscroll-contain p-3 sm:p-4">
                    {children}
                </div>}
        </dialog>
    );
}

export function MatrixSolutionDialog({ candidate, onClose }: { candidate: MatrixCandidate; onClose: () => void }) {
    return <MatrixDialog title={`Lời giải · ${candidate.item.questionNo}`} closeLabel="Đóng lời giải" onClose={onClose}>
        <SolutionRenderer content={candidate.preview()} />
    </MatrixDialog>;
}
