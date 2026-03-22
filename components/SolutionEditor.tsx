import React, { useState, useEffect, useRef, useCallback } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { supabase } from "../src/lib/supabase";
import { useUIStore } from "../src/stores/useUIStore";
import { ChevronLeft, Save, Trash2, ArrowUp, ArrowDown, Plus, Eye, BookOpen, Layers, X } from 'lucide-react';

const CATEGORIES = ['Lý thuyết', 'Mẹo giải bài', 'Kinh nghiệm', 'Tin tức', 'Đề cương', 'Khác'];

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

function TextWithMath({ text }: { text: string }) {
  if (!text) return null;
  const parts = text.split(/(\$[^$]+\$|\\\([\s\S]*?\\\))/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('$') && part.endsWith('$') && part.length > 1) {
          return <KatexSpan key={i} tex={part.slice(1, -1)} block={false} />;
        }
        if (part.startsWith('\\(') && part.endsWith('\\)') && part.length > 3) {
          return <KatexSpan key={i} tex={part.slice(2, -2)} block={false} />;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function AutoResizeTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  
  const resize = () => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = ref.current.scrollHeight + "px";
    }
  };

  useEffect(() => {
    resize();
  }, [props.value]);

  return (
    <textarea
      ref={ref}
      {...props}
      style={{ overflow: "hidden", resize: "none", ...props.style }}
    />
  );
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
        {step.text && <p className="text-[13px] text-[#57564F] leading-relaxed m-0 whitespace-pre-wrap break-words"><TextWithMath text={step.text} /></p>}
        {step.formula && <div className="text-[#1A1A1A]"><KatexSpan tex={step.formula} block /></div>}
        {step.formula2 && <div className="text-[#1A1A1A]"><KatexSpan tex={step.formula2} block /></div>}
      </div>
    </div>
  );
}

const emptyStep = () => ({ title: "", text: "", formula: "", formula2: "" });
const emptyQuestion = () => ({ questionNo: "", qText: "", qFormula: "", steps: [emptyStep()] });

interface SolutionEditorProps {
  blog?: any;
  saveBlog?: (blog: any) => Promise<any>;
  deleteBlog?: (id: string) => Promise<boolean>;
  syncBlogs?: () => Promise<any>;
  onSaved?: (blog: any) => void;
  onBack?: () => void;
  switchToMarkdown?: () => void;
}

