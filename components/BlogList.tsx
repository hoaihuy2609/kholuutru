import React, { useState, useEffect, useId, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BlogPost, StudyLesson, StudyLibrary, StudyQuestionGroup, StudyQuestionType, StudySection } from '../types';
import { BookOpen, Plus, Search, SlidersHorizontal, Image, FileText, Check, Pencil, Sparkles, ChevronLeft, ChevronRight, ChevronDown, Folder, X, RotateCcw } from 'lucide-react';
import ExamStyleModal from './ExamStyleModal';
import TreeTableOfContents, { normalizeSearchText } from './TreeTableOfContents';
import ChapterStudyList from './ChapterStudyList';
import { getStudyChapter, isStudyQuestionGroup, isStudyQuestionType, STUDY_GRADES, studySectionParams, supportsStudyGroups } from '../src/utils/studyLibrary';
import { SelectedQuestionItem } from '../src/services/examLatexService';
import { CLOUDFLARE_PROXY_URL } from '../src/lib/telegram';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// ─────────────────────────────────────────────────────────────
// Mini renderers — tái sử dụng logic của SolutionRenderer để
// hiển thị đề bài trực tiếp trên card (đồng nhất 100% với
// giao diện chi tiết khi click vào)
// ─────────────────────────────────────────────────────────────

function KatexInlineCard({ tex }: { tex: string }) {
    const ref = useRef<HTMLSpanElement>(null);
    useEffect(() => {
        if (!ref.current || !tex?.trim()) return;
        try { katex.render(tex, ref.current, { throwOnError: false, displayMode: false }); }
        catch (_) {}
    }, [tex]);
    return <span ref={ref} />;
}

function KatexBlockCard({ tex }: { tex: string }) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!ref.current || !tex?.trim()) return;
        try { katex.render(tex, ref.current, { throwOnError: false, displayMode: true }); }
        catch (_) {}
    }, [tex]);
    return <div ref={ref} style={{ textAlign: 'center', padding: '4px 0', overflowX: 'auto' }} />;
}

function renderMathCard(text: string): React.ReactNode[] {
    return text.split(/(\$[^$]+\$|\\\([^)]*\\\))/g).map((part, i) => {
        if (part.startsWith('$') && part.endsWith('$') && part.length > 1)
            return <KatexInlineCard key={i} tex={part.slice(1, -1)} />;
        if (part.startsWith('\\(') && part.endsWith('\\)') && part.length > 3)
            return <KatexInlineCard key={i} tex={part.slice(2, -2)} />;
        return <span key={i}>{part}</span>;
    });
}

function TextWithMathCard({ text }: { text: string }) {
    if (!text) return null;
    return (
        <>
            {text.split(/(\[center\][\s\S]*?\[\/center\]|\[justify\][\s\S]*?\[\/justify\])/g).map((block, i) => {
                if (block.startsWith('[center]') && block.endsWith('[/center]'))
                    return <div key={i} style={{ textAlign: 'center' }}>{renderMathCard(block.slice(8, -9))}</div>;
                if (block.startsWith('[justify]') && block.endsWith('[/justify]'))
                    return <div key={i} style={{ textAlign: 'justify' }}>{renderMathCard(block.slice(9, -10))}</div>;
                return <React.Fragment key={i}>{renderMathCard(block)}</React.Fragment>;
            })}
        </>
    );
}

type QuestionType = StudyQuestionType;

interface StoredQuestion extends Partial<Pick<SelectedQuestionItem,
    'type' | 'choices' | 'correctChoice' | 'statements' | 'solution' | 'steps' | 'solutionSteps'
    | 'tikzCode' | 'imageSvg' | 'imageUrl' | 'imageTelegramFileId' | 'imageLayout'>> {
    question_no?: string;
    question_groups?: StudyQuestionGroup[];
    question_text?: string;
    question_latex?: string;
    tikz_code?: string;
    image_svg?: string;
    image_url?: string;
    image_telegram_file_id?: string;
    image_layout?: SelectedQuestionItem['imageLayout'];
}

interface CardQuestionData {
    questionNo: string;
    questionText: string;
    questionLatex: string;
    type: QuestionType;
    imageSvg?: string;
    imageUrl?: string;
    imageTelegramFileId?: string;
    imageLayout?: SelectedQuestionItem['imageLayout'];
}

function parsePhysicsSolution(content: string): { type: 'physics_solution'; data: StoredQuestion & { questions?: StoredQuestion[] } } | null {
    try {
        const parsed = JSON.parse(content);
        return parsed?.type === 'physics_solution' && parsed.data && typeof parsed.data === 'object' ? parsed : null;
    } catch {
        return null;
    }
}

function getStoredQuestions(solution: ReturnType<typeof parsePhysicsSolution>): StoredQuestion[] {
    if (!solution) return [];
    const { data } = solution;
    return Array.isArray(data.questions) && data.questions.length ? data.questions : [data];
}

function toCardQuestion(question?: StoredQuestion): CardQuestionData | null {
    if (!question) return null;
    return {
        questionNo: question.question_no || '',
        questionText: question.question_text || '',
        questionLatex: question.question_latex || '',
        type: question.type === 'dung_sai' ? 'dung_sai' : question.type === 'trac_nghiem' ? 'trac_nghiem' : 'tu_luan',
        imageSvg: question.image_svg || question.imageSvg || '',
        imageUrl: question.image_url || question.imageUrl || '',
        imageTelegramFileId: question.image_telegram_file_id || question.imageTelegramFileId || '',
        imageLayout: question.image_layout || question.imageLayout || 'auto',
    };
}

function questionKey(blogId: string, index: number) {
    return JSON.stringify([blogId, index]);
}

