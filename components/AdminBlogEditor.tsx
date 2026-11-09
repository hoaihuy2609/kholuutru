import React, { useState, useEffect, useMemo, useRef } from 'react';
import { BlogPost, StudyLesson, StudyQuestionGroup, StudyQuestionType, StudySection } from '../types';
import { getStudyChapter, isStudyQuestionType, nextStudyQuestionNumber, STUDY_CHAPTERS, STUDY_GRADES, STUDY_QUESTION_TYPES } from '../src/utils/studyLibrary';
import { matrixDraftPlacement, questionOutcomes, type MatrixQuestionDraft } from '../src/utils/examMatrix';
import {
    ChevronDown, ChevronLeft, Save, Trash2, Eye, PenTool, Bold, Italic, List,
    ImageIcon, Link as LinkIcon, HelpCircle, AlignLeft, AlignCenter,
    AlignRight, AlignJustify, Type, Hash, Quote, Code2, Table,
    X, CheckCircle, AlertCircle, RefreshCw
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import 'katex/dist/katex.min.css';
import SolutionEditor from './SolutionEditor';
import ExamPaperEditor from './ExamPaperEditor';

interface AdminBlogEditorProps {
    blog: BlogPost | null;
    initialSection?: StudySection;
    matrixDraft?: MatrixQuestionDraft;
    initialQuestionIndex?: number;
    initialQuestionGroup?: StudyQuestionGroup;
    studyLessons: StudyLesson[];
    existingBlogs: BlogPost[];
    onBack: () => void;
    onSaved: (blog: BlogPost) => void;
    saveBlog: (blog: Partial<BlogPost>) => Promise<BlogPost | null>;
    deleteBlog: (id: string) => Promise<boolean>;
    syncBlogs: (onProgress?: (pct: number) => void) => Promise<{ success: boolean; fileId?: string; blogCount: number }>;
}

const CATEGORIES = ['Lý thuyết', 'Mẹo giải bài', 'Kinh nghiệm', 'Tin tức', 'Đề cương', 'Khác'];

type EditorMode = 'markdown' | 'solution' | 'exam_paper';

function storedEditorMode(content?: string): EditorMode {
    try {
        const type = JSON.parse(content || '{}')?.type;
        if (type === 'physics_solution') return 'solution';
        if (type === 'exam_paper') return 'exam_paper';
    } catch { /* Plain-text posts use Markdown. */ }
    return 'markdown';
}

const AdminBlogEditor: React.FC<AdminBlogEditorProps> = ({ blog, initialSection, matrixDraft, initialQuestionIndex, initialQuestionGroup, studyLessons, existingBlogs, onBack, onSaved, saveBlog, deleteBlog, syncBlogs }) => {
    const storedMode = useMemo(() => storedEditorMode(blog?.content), [blog?.content]);
    const [selectedMode, setEditorMode] = useState(storedMode);
    const opensSolutionDirectly = storedMode === 'solution' || !!matrixDraft || (!blog && !!initialSection?.lessonId);
    const editorMode = opensSolutionDirectly ? 'solution' : selectedMode;
    const placement = blog?.studySection ?? initialSection ?? (matrixDraft && matrixDraftPlacement(matrixDraft, studyLessons));
    const [chapterId, setChapterId] = useState(placement?.chapterId ?? '');
    const [studyType, setStudyType] = useState<StudyQuestionType | ''>(matrixDraft?.type ?? placement?.questionType ?? '');
    const [lessonId, setLessonId] = useState(placement?.lessonId ?? '');
    const chapter = getStudyChapter(chapterId);
    const lessonOptions = studyLessons.filter(lesson =>
        lesson.studySection.chapterId === chapterId && lesson.studySection.questionType === studyType);
    const lesson = lessonOptions.find(option => option.id === lessonId);
    const firstQuestionNumber = useMemo(() => chapter && studyType
        ? nextStudyQuestionNumber(existingBlogs, { chapterId: chapter.id, questionType: studyType, lessonId: lesson?.id })
        : 1, [chapter, studyType, lesson?.id, existingBlogs]);
    const savedOutcomes = useMemo(() => questionOutcomes(existingBlogs.flatMap(post => {
        try {
            const parsed = JSON.parse(post.content);
            if (parsed?.type !== 'physics_solution' || !parsed.data) return [];
            const questions = Array.isArray(parsed.data.questions) && parsed.data.questions.length
                ? parsed.data.questions : [parsed.data];
            return questions.flatMap(question => questionOutcomes(question?.learning_outcomes));
        } catch {
            return [];
        }
    })).sort((a, b) => a.localeCompare(b, 'vi')), [existingBlogs]);

    const [formData, setFormData] = useState<Partial<BlogPost>>({
        title: '', summary: '', content: '', cover_image: '', category: '', is_published: false,
        grade: 0,
        tags: []
    });
    const [isPreview, setIsPreview] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showHelper, setShowHelper] = useState(false);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'warning' } | null>(null);
    const [wordCount, setWordCount] = useState(0);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (blog) {
            setFormData({
                id: blog.id, title: blog.title, summary: blog.summary,
                content: blog.content, cover_image: blog.cover_image,
                category: blog.category, tags: blog.tags || [],
                is_published: blog.is_published,
                grade: blog.grade ?? 0,
            });
        }
        setEditorMode(storedMode);
    }, [blog, storedMode]);

    useEffect(() => {
        const words = (formData.content || '').trim().split(/\s+/).filter(w => w).length;
        setWordCount(words);
    }, [formData.content]);

    const toastTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const showToast = (msg: string, type: 'success' | 'error' | 'warning' = 'success') => {
        // Hủy timer cũ nếu có
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setToast({ msg, type });
        // 'warning' (đang sync) không tự đóng — đợi kết quả mới đóng
        if (type !== 'warning') {
            toastTimerRef.current = setTimeout(() => setToast(null), 5000);
        }
    };


    const handleChange = (field: keyof BlogPost, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleTagsChange = (val: string) => {
        handleChange('tags', val.split(',').map(t => t.trim()).filter(t => t));
    };

    const savePlacedBlog = (payload: Partial<BlogPost>) => {
        if (matrixDraft && !chapter) {
            showToast('Chọn chương trong Góc Học Tập để lưu câu hỏi.', 'error');
            return Promise.resolve(null);
        }
        if (payload.category !== 'exam_paper' && chapter) {
            if (!studyType) {
                showToast('Chọn loại câu để lưu bài vào chương.', 'error');
                return Promise.resolve(null);
            }
            return saveBlog({
                ...payload, grade: chapter.grade,
                studySection: { chapterId: chapter.id, questionType: studyType, ...(lesson ? { lessonId: lesson.id } : {}) },
            });
        }
        return saveBlog(blog?.studySection ? { ...payload, studySection: null } : payload);
    };

    const handleSave = async () => {
        if (!formData.title?.trim()) { showToast('Vui lòng nhập tiêu đề!', 'error'); return; }
        if (!formData.content?.trim()) { showToast('Vui lòng nhập nội dung!', 'error'); return; }
        setIsSaving(true);
        const saved = await savePlacedBlog(formData);
        setIsSaving(false);
        if (saved) {
            if (formData.is_published || blog?.is_published) void syncBlogs();
            showToast(formData.is_published ? 'Đã lưu bài viết.' : 'Đã lưu bản nháp.');
            onSaved(saved);
        } else if (!chapter || studyType) {
            showToast('Lưu thất bại, vui lòng thử lại.', 'error');
        }
    };

    const handleDelete = async () => {
        if (!blog) return;
        if (!window.confirm('Bạn có chắc chắn muốn xóa bài viết này vĩnh viễn không?')) return;
        setIsSaving(true);
        const ok = await deleteBlog(blog.id);
        if (!ok) {
            setIsSaving(false);
            showToast('Lỗi khi xóa!', 'error');
            return;
        }
        void syncBlogs();
        setIsSaving(false);
        showToast('Đã xóa bài viết.');
        onBack();
    };

    const insertTextAtCursor = (prefix: string, suffix: string = '') => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const current = formData.content || '';
        const selected = current.substring(start, end);
        const newText = current.substring(0, start) + prefix + selected + suffix + current.substring(end);
        handleChange('content', newText);
        const newPos = start + prefix.length + selected.length + suffix.length;
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(newPos, newPos);
        }, 0);
    };

    const toolbarButtons = [
        { icon: <Bold className="w-4 h-4" />, tip: 'In đậm (Ctrl+B)', action: () => insertTextAtCursor('**', '**') },
        { icon: <Italic className="w-4 h-4" />, tip: 'In nghiêng (Ctrl+I)', action: () => insertTextAtCursor('*', '*') },
        { divider: true },
        { icon: <Hash className="w-4 h-4" />, tip: 'Tiêu đề H2', action: () => insertTextAtCursor('\n## ', '\n') },
        { icon: <Type className="w-4 h-4" />, tip: 'Tiêu đề H3', action: () => insertTextAtCursor('\n### ', '\n') },
        { divider: true },
        { icon: <List className="w-4 h-4" />, tip: 'Danh sách bullet', action: () => insertTextAtCursor('\n- ') },
        { icon: <span className="text-xs font-bold font-mono">1.</span>, tip: 'Danh sách số', action: () => insertTextAtCursor('\n1. ') },
        { icon: <Quote className="w-4 h-4" />, tip: 'Trích dẫn', action: () => insertTextAtCursor('\n> ') },
        { divider: true },
        { icon: <LinkIcon className="w-4 h-4" />, tip: 'Chèn link', action: () => insertTextAtCursor('[Tên link](', ')') },
        { icon: <ImageIcon className="w-4 h-4" />, tip: 'Chèn ảnh qua URL', action: () => insertTextAtCursor('![Mô tả](', ')') },
        { divider: true },
        { icon: <Code2 className="w-4 h-4" />, tip: 'Code block', action: () => insertTextAtCursor('\n```\n', '\n```\n') },
        { icon: <span className="text-xs font-bold font-mono italic">fx</span>, tip: 'Công thức toán (LaTeX)', action: () => insertTextAtCursor('\n$$\n', '\n$$\n'), highlight: true },
        { icon: <Table className="w-4 h-4" />, tip: 'Bảng Markdown', action: () => insertTextAtCursor('\n| Cột 1 | Cột 2 | Cột 3 |\n| ----- | ----- | ----- |\n| A     | B     | C     |\n') },
        { divider: true },
        { icon: <AlignLeft className="w-4 h-4" />, tip: 'Căn trái', action: () => insertTextAtCursor('<div align="left">\n\n', '\n\n</div>') },
        { icon: <AlignCenter className="w-4 h-4" />, tip: 'Căn giữa', action: () => insertTextAtCursor('<div align="center">\n\n', '\n\n</div>') },
        { icon: <AlignRight className="w-4 h-4" />, tip: 'Căn phải', action: () => insertTextAtCursor('<div align="right">\n\n', '\n\n</div>') },
        { icon: <AlignJustify className="w-4 h-4" />, tip: 'Căn đều', action: () => insertTextAtCursor('<div align="justify">\n\n', '\n\n</div>') },
    ];

    const studyPlacement = (
        <div className="grid gap-3 sm:grid-cols-2">
            <label className="min-w-0 space-y-1 text-sm font-medium text-stone-700">
                <span>Chương</span>
                <select value={chapterId} onChange={event => { setChapterId(event.target.value); setLessonId(''); }}
                    className="block w-full rounded-lg border border-stone-200 bg-white px-2.5 py-2">
                    <option value="">Chưa phân vào chương</option>
                    {STUDY_GRADES.filter(grade => !matrixDraft?.grade || grade === matrixDraft.grade).map(grade => (
                        <optgroup key={grade} label={'Vật lý ' + grade}>
                            {STUDY_CHAPTERS.filter(option => option.grade === grade).map(option => (
                                <option key={option.id} value={option.id}>{option.name}</option>
                            ))}
                        </optgroup>
                    ))}
                </select>
            </label>
            <label className="min-w-0 space-y-1 text-sm font-medium text-stone-700">
                <span>Loại câu</span>
                <select value={chapter || matrixDraft ? studyType : ''} disabled={!chapter || !!matrixDraft} required={!!chapter}
                    onChange={event => {
                        setStudyType(isStudyQuestionType(event.target.value) ? event.target.value : '');
                        setLessonId('');
                    }}
                    className="block w-full rounded-lg border border-stone-200 bg-white px-2.5 py-2 disabled:bg-stone-100">
                    <option value="">Chọn loại câu</option>
                    {STUDY_QUESTION_TYPES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
            </label>
            <label className="min-w-0 space-y-1 text-sm font-medium text-stone-700 sm:col-span-2">
                <span>Tên bài</span>
                <span className={`relative flex min-h-10 items-center gap-3 rounded-lg border border-stone-200 px-2.5 py-2 focus-within:ring-2 focus-within:ring-amber-600 ${
                    lessonOptions.length ? 'bg-white' : 'bg-stone-100 text-stone-500'
                }`}>
                    <span aria-hidden="true" className="min-w-0 flex-1 whitespace-normal [overflow-wrap:anywhere]">
                        {lesson?.title ?? 'Chưa xếp vào tên bài'}
                    </span>
                    <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-stone-500" />
                    <select value={lesson?.id ?? ''} disabled={lessonOptions.length === 0}
                        onChange={event => setLessonId(event.target.value)}
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-default">
                        <option value="">Chưa xếp vào tên bài</option>
                        {lessonOptions.map(option => <option key={option.id} value={option.id}>{option.title}</option>)}
                    </select>
                </span>
            </label>
        </div>
    );

    return (
        <div className="max-w-[1920px] w-full mx-auto p-4 md:p-8 space-y-6 animate-fade-in relative pb-20">
            {/* Toast */}
            {toast && (
                <div
                    className="fixed top-5 right-5 z-50 flex items-start gap-3 px-4 py-3.5 rounded-2xl animate-fade-in"
                    style={{
                        background: '#FFFFFF',
                        border: `1px solid ${toast.type === 'success' ? '#B7D9C4' : toast.type === 'error' ? '#FECACA' : '#E9E9E7'}`,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
                        maxWidth: '340px',
                    }}
                >
                    <div
                        className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                        style={{ background: toast.type === 'success' ? '#EAF3EE' : toast.type === 'error' ? '#FEE2E2' : '#EEF0FB' }}
                    >
                        {toast.type === 'success'
                            ? <CheckCircle className="w-4 h-4" style={{ color: '#448361' }} />
                            : toast.type === 'error'
                                ? <AlertCircle className="w-4 h-4" style={{ color: '#E03E3E' }} />
                                : <RefreshCw className="w-4 h-4 animate-spin" style={{ color: '#6B7CDB' }} />
                        }
                    </div>
                    <p className="text-sm font-medium leading-snug" style={{ color: '#1A1A1A' }}>{toast.msg}</p>
                </div>
            )}

            {/* ═══ UNIFIED Top Bar ═══ */}
            <div className="flex items-center" style={{ gap: '12px' }}>
                <div style={{ flex: 1 }}>
                    <button
                        onClick={onBack}
                        className="flex items-center gap-1.5 text-sm font-medium hover:text-indigo-600 transition-colors"
                        style={{ color: '#787774' }}
                    >
                        <ChevronLeft className="w-4 h-4" /> {matrixDraft ? 'Về ma trận' : 'Quay lại'}
                    </button>
                </div>

                {!opensSolutionDirectly && (
                    <div className="flex items-center bg-white p-1 rounded-xl border border-[#E9E9E7]">
                        {([
                            { key: 'markdown' as const, label: 'Markdown' },
                            { key: 'solution' as const, label: 'Lời Giải (LaTeX)' },
                            { key: 'exam_paper' as const, label: 'Soạn Đề' },
                        ]).filter(tab => !chapter || tab.key !== 'exam_paper').map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setEditorMode(tab.key)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                                    editorMode === tab.key
                                        ? 'bg-[#EEF0FB] text-[#6B7CDB]'
                                        : 'text-[#787774] hover:bg-gray-50'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                )}

                <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', gap: '12px', flexWrap: 'wrap' as const }}>
                    {editorMode === 'markdown' && (
                        <>
                            {blog && (
                                <button
                                    onClick={handleDelete}
                                    disabled={isSaving}
                                    className="px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-red-50 text-red-600 transition-colors disabled:opacity-50"
                                >
                                    <Trash2 className="w-4 h-4" /> Xóa bài
                                </button>
                            )}
                            <button
                                onClick={() => setIsPreview(!isPreview)}
                                className="px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all"
                                style={{ background: '#F1F0EC', color: '#1A1A1A' }}
                            >
                                {isPreview ? <><PenTool className="w-4 h-4" /> Chỉnh sửa</> : <><Eye className="w-4 h-4" /> Xem trước</>}
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="px-6 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-60"
                            >
                                <Save className="w-4 h-4" />
                                {isSaving ? 'Đang lưu...' : blog ? 'Cập nhật' : 'Đăng bài'}
                            </button>
                        </>
                    )}
                </div>
            </div>
            {matrixDraft && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950">
                    <h1 className="font-bold">Soạn câu cho {matrixDraft.label}</h1>
                    {matrixDraft.topic && <p className="mt-1 text-sm">{matrixDraft.topic}</p>}
                </div>
            )}

            {/* ═══ CONTENT ═══ */}
            {editorMode === 'markdown' && (
                <fieldset className="min-w-0 rounded-xl border border-stone-200 bg-white p-3">
                    <legend className="px-1 text-sm font-semibold text-stone-800">Vị trí trong Góc Học Tập</legend>
                    {studyPlacement}
                </fieldset>
            )}
            {editorMode === 'solution' && (
                <SolutionEditor
                    blog={blog}
                    initialQuestionIndex={initialQuestionIndex}
                    onSaved={onSaved}
                    onBack={onBack}
                    saveBlog={savePlacedBlog}
                    syncBlogs={syncBlogs}
                    deleteBlog={deleteBlog}
                    hideTopBar
                    studyPlacement={studyPlacement}
                    studyDefaults={chapter || matrixDraft ? { title: lesson?.title || chapter?.name || matrixDraft?.topic || 'Bài tập Vật lý', firstQuestionNumber } : undefined}
                    studyGrade={chapter?.grade}
                    studyQuestionType={chapter && studyType ? studyType : undefined}
                    initialQuestionGroup={initialQuestionGroup}
                    savedOutcomes={savedOutcomes}
                    matrixDraft={matrixDraft}
                />
            )}

            {editorMode === 'exam_paper' && (
                <ExamPaperEditor
                    saveBlog={savePlacedBlog}
                    syncBlogs={syncBlogs}
                    deleteBlog={deleteBlog}
                    existingBlog={blog}
                    onSaved={() => { onBack(); }}
                    onBack={onBack}
                />
            )}

            {editorMode === 'markdown' && (

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Editor Area */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="space-y-4 p-6 rounded-2xl bg-white border border-[#E9E9E7]">
                        {/* Title */}
                        <div>
                            <label className="block text-sm font-semibold mb-1 text-[#1A1A1A]">Tiêu đề bài viết *</label>
                            <input
                                type="text"
                                placeholder="Nhập tiêu đề hấp dẫn..."
                                className="w-full p-3 rounded-lg border border-[#E9E9E7] outline-none focus:border-indigo-500 font-semibold text-xl"
                                value={formData.title}
                                onChange={e => handleChange('title', e.target.value)}
                                disabled={isPreview}
                            />
                        </div>

                        {/* Summary */}
                        <div>
                            <label className="block text-sm font-semibold mb-1 text-[#1A1A1A]">Tóm tắt ngắn *</label>
                            <textarea
                                placeholder="1-3 câu giới thiệu, hiển thị ở thẻ bài viết..."
                                className="w-full p-3 rounded-lg border border-[#E9E9E7] outline-none focus:border-indigo-500 resize-none"
                                rows={3}
                                value={formData.summary}
                                onChange={e => handleChange('summary', e.target.value)}
                                disabled={isPreview}
                            />
                        </div>

                        {/* Content */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-sm font-semibold text-[#1A1A1A]">Nội dung bài viết *</label>
                                <div className="flex items-center gap-2 text-xs text-[#AEACA8]">
                                    <span>{wordCount} từ · {Math.max(1, Math.ceil(wordCount / 200))} phút đọc</span>
                                    <button
                                        onClick={() => setShowHelper(!showHelper)}
                                        className="p-1 hover:bg-gray-100 rounded text-gray-400 transition-colors"
                                        title="Hướng dẫn Markdown"
                                    >
                                        <HelpCircle className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Toolbar */}
                            {!isPreview && (
                                <div
                                    className="flex flex-wrap items-center gap-0.5 p-2 border border-b-0 rounded-t-lg"
                                    style={{ background: '#F7F6F3', borderColor: '#E9E9E7' }}
                                >
                                    {toolbarButtons.map((btn, i) =>
                                        'divider' in btn ? (
                                            <div key={i} className="w-px h-5 mx-1" style={{ background: '#DCDCDA' }} />
                                        ) : (
                                            <button
                                                key={i}
                                                onClick={btn.action}
                                                title={btn.tip}
                                                className="p-1.5 rounded transition-colors flex items-center justify-center min-w-[28px]"
                                                style={{ color: btn.highlight ? '#6B7CDB' : '#57564F' }}
                                                onMouseEnter={e => (e.currentTarget.style.background = '#E9E9E7')}
                                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                            >
                                                {btn.icon}
                                            </button>
                                        )
                                    )}
                                </div>
                            )}

                            {/* Helper panel */}
                            {showHelper && !isPreview && (
                                <div
                                    className="text-xs p-3 border border-t-0 mb-0 leading-relaxed"
                                    style={{ background: '#EEF0FB', color: '#3D3D8D', borderColor: '#C5CAFA' }}
                                >
                                    <strong>Mẹo nhanh:</strong> <code className="bg-white/60 px-1 rounded">**đậm**</code> · <code className="bg-white/60 px-1 rounded">*nghiêng*</code> · <code className="bg-white/60 px-1 rounded">## Tiêu đề</code> · <code className="bg-white/60 px-1 rounded">$$E=mc^2$$</code> (LaTeX) · <code className="bg-white/60 px-1 rounded">&gt; trích dẫn</code> · <code className="bg-white/60 px-1 rounded">`code`</code>
                                </div>
                            )}

                            {/* Textarea / Preview */}
                            {isPreview ? (
                                <div
                                    className="p-6 rounded-b-lg border min-h-[400px] prose prose-indigo max-w-none"
                                    style={{ background: '#F7F6F3', borderColor: '#E9E9E7' }}
                                >
                                    <ReactMarkdown
                                        remarkPlugins={[remarkMath]}
                                        rehypePlugins={[rehypeKatex, rehypeRaw]}
                                    >
                                        {formData.content || '*Chưa có nội dung*'}
                                    </ReactMarkdown>
                                </div>
                            ) : (
                                <textarea
                                    ref={textareaRef}
                                    id="blog-content-textarea"
                                    placeholder="Nhập nội dung bài viết bằng Markdown... Bắt đầu với ## Tiêu đề"
                                    className="w-full p-4 border border-[#E9E9E7] outline-none focus:border-indigo-500 font-mono text-sm leading-relaxed rounded-b-lg resize-none"
                                    style={{ minHeight: '500px' }}
                                    value={formData.content}
                                    onChange={e => handleChange('content', e.target.value)}
                                    onKeyDown={e => {
                                        // Tab support
                                        if (e.key === 'Tab') {
                                            e.preventDefault();
                                            insertTextAtCursor('  ');
                                        }
                                    }}
                                />
                            )}
                        </div>
                    </div>
                </div>

                {/* Sidebar */}
                <div className="space-y-5">
                    {/* Publish settings */}
                    <div className="p-5 rounded-2xl bg-white border border-[#E9E9E7] space-y-5">
                        <h3 className="font-semibold text-[#1A1A1A]">Cài đặt xuất bản</h3>

                        {/* Toggle publish */}
                        <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: '#F7F6F3', border: '1px solid #E9E9E7' }}>
                            <div>
                                <span className="block font-medium text-sm text-[#1A1A1A]">Trạng thái</span>
                                <span className="text-[11px]" style={{ color: formData.is_published ? '#448361' : '#787774' }}>
                                    {formData.is_published ? '✓ Hiển thị cho học sinh' : '✎ Chỉ Admin thấy'}
                                </span>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={formData.is_published}
                                    onChange={e => handleChange('is_published', e.target.checked)}
                                />
                                <div className="w-9 h-5 bg-[#CFCFCB] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                            </label>
                        </div>

                        {/* Grade Selection */}
                        {!chapter && <div>
                            <label className="block text-sm font-semibold mb-1.5 text-[#1A1A1A]">Khối lớp</label>
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { lab: 'Tất cả khối', val: 0 },
                                    { lab: 'Lớp 12', val: 12 },
                                    { lab: 'Lớp 11', val: 11 },
                                    { lab: 'Lớp 10', val: 10 }
                                ].map(g => (
                                    <button
                                        key={g.val}
                                        type="button"
                                        onClick={() => handleChange('grade', g.val)}
                                        className="py-2 text-xs font-semibold rounded-lg border transition-all"
                                        style={{
                                            background: (formData.grade || 0) === g.val ? '#6B7CDB' : '#FFFFFF',
                                            color: (formData.grade || 0) === g.val ? '#FFFFFF' : '#787774',
                                            borderColor: (formData.grade || 0) === g.val ? '#6B7CDB' : '#E9E9E7'
                                        }}
                                    >
                                        {g.lab}
                                    </button>
                                ))}
                            </div>
                        </div>}

                        {/* Category */}
                        <div>
                            <label className="block text-sm font-semibold mb-1.5 text-[#1A1A1A]">Chuyên mục</label>
                            <select
                                className="w-full p-3 rounded-lg border border-[#E9E9E7] outline-none focus:border-indigo-500 text-sm bg-white"
                                value={formData.category}
                                onChange={e => handleChange('category', e.target.value)}
                            >
                                <option value="">-- Chọn chuyên mục --</option>
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            {/* Hoặc nhập tùy chỉnh */}
                            <input
                                type="text"
                                placeholder="Hoặc nhập tùy chỉnh..."
                                className="w-full mt-2 p-2.5 rounded-lg border border-[#E9E9E7] outline-none focus:border-indigo-500 text-sm"
                                value={formData.category}
                                onChange={e => handleChange('category', e.target.value)}
                            />
                        </div>

                        {/* Tags */}
                        <div>
                            <label className="block text-sm font-semibold mb-1.5 text-[#1A1A1A]">Thẻ (Tags)</label>
                            <input
                                type="text"
                                placeholder="VD: vatly12, dongdien, nangluong"
                                className="w-full p-3 rounded-lg border border-[#E9E9E7] outline-none focus:border-indigo-500 text-sm"
                                value={(formData.tags || []).join(', ')}
                                onChange={e => handleTagsChange(e.target.value)}
                            />
                            <p className="text-[11px] mt-1" style={{ color: '#AEACA8' }}>Ngăn cách bằng dấu phẩy</p>
                            {(formData.tags || []).length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                    {(formData.tags || []).map(tag => (
                                        <span key={tag} className="text-xs px-2 py-0.5 rounded-md flex items-center gap-1" style={{ background: '#EEF0FB', color: '#6B7CDB' }}>
                                            #{tag}
                                            <button onClick={() => handleChange('tags', (formData.tags || []).filter(t => t !== tag))} className="hover:text-red-500">
                                                <X className="w-3 h-3" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Quick stats */}
                    <div className="p-5 rounded-2xl bg-white border border-[#E9E9E7]">
                        <h3 className="font-semibold text-[#1A1A1A] mb-3">Thống kê bài viết</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span style={{ color: '#787774' }}>Số từ</span>
                                <span className="font-medium" style={{ color: '#1A1A1A' }}>{wordCount.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span style={{ color: '#787774' }}>P.đọc ước tính</span>
                                <span className="font-medium" style={{ color: '#1A1A1A' }}>{Math.max(1, Math.ceil(wordCount / 200))} phút</span>
                            </div>
                            <div className="flex justify-between">
                                <span style={{ color: '#787774' }}>Số ký tự</span>
                                <span className="font-medium" style={{ color: '#1A1A1A' }}>{(formData.content || '').length.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
            )}
        </div>
    );
};

export default AdminBlogEditor;
