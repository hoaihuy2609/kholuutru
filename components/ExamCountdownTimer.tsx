import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface ExamCountdownTimerProps {
    initialSeconds: number;
    onTimeUp: () => void;
}

const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
};

const ACCENT = '#6B7CDB';

const ExamCountdownTimer: React.FC<ExamCountdownTimerProps> = ({ initialSeconds, onTimeUp }) => {
    const [secondsLeft, setSecondsLeft] = useState(initialSeconds);

    useEffect(() => {
        const timer = setInterval(() => {
            setSecondsLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    onTimeUp();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [onTimeUp]); // only dependent on onTimeUp

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