interface QuestionCardProps {
    blog: BlogPost;
    question: CardQuestionData | null;
    isAdmin: boolean;
    onEdit?: () => void;
    onClick: () => void;
    isSelected?: boolean;
    onToggleSelect: () => void;
}

const cardTypes: Record<QuestionType, string> = {
    dung_sai: 'Đúng / Sai',
    trac_nghiem: 'Trắc nghiệm',
    tu_luan: 'Trả lời ngắn',
};

const cardControl = 'inline-flex min-h-8 shrink-0 items-center gap-1 rounded-md px-2 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-700';

function QuestionCard({ blog, question, isAdmin, onEdit, onClick, isSelected = false, onToggleSelect }: QuestionCardProps) {
    const [expanded, setExpanded] = useState(false);
    const [isClipped, setIsClipped] = useState(false);
    const contentId = useId();
    const viewportRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const viewport = viewportRef.current;
        const content = contentRef.current;
        if (!viewport || !content || expanded) return;

        const measure = () => setIsClipped(content.scrollHeight > viewport.clientHeight + 1);
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(viewport);
        observer.observe(content);
        return () => observer.disconnect();
    }, [expanded]);

    const imageSrc = question?.imageUrl || (question?.imageTelegramFileId
        ? CLOUDFLARE_PROXY_URL + '/getFile/' + question.imageTelegramFileId : '');
    const hasImage = !!(question?.imageSvg || imageSrc);
    const text = question?.questionText || '';
    const formula = question?.questionLatex || '';
    const hasQuestion = !!(text || formula || hasImage);
    const parts = hasImage ? text.split(/\[image\]/i) : [text];
    const inlineImage = parts.length > 1;
    const sideImage = hasImage && !inlineImage && !!(text || formula) && question?.imageLayout !== 'bottom';
    const metadata = [
        blog.grade ? 'Lớp ' + blog.grade : 'Chung',
        blog.level ? 'Mức ' + blog.level : '',
        isAdmin && !blog.is_published ? 'Nháp' : '',
    ].filter(Boolean).join(' · ');
    const image = hasImage && (
        <figure className={'mx-auto flex w-full min-w-0 max-w-sm items-center justify-center self-start '
            + (sideImage ? '[@container_(min-width:26rem)]:w-[38%] [@container_(min-width:26rem)]:shrink-0' : '')}>
            {question?.imageSvg ? (
                <div className={'max-w-full [&>svg]:block [&>svg]:h-auto [&>svg]:max-w-full '
                    + (expanded ? '[&>svg]:max-h-48' : '[&>svg]:max-h-32 sm:[&>svg]:max-h-40')}
                    dangerouslySetInnerHTML={{ __html: question.imageSvg }} />
            ) : (
                <img src={imageSrc} alt="Hình vẽ minh họa"
                    className={'max-w-full object-contain ' + (expanded ? 'max-h-48' : 'max-h-32 sm:max-h-40')} />
            )}
        </figure>
    );
    const renderText = (value: string) => value.trim() ? (
        <div className="overflow-x-auto whitespace-pre-wrap [overflow-wrap:anywhere]"><TextWithMathCard text={value} /></div>
    ) : null;
    const readLabel = question ? 'Xem lời giải' : 'Đọc bài';

    return (
        <article
            onClick={event => {
                if (event.target instanceof Element && event.target.closest('button, a')) return;
                const selection = window.getSelection();
                if (selection && !selection.isCollapsed && event.currentTarget.contains(selection.anchorNode)) return;
                onClick();
            }}
            className={'flex min-w-0 cursor-pointer flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition-colors hover:border-amber-300 '
                + (expanded ? 'min-h-[250px] sm:min-h-[280px] ' : 'h-[250px] sm:h-[280px] ')
                + (isSelected ? 'border-amber-400 ring-1 ring-inset ring-amber-200' : 'border-stone-200')}>
            <header className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-stone-100 bg-stone-50 px-3 sm:px-3.5">
                <div className="flex min-w-0 items-center gap-2">
                    {question?.questionNo && (
                        <span className="max-w-[55%] truncate rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-xs font-bold text-amber-950" title={question.questionNo}>
                            {question.questionNo}
                        </span>
                    )}
                    <span className="truncate text-xs font-semibold text-stone-700">{question ? cardTypes[question.type] : 'Bài viết'}</span>
                </div>
                <div className="ml-auto flex shrink-0 items-center gap-1">
                    <button type="button" aria-pressed={isSelected} onClick={onToggleSelect}
                        title={isSelected ? 'Bỏ chọn khỏi đề thi' : 'Thêm vào đề thi'}
                        className={cardControl + (isSelected ? ' bg-amber-100 text-amber-950 hover:bg-amber-200' : ' text-amber-900 hover:bg-amber-100')}>
                        {isSelected ? <Check aria-hidden="true" className="size-3.5" /> : <Plus aria-hidden="true" className="size-3.5" />}
                        {isSelected ? 'Đã chọn' : 'Thêm'}
                    </button>
                    {isAdmin && onEdit && (
                        <button type="button" onClick={onEdit} title="Chỉnh sửa bài viết"
                            className={cardControl + ' text-stone-700 hover:bg-stone-200'}>
                            <Pencil aria-hidden="true" className="size-3.5" /> Sửa
                        </button>
                    )}
                </div>
            </header>

            <div className="flex min-h-0 min-w-0 flex-1 flex-col px-3.5 py-3.5 [container-type:inline-size] sm:px-4">
                <div id={contentId} ref={viewportRef}
                    className="relative min-h-0 flex-1 overflow-hidden">
                    <div ref={contentRef} className="latex-prose min-w-0 text-base leading-relaxed text-stone-800">
                        {!hasQuestion ? (
                            <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{blog.summary || blog.title}</p>
                        ) : inlineImage ? (
                            <div className="space-y-3">
                                {renderText(parts[0])}
                                {image}
                                {renderText(parts.slice(1).join('[image]'))}
                                {formula && <KatexBlockCard tex={formula} />}
                            </div>
                        ) : (
                            <div className={'flex flex-col gap-3 ' + (sideImage ? '[@container_(min-width:26rem)]:flex-row' : '')}>
                                {(text || formula) && (
                                    <div className="min-w-0 flex-1 space-y-2">
                                        {renderText(text)}
                                        {formula && <KatexBlockCard tex={formula} />}
                                    </div>
                                )}
                                {image}
                            </div>
                        )}
                    </div>
                    {!expanded && isClipped && (
                        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white to-white/0" />
                    )}
                </div>
            </div>

            <footer className="flex h-11 shrink-0 items-center justify-between gap-1 border-t border-stone-100 px-3.5 sm:px-4">
                <span className="min-w-0 flex-1 truncate text-xs text-stone-600" title={metadata}>{metadata}</span>
                <div className="flex shrink-0 items-center gap-0.5">
                    {(isClipped || expanded) && (
                        <button type="button" aria-expanded={expanded} aria-controls={contentId}
                            onClick={() => setExpanded(previous => !previous)} className={cardControl + ' text-amber-900 hover:bg-amber-50'}>
                            {expanded ? 'Thu gọn' : 'Xem thêm'}
                            <ChevronDown aria-hidden="true" className={'size-3.5 ' + (expanded ? 'rotate-180' : '')} />
                        </button>
                    )}
                    <button type="button" onClick={onClick}
                        aria-label={question?.questionNo ? readLabel + ' ' + question.questionNo : readLabel}
                        className={cardControl + ' text-amber-900 hover:bg-amber-50'}>
                        {readLabel} <ChevronRight aria-hidden="true" className="size-3.5" />
                    </button>
                </div>
            </footer>
        </article>
    );
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────

