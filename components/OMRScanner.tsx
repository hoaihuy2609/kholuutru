import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Camera, Upload, ScanLine, CheckCircle2, AlertCircle, RefreshCw,
  ChevronDown, Key, FileText, Zap, RotateCcw, Info, Eye, Download,
  X, Bug
} from 'lucide-react';
import { processOMRImage, scoreOMR, OMRAnswers, AnswerKey, ScoreResult } from '../src/lib/omrProcessor';

// ── Types ──────────────────────────────────────────────────────────────────
interface OMRScannerProps {
  onShowToast: (msg: string, type: 'success' | 'error' | 'warning') => void;
}

type ScanStep = 'setup' | 'scanning' | 'result';

const emptyKey = (): AnswerKey => ({
  mc: Array(40).fill(''),
  tf: Array.from({ length: 8 }, () => ({ a: '', b: '', c: '', d: '' })),
  sa: Array(6).fill(''),
});

const ABCD = ['A', 'B', 'C', 'D'];
const ACCENT = '#6B7CDB';

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

  const Section = ({ id, label, count, total, children }: { id: 'mc' | 'tf' | 'sa'; label: string; count: number; total: number; children: React.ReactNode }) => (
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
          color: '#AEACA8', transform: openSection === id ? 'rotate(180deg)' : 'none'
        }} />
      </button>
      {openSection === id && <div className="p-4 bg-white">{children}</div>}
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Phần I: ABCD */}
      <Section id="mc" label="Phần I — Trắc nghiệm ABCD" count={filled1} total={40}>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
          {answerKey.mc.map((val, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs font-mono w-6 text-right" style={{ color: '#AEACA8' }}>{i + 1}</span>
              <div className="flex gap-1">
                {ABCD.map(letter => (
                  <button
                    key={letter}
                    onClick={() => setMC(i, letter)}
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

      {/* Phần II: Đúng/Sai */}
      <Section id="tf" label="Phần II — Đúng / Sai" count={filled2} total={8}>
        <div className="grid grid-cols-2 gap-4">
          {answerKey.tf.map((t, qi) => (
            <div key={qi} className="p-3 rounded-lg" style={{ background: '#F7F6F3', border: '1px solid #E9E9E7' }}>
              <p className="text-xs font-semibold mb-2" style={{ color: '#1A1A1A' }}>Câu {19 + qi}</p>
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

      {/* Phần III: Trả lời ngắn */}
      <Section id="sa" label="Phần III — Trả lời ngắn" count={filled3} total={6}>
        <div className="grid grid-cols-2 gap-3">
          {answerKey.sa.map((v, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs font-mono w-12 text-right shrink-0" style={{ color: '#AEACA8' }}>Câu {23 + i}</span>
              <input
                type="text"
                value={v}
                onChange={e => setSA(i, e.target.value)}
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
  const [showDebug, setShowDebug] = useState(false);
  const debugRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showDebug && debugCanvas && debugRef.current) {
      debugRef.current.innerHTML = '';
      const scaled = document.createElement('canvas');
      scaled.width = 620;
      scaled.height = Math.round(620 * (debugCanvas.height / debugCanvas.width));
      scaled.getContext('2d')!.drawImage(debugCanvas, 0, 0, scaled.width, scaled.height);
      debugRef.current.appendChild(scaled);
    }
  }, [showDebug, debugCanvas]);

  const scoreColor = score.total >= 8 ? '#448361' : score.total >= 5 ? '#D9730D' : '#E03E3E';
  const scoreBg = score.total >= 8 ? '#EAF3EE' : score.total >= 5 ? '#FFF3E8' : '#FEF0F0';

  return (
    <div className="space-y-5">
      {/* Header tổng điểm */}
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

      {/* Thông tin nhận diện */}
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

      {/* Phần I: Chi tiết ABCD */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E9E9E7', background: '#fff' }}>
        <div className="px-4 py-2.5" style={{ borderBottom: '1px solid #E9E9E7', background: '#FAFAF9' }}>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#AEACA8' }}>
            Phần I — {score.mcDetail.filter(Boolean).length}/40 câu đúng
          </p>
        </div>
        <div className="p-4 grid grid-cols-8 gap-1.5">
          {answers.mc.map((ans, i) => {
            const correct = score.mcDetail[i];
            const isWrong = ans && !correct;
            const missed = !ans && answerKey.mc[i];
            return (
              <div key={i} title={`Câu ${i + 1}: ${ans || '—'} (đáp án: ${answerKey.mc[i]})`}
                className="flex flex-col items-center gap-0.5"
                style={{ opacity: !ans && !answerKey.mc[i] ? 0.4 : 1 }}>
                <span className="text-[9px]" style={{ color: '#AEACA8' }}>{i + 1}</span>
                <div className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold"
                  style={{
                    background: correct ? '#EAF3EE' : isWrong ? '#FEF0F0' : missed ? '#FFF3E8' : '#F1F0EC',
                    color: correct ? '#448361' : isWrong ? '#E03E3E' : missed ? '#D9730D' : '#AEACA8',
                    border: `1px solid ${correct ? '#B7D9C4' : isWrong ? '#F5C2C2' : missed ? '#FDDBA0' : '#E9E9E7'}`,
                  }}>
                  {ans || '·'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Phần II: Đúng/Sai */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E9E9E7', background: '#fff' }}>
        <div className="px-4 py-2.5" style={{ borderBottom: '1px solid #E9E9E7', background: '#FAFAF9' }}>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#AEACA8' }}>
            Phần II — Đúng/Sai ({score.tf.toFixed(2)}đ)
          </p>
        </div>
        <div className="p-4 grid grid-cols-4 gap-2">
          {answers.tf.map((t, i) => (
            <div key={i} className="rounded-lg p-2.5" style={{ background: '#F7F6F3', border: '1px solid #E9E9E7' }}>
              <p className="text-[10px] font-semibold mb-1.5" style={{ color: '#1A1A1A' }}>Câu {19 + i}</p>
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
                <p className="text-[10px] mb-1" style={{ color: '#AEACA8' }}>Câu {23 + i}</p>
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

      {/* Debug view */}
      {debugCanvas && (
        <div>
          <button
            onClick={() => setShowDebug(!showDebug)}
            className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg"
            style={{ background: '#F7F6F3', color: '#787774', border: '1px solid #E9E9E7' }}
          >
            <Bug className="w-3.5 h-3.5" />
            {showDebug ? 'Ẩn' : 'Xem'} ảnh debug (ô tô được đánh dấu)
          </button>
          {showDebug && (
            <div ref={debugRef} className="mt-3 rounded-xl overflow-hidden"
              style={{ border: '1px solid #E9E9E7', maxWidth: '100%', overflowX: 'auto' }} />
          )}
        </div>
      )}

      <button
        onClick={onReset}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-colors"
        style={{ background: '#F7F6F3', color: '#57564F', border: '1px solid #E9E9E7' }}
      >
        <RotateCcw className="w-4 h-4" /> Chấm bài khác
      </button>
    </div>
  );
};

// ── Main Component ──────────────────────────────────────────────────────────
const OMRScanner: React.FC<OMRScannerProps> = ({ onShowToast }) => {
  const [step, setStep] = useState<ScanStep>('setup');
  const [answerKey, setAnswerKey] = useState<AnswerKey>(emptyKey);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{
    answers: OMRAnswers;
    score: ScoreResult;
    confidence: number;
    anchorsFound: number;
    debugCanvas: HTMLCanvasElement | null;
  } | null>(null);

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [debugMode, setDebugMode] = useState(false);

  // Check đáp án đã đủ chưa
  const mcFilled = answerKey.mc.filter(Boolean).length;
  const canScan = mcFilled >= 10; // cần nhập ít nhất 10 câu

  // ── Camera ──────────────────────────────────────────────────────────────
  const openCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      setCameraStream(stream);
      setIsCameraOpen(true);
    } catch {
      onShowToast('Không thể mở camera. Hãy thử upload ảnh thay thế.', 'error');
    }
  }, [onShowToast]);

  useEffect(() => {
    if (isCameraOpen && videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [isCameraOpen, cameraStream]);

  const closeCamera = useCallback(() => {
    cameraStream?.getTracks().forEach(t => t.stop());
    setCameraStream(null);
    setIsCameraOpen(false);
  }, [cameraStream]);

  const captureFromCamera = useCallback(async () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d')!.drawImage(videoRef.current, 0, 0);
    closeCamera();
    await runScan(canvas);
  }, [closeCamera, answerKey, debugMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Scan logic ───────────────────────────────────────────────────────────
  const runScan = useCallback(async (source: File | HTMLCanvasElement) => {
    if (!canScan) {
      onShowToast('Vui lòng nhập ít nhất 10 câu đáp án trước khi chấm.', 'warning');
      return;
    }
    setScanning(true);
    setStep('scanning');
    try {
      const result = await processOMRImage(source, debugMode);
      const score = scoreOMR(result.answers, answerKey);

      const confidencePct = Math.round(result.confidence * 100);
      if (result.anchorsFound < 4) {
        onShowToast(`Chỉ tìm thấy ${result.anchorsFound}/4 anchor. Kết quả có thể kém chính xác.`, 'warning');
      } else if (confidencePct < 70) {
        onShowToast(`Độ tin cậy thấp (${confidencePct}%). Hãy chụp lại với ánh sáng tốt hơn.`, 'warning');
      } else {
        onShowToast(`Chấm xong! Điểm: ${score.total.toFixed(2)} — Độ tin cậy: ${confidencePct}%`, 'success');
      }

      setScanResult({
        answers: result.answers,
        score,
        confidence: result.confidence,
        anchorsFound: result.anchorsFound,
        debugCanvas: result.debugCanvas || null,
      });
      setStep('result');
    } catch (e: any) {
      onShowToast('Lỗi xử lý ảnh: ' + e.message, 'error');
      setStep('setup');
    } finally {
      setScanning(false);
    }
  }, [canScan, answerKey, debugMode, onShowToast]);

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

  const reset = () => {
    setScanResult(null);
    setStep('setup');
  };

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
            Nhập đáp án → Chụp ảnh phiếu → Hệ thống tự động nhận diện & tính điểm BGD 2025.
          </p>
        </div>
      </div>

      {/* Camera overlay */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.92)' }}>
          <div className="relative w-full max-w-2xl">
            <video ref={videoRef} autoPlay playsInline
              className="w-full rounded-xl" style={{ maxHeight: '70vh', objectFit: 'cover' }} />
            {/* Khung ngắm */}
            <div className="absolute inset-4 rounded-xl pointer-events-none"
              style={{ border: '2px solid rgba(107,124,219,0.8)', boxShadow: '0 0 0 9999px rgba(0,0,0,0.4)' }}>
              {/* 4 góc */}
              {[['top-0 left-0', '0 4px 4px 0'], ['top-0 right-0', '0 0 4px 4px'], ['bottom-0 left-0', '4px 4px 0 0'], ['bottom-0 right-0', '4px 0 0 4px']].map(([pos], i) => (
                <div key={i} className={`absolute w-8 h-8 ${pos}`}
                  style={{ border: '3px solid #6B7CDB', borderRadius: '4px' }} />
              ))}
            </div>
            <p className="text-center text-white text-sm mt-3 opacity-75">
              Đặt phiếu vào khung · giữ thẳng · ánh sáng đủ
            </p>
          </div>
          <div className="flex gap-4 mt-6">
            <button onClick={closeCamera}
              className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold"
              style={{ background: '#333', color: '#fff' }}>
              <X className="w-4 h-4" /> Hủy
            </button>
            <button onClick={captureFromCamera}
              className="flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-bold"
              style={{ background: ACCENT, color: '#fff' }}>
              <Camera className="w-4 h-4" /> Chụp
            </button>
          </div>
        </div>
      )}

      {step === 'scanning' && (
        <div className="rounded-xl py-20 flex flex-col items-center gap-4"
          style={{ background: '#fff', border: '1px solid #E9E9E7' }}>
          <ScanLine className="w-12 h-12 animate-pulse" style={{ color: ACCENT }} />
          <p className="text-base font-semibold" style={{ color: '#1A1A1A' }}>Đang xử lý phiếu...</p>
          <p className="text-sm" style={{ color: '#787774' }}>Đang tìm anchor · Bóp phẳng ảnh · Đọc bong bóng</p>
          <div className="w-48 h-1.5 rounded-full overflow-hidden mt-2" style={{ background: '#F1F0EC' }}>
            <div className="h-full rounded-full animate-pulse" style={{ width: '60%', background: ACCENT }} />
          </div>
        </div>
      )}

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

      {step === 'setup' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Đáp án */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4" style={{ color: ACCENT }} />
                <h3 className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>Bảng đáp án</h3>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: '#787774' }}>
                  <input type="checkbox" checked={debugMode} onChange={e => setDebugMode(e.target.checked)}
                    className="rounded" />
                  <Bug className="w-3 h-3" /> Debug
                </label>
                <button onClick={() => setAnswerKey(emptyKey())}
                  className="text-xs px-2.5 py-1 rounded-lg"
                  style={{ background: '#F1F0EC', color: '#787774', border: '1px solid #E9E9E7' }}>
                  <RotateCcw className="w-3 h-3 inline mr-1" />Xóa
                </button>
              </div>
            </div>

            <AnswerKeyEditor answerKey={answerKey} onChange={setAnswerKey} />

            {!canScan && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg" style={{ background: '#FFF3E8', border: '1px solid #FDDBA0' }}>
                <Info className="w-3.5 h-3.5 shrink-0" style={{ color: '#D9730D' }} />
                <p className="text-[11px]" style={{ color: '#D9730D' }}>
                  Nhập ít nhất 10 câu đáp án Phần I để bắt đầu chấm.
                </p>
              </div>
            )}
          </div>

          {/* Right: Chụp/Upload */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4" style={{ color: ACCENT }} />
              <h3 className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>Chấm bài</h3>
            </div>

            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E9E9E7', background: '#fff' }}>
              {/* Camera button */}
              <button
                onClick={openCamera}
                disabled={!canScan}
                className="w-full flex flex-col items-center gap-3 py-10 transition-all"
                style={{
                  borderBottom: '1px solid #E9E9E7',
                  opacity: canScan ? 1 : 0.5,
                  cursor: canScan ? 'pointer' : 'not-allowed',
                }}
                onMouseEnter={e => canScan && ((e.currentTarget as HTMLElement).style.background = '#EEF0FB')}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ background: canScan ? '#EEF0FB' : '#F1F0EC' }}>
                  <Camera className="w-8 h-8" style={{ color: canScan ? ACCENT : '#CFCFCB' }} />
                </div>
                <div>
                  <p className="font-semibold text-sm" style={{ color: canScan ? '#1A1A1A' : '#AEACA8' }}>
                    Chụp bằng Camera
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#787774' }}>
                    Dùng camera điện thoại / laptop
                  </p>
                </div>
              </button>

              {/* Upload button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={!canScan}
                className="w-full flex flex-col items-center gap-3 py-8 transition-all"
                style={{
                  opacity: canScan ? 1 : 0.5,
                  cursor: canScan ? 'pointer' : 'not-allowed',
                }}
                onMouseEnter={e => canScan && ((e.currentTarget as HTMLElement).style.background = '#F7F6F3')}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ background: '#F1F0EC' }}>
                  <Upload className="w-6 h-6" style={{ color: canScan ? '#57564F' : '#CFCFCB' }} />
                </div>
                <div>
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
                'Ánh sáng đủ, không bị bóng tối',
                'Học sinh tô đậm bằng bút chì / bút bi',
                '4 ô đen góc phiếu phải rõ ràng trong ảnh',
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
