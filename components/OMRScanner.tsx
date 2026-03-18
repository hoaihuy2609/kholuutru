import React, { useRef, useState, useCallback, useEffect, Suspense } from 'react';
import {
  Camera, X, RotateCcw, CheckCircle2, AlertCircle,
  ScanLine, ChevronLeft, ZoomIn, Sun, Info,
  Target, Loader2, RefreshCw, Award, BookOpen, FileText,
  Cpu, Zap,
} from 'lucide-react';
import {
  loadOpenCV,
  processOMRWithOpenCV,
  processOMRFallback,
  type OMRResult,
  type AnswerKey,
} from '../src/utils/omrProcessor';

const AnswerSheetTemplate = React.lazy(() => import('./AnswerSheetTemplate'));

// ─── Preset answer key (sẽ được thay bằng dữ liệu từ Supabase sau) ───────────
const SAMPLE_ANSWER_KEY: AnswerKey = Object.fromEntries(
  Array.from({ length: 40 }, (_, i) => [i, ['A', 'B', 'C', 'D'][i % 4]])
);

type AppMode = 'setup' | 'template' | 'camera' | 'preview' | 'processing' | 'result';
type OCVStatus = 'idle' | 'loading' | 'ready' | 'error';

// ─── Sub-components ────────────────────────────────────────────────────────────

