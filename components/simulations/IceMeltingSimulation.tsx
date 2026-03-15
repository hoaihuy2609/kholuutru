import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Activity } from 'lucide-react';
import { InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';

// ─── Hằng số vật lí ──────────────────────────────
const C_NUOC = 4200;       // Nhiệt dung riêng nước (J/kg·K)
const LAMBDA_LT = 3.34e5;  // Nhiệt nóng chảy riêng lý thuyết (J/kg)
const P_DANH_DINH = 14.25; // Công suất danh định (W)
const P_DAODONG = 0.05;    // Biên độ dao động công suất (W)
const M_DA = 0.025;        // Khối lượng nước đá ban đầu (kg)
const M_NUOC = 0.050;      // Khối lượng nước lạnh thêm vào (kg)
const M_TONG = M_DA + M_NUOC; // Tổng khối lượng chất lỏng sau khi đá tan (kg)
const T0 = 0.0;            // Nhiệt độ ban đầu (°C)
const DT = 2.0;

interface RecordData {
    n: number;
    tau: number;
    temp: number;
    power: number;
    phase: number;
}

interface Particle {
    x: number;
    y: number;
    r: number;
    vx: number;
    vy: number;
    life: number;
    op: number;
}

const ICE_CUBES = [
    { cx: 155, cy: 145 }, { cx: 175, cy: 138 }, { cx: 195, cy: 148 },
    { cx: 162, cy: 160 }, { cx: 185, cy: 155 }, { cx: 207, cy: 158 },
    { cx: 150, cy: 168 }, { cx: 173, cy: 168 }, { cx: 198, cy: 165 },
];

export default function IceMeltingSimulation() {
    const [isRunning, setIsRunning] = useState(false);
    const [tickCount, setTickCount] = useState(0);
    const [phase, setPhase] = useState(1);
    const [iceLeft, setIceLeft] = useState(M_DA);
    const [tempNow, setTempNow] = useState(T0);
    const [powerNow, setPowerNow] = useState(0);
    const [dataRecords, setDataRecords] = useState<RecordData[]>([{ n: 1, tau: 0, temp: 0.0, power: P_DANH_DINH, phase: 1 }]);
    const [autoMode, setAutoMode] = useState(true);

    const [svgMeta, setSvgMeta] = useState({ W: 600, H: 230 });
    const [result, setResult] = useState<{ Pavg: number; tauM: number; lambda: number; err: number; slope2: number; int2: number } | null>(null);

    const steamCanvasRef = useRef<HTMLCanvasElement>(null);
    const chartWrapRef = useRef<HTMLDivElement>(null);
    const particlesRef = useRef<Particle[]>([]);

    const physics = useRef({
        tickCount: 0,
        phase: 1,
        iceLeft: M_DA,
        tempNow: T0,
        powerNow: 0,
    });

    const autoModeRef = useRef(autoMode);
    useEffect(() => { autoModeRef.current = autoMode; }, [autoMode]);

    // Luồng Vật Lý
    useEffect(() => {
        let loopId: NodeJS.Timeout;
        if (isRunning) {
            loopId = setInterval(() => {
                physics.current.tickCount++;
                const currentTick = physics.current.tickCount;
                const currentTau = currentTick * DT;

                const p = P_DANH_DINH + (Math.random() * 2 - 1) * P_DAODONG;
                physics.current.powerNow = Math.round(p * 100) / 100;

                if (physics.current.phase === 1) {
                    physics.current.tempNow = 0.0;
                    const deltaMelt = (physics.current.powerNow * DT) / LAMBDA_LT;
                    physics.current.iceLeft = Math.max(0, physics.current.iceLeft - deltaMelt);

                    if (physics.current.iceLeft <= 0) {
                        physics.current.iceLeft = 0;
                        physics.current.phase = 2;
                        setPhase(2);
                    }
                }

                if (physics.current.phase === 2) {
                    const deltaT = (physics.current.powerNow * DT) / (M_TONG * C_NUOC);
                    physics.current.tempNow += deltaT;
                }

                setTickCount(currentTick);
                setPowerNow(physics.current.powerNow);
                setIceLeft(physics.current.iceLeft);
                setTempNow(physics.current.tempNow);

                const ticksPerRecord = 120 / DT;
                if (autoModeRef.current && currentTick % ticksPerRecord === 0) {
                    setDataRecords(prev => {
                        const lastTau = prev.length > 0 ? prev[prev.length - 1].tau : -1;
                        if (currentTau !== lastTau) {
                            const newRec = {
                                n: prev.length + 1,
                                tau: currentTau,
                                temp: parseFloat(physics.current.tempNow.toFixed(1)),
                                power: physics.current.powerNow,
                                phase: physics.current.phase
                            };
                            return [...prev, newRec];
                        }
                        return prev;
                    });
                }

                if (autoModeRef.current && currentTick >= 960 / DT) {
                    setIsRunning(false);
                }
            }, 100);
        } else {
            physics.current.powerNow = 0;
            setPowerNow(0);
        }
        return () => {
            if (loopId) clearInterval(loopId);
        };
    }, [isRunning]);

    // Tự động tính toán khi có đủ records
    useEffect(() => {
        const pts1 = dataRecords.filter(r => r.phase === 1);
        const pts2 = dataRecords.filter(r => r.phase === 2);
        if (pts1.length < 3 || pts2.length < 2) {
            setResult(null);
            return;
        }

        const n2 = pts2.length;
        const sx = pts2.reduce((s, r) => s + r.tau, 0);
        const sy = pts2.reduce((s, r) => s + r.temp, 0);
        const sxy = pts2.reduce((s, r) => s + r.tau * r.temp, 0);
        const sx2 = pts2.reduce((s, r) => s + r.tau * r.tau, 0);
        const slope = (n2 * sxy - sx * sy) / (n2 * sx2 - sx * sx);
        const intercept = (sy - slope * sx) / n2;

        if (Math.abs(slope) < 1e-10) return;
        const tauM = -intercept / slope;
        if (tauM < 0) return;

        const activePts = dataRecords.filter(r => r.power > 0);
        const Pavg = activePts.length > 0 ? activePts.reduce((s, r) => s + r.power, 0) / activePts.length : P_DANH_DINH;

        const lambda = (Pavg * tauM) / M_DA;
        const err = Math.abs(lambda - LAMBDA_LT) / LAMBDA_LT * 100;

        setResult({ Pavg, tauM, lambda, err, slope2: slope, int2: intercept });
    }, [dataRecords]);

    const togglePower = () => setIsRunning(!isRunning);

    const manualRecord = () => {
        if (!isRunning) return;
        setDataRecords(prev => [
            ...prev,
            {
                n: prev.length + 1,
                tau: physics.current.tickCount * DT,
                temp: parseFloat(physics.current.tempNow.toFixed(1)),
                power: parseFloat(physics.current.powerNow.toFixed(2)),
                phase: physics.current.phase
            }
        ]);
    };

    const clearData = () => {
        physics.current.tickCount = 0;
        physics.current.phase = 1;
        physics.current.iceLeft = M_DA;
        physics.current.tempNow = T0;
        physics.current.powerNow = 0;

        setTickCount(0);
        setPhase(1);
        setIceLeft(M_DA);
        setTempNow(T0);
        setPowerNow(0);
        setDataRecords([{ n: 1, tau: 0, temp: 0.0, power: P_DANH_DINH, phase: 1 }]);
        setResult(null);
        setIsRunning(false);
    };

    useEffect(() => {
        const wrap = chartWrapRef.current;
        if (!wrap) return;

        const updateSize = () => {
            setSvgMeta({ W: wrap.clientWidth || 600, H: wrap.clientHeight || 230 });
        };

        const observer = new ResizeObserver(updateSize);
        observer.observe(wrap);
        updateSize();

        return () => observer.disconnect();
    }, []);

    // Hơi nước animation (chỉ pha 2)
    useEffect(() => {
        const canvas = steamCanvasRef.current;
        if (!canvas || !canvas.parentElement) return;

        const updateCanvasSize = () => {
            canvas.width = canvas.parentElement!.offsetWidth;
            canvas.height = canvas.parentElement!.offsetHeight;
        };
        const observer = new ResizeObserver(updateCanvasSize);
        observer.observe(canvas.parentElement!);
        updateCanvasSize();

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animFrameId: number;

        const renderLoop = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            if (isRunning && phase === 2) {
                const scX = canvas.width / 380;
                const scY = canvas.height / 205;
                const fL = 136 * scX;
                const fR = 244 * scX;
                const wT = 120 * scY;

                if (Math.random() < 0.15) {
                    particlesRef.current.push({
                        x: fL + Math.random() * (fR - fL),
                        y: wT,
                        r: 2 + Math.random() * 3,
                        vx: (Math.random() - 0.5) * 0.5,
                        vy: -(0.3 + Math.random() * 0.6),
                        life: 1,
                        op: 0.12 + Math.random() * 0.1
                    });
                }
            }

            particlesRef.current = particlesRef.current.filter((p) => p.life > 0);

            for (const p of particlesRef.current) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r * (1.6 - p.life), 0, Math.PI * 2);
                ctx.fillStyle = `rgba(186,216,228,${p.life * p.op})`;
                ctx.fill();
                p.x += p.vx;
                p.y += p.vy;
                p.r += 0.1;
                p.life -= 0.012;
                ctx.restore();
            }
            animFrameId = requestAnimationFrame(renderLoop);
        };

        renderLoop();

        return () => {
            cancelAnimationFrame(animFrameId);
            observer.disconnect();
        };
    }, [isRunning, phase]);

    // Các biến cho đồ thị
    const pad = { top: 14, right: 16, bottom: 42, left: 52 };
    const { W, H } = svgMeta;

    let tMin = 0, tMax = 120, tmMin = 0, tmMax = 1;
    if (dataRecords.length >= 2) {
        const tauArr = dataRecords.map(r => r.tau);
        const tempArr = dataRecords.map(r => r.temp);
        tMin = Math.min(...tauArr);
        tMax = Math.max(...tauArr);
        tmMin = 0; // Luôn bắt đầu từ 0
        tmMax = Math.max(...tempArr);

        const tR = tMax - tMin || 120;
        const tmR = tmMax - tmMin || 1;
        tMin -= tR * 0.05;
        tMax += tR * 0.08;
        tmMax += tmR * 0.3;
        if (tmMax < 0.5) tmMax = 0.5;
    }

    const toX = (t: number) => pad.left + ((t - tMin) / (tMax - tMin)) * (W - pad.left - pad.right);
    const toY = (tm: number) => pad.top + (1 - ((tm - tmMin) / (tmMax - tmMin))) * (H - pad.top - pad.bottom);

    const ratio = Math.max(0, Math.min(1, iceLeft / M_DA));
    const iceRadius = Math.max(1, 9 * ratio);

    return (
        <div className="flex flex-col w-full max-w-[1240px] mx-auto p-4 md:p-6 gap-6 bg-white font-sans text-gray-900 border border-gray-200 shadow-sm rounded-xl">
            <div className="space-y-2 border-b border-gray-100 pb-4">
                <h1 className="text-2xl font-bold tracking-tight text-gray-900 font-serif">Đo Nhiệt Nóng Chảy Riêng Của Nước Đá</h1>
                <div className="text-[13px] text-gray-500 font-medium flex-wrap flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 w-fit">
                    <span>Xác định <InlineMath math="\lambda" /> của nước đá</span>
                    <span className="text-slate-300">|</span>
                    <span>Sách giáo khoa VL12 - Bảng 5.2</span>
                    <span className="text-slate-300">|</span>
                    <span className="text-indigo-600 font-semibold bg-white border border-indigo-100 px-2 py-0.5 rounded shadow-sm">
                        <InlineMath math="\lambda = \frac{\bar{\mathcal{P}} \cdot \tau_M}{m_{\text{da}}}" />
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[390px_1fr] gap-6 items-start">
                {/* KHU VỰC 1 */}
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col items-stretch ring-1 ring-gray-900/5">
                    <div className="flex items-center gap-2 p-3 bg-cyan-50/50 border-b border-gray-200">
                        <div className="w-6 h-6 rounded bg-cyan-100 border border-cyan-200 flex items-center justify-center text-cyan-600 text-xs shadow-sm">❄</div>
                        <span className="text-[12px] font-bold tracking-widest uppercase text-gray-600">Bàn Thí Nghiệm Ảo</span>
                    </div>

                    <div className="p-4 flex flex-col gap-3">
                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 border border-gray-200 shadow-inner">
                            <div className="flex items-center gap-2.5">
                                <div className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${isRunning ? 'bg-red-500 shadow-[0_0_0_4px_#fee2e2]' : 'bg-gray-300'}`}></div>
                                <span className="text-[13px] font-medium text-gray-700">Nguồn điện đun nóng</span>
                            </div>
                            <button
                                onClick={togglePower}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-semibold transition-all shadow-sm ${isRunning ? 'bg-red-600 text-white hover:bg-red-700 ring-4 ring-red-600/10' : 'bg-gray-900 text-white hover:bg-gray-800'}`}
                            >
                                {isRunning ? <><Pause size={14} /> Dừng đun</> : <><Play size={14} className="ml-0.5" /> Bật nguồn</>}
                            </button>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                            <div className="flex flex-col items-center justify-center py-2 px-1 rounded-lg bg-slate-50 border border-slate-200 shadow-sm relative overflow-hidden">
                                <span className="text-[9px] font-bold tracking-wider uppercase text-slate-400 mb-1">Thời gian τ</span>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-[1.4rem] font-mono tracking-tighter text-gray-800 leading-none">{Math.round(tickCount * DT).toString().padStart(3, '0')}</span>
                                    <span className="text-[11px] font-medium text-slate-400">s</span>
                                </div>
                            </div>
                            <div className="flex flex-col items-center justify-center py-2 px-1 rounded-lg bg-slate-50 border border-slate-200 shadow-sm relative overflow-hidden">
                                <span className="text-[9px] font-bold tracking-wider uppercase text-slate-400 mb-1">Nhiệt kế t</span>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-[1.4rem] font-mono tracking-tighter leading-none" style={{ color: tempNow <= 0.1 ? '#06b6d4' : (tempNow > 5 ? '#ef4444' : '#f59e0b') }}>
                                        {tempNow.toFixed(1)}
                                    </span>
                                    <span className="text-[11px] font-medium text-slate-400">°C</span>
                                </div>
                            </div>
                            <div className="flex flex-col items-center justify-center py-2 px-1 rounded-lg bg-slate-50 border border-slate-200 shadow-sm relative overflow-hidden">
                                <span className="text-[9px] font-bold tracking-wider uppercase text-slate-400 mb-1">Đá còn</span>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-[1.4rem] font-mono tracking-tighter text-sky-500 leading-none">{(iceLeft * 1000).toFixed(2)}</span>
                                    <span className="text-[11px] font-medium text-slate-400">g</span>
                                </div>
                            </div>
                        </div>

                        <div className={`p-2 rounded-full text-center text-[11px] font-bold transition-colors ${phase === 1 ? 'bg-sky-50 text-sky-600 border border-sky-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                            {phase === 1 ? '❄️ Giai đoạn 1 — Đá đang tan (t = 0°C)' : '🔥 Giai đoạn 2 — Nước phân lớp nóng lên'}
                        </div>

                        <div className="relative w-full h-[210px] bg-slate-50 border border-slate-200 rounded-lg overflow-hidden flex-shrink-0">
                            <svg viewBox="0 0 380 205" className="w-full h-full absolute inset-0">
                                {/* Base components */}
                                <ellipse cx="190" cy="197" rx="88" ry="7" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="1" />
                                <rect x="185" y="196" width="10" height="8" fill="#cbd5e1" />
                                <rect x="162" y="203" width="56" height="3" fill="#94a3b8" rx="1.5" />

                                <rect x="127" y="55" width="126" height="139" rx="8" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />
                                <rect x="134" y="62" width="112" height="126" rx="5" fill="#f1f5f9" stroke="#e2e8f0" strokeWidth="1" />
                                <rect x="123" y="49" width="134" height="10" rx="5" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="1.5" />

                                <rect x="136" y="120" width="108" height="66" rx="3" fill="#bae6fd" opacity=".55" />
                                <rect x="138" y="122" width="22" height="62" rx="2" fill="#e0f2fe" opacity=".4" />

                                {/* Ice Cubes */}
                                {ratio > 0 && ICE_CUBES.map((pos, i) => (
                                    <g key={`ice-${i}`}>
                                        <rect x={pos.cx - iceRadius} y={pos.cy - iceRadius * 0.7} width={iceRadius * 2} height={iceRadius * 1.4} rx={iceRadius * 0.35} fill={`rgba(186,230,253,${0.7 + ratio * 0.3})`} stroke={`rgba(125,211,252,${0.5 + ratio * 0.4})`} strokeWidth="1" />
                                        <ellipse cx={pos.cx - iceRadius * 0.3} cy={pos.cy - iceRadius * 0.35} rx={iceRadius * 0.35} ry={iceRadius * 0.2} fill={`rgba(255,255,255,${0.4 * ratio})`} />
                                    </g>
                                ))}

                                {/* Heater */}
                                <rect x="150" y="175" width="80" height="7" rx="3" fill={isRunning ? '#fed7aa' : '#d4d4d0'} stroke={isRunning ? '#f97316' : '#c0c0bc'} strokeWidth="1" />
                                {[158, 165, 172, 179, 186, 193, 200, 207, 214, 221].map(x => (
                                    <line key={`hx-${x}`} x1={x} y1="175" x2={x} y2="182" stroke="#b0b0aa" strokeWidth="1.1" />
                                ))}

                                {/* Stirrer with animation */}
                                <g transform={isRunning ? `translate(${Math.sin(Date.now() / 300) * 3},0)` : ''} className="transition-transform duration-75">
                                    <rect x="218" y="64" width="4" height="90" rx="2" fill="#94a3b8" stroke="#64748b" strokeWidth=".5" />
                                    <ellipse cx="220" cy="155" rx="10" ry="4" fill="#94a3b8" stroke="#64748b" strokeWidth=".5" />
                                </g>

                                <text x="175" y="82" textAnchor="middle" fontSize="8" fill="#94a3b8" fontFamily="sans-serif" fontWeight="600">NHIỆT LƯỢNG KẾ</text>
                                <text x="175" y="92" textAnchor="middle" fontSize="7" fill="#b0bec5" fontFamily="sans-serif">(bình đậy kín)</text>

                                {/* Thermometer */}
                                <rect x="237" y="48" width="6" height="80" rx="3" fill="#e0f2fe" stroke="#7dd3fc" strokeWidth="1" />
                                <circle cx="240" cy="130" r="5" fill={tempNow > 5 ? '#f87171' : '#06b6d4'} stroke="#67e8f9" strokeWidth="1" />
                                {(() => {
                                    const fillH = Math.min(50, 32 + (tempNow / 10) * 18);
                                    const fillY = 130 - fillH;
                                    return <rect x="238.5" y={fillY} width="3" height={fillH} rx="1.5" fill={tempNow > 5 ? '#f87171' : '#06b6d4'} />;
                                })()}
                                <text x="250" y="51" fontSize="7" fill="#94a3b8" fontFamily="monospace">0.0°C</text>

                                {/* Watt Meter */}
                                <rect x="296" y="122" width="50" height="26" rx="4" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
                                <text x="321" y="134" textAnchor="middle" fontSize="7" fill="#94a3b8" fontFamily="sans-serif" fontWeight="600">OÁT KẾ</text>
                                <text x="321" y="143" textAnchor="middle" fontSize="7.5" fill="#2563eb" fontFamily="monospace" fontWeight="bold">{(isRunning ? powerNow : 0).toFixed(2)} W</text>

                                {/* Power Source */}
                                <rect x="25" y="100" width="40" height="70" rx="4" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
                                <text x="45" y="126" textAnchor="middle" fontSize="7" fill="#94a3b8" fontFamily="sans-serif" fontWeight="600">NGUỒN</text>
                                <text x="45" y="136" textAnchor="middle" fontSize="7" fill="#94a3b8" fontFamily="sans-serif" fontWeight="600">DC</text>
                                <text x="45" y="146" textAnchor="middle" fontSize="7" fill="#94a3b8" fontFamily="sans-serif">14V</text>
                                <circle cx="45" cy="157" r="3" fill={isRunning ? '#f87171' : '#d4d4d0'} />
                                <circle cx="45" cy="135" r="3" fill={isRunning ? '#f87171' : '#d4d4d0'} />

                                <polyline points="150,179 138,179 138,62 134,62 134,54" fill="none" stroke="#fca5a5" strokeWidth="1.4" strokeDasharray="3,2" />
                                <polyline points="134,54 134,40 45,40 45,100" fill="none" stroke="#fca5a5" strokeWidth="1.4" />
                                <circle cx="45" cy="100" r="3" fill="#fca5a5" />

                                <polyline points="230,179 242,179 242,62 246,62 246,54" fill="none" stroke="#93c5fd" strokeWidth="1.4" strokeDasharray="3,2" />
                                <polyline points="246,54 246,40 321,40 321,122" fill="none" stroke="#93c5fd" strokeWidth="1.4" />
                                <polyline points="321,148 321,192 45,192 45,170" fill="none" stroke="#93c5fd" strokeWidth="1.4" />
                                <circle cx="45" cy="170" r="3" fill="#93c5fd" />
                            </svg>
                            <canvas ref={steamCanvasRef} className="absolute inset-0 pointer-events-none w-full h-full"></canvas>
                        </div>

                        <div className="mt-2 rounded-lg border border-indigo-100 bg-indigo-50/50 p-3 text-[12.5px] leading-relaxed text-indigo-900 shadow-sm">
                            <p className="font-semibold mb-1 flex items-center gap-1.5"><Activity size={14} className="text-indigo-600" /> Quy trình SGK:</p>
                            <ul className="list-decimal list-inside space-y-0.5 opacity-90 pl-1 text-xs">
                                <li>Cho 25g đá + 50g nước lạnh vào bình.</li>
                                <li>Bật nguồn <InlineMath math="\rightarrow" /> nhiệt độ giữ ở 0°C đến khi đá tan hết (<InlineMath math="\approx 600\,\text{s}" />)</li>
                                <li>Ghi <InlineMath math="(\tau,\,t,\,\mathcal{P})" /> mỗi 2 phút bằng Oát kế và đồng hồ. Tính và đo giao điểm trên đồ thị.</li>
                            </ul>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-6">
                    {/* KHU VỰC 2 */}
                    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden ring-1 ring-gray-900/5">
                        <div className="flex items-center gap-2 p-3 bg-amber-50/60 border-b border-gray-200">
                            <div className="w-6 h-6 rounded bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-600 text-[10px] font-bold shadow-sm">≡</div>
                            <span className="text-[12px] font-bold tracking-widest uppercase text-gray-600">Bảng Số Liệu Máy Tập Hợp</span>
                            <span className="text-[11px] text-gray-400 ml-2">— Bảng 5.2 SGK</span>
                        </div>
                        <div className="p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={manualRecord}
                                        disabled={!isRunning || autoMode}
                                        className="px-3 py-1.5 text-xs font-semibold rounded-md border border-gray-900 bg-gray-900 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-800 transition-colors shadow-sm"
                                    >
                                        + Ghi Data Thực
                                    </button>
                                    <button
                                        onClick={clearData}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
                                    >
                                        <RotateCcw size={12} /> Xóa bảng đo
                                    </button>
                                </div>
                                <label className="flex items-center gap-2 cursor-pointer group bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-md shadow-sm">
                                    <div className="relative">
                                        <input type="checkbox" checked={autoMode} onChange={(e) => setAutoMode(e.target.checked)} className="peer sr-only" />
                                        <div className="block h-4 w-7 rounded-full bg-slate-300 transition peer-checked:bg-green-500"></div>
                                        <div className="absolute left-[2px] top-[2px] h-3 w-3 rounded-full bg-white transition peer-checked:translate-x-3 shadow-sm"></div>
                                    </div>
                                    <span className="text-[11.5px] font-semibold text-slate-600">Auto Save 120s</span>
                                </label>
                            </div>

                            <div className="border border-gray-200 rounded-lg overflow-x-auto relative shadow-sm max-h-[220px]">
                                <table className="w-full text-[13px] text-gray-700">
                                    <thead className="bg-slate-50 border-b border-gray-200 sticky top-0">
                                        <tr>
                                            <th className="py-2 px-3 font-bold text-gray-500 uppercase tracking-tighter text-[10px] text-left">Lần</th>
                                            <th className="py-2 px-3 font-bold text-gray-500 uppercase tracking-tighter text-[10px] text-right">Thời gian τ (s)</th>
                                            <th className="py-2 px-3 font-bold text-gray-500 uppercase tracking-tighter text-[10px] text-right">Nhiệt độ t (°C)</th>
                                            <th className="py-2 px-3 font-bold text-gray-500 uppercase tracking-tighter text-[10px] text-right">Công suất P (W)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 bg-white">
                                        {dataRecords.length === 0 ? (
                                            <tr><td colSpan={4} className="text-center text-gray-400 py-6 text-[12px] italic bg-gray-50">Chưa có dữ liệu thí nghiệm.</td></tr>
                                        ) : (
                                            dataRecords.map((r, i) => (
                                                <tr key={i} className={`hover:bg-blue-50/50 transition-colors ${r.phase === 1 ? 'text-cyan-700' : 'text-gray-900'} ${i === dataRecords.length - 1 ? 'animate-pulse bg-blue-50/30' : ''}`}>
                                                    <td className="py-1.5 px-3 font-medium text-[11px] text-gray-400">{r.n}</td>
                                                    <td className="py-1.5 px-3 font-mono text-right text-xs">{r.tau}</td>
                                                    <td className="py-1.5 px-3 font-mono text-right text-xs font-semibold">{r.temp.toFixed(1)}</td>
                                                    <td className="py-1.5 px-3 font-mono text-right text-xs">{r.power.toFixed(2)}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* KHU VỰC 3 */}
                    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden ring-1 ring-gray-900/5">
                        <div className="flex items-center gap-2 p-3 bg-green-50 border-b border-gray-200">
                            <div className="w-6 h-6 rounded bg-green-100 border border-green-200 flex items-center justify-center text-green-600 font-bold text-[13px] shadow-sm">∿</div>
                            <span className="text-[12px] font-bold tracking-widest uppercase text-gray-600">Đồ Thị t(τ) & Tính λ</span>
                        </div>

                        <div className="p-4 flex flex-col gap-4">
                            <div className="text-[11.5px] text-gray-500 mb-1">
                                Đồ thị tự động vẽ 2 đường thẳng và tìm điểm M (giao điểm) khi có đủ điểm ở cả 2 giai đoạn.
                            </div>

                            <div ref={chartWrapRef} className="w-full h-[230px] bg-white border border-gray-200 rounded-lg relative shadow-sm overflow-hidden block">
                                <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" className="absolute inset-0 pointer-events-none">
                                    <rect x="0" y="0" width={W} height={H} fill="#ffffff" />
                                    {/* Grid */}
                                    {Array.from({ length: 6 }).map((_, i) => (
                                        <line key={`hy${i}`} x1={pad.left} y1={pad.top + (H - pad.top - pad.bottom) * i / 5} x2={W - pad.right} y2={pad.top + (H - pad.top - pad.bottom) * i / 5} stroke="#f1f5f9" strokeWidth="1" />
                                    ))}
                                    {Array.from({ length: 6 }).map((_, i) => (
                                        <line key={`vx${i}`} x1={pad.left + (W - pad.left - pad.right) * i / 5} y1={pad.top} x2={pad.left + (W - pad.left - pad.right) * i / 5} y2={H - pad.bottom} stroke="#f1f5f9" strokeWidth="1" />
                                    ))}

                                    {/* Axes */}
                                    <polyline points={`${pad.left},${pad.top} ${pad.left},${H - pad.bottom} ${W - pad.right},${H - pad.bottom}`} fill="none" stroke="#64748b" strokeWidth="1.5" />
                                    <text x={W / 2} y={H - 5} textAnchor="middle" fontSize="10" fontFamily="monospace" fill="#64748b">Thời gian τ (s)</text>
                                    <text x={0} y={0} textAnchor="middle" fontSize="10" fontFamily="monospace" fill="#64748b" transform={`translate(12,${H / 2}) rotate(-90)`}>Nhiệt độ t (°C)</text>

                                    {dataRecords.length >= 2 && (
                                        <>
                                            {Array.from({ length: 6 }).map((_, i) => (
                                                <text key={`lblt${i}`} x={toX(tMin + (tMax - tMin) * i / 5)} y={H - pad.bottom + 14} textAnchor="middle" fontSize="10" fontFamily="monospace" fill="#94a3b8">{Math.round(tMin + (tMax - tMin) * i / 5)}</text>
                                            ))}
                                            {Array.from({ length: 6 }).map((_, i) => (
                                                <text key={`lblm${i}`} x={pad.left - 6} y={toY(tmMin + (tmMax - tmMin) * i / 5) + 3} textAnchor="end" fontSize="10" fontFamily="monospace" fill="#94a3b8">{(tmMin + (tmMax - tmMin) * i / 5).toFixed(1)}</text>
                                            ))}

                                            {/* Phase 1 line */}
                                            <line x1={toX(Math.max(0, tMin))} y1={toY(0)} x2={result ? toX(result.tauM) : (W - pad.right)} y2={toY(0)} stroke="#06b6d4" strokeWidth="2" opacity="0.85" />

                                            {/* Phase 2 regression line & Point M */}
                                            {result && result.tauM && result.slope2 && (
                                                <>
                                                    <line
                                                        x1={toX(result.tauM)} y1={toY(result.slope2 * result.tauM + result.int2)}
                                                        x2={toX(tMax)} y2={toY(result.slope2 * tMax + result.int2)}
                                                        stroke="#f97316" strokeWidth="2" opacity="0.85"
                                                    />
                                                    {/* Point M projection */}
                                                    <line x1={toX(result.tauM)} y1={toY(0)} x2={toX(result.tauM)} y2={H - pad.bottom} stroke="#6940a5" strokeWidth="1" strokeDasharray="3,3" opacity="0.7" />
                                                    <circle cx={toX(result.tauM)} cy={toY(0)} r="6" fill="#fff" stroke="#6940a5" strokeWidth="2" />
                                                    <text x={toX(result.tauM)} y={toY(0) - 10} textAnchor="middle" fontSize="11" fontWeight="bold" fontFamily="serif" fill="#6940a5">M</text>
                                                    <text x={toX(result.tauM)} y={H - pad.bottom + 26} textAnchor="middle" fontSize="9" fontFamily="monospace" fill="#6940a5">τM={Math.round(result.tauM)}s</text>
                                                </>
                                            )}

                                            {/* Points */}
                                            {dataRecords.map((r, i) => (
                                                <circle key={`pt${i}`} cx={toX(r.tau)} cy={toY(r.temp)} r="4" fill={r.phase === 1 ? "#06b6d4" : "#f97316"} stroke="#fff" strokeWidth="1" />
                                            ))}
                                        </>
                                    )}

                                    {/* Legend */}
                                    <circle cx={pad.left + 12} cy={pad.top + 8} r="4" fill="#06b6d4" />
                                    <text x={pad.left + 20} y={pad.top + 11} fontSize="8.5" fontFamily="serif" fill="#64748b">Giai đoạn 1</text>
                                    <circle cx={pad.left + 82} cy={pad.top + 8} r="4" fill="#f97316" />
                                    <text x={pad.left + 90} y={pad.top + 11} fontSize="8.5" fontFamily="serif" fill="#64748b">Giai đoạn 2</text>
                                    <circle cx={pad.left + 148} cy={pad.top + 8} r="4" fill="#6940a5" />
                                    <text x={pad.left + 156} y={pad.top + 11} fontSize="8.5" fontFamily="serif" fill="#64748b">Điểm M</text>
                                </svg>
                            </div>

                            {/* Ket qua */}
                            {result && (
                                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mt-1 shadow-inner">
                                    <div className="text-[11px] font-bold tracking-widest text-slate-500 uppercase mb-3">Kết quả nhiệt nóng chảy riêng λ</div>
                                    <div className="text-[13px] text-gray-800 leading-[2.1] font-serif pr-4 border-b border-slate-200 pb-3">
                                        <InlineMath math={`\\bar{\\mathcal{P}} = ${result.Pavg.toFixed(2)}\\,\\text{W}`} /><br />
                                        <InlineMath math={`\\tau_M = ${result.tauM.toFixed(0)}\\,\\text{s}`} /> (giao điểm đường song song trục hoành và đường hồi quy pha 2)<br />
                                        <InlineMath math={`m_{\\text{da}} = ${(M_DA * 1000).toFixed(0)}\\,\\text{g} = ${M_DA.toFixed(4)}\\,\\text{kg}`} /><br />
                                        <div className="mt-1 flex items-center gap-2">
                                            <InlineMath math={`\\displaystyle \\lambda = \\frac{\\bar{\\mathcal{P}} \\cdot \\tau_M}{m_{\\text{da}}}`} />
                                            <span>=</span>
                                            <InlineMath math={`\\frac{${result.Pavg.toFixed(2)} \\times ${result.tauM.toFixed(0)}}{${M_DA.toFixed(4)}}`} />
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-1 mt-3">
                                        <div className="font-mono text-[19px] font-semibold text-emerald-600">
                                            λ = {(result.lambda / 1e5).toFixed(4)} × 10⁵ J/kg
                                        </div>
                                        <div className="text-[12px] text-slate-500">
                                            Lý thuyết <InlineMath math="\lambda = 3{,}34 \times 10^5\,\text{J/kg}" /> · Sai số <em className="text-amber-600 font-bold not-italic font-mono ml-0.5">{result.err.toFixed(1)} %</em>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
