import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, Timer, Hourglass } from 'lucide-react';

interface StudyTimerProps {
  fileId: string;
}

type TimerMode = 'stopwatch' | 'countdown';

interface TimerState {
  mode: TimerMode;
  seconds: number;
  countdownTotal: number;
}

const formatTime = (totalSeconds: number) => {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  
  if (h > 0) {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const StudyTimer: React.FC<StudyTimerProps> = ({ fileId }) => {
  const [mode, setMode] = useState<TimerMode>('stopwatch');
  const [seconds, setSeconds] = useState(0);
  const [countdownTotal, setCountdownTotal] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  
  const timerRef = useRef<number | null>(null);
  const storageKey = `study_timer_${fileId}`;

  // ── Restore State ──────────────────────────────────────────
  useEffect(() => {
    setIsRunning(false); // Luôn ở trạng thái paused khi mount hoặc đổi file
    const saved = sessionStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed: TimerState = JSON.parse(saved);
        setMode(parsed.mode);
        setSeconds(parsed.seconds);
        setCountdownTotal(parsed.countdownTotal || 25 * 60);
      } catch (e) {
        console.error('Failed to parse study timer state', e);
      }
    } else {
      // Mặc định cho file mới
      setMode('stopwatch');
      setSeconds(0);
      setCountdownTotal(25 * 60);
    }

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [fileId]);

  // ── Save State ─────────────────────────────────────────────
  useEffect(() => {
    const state: TimerState = { mode, seconds, countdownTotal };
    sessionStorage.setItem(storageKey, JSON.stringify(state));
  }, [mode, seconds, countdownTotal, storageKey]);

  // ── Interval Logic ─────────────────────────────────────────
  useEffect(() => {
    if (isRunning) {
      timerRef.current = window.setInterval(() => {
        setSeconds(prev => {
          if (mode === 'countdown') {
            if (prev <= 1) {
              setIsRunning(false);
              return 0;
            }
            return prev - 1;
          } else {
            return prev + 1;
          }
        });
      }, 1000);
    } else {
      if (timerRef.current) window.clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [isRunning, mode]);

  const handleToggle = () => setIsRunning(!isRunning);

  const handleReset = () => {
    setIsRunning(false);
    setSeconds(mode === 'countdown' ? countdownTotal : 0);
  };

  const switchMode = (newMode: TimerMode) => {
    setIsRunning(false);
    setMode(newMode);
    setSeconds(newMode === 'countdown' ? countdownTotal : 0);
  };

  const setPreset = (mins: number) => {
    const secs = mins * 60;
    setIsRunning(false);
    setCountdownTotal(secs);
    setSeconds(secs);
  };

  const isWarning = mode === 'countdown' && seconds <= 30 && seconds > 0;
  const AMBER = '#EF9F27';
  const TEXT_PRIMARY = '#E5E5E4';
  const BORDER_DEFAULT = 'rgba(255,255,255,0.12)';

  return (
    <div className="flex items-center gap-2">
      {/* Pulse Animation Style */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes timer-pulse {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(0.98); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}} />

      {/* Preset Buttons (Only shown for countdown when stopped) */}
      {mode === 'countdown' && !isRunning && (
        <div className="flex items-center gap-1">
          {[15, 25, 45].map(m => (
            <button
              key={m}
              onClick={() => setPreset(m)}
              className="px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors"
              style={{
                background: countdownTotal === m * 60 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)',
                color: countdownTotal === m * 60 ? '#fff' : '#787774',
              }}
            >
              {m}
            </button>
          ))}
        </div>
      )}

      {/* Main Pill Wrapper */}
      <div
        className="flex items-center h-8 px-2.5 gap-2.5 transition-all"
        style={{
          background: 'rgba(255,255,255,0.08)',
          border: `1px solid ${isWarning ? AMBER : BORDER_DEFAULT}`,
          borderRadius: '999px',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          animation: isWarning ? 'timer-pulse 1.5s infinite' : 'none',
        }}
      >
        {/* Mode Toggle Button */}
        <button
          onClick={() => switchMode(mode === 'stopwatch' ? 'countdown' : 'stopwatch')}
          style={{ color: '#AEACA8' }}
          className="hover:text-white transition-colors"
          title={mode === 'stopwatch' ? 'Sang đếm ngược' : 'Sang đếm tiến'}
        >
          {mode === 'stopwatch' ? <Timer size={14} /> : <Hourglass size={14} />}
        </button>

        {/* Time Display */}
        <span
          className="font-mono text-xs font-bold"
          style={{
            color: isWarning ? AMBER : (isRunning ? '#fff' : TEXT_PRIMARY),
            minWidth: '40px',
            textAlign: 'center',
            fontVariantNumeric: 'tabular-nums'
          }}
        >
          {formatTime(seconds)}
        </span>

        {/* Controls */}
        <div className="flex items-center gap-1.5 ml-0.5">
          <button
            onClick={handleReset}
            className="p-1 hover:text-white transition-colors"
            style={{ color: '#787774' }}
            title="Đặt lại"
          >
            <RotateCcw size={12} />
          </button>
          <button
            onClick={handleToggle}
            className="w-5 h-5 flex items-center justify-center rounded-full transition-all"
            style={{
              background: isRunning ? 'rgba(255,255,255,0.1)' : '#E5E5E4',
              color: isRunning ? '#fff' : '#1A1A1A'
            }}
          >
            {isRunning ? <Pause size={10} fill="currentColor" /> : <Play size={10} fill="currentColor" className="ml-0.5" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudyTimer;