interface BlogListProps {
    isAdmin: boolean;
    studentGrade?: number | null;
    onReadBlog: (blog: BlogPost) => void;
    onEditBlog?: (blog: BlogPost, questionIndex?: number) => void;
    onCreateBlog?: (section?: StudySection) => void;
    studyLessons: StudyLesson[];
    onSaveLesson?: (section: StudySection, title: string, id?: string) => Promise<StudyLesson | null>;
    lessonSync?: 'syncing' | 'failed';
    onRetryLessonSync?: () => void;
    onLibraryLoaded: (library: StudyLibrary) => void;
    getStudyLibrary: (isAdmin: boolean) => Promise<StudyLibrary>;
}

const estimateReadTime = (content: string): number =>
    Math.max(1, Math.ceil(content.trim().split(/\s+/).length / 200));

const questionTypeOptions = [
    { value: 'all', label: 'Tất cả' },
    { value: 'trac_nghiem', label: 'Trắc nghiệm 4 đáp án' },
    { value: 'dung_sai', label: 'Đúng / Sai' },
    { value: 'tu_luan', label: 'Trả lời ngắn' },
] as const;

const levelOptions = [
    { value: 0, label: 'Tất cả' },
    { value: 1, label: 'Nhận biết' },
    { value: 2, label: 'Thông hiểu' },
    { value: 3, label: 'Vận dụng' },
    { value: 4, label: 'Vận dụng cao' },
] as const;

function indexQuestion(blog: BlogPost) {
    const question = toCardQuestion(getStoredQuestions(parsePhysicsSolution(blog.content))[0]);
    return {
        blog,
        type: question?.type ?? 'tu_luan',
        level: blog.level ?? 0,
        hasImage: !!(question?.imageSvg || question?.imageUrl || question?.imageTelegramFileId),
        searchFields: [
            blog.title, blog.summary, blog.category, ...(blog.tags || []),
            question?.questionText, question?.questionLatex,
        ].filter((value): value is string => typeof value === 'string' && value.length > 0)
            .map(normalizeSearchText),
    };
}

function filterQuestions(
    questions: ReturnType<typeof indexQuestion>[],
    search: string,
    questionType: QuestionType | 'all',
    difficulty: number,
    imagesOnly: boolean,
) {
    const filteredBlogs: BlogPost[] = [];
    const typeCounts = { all: 0, trac_nghiem: 0, dung_sai: 0, tu_luan: 0 };
    const levelCounts = [0, 0, 0, 0, 0];
    let withImage = 0;
    const query = normalizeSearchText(search);

    for (const { blog, type, level, hasImage, searchFields } of questions) {
        if (query && !searchFields.some(field => field.includes(query))) continue;
        const matchesType = questionType === 'all' || questionType === type;
        const matchesLevel = difficulty === 0 || difficulty === level;
        const matchesImage = !imagesOnly || hasImage;

        // Each badge counts results after replacing just its own filter.
        if (matchesLevel && matchesImage) {
            typeCounts.all++;
            typeCounts[type]++;
        }
        if (matchesType && matchesImage) {
            levelCounts[0]++;
            if (Number.isInteger(level) && level >= 1 && level <= 4) levelCounts[level]++;
        }
        if (matchesType && matchesLevel && hasImage) withImage++;
        if (matchesType && matchesLevel && matchesImage) filteredBlogs.push(blog);
    }

    return { filteredBlogs, typeCounts, levelCounts, withImage };
}

const filterFocus = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700';

