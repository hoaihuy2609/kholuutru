import React, { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  X, RotateCcw, Palette, Droplets, Sliders, Layout,
  Layers, CheckSquare, ChevronDown, Download, Printer, Shuffle
} from 'lucide-react';
import { examVariantsSheetHtml, MAX_EXAM_VARIANTS, SHUFFLE_PARTS, shuffleExam, type ShufflePartType } from '../src/utils/examShuffle';
import { applyExamImageWidths, examImageKey, examImageWidth, type ExamImageWidths } from '../src/utils/examImageSizes';
import { MAX_QUESTION_IMAGE_WIDTH, MIN_QUESTION_IMAGE_WIDTH } from '../src/utils/questionImage';
import {
  ExamStyleConfig, DEFAULT_EXAM_STYLE, SelectedQuestionItem,
  formatExamSectionNote, generateExamLatex, downloadTexFile,
  examPrintDocument, printExamDirectlyToPdf, printExamVariantsToPdf, renderExamPrintBody
} from '../src/services/examLatexService';

interface ExamStyleModalProps {
  isOpen: boolean;
  onClose: () => void;
  questions: SelectedQuestionItem[];
}

const previewFrameWidth = 210 * 96 / 25.4 + 18; // A4 plus room for the scrollbar.

/** Hình đang chỉnh cỡ trong bản xem trước. */
type PickedImage = { questionId: string; src: string; label: string };

function ExamPrintPreview({ questions, config, picked, onPickImage, html }: {
  questions: SelectedQuestionItem[];
  config: ExamStyleConfig;
  picked?: PickedImage;
  onPickImage: (image: PickedImage) => void;
  /** Nội dung xem trước thay cho đề (ví dụ bảng đáp án các mã đề). */
  html?: string;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const deferredConfig = useDeferredValue(config);
  const frameHtml = useMemo(() => examPrintDocument(), []);
  const bodyHtml = useMemo(() => html ?? renderExamPrintBody(questions, deferredConfig), [html, questions, deferredConfig]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const resize = () => {
      if (viewport.clientWidth) setScale(Math.min(1, viewport.clientWidth / previewFrameWidth));
    };
    const observer = new ResizeObserver(resize);
    observer.observe(viewport);
    resize();
    return () => observer.disconnect();
  }, []);

  const pickRef = useRef(onPickImage);
  pickRef.current = onPickImage;
  const updateFrame = () => {
    const doc = frameRef.current?.contentDocument;
    if (!doc?.body) return;
    doc.body.innerHTML = bodyHtml;
    if (!doc.getElementById('pv-image-pick')) {
      const style = doc.createElement('style');
      style.id = 'pv-image-pick';
      style.textContent = '[data-question-id] img { cursor: pointer; } [data-question-id] img:hover { outline: 2px dashed #b45309; outline-offset: 2px; }'
        + ' img[data-picked] { outline: 3px solid #b45309 !important; outline-offset: 2px; }';
      doc.head.appendChild(style);
      // Bấm vào hình trong đề để chỉnh cỡ hình đó.
      doc.addEventListener('click', event => {
        const image = (event.target as Element | null)?.closest?.('img');
        const block = image?.closest('[data-question-id]');
        if (!image || !block) return;
        event.preventDefault();
        const label = block.querySelector('b')?.textContent?.replace(/:\s*$/, '').trim() || 'Câu';
        pickRef.current({ questionId: block.getAttribute('data-question-id') ?? '', src: image.getAttribute('src') ?? '', label });
      });
    }
    markPicked();
  };
  const markPicked = () => {
    const doc = frameRef.current?.contentDocument;
    doc?.querySelectorAll('img[data-picked]').forEach(image => image.removeAttribute('data-picked'));
    if (!doc || !picked) return;
    doc.querySelectorAll('[data-question-id]').forEach(block => {
      if (block.getAttribute('data-question-id') !== picked.questionId) return;
      block.querySelectorAll('img').forEach(image => { if (image.getAttribute('src') === picked.src) image.setAttribute('data-picked', ''); });
    });
  };
  useEffect(updateFrame, [bodyHtml]);
  useEffect(markPicked, [picked, bodyHtml]);

  return (
    <div ref={viewportRef} className="relative mx-auto h-full max-w-[812px] overflow-hidden bg-white">
      <iframe ref={frameRef} title="Xem trước đề thi" sandbox="allow-same-origin" srcDoc={frameHtml}
        onLoad={updateFrame} className="absolute left-0 top-0 origin-top-left border-0"
        style={{ width: previewFrameWidth, height: 100 / scale + '%', transform: 'scale(' + scale + ')' }} />
    </div>
  );
}

