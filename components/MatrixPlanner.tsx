import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { MATRIX_LEVELS, type MatrixQuestionType } from '../src/utils/examMatrix';
import { STUDY_QUESTION_TYPES } from '../src/utils/studyLibrary';

const chapters: readonly { id: string; name: string; topics: readonly (readonly [id: string, name: string])[] }[] = [
    { id: 'g10-ch0', name: 'Mở đầu', topics: [
        ['introduction', 'Giới thiệu mục đích học tập môn Vật lí'],
    ] },
    { id: 'g10-ch1', name: 'Động học', topics: [
        ['motion', 'Mô tả chuyển động'],
        ['accelerated-motion', 'Chuyển động biến đổi'],
    ] },
    { id: 'g10-ch2', name: 'Động lực học', topics: [
        ['newton', 'Ba định luật Newton về chuyển động'],
        ['forces', 'Một số lực trong thực tiễn'],
        ['equilibrium', 'Cân bằng lực, moment lực'],
        ['pressure', 'Khối lượng riêng, áp suất chất lỏng'],
    ] },
    { id: 'g10-ch3', name: 'Công, năng lượng, công suất', topics: [
        ['work', 'Công và năng lượng'],
        ['mechanical-energy', 'Động năng và thế năng'],
        ['power', 'Công suất và hiệu suất'],
    ] },
    { id: 'g10-ch4', name: 'Động lượng', topics: [
        ['momentum', 'Định nghĩa động lượng, bảo toàn động lượng'],
        ['collisions', 'Động lượng và va chạm'],
    ] },
    { id: 'g10-ch5', name: 'Chuyển động tròn', topics: [
        ['circular-motion', 'Động học của chuyển động tròn đều'],
        ['centripetal-force', 'Gia tốc hướng tâm và lực hướng tâm'],
    ] },
    { id: 'g10-ch6', name: 'Biến dạng của vật rắn', topics: [
        ['deformation', 'Biến dạng kéo, biến dạng nén và đặc tính của lò xo'],
        ['hooke', 'Định luật Hooke'],
    ] },
];

const formats: { value: Exclude<MatrixQuestionType, ''>; label: string }[] = [
    ...STUDY_QUESTION_TYPES,
    { value: 'written', label: 'Tự luận' },
];
const levels = [1, 2, 3].map(value => ({ value, label: MATRIX_LEVELS[value] }));
const columns = formats.flatMap(format => levels.map(level => ({
    key: format.value + ':' + level.value,
    format: format.label,
    level: level.label,
})));
const cell = 'border-b border-r border-stone-200 px-2 py-2';
const check = 'size-4 shrink-0 accent-amber-800';
const maxCount = 99;