const ScoreGauge: React.FC<{ score: number }> = ({ score }) => {
  const pct = (score / 10) * 100;
  const color = score >= 8 ? '#22c55e' : score >= 6.5 ? '#f59e0b' : score >= 5 ? '#f97316' : '#ef4444';
  const label = score >= 8 ? 'Xuất sắc' : score >= 6.5 ? 'Đạt' : score >= 5 ? 'Yếu' : 'Kém';

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-32 h-32">
        <svg className="w-32 h-32 -rotate-90" viewBox="0 0 128 128">
          <circle cx="64" cy="64" r="54" fill="none" stroke="#1F1F1F" strokeWidth="12" />
          <circle
            cx="64" cy="64" r="54" fill="none"
            stroke={color} strokeWidth="12"
            strokeDasharray={`${2 * Math.PI * 54}`}
            strokeDashoffset={`${2 * Math.PI * 54 * (1 - pct / 100)}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-black" style={{ color }}>{score}</span>
          <span className="text-[11px] font-semibold" style={{ color: '#555' }}>/ 10 điểm</span>
        </div>
      </div>
      <span className="text-sm font-bold px-4 py-1.5 rounded-full" style={{ background: color + '22', color, border: `1px solid ${color}44` }}>
        {label}
      </span>
    </div>
  );
};

const OpenCVBadge: React.FC<{ status: OCVStatus }> = ({ status }) => {
  const config = {
    idle:    { color: '#555', bg: '#1A1A1A', label: 'OpenCV chưa load', Icon: Cpu },
    loading: { color: '#f59e0b', bg: '#1C1A11', label: 'Đang tải OpenCV.js...', Icon: Loader2 },
    ready:   { color: '#22c55e', bg: '#0f2e18', label: 'OpenCV sẵn sàng', Icon: Zap },
    error:   { color: '#ef4444', bg: '#1F0A0A', label: 'OpenCV bị lỗi (dùng fallback)', Icon: AlertCircle },
  }[status];
  const { color, bg, label, Icon } = config;
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold"
      style={{ background: bg, color, border: `1px solid ${color}33` }}>
      <Icon className={`w-3 h-3 ${status === 'loading' ? 'animate-spin' : ''}`} />
      {label}
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────

interface OMRScannerProps { onBack: () => void; }

const OMRScanner: React.FC<OMRScannerProps> = ({ onBack }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [mode, setMode] = useState<AppMode>('setup');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<OMRResult | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [totalQuestions, setTotalQuestions] = useState(30);
  const [answerKey] = useState<AnswerKey>(SAMPLE_ANSWER_KEY);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [ocvStatus, setOcvStatus] = useState<OCVStatus>('idle');
  const [ocvError, setOcvError] = useState<string | null>(null);
  const [processingMsg, setProcessingMsg] = useState('Đang phân tích ảnh...');

  // ── Pre-load OpenCV khi người dùng vào trang ──────────────────────
  useEffect(() => {
    setOcvStatus('loading');
    loadOpenCV()
      .then(() => setOcvStatus('ready'))
      .catch(err => {
        console.warn('OpenCV load failed, will use fallback:', err);
        setOcvStatus('error');
        setOcvError(err.message);
      });
  }, []);

  // ── Camera ────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setMode('camera');
    } catch (err: unknown) {
      const e = err as Error;
      if (e.name === 'NotAllowedError') setCameraError('Chưa cấp quyền Camera. Vào Cài đặt trình duyệt → Bật quyền Camera.');
      else if (e.name === 'NotFoundError') setCameraError('Không tìm thấy Camera trên thiết bị này.');
      else setCameraError('Không thể mở Camera: ' + e.message);
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  // ── Capture ───────────────────────────────────────────────────────
  const captureFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    setCapturedImage(canvas.toDataURL('image/jpeg', 0.92));
    stopCamera();
    setMode('preview');
  }, [stopCamera]);

  // ── File Upload ───────────────────────────────────────────────────
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setCapturedImage(ev.target?.result as string);
      stopCamera();
      setMode('preview');
    };
    reader.readAsDataURL(file);
  }, [stopCamera]);

  // ── Process OMR ───────────────────────────────────────────────────
  const processImage = useCallback(async () => {
    if (!capturedImage || !canvasRef.current) return;
    setMode('processing');

    const img = new Image();
    img.onload = async () => {
      const canvas = canvasRef.current!;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d')?.drawImage(img, 0, 0);

      try {
        let result: OMRResult;
        if (ocvStatus === 'ready') {
          setProcessingMsg('OpenCV đang phân tích ảnh...');
          result = await processOMRWithOpenCV(canvas, answerKey, totalQuestions);
        } else {
          setProcessingMsg('Đang dùng chế độ fallback...');
          await new Promise(r => setTimeout(r, 800)); // simulate processing
          result = processOMRFallback(canvas, answerKey, totalQuestions);
        }
        // Xóa canvas ngay sau khi xử lý → không lưu ảnh (Phương án 1)
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          canvas.width = 0; canvas.height = 0;
        }
        setScanResult(result);
        setCapturedImage(null); // Xóa ảnh preview khỏi RAM
        setMode('result');
      } catch (err: unknown) {
        const e = err as Error;
        console.error('OMR processing error:', e);
        setCameraError('Lỗi xử lý ảnh: ' + e.message + '. Vui lòng chụp lại.');
        setMode('preview');
      }
    };
    img.src = capturedImage;
  }, [capturedImage, answerKey, totalQuestions, ocvStatus]);

  // ── Reset ─────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    stopCamera();
    setCapturedImage(null);
    setScanResult(null);
    setCameraError(null);
    setMode('setup');
    setSavedToast(false);
  }, [stopCamera]);

  // ── Save (mock) ───────────────────────────────────────────────────
  const saveResult = useCallback(async () => {
    if (!scanResult) return;
    setIsSaving(true);
    // TODO: await supabase.from('omr_results').insert({ score: scanResult.score, ... });
    await new Promise(r => setTimeout(r, 700));
    setIsSaving(false);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 3000);
  }, [scanResult]);

  // ─── RENDER ────────────────────────────────────────────────────────────────

  // Màn hình phiếu mẫu
  if (mode === 'template') {
    return (
      <Suspense fallback={<div className="flex items-center justify-center h-screen" style={{ background: '#0F0F0F' }}><Loader2 className="w-8 h-8 text-white animate-spin" /></div>}>
        <AnswerSheetTemplate
          totalQuestions={totalQuestions}
          onBack={() => setMode('setup')}
        />
      </Suspense>
    );
  }

  // ── SETUP ──────────────────────────────────────────────────────────
  if (mode === 'setup') {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: '#0F0F0F', color: '#F5F5F5' }}>
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 sticky top-0 z-20"
          style={{ background: '#0F0F0F', borderBottom: '1px solid #1F1F1F' }}>
          <button onClick={onBack} className="p-2 rounded-lg" style={{ background: '#1A1A1A' }}>
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-bold text-white">Chấm điểm OMR</h1>
            <p className="text-xs" style={{ color: '#787774' }}>Quét phiếu trắc nghiệm bằng Camera</p>
          </div>
          <OpenCVBadge status={ocvStatus} />
        </div>

        <div className="flex-1 p-5 space-y-4 max-w-lg mx-auto w-full pb-10">

          {/* Hero Banner */}
          <div className="rounded-2xl p-6 flex flex-col items-center gap-4 text-center"
            style={{ background: 'linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)', border: '1px solid #1a3a5c' }}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(107,124,219,0.2)', border: '1px solid rgba(107,124,219,0.4)' }}>
              <ScanLine className="w-8 h-8" style={{ color: '#8B9FE8' }} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Chấm điểm thông minh</h2>
              <p className="text-xs mt-1" style={{ color: '#8B9FE8' }}>
                {ocvStatus === 'ready'
                  ? '✨ OpenCV.js đã sẵn sàng — Nhận diện ảnh chính xác cao'
                  : ocvStatus === 'loading'
                    ? '⏳ Đang tải OpenCV.js...'
                    : ocvStatus === 'error'
                      ? '⚠️ Chạy chế độ dự phòng (kém chính xác hơn)'
                      : 'Chụp phiếu → AI phân tích → Điểm ngay'}
              </p>
            </div>
            <div className="flex items-center gap-6 text-xs">
              {[
                { icon: '📷', text: 'Chụp ảnh' },
                { icon: '🧠', text: 'AI phân tích' },
                { icon: '✅', text: 'Ra kết quả' },
              ].map(item => (
                <div key={item.text} className="flex flex-col items-center gap-1">
                  <span className="text-2xl">{item.icon}</span>
                  <span style={{ color: '#AEACA8' }}>{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Cài đặt số câu */}
          <div className="rounded-xl p-4 space-y-3" style={{ background: '#1A1A1A', border: '1px solid #292929' }}>
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" style={{ color: '#6B7CDB' }} />
              <h3 className="text-sm font-semibold text-white">Cài đặt bài thi</h3>
            </div>
            <div>
              <label className="text-xs mb-2 block" style={{ color: '#787774' }}>
                Số câu hỏi: <span className="text-white font-bold">{totalQuestions} câu</span>
              </label>
              <div className="flex gap-2 flex-wrap">
                {[20, 25, 30, 40].map(n => (
                  <button
                    key={n}
                    onClick={() => setTotalQuestions(n)}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                    style={{
                      background: totalQuestions === n ? '#6B7CDB' : '#2A2A2A',
                      color: totalQuestions === n ? '#fff' : '#787774',
                      border: `1px solid ${totalQuestions === n ? '#6B7CDB' : '#333'}`,
                    }}
                  >
                    {n} câu
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Nút Xem phiếu mẫu */}
          <button
            onClick={() => setMode('template')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all"
            style={{ background: '#1A1A1A', border: '1px solid #292929', color: '#F5F5F5' }}
          >
            <FileText className="w-5 h-5 shrink-0" style={{ color: '#6B7CDB' }} />
            <div className="text-left flex-1">
              <div className="font-semibold">Phiếu trả lời chuẩn</div>
              <div className="text-xs mt-0.5" style={{ color: '#787774' }}>Xem & In phiếu chuẩn có điểm neo cho Camera</div>
            </div>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#1a3a5c', color: '#8B9FE8' }}>In ra</span>
          </button>

          {/* OpenCV Error hint */}
          {ocvStatus === 'error' && ocvError && (
            <div className="rounded-xl p-4 flex gap-3" style={{ background: '#1F0A0A', border: '1px solid #3D1515' }}>
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
              <div className="text-xs">
                <p className="font-semibold text-red-400 mb-1">OpenCV không tải được</p>
                <p className="text-red-300/70">{ocvError}</p>
                <p className="text-red-300/70 mt-1">Hệ thống sẽ dùng thuật toán dự phòng (ít chính xác hơn). Nghiều ánh sáng sẽ giúp cải thiện kết quả.</p>
              </div>
            </div>
          )}

          {/* Thông tin prototype */}
          <div className="rounded-xl p-4 flex gap-3" style={{ background: '#1C1A11', border: '1px solid #3D3519' }}>
            <Info className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#E8B800' }} />
            <div className="text-xs" style={{ color: '#B8960C' }}>
              <p className="font-semibold mb-1" style={{ color: '#E8B800' }}>Để đạt kết quả tốt nhất:</p>
              <ul className="space-y-0.5 list-disc list-inside">
                <li>In phiếu mẫu chuẩn của PhysiVault (ấn nút bên trên)</li>
                <li>Chụp ảnh nơi đủ sáng, phiếu phẳng trong khung</li>
                <li>Học sinh tô đen hoàn toàn ô đáp án (bút chì hoặc bút bi)</li>
              </ul>
            </div>
          </div>

          {/* Action buttons */}
          <button
            onClick={startCamera}
            className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-base transition-all active:scale-95"
            style={{ background: 'linear-gradient(135deg, #6B7CDB, #5B6CC8)', color: '#fff', boxShadow: '0 4px 20px rgba(107,124,219,0.4)' }}
          >
            <Camera className="w-5 h-5" />
            Mở Camera để chụp
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-2xl font-medium text-sm transition-all"
            style={{ background: '#1A1A1A', color: '#AEACA8', border: '1px solid #292929' }}
          >
            <ZoomIn className="w-4 h-4" />
            Tải ảnh từ thư viện
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />

          {cameraError && (
            <div className="rounded-xl p-4 flex gap-3" style={{ background: '#1F0A0A', border: '1px solid #3D1515' }}>
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
              <p className="text-xs text-red-400">{cameraError}</p>
            </div>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </div>
    );
  }

  // ── CAMERA ────────────────────────────────────────────────────────
  if (mode === 'camera') {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col">
        <video ref={videoRef} className="flex-1 object-cover w-full" autoPlay playsInline muted />

        {/* Overlay khung ngắm */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)' }} />
          <div className="relative z-10" style={{ width: '82vw', maxWidth: 360, aspectRatio: '3/4' }}>
            {/* 4 góc khung */}
            {(['tl','tr','bl','br'] as const).map(c => (
              <div key={c} className="absolute w-9 h-9" style={{
                top: c[0]==='t' ? -3 : 'auto', bottom: c[0]==='b' ? -3 : 'auto',
                left: c[1]==='l' ? -3 : 'auto', right: c[1]==='r' ? -3 : 'auto',
                borderTop: c[0]==='t' ? '3px solid #6B7CDB' : 'none',
                borderBottom: c[0]==='b' ? '3px solid #6B7CDB' : 'none',
                borderLeft: c[1]==='l' ? '3px solid #6B7CDB' : 'none',
                borderRight: c[1]==='r' ? '3px solid #6B7CDB' : 'none',
                borderRadius: c==='tl'?'4px 0 0 0':c==='tr'?'0 4px 0 0':c==='bl'?'0 0 0 4px':'0 0 4px 0',
              }} />
            ))}
            {/* Scan line animation */}
            <div className="absolute inset-x-0 overflow-hidden" style={{ top: 0, bottom: 0 }}>
              <div className="w-full h-0.5 absolute" style={{
                background: 'linear-gradient(90deg, transparent, #6B7CDB, transparent)',
                animation: 'scan 2s linear infinite',
              }} />
            </div>
          </div>
          <p className="mt-5 text-white text-sm font-medium z-10 text-center px-8 drop-shadow">
            Canh 4 điểm đen ở góc phiếu vào khung xanh
          </p>
          <p className="text-xs z-10 mt-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
            Giữ điện thoại thẳng • Đủ ánh sáng • Phiếu phẳng
          </p>
        </div>

        {/* Controls */}
        <div className="absolute bottom-0 left-0 right-0">
          <div className="flex items-center justify-between px-10 py-6">
            <button onClick={() => { stopCamera(); setMode('setup'); }}
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}>
              <X className="w-5 h-5 text-white" />
            </button>
            {/* Shutter */}
            <button onClick={captureFrame}
              className="w-20 h-20 rounded-full flex items-center justify-center transition-transform active:scale-90"
              style={{ background: '#fff', boxShadow: '0 0 0 5px rgba(255,255,255,0.25)' }}>
              <div className="w-16 h-16 rounded-full" style={{ background: 'linear-gradient(135deg, #6B7CDB, #5B6CC8)' }} />
            </button>
            <button onClick={() => setFlashEnabled(f => !f)}
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ background: flashEnabled ? 'rgba(248,220,64,0.3)' : 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}>
              <Sun className="w-5 h-5" style={{ color: flashEnabled ? '#F8DC40' : '#fff' }} />
            </button>
          </div>
        </div>

        <canvas ref={canvasRef} className="hidden" />
        <style>{`@keyframes scan { 0% { top:0% } 100% { top:100% } }`}</style>
      </div>
    );
  }

  // ── PREVIEW ───────────────────────────────────────────────────────
  if (mode === 'preview') {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: '#0F0F0F' }}>
        <div className="flex items-center justify-between px-4 py-3 sticky top-0 z-20"
          style={{ background: '#0F0F0F', borderBottom: '1px solid #1F1F1F' }}>
          <button onClick={() => { setCapturedImage(null); setMode('setup'); }}
            className="p-2 rounded-lg" style={{ background: '#1A1A1A' }}>
            <RotateCcw className="w-5 h-5 text-white" />
          </button>
          <h2 className="text-sm font-bold text-white">Kiểm tra ảnh</h2>
          <OpenCVBadge status={ocvStatus} />
        </div>

        <div className="flex-1 p-4 space-y-4 max-w-lg mx-auto w-full">
          {capturedImage && (
            <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #292929' }}>
              <img src={capturedImage} alt="Captured" className="w-full object-contain max-h-[55vh]" />
            </div>
          )}

          <div className="rounded-xl p-4 space-y-2.5" style={{ background: '#1A1A1A', border: '1px solid #292929' }}>
            <p className="text-xs font-semibold text-white flex items-center gap-2">
              <Target className="w-4 h-4" style={{ color: '#6B7CDB' }} />
              Checklist trước khi chấm
            </p>
            {[
              'Ảnh rõ nét, không bị mờ hoặc nghiêng quá nhiều',
              'Toàn bộ 4 điểm đen ở góc đều xuất hiện trong ảnh',
              'Đủ ánh sáng, không bị tối hoặc chói ngược',
              'Học sinh đã tô đen đủ các ô đáp án',
            ].map(tip => (
              <div key={tip} className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: '#22c55e' }} />
                <p className="text-xs" style={{ color: '#787774' }}>{tip}</p>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <button
              onClick={processImage}
              className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-base transition-all active:scale-95"
              style={{ background: 'linear-gradient(135deg, #6B7CDB, #5B6CC8)', color: '#fff', boxShadow: '0 4px 20px rgba(107,124,219,0.4)' }}
            >
              <ScanLine className="w-5 h-5" />
              Bắt đầu chấm điểm
            </button>
            <button
              onClick={() => { setCapturedImage(null); startCamera(); }}
              className="w-full flex items-center justify-center gap-3 py-3 rounded-2xl font-medium text-sm transition-all"
              style={{ background: '#1A1A1A', color: '#AEACA8', border: '1px solid #292929' }}
            >
              <Camera className="w-4 h-4" />
              Chụp lại
            </button>
          </div>

          {cameraError && (
            <div className="rounded-xl p-4 flex gap-3" style={{ background: '#1F0A0A', border: '1px solid #3D1515' }}>
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
              <p className="text-xs text-red-400">{cameraError}</p>
            </div>
          )}
        </div>
        <canvas ref={canvasRef} className="hidden" />
      </div>
    );
  }

  // ── PROCESSING ────────────────────────────────────────────────────
  if (mode === 'processing') {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-6"
        style={{ background: '#0F0F0F' }}>
        <div className="relative w-24 h-24">
          <div className="w-24 h-24 rounded-full border-4 animate-spin" style={{ borderColor: '#6B7CDB', borderTopColor: 'transparent' }} />
          <ScanLine className="absolute inset-0 m-auto w-8 h-8" style={{ color: '#6B7CDB' }} />
        </div>
        <div className="text-center">
          <p className="text-white font-bold text-base">{processingMsg}</p>
          <p className="text-xs mt-1" style={{ color: '#555' }}>
            {ocvStatus === 'ready' ? 'Đang dùng OpenCV.js' : 'Chế độ dự phòng'}
          </p>
        </div>
        <div className="space-y-1 text-center">
          {['Phát hiện 4 điểm neo...', 'Căn chỉnh phối cảnh...', 'Quét từng ô đáp án...', 'Tính điểm...'].map(step => (
            <p key={step} className="text-xs animate-pulse" style={{ color: '#333' }}>{step}</p>
          ))}
        </div>
      </div>
    );
  }

  // ── RESULT ────────────────────────────────────────────────────────
  if (mode === 'result' && scanResult) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: '#0F0F0F', color: '#F5F5F5' }}>
        <div className="flex items-center justify-between px-4 py-3 sticky top-0 z-20"
          style={{ background: '#0F0F0F', borderBottom: '1px solid #1F1F1F' }}>
          <button onClick={reset} className="p-2 rounded-lg" style={{ background: '#1A1A1A' }}>
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
          <h2 className="text-sm font-bold text-white">Kết quả chấm điểm</h2>
          <button onClick={reset} className="p-2 rounded-lg" style={{ background: '#1A1A1A' }}>
            <RefreshCw className="w-4 h-4 text-white" />
          </button>
        </div>

        <div className="flex-1 p-5 space-y-4 max-w-lg mx-auto w-full">
          {/* Score card */}
          <div className="rounded-2xl p-6 flex flex-col items-center gap-4"
            style={{ background: 'linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)', border: '1px solid #1a3a5c' }}>
            <ScoreGauge score={scanResult.score} />
            <div className="grid grid-cols-3 gap-3 w-full">
              {[
                { label: 'Đúng', val: scanResult.correctCount, color: '#22c55e', bg: '#0f2e18' },
                { label: 'Sai', val: scanResult.wrongIndexes.length, color: '#ef4444', bg: '#2e0f0f' },
                { label: 'Bỏ', val: scanResult.blankIndexes.length, color: '#f59e0b', bg: '#2e240f' },
              ].map(item => (
                <div key={item.label} className="rounded-xl p-3 text-center" style={{ background: item.bg }}>
                  <div className="text-2xl font-black" style={{ color: item.color }}>{item.val}</div>
                  <div className="text-[11px] font-medium mt-0.5" style={{ color: item.color + 'AA' }}>{item.label}</div>
                </div>
              ))}
            </div>
            {/* Processing method badge */}
            <div className="text-xs" style={{ color: '#1a3a5c' }}>
              Chấm bởi: {ocvStatus === 'ready' ? '⚡ OpenCV.js' : '🔧 Fallback Processor'}
            </div>
          </div>

          {/* Chi tiết câu */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #292929' }}>
            <div className="px-4 py-3 flex items-center gap-2" style={{ background: '#1A1A1A', borderBottom: '1px solid #292929' }}>
              <Award className="w-4 h-4" style={{ color: '#6B7CDB' }} />
              <h3 className="text-sm font-semibold text-white">Chi tiết từng câu</h3>
            </div>
            <div className="overflow-y-auto max-h-64" style={{ background: '#111' }}>
              {Array.from({ length: scanResult.totalQuestions }, (_, i) => {
                const sAns = scanResult.studentAnswers[i];
                const cAns = answerKey[i];
                const isCorrect = sAns === cAns;
                const isBlank = sAns === null;
                return (
                  <div key={i} className="flex items-center justify-between px-4 py-2 border-b"
                    style={{ borderColor: '#1A1A1A' }}>
                    <span className="text-xs font-medium w-12" style={{ color: '#555' }}>Câu {i + 1}</span>
                    <div className="flex items-center gap-4 flex-1 justify-end">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px]" style={{ color: '#444' }}>HS:</span>
                        <span className="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center"
                          style={{ background: isBlank ? '#2A2A2A' : isCorrect ? '#0f2e18' : '#2e0f0f', color: isBlank ? '#555' : isCorrect ? '#22c55e' : '#ef4444' }}>
                          {isBlank ? '—' : sAns}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px]" style={{ color: '#444' }}>ĐA:</span>
                        <span className="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center"
                          style={{ background: '#1a1a2e', color: '#6B7CDB' }}>
                          {cAns}
                        </span>
                      </div>
                      {isBlank ? <AlertCircle className="w-4 h-4" style={{ color: '#f59e0b' }} />
                        : isCorrect ? <CheckCircle2 className="w-4 h-4" style={{ color: '#22c55e' }} />
                          : <X className="w-4 h-4" style={{ color: '#ef4444' }} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {savedToast && (
            <div className="rounded-xl p-3 flex items-center gap-2" style={{ background: '#0f2e18', border: '1px solid #22c55e33' }}>
              <CheckCircle2 className="w-4 h-4" style={{ color: '#22c55e' }} />
              <p className="text-xs text-green-400">Đã lưu kết quả vào hệ thống!</p>
            </div>
          )}

          <div className="space-y-3 pb-8">
            <button
              onClick={saveResult}
              disabled={isSaving || savedToast}
              className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-base transition-all active:scale-95 disabled:opacity-60"
              style={{ background: savedToast ? '#0f2e18' : 'linear-gradient(135deg, #22c55e, #16a34a)', color: savedToast ? '#22c55e' : '#fff' }}
            >
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
              {isSaving ? 'Đang lưu...' : savedToast ? 'Đã lưu thành công!' : 'Lưu kết quả'}
            </button>
            <button
              onClick={reset}
              className="w-full flex items-center justify-center gap-3 py-3 rounded-2xl font-medium text-sm"
              style={{ background: '#1A1A1A', color: '#AEACA8', border: '1px solid #292929' }}
            >
              <ScanLine className="w-4 h-4" />
              Chấm bài tiếp theo
            </button>
          </div>
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </div>
    );
  }

  return null;
};

export default OMRScanner;
