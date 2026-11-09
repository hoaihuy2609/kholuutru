import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { MATRIX_LEVELS, type MatrixMatchEvidence } from '../src/utils/examMatrix';
import SolutionRenderer, { SolutionQuestionPrompt } from './SolutionRenderer';
import type { MatrixCandidate } from './ExamMatrixBuilder';

const action = 'rounded-lg border border-stone-200 px-3 py-2 text-sm font-semibold hover:bg-stone-50';

interface CardProps {
    candidate: MatrixCandidate;
    score: number;
    evidence: MatrixMatchEvidence[];
    selected: boolean;
    used: boolean;
    recent: boolean;
    onPreview: () => void;
    onChoose: () => void;
}

export function MatrixQuestionCard({ candidate, score, evidence, selected, used, recent, onPreview, onChoose }: CardProps) {
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
                <span>{[candidate.topic, candidate.grade && `Lớp ${candidate.grade}`, item.level && MATRIX_LEVELS[item.level]].filter(Boolean).join(' · ')}</span>
                {recent && <span className="rounded bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-900">Vừa soạn</span>}
                {selected && <span className="inline-flex items-center gap-1 font-semibold text-emerald-800"><Check aria-hidden="true" className="size-3.5" /> Đã chọn</span>}
            </div>

            <div className="space-y-1.5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950">
                <p className="text-xs font-semibold">{score === 1 ? 'Khớp trực tiếp' : 'Gần khớp'} · {evidence.length} yêu cầu</p>
                <ul className="space-y-1.5">
                    {evidence.map(match => <li key={`${match.rowIndex}:${match.lineIndex}`}>
                        {match.score === 1 ? <strong>{match.requirement}</strong> : <>
                            <p>Ma trận yêu cầu <strong>{match.requirement}</strong></p>
                            <p>Câu trong kho đánh giá <strong>{match.outcome}</strong></p>
                        </>}
                    </li>)}
                </ul>
            </div>

            <div id={promptId} ref={viewport} className={'relative min-w-0 ' + (expanded ? '' : 'max-h-64 overflow-hidden')}>
                <div ref={prompt}><SolutionQuestionPrompt content={content} /></div>
                {clipped && !expanded && <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-7 bg-gradient-to-t from-white to-transparent" />}
            </div>
            {clipped && <button type="button" aria-expanded={expanded} aria-controls={promptId} onClick={() => setExpanded(value => !value)}
                className="text-sm font-semibold text-amber-900 underline-offset-2 hover:underline">
                {expanded ? 'Thu gọn đề bài' : 'Xem đầy đủ đề bài'}
            </button>}

            <div className="flex flex-wrap items-center gap-2 border-t border-stone-100 pt-3">
                <button type="button" className="rounded-lg bg-amber-800 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-900 disabled:opacity-50"
                    disabled={used} onClick={onChoose}>{used ? 'Đã dùng ở vị trí khác' : selected ? 'Bỏ câu này' : 'Chọn câu này'}</button>
                <button type="button" className={action} aria-haspopup="dialog" onClick={onPreview}>Xem lời giải</button>
                {otherOutcomes.length > 0 && <details className="basis-full text-sm text-stone-600">
                    <summary className="cursor-pointer py-1">Xem {otherOutcomes.length} yêu cầu khác của câu</summary>
                    <ul className="list-disc space-y-1 pl-5">{otherOutcomes.map(outcome => <li key={outcome}>{outcome}</li>)}</ul>
                </details>}
            </div>
        </article>
    );
}

export function MatrixSolutionDialog({ candidate, onClose }: { candidate: MatrixCandidate; onClose: () => void }) {
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
            className="fixed inset-0 m-auto h-[94dvh] max-h-none w-[96vw] max-w-none overflow-hidden rounded-xl border border-stone-200 bg-stone-50 p-0 shadow-xl backdrop:bg-black/25 open:flex open:flex-col lg:inset-y-0 lg:left-auto lg:right-0 lg:m-0 lg:h-[100dvh] lg:w-[min(48vw,46rem)] lg:rounded-r-none">
            <header className="flex items-center justify-between gap-3 border-b border-stone-200 bg-white px-4 py-3">
                <h2 id={titleId} className="font-bold">Lời giải · {candidate.item.questionNo}</h2>
                <button type="button" aria-label="Đóng lời giải" className={action} onClick={onClose}><X aria-hidden="true" className="size-4" /></button>
            </header>
            <div className="min-h-0 flex-1 overflow-auto overscroll-contain p-3 sm:p-4">
                <SolutionRenderer content={candidate.preview()} />
            </div>
        </dialog>
    );
}
