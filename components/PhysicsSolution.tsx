import React, { useEffect, useRef } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

// ─── Utility: render LaTeX inline hoặc block ───────────────────────────────
function Latex({ children, block = false }: { children: string; block?: boolean }) {
  const ref = useRef<HTMLDivElement | HTMLSpanElement>(null);

  useEffect(() => {
    if (ref.current && children != null) {
      try {
        katex.render(children, ref.current as HTMLElement, {
          throwOnError: false,
          displayMode: block,
        });
      } catch (err) {}
    }
  }, [children, block]);

  return block ? (
    <div ref={ref as React.RefObject<HTMLDivElement>} className="latex-block" />
  ) : (
    <span ref={ref as React.RefObject<HTMLSpanElement>} className="latex-inline" />
  );
}

function TextWithMath({ text }: { text: string }) {
  if (!text) return null;
  const parts = text.split(/(\$[^$]+\$|\\\([\s\S]*?\\\))/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('$') && part.endsWith('$') && part.length > 1) {
          return <Latex key={i} block={false}>{part.slice(1, -1)}</Latex>;
        }
        if (part.startsWith('\\(') && part.endsWith('\\)') && part.length > 3) {
          return <Latex key={i} block={false}>{part.slice(2, -2)}</Latex>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// ─── Component: tag câu hỏi ──────────────────────────────────────────────────
function QuestionTag({ votes, label }: { votes: number; label: string }) {
  if (!votes) return null;
  return (
    <div className="question-tag">
      <span className="fire">🔥</span>
      <span className="tag-label">{label}</span>
      <span className="tag-votes">{votes} vote</span>
    </div>
  );
}

// ─── Component chính ─────────────────────────────────────────────────────────
export default function PhysicsSolution({ data }: { data: any }) {
  if (!data) return null;

  // Lấy danh sách câu hỏi. Nếu là format mới có `questions`
  const questionsList = (data.questions && data.questions.length > 0) ? data.questions : [data];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400&family=JetBrains+Mono:wght@400;600&family=Be+Vietnam+Pro:wght@300;400;500;600&display=swap');

        .ps-wrap {
          --ink:       #1a1a2e;
          --ink-soft:  #4a4a6a;
          --bg:        #f7f6f2;
          --bg-card:   #ffffff;
          --accent:    #c0392b;
          --accent2:   #e67e22;
          --line:      #e2e0d8;
          --step-bg:   #faf9f6;
          --result-bg: #fff8e1;

          font-family: 'Be Vietnam Pro', sans-serif;
          background: var(--bg);
          color: var(--ink);
          border-radius: 12px;
          min-height: auto;
          padding: 2.5rem 1rem 4rem;
        }

        .ps-inner {
          max-width: 780px;
          margin: 0 auto;
        }

        .ps-header {
          border-bottom: 2px solid var(--ink);
          padding-bottom: 1.2rem;
          margin-bottom: 2rem;
        }

        .exam-name {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.72rem;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--ink-soft);
          margin-bottom: 0.5rem;
        }

        .question-label {
          display: flex;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .q-number {
          font-family: 'Lora', serif;
          font-size: 2rem;
          font-weight: 600;
          color: var(--accent);
          line-height: 1;
        }

        .question-tag {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          background: #fff3e0;
          border: 1.5px solid var(--accent2);
          border-radius: 20px;
          padding: 0.25rem 0.75rem;
          font-size: 0.78rem;
          font-weight: 600;
          color: var(--accent2);
        }

        .fire { font-size: 1rem; }
        .tag-votes { 
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.72rem;
        }

        .question-block {
          background: var(--bg-card);
          border-left: 4px solid var(--accent);
          border-radius: 0 8px 8px 0;
          padding: 1.25rem 1.5rem;
          margin-bottom: 2rem;
          box-shadow: 2px 2px 0 var(--line);
        }

        .question-block p {
          font-size: 0.95rem;
          line-height: 1.75;
          color: var(--ink-soft);
          margin-bottom: 0.75rem;
          white-space: pre-wrap;
        }

        .section-title-ps {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.68rem;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: var(--ink-soft);
          margin-bottom: 1rem;
          display: flex;
          align-items: center;
          gap: 0.6rem;
        }
        .section-title-ps::after {
          content: '';
          flex: 1;
          height: 1px;
          background: var(--line);
        }

        .steps-ps { display: flex; flex-direction: column; gap: 1.25rem; }

        .step {
          background: var(--step-bg);
          border: 1.5px solid var(--line);
          border-radius: 8px;
          overflow: hidden;
        }

        .step-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.7rem 1.25rem;
          background: var(--bg-card);
          border-bottom: 1.5px solid var(--line);
        }

        .step-number {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.72rem;
          font-weight: 600;
          background: var(--ink);
          color: #fff;
          width: 22px; height: 22px;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }

        .step-title {
          font-weight: 600;
          font-size: 0.88rem;
          color: var(--ink);
        }

        .step-body {
          padding: 1rem 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
        }

        .step-text {
          font-size: 0.88rem;
          color: var(--ink-soft);
          line-height: 1.7;
          white-space: pre-wrap;
        }

        .latex-block {
          text-align: center;
          padding: 0.5rem 0;
          overflow-x: auto;
        }

        .latex-inline { display: inline; }

        .ps-footer {
          margin-top: 2.5rem;
          padding-top: 1rem;
          border-top: 1px solid var(--line);
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.68rem;
          color: var(--ink-soft);
          letter-spacing: 0.08em;
          text-align: right;
        }
        
        .multi-question-divider {
          width: 100%;
          height: 4px;
          background: repeating-linear-gradient(
            45deg,
            var(--line),
            var(--line) 10px,
            transparent 10px,
            transparent 20px
          );
          margin: 4rem 0;
          opacity: 0.5;
        }

        @media (max-width: 560px) {
          .ps-wrap { padding: 1.5rem 0.75rem 3rem; }
          .q-number { font-size: 1.5rem; }
        }
      `}</style>

      <div className="ps-wrap">
        <div className="ps-inner">
          <div className="ps-header">
            <div className="exam-name">{data.exam_name || data.examName}</div>
          </div>
          
          {questionsList.map((q: any, qIdx: number) => (
             <div key={qIdx}>
                <div className="question-label" style={{ marginBottom: '1.25rem' }}>
                  <span className="q-number">{q.question_no || q.questionNumber || `Câu ${qIdx + 1}`}</span>
                  {(data.votes || q.votes) ? <QuestionTag votes={data.votes || q.votes} label="Tham khảo/Báo cáo" /> : null}
                </div>

                <div className="question-block">
                  {q.question_text && <p><TextWithMath text={q.question_text} /></p>}
                  {q.question_latex && <Latex block>{q.question_latex}</Latex>}
                </div>

                {q.steps && q.steps.length > 0 && (
                  <>
                    <div className="section-title-ps">Lời giải chi tiết</div>
                    <div className="steps-ps">
                      {q.steps.map((step: any, i: number) => (
                        <div className="step" key={i}>
                          <div className="step-header">
                            <span className="step-number">{i + 1}</span>
                            <span className="step-title">{step.title}</span>
                          </div>
                          <div className="step-body">
                            {step.text && <p className="step-text"><TextWithMath text={step.text} /></p>}
                            {step.formula && <Latex block>{step.formula}</Latex>}
                            {step.formula2 && <Latex block>{step.formula2}</Latex>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                
                {qIdx < questionsList.length - 1 && <div className="multi-question-divider" />}
             </div>
          ))}

          <div className="ps-footer">Biên soạn bởi PhysiVault • {data.exam_name || data.examName}</div>
        </div>
      </div>
    </>
  );
}
