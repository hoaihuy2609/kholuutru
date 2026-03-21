import React, { useState, useEffect, useRef, useCallback } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { supabase } from "../src/lib/supabase"; // Use project's supabase client
import { useUIStore } from "../src/stores/useUIStore"; // Use project's toast system

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
    <div style={{
      background: "var(--preview-step-bg)",
      border: "1px solid var(--preview-step-border)",
      borderRadius: 8,
      marginBottom: 10,
      overflow: "hidden",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "7px 12px",
        borderBottom: "1px solid var(--preview-step-border)",
        background: "var(--preview-step-head)",
      }}>
        <span style={{
          fontFamily: "monospace", fontSize: 11, fontWeight: 600,
          background: "var(--accent)", color: "#fff",
          width: 20, height: 20, borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>{index + 1}</span>
        <span style={{ fontSize: 13, fontWeight: 500 }}>
          {step.title || <em style={{ color: "var(--muted)" }}>Chưa có tiêu đề</em>}
        </span>
      </div>
      <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
        {step.text && <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.65, margin: 0 }}>{step.text}</p>}
        {step.formula && <KatexSpan tex={step.formula} block />}
        {step.formula2 && <KatexSpan tex={step.formula2} block />}
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
    <>
      <style>{`

        .se-root {
          --bg:         #F7F6F3;
          --surface:    #FFFFFF;
          --surface2:   #F1F0EC;
          --border:     #E9E9E7;
          --accent:     #6B7CDB;
          --accent2:    #9065B0;
          --text:       #1A1A1A;
          --muted:      #787774;
          --preview-step-bg:     #FFFFFF;
          --preview-step-border: #E9E9E7;
          --preview-step-head:   #F7F6F3;

          font-family: 'Inter', sans-serif;
          background: var(--bg);
          color: var(--text);
          height: calc(100vh - 60px);
          max-height: 100vh;
          margin: -1rem; /* Bù lại padding của content wrapper */
          display: flex;
          flex-direction: column;
        }

        .se-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 1.5rem;
          height: 52px;
          min-height: 52px;
          background: var(--surface);
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
        }
        .se-logo {
          font-family: 'Inter', sans-serif;
          font-weight: 700;
          font-size: 1.2rem;
          letter-spacing: 0.02em;
          color: var(--accent);
        }
        .se-logo span { color: var(--accent2); }

        .btn-save {
          display: flex;
          align-items: center;
          gap: 7px;
          background: var(--accent);
          color: #fff;
          border: none;
          border-radius: 6px;
          padding: 6px 16px;
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity .15s;
        }
        .btn-save:hover { opacity: .85; }
        .btn-save:disabled { opacity: .5; cursor: not-allowed; }

        .se-body {
          display: grid;
          grid-template-columns: 1fr 1fr;
          flex: 1;
          overflow: hidden;
        }

        @media (max-width: 768px) {
          .se-body { grid-template-columns: 1fr; }
          .se-preview { display: none !important; }
        }

        .se-editor {
          overflow-y: auto;
          border-right: 1px solid var(--border);
          padding: 1.25rem 1.5rem 2rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .section-head {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--muted);
          margin-bottom: .6rem;
        }

        .snippet-bar { display: none; }
        .snippet-btn { display: none; }
        .snippet-hint { display: none; }

        .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .field { display: flex; flex-direction: column; gap: 5px; }
        .field label { font-size: 11px; color: var(--muted); font-weight: 600; letter-spacing: 0.04em; }
        .field input, .field textarea {
          background: var(--surface); border: 1px solid var(--border); border-radius: 7px;
          color: var(--text); font-family: 'Inter', sans-serif; font-size: 13px; padding: 7px 10px; outline: none; resize: vertical;
        }
        .field input:focus, .field textarea:focus { border-color: var(--accent); }
        .field .latex-field { font-family: 'JetBrains Mono', monospace; font-size: 12px; background: #EEF0FB; color: #3D3D8D; border-color: #D3DBF9; }
        .field .latex-field:focus { border-color: var(--accent); box-shadow: 0 0 0 2px #d3dbf9; }

        .divider { height: 1px; background: var(--border); }

        .step-card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
        .step-card-head { display: flex; justify-content: space-between; padding: 8px 12px; background: var(--surface2); border-bottom: 1px solid var(--border); }
        .step-idx { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--accent); font-weight: 500; }
        .step-actions { display: flex; gap: 4px; }
        .step-btn { background: none; border: 1px solid var(--border); border-radius: 4px; color: var(--muted); font-size: 11px; padding: 2px 7px; cursor: pointer; }
        .step-btn:hover { background: var(--surface2); color: var(--text); }
        .step-btn.del:hover { background: #FEE2E2; border-color: #F87171; color: #DC2626; }

        .step-card-body { padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; }

        .add-step-btn {
          background: none; border: 1px dashed var(--border); border-radius: 8px; color: var(--muted);
          font-size: 13px; padding: 8px; cursor: pointer; width: 100%; text-align: center;
        }
        .add-step-btn:hover { border-color: var(--accent); color: var(--accent); background: #EEF0FB; }

        .se-preview { overflow-y: auto; padding: 1.25rem 1.5rem 2rem; background: var(--surface); border-left: 1px solid var(--border); }
        .preview-label { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); margin-bottom: 1rem; display: flex; align-items: center; gap: 8px; }
        .preview-label::after { content: ''; flex: 1; height: 1px; background: var(--border); }

        .preview-exam { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--muted); margin-bottom: 5px; }
        .preview-qnum { font-family: 'Inter', sans-serif; font-weight: 700; font-size: 1.5rem; color: var(--accent2); margin-bottom: .75rem; }
        .preview-qblock { background: var(--surface); border-left: 3px solid var(--accent2); border-radius: 0 6px 6px 0; padding: 10px 14px; margin-bottom: 1.25rem; }
        .preview-qtext { font-size: 13px; color: var(--muted); line-height: 1.6; margin-bottom: 6px; }
        .steps-preview-label { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); margin-bottom: .75rem; display: flex; align-items: center; gap: 8px; }
        .steps-preview-label::after { content: ''; flex: 1; height: 1px; background: var(--border); }
        
        .katex { color: var(--text) !important; }
      `}</style>

      <div className="se-root">
        <div className="se-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {onBack && (
              <button 
                onClick={onBack}
                style={{
                  background: 'none', border: 'none', color: 'var(--muted)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                  fontSize: '13px', padding: 0, fontFamily: 'Inter', fontWeight: 600
                }}
              >
                ← Quay lại
              </button>
            )}
            <div className="se-logo">PhysiVault <span>Giải bài</span></div>
          </div>
          
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
             {switchToMarkdown && (
               <button
                  onClick={switchToMarkdown}
                  style={{
                    background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border)",
                    padding: "6px 12px", borderRadius: "6px", fontSize: "12px", cursor: "pointer", fontFamily: 'Inter', fontWeight: 600
                  }}
               >
                 Thường (Markdown)
               </button>
             )}
            <button className="btn-save" onClick={handleSave} disabled={saving}>
              {saving ? "Đang lưu..." : "💾 Bấm Lưu"}
            </button>
          </div>
        </div>

        <div className="se-body">
          <div className="se-editor">
            <div>
              <div className="section-head">Thông tin bài tập</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div className="field-row">
                  <div className="field">
                    <label>Tên đề thi / Nguồn</label>
                    <input placeholder="VD: THPT QG 2024" value={examName} onChange={e => setExamName(e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Số bài / Số câu</label>
                    <input placeholder="VD: Câu 38" value={questionNo} onChange={e => setQuestionNo(e.target.value)} />
                  </div>
                </div>
                <div className="field">
                  <label>Mô tả đề bài (Text)</label>
                  <textarea rows={2} placeholder="Một vật dao động..." value={qText} onChange={e => setQText(e.target.value)} />
                </div>
                <div className="field">
                  <label>Công thức đề bài (LaTeX)</label>
                  <textarea rows={2} className="latex-field" placeholder="x = 4\cos(...)" value={qFormula} onChange={e => setQFormula(e.target.value)} onFocus={e => trackFocus("qFormula", e.target)} />
                </div>
              </div>
            </div>

            <div className="divider" />

            <div>
              <div className="section-head">Từng bước giải</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {steps.map((step, idx) => (
                  <div className="step-card" key={idx}>
                    <div className="step-card-head">
                      <span className="step-idx">Bước {idx + 1}</span>
                      <div className="step-actions">
                        <button className="step-btn" onClick={() => moveStep(idx, -1)}>↑</button>
                        <button className="step-btn" onClick={() => moveStep(idx, 1)}>↓</button>
                        {steps.length > 1 && <button className="step-btn del" onClick={() => removeStep(idx)}>Xóa</button>}
                      </div>
                    </div>
                    <div className="step-card-body">
                      <div className="field">
                        <label>Tiêu đề bước</label>
                        <input placeholder="VD: Tìm chu kì" value={step.title} onChange={e => updateStep(idx, "title", e.target.value)} />
                      </div>
                      <div className="field">
                        <label>Giải thích</label>
                        <textarea rows={1} value={step.text} onChange={e => updateStep(idx, "text", e.target.value)} />
                      </div>
                      <div className="field">
                        <label>Công thức 1</label>
                        <textarea rows={1} className="latex-field" value={step.formula} onChange={e => updateStep(idx, "formula", e.target.value)} onFocus={e => trackFocus(`step-${idx}-formula`, e.target)} />
                      </div>
                      <div className="field">
                        <label>Công thức 2 (Nếu cần)</label>
                        <textarea rows={1} className="latex-field" value={step.formula2} onChange={e => updateStep(idx, "formula2", e.target.value)} onFocus={e => trackFocus(`step-${idx}-formula2`, e.target)} />
                      </div>
                    </div>
                  </div>
                ))}
                <button className="add-step-btn" onClick={addStep}>+ Thêm bước tiếp theo</button>
              </div>
            </div>
          </div>

          <div className="se-preview">
            <div className="preview-label">Xem trước kết quả</div>
            {examName && <div className="preview-exam">{examName}</div>}
            <div className="preview-qnum">{questionNo || "Câu ?"}</div>
            <div className="preview-qblock">
              {qText && <p className="preview-qtext">{qText}</p>}
              {qFormula && <KatexSpan tex={qFormula} block />}
            </div>
            {steps.some(s => s.title || s.formula) && (
              <>
                <div className="steps-preview-label">Lời giải</div>
                {steps.map((step, idx) => <StepPreview key={idx} step={step} index={idx} />)}
              </>
            )}
            {!examName && !qFormula && !steps[0].title && (
              <p style={{ fontSize: 13, color: "var(--muted)", textAlign: "center", marginTop: "30%" }}>Bắt đầu soạn thảo để xem trước...</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
