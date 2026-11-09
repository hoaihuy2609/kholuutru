// SolutionRenderer.tsx
// Component phía học sinh — tự nhận diện type (tu_luan | dung_sai)
// Tương thích ngược với data cũ không có `type`
//
// Usage:
//   import SolutionRenderer from './SolutionRenderer'
//   <SolutionRenderer content={blog.content} />

import React, { useEffect, useMemo, useRef } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { SolutionStep as Step, SolutionStatement as Statement } from '../types';
import { CLOUDFLARE_PROXY_URL } from '../src/lib/telegram';
import { normalizeQuestionImageWidth } from '../src/utils/questionImage';

interface Question {
  question_no: string;
  question_text: string;
  question_latex: string;
  type?: 'tu_luan' | 'dung_sai' | 'trac_nghiem';
  solution?: string;
  steps: Step[];
  statements: Statement[];
  choices?: string[];
  correctChoice?: string;
  solutionSteps?: Step[];
  tikz_code?: string;
  image_svg?: string;
  image_url?: string;
  image_telegram_file_id?: string;
  image_layout?: 'auto' | 'right' | 'bottom';
  image_width?: number;
  tikzCode?: string;
  imageSvg?: string;
  imageUrl?: string;
  imageTelegramFileId?: string;
  imageLayout?: 'auto' | 'right' | 'bottom';
  imageWidth?: number;
}

interface PhysicsSolutionData extends Partial<Question> {
  questions?: Question[];
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function normalizeIllustration(question: Partial<Question>) {
  return {
    tikz_code: question.tikz_code || question.tikzCode || '',
    image_svg: question.image_svg || question.imageSvg || '',
    image_url: question.image_url || question.imageUrl || '',
    image_telegram_file_id: question.image_telegram_file_id || question.imageTelegramFileId || '',
    image_layout: question.image_layout || question.imageLayout || 'auto' as const,
    image_width: normalizeQuestionImageWidth(question.image_width ?? question.imageWidth),
  };
}

// Parse blog.content (JSON string) → danh sách Question đã normalize
function parseContent(content: string): Question[] | null {
  try {
    const parsed = JSON.parse(content);
    if (parsed.type !== 'physics_solution' || !parsed.data) return null;

    const data: PhysicsSolutionData = parsed.data;

    let questions: Question[];

    if (data.questions && data.questions.length > 0) {
      questions = data.questions.map(q => ({
        question_no:    q.question_no    || "",
        question_text:  q.question_text  || "",
        question_latex: q.question_latex || "",
        type:           q.type === 'dung_sai' ? 'dung_sai' : q.type === 'trac_nghiem' ? 'trac_nghiem' : 'tu_luan',
        steps:          q.steps          || [],
        statements:     q.statements     || [],
        choices:        q.choices        || [],
        correctChoice:  q.correctChoice  || '',
        solutionSteps:  q.solutionSteps  || [],
        solution:       q.solution       || "",
        ...normalizeIllustration(q),
      }));
    } else {
      // Backward compat: câu duy nhất ở root-level, không có `type`
      questions = [{
        question_no:    data.question_no    || "",
        question_text:  data.question_text  || "",
        question_latex: data.question_latex || "",
        type:           'tu_luan',
        steps:       data.steps || [],
        statements:  [],
        solution:    data.solution || "",
        ...normalizeIllustration(data),
      }];
    }

    return questions;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// KATEX & TEXT
// ─────────────────────────────────────────────────────────────
function KatexBlock({ tex }: { tex: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current || !tex?.trim()) return;
    try { katex.render(tex, ref.current, { throwOnError: false, displayMode: true }); }
    catch (_) {}
  }, [tex]);
  return <div ref={ref} style={{ textAlign: "center", padding: "6px 0", overflowX: "auto" }} />;
}

function KatexInline({ tex }: { tex: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!ref.current || !tex?.trim()) return;
    try { katex.render(tex, ref.current, { throwOnError: false, displayMode: false }); }
    catch (_) {}
  }, [tex]);
  return <span ref={ref} />;
}

function renderFormattedText(text: string, baseKey: string | number): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((chunk, j) => {
    if (chunk.startsWith('**') && chunk.endsWith('**') && chunk.length >= 4) {
      return <strong key={`${baseKey}-b-${j}`} className="font-bold text-[#1A1A1A]">{chunk.slice(2, -2)}</strong>;
    }
    return <span key={`${baseKey}-t-${j}`}>{chunk}</span>;
  });
}