export default function SolutionEditor({ blog, saveBlog, deleteBlog, syncBlogs, onSaved, onBack, switchToMarkdown }: SolutionEditorProps) {
  const [examName,   setExamName]   = useState("");
  const [questions,  setQuestions]  = useState<any[]>([emptyQuestion()]);
  const [activeQIdx, setActiveQIdx] = useState(0);

  const [saving,     setSaving]     = useState(false);
  const [activeField, setActiveField] = useState<string | null>(null);

  // Cài đặt xuất bản state
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [isPublished, setIsPublished] = useState(false);
  const [grade, setGrade] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);

  const activeRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);
  const showToast = useUIStore(state => state.showToast);

  const activeQuestion = questions[activeQIdx] || emptyQuestion();

  // Load existing data if editing
  useEffect(() => {
    if (blog) {
      setCategory(blog.category || "");
      setTags(blog.tags || []);
      setIsPublished(!!blog.is_published);
      setGrade(blog.grade || 0);

      if (blog.content) {
        try {
          const parsed = JSON.parse(blog.content);
          if (parsed.type === 'physics_solution' && parsed.data) {
            setExamName(parsed.data.exam_name || "");
            
            if (parsed.data.questions && parsed.data.questions.length > 0) {
                setQuestions(parsed.data.questions.map((q: any) => ({
                    questionNo: q.question_no || "",
                    qText: q.question_text || "",
                    qFormula: q.question_latex || "",
                    steps: q.steps && q.steps.length > 0 ? q.steps : [emptyStep()]
                })));
            } else {
                setQuestions([{
                    questionNo: parsed.data.question_no || "",
                    qText: parsed.data.question_text || "",
                    qFormula: parsed.data.question_latex || "",
                    steps: parsed.data.steps && parsed.data.steps.length > 0 ? parsed.data.steps : [emptyStep()]
                }]);
            }
          }
        } catch (e) {
          console.error("Failed to parse physics solution data", e);
        }
      }
    }
  }, [blog]);

  useEffect(() => {
    let count = 0;
    let chars = 0;
    questions.forEach(q => {
        const text = q.qText + ' ' + q.steps.map((s: any) => s.title + ' ' + s.text).join(' ');
        count += text.trim().split(/\s+/).filter((w: any) => w).length;
        chars += text.length;
    });
    setWordCount(count);
    setCharCount(chars);
  }, [questions]);

  const insertSnippet = useCallback((tex: string) => {
    const el = activeRef.current;
    if (!el) return;
    const start = el.selectionStart || 0;
    const end   = el.selectionEnd || 0;
    const val   = el.value;
    const next  = val.slice(0, start) + tex + val.slice(end);

    if (activeField === "qFormula") {
      updateQuestionField("qFormula", next);
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
  }, [activeField, questions, activeQIdx]);

  const updateQuestionField = (key: string, val: string) => {
      setQuestions(prev => prev.map((q, i) => i === activeQIdx ? { ...q, [key]: val } : q));
  };

  const updateStep = (idx: number, key: string, val: string) => {
    setQuestions(prev => prev.map((q, i) => {
        if (i !== activeQIdx) return q;
        return {
            ...q,
            steps: q.steps.map((s: any, si: number) => si === idx ? { ...s, [key]: val } : s)
        };
    }));
  };

  const handleTagsChange = (val: string) => {
    setTags(val.split(',').map(t => t.trim()).filter(t => t));
  };
  
  const addQuestion = () => {
      setQuestions(prev => [...prev, emptyQuestion()]);
      setActiveQIdx(questions.length);
  };
  
  const removeQuestion = (idx: number) => {
      if (questions.length <= 1) return;
      if (window.confirm("Bạn có chắc muốn xóa câu này?")) {
        setQuestions(prev => prev.filter((_, i) => i !== idx));
        if (activeQIdx >= idx && activeQIdx > 0) setActiveQIdx(activeQIdx - 1);
      }
  };

  const addStep    = () => {
      setQuestions(prev => prev.map((q, i) => i === activeQIdx ? { ...q, steps: [...q.steps, emptyStep()] } : q));
  };
  const removeStep = (idx: number) => {
      setQuestions(prev => prev.map((q, i) => i === activeQIdx ? { ...q, steps: q.steps.filter((_: any, si: number) => si !== idx) } : q));
  };
  const moveStep   = (idx: number, dir: number) => {
    setQuestions(prev => prev.map((q, i) => {
      if (i !== activeQIdx) return q;
      const arr = [...q.steps];
      const target = idx + dir;
      if (target < 0 || target >= arr.length) return q;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return { ...q, steps: arr };
    }));
  };

  const handleSave = async () => {
    if (!examName || questions.some(q => !q.questionNo)) {
      showToast("Vui lòng nhập tên đề và số câu cho tất cả các câu!", "error");
      return;
    }
    setSaving(true);
    try {
      const solutionData = {
        type: 'physics_solution',
        data: {
          exam_name: examName,
          questions: questions.map(q => ({
              question_no: q.questionNo,
              question_text: q.qText,
              question_latex: q.qFormula,
              steps: q.steps
          })),
          // for extremely old backward comp if any old renderer is used directly
          question_no: questions[0].questionNo,
          question_text: questions[0].qText,
          question_latex: questions[0].qFormula,
          steps: questions[0].steps,
        }
      };
      
      const titleStr = questions.length === 1 
          ? `[Giải chi tiết] ${examName} - ${questions[0].questionNo}`
          : `[Giải chi tiết] ${examName} (${questions.length} câu)`;
          
      const firstText = questions[0].qText;
      
      const payload = {
        id: blog?.id,
        title: titleStr,
        summary: firstText ? firstText.substring(0, 150) + (firstText.length > 150 ? '...' : '') : 'Hướng dẫn giải chi tiết bằng LaTeX.',
        content: JSON.stringify(solutionData),
        category: category || 'Lời giải',
        is_published: isPublished,
        tags: tags,
        grade: grade,
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
        const { error } = await supabase.from("solutions").insert(solutionData.data);
        if (error) throw error;
        showToast("Đã lưu vào solutions table (chế độ standalone)!", "success");
        setQuestions([emptyQuestion()]);
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
    <div className="max-w-[1920px] w-full mx-auto p-4 md:p-8 space-y-6 animate-fade-in relative pb-20 font-sans">
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
              {blog && deleteBlog && (
                  <button
                      onClick={async () => {
                          if (window.confirm("Bạn có chắc muốn xóa bài viết này (và trên Github)?")) {
                              setSaving(true);
                              const ok = await deleteBlog(blog.id);
                              setSaving(false);
                              if (ok && onBack) onBack();
                          }
                      }}
                      disabled={saving}
                      className="px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-red-50 text-red-600 transition-colors disabled:opacity-50"
                  >
                      <Trash2 className="w-4 h-4" /> Xóa bài
                  </button>
              )}
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

      {/* Cài đặt xuất bản (Header) */}
      <div className="bg-white p-4 rounded-2xl border border-[#E9E9E7] shadow-sm flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6 relative z-10">
          <div className="flex items-center gap-3 shrink-0 min-w-[140px]">
              <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={isPublished} onChange={e => setIsPublished(e.target.checked)} />
                  <div className="w-[34px] h-[20px] bg-[#CFCFCB] rounded-full peer peer-checked:after:translate-x-[14px] peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
              <div className="text-xs font-semibold" style={{ color: isPublished ? '#448361' : '#787774' }}>
                  {isPublished ? '✓ Công khai' : '✎ Nháp (Admin)'}
              </div>
          </div>

          <div className="hidden lg:block w-px h-6 bg-[#E9E9E7] shrink-0" />

          <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-bold text-[#AEACA8] uppercase">Khối</span>
              <div className="flex bg-[#F7F6F3] p-1 rounded-lg border border-[#E9E9E7]">
                  {[ { lab: 'Tất cả', val: 0 }, { lab: '12', val: 12 }, { lab: '11', val: 11 }, { lab: '10', val: 10 } ].map(g => (
                      <button key={g.val} type="button" onClick={() => setGrade(g.val)} className="px-3 py-1.5 text-xs font-semibold rounded-md transition-all" style={{ background: grade === g.val ? '#6B7CDB' : 'transparent', color: grade === g.val ? '#FFFFFF' : '#787774' }}>{g.lab}</button>
                  ))}
              </div>
          </div>

          <div className="hidden lg:block w-px h-6 bg-[#E9E9E7] shrink-0" />

          <div className="flex flex-col md:flex-row md:items-center gap-4 lg:gap-6 flex-1">
              <div className="flex items-center gap-2 flex-1 relative">
                  <span className="text-xs font-bold text-[#AEACA8] uppercase shrink-0">Chuyên mục</span>
                  <input type="text" list="solution-categories-list" placeholder="Chọn hoặc nhập..." className="w-full p-2.5 rounded-lg border border-[#E9E9E7] outline-none focus:border-indigo-500 text-sm font-medium" value={category} onChange={e => setCategory(e.target.value)} />
                  <datalist id="solution-categories-list">
                      {CATEGORIES.map(c => <option key={c} value={c} />)}
                  </datalist>
              </div>

              <div className="hidden md:block w-px h-6 bg-[#E9E9E7] shrink-0" />

              <div className="flex items-center gap-2 flex-1">
                  <span className="text-xs font-bold text-[#AEACA8] uppercase shrink-0">Thẻ</span>
                  <input type="text" placeholder="vatly12, dongdien..." className="w-full p-2.5 rounded-lg border border-[#E9E9E7] outline-none focus:border-indigo-500 text-sm font-medium" value={tags.join(', ')} onChange={e => handleTagsChange(e.target.value)} />
              </div>
          </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        
        {/* Editor Area */}
        <div className="xl:col-span-6 flex flex-col gap-6">
          
          {/* Thông tin bài tập / Đề thi */}
          <div className="p-6 rounded-2xl bg-white border border-[#E9E9E7] shadow-sm space-y-5">
            <h3 className="font-semibold text-[#1A1A1A] flex items-center gap-2 text-lg">
               <BookOpen className="w-5 h-5 text-indigo-500" /> Thông tin đề thi
            </h3>
            
            <div>
              <label className="block text-sm font-semibold mb-2 text-[#1A1A1A]">Tên đề thi / Nguồn</label>
              <input 
                className="w-full p-3 rounded-lg border border-[#E9E9E7] outline-none focus:border-indigo-500 text-sm transition-colors"
                placeholder="VD: THPT QG 2024" 
                value={examName} onChange={e => setExamName(e.target.value)} 
              />
            </div>
            
            {/* Tabs cho nhiều câu */}
            <div className="pt-2 border-t border-[#E9E9E7] mt-4">
               <div className="flex items-center flex-wrap gap-2 mb-4">
                  {questions.map((q, idx) => (
                      <button
                          key={idx}
                          onClick={() => setActiveQIdx(idx)}
                          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${activeQIdx === idx ? 'bg-indigo-600 text-white shadow-sm' : 'bg-[#F7F6F3] text-[#787774] border border-[#E9E9E7] hover:bg-white'}`}
                      >
                          {q.questionNo || `Câu ${idx + 1}`}
                          {questions.length > 1 && (
                              <div 
                                onClick={(e) => { e.stopPropagation(); removeQuestion(idx); }} 
                                className={`w-5 h-5 rounded-full flex items-center justify-center -mr-1 ${activeQIdx === idx ? 'hover:bg-indigo-700 text-indigo-100' : 'hover:bg-red-100 text-red-400'}`}
                              >
                                  <X className="w-3 h-3" />
                              </div>
                          )}
                      </button>
                  ))}
                  <button 
                      onClick={addQuestion}
                      className="px-3 py-2 rounded-lg text-sm font-semibold border-2 border-dashed border-[#DCDCDA] text-[#787774] hover:border-indigo-400 hover:text-indigo-600 transition-all flex items-center gap-1"
                  >
                      <Plus className="w-4 h-4" /> Thêm câu
                  </button>
               </div>
               
               <div className="space-y-4">
                   <div>
                     <label className="block text-sm font-semibold mb-2 text-[#1A1A1A]">Số bài / Số câu</label>
                     <input 
                       className="w-full p-3 rounded-lg border border-[#E9E9E7] outline-none focus:border-indigo-500 text-sm transition-colors"
                       placeholder="VD: Câu 38" 
                       value={activeQuestion.questionNo} onChange={e => updateQuestionField("questionNo", e.target.value)} 
                     />
                   </div>

                   <div>
                     <label className="block text-sm font-semibold mb-2 text-[#1A1A1A]">Mô tả đề bài (Text)</label>
                     <AutoResizeTextarea 
                       rows={2}
                       className="w-full p-3 rounded-lg border border-[#E9E9E7] outline-none focus:border-indigo-500 text-sm text-gray-700 transition-colors"
                       placeholder="Một vật dao động..." 
                       value={activeQuestion.qText} onChange={e => updateQuestionField("qText", e.target.value)} 
                     />
                   </div>

                   <div>
                     <label className="block text-sm font-semibold mb-2 text-[#1A1A1A]">Công thức đề bài (LaTeX)</label>
                     <AutoResizeTextarea 
                       rows={2}
                       className="w-full p-3 rounded-lg border border-[#D3DBF9] outline-none focus:border-indigo-500 text-sm font-mono bg-[#EEF0FB] text-[#3D3D8D] transition-colors"
                       placeholder="x = 4\cos(...)" 
                       value={activeQuestion.qFormula} onChange={e => updateQuestionField("qFormula", e.target.value)} 
                       onFocus={e => trackFocus("qFormula", e.target as any)} 
                     />
                   </div>
               </div>
            </div>
          </div>

          {/* Từng bước giải của câu đang active */}
          <div className="space-y-4">
            <h3 className="font-semibold text-[#1A1A1A] flex items-center gap-2 text-lg mb-2">
               <Layers className="w-5 h-5 text-indigo-500" /> Từng bước giải - {activeQuestion.questionNo || `Câu ${activeQIdx + 1}`}
            </h3>

            <div className="space-y-4">
              {activeQuestion.steps.map((step: any, idx: number) => (
                <div key={idx} className="bg-white border border-[#E9E9E7] rounded-2xl overflow-hidden shadow-sm transition-all focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-50">
                  <div className="flex items-center justify-between px-5 py-3.5 bg-[#FCFCFA] border-b border-[#E9E9E7]">
                    <span className="font-semibold text-sm text-indigo-700 flex items-center gap-2">
                       <span className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold shrink-0">{idx + 1}</span>
                       Bước {idx + 1}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors" onClick={() => moveStep(idx, -1)} title="Lên"><ArrowUp className="w-4 h-4" /></button>
                      <button className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors" onClick={() => moveStep(idx, 1)} title="Xuống"><ArrowDown className="w-4 h-4" /></button>
                      {activeQuestion.steps.length > 1 && (
                         <button className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors ml-1" onClick={() => removeStep(idx)} title="Xóa"><Trash2 className="w-4 h-4" /></button>
                      )}
                    </div>
                  </div>
                  
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
                        <AutoResizeTextarea 
                          rows={2}
                          className="w-full p-2.5 rounded-lg border border-[#E9E9E7] outline-none focus:border-indigo-500 text-sm text-gray-700 transition-colors"
                          placeholder="Mô tả cách làm..." 
                          value={step.text} onChange={e => updateStep(idx, "text", e.target.value)} 
                        />
                     </div>

                     <div className="grid grid-cols-1 gap-5">
                       <div>
                          <label className="block text-xs font-bold mb-2 text-[#787774] uppercase tracking-wider">Công thức 1</label>
                          <AutoResizeTextarea 
                            rows={2}
                            className="w-full p-2.5 rounded-lg border border-[#D3DBF9] outline-none focus:border-indigo-500 text-sm font-mono bg-[#EEF0FB] text-[#3D3D8D] transition-colors"
                            placeholder="LaTeX..." 
                            value={step.formula} onChange={e => updateStep(idx, "formula", e.target.value)} 
                            onFocus={e => trackFocus(`step-${idx}-formula`, e.target as any)} 
                          />
                       </div>
                       <div>
                          <label className="block text-xs font-bold mb-2 text-[#787774] uppercase tracking-wider">Công thức 2 (Tùy chọn)</label>
                          <AutoResizeTextarea 
                            rows={2}
                            className="w-full p-2.5 rounded-lg border border-[#D3DBF9] outline-none focus:border-indigo-500 text-sm font-mono bg-[#EEF0FB] text-[#3D3D8D] transition-colors"
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
        <div className="xl:col-span-6 h-[calc(100vh-200px)] sticky top-20">
          <div className="h-full border border-[#E9E9E7] rounded-2xl bg-white shadow-sm flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E9E9E7] flex justify-between items-center bg-[#FCFCFA] shrink-0">
              <h3 className="font-semibold text-[#1A1A1A] flex items-center gap-2">
                 <Eye className="w-4 h-4 text-indigo-500" /> Xem trước kết quả
              </h3>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 bg-[#F7F6F3]">
               <div className="space-y-12">
                  {questions.map((q, qIdx) => (
                      <div key={qIdx} className={`space-y-6 ${qIdx !== activeQIdx ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                          {(examName || q.questionNo || q.qText || q.qFormula) ? (
                            <div>
                              {examName && <div className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-1.5">{examName}</div>}
                              <div className="font-bold text-2xl text-indigo-900 mb-4">{q.questionNo || `Câu ${qIdx + 1}`}</div>
                              
                              <div className="bg-white border-l-[3px] border-indigo-400 rounded-r-xl p-5 shadow-sm mb-6">
                                {q.qText && <p className="text-[14px] text-gray-700 leading-relaxed mb-3 whitespace-pre-wrap break-words"><TextWithMath text={q.qText} /></p>}
                                {q.qFormula && <div className="text-[#1A1A1A]"><KatexSpan tex={q.qFormula} block /></div>}
                              </div>
                            </div>
                          ) : null}

                          {q.steps.some((s: any) => s.title || s.formula || s.text || s.formula2) && (
                            <div>
                              <div className="text-[10px] font-mono text-[#AEACA8] uppercase tracking-[0.15em] flex items-center gap-3 mb-5">
                                 Lời giải chi tiết
                                 <div className="h-[1px] flex-1 bg-[#E9E9E7]"></div>
                              </div>
                              {q.steps.map((step: any, idx: number) => (step.title || step.formula || step.text || step.formula2) ? (
                                 <StepPreview key={idx} step={step} index={idx} />
                              ) : null)}
                            </div>
                          )}
                      </div>
                  ))}

                  {!examName && !activeQuestion.qFormula && !activeQuestion.steps[0]?.title && !activeQuestion.qText && (
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
