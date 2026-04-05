import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Clock, ChevronLeft, Send, AlertTriangle, CheckCircle, RefreshCw, FileText } from 'lucide-react';
import { Exam, ExamTFAnswer, ExamSubmission } from '../types';
import ExamCountdownTimer from './ExamCountdownTimer';
import { CLOUDFLARE_PROXY_URL } from '../src/lib/telegram';
import { getCachedPdf, savePdfToCache } from '../src/lib/pdfCache';
import { getSecureTime } from '../src/lib/serverTime';

// ── Helpers ────────────────────────────────────────────────────────
const normalizeSA = (s: string) =>
    s.trim().replace(',', '.').toLowerCase();

const emptyMC = () => Array(18).fill('');
const emptyTF = (): ExamTFAnswer[] => Array(4).fill(null).map(() => ({ a: '', b: '', c: '', d: '' }));
const emptySA = () => Array(6).fill('');

// Score calculator
export const calcScore = (submission: ExamSubmission, answers: Exam['answers']) => {
    // Phần I: trắc nghiệm
    let mcScore = 0;
    let correctCount = 0;
    submission.mc.forEach((ans, i) => {
        if (ans && answers.mc[i] && ans === answers.mc[i]) {
            mcScore += 0.25;
            correctCount++;
        }
    });

    // Phần II: đúng/sai
    let tfScore = 0;
    const tfBreakdown: number[] = [];
    const tfKeys: (keyof ExamTFAnswer)[] = ['a', 'b', 'c', 'd'];
    submission.tf.forEach((stuTF, qi) => {
        const corTF = answers.tf[qi];
        const correctItemsCount = tfKeys.filter(k => stuTF[k] && corTF[k] && stuTF[k] === corTF[k]).length;
        tfBreakdown.push(correctItemsCount);
        if (correctItemsCount === 1) tfScore += 0.1;
        else if (correctItemsCount === 2) tfScore += 0.25;
        else if (correctItemsCount === 3) tfScore += 0.5;
        else if (correctItemsCount === 4) {
            tfScore += 1.0;
            correctCount++;
        }
    });

    // Phần III: trả lời ngắn
    let saScore = 0;
    submission.sa.forEach((ans, i) => {
        const correct = answers.sa[i];
        if (ans && correct && normalizeSA(ans) === normalizeSA(correct)) {
            saScore += 0.25;
            correctCount++;
        }
    });

    return {
        mc: Math.round(mcScore * 100) / 100,
        tf: Math.round(tfScore * 100) / 100,
        sa: Math.round(saScore * 100) / 100,
        total: Math.round((mcScore + tfScore + saScore) * 100) / 100,
        correctCount: correctCount,
        tfBreakdown,
    };
};

// Format time mm:ss
const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
};

interface ExamViewProps {
    exam: Exam;
    onBack: () => void;
    onSubmit: (submission: ExamSubmission) => void;
    isPreviewMode?: boolean;
    onShowToast?: (message: string, type: 'success' | 'error' | 'warning') => void;
}