function FilterChip({ children, selected, count, onClick }: {
    children: React.ReactNode;
    selected: boolean;
    count?: number;
    onClick: () => void;
}) {
    return (
        <button type="button" aria-pressed={selected} onClick={onClick}
            className={`inline-flex min-h-8 items-center gap-1.5 rounded-md border px-2 py-1 text-left text-xs font-semibold leading-tight transition-colors sm:min-h-7 ${filterFocus} ${
                selected
                    ? 'border-amber-300 bg-amber-50 text-amber-950'
                    : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50'
            }`}>
            <span className="flex min-w-0 flex-1 items-center gap-1.5">{children}</span>
            {count !== undefined && (
                <span className={`shrink-0 rounded px-1 text-[11px] tabular-nums ${selected ? 'bg-amber-100 text-amber-900' : 'bg-stone-100 text-stone-600'}`}>
                    {count}
                </span>
            )}
        </button>
    );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div role="group" aria-label={label} className="flex min-w-0 items-start gap-1.5">
            <span aria-hidden="true" className="w-12 shrink-0 pt-2 text-xs font-semibold text-stone-600 sm:w-16 sm:pt-1.5">{label}</span>
            <div className="flex min-w-0 flex-wrap gap-1.5">{children}</div>
        </div>
    );
}

