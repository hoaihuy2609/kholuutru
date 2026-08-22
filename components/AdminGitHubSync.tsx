
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    CloudUpload, Send, CheckCircle2, RefreshCw, AlertCircle,
    FileText, Trash2, Upload,
    BookOpen, X, MessageCircle, Tag, ChevronDown, ChevronRight,
    BarChart3, AlertTriangle, FolderOpen, GraduationCap, BookMarked, Calculator, FlaskConical
} from 'lucide-react';

const Loader2 = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
    <RefreshCw className={`${className} animate-spin`} style={style} />
);

import { Chapter, GradeData, GradeLevel, Lesson, StoredFile, FileStorage } from '../types';

// ── Danh mục cấp Bài học ─────────────────────────────────────────────────────
const LESSON_CATEGORIES = [
    'Trắc nghiệm Lý thuyết (ABCD)',
    'Trắc nghiệm Lý thuyết (Đúng/Sai)',
    'Bài tập Tính toán Cơ bản',
];

const CAT_CONFIG: Record<string, { short: string; color: string; bg: string }> = {
    'Trắc nghiệm Lý thuyết (ABCD)':      { short: 'TN ABCD',   color: '#4F5FBE', bg: '#DDE2F7' },
    'Trắc nghiệm Lý thuyết (Đúng/Sai)':  { short: 'Đúng/Sai',  color: '#7C4FAE', bg: '#E8DAFC' },
    'Bài tập Tính toán Cơ bản':           { short: 'Tính toán', color: '#C4630A', bg: '#FFE4C8' },
};

// ── Danh mục cấp Chương ───────────────────────────────────────────────────────
const CHAPTER_CATEGORIES = [
    'Lý thuyết trọng tâm (Chương)',
    'Trắc nghiệm Đúng/Sai (Chương)',
    'Bài tập Tính toán Nâng cao',
] as const;

type ChapterCategory = typeof CHAPTER_CATEGORIES[number];

const CH_CAT_CONFIG: Record<ChapterCategory, {
    short: string; color: string; bg: string; border: string;
    label: string; uploadLabel: string; icon: React.FC<{ className?: string; style?: React.CSSProperties }>;
}> = {
    'Lý thuyết trọng tâm (Chương)': {
        short: 'Lý thuyết', color: '#D9730D', bg: '#FFF3E8', border: '#D9730D33',
        label: 'Kho Lý thuyết trọng tâm',
        uploadLabel: 'Tải file Lý thuyết',
        icon: BookMarked,
    },
    'Trắc nghiệm Đúng/Sai (Chương)': {
        short: 'Đúng/Sai', color: '#448361', bg: '#EAF3EE', border: '#44836133',
        label: 'Trắc nghiệm Đúng/Sai',
        uploadLabel: 'Tải bài Đúng/Sai',
        icon: FlaskConical,
    },
    'Bài tập Tính toán Nâng cao': {
        short: 'Nâng cao', color: '#9065B0', bg: '#F3ECF8', border: '#9065B033',
        label: 'Bài tập Tính toán Nâng cao',
        uploadLabel: 'Tải bài Nâng cao',
        icon: Calculator,
    },
};

// ── Natural Sort helper ───────────────────────────────────────────────────────
const naturalSort = <T extends { name: string }>(items: T[]): T[] =>
    [...items].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    );

interface AdminGitHubSyncProps {
    onShowToast: (msg: string, type: 'success' | 'error' | 'warning') => void;
    curriculum: GradeData[];
    lessons: Lesson[];
    storedFiles: FileStorage;
    onDeleteChapter: (grade: GradeLevel, chapter: Chapter) => Promise<void>;
    onAddLesson: (name: string, chapterId: string) => Promise<void>;
    onDeleteLesson: (id: string) => Promise<void>;
    onUploadFiles: (files: File[], targetId: string, category?: string) => Promise<void>;
    onDeleteFile: (fileId: string, targetId: string) => Promise<void>;
    onSyncToGitHub: (grade: number, lessons: Lesson[], files: FileStorage) => Promise<string>;
    syncProgress: number;
}

type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

const GRADE_COLORS: Record<number, { accent: string; bg: string; label: string }> = {
    12: { accent: '#9065B0', bg: '#F3ECF8', label: 'Vật Lý 12' },
    11: { accent: '#6B7CDB', bg: '#EEF0FB', label: 'Vật Lý 11' },
    10: { accent: '#448361', bg: '#EAF3EE', label: 'Vật Lý 10' },
};