function renderInlineMath(text: string): React.ReactNode[] {
  if (!text) return [];

  // Tự động nhận diện công thức toán nếu AI quên kẹp dấu $
  let processed = text;
  if (!processed.includes('$') && /\\(?:vec|frac|cdot|text|alpha|beta|omega|pi|Delta|mu|times|le|ge|neq|approx)|[A-Za-z]_[0-9A-Za-z]|\^[0-9]/.test(processed)) {
    return [<KatexInline key="auto-math" tex={processed.trim()} />];
  }

  return processed.split(/(\$(?!\$)[^$\n]+(?<!\$)\$|\\\([\s\S]*?\\\))/g).map((part, i) => {
    if (part.startsWith('$') && part.endsWith('$') && part.length > 2 && !part.startsWith('$$')) {
      return <KatexInline key={i} tex={part.slice(1, -1).trim()} />;
    }
    if (part.startsWith('\\(') && part.endsWith('\\)') && part.length > 3) {
      return <KatexInline key={i} tex={part.slice(2, -2).trim()} />;
    }
    return <React.Fragment key={i}>{renderFormattedText(part, i)}</React.Fragment>;
  });
}

function TextWithMath({ text }: { text: string }) {
  if (!text) return null;
  // Chuẩn hóa ký tự \n dạng chuỗi escape thành ký tự xuống dòng thực tế
  const normalized = text.replace(/\\n/g, '\n');
  const clean = normalized.replace(/\[\/?justify\]/gi, '');
  const rawLines = clean.split('\n');

  const elements: React.ReactNode[] = [];
  let inBlockMath = false;
  let blockMathBuffer: string[] = [];

  for (let idx = 0; idx < rawLines.length; idx++) {
    const line = rawLines[idx];
    const trimmed = line.trim();

    if (!trimmed) {
      if (!inBlockMath) {
        elements.push(<div key={`empty-${idx}`} className="h-2" />);
      }
      continue;
    }

    // Dòng chứa công thức độc lập $$...$$ (căn giữa 100%, đứng riêng một dòng)
    if (trimmed.startsWith('$$') && trimmed.endsWith('$$') && trimmed.length > 3) {
      const tex = trimmed.slice(2, -2).trim();
      elements.push(
        <div key={`bm-${idx}`} className="my-2.5 text-center overflow-x-auto">
          <KatexBlock tex={tex} />
        </div>
      );
      continue;
    }

    // Dòng chứa công thức độc lập \[...\]
    if (trimmed.startsWith('\\[') && trimmed.endsWith('\\]') && trimmed.length > 3) {
      const tex = trimmed.slice(2, -2).trim();
      elements.push(
        <div key={`bm-${idx}`} className="my-2.5 text-center overflow-x-auto">
          <KatexBlock tex={tex} />
        </div>
      );
      continue;
    }

    // Multi-line block math bắt đầu bằng $$
    if (trimmed.startsWith('$$')) {
      inBlockMath = true;
      blockMathBuffer = [trimmed.slice(2)];
      continue;
    }

    if (inBlockMath) {
      if (trimmed.endsWith('$$')) {
        blockMathBuffer.push(trimmed.slice(0, -2));
        const tex = blockMathBuffer.join('\n').trim();
        elements.push(
          <div key={`bmm-${idx}`} className="my-2.5 text-center overflow-x-auto">
            <KatexBlock tex={tex} />
          </div>
        );
        blockMathBuffer = [];
        inBlockMath = false;
      } else {
        blockMathBuffer.push(line);
      }
      continue;
    }

    // Thẻ [center]...[/center]
    if (trimmed.startsWith('[center]') && trimmed.endsWith('[/center]')) {
      const inner = trimmed.slice(8, -9);
      elements.push(
        <div key={`c-${idx}`} className="my-1 text-center">
          {renderInlineMath(inner)}
        </div>
      );
      continue;
    }

    // Dòng văn bản bình thường (tự động căn đều 2 bên mép, công thức $...$ nằm gọn gàng)
    elements.push(
      <div key={`t-${idx}`} style={{ textAlign: 'justify', textJustify: 'inter-word' }} className="leading-relaxed my-0.5">
        {renderInlineMath(line)}
      </div>
    );
  }

  return <div className="space-y-1">{elements}</div>;
}

