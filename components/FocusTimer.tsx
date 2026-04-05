import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Timer, Hourglass } from 'lucide-react';

const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const formatStopwatch = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const FocusTimer: React.FC = () => {
    const [mode, setMode] = useState<'stopwatch' | 'pomodoro'>('pomodoro');
    const [timeLength, setTimeLength] = useState(25 * 60);
    const [timeLeft, setTimeLeft] = useState(25 * 60);
    const [timeElapsed, setTimeElapsed] = useState(0);
    const [isRunning, setIsRunning] = useState(false);

    const timerRef = useRef<number | null>(null);
    const shouldStopRef = useRef(false); // sync flag to prevent extra tick
    const ACCENT = '#448361'; // Xanh lá cây đậm

    useEffect(() => {
        if (isRunning) {
            shouldStopRef.current = false;
            timerRef.current = window.setInterval(() => {
                if (mode === 'pomodoro') {
                    setTimeLeft((prev) => {
                        if (prev <= 1) {
                            // Mark stop synchronously so interval doesn't fire again
                            shouldStopRef.current = true;
                            if (timerRef.current) {
                                clearInterval(timerRef.current);
                                timerRef.current = null;
                            }
                            setIsRunning(false);
                            return 0;
                        }
                        return prev - 1;
                    });
                } else {
                    if (!shouldStopRef.current) {
                        setTimeElapsed((prev) => prev + 1);
                    }
                }
            }, 1000);
        } else {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        }
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [isRunning, mode]);

    const handleToggle = () => setIsRunning(!isRunning);

    const handleReset = () => {
        setIsRunning(false);
        if (mode === 'pomodoro') setTimeLeft(timeLength);
        else setTimeElapsed(0);
    };

    const switchMode = (newMode: 'stopwatch' | 'pomodoro') => {
        setIsRunning(false);
        setMode(newMode);
        if (newMode === 'pomodoro') setTimeLeft(timeLength);
        else setTimeElapsed(0);
    };

    const setPomodoroLength = (minutes: number) => {
        setIsRunning(false);
        setTimeLength(minutes * 60);
        setTimeLeft(minutes * 60);
    };

    const progressPct = mode === 'pomodoro' ? ((timeLength - timeLeft) / timeLength) * 100 : 0;
    const isFinished = mode === 'pomodoro' && timeLeft === 0 && progressPct === 100;

    return (
        <div
            className="flex items-center w-[600px] shrink-0 h-[64px] bg-white rounded-full transition-all duration-300 relative overflow-hidden group hover:shadow-md"
            style={{
                border: `1px solid ${isRunning ? ACCENT + '40' : '#E9E9E7'}`,
                boxShadow: isRunning ? `0 4px 24px ${ACCENT}20` : '0 2px 12px rgba(0,0,0,0.04)'
            }}
        >
            {/* Thanh tiến trình chạy ngầm dưới đáy pill */}
            {mode === 'pomodoro' && (
                <div
                    className="absolute left-0 bottom-0 h-1.5 bg-[#448361] transition-all duration-1000 ease-linear opacity-80"
                    style={{ width: `${progressPct}%` }}
                />
            )}

            {/* Khối chọn chế độ - To hơn, click dễ hơn */}
            <div className="flex items-center h-full p-2 bg-[#F7F6F3] rounded-l-full border-r border-[#E9E9E7] mr-4 shadow-inner">
                <button
                    onClick={() => switchMode('pomodoro')}
                    className="flex items-center justify-center w-12 h-12 rounded-full transition-all"
                    style={{
                        background: mode === 'pomodoro' ? '#FFFFFF' : 'transparent',
                        color: mode === 'pomodoro' ? ACCENT : '#AEACA8',
                        boxShadow: mode === 'pomodoro' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none'
                    }}
                    title="Đếm ngược (Pomodoro)"
                >
                    <Hourglass className="w-5 h-5" />
                </button>
                <button
                    onClick={() => switchMode('stopwatch')}
                    className="flex items-center justify-center w-12 h-12 rounded-full transition-all"
                    style={{
                        background: mode === 'stopwatch' ? '#FFFFFF' : 'transparent',
                        color: mode === 'stopwatch' ? ACCENT : '#AEACA8',
                        boxShadow: mode === 'stopwatch' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none'
                    }}
                    title="Bấm giờ (Stopwatch)"
                >
                    <Timer className="w-5 h-5" />
                </button>
            </div>

            {/* Hiển thị thời gian - Font siêu to khổng lồ */}
            <div className="flex-1 flex items-center justify-center relative z-10 px-2">
                <span
                    className="font-mono text-4xl font-extrabold tracking-tight transition-colors duration-300"
                    style={{
                        color: isFinished ? '#10B981' : isRunning ? '#1A1A1A' : '#57564F',
                        fontVariantNumeric: 'tabular-nums'
                    }}
                >
                    {mode === 'pomodoro' ? formatTime(timeLeft) : formatStopwatch(timeElapsed)}
                </span>

                {/* Chỉ báo đang nhấp nháy khi chạy */}
                {isRunning && (
                    <span className="absolute top-1 right-8 w-2.5 h-2.5 rounded-full bg-[#10B981] animate-pulse shadow-[0_0_8px_#10B981]" />
                )}
            </div>

            {/* Các tùy chọn cài đặt phút (Chỉ hiện khi dừng Pomodoro) */}
            {mode === 'pomodoro' && !isRunning && timeLeft === timeLength && (
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-[#F7F6F3] transition-all mr-2">
                    {[15, 25, 45].map(m => (
                        <button
                            key={m}
                            onClick={() => setPomodoroLength(m)}
                            className="w-9 h-9 flex items-center justify-center rounded-full text-sm font-bold transition-all hover:bg-[#EAF3EE] hover:text-[#448361]"
                            style={{
                                background: timeLength === m * 60 ? '#EAF3EE' : 'transparent',
                                color: timeLength === m * 60 ? ACCENT : '#787774',
                            }}
                        >
                            {m}
                        </button>
                    ))}
                </div>
            )}

            {/* Khối điều khiển (Play/Pause/Reset) */}
            <div className="flex items-center gap-3 pr-3 pl-2 ml-auto">
                <button
                    onClick={handleReset}
                    className="w-10 h-10 flex items-center justify-center rounded-full transition-all hover:bg-[#F3F4F6] hover:rotate-[-45deg] active:scale-95"
                    title="Đặt lại"
                >
                    <RotateCcw className="w-5 h-5" style={{ color: '#AEACA8' }} />
                </button>

                <button
                    onClick={handleToggle}
                    className="w-12 h-12 flex items-center justify-center rounded-full transition-all active:scale-95 group/btn"
                    style={{
                        background: isRunning ? '#FAFAFA' : '#1A1A1A',
                        border: isRunning ? '2px solid #E9E9E7' : 'none',
                        color: isRunning ? '#1A1A1A' : '#FFFFFF',
                        boxShadow: isRunning ? 'none' : '0 6px 16px rgba(0,0,0,0.2)'
                    }}
                    title={isRunning ? "Tạm dừng" : "Bắt đầu"}
                >
                    {isRunning ? (
                        <Pause className="w-5 h-5 fill-current transition-transform group-hover/btn:scale-90" />
                    ) : (
                        <Play className="w-5 h-5 fill-current ml-1 transition-transform group-hover/btn:scale-110" />
                    )}
                </button>
            </div>

        </div>
    );
};

export default FocusTimer;
