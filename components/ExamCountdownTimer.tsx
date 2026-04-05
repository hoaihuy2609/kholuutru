import React, { useState, useEffect, useRef } from 'react';
import { Clock } from 'lucide-react';

interface ExamCountdownTimerProps {
    initialSeconds: number;
    onTimeUp: () => void;
    paused?: boolean; // Đóng băng đồng hồ khi PDF chưa load xong
}

const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
};

const ACCENT = '#6B7CDB';

const ExamCountdownTimer: React.FC<ExamCountdownTimerProps> = ({ initialSeconds, onTimeUp, paused = false }) => {
    const [secondsLeft, setSecondsLeft] = useState(initialSeconds);

    // ✅ FIX CRITICAL: Dùng ref để luôn gọi phiên bản mới nhất của onTimeUp
    // mà không cần đặt nó vào dependency array — tránh timer reset mỗi khi
    // học sinh điền đáp án (mc/tf/sa thay đổi → handleSubmitFinal mới → onTimeUp mới
    // → useEffect re-run → đồng hồ về đầu, mất thời gian thi!)
    const onTimeUpRef = useRef(onTimeUp);
    useEffect(() => { onTimeUpRef.current = onTimeUp; }, [onTimeUp]);

    useEffect(() => {
        // Chỉ chạy đồng hồ sau khi PDF đã load xong (paused = false)
        if (paused) return;
        const timer = setInterval(() => {
            setSecondsLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    onTimeUpRef.current(); // luôn gọi callback mới nhất qua ref
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [paused]); // ✅ Chỉ depend vào paused — timer không reset khi học sinh điền đáp án

    const pct = secondsLeft / initialSeconds;
    const isUrgent = secondsLeft <= 120;

    return (
        <>
            <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono font-bold text-sm transition-all"
                style={{
                    background: isUrgent ? 'rgba(224, 62, 62, 0.1)' : '#3B3B3B',
                    color: isUrgent ? '#E03E3E' : '#C7C4B8',
                    border: `1px solid ${isUrgent ? 'rgba(224, 62, 62, 0.2)' : 'transparent'}`,
                    animation: isUrgent ? 'pulse 1s infinite' : 'none',
                    marginRight: '1rem', // added this so it looks identical to original since we extracted it out of its flex parent slightly different
                }}
            >
                <Clock className="w-4 h-4 shrink-0" />
                {formatTime(secondsLeft)}
            </div>

            {/* Timer progress bar (Absolute layout across the top) */}
            <div className="absolute top-[57.8px] left-0 right-0 w-full h-1 shrink-0 z-[101]" style={{ background: '#333' }}>
                <div
                    className="h-full transition-all duration-1000"
                    style={{
                        width: `${pct * 100}%`,
                        background: isUrgent ? 'linear-gradient(90deg,#E03E3E,#F87171)' : `linear-gradient(90deg,${ACCENT},#93ACFF)`,
                    }}
                />
            </div>
        </>
    );
};

export default React.memo(ExamCountdownTimer);
