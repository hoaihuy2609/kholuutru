import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Clock, ChevronLeft, Send, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
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

    // ── Load PDF from Telegram ──
    useEffect(() => {
        let objectUrl = '';
        const load = async () => {
            try {
                // 1. Lấy download URL từ Telegram API
                const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getFile?file_id=${exam.pdfTelegramFileId}`);
                const data = await res.json();
                if (!data.ok) throw new Error('Không lấy được link PDF');
                const filePath = data.result.file_path;
                const downloadUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${filePath}`;

                // 2. Fetch binary rồi tạo Blob URL
                const pdfRes = await fetch(downloadUrl);
                const blob = await pdfRes.blob();
                objectUrl = URL.createObjectURL(blob);
                setPdfUrl(objectUrl);
            } catch (err) {
                console.error('Lỗi load PDF:', err);
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
        <div className="fixed inset-0 z-40 flex flex-col" style={{ background: '#F7F6F3' }}>

            {/* ── Top Bar ── */}
            <div
                className="flex items-center justify-between px-4 py-3 shrink-0"
                style={{ background: '#fff', borderBottom: '1px solid #E9E9E7', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
            >
                <button
                    onClick={onBack}
                    className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-colors"
                    style={{ color: '#57564F' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F1F0EC'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                    <ChevronLeft className="w-4 h-4" /> Thoát
                </button>

                <div className="text-center min-w-0 px-4">
                    <p className="font-semibold text-sm truncate" style={{ color: '#1A1A1A' }}>{exam.title}</p>
                    <p className="text-xs" style={{ color: '#AEACA8' }}>{answeredCount}/{totalQ} câu đã làm</p>
                </div>

                {/* Timer */}
                <div
                    className="flex items-center gap-2 px-4 py-2 rounded-xl font-mono font-bold text-base transition-all"
                    style={{
                        background: isUrgent ? '#FEF2F2' : '#EEF0FB',
                        color: isUrgent ? '#E03E3E' : ACCENT,
                        border: `1.5px solid ${isUrgent ? '#FECACA' : '#C7CEFF'}`,
                        animation: isUrgent ? 'pulse 1s infinite' : 'none',
                    }}
                >
                    <Clock className="w-4 h-4 shrink-0" />
                    {formatTime(secondsLeft)}
                </div>
            </div>

            {/* Timer progress bar */}
            <div className="w-full h-1 shrink-0" style={{ background: '#E9E9E7' }}>
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
                <div className="flex-1 overflow-hidden relative" style={{ borderRight: '1px solid #E9E9E7' }}>
                    {pdfLoading ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3" style={{ background: '#F7F6F3' }}>
                            <RefreshCw className="w-8 h-8 animate-spin" style={{ color: ACCENT }} />
                            <p className="text-sm" style={{ color: '#787774' }}>Đang tải đề thi...</p>
                        </div>
                    ) : pdfUrl ? (
                        <object
                            data={pdfUrl}
                            type="application/pdf"
                            className="w-full h-full"
                            style={{ display: 'block' }}
                        >
                            <div className="flex flex-col items-center justify-center h-full gap-3">
                                <p className="text-sm" style={{ color: '#787774' }}>Trình duyệt không hỗ trợ xem PDF trực tiếp.</p>
                                <a href={pdfUrl} target="_blank" rel="noopener noreferrer"
                                    className="px-4 py-2 rounded-lg text-sm font-medium"
                                    style={{ background: ACCENT, color: '#fff' }}>
                                    Mở PDF trong tab mới
                                </a>
                            </div>
                        </object>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full gap-2">
                            <AlertTriangle className="w-8 h-8" style={{ color: '#D9730D' }} />
                            <p className="text-sm" style={{ color: '#787774' }}>Không tải được đề thi.</p>
                        </div>
                    )}
                </div>

                {/* ── Answer Panel ── */}
                <div
                    className="w-72 flex flex-col overflow-hidden shrink-0"
                    style={{ background: '#fff' }}
                >
                    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">

                        {/* Phần I */}
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0" style={{ background: ACCENT, color: '#fff' }}>I</div>
                                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#57564F' }}>Trắc nghiệm ABCD</p>
                                <span className="text-[10px] ml-auto" style={{ color: '#AEACA8' }}>4.5đ</span>
                            </div>
                            <div className="space-y-2">
                                {mc.map((val, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <span className="text-xs font-medium w-12 shrink-0 text-right" style={{ color: '#787774' }}>Câu {i + 1}</span>
                                        <div className="flex gap-1">
                                            {['A', 'B', 'C', 'D'].map(letter => (
                                                <button
                                                    key={letter}
                                                    onClick={() => toggleMC(i, letter)}
                                                    className="w-7 h-7 rounded-md text-xs font-bold transition-all active:scale-90"
                                                    style={{
                                                        background: val === letter ? ACCENT : '#F1F0EC',
                                                        color: val === letter ? '#fff' : '#57564F',
                                                    }}
                                                >{letter}</button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div style={{ height: '1px', background: '#F1F0EC' }} />

                        {/* Phần II */}
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0" style={{ background: '#7C4FAE', color: '#fff' }}>II</div>
                                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#57564F' }}>Đúng / Sai</p>
                                <span className="text-[10px] ml-auto" style={{ color: '#AEACA8' }}>4đ</span>
                            </div>
                            <div className="space-y-3">
                                {tf.map((tfAns, qi) => (
                                    <div key={qi} className="p-3 rounded-xl" style={{ background: '#F7F6F3' }}>
                                        <p className="text-xs font-semibold mb-2" style={{ color: '#57564F' }}>Câu {19 + qi}</p>
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
                                                                        ? (v === 'D' ? '#16A34A' : '#E03E3E')
                                                                        : '#fff',
                                                                    color: tfAns[key] === v ? '#fff' : '#57564F',
                                                                    border: `1px solid ${tfAns[key] === v ? (v === 'D' ? '#16A34A' : '#E03E3E') : '#E9E9E7'}`,
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

                        <div style={{ height: '1px', background: '#F1F0EC' }} />

                        {/* Phần III */}
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0" style={{ background: '#D9730D', color: '#fff' }}>III</div>
                                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#57564F' }}>Trả lời ngắn</p>
                                <span className="text-[10px] ml-auto" style={{ color: '#AEACA8' }}>1.5đ</span>
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
                                            style={{ border: '1.5px solid #E9E9E7', background: '#F7F6F3', color: '#1A1A1A', minWidth: 0 }}
                                            onFocus={e => (e.target as HTMLElement).style.borderColor = '#D9730D'}
                                            onBlur={e => (e.target as HTMLElement).style.borderColor = '#E9E9E7'}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Submit Button */}
                    <div className="p-4 shrink-0" style={{ borderTop: '1px solid #E9E9E7' }}>
                        <button
                            onClick={() => setShowConfirm(true)}
                            disabled={submitted}
                            className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
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
                    className="fixed inset-0 z-50 flex items-center justify-center"
                    style={{ background: 'rgba(26,26,26,0.5)', backdropFilter: 'blur(4px)' }}
                >
                    <div className="rounded-2xl p-6 w-full max-w-sm mx-4" style={{ background: '#fff', boxShadow: '0 16px 48px rgba(0,0,0,0.16)' }}>
                        <div className="text-center space-y-4">
                            <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center" style={{ background: '#FFF7ED', border: '1px solid #FED7AA' }}>
                                <AlertTriangle className="w-7 h-7" style={{ color: '#D9730D' }} />
                            </div>
                            <div>
                                <h3 className="font-semibold text-base" style={{ color: '#1A1A1A' }}>Xác nhận nộp bài?</h3>
                                <p className="text-sm mt-1" style={{ color: '#787774' }}>
                                    Bạn đã làm <strong>{answeredCount}/{totalQ}</strong> câu.
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
                                    style={{ background: '#F1F0EC', color: '#57564F' }}
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
