import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Camera, Upload, ScanLine, RotateCcw, Info, Download,
  X, AlertTriangle, CheckCheck, ChevronDown, Key, Eye,
} from 'lucide-react';
import {
  processOMRImage, scoreOMR, detectAnchorsFromCanvas,
  OMRAnswers, AnswerKey, ScoreResult,
} from '../src/lib/omrProcessor';
import { supabase } from '../src/lib/supabase';
import { TELEGRAM_CHAT_ID, CLOUDFLARE_PROXY_URL } from '../src/lib/telegram';

// ── Types ──────────────────────────────────────────────────────────────────
interface OMRScannerProps {
  onShowToast: (msg: string, type: 'success' | 'error' | 'warning') => void;
}
type ScanStep = 'setup' | 'scanning' | 'review' | 'result';
interface ReviewData {
  answers: OMRAnswers;
  debugCanvas: HTMLCanvasElement;
  confidence: number;
  anchorsFound: number;
}

const emptyKey = (): AnswerKey => ({
  mc: Array(18).fill(''),
  tf: Array.from({ length: 4 }, () => ({ a: '', b: '', c: '', d: '' })),
  sa: Array(6).fill(''),
});
const ABCD = ['A', 'B', 'C', 'D'];
const ACCENT = '#6B7CDB';
const STABLE_THRESHOLD = 28; // frames (~0.9s at 30fps)