export default function MatrixPlanner() {
    const id = useId();
    const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
    const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
    const [counts, setCounts] = useState<Record<string, Record<string, number>>>({});

    const topicRows = chapters.flatMap(chapter => chapter.topics
        .filter(([topicId]) => selected.has(topicId))
        .map(([topicId, name]) => ({ topicId, name, chapter: chapter.name })));
    const totals = Object.fromEntries(columns.map(({ key }) =>
        [key, topicRows.reduce((sum, { topicId }) => sum + (counts[topicId]?.[key] ?? 0), 0)]));

    function toggleExpanded(chapterId: string) {
        setExpanded(previous => {
            const next = new Set(previous);
            if (next.has(chapterId)) next.delete(chapterId);
            else next.add(chapterId);
            return next;
        });
    }

    function selectTopics(topicIds: readonly string[], checked: boolean) {
        setSelected(previous => {
            const next = new Set(previous);
            for (const topicId of topicIds) {
                if (checked) next.add(topicId);
                else next.delete(topicId);
            }
            return next;
        });
    }

    return (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(235px,285px)_minmax(0,1fr)]">
            <aside className="rounded-xl border border-stone-200 bg-white">
                <h2 className="border-b border-stone-200 px-4 py-3 font-bold">Nội dung Vật lí 10</h2>
                <ul className="space-y-2 p-2">
                    {chapters.map(chapter => {
                        const open = expanded.has(chapter.id);
                        const panelId = id + '-' + chapter.id;
                        const selectedCount = chapter.topics.filter(([topicId]) => selected.has(topicId)).length;
                        return (
                            <li key={chapter.id} className="rounded-lg border border-stone-200">
                                <div className="flex items-center gap-2 rounded-t-lg bg-stone-50 pl-3">
                                    <input type="checkbox" className={check} aria-label={'Chọn cả chương ' + chapter.name}
                                        checked={selectedCount === chapter.topics.length}
                                        ref={element => {
                                            if (element) element.indeterminate = selectedCount > 0 && selectedCount < chapter.topics.length;
                                        }}
                                        onChange={event => selectTopics(chapter.topics.map(([topicId]) => topicId), event.target.checked)} />
                                    <button type="button" className="flex min-h-11 flex-1 items-center justify-between gap-2 px-1 pr-3 text-left text-sm font-semibold hover:text-amber-900"
                                        aria-expanded={open} aria-controls={panelId} onClick={() => toggleExpanded(chapter.id)}>
                                        {chapter.name}
                                        <ChevronDown aria-hidden="true" className={'size-4 shrink-0 ' + (open ? '' : '-rotate-90')} />
                                    </button>
                                </div>
                                <ul id={panelId} hidden={!open} className="space-y-1 border-t border-stone-100 p-1">
                                    {chapter.topics.map(([topicId, name]) => (
                                        <li key={topicId}>
                                            <label className="flex min-h-10 cursor-pointer items-start gap-2 rounded-md px-2 py-2 text-sm hover:bg-amber-50">
                                                <input type="checkbox" className={check + ' mt-0.5'} checked={selected.has(topicId)}
                                                    onChange={event => selectTopics([topicId], event.target.checked)} />
                                                <span className="leading-snug">{name}</span>
                                            </label>
                                        </li>
                                    ))}
                                </ul>
                            </li>
                        );
                    })}
                </ul>
            </aside>
            <section className="min-w-0 rounded-xl border border-stone-200 bg-white" aria-labelledby={id + '-title'}>
                <div className="space-y-1 px-4 py-3">
                    <h2 id={id + '-title'} className="font-bold">Ma trận đề kiểm tra</h2>
                    <p className="text-sm text-stone-600">Chọn nội dung bên trái rồi nhập số câu theo từng mức độ. Riêng Đúng/Sai nhập số ý.</p>
                </div>
                <div className="overflow-x-auto rounded-b-xl" tabIndex={0} role="region" aria-label="Bảng phân số câu theo mức độ">
                    <table className="w-full min-w-[1080px] border-separate border-spacing-0 text-sm">
                        <colgroup span={2} />
                        {formats.map(format => <colgroup key={format.value} span={levels.length} />)}
                        <thead className="bg-stone-100 text-stone-800">
                            <tr>
                                <th scope="col" rowSpan={2} className={cell + ' w-28 text-left'}>Chương</th>
                                <th scope="col" rowSpan={2} className={cell + ' w-48 text-left'}>Nội dung</th>
                                {formats.map(format => (
                                    <th key={format.value} scope="colgroup" colSpan={levels.length} className={cell + ' bg-amber-50 font-semibold text-amber-950'}>
                                        {format.label}{format.value === 'dung_sai' ? ' (ý)' : ''}
                                    </th>
                                ))}
                            </tr>
                            <tr>
                                {columns.map(({ key, level }) => (
                                    <th key={key} scope="col" className={cell + ' whitespace-nowrap text-xs font-semibold'}>{level}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {topicRows.map(({ topicId, name, chapter }) => (
                                <tr key={topicId} className="group">
                                    <td className={cell + ' text-sm text-stone-600 group-hover:bg-stone-50'}>{chapter}</td>
                                    <th scope="row" className={cell + ' text-left font-medium group-hover:bg-stone-50'}>{name}</th>
                                    {columns.map(({ key, format, level }) => (
                                        <td key={key} className={cell + ' group-hover:bg-stone-50'}>
                                            <input type="number" min={0} max={maxCount} step={1}
                                                aria-label={name + ' · ' + format + ' · ' + level}
                                                className="h-9 w-full min-w-11 rounded-md border border-stone-300 bg-white px-1 text-center tabular-nums focus:border-amber-700 focus:outline-none focus:ring-1 focus:ring-amber-700"
                                                value={counts[topicId]?.[key] || ''}
                                                onChange={event => {
                                                    const count = Math.max(0, Math.min(maxCount, Math.trunc(event.currentTarget.valueAsNumber || 0)));
                                                    setCounts(previous => ({
                                                        ...previous,
                                                        [topicId]: { ...previous[topicId], [key]: count },
                                                    }));
                                                }} />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                            {!topicRows.length && <tr><td colSpan={columns.length + 2} className="px-4 py-6 text-stone-600">
                                Chưa chọn nội dung nào.
                            </td></tr>}
                        </tbody>
                        <tfoot className="bg-stone-100 text-center font-semibold tabular-nums">
                            <tr>
                                <th scope="row" colSpan={2} className={cell + ' text-left'}>Tổng theo mức độ</th>
                                {columns.map(({ key }) => <td key={key} className={cell}>{totals[key]}</td>)}
                            </tr>
                            <tr>
                                <th scope="row" colSpan={2} className={cell + ' text-left'}>Tổng theo loại</th>
                                {formats.map(format => (
                                    <td key={format.value} colSpan={levels.length} className={cell + ' bg-amber-50 text-amber-950'}>
                                        {levels.reduce((sum, level) => sum + totals[format.value + ':' + level.value], 0)}
                                        {format.value === 'dung_sai' ? ' ý' : ' câu'}
                                    </td>
                                ))}
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </section>
        </div>
    );
}
