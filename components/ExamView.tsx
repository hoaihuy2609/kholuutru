import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Clock, ChevronLeft, Send, AlertTriangle, CheckCircle, RefreshCw, FileText } from 'lucide-react';
import { Exam, ExamTFAnswer, ExamSubmission } from '../types';

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzlcTDkj2-GO1mdE6CZ1vaI5pBPWJAGZsChsQxpapw3eO0sKslB0tkNxam8l3Y4G5E8/exec";
const TELEGRAM_TOKEN = '7985901918:AAFK33yVAEPPKiAbiaMFCdz78TpOhBXeRr0';

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
    submission.mc.forEach((ans, i) => {
        if (ans && answers.mc[i] && ans === answers.mc[i]) mcScore += 0.25;
    });

    // Phần II: đúng/sai
    let tfScore = 0;
    const tfKeys: (keyof ExamTFAnswer)[] = ['a', 'b', 'c', 'd'];
    submission.tf.forEach((stuTF, qi) => {
        const corTF = answers.tf[qi];
        const correctCount = tfKeys.filter(k => stuTF[k] && corTF[k] && stuTF[k] === corTF[k]).length;
        if (correctCount === 1) tfScore += 0.1;
        else if (correctCount === 2) tfScore += 0.25;
        else if (correctCount === 3) tfScore += 0.5;
        else if (correctCount === 4) tfScore += 1.0;
    });

    // Phần III: trả lời ngắn
    let saScore = 0;
    submission.sa.forEach((ans, i) => {
        const correct = answers.sa[i];
        if (ans && correct && normalizeSA(ans) === normalizeSA(correct)) saScore += 0.25;
    });

    return {
        mc: Math.round(mcScore * 100) / 100,
        tf: Math.round(tfScore * 100) / 100,
        sa: Math.round(saScore * 100) / 100,
        total: Math.round((mcScore + tfScore + saScore) * 100) / 100,
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
}