// ── AnswerKeyEditor ─────────────────────────────────────────────────────────
const AnswerKeyEditor: React.FC<{
  answerKey: AnswerKey;
  onChange: (k: AnswerKey) => void;
}> = ({ answerKey, onChange }) => {
  const [openSection, setOpenSection] = useState<'mc' | 'tf' | 'sa' | null>('mc');

  const setMC = (i: number, v: string) => {
    const mc = [...answerKey.mc];
    mc[i] = mc[i] === v ? '' : v;
    onChange({ ...answerKey, mc });
  };
  const setTF = (qi: number, key: 'a' | 'b' | 'c' | 'd', v: string) => {
    const tf = answerKey.tf.map((t, i) =>
      i === qi ? { ...t, [key]: t[key] === v ? '' : v } : t
    );
    onChange({ ...answerKey, tf });
  };
  const setSA = (i: number, v: string) => {
    const sa = [...answerKey.sa];
    sa[i] = v;
    onChange({ ...answerKey, sa });
  };

  const filled1 = answerKey.mc.filter(Boolean).length;
  const filled2 = answerKey.tf.filter(t => t.a || t.b || t.c || t.d).length;
  const filled3 = answerKey.sa.filter(Boolean).length;

  const Section = ({ id, label, count, total, children }: {
    id: 'mc' | 'tf' | 'sa'; label: string; count: number; total: number; children: React.ReactNode;
  }) => (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E9E9E7' }}>
      <button
        onClick={() => setOpenSection(openSection === id ? null : id)}
        className="w-full flex items-center justify-between px-5 py-3.5"
        style={{ background: openSection === id ? '#EEF0FB' : '#FAFAF9' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
            style={{ background: ACCENT }}>{id === 'mc' ? 'I' : id === 'tf' ? 'II' : 'III'}</div>
          <span className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>{label}</span>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{
            background: count === total ? '#EAF3EE' : '#F1F0EC',
            color: count === total ? '#448361' : '#787774',
          }}>{count}/{total}</span>
        </div>
        <ChevronDown className="w-4 h-4 transition-transform" style={{
          color: '#AEACA8', transform: openSection === id ? 'rotate(180deg)' : 'none',
        }} />
      </button>
      {openSection === id && <div className="p-4 bg-white">{children}</div>}
    </div>
  );

  return (
    <div className="space-y-3">
      <Section id="mc" label="Phần I — Trắc nghiệm ABCD" count={filled1} total={18}>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
          {answerKey.mc.map((val, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs font-mono w-6 text-right" style={{ color: '#AEACA8' }}>{i + 1}</span>
              <div className="flex gap-1">
                {ABCD.map(letter => (
                  <button key={letter} onClick={() => setMC(i, letter)}
                    className="w-7 h-7 rounded-md text-xs font-bold transition-all"
                    style={{
                      background: val === letter ? ACCENT : '#F7F6F3',
                      color: val === letter ? '#fff' : '#787774',
                      border: `1px solid ${val === letter ? ACCENT : '#E9E9E7'}`,
                    }}
                  >{letter}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section id="tf" label="Phần II — Đúng / Sai" count={filled2} total={4}>
        <div className="grid grid-cols-2 gap-4">
          {answerKey.tf.map((t, qi) => (
            <div key={qi} className="p-3 rounded-lg" style={{ background: '#F7F6F3', border: '1px solid #E9E9E7' }}>
              <p className="text-xs font-semibold mb-2" style={{ color: '#1A1A1A' }}>Câu {qi + 1}</p>
              {(['a', 'b', 'c', 'd'] as const).map(k => (
                <div key={k} className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] w-4" style={{ color: '#787774' }}>{k})</span>
                  {['D', 'S'].map(v => (
                    <button key={v} onClick={() => setTF(qi, k, v)}
                      className="px-2 py-0.5 rounded text-[11px] font-bold transition-all"
                      style={{
                        background: t[k] === v ? (v === 'D' ? '#059669' : '#DC2626') : '#E9E9E7',
                        color: t[k] === v ? '#fff' : '#787774',
                      }}
                    >{v === 'D' ? 'Đúng' : 'Sai'}</button>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      </Section>

      <Section id="sa" label="Phần III — Trả lời ngắn" count={filled3} total={6}>
        <div className="grid grid-cols-2 gap-3">
          {answerKey.sa.map((v, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs font-mono w-12 text-right shrink-0" style={{ color: '#AEACA8' }}>Câu {i + 1}</span>
              <input
                type="text" value={v} onChange={e => setSA(i, e.target.value)}
                placeholder="VD: 3.14 hoặc -5"
                className="flex-1 px-2.5 py-1.5 rounded-lg text-sm"
                style={{ background: '#F7F6F3', border: '1px solid #E9E9E7', color: '#1A1A1A', outline: 'none' }}
                onFocus={e => (e.target as HTMLElement).style.borderColor = ACCENT}
                onBlur={e => (e.target as HTMLElement).style.borderColor = '#E9E9E7'}
              />
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
};

// ── ScoreDisplay ────────────────────────────────────────────────────────────
const ScoreDisplay: React.FC<{
  answers: OMRAnswers;
  score: ScoreResult;
  answerKey: AnswerKey;
  confidence: number;
  anchorsFound: number;
  debugCanvas: HTMLCanvasElement | null;
  onReset: () => void;
}> = ({ answers, score, answerKey, confidence, anchorsFound, debugCanvas, onReset }) => {
  const [showOverlay, setShowOverlay] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showOverlay && debugCanvas && overlayRef.current) {
      overlayRef.current.innerHTML = '';
      const display = document.createElement('canvas');
      const maxW = Math.min(window.innerWidth - 48, 800);
      display.width = maxW;
      display.height = Math.round(maxW * (debugCanvas.height / debugCanvas.width));
      display.style.width = '100%';
      display.style.height = 'auto';
      display.style.display = 'block';
      display.getContext('2d')!.drawImage(debugCanvas, 0, 0, display.width, display.height);
      overlayRef.current.appendChild(display);
    }
  }, [showOverlay, debugCanvas]);

  const scoreColor = score.total >= 8 ? '#448361' : score.total >= 5 ? '#D9730D' : '#E03E3E';
  const scoreBg = score.total >= 8 ? '#EAF3EE' : score.total >= 5 ? '#FFF3E8' : '#FEF0F0';

  return (
    <div className="space-y-5">
      <div className="rounded-2xl p-6 text-center" style={{ background: scoreBg, border: `2px solid ${scoreColor}33` }}>
        <p className="text-sm font-semibold mb-1" style={{ color: scoreColor }}>Tổng điểm</p>
        <div className="text-6xl font-black tabular-nums" style={{ color: scoreColor }}>
          {score.total.toFixed(2)}
        </div>
        <p className="text-xs mt-1" style={{ color: scoreColor }}>/ 10.00 điểm</p>
        <div className="flex items-center justify-center gap-4 mt-4 text-sm">
          <span style={{ color: ACCENT }}>I: <b>{score.mc}</b>đ</span>
          <span className="w-px h-4" style={{ background: '#E9E9E7' }} />
          <span style={{ color: '#9065B0' }}>II: <b>{score.tf}</b>đ</span>
          <span className="w-px h-4" style={{ background: '#E9E9E7' }} />
          <span style={{ color: '#D9730D' }}>III: <b>{score.sa}</b>đ</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'SBD', value: answers.sbd || '—', icon: '🪪' },
          { label: 'Mã đề', value: answers.maDethi || '—', icon: '📋' },
          { label: 'Độ tin cậy', value: `${Math.round(confidence * 100)}%`, icon: '🎯' },
        ].map(item => (
          <div key={item.label} className="rounded-xl p-3 text-center" style={{ background: '#fff', border: '1px solid #E9E9E7' }}>
            <div className="text-lg mb-1">{item.icon}</div>
            <div className="text-xs" style={{ color: '#AEACA8' }}>{item.label}</div>
            <div className="text-sm font-bold mt-0.5" style={{ color: '#1A1A1A' }}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* Phần I */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E9E9E7', background: '#fff' }}>
        <div className="px-4 py-2.5" style={{ borderBottom: '1px solid #E9E9E7', background: '#FAFAF9' }}>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#AEACA8' }}>
            Phần I — {score.mcDetail.filter(Boolean).length}/18 câu đúng
          </p>
        </div>
        <div className="p-4 grid grid-cols-6 gap-1.5">
          {answers.mc.map((ans, i) => {
            const correct = score.mcDetail[i];
            const isWrong = ans && !correct;
            const missed = !ans && answerKey.mc[i];
            const isMulti = ans === '?';
            return (
              <div key={i} title={`Câu ${i + 1}: ${ans || '—'} (đáp án: ${answerKey.mc[i]})`}
                className="flex flex-col items-center gap-0.5"
                style={{ opacity: !ans && !answerKey.mc[i] ? 0.4 : 1 }}>
                <span className="text-[9px]" style={{ color: '#AEACA8' }}>{i + 1}</span>
                <div className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold"
                  style={{
                    background: isMulti ? '#FEF3C7' : correct ? '#EAF3EE' : isWrong ? '#FEF0F0' : missed ? '#FFF3E8' : '#F1F0EC',
                    color: isMulti ? '#D97706' : correct ? '#448361' : isWrong ? '#E03E3E' : missed ? '#D9730D' : '#AEACA8',
                    border: `1px solid ${isMulti ? '#FCD34D' : correct ? '#B7D9C4' : isWrong ? '#F5C2C2' : missed ? '#FDDBA0' : '#E9E9E7'}`,
                  }}>
                  {isMulti ? '!' : ans || '·'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Phần II */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E9E9E7', background: '#fff' }}>
        <div className="px-4 py-2.5" style={{ borderBottom: '1px solid #E9E9E7', background: '#FAFAF9' }}>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#AEACA8' }}>
            Phần II — Đúng/Sai ({score.tf.toFixed(2)}đ)
          </p>
        </div>
        <div className="p-3 grid grid-cols-4 gap-2">
          {answers.tf.map((t, i) => (
            <div key={i} className="rounded-lg p-2.5" style={{ background: '#F7F6F3', border: '1px solid #E9E9E7' }}>
              <p className="text-[10px] font-semibold mb-1.5" style={{ color: '#1A1A1A' }}>Câu {i + 1}</p>
              {(['a', 'b', 'c', 'd'] as const).map(k => {
                const key_val = answerKey.tf[i]?.[k];
                const ans_val = t[k];
                const isOk = ans_val && ans_val === key_val;
                const isWrong = ans_val && ans_val !== key_val;
                return (
                  <div key={k} className="flex items-center gap-1 mb-0.5">
                    <span className="text-[9px] w-3" style={{ color: '#AEACA8' }}>{k})</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{
                      background: isOk ? '#EAF3EE' : isWrong ? '#FEF0F0' : '#E9E9E7',
                      color: isOk ? '#448361' : isWrong ? '#E03E3E' : '#AEACA8',
                    }}>{ans_val || '·'}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Phần III */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E9E9E7', background: '#fff' }}>
        <div className="px-4 py-2.5" style={{ borderBottom: '1px solid #E9E9E7', background: '#FAFAF9' }}>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#AEACA8' }}>
            Phần III — Trả lời ngắn ({score.sa.toFixed(2)}đ)
          </p>
        </div>
        <div className="p-4 grid grid-cols-3 gap-3">
          {answers.sa.map((v, i) => {
            const correct = score.saDetail[i];
            return (
              <div key={i} className="rounded-lg p-2.5" style={{ background: '#F7F6F3', border: '1px solid #E9E9E7' }}>
                <p className="text-[10px] mb-1" style={{ color: '#AEACA8' }}>Câu {i + 1}</p>
                <p className="text-sm font-bold" style={{ color: correct ? '#448361' : v ? '#E03E3E' : '#AEACA8' }}>
                  {v || '—'}
                </p>
                {!correct && answerKey.sa[i] && (
                  <p className="text-[10px] mt-0.5" style={{ color: '#448361' }}>✓ {answerKey.sa[i]}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Xem lại ảnh đã chấm */}
      {debugCanvas && (
        <div>
          <button
            onClick={() => setShowOverlay(!showOverlay)}
            className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
            style={{ background: '#EEF0FB', color: ACCENT, border: `1px solid #C8D0F5` }}
          >
            <Eye className="w-3.5 h-3.5" />
            {showOverlay ? 'Ẩn' : 'Xem lại'} ảnh phiếu đã nhận diện
          </button>
          {showOverlay && (
            <div ref={overlayRef} className="mt-3 rounded-xl overflow-hidden"
              style={{ border: '1px solid #E9E9E7' }} />
          )}
        </div>
      )}

      <button onClick={onReset}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-colors"
        style={{ background: '#F7F6F3', color: '#57564F', border: '1px solid #E9E9E7' }}>
        <RotateCcw className="w-4 h-4" /> Chấm bài khác
      </button>
    </div>
  );
};

// ── ReviewScreen ────────────────────────────────────────────────────────────
// Màn hình kiểm tra sau khi quét — hiển thị ảnh warp + overlay bubble
const ReviewScreen: React.FC<{
  reviewData: ReviewData;
  answerKey: AnswerKey;
  onConfirm: () => void;
  onRetake: () => void;
}> = ({ reviewData, answerKey, onConfirm, onRetake }) => {
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!canvasContainerRef.current || !reviewData.debugCanvas) return;
    canvasContainerRef.current.innerHTML = '';
    const { debugCanvas } = reviewData;
    const display = document.createElement('canvas');
    const maxW = Math.min((window.innerWidth || 800) - 32, 800);
    const ratio = debugCanvas.height / debugCanvas.width;
    display.width = maxW;
    display.height = Math.round(maxW * ratio);
    display.style.width = '100%';
    display.style.height = 'auto';
    display.style.display = 'block';
    display.getContext('2d')!.drawImage(debugCanvas, 0, 0, display.width, display.height);
    canvasContainerRef.current.appendChild(display);
  }, [reviewData.debugCanvas]);

  // Build warning list
  const warnings: { text: string; level: 'error' | 'warn' }[] = [];
  reviewData.answers.mc.forEach((ans, i) => {
    if (ans === '?') warnings.push({ text: `P.I Câu ${i + 1}: Nhiều đáp án cùng được tô`, level: 'error' });
    else if (!ans && answerKey.mc[i]) warnings.push({ text: `P.I Câu ${i + 1}: Chưa tô đáp án`, level: 'warn' });
  });
  if (reviewData.anchorsFound < 4)
    warnings.push({ text: `Chỉ nhận diện được ${reviewData.anchorsFound}/4 ô vuông góc → ảnh có thể lệch`, level: 'error' });
  if (reviewData.confidence < 0.65)
    warnings.push({ text: `Độ rõ nét thấp (${Math.round(reviewData.confidence * 100)}%) → nên chụp lại`, level: 'warn' });

  const previewScore = answerKey.mc.some(Boolean) ? scoreOMR(reviewData.answers, answerKey) : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl shrink-0" style={{ background: '#EEF0FB' }}>
          <Eye className="w-5 h-5" style={{ color: ACCENT }} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm" style={{ color: '#1A1A1A' }}>
            Kiểm tra kết quả nhận diện
          </h3>
          <p className="text-xs mt-0.5" style={{ color: '#787774' }}>
            Bong bóng <span style={{ color: '#00BB55' }}>xanh</span> = đã tô •{' '}
            <span style={{ color: '#FF4444' }}>đỏ</span> = trống. Xác nhận khi đúng.
          </p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0" style={{
          background: reviewData.anchorsFound === 4 ? '#EAF3EE' : '#FEF0F0',
          color: reviewData.anchorsFound === 4 ? '#448361' : '#E03E3E',
        }}>
          {reviewData.anchorsFound}/4 anchor
        </span>
      </div>

      {/* ★ Annotated image — trung tâm của màn hình review */}
      <div
        ref={canvasContainerRef}
        className="w-full rounded-xl overflow-hidden"
        style={{
          border: `2px solid ${reviewData.anchorsFound === 4 ? '#B7D9C4' : '#F5C2C2'}`,
          background: '#111',
          minHeight: 100,
        }}
      />

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="rounded-xl p-4 space-y-1.5"
          style={{ background: '#FFF8F0', border: '1px solid #FDDBA0' }}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: '#D9730D' }} />
            <span className="text-sm font-semibold" style={{ color: '#D9730D' }}>
              {warnings.length} cảnh báo
            </span>
          </div>
          {warnings.map((w, i) => (
            <p key={i} className="text-xs" style={{ color: w.level === 'error' ? '#E03E3E' : '#57564F' }}>
              {w.level === 'error' ? '⚠ ' : '• '}{w.text}
            </p>
          ))}
        </div>
      )}

      {/* Quick info bar */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'SBD', value: reviewData.answers.sbd || '—' },
          { label: 'Mã đề', value: reviewData.answers.maDethi || '—' },
          { label: 'Tin cậy', value: `${Math.round(reviewData.confidence * 100)}%` },
          { label: 'Điểm tạm', value: previewScore ? `${previewScore.total.toFixed(1)}đ` : '—' },
        ].map(item => (
          <div key={item.label} className="rounded-xl p-3 text-center"
            style={{ background: '#fff', border: '1px solid #E9E9E7' }}>
            <div className="text-[10px] mb-0.5" style={{ color: '#AEACA8' }}>{item.label}</div>
            <div className="text-sm font-bold" style={{ color: '#1A1A1A' }}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 pt-1">
        <button onClick={onRetake}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold"
          style={{ background: '#F7F6F3', color: '#57564F', border: '1px solid #E9E9E7' }}>
          <RotateCcw className="w-4 h-4" /> Chụp lại
        </button>
        <button onClick={onConfirm}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold shadow-lg"
          style={{ background: ACCENT, color: '#fff', boxShadow: `0 4px 20px ${ACCENT}55` }}>
          <CheckCheck className="w-4 h-4" /> Xác nhận điểm
        </button>
      </div>
    </div>
  );
};

// ── Main Component ──────────────────────────────────────────────────────────
const OMRScanner: React.FC<OMRScannerProps> = ({ onShowToast }) => {
  const [step, setStep] = useState<ScanStep>('setup');
  const [answerKey, setAnswerKey] = useState<AnswerKey>(emptyKey);
  const [scanning, setScanning] = useState(false);
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const [scanResult, setScanResult] = useState<{
    answers: OMRAnswers;
    score: ScoreResult;
    confidence: number;
    anchorsFound: number;
    debugCanvas: HTMLCanvasElement | null;
  } | null>(null);

  // Camera
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);

  // Live detection state
  const [anchorsLive, setAnchorsLive] = useState(0);
  const [autoProgress, setAutoProgress] = useState(0);
  const stableCountRef = useRef(0);
  const captureCalledRef = useRef(false);
  const autoCaptureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const loopRef = useRef<number>(0);
  const [autoCaptureTrigger, setAutoCaptureTrigger] = useState(0);

  // Refs to break stale-closure in RAF → state callback chain
  const runScanRef = useRef<((source: File | HTMLCanvasElement) => Promise<void>)>(async () => { });
  const closeCameraRef = useRef<() => void>(() => { });

  // Misc
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [templateFileId, setTemplateFileId] = useState<string | null>(null);
  const [isUploadingTemplate, setIsUploadingTemplate] = useState(false);
  const templateInputRef = useRef<HTMLInputElement>(null);
  const [canScan, setCanScan] = useState(false);

  useEffect(() => {
    setCanScan(answerKey.mc.filter(Boolean).length >= 5);
  }, [answerKey]);

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('id', 'omr_template_file_id').single()
      .then(({ data }) => { if (data?.value) setTemplateFileId(data.value); })
      .catch(() => { });
  }, []);

  // ── Template ──────────────────────────────────────────────────────────────
  const handleUploadTemplate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingTemplate(true);
    try {
      const formData = new FormData();
      formData.append('chat_id', TELEGRAM_CHAT_ID);
      formData.append('document', file);
      const res = await fetch(`${CLOUDFLARE_PROXY_URL}/proxy/sendDocument`, { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Proxy API lỗi');
      const data = await res.json();
      const fileId = data.result?.document?.file_id;
      if (!fileId) throw new Error('Không nhận được file_id');
      const { error } = await supabase.from('app_settings').upsert({ id: 'omr_template_file_id', value: fileId });
      if (error) throw error;
      setTemplateFileId(fileId);
      onShowToast('Đã lưu mẫu phiếu!', 'success');
    } catch (err: any) {
      onShowToast('Lỗi: ' + err.message, 'error');
    } finally {
      setIsUploadingTemplate(false);
      if (templateInputRef.current) templateInputRef.current.value = '';
    }
  };

  const handleDownloadTemplate = async () => {
    if (!templateFileId) return;
    try {
      const res = await fetch(`${CLOUDFLARE_PROXY_URL}/getFile/${templateFileId}`);
      if (!res.ok) throw new Error(`Lỗi: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'mau_phieu_thi.pdf';
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch (err: any) {
      onShowToast('Lỗi tải mẫu: ' + err.message, 'error');
    }
  };

  // ── Camera open/close ─────────────────────────────────────────────────────
  const openCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      onShowToast('Trình duyệt không hỗ trợ camera. Cần HTTPS + Chrome/Safari mới nhất.', 'error');
      return;
    }
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }
      setCameraStream(stream);
      setIsCameraOpen(true);
    } catch (err: any) {
      const name = err?.name || '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        onShowToast('Quyền camera bị từ chối. Vào Cài đặt → Camera để cấp lại.', 'error');
      } else if (name === 'NotFoundError') {
        onShowToast('Không tìm thấy camera. Thử upload ảnh thay thế.', 'error');
      } else {
        onShowToast(`Lỗi camera: ${err?.message || 'Không xác định'}`, 'error');
      }
    }
  }, [onShowToast]);

  const closeCamera = useCallback(() => {
    cameraStream?.getTracks().forEach(t => t.stop());
    setCameraStream(null);
    setIsCameraOpen(false);
    cancelAnimationFrame(loopRef.current);
    setAnchorsLive(0);
    setAutoProgress(0);
    stableCountRef.current = 0;
    captureCalledRef.current = false;
  }, [cameraStream]);

  useEffect(() => {
    if (isCameraOpen && videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [isCameraOpen, cameraStream]);

  // ── RAF live anchor detection loop ────────────────────────────────────────
  useEffect(() => {
    if (!isCameraOpen) {
      cancelAnimationFrame(loopRef.current);
      return;
    }
    captureCalledRef.current = false;
    stableCountRef.current = 0;
    let frameIdx = 0;

    const loop = () => {
      if (captureCalledRef.current) return;
      const video = videoRef.current;
      const overlay = overlayRef.current;
      if (!video || !overlay || !video.videoWidth || !video.videoHeight) {
        loopRef.current = requestAnimationFrame(loop);
        return;
      }

      frameIdx++;
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      overlay.width = vw;
      overlay.height = vh;
      const ctx = overlay.getContext('2d')!;
      ctx.clearRect(0, 0, vw, vh);

      // Only run detection every 3rd frame for performance
      if (frameIdx % 3 === 0) {
        const tmp = document.createElement('canvas');
        tmp.width = vw; tmp.height = vh;
        tmp.getContext('2d')!.drawImage(video, 0, 0);
        const { anchors, found } = detectAnchorsFromCanvas(tmp);
        setAnchorsLive(found);

        // Draw L-bracket markers at each anchor
        // Corner order: TL, TR, BL, BR → dx/dy direction of the bracket arms
        const cornerDirs: [number, number][] = [[1, 1], [-1, 1], [1, -1], [-1, -1]];
        const expectedPos: [number, number][] = [
          [0.04 * vw, 0.013 * vh],
          [0.96 * vw, 0.013 * vh],
          [0.04 * vw, 0.987 * vh],
          [0.96 * vw, 0.987 * vh],
        ];
        const armLen = Math.min(vw, vh) * 0.09;

        anchors.forEach((anchor, i) => {
          const isFound = !!anchor;
          const x = anchor ? anchor.x : expectedPos[i][0];
          const y = anchor ? anchor.y : expectedPos[i][1];
          const [dx, dy] = cornerDirs[i];

          ctx.save();
          ctx.strokeStyle = isFound ? '#00FF88' : 'rgba(255,255,255,0.25)';
          ctx.lineWidth = isFound ? 5 : 2.5;
          ctx.lineCap = 'round';
          if (isFound) {
            ctx.shadowColor = '#00FF88';
            ctx.shadowBlur = 10;
          }
          ctx.beginPath();
          ctx.moveTo(x + dx * armLen, y);
          ctx.lineTo(x, y);
          ctx.lineTo(x, y + dy * armLen);
          ctx.stroke();
          ctx.restore();

          // Dot at corner center
          if (isFound) {
            ctx.save();
            ctx.fillStyle = '#00FF88';
            ctx.shadowColor = '#00FF88';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        });

        // Auto-capture logic
        if (found === 4) {
          stableCountRef.current++;
          const prog = Math.min(100, Math.round((stableCountRef.current / STABLE_THRESHOLD) * 100));
          setAutoProgress(prog);

          if (stableCountRef.current >= STABLE_THRESHOLD && !captureCalledRef.current) {
            captureCalledRef.current = true;
            // Capture full-res frame
            const cap = document.createElement('canvas');
            cap.width = vw; cap.height = vh;
            cap.getContext('2d')!.drawImage(video, 0, 0);
            autoCaptureCanvasRef.current = cap;
            setAutoCaptureTrigger(n => n + 1);
            return;
          }
        } else {
          // Decay stable count when anchors lost
          stableCountRef.current = Math.max(0, stableCountRef.current - 4);
          setAutoProgress(Math.round((stableCountRef.current / STABLE_THRESHOLD) * 100));
        }
      }

      loopRef.current = requestAnimationFrame(loop);
    };

    // Start when video is ready
    const video = videoRef.current;
    const startLoop = () => { loopRef.current = requestAnimationFrame(loop); };
    if (video) {
      if (video.readyState >= 2) startLoop();
      else video.addEventListener('canplay', startLoop, { once: true });
    }
    return () => cancelAnimationFrame(loopRef.current);
  }, [isCameraOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Triggered by RAF loop via setAutoCaptureTrigger
  useEffect(() => {
    if (autoCaptureTrigger === 0) return;
    const canvas = autoCaptureCanvasRef.current;
    if (!canvas) return;
    autoCaptureCanvasRef.current = null;
    closeCameraRef.current();
    runScanRef.current(canvas);
  }, [autoCaptureTrigger]);

  // ── Scan / process ───────────────────────────────────────────────────────
  const runScan = useCallback(async (source: File | HTMLCanvasElement) => {
    if (!canScan) {
      onShowToast('Nhập ít nhất 5 đáp án Phần I trước khi chấm.', 'warning');
      return;
    }
    setScanning(true);
    setStep('scanning');
    try {
      // Always enable debug=true so we get the annotated canvas for review
      const result = await processOMRImage(source, true);
      if (!result.debugCanvas) throw new Error('Debug canvas không được tạo');
      setReviewData({
        answers: result.answers,
        debugCanvas: result.debugCanvas,
        confidence: result.confidence,
        anchorsFound: result.anchorsFound,
      });
      setStep('review');
    } catch (e: any) {
      onShowToast('Lỗi xử lý ảnh: ' + e.message, 'error');
      setStep('setup');
    } finally {
      setScanning(false);
    }
  }, [canScan, onShowToast]);

  // Keep refs fresh (used inside RAF → useEffect chain to avoid stale closures)
  useEffect(() => { runScanRef.current = runScan; }, [runScan]);
  useEffect(() => { closeCameraRef.current = closeCamera; }, [closeCamera]);

  const captureManually = useCallback(async () => {
    if (!videoRef.current) return;
    const cap = document.createElement('canvas');
    cap.width = videoRef.current.videoWidth;
    cap.height = videoRef.current.videoHeight;
    cap.getContext('2d')!.drawImage(videoRef.current, 0, 0);
    closeCamera();
    await runScan(cap);
  }, [closeCamera, runScan]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (!file.type.startsWith('image/')) {
      onShowToast('Vui lòng chọn file ảnh (JPG, PNG, HEIC...)', 'error');
      return;
    }
    await runScan(file);
  }, [runScan]);

  const confirmReview = useCallback(() => {
    if (!reviewData) return;
    const score = scoreOMR(reviewData.answers, answerKey);
    const confidencePct = Math.round(reviewData.confidence * 100);
    if (reviewData.anchorsFound < 4) {
      onShowToast(`${reviewData.anchorsFound}/4 anchor — kết quả có thể kém chính xác.`, 'warning');
    } else if (confidencePct < 70) {
      onShowToast(`Độ tin cậy thấp (${confidencePct}%). Nên xem xét chụp lại.`, 'warning');
    } else {
      onShowToast(`Chấm xong! Điểm: ${score.total.toFixed(2)}`, 'success');
    }
    setScanResult({
      answers: reviewData.answers,
      score,
      confidence: reviewData.confidence,
      anchorsFound: reviewData.anchorsFound,
      debugCanvas: reviewData.debugCanvas,
    });
    setStep('result');
  }, [reviewData, answerKey, onShowToast]);

  const retakeFromReview = useCallback(() => {
    setReviewData(null);
    setStep('setup');
  }, []);

  const reset = useCallback(() => {
    setScanResult(null);
    setReviewData(null);
    setStep('setup');
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="rounded-xl p-5 flex items-start gap-4" style={{ background: '#EEF0FB', border: '1px solid #C8D0F5' }}>
        <div className="p-2.5 rounded-xl shrink-0" style={{ background: ACCENT }}>
          <ScanLine className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-base font-semibold" style={{ color: '#1A1A1A' }}>
            Chấm Phiếu Trắc Nghiệm (OMR)
          </h2>
          <p className="text-sm mt-0.5" style={{ color: '#57564F' }}>
            Nhập đáp án → Hướng camera vào phiếu (tự chụp) → Xem lại → Xác nhận điểm.
          </p>
        </div>
      </div>

      {/* ── CAMERA OVERLAY ─────────────────────────────────────────────── */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-[200] flex flex-col bg-black" style={{ touchAction: 'none' }}>
          {/* Video + canvas overlay */}
          <div className="relative flex-1 overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
            />
            <canvas
              ref={overlayRef}
              className="absolute inset-0 w-full h-full"
              style={{ pointerEvents: 'none', objectFit: 'cover' }}
            />

            {/* Top HUD */}
            <div className="absolute top-0 left-0 right-0 flex flex-col items-center pt-safe pt-8 gap-3">
              {/* Anchor status pill */}
              <div
                className="px-4 py-2 rounded-full text-sm font-semibold backdrop-blur-md"
                style={{
                  background: anchorsLive === 4
                    ? 'rgba(0,187,85,0.85)'
                    : anchorsLive >= 2
                      ? 'rgba(217,115,13,0.85)'
                      : 'rgba(0,0,0,0.6)',
                  color: '#fff',
                  transition: 'background 0.3s',
                }}
              >
                {anchorsLive === 4
                  ? autoProgress >= 100
                    ? '📸 Chụp!'
                    : `✓ 4/4 góc — giữ nguyên...`
                  : `🔍 Đang tìm ${anchorsLive}/4 ô góc`
                }
              </div>

              {/* Instruction */}
              {anchorsLive < 4 && (
                <p className="text-white text-xs opacity-60 text-center px-8">
                  Hướng camera thẳng xuống phiếu · 4 ô đen ở 4 góc phải nằm trong khung
                </p>
              )}
            </div>

            {/* Auto-capture progress bar */}
            {anchorsLive === 4 && autoProgress > 0 && (
              <div className="absolute bottom-28 left-8 right-8">
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.2)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${autoProgress}%`,
                      background: '#00FF88',
                      transition: 'width 80ms linear',
                      boxShadow: '0 0 8px #00FF88',
                    }}
                  />
                </div>
                <p className="text-center text-xs mt-2" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  Đang tự động chụp... {autoProgress}%
                </p>
              </div>
            )}
          </div>

          {/* Bottom controls */}
          <div
            className="flex items-center justify-center gap-4 px-6 pb-safe"
            style={{ background: 'rgba(0,0,0,0.8)', paddingTop: 20, paddingBottom: 32, backdropFilter: 'blur(12px)' }}
          >
            <button
              onClick={closeCamera}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold"
              style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}
            >
              <X className="w-4 h-4" /> Hủy
            </button>

            {/* Shutter button */}
            <button
              onClick={captureManually}
              style={{
                width: 72, height: 72,
                borderRadius: '50%',
                background: '#fff',
                border: '4px solid rgba(255,255,255,0.3)',
                boxShadow: '0 0 0 2px rgba(255,255,255,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <Camera className="w-7 h-7" style={{ color: '#1A1A1A' }} />
            </button>

            {/* Spacer to balance layout */}
            <div style={{ width: 84 }} />
          </div>
        </div>
      )}

      {/* ── SCANNING SPINNER ───────────────────────────────────────────── */}
      {step === 'scanning' && (
        <div className="rounded-xl py-20 flex flex-col items-center gap-4"
          style={{ background: '#fff', border: '1px solid #E9E9E7' }}>
          <ScanLine className="w-12 h-12 animate-pulse" style={{ color: ACCENT }} />
          <p className="text-base font-semibold" style={{ color: '#1A1A1A' }}>Đang xử lý phiếu...</p>
          <p className="text-sm" style={{ color: '#787774' }}>
            Tìm góc anchor · Bóp phẳng ảnh · Đọc toàn bộ bong bóng
          </p>
          <div className="w-48 h-1.5 rounded-full overflow-hidden mt-2" style={{ background: '#F1F0EC' }}>
            <div className="h-full rounded-full animate-pulse" style={{ width: '60%', background: ACCENT }} />
          </div>
        </div>
      )}

      {/* ── REVIEW SCREEN ──────────────────────────────────────────────── */}
      {step === 'review' && reviewData && (
        <ReviewScreen
          reviewData={reviewData}
          answerKey={answerKey}
          onConfirm={confirmReview}
          onRetake={retakeFromReview}
        />
      )}

      {/* ── RESULT SCREEN ──────────────────────────────────────────────── */}
      {step === 'result' && scanResult && (
        <ScoreDisplay
          answers={scanResult.answers}
          score={scanResult.score}
          answerKey={answerKey}
          confidence={scanResult.confidence}
          anchorsFound={scanResult.anchorsFound}
          debugCanvas={scanResult.debugCanvas}
          onReset={reset}
        />
      )}

      {/* ── SETUP SCREEN ───────────────────────────────────────────────── */}
      {step === 'setup' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Bảng đáp án */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4" style={{ color: ACCENT }} />
                <h3 className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>Bảng đáp án</h3>
              </div>
              <button onClick={() => setAnswerKey(emptyKey())}
                className="text-xs px-2.5 py-1 rounded-lg"
                style={{ background: '#F1F0EC', color: '#787774', border: '1px solid #E9E9E7' }}>
                <RotateCcw className="w-3 h-3 inline mr-1" />Xóa
              </button>
            </div>

            <AnswerKeyEditor answerKey={answerKey} onChange={setAnswerKey} />

            {!canScan && (
              <div className="flex items-center gap-2">
                <Info className="w-3.5 h-3.5 shrink-0" style={{ color: '#D9730D' }} />
                <p className="text-[11px]" style={{ color: '#D9730D' }}>
                  Nhập ít nhất 5 câu đáp án Phần I để bắt đầu chấm.
                </p>
              </div>
            )}
          </div>

          {/* Right: Camera / Upload */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4" style={{ color: ACCENT }} />
                <h3 className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>Chấm bài</h3>
              </div>
              <div className="flex items-center gap-2">
                <input type="file" accept="application/pdf" className="hidden"
                  ref={templateInputRef} onChange={handleUploadTemplate} disabled={isUploadingTemplate} />
                <button onClick={() => templateInputRef.current?.click()} disabled={isUploadingTemplate}
                  className="text-[11px] px-2 py-1.5 rounded-lg font-medium"
                  style={{ background: '#F1F0EC', color: '#1A1A1A', opacity: isUploadingTemplate ? 0.5 : 1 }}>
                  <Upload className="w-3.5 h-3.5 inline mr-1" />
                  {isUploadingTemplate ? 'Đang tải...' : 'Up Phiếu'}
                </button>
                {templateFileId ? (
                  <button onClick={handleDownloadTemplate}
                    className="text-[11px] px-2 py-1.5 rounded-lg flex items-center gap-1 font-medium"
                    style={{ background: '#EEF0FB', color: ACCENT, border: '1px solid #C8D0F5' }}>
                    <Download className="w-3.5 h-3.5" /> Tải mẫu
                  </button>
                ) : (
                  <span className="text-[10px] text-gray-400">Chưa có mẫu</span>
                )}
              </div>
            </div>

            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E9E9E7', background: '#fff' }}>
              {/* Camera button */}
              <button onClick={openCamera} disabled={!canScan}
                className="w-full flex flex-col items-center gap-3 py-10 transition-all"
                style={{
                  borderBottom: '1px solid #E9E9E7',
                  opacity: canScan ? 1 : 0.5,
                  cursor: canScan ? 'pointer' : 'not-allowed',
                }}
                onMouseEnter={e => canScan && ((e.currentTarget as HTMLElement).style.background = '#EEF0FB')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
              >
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ background: canScan ? '#EEF0FB' : '#F1F0EC' }}>
                  <Camera className="w-8 h-8" style={{ color: canScan ? ACCENT : '#CFCFCB' }} />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-sm" style={{ color: canScan ? '#1A1A1A' : '#AEACA8' }}>
                    Chụp bằng Camera
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#787774' }}>
                    Hướng vào phiếu · tự động chụp khi nhận diện được 4 góc
                  </p>
                </div>
              </button>

              {/* Upload button */}
              <button onClick={() => fileInputRef.current?.click()} disabled={!canScan}
                className="w-full flex flex-col items-center gap-3 py-8 transition-all"
                style={{ opacity: canScan ? 1 : 0.5, cursor: canScan ? 'pointer' : 'not-allowed' }}
                onMouseEnter={e => canScan && ((e.currentTarget as HTMLElement).style.background = '#F7F6F3')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: '#F1F0EC' }}>
                  <Upload className="w-6 h-6" style={{ color: canScan ? '#57564F' : '#CFCFCB' }} />
                </div>
                <div className="text-center">
                  <p className="font-medium text-sm" style={{ color: canScan ? '#1A1A1A' : '#AEACA8' }}>
                    Upload ảnh phiếu
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#787774' }}>JPG, PNG, HEIC...</p>
                </div>
              </button>

              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            </div>

            {/* Tips */}
            <div className="rounded-xl p-4 space-y-2" style={{ background: '#F7F6F3', border: '1px solid #E9E9E7' }}>
              <p className="text-xs font-semibold" style={{ color: '#57564F' }}>💡 Để đạt kết quả tốt nhất:</p>
              {[
                'Để phiếu trên bàn phẳng, không cong vênh',
                'Chụp thẳng từ trên xuống, không nghiêng',
                'Ánh sáng đủ, tránh bóng tối hoặc phản quang',
                'Học sinh tô đậm bằng bút chì hoặc bút bi',
                '4 ô đen góc phiếu phải rõ ràng trong ảnh',
                'Camera sẽ tự chụp khi nhận diện đủ 4 góc',
              ].map((tip, i) => (
                <p key={i} className="text-[11px]" style={{ color: '#787774' }}>• {tip}</p>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OMRScanner;
