import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

// Physics constants based on the provided graph
const TOTAL_TIME = 9;
const MAX_VELOCITY = 8;
const MIN_VELOCITY = -4;

// Physics calculation function
const getPhysicsState = (t: number) => {
  let v = 0;
  let x = 0;
  let section = 0;

  // Clamp time
  const time = Math.max(0, Math.min(t, TOTAL_TIME));

  if (time <= 6) {
    // Sections 1 & 2: t in [0, 6]
    // v(t) = -2t + 8
    // x(t) = -t^2 + 8t (assuming x(0)=0)
    v = -2 * time + 8;
    x = -Math.pow(time, 2) + 8 * time;
    section = time <= 4 ? 1 : 2;
  } else {
    // Section 3: t in [6, 9]
    // v(t) = -4
    // x(t) = -4t + 36 (derived to match x(6)=12)
    v = -4;
    x = -4 * time + 36;
    section = 3;
  }

  return { v, x, section, t: time };
};

export default function CarSimulation() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [selectedInterval, setSelectedInterval] = useState<{ start: number, end: number } | null>(null);
  const requestRef = useRef<number | undefined>(undefined);
  const previousTimeRef = useRef<number | undefined>(undefined);

  const animate = (timestamp: number) => {
    if (previousTimeRef.current !== undefined) {
      const deltaTime = (timestamp - previousTimeRef.current) / 1000;
      setTime((prevTime) => {
        const newTime = prevTime + deltaTime * playbackSpeed;
        const endTime = selectedInterval ? selectedInterval.end : TOTAL_TIME;

        if (newTime >= endTime) {
          setIsPlaying(false);
          return endTime;
        }
        return newTime;
      });
    }
    previousTimeRef.current = timestamp;
    if (isPlaying) {
      requestRef.current = requestAnimationFrame(animate);
    }
  };

  useEffect(() => {
    if (isPlaying) {
      previousTimeRef.current = undefined;
      requestRef.current = requestAnimationFrame(animate);
    } else {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    }
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isPlaying, playbackSpeed]);

  const handleReset = () => {
    setIsPlaying(false);
    setTime(selectedInterval ? selectedInterval.start : 0);
  };

  const handleIntervalChange = (interval: { start: number, end: number } | null) => {
    setSelectedInterval(interval);
    setIsPlaying(false);
    setTime(interval ? interval.start : 0);
  };

  const currentState = getPhysicsState(time);

  // SVG Graph Dimensions
  const graphWidth = 600;
  const graphHeight = 300;
  const padding = { top: 20, right: 30, bottom: 30, left: 40 };
  const plotWidth = graphWidth - padding.left - padding.right;
  const plotHeight = graphHeight - padding.top - padding.bottom;

  // Scales
  const scaleX = (t: number) => (t / TOTAL_TIME) * plotWidth;
  const scaleY = (v: number) => {
    // Map [-5, 9] to height to include padding
    const range = MAX_VELOCITY - MIN_VELOCITY + 2; // 14
    const normalized = (v - (MIN_VELOCITY - 1)) / range;
    return plotHeight - normalized * plotHeight;
  };

  const zeroY = scaleY(0);

  // Generate path data for the line up to current time
  const generateLinePath = () => {
    let path = `M ${padding.left} ${padding.top + scaleY(8)}`;
    const steps = 100;
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * time;
      const state = getPhysicsState(t);
      path += ` L ${padding.left + scaleX(t)} ${padding.top + scaleY(state.v)}`;
    }
    return path;
  };

  // Generate area paths
  const generateAreaPath = (startTime: number, endTime: number, color: string) => {
    if (time < startTime) return null;

    const effectiveEnd = Math.min(time, endTime);
    const startX = padding.left + scaleX(startTime);
    const endX = padding.left + scaleX(effectiveEnd);

    let path = `M ${startX} ${padding.top + zeroY}`; // Start at y=0

    // Trace the curve
    const steps = 20;
    for (let i = 0; i <= steps; i++) {
      const t = startTime + (i / steps) * (effectiveEnd - startTime);
      const state = getPhysicsState(t);
      path += ` L ${padding.left + scaleX(t)} ${padding.top + scaleY(state.v)}`;
    }

    path += ` L ${endX} ${padding.top + zeroY} Z`; // Close back to y=0
    return <path d={path} fill={color} opacity="0.5" stroke="none" />;
  };

  return (
    <div className="flex flex-col items-center w-full max-w-5xl mx-auto p-6 gap-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Trực quan hóa chuyển động của xe</h1>
        <p className="text-gray-600">Đồ thị Vận tốc - Thời gian</p>
      </div>

      {/* Car Visualization */}
      <div className="w-full bg-gray-100 rounded-xl p-8 shadow-sm border border-gray-200 relative overflow-hidden">
        <div className="absolute top-4 left-4 text-sm font-mono text-gray-500">
          Vị trí: {currentState.x.toFixed(2)}m | Vận tốc: {currentState.v.toFixed(2)}m/s | Thời gian: {currentState.t.toFixed(2)}s
        </div>

        {/* Road */}
        <div className="mt-12 relative h-24 border-b-4 border-gray-700">
          {/* Markers */}
          {[0, 4, 8, 12, 16].map((mark) => (
            <div key={mark} className="absolute bottom-0 w-px h-4 bg-gray-400" style={{ left: `${(mark / 18) * 100}%` }}>
              <span className="absolute top-6 -translate-x-1/2 text-xs text-gray-500">{mark}m</span>
            </div>
          ))}

          {/* Car */}
          <div
            className="absolute bottom-0 transition-transform duration-75 ease-linear will-change-transform"
            style={{
              left: `${(currentState.x / 18) * 90 + 5}%`,
              transform: 'translateX(-50%)'
            }}
          >
            {/* Car Icon */}
            <div className="relative w-20 h-10 bg-indigo-600 rounded-t-xl shadow-lg flex items-center justify-center mb-2 z-10">
              {/* Windows */}
              <div className="w-14 h-5 bg-indigo-900 rounded-sm opacity-40 mb-1"></div>

              {/* Headlights */}
              {currentState.v >= 0 ? (
                <>
                  <div className="absolute top-3 right-0 w-1 h-3 bg-yellow-300 rounded-l-sm shadow-[0_0_5px_rgba(253,224,71,0.8)]"></div>
                  <div className="absolute top-3 left-0 w-1 h-3 bg-red-500 rounded-r-sm shadow-[0_0_5px_rgba(239,68,68,0.8)]"></div>
                </>
              ) : (
                <>
                  <div className="absolute top-3 left-0 w-1 h-3 bg-yellow-300 rounded-r-sm shadow-[0_0_5px_rgba(253,224,71,0.8)]"></div>
                  <div className="absolute top-3 right-0 w-1 h-3 bg-red-500 rounded-l-sm shadow-[0_0_5px_rgba(239,68,68,0.8)]"></div>
                </>
              )}

              {/* Wheels */}
              <div className="absolute -bottom-3 left-2 w-5 h-5 bg-gray-900 rounded-full border-2 border-gray-400 flex items-center justify-center">
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
              </div>
              <div className="absolute -bottom-3 right-2 w-5 h-5 bg-gray-900 rounded-full border-2 border-gray-400 flex items-center justify-center">
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
              </div>

              {/* Direction Arrow */}
              {Math.abs(currentState.v) > 0.1 && (
                <div className={`absolute -top-8 left-1/2 -translate-x-1/2 text-indigo-500 font-bold text-xl transition-opacity ${currentState.v < 0 ? 'rotate-180' : ''}`}>
                  ➔
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Graph Visualization */}
      <div className="relative bg-white rounded-xl shadow-md border border-gray-200 p-4 overflow-hidden">
        <svg width={graphWidth} height={graphHeight} className="overflow-visible">
          {/* Grid */}
          <g className="text-gray-200">
            {/* Vertical lines (Time) */}
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(t => (
              <line
                key={`v-${t}`}
                x1={padding.left + scaleX(t)}
                y1={padding.top}
                x2={padding.left + scaleX(t)}
                y2={graphHeight - padding.bottom}
                stroke="currentColor"
                strokeWidth="1"
              />
            ))}
            {/* Horizontal lines (Velocity) */}
            {[-4, -2, 0, 2, 4, 6, 8].map(v => (
              <line
                key={`h-${v}`}
                x1={padding.left}
                y1={padding.top + scaleY(v)}
                x2={graphWidth - padding.right}
                y2={padding.top + scaleY(v)}
                stroke="currentColor"
                strokeWidth="1"
              />
            ))}
          </g>

          {/* Axes */}
          <line
            x1={padding.left} y1={padding.top + zeroY}
            x2={graphWidth - padding.right} y2={padding.top + zeroY}
            stroke="black" strokeWidth="2"
          />
          <line
            x1={padding.left} y1={padding.top}
            x2={padding.left} y2={graphHeight - padding.bottom}
            stroke="black" strokeWidth="2"
          />

          {/* Labels */}
          <text x={graphWidth - padding.right + 10} y={padding.top + zeroY + 5} className="text-sm" style={{ fontFamily: '"Latin Modern Math", "Computer Modern", "Times New Roman", Times, serif' }}>t(s)</text>
          <text x={padding.left} y={padding.top - 10} className="text-sm" textAnchor="middle" style={{ fontFamily: '"Latin Modern Math", "Computer Modern", "Times New Roman", Times, serif' }}>v(m/s)</text>

          {/* Tick Labels */}
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(t => (
            <text key={`tl-${t}`} x={padding.left + scaleX(t)} y={graphHeight - padding.bottom + 20} textAnchor="middle" className="text-sm text-gray-600" style={{ fontFamily: '"Latin Modern Math", "Computer Modern", "Times New Roman", Times, serif' }}>{t}</text>
          ))}
          {[-4, -2, 0, 2, 4, 6, 8].map(v => (
            <text key={`vl-${v}`} x={padding.left - 10} y={padding.top + scaleY(v) + 5} textAnchor="end" className="text-sm text-gray-600" style={{ fontFamily: '"Latin Modern Math", "Computer Modern", "Times New Roman", Times, serif' }}>{v}</text>
          ))}

          {/* Areas */}
          {/* d1: t=0 to 4 (Blue) */}
          {generateAreaPath(0, 4, "#06b6d4")}
          {/* d2: t=4 to 6 (Pink) */}
          {generateAreaPath(4, 6, "#f43f5e")}
          {/* d3: t=6 to 9 (Green) */}
          {generateAreaPath(6, 9, "#22c55e")}

          {/* Labels for areas (d1, d2, d3) */}
          {time > 1.5 && <text x={padding.left + scaleX(1.33)} y={padding.top + scaleY(2.67)} textAnchor="middle" className="text-blue-900 font-bold text-2xl" style={{ fontFamily: '"Latin Modern Math", "Computer Modern", "Times New Roman", Times, serif', fontStyle: 'italic' }}>d₁</text>}
          {time > 5.5 && <text x={padding.left + scaleX(5.33)} y={padding.top + scaleY(-1.33)} textAnchor="middle" className="text-pink-900 font-bold text-2xl" style={{ fontFamily: '"Latin Modern Math", "Computer Modern", "Times New Roman", Times, serif', fontStyle: 'italic' }}>d₂</text>}
          {time > 7.5 && <text x={padding.left + scaleX(7.5)} y={padding.top + scaleY(-2)} textAnchor="middle" className="text-green-900 font-bold text-2xl" style={{ fontFamily: '"Latin Modern Math", "Computer Modern", "Times New Roman", Times, serif', fontStyle: 'italic' }}>d₃</text>}

          {/* The Line */}
          <path d={generateLinePath()} fill="none" stroke="#0ea5e9" strokeWidth="3" strokeLinecap="round" />

          {/* Current Point Dot */}
          <circle
            cx={padding.left + scaleX(time)}
            cy={padding.top + scaleY(currentState.v)}
            r="4"
            fill="#0ea5e9"
            stroke="white"
            strokeWidth="2"
          />
        </svg>
      </div>

      {/* Controls */}
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-4 bg-white p-4 rounded-full shadow-lg border border-gray-100">
          <button
            onClick={() => {
              const endTime = selectedInterval ? selectedInterval.end : TOTAL_TIME;
              const startTime = selectedInterval ? selectedInterval.start : 0;

              if (time >= endTime) {
                setTime(startTime);
                setIsPlaying(true);
              } else {
                setIsPlaying(!isPlaying);
              }
            }}
            className="w-12 h-12 flex items-center justify-center rounded-full bg-black text-white hover:bg-gray-800 transition-colors"
          >
            {isPlaying && time < (selectedInterval ? selectedInterval.end : TOTAL_TIME) ? <Pause size={20} /> : <Play size={20} className="ml-1" />}
          </button>

          <button
            onClick={handleReset}
            className="w-12 h-12 flex items-center justify-center rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
          >
            <RotateCcw size={20} />
          </button>

          <div className="h-8 w-px bg-gray-200 mx-2"></div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-500">Tốc độ:</span>
            {[0.5, 1, 2].map(speed => (
              <button
                key={speed}
                onClick={() => setPlaybackSpeed(speed)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${playbackSpeed === speed
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>

        {/* Interval Selection */}
        <div className="flex items-center gap-2 bg-white p-2 rounded-xl shadow-sm border border-gray-100">
          <span className="text-sm font-medium text-gray-500 px-2">Khoảng thời gian:</span>
          <button
            onClick={() => handleIntervalChange(null)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedInterval === null
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
          >
            Toàn bộ
          </button>
          <button
            onClick={() => handleIntervalChange({ start: 0, end: 4 })}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedInterval?.start === 0 && selectedInterval?.end === 4
                ? 'bg-cyan-500 text-white shadow-sm'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
          >
            0s - 4s
          </button>
          <button
            onClick={() => handleIntervalChange({ start: 4, end: 6 })}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedInterval?.start === 4 && selectedInterval?.end === 6
                ? 'bg-pink-500 text-white shadow-sm'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
          >
            4s - 6s
          </button>
          <button
            onClick={() => handleIntervalChange({ start: 6, end: 9 })}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedInterval?.start === 6 && selectedInterval?.end === 9
                ? 'bg-green-500 text-white shadow-sm'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
          >
            6s - 9s
          </button>
        </div>
      </div>
    </div>
  );
}
