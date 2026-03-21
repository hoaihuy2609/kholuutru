import React, { useState, useEffect, useRef, useCallback } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { supabase } from "../src/lib/supabase";
import { useUIStore } from "../src/stores/useUIStore";
import { ChevronLeft, Save, Trash2, ArrowUp, ArrowDown, Plus, Eye, BookOpen, Layers } from 'lucide-react';

const SNIPPETS = [
  { label: "Phân số",      tex: "\\frac{a}{b}",                   display: "a/b" },
  { label: "Căn",          tex: "\\sqrt{x}",                      display: "√x" },
  { label: "Mũ",           tex: "x^{n}",                          display: "xⁿ" },
  { label: "Chỉ số dưới",  tex: "x_{0}",                          display: "x₀" },
  { label: "Tích phân",    tex: "\\int_{a}^{b} f(x)\\,dx",        display: "∫" },
  { label: "Tổng sigma",   tex: "\\sum_{i=1}^{n}",                display: "Σ" },
  { label: "Vec-tơ",       tex: "\\vec{F}",                       display: "F⃗" },
  { label: "Góc",          tex: "\\alpha, \\beta, \\theta",       display: "α β θ" },
  { label: "Omega",        tex: "\\omega",                        display: "ω" },
  { label: "Pi",           tex: "\\pi",                           display: "π" },
  { label: "Mũi tên",      tex: "\\Rightarrow",                   display: "⇒" },
  { label: "Xấp xỉ",       tex: "\\approx",                       display: "≈" },
  { label: "Dấu nhân",     tex: "\\times",                        display: "×" },
  { label: "Delta",        tex: "\\Delta",                        display: "Δ" },
  { label: "Ngoặc lớn",    tex: "\\left( ... \\right)",           display: "( )" },
  { label: "Đơn vị",       tex: "\\text{ cm/s}",                  display: "text" },
];

function KatexSpan({ tex, block = false }: { tex: string; block?: boolean }) {
  const ref = useRef<HTMLDivElement | HTMLSpanElement>(null);
  useEffect(() => {
    if (!ref.current || !tex) return;
    try {
      katex.render(tex, ref.current as HTMLElement, { throwOnError: false, displayMode: block });
    } catch (_) {}
  }, [tex, block]);
  return block
    ? <div ref={ref as React.RefObject<HTMLDivElement>} style={{ textAlign: "center", padding: "6px 0", overflowX: "auto" }} />
    : <span ref={ref as React.RefObject<HTMLSpanElement>} />;
}

