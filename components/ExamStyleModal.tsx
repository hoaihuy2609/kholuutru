import React, { useId, useState } from 'react';
import {
  X, RotateCcw, Palette, Droplets, Sliders, Layout,
  Layers, CheckSquare, Download, Loader2, Printer
} from 'lucide-react';
import {
  ExamStyleConfig, DEFAULT_EXAM_STYLE, SelectedQuestionItem,
  formatExamSectionNote, generateExamLatex, downloadTexFile,
} from '../src/services/examLatexService';

interface ExamStyleModalProps {
  isOpen: boolean;
  onClose: () => void;
  questions: SelectedQuestionItem[];
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
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileStatus, setCompileStatus] = useState<string>('');
  const titleId = useId();

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

  const handleExportPdf = async () => {
    setIsCompiling(true);
    setCompileStatus('');

    try {
      const { downloadExamPdf } = await import('../src/services/examPdfService');
      await downloadExamPdf(questions, config);
    } catch (error) {
      const message = error instanceof Error && error.message.startsWith('Không tải được hình')
        ? error.message : 'Không tạo được PDF. Vui lòng thử lại.';
      setCompileStatus(message);
    } finally {
      setIsCompiling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/20 animate-fade-in">
      <div role="dialog" aria-labelledby={titleId}
        className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl md:max-h-[calc(100dvh-3rem)]">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-stone-200 px-3 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-800">
              <Sliders aria-hidden="true" className="size-4" />
            </span>
            <h2 id={titleId} className="text-base font-bold leading-tight text-stone-900 sm:text-lg">Tùy chỉnh đề thi</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetDefault}
              className="flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-md border border-stone-200 px-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 sm:px-2.5"
            >
              <RotateCcw aria-hidden="true" className="size-3.5" /> Mặc định
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng tùy chỉnh đề thi"
              className="grid size-9 place-items-center rounded-md text-stone-600 hover:bg-stone-100 hover:text-stone-900"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-stone-50 p-3 text-sm text-stone-900 sm:p-5">

          {/* ═══ MỤC 1. MẪU GIAO DIỆN & BẢNG MÀU LATEX ═══ */}
          <div className="rounded-xl border border-stone-200 bg-white p-3 sm:p-4 space-y-4">
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
            <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-stone-200 bg-stone-50">
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
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-stone-700">Gói Font Toán học:</label>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">3 Font</span>
              </div>
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
          <div className="rounded-xl border border-stone-200 bg-white p-3 sm:p-4 space-y-3">
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
          <div className="rounded-xl border border-stone-200 bg-white p-3 sm:p-4 space-y-4">
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
          <div className="rounded-xl border border-stone-200 bg-white p-3 sm:p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-950">
              <CheckSquare className="w-4 h-4" /> 4. Nội dung xuất kèm
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {/* Xuất bảng đáp án */}
              <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-stone-200 bg-stone-50">
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
              <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-stone-200 bg-stone-50">
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
          <div className="rounded-xl border border-stone-200 bg-white p-3 sm:p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-semibold text-amber-950">
                <Layers className="w-4 h-4" /> 5. Tiêu đề phần thi
              </span>
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
              <div className="space-y-3 pt-2">
                {/* Phần Trắc nghiệm 4 PA */}
                <div className="p-3 rounded-lg border border-stone-200 bg-stone-50 space-y-2">
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
                <div className="p-3 rounded-lg border border-stone-200 bg-stone-50 space-y-2">
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
                <div className="p-3 rounded-lg border border-stone-200 bg-stone-50 space-y-2">
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

        {/* ── FOOTER MODAL: NÚT XUẤT ĐỀ TRỰC TIẾP TRONG WEB ── */}
        {compileStatus && <p role="alert" className="shrink-0 border-t border-red-100 bg-red-50 px-3 py-2 text-xs text-red-800 sm:px-5">{compileStatus}</p>}
        <div className="grid shrink-0 gap-2 border-t border-stone-200 bg-white p-3 sm:flex sm:items-center sm:justify-between sm:px-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-stone-700">
            <span className="rounded-full bg-amber-100 px-2 py-1 font-bold tabular-nums text-amber-950">{questions.length}</span>
            <span>câu hỏi đã chọn</span>
          </div>

          <div className="grid grid-cols-[auto_1fr] gap-2 sm:flex">
            {/* Tải .tex */}
            <button
              type="button"
              onClick={handleDownloadTex}
              title="Tải mã nguồn TeX về máy"
              className="inline-flex min-h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-stone-200 px-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 sm:px-3"
            >
              <Download className="w-3.5 h-3.5" /> Mã nguồn .tex
            </button>

            {/* Nút chính: TỰ BIÊN SOẠN & XUẤT PDF TRỰC TIẾP TRONG WEB */}
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={isCompiling}
              className="inline-flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-lg bg-amber-800 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-900 disabled:opacity-50"
            >
              {isCompiling ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang tạo PDF…</span>
                </>
              ) : (
                <>
                  <Printer aria-hidden="true" className="size-4 shrink-0" />
                  <span>Xuất đề thi ra PDF</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ExamStyleModal;