const BlogList: React.FC<BlogListProps> = ({
    isAdmin, studentGrade, onReadBlog, onEditBlog, onCreateBlog, studyLessons,
    onSaveLesson, lessonSync, onRetryLessonSync, onLibraryLoaded, getStudyLibrary,
}) => {
    const [blogs, setBlogs] = useState<BlogPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const questionSearch = useRef<HTMLInputElement>(null);
    const filterHeading = useRef<HTMLHeadingElement>(null);
    const [searchParams, setSearchParams] = useSearchParams();
    const [showMobileTree, setShowMobileTree] = useState(false);
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    const mobileTreeOpener = useRef<HTMLButtonElement>(null);
    const mobileTreeClose = useRef<HTMLButtonElement>(null);

    // ── BỘ LỌC CHUYÊN SÂU (Question Format, Difficulty Level, Image/Diagram) ──
    const [questionTypeFilter, setQuestionTypeFilter] = useState<QuestionType | 'all'>('all');
    const [levelFilter, setLevelFilter] = useState<number>(0); // 0 = Tất cả, 1-4 = Mức độ 1 đến 4
    const [hasImageFilter, setHasImageFilter] = useState<boolean>(false); // Chỉ câu có hình vẽ / đồ thị

    const [selectedCardIndexes, setSelectedCardIndexes] = useState(() => new Map<string, Set<number>>());
    const [isExamModalOpen, setIsExamModalOpen] = useState(false);
    const navigate = useNavigate();

    const handleToggleSelect = (blogId: string, index: number) => {
        setSelectedCardIndexes(previous => {
            const next = new Map(previous);
            const indexes = new Set(next.get(blogId));
            if (indexes.has(index)) indexes.delete(index);
            else indexes.add(index);
            if (indexes.size) next.set(blogId, indexes);
            else next.delete(blogId);
            return next;
        });
    };

    const selectedQuestions = useMemo(() => {
        const selected: SelectedQuestionItem[] = [];
        for (const blog of blogs) {
            const indexes = selectedCardIndexes.get(blog.id);
            if (!indexes) continue;
            const questions = getStoredQuestions(parsePhysicsSolution(blog.content));
            (questions.length ? questions : [undefined]).forEach((question, index) => {
                if (!indexes.has(index)) return;
                const card = toCardQuestion(question);
                selected.push({
                    id: questionKey(blog.id, index),
                    questionNo: card?.questionNo || 'Câu ' + (selected.length + 1),
                    qText: card ? card.questionText : blog.summary || blog.title,
                    qFormula: card?.questionLatex,
                    type: card?.type ?? 'tu_luan',
                    choices: question?.choices,
                    correctChoice: question?.correctChoice,
                    statements: question?.statements,
                    solution: question?.solution,
                    solutionSteps: question?.solutionSteps,
                    steps: question?.steps,
                    level: blog.level,
                    tikzCode: question?.tikz_code || question?.tikzCode,
                    imageSvg: card?.imageSvg,
                    imageUrl: card?.imageUrl,
                    imageTelegramFileId: card?.imageTelegramFileId,
                    imageLayout: card?.imageLayout,
                });
            });
        }
        return selected;
    }, [blogs, selectedCardIndexes]);

    const renderQuestionCards = (posts: BlogPost[], expandQuestions = false, matches?: ReadonlyMap<string, ReadonlySet<number>>) => (
        <div className="grid grid-cols-1 items-start gap-3.5 md:grid-cols-2">
            {posts.flatMap(blog => {
                const solution = parsePhysicsSolution(blog.content);
                const questions = getStoredQuestions(solution);
                const displayed = expandQuestions && questions.length ? questions : [questions[0]];
                return displayed.map((question, index) => (!matches || matches.get(blog.id)?.has(index)) && (
                    <QuestionCard
                        key={questionKey(blog.id, index)}
                        blog={blog}
                        question={toCardQuestion(question)}
                        isAdmin={isAdmin}
                        onEdit={onEditBlog && (() => onEditBlog(blog, index))}
                        onClick={() => {
                            if (solution && question && expandQuestions && questions.length > 1) {
                                const content = JSON.stringify({ ...solution, data: { ...solution.data, questions: [question] } });
                                onReadBlog({ ...blog, content });
                            } else {
                                onReadBlog(blog);
                            }
                        }}
                        isSelected={selectedCardIndexes.get(blog.id)?.has(index)}
                        onToggleSelect={() => handleToggleSelect(blog.id, index)}
                    />
                ));
            })}
        </div>
    );

    useEffect(() => {
        let cancelled = false;
        const fetchBlogs = async () => {
            setLoading(true);
            try {
                const data = await getStudyLibrary(isAdmin);
                if (cancelled) return;
                setBlogs(data.blogs);
                onLibraryLoaded(data);
            } catch (error) {
                console.error('[Blog] Không tải được thư viện:', error);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        void fetchBlogs();
        return () => { cancelled = true; };
    }, [getStudyLibrary, isAdmin, onLibraryLoaded]);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(searchQuery), 200);
        return () => clearTimeout(t);
    }, [searchQuery]);

    const visibleBlogs = useMemo(() => blogs.filter(blog => {
        if (isAdmin) return true;
        return blog.is_published && blog.category !== 'exam_paper' && (!studentGrade || !blog.grade || blog.grade === studentGrade);
    }), [blogs, isAdmin, studentGrade]);

    const grades = !isAdmin && studentGrade ? [studentGrade] : STUDY_GRADES;
    const folder = searchParams.get('folder');
    const chapter = getStudyChapter(folder);
    const activeChapter = chapter && grades.includes(chapter.grade) ? chapter : undefined;
    const gradeFilter = activeChapter?.grade ?? grades.find(grade => folder === 'grade-' + grade) ?? 0;
    const selectedFolderId = activeChapter?.id ?? (gradeFilter ? 'grade-' + gradeFilter : undefined);
    const type = searchParams.get('type');
    const selectedType = activeChapter && isStudyQuestionType(type) ? type : undefined;
    const selectedLessonId = selectedType ? searchParams.get('lesson') ?? undefined : undefined;
    const group = searchParams.get('group');
    const selectedGroup = supportsStudyGroups(selectedType)
        ? isStudyQuestionGroup(group) ? group : group === 'all' || selectedLessonId ? 'all' : undefined
        : undefined;
    const chapterLessons = studyLessons.filter(lesson => lesson.studySection.chapterId === activeChapter?.id);

    const { chapterCounts, gradeCounts } = useMemo(() => {
        const chapterCounts = new Map<string, number>();
        const gradeCounts = new Map<number, number>();
        const lessonsById = new Map(studyLessons.map(lesson => [lesson.id, lesson.studySection]));
        for (const lesson of studyLessons) {
            const { chapterId } = lesson.studySection;
            chapterCounts.set(chapterId, (chapterCounts.get(chapterId) ?? 0) + 1);
        }
        for (const blog of visibleBlogs) {
            gradeCounts.set(blog.grade, (gradeCounts.get(blog.grade) ?? 0) + 1);
            const section = blog.studySection;
            if (section && blog.category !== 'exam_paper' && isStudyQuestionType(section.questionType)) {
                const parent = section.lessonId ? lessonsById.get(section.lessonId) : undefined;
                if (parent?.chapterId !== section.chapterId || parent.questionType !== section.questionType) {
                    chapterCounts.set(section.chapterId, (chapterCounts.get(section.chapterId) ?? 0) + 1);
                }
            }
        }
        return { chapterCounts, gradeCounts };
    }, [studyLessons, visibleBlogs]);
    const chapterBlogs = useMemo(() => activeChapter ? visibleBlogs.filter(blog =>
        blog.category !== 'exam_paper' && blog.studySection?.chapterId === activeChapter.id
        && isStudyQuestionType(blog.studySection.questionType)
    ) : [], [activeChapter, visibleBlogs]);
    const groupMatches = useMemo(() => {
        if (!isStudyQuestionGroup(selectedGroup)) return undefined;
        const matches = new Map<string, Set<number>>();
        for (const blog of chapterBlogs) {
            if (blog.studySection?.questionType !== selectedType) continue;
            const indexes = new Set<number>();
            getStoredQuestions(parsePhysicsSolution(blog.content)).forEach((question, index) => {
                if (question && (question.type ?? selectedType) === selectedType
                    && Array.isArray(question.question_groups) && question.question_groups.includes(selectedGroup)) {
                    indexes.add(index);
                }
            });
            if (indexes.size) matches.set(blog.id, indexes);
        }
        return matches;
    }, [chapterBlogs, selectedType, selectedGroup]);

    const readChapterPost = (blog: BlogPost) => {
        const indexes = groupMatches?.get(blog.id);
        if (!indexes) return onReadBlog(blog);
        const solution = parsePhysicsSolution(blog.content);
        if (!solution) return onReadBlog(blog);
        const questions = getStoredQuestions(solution).filter((_, index) => indexes.has(index));
        const content = JSON.stringify({ ...solution, data: { ...solution.data, questions } });
        onReadBlog({ ...blog, content });
    };

    const inScopeBlogs = useMemo(
        () => activeChapter ? [] : gradeFilter ? visibleBlogs.filter(blog => blog.grade === gradeFilter) : visibleBlogs,
        [activeChapter, visibleBlogs, gradeFilter]
    );

    useEffect(() => {
        if (showMobileTree) mobileTreeClose.current?.focus();
    }, [showMobileTree]);

    const closeMobileTree = () => {
        if (!showMobileTree) return;
        setShowMobileTree(false);
        mobileTreeOpener.current?.focus();
    };

    const selectFolder = (id?: string) => {
        setSearchParams(id ? { folder: id } : {});
    };

    const selectGrade = (grade: number) => {
        selectFolder(grade ? 'grade-' + grade : undefined);
    };

    const questionIndex = useMemo(() => inScopeBlogs.map(indexQuestion), [inScopeBlogs]);
    const { filteredBlogs, typeCounts, levelCounts, withImage } = useMemo(
        () => filterQuestions(questionIndex, debouncedSearch, questionTypeFilter, levelFilter, hasImageFilter),
        [questionIndex, debouncedSearch, questionTypeFilter, levelFilter, hasImageFilter]
    );
    const isAnyFilterActive = questionTypeFilter !== 'all' || levelFilter !== 0 || hasImageFilter || !!searchQuery.trim();
    const advancedCount = Number(questionTypeFilter !== 'all') + Number(levelFilter !== 0);
    const gradeTabs = [0, ...[...grades].reverse()];

    const clearQuestionSearch = () => {
        setSearchQuery('');
        setDebouncedSearch('');
    };

    const handleResetAllFilters = () => {
        setQuestionTypeFilter('all');
        setLevelFilter(0);
        setHasImageFilter(false);
        clearQuestionSearch();
        filterHeading.current?.focus();
    };

    return (
        <div className="w-full max-w-[1720px] mx-auto p-4 md:p-6 lg:p-8 animate-fade-in relative pb-20" style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>
            {/* Nút quay lại trang chủ (khi góc học tập mở full-screen) */}
            <div style={{ marginBottom: '16px' }}>
                <button
                    onClick={() => navigate('/')}
                    style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        background: '#fff', border: '1px solid #E9E9E7', padding: '7px 16px',
                        borderRadius: '10px', fontSize: '13px', fontWeight: 600, color: '#57564F',
                        cursor: 'pointer', transition: 'all 0.15s', boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#1A1A1A'; e.currentTarget.style.borderColor = '#CFCFCB'; e.currentTarget.style.background = '#F7F6F3'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#57564F'; e.currentTarget.style.borderColor = '#E9E9E7'; e.currentTarget.style.background = '#fff'; }}
                >
                    <ChevronLeft style={{ width: '16px', height: '16px' }} /> Quay lại trang chủ
                </button>
            </div>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        width: '40px', height: '40px', borderRadius: '10px',
                        background: isAdmin ? '#EEF0FB' : '#F3ECF8',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                        {isAdmin
                            ? <FileText style={{ width: '20px', height: '20px', color: '#6B7CDB' }} />
                            : <BookOpen style={{ width: '20px', height: '20px', color: '#9065B0' }} />}
                    </div>
                    <div>
                        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#1A1A1A', lineHeight: 1.2 }}>
                            {isAdmin ? 'Quản lý Blog' : 'Góc Học Tập'}
                        </h1>
                        <p style={{ fontSize: '13px', color: '#787774', marginTop: '2px' }}>
                            {isAdmin ? 'Quản lý bài viết & kiến thức chuyên sâu' : 'Kiến thức, mẹo giải bài tập và tài liệu Vật Lý'}
                        </p>
                    </div>
                </div>

                {isAdmin && onCreateBlog && !activeChapter && (
                    <button
                        onClick={() => onCreateBlog()}
                        style={{
                            padding: '9px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: 600,
                            background: '#1A1A1A', color: '#fff', border: 'none', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '6px',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)', transition: 'all 0.15s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                    >
                        <Plus style={{ width: '15px', height: '15px' }} /> Viết bài mới
                    </button>
                )}
            </div>

            {/* ── BỐ CỤC 2 CỘT: Cột Trái (Mục lục cây thư mục) & Cột Phải (Kho học liệu & Bộ lọc) ── */}
            <div className="flex flex-col lg:flex-row gap-6 items-start mt-6">
                {/* ── CỘT TRÁI: MỤC LỤC CÂY THƯ MỤC 4 CẤP CHUẨN GDPT 2018 (Desktop) ── */}
                <aside className={(showMobileTree ? 'fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4 ' : 'hidden ')
                    + 'lg:sticky lg:inset-auto lg:top-6 lg:z-auto lg:block lg:w-[320px] lg:shrink-0 lg:p-0 xl:w-[350px]'}
                    aria-labelledby="physics-folder-panel-title"
                    onKeyDown={event => {
                        if (!showMobileTree || !mobileTreeClose.current?.getClientRects().length
                            || (event.target as HTMLElement).closest('dialog')) return;
                        if (event.key === 'Escape') closeMobileTree();
                        if (event.key !== 'Tab') return;
                        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)'))
                            .filter(control => control.getClientRects().length > 0);
                        const first = controls[0];
                        const last = controls.at(-1);
                        if (event.shiftKey ? event.target === first : event.target === last) {
                            event.preventDefault();
                            (event.shiftKey ? last : first)?.focus();
                        }
                    }}>
                    {showMobileTree && (
                        <div aria-hidden="true" className="absolute inset-0 bg-black/40 lg:hidden" onClick={closeMobileTree} />
                    )}
                    <div id="physics-folder-panel" className="relative flex h-[85dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-stone-200 bg-white shadow-sm sm:max-w-md sm:rounded-2xl lg:h-[min(740px,calc(100dvh-3rem))]">
                        <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-2.5">
                            <h2 id="physics-folder-panel-title" className="flex items-center gap-2 text-sm font-bold text-stone-800">
                                <Folder aria-hidden="true" className="size-4 text-amber-700" />
                                Mục lục Vật lý
                            </h2>
                            <button ref={mobileTreeClose} type="button" aria-label="Đóng mục lục" onClick={closeMobileTree}
                                className="grid size-9 place-items-center rounded-md text-stone-600 hover:bg-stone-100 lg:hidden">
                                <X aria-hidden="true" className="size-5" />
                            </button>
                        </div>
                        <TreeTableOfContents
                            grades={grades}
                            chapterCounts={chapterCounts}
                            gradeCounts={gradeCounts}
                            totalCount={visibleBlogs.length}
                            selectedId={selectedFolderId}
                            onSelect={id => {
                                selectFolder(id);
                                closeMobileTree();
                            }}
                        />
                    </div>
                </aside>

                {/* ── CỘT PHẢI: BỘ LỌC + DANH SÁCH BÀI TẬP ── */}
                <div className="flex w-full min-w-0 flex-1 flex-col gap-4">
                    {/* Nút mở Mục lục trên Mobile / Tablet */}
                    <div className="lg:hidden flex items-center justify-between bg-white p-3 rounded-xl border border-[#E9E9E7] shadow-2xs">
                        <button
                            ref={mobileTreeOpener}
                            type="button"
                            aria-expanded={showMobileTree}
                            aria-controls="physics-folder-panel"
                            onClick={() => setShowMobileTree(true)}
                            className="flex items-center gap-2 text-xs font-bold text-[#8C4A00] bg-[#FDF6ED] px-3.5 py-2 rounded-lg border border-[#F3DFC1]"
                        >
                            <Folder className="w-4 h-4 fill-[#F5A623] text-[#D9730D]" />
                            <span>Mục lục ({visibleBlogs.length} câu)</span>
                        </button>
                        {gradeFilter > 0 && (
                            <span className="text-xs font-semibold text-[#8C4A00] truncate max-w-[160px]">
                                {activeChapter?.name ?? 'VẬT LÝ ' + gradeFilter}
                            </span>
                        )}
                    </div>

                    {activeChapter ? (
                        <ChapterStudyList key={activeChapter.id + ':' + (selectedType ?? '') + ':' + (selectedGroup ?? '')}
                            chapter={activeChapter} selectedType={selectedType} selectedLessonId={selectedLessonId}
                            selectedGroup={selectedGroup} groupMatches={groupMatches}
                            blogs={chapterBlogs} lessons={chapterLessons} loading={loading}
                            onSelectType={questionType => setSearchParams(
                                questionType === selectedType && supportsStudyGroups(questionType)
                                    ? { folder: activeChapter.id }
                                    : studySectionParams({ chapterId: activeChapter.id, questionType })
                            )}
                            onSelectGroup={group => {
                                if (selectedType) setSearchParams({ ...studySectionParams({ chapterId: activeChapter.id, questionType: selectedType }), group });
                            }}
                            onSelectLesson={lessonId => {
                                if (selectedType) setSearchParams({
                                    ...studySectionParams({ chapterId: activeChapter.id, questionType: selectedType, lessonId }),
                                    ...(selectedGroup ? { group: selectedGroup } : {}),
                                });
                            }}
                            onRead={readChapterPost} onCreate={isAdmin ? onCreateBlog : undefined} onEdit={isAdmin ? onEditBlog : undefined}
                            renderLessonPosts={posts => renderQuestionCards(posts, true, groupMatches)}
                            onSaveLesson={onSaveLesson} lessonSync={lessonSync} onRetryLessonSync={onRetryLessonSync} />
                    ) : (<>
                    <section aria-labelledby="question-filter-heading" className="space-y-2 rounded-xl border border-stone-200 bg-white p-2.5 shadow-sm sm:px-3">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                            <div className="flex shrink-0 items-center gap-1.5">
                                <SlidersHorizontal aria-hidden="true" className="hidden size-3.5 text-amber-800 sm:block" />
                                <h2 ref={filterHeading} tabIndex={-1} id="question-filter-heading" className="sr-only text-xs font-bold text-stone-900 sm:not-sr-only">Bộ lọc</h2>
                                <span role="status" className="rounded bg-stone-100 px-1.5 py-0.5 text-xs tabular-nums text-stone-700">
                                    {loading ? 'Đang tải…' : filteredBlogs.length.toLocaleString('vi-VN') + ' kết quả'}
                                </span>
                            </div>
                            <div className="relative order-first min-w-0 basis-full sm:order-none sm:flex-[1_1_12rem]">
                                <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-stone-500" />
                                <input ref={questionSearch} type="text" aria-label="Tìm câu hỏi"
                                    placeholder="Tìm câu hỏi, công thức…"
                                    value={searchQuery} onChange={event => setSearchQuery(event.target.value)}
                                    className="h-9 w-full rounded-md border border-stone-200 bg-stone-50 pl-8 pr-8 text-sm text-stone-900 outline-none placeholder:text-stone-500 focus:border-amber-600 focus:bg-white focus:ring-1 focus:ring-amber-600 sm:h-8" />
                                {searchQuery && (
                                    <button type="button" aria-label="Xóa từ khóa"
                                        onClick={() => { clearQuestionSearch(); questionSearch.current?.focus(); }}
                                        className={`absolute right-0.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded text-stone-500 hover:bg-stone-100 hover:text-stone-800 ${filterFocus}`}>
                                        <X aria-hidden="true" className="size-4" />
                                    </button>
                                )}
                            </div>
                            <FilterChip selected={hasImageFilter} count={loading ? undefined : withImage}
                                onClick={() => setHasImageFilter(previous => !previous)}>
                                <Image aria-hidden="true" className="size-3.5 shrink-0" />
                                <span>Có hình<span className="sr-only sm:not-sr-only">/đồ thị</span></span>
                            </FilterChip>
                            <button type="button" aria-expanded={showAdvancedFilters} aria-controls="question-advanced-filters"
                                onClick={() => setShowAdvancedFilters(previous => !previous)}
                                className={`inline-flex min-h-8 items-center gap-1 rounded-md px-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-50 sm:hidden ${filterFocus}`}>
                                Lọc thêm{advancedCount > 0 && ' (' + advancedCount + ')'}
                                <ChevronDown aria-hidden="true" className={'size-3.5 ' + (showAdvancedFilters ? 'rotate-180' : '')} />
                            </button>
                            {isAnyFilterActive && (
                                <button type="button" onClick={handleResetAllFilters} aria-label="Xóa bộ lọc" title="Xóa bộ lọc"
                                    className={`inline-flex min-h-8 items-center gap-1 rounded-md px-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-50 sm:min-h-7 ${filterFocus}`}>
                                    <RotateCcw aria-hidden="true" className="size-3.5" /> <span className="hidden sm:inline">Xóa bộ lọc</span>
                                </button>
                            )}
                        </div>
                        <FilterGroup label="Khối">
                            {gradeTabs.map(grade => (
                                <FilterChip key={grade} selected={gradeFilter === grade} onClick={() => selectGrade(grade)}>
                                    {grade ? 'Lớp ' + grade : 'Tất cả'}
                                </FilterChip>
                            ))}
                        </FilterGroup>
                        <div id="question-advanced-filters" className={(showAdvancedFilters ? 'grid ' : 'hidden ') + 'gap-1.5 border-t border-stone-100 pt-2 sm:grid'}>
                            <FilterGroup label="Loại câu">
                                {questionTypeOptions.map(({ value, label }) => (
                                    <FilterChip key={value} selected={questionTypeFilter === value}
                                        count={loading ? undefined : typeCounts[value]} onClick={() => setQuestionTypeFilter(value)}>
                                        {label}
                                    </FilterChip>
                                ))}
                            </FilterGroup>
                            <FilterGroup label="Mức độ">
                                {levelOptions.map(({ value, label }) => (
                                    <FilterChip key={value} selected={levelFilter === value}
                                        count={loading ? undefined : levelCounts[value]} onClick={() => setLevelFilter(value)}>
                                        {label}
                                    </FilterChip>
                                ))}
                            </FilterGroup>
                        </div>
                    </section>

                    {/* Thanh Breadcrumb khi đang chọn một thư mục bất kỳ trong cây */}
                    {gradeFilter > 0 && (
                        <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#FDF4E7] border border-[#F6E1C4] text-xs">
                            <div className="flex items-center gap-2 min-w-0 pr-2">
                                <Folder className="w-4 h-4 fill-[#F5A623] text-[#D9730D] shrink-0" />
                                <span className="text-[#8C4A00] font-bold truncate">
                                    VẬT LÝ {gradeFilter}
                                </span>
                                <span className="text-[11px] font-semibold text-[#8C4A00] bg-[#FAEDE0] px-2 py-0.5 rounded-full shrink-0">
                                    {filteredBlogs.length} câu
                                </span>
                            </div>
                            <button
                                onClick={() => selectGrade(0)}
                                className="text-xs font-bold text-[#8C4A00] hover:text-[#5C3000] underline shrink-0 cursor-pointer"
                            >
                                ✕ Xem tất cả
                            </button>
                        </div>
                    )}

                    {/* Content */}
                    {loading ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: '12px' }}>
                            <div className="animate-spin" style={{ width: '32px', height: '32px', borderRadius: '50%', border: '3px solid #EEF0FB', borderTopColor: '#6B7CDB' }} />
                            <p style={{ fontSize: '13px', color: '#AEACA8', fontWeight: 500 }}>Đang tải bài viết...</p>
                        </div>
                    ) : filteredBlogs.length === 0 ? (
                        <div style={{
                            textAlign: 'center', padding: '64px 24px', borderRadius: '12px',
                            border: '1px solid #E9E9E7', background: '#fff'
                        }}>
                            <div style={{
                                width: '48px', height: '48px', borderRadius: '12px', background: '#F1F0EC',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px'
                            }}>
                                <BookOpen style={{ width: '22px', height: '22px', color: '#CFCFCB' }} />
                            </div>
                            <h3 className="mb-1.5 text-base font-semibold text-stone-900">
                                {inScopeBlogs.length > 0 ? 'Không có câu hỏi phù hợp' : 'Chưa có câu hỏi trong mục này'}
                            </h3>
                            {inScopeBlogs.length > 0 && (
                                <button type="button" onClick={handleResetAllFilters}
                                    className={`mt-2 min-h-10 rounded-lg border border-amber-200 bg-amber-50 px-3 text-sm font-semibold text-amber-900 hover:bg-amber-100 ${filterFocus}`}>
                                    Xóa bộ lọc
                                </button>
                            )}
                        </div>
                    ) : (
                        renderQuestionCards(filteredBlogs)
                    )}
                    </>)}
                </div>
            </div>

            {/* ── FLOATING BAR: Khi có câu hỏi được chọn ── */}
            {selectedQuestions.length > 0 && (
                <div
                    style={{
                        position: 'fixed',
                        bottom: '24px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 40,
                        background: '#1A1A1A',
                        color: '#fff',
                        padding: '10px 20px',
                        borderRadius: '16px',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                        maxWidth: '92vw',
                        border: '1px solid rgba(255,255,255,0.1)',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600 }}>
                        <span style={{
                            minWidth: '22px', height: '22px', borderRadius: '50%',
                            background: '#7B1113', color: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '11px', fontWeight: 700, padding: '0 6px',
                        }}>
                            {selectedQuestions.length}
                        </span>
                        <span>câu hỏi đã chọn</span>
                    </div>

                    <button
                        onClick={() => setSelectedCardIndexes(new Map())}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#AEACA8',
                            fontSize: '12px',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            padding: '4px 8px',
                        }}
                    >
                        Bỏ chọn
                    </button>

                    <button
                        onClick={() => setIsExamModalOpen(true)}
                        style={{
                            background: '#7B1113',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '10px',
                            padding: '8px 16px',
                            fontSize: '13px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 4px 12px rgba(123, 17, 19, 0.4)',
                            transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#920000'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#7B1113'; }}
                    >
                        <Sparkles style={{ width: '15px', height: '15px', color: '#FCD34D' }} />
                        <span>Biên soạn đề (LaTeX)</span>
                    </button>
                </div>
            )}

            {/* ── MODAL TÙY BIẾN STYLE & LAYOUT ── */}
            <ExamStyleModal
                isOpen={isExamModalOpen}
                onClose={() => setIsExamModalOpen(false)}
                questions={selectedQuestions}
            />
        </div>
    );
};

export default BlogList;