function StepPreview({ step, index }: { step: any; index: number }) {
  return (
    <div className="bg-white border border-[#E9E9E7] rounded-xl mb-4 overflow-hidden shadow-sm">
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[#E9E9E7] bg-[#FCFCFA]">
        <span className="font-mono text-[11px] font-bold bg-[#6B7CDB] text-white w-5 h-5 rounded-full flex items-center justify-center shrink-0 tracking-tighter">
          {index + 1}
        </span>
        <span className="text-[13px] font-semibold text-[#1A1A1A]">
          {step.title || <em className="text-[#AEACA8] font-normal">Chưa có tiêu đề</em>}
        </span>
      </div>
      <div className="p-4 flex flex-col gap-3">
        {step.text && <p className="text-[13px] text-[#57564F] leading-relaxed m-0 whitespace-pre-wrap">{step.text}</p>}
        {step.formula && <div className="text-[#1A1A1A]"><KatexSpan tex={step.formula} block /></div>}
        {step.formula2 && <div className="text-[#1A1A1A]"><KatexSpan tex={step.formula2} block /></div>}
      </div>
    </div>
  );
}

const emptyStep = () => ({ title: "", text: "", formula: "", formula2: "" });

interface SolutionEditorProps {
  blog?: any;
  saveBlog?: (blog: any) => Promise<any>;
  deleteBlog?: (id: string) => Promise<boolean>;
  syncBlogs?: () => Promise<any>;
  onSaved?: (blog: any) => void;
  onBack?: () => void;
  switchToMarkdown?: () => void;
}

export default function SolutionEditor({ blog, saveBlog, syncBlogs, onSaved, onBack, switchToMarkdown }: SolutionEditorProps) {
  const [examName,   setExamName]   = useState("");
  const [questionNo, setQuestionNo] = useState("");
  const [qText,      setQText]      = useState("");
  const [qFormula,   setQFormula]   = useState("");
  const [steps,      setSteps]      = useState<any[]>([emptyStep()]);
  const [saving,     setSaving]     = useState(false);
  const [activeField, setActiveField] = useState<string | null>(null);

  const activeRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);
  const showToast = useUIStore(state => state.showToast);

  // Load existing data if editing
  useEffect(() => {
    if (blog && blog.content) {
      try {
        const parsed = JSON.parse(blog.content);
        if (parsed.type === 'physics_solution' && parsed.data) {
          setExamName(parsed.data.exam_name || "");
          setQuestionNo(parsed.data.question_no || "");
          setQText(parsed.data.question_text || "");
          setQFormula(parsed.data.question_latex || "");
          setSteps(parsed.data.steps && parsed.data.steps.length > 0 ? parsed.data.steps : [emptyStep()]);
        }
      } catch (e) {
        console.error("Failed to parse physics solution data", e);
      }
    }
  }, [blog]);

  const insertSnippet = useCallback((tex: string) => {
    const el = activeRef.current;
    if (!el) return;
    const start = el.selectionStart || 0;
    const end   = el.selectionEnd || 0;
    const val   = el.value;
    const next  = val.slice(0, start) + tex + val.slice(end);

    if (activeField === "qFormula") {
      setQFormula(next);
    } else if (activeField?.startsWith("step-")) {
      const parts = activeField.split("-");
      const idx = Number(parts[1]);
      const key = parts[2];
      updateStep(idx, key, next);
    }

    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + tex.length, start + tex.length);
    }, 0);
  }, [activeField]);

  const updateStep = (idx: number, key: string, val: string) => {
    setSteps(prev => prev.map((s, i) => i === idx ? { ...s, [key]: val } : s));
  };

  const addStep    = () => setSteps(prev => [...prev, emptyStep()]);
  const removeStep = (idx: number) => setSteps(prev => prev.filter((_, i) => i !== idx));
  const moveStep   = (idx: number, dir: number) => {
    setSteps(prev => {
      const arr = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= arr.length) return arr;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return arr;
    });
  };

  const handleSave = async () => {
    if (!examName || !questionNo) {
      showToast("Vui lòng nhập tên đề và số câu!", "error");
      return;
    }
    setSaving(true);
    try {
      const solutionData = {
        type: 'physics_solution',
        data: {
          exam_name: examName,
          question_no: questionNo,
          question_text: qText,
          question_latex: qFormula,
          steps,
        }
      };
      
      const payload = {
        id: blog?.id,
        title: `[Giải chi tiết] ${examName} - ${questionNo}`,
        summary: qText || 'Hướng dẫn giải bài tập vật lý chi tiết từng bước bằng LaTeX.',
        content: JSON.stringify(solutionData),
        category: 'Lời giải',
        is_published: true, // auto publish cho tiện
      };

      if (saveBlog) {
        const saved = await saveBlog(payload);
        if (saved) {
           showToast("Đã lưu bài viết! Đang đồng bộ...", "warning");
           if (syncBlogs) await syncBlogs();
           showToast("Đã lưu và đồng bộ thành công!", "success");
           if (onSaved) onSaved(saved);
        } else {
           throw new Error("Lưu thất bại.");
        }
      } else {
        // Fallback for standalone mode (if still used)
        const { error } = await supabase.from("solutions").insert(solutionData.data);
        if (error) throw error;
        showToast("Đã lưu vào solutions table (chế độ standalone)!", "success");
        setQText(""); setQFormula(""); setSteps([emptyStep()]);
      }
    } catch (err: any) {
      showToast("Lỗi: " + err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const trackFocus = (fieldId: string, ref: any) => {
    activeRef.current = ref;
    setActiveField(fieldId);
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6 animate-fade-in relative pb-20 font-sans">
      <style>{`.katex { color: #1A1A1A !important; }`}</style>

      {/* Top Bar */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
          {onBack && (
            <button
                onClick={onBack}
                className="flex items-center gap-1.5 text-sm font-medium hover:text-indigo-600 transition-colors"
                style={{ color: '#787774' }}
            >
                <ChevronLeft className="w-4 h-4" /> Quay lại
            </button>
          )}

          <div className="flex items-center gap-3 bg-white p-1 rounded-xl border border-[#E9E9E7]">
              {switchToMarkdown && (
                  <button
                      onClick={switchToMarkdown}
                      className="px-3 py-1.5 rounded-lg text-sm font-semibold transition-all text-[#787774] hover:bg-gray-50"
                  >
                      Markdown
                  </button>
              )}
              <button
                  className="px-3 py-1.5 rounded-lg text-sm font-semibold transition-all bg-[#EEF0FB] text-[#6B7CDB]"
              >
                  Lời Giải (LaTeX)
              </button>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
              <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-60 shadow-sm"
              >
                  <Save className="w-4 h-4" />
                  {saving ? 'Đang lưu...' : (blog ? 'Cập nhật' : 'Đăng bài')}
              </button>
          </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* Editor Area */}
        <div className="xl:col-span-7 flex flex-col gap-6">
          
          {/* Thông tin bài tập */}
          <div className="p-6 rounded-2xl bg-white border border-[#E9E9E7] shadow-sm space-y-5">
            <h3 className="font-semibold text-[#1A1A1A] flex items-center gap-2 text-lg">
               <BookOpen className="w-5 h-5 text-indigo-500" /> Thông tin bài tập
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-semibold mb-2 text-[#1A1A1A]">Tên đề thi / Nguồn</label>
                <input 
                  className="w-full p-3 rounded-lg border border-[#E9E9E7] outline-none focus:border-indigo-500 text-sm transition-colors"
                  placeholder="VD: THPT QG 2024" 
                  value={examName} onChange={e => setExamName(e.target.value)} 
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2 text-[#1A1A1A]">Số bài / Số câu</label>
                <input 
                  className="w-full p-3 rounded-lg border border-[#E9E9E7] outline-none focus:border-indigo-500 text-sm transition-colors"
                  placeholder="VD: Câu 38" 
                  value={questionNo} onChange={e => setQuestionNo(e.target.value)} 
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2 text-[#1A1A1A]">Mô tả đề bài (Text)</label>
              <textarea 
                rows={2}
                className="w-full p-3 rounded-lg border border-[#E9E9E7] outline-none focus:border-indigo-500 text-sm resize-y text-gray-700 transition-colors"
                placeholder="Một vật dao động..." 
                value={qText} onChange={e => setQText(e.target.value)} 
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2 text-[#1A1A1A]">Công thức đề bài (LaTeX)</label>
              <textarea 
                rows={2}
                className="w-full p-3 rounded-lg border border-[#D3DBF9] outline-none focus:border-indigo-500 text-sm font-mono resize-y bg-[#EEF0FB] text-[#3D3D8D] transition-colors"
                placeholder="x = 4\cos(...)" 
                value={qFormula} onChange={e => setQFormula(e.target.value)} 
                onFocus={e => trackFocus("qFormula", e.target as any)} 
              />
            </div>
          </div>

          {/* Từng bước giải */}
          <div className="space-y-4">
            <h3 className="font-semibold text-[#1A1A1A] flex items-center gap-2 text-lg mb-2">
               <Layers className="w-5 h-5 text-indigo-500" /> Từng bước giải
            </h3>

            <div className="space-y-4">
              {steps.map((step, idx) => (
                <div key={idx} className="bg-white border border-[#E9E9E7] rounded-2xl overflow-hidden shadow-sm transition-all focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-50">
                  {/* Step Header */}
                  <div className="flex items-center justify-between px-5 py-3.5 bg-[#FCFCFA] border-b border-[#E9E9E7]">
                    <span className="font-semibold text-sm text-indigo-700 flex items-center gap-2">
                       <span className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold shrink-0">{idx + 1}</span>
                       Bước {idx + 1}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors" onClick={() => moveStep(idx, -1)} title="Lên"><ArrowUp className="w-4 h-4" /></button>
                      <button className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors" onClick={() => moveStep(idx, 1)} title="Xuống"><ArrowDown className="w-4 h-4" /></button>
                      {steps.length > 1 && (
                         <button className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors ml-1" onClick={() => removeStep(idx)} title="Xóa"><Trash2 className="w-4 h-4" /></button>
                      )}
                    </div>
                  </div>
                  
                  {/* Step Body */}
                  <div className="p-5 space-y-5">
                     <div>
                        <label className="block text-xs font-bold mb-2 text-[#787774] uppercase tracking-wider">Tiêu đề bước</label>
                        <input 
                          className="w-full p-2.5 rounded-lg border border-[#E9E9E7] outline-none focus:border-indigo-500 text-sm font-medium transition-colors"
                          placeholder="VD: Tìm chu kì" 
                          value={step.title} onChange={e => updateStep(idx, "title", e.target.value)} 
                        />
                     </div>
                     
                     <div>
                        <label className="block text-xs font-bold mb-2 text-[#787774] uppercase tracking-wider">Giải thích</label>
                        <textarea 
                          rows={2}
                          className="w-full p-2.5 rounded-lg border border-[#E9E9E7] outline-none focus:border-indigo-500 text-sm resize-y text-gray-700 transition-colors"
                          placeholder="Mô tả cách làm..." 
                          value={step.text} onChange={e => updateStep(idx, "text", e.target.value)} 
                        />
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                       <div>
                          <label className="block text-xs font-bold mb-2 text-[#787774] uppercase tracking-wider">Công thức 1</label>
                          <textarea 
                            rows={2}
                            className="w-full p-2.5 rounded-lg border border-[#D3DBF9] outline-none focus:border-indigo-500 text-sm font-mono resize-y bg-[#EEF0FB] text-[#3D3D8D] transition-colors"
                            placeholder="LaTeX..." 
                            value={step.formula} onChange={e => updateStep(idx, "formula", e.target.value)} 
                            onFocus={e => trackFocus(`step-${idx}-formula`, e.target as any)} 
                          />
                       </div>
                       <div>
                          <label className="block text-xs font-bold mb-2 text-[#787774] uppercase tracking-wider">Công thức 2 (Tùy chọn)</label>
                          <textarea 
                            rows={2}
                            className="w-full p-2.5 rounded-lg border border-[#D3DBF9] outline-none focus:border-indigo-500 text-sm font-mono resize-y bg-[#EEF0FB] text-[#3D3D8D] transition-colors"
                            placeholder="LaTeX..." 
                            value={step.formula2} onChange={e => updateStep(idx, "formula2", e.target.value)} 
                            onFocus={e => trackFocus(`step-${idx}-formula2`, e.target as any)} 
                          />
                       </div>
                     </div>
                  </div>
                </div>
              ))}

              <button 
                className="w-full py-4 rounded-2xl border-2 border-dashed border-[#DCDCDA] text-[#787774] font-semibold text-sm hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all flex items-center justify-center gap-2 mt-4"
                onClick={addStep}
              >
                <Plus className="w-5 h-5" /> Thêm bước tiếp theo
              </button>
            </div>
          </div>
        </div>

        {/* Preview Area */}
        <div className="xl:col-span-5 h-[calc(100vh-140px)] sticky top-20">
          <div className="h-full border border-[#E9E9E7] rounded-2xl bg-white shadow-sm flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E9E9E7] flex justify-between items-center bg-[#FCFCFA] shrink-0">
              <h3 className="font-semibold text-[#1A1A1A] flex items-center gap-2">
                 <Eye className="w-4 h-4 text-indigo-500" /> Xem trước kết quả
              </h3>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 bg-[#F7F6F3]">
               <div className="space-y-8">
                  {(examName || questionNo || qText || qFormula) ? (
                    <div>
                      {examName && <div className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-1.5">{examName}</div>}
                      <div className="font-bold text-2xl text-indigo-900 mb-4">{questionNo || "Câu ?"}</div>
                      
                      <div className="bg-white border-l-[3px] border-indigo-400 rounded-r-xl p-5 shadow-sm mb-6">
                        {qText && <p className="text-[14px] text-gray-700 leading-relaxed mb-3 whitespace-pre-wrap">{qText}</p>}
                        {qFormula && <div className="text-[#1A1A1A]"><KatexSpan tex={qFormula} block /></div>}
                      </div>
                    </div>
                  ) : null}

                  {steps.some(s => s.title || s.formula || s.text || s.formula2) && (
                    <div>
                      <div className="text-[10px] font-mono text-[#AEACA8] uppercase tracking-[0.15em] flex items-center gap-3 mb-5">
                         Lời giải chi tiết
                         <div className="h-[1px] flex-1 bg-[#E9E9E7]"></div>
                      </div>
                      {steps.map((step, idx) => (step.title || step.formula || step.text || step.formula2) ? (
                         <StepPreview key={idx} step={step} index={idx} />
                      ) : null)}
                    </div>
                  )}

                  {!examName && !qFormula && !steps[0]?.title && !qText && (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 mt-28 opacity-60">
                       <Eye className="w-12 h-12 mb-4" />
                       <p className="text-sm">Bắt đầu nhập liệu để xem trước kết quả...</p>
                    </div>
                  )}
               </div>
            </div>
          </div>
        </div>
        
      </div>
    </div>
  );
}
