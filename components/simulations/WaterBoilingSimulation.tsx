import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, Activity } from 'lucide-react';
import { BlockMath, InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';

// ─── Hằng số vật lí ──────────────────────────────
const L_LY_THUYET = 2.26e6;
const P_DANH_DINH = 15.20;
const P_DAODONG = 0.05;
const M0 = 0.1200;
const T_SOI = 100.0;
const DT = 2.0;

interface RecordData {
  n: number;
  tau: number;
  power: number;
  mass: number;
}

interface Particle {
  type: 'bubble' | 'steam';
  x: number;
  y: number;
  r: number;
  vx?: number;
  vy: number;
  life: number;
  op?: number;
}

export default function WaterBoilingSimulation() {
  const [isRunning, setIsRunning] = useState(false);
  const [tickCount, setTickCount] = useState(0); // Dùng tick(integer) thay vì hệ float cho vòng lặp
  const [mass, setMass] = useState(M0);
  const [powerNow, setPowerNow] = useState(0);
  const [dataRecords, setDataRecords] = useState<RecordData[]>([{ n: 1, tau: 0, power: 0, mass: M0 }]);
  const [autoMode, setAutoMode] = useState(true);

  // SVG Size Meta tracking
  const [svgMeta, setSvgMeta] = useState({ W: 600, H: 224 });

  // For Area 3
  const [pointP, setPointP] = useState<{ tau: string; m: string }>({ tau: '', m: '' });
  const [pointQ, setPointQ] = useState<{ tau: string; m: string }>({ tau: '', m: '' });
  const [clickPhase, setClickPhase] = useState(0);
  const [result, setResult] = useState<{ Pavg: number; dTau: number; dMass: number; Lcalc: number; err: number; tauP: number; tauQ: number; mP: number; mQ: number } | null>(null);

  const steamCanvasRef = useRef<HTMLCanvasElement>(null);
  const chartWrapRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<Particle[]>([]);

  // Tham chiếu luồng vật lí nền
  const physics = useRef({
      tickCount: 0,
      mass: M0,
      powerNow: 0,
  });

  const autoModeRef = useRef(autoMode);
  useEffect(() => { autoModeRef.current = autoMode; }, [autoMode]);

  // Luồng tính toán Vật lí (100ms / tick)
  useEffect(() => {
    let loopId: NodeJS.Timeout;
    if (isRunning) {
       loopId = setInterval(() => {
           physics.current.tickCount++;
           const currentTick = physics.current.tickCount;
           const currentTau = currentTick * DT;
           
           // Tính P (powerNow)
           const p = P_DANH_DINH + (Math.random() * 2 - 1) * P_DAODONG;
           physics.current.powerNow = Math.round(p * 100) / 100;

           // Tính khối lượng m theo năng lượng ΔE = P * Δt
           physics.current.mass = Math.max(0, physics.current.mass - (physics.current.powerNow * DT) / L_LY_THUYET);
           
           // Đồng bộ React State
           setTickCount(currentTick);
           setPowerNow(physics.current.powerNow);
           setMass(physics.current.mass);
           
           // Auto Record (kiểm tra bằng tỷ lệ chia chẵn tickCount, an toàn 100%)
           const ticksPerRecord = 120 / DT;
           if (autoModeRef.current && currentTick % ticksPerRecord === 0) {
               setDataRecords(prev => {
                   const lastTau = prev.length > 0 ? prev[prev.length - 1].tau : -1;
                   if (currentTau !== lastTau) {
                       return [...prev, {
                           n: prev.length + 1,
                           tau: currentTau,
                           power: physics.current.powerNow,
                           mass: physics.current.mass
                       }];
                   }
                   return prev;
               });
           }
           
           // Giới hạn thời gian (840s) thay vì dùng float -> đo theo tick (840/2 = 420)
           if (currentTick >= 840 / DT) {
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

  const togglePower = () => setIsRunning(!isRunning);

  const manualRecord = () => {
    if (!isRunning) return;
    setDataRecords((prev) => [
      ...prev,
      {
        n: prev.length + 1,
        tau: physics.current.tickCount * DT,
        power: parseFloat(physics.current.powerNow.toFixed(2)),
        mass: parseFloat(physics.current.mass.toFixed(4))
      }
    ]);
  };

  const clearData = () => {
    // Reset core hook values
    physics.current.tickCount = 0;
    physics.current.mass = M0;
    physics.current.powerNow = 0;
    
    // Reset react display values
    setTickCount(0);
    setMass(M0);
    setPowerNow(0);
    setDataRecords([{ n: 1, tau: 0, power: 0, mass: M0 }]);
    setClickPhase(0);
    setPointP({ tau: '', m: '' });
    setPointQ({ tau: '', m: '' });
    setResult(null);
    setIsRunning(false); // Dừng hệ thống nếu đang đun
  };

  // ─── Quan sát (Observer) tự động co giãn kích thước SVG ────────────────
  useEffect(() => {
    const wrap = chartWrapRef.current;
    if (!wrap) return;
    
    const updateSize = () => {
       setSvgMeta({ W: wrap.clientWidth || 600, H: wrap.clientHeight || 224 });
    };
    
    const observer = new ResizeObserver(updateSize);
    observer.observe(wrap);
    updateSize(); // Initial call
    
    return () => observer.disconnect();
  }, []);

  // ─── Animation hơi nước + bọt khí (Tối ưu Ref & RequestAnimationFrame) ────────────────
  useEffect(() => {
    const canvas = steamCanvasRef.current;
    if (!canvas || !canvas.parentElement) return;
    
    // Auto resize canvas to match parent
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
      const scX = canvas.width / 380;
      const scY = canvas.height / 205;
      const fL = 136 * scX;
      const fR = 244 * scX;
      const wT = 107 * scY;
      const mY = 60 * scY;

      // Mình dùng isRunning thẳng từ state (vấn đề stale closure không ảnh hưởng nếu React useEffect tự clean up)
      if (isRunning) {
        if (Math.random() < 0.42) {
          particlesRef.current.push({
            type: 'bubble',
            x: fL + Math.random() * (fR - fL),
            y: (160 + Math.random() * 12) * scY,
            r: 1 + Math.random() * 2,
            vy: -(0.5 + Math.random() * 1),
            life: 1
          });
        }
        if (Math.random() < 0.38) {
          particlesRef.current.push({
            type: 'steam',
            x: fL + Math.random() * (fR - fL),
            y: mY,
            r: 4 + Math.random() * 5,
            vx: (Math.random() - 0.5) * 0.8,
            vy: -(0.7 + Math.random() * 1.2),
            life: 1,
            op: 0.18 + Math.random() * 0.12
          });
        }
      }

      particlesRef.current = particlesRef.current.filter((p) => p.life > 0);

      for (const p of particlesRef.current) {
        ctx.save();
        if (p.type === 'bubble') {
          if (p.y < wT) { p.life = 0; ctx.restore(); continue; }
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(147,197,253,${p.life * 0.55})`;
          ctx.lineWidth = 0.6;
          ctx.stroke();
          p.y += p.vy;
          p.life -= 0.022;
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * (1.7 - p.life), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(186,216,228,${p.life * (p.op || 1)})`;
          ctx.fill();
          if (p.vx) p.x += p.vx;
          p.y += p.vy;
          p.r += 0.15;
          p.life -= 0.010;
        }
        ctx.restore();
      }
      animFrameId = requestAnimationFrame(renderLoop);
    };

    renderLoop();

    return () => {
      cancelAnimationFrame(animFrameId);
      observer.disconnect();
    };
  }, [isRunning]);


  // ─── Tính L ───────────────────────
  const calcL = () => {
    const tauPv = parseFloat(pointP.tau);
    const mPv = parseFloat(pointP.m);
    const tauQv = parseFloat(pointQ.tau);
    const mQv = parseFloat(pointQ.m);

    if (isNaN(tauPv) || isNaN(mPv) || isNaN(tauQv) || isNaN(mQv)) {
      alert('⚠️ Hãy chọn đủ điểm P và Q!');
      return;
    }
    if (tauPv === 0 || tauQv === 0) {
      alert('⚠️ CẢNH BÁO SƯ PHẠM: Không dùng điểm tĩnh (chưa bật điện đun) τ = 0 để làm mốc tính L! Hãy chọn điểm khác.');
      return;
    }
    if (mPv <= mQv) {
      alert('⚠️ m_P phải lớn hơn m_Q (Khoảng điểm P phải nằm trước điểm Q)!');
      return;
    }
    if (tauQv <= tauPv) {
      alert('⚠️ τ_Q phải kéo dài hơn τ_P!');
      return;
    }

    const active = dataRecords.filter((r) => r.power > 0);
    const Pavg = active.length > 0 ? active.reduce((s, r) => s + r.power, 0) / active.length : P_DANH_DINH;
    const dTau = tauQv - tauPv;
    const dMass = mPv - mQv;
    const Lcalc = (Pavg * dTau) / dMass;
    const err = Math.abs(Lcalc - L_LY_THUYET) / L_LY_THUYET * 100;

    setResult({ Pavg, dTau, dMass, Lcalc, err, tauP: tauPv, tauQ: tauQv, mP: mPv, mQ: mQv });
  };

  // ─── Thông số thiết lập biểu đồ SVG ───────────────────────
  const pad = { top: 14, right: 14, bottom: 42, left: 68 };
  const W = svgMeta.W;
  const H = svgMeta.H;

  let tMin = 0, tMax = 120, mMin = 0.1, mMax = 0.13;
  if (dataRecords.length >= 2) {
    const tauArr = dataRecords.map(r => r.tau);
    const massArr = dataRecords.map(r => r.mass);
    tMin = Math.min(...tauArr); tMax = Math.max(...tauArr);
    mMin = Math.min(...massArr); mMax = Math.max(...massArr);
    const tR = tMax - tMin || 120;
    const mR = mMax - mMin || 0.001;
    tMin -= tR * 0.08; tMax += tR * 0.08;
    mMin -= mR * 0.25; mMax += mR * 0.25;
  }

  const toX = (t: number) => pad.left + (t - tMin) / (tMax - tMin) * (W - pad.left - pad.right);
  const toY = (m: number) => pad.top + (1 - (m - mMin) / (mMax - mMin)) * (H - pad.top - pad.bottom);

  let regressionLine = null;
  if (dataRecords.length >= 3) {
    const n = dataRecords.length;
    const sx = dataRecords.reduce((s, r) => s + r.tau, 0);
    const sy = dataRecords.reduce((s, r) => s + r.mass, 0);
    const sxy = dataRecords.reduce((s, r) => s + r.tau * r.mass, 0);
    const sx2 = dataRecords.reduce((s, r) => s + r.tau * r.tau, 0);
    const slope = (n * sxy - sx * sy) / (n * sx2 - sx * sx);
    const intercept = (sy - slope * sx) / n;
    regressionLine = {
      x1: toX(tMin), y1: toY(slope * tMin + intercept),
      x2: toX(tMax), y2: toY(slope * tMax + intercept)
    };
  }

  const handleChartClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (dataRecords.length < 2) return;
    const svgRect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - svgRect.left;
    const py = e.clientY - svgRect.top;

    const scaleX = W / svgRect.width;
    const scaleY = H / svgRect.height;
    const lpx = px * scaleX;
    const lpy = py * scaleY;

    // Chặn click vọt ra ngoài vùng biên của biểu đồ
    if (lpx < pad.left || lpx > W - pad.right || lpy < pad.top || lpy > H - pad.bottom) {
        return;
    }

    const t = tMin + (lpx - pad.left) / (W - pad.left - pad.right) * (tMax - tMin);
    const m = mMin + (1 - (lpy - pad.top) / (H - pad.top - pad.bottom)) * (mMax - mMin);

    let bestDist = 999;
    let bestRecord = dataRecords[0];

    for (const r of dataRecords) {
      const d = Math.sqrt((toX(r.tau) - lpx) ** 2 + (toY(r.mass) - lpy) ** 2);
      if (d < bestDist) {
        bestDist = d;
        bestRecord = r;
      }
    }

    const snapT = bestDist < 22 ? bestRecord.tau : Math.round(t);
    const snapM = bestDist < 22 ? bestRecord.mass : parseFloat(m.toFixed(4));

    if (snapT === 0) {
        alert('⚠️ CẢNH BÁO SƯ PHẠM: Đây là mốc Cân hệ tĩnh ban đầu khi chưa cấp nguồn (P=0). Không thể sử dụng điểm τ = 0 để tính sai phân L. Vui lòng chọn mốc sau khi đun!');
        return;
    }

    if (clickPhase === 0 || clickPhase === 2) {
      setPointP({ tau: String(snapT), m: snapM.toFixed(4) });
      setPointQ({ tau: '', m: '' });
      setClickPhase(1);
    } else {
      setPointQ({ tau: String(snapT), m: snapM.toFixed(4) });
      setClickPhase(2);
    }
  };

  return (
    <div className="flex flex-col w-full max-w-[1240px] mx-auto p-4 md:p-6 gap-6 bg-white font-sans text-gray-900 border border-gray-200 shadow-sm rounded-xl">
      <div className="space-y-2 border-b border-gray-100 pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 font-serif">Đo Nhiệt Hoá Hơi Riêng Của Nước</h1>
        <div className="text-[13px] text-gray-500 font-medium flex-wrap flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 w-fit">
          <span>Xác định <InlineMath math="L" /> tại <InlineMath math="100^\circ\text{C}" /></span>
          <span className="text-slate-300">|</span>
          <span>Sách giáo khoa VL12 - Bảng 6.2</span>
          <span className="text-slate-300">|</span>
          <span className="text-indigo-600 font-semibold bg-white border border-indigo-100 px-2 py-0.5 rounded shadow-sm">
             <InlineMath math="L = \frac{\bar{\mathcal{P}}(\tau_Q - \tau_P)}{m_P - m_Q}" />
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 items-start">
        {/* KHU VỰC 1 */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col items-stretch ring-1 ring-gray-900/5">
          <div className="flex items-center gap-2 p-3 bg-blue-50/50 border-b border-gray-200">
            <div className="w-6 h-6 rounded bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-600 text-xs shadow-sm">⚗️</div>
            <span className="text-[12px] font-bold tracking-widest uppercase text-gray-600">Bàn Thí Nghiệm Ảo</span>
          </div>
          
          <div className="p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 border border-gray-200 shadow-inner">
              <div className="flex items-center gap-2.5">
                <div className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${isRunning ? 'bg-red-500 shadow-[0_0_0_4px_#fee2e2]' : 'bg-gray-300'}`}></div>
                <span className="text-[13px] font-medium text-gray-700">Nguồn sục sôi</span>
              </div>
              <button
                onClick={togglePower}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-semibold transition-all shadow-sm ${isRunning ? 'bg-red-600 text-white hover:bg-red-700 ring-4 ring-red-600/10' : 'bg-gray-900 text-white hover:bg-gray-800'}`}
              >
                {isRunning ? <><Pause size={14} /> Dừng đun</> : <><Play size={14} className="ml-0.5" /> Bật nguồn</>}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-slate-50 border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-slate-300/60"></div>
                <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400 mb-1">Thời gian τ</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-[1.8rem] font-mono tracking-tighter text-gray-800 leading-none">{Math.round(tickCount * DT).toString().padStart(3, '0')}</span>
                  <span className="text-[13px] font-medium text-slate-400">s</span>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-slate-50 border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-orange-200/60"></div>
                <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400 mb-1">Cân điện tử m</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-[1.8rem] font-mono tracking-tighter text-gray-800 leading-none">{mass.toFixed(4)}</span>
                  <span className="text-[12px] font-medium text-slate-400">kg</span>
                </div>
              </div>
            </div>

            <div className="relative w-full h-[210px] bg-slate-50 border border-slate-200 rounded-lg overflow-hidden shadow-inner flex-shrink-0">
              <svg viewBox="0 0 380 205" className="w-full h-full absolute inset-0">
                {/* SVG Graphics 100% like native template */}
                <ellipse cx="190" cy="197" rx="88" ry="7" fill="#e8e8e5" stroke="#d4d4d0" strokeWidth="1" />
                <rect x="185" y="196" width="10" height="8" fill="#e0e0dc" />
                <rect x="162" y="203" width="56" height="3" fill="#e0e0dc" rx="1.5" />

                <rect x="127" y="60" width="126" height="134" rx="8" fill="#fafaf8" stroke="#d4d4d0" strokeWidth="1.5" />
                <rect x="134" y="67" width="112" height="121" rx="5" fill="#f2f2ef" stroke="#e0e0dc" strokeWidth="1" />

                <rect x="136" y="105" width="108" height="81" rx="3" fill="#dbeeff" opacity=".88" />
                <rect x="138" y="107" width="22" height="77" rx="2" fill="#eef6ff" opacity=".5" />

                <rect x="123" y="54" width="134" height="9" rx="4" fill="#e8e8e5" stroke="#d4d4d0" strokeWidth="1" />

                <rect x="150" y="176" width="80" height="7" rx="3" fill={isRunning ? '#fed7aa' : '#d4d4d0'} stroke={isRunning ? '#f97316' : '#c0c0bc'} strokeWidth="1" className="transition-colors duration-500" />
                {[158, 165, 172, 179, 186, 193, 200, 207, 214, 221].map(x => (
                  <line key={`heater-${x}`} x1={x} y1="176" x2={x} y2="183" stroke="#b0b0aa" strokeWidth="1.1" />
                ))}

                <rect x="30" y="100" width="40" height="70" rx="4" fill="#fafaf8" stroke="#d4d4d0" strokeWidth="1" />
                <text x="50" y="128" textAnchor="middle" fontSize="7" fill="#b0b0aa" fontFamily="sans-serif" fontWeight="600">NGUỒN</text>
                <text x="50" y="138" textAnchor="middle" fontSize="7" fill="#b0b0aa" fontFamily="sans-serif" fontWeight="600">DC</text>
                <text x="50" y="148" textAnchor="middle" fontSize="7" fill="#b0b0aa" fontFamily="sans-serif">15 V</text>

                <polyline points="150,180 138,180 138,62 134,62 134,54" fill="none" stroke="#fca5a5" strokeWidth="1.4" strokeDasharray="3,2" />
                <polyline points="134,54 134,40 50,40 50,100" fill="none" stroke="#fca5a5" strokeWidth="1.4" />
                <circle cx="50" cy="100" r="3" fill="#fca5a5" />

                <polyline points="230,180 242,180 242,62 246,62 246,54" fill="none" stroke="#93c5fd" strokeWidth="1.4" strokeDasharray="3,2" />
                <polyline points="246,54 246,40 321,40 321,122" fill="none" stroke="#93c5fd" strokeWidth="1.4" />
                <polyline points="321,148 321,192 50,192 50,170" fill="none" stroke="#93c5fd" strokeWidth="1.4" />
                <circle cx="50" cy="170" r="3" fill="#93c5fd" />

                <text x="190" y="86" textAnchor="middle" fontSize="8.5" fill="#b8b8b4" fontFamily="sans-serif" fontWeight="500">NHIỆT LƯỢNG KẾ</text>
                
                <rect x="210" y="38" width="6" height="86" rx="3" fill="#dbeeff" stroke="#93c5fd" strokeWidth="1" />
                <circle cx="213" cy="126" r="5" fill="#f87171" stroke="#fca5a5" strokeWidth="1" />
                <rect x="211.5" y="86" width="3" height="40" rx="1.5" fill="#f87171" />
                <text x="222" y="42" fontSize="7" fill="#b0b0aa" fontFamily="monospace">100°C</text>

                <rect x="296" y="122" width="50" height="26" rx="4" fill="#fafaf8" stroke="#d4d4d0" strokeWidth="1" />
                <text x="321" y="134" textAnchor="middle" fontSize="7" fill="#b0b0aa" fontFamily="sans-serif" fontWeight="600">OÁT KẾ</text>
                <text x="321" y="143" textAnchor="middle" fontSize="7.5" fill="#2383e2" fontFamily="monospace" fontWeight="bold">{isRunning ? powerNow.toFixed(2) : '0.00'} W</text>

                <rect x="8" y="8" width="54" height="42" rx="4" fill="#fafaf8" stroke="#d4d4d0" strokeWidth="1" />
                <text x="35" y="22" textAnchor="middle" fontSize="7" fill="#b0b0aa" fontFamily="sans-serif" fontWeight="600">CÂN</text>
                <text x="35" y="35" textAnchor="middle" fontSize="8.5" fill="#191918" fontFamily="monospace">{mass.toFixed(4)}</text>
                <text x="35" y="45" textAnchor="middle" fontSize="6.5" fill="#b0b0aa" fontFamily="sans-serif">kg</text>
              </svg>
              <canvas ref={steamCanvasRef} className="absolute inset-0 pointer-events-none w-full h-full"></canvas>
            </div>

            <div className="mt-2 rounded-lg border border-indigo-100 bg-indigo-50/50 p-3 text-[12.5px] leading-relaxed text-indigo-900 shadow-sm">
              <p className="font-semibold mb-1 flex items-center gap-1.5"><Activity size={14} className="text-indigo-600"/> Quy trình SGK:</p>
              <ul className="list-decimal list-inside space-y-0.5 opacity-90 pl-1 text-xs">
                <li>Đặt lên cân <InlineMath math="\rightarrow" /> xác định <b><InlineMath math="m_0 = 0.1200\,\text{kg}" /></b>.</li>
                <li>Bật điện sưởi đun sôi nước trên 100°C.</li>
                <li>Hệ thống đo (Oát kế, Cân, Timer) sẽ báo chỉ số đo để lưu trữ vào bảng mỗi 120 giây.</li>
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
                        <RotateCcw size={12}/> Xóa bảng đo
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

              <div className="border border-gray-200 rounded-lg overflow-hidden relative shadow-sm">
                <table className="w-full text-[13px] text-gray-700">
                  <thead className="bg-slate-50 border-b border-gray-200">
                    <tr>
                      <th className="py-2.5 px-4 font-bold text-gray-500 uppercase tracking-tighter text-[10.5px] text-left">Lần</th>
                      <th className="py-2.5 px-4 font-bold text-gray-500 uppercase tracking-tighter text-[10.5px] text-right">T.Gian τ (s)</th>
                      <th className="py-2.5 px-4 font-bold text-gray-500 uppercase tracking-tighter text-[10.5px] text-right">C.Suất P (W)</th>
                      <th className="py-2.5 px-4 font-bold text-gray-500 uppercase tracking-tighter text-[10.5px] text-right">Khối lượng m (kg)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {dataRecords.length === 0 ? (
                      <tr><td colSpan={4} className="text-center text-gray-400 py-8 text-[13px] italic bg-gray-50">Chưa có dữ liệu thí nghiệm.</td></tr>
                    ) : (
                      dataRecords.map((r, i) => (
                        <tr key={i} className={`hover:bg-blue-50/50 transition-colors group ${i === dataRecords.length - 1 ? 'animate-pulse bg-blue-50/30' : ''}`}>
                          <td className="py-2.5 px-4 font-medium text-gray-500 group-hover:text-gray-900">{r.n}</td>
                          <td className="py-2.5 px-4 font-mono text-right">{r.tau}</td>
                          <td className={`py-2.5 px-4 font-mono text-right ${r.power === 0 ? 'text-gray-400' : 'text-blue-700 font-medium'}`}>{r.power === 0 ? '0' : r.power.toFixed(2)}</td>
                          <td className="py-2.5 px-4 font-mono text-right font-medium">{r.mass.toFixed(4)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="text-[11.5px] text-slate-500 mt-2.5 pl-1 italic font-medium">
                  * Dòng <b><InlineMath math="\tau = 0" /></b>, <b><InlineMath math="\mathcal{P} = 0" /></b>: Mốc lượng tĩnh ban đầu (Chưa cấp điện đo đạc)
              </div>
            </div>
          </div>

          {/* KHU VỰC 3 */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden ring-1 ring-gray-900/5">
            <div className="flex items-center gap-2 p-3 bg-purple-50/60 border-b border-gray-200">
              <div className="w-6 h-6 rounded bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-600 font-bold text-[13px] shadow-sm">∿</div>
              <span className="text-[12px] font-bold tracking-widest uppercase text-gray-600">Đồ Thị m(τ) & Tính L</span>
            </div>
            
            <div className="p-4 flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap gap-2 items-center">
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 border border-blue-200 rounded-md shadow-sm">
                    <span className="font-bold text-blue-700 text-xs">P</span>
                    <input
                      type="number" className="w-[42px] bg-transparent text-right outline-none font-mono placeholder-blue-300 font-medium text-blue-900 text-[12px]"
                      placeholder="τ" value={pointP.tau} onChange={e => setPointP({ ...pointP, tau: e.target.value })}
                    />
                    <span className="text-blue-300">|</span>
                    <input
                      type="number" className="w-[58px] bg-transparent text-right outline-none font-mono placeholder-blue-300 font-medium text-blue-900 text-[12px]"
                      placeholder="m(kg)" value={pointP.m} onChange={e => setPointP({ ...pointP, m: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-rose-50 border border-rose-200 rounded-md shadow-sm">
                    <span className="font-bold text-rose-700 text-xs">Q</span>
                    <input
                      type="number" className="w-[42px] bg-transparent text-right outline-none font-mono placeholder-rose-300 font-medium text-rose-900 text-[12px]"
                      placeholder="τ" value={pointQ.tau} onChange={e => setPointQ({ ...pointQ, tau: e.target.value })}
                    />
                    <span className="text-rose-300">|</span>
                    <input
                      type="number" className="w-[58px] bg-transparent text-right outline-none font-mono placeholder-rose-300 font-medium text-rose-900 text-[12px]"
                      placeholder="m(kg)" value={pointQ.m} onChange={e => setPointQ({ ...pointQ, m: e.target.value })}
                    />
                  </div>
                </div>
                <button
                  onClick={calcL}
                  disabled={dataRecords.length < 2}
                  className="px-4 py-1.5 text-[12.5px] font-bold rounded-md bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors border border-purple-800"
                >
                  Tiến hành Tính L
                </button>
              </div>

              {/* Chart Wrap Observe for dynamic layout matching original index.html */}
              <div ref={chartWrapRef} className="w-full h-[240px] bg-white border border-gray-200 rounded-lg relative shadow-sm overflow-hidden">
                <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" onClick={handleChartClick} className="cursor-crosshair block absolute inset-0">
                  <rect x="0" y="0" width={W} height={H} fill="#ffffff" />
                  {/* Grid */}
                  {Array.from({ length: 6 }).map((_, i) => (
                    <line key={`hy${i}`} x1={pad.left} y1={pad.top + (H - pad.top - pad.bottom) * i / 5} x2={W - pad.right} y2={pad.top + (H - pad.top - pad.bottom) * i / 5} stroke="#f1f5f9" strokeWidth="1.5" />
                  ))}
                  {Array.from({ length: 6 }).map((_, i) => (
                    <line key={`vx${i}`} x1={pad.left + (W - pad.left - pad.right) * i / 5} y1={pad.top} x2={pad.left + (W - pad.left - pad.right) * i / 5} y2={H - pad.bottom} stroke="#f1f5f9" strokeWidth="1.5" />
                  ))}

                  {/* Axes */}
                  <polyline points={`${pad.left},${pad.top} ${pad.left},${H - pad.bottom} ${W - pad.right},${H - pad.bottom}`} fill="none" stroke="#64748b" strokeWidth="1.5" />
                  <text x={W / 2} y={H - 8} textAnchor="middle" fontSize="10.5" fontFamily="monospace" fontWeight="500" fill="#64748b">Thời gian τ (s)</text>
                  <text x={0} y={0} textAnchor="middle" fontSize="10.5" fontFamily="monospace" fontWeight="500" fill="#64748b" transform={`translate(16,${H / 2}) rotate(-90)`}>Khối lượng m (kg)</text>

                  {/* Data & Plot */}
                  {dataRecords.length >= 2 && regressionLine && (
                    <>
                      {Array.from({ length: 6 }).map((_, i) => (
                        <text key={`lblt${i}`} x={toX(tMin + (tMax - tMin) * i / 5)} y={H - pad.bottom + 15} textAnchor="middle" fontSize="10" fontFamily="monospace" fill="#94a3b8">{Math.round(tMin + (tMax - tMin) * i / 5)}</text>
                      ))}
                      {Array.from({ length: 6 }).map((_, i) => (
                        <text key={`lblm${i}`} x={pad.left - 6} y={toY(mMin + (mMax - mMin) * i / 5) + 3} textAnchor="end" fontSize="10" fontFamily="monospace" fill="#94a3b8">{(mMin + (mMax - mMin) * i / 5).toFixed(4)}</text>
                      ))}
                      <line x1={regressionLine.x1} y1={regressionLine.y1} x2={regressionLine.x2} y2={regressionLine.y2} stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="5,4" />
                      {dataRecords.map((r, i) => (
                        <circle key={`pt${i}`} cx={toX(r.tau)} cy={toY(r.mass)} r="4" fill={r.tau === 0 ? "#cbd5e1" : "#2383e2"} stroke="#fff" strokeWidth="1" />
                      ))}
                    </>
                  )}

                  {/* PQ GuideLines */}
                  {pointP.tau && pointP.m && !isNaN(parseFloat(pointP.tau)) && (
                    <g>
                      <line x1={toX(parseFloat(pointP.tau))} y1={toY(parseFloat(pointP.m))} x2={toX(parseFloat(pointP.tau))} y2={H - pad.bottom} stroke="#2383e2" opacity="0.4" strokeWidth="1" strokeDasharray="3,3" />
                      <line x1={toX(parseFloat(pointP.tau))} y1={toY(parseFloat(pointP.m))} x2={pad.left} y2={toY(parseFloat(pointP.m))} stroke="#2383e2" opacity="0.4" strokeWidth="1" strokeDasharray="3,3" />
                      <circle cx={toX(parseFloat(pointP.tau))} cy={toY(parseFloat(pointP.m))} r="6" fill="#fff" stroke="#2383e2" strokeWidth="2" />
                      <text x={toX(parseFloat(pointP.tau))} y={toY(parseFloat(pointP.m)) - 10} textAnchor="middle" fontSize="11" fontWeight="bold" fontFamily="serif" fill="#1d4ed8">P</text>
                    </g>
                  )}
                  {pointQ.tau && pointQ.m && !isNaN(parseFloat(pointQ.tau)) && (
                    <g>
                      <line x1={toX(parseFloat(pointQ.tau))} y1={toY(parseFloat(pointQ.m))} x2={toX(parseFloat(pointQ.tau))} y2={H - pad.bottom} stroke="#e05a3a" opacity="0.4" strokeWidth="1" strokeDasharray="3,3" />
                      <line x1={toX(parseFloat(pointQ.tau))} y1={toY(parseFloat(pointQ.m))} x2={pad.left} y2={toY(parseFloat(pointQ.m))} stroke="#e05a3a" opacity="0.4" strokeWidth="1" strokeDasharray="3,3" />
                      <circle cx={toX(parseFloat(pointQ.tau))} cy={toY(parseFloat(pointQ.m))} r="6" fill="#fff" stroke="#e05a3a" strokeWidth="2" />
                      <text x={toX(parseFloat(pointQ.tau))} y={toY(parseFloat(pointQ.m)) - 10} textAnchor="middle" fontSize="11" fontWeight="bold" fontFamily="serif" fill="#c2410c">Q</text>
                    </g>
                  )}
                  {pointP.tau && pointP.m && pointQ.tau && pointQ.m && !isNaN(parseFloat(pointP.tau)) && !isNaN(parseFloat(pointQ.tau)) && (
                    <line
                      x1={toX(parseFloat(pointP.tau))} y1={toY(parseFloat(pointP.m))}
                      x2={toX(parseFloat(pointQ.tau))} y2={toY(parseFloat(pointQ.m))}
                      stroke="#6940a5" strokeWidth="2"
                    />
                  )}
                </svg>
              </div>

              {/* Box Render Kết Quả với KaTeX */}
              {result && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 mt-2 animate-fade-in shadow-inner overflow-x-auto">
                    <div className="text-[11.5px] font-bold tracking-widest text-slate-500 uppercase mb-4">Kết quả tính toán Toán học L</div>
                    
                    <div className="text-[14px] text-gray-800 leading-[2.6] font-serif pr-4 border-b border-slate-200/50 pb-5">
                        <InlineMath math={`\\bar{\\mathcal{P}} = ${result.Pavg.toFixed(2)}\\,\\text{W}`} /><br/>
                        <InlineMath math={`\\tau_Q - \\tau_P = ${result.tauQ}\\,\\text{s} - ${result.tauP}\\,\\text{s} = \\mathbf{${result.dTau}\\,\\text{s}}`} /><br/>
                        <InlineMath math={`m_P - m_Q = ${result.mP.toFixed(4)}\\,\\text{kg} - ${result.mQ.toFixed(4)}\\,\\text{kg} = \\mathbf{${result.dMass.toFixed(4)}\\,\\text{kg}}`} /><br/>
                        <InlineMath math={`\\displaystyle L = \\frac{\\bar{\\mathcal{P}}\\,(\\tau_Q - \\tau_P)}{m_P - m_Q} = \\frac{${result.Pavg.toFixed(2)}\\,\\text{W} \\times ${result.dTau}\\,\\text{s}}{${result.dMass.toFixed(4)}\\,\\text{kg}}`} />
                    </div>
                    
                    <div className="flex flex-col md:flex-row md:items-baseline gap-2 md:gap-5 mt-5">
                        <div className="font-mono text-[22px] font-semibold text-emerald-600">L = {(result.Lcalc / 1e6).toFixed(4)} × 10⁶ J/kg</div>
                        <div className="text-[13px] text-slate-500">
                            Lý thuyết <InlineMath math="L = 2{,}26 \times 10^6\,\text{J/kg}" /> · Sai số <em className="text-amber-600 font-bold not-italic font-mono ml-0.5">{result.err.toFixed(1)} %</em>
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