const ExamView: React.FC<ExamViewProps> = ({ exam, onBack, onSubmit, isPreviewMode, onShowToast }) => {
    const [mc, setMC] = useState<string[]>(emptyMC());
    const [tf, setTF] = useState<ExamTFAnswer[]>(emptyTF());
    const [sa, setSA] = useState<string[]>(emptySA());
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);       // blob: URL cho iframe desktop + mobile
    const [pdfLoading, setPdfLoading] = useState(true);
    const [showConfirm, setShowConfirm] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    // Sau khi học sinh bấm "Xem đề thi" trên mobile → ẩn khu vực PDF, full-screen form
    const [hasViewedPdf, setHasViewedPdf] = useState(false);

    // Thiết bị mobile/tablet (để ẩn iframe và hiện nút link thật)
    const [isMobileDevice] = useState(() => {
        const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        return isTouch || isMobileUA;
    });

    const startTime = useRef<number | null>(null); // null = chưa bắt đầu tính giờ
    const [iframeReady, setIframeReady] = useState(false); // true khi iframe render xong PDF
    const objectUrlRef = useRef<string | null>(null); // giữ objectURL để revoke khi unmount

    // Security Check: Block direct URL access before scheduled time (bypass for admins via isPreviewMode)
    if (!isPreviewMode && exam.scheduledAt && getSecureTime() < exam.scheduledAt) {
        return (
            <div className="flex flex-col items-center justify-center p-8 bg-white rounded-xl shadow-sm border border-red-100 min-h-[50vh] text-center max-w-2xl mx-auto mt-12">
                <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
                <h2 className="text-xl font-bold text-red-700">TỪ CHỐI TRUY CẬP</h2>
                <p className="text-sm mt-2 text-gray-600">
                    Đề thi <b>"{exam.title}"</b> chưa được mở. Vui lòng quay lại danh sách chờ đến giờ thi.
                </p>
                <button
                    onClick={onBack}
                    className="mt-6 px-6 py-2.5 bg-[#F1F0EC] text-[#57564F] font-semibold rounded-lg hover:bg-[#E9E9E7] transition-colors"
                >
                    Trở về danh sách
                </button>
            </div>
        );
    }

    const ACCENT = '#6B7CDB';
    const tf_keys: (keyof ExamTFAnswer)[] = ['a', 'b', 'c', 'd'];

    // ── Load PDF: Cache (Blob) → Cloudflare Proxy ──
    useEffect(() => {
        let cancelled = false;


        const load = async () => {
            try {
                // ① Kiểm tra IndexedDB cache trước (nhanh nhất, ≈ 0ms)
                // Truyền fileId để cache key bao gồm version file — tự invalidate khi admin đổi đề
                const cachedBlob = await getCachedPdf(exam.id, exam.pdfTelegramFileId);
                if (cachedBlob && !cancelled) {
                    const url = URL.createObjectURL(cachedBlob);
                    objectUrlRef.current = url;
                    setPdfUrl(url);
                    setPdfLoading(false);
                    console.log('[PDF] ✅ Loaded from cache (Blob)');
                    return;
                }

                // ② Lấy PDF qua Cloudflare Proxy
                const proxyUrl = `${CLOUDFLARE_PROXY_URL}/getFile/${exam.pdfTelegramFileId}`;
                const res = await fetch(proxyUrl);
                if (!res.ok) throw new Error(`Cloudflare proxy lỗi: ${res.status}`);

                // Force MIME type application/pdf để iframe luôn render đúng
                const buffer = await res.arrayBuffer();
                const blob = new Blob([buffer], { type: 'application/pdf' });
                console.log('[PDF] ✅ Loaded via Cloudflare proxy (Blob)');

                if (!cancelled) {
                    savePdfToCache(exam.id, blob, exam.pdfTelegramFileId);
                    const url = URL.createObjectURL(blob);
                    objectUrlRef.current = url;
                    setPdfUrl(url);
                }
            } catch (err) {
                console.error('[PDF] Lỗi không xử lý được:', err);
            } finally {
                if (!cancelled) setPdfLoading(false);
            }
        };

        load();

        return () => {
            cancelled = true;
            if (objectUrlRef.current) {
                URL.revokeObjectURL(objectUrlRef.current);
                objectUrlRef.current = null;
            }
        };
    }, [exam.id, exam.pdfTelegramFileId]);

    // ✅ FIX: Chốt startTime đúng lúc iframe render xong — chính xác 100%
    useEffect(() => {
        if (iframeReady && startTime.current === null) {
            startTime.current = Date.now();
        }
    }, [iframeReady]);

    // Reset iframeReady nếu đề đổi (trường hợp admin preview nhiều đề)
    useEffect(() => {
        setIframeReady(false);
    }, [exam.id]);

    // ── Countdown ──
    const handleSubmitFinal = useCallback(() => {
        if (isPreviewMode) {
            if (onShowToast) {
                onShowToast('Bạn đang ở chế độ xem trước (Preview Mode). Hãy đăng nhập bằng tài khoản học sinh để thao tác.', 'warning');
            }
            setShowConfirm(false);
            return;
        }
        if (submitted) return;
        setSubmitted(true);
        const submission: ExamSubmission = {
            examId: exam.id,
            mc, tf, sa,
            submittedAt: Date.now(),
            // ✅ FIX: timeTaken tính từ lúc PDF hiện ra, không phải lúc vào trang
            timeTaken: Math.round((Date.now() - (startTime.current ?? Date.now())) / 1000),
        };
        onSubmit(submission);
    }, [submitted, mc, tf, sa, exam.id, onSubmit, isPreviewMode, onShowToast]);

    const toggleMC = (i: number, letter: string) =>
        setMC(prev => { const arr = [...prev]; arr[i] = arr[i] === letter ? '' : letter; return arr; });

    const toggleTF = (qi: number, key: keyof ExamTFAnswer, v: 'D' | 'S') =>
        setTF(prev => prev.map((item, i) => i === qi ? { ...item, [key]: item[key] === v ? '' : v } : item));

    const setSAVal = (i: number, v: string) =>
        setSA(prev => { const arr = [...prev]; arr[i] = v; return arr; });

    const answeredCount = mc.filter(Boolean).length
        + tf.filter(t => t.a || t.b || t.c || t.d).length
        + sa.filter(Boolean).length;
    const totalQ = 18 + 4 + 6;

    return (
        <div className="fixed inset-0 z-[100] flex flex-col" style={{ background: '#1A1A1A' }}>

            {/* ── Top Bar ── */}
            <div
                className="flex items-center justify-between px-4 py-2.5 shrink-0"
                style={{ background: '#242424', borderBottom: '1px solid #333' }}
            >
                <button
                    onClick={onBack}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors"
                    style={{ color: '#787774' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#3B3B3B'; (e.currentTarget as HTMLElement).style.color = '#fff'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#787774'; }}
                >
                    <ChevronLeft className="w-4 h-4" /> Thoát
                </button>

                <div className="text-center min-w-0 px-4 flex-1 flex flex-col items-center justify-center">
                    <div className="flex items-center justify-center gap-2 max-w-full">
                        <div className="w-6 h-6 rounded flex items-center justify-center shrink-0" style={{ background: '#3B3B3B' }}>
                            <FileText className="w-3.5 h-3.5" style={{ color: '#E03E3E' }} />
                        </div>
                        <p className="font-semibold text-sm truncate" style={{ color: '#E5E5E4' }}>{exam.title}</p>
                        {isPreviewMode && (
                            <span
                                className="hidden md:inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded shrink-0"
                                style={{ background: '#3B3B3B', color: '#AEACA8' }}
                            >
                                Chỉ xem
                            </span>
                        )}
                    </div>
                    <p className="text-[10px] mt-0.5" style={{ color: '#AEACA8' }}>{answeredCount}/{totalQ} câu đã làm</p>
                </div>

                <ExamCountdownTimer
                    initialSeconds={exam.duration * 60}
                    onTimeUp={handleSubmitFinal}
                    paused={!iframeReady} // ✅ FIX: Chờ iframe render xong mới bắt đầu đếm
                />
            </div>

            {/* ── Main Content ── */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">

                {/* PDF Viewer — Desktop: always visible | Mobile: ẩn sau khi học sinh đã bấm "Xem đề" */}
                {(!isMobileDevice || !hasViewedPdf) && (
                <div className={`overflow-hidden relative ${isMobileDevice ? 'shrink-0' : 'flex-1 min-h-0'}`}>
                    {pdfLoading ? (
                        <div className="flex flex-col items-center justify-center gap-3 py-10" style={{ background: '#1A1A1A' }}>
                            <RefreshCw className="w-8 h-8 animate-spin" style={{ color: ACCENT }} />
                            <p className="text-sm" style={{ color: '#AEACA8' }}>Đang tải đề thi...</p>
                        </div>
                    ) : pdfUrl ? (
                        <>
                            {/* Desktop: iframe nhúng — ẩn cho đến khi render xong Base64 */}
                            {!isMobileDevice && (
                                <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
                                    {/* Loading overlay — hiện khi iframe chưa sẵn sàng */}
                                    {!iframeReady && (
                                        <div
                                            className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10"
                                            style={{ background: '#1A1A1A' }}
                                        >
                                            <RefreshCw className="w-8 h-8 animate-spin" style={{ color: ACCENT }} />
                                            <p className="text-sm" style={{ color: '#AEACA8' }}>Đang hiển thị đề thi...</p>
                                        </div>
                                    )}
                                    <iframe
                                        src={`${pdfUrl}#navpanes=0`}
                                        title="PDF Preview"
                                        onLoad={() => setIframeReady(true)} // ✅ FIX: Bật đồng hồ khi PDF render xong
                                        style={{
                                            width: '100%',
                                            height: 'calc(100% + 56px)',
                                            marginTop: '-56px',
                                            border: 'none',
                                            display: 'block',
                                            opacity: iframeReady ? 1 : 0, // Tàng hình cho đến khi render xong
                                            transition: 'opacity 0.3s ease',
                                        }}
                                    />
                                </div>
                            )}
                            {/* Mobile/Tablet: nút mở tab mới — bấm xong sẽ collapse khu vực này */}
                            {isMobileDevice && (
                                <div className="flex flex-col items-center justify-center gap-4 py-8 bg-[#1A1A1A]">
                                    <FileText className="w-10 h-10" style={{ color: ACCENT }} />
                                    <p className="text-xs text-center px-6" style={{ color: '#AEACA8' }}>
                                        Bấm để mở đề thi, sau đó quay lại tab này điền đáp án.
                                    </p>
                                    <button
                                        onClick={() => {
                                            if (pdfUrl) window.open(pdfUrl, '_blank');
                                            setHasViewedPdf(true);
                                        }}
                                        className="px-6 py-3 rounded-xl text-sm font-bold text-white flex items-center gap-2 transition-all active:scale-95"
                                        style={{ background: ACCENT }}
                                    >
                                        <FileText className="w-4 h-4" />
                                        Xem đề thi
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center gap-2 py-10" style={{ background: '#1A1A1A' }}>
                            <AlertTriangle className="w-8 h-8" style={{ color: '#D9730D' }} />
                            <p className="text-sm" style={{ color: '#AEACA8' }}>Không tải được đề thi.</p>
                        </div>
                    )}
                </div>
                )}

                {/* ── Answer Panel ── */}
                <div
                    className={`flex flex-col overflow-hidden shrink-0 ${isMobileDevice && hasViewedPdf ? 'flex-1' : 'w-full md:w-[280px]'}`}
                    style={{ background: '#1E1E1E', borderLeft: 'none', borderTop: isMobileDevice && hasViewedPdf ? 'none' : '1px solid #333' }}
                >
                    {/* Nút mở lại đề (fallback) — chỉ hiện trên mobile sau khi đã bấm Xem đề */}
                    {isMobileDevice && hasViewedPdf && pdfUrl && (
                        <div className="flex items-center justify-between px-4 py-2 shrink-0" style={{ borderBottom: '1px solid #2D2D2D', background: '#242424' }}>
                            <span className="text-xs" style={{ color: '#787774' }}>Điền đáp án bên dưới</span>
                            <button
                                onClick={() => { if (pdfUrl) window.open(pdfUrl, '_blank'); }}
                                className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg transition-all active:scale-95"
                                style={{ color: ACCENT, background: '#2A2A2A', border: `1px solid ${ACCENT}33` }}
                            >
                                <FileText className="w-3 h-3" />
                                Mở lại đề
                            </button>
                        </div>
                    )}
                    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6" style={{ scrollbarWidth: 'thin', scrollbarColor: '#3B3B3B #1E1E1E' }}>

                        {/* Phần I */}
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0" style={{ background: ACCENT, color: '#fff' }}>I</div>
                                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#C7C4B8' }}>Trắc nghiệm ABCD</p>
                                <span className="text-[10px] ml-auto" style={{ color: '#787774' }}>4.5đ</span>
                            </div>
                            <div className="space-y-2">
                                {mc.map((val, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <span className="text-xs font-medium w-12 shrink-0 text-right" style={{ color: '#787774' }}>Câu {i + 1}</span>
                                        <div className="flex gap-1 flex-1">
                                            {['A', 'B', 'C', 'D'].map(letter => (
                                                <button
                                                    key={letter}
                                                    onClick={() => toggleMC(i, letter)}
                                                    className="flex-1 py-1 rounded-md text-xs font-bold transition-all active:scale-90"
                                                    style={{
                                                        background: val === letter ? ACCENT : '#2A2A2A',
                                                        color: val === letter ? '#fff' : '#787774',
                                                        border: val === letter ? `1px solid ${ACCENT}` : '1px solid #333'
                                                    }}
                                                >{letter}</button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div style={{ height: '1px', background: '#2D2D2D' }} />

                        {/* Phần II */}
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0" style={{ background: '#7C4FAE', color: '#fff' }}>II</div>
                                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#C7C4B8' }}>Đúng / Sai</p>
                                <span className="text-[10px] ml-auto" style={{ color: '#787774' }}>4đ</span>
                            </div>
                            <div className="space-y-3">
                                {tf.map((tfAns, qi) => (
                                    <div key={qi} className="p-3 rounded-lg" style={{ background: '#242424', border: '1px solid #333' }}>
                                        <p className="text-xs font-semibold mb-2" style={{ color: '#E5E5E4' }}>Câu {19 + qi}</p>
                                        <div className="space-y-1.5">
                                            {tf_keys.map(key => (
                                                <div key={key} className="flex items-center gap-2">
                                                    <span className="text-[11px] font-semibold w-5" style={{ color: '#787774' }}>{key})</span>
                                                    <div className="flex gap-1.5">
                                                        {(['D', 'S'] as const).map(v => (
                                                            <button
                                                                key={v}
                                                                onClick={() => toggleTF(qi, key, v)}
                                                                className="px-2.5 py-1 rounded-md text-[11px] font-bold transition-all active:scale-90"
                                                                style={{
                                                                    background: tfAns[key] === v
                                                                        ? (v === 'D' ? '#059669' : '#DC2626')
                                                                        : '#2A2A2A',
                                                                    color: tfAns[key] === v ? '#fff' : '#787774',
                                                                    border: `1px solid ${tfAns[key] === v ? (v === 'D' ? '#059669' : '#DC2626') : '#333'}`,
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

                        <div style={{ height: '1px', background: '#2D2D2D' }} />

                        {/* Phần III */}
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0" style={{ background: '#D9730D', color: '#fff' }}>III</div>
                                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#C7C4B8' }}>Trả lời ngắn</p>
                                <span className="text-[10px] ml-auto" style={{ color: '#787774' }}>1.5đ</span>
                            </div>
                            <div className="space-y-2">
                                {sa.map((val, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <span className="text-xs font-medium w-12 shrink-0 text-right" style={{ color: '#787774' }}>Câu {23 + i}</span>
                                        <input
                                            type="text"
                                            value={val}
                                            onChange={e => setSAVal(i, e.target.value)}
                                            placeholder="Đáp án..."
                                            className="flex-1 px-3 py-1.5 rounded-lg text-sm outline-none transition-all"
                                            style={{ border: '1px solid #333', background: '#2A2A2A', color: '#E5E5E4', minWidth: 0 }}
                                            onFocus={e => (e.target as HTMLElement).style.borderColor = '#D9730D'}
                                            onBlur={e => (e.target as HTMLElement).style.borderColor = '#333'}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Submit Button */}
                    <div className="p-4 shrink-0" style={{ borderTop: '1px solid #2D2D2D' }}>
                        <button
                            onClick={() => setShowConfirm(true)}
                            disabled={submitted}
                            className="w-full py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                            style={{ background: '#E03E3E', color: '#fff' }}
                            onMouseEnter={e => { if (!submitted) (e.currentTarget as HTMLElement).style.background = '#c5302d'; }}
                            onMouseLeave={e => { if (!submitted) (e.currentTarget as HTMLElement).style.background = '#E03E3E'; }}
                        >
                            <Send className="w-4 h-4" />
                            Nộp Bài
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Confirm Submit Dialog ── */}
            {showConfirm && (
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center"
                    style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
                >
                    <div className="rounded-2xl p-6 w-full max-w-sm mx-4" style={{ background: '#1E1E1E', border: '1px solid #333', boxShadow: '0 16px 48px rgba(0,0,0,0.4)' }}>
                        <div className="text-center space-y-4">
                            <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center" style={{ background: '#2D1F12', border: '1px solid #633309' }}>
                                <AlertTriangle className="w-7 h-7" style={{ color: '#D9730D' }} />
                            </div>
                            <div>
                                <h3 className="font-semibold text-base" style={{ color: '#E5E5E4' }}>Xác nhận nộp bài?</h3>
                                <p className="text-sm mt-1" style={{ color: '#AEACA8' }}>
                                    Bạn đã làm <strong style={{ color: '#fff' }}>{answeredCount}/{totalQ}</strong> câu.
                                    Sau khi nộp không thể sửa được nữa.
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowConfirm(false)}
                                    className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors"
                                    style={{ background: '#333', color: '#E5E5E4' }}
                                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#444'}
                                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#333'}
                                >Tiếp tục làm</button>
                                <button
                                    onClick={() => { setShowConfirm(false); handleSubmitFinal(); }}
                                    className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95"
                                    style={{ background: '#E03E3E', color: '#fff' }}
                                >Nộp bài</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExamView;
