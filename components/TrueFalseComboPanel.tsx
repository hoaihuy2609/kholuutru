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
 * Gợi ý cách chia ý Đúng/Sai theo mức mà kho ghép được: chọn số câu, bấm một tổ hợp để điền vào ma trận.
 * Tổ hợp xếp theo độ gần tỉ lệ 4-3-3 của Công văn 7991, rồi theo số cách chọn câu.
 */
export default function TrueFalseComboPanel({ topics, onApply }: {
    topics: TrueFalseTopic[];
    onApply: (topicId: string, counts: StatementCounts) => void;
}) {
    const id = useId();
    const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
    if (!topics.length) return null;
    return (
        <section className="space-y-3 border-t border-stone-200 px-4 py-4" aria-labelledby={id}>
            <div className="space-y-1">
                <h3 id={id} className="font-bold">Gợi ý Đúng/Sai theo kho</h3>
                <p className="text-sm text-stone-600">Chọn số câu Đúng/Sai cho từng nội dung, rồi bấm một cách chia ý để điền vào ma trận. Chỉ hiện những cách chia mà kho ghép được; cách gần tỉ lệ 4 Biết : 3 Hiểu : 3 Vận dụng đứng trước.</p>
            </div>
            <ul className="space-y-3">
                {topics.map(topic => {
                    const total = topic.current[0] + topic.current[1] + topic.current[2];
                    const questions = Math.floor(total / 4);
                    const available = topic.patterns.reduce((sum, pattern) => sum + pattern.available, 0);
                    const combos = rankTrueFalseCombos(trueFalseCombos(topic.patterns, questions));
                    const status = trueFalseStatus(topic);
                    const open = expanded.has(topic.topicId);
                    const setQuestions = (next: number) => {
                        const value = Math.max(0, Math.min(available, next));
                        const [best] = rankTrueFalseCombos(trueFalseCombos(topic.patterns, value));
                        onApply(topic.topicId, value && best ? best.total : [0, 0, 0]);
                    };
                    return <li key={topic.topicId} className="space-y-2 rounded-xl border border-stone-200 bg-violet-50/40 p-3">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                            <p className="min-w-0 flex-1 font-semibold">{topic.name}</p>
                            <span className="text-xs text-stone-600">kho có {available} câu Đúng/Sai</span>
                            <div className="inline-flex items-center overflow-hidden rounded-lg border border-stone-300 bg-white" role="group" aria-label={'Số câu Đúng/Sai của ' + topic.name}>
                                <button type="button" className="grid size-9 place-items-center hover:bg-stone-100 disabled:opacity-40" aria-label="Bớt một câu Đúng/Sai"
                                    disabled={questions <= 0} onClick={() => setQuestions(questions - 1)}><Minus aria-hidden="true" className="size-4" /></button>
                                <output className="min-w-14 px-1 text-center text-sm font-bold tabular-nums">{questions} câu</output>
                                <button type="button" className="grid size-9 place-items-center hover:bg-stone-100 disabled:opacity-40" aria-label="Thêm một câu Đúng/Sai"
                                    disabled={questions >= available} onClick={() => setQuestions(questions + 1)}><Plus aria-hidden="true" className="size-4" /></button>
                            </div>
                        </div>
                        {!available ? <p className="text-sm text-stone-600">Kho chưa có câu Đúng/Sai cho nội dung này.</p>
                            : !questions ? <p className="text-sm text-stone-600">Chưa có câu Đúng/Sai. Bấm + để thêm, web sẽ điền sẵn cách chia ý phù hợp nhất.</p>
                            : <>
                                <p className={'flex items-start gap-1.5 text-sm ' + (status?.fits ? 'text-emerald-800' : 'text-red-800')} role="status">
                                    {status?.fits ? <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> : <X aria-hidden="true" className="mt-0.5 size-4 shrink-0" />}
                                    <span>Đang nhập {levelCountsLabel(topic.current)}
                                        {total % 4 ? ' (' + total + ' ý, chưa phải bội của 4).'
                                            : status?.fits ? ': kho ghép được, ' + status.ways + ' cách chọn câu.'
                                            : ': kho không có câu nào ghép ra đúng số ý này. Chọn một cách chia bên dưới, hoặc ghi lại để soạn thêm câu.'}</span>
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
                                        aria-expanded={open} onClick={() => setExpanded(previous => {
                                            const next = new Set(previous);
                                            if (next.has(topic.topicId)) next.delete(topic.topicId); else next.add(topic.topicId);
                                            return next;
                                        })}>{open ? 'Thu gọn' : 'Xem thêm ' + (combos.length - shown) + ' cách'}</button>}
                                </div>
                            </>}
                    </li>;
                })}
            </ul>
        </section>
    );
}