function SectionNoteInput({ label, note, count, onChange }: {
  label: string;
  note: string;
  count: number;
  onChange: (note: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <input
      type="text"
      aria-label={label}
      value={editing || count === 0 ? note : formatExamSectionNote(note, count)}
      onFocus={() => setEditing(true)}
      onBlur={() => setEditing(false)}
      onChange={event => onChange(event.target.value)}
      placeholder="Dùng “câu n” để tự điền số câu"
      className="w-full p-2 rounded border border-stone-200 text-xs italic bg-white"
    />
  );
}

export const ExamStyleModal: React.FC<ExamStyleModalProps> = ({
  isOpen,
  onClose,
  questions,
}) => {
  const [config, setConfig] = useState<ExamStyleConfig>(DEFAULT_EXAM_STYLE);
  const [mobilePane, setMobilePane] = useState<'settings' | 'preview'>('settings');
  const [sectionTitlesExpanded, setSectionTitlesExpanded] = useState(false);
  /** Cỡ hình chỉnh cho đề này (không lưu vào kho) và hình đang chỉnh. */
  const [imageWidths, setImageWidths] = useState<ExamImageWidths>({});
  const [picked, setPicked] = useState<PickedImage>();
  const sizedQuestions = useMemo(() => applyExamImageWidths(questions, imageWidths), [questions, imageWidths]);
  /** Trộn đề: nhiều mã đề từ đề gốc. Hạt giống cố định trong lần mở này, "Trộn lại" đổi hạt giống. */
  const [shuffle, setShuffle] = useState(() => ({ enabled: false, count: 4, questions: true, choices: true, statements: false, sheet: true,
    seed: Math.floor(Math.random() * 1e9), keep: {} as Partial<Record<ShufflePartType, string>> }));
  const [previewCode, setPreviewCode] = useState('');
  const variants = useMemo(() => shuffle.enabled ? shuffleExam(sizedQuestions, { ...shuffle, firstCode: config.examCode,
    keep: Object.fromEntries(Object.entries(shuffle.keep).map(([type, text]) => [type,
      (text ?? '').split(/[^\d]+/).filter(Boolean).map(Number)])) }) : [], [shuffle, sizedQuestions, config.examCode]);
  const sheetHtml = useMemo(() => shuffle.enabled && shuffle.sheet ? examVariantsSheetHtml(variants,
    { continuous: !config.enableSectionTitles, color: config.isCustomColor ? config.customColor : config.themeColor }) : '',
    [variants, shuffle.enabled, shuffle.sheet, config.enableSectionTitles, config.isCustomColor, config.customColor, config.themeColor]);
  const previewVariant = variants.find(variant => variant.code === previewCode) ?? variants[0];
  const titleId = useId();
  const sectionTitlesId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!isOpen || !dialog) return;
    dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const updateConfig = <K extends keyof ExamStyleConfig>(key: K, val: ExamStyleConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: val }));
  };

  const handleResetDefault = () => {
    if (window.confirm('Khôi phục toàn bộ cấu hình và cỡ hình về mặc định?')) {
      setConfig(DEFAULT_EXAM_STYLE);
      setImageWidths({});
      setPicked(undefined);
    }
  };

  const updateShuffle = (patch: Partial<typeof shuffle>) => setShuffle(previous => ({ ...previous, ...patch }));
  const partCounts = Object.fromEntries(SHUFFLE_PARTS.map(({ type }) => [type, sizedQuestions.filter(question => question.type === type).length]));

  // 1. Tải file .tex (mã nguồn cho ai cần); trộn đề thì mỗi mã một file, gói trong .zip.
  const handleDownloadTex = async () => {
    if (!variants.length) {
      const tex = generateExamLatex(sizedQuestions, config);
      downloadTexFile(tex, `De_Thi_${config.subject}_Ma_${config.examCode}.tex`);
      return;
    }
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    for (const variant of variants) zip.file(`De_Thi_${config.subject}_Ma_${variant.code}.tex`, generateExamLatex(variant.questions, { ...config, examCode: variant.code }));
    const url = URL.createObjectURL(await zip.generateAsync({ type: 'blob' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `De_Thi_${config.subject}_${variants.length}_ma_de.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const handlePrint = () => variants.length
    ? printExamVariantsToPdf(variants, config, sheetHtml)
    : printExamDirectlyToPdf(sizedQuestions, config);

  return (
    <dialog ref={dialogRef} aria-labelledby={titleId}
      onCancel={event => { event.preventDefault(); onClose(); }}
      className="fixed inset-0 m-0 h-[100dvh] max-h-none w-full max-w-none flex-col overflow-hidden border-0 bg-white p-0 open:flex">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-stone-200 px-2 py-1.5 sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="hidden size-8 shrink-0 place-items-center text-amber-800 sm:grid">
              <Sliders aria-hidden="true" className="size-4" />
            </span>
            <h2 id={titleId} className="truncate text-sm font-bold leading-tight text-stone-900 sm:text-base">Tùy chỉnh đề thi</h2>
            <span className="hidden shrink-0 text-xs text-stone-600 md:inline">{questions.length} câu đã chọn</span>
          </div>
          {(() => {
            const question = picked && questions.find(item => item.id === picked.questionId);
            if (!picked || !question) return <p className="hidden min-w-0 flex-1 truncate text-center text-xs text-stone-600 lg:block">
              Mẹo: bấm vào hình trong đề (khung xem trước) để chỉnh kích thước hình.</p>;
            const key = examImageKey(picked.questionId, picked.src);
            const width = examImageWidth(question, picked.src, imageWidths) ?? MAX_QUESTION_IMAGE_WIDTH;
            return <div className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-2 rounded-lg bg-amber-50 px-2 py-1 text-xs" role="group" aria-label={'Kích thước hình ' + picked.label}>
              <span className="font-semibold text-amber-950">Hình {picked.label}</span>
              <input type="range" min={MIN_QUESTION_IMAGE_WIDTH} max={MAX_QUESTION_IMAGE_WIDTH} step={5} value={width}
                aria-label={'Kích thước hình ' + picked.label + ' (%)'} className="w-32 accent-amber-800 sm:w-48"
                onChange={event => { const value = Number(event.currentTarget.value); setImageWidths(previous => ({ ...previous, [key]: value })); }} />
              <output className="w-10 font-semibold tabular-nums">{width}%</output>
              <button type="button" className="rounded-md px-2 py-1 font-semibold text-stone-700 hover:bg-amber-100"
                onClick={() => setImageWidths(previous => { const next = { ...previous }; delete next[key]; return next; })}>Cỡ gốc</button>
              <button type="button" className="rounded-md bg-amber-800 px-2 py-1 font-semibold text-white hover:bg-amber-900" onClick={() => setPicked(undefined)}>Xong</button>
            </div>;
          })()}
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={handleResetDefault}
              aria-label="Khôi phục mặc định"
              title="Khôi phục mặc định"
              className="flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-md px-2 text-xs font-semibold text-stone-700 hover:bg-stone-100"
            >
              <RotateCcw aria-hidden="true" className="size-4" /> <span className="hidden sm:inline">Mặc định</span>
            </button>
            <button type="button" onClick={() => void handleDownloadTex()} aria-label={variants.length ? 'Tải mã nguồn .tex các mã đề (.zip)' : 'Tải mã nguồn .tex'}
              className="inline-flex min-h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2 text-xs font-semibold text-stone-700 hover:bg-stone-100">
              <Download aria-hidden="true" className="hidden size-4 sm:block" />
              <span className="hidden sm:inline">Mã nguồn</span> .tex{variants.length ? ' (.zip)' : ''}
            </button>
            <button type="button" onClick={handlePrint} aria-label={variants.length ? `Xuất ${variants.length} mã đề ra PDF` : 'Xuất đề thi ra PDF'}
              className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md bg-amber-800 px-2.5 text-xs font-semibold text-white hover:bg-amber-900 sm:px-3">
              <Printer aria-hidden="true" className="hidden size-4 sm:block" />
              <span><span className="hidden sm:inline">Xuất </span>PDF{variants.length ? ` (${variants.length} mã đề)` : ''}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng tùy chỉnh đề thi"
              className="grid size-8 place-items-center rounded-md text-stone-600 hover:bg-stone-100 hover:text-stone-900"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex shrink-0 gap-1 border-b border-stone-200 bg-stone-50 px-3 py-2 lg:hidden">
          {(['settings', 'preview'] as const).map(pane => (
            <button key={pane} type="button" aria-pressed={mobilePane === pane} onClick={() => setMobilePane(pane)}
              className={'flex-1 rounded-md px-2 py-2 text-xs font-semibold ' + (mobilePane === pane
                ? 'bg-amber-100 text-amber-950' : 'text-stone-600 hover:bg-stone-100')}>
              {pane === 'settings' ? 'Tùy chỉnh' : 'Xem trước'}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 lg:grid lg:grid-cols-[clamp(20rem,32vw,27rem)_minmax(0,1fr)]">
        <div className={(mobilePane === 'settings' ? '' : 'hidden lg:block ') + 'h-full min-h-0 divide-y divide-stone-200 overflow-y-auto overscroll-contain px-3 text-sm text-stone-900 sm:px-5'}>

          {/* ═══ MỤC 1. MẪU GIAO DIỆN & BẢNG MÀU LATEX ═══ */}
          <div className="space-y-3 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-950">
              <Palette className="w-4 h-4" /> 1. Màu sắc và phông chữ
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-2">Màu chủ đạo đề thi:</label>
              <div className="grid gap-2 sm:grid-cols-2">
                {/* Pimax Red */}
                <div
                  onClick={() => updateConfig('isCustomColor', false)}
                  className={`p-2.5 rounded-lg border cursor-pointer flex items-center gap-3 transition-all ${
                    !config.isCustomColor ? 'border-amber-400 bg-amber-50' : 'border-stone-200 hover:border-stone-300'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-[#920000] shrink-0 shadow-sm" />
                  <div>
                    <div className="font-bold text-xs">Pimax Red</div>
                    <div className="text-[11px] text-stone-600">#920000 (Mặc định)</div>
                  </div>
                </div>

                {/* Tùy chọn màu */}
                <div
                  onClick={() => updateConfig('isCustomColor', true)}
                  className={`p-2.5 rounded-lg border cursor-pointer flex items-center justify-between transition-all ${
                    config.isCustomColor ? 'border-amber-400 bg-amber-50' : 'border-stone-200 hover:border-stone-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={config.customColor}
                      onChange={e => {
                        updateConfig('customColor', e.target.value);
                        updateConfig('isCustomColor', true);
                      }}
                      className="w-8 h-8 rounded-lg border-0 cursor-pointer p-0"
                    />
                    <div>
                      <div className="font-bold text-xs">Tùy chọn màu</div>
                      <div className="text-[11px] text-stone-600 font-mono">{config.customColor}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Màu công thức toán */}
            <div className="flex items-center justify-between gap-3 py-2">
              <span className="text-xs font-semibold text-stone-700">Màu công thức toán</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={config.mathColor}
                  onChange={e => updateConfig('mathColor', e.target.value)}
                  className="w-6 h-6 rounded cursor-pointer border-0 p-0"
                />
                <span className="text-xs font-mono font-bold text-amber-950">{config.mathColor}</span>
              </div>
            </div>

            {/* Gói Font Toán học */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-stone-700">Phông chữ toán</label>
              <select
                value={config.mathFont}
                onChange={e => updateConfig('mathFont', e.target.value)}
                className="w-full p-2.5 rounded-lg border border-stone-200 bg-white text-xs font-medium outline-none focus:border-amber-700"
              >
                <option value="Latin Modern">Latin Modern (Chuẩn Overleaf)</option>
                <option value="Computer Modern">Computer Modern (Cổ điển)</option>
                <option value="Times New Roman">Times New Roman</option>
              </select>
            </div>
          </div>

          {/* ═══ MỤC 2. Hình mờ ═══ */}
          <div className="space-y-2 py-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-semibold text-amber-950">
                <Droplets className="w-4 h-4" /> 2. Hình mờ
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={config.enableWatermark}
                  aria-label="Bật hình mờ"
                  onChange={e => updateConfig('enableWatermark', e.target.checked)}
                />
                <div className="w-9 h-5 bg-stone-200 peer-focus-visible:ring-2 peer-focus-visible:ring-amber-700 peer-focus-visible:ring-offset-2 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-800" />
              </label>
            </div>
            {config.enableWatermark && (
              <input
                type="text"
                value={config.watermarkText}
                onChange={e => updateConfig('watermarkText', e.target.value)}
                placeholder="Nhập nội dung Watermark..."
                className="w-full p-2.5 rounded-lg border border-stone-200 text-xs outline-none focus:border-amber-700"
              />
            )}
          </div>

          {/* ═══ MỤC 3. THUỘC TÍNH KHUNG ĐỀ (BOX & CONTENT) ═══ */}
          <div className="space-y-3 py-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-semibold text-amber-950">
                <Layout className="w-4 h-4" /> 3. Thông tin và khung đề
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={config.enableBox}
                  aria-label="Bật khung đề"
                  onChange={e => updateConfig('enableBox', e.target.checked)}
                />
                <div className="w-9 h-5 bg-stone-200 peer-focus-visible:ring-2 peer-focus-visible:ring-amber-700 peer-focus-visible:ring-offset-2 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-800" />
              </label>
            </div>

            {config.enableBox && (
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-stone-600 mb-1">Tiêu đề cấp trên</label>
                    <input
                      type="text"
                      value={config.headerTitle}
                      onChange={e => updateConfig('headerTitle', e.target.value)}
                      placeholder="VD: SỞ GD&ĐT AN GIANG"
                      className="w-full p-2.5 rounded-lg border border-stone-200 text-xs font-medium outline-none focus:border-amber-700"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-600 mb-1">Mã đề</label>
                    <input
                      type="text"
                      value={config.examCode}
                      onChange={e => updateConfig('examCode', e.target.value)}
                      placeholder="101"
                      className="w-full p-2.5 rounded-lg border border-stone-200 text-xs font-medium outline-none focus:border-amber-700"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">Tên trường / Đơn vị</label>
                  <input
                    type="text"
                    value={config.schoolName}
                    onChange={e => updateConfig('schoolName', e.target.value)}
                    placeholder="VD: TRƯỜNG THPT CHUYÊN THỰC HÀNH"
                    className="w-full p-2.5 rounded-lg border border-stone-200 text-xs font-medium outline-none focus:border-amber-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">Tên kỳ thi / Đề thi</label>
                  <input
                    type="text"
                    value={config.examName}
                    onChange={e => updateConfig('examName', e.target.value)}
                    placeholder="VD: KỲ THI THỬ TỐT NGHIỆP THPT"
                    className="w-full p-2.5 rounded-lg border border-stone-200 text-xs font-medium outline-none focus:border-amber-700"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-600 mb-1">Môn thi</label>
                    <input
                      type="text"
                      value={config.subject}
                      onChange={e => updateConfig('subject', e.target.value)}
                      placeholder="Vật lý"
                      className="w-full p-2.5 rounded-lg border border-stone-200 text-xs font-medium outline-none focus:border-amber-700"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-600 mb-1">Thời gian (phút)</label>
                    <input
                      type="number"
                      value={config.duration}
                      onChange={e => updateConfig('duration', parseInt(e.target.value, 10) || 50)}
                      className="w-full p-2.5 rounded-lg border border-stone-200 text-xs font-medium outline-none focus:border-amber-700"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-600 mb-1">Tiền tố nhãn câu</label>
                    <input
                      type="text"
                      value={config.questionPrefix}
                      onChange={e => updateConfig('questionPrefix', e.target.value)}
                      placeholder="Câu"
                      className="w-full p-2.5 rounded-lg border border-stone-200 text-xs font-medium outline-none focus:border-amber-700"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ═══ MỤC 4. Trộn đề ═══ */}
          <div className="space-y-3 py-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-semibold text-amber-950">
                <Shuffle aria-hidden="true" className="size-4" /> 4. Trộn đề
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={shuffle.enabled} aria-label="Trộn thành nhiều mã đề"
                  onChange={e => { updateShuffle({ enabled: e.target.checked }); setPreviewCode(''); }} />
                <div className="w-9 h-5 bg-stone-200 peer-focus-visible:ring-2 peer-focus-visible:ring-amber-700 peer-focus-visible:ring-offset-2 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-800" />
              </label>
            </div>
            {!shuffle.enabled ? <p className="text-[11px] text-stone-600">Bật để tạo nhiều mã đề từ đề này: đổi thứ tự câu trong từng phần và đổi chỗ phương án A–D.</p> : <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-semibold text-stone-600">Số mã đề
                  <input type="number" min={1} max={MAX_EXAM_VARIANTS} step={1} value={shuffle.count}
                    onChange={e => { const value = e.currentTarget.valueAsNumber; if (Number.isFinite(value)) updateShuffle({ count: Math.max(1, Math.min(MAX_EXAM_VARIANTS, Math.round(value))) }); }}
                    className="mt-1 w-full p-2.5 rounded-lg border border-stone-200 text-xs font-medium outline-none focus:border-amber-700" />
                </label>
                <label className="block text-xs font-semibold text-stone-600">Mã đề đầu tiên
                  <input type="text" value={config.examCode} onChange={e => updateConfig('examCode', e.target.value)} placeholder="101"
                    className="mt-1 w-full p-2.5 rounded-lg border border-stone-200 text-xs font-medium outline-none focus:border-amber-700" />
                </label>
              </div>
              <p className="text-[11px] text-stone-600">Các mã: {variants.map(variant => variant.code).join(', ')}.</p>
              <div className="space-y-1.5 text-xs">
                {([['questions', 'Đổi thứ tự câu trong từng phần', 'Phần I, II, III giữ nguyên thứ tự phần'],
                  ['choices', 'Đổi chỗ phương án A, B, C, D', 'Câu có phương án kiểu "Cả A và B", "Tất cả đều đúng" được giữ nguyên'],
                  ['statements', 'Đổi chỗ ý a, b, c, d của câu Đúng/Sai', 'Chỉ bật khi các ý không dùng kết quả của nhau'],
                  ['sheet', 'Kèm bảng đáp án và bảng đối chiếu', 'In ở cuối file, sau tất cả mã đề']] as const).map(([key, label, hint]) =>
                  <label key={key} className="flex items-start gap-2">
                    <input type="checkbox" className="mt-0.5 accent-amber-800" checked={shuffle[key]} onChange={e => updateShuffle({ [key]: e.target.checked })} />
                    <span><span className="font-semibold text-stone-900">{label}</span><br /><span className="text-[11px] text-stone-600">{hint}</span></span>
                  </label>)}
              </div>
              {shuffle.questions && <div className="space-y-1.5">
                <p className="text-xs font-semibold text-stone-600">Câu giữ nguyên vị trí (tùy chọn)</p>
                {SHUFFLE_PARTS.filter(({ type }) => partCounts[type] > 1).map(({ type, part }) => <label key={type} className="flex items-center gap-2 text-xs">
                  <span className="w-16 shrink-0">Phần {part}</span>
                  <input type="text" inputMode="numeric" value={shuffle.keep[type] ?? ''} placeholder={'Ví dụ: 1, ' + partCounts[type]}
                    aria-label={'Câu giữ nguyên vị trí ở Phần ' + part}
                    onChange={e => updateShuffle({ keep: { ...shuffle.keep, [type]: e.target.value } })}
                    className="min-w-0 flex-1 p-2 rounded-lg border border-stone-200 text-xs outline-none focus:border-amber-700" />
                </label>)}
              </div>}
              <button type="button" onClick={() => updateShuffle({ seed: Math.floor(Math.random() * 1e9) })}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 text-xs font-semibold text-stone-800 hover:bg-stone-100">
                <Shuffle aria-hidden="true" className="size-3.5" /> Trộn lại
              </button>
              <p className="text-[11px] text-stone-600">Ma trận và bản đặc tả vẫn tính theo đề gốc. Bảng đối chiếu cho biết mỗi câu của từng mã đề là câu số mấy trong đề gốc.</p>
            </div>}
          </div>

          {/* ═══ MỤC 5. Nội dung xuất kèm ═══ */}
          <div className="space-y-2 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-950">
              <CheckSquare className="w-4 h-4" /> 5. Nội dung xuất kèm
            </div>

            <div className="divide-y divide-stone-100">
              {/* Xuất bảng đáp án */}
              <div className="flex items-center justify-between gap-3 py-2">
                <div>
                  <div className="font-semibold text-xs text-stone-900">Xuất bảng đáp án</div>
                  <div className="text-[11px] text-stone-600">Chèn bảng đáp án tổng hợp ở cuối đề thi</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={config.exportAnswerTable}
                    aria-label="Xuất bảng đáp án"
                    onChange={e => updateConfig('exportAnswerTable', e.target.checked)}
                  />
                  <div className="w-9 h-5 bg-stone-200 peer-focus-visible:ring-2 peer-focus-visible:ring-amber-700 peer-focus-visible:ring-offset-2 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-800" />
                </label>
              </div>

              {/* Xuất lời giải chi tiết */}
              <div className="flex items-center justify-between gap-3 py-2">
                <div>
                  <div className="font-semibold text-xs text-stone-900">Xuất lời giải chi tiết</div>
                  <div className="text-[11px] text-stone-600">Đính kèm hướng dẫn giải chi tiết cho từng câu hỏi</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={config.exportDetailedSolution}
                    aria-label="Xuất lời giải chi tiết"
                    onChange={e => updateConfig('exportDetailedSolution', e.target.checked)}
                  />
                  <div className="w-9 h-5 bg-stone-200 peer-focus-visible:ring-2 peer-focus-visible:ring-amber-700 peer-focus-visible:ring-offset-2 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-800" />
                </label>
              </div>
            </div>
          </div>

          {/* ═══ MỤC 5. Tiêu đề phần thi (CHUẨN BỘ GD) ═══ */}
          <div className="space-y-3 py-3">
            <div className="flex items-center justify-between">
              <button type="button" aria-expanded={sectionTitlesExpanded && config.enableSectionTitles} aria-controls={sectionTitlesId}
                onClick={() => setSectionTitlesExpanded(expanded => !expanded)} disabled={!config.enableSectionTitles}
                className="flex min-h-8 items-center gap-2 rounded text-sm font-semibold text-amber-950 hover:text-amber-800 disabled:opacity-60">
                <Layers aria-hidden="true" className="size-4" /> 6. Tiêu đề phần thi
                <ChevronDown aria-hidden="true" className={'size-3.5 ' + (sectionTitlesExpanded && config.enableSectionTitles ? 'rotate-180' : '')} />
              </button>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={config.enableSectionTitles}
                  aria-label="Hiện tiêu đề phần thi"
                  onChange={e => updateConfig('enableSectionTitles', e.target.checked)}
                />
                <div className="w-9 h-5 bg-stone-200 peer-focus-visible:ring-2 peer-focus-visible:ring-amber-700 peer-focus-visible:ring-offset-2 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-800" />
              </label>
            </div>

            {config.enableSectionTitles && (
              <div id={sectionTitlesId} hidden={!sectionTitlesExpanded} className="space-y-3">
                {/* Phần Trắc nghiệm 4 PA */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-stone-700">Tiêu đề — Trắc nghiệm 4 PA</label>
                  <input
                    type="text"
                    value={config.choice4Title}
                    onChange={e => updateConfig('choice4Title', e.target.value)}
                    className="w-full p-2 rounded border border-stone-200 text-xs bg-white"
                  />
                  <SectionNoteInput
                    label="Hướng dẫn phần trắc nghiệm 4 phương án"
                    note={config.choice4Note}
                    count={questions.filter(question => question.type === 'trac_nghiem').length}
                    onChange={note => updateConfig('choice4Note', note)}
                  />
                </div>

                {/* Phần Đúng / Sai */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-stone-700">Tiêu đề — Đúng / Sai</label>
                  <input
                    type="text"
                    value={config.trueFalseTitle}
                    onChange={e => updateConfig('trueFalseTitle', e.target.value)}
                    className="w-full p-2 rounded border border-stone-200 text-xs bg-white"
                  />
                  <SectionNoteInput
                    label="Hướng dẫn phần đúng sai"
                    note={config.trueFalseNote}
                    count={questions.filter(question => question.type === 'dung_sai').length}
                    onChange={note => updateConfig('trueFalseNote', note)}
                  />
                </div>

                {/* Phần III: Trả lời ngắn */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-stone-700">Tiêu đề — Phần III (Trả lời ngắn)</label>
                  <input
                    type="text"
                    value={config.shortAnswerTitle}
                    onChange={e => updateConfig('shortAnswerTitle', e.target.value)}
                    className="w-full p-2 rounded border border-stone-200 text-xs bg-white"
                  />
                  <SectionNoteInput
                    label="Hướng dẫn phần trả lời ngắn"
                    note={config.shortAnswerNote}
                    count={questions.filter(question => question.type === 'tu_luan').length}
                    onChange={note => updateConfig('shortAnswerNote', note)}
                  />
                </div>
              </div>
            )}
          </div>

        </div>
        <section aria-label="Bản xem trước" className={(mobilePane === 'preview' ? 'flex ' : 'hidden lg:flex ')
          + 'h-full min-h-0 min-w-0 flex-col bg-stone-100 lg:border-l lg:border-stone-200'}>
          {variants.length > 0 && <div className="flex shrink-0 flex-wrap items-center gap-2 px-2 pt-2 text-xs sm:px-3">
            <label className="flex items-center gap-2 font-semibold text-stone-700"><span aria-hidden="true">Xem trước</span>
              <select aria-label="Xem trước mã đề" value={previewCode === 'sheet' && sheetHtml ? 'sheet' : previewVariant?.code} onChange={e => setPreviewCode(e.target.value)}
                className="rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs font-semibold outline-none focus:border-amber-700">
                {variants.map(variant => <option key={variant.code} value={variant.code}>Mã đề {variant.code}</option>)}
                {sheetHtml && <option value="sheet">Bảng đáp án và đối chiếu</option>}
              </select>
            </label>
            <span className="text-stone-600">Xuất PDF sẽ in liền {variants.length} mã đề{sheetHtml ? ', kèm bảng đáp án ở cuối' : ''}.</span>
          </div>}
          <div className="min-h-0 flex-1 px-1 sm:px-3">
            <ExamPrintPreview questions={previewVariant?.questions ?? sizedQuestions}
              config={previewVariant ? { ...config, examCode: previewVariant.code, exportAnswerTable: false } : config}
              html={previewCode === 'sheet' && sheetHtml ? sheetHtml : undefined}
              picked={picked} onPickImage={image => { setPicked(image); setMobilePane('preview'); }} />
          </div>
        </section>
        </div>

    </dialog>
  );
};

export default ExamStyleModal;
