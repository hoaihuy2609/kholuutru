
import React, { useState, useRef, useMemo } from 'react';
import {
    CloudUpload, Send, CheckCircle2, RefreshCw, AlertCircle,
    FileText, Trash2, Upload,
    BookOpen, X, MessageCircle, Tag, ChevronDown, ChevronRight,
    BarChart3, AlertTriangle
} from 'lucide-react';

const Loader2 = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
    <RefreshCw className={`${className} animate-spin`} style={style} />
);

import { CURRICULUM } from '../constants';
import { Lesson, StoredFile, FileStorage } from '../types';

const LESSON_CATEGORIES = [
    'Trắc nghiệm Lý thuyết (ABCD)',
    'Trắc nghiệm Lý thuyết (Đúng/Sai)',
    'Bài tập Tính toán Cơ bản',
];

const CAT_CONFIG: Record<string, { short: string; color: string; bg: string }> = {
    'Trắc nghiệm Lý thuyết (ABCD)': { short: 'TN ABCD', color: '#6B7CDB', bg: '#EEF0FB' },
    'Trắc nghiệm Lý thuyết (Đúng/Sai)': { short: 'Đúng/Sai', color: '#9B72CB', bg: '#F3EEF9' },
    'Bài tập Tính toán Cơ bản': { short: 'Tính toán', color: '#D9730D', bg: '#FFF3E8' },
};

interface AdminGitHubSyncProps {
    onBack: () => void;
    onShowToast: (msg: string, type: 'success' | 'error' | 'warning') => void;
    lessons: Lesson[];
    storedFiles: FileStorage;
    onAddLesson: (name: string, chapterId: string) => Promise<void>;
    onDeleteLesson: (id: string) => Promise<void>;
    onUploadFiles: (files: File[], targetId: string, category?: string) => Promise<void>;
    onDeleteFile: (fileId: string, targetId: string) => Promise<void>;
    onSyncToGitHub: (grade: number, lessons: Lesson[], files: FileStorage) => Promise<string>;
    syncProgress: number;
}

type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

const GRADE_COLORS: Record<number, { accent: string; bg: string; label: string }> = {
    12: { accent: '#6B7CDB', bg: '#EEF0FB', label: 'Vật Lý 12' },
    11: { accent: '#448361', bg: '#EAF3EE', label: 'Vật Lý 11' },
    10: { accent: '#D9730D', bg: '#FFF3E8', label: 'Vật Lý 10' },
};

