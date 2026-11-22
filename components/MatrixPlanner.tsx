import { Fragment, useId, useMemo, useState } from 'react';
import { ChevronDown, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import type { SelectedQuestionItem } from '../src/services/examLatexService';
import { ENERGY_MATRIX_CHAPTER_ID, MATRIX_LEVELS, type MatrixQuestionType } from '../src/utils/examMatrix';
import { STUDY_QUESTION_TYPES } from '../src/utils/studyLibrary';
import type { MatrixCandidate } from './ExamMatrixBuilder';
import MatrixPlanSpecification from './MatrixPlanSpecification';
import LessonSpecification from './LessonSpecification';
import { lessonPool, lessonTopics } from '../src/utils/lessonSpec';
import { lessonTopicId, specLessons } from '../src/data/lessonLines';

const allChapters: readonly { id: string; name: string; topics: readonly (readonly [id: string, name: string])[] }[] = [
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
    { id: ENERGY_MATRIX_CHAPTER_ID, name: 'Công, năng lượng, công suất',
        topics: specLessons(ENERGY_MATRIX_CHAPTER_ID).map(lesson => [lessonTopicId(lesson.id), lesson.name] as const) },
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

const allFormats: { value: Exclude<MatrixQuestionType, ''>; label: string }[] = [
    ...STUDY_QUESTION_TYPES,
    { value: 'written', label: 'Tự luận' },
];
const formatColors: Record<typeof allFormats[number]['value'], { header: string; band: string; body: string }> = {
    trac_nghiem: { header: 'bg-blue-700', band: 'bg-blue-100 text-blue-950', body: 'bg-blue-50' },
    dung_sai: { header: 'bg-violet-700', band: 'bg-violet-100 text-violet-950', body: 'bg-violet-50' },
    tu_luan: { header: 'bg-amber-800', band: 'bg-amber-100 text-amber-950', body: 'bg-amber-50' },
    written: { header: 'bg-emerald-800', band: 'bg-emerald-100 text-emerald-950', body: 'bg-emerald-50' },
};
const levels = [1, 2, 3].map(value => ({ value, label: MATRIX_LEVELS[value] }));
/** Đúng/Sai nhập số câu (một cột); các ý của câu đã chọn tự vào mức của chúng khi xuất. */
const levelsOf = (type: typeof allFormats[number]['value']) => type === 'dung_sai' ? [{ value: 0, label: 'Số câu' }] : levels;
const allColumns = allFormats.flatMap(format => levelsOf(format.value).map(level => ({
    key: format.value + ':' + level.value,
    format: format.label,
    type: format.value,
    level: level.label,
    levelValue: level.value,
    colors: formatColors[format.value],
})));
const cell = 'border-b border-r border-stone-200 px-2 py-2';
const check = 'size-4 shrink-0 accent-amber-800';
const maxCount = 99;

export default function MatrixPlanner({ candidates, onCompose, chapterIds, withWritten = true }: {
    candidates: MatrixCandidate[];
    onCompose: (questions: SelectedQuestionItem[]) => void;
    /** Chỉ hiện các chương này (mở sẵn); bỏ trống để hiện mọi chương. */
    chapterIds?: readonly string[];
    /** Hiện cột Tự luận (kho chưa có câu tự luận). */
    withWritten?: boolean;
}) {
    const formats = withWritten ? allFormats : allFormats.filter(format => format.value !== 'written');
    const columns = withWritten ? allColumns : allColumns.filter(column => column.type !== 'written');
    const id = useId();
    const chapters = useMemo(() => chapterIds ? allChapters.filter(chapter => chapterIds.includes(chapter.id)) : allChapters, [chapterIds]);
    const [showContents, setShowContents] = useState(true);
    const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set(chapterIds));
    const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
    const [counts, setCounts] = useState<Record<string, Record<string, number>>>({});

    const selectedChapters = useMemo(() => chapters.map(chapter => ({
        ...chapter, topics: chapter.topics.filter(([topicId]) => selected.has(topicId)),
    })).filter(chapter => chapter.topics.length > 0), [chapters, selected]);
    const selectedTopics = selectedChapters.flatMap(chapter => chapter.topics);
    const totals = Object.fromEntries(columns.map(({ key }) =>
        [key, selectedTopics.reduce((sum, [topicId]) => sum + (counts[topicId]?.[key] ?? 0), 0)]));
    const allocations = useMemo(() => selectedChapters.flatMap(chapter =>
        chapter.topics.flatMap(([topicId, topic]) => columns.flatMap(({ key, type, levelValue }) => {
            const count = counts[topicId]?.[key];
            return count ? [{ chapterId: chapter.id, chapter: chapter.name, topicId, topic, type, level: levelValue, count }] : [];
        }))
    ), [selectedChapters, counts]);
    /** Bản đặc tả theo bài khi mọi nội dung đã chọn là bài có dòng YCCĐ và kho đã gắn câu vào các dòng đó. */
    const lessonRows = useMemo(() => lessonTopics(allocations), [allocations]);
    const hasAssignments = useMemo(() => {
        if (!lessonRows) return false;
        const pool = lessonPool(candidates, [...new Set(lessonRows.map(topic => topic.chapterId))]);
        return lessonRows.some(topic => pool.units.has(topic.lesson.id));
    }, [lessonRows, candidates]);
    const lessons = hasAssignments ? lessonRows : undefined;
    const lessonsWithoutLines = !!lessonRows && !hasAssignments;

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

    return <>
        <div className={'grid items-start gap-3 ' + (showContents
            ? 'lg:grid-cols-[minmax(235px,285px)_minmax(0,1fr)]'
            : 'lg:grid-cols-[auto_minmax(0,1fr)]')}>
            <aside className="rounded-xl border border-stone-200 bg-white" aria-label="Nội dung Vật lí 10">
                <div className={'flex items-center justify-between gap-2 ' + (showContents
                    ? 'border-b border-stone-200 px-3 py-2'
                    : 'p-1')}>
                    {showContents && <h2 className="min-w-0 font-bold">Nội dung Vật lí 10</h2>}
                    <button type="button"
                        className="inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-semibold text-stone-700 hover:bg-stone-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-700"
                        title={showContents ? 'Thu gọn khung nội dung' : 'Mở khung nội dung Vật lí 10'}
                        aria-expanded={showContents} aria-controls={id + '-contents'}
                        onClick={() => setShowContents(open => !open)}>
                        {showContents ? <PanelLeftClose aria-hidden="true" className="size-4" />
                            : <PanelLeftOpen aria-hidden="true" className="size-4" />}
                        {showContents ? 'Thu gọn' : <span className="lg:sr-only">Mở nội dung Vật lí 10</span>}
                    </button>
                </div>
                <ul id={id + '-contents'} hidden={!showContents} className="space-y-2 p-2">
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
                    <p className="text-sm text-stone-600">Chọn nội dung bên trái rồi nhập số câu theo từng mức độ. Riêng Đúng/Sai nhập số câu; các ý a, b, c, d của câu được chọn tự nằm ở mức của chúng.</p>
                </div>
                <div className="overflow-x-auto rounded-b-xl" tabIndex={0} role="region" aria-label="Bảng phân số câu theo mức độ">
                    <table className={'w-full table-fixed border-separate border-spacing-0 text-sm ' + (withWritten ? 'min-w-[1080px]' : 'min-w-[840px]')}>
                        <colgroup>
                            <col className="w-[10%]" />
                            <col className="w-[14%]" />
                        </colgroup>
                        {formats.map(format => <colgroup key={format.value}>
                            {levelsOf(format.value).map(level => <col key={level.value} className={format.value === 'dung_sai' ? 'w-[9%]' : withWritten ? 'w-[7.0833%]' : 'w-[11.1667%]'} />)}
                        </colgroup>)}
                        <thead className="bg-stone-100 text-stone-800">
                            <tr>
                                <th scope="col" rowSpan={2} className={cell + ' text-left'}>Chương</th>
                                <th scope="col" rowSpan={2} className={cell + ' text-left'}>Nội dung</th>
                                {formats.map(format => (
                                    <th key={format.value} scope="colgroup" colSpan={levelsOf(format.value).length}
                                        className={cell + ' font-semibold text-white ' + formatColors[format.value].header}>
                                        {format.label}
                                    </th>
                                ))}
                            </tr>
                            <tr>
                                {columns.map(({ key, level, colors }) => (
                                    <th key={key} scope="col" className={cell + ' text-xs font-semibold ' + colors.band}>{level}</th>
                                ))}
                            </tr>
                        </thead>
                        {selectedChapters.map(chapter => <tbody key={chapter.id}>
                            {chapter.topics.map(([topicId, name], index) => <Fragment key={topicId}>
                                <tr className="group">
                                    {index === 0 && (
                                        <th scope="rowgroup" rowSpan={chapter.topics.length}
                                            className={cell + ' bg-stone-50 text-left font-semibold text-stone-800'}>
                                            {chapter.name}
                                        </th>
                                    )}
                                    <th scope="row" className={cell + ' text-left font-medium group-hover:bg-stone-50'}>
                                        {name}
                                    </th>
                                    {columns.map(({ key, format, level, colors }) => (
                                        <td key={key} className={cell + ' ' + colors.body}>
                                            <input type="number" min={0} max={maxCount} step={1}
                                                aria-label={name + ' · ' + format + ' · ' + level}
                                                className="h-9 w-full min-w-0 rounded-md border border-stone-300 bg-white px-1 text-center tabular-nums focus:border-amber-700 focus:outline-none focus:ring-1 focus:ring-amber-700"
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
                            </Fragment>)}
                        </tbody>)}
                        {!selectedChapters.length && <tbody>
                            <tr><td colSpan={columns.length + 2} className="px-4 py-6 text-stone-600">
                                Chưa chọn nội dung nào.
                            </td></tr>
                        </tbody>}
                        <tfoot className="bg-stone-100 text-center font-semibold tabular-nums">
                            <tr>
                                <th scope="row" colSpan={2} className={cell + ' text-left'}>Tổng theo mức độ</th>
                                {columns.map(({ key, colors }) => <td key={key} className={cell + ' ' + colors.body}>{totals[key]}</td>)}
                            </tr>
                            <tr>
                                <th scope="row" colSpan={2} className={cell + ' text-left'}>Tổng theo loại</th>
                                {formats.map(format => (
                                    <td key={format.value} colSpan={levelsOf(format.value).length} className={cell + ' ' + formatColors[format.value].band}>
                                        {levelsOf(format.value).reduce((sum, level) => sum + totals[format.value + ':' + level.value], 0)} câu
                                    </td>
                                ))}
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </section>
        </div>
        {lessons
            ? <LessonSpecification key={lessons.map(topic => topic.key).join('|')} allocations={allocations} topics={lessons} candidates={candidates} onCompose={onCompose} />
            : <>
                {lessonsWithoutLines && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                    Câu của chương này chưa được gắn vào dòng YCCĐ theo bài, nên bản đặc tả dùng cách chọn theo vị trí câu. Nạp file gắn dòng YCCĐ ở mục Rà YCCĐ → Nhập mức độ để dùng bản đặc tả theo bài.
                </p>}
                <MatrixPlanSpecification allocations={allocations} candidates={candidates} onCompose={onCompose} />
            </>}
    </>;
}
