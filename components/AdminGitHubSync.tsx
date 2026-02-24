
import React, { useState, useRef } from 'react';
import {
    CloudUpload, Send, CheckCircle2, Loader2, AlertCircle,
    GraduationCap, FileText, Trash2, Upload, RefreshCw,
    BookOpen, X, Download, MessageCircle
} from 'lucide-react';
import { useCloudStorage } from '../src/hooks/useCloudStorage';
import { CURRICULUM } from '../constants';
import { GradeLevel, Lesson, StoredFile } from '../types';

interface AdminGitHubSyncProps {
    onBack: () => void;
    onShowToast: (msg: string, type: 'success' | 'error' | 'warning') => void;
}

type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

const GRADE_COLORS: Record<number, { accent: string; bg: string; label: string }> = {
    12: { accent: '#6B7CDB', bg: '#EEF0FB', label: 'Vật Lý 12' },
    11: { accent: '#448361', bg: '#EAF3EE', label: 'Vật Lý 11' },
    10: { accent: '#D9730D', bg: '#FFF3E8', label: 'Vật Lý 10' },
};

const AdminGitHubSync: React.FC<AdminGitHubSyncProps> = ({ onBack, onShowToast }) => {
    const { lessons, storedFiles, uploadFiles, deleteFile, deleteLesson, addLesson, syncToGitHub, syncProgress } = useCloudStorage();
    const [selectedGrade, setSelectedGrade] = useState<number>(12);
    const [syncStatus, setSyncStatus] = useState<Record<number, SyncStatus>>({ 10: 'idle', 11: 'idle', 12: 'idle' });
    const [syncMsg, setSyncMsg] = useState<Record<number, string>>({});
    const [uploadingLesson, setUploadingLesson] = useState<string | null>(null);
    const [newLessonName, setNewLessonName] = useState('');
    const [newLessonChapter, setNewLessonChapter] = useState('');
    const [showAddLesson, setShowAddLesson] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadTargetLesson, setUploadTargetLesson] = useState<string | null>(null);

    const gradeData = CURRICULUM.find(g => g.level === selectedGrade);
    const gradeLessons = lessons.filter(l => {
        const chapterIds = gradeData?.chapters.map(c => c.id) || [];
        return chapterIds.includes(l.chapterId);
    });

    // Lấy toàn bộ files của các lessons thuộc grade
    const gradeFiles: Record<string, StoredFile[]> = {};
    gradeLessons.forEach(l => {
        if (storedFiles[l.id]) gradeFiles[l.id] = storedFiles[l.id];
    });

    const totalFiles = Object.values(gradeFiles).flat().length;
    const totalSize = Object.values(gradeFiles).flat().reduce((acc, f) => acc + f.size, 0);

    const handleSyncGrade = async (grade: number) => {
        const gData = CURRICULUM.find(g => g.level === grade);
        if (!gData) return;

        const gLessons = lessons.filter(l => gData.chapters.map(c => c.id).includes(l.chapterId));
        const gFiles: Record<string, StoredFile[]> = {};
        gLessons.forEach(l => { if (storedFiles[l.id]) gFiles[l.id] = storedFiles[l.id]; });

        if (gLessons.length === 0) {
            onShowToast(`Lớp ${grade} chưa có bài giảng nào để Sync!`, 'warning');
            return;
        }

        setSyncStatus(prev => ({ ...prev, [grade]: 'syncing' }));
        setSyncMsg(prev => ({ ...prev, [grade]: '' }));

        try {
            const fileId = await syncToGitHub(grade, gLessons, gFiles);
            const fileCount = Object.values(gFiles).flat().length;
            setSyncStatus(prev => ({ ...prev, [grade]: 'success' }));
            setSyncMsg(prev => ({ ...prev, [grade]: `✓ Đã lên Telegram (ID: ...${fileId.slice(-4)})` }));
            onShowToast(`Đã Sync Lớp ${grade} lên Telegram thành công!`, 'success');
            setTimeout(() => setSyncStatus(prev => ({ ...prev, [grade]: 'idle' })), 8000);
        } catch (err: any) {
            setSyncStatus(prev => ({ ...prev, [grade]: 'error' }));
            setSyncMsg(prev => ({ ...prev, [grade]: err.message }));
            onShowToast(`Lỗi Sync Lớp ${grade}: ${err.message}`, 'error');
        }
    };

    const handleUploadTrigger = (lessonId: string) => {
        setUploadTargetLesson(lessonId);
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []) as File[];
        if (!files.length || !uploadTargetLesson) return;
        setUploadingLesson(uploadTargetLesson);
        try {
            await uploadFiles(files, uploadTargetLesson, 'pdf');
            onShowToast(`Đã thêm ${files.length} file vào bài giảng!`, 'success');
        } catch {
            onShowToast('Lỗi khi thêm file', 'error');
        } finally {
            setUploadingLesson(null);
            setUploadTargetLesson(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleAddLesson = async () => {
        if (!newLessonName.trim() || !newLessonChapter) {
            onShowToast('Vui lòng nhập tên bài và chọn chương!', 'warning');
            return;
        }
        await addLesson(newLessonName.trim(), newLessonChapter);
        onShowToast(`Đã thêm bài giảng: ${newLessonName}`, 'success');
        setNewLessonName('');
        setNewLessonChapter('');
        setShowAddLesson(false);
    };

    const handleDeleteLesson = async (lessonId: string, name: string) => {
        if (!window.confirm(`Xóa bài giảng "${name}"? Hành động này không thể hoàn tác.`)) return;
        await deleteLesson(lessonId);
        onShowToast(`Đã xóa bài giảng: ${name}`, 'success');
    };

    const handleDeleteFile = async (fileId: string, lessonId: string, fileName: string) => {
        if (!window.confirm(`Xóa file "${fileName}"?`)) return;
        await deleteFile(fileId, lessonId);
        onShowToast('Đã xóa file', 'success');
    };

    const color = GRADE_COLORS[selectedGrade];

    return (
        <div className="fixed inset-0 z-[60] flex flex-col font-sans overflow-hidden animate-fade-in" style={{ background: '#F7F6F3' }}>

            {/* ── Top Nav ── */}
            <div className="flex items-center justify-between px-5 py-3.5" style={{ background: '#FFFFFF', borderBottom: '1px solid #E9E9E7' }}>
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: '#787774' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F1F0EC'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                    >
                        <X className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg" style={{ background: '#EEF0FB' }}>
                            <MessageCircle className="w-4 h-4" style={{ color: '#6B7CDB' }} />
                        </div>
                        <div>
                            <h1 className="text-base font-semibold" style={{ color: '#1A1A1A' }}>Telegram Cloud Sync</h1>
                            <p className="text-[10px] uppercase tracking-widest" style={{ color: '#AEACA8' }}>Lưu trữ & Phân phối bảo mật</p>
                        </div>
                    </div>
                </div>

                {/* Sync All Grades shortcut */}
                <div className="flex items-center gap-2">
                    {[10, 11, 12].map(grade => {
                        const st = syncStatus[grade];
                        const c = GRADE_COLORS[grade];
                        return (
                            <button
                                key={grade}
                                onClick={() => handleSyncGrade(grade)}
                                disabled={st === 'syncing'}
                                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors disabled:opacity-60"
                                style={{ background: st === 'success' ? '#EAF3EE' : c.bg, color: st === 'success' ? '#448361' : c.accent, border: `1px solid ${c.accent}22` }}
                                title={`Sync Lớp ${grade} lên Telegram`}
                            >
                                {st === 'syncing' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : st === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                                L{grade}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── Main content ── */}
            <div className="flex-1 overflow-y-auto p-5 lg:p-8 space-y-5 custom-scrollbar">

                {/* Grade Tabs */}
                <div className="flex gap-2 flex-wrap">
                    {[12, 11, 10].map(grade => {
                        const c = GRADE_COLORS[grade];
                        const gLessons = lessons.filter(l => {
                            const gd = CURRICULUM.find(g => g.level === grade);
                            return gd?.chapters.map(ch => ch.id).includes(l.chapterId);
                        });
                        const gFileCount = gLessons.reduce((sum, l) => sum + (storedFiles[l.id]?.length || 0), 0);
                        const isActive = selectedGrade === grade;

                        return (
                            <button
                                key={grade}
                                onClick={() => setSelectedGrade(grade)}
                                className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
                                style={{
                                    background: isActive ? c.accent : '#FFFFFF',
                                    color: isActive ? '#FFFFFF' : '#57564F',
                                    border: `1px solid ${isActive ? c.accent : '#E9E9E7'}`,
                                    boxShadow: isActive ? `0 2px 8px ${c.accent}30` : 'none',
                                }}
                            >
                                <GraduationCap className="w-4 h-4" />
                                Lớp {grade}
                                <span
                                    className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                                    style={{
                                        background: isActive ? 'rgba(255,255,255,0.2)' : c.bg,
                                        color: isActive ? '#FFFFFF' : c.accent,
                                    }}
                                >
                                    {gLessons.length} bài · {gFileCount} file
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Sync Card cho grade đang chọn */}
                <div
                    className="relative rounded-xl overflow-hidden"
                    style={{ background: '#FFFFFF', border: `1px solid ${color.accent}33`, borderLeft: `3px solid ${color.accent}` }}
                >
                    <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl" style={{ background: color.bg }}>
                                <CloudUpload className="w-5 h-5" style={{ color: color.accent }} />
                            </div>
                            <div>
                                <div className="font-semibold text-sm" style={{ color: '#1A1A1A' }}>
                                    Sync {color.label} lên Telegram
                                </div>
                                <div className="text-xs mt-0.5" style={{ color: '#787774' }}>
                                    {gradeLessons.length} bài giảng · {totalFiles} tài liệu ·
                                    <span className="font-medium ml-1" style={{ color: '#1A1A1A' }}>
                                        ~{(totalSize / 1024 / 1024).toFixed(1)}MB
                                    </span>
                                    {syncMsg[selectedGrade] && (
                                        <span className="ml-2 font-medium" style={{ color: syncStatus[selectedGrade] === 'success' ? '#448361' : '#E03E3E' }}>
                                            {syncMsg[selectedGrade]}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                                onClick={() => handleSyncGrade(selectedGrade)}
                                disabled={syncStatus[selectedGrade] === 'syncing'}
                                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-xl transition-all disabled:opacity-60 active:scale-[0.98]"
                                style={{ background: syncStatus[selectedGrade] === 'success' ? '#448361' : color.accent }}
                                onMouseEnter={e => syncStatus[selectedGrade] !== 'syncing' && ((e.currentTarget as HTMLElement).style.opacity = '0.9')}
                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
                            >
                                {syncStatus[selectedGrade] === 'syncing' ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" /> Đang Sync...</>
                                ) : syncStatus[selectedGrade] === 'success' ? (
                                    <><CheckCircle2 className="w-4 h-4" /> Đã Sync!</>
                                ) : syncStatus[selectedGrade] === 'error' ? (
                                    <><AlertCircle className="w-4 h-4" /> Thử lại</>
                                ) : (
                                    <><Send className="w-4 h-4" /> Sync lên Telegram</>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    {syncProgress > 0 && selectedGrade && syncStatus[selectedGrade] === 'syncing' && (
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-100">
                            <div
                                className="h-full transition-all duration-500 ease-out"
                                style={{
                                    width: `${syncProgress}%`,
                                    background: `linear-gradient(90deg, ${color.accent}88, ${color.accent})`
                                }}
                            />
                        </div>
                    )}
                </div>

                {/* Lesson List - Grouped by Chapter */}
                <div className="rounded-xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E9E9E7' }}>
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid #E9E9E7' }}>
                        <div className="flex items-center gap-2">
                            <BookOpen className="w-4 h-4" style={{ color: color.accent }} />
                            <h3 className="font-semibold text-sm" style={{ color: '#1A1A1A' }}>
                                Danh sách bài giảng — {color.label}
                            </h3>
                            <span
                                className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                                style={{ background: color.bg, color: color.accent }}
                            >
                                {gradeLessons.length}
                            </span>
                        </div>
                        <button
                            onClick={() => setShowAddLesson(!showAddLesson)}
                            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                            style={{
                                background: showAddLesson ? color.bg : '#F1F0EC',
                                color: showAddLesson ? color.accent : '#57564F',
                                border: '1px solid #E9E9E7',
                            }}
                        >
                            {showAddLesson ? <X className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5" />}
                            {showAddLesson ? 'Đóng' : 'Thêm bài giảng'}
                        </button>
                    </div>

                    {/* Add Lesson Form */}
                    {showAddLesson && (
                        <div className="px-5 py-4 space-y-3 animate-fade-in" style={{ borderBottom: '1px solid #E9E9E7', background: '#FAFAF9' }}>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <select
                                    value={newLessonChapter}
                                    onChange={e => setNewLessonChapter(e.target.value)}
                                    className="text-sm rounded-lg px-3 py-2.5 outline-none transition-all"
                                    style={{ background: '#FFFFFF', border: '1px solid #E9E9E7', color: '#1A1A1A' }}
                                    onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = color.accent}
                                    onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = '#E9E9E7'}
                                >
                                    <option value="">-- Chọn chương --</option>
                                    {gradeData?.chapters.map(ch => (
                                        <option key={ch.id} value={ch.id}>{ch.name}</option>
                                    ))}
                                </select>
                                <input
                                    type="text"
                                    value={newLessonName}
                                    onChange={e => setNewLessonName(e.target.value)}
                                    placeholder="Tên bài giảng..."
                                    className="md:col-span-1 text-sm rounded-lg px-3 py-2.5 outline-none"
                                    style={{ background: '#FFFFFF', border: '1px solid #E9E9E7', color: '#1A1A1A' }}
                                    onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = color.accent}
                                    onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = '#E9E9E7'}
                                    onKeyDown={e => e.key === 'Enter' && handleAddLesson()}
                                />
                                <button
                                    onClick={handleAddLesson}
                                    className="text-sm font-semibold text-white rounded-lg px-4 py-2.5 transition-colors active:scale-[0.98]"
                                    style={{ background: color.accent }}
                                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.9'}
                                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
                                >
                                    ＋ Tạo bài giảng
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Chapters & Lessons */}
                    <div className="divide-y p-5 space-y-8" style={{ borderColor: '#F1F0EC' }}>
                        {gradeLessons.length === 0 ? (
                            <div className="py-12 text-center">
                                <BookOpen className="w-10 h-10 mx-auto mb-3" style={{ color: '#CFCFCB' }} />
                                <p className="text-sm font-medium" style={{ color: '#787774' }}>Chưa có bài giảng nào</p>
                                <p className="text-xs mt-1" style={{ color: '#AEACA8' }}>Nhấn "Thêm bài giảng" để bắt đầu</p>
                            </div>
                        ) : (
                            gradeData?.chapters.map(chapter => {
                                const chapterLessons = gradeLessons
                                    .filter(l => l.chapterId === chapter.id)
                                    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
                                if (chapterLessons.length === 0) return null;

                                return (
                                    <div key={chapter.id} className="space-y-4">
                                        <div className="flex items-center gap-3 pb-2 border-b" style={{ borderColor: '#F1F0EC' }}>
                                            <div className="p-1.5 rounded-lg" style={{ background: color.bg }}>
                                                <BookOpen className="w-4 h-4" style={{ color: color.accent }} />
                                            </div>
                                            <div>
                                                <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: '#1A1A1A' }}>
                                                    {chapter.name}
                                                </h2>
                                                <p className="text-[10px]" style={{ color: '#AEACA8' }}>
                                                    {chapterLessons.length} bài giảng
                                                </p>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            {chapterLessons.map(lesson => {
                                                const lessonFiles = storedFiles[lesson.id] || [];
                                                const isUploading = uploadingLesson === lesson.id;
                                                return (
                                                    <div key={lesson.id} className="bg-white rounded-xl p-4 border border-[#F1F0EC] hover:border-[#E9E9E7] transition-all group">
                                                        <div className="flex items-start justify-between gap-4">
                                                            <div className="flex-1 min-w-0">
                                                                <h3 className="font-semibold text-sm mb-1" style={{ color: '#1A1A1A' }}>{lesson.name}</h3>
                                                                <div className="space-y-1.5">
                                                                    {lessonFiles.map(file => (
                                                                        <div key={file.id} className="flex items-center gap-2 text-[11px] p-1.5 rounded-lg bg-[#F8F9FB]" style={{ color: '#787774' }}>
                                                                            <FileText className="w-3.5 h-3.5 text-gray-400" />
                                                                            <span className="flex-1 truncate">{file.name}</span>
                                                                            <span className="text-[9px] text-[#AEACA8]">{(file.size / 1024 / 1024).toFixed(1)}MB</span>
                                                                            <button
                                                                                onClick={() => handleDeleteFile(file.id, lesson.id, file.name)}
                                                                                className="p-1 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                            >
                                                                                <Trash2 className="w-3 h-3" />
                                                                            </button>
                                                                        </div>
                                                                    ))}
                                                                    {lessonFiles.length === 0 && (
                                                                        <span className="text-[10px] italic text-[#AEACA8]">Chưa có tài liệu</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-1.5">
                                                                <button
                                                                    onClick={() => handleUploadTrigger(lesson.id)}
                                                                    className="p-2 rounded-lg hover:bg-[#EEF0FB] text-gray-400 hover:text-[#6B7CDB] transition-colors"
                                                                >
                                                                    {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteLesson(lesson.id, lesson.name)}
                                                                    className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Help / Info */}
                <div
                    className="rounded-xl p-4 space-y-3"
                    style={{ background: '#FFFFFF', border: '1px solid #E9E9E7' }}
                >
                    <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#AEACA8' }}>
                        Hướng dẫn sử dụng
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {[
                            {
                                step: '①',
                                title: 'Thêm bài giảng',
                                desc: 'Chọn chương, nhập tên bài giảng, nhấn tạo. Sau đó upload PDF vào từng bài.',
                                color: '#6B7CDB',
                                bg: '#EEF0FB',
                            },
                            {
                                step: '②',
                                title: 'Upload PDF',
                                desc: 'Nhấn icon ↑ bên cạnh mỗi bài để đính kèm file PDF. Hệ thống lưu tạm trên máy.',
                                color: '#D9730D',
                                bg: '#FFF3E8',
                            },
                            {
                                step: '③',
                                title: 'Sync lên Telegram',
                                desc: 'Nhấn "Sync lên Telegram" để đẩy toàn bộ bài giảng khối đó lên kho chứa. Học sinh sẽ tự động nhận diện và cập nhật.',
                                color: '#448361',
                                bg: '#EAF3EE',
                            },
                        ].map(item => (
                            <div key={item.step} className="flex gap-3" style={{ padding: '12px', background: item.bg, borderRadius: '10px' }}>
                                <span className="text-lg font-bold shrink-0" style={{ color: item.color }}>{item.step}</span>
                                <div>
                                    <p className="text-xs font-semibold" style={{ color: item.color }}>{item.title}</p>
                                    <p className="text-xs mt-1 leading-relaxed" style={{ color: '#57564F' }}>{item.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Hidden file input */}
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".pdf,.pptx,.docx,.jpg,.png"
                multiple
                onChange={handleFileChange}
            />
        </div>
    );
};

export default AdminGitHubSync;
