import React, { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  X, RotateCcw, Palette, Droplets, Sliders, Layout,
  Layers, CheckSquare, ChevronDown, Download, Printer
} from 'lucide-react';
import {
  ExamStyleConfig, DEFAULT_EXAM_STYLE, SelectedQuestionItem,
  formatExamSectionNote, generateExamLatex, downloadTexFile,
  examPrintDocument, printExamDirectlyToPdf, renderExamPrintBody
} from '../src/services/examLatexService';

interface ExamStyleModalProps {
  isOpen: boolean;
  onClose: () => void;
  questions: SelectedQuestionItem[];
}

const previewFrameWidth = 210 * 96 / 25.4 + 18; // A4 plus room for the scrollbar.

function ExamPrintPreview({ questions, config }: {
  questions: SelectedQuestionItem[];
  config: ExamStyleConfig;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const deferredConfig = useDeferredValue(config);
  const frameHtml = useMemo(() => examPrintDocument(), []);
  const bodyHtml = useMemo(() => renderExamPrintBody(questions, deferredConfig), [questions, deferredConfig]);

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

  const updateFrame = () => {
    const body = frameRef.current?.contentDocument?.body;
    if (body) body.innerHTML = bodyHtml;
  };
  useEffect(updateFrame, [bodyHtml]);

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
    if (window.confirm('Khôi phục toàn bộ cấu hình về mặc định?')) {
      setConfig(DEFAULT_EXAM_STYLE);
    }
  };

  // 1. Tải file .tex (mã nguồn cho ai cần)
  const handleDownloadTex = () => {
    const tex = generateExamLatex(questions, config);
    downloadTexFile(tex, `De_Thi_${config.subject}_Ma_${config.examCode}.tex`);
  };

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
            <button type="button" onClick={handleDownloadTex} aria-label="Tải mã nguồn .tex"
              className="inline-flex min-h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2 text-xs font-semibold text-stone-700 hover:bg-stone-100">
              <Download aria-hidden="true" className="hidden size-4 sm:block" />
              <span className="hidden sm:inline">Mã nguồn</span> .tex
            </button>
            <button type="button" onClick={() => printExamDirectlyToPdf(questions, config)} aria-label="Xuất đề thi ra PDF"
              className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md bg-amber-800 px-2.5 text-xs font-semibold text-white hover:bg-amber-900 sm:px-3">
              <Printer aria-hidden="true" className="hidden size-4 sm:block" />
              <span><span className="hidden sm:inline">Xuất </span>PDF</span>
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

          {/* ═══ MỤC 4. Nội dung xuất kèm ═══ */}
          <div className="space-y-2 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-950">
              <CheckSquare className="w-4 h-4" /> 4. Nội dung xuất kèm
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
                <Layers aria-hidden="true" className="size-4" /> 5. Tiêu đề phần thi
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
          <div className="min-h-0 flex-1 px-1 sm:px-3">
            <ExamPrintPreview questions={questions} config={config} />
          </div>
        </section>
        </div>

    </dialog>
  );
};

export default ExamStyleModal;
