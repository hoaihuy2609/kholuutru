import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, Upload, FileText, Clock, ChevronLeft, ChevronRight, Save, X, Check, RefreshCw, ClipboardList, Flag, User, AlertCircle, Edit, Lock } from 'lucide-react';
import { Exam, ExamAnswers, ExamTFAnswer } from '../types';
import { useCloudStorage } from '../src/hooks/useCloudStorage';
import { getAllExamTopVotes } from '../src/services/notificationService';
import { supabase } from '../src/lib/supabase';

const Loader2 = ({ className, style }: { className?: string, style?: React.CSSProperties }) => (
    <RefreshCw className={`${className} animate-spin`} style={style} />
);

interface ExamManagerProps {
    onShowToast: (msg: string, type: 'success' | 'error' | 'warning') => void;
    onUploadExamPdf: (file: File, onProgress: (pct: number) => void) => Promise<{ fileId: string; fileName: string }>;
    onSaveExam: (exams: Exam[]) => Promise<void>;
    onDeleteExam: (examId: string, allExams: Exam[]) => Promise<void>;
    onLoadExams: () => Promise<Exam[]>;
}

// ── Helpers ────────────────────────────────────────────────────────
const emptyAnswers = (): ExamAnswers => ({
    mc: Array(18).fill(''),
    tf: Array(4).fill(null).map(() => ({ a: '', b: '', c: '', d: '' })),
    sa: Array(6).fill(''),
});

const ACCENT = '#6B7CDB';

// ── Step Indicator ─────────────────────────────────────────────────
const StepDot = ({ n, current, label }: { n: number; current: number; label: string }) => (
    <div className="flex flex-col items-center gap-1">
        <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all"
            style={{
                background: current >= n ? ACCENT : '#E9E9E7',
                color: current >= n ? '#fff' : '#AEACA8',
            }}
        >
            {current > n ? <Check className="w-4 h-4" /> : n}
        </div>
        <span className="text-[10px] font-medium" style={{ color: current >= n ? ACCENT : '#AEACA8' }}>{label}</span>
    </div>
);

