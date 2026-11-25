import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { CircleHelp, X } from 'lucide-react';
import { hasSeenMatrixTour, markMatrixTourSeen, MATRIX_TOUR_STEPS, placeTourCard, type TourRect } from '../src/utils/matrixTour';

const PAD = 6;
const button = 'inline-flex min-h-9 items-center justify-center rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm font-semibold text-stone-800 hover:bg-stone-100 disabled:opacity-50';
const primary = 'inline-flex min-h-9 items-center justify-center rounded-lg bg-amber-800 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-amber-900 disabled:cursor-not-allowed disabled:opacity-50';

/** Mọi phần tử đang hiển thị của nhóm đầu tiên có trên trang (một bước có thể chỉ vào nhiều phần tử, ví dụ các dòng của bảng). */
function findTargets(targets: readonly string[]): HTMLElement[] {
    for (const name of targets) {
        const elements = [...document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)].filter(element => element.getClientRects().length);
        if (elements.length) return elements;
    }
    return [];
}

/** Phần nhìn thấy được trong màn hình của khung bao các phần tử, nới thêm một chút viền. */
function visibleRect(elements: HTMLElement[]): TourRect | null {
    if (!elements.length) return null;
    const rects = elements.map(element => element.getBoundingClientRect());
    const top = Math.max(Math.min(...rects.map(rect => rect.top)) - PAD, 4);
    const left = Math.max(Math.min(...rects.map(rect => rect.left)) - PAD, 4);
    const bottom = Math.min(Math.max(...rects.map(rect => rect.bottom)) + PAD, window.innerHeight - 4);
    const right = Math.min(Math.max(...rects.map(rect => rect.right)) + PAD, window.innerWidth - 4);
    if (bottom <= top || right <= left) return null;
    return { top, left, width: right - left, height: bottom - top };
}

const sameRect = (a: TourRect | null, b: TourRect | null) => a === b || (!!a && !!b
    && Math.abs(a.top - b.top) < 0.5 && Math.abs(a.left - b.left) < 0.5
    && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5);

/**
 * Hướng dẫn từng bước cho giáo viên mới: làm tối màn hình, chỉ sáng chỗ cần thao tác, kèm thẻ giải thích.
 * Tự mở ở lần đầu trên mỗi máy; nút “Hướng dẫn” ở góc phải dưới để xem lại.
 */