const ExamView: React.FC<ExamViewProps> = ({ exam, onBack, onSubmit }) => {
    const [mc, setMC] = useState<string[]>(emptyMC());
    const [tf, setTF] = useState<ExamTFAnswer[]>(emptyTF());
    const [sa, setSA] = useState<string[]>(emptySA());
    const [secondsLeft, setSecondsLeft] = useState(exam.duration * 60);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [pdfLoading, setPdfLoading] = useState(true);
    const [showConfirm, setShowConfirm] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const startTime = useRef(Date.now());
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const ACCENT = '#6B7CDB';
    const tf_keys: (keyof ExamTFAnswer)[] = ['a', 'b', 'c', 'd'];

    // ── Load PDF from Telegram (via GAS proxy to avoid CORS) ──
    useEffect(() => {
        let objectUrl = '';
        const load = async () => {
            try {
                // Bước 1: Lấy file_path từ Telegram Bot API (không bị CORS)
                const metaRes = await fetch(
                    `https://api.telegram.org/bot${TELEGRAM_TOKEN}/getFile?file_id=${exam.pdfTelegramFileId}`
                );
                const metaData = await metaRes.json();
                if (!metaData.ok) throw new Error('Không lấy được link PDF từ Telegram');
                const filePath = metaData.result.file_path;

                // Bước 2: Dùng GAS proxy để tải binary PDF (tránh CORS của file CDN)
                const proxyUrl = `${GOOGLE_SCRIPT_URL}?action=proxy_pdf&file_path=${encodeURIComponent(filePath)}&token=${encodeURIComponent(TELEGRAM_TOKEN)}`;
                const pdfRes = await fetch(proxyUrl);

                if (!pdfRes.ok) throw new Error(`GAS proxy trả về lỗi: ${pdfRes.status}`);

                const contentType = pdfRes.headers.get('content-type') || '';

                if (contentType.includes('application/json')) {
                    // GAS trả về JSON với base64 data
                    const json = await pdfRes.json();
                    if (!json.success) throw new Error(json.error || 'GAS proxy thất bại');
                    // base64 → Blob
                    const base64 = json.data as string;
                    const byteChars = atob(base64);
                    const byteArr = new Uint8Array(byteChars.length);
                    for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
                    const blob = new Blob([byteArr], { type: 'application/pdf' });
                    objectUrl = URL.createObjectURL(blob);
                } else {
                    // GAS trả về binary trực tiếp
                    const blob = await pdfRes.blob();
                    objectUrl = URL.createObjectURL(blob);
                }

                setPdfUrl(objectUrl);
            } catch (err) {
                console.error('[ExamView] Lỗi load PDF:', err);
                // Fallback: thử dùng trực tiếp (có thể hoạt động trên một số trình duyệt)
                try {
                    const directRes = await fetch(
                        `https://api.telegram.org/bot${TELEGRAM_TOKEN}/getFile?file_id=${exam.pdfTelegramFileId}`
                    );
                    const directData = await directRes.json();
                    if (directData.ok) {
                        const directUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${directData.result.file_path}`;
                        const blobRes = await fetch(directUrl);
                        const blob = await blobRes.blob();
                        objectUrl = URL.createObjectURL(blob);
                        setPdfUrl(objectUrl);
                        return;
                    }
                } catch { /* ignore fallback error */ }
            } finally {
                setPdfLoading(false);
            }
        };
        load();
        return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
    }, [exam.pdfTelegramFileId]);

    // ── Countdown ──
    const handleSubmitFinal = useCallback(() => {
        if (submitted) return;
        setSubmitted(true);
        if (timerRef.current) clearInterval(timerRef.current);
        const submission: ExamSubmission = {
            examId: exam.id,
            mc, tf, sa,
            submittedAt: Date.now(),
            timeTaken: Math.round((Date.now() - startTime.current) / 1000),
        };
        onSubmit(submission);
    }, [submitted, mc, tf, sa, exam.id, onSubmit]);

    useEffect(() => {
        timerRef.current = setInterval(() => {
            setSecondsLeft(prev => {
                if (prev <= 1) {
                    handleSubmitFinal();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [handleSubmitFinal]);

    const toggleMC = (i: number, letter: string) =>
        setMC(prev => { const arr = [...prev]; arr[i] = arr[i] === letter ? '' : letter; return arr; });

    const toggleTF = (qi: number, key: keyof ExamTFAnswer, v: 'D' | 'S') =>
        setTF(prev => prev.map((item, i) => i === qi ? { ...item, [key]: item[key] === v ? '' : v } : item));

    const setSAVal = (i: number, v: string) =>
        setSA(prev => { const arr = [...prev]; arr[i] = v; return arr; });

    const pct = secondsLeft / (exam.duration * 60);
    const isUrgent = secondsLeft <= 120;

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
                        <span
                            className="hidden md:inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded shrink-0"
                            style={{ background: '#3B3B3B', color: '#AEACA8' }}
                        >
                            Chỉ xem
                        </span>
                    </div>
                    <p className="text-[10px] mt-0.5" style={{ color: '#AEACA8' }}>{answeredCount}/{totalQ} câu đã làm</p>
                </div>

                {/* Timer */}
                <div
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono font-bold text-sm transition-all"
                    style={{
                        background: isUrgent ? 'rgba(224, 62, 62, 0.1)' : '#3B3B3B',
                        color: isUrgent ? '#E03E3E' : '#C7C4B8',
                        border: `1px solid ${isUrgent ? 'rgba(224, 62, 62, 0.2)' : 'transparent'}`,
                        animation: isUrgent ? 'pulse 1s infinite' : 'none',
                    }}
                >
                    <Clock className="w-4 h-4 shrink-0" />
                    {formatTime(secondsLeft)}
                </div>
            </div>

            {/* Timer progress bar */}
            <div className="w-full h-1 shrink-0" style={{ background: '#333' }}>
                <div
                    className="h-full transition-all duration-1000"
                    style={{
                        width: `${pct * 100}%`,
                        background: isUrgent ? 'linear-gradient(90deg,#E03E3E,#F87171)' : `linear-gradient(90deg,${ACCENT},#93ACFF)`,
                    }}
                />
            </div>

            {/* ── Main Content ── */}
            <div className="flex-1 flex overflow-hidden">

                {/* PDF Viewer */}
                <div className="flex-1 overflow-hidden relative">
                    {pdfLoading ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3" style={{ background: '#1A1A1A' }}>
                            <RefreshCw className="w-8 h-8 animate-spin" style={{ color: ACCENT }} />
                            <p className="text-sm" style={{ color: '#AEACA8' }}>Đang tải đề thi...</p>
                        </div>
                    ) : pdfUrl ? (
                        <iframe
                            src={`${pdfUrl}#toolbar=0`}
                            className="w-full h-full border-0 block"
                            title="PDF Preview"
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full gap-2" style={{ background: '#1A1A1A' }}>
                            <AlertTriangle className="w-8 h-8" style={{ color: '#D9730D' }} />
                            <p className="text-sm" style={{ color: '#AEACA8' }}>Không tải được đề thi.</p>
                        </div>
                    )}
                </div>

                {/* ── Answer Panel ── */}
                <div
                    className="w-[280px] flex flex-col overflow-hidden shrink-0"
                    style={{ background: '#1E1E1E', borderLeft: '1px solid #333' }}
                >
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
                                <p className="text-sm mt-1 font-mono" style={{ color: '#D9730D' }}>
                                    Còn lại: {formatTime(secondsLeft)}
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