// ── Main Component ─────────────────────────────────────────────────
const ExamManager: React.FC<ExamManagerProps> = ({
    onShowToast, onUploadExamPdf, onSaveExam, onDeleteExam, onLoadExams
}) => {
    const [activeTab, setActiveTab] = useState<number>(12);
    const [exams, setExams] = useState<Exam[]>([]);
    const [loadingExams, setLoadingExams] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingExam, setEditingExam] = useState<Exam | null>(null);
    const [viewingVotes, setViewingVotes] = useState<Exam | null>(null);
    const [topVotes, setTopVotes] = useState<Record<string, { part: string; num: number; count: number }[]>>({});

    // Load exams on mount
    useEffect(() => {
        onLoadExams().then(data => { setExams(data); setLoadingExams(false); }).catch(() => setLoadingExams(false));
    }, [onLoadExams]);

    // Tải votes sau khi exams đã load xong (1 lần duy nhất)
    useEffect(() => {
        if (!loadingExams) {
            getAllExamTopVotes().then(data => setTopVotes(data));
        }
    }, [loadingExams]);

    const handleDeleteExam = async (examId: string, title: string) => {
        if (!window.confirm(`Xóa đề thi "${title}"?`)) return;
        try {
            await onDeleteExam(examId, exams);
            setExams(prev => prev.filter(e => e.id !== examId));
            onShowToast('Đã xóa đề thi', 'success');
        } catch { onShowToast('Lỗi khi xóa đề thi', 'error'); }
    };

    const handleSaved = (exam: Exam) => {
        setExams(prev => {
            const updated = [...prev.filter(e => e.id !== exam.id), exam]
                .sort((a, b) => b.createdAt - a.createdAt);
            return updated;
        });
        setShowCreateModal(false);
        onShowToast('Đã lưu đề thi thành công!', 'success');
    };

    const handleEdited = (exam: Exam) => {
        setExams(prev => prev.map(e => e.id === exam.id ? exam : e));
        setEditingExam(null);
        onShowToast('Đã cập nhật đề thi thành công!', 'success');
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold" style={{ color: '#1A1A1A' }}>Quản lý Đề Thi Thử</h2>
                    <p className="text-sm" style={{ color: '#787774' }}>Tạo và quản lý đề thi theo cấu trúc THPT 2025</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all active:scale-95"
                    style={{ background: ACCENT, color: '#fff' }}
                >
                    <Plus className="w-4 h-4" />
                    Tạo đề mới
                </button>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-2 border-b" style={{ borderColor: '#E9E9E7' }}>
                {[12, 11, 10].map(grade => (
                    <button
                        key={grade}
                        onClick={() => setActiveTab(grade)}
                        className={`px-5 py-3 text-sm font-semibold transition-colors border-b-2`}
                        style={{
                            color: activeTab === grade ? ACCENT : '#787774',
                            borderColor: activeTab === grade ? ACCENT : 'transparent',
                            marginBottom: '-1px'
                        }}
                    >
                        Lớp {grade}
                    </button>
                ))}
            </div>

            {/* Exam List */}
            {loadingExams ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6" style={{ color: ACCENT } as any} />
                    <span className="ml-2 text-sm" style={{ color: '#787774' }}>Đang tải...</span>
                </div>
            ) : (() => {
                const filteredExams = exams.filter(e => (!e.grade && activeTab === 12) || e.grade === activeTab);

                if (filteredExams.length === 0) {
                    return (
                        <div className="text-center py-16 rounded-xl" style={{ border: '2px dashed #E9E9E7' }}>
                            <ClipboardList className="w-10 h-10 mx-auto mb-3" style={{ color: '#CFCFCB' }} />
                            <p className="text-sm font-medium" style={{ color: '#787774' }}>Chưa có đề thi nào cho Lớp {activeTab}</p>
                            <p className="text-xs mt-1" style={{ color: '#AEACA8' }}>Bấm "Tạo đề mới" để bắt đầu</p>
                        </div>
                    );
                }

                return (
                    <div className="grid gap-3">
                        {filteredExams.map(exam => (
                            <div
                                key={exam.id}
                                className="rounded-xl p-4 flex items-center justify-between gap-4 transition-shadow"
                                style={{ background: '#fff', border: '1px solid #E9E9E7' }}
                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.07)'}
                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = 'none'}
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#EEF0FB' }}>
                                        <FileText className="w-5 h-5" style={{ color: ACCENT }} />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-3">
                                            <p className="font-semibold text-sm truncate" style={{ color: '#1A1A1A' }}>{exam.title}</p>
                                        </div>
                                        <div className="flex items-center gap-3 mt-0.5">
                                            <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: ACCENT, background: '#EEF0FB', padding: '2px 6px', borderRadius: '4px' }}>
                                                Lớp {exam.grade || 12}
                                            </span>
                                            {exam.category === 'chapter' ? (
                                                <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: '#1A1A1A', background: '#E9E9E7', padding: '2px 6px', borderRadius: '4px' }}>
                                                    Ôn theo Chương
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: '#D9730D', background: '#FFF7ED', padding: '2px 6px', borderRadius: '4px' }}>
                                                    Đề Trường / Sở
                                                </span>
                                            )}
                                            <span className="flex items-center gap-1 text-xs" style={{ color: '#AEACA8' }}>
                                                <Clock className="w-3 h-3" />{exam.duration}'
                                            </span>
                                            <span className="text-xs" style={{ color: '#AEACA8' }}>
                                                {new Date(exam.createdAt).toLocaleDateString('vi-VN')}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {topVotes[exam.id] && topVotes[exam.id].length > 0 && (
                                        <button 
                                            onClick={() => setViewingVotes(exam)}
                                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all hover:-translate-y-0.5"
                                            style={{ background: '#FEF2F2', borderColor: '#FECACA', color: '#DC2626' }}
                                            title="Xem toàn bộ báo cáo của đề thi này"
                                        >
                                            <span className="flex items-center gap-1">
                                                <AlertCircle className="w-4 h-4" />
                                                {topVotes[exam.id][0].count} vote
                                            </span>
                                            <span style={{ color: '#EF4444', fontStyle: 'italic', fontWeight: 500 }}>
                                                ({topVotes[exam.id][0].part} — Câu {topVotes[exam.id][0].num})
                                            </span>
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setEditingExam(exam)}
                                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all hover:-translate-y-0.5"
                                        style={{ background: '#F1F5F9', borderColor: '#E2E8F0', color: '#475569' }}
                                        title="Sửa đáp án hoặc thông tin đề thi"
                                    >
                                        <Edit className="w-4 h-4" /> Sửa
                                    </button>
                                    <span className="text-xs px-2 py-1.5 rounded-lg font-semibold" style={{ background: '#F0FDF4', color: '#16A34A', border: '1.5px solid #86EFAC' }}>
                                        ✓ Có đáp án
                                    </span>
                                    <button
                                        onClick={() => handleDeleteExam(exam.id, exam.title)}
                                        className="p-2 rounded-lg transition-colors"
                                        style={{ color: '#AEACA8' }}
                                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#FEF2F2'; (e.currentTarget as HTMLElement).style.color = '#E03E3E'; }}
                                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#AEACA8'; }}
                                        title="Xóa đề thi"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                );
            })()}

            {/* Create/Edit Modal */}
            {(showCreateModal || editingExam) && (
                <CreateExamModal
                    initialGrade={editingExam ? (editingExam.grade || activeTab) : activeTab}
                    examToEdit={editingExam || undefined}
                    onClose={() => { setShowCreateModal(false); setEditingExam(null); }}
                    onSaved={editingExam ? handleEdited : handleSaved}
                    onShowToast={onShowToast}
                    onUploadExamPdf={onUploadExamPdf}
                    onSaveExam={onSaveExam}
                    allExams={exams}
                />
            )}

            {/* Votes Modal */}
            {viewingVotes && (
                <ExamVotesModal
                    exam={viewingVotes}
                    onClose={() => setViewingVotes(null)}
                />
            )}
        </div>
    );
};