const AdminGitHubSync: React.FC<AdminGitHubSyncProps> = ({
    onShowToast, curriculum, lessons, storedFiles, onDeleteChapter,
    onAddLesson, onDeleteLesson, onUploadFiles, onDeleteFile, onSyncToGitHub, syncProgress
}) => {

    const [selectedGrade, setSelectedGrade] = useState<number>(12);
    const [syncStatus, setSyncStatus] = useState<Record<number, SyncStatus>>({ 10: 'idle', 11: 'idle', 12: 'idle' });
    const [syncMsg, setSyncMsg] = useState<Record<number, string>>({});
    const [uploadingTarget, setUploadingTarget] = useState<string | null>(null);
    const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
    const [expandedLessons, setExpandedLessons] = useState<Set<string>>(new Set());
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [selectedUploadCategory, setSelectedUploadCategory] = useState<string>(LESSON_CATEGORIES[0]);
    const [pendingUploadLessonId, setPendingUploadLessonId] = useState<string | null>(null);

    // Khóa cuộn trang triệt để khi Modal chọn loại tài liệu mở
    useEffect(() => {
        if (!showCategoryModal) return;

        const originalBodyOverflow = document.body.style.overflow;
        const originalHtmlOverflow = document.documentElement.style.overflow;
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';

        // Khóa tất cả scroll containers (VD: div.overflow-y-auto trong AdminDashboard)
        const scrollContainers = document.querySelectorAll<HTMLElement>('.overflow-y-auto, .overflow-auto');
        const originalContainerOverflows: Map<HTMLElement, string> = new Map();
        scrollContainers.forEach(el => {
            originalContainerOverflows.set(el, el.style.overflow);
            el.style.overflow = 'hidden';
        });

        const preventScroll = (e: Event) => {
            e.preventDefault();
        };

        window.addEventListener('wheel', preventScroll, { passive: false });
        window.addEventListener('touchmove', preventScroll, { passive: false });

        return () => {
            document.body.style.overflow = originalBodyOverflow;
            document.documentElement.style.overflow = originalHtmlOverflow;
            originalContainerOverflows.forEach((val, el) => {
                el.style.overflow = val;
            });
            window.removeEventListener('wheel', preventScroll);
            window.removeEventListener('touchmove', preventScroll);
        };
    }, [showCategoryModal]);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const uploadTargetRef = useRef<string | null>(null);
    const uploadCategoryRef = useRef<string>(LESSON_CATEGORIES[0]);

    const color = GRADE_COLORS[selectedGrade];
    const gradeData = curriculum.find(g => g.level === selectedGrade);
    const gradeLessons = lessons.filter(l => gradeData?.chapters.map(c => c.id).includes(l.chapterId));

    // Category summary — chỉ tính file cấp bài (lesson)
    const categorySummary = useMemo(() => {
        const counts: Record<string, number> = {};
        let uncategorized = 0;
        LESSON_CATEGORIES.forEach(cat => counts[cat] = 0);
        gradeLessons.forEach(l => {
            (storedFiles[l.id] || []).forEach(f => {
                if (f.category && LESSON_CATEGORIES.includes(f.category)) counts[f.category]++;
                else uncategorized++;
            });
        });
        return { counts, uncategorized };
    }, [gradeLessons, storedFiles]);

    const gradeFiles: FileStorage = {};
    gradeLessons.forEach(l => { if (storedFiles[l.id]) gradeFiles[l.id] = storedFiles[l.id]; });
    gradeData?.chapters.forEach(ch => { if (storedFiles[ch.id]?.length) gradeFiles[ch.id] = storedFiles[ch.id]; });
    const totalFiles = Object.values(gradeFiles).flat().length;
    const totalSize = Object.values(gradeFiles).flat().reduce((acc, f) => acc + f.size, 0);

    const handleSyncGrade = async (grade: number) => {
        const gData = curriculum.find(g => g.level === grade);
        if (!gData) return;
        const gLessons = lessons.filter(l => gData.chapters.map(c => c.id).includes(l.chapterId));
        const gFiles: FileStorage = {};
        gLessons.forEach(l => { if (storedFiles[l.id]) gFiles[l.id] = storedFiles[l.id]; });
        gData.chapters.forEach(ch => { if (storedFiles[ch.id]?.length) gFiles[ch.id] = storedFiles[ch.id]; });
        const hasChapterFiles = gData.chapters.some(ch => (storedFiles[ch.id]?.length ?? 0) > 0);
        if (gLessons.length === 0 && !hasChapterFiles) { onShowToast(`Lớp ${grade} chưa có tài liệu nào!`, 'warning'); return; }
        setSyncStatus(prev => ({ ...prev, [grade]: 'syncing' }));
        setSyncMsg(prev => ({ ...prev, [grade]: '' }));
        try {
            const fileId = await onSyncToGitHub(grade, gLessons, gFiles);
            setSyncStatus(prev => ({ ...prev, [grade]: 'success' }));
            setSyncMsg(prev => ({ ...prev, [grade]: `✓ ID: ...${fileId.slice(-6)}` }));
            onShowToast(`Đã Sync Lớp ${grade} lên Telegram!`, 'success');
            setTimeout(() => setSyncStatus(prev => ({ ...prev, [grade]: 'idle' })), 10000);
        } catch (err: any) {
            setSyncStatus(prev => ({ ...prev, [grade]: 'error' }));
            setSyncMsg(prev => ({ ...prev, [grade]: err.message }));
            onShowToast(`Lỗi Sync Lớp ${grade}: ${err.message}`, 'error');
        }
    };

    // Upload cho bài học (qua modal chọn category)
    const handleUploadTrigger = (lessonId: string) => {
        setPendingUploadLessonId(lessonId);
        setSelectedUploadCategory(LESSON_CATEGORIES[0]);
        setShowCategoryModal(true);
    };

    const handleCategoryConfirm = () => {
        uploadTargetRef.current = pendingUploadLessonId;
        uploadCategoryRef.current = selectedUploadCategory;
        setShowCategoryModal(false);
        setTimeout(() => fileInputRef.current?.click(), 50);
    };

    // Upload trực tiếp cho file cấp Chương (không cần modal)
    const triggerDirectUpload = (targetId: string, category: string) => {
        uploadTargetRef.current = targetId;
        uploadCategoryRef.current = category;
        setTimeout(() => fileInputRef.current?.click(), 50);
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []) as File[];
        const targetId = uploadTargetRef.current;
        const category = uploadCategoryRef.current;
        if (!files.length || !targetId) return;
        setUploadingTarget(targetId + '_' + category);
        try {
            await onUploadFiles(files, targetId, category);
            onShowToast(`Đã thêm ${files.length} file vào "${category}"!`, 'success');
            setExpandedLessons(prev => new Set([...prev, targetId]));
        } catch { onShowToast('Lỗi khi thêm file', 'error'); }
        finally {
            setUploadingTarget(null);
            uploadTargetRef.current = null;
            setPendingUploadLessonId(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDeleteChapter = async (chapter: Chapter, lessonCount: number, fileCount: number) => {
        const detail = lessonCount || fileCount
            ? `\n\nChương này có ${lessonCount} bài học và ${fileCount} tài liệu; toàn bộ dữ liệu đó sẽ bị xóa.`
            : '';
        if (!window.confirm(`Xóa chương "${chapter.name}"?${detail}\n\nThao tác này không thể hoàn tác.`)) return;
        try {
            await onDeleteChapter(selectedGrade as GradeLevel, chapter);
            onShowToast(`Đã xóa chương: ${chapter.name}. Hãy bấm Đồng bộ để cập nhật cho học viên.`, 'warning');
        } catch {
            onShowToast('Không thể xóa chương.', 'error');
        }
    };

    const handleDeleteLesson = async (lessonId: string, name: string) => {
        if (!window.confirm(`Xóa bài giảng "${name}"?`)) return;
        await onDeleteLesson(lessonId);
        onShowToast(`Đã xóa: ${name}`, 'success');
    };

    const handleDeleteFile = async (fileId: string, targetId: string, fileName: string) => {
        if (!window.confirm(`Xóa file "${fileName}"?`)) return;
        await onDeleteFile(fileId, targetId);
        onShowToast('Đã xóa file', 'success');
    };

    const toggleChapter = (chId: string) => {
        setExpandedChapters(prev => {
            const s = new Set(prev);
            s.has(chId) ? s.delete(chId) : s.add(chId);
            return s;
        });
    };

    const toggleLesson = (lessonId: string) => {
        setExpandedLessons(prev => {
            const s = new Set(prev);
            s.has(lessonId) ? s.delete(lessonId) : s.add(lessonId);
            return s;
        });
    };

    const expandAll = () => {
        setExpandedChapters(new Set(gradeData?.chapters.map(c => c.id) || []));
    };
    const collapseAll = () => {
        setExpandedChapters(new Set());
        setExpandedLessons(new Set());
    };

    return (
        <div className="space-y-4 animate-fade-in">

                {/* Grade Tabs */}
                <div className="flex items-center gap-0.5 p-1 rounded-lg" style={{ background: '#EBEBEA', width: 'fit-content' }}>
                    {([12, 11, 10] as const).map(grade => {
                        const c = GRADE_COLORS[grade];
                        const gLessons = lessons.filter(l => curriculum.find(g => g.level === grade)?.chapters.map(ch => ch.id).includes(l.chapterId));
                        const gFileCount = gLessons.reduce((s, l) => s + (storedFiles[l.id]?.length || 0), 0)
                            + (curriculum.find(g => g.level === grade)?.chapters.reduce((s, ch) => s + (storedFiles[ch.id]?.length || 0), 0) ?? 0);
                        const isActive = selectedGrade === grade;
                        return (
                            <button key={grade} onClick={() => setSelectedGrade(grade)}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors"
                                style={{
                                    background: isActive ? '#FFFFFF' : 'transparent',
                                    color: isActive ? '#1A1A1A' : '#57564F',
                                    fontWeight: isActive ? 600 : 400,
                                    boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                                }}
                                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.04)'; }}
                                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                            >
                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.accent, opacity: isActive ? 1 : 0.65 }} />
                                Lớp {grade}
                                {isActive && (
                                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: `${c.accent}18`, color: c.accent }}>
                                        {gLessons.length}b · {gFileCount}f
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Category Summary Bar */}
                <div className="rounded-xl px-4 py-3 flex items-center gap-3"
                    style={{ background: '#FFFFFF', border: '1px solid #E9E9E7' }}>
                    <div className="flex items-center gap-1.5 shrink-0 pr-3" style={{ borderRight: '1px solid #E9E9E7' }}>
                        <BarChart3 className="w-3.5 h-3.5 shrink-0" style={{ color: '#AEACA8' }} />
                        <span className="text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: '#AEACA8' }}>Phân loại</span>
                    </div>
                    {LESSON_CATEGORIES.map(cat => {
                        const cfg = CAT_CONFIG[cat];
                        const count = categorySummary.counts[cat] || 0;
                        return (
                            <div key={cat} className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg min-w-0"
                                style={{ background: cfg.bg, border: `1px solid ${cfg.color}30` }}>
                                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cfg.color }} />
                                <div className="min-w-0">
                                    <div className="text-[10px] font-semibold leading-tight truncate" style={{ color: cfg.color }}>{cfg.short}</div>
                                    <div className="text-sm font-bold leading-tight tabular-nums" style={{ color: '#1A1A1A' }}>{count}</div>
                                </div>
                            </div>
                        );
                    })}
                    <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg min-w-0"
                        style={{
                            background: categorySummary.uncategorized > 0 ? '#FDE68A' : '#F7F6F3',
                            border: categorySummary.uncategorized > 0 ? '1px solid #F59E0B40' : '1px solid transparent',
                            opacity: categorySummary.uncategorized > 0 ? 1 : 0.5,
                        }}>
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" style={{ color: categorySummary.uncategorized > 0 ? '#D97706' : '#CFCFCB' }} />
                        <div className="min-w-0">
                            <div className="text-[10px] font-semibold leading-tight truncate" style={{ color: categorySummary.uncategorized > 0 ? '#B45309' : '#AEACA8' }}>Chưa PL</div>
                            <div className="text-sm font-bold leading-tight tabular-nums" style={{ color: '#1A1A1A' }}>{categorySummary.uncategorized}</div>
                        </div>
                    </div>
                </div>

                {/* Sync Card */}
                <div className="rounded-xl overflow-hidden"
                    style={{ background: '#FFFFFF', border: `1px solid ${color.accent}33`, borderLeft: `3px solid ${color.accent}` }}>
                    <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl shrink-0" style={{ background: color.bg }}>
                                <CloudUpload className="w-5 h-5" style={{ color: color.accent }} />
                            </div>
                            <div>
                                <div className="font-semibold text-sm" style={{ color: '#1A1A1A' }}>Sync {color.label} lên Telegram</div>
                                <div className="text-xs mt-0.5 flex flex-wrap gap-x-3" style={{ color: '#787774' }}>
                                    <span>{gradeLessons.length} bài giảng</span>
                                    <span>{totalFiles} tài liệu</span>
                                    <span className="font-medium" style={{ color: '#1A1A1A' }}>~{(totalSize / 1024 / 1024).toFixed(1)}MB</span>
                                    {syncMsg[selectedGrade] && (
                                        <span className="font-medium" style={{ color: syncStatus[selectedGrade] === 'success' ? '#448361' : '#E03E3E' }}>
                                            {syncMsg[selectedGrade]}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <button onClick={() => handleSyncGrade(selectedGrade)} disabled={syncStatus[selectedGrade] === 'syncing'}
                            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-xl transition-all disabled:opacity-60 active:scale-[0.98] shrink-0"
                            style={{ background: syncStatus[selectedGrade] === 'success' ? '#448361' : color.accent }}>
                            {syncStatus[selectedGrade] === 'syncing'
                                ? <><Loader2 className="w-4 h-4 animate-spin" /> Đang Sync...</>
                                : syncStatus[selectedGrade] === 'success' ? <><CheckCircle2 className="w-4 h-4" /> Đã Sync!</>
                                    : syncStatus[selectedGrade] === 'error' ? <><AlertCircle className="w-4 h-4" /> Thử lại</>
                                        : <><Send className="w-4 h-4" /> Sync lên Telegram</>}
                        </button>
                    </div>

                    {/* Progress Bar */}
                    {syncStatus[selectedGrade] === 'syncing' && (
                        <div className="px-4 pb-4">
                            <div className="relative h-2 rounded-full overflow-hidden" style={{ background: '#F1F0EC' }}>
                                <div
                                    className="absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out"
                                    style={{
                                        width: `${syncProgress || 2}%`,
                                        background: `linear-gradient(90deg, ${color.accent}BB, ${color.accent})`,
                                    }}
                                />
                                <div
                                    className="absolute inset-y-0 left-0 rounded-full overflow-hidden pointer-events-none"
                                    style={{ width: `${syncProgress || 2}%` }}
                                >
                                    <div
                                        style={{
                                            position: 'absolute',
                                            inset: 0,
                                            width: '40%',
                                            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)',
                                            animation: 'shimmer-sweep 1.6s ease-in-out infinite',
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="flex items-center justify-between mt-1.5">
                                <span className="text-[11px]" style={{ color: '#AEACA8' }}>Đang tải lên Telegram…</span>
                                <span className="text-[11px] font-semibold tabular-nums" style={{ color: color.accent }}>
                                    {syncProgress > 0 ? `${Math.round(syncProgress)}%` : '···'}
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Lesson List */}
                <div className="rounded-xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E9E9E7' }}>
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid #E9E9E7' }}>
                        <div className="flex items-center gap-2">
                            <BookOpen className="w-4 h-4" style={{ color: color.accent }} />
                            <h3 className="font-semibold text-sm" style={{ color: '#1A1A1A' }}>Danh sách bài giảng — {color.label}</h3>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: color.bg, color: color.accent }}>{gradeLessons.length}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={expandAll} className="text-[11px] px-2.5 py-1 rounded-md transition-colors" style={{ color: '#787774', background: '#F1F0EC', border: '1px solid #E9E9E7' }}
                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#E5E4DE'}
                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#F1F0EC'}>Mở tất cả</button>
                            <button onClick={collapseAll} className="text-[11px] px-2.5 py-1 rounded-md transition-colors" style={{ color: '#787774', background: '#F1F0EC', border: '1px solid #E9E9E7' }}
                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#E5E4DE'}
                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#F1F0EC'}>Thu gọn</button>
                        </div>
                    </div>

                    {/* Chapters */}
                    {!gradeData?.chapters.length ? (
                        <div className="py-12 text-center">
                            <BookOpen className="w-10 h-10 mx-auto mb-3" style={{ color: '#CFCFCB' }} />
                            <p className="text-sm font-medium" style={{ color: '#787774' }}>Chưa có chương nào</p>
                            <p className="text-xs mt-1" style={{ color: '#AEACA8' }}>Thêm chương mới tại trang Tổng quan khối lớp.</p>
                        </div>
                    ) : (
                        <div>
                            {gradeData?.chapters.map(chapter => {
                                const chapterLessons = naturalSort(
                                    gradeLessons.filter(l => l.chapterId === chapter.id)
                                );
                                const chapterDirectFiles = storedFiles[chapter.id] || [];
                                const isExpanded = expandedChapters.has(chapter.id);

                                // Phân nhóm file cấp Chương theo 3 danh mục
                                const chCatFiles: Record<ChapterCategory, StoredFile[]> = {
                                    'Lý thuyết trọng tâm (Chương)': [],
                                    'Trắc nghiệm Đúng/Sai (Chương)': [],
                                    'Bài tập Tính toán Nâng cao': [],
                                };
                                chapterDirectFiles.forEach(f => {
                                    if (f.category && (CHAPTER_CATEGORIES as readonly string[]).includes(f.category)) {
                                        chCatFiles[f.category as ChapterCategory].push(f);
                                    } else {
                                        // file không có category → đưa vào Lý thuyết mặc định
                                        chCatFiles['Lý thuyết trọng tâm (Chương)'].push(f);
                                    }
                                });
                                // Natural sort từng nhóm
                                CHAPTER_CATEGORIES.forEach(cat => {
                                    chCatFiles[cat] = naturalSort(chCatFiles[cat]);
                                });

                                const chFileCount = chapterLessons.reduce((s, l) => s + (storedFiles[l.id]?.length || 0), 0) + chapterDirectFiles.length;

                                // Badge tổng hợp cấp bài
                                const chCatCounts: Record<string, number> = {};
                                LESSON_CATEGORIES.forEach(cat => chCatCounts[cat] = 0);
                                let chUncategorized = 0;
                                chapterLessons.forEach(l => {
                                    (storedFiles[l.id] || []).forEach(f => {
                                        if (f.category && LESSON_CATEGORIES.includes(f.category)) chCatCounts[f.category]++;
                                        else chUncategorized++;
                                    });
                                });

                                return (
                                    <div key={chapter.id} style={{ borderBottom: '1px solid #F1F0EC' }}>
                                        {/* Chapter Header */}
                                        <div className="flex items-center justify-between px-5 py-3 cursor-pointer group"
                                            style={{ background: isExpanded ? '#FAFAF9' : '#FFFFFF' }}
                                            onClick={() => toggleChapter(chapter.id)}>
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="p-1.5 rounded-lg shrink-0" style={{ background: color.bg }}>
                                                    <BookOpen className="w-3.5 h-3.5" style={{ color: color.accent }} />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="text-sm font-bold uppercase tracking-wide truncate" style={{ color: '#1A1A1A' }}>{chapter.name}</div>
                                                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                        <span className="text-[11px]" style={{ color: '#AEACA8' }}>{chapterLessons.length} bài · {chFileCount} file</span>
                                                        {LESSON_CATEGORIES.map(cat => {
                                                            const cfg = CAT_CONFIG[cat];
                                                            const cnt = chCatCounts[cat];
                                                            if (!cnt) return null;
                                                            return (
                                                                <span key={cat} className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                                                                    style={{ background: cfg.bg, color: cfg.color }}>
                                                                    {cfg.short}: {cnt}
                                                                </span>
                                                            );
                                                        })}
                                                        {chUncategorized > 0 && (
                                                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-600">
                                                                ⚠ Chưa PL: {chUncategorized}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0 ml-2">
                                                <button
                                                    onClick={event => { event.stopPropagation(); handleDeleteChapter(chapter, chapterLessons.length, chFileCount); }}
                                                    className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-all"
                                                    style={{ color: '#AEACA8' }}
                                                    onMouseEnter={event => { (event.currentTarget as HTMLElement).style.color = '#E03E3E'; (event.currentTarget as HTMLElement).style.background = '#FEF0F0'; }}
                                                    onMouseLeave={event => { (event.currentTarget as HTMLElement).style.color = '#AEACA8'; (event.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                                    title="Xóa chương"
                                                    aria-label={`Xóa chương ${chapter.name}`}
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                            </div>
                                        </div>

                                        {/* Expanded Content */}
                                        {isExpanded && (
                                            <div style={{ borderTop: '1px solid #F1F0EC' }}>

                                                {/* ── Helper render cho 1 mục Cấp Chương ── */}
                                                {(() => {
                                                    const renderChapterCategory = (cat: ChapterCategory) => {
                                                        const cfg = CH_CAT_CONFIG[cat];
                                                        const catFiles = chCatFiles[cat];
                                                        const IconComp = cfg.icon;
                                                        const isUploadingThis = uploadingTarget === chapter.id + '_' + cat;

                                                        return (
                                                            <div key={cat} style={{ borderBottom: '1px solid #F1F0EC', background: cfg.bg + '66' }}>
                                                                {/* Tiêu đề nhóm */}
                                                                <div className="flex items-center justify-between px-5 py-2.5"
                                                                    style={{ borderBottom: catFiles.length > 0 ? '1px solid ' + cfg.border : 'none' }}>
                                                                    <div className="flex items-center gap-2">
                                                                        <IconComp className="w-3.5 h-3.5 shrink-0" style={{ color: cfg.color }} />
                                                                        <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: cfg.color }}>
                                                                            {cfg.label}
                                                                        </span>
                                                                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                                                                            style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                                                                            {catFiles.length}
                                                                        </span>
                                                                    </div>
                                                                    {/* Nút Upload trực tiếp */}
                                                                    <button
                                                                        onClick={e => { e.stopPropagation(); triggerDirectUpload(chapter.id, cat); }}
                                                                        className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-all active:scale-95"
                                                                        style={{
                                                                            border: `1.5px dashed ${cfg.color}88`,
                                                                            color: cfg.color,
                                                                            background: 'transparent',
                                                                        }}
                                                                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = cfg.bg}
                                                                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                                                                        title={cfg.uploadLabel}
                                                                    >
                                                                        {isUploadingThis
                                                                            ? <Loader2 className="w-3 h-3" />
                                                                            : <Upload className="w-3 h-3" />}
                                                                        {cfg.uploadLabel}
                                                                    </button>
                                                                </div>

                                                                {/* Danh sách file (Natural Sort) */}
                                                                {catFiles.length > 0 && (
                                                                    <div className="py-1">
                                                                        {catFiles.map(file => (
                                                                            <div
                                                                                key={file.id}
                                                                                className="flex items-center gap-2 group/cf"
                                                                                style={{ padding: '5px 20px 5px 52px' }}
                                                                            >
                                                                                <FileText className="w-3 h-3 shrink-0" style={{ color: cfg.color }} />
                                                                                <span className="text-[12px] flex-1 truncate" style={{ color: '#57564F' }}>{file.name}</span>
                                                                                <span className="text-[10px] shrink-0" style={{ color: '#AEACA8' }}>{(file.size / 1024 / 1024).toFixed(1)}MB</span>
                                                                                <button
                                                                                    onClick={() => handleDeleteFile(file.id, chapter.id, file.name)}
                                                                                    className="opacity-0 group-hover/cf:opacity-100 p-1 rounded hover:text-red-500 transition-all"
                                                                                    title="Xóa file"
                                                                                >
                                                                                    <Trash2 className="w-3 h-3" />
                                                                                </button>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    };

                                                    return (
                                                        <>
                                                            {/* ── 1. Kho Lý thuyết trọng tâm (Màu Cam full khung) ── */}
                                                            {renderChapterCategory('Lý thuyết trọng tâm (Chương)')}

                                                            {/* ── 2. Bài học trong Chương (Màu Xanh biển full khung #6B7CDB / #EEF0FB) ── */}
                                                            <div style={{ borderBottom: '1px solid #F1F0EC', background: '#EEF0FB66' }}>
                                                                {/* Header nhóm Bài học */}
                                                                <div className="flex items-center justify-between px-5 py-2.5"
                                                                    style={{ borderBottom: chapterLessons.length > 0 ? '1px solid #6B7CDB22' : 'none' }}>
                                                                    <div className="flex items-center gap-2">
                                                                        <GraduationCap className="w-3.5 h-3.5 shrink-0" style={{ color: '#6B7CDB' }} />
                                                                        <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: '#6B7CDB' }}>
                                                                            Bài học trong chương
                                                                        </span>
                                                                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                                                                            style={{ background: '#EEF0FB', color: '#6B7CDB', border: '1px solid #6B7CDB33' }}>
                                                                            {chapterLessons.length}
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                {/* Danh sách từng Bài học */}
                                                                {chapterLessons.length === 0 ? (
                                                                    <div className="text-[11px] italic px-5 py-3" style={{ color: '#CFCFCB' }}>
                                                                        Chưa có bài học nào — dùng nút "Thêm bài" ở trên để thêm.
                                                                    </div>
                                                                ) : (
                                                                    chapterLessons.map(lesson => {
                                                                        const lessonFiles = storedFiles[lesson.id] || [];
                                                                        const isLessonExpanded = expandedLessons.has(lesson.id);
                                                                        const isUploading = uploadingTarget === lesson.id + '_' + uploadCategoryRef.current;

                                                                        // Phân nhóm file theo category (Natural Sort)
                                                                        const lCatFiles: Record<string, StoredFile[]> = {};
                                                                        let lUncategorized: StoredFile[] = [];
                                                                        LESSON_CATEGORIES.forEach(cat => lCatFiles[cat] = []);
                                                                        lessonFiles.forEach(f => {
                                                                            if (f.category && LESSON_CATEGORIES.includes(f.category)) lCatFiles[f.category].push(f);
                                                                            else lUncategorized.push(f);
                                                                        });
                                                                        LESSON_CATEGORIES.forEach(cat => {
                                                                            lCatFiles[cat] = naturalSort(lCatFiles[cat]);
                                                                        });
                                                                        lUncategorized = naturalSort(lUncategorized);

                                                                        return (
                                                                            <div key={lesson.id} style={{ borderBottom: '1px solid #F8F7F5' }}>
                                                                                {/* Lesson Row */}
                                                                                <div className="flex items-center gap-3 px-5 py-2.5 group" style={{ paddingLeft: '52px' }}>
                                                                                    <button onClick={() => toggleLesson(lesson.id)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                                                                                        <FileText className="w-3.5 h-3.5 shrink-0" style={{ color: '#AEACA8' }} />
                                                                                        <span className="text-sm font-medium truncate" style={{ color: '#1A1A1A' }}>{lesson.name}</span>
                                                                                    </button>

                                                                                    {/* Category Badges */}
                                                                                    <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                                                                                        {LESSON_CATEGORIES.map(cat => {
                                                                                            const cfg = CAT_CONFIG[cat];
                                                                                            const cnt = lCatFiles[cat].length;
                                                                                            return (
                                                                                                <span key={cat}
                                                                                                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap"
                                                                                                    style={{
                                                                                                        background: cnt > 0 ? cfg.bg : '#F1F0EC',
                                                                                                        color: cnt > 0 ? cfg.color : '#CFCFCB',
                                                                                                    }}>
                                                                                                    {cfg.short}: {cnt}
                                                                                                </span>
                                                                                            );
                                                                                        })}
                                                                                        {lUncategorized.length > 0 && (
                                                                                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-500">
                                                                                                ⚠{lUncategorized.length}
                                                                                            </span>
                                                                                        )}
                                                                                    </div>

                                                                                    {/* Actions */}
                                                                                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                        <button onClick={() => handleUploadTrigger(lesson.id)}
                                                                                            className="p-1.5 rounded-lg hover:bg-[#EEF0FB] text-gray-400 hover:text-[#6B7CDB] transition-colors"
                                                                                            title="Upload file">
                                                                                            {isUploading ? <Loader2 className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5" />}
                                                                                        </button>
                                                                                        <button onClick={() => handleDeleteLesson(lesson.id, lesson.name)}
                                                                                            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                                                                                            title="Xóa bài">
                                                                                            <Trash2 className="w-3.5 h-3.5" />
                                                                                        </button>
                                                                                        <button onClick={() => toggleLesson(lesson.id)}
                                                                                            className="p-1.5 rounded-lg transition-colors"
                                                                                            style={{ color: '#AEACA8' }}>
                                                                                            {isLessonExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                                                                        </button>
                                                                                    </div>
                                                                                    {/* Toggle mobile */}
                                                                                    <button onClick={() => toggleLesson(lesson.id)} className="p-1.5 rounded-lg md:hidden" style={{ color: '#AEACA8' }}>
                                                                                        {isLessonExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                                                                    </button>
                                                                                </div>

                                                                                {/* Expanded: Files grouped by category */}
                                                                                {isLessonExpanded && (
                                                                                    <div className="pb-3 space-y-2 animate-fade-in" style={{ paddingLeft: '52px', paddingRight: '16px' }}>
                                                                                        {LESSON_CATEGORIES.map(cat => {
                                                                                            const cfg = CAT_CONFIG[cat];
                                                                                            const catFiles = lCatFiles[cat];
                                                                                            return (
                                                                                                <div key={cat}>
                                                                                                    <div className="flex items-center gap-1.5 mb-1">
                                                                                                        <div className="w-2 h-2 rounded-full" style={{ background: cfg.color }} />
                                                                                                        <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: cfg.color }}>{cfg.short}</span>
                                                                                                        <span className="text-[10px]" style={{ color: '#AEACA8' }}>({catFiles.length})</span>
                                                                                                    </div>
                                                                                                    {catFiles.length === 0 ? (
                                                                                                        <div className="text-[11px] italic px-3 py-1.5 rounded" style={{ color: '#CFCFCB', background: '#FAFAF9' }}>
                                                                                                            Chưa có file — nhấn ↑ để upload
                                                                                                        </div>
                                                                                                    ) : (
                                                                                                        <div className="space-y-1">
                                                                                                            {catFiles.map(file => (
                                                                                                                <div key={file.id} className="flex items-center gap-2 text-[11px] px-2 py-1.5 rounded-lg group/f"
                                                                                                                    style={{ background: cfg.bg + '60', color: '#57564F' }}>
                                                                                                                    <FileText className="w-3 h-3 shrink-0" style={{ color: cfg.color }} />
                                                                                                                    <span className="flex-1 truncate">{file.name}</span>
                                                                                                                    <span className="text-[10px] shrink-0" style={{ color: '#AEACA8' }}>{(file.size / 1024 / 1024).toFixed(1)}MB</span>
                                                                                                                    <button onClick={() => handleDeleteFile(file.id, lesson.id, file.name)}
                                                                                                                        className="opacity-0 group-hover/f:opacity-100 p-0.5 hover:text-red-500 transition-all">
                                                                                                                        <Trash2 className="w-3 h-3" />
                                                                                                                    </button>
                                                                                                                </div>
                                                                                                            ))}
                                                                                                        </div>
                                                                                                    )}
                                                                                                </div>
                                                                                            );
                                                                                        })}
                                                                                        {lUncategorized.length > 0 && (
                                                                                            <div>
                                                                                                <div className="flex items-center gap-1.5 mb-1">
                                                                                                    <AlertTriangle className="w-2.5 h-2.5 text-amber-500" />
                                                                                                    <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-600">Chưa phân loại ({lUncategorized.length})</span>
                                                                                                </div>
                                                                                                {lUncategorized.map(file => (
                                                                                                    <div key={file.id} className="flex items-center gap-2 text-[11px] px-2 py-1.5 rounded-lg group/f bg-amber-50" style={{ color: '#57564F' }}>
                                                                                                        <FileText className="w-3 h-3 shrink-0 text-amber-400" />
                                                                                                        <span className="flex-1 truncate">{file.name}</span>
                                                                                                        <span className="text-[10px] shrink-0" style={{ color: '#AEACA8' }}>{(file.size / 1024 / 1024).toFixed(1)}MB</span>
                                                                                                        <button onClick={() => handleDeleteFile(file.id, lesson.id, file.name)}
                                                                                                            className="opacity-0 group-hover/f:opacity-100 p-0.5 hover:text-red-500 transition-all">
                                                                                                            <Trash2 className="w-3 h-3" />
                                                                                                        </button>
                                                                                                    </div>
                                                                                                ))}
                                                                                            </div>
                                                                                        )}
                                                                                        <button onClick={() => handleUploadTrigger(lesson.id)}
                                                                                            className="flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-lg transition-colors mt-1"
                                                                                            style={{ border: '1px dashed #6B7CDB66', color: '#6B7CDB', background: '#EEF0FB40' }}
                                                                                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#EEF0FB'}
                                                                                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#EEF0FB40'}>
                                                                                            <Upload className="w-3 h-3" />
                                                                                            Upload thêm file vào bài này
                                                                                        </button>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })
                                                                )}
                                                            </div>

                                                            {/* ── 3. Trắc nghiệm Đúng/Sai (Màu Xanh lá) ── */}
                                                            {renderChapterCategory('Trắc nghiệm Đúng/Sai (Chương)')}

                                                            {/* ── 4. Bài tập Tính toán Nâng cao (Màu Tím) ── */}
                                                            {renderChapterCategory('Bài tập Tính toán Nâng cao')}
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

            {/* ── Category Picker Modal (cho Bài học) ── */}
            {showCategoryModal && typeof document !== 'undefined' && createPortal(
                <div
                    className="fixed inset-0 select-none animate-fade-in flex items-center justify-center p-4"
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        width: '100vw',
                        height: '100vh',
                        zIndex: 99999,
                        backgroundColor: 'rgba(0, 0, 0, 0.45)',
                        backdropFilter: 'blur(5px)',
                        WebkitBackdropFilter: 'blur(5px)',
                    }}
                    onClick={() => setShowCategoryModal(false)}
                    onWheel={e => e.stopPropagation()}
                    onTouchMove={e => e.stopPropagation()}
                >
                    <div
                        className="w-full max-w-[440px] rounded-2xl overflow-hidden animate-fade-in"
                        style={{
                            background: '#FFFFFF',
                            border: '1px solid #E9E9E7',
                            boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(0,0,0,0.05)',
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #F1F0EC' }}>
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl" style={{ background: '#F3ECF8' }}>
                                    <Tag className="w-4 h-4" style={{ color: '#9065B0' }} />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold" style={{ color: '#1A1A1A' }}>Chọn loại tài liệu</h3>
                                    <p className="text-xs mt-0.5" style={{ color: '#787774' }}>File sẽ hiển thị trong tab tương ứng</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowCategoryModal(false)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-[#F1F0EC] transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Options List */}
                        <div className="p-5 space-y-2.5">
                            {LESSON_CATEGORIES.map(cat => {
                                const cfg = CAT_CONFIG[cat];
                                const isSelected = selectedUploadCategory === cat;
                                return (
                                    <button
                                        key={cat}
                                        onClick={() => setSelectedUploadCategory(cat)}
                                        className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-sm text-left transition-all cursor-pointer"
                                        style={{
                                            background: isSelected ? '#EEF0FB' : '#F7F6F3',
                                            border: `1.5px solid ${isSelected ? '#6B7CDB' : 'transparent'}`,
                                            color: isSelected ? '#3B49A2' : '#57564F',
                                            fontWeight: isSelected ? 600 : 500,
                                        }}
                                        onMouseEnter={e => {
                                            if (!isSelected) (e.currentTarget as HTMLElement).style.background = '#EFEFEA';
                                        }}
                                        onMouseLeave={e => {
                                            if (!isSelected) (e.currentTarget as HTMLElement).style.background = '#F7F6F3';
                                        }}
                                    >
                                        {/* Radio Circle */}
                                        <div
                                            className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center transition-all"
                                            style={{
                                                border: `2px solid ${isSelected ? '#4F5FBE' : '#CFCFCB'}`,
                                                background: '#FFFFFF',
                                            }}
                                        >
                                            {isSelected && (
                                                <div className="w-2 h-2 rounded-full" style={{ background: '#4F5FBE' }} />
                                            )}
                                        </div>
                                        <span className="flex-1">{cat}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Footer Action Button */}
                        <div className="px-5 pb-5">
                            <button
                                onClick={handleCategoryConfirm}
                                className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all active:scale-[0.98] shadow-sm hover:opacity-95"
                                style={{ background: color.accent }}
                            >
                                Chọn file →
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Hidden file input */}
            <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.pptx,.docx,.jpg,.png" multiple onChange={handleFileChange} />
        </div>
    );
};

export default AdminGitHubSync;