const AdminGitHubSync: React.FC<AdminGitHubSyncProps> = ({
    onBack, onShowToast, lessons, storedFiles,
    onAddLesson, onDeleteLesson, onUploadFiles, onDeleteFile, onSyncToGitHub, syncProgress
}) => {
    const [selectedGrade, setSelectedGrade] = useState<number>(12);
    const [syncStatus, setSyncStatus] = useState<Record<number, SyncStatus>>({ 10: 'idle', 11: 'idle', 12: 'idle' });
    const [syncMsg, setSyncMsg] = useState<Record<number, string>>({});
    const [uploadingLesson, setUploadingLesson] = useState<string | null>(null);
    const [newLessonName, setNewLessonName] = useState('');
    const [newLessonChapter, setNewLessonChapter] = useState('');
    const [showAddLesson, setShowAddLesson] = useState(false);
    const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
    const [expandedLessons, setExpandedLessons] = useState<Set<string>>(new Set());
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [selectedUploadCategory, setSelectedUploadCategory] = useState<string>(LESSON_CATEGORIES[0]);
    const [pendingUploadLessonId, setPendingUploadLessonId] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const uploadTargetRef = useRef<string | null>(null);
    const uploadCategoryRef = useRef<string>(LESSON_CATEGORIES[0]);

    const color = GRADE_COLORS[selectedGrade];
    const gradeData = CURRICULUM.find(g => g.level === selectedGrade);
    const gradeLessons = lessons.filter(l => gradeData?.chapters.map(c => c.id).includes(l.chapterId));

    // Tổng hợp số file theo category cho toàn grade (cả file cấp bài và cấp chương)
    const categorySummary = useMemo(() => {
        const counts: Record<string, number> = {};
        let uncategorized = 0;
        LESSON_CATEGORIES.forEach(cat => counts[cat] = 0);
        // File cấp bài giảng
        gradeLessons.forEach(l => {
            (storedFiles[l.id] || []).forEach(f => {
                if (f.category && LESSON_CATEGORIES.includes(f.category)) counts[f.category]++;
                else uncategorized++;
            });
        });
        // File cấp chương
        gradeData?.chapters.forEach(ch => {
            (storedFiles[ch.id] || []).forEach(f => {
                if (f.category && LESSON_CATEGORIES.includes(f.category)) counts[f.category]++;
                else uncategorized++;
            });
        });
        return { counts, uncategorized };
    }, [gradeLessons, gradeData, storedFiles]);

    const gradeFiles: FileStorage = {};
    gradeLessons.forEach(l => { if (storedFiles[l.id]) gradeFiles[l.id] = storedFiles[l.id]; });
    // ✅ Bao gồm file cấp chương trong tổng count
    gradeData?.chapters.forEach(ch => { if (storedFiles[ch.id]?.length) gradeFiles[ch.id] = storedFiles[ch.id]; });
    const totalFiles = Object.values(gradeFiles).flat().length;
    const totalSize = Object.values(gradeFiles).flat().reduce((acc, f) => acc + f.size, 0);

    const handleSyncGrade = async (grade: number) => {
        const gData = CURRICULUM.find(g => g.level === grade);
        if (!gData) return;
        const gLessons = lessons.filter(l => gData.chapters.map(c => c.id).includes(l.chapterId));
        const gFiles: FileStorage = {};
        // Bao gồm file cấp bài giảng
        gLessons.forEach(l => { if (storedFiles[l.id]) gFiles[l.id] = storedFiles[l.id]; });
        // ✅ Bao gồm file cấp chương (storedFiles[chapterId]) — trước đây bị bỏ sót!
        gData.chapters.forEach(ch => { if (storedFiles[ch.id]?.length) gFiles[ch.id] = storedFiles[ch.id]; });
        if (gLessons.length === 0) { onShowToast(`Lớp ${grade} chưa có bài giảng nào!`, 'warning'); return; }
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

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []) as File[];
        const targetId = uploadTargetRef.current;
        const category = uploadCategoryRef.current;
        if (!files.length || !targetId) return;
        setUploadingLesson(targetId);
        try {
            await onUploadFiles(files, targetId, category);
            onShowToast(`Đã thêm ${files.length} file vào "${category}"!`, 'success');
            setExpandedLessons(prev => new Set([...prev, targetId]));
        } catch { onShowToast('Lỗi khi thêm file', 'error'); }
        finally {
            setUploadingLesson(null);
            uploadTargetRef.current = null;
            setPendingUploadLessonId(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleAddLesson = async () => {
        if (!newLessonName.trim() || !newLessonChapter) { onShowToast('Vui lòng nhập tên bài và chọn chương!', 'warning'); return; }
        await onAddLesson(newLessonName.trim(), newLessonChapter);
        onShowToast(`Đã thêm: ${newLessonName}`, 'success');
        setNewLessonName(''); setNewLessonChapter(''); setShowAddLesson(false);
    };

    const handleDeleteLesson = async (lessonId: string, name: string) => {
        if (!window.confirm(`Xóa bài giảng "${name}"?`)) return;
        await onDeleteLesson(lessonId);
        onShowToast(`Đã xóa: ${name}`, 'success');
    };

    const handleDeleteFile = async (fileId: string, lessonId: string, fileName: string) => {
        if (!window.confirm(`Xóa file "${fileName}"?`)) return;
        await onDeleteFile(fileId, lessonId);
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
        <div className="fixed inset-0 z-[60] flex flex-col font-sans overflow-hidden animate-fade-in" style={{ background: '#F7F6F3' }}>

            {/* ── Top Nav ── */}
            <div className="flex items-center justify-between px-5 py-3" style={{ background: '#FFFFFF', borderBottom: '1px solid #E9E9E7' }}>
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-1.5 rounded-lg transition-colors" style={{ color: '#787774' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F1F0EC'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                        <X className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg" style={{ background: '#EEF0FB' }}>
                            <MessageCircle className="w-4 h-4" style={{ color: '#6B7CDB' }} />
                        </div>
                        <div>
                            <h1 className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>Telegram Cloud Sync</h1>
                            <p className="text-[10px] uppercase tracking-widest" style={{ color: '#AEACA8' }}>Quản lý & Phân phối tài liệu</p>
                        </div>
                    </div>
                </div>

            </div>

            {/* ── Main ── */}
            <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4 custom-scrollbar">

                {/* Grade Tabs — Notion style, consistent với Sidebar */}
                <div className="flex items-center gap-0.5 p-1 rounded-lg" style={{ background: '#EBEBEA', width: 'fit-content' }}>
                    {([12, 11, 10] as const).map(grade => {
                        const c = GRADE_COLORS[grade];
                        const gLessons = lessons.filter(l => CURRICULUM.find(g => g.level === grade)?.chapters.map(ch => ch.id).includes(l.chapterId));
                        const gFileCount = gLessons.reduce((s, l) => s + (storedFiles[l.id]?.length || 0), 0);
                        const isActive = selectedGrade === grade;
                        return (
                            <button key={grade} onClick={() => setSelectedGrade(grade)}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors"
                                style={{
                                    background: isActive ? '#FFFFFF' : 'transparent',
                                    color: isActive ? '#1A1A1A' : '#787774',
                                    fontWeight: isActive ? 500 : 400,
                                    boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                                }}
                                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.04)'; }}
                                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                            >
                                {/* Dot màu đặc trưng của lớp */}
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.accent, opacity: isActive ? 1 : 0.4 }} />
                                Lớp {grade}
                                {isActive && (
                                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: '#F1F0EC', color: '#787774' }}>
                                        {gLessons.length}b · {gFileCount}f
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Category Summary Bar */}
                <div className="rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-3"
                    style={{ background: '#FFFFFF', border: '1px solid #E9E9E7' }}>
                    <div className="flex items-center gap-1.5 col-span-2 md:col-span-1">
                        <BarChart3 className="w-4 h-4 shrink-0" style={{ color: '#AEACA8' }} />
                        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#AEACA8' }}>Phân loại tài liệu</span>
                    </div>
                    {LESSON_CATEGORIES.map(cat => {
                        const cfg = CAT_CONFIG[cat];
                        const count = categorySummary.counts[cat] || 0;
                        return (
                            <div key={cat} className="flex items-center gap-2 px-3 py-2 rounded-lg"
                                style={{ background: cfg.bg }}>
                                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: cfg.color }} />
                                <div>
                                    <div className="text-[10px] font-medium leading-tight" style={{ color: cfg.color }}>{cfg.short}</div>
                                    <div className="text-base font-bold leading-tight" style={{ color: '#1A1A1A' }}>{count}</div>
                                </div>
                            </div>
                        );
                    })}
                    {categorySummary.uncategorized > 0 && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: '#FEF3C7' }}>
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                            <div>
                                <div className="text-[10px] font-medium text-amber-600">Chưa phân loại</div>
                                <div className="text-base font-bold" style={{ color: '#1A1A1A' }}>{categorySummary.uncategorized}</div>
                            </div>
                        </div>
                    )}
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

                    {/* Progress Bar — chỉ hiện khi đang sync */}
                    {syncStatus[selectedGrade] === 'syncing' && (
                        <div className="px-4 pb-4">
                            {/* Track */}
                            <div className="relative h-2 rounded-full overflow-hidden" style={{ background: '#F1F0EC' }}>
                                {/* Fill */}
                                <div
                                    className="absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out"
                                    style={{
                                        width: `${syncProgress || 2}%`,
                                        background: `linear-gradient(90deg, ${color.accent}BB, ${color.accent})`,
                                    }}
                                />
                                {/* Shimmer sweep — chạy liên tục qua phần fill */}
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
                            {/* Labels */}
                            <div className="flex items-center justify-between mt-1.5">
                                <span className="text-[11px]" style={{ color: '#AEACA8' }}>
                                    Đang tải lên Telegram…
                                </span>
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
                            <button onClick={expandAll} className="text-[11px] px-2 py-1 rounded transition-colors" style={{ color: '#787774' }}
                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F1F0EC'}
                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>Mở tất cả</button>
                            <button onClick={collapseAll} className="text-[11px] px-2 py-1 rounded transition-colors" style={{ color: '#787774' }}
                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F1F0EC'}
                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>Thu gọn</button>
                            <button onClick={() => setShowAddLesson(!showAddLesson)}
                                className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                                style={{ background: showAddLesson ? color.bg : '#F1F0EC', color: showAddLesson ? color.accent : '#57564F', border: '1px solid #E9E9E7' }}>
                                {showAddLesson ? <X className="w-3 h-3" /> : <Upload className="w-3 h-3" />}
                                {showAddLesson ? 'Đóng' : 'Thêm bài'}
                            </button>
                        </div>
                    </div>

                    {/* Add Lesson Form */}
                    {showAddLesson && (
                        <div className="px-5 py-3 grid grid-cols-1 md:grid-cols-3 gap-2 animate-fade-in" style={{ borderBottom: '1px solid #E9E9E7', background: '#FAFAF9' }}>
                            <select value={newLessonChapter} onChange={e => setNewLessonChapter(e.target.value)}
                                className="text-sm rounded-lg px-3 py-2 outline-none" style={{ background: '#FFFFFF', border: '1px solid #E9E9E7', color: '#1A1A1A' }}>
                                <option value="">-- Chọn chương --</option>
                                {gradeData?.chapters.map(ch => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
                            </select>
                            <input value={newLessonName} onChange={e => setNewLessonName(e.target.value)}
                                placeholder="Tên bài giảng..." onKeyDown={e => e.key === 'Enter' && handleAddLesson()}
                                className="text-sm rounded-lg px-3 py-2 outline-none" style={{ background: '#FFFFFF', border: '1px solid #E9E9E7', color: '#1A1A1A' }} />
                            <button onClick={handleAddLesson} className="text-sm font-semibold text-white rounded-lg px-4 py-2 transition-colors active:scale-[0.98]"
                                style={{ background: color.accent }}>＋ Tạo bài giảng</button>
                        </div>
                    )}

                    {/* Chapters */}
                    {gradeLessons.length === 0 ? (
                        <div className="py-12 text-center">
                            <BookOpen className="w-10 h-10 mx-auto mb-3" style={{ color: '#CFCFCB' }} />
                            <p className="text-sm font-medium" style={{ color: '#787774' }}>Chưa có bài giảng nào</p>
                        </div>
                    ) : (
                        <div>
                            {gradeData?.chapters.map(chapter => {
                                const chapterLessons = gradeLessons.filter(l => l.chapterId === chapter.id)
                                    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
                                if (chapterLessons.length === 0) return null;
                                const isExpanded = expandedChapters.has(chapter.id);
                                const chFileCount = chapterLessons.reduce((s, l) => s + (storedFiles[l.id]?.length || 0), 0);

                                // Category counts for chapter
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
                                        {/* Chapter Header - Clickable */}
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
                                            <div className="text-gray-400 shrink-0 ml-2">
                                                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                            </div>
                                        </div>

                                        {/* Lesson Rows */}
                                        {isExpanded && (
                                            <div style={{ borderTop: '1px solid #F1F0EC' }}>
                                                {chapterLessons.map(lesson => {
                                                    const lessonFiles = storedFiles[lesson.id] || [];
                                                    const isLessonExpanded = expandedLessons.has(lesson.id);
                                                    const isUploading = uploadingLesson === lesson.id;

                                                    // Count by category
                                                    const lCatFiles: Record<string, StoredFile[]> = {};
                                                    let lUncategorized: StoredFile[] = [];
                                                    LESSON_CATEGORIES.forEach(cat => lCatFiles[cat] = []);
                                                    lessonFiles.forEach(f => {
                                                        if (f.category && LESSON_CATEGORIES.includes(f.category)) lCatFiles[f.category].push(f);
                                                        else lUncategorized.push(f);
                                                    });

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
                                                                {/* Show expand toggle always on mobile */}
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
                                                                        style={{ border: `1px dashed ${color.accent}66`, color: color.accent, background: color.bg + '40' }}
                                                                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = color.bg}
                                                                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = color.bg + '40'}>
                                                                        <Upload className="w-3 h-3" />
                                                                        Upload thêm file vào bài này
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Category Picker Modal ── */}
            {showCategoryModal && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4"
                    style={{ background: 'rgba(26,26,26,0.5)' }}
                    onClick={() => setShowCategoryModal(false)}>
                    <div className="w-full max-w-sm rounded-2xl overflow-hidden animate-fade-in"
                        style={{ background: '#FFFFFF', border: '1px solid #E9E9E7', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}
                        onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #E9E9E7' }}>
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg" style={{ background: color.bg }}>
                                    <Tag className="w-4 h-4" style={{ color: color.accent }} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>Chọn loại tài liệu</h3>
                                    <p className="text-[10px]" style={{ color: '#AEACA8' }}>File sẽ hiển thị trong tab tương ứng</p>
                                </div>
                            </div>
                            <button onClick={() => setShowCategoryModal(false)} className="p-1.5 rounded-lg transition-colors"
                                style={{ color: '#787774' }}
                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F1F0EC'}
                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-4 space-y-2">
                            {LESSON_CATEGORIES.map(cat => {
                                const cfg = CAT_CONFIG[cat];
                                const isSelected = selectedUploadCategory === cat;
                                return (
                                    <button key={cat} onClick={() => setSelectedUploadCategory(cat)}
                                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-left transition-all"
                                        style={{ background: isSelected ? cfg.bg : '#F7F6F3', border: `1.5px solid ${isSelected ? cfg.color : 'transparent'}`, color: isSelected ? cfg.color : '#57564F', fontWeight: isSelected ? 600 : 400 }}>
                                        <div className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center"
                                            style={{ border: `2px solid ${isSelected ? cfg.color : '#CFCFCB'}`, background: isSelected ? cfg.color : 'transparent' }}>
                                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                        </div>
                                        {cat}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="px-4 pb-4">
                            <button onClick={handleCategoryConfirm}
                                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all active:scale-[0.98]"
                                style={{ background: color.accent }}>
                                Chọn file →
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Hidden file input */}
            <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.pptx,.docx,.jpg,.png" multiple onChange={handleFileChange} />
        </div>
    );
};

export default AdminGitHubSync;