// ── Create Exam Modal ──────────────────────────────────────────────
interface CreateExamModalProps {
    initialGrade: number;
    onClose: () => void;
    onSaved: (exam: Exam) => void;
    onShowToast: (msg: string, type: 'success' | 'error' | 'warning') => void;
    onUploadExamPdf: (file: File, onProgress: (pct: number) => void) => Promise<{ fileId: string; fileName: string }>;
    onSaveExam: (exams: Exam[]) => Promise<void>;
    allExams: Exam[];
    examToEdit?: Exam;
}

const CreateExamModal: React.FC<CreateExamModalProps> = ({
    initialGrade, onClose, onSaved, onShowToast, onUploadExamPdf, onSaveExam, allExams, examToEdit
}) => {
    const [step, setStep] = useState(1); // 1=Info+PDF, 2=Phần I, 3=Phần II, 4=Phần III
    const [title, setTitle] = useState(examToEdit?.title || '');
    const [duration, setDuration] = useState(examToEdit?.duration.toString() || '50');
    const [grade, setGrade] = useState(examToEdit?.grade || initialGrade);
    const [category, setCategory] = useState<'school' | 'chapter'>(examToEdit?.category || 'school');
    const [subCategory, setSubCategory] = useState(
        examToEdit?.category === 'chapter' ? (examToEdit.subCategory || '') : ''
    );
    const [scheduledAt, setScheduledAt] = useState(
        examToEdit?.scheduledAt ? new Date(examToEdit.scheduledAt - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''
    );
    const [closedAt, setClosedAt] = useState(
        examToEdit?.closedAt ? new Date(examToEdit.closedAt - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''
    );
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [pdfProgress, setPdfProgress] = useState(0);
    const [pdfUploading, setPdfUploading] = useState(false);
    const [pdfFileId, setPdfFileId] = useState(examToEdit?.pdfTelegramFileId || '');
    const [pdfFileName, setPdfFileName] = useState(examToEdit?.pdfFileName || '');
    const [answers, setAnswers] = useState<ExamAnswers>(examToEdit ? JSON.parse(JSON.stringify(examToEdit.answers)) : emptyAnswers());
    const [saving, setSaving] = useState(false);
    const pdfInputRef = useRef<HTMLInputElement>(null);

    const setMC = (i: number, v: string) => setAnswers(prev => {
        const mc = [...prev.mc]; mc[i] = v; return { ...prev, mc };
    });

    const setTF = (q: number, key: keyof ExamTFAnswer, v: 'D' | 'S') => setAnswers(prev => {
        const tf = prev.tf.map((item, idx) => idx === q ? { ...item, [key]: item[key] === v ? '' : v } : item);
        return { ...prev, tf };
    });

    const setSA = (i: number, v: string) => setAnswers(prev => {
        const sa = [...prev.sa]; sa[i] = v; return { ...prev, sa };
    });

    const handlePdfChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.type !== 'application/pdf') { onShowToast('Chỉ nhận file PDF', 'error'); return; }
        setPdfFile(file);
        setPdfUploading(true);
        setPdfProgress(0);
        try {
            const { fileId, fileName } = await onUploadExamPdf(file, setPdfProgress);
            setPdfFileId(fileId);
            setPdfFileName(fileName);
            onShowToast('Upload PDF thành công!', 'success');
        } catch (err: any) {
            onShowToast(err.message || 'Lỗi upload PDF', 'error');
            setPdfFile(null);
        } finally {
            setPdfUploading(false);
        }
    };

    const normalizedSubCategory = subCategory.trim();
    const canNext1 = Boolean(
        title.trim() &&
        pdfFileId &&
        !pdfUploading &&
        parseInt(duration) > 0 &&
        (category === 'school' || normalizedSubCategory)
    );

    const handleSave = async () => {
        setSaving(true);
        if (category === 'chapter' && !normalizedSubCategory) {
            onShowToast('Vui lòng nhập tên chương cho đề ôn theo chương', 'warning');
            setSaving(false);
            return;
        }

        // Validate closedAt: must be after scheduledAt + duration
        const closedAtMs = closedAt ? new Date(closedAt).getTime() : undefined;
        if (closedAtMs) {
            const scheduledAtMs = scheduledAt ? new Date(scheduledAt).getTime() : Date.now();
            const minClosedAt = scheduledAtMs + parseInt(duration) * 60000;
            if (closedAtMs <= minClosedAt) {
                onShowToast('Giờ đóng đề phải sau khi kết thúc thời gian làm bài dự kiến!', 'warning');
                setSaving(false);
                return;
            }
            // Warn admin if they are shortening an active exam
            if (examToEdit?.closedAt && closedAtMs < examToEdit.closedAt && examToEdit.closedAt > Date.now()) {
                const ok = window.confirm('⚠️ Có thể có học sinh đang làm bài. Rút ngắn giờ đóng sẽ buộc họ nộp bài sớm. Xác nhận?');
                if (!ok) { setSaving(false); return; }
            }
        }

        try {
            const exam: Exam = {
                id: examToEdit ? examToEdit.id : crypto.randomUUID(),
                title: title.trim(),
                pdfTelegramFileId: pdfFileId,
                pdfFileName,
                duration: parseInt(duration),
                grade,
                createdAt: examToEdit ? examToEdit.createdAt : Date.now(),
                answers,
                category,
                subCategory: category === 'chapter' ? normalizedSubCategory : undefined,
                scheduledAt: scheduledAt ? new Date(scheduledAt).getTime() : undefined,
                closedAt: closedAtMs,
            };
            const updatedAllExams = examToEdit 
                ? allExams.map(e => e.id === exam.id ? exam : e)
                : [...allExams, exam];
            await onSaveExam(updatedAllExams);

            // Sync metadata to Supabase so backend RPC can enforce closing time
            try {
                await supabase.rpc('admin_upsert_exam_metadata', {
                    p_id: exam.id,
                    p_closed_at: exam.closedAt ? new Date(exam.closedAt).toISOString() : null,
                    p_duration: exam.duration,
                });
            } catch (supaErr) {
                // Non-fatal: log but don't block save
                console.warn('[ExamManager] Failed to sync exam metadata to Supabase:', supaErr);
            }

            onSaved(exam);
        } catch (err: any) {
            onShowToast(err.message || 'Lỗi lưu đề thi', 'error');
        } finally {
            setSaving(false);
        }
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            style={{ background: 'rgba(26,26,26,0.5)', backdropFilter: 'blur(4px)' }}
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div
                className="w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col"
                style={{ background: '#FFFFFF', maxHeight: '90vh', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}
            >
                {/* Modal Header */}
                <div className="px-6 py-4 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid #E9E9E7' }}>
                    <h3 className="font-semibold" style={{ color: '#1A1A1A' }}>{examToEdit ? 'Cập Nhật Đề Thi' : 'Tạo Đề Thi Mới'}</h3>
                    <button onClick={onClose} className="p-1.5 rounded-lg transition-colors" style={{ color: '#AEACA8' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F1F0EC'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                    ><X className="w-4 h-4" /></button>
                </div>

                {/* Step Indicator */}
                <div className="px-6 py-4 shrink-0" style={{ borderBottom: '1px solid #F1F0EC' }}>
                    <div className="flex items-center justify-center gap-3">
                        <StepDot n={1} current={step} label="Thông tin" />
                        <div className="h-px flex-1 max-w-[48px]" style={{ background: step >= 2 ? ACCENT : '#E9E9E7' }} />
                        <StepDot n={2} current={step} label="Trắc nghiệm" />
                        <div className="h-px flex-1 max-w-[48px]" style={{ background: step >= 3 ? ACCENT : '#E9E9E7' }} />
                        <StepDot n={3} current={step} label="Đúng/Sai" />
                        <div className="h-px flex-1 max-w-[48px]" style={{ background: step >= 4 ? ACCENT : '#E9E9E7' }} />
                        <StepDot n={4} current={step} label="Trả lời ngắn" />
                    </div>
                </div>

                {/* Modal Body */}
                <div className="flex-1 overflow-y-auto px-6 py-5">

                    {/* ── Step 1: Info + PDF ── */}
                    {step === 1 && (
                        <div className="space-y-5">
                            {/* Tên đề */}
                            <div>
                                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#57564F' }}>Tên đề thi *</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    placeholder="VD: Đề thi thử số 1 - Vật Lý 12"
                                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
                                    style={{ border: '1.5px solid #E9E9E7', background: '#F7F6F3', color: '#1A1A1A' }}
                                    onFocus={e => (e.target as HTMLElement).style.borderColor = ACCENT}
                                    onBlur={e => (e.target as HTMLElement).style.borderColor = '#E9E9E7'}
                                />
                            </div>

                            {/* Phân loại đề */}
                            <div>
                                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#57564F' }}>Phân loại *</label>
                                <div className="flex p-1 rounded-xl" style={{ background: '#E9E9E7' }}>
                                    <button
                                        onClick={() => {
                                            setCategory('school');
                                            setSubCategory('');
                                        }}
                                        className="flex-1 py-1.5 text-xs font-bold rounded-lg transition-all"
                                        style={{ background: category === 'school' ? '#fff' : 'transparent', color: category === 'school' ? '#1A1A1A' : '#787774', boxShadow: category === 'school' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}
                                    >Đề Trường / Sở</button>
                                    <button
                                        onClick={() => setCategory('chapter')}
                                        className="flex-1 py-1.5 text-xs font-bold rounded-lg transition-all"
                                        style={{ background: category === 'chapter' ? '#fff' : 'transparent', color: category === 'chapter' ? '#1A1A1A' : '#787774', boxShadow: category === 'chapter' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}
                                    >Ôn theo Chương</button>
                                </div>
                            </div>

                            {/* Tên chương */}
                            {category === 'chapter' && (
                                <div>
                                    <label className="block text-xs font-semibold mb-1.5" style={{ color: '#57564F' }}>
                                        Tên chương *
                                    </label>
                                    <input
                                        type="text"
                                        value={subCategory}
                                        onChange={e => setSubCategory(e.target.value)}
                                        placeholder="VD: Chương 1 - Dao động cơ"
                                        className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
                                        style={{ border: '1.5px solid #E9E9E7', background: '#F7F6F3', color: '#1A1A1A' }}
                                        onFocus={e => (e.target as HTMLElement).style.borderColor = ACCENT}
                                        onBlur={e => (e.target as HTMLElement).style.borderColor = '#E9E9E7'}
                                    />
                                    <p className="text-[11px] mt-1" style={{ color: '#AEACA8' }}>
                                        Tên chương sẽ được dùng để gom nhóm đề thi bên trang học sinh.
                                    </p>
                                </div>
                            )}

                            {/* Thời gian + Lớp */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold mb-1.5" style={{ color: '#57564F' }}>Thời gian làm bài *</label>
                                    <div className="flex items-center gap-2">
                                        {[45, 50, 90].map(t => (
                                            <button
                                                key={t}
                                                onClick={() => setDuration(t.toString())}
                                                className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                                                style={{ background: duration === t.toString() ? ACCENT : '#F1F0EC', color: duration === t.toString() ? '#fff' : '#57564F' }}
                                            >{t}'</button>
                                        ))}
                                        <input
                                            type="number"
                                            value={duration}
                                            onChange={e => setDuration(e.target.value)}
                                            className="w-14 px-2 py-1.5 rounded-lg text-xs text-center outline-none"
                                            style={{ border: '1.5px solid #E9E9E7', background: '#F7F6F3', color: '#1A1A1A' }}
                                            min="1" max="180"
                                            onFocus={e => (e.target as HTMLElement).style.borderColor = ACCENT}
                                            onBlur={e => (e.target as HTMLElement).style.borderColor = '#E9E9E7'}
                                        />
                                    </div>
                                    <div className="flex-1 grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#57564F' }}>Hẹn thi (Tùy chọn)</label>
                                            <input
                                                type="datetime-local"
                                                value={scheduledAt}
                                                onChange={e => setScheduledAt(e.target.value)}
                                                className="w-full px-2 py-1.5 rounded-lg text-xs outline-none"
                                                style={{ border: '1.5px solid #E9E9E7', background: '#F7F6F3', color: '#1A1A1A' }}
                                                onFocus={e => (e.target as HTMLElement).style.borderColor = ACCENT}
                                                onBlur={e => (e.target as HTMLElement).style.borderColor = '#E9E9E7'}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold mb-1.5 flex items-center gap-1" style={{ color: '#57564F' }}>
                                                <Lock style={{ width: 11, height: 11, color: '#E03E3E' }} />
                                                Đóng đề lúc (Tùy chọn)
                                            </label>
                                            <input
                                                type="datetime-local"
                                                value={closedAt}
                                                onChange={e => setClosedAt(e.target.value)}
                                                className="w-full px-2 py-1.5 rounded-lg text-xs outline-none"
                                                style={{ border: '1.5px solid #E9E9E7', background: '#F7F6F3', color: '#1A1A1A' }}
                                                onFocus={e => (e.target as HTMLElement).style.borderColor = '#E03E3E'}
                                                onBlur={e => (e.target as HTMLElement).style.borderColor = '#E9E9E7'}
                                            />
                                            {closedAt && (
                                                <p className="text-[10px] mt-1" style={{ color: '#E03E3E' }}>
                                                    ⚠️ Học sinh chưa làm bài sẽ bị khóa. Người đang thi sẽ bị tự động nộp bài.
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold mb-1.5" style={{ color: '#57564F' }}>Khối lớp *</label>
                                    <div className="flex items-center gap-2">
                                        {[10, 11, 12].map(g => (
                                            <button
                                                key={g}
                                                onClick={() => setGrade(g)}
                                                className="flex-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                                                style={{ background: grade === g ? ACCENT : '#F1F0EC', color: grade === g ? '#fff' : '#57564F' }}
                                            >Lớp {g}</button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            {/* Upload PDF */}
                            <div>
                                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#57564F' }}>File đề thi (PDF) *</label>
                                {pdfFileId ? (
                                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: '#F0FDF4', border: '1.5px solid #86EFAC' }}>
                                        <FileText className="w-5 h-5 shrink-0" style={{ color: '#16A34A' }} />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium truncate" style={{ color: '#15803D' }}>{pdfFileName}</p>
                                            <p className="text-xs" style={{ color: '#16A34A' }}>Đã upload lên Telegram ✓</p>
                                        </div>
                                        <button
                                            onClick={() => { setPdfFileId(''); setPdfFileName(''); setPdfFile(null); }}
                                            className="text-xs px-2 py-1 rounded-md"
                                            style={{ background: '#DCFCE7', color: '#16A34A' }}
                                        >Đổi file</button>
                                    </div>
                                ) : (
                                    <>
                                        <input ref={pdfInputRef} type="file" accept=".pdf" className="hidden" onChange={handlePdfChange} />
                                        <button
                                            onClick={() => pdfInputRef.current?.click()}
                                            disabled={pdfUploading}
                                            className="w-full py-10 rounded-xl flex flex-col items-center gap-2 transition-all"
                                            style={{ border: '2px dashed #D0D5F7', background: '#F7F8FD' }}
                                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = ACCENT}
                                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = '#D0D5F7'}
                                        >
                                            {pdfUploading ? (
                                                <>
                                                    <Loader2 className="w-6 h-6" style={{ color: ACCENT } as any} />
                                                    <p className="text-sm font-medium" style={{ color: ACCENT }}>Đang upload... {pdfProgress}%</p>
                                                    <div className="w-40 h-1.5 rounded-full" style={{ background: '#E9E9E7' }}>
                                                        <div className="h-full rounded-full transition-all" style={{ width: `${pdfProgress}%`, background: ACCENT }} />
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <Upload className="w-6 h-6" style={{ color: '#CFCFCB' }} />
                                                    <p className="text-sm font-medium" style={{ color: '#57564F' }}>Bấm để chọn file PDF</p>
                                                    <p className="text-xs" style={{ color: '#AEACA8' }}>File sẽ được upload lên Telegram</p>
                                                </>
                                            )}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── Step 2: Phần I — Trắc nghiệm (18 câu ABCD) ── */}
                    {step === 2 && (
                        <div>
                            <div className="mb-4 p-3 rounded-xl" style={{ background: '#EEF0FB' }}>
                                <p className="text-xs font-semibold" style={{ color: ACCENT }}>PHẦN I — TRẮC NGHIỆM NHIỀU LỰA CHỌN</p>
                                <p className="text-xs mt-0.5" style={{ color: '#787774' }}>18 câu × 0.25đ = 4.5đ | Chọn 1 đáp án đúng cho mỗi câu</p>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                {answers.mc.map((val, i) => (
                                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#F7F6F3', border: '1px solid #E9E9E7' }}>
                                        <span className="text-sm font-semibold w-10 shrink-0" style={{ color: '#57564F' }}>Câu {i + 1}</span>
                                        <div className="flex gap-1.5">
                                            {['A', 'B', 'C', 'D'].map(letter => (
                                                <button
                                                    key={letter}
                                                    onClick={() => setMC(i, val === letter ? '' : letter)}
                                                    className="w-8 h-8 rounded-lg text-sm font-bold transition-all active:scale-95"
                                                    style={{
                                                        background: val === letter ? ACCENT : '#fff',
                                                        color: val === letter ? '#fff' : '#57564F',
                                                        border: `1.5px solid ${val === letter ? ACCENT : '#E9E9E7'}`,
                                                    }}
                                                >{letter}</button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Step 3: Phần II — Đúng/Sai (4 câu × 4 ý) ── */}
                    {step === 3 && (
                        <div>
                            <div className="mb-4 p-3 rounded-xl" style={{ background: '#F5F3FF' }}>
                                <p className="text-xs font-semibold" style={{ color: '#7C4FAE' }}>PHẦN II — ĐÚNG/SAI</p>
                                <p className="text-xs mt-0.5" style={{ color: '#787774' }}>4 câu × tối đa 1đ/câu = 4đ | 1ý=0.1đ · 2ý=0.25đ · 3ý=0.5đ · 4ý=1đ</p>
                            </div>
                            <div className="space-y-4">
                                {answers.tf.map((tfAns, qi) => (
                                    <div key={qi} className="p-4 rounded-xl" style={{ background: '#F7F6F3', border: '1px solid #E9E9E7' }}>
                                        <p className="text-sm font-semibold mb-3" style={{ color: '#1A1A1A' }}>Câu {19 + qi}</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            {(['a', 'b', 'c', 'd'] as (keyof ExamTFAnswer)[]).map(key => (
                                                <div key={key} className="flex items-center gap-2">
                                                    <span className="text-xs font-semibold w-4" style={{ color: '#57564F' }}>{key})</span>
                                                    <div className="flex gap-1.5">
                                                        {(['D', 'S'] as const).map(v => (
                                                            <button
                                                                key={v}
                                                                onClick={() => setTF(qi, key, v)}
                                                                className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95"
                                                                style={{
                                                                    background: tfAns[key] === v ? (v === 'D' ? '#16A34A' : '#E03E3E') : '#fff',
                                                                    color: tfAns[key] === v ? '#fff' : '#57564F',
                                                                    border: `1.5px solid ${tfAns[key] === v ? (v === 'D' ? '#16A34A' : '#E03E3E') : '#E9E9E7'}`,
                                                                }}
                                                            >{v === 'D' ? 'Đúng' : 'Sai'}</button>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Step 4: Phần III — Trả lời ngắn (6 câu) ── */}
                    {step === 4 && (
                        <div>
                            <div className="mb-4 p-3 rounded-xl" style={{ background: '#FFF7ED' }}>
                                <p className="text-xs font-semibold" style={{ color: '#D9730D' }}>PHẦN III — TRẢ LỜI NGẮN</p>
                                <p className="text-xs mt-0.5" style={{ color: '#787774' }}>6 câu × 0.25đ = 1.5đ | Nhập đáp án chính xác (học sinh nhập đúng thì được điểm)</p>
                            </div>
                            <div className="space-y-3">
                                {answers.sa.map((val, i) => (
                                    <div key={i} className="flex items-center gap-4 p-4 rounded-xl" style={{ background: '#F7F6F3', border: '1px solid #E9E9E7' }}>
                                        <span className="text-sm font-semibold w-16 shrink-0" style={{ color: '#57564F' }}>Câu {23 + i}</span>
                                        <input
                                            type="text"
                                            value={val}
                                            onChange={e => setSA(i, e.target.value)}
                                            placeholder="Nhập đáp án..."
                                            className="flex-1 px-4 py-2 rounded-lg text-sm outline-none transition-all"
                                            style={{ border: '1.5px solid #E9E9E7', background: '#fff', color: '#1A1A1A' }}
                                            onFocus={e => (e.target as HTMLElement).style.borderColor = '#D9730D'}
                                            onBlur={e => (e.target as HTMLElement).style.borderColor = '#E9E9E7'}
                                        />
                                        <span className="text-xs font-semibold shrink-0" style={{ color: '#D9730D' }}>0.25đ</span>
                                    </div>
                                ))}
                            </div>

                            {/* Summary */}
                            <div className="mt-5 p-4 rounded-xl" style={{ background: '#F7F8FD', border: '1px solid #D0D5F7' }}>
                                <p className="text-xs font-semibold mb-2" style={{ color: ACCENT }}>Tóm tắt đề thi</p>
                                <div className="space-y-1 text-xs" style={{ color: '#57564F' }}>
                                    <div className="flex justify-between"><span>📋 Tên đề:</span><span className="font-medium">{title}</span></div>
                                    <div className="flex justify-between"><span>📚 Khối:</span><span className="font-medium">Lớp {grade}</span></div>
                                    <div className="flex justify-between"><span>⏱️ Thời gian:</span><span className="font-medium">{duration} phút</span></div>
                                    {category === 'chapter' && (
                                        <div className="flex justify-between">
                                            <span>📖 Chương:</span>
                                            <span className="font-medium">{normalizedSubCategory}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between"><span>I. Trắc nghiệm:</span><span className="font-medium">{answers.mc.filter(Boolean).length}/18 câu</span></div>
                                    <div className="flex justify-between"><span>II. Đúng/Sai:</span><span className="font-medium">{answers.tf.filter(t => t.a || t.b || t.c || t.d).length}/4 câu</span></div>
                                    <div className="flex justify-between"><span>III. Trả lời ngắn:</span><span className="font-medium">{answers.sa.filter(Boolean).length}/6 câu</span></div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-4 flex items-center justify-between gap-3 shrink-0" style={{ borderTop: '1px solid #E9E9E7' }}>
                    <button
                        onClick={() => step > 1 ? setStep(step - 1) : onClose()}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm transition-colors"
                        style={{ color: '#57564F', background: '#F1F0EC' }}
                    >
                        <ChevronLeft className="w-4 h-4" />
                        {step === 1 ? 'Hủy' : 'Quay lại'}
                    </button>

                    {step < 4 ? (
                        <button
                            onClick={() => setStep(step + 1)}
                            disabled={step === 1 && !canNext1}
                            className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold transition-all active:scale-95"
                            style={{
                                background: (step === 1 && !canNext1) ? '#E9E9E7' : ACCENT,
                                color: (step === 1 && !canNext1) ? '#AEACA8' : '#fff',
                            }}
                        >
                            Tiếp theo
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    ) : (
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold transition-all active:scale-95"
                            style={{ background: '#16A34A', color: '#fff' }}
                        >
                            {saving ? <Loader2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                            {saving ? 'Đang lưu...' : 'Lưu đề thi'}
                        </button>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

// ── Exam Votes Modal ──────────────────────────────────────────────
interface ExamVotesModalProps {
    exam: Exam;
    onClose: () => void;
}

const ExamVotesModal: React.FC<ExamVotesModalProps> = ({ exam, onClose }) => {
    const { getQuestionVotes } = useCloudStorage();
    const [votes, setVotes] = useState<{ part_name: string; question_number: number; student_phone: string }[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getQuestionVotes(exam.id).then(data => {
            setVotes(data);
            setLoading(false);
        });
    }, [exam.id]);

    // Group votes by question
    const voteCounts: Record<string, { count: number; phones: string[]; part: string; num: number }> = {};
    votes.forEach(v => {
        const key = `${v.part_name}-${v.question_number}`;
        if (!voteCounts[key]) {
            voteCounts[key] = { count: 0, phones: [], part: v.part_name, num: v.question_number };
        }
        voteCounts[key].count++;
        if (!voteCounts[key].phones.includes(v.student_phone)) {
            voteCounts[key].phones.push(v.student_phone);
        }
    });

    const sortedVotes = Object.values(voteCounts).sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.num - b.num;
    });

    return createPortal(
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            style={{ background: 'rgba(26,26,26,0.5)', backdropFilter: 'blur(4px)' }}
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div
                className="w-full max-w-lg rounded-2xl overflow-hidden flex flex-col"
                style={{ background: '#FFFFFF', maxHeight: '80vh', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}
            >
                {/* Header */}
                <div className="px-6 py-4 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid #E9E9E7', background: '#FAFAFA' }}>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: '#FFF7ED' }}>
                            <Flag className="w-4 h-4" style={{ color: '#D9730D' }} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-sm" style={{ color: '#1A1A1A' }}>Báo cáo câu hỏi khó</h3>
                            <p className="text-xs" style={{ color: '#787774' }}>{exam.title}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg transition-colors" style={{ color: '#AEACA8' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#E9E9E7'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                    ><X className="w-4 h-4" /></button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 mb-3" style={{ color: '#D9730D' } as any} />
                            <p className="text-sm" style={{ color: '#787774' }}>Đang tải dữ liệu báo cáo...</p>
                        </div>
                    ) : sortedVotes.length === 0 ? (
                        <div className="text-center py-12 rounded-xl" style={{ border: '2px dashed #E9E9E7', background: '#FAFAFA' }}>
                            <Check className="w-10 h-10 mx-auto mb-3" style={{ color: '#16A34A' }} />
                            <p className="text-sm font-semibold" style={{ color: '#16A34A' }}>Tuyệt vời!</p>
                            <p className="text-xs mt-1" style={{ color: '#787774' }}>Chưa có học sinh nào báo cáo gặp khó khăn với đề này.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <p className="text-xs font-semibold mb-2" style={{ color: '#57564F' }}>TOP CÁC CÂU LÀM KHÓ HỌC SINH NHẤT</p>
                            {sortedVotes.map((v, i) => (
                                <div key={i} className="p-4 rounded-xl" style={{ background: '#F7F6F3', border: '1px solid #E9E9E7' }}>
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                                                style={{ background: i === 0 ? '#FEF2F2' : '#fff', color: i === 0 ? '#E03E3E' : '#57564F', border: i === 0 ? 'none' : '1px solid #E9E9E7' }}>
                                                #{i + 1}
                                            </span>
                                            <span className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>{v.part} — Câu {v.num}</span>
                                        </div>
                                        <span className="text-xs px-2.5 py-1 rounded-full font-bold" style={{ background: '#FFF7ED', color: '#D9730D' }}>
                                            {v.count} lượt
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-1 mt-2">
                                        {v.phones.map((phone, pi) => (
                                            <span key={pi} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md" style={{ background: '#fff', border: '1px solid #E9E9E7', color: '#787774' }}>
                                                <User className="w-3 h-3" />
                                                {phone}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ExamManager;