export default function MatrixTour({ autoStart = true }: { autoStart?: boolean }) {
    const [step, setStep] = useState<number | null>(null);
    const [rect, setRect] = useState<TourRect | null>(null);
    const [done, setDone] = useState(false);
    const [hidden, setHidden] = useState(false);
    const [cardSize, setCardSize] = useState({ width: 360, height: 220 });
    const card = useRef<HTMLDivElement>(null);
    const titleId = useId();
    const current = step === null ? undefined : MATRIX_TOUR_STEPS[step];
    const last = step === MATRIX_TOUR_STEPS.length - 1;

    useEffect(() => {
        if (!autoStart || hasSeenMatrixTour()) return;
        const timer = window.setTimeout(() => setStep(previous => previous ?? 0), 700);
        return () => window.clearTimeout(timer);
    }, [autoStart]);

    const close = useCallback(() => {
        markMatrixTourSeen();
        setStep(null);
    }, []);

    // Đưa phần được chỉ vào giữa màn hình khi sang bước mới.
    useEffect(() => {
        if (!current) return;
        const elements = findTargets(current.targets);
        if (!elements.length) return;
        const rects = elements.map(element => element.getBoundingClientRect());
        const height = Math.max(...rects.map(rect => rect.bottom)) - Math.min(...rects.map(rect => rect.top));
        const element = elements[0];
        const tall = height > window.innerHeight * 0.6;
        const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        element.scrollIntoView({ block: tall ? 'start' : 'center', inline: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
    }, [current]);

    // Bám theo vị trí phần tử (cuộn, đổi cỡ, bảng giãn ra) và kiểm tra bước đã làm xong chưa.
    useEffect(() => {
        if (!current) return;
        let frame = 0;
        const tick = () => {
            const next = visibleRect(findTargets(current.targets));
            setRect(previous => sameRect(previous, next) ? previous : next);
            setDone(!current.waitFor || !!document.querySelector(current.waitFor));
            // Hộp thoại xuất ma trận hoặc biên soạn đề đang mở thì tạm ẩn hướng dẫn.
            setHidden(!!document.querySelector('dialog[open]'));
            frame = window.requestAnimationFrame(tick);
        };
        tick();
        return () => window.cancelAnimationFrame(frame);
    }, [current]);

    useLayoutEffect(() => {
        const element = card.current;
        if (!element) return;
        const { width, height } = element.getBoundingClientRect();
        setCardSize(previous => Math.abs(previous.width - width) < 1 && Math.abs(previous.height - height) < 1 ? previous : { width, height });
    }, [step, done, hidden, rect]);

    useEffect(() => {
        if (step === null) return;
        const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !document.querySelector('dialog[open]')) close(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [step, close]);

    useEffect(() => { if (step === 0) card.current?.focus({ preventScroll: true }); }, [step]);

    if (!current) return (
        <button type="button" onClick={() => setStep(0)}
            className="fixed bottom-4 right-4 z-40 inline-flex min-h-11 items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-800 shadow-lg hover:bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-700">
            <CircleHelp className="size-5 text-amber-800" aria-hidden="true" />Hướng dẫn
        </button>
    );

    if (hidden) return null;

    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const position = placeTourCard(rect, cardSize, viewport);
    const total = MATRIX_TOUR_STEPS.length;

    return <>
        {/* Lớp tối có lỗ sáng ở chỗ cần thao tác; không chặn chuột để giáo viên làm theo ngay. */}
        <div aria-hidden="true" className="pointer-events-none fixed z-[70] rounded-xl motion-safe:transition-all motion-safe:duration-300"
            style={rect
                ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height, boxShadow: '0 0 0 3px #f59e0b, 0 0 0 9999px rgba(28, 25, 23, 0.55)' }
                : { top: '50%', left: '50%', width: 0, height: 0, boxShadow: '0 0 0 9999px rgba(28, 25, 23, 0.55)' }} />
        <div ref={card} role="dialog" aria-modal="false" aria-labelledby={titleId} tabIndex={-1}
            className="fixed z-[71] w-[min(360px,calc(100vw-24px))] rounded-xl border border-stone-200 bg-white p-4 text-stone-900 shadow-2xl focus:outline-none motion-safe:transition-[top,left] motion-safe:duration-300"
            style={{ top: position.top, left: position.left }}>
            <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Bước {step! + 1}/{total}</p>
                <button type="button" onClick={close} aria-label="Đóng hướng dẫn"
                    className="-m-1.5 grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800">
                    <X className="size-4" aria-hidden="true" />
                </button>
            </div>
            <h2 id={titleId} className="mt-1 text-base font-bold">{current.title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-stone-700" aria-live="polite">{current.body}</p>
            {current.waitFor && <p className={'mt-2 rounded-lg px-2.5 py-1.5 text-sm font-medium '
                + (done ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-950')} role="status">
                {done ? '✓ Đã xong. Bấm “Tiếp” để sang bước sau.' : current.waitHint}
            </p>}
            <div className="mt-3 flex gap-1" aria-hidden="true">
                {MATRIX_TOUR_STEPS.map((item, index) => <span key={item.id}
                    className={'h-1.5 flex-1 rounded-full ' + (index <= step! ? 'bg-amber-700' : 'bg-stone-200')} />)}
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
                <button type="button" onClick={close} className="text-sm font-semibold text-stone-600 underline-offset-2 hover:text-stone-900 hover:underline">
                    Bỏ qua hướng dẫn
                </button>
                <div className="flex gap-2">
                    {step! > 0 && <button type="button" className={button} onClick={() => setStep(step! - 1)}>Quay lại</button>}
                    <button type="button" className={primary} disabled={!done}
                        onClick={() => last ? close() : setStep(step! + 1)}>{last ? 'Hoàn tất' : 'Tiếp'}</button>
                </div>
            </div>
        </div>
    </>;
}