// ─────────────────────────────────────────────────────────────
// STEP RENDERER (dùng chung cho cả hai loại)
// ─────────────────────────────────────────────────────────────
function StepRenderer({ step, index }: { step: Step; index: number }) {
  if (!step.title && !step.text && !step.formula && !step.formula2) return null;
  return (
    <div className="bg-white border border-[#E9E9E7] rounded-xl mb-4 overflow-hidden shadow-sm">
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[#E9E9E7] bg-[#FCFCFA]">
        <span className="font-mono text-[11px] font-bold bg-[#6B7CDB] text-white w-6 h-6 rounded-full flex items-center justify-center shrink-0">
          {index + 1}
        </span>
        {step.title && (
          <span className="text-[13px] font-semibold text-[#1A1A1A]"><TextWithMath text={step.title} /></span>
        )}
      </div>
      <div className="p-4 flex flex-col gap-3">
        {step.text    && (
          <p className="text-[17px] text-[#57564F] leading-relaxed m-0 whitespace-pre-wrap">
            <TextWithMath text={step.text} />
          </p>
        )}
        {step.formula  && <KatexBlock tex={step.formula} />}
        {step.formula2 && <KatexBlock tex={step.formula2} />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TỰ LUẬN RENDERER
// ─────────────────────────────────────────────────────────────
// ──────────────────────────────────────────────────────────────
// TRẮC NGHIỆM RENDERER
// ──────────────────────────────────────────────────────────────
const convertStepsToSolution = (steps?: Step[]): string => {
  if (!steps || steps.length === 0) return '';
  return steps
    .filter(s => s && (s.title || s.text || s.formula || s.formula2))
    .map(s => {
      const parts: string[] = [];
      if (s.title) parts.push(`**${s.title}**`);
      if (s.text) parts.push(s.text);
      if (s.formula) parts.push(`$$${s.formula}$$`);
      if (s.formula2) parts.push(`$$${s.formula2}$$`);
      return parts.join('\n');
    })
    .join('\n\n');
};

const detailPanel = 'min-w-0 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm';
const detailHeading = 'text-base font-bold text-stone-900';
const detailProse = 'min-w-0 overflow-x-auto whitespace-pre-wrap text-[17px] leading-relaxed text-stone-800 [overflow-wrap:anywhere]';

function SolutionPanel({ text }: { text: string }) {
  if (!text) return null;
  return (
    <section className={detailPanel}>
      <h3 className={detailHeading + ' border-b border-stone-100 bg-amber-50/60 px-4 py-2.5 sm:px-5'}>Lời giải chi tiết</h3>
      <div className={detailProse + ' px-4 py-4 sm:px-5'}>
        <TextWithMath text={text} />
      </div>
    </section>
  );
}

function VerdictBadge({ verdict }: { verdict?: boolean | null }) {
  return (
    <span className={'shrink-0 rounded-full px-2.5 py-1 text-xs font-bold '
      + (verdict === true ? 'bg-emerald-100 text-emerald-800' : verdict === false ? 'bg-red-100 text-red-800' : 'bg-stone-100 text-stone-600')}>
      {verdict === true ? 'Đúng' : verdict === false ? 'Sai' : 'Chưa kết luận'}
    </span>
  );
}

function AnswerRow({ label, badge, children }: { label: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[1.75rem_minmax(0,1fr)] items-start gap-x-2.5 gap-y-1 px-4 py-3 [@container_(min-width:28rem)]:grid-cols-[1.75rem_minmax(0,1fr)_auto] sm:px-5">
      <span className="grid size-7 place-items-center rounded-md bg-stone-100 text-sm font-bold text-stone-800">{label}</span>
      <div className={detailProse}>{children}</div>
      {badge && <div className="col-start-2 justify-self-start [@container_(min-width:28rem)]:col-start-3 [@container_(min-width:28rem)]:justify-self-end">{badge}</div>}
    </li>
  );
}

function TracNghiemRenderer({ question }: { question: Question }) {
  const choices = question.choices || [];

  return (
    <div className="space-y-4">
      <QuestionHeader question={question} />
      {choices.some(Boolean) && (
        <section className={detailPanel}>
          <h3 className={detailHeading + ' border-b border-stone-100 px-4 py-2.5 sm:px-5'}>Các phương án</h3>
          <ul className="divide-y divide-stone-100">
            {['A', 'B', 'C', 'D'].map((label, index) => choices[index] && (
              <AnswerRow key={label} label={label} badge={question.correctChoice === label ? <VerdictBadge verdict /> : undefined}>
                <TextWithMath text={choices[index]} />
              </AnswerRow>
            ))}
          </ul>
        </section>
      )}
      <SolutionPanel text={question.solution || convertStepsToSolution(question.solutionSteps)} />
    </div>
  );
}

function TuLuanRenderer({ question }: { question: Question }) {
  return (
    <div className="space-y-4">
      <QuestionHeader question={question} />
      <SolutionPanel text={question.solution || convertStepsToSolution(question.steps)} />
    </div>
  );
}

function DungSaiRenderer({ question }: { question: Question }) {
  const statements = question.statements.filter(statement => statement.claim || statement.claim_latex);
  const trueCount = question.statements.filter(statement => statement.verdict === true).length;
  const falseCount = question.statements.filter(statement => statement.verdict === false).length;

  // Older posts can store the explanation as steps under each statement.
  const effectiveSolution = question.solution || question.statements
    .map(statement => {
      const text = convertStepsToSolution(statement.steps);
      const badge = statement.verdict === true ? ' (ĐÚNG)' : statement.verdict === false ? ' (SAI)' : '';
      return text ? '**Mệnh đề ' + statement.label.toUpperCase() + badge + ':**\n' + text : '';
    })
    .filter(Boolean)
    .join('\n\n---\n\n');

  return (
    <div className="space-y-4">
      <QuestionHeader question={question} />
      {statements.length > 0 && (
        <section className={detailPanel}>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-stone-100 px-4 py-2.5 sm:px-5">
            <h3 className={detailHeading}>Các mệnh đề</h3>
            {trueCount + falseCount > 0 && (
              <div className="flex flex-wrap gap-1.5 text-xs font-semibold">
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-800">{trueCount} đúng</span>
                <span className="rounded-full bg-red-50 px-2.5 py-1 text-red-800">{falseCount} sai</span>
              </div>
            )}
          </div>
          <ul className="divide-y divide-stone-100">
            {statements.map((statement, index) => (
              <AnswerRow key={index} label={statement.label.toUpperCase()} badge={<VerdictBadge verdict={statement.verdict} />}>
                {statement.claim && <TextWithMath text={statement.claim} />}
                {statement.claim_latex && <KatexBlock tex={statement.claim_latex} />}
              </AnswerRow>
            ))}
          </ul>
        </section>
      )}
      <SolutionPanel text={effectiveSolution} />
    </div>
  );
}

function QuestionBody({ question, compact = false }: { question: Question; compact?: boolean }) {
  const hasImage = !!(question.image_svg || question.image_url || question.image_telegram_file_id);
  const parts = hasImage ? (question.question_text || '').split(/\[image\]/i) : [question.question_text];
  const inlineImage = parts.length > 1;
  const afterImage = parts.slice(1).join('[image]');
  const hasText = !!(question.question_text || question.question_latex);
  const sideImage = hasImage && hasText && !inlineImage && question.image_layout !== 'bottom';
  const imageWidth = question.image_width === undefined ? undefined : { width: question.image_width + '%' };
  const image = hasImage && (
    <figure className={'mx-auto flex w-full min-w-0 justify-center ' + (compact ? 'max-w-[11rem] ' : 'max-w-sm ')
      + (sideImage ? '[@container_(min-width:40rem)]:w-[38%] [@container_(min-width:40rem)]:shrink-0' : '')}>
      {question.image_svg ? (
        <div className={'max-w-full [&>svg]:block [&>svg]:h-auto [&>svg]:max-w-full' + (imageWidth ? ' [&>svg]:w-full' : '')}
          style={imageWidth}
          dangerouslySetInnerHTML={{ __html: question.image_svg }} />
      ) : (
        <img
          src={question.image_url || CLOUDFLARE_PROXY_URL + '/getFile/' + question.image_telegram_file_id}
          alt="Sơ đồ câu hỏi" className={'h-auto max-w-full ' + (compact ? 'max-h-36 object-contain' : '')}
          loading={compact ? 'lazy' : undefined} style={imageWidth}
        />
      )}
    </figure>
  );

  return (hasText || hasImage) ? (
    <div className={compact ? '' : 'border-t border-stone-100 px-4 py-4 sm:px-5'}>
      {inlineImage ? (
        <div className="space-y-3">
          {parts[0].trim() && <div className={detailProse}><TextWithMath text={parts[0]} /></div>}
          {image}
          {afterImage.trim() && <div className={detailProse}><TextWithMath text={afterImage} /></div>}
          {question.question_latex && <KatexBlock tex={question.question_latex} />}
        </div>
      ) : (
        <div className={'flex flex-col gap-4 ' + (sideImage ? '[@container_(min-width:40rem)]:flex-row [@container_(min-width:40rem)]:items-start' : '')}>
          {hasText && (
            <div className={detailProse + ' flex-1'}>
              {question.question_text && <TextWithMath text={question.question_text} />}
              {question.question_latex && <KatexBlock tex={question.question_latex} />}
            </div>
          )}
          {image}
        </div>
      )}
    </div>
  ) : null;
}

function QuestionHeader({ question }: { question: Question }) {
  const typeLabel = question.type === 'dung_sai' ? 'Đúng / Sai' : question.type === 'trac_nghiem' ? 'Trắc nghiệm' : 'Trả lời ngắn';
  return (
    <section className={detailPanel}>
      <div className="flex flex-wrap items-center gap-2 bg-stone-50 px-4 py-2.5 sm:px-5">
        <h2 className={detailHeading}>{question.question_no || 'Đề bài'}</h2>
        <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-950">{typeLabel}</span>
      </div>
      <QuestionBody question={question} />
    </section>
  );
}

export function SolutionQuestionPrompt({ content }: { content: string }) {
  const question = useMemo(() => parseContent(content)?.[0], [content]);
  if (!question) return null;
  const options = (question.type === 'trac_nghiem'
    ? (question.choices ?? []).slice(0, 4).map((text, index) => ({ label: ['A', 'B', 'C', 'D'][index], text, formula: '' }))
    : question.type === 'dung_sai'
      ? question.statements.map(statement => ({ label: statement.label, text: statement.claim, formula: statement.claim_latex }))
      : []).filter(option => option.text || option.formula);
  return (
    <div className="latex-prose space-y-3 [container-type:inline-size]">
      <QuestionBody question={question} compact />
      {options.length > 0 && <ul className="space-y-1.5">
        {options.map(({ label, text, formula }, index) => (
          <li key={index} className="grid grid-cols-[1.5rem_minmax(0,1fr)] items-start gap-2">
            <span className="rounded bg-stone-100 text-center text-sm font-bold text-stone-800">{label ?? index + 1}.</span>
            <div className={detailProse}>
              {text && <TextWithMath text={text} />}
              {formula && <KatexBlock tex={formula} />}
            </div>
          </li>
        ))}
      </ul>}
    </div>
  );
}

// MAIN EXPORT
// ─────────────────────────────────────────────────────────────
interface SolutionRendererProps {
  content: string;    // blog.content (JSON string)
  className?: string;
}

export default function SolutionRenderer({ content, className = "" }: SolutionRendererProps) {
  const questions = parseContent(content);

  if (!questions) {
    return (
      <div className={`p-8 text-center text-gray-400 ${className}`}>
        <p className="text-sm">Không thể tải nội dung bài giải.</p>
      </div>
    );
  }

  return <SolutionQuestions questions={questions} className={className} />;
}

export function SolutionQuestions({ questions, activeIndex, className = '' }: {
  questions: Question[];
  activeIndex?: number;
  className?: string;
}) {
  return (
    <div className={`solution-renderer latex-prose space-y-5 [container-type:inline-size] ${className}`}>
      {questions.map((q, idx) => (
        <div key={idx} className={(idx > 0 ? 'border-t border-stone-200 pt-5 ' : '')
          + (activeIndex !== undefined && idx !== activeIndex ? 'pointer-events-none opacity-40 grayscale' : '')}>
          {q.type === 'dung_sai'
            ? <DungSaiRenderer   question={q} />
            : q.type === 'trac_nghiem'
            ? <TracNghiemRenderer question={q} />
            : <TuLuanRenderer    question={q} />
          }
        </div>
      ))}
    </div>
  );
}
