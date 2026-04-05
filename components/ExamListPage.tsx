import React, { useState, useEffect, useRef } from 'react';
import { ClipboardList, Clock, Play, RefreshCw, FileText, Lock, CheckCircle, Zap } from 'lucide-react';
import { Exam } from '../types';
import { CLOUDFLARE_PROXY_URL } from '../src/lib/telegram';
import { isPdfCached, savePdfToCache } from '../src/lib/pdfCache';
import { useLocation } from 'react-router-dom';
import { getSecureTime } from '../src/lib/serverTime';


const prefetchExamPdf = async (exam: Exam) => {
    try {
        // Truyền fileId để cache key bao gồm version của file — tự invalidate khi admin upload đề mới
        if (await isPdfCached(exam.id, exam.pdfTelegramFileId)) return;
        const res = await fetch(`${CLOUDFLARE_PROXY_URL}/getFile/${exam.pdfTelegramFileId}`);
        if (res.ok) {
            // FIX: Force MIME type application/pdf — res.blob() có thể trả về MIME sai từ Telegram
            // nếu không force, iframe có thể không render được PDF
            const buffer = await res.arrayBuffer();
            const blob = new Blob([buffer], { type: 'application/pdf' });
            await savePdfToCache(exam.id, blob, exam.pdfTelegramFileId);
            console.log(`[Prefetch] ✅ ${exam.title}`);
        }
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

const getExamSubCategoryLabel = (exam: Exam) => {
    const raw = typeof exam.subCategory === 'string' ? exam.subCategory.trim() : '';
    return raw || 'Chưa phân loại';
};

const ExamRowCard = React.memo(({ exam, idx, total, bestScore, onSelectExam, isAdmin }: any) => {
    const isDone = bestScore !== undefined;
    const [now, setNow] = useState(getSecureTime());

    useEffect(() => {
        if ((!exam.scheduledAt && !exam.closedAt) || isDone || isAdmin) return;
        const iv = setInterval(() => setNow(getSecureTime()), 1000);
        return () => clearInterval(iv);
    }, [exam.scheduledAt, exam.closedAt, isDone, isAdmin]);

    let status: 'LOCKED' | 'READY' | 'ARMED' | 'CLOSED' | 'OPEN' = 'OPEN';
    let diff = 0;

    // CLOSED: Đề đã quá giờ đóng chung — chỉ khóa người CHƯА LÀM BÀI
    if (exam.closedAt && now > exam.closedAt && !isDone && !isAdmin) {
        status = 'CLOSED';
    } else if (exam.scheduledAt && !isAdmin && !isDone) {
        diff = Math.floor((exam.scheduledAt - now) / 1000);
        if (diff > 300) status = 'LOCKED';
        else if (diff > 60) status = 'READY';
        else if (diff > 0) status = 'ARMED';
    }

    // In-flight guard: chi prefetch 1 lan du component re-render voi status=READY
    // Neu khong co guard: exam object ref thay doi -> [status, exam] effect re-run -> double download
    const hasPrefetchedRef = useRef(false);
    useEffect(() => {
        // Only prefetch when READY (5 min before open) — skip CLOSED/LOCKED to prevent early PDF leaks
        if (status === 'READY' && !hasPrefetchedRef.current) {
            hasPrefetchedRef.current = true;
            prefetchExamPdf(exam);
        }
    }, [status, exam]);

    const formatDiff = (d: number) => {
        const m = Math.floor(d / 60);
        const s = d % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    return (
        <div
            className="flex items-center gap-4 px-4 py-3.5 cursor-pointer group pv-row-hover"
            style={{
                borderBottom: idx < total - 1 ? '1px solid #F1F0EC' : 'none',
                background: '#FFFFFF',
                borderLeft: isDone ? '3px solid #448361' : '3px solid transparent',
                opacity: status === 'LOCKED' ? 0.6 : 1,
            }}
            onClick={() => {
                // ✅ FIX BUG 4: Thêm ngoặc tường minh — tránh bug operator precedence
                if ((status === 'OPEN') || (status === 'CLOSED' && isDone) || isAdmin) onSelectExam();
            }}
        >
            <div
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 font-bold text-sm"
                style={{
                    background: isDone ? '#EAF3EE' : (status === 'LOCKED' || status === 'CLOSED' ? '#F1F0EC' : '#EEF0FB'),
                    color: isDone ? '#448361' : (status === 'LOCKED' || status === 'CLOSED' ? '#AEACA8' : ACCENT),
                }}
            >
                {isDone ? <CheckCircle className="w-4 h-4" /> : (status === 'LOCKED' || status === 'CLOSED' ? <Lock className="w-4 h-4" /> : idx + 1)}
            </div>

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
                    {exam.scheduledAt && !isDone && (
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border" style={{ color: '#D9730D', borderColor: '#D9730D50', background: '#FFF3E8' }}>
                            {new Date(exam.scheduledAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
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

            <button
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold shrink-0 transition-opacity ${isDone ? 'pv-btn-secondary-hover' : 'pv-btn-primary-hover'}`}
                style={{
                    background: isDone ? '#F1F0EC' : (status === 'OPEN' || isAdmin ? ACCENT : '#F1F0EC'),
                    color: isDone ? '#57564F' : (status === 'OPEN' || isAdmin ? '#fff' : '#AEACA8'),
                    cursor: status === 'OPEN' || isAdmin ? 'pointer' : 'not-allowed',
                }}
                onClick={e => {
                    e.stopPropagation();
                    if (status === 'OPEN' || isAdmin) onSelectExam();
                }}
                disabled={status !== 'OPEN' && !isAdmin}
            >
                {status === 'LOCKED' ? (
                    <><Lock className="w-3.5 h-3.5" /> Chưa mở</>
                ) : status === 'CLOSED' ? (
                    <><Lock className="w-3.5 h-3.5" /> Đã khóa</>
                ) : status === 'READY' ? (
                    <><Zap className="w-3.5 h-3.5" style={{color: '#D9730D'}}/> Đang tải...</>
                ) : status === 'ARMED' ? (
                    <>{formatDiff(diff)}s</>
                ) : (
                    <><Play className="w-3.5 h-3.5" /> {isDone ? 'Làm lại' : 'Làm bài'}</>
                )}
            </button>
        </div>
    );
// Custom comparator: chi re-render khi examId/bestScore/isAdmin/scheduledAt thay doi
// Ngan toan bo list bi re-render moi giay do now-tick o card khac
}, (prev, next) =>
    prev.exam.id === next.exam.id &&
    prev.exam.scheduledAt === next.exam.scheduledAt &&
    prev.exam.closedAt === next.exam.closedAt &&
    prev.bestScore === next.bestScore &&
    prev.isAdmin === next.isAdmin &&
    prev.idx === next.idx &&
    prev.total === next.total
);

const ExamListPage: React.FC<ExamListPageProps> = ({ onSelectExam, onLoadExams, onLoadHistory, isAdmin, previewMode }) => {
    const [exams, setExams] = useState<Exam[]>([]);
    const [loading, setLoading] = useState(true);
    // Map: examId → best score
    const [doneMap, setDoneMap] = useState<Record<string, number>>({});
    const [localStudentGrade] = useState(() => parseInt(localStorage.getItem('physivault_grade') || '12', 10));
    const studentGrade = previewMode || localStudentGrade;
    const [activeTab, setActiveTab] = useState<number>(studentGrade);
    const [activeCategory, setActiveCategory] = useState<'school' | 'chapter'>('school');
    // Track prefetch timeouts để cleanup khi unmount
    const prefetchTimeoutsRef = useRef<number[]>([]);

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
            // grade = 0/undefined = đề chung, hiện cho tất cả khối
            const gradedExams = sorted.filter(e => !e.grade || e.grade === studentGrade);
            // Cleanup timeouts cũ trước khi tạo mới
            prefetchTimeoutsRef.current.forEach(id => clearTimeout(id));
            prefetchTimeoutsRef.current = [];
            // ✅ SECURITY FIX: Chỉ tải ngầm đề ĐÃ MỞ CÔNG KHAI (không có scheduledAt, hoặc đã qua giờ thi)
            // Đề hẹn giờ đang bị khóa (LOCKED) sẽ KHÔNG được tải sớm để tránh lộ đề
            // Chúng đã có cơ chế tải riêng trong 5 phút cuối (trạng thái READY ở ExamRowCard)
            const now = getSecureTime();
            const openExams = gradedExams.filter(e => !e.scheduledAt || e.scheduledAt <= now);
            // FIX: Tăng lên 5 đề, stagger 1500ms mỗi đề — cân bằng UX vs network
            openExams.slice(0, 5).forEach((exam, i) => {
                const id = window.setTimeout(() => prefetchExamPdf(exam), i * 1500); // stagger 1.5s each
                prefetchTimeoutsRef.current.push(id);
            });
        } catch { /* silent */ }
        finally { setLoading(false); }
    };

    const location = useLocation();

    useEffect(() => {
        load();
        return () => {
            // Cleanup tất cả prefetch timeouts khi component unmount
            prefetchTimeoutsRef.current.forEach(id => clearTimeout(id));
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        const state = location.state as { selectedExamId?: string };
        if (state?.selectedExamId && exams.length > 0) {
            const ex = exams.find(e => e.id === state.selectedExamId);
            if (ex) {
                // Tự động chuyển tab sang khối phù hợp nếu cần
                if (ex.grade) setActiveTab(ex.grade);
                onSelectExam(ex);
            }
        }
    }, [location.state, exams, onSelectExam]);

    const scoringInfo = [
        { label: 'Trắc nghiệm', sub: '18 câu × 0.25đ', max: '4.5 đ', color: '#6B7CDB', bg: '#EEF0FB' },
        { label: 'Đúng / Sai', sub: '4 câu lũy tiến', max: '4.0 đ', color: '#9065B0', bg: '#F3ECF8' },
        { label: 'Trả lời ngắn', sub: '6 câu × 0.25đ', max: '1.5 đ', color: '#D9730D', bg: '#FFF3E8' },
    ];

    // --- Data processing ---
    const filteredExams = exams.filter(e => {
        const matchGrade = !e.grade || e.grade === activeTab;
        const matchCategory =
            activeCategory === 'school'
                ? (!e.category || e.category === 'school')
                : e.category === 'chapter';

        return matchGrade && matchCategory;
    });

    const groupedChapterExams =
        activeCategory === 'chapter'
            ? filteredExams.reduce<Record<string, Exam[]>>((acc, exam) => {
                const groupName = getExamSubCategoryLabel(exam);
                if (!acc[groupName]) {
                    acc[groupName] = [];
                }
                acc[groupName].push(exam);
                return acc;
            }, {})
            : {};

    const groupedChapterEntries =
        activeCategory === 'chapter'
            ? Object.entries(groupedChapterExams).sort(([a], [b]) => a.localeCompare(b, 'vi'))
            : [];

    // --- Sub-renderers ---
    const renderExamRow = (exam: Exam, idx: number, total: number, keyPrefix = '') => {
        return (
            <ExamRowCard
                key={`${keyPrefix}${exam.id}`}
                exam={exam}
                idx={idx}
                total={total}
                bestScore={doneMap[exam.id]}
                onSelectExam={() => onSelectExam(exam)}
                isAdmin={isAdmin}
            />
        );
    };

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
                    className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium pv-btn-secondary-hover"
                    style={{ background: '#F1F0EC', border: '1px solid #E9E9E7', color: '#57564F' }}
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b" style={{ borderColor: '#E9E9E7' }}>
                <div className="flex items-center gap-2">
                    {(isAdmin && !previewMode ? [12, 11, 10] : [studentGrade]).map(grade => (
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
                {/* Category Switch */}
                <div className="flex bg-[#F1F0EC] p-1 rounded-xl shrink-0 self-start sm:self-center mb-2 sm:mb-0 mr-2">
                    <button
                        onClick={() => setActiveCategory('school')}
                        className="px-4 py-1.5 text-xs font-bold rounded-lg transition-all"
                        style={{ background: activeCategory === 'school' ? '#fff' : 'transparent', color: activeCategory === 'school' ? '#1A1A1A' : '#787774', boxShadow: activeCategory === 'school' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}
                    >Đề Trường / Sở</button>
                    <button
                        onClick={() => setActiveCategory('chapter')}
                        className="px-4 py-1.5 text-xs font-bold rounded-lg transition-all"
                        style={{ background: activeCategory === 'chapter' ? '#fff' : 'transparent', color: activeCategory === 'chapter' ? '#1A1A1A' : '#787774', boxShadow: activeCategory === 'chapter' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}
                    >Ôn theo Chương</button>
                </div>
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
            ) : filteredExams.length === 0 ? (
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E9E9E7', background: '#FFFFFF' }}>
                    <div className="py-12 text-center">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-3" style={{ background: '#F1F0EC' }}>
                            <ClipboardList className="w-5 h-5" style={{ color: '#CFCFCB' }} />
                        </div>
                        <p className="font-medium" style={{ color: '#57564F' }}>Chưa có đề thi nào</p>
                        <p className="text-sm mt-1" style={{ color: '#AEACA8' }}>
                            {activeCategory === 'chapter'
                                ? 'Chưa có đề ôn theo chương nào trong mục này.'
                                : 'Thầy/cô sẽ đăng đề thi sớm nhé!'}
                        </p>
                    </div>
                </div>
            ) : activeCategory === 'school' ? (
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E9E9E7', background: '#FFFFFF' }}>
                    {filteredExams.map((exam, idx) => renderExamRow(exam, idx, filteredExams.length, 'school-'))}
                </div>
            ) : (
                <div className="space-y-4">
                    {groupedChapterEntries.map(([groupName, examsInGroup]) => (
                        <div
                            key={groupName}
                            className="rounded-xl overflow-hidden"
                            style={{ border: '1px solid #E9E9E7', background: '#FFFFFF' }}
                        >
                            <div
                                className="px-4 py-3"
                                style={{ borderBottom: '1px solid #E9E9E7', background: '#FAFAF9' }}
                            >
                                <h3 className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>
                                    {groupName}
                                </h3>
                                <p className="text-xs mt-0.5" style={{ color: '#AEACA8' }}>
                                    {examsInGroup.length} đề thi
                                </p>
                            </div>

                            <div>
                                {examsInGroup.map((exam, idx) =>
                                    renderExamRow(exam, idx, examsInGroup.length, `${groupName}-`)
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ExamListPage;
