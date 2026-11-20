import { useId, useState } from 'react';
import { Check, Minus, Plus, X } from 'lucide-react';
import type { StatementCounts } from '../src/utils/matrixPlan';
import { levelCountsLabel, patternLabel, rankTrueFalseCombos, trueFalseCombos, type TrueFalsePattern } from '../src/utils/trueFalseCombos';

export interface TrueFalseTopic {
    topicId: string;
    name: string;
    /** Kiểu ý của các câu Đúng/Sai trong kho thuộc nội dung này. */
    patterns: TrueFalsePattern[];
    /** Số ý Biết, Hiểu, Vận dụng đang nhập trong ma trận. */
    current: StatementCounts;
}

const shown = 6;
const chip = 'inline-flex min-h-9 items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-sm tabular-nums';

/** Trạng thái phần Đúng/Sai đang nhập của một nội dung so với kho, để hiện ngay trong ô tên nội dung. */
export function trueFalseStatus(topic: Pick<TrueFalseTopic, 'patterns' | 'current'>) {
    const total = topic.current[0] + topic.current[1] + topic.current[2];
    if (!total || total % 4) return undefined;
    const [combo] = trueFalseCombos(topic.patterns, total / 4, topic.current);
    return combo ? { fits: true as const, ways: combo.ways } : { fits: false as const, ways: 0 };
}

/**
 * Gợi ý cách chia ý Đúng/Sai của một nội dung, hiện ngay dưới hàng của nội dung trong ma trận khi giáo viên
 * nhập ô Đúng/Sai. Chọn số câu bằng − / +, hoặc bấm một cách chia để điền vào ma trận. Chỉ hiện cách chia mà
 * kho ghép được, xếp theo độ gần tỉ lệ 4-3-3 của Công văn 7991 rồi theo số cách chọn câu.
 */
export default function TrueFalseComboEditor({ topic, onApply, onClose }: {
    topic: TrueFalseTopic;
    onApply: (topicId: string, counts: StatementCounts) => void;
    onClose: () => void;
}) {
    const id = useId();
    const [open, setOpen] = useState(false);
    const total = topic.current[0] + topic.current[1] + topic.current[2];
    const questions = Math.floor(total / 4);
    const available = topic.patterns.reduce((sum, pattern) => sum + pattern.available, 0);
    const combos = rankTrueFalseCombos(trueFalseCombos(topic.patterns, questions));
    const status = trueFalseStatus(topic);
    const setQuestions = (next: number) => {
        const value = Math.max(0, Math.min(available, next));
        const [best] = rankTrueFalseCombos(trueFalseCombos(topic.patterns, value));
        onApply(topic.topicId, value && best ? best.total : [0, 0, 0]);
    };
    return (
        <div className="sticky left-2 max-w-3xl space-y-2 rounded-lg border border-violet-300 bg-white p-3 shadow-sm" role="region" aria-labelledby={id}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <p id={id} className="min-w-0 flex-1 text-sm font-semibold text-violet-950">Gợi ý Đúng/Sai · {topic.name} <span className="font-normal text-stone-600">(kho có {available} câu)</span></p>
                <div className="inline-flex items-center overflow-hidden rounded-lg border border-stone-300 bg-white" role="group" aria-label={'Số câu Đúng/Sai của ' + topic.name}>
                    <button type="button" className="grid size-9 place-items-center hover:bg-stone-100 disabled:opacity-40" aria-label="Bớt một câu Đúng/Sai"
                        disabled={questions <= 0} onClick={() => setQuestions(questions - 1)}><Minus aria-hidden="true" className="size-4" /></button>
                    <output className="min-w-14 px-1 text-center text-sm font-bold tabular-nums">{questions} câu</output>
                    <button type="button" className="grid size-9 place-items-center hover:bg-stone-100 disabled:opacity-40" aria-label="Thêm một câu Đúng/Sai"
                        disabled={questions >= available} onClick={() => setQuestions(questions + 1)}><Plus aria-hidden="true" className="size-4" /></button>
                </div>
                <button type="button" className="grid size-9 place-items-center rounded-lg text-stone-600 hover:bg-stone-100" aria-label="Đóng gợi ý Đúng/Sai" onClick={onClose}>
                    <X aria-hidden="true" className="size-4" />
                </button>
            </div>
            {!available ? <p className="text-sm text-stone-600">Kho chưa có câu Đúng/Sai cho nội dung này.</p>
                : !questions ? <p className="text-sm text-stone-600">Bấm + để thêm câu Đúng/Sai; web điền sẵn cách chia ý phù hợp nhất vào ma trận.</p>
                : <>
                    <p className={'flex items-start gap-1.5 text-sm ' + (status?.fits ? 'text-emerald-800' : 'text-red-800')} role="status">
                        {status?.fits ? <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> : <X aria-hidden="true" className="mt-0.5 size-4 shrink-0" />}
                        <span>Đang nhập {levelCountsLabel(topic.current)}
                            {total % 4 ? ' (' + total + ' ý, chưa phải bội của 4). Bấm một cách chia bên dưới.'
                                : status?.fits ? ': kho ghép được, ' + status.ways + ' cách chọn câu.'
                                : ': kho không có câu nào ghép ra đúng số ý này. Bấm một cách chia bên dưới, hoặc giữ lại để soạn thêm câu.'}</span>
                    </p>
                    <div className="flex flex-wrap gap-2" role="group" aria-label={'Cách chia ý Đúng/Sai cho ' + topic.name}>
                        {(open ? combos : combos.slice(0, shown)).map(combo => {
                            const active = combo.total.every((value, index) => value === topic.current[index]);
                            return <button key={combo.total.join()} type="button" aria-pressed={active}
                                title={'Ví dụ: ' + combo.patterns.map(({ counts, times }) => times + ' câu ' + patternLabel(counts)).join(' + ')}
                                className={chip + (active ? ' border-violet-700 bg-violet-700 text-white' : ' border-stone-300 bg-white hover:border-violet-600 hover:bg-violet-50')}
                                onClick={() => onApply(topic.topicId, combo.total)}>
                                <span className="font-semibold">{levelCountsLabel(combo.total)}</span>
                                <span className={'text-xs ' + (active ? 'text-violet-100' : 'text-stone-500')}>{combo.ways} cách</span>
                            </button>;
                        })}
                        {combos.length > shown && <button type="button" className="text-sm font-semibold text-violet-900 underline underline-offset-2"
                            aria-expanded={open} onClick={() => setOpen(value => !value)}>{open ? 'Thu gọn' : 'Xem thêm ' + (combos.length - shown) + ' cách'}</button>}
                    </div>
                    <p className="text-xs text-stone-500">Cách gần tỉ lệ 4 Biết : 3 Hiểu : 3 Vận dụng đứng trước. "… cách" là số cách chọn câu trong kho.</p>
                </>}
        </div>
    );
}
