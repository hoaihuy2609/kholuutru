import React, { useState, useEffect } from 'react';
import { ClipboardList, Clock, Play, RefreshCw, ChevronRight, FileText, Lock, CheckCircle } from 'lucide-react';
import { Exam } from '../types';

const TELEGRAM_TOKEN = '7985901918:AAFK33yVAEPPKiAbiaMFCdz78TpOhBXeRr0';
const PDF_CACHE_DB = 'pv_pdf_cache';
const PDF_CACHE_STORE = 'pdfs';

// ── Inline cache helpers (same IndexedDB as ExamView) ────────────
const _openPdfDB = (): Promise<IDBDatabase> =>
    new Promise((resolve, reject) => {
        const req = indexedDB.open(PDF_CACHE_DB, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(PDF_CACHE_STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });

const _isPdfCached = async (examId: string): Promise<boolean> => {
    try {
        const db = await _openPdfDB();
        return new Promise(resolve => {
            const req = db.transaction(PDF_CACHE_STORE, 'readonly').objectStore(PDF_CACHE_STORE).getKey(examId);
            req.onsuccess = () => resolve(!!req.result);
            req.onerror = () => resolve(false);
        });
    } catch { return false; }
};

const _savePdfBlob = async (examId: string, blob: Blob) => {
    try {
        const db = await _openPdfDB();
        db.transaction(PDF_CACHE_STORE, 'readwrite').objectStore(PDF_CACHE_STORE).put(blob, examId);
    } catch { /* silent */ }
};

const prefetchExamPdf = async (exam: Exam) => {
    try {
        if (await _isPdfCached(exam.id)) return; // already cached
        const meta = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getFile?file_id=${exam.pdfTelegramFileId}`);
        const md = await meta.json();
        if (!md.ok) return;
        const directUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${md.result.file_path}`;
        // Try codetabs first
        try {
            const res = await fetch(`https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(directUrl)}`);
            if (res.ok) {
                const ct = res.headers.get('content-type') || '';
                if (ct.includes('pdf') || ct.includes('octet')) {
                    const blob = await res.blob();
                    await _savePdfBlob(exam.id, blob);
                    console.log(`[Prefetch] ✅ ${exam.title}`);
                    return;
                }
            }
        } catch { /* silent */ }
    } catch { /* silent */ }
};

interface ExamListPageProps {
    onSelectExam: (exam: Exam) => void;
    onLoadExams: () => Promise<Exam[]>;
    onLoadHistory?: () => Promise<any[]>;
    isAdmin?: boolean;
    previewMode?: number | null;
}

const ACCENT = '#6B7CDB';

const ExamListPage: React.FC<ExamListPageProps> = ({ onSelectExam, onLoadExams, onLoadHistory, isAdmin, previewMode }) => {
    const [exams, setExams] = useState<Exam[]>([]);
    const [loading, setLoading] = useState(true);
    // Map: examId → best score
    const [doneMap, setDoneMap] = useState<Record<string, number>>({});
    const [localStudentGrade] = useState(() => parseInt(localStorage.getItem('physivault_grade') || '12', 10));
    const studentGrade = previewMode || localStudentGrade;
    const [activeTab, setActiveTab] = useState<number>(studentGrade);

    useEffect(() => {
        if (previewMode) setActiveTab(previewMode);
    }, [previewMode]);

    const load = async () => {
        setLoading(true);
        try {
            const [data, history] = await Promise.all([
                onLoadExams(),
                onLoadHistory ? onLoadHistory() : Promise.resolve([]),
            ]);
            const sorted = data.sort((a, b) => b.createdAt - a.createdAt);
            setExams(sorted);
            // Build doneMap: examId → best score
            const map: Record<string, number> = {};
            (history || []).forEach((h: any) => {
                const id = h.exam_id;
                const score = typeof h.score === 'number' ? h.score : parseFloat(h.score);
                if (!isNaN(score)) {
                    if (map[id] === undefined || score > map[id]) map[id] = score;
                }
            });
            setDoneMap(map);
            // Prefetch PDFs in background after list is loaded (1 by 1, no rush)
            const gradedExams = sorted.filter(e => (!e.grade && studentGrade === 12) || e.grade === studentGrade);
            gradedExams.forEach((exam, i) => {
                setTimeout(() => prefetchExamPdf(exam), i * 2000); // stagger 2s each
            });
        } catch { /* silent */ }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    const scoringInfo = [
        { label: 'Trắc nghiệm', sub: '18 câu × 0.25đ', max: '4.5 đ', color: '#6B7CDB', bg: '#EEF0FB' },
        { label: 'Đúng / Sai', sub: '4 câu lũy tiến', max: '4.0 đ', color: '#9065B0', bg: '#F3ECF8' },
        { label: 'Trả lời ngắn', sub: '6 câu × 0.25đ', max: '1.5 đ', color: '#D9730D', bg: '#FFF3E8' },
    ];

    return (
        <div className="space-y-6 animate-fade-in pb-10">

            {/* ── Header ── */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#EEF0FB' }}>
                        <ClipboardList className="w-5 h-5" style={{ color: ACCENT }} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-semibold" style={{ color: '#1A1A1A' }}>Bài Thi Thử</h1>
                        <p className="text-sm mt-0.5" style={{ color: '#787774' }}>Cấu trúc chuẩn Bộ GD&ĐT 2025</p>
                    </div>
                </div>
                <button
                    onClick={load}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                    style={{ background: '#F1F0EC', border: '1px solid #E9E9E7', color: '#57564F' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#E9E9E7'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#F1F0EC'}
                    title="Tải lại danh sách"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} style={{ color: ACCENT }} />
                    Làm mới
                </button>
            </div>

            {/* ── Scoring Info ── */}
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E9E9E7', background: '#FFFFFF' }}>
                <div className="px-4 py-3" style={{ borderBottom: '1px solid #E9E9E7', borderLeft: '3px solid #6B7CDB', background: '#FAFAF9' }}>
                    <h3 className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>Cơ cấu điểm số</h3>
                    <p className="text-xs mt-0.5" style={{ color: '#787774' }}>Tổng 10 điểm — 28 câu hỏi</p>
                </div>
                <div className="grid grid-cols-3 divide-x" style={{ borderColor: '#E9E9E7' }}>
                    {scoringInfo.map(s => (
                        <div key={s.label} className="p-4 text-center">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center mx-auto mb-2" style={{ background: s.bg }}>
                                <FileText className="w-4 h-4" style={{ color: s.color }} />
                            </div>
                            <div className="text-xl font-bold tabular-nums" style={{ color: s.color }}>{s.max}</div>
                            <div className="text-[13px] font-semibold mt-0.5" style={{ color: '#1A1A1A' }}>{s.label}</div>
                            <div className="text-[11px] mt-1" style={{ color: '#AEACA8' }}>{s.sub}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Tabs ── */}
            <div className="flex items-center gap-2 border-b" style={{ borderColor: '#E9E9E7' }}>
                {[12, 11, 10].map(grade => (
                    <button
                        key={grade}
                        onClick={() => setActiveTab(grade)}
                        className="px-5 py-2.5 text-sm font-semibold transition-colors border-b-2"
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

            {/* ── Exam List ── */}
            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <RefreshCw className="w-5 h-5 animate-spin" style={{ color: ACCENT }} />
                    <span className="ml-2 text-sm" style={{ color: '#787774' }}>Đang tải đề thi...</span>
                </div>
            ) : (!isAdmin || previewMode) && activeTab !== studentGrade ? (
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E9E9E7', background: '#FFFFFF' }}>
                    <div className="py-12 text-center px-6">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-3" style={{ background: '#FEF2F2' }}>
                            <Lock className="w-5 h-5" style={{ color: '#E03E3E' }} />
                        </div>
                        <p className="font-semibold" style={{ color: '#E03E3E' }}>Quyền truy cập bị hạn chế</p>
                        <p className="text-sm mt-1 max-w-sm mx-auto leading-relaxed" style={{ color: '#787774' }}>
                            Tài khoản của bạn chỉ được xem đề thi Khối {studentGrade}.
                        </p>
                    </div>
                </div>
            ) : (() => {
                const filteredExams = exams.filter(e => (!e.grade && activeTab === 12) || e.grade === activeTab);
                if (filteredExams.length === 0) {
                    return (
                        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E9E9E7', background: '#FFFFFF' }}>
                            <div className="py-12 text-center">
                                <div className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-3" style={{ background: '#F1F0EC' }}>
                                    <ClipboardList className="w-5 h-5" style={{ color: '#CFCFCB' }} />
                                </div>
                                <p className="font-medium" style={{ color: '#57564F' }}>Chưa có đề thi nào</p>
                                <p className="text-sm mt-1" style={{ color: '#AEACA8' }}>Thầy/cô sẽ đăng đề thi sớm nhé!</p>
                            </div>
                        </div>
                    );
                }
                return (
                    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E9E9E7', background: '#FFFFFF' }}>
                        {filteredExams.map((exam, idx) => {
                            const bestScore = doneMap[exam.id];
                            const isDone = bestScore !== undefined;
                            return (
                                <div
                                    key={exam.id}
                                    className="flex items-center gap-4 px-4 py-3.5 cursor-pointer transition-colors group"
                                    style={{
                                        borderBottom: idx < filteredExams.length - 1 ? '1px solid #F1F0EC' : 'none',
                                        background: '#FFFFFF',
                                        borderLeft: isDone ? '3px solid #448361' : '3px solid transparent',
                                    }}
                                    onClick={() => onSelectExam(exam)}
                                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F7F6F3'}
                                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#FFFFFF'}
                                >
                                    {/* Index badge */}
                                    <div
                                        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 font-bold text-sm"
                                        style={{
                                            background: isDone ? '#EAF3EE' : '#EEF0FB',
                                            color: isDone ? '#448361' : ACCENT,
                                        }}
                                    >
                                        {isDone
                                            ? <CheckCircle className="w-4 h-4" />
                                            : idx + 1
                                        }
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="text-sm font-semibold truncate" style={{ color: '#1A1A1A' }}>
                                                {exam.title}
                                            </h3>
                                            {isDone && (
                                                <span
                                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold shrink-0"
                                                    style={{ background: '#EAF3EE', color: '#448361', border: '1px solid #B7D9C4' }}
                                                >
                                                    <CheckCircle className="w-2.5 h-2.5" />
                                                    {bestScore.toFixed(2)}đ
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                                            <span className="flex items-center gap-1 text-xs" style={{ color: '#787774' }}>
                                                <Clock className="w-3 h-3" style={{ color: '#D9730D' }} />
                                                {exam.duration} phút
                                            </span>
                                            <span className="flex items-center gap-1 text-xs truncate max-w-[180px]" style={{ color: '#AEACA8' }}>
                                                <FileText className="w-3 h-3" />
                                                {exam.pdfFileName}
                                            </span>
                                            <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: '#F1F0EC', color: '#AEACA8' }}>
                                                {new Date(exam.createdAt).toLocaleDateString('vi-VN')}
                                            </span>
                                        </div>
                                    </div>

                                    {/* CTA */}
                                    <button
                                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold shrink-0 transition-all active:scale-95"
                                        style={{
                                            background: isDone ? '#F1F0EC' : ACCENT,
                                            color: isDone ? '#57564F' : '#fff',
                                        }}
                                        onClick={e => { e.stopPropagation(); onSelectExam(exam); }}
                                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = isDone ? '#E9E9E7' : '#5a6bc9'}
                                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = isDone ? '#F1F0EC' : ACCENT}
                                    >
                                        <Play className="w-3.5 h-3.5" />
                                        {isDone ? 'Làm lại' : 'Làm bài'}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                );
            })()}
        </div>
    );
};

export default ExamListPage;
