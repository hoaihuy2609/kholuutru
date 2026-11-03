// SolutionEditor.tsx — v2 (Merge Tự Luận + Đúng/Sai)
// Tương thích ngược hoàn toàn với data cũ (không có `type`)

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import katex from "katex";
import "katex/dist/katex.min.css";
import { supabase } from "../src/lib/supabase";
import { useUIStore } from "../src/stores/useUIStore";
import { SolutionStep as Step, SolutionStatement as Statement } from '../types';
import {
  ChevronLeft, Save, Trash2, ArrowUp, ArrowDown,
  Plus, Eye, BookOpen, Layers, X, ToggleLeft, ToggleRight,
  Image as ImageIcon, Sparkles, RefreshCw, CheckCircle2, AlertCircle,
  FileCode, Download
} from 'lucide-react';
import { renderTikzToSvg, uploadSvgToTelegram } from "../src/services/tikzService";
import { CLOUDFLARE_PROXY_URL } from "../src/lib/telegram";

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
type QuestionType = 'tu_luan' | 'dung_sai' | 'trac_nghiem';

interface Question {
  questionNo: string;
  qText: string;
  qFormula: string;
  type: QuestionType;
  solution: string;        // Ô lời giải chi tiết duy nhất (hỗ trợ text & LaTeX)
  steps: Step[];           // backward compat
  statements: Statement[]; // dùng khi type === 'dung_sai'
  choices: string[];       // dùng khi type === 'trac_nghiem' (A/B/C/D)
  correctChoice: string;   // 'A' | 'B' | 'C' | 'D'
  solutionSteps: Step[];   // backward compat
  tikzCode?: string;       // Mã TikZ vẽ hình minh họa
  imageSvg?: string;       // Chuỗi SVG sau khi render
  imageUrl?: string;       // URL ảnh (nếu có)
  imageTelegramFileId?: string; // Telegram file_id
  imageLayout?: 'auto' | 'right' | 'bottom'; // Bố cục ảnh
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
const CATEGORIES = ['Lý thuyết', 'Mẹo giải bài', 'Kinh nghiệm', 'Tin tức', 'Đề cương', 'Khác'];
const STMT_LABELS: Array<'a' | 'b' | 'c' | 'd'> = ['a', 'b', 'c', 'd'];

const emptyStep = (): Step => ({ title: "", text: "", formula: "", formula2: "" });

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

const emptyStatement = (label: 'a' | 'b' | 'c' | 'd'): Statement => ({
  label,
  claim: "",
  claim_latex: "",
  verdict: null,
  steps: [emptyStep()],
});

const emptyQuestion = (): Question => ({
  questionNo: "",
  qText: "",
  qFormula: "",
  type: "tu_luan",
  solution: "",
  steps: [emptyStep()],
  statements: STMT_LABELS.map(emptyStatement),
  choices: ['', '', '', ''],
  correctChoice: '',
  solutionSteps: [emptyStep()],
  tikzCode: '',
  imageSvg: '',
  imageUrl: '',
  imageTelegramFileId: '',
  imageLayout: 'auto',
});

// Normalize question từ JSON (backward compat & new format)
const normalizeQuestion = (q: any): Question => {
  let sol = q.solution || "";
  if (!sol) {
    if (q.type === 'trac_nghiem' && q.solutionSteps?.length) {
      sol = convertStepsToSolution(q.solutionSteps);
    } else if (q.type === 'tu_luan' && q.steps?.length) {
      sol = convertStepsToSolution(q.steps);
    } else if (q.type === 'dung_sai' && Array.isArray(q.statements)) {
      const stmtSols = q.statements
        .map((st: any) => {
          const sText = convertStepsToSolution(st.steps);
          return sText ? `**Ý ${st.label?.toUpperCase() || ''}:**\n${sText}` : '';
        })
        .filter(Boolean)
        .join('\n\n');
      if (stmtSols) sol = stmtSols;
    }
  }

  // Chuẩn hóa loại câu hỏi
  let qType: QuestionType = 'tu_luan';
  const rawType = (q.type || '').toString().toLowerCase();
  if (rawType === 'dung_sai' || rawType === 'true_false') {
    qType = 'dung_sai';
  } else if (rawType === 'trac_nghiem' || rawType === 'multiple_choice' || (Array.isArray(q.choices) && q.choices.some((c: any) => Boolean(c)))) {
    qType = 'trac_nghiem';
  }

  // Chuẩn hóa 4 mệnh đề đúng sai
  const normalizedStatements: Statement[] = Array.isArray(q.statements) && q.statements.length > 0
    ? STMT_LABELS.map((lbl, idx) => {
        const st = q.statements[idx] || q.statements.find((s: any) => s.label?.toLowerCase() === lbl);
        if (!st) return emptyStatement(lbl);
        const v = st.verdict;
        let verdictVal: boolean | null = null;
        if (v === true || v === 'true' || v === 'Đúng' || v === 'dung' || v === 'D') verdictVal = true;
        else if (v === false || v === 'false' || v === 'Sai' || v === 'sai' || v === 'S') verdictVal = false;
        return {
          label: lbl,
          claim: st.claim || '',
          claim_latex: st.claim_latex || st.claimLatex || '',
          verdict: verdictVal,
          steps: Array.isArray(st.steps) && st.steps.length > 0 ? st.steps : [emptyStep()],
        };
      })
    : STMT_LABELS.map(emptyStatement);

  return {
    questionNo: q.question_no || q.questionNo || "",
    qText:      q.question_text || q.qText || "",
    qFormula:   q.question_latex || q.qFormula || "",
    type:       qType,
    solution:   sol,
    steps:      q.steps?.length > 0 ? q.steps : [emptyStep()],
    statements: normalizedStatements,
    choices: Array.isArray(q.choices) ? [0, 1, 2, 3].map(i => q.choices[i] !== undefined && q.choices[i] !== null ? String(q.choices[i]) : '') : ['', '', '', ''],
    correctChoice: (q.correctChoice || q.correct_choice || '').toString().trim().toUpperCase(),
    solutionSteps: q.solutionSteps?.length > 0 ? q.solutionSteps : [emptyStep()],
    tikzCode: q.tikz_code || q.tikzCode || '',
    imageSvg: q.image_svg || q.imageSvg || '',
    imageUrl: q.image_url || q.imageUrl || '',
    imageTelegramFileId: q.image_telegram_file_id || q.imageTelegramFileId || '',
    imageLayout: q.image_layout || q.imageLayout || 'auto',
  };
};

// Dữ liệu mẫu 3 câu thử nghiệm (có hình ảnh TikZ) trích từ đề Chuyên đề 1.1 Từ trường của dòng điện thẳng
const SAMPLE_PHYSICS_EXAM_JSON = JSON.stringify({
  exam_name: "Chuyên đề 1.1: Từ trường của dòng điện thẳng",
  questions: [
    {
      questionNo: "Câu 1",
      type: "trac_nghiem",
      qText: "Một dòng điện có cường độ $I = 5\\text{ A}$ chạy trong một dây dẫn thẳng, dài đặt trong không khí. Hai điểm $M, N$ nằm trong mặt phẳng vuông góc với dây dẫn và cùng cách dòng điện một khoảng $r = 4\\text{ cm} = 0{,}04\\text{ m}$ như hình vẽ. Cảm ứng từ tại điểm $M$ có độ lớn là:",
      choices: [
        "2{,}5 \\cdot 10^{-5}\\text{ T}",
        "1{,}5 \\cdot 10^{-5}\\text{ T}",
        "4{,}0 \\cdot 10^{-5}\\text{ T}",
        "2{,}0 \\cdot 10^{-5}\\text{ T}"
      ],
      correctChoice: "A",
      solution: "**Hướng dẫn giải chi tiết:**\n- Cảm ứng từ do dòng điện thẳng dài gây ra tại điểm cách dây một khoảng $r$ được tính bởi:\n$$B = 2 \\cdot 10^{-7} \\cdot \\frac{I}{r}$$\n- Thay số $I = 5\\text{ A}$ và $r = 0{,}04\\text{ m}$:\n$$B_M = 2 \\cdot 10^{-7} \\cdot \\frac{5}{0{,}04} = 2{,}5 \\cdot 10^{-5}\\text{ T}$$\n- Dùng quy tắc nắm bàn tay phải, ta xác định được phương chiều của $\\vec{B}$ tại $M$ và $N$.\n=> Chọn đáp án **A**.",
      tikzCode: "\\begin{tikzpicture}[scale=1]\n  \\draw[thick, fill=gray!20] (0,0) circle (0.25);\n  \\fill[black] (0,0) circle (0.08);\n  \\node[above] at (0,0.3) {$I$ (hướng ra)};\n  \\draw[dashed, gray] (-2.5,0) -- (2.5,0);\n  \\fill[blue] (-2,0) circle (0.06) node[below] {$M$};\n  \\fill[blue] (2,0) circle (0.06) node[below] {$N$};\n  \\draw[<->, >=stealth, red] (0,-0.4) -- (-2,-0.4) node[midway, below] {$r = 4\\text{ cm}$};\n  \\draw[<->, >=stealth, red] (0,-0.4) -- (2,-0.4) node[midway, below] {$r = 4\\text{ cm}$};\n  \\draw[->, >=stealth, ultra thick, blue] (-2,0) -- (-2,-1.2) node[left] {$\\vec{B}_M$};\n  \\draw[->, >=stealth, ultra thick, blue] (2,0) -- (2,1.2) node[right] {$\\vec{B}_N$};\n\\end{tikzpicture}",
      imageLayout: "right"
    },
    {
      questionNo: "Câu 6",
      type: "trac_nghiem",
      qText: "Trong mặt phẳng tọa độ $Oxy$ nằm ngang, ba dòng điện thẳng dài vô hạn cùng song song với trục $Oy$. Dòng $I_1 = I_2 = 10\\text{ A}$ chạy theo chiều dương của trục $Oy$, dòng $I_3 = 45\\text{ A}$ chạy theo chiều ngược lại như hình vẽ. Ba dây cắt trục $Ox$ lần lượt tại $x_1 = -4\\text{ cm}$, $x_2 = 0\\text{ cm}$, $x_3 = 4\\text{ cm}$. Điểm $M$ thuộc trục $Ox$ có hoành độ $x$ hữu hạn sao cho cảm ứng từ tổng hợp bằng không. Giá trị của $x$ là:",
      choices: [
        "-5\\text{ cm} \\text{ hoặc } 4\\text{ cm}",
        "-3\\text{ cm} \\text{ hoặc } 4{,}5\\text{ cm}",
        "+5\\text{ cm} \\text{ hoặc } -4\\text{ cm}",
        "+3\\text{ cm} \\text{ hoặc } -4{,}5\\text{ cm}"
      ],
      correctChoice: "A",
      solution: "**Hướng dẫn giải chi tiết:**\n- Cảm ứng từ tổng hợp tại $M$ do ba dòng điện gây ra:\n$$\\vec{B}_M = \\vec{B}_1 + \\vec{B}_2 + \\vec{B}_3 = \\vec{0}$$\n- Vì các dòng điện song song và vuông góc với mặt phẳng hình vẽ, vectơ cảm ứng từ do mỗi dòng gây ra tại các điểm trên trục $Ox$ đều vuông góc với $Ox$. Chiếu lên chiều quy ước theo quy tắc nắm tay phải:\n$$2\\cdot 10^{-7}\\left( \\frac{I_1}{x - x_1} + \\frac{I_2}{x - x_2} - \\frac{I_3}{x - x_3} \\right) = 0$$\n- Thay $I_1 = 10, I_2 = 10, I_3 = 45$ và $x_1 = -4, x_2 = 0, x_3 = 4$:\n$$\\frac{10}{x + 4} + \\frac{10}{x} - \\frac{45}{x - 4} = 0$$\n- Rút gọn phương trình bậc hai:\n$$5x^2 - 4x - 32 = 0 \\iff (x - 4)(5x + 8) = 0 \\quad \\text{hoặc quy đồng đầy đủ được } x = -5\\text{ cm}, x = 4\\text{ cm}$$\n=> Chọn đáp án **A**.",
      tikzCode: "\\begin{tikzpicture}[scale=0.9]\n  \\draw[->, thick] (-5.5,0) -- (5.5,0) node[right] {$x$ (cm)};\n  \\draw[->, thick] (0,-1.5) -- (0,2.5) node[above] {$y$};\n  \\fill[black] (-3,0) circle (0.15) node[above=2pt] {$I_1 (\\odot)$};\n  \\node[below] at (-3,0) {$-4$};\n  \\fill[black] (0,0) circle (0.15) node[above left] {$I_2 (\\odot)$};\n  \\node[below right] at (0,0) {$O$};\n  \\draw[thick] (3,0) circle (0.15);\n  \\draw[thick] (3-0.1, -0.1) -- (3+0.1, 0.1);\n  \\draw[thick] (3-0.1, 0.1) -- (3+0.1, -0.1);\n  \\node[above=2pt] at (3,0) {$I_3 (\\otimes)$};\n  \\node[below] at (3,0) {$+4$};\n  \\fill[red] (-4,0) circle (0.07) node[below=2pt, red] {$M$};\n\\end{tikzpicture}",
      imageLayout: "bottom"
    },
    {
      questionNo: "Câu 11",
      type: "trac_nghiem",
      qText: "Hai dòng điện thẳng dài đặt vuông góc với nhau, cách điện với nhau tại điểm bắt chéo, cùng nằm trong một mặt phẳng. Dòng $I_1$ đặt dọc theo trục $Ox$, dòng $I_2$ dọc theo trục $Oy$ sao cho $I_1 = 2I_2$. Chiều các dòng đó cùng chiều với các trục tọa độ như hình vẽ. Nếu điểm $M$ thuộc đường thẳng $y = ax$, có cảm ứng từ bằng 0 thì hệ số góc $a$ bằng:",
      choices: [
        "a = 2",
        "a = -2",
        "a = 1/2",
        "a = -1/2"
      ],
      correctChoice: "A",
      solution: "**Hướng dẫn giải chi tiết:**\n- Tại điểm $M(x, y)$:\n+ Khoảng cách từ $M$ đến dòng $I_1$ (trục $Ox$) là $d_1 = |y|$.\n+ Khoảng cách từ $M$ đến dòng $I_2$ (trục $Oy$) là $d_2 = |x|$.\n- Cảm ứng từ do từng dòng điện gây ra:\n$$B_1 = 2\\cdot 10^{-7} \\frac{I_1}{|y|}, \\quad B_2 = 2\\cdot 10^{-7} \\frac{I_2}{|x|}$$\n- Để cảm ứng từ tổng hợp $\\vec{B}_M = \\vec{B}_1 + \\vec{B}_2 = \\vec{0}$ thì:\n1. $\\vec{B}_1$ và $\\vec{B}_2$ phải ngược chiều: Áp dụng quy tắc nắm tay phải, các điểm ở góc phần tư I ($x > 0, y > 0$) và III ($x < 0, y < 0$) có $\\vec{B}_1$ và $\\vec{B}_2$ ngược chiều nhau $\\Rightarrow a = \\frac{y}{x} > 0$.\n2. $B_1 = B_2 \\iff \\frac{I_1}{|y|} = \\frac{I_2}{|x|} \\iff |y| = \\frac{I_1}{I_2} |x| = 2|x|$.\n- Vì $x$ và $y$ cùng dấu (góc phần tư I hoặc III), suy ra $y = 2x \\Rightarrow a = 2$.\n=> Chọn đáp án **A**.",
      tikzCode: "\\begin{tikzpicture}[scale=1]\n  \\draw[->, ultra thick, blue] (-2.5,0) -- (3,0) node[right] {$x$};\n  \\draw[->, ultra thick, red] (0,-2) -- (0,3) node[above] {$y$};\n  \\node[above right] at (1.5,0) {$I_1$};\n  \\node[above right] at (0,1.5) {$I_2$};\n  \\node[below left] at (0,0) {$O$};\n  \\draw[dashed, purple, thick] (-1.2,-2.4) -- (1.4,2.8) node[right] {$y = 2x$};\n  \\fill[purple] (1,2) circle (0.07) node[right] {$M(x, y)$};\n  \\draw[dotted, gray] (1,0) -- (1,2) -- (0,2);\n  \\node[below] at (1,0) {$x$};\n  \\node[left] at (0,2) {$y$};\n\\end{tikzpicture}",
      imageLayout: "right"
    }
  ]
}, null, 2);

// ── BATCH OPTION PARSERS (Dán nhanh 4 đáp án / 4 mệnh đề) ───
function parseMultipleChoiceBatch(raw: string): { choices: string[]; correctChoice?: string } {
  const text = raw.trim();
  if (!text) return { choices: ['', '', '', ''] };

  const regex = /(?:^|\s+)(?:\*?\s*\[?\(?([A-D])[\.\)\]]|\*([A-D])(?=[\.\)\s]))\s*/g;
  const matches: { label: string; isStar: boolean; index: number; matchLen: number }[] = [];
  let m;
  while ((m = regex.exec(text)) !== null) {
    const isStar = m[0].includes('*');
    const lbl = (m[2] || m[1]).toUpperCase();
    matches.push({ label: lbl, isStar, index: m.index, matchLen: m[0].length });
  }

  if (matches.length >= 2) {
    const result = ['', '', '', ''];
    let detectedCorrect = '';
    const labelIdx: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };

    for (let i = 0; i < matches.length; i++) {
      const cur = matches[i];
      const next = matches[i + 1];
      const start = cur.index + cur.matchLen;
      const end = next ? next.index : text.length;
      let part = text.substring(start, end).trim();

      if (cur.isStar || part.startsWith('*')) {
        detectedCorrect = cur.label;
        part = part.replace(/^\*\s*/, '').trim();
      }

      const idx = labelIdx[cur.label];
      if (idx !== undefined) {
        result[idx] = part;
      }
    }
    return { choices: result, correctChoice: detectedCorrect || undefined };
  }

  // Fallback nếu người dùng dán 4 dòng riêng biệt
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length >= 2) {
    const result = ['', '', '', ''];
    for (let i = 0; i < Math.min(lines.length, 4); i++) {
      result[i] = lines[i].replace(/^(?:\[?\(?[A-D0-9][\.\)\]]?|\*[A-D0-9][\.\)]?)\s*/i, '').trim();
    }
    return { choices: result };
  }

  return { choices: [text, '', '', ''] };
}

function parseStatementsBatch(raw: string, currentStatements: Statement[]): Statement[] {
  const text = raw.trim();
  if (!text) return currentStatements;

  const regex = /(?:^|\s+)\[?\(?([a-dA-D])[\.\)\]]\s*/g;
  const matches: { label: string; index: number; matchLen: number }[] = [];
  let m;
  while ((m = regex.exec(text)) !== null) {
    matches.push({ label: m[1].toLowerCase(), index: m.index, matchLen: m[0].length });
  }

  const labelMap: Record<string, number> = { a: 0, b: 1, c: 2, d: 3 };
  const newStmts = currentStatements.map(s => ({ ...s }));

  const extractVerdict = (content: string, currentVerdict: boolean | null): { text: string; verdict: boolean | null } => {
    let verdict = currentVerdict;
    let clean = content;
    if (/(?:[\(\[\-–—\s]\s*)?(?:Đúng|đúng|True|true)\s*[\)\]]?\s*$/i.test(clean)) {
      verdict = true;
      clean = clean.replace(/(?:[\(\[\-–—\s]\s*)?(?:Đúng|đúng|True|true)\s*[\)\]]?\s*$/i, '').trim();
    } else if (/(?:[\(\[\-–—\s]\s*)?(?:Sai|sai|False|false)\s*[\)\]]?\s*$/i.test(clean)) {
      verdict = false;
      clean = clean.replace(/(?:[\(\[\-–—\s]\s*)?(?:Sai|sai|False|false)\s*[\)\]]?\s*$/i, '').trim();
    }
    return { text: clean, verdict };
  };

  if (matches.length >= 2) {
    for (let i = 0; i < matches.length; i++) {
      const cur = matches[i];
      const next = matches[i + 1];
      const start = cur.index + cur.matchLen;
      const end = next ? next.index : text.length;
      const part = text.substring(start, end).trim();

      const idx = labelMap[cur.label];
      if (idx !== undefined && newStmts[idx]) {
        const { text: cleanText, verdict } = extractVerdict(part, newStmts[idx].verdict);
        newStmts[idx] = { ...newStmts[idx], claim: cleanText, verdict };
      }
    }
    return newStmts;
  }

  // Fallback 4 dòng riêng biệt
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length >= 2) {
    for (let i = 0; i < Math.min(lines.length, 4); i++) {
      const line = lines[i].replace(/^(?:\[?\(?[a-dA-D0-9][\.\)\]]|\*[a-dA-D0-9][\.\)]?)\s*/, '').trim();
      if (newStmts[i]) {
        const { text: cleanText, verdict } = extractVerdict(line, newStmts[i].verdict);
        newStmts[i] = { ...newStmts[i], claim: cleanText, verdict };
      }
    }
  }

  return newStmts;
}

// ─────────────────────────────────────────────────────────────
// SUB-COMPONENTS (KaTeX, TextWithMath, AutoResizeTextarea)
// ─────────────────────────────────────────────────────────────
function KatexSpan({ tex, block = false }: { tex: string; block?: boolean }) {
  const ref = useRef<HTMLDivElement | HTMLSpanElement>(null);
  useEffect(() => {
    if (!ref.current || !tex) return;
    try { katex.render(tex, ref.current as HTMLElement, { throwOnError: false, displayMode: block }); }
    catch (_) {}
  }, [tex, block]);
  return block
    ? <div ref={ref as React.RefObject<HTMLDivElement>} style={{ textAlign: "center", padding: "6px 0", overflowX: "auto" }} />
    : <span ref={ref as React.RefObject<HTMLSpanElement>} />;
}

const renderInlineMath = (text: string) =>
  text.split(/(\$(?!\$)[^$\n]+(?<!\$)\$|\\\([\s\S]*?\\\))/g).map((part, i) => {
    if (part.startsWith('$') && part.endsWith('$') && part.length > 2 && !part.startsWith('$$')) {
      return <KatexSpan key={i} tex={part.slice(1, -1).trim()} block={false} />;
    }
    if (part.startsWith('\\(') && part.endsWith('\\)') && part.length > 3) {
      return <KatexSpan key={i} tex={part.slice(2, -2).trim()} block={false} />;
    }
    return <span key={i}>{part}</span>;
  });

function TextWithMath({ text }: { text: string }) {
  if (!text) return null;
  const clean = text.replace(/\[\/?justify\]/gi, '');
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
          <KatexSpan tex={tex} block />
        </div>
      );
      continue;
    }

    // Dòng chứa công thức độc lập \[...\]
    if (trimmed.startsWith('\\[') && trimmed.endsWith('\\]') && trimmed.length > 3) {
      const tex = trimmed.slice(2, -2).trim();
      elements.push(
        <div key={`bm-${idx}`} className="my-2.5 text-center overflow-x-auto">
          <KatexSpan tex={tex} block />
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
            <KatexSpan tex={tex} block />
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


function AutoResizeTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (ref.current) { ref.current.style.height = "auto"; ref.current.style.height = ref.current.scrollHeight + "px"; }
  }, [props.value]);

  const wrapText = (open: string, close: string) => {
    if (!ref.current) return;
    const el = ref.current, s = el.selectionStart || 0, e = el.selectionEnd || 0;
    const next = el.value.slice(0, s) + open + el.value.slice(s, e) + close + el.value.slice(e);
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set?.call(el, next);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    setTimeout(() => { el.focus(); el.setSelectionRange(s + open.length, s + open.length + (e - s)); }, 0);
  };

  return (
    <textarea ref={ref} {...props}
      style={{ overflow: "hidden", resize: "none", ...props.style }}
      onKeyDown={e => {
        if ((e.ctrlKey || e.metaKey) && (e.key === 'e' || e.key === 'E')) { e.preventDefault(); wrapText('[center]', '[/center]'); }
        if ((e.ctrlKey || e.metaKey) && (e.key === 'j' || e.key === 'J')) { e.preventDefault(); wrapText('[justify]', '[/justify]'); }
        if (props.onKeyDown) props.onKeyDown(e);
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────
// STEP EDITOR
// ─────────────────────────────────────────────────────────────
function StepEditor({
  step, idx, total, compact = false,
  onChange, onRemove, onMove, onFocus
}: {
  step: Step; idx: number; total: number; compact?: boolean;
  onChange: (idx: number, key: string, val: string) => void;
  onRemove: (idx: number) => void;
  onMove: (idx: number, dir: number) => void;
  onFocus: (fieldId: string, el: any) => void;
}) {
  const prefix = compact ? 'text-xs' : 'text-sm';
  return (
    <div className="bg-white border border-[#E9E9E7] rounded-xl overflow-hidden shadow-sm transition-all focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-50">
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#FCFCFA] border-b border-[#E9E9E7]">
        <span className={`font-semibold ${prefix} text-indigo-700 flex items-center gap-2`}>
          <span className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold shrink-0">{idx + 1}</span>
          Bước {idx + 1}
        </span>
        <div className="flex items-center gap-1">
          <button className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded" onClick={() => onMove(idx, -1)}><ArrowUp className="w-3.5 h-3.5" /></button>
          <button className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded" onClick={() => onMove(idx, 1)}><ArrowDown className="w-3.5 h-3.5" /></button>
          {total > 1 && <button className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded ml-1" onClick={() => onRemove(idx)}><Trash2 className="w-3.5 h-3.5" /></button>}
        </div>
      </div>
      <div className="p-4 space-y-3">
        <div>
          <label className="block text-[10px] font-bold mb-1.5 text-[#787774] uppercase tracking-wider">Tiêu đề bước</label>
          <input className="w-full p-2 rounded-lg border border-[#E9E9E7] outline-none focus:border-indigo-500 text-sm transition-colors"
            placeholder="VD: Áp dụng định lý động năng"
            value={step.title} onChange={e => onChange(idx, "title", e.target.value)} />
        </div>
        <div>
          <label className="block text-[10px] font-bold mb-1.5 text-[#787774] uppercase tracking-wider">Giải thích</label>
          <AutoResizeTextarea rows={2}
            className="w-full p-2 rounded-lg border border-[#E9E9E7] outline-none focus:border-indigo-500 text-sm text-gray-700 transition-colors"
            placeholder="Mô tả cách làm..."
            value={step.text} onChange={e => onChange(idx, "text", e.target.value)} />
        </div>
        <div>
          <label className="block text-[10px] font-bold mb-1.5 text-[#787774] uppercase tracking-wider">Công thức 1 (LaTeX)</label>
          <AutoResizeTextarea rows={2}
            className="w-full p-2 rounded-lg border border-[#D3DBF9] outline-none focus:border-indigo-500 text-sm font-mono bg-[#EEF0FB] text-[#3D3D8D] transition-colors"
            placeholder="LaTeX..."
            value={step.formula} onChange={e => onChange(idx, "formula", e.target.value)}
            onFocus={e => onFocus(`step-f1-${idx}`, e.target)} />
        </div>
        <div>
          <label className="block text-[10px] font-bold mb-1.5 text-[#787774] uppercase tracking-wider">Công thức 2 (Tùy chọn)</label>
          <AutoResizeTextarea rows={2}
            className="w-full p-2 rounded-lg border border-[#D3DBF9] outline-none focus:border-indigo-500 text-sm font-mono bg-[#EEF0FB] text-[#3D3D8D] transition-colors"
            placeholder="LaTeX..."
            value={step.formula2} onChange={e => onChange(idx, "formula2", e.target.value)}
            onFocus={e => onFocus(`step-f2-${idx}`, e.target)} />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// STATEMENT EDITOR (một mệnh đề đúng/sai)
// ─────────────────────────────────────────────────────────────
function StatementEditor({
  st, si,
  onUpdate,
  onFocus,
}: {
  st: Statement; si: number;
  onUpdate: (si: number, val: Statement) => void;
  onFocus: (fieldId: string, el: any) => void;
}) {
  const verdictStyle = {
    true:  { btn: 'bg-emerald-50 border-emerald-400 text-emerald-700 font-bold', ring: 'ring-2 ring-emerald-200' },
    false: { btn: 'bg-red-50 border-red-400 text-red-700 font-bold',           ring: 'ring-2 ring-red-200'     },
    null:  { btn: 'bg-[#F7F6F3] border-[#E9E9E7] text-[#787774]',             ring: '' },
  };
  const curStyle = verdictStyle[String(st.verdict) as 'true' | 'false' | 'null'];

  return (
    <div className={`bg-white border rounded-xl overflow-hidden shadow-sm transition-all ${curStyle.ring} ${st.verdict === true ? 'border-emerald-300' : st.verdict === false ? 'border-red-300' : 'border-[#E9E9E7]'}`}>
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#FCFCFA] border-b border-[#E9E9E7]">
        <span className="font-bold text-sm text-indigo-700 tracking-wide flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-800">
            {st.label.toUpperCase()}
          </span>
          Mệnh đề {st.label.toUpperCase()}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#787774] font-semibold">Kết luận:</span>
          <button
            type="button"
            onClick={() => onUpdate(si, { ...st, verdict: st.verdict === true ? null : true })}
            className={`px-3 py-1 rounded-lg text-xs border transition-all ${st.verdict === true ? verdictStyle.true.btn : 'bg-[#F7F6F3] border-[#E9E9E7] text-[#787774] hover:border-emerald-300 hover:text-emerald-600'}`}
          >✓ Đúng</button>
          <button
            type="button"
            onClick={() => onUpdate(si, { ...st, verdict: st.verdict === false ? null : false })}
            className={`px-3 py-1 rounded-lg text-xs border transition-all ${st.verdict === false ? verdictStyle.false.btn : 'bg-[#F7F6F3] border-[#E9E9E7] text-[#787774] hover:border-red-300 hover:text-red-600'}`}
          >✗ Sai</button>
        </div>
      </div>
      <div className="p-3">
        <AutoResizeTextarea
          rows={2}
          className="w-full p-2.5 rounded-lg border border-[#E9E9E7] outline-none focus:border-indigo-500 text-sm text-gray-800 transition-colors"
          placeholder={`Nội dung mệnh đề ${st.label.toUpperCase()}... (hỗ trợ công thức $...$)`}
          value={st.claim}
          onChange={e => onUpdate(si, { ...st, claim: e.target.value })}
          onFocus={e => onFocus(`stmt-${si}`, e.target)}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// STEP PREVIEW (cho cả tự luận và bước chứng minh trong đúng/sai)
// ─────────────────────────────────────────────────────────────
function StepPreview({ step, index }: { step: Step; index: number }) {
  return (
    <div className="bg-white border border-[#E9E9E7] rounded-xl mb-3 overflow-hidden shadow-sm">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[#E9E9E7] bg-[#FCFCFA]">
        <span className="font-mono text-[11px] font-bold bg-[#6B7CDB] text-white w-5 h-5 rounded-full flex items-center justify-center shrink-0">{index + 1}</span>
        <span className="text-[12px] font-semibold text-[#1A1A1A]">{step.title ? <TextWithMath text={step.title} /> : <em className="text-[#AEACA8] font-normal">Chưa có tiêu đề</em>}</span>
      </div>
      <div className="p-3 flex flex-col gap-2">
        {step.text    && <p className="text-[13px] text-[#57564F] leading-relaxed m-0 whitespace-pre-wrap"><TextWithMath text={step.text} /></p>}
        {step.formula  && <KatexSpan tex={step.formula}  block />}
        {step.formula2 && <KatexSpan tex={step.formula2} block />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// STATEMENT PREVIEW (trong panel xem trước)
// ─────────────────────────────────────────────────────────────
function StatementPreview({ st }: { st: Statement }) {
  const verdictEl =
    st.verdict === true  ? <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300">✓ ĐÚNG</span> :
    st.verdict === false ? <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-700 border border-red-300">✗ SAI</span> :
                           <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 border border-gray-200">?</span>;

  const borderColor = st.verdict === true ? 'border-emerald-300' : st.verdict === false ? 'border-red-300' : 'border-[#E9E9E7]';

  return (
    <div className={`bg-white border rounded-xl mb-3 overflow-hidden shadow-sm ${borderColor}`}>
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#E9E9E7] bg-[#FCFCFA]">
        <span className="font-bold text-sm text-indigo-700">Mệnh đề {st.label.toUpperCase()}</span>
        {verdictEl}
      </div>
      <div className="p-3 text-[14px] text-[#1A1A1A] leading-relaxed">
        {st.claim && <TextWithMath text={st.claim} />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
interface SolutionEditorProps {
  blog?: any;
  saveBlog?: (blog: any) => Promise<any>;
  deleteBlog?: (id: string) => Promise<boolean>;
  syncBlogs?: () => Promise<any>;
  onSaved?: (blog: any) => void;
  onBack?: () => void;
  switchToMarkdown?: () => void;
  switchToExamPaper?: () => void;
  hideTopBar?: boolean;
}

export default function SolutionEditor({
  blog, saveBlog, deleteBlog, syncBlogs, onSaved, onBack, switchToMarkdown, switchToExamPaper, hideTopBar
}: SolutionEditorProps) {
  const [examName,   setExamName]   = useState("");
  const [questions,  setQuestions]  = useState<Question[]>([emptyQuestion()]);
  const [activeQIdx, setActiveQIdx] = useState(0);
  const [saving,     setSaving]     = useState(false);

  const [category,     setCategory]     = useState("");
  const [level,        setLevel]        = useState(0);
  const [isPublished,  setIsPublished]  = useState(false);
  const [grade,        setGrade]        = useState(0);

  // Local toast (dùng khi hideTopBar=true, vì global toast có thể không render trong context này)
  const [localToast, setLocalToast] = useState<{ msg: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const localToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeRef   = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);
  const activeField = useRef<string>("");
  const showGlobalToast = useUIStore(state => state.showToast);

  // Wrapper: hiển thị cả local toast (luôn) và global toast
  const showToast = (msg: string, type: 'success' | 'error' | 'warning' = 'success') => {
    showGlobalToast(msg, type);
    if (localToastTimer.current) clearTimeout(localToastTimer.current);
    setLocalToast({ msg, type });
    if (type !== 'warning') {
      localToastTimer.current = setTimeout(() => setLocalToast(null), 5000);
    }
  };

  const activeQuestion = questions[activeQIdx] ?? emptyQuestion();
  const [renderingTikz, setRenderingTikz] = useState(false);
  const [tikzError, setTikzError] = useState<string | null>(null);

  // Khung dán nhanh cả 4 đáp án / 4 mệnh đề
  const [quickBatchInput, setQuickBatchInput] = useState('');

  useEffect(() => {
    setQuickBatchInput('');
  }, [activeQIdx]);

  const handleBatchChoicesChange = (val: string) => {
    setQuickBatchInput(val);
    if (!val.trim()) return;
    const { choices: newChoices, correctChoice } = parseMultipleChoiceBatch(val);
    if (newChoices.filter(Boolean).length >= 2) {
      updateQ('choices', newChoices);
      if (correctChoice) {
        updateQ('correctChoice', correctChoice);
      }
    }
  };

  const handleBatchStatementsChange = (val: string) => {
    setQuickBatchInput(val);
    if (!val.trim()) return;
    const newStmts = parseStatementsBatch(val, activeQuestion.statements);
    if (newStmts.filter(s => s.claim).length >= 2) {
      updateQ('statements', newStmts);
    }
  };

  const handleRenderTikz = async () => {
    if (!activeQuestion.tikzCode?.trim()) {
      showToast("Vui lòng nhập mã TikZ trước khi bấm xem trước", "warning");
      return;
    }
    setRenderingTikz(true);
    setTikzError(null);
    try {
      const res = await renderTikzToSvg(activeQuestion.tikzCode);
      updateQ('imageSvg', res.svg);
      if (!activeQuestion.imageLayout || activeQuestion.imageLayout === 'auto') {
        updateQ('imageLayout', res.recommendedLayout);
      }
      showToast(`Đã vẽ hình thành công! Bố cục: ${res.recommendedLayout === 'right' ? 'Cột bên phải' : 'Ở dưới căn giữa'}`, 'success');
    } catch (err: any) {
      const msg = err.message || 'Lỗi khi biên dịch mã TikZ';
      setTikzError(msg);
      showToast(msg, 'error');
    } finally {
      setRenderingTikz(false);
    }
  };

  // ── Import Đề Thi Từ JSON ──────────────────────────────────
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [importingJson, setImportingJson] = useState(false);

  // Phân tích cú pháp JSON thời gian thực để báo trạng thái trên giao diện
  const parsedPreview = useMemo(() => {
    if (!jsonInput.trim()) return null;
    try {
      const parsed = JSON.parse(jsonInput);
      let list: any[] = [];
      if (Array.isArray(parsed)) {
        list = parsed;
      } else if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed.questions)) list = parsed.questions;
        else if (parsed.questionNo || parsed.qText || parsed.question_text) list = [parsed];
      }
      if (list.length === 0) return { error: 'Không tìm thấy câu hỏi trong JSON', count: 0, tikzCount: 0 };
      const tikzCount = list.filter(q => Boolean(q.tikzCode || q.tikz_code)).length;
      return { count: list.length, tikzCount, error: null };
    } catch {
      return { error: 'Cú pháp JSON chưa hợp lệ', count: 0, tikzCount: 0 };
    }
  }, [jsonInput]);

  const handleImportJson = async () => {
    if (!jsonInput.trim()) {
      showToast('Vui lòng dán nội dung JSON trước khi nạp!', 'warning');
      return;
    }

    setImportingJson(true);
    try {
      let parsed: any;
      try {
        parsed = JSON.parse(jsonInput);
      } catch {
        throw new Error('Định dạng JSON không hợp lệ! Vui lòng kiểm tra lại cú pháp hoặc dấu đóng mở ngoặc.');
      }

      let rawQuestions: any[] = [];
      let importedExamName = '';

      if (Array.isArray(parsed)) {
        rawQuestions = parsed;
      } else if (parsed && typeof parsed === 'object') {
        if (parsed.exam_name || parsed.examName || parsed.title) {
          importedExamName = parsed.exam_name || parsed.examName || parsed.title;
        }
        if (Array.isArray(parsed.questions)) {
          rawQuestions = parsed.questions;
        } else if (parsed.questionNo || parsed.qText || parsed.question_text) {
          rawQuestions = [parsed];
        } else {
          throw new Error('Không tìm thấy danh sách câu hỏi ("questions") trong đối tượng JSON.');
        }
      } else {
        throw new Error('Dữ liệu JSON không hợp lệ.');
      }

      if (rawQuestions.length === 0) {
        throw new Error('Danh sách câu hỏi trong JSON rỗng.');
      }

      const normalizedList: Question[] = rawQuestions.map(normalizeQuestion);

      // Tự động render TikZ sang SVG nếu có tikzCode mà chưa có imageSvg
      let renderedCount = 0;
      for (let i = 0; i < normalizedList.length; i++) {
        const q = normalizedList[i];
        if (q.tikzCode && !q.imageSvg) {
          try {
            const res = await renderTikzToSvg(q.tikzCode);
            q.imageSvg = res.svg;
            if (!q.imageLayout || q.imageLayout === 'auto') {
              q.imageLayout = res.recommendedLayout;
            }
            renderedCount++;
          } catch (tikzErr: any) {
            console.warn(`Không thể render TikZ cho câu ${q.questionNo || i + 1}:`, tikzErr?.message);
          }
        }
      }

      if (importedExamName) {
        setExamName(importedExamName);
      }

      setQuestions(normalizedList);
      setActiveQIdx(0);
      setShowJsonModal(false);

      const svgNote = renderedCount > 0 ? ` (đã sinh tự động ${renderedCount} hình vẽ vector SVG)` : '';
      showToast(`Đã nạp thành công ${normalizedList.length} câu hỏi vào trình soạn${svgNote}!`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi nhập dữ liệu JSON', 'error');
    } finally {
      setImportingJson(false);
    }
  };

  // ── Load data ──────────────────────────────────────────────
  useEffect(() => {
    if (!blog) return;
    setCategory(blog.category || "");
    setLevel(blog.level || 0);
    setIsPublished(!!blog.is_published);
    setGrade(blog.grade || 0);

    if (blog.content) {
      try {
        const parsed = JSON.parse(blog.content);
        if (parsed.type === 'physics_solution' && parsed.data) {
          setExamName(parsed.data.exam_name || "");

          if (parsed.data.questions?.length > 0) {
            setQuestions(parsed.data.questions.map(normalizeQuestion));
          } else {
            // Backward compat: bài cũ chỉ có một câu ở root-level
            setQuestions([normalizeQuestion(parsed.data)]);
          }
        }
      } catch (e) {
        console.error("Failed to parse physics solution data", e);
      }
    }
  }, [blog]);

  // ── Snippet insert ─────────────────────────────────────────
  const trackFocus = useCallback((fieldId: string, el: any) => {
    activeRef.current   = el;
    activeField.current = fieldId;
  }, []);

  const insertSnippet = useCallback((tex: string) => {
    const el = activeRef.current;
    if (!el) return;
    const s = el.selectionStart || 0, e = el.selectionEnd || 0;
    el.value = el.value.slice(0, s) + tex + el.value.slice(e);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.focus();
    el.setSelectionRange(s + tex.length, s + tex.length);
  }, []);

  // ── Question-level helpers ─────────────────────────────────
  const updateQ = (key: keyof Question, val: any) =>
    setQuestions(prev => prev.map((q, i) => i === activeQIdx ? { ...q, [key]: val } : q));

  const addQuestion = () => {
    setQuestions(prev => [...prev, emptyQuestion()]);
    setActiveQIdx(questions.length);
  };

  const removeQuestion = (idx: number) => {
    if (questions.length <= 1) return;
    if (!window.confirm("Bạn có chắc muốn xóa câu này?")) return;
    setQuestions(prev => prev.filter((_, i) => i !== idx));
    if (activeQIdx >= idx && activeQIdx > 0) setActiveQIdx(activeQIdx - 1);
  };

  // ── Steps (tự luận) ────────────────────────────────────────
  const updStep = (idx: number, key: string, val: string) =>
    updateQ('steps', activeQuestion.steps.map((s, i) => i === idx ? { ...s, [key]: val } : s));

  const addStep = () => updateQ('steps', [...activeQuestion.steps, emptyStep()]);

  const removeStep = (idx: number) =>
    updateQ('steps', activeQuestion.steps.filter((_, i) => i !== idx));

  const moveStep = (idx: number, dir: number) => {
    const arr = [...activeQuestion.steps], j = idx + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    updateQ('steps', arr);
  };

  // ── Statements (đúng/sai) ──────────────────────────────────
  const updStatement = (si: number, val: Statement) =>
    updateQ('statements', activeQuestion.statements.map((s, i) => i === si ? val : s));

  // ── Save ───────────────────────────────────────────────────
  const handleSave = async () => {
    if (!examName || questions.some(q => !q.questionNo)) {
      showToast("Vui lòng nhập tên đề và số câu cho tất cả các câu!", "error");
      return;
    }
    setSaving(true);
    try {
      // Upload SVG lên Telegram nếu chưa có file_id
      const processedQuestions = await Promise.all(questions.map(async (q, idx) => {
        let tId = q.imageTelegramFileId;
        if (q.imageSvg && !tId) {
          try {
            const uploadedId = await uploadSvgToTelegram(q.imageSvg, `diagram_${idx + 1}.svg`);
            if (uploadedId) tId = uploadedId;
          } catch (e) {
            console.warn('Upload Telegram SVG error:', e);
          }
        }
        return { ...q, imageTelegramFileId: tId };
      }));

      // Serialize mỗi câu hỏi tùy theo type
      const serializedQuestions = processedQuestions.map(q => ({
        question_no:    q.questionNo,
        question_text:  q.qText,
        question_latex: q.qFormula,
        type:           q.type,
        solution:       q.solution || '',
        tikz_code:      q.tikzCode || '',
        image_svg:      q.imageSvg || '',
        image_url:      q.imageUrl || '',
        image_telegram_file_id: q.imageTelegramFileId || '',
        image_layout:   q.imageLayout || 'auto',
        // Tự luận: lưu cả solution và steps tương thích
        steps:         q.type === 'tu_luan'    ? (q.solution ? [{ title: '', text: q.solution, formula: '', formula2: '' }] : q.steps) : [],
        // Đúng/sai: lưu statements
        statements:    q.type === 'dung_sai'   ? q.statements    : [],
        // Trắc nghiệm: lưu choices + correctChoice + solutionSteps
        choices:       q.type === 'trac_nghiem' ? q.choices       : [],
        correctChoice: q.type === 'trac_nghiem' ? q.correctChoice : '',
        solutionSteps: q.type === 'trac_nghiem' ? (q.solution ? [{ title: '', text: q.solution, formula: '', formula2: '' }] : q.solutionSteps) : [],
      }));

      const solutionData = {
        type: 'physics_solution',
        data: {
          exam_name: examName,
          questions: serializedQuestions,
          // Backward compat: giữ root-level của câu đầu
          question_no:    questions[0].questionNo,
          question_text:  questions[0].qText,
          question_latex: questions[0].qFormula,
          steps:          questions[0].type === 'tu_luan' ? questions[0].steps : [],
        }
      };

      const titleStr = questions.length === 1
        ? `[Giải chi tiết] ${examName} - ${questions[0].questionNo}`
        : `[Giải chi tiết] ${examName} (${questions.length} câu)`;

      const payload = {
        id: blog?.id,
        title: titleStr,
        summary: (questions[0].qText || '').substring(0, 150) || 'Hướng dẫn giải chi tiết bằng LaTeX.',
        content: JSON.stringify(solutionData),
        category: category || 'Lời giải',
        is_published: isPublished,
        tags: [],
        level,
        grade,
      };

      if (saveBlog) {
        const saved = await saveBlog(payload);
        if (saved) {
          showToast("Đã lưu bài viết! Đang đồng bộ...", "warning");
          if (syncBlogs) await syncBlogs();
          showToast("Đã lưu và đồng bộ thành công!", "success");
          if (onSaved) onSaved(saved);
        } else throw new Error("Lưu thất bại.");
      } else {
        const { error } = await supabase.from("solutions").insert(solutionData.data);
        if (error) throw error;
        showToast("Đã lưu (standalone mode)!", "success");
        setQuestions([emptyQuestion()]);
      }
    } catch (err: any) {
      showToast("Lỗi: " + err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  return (
    <div className={hideTopBar ? "space-y-6 font-sans" : "max-w-[1920px] w-full mx-auto p-4 md:p-8 space-y-6 animate-fade-in relative pb-20 font-sans"}>
      <style>{`.katex { color: #1A1A1A !important; }`}</style>

      {/* ── Top Bar ── (hidden when parent manages it) */}
      {!hideTopBar && (
      <div className="flex items-center justify-between flex-wrap gap-3">
        {onBack && (
          <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-medium text-[#787774] hover:text-indigo-600 transition-colors">
            <ChevronLeft className="w-4 h-4" /> Quay lại
          </button>
        )}
        <div className="flex items-center gap-3 bg-white p-1 rounded-xl border border-[#E9E9E7]">
          {switchToMarkdown && (
            <button onClick={switchToMarkdown} className="px-3 py-1.5 rounded-lg text-sm font-semibold text-[#787774] hover:bg-gray-50">Markdown</button>
          )}
          <button className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-[#EEF0FB] text-[#6B7CDB]">Lời Giải (LaTeX)</button>
          {switchToExamPaper && (
            <button onClick={switchToExamPaper} className="px-3 py-1.5 rounded-lg text-sm font-semibold text-[#787774] hover:bg-gray-50">Soạn Đề</button>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {blog && deleteBlog && (
            <button onClick={async () => {
              if (!window.confirm("Xóa bài viết này?")) return;
              setSaving(true);
              const ok = await deleteBlog(blog.id);
              setSaving(false);
              if (ok && onBack) onBack();
            }} disabled={saving} className="px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-red-50 text-red-600 transition-colors disabled:opacity-50">
              <Trash2 className="w-4 h-4" /> Xóa bài
            </button>
          )}
          <button onClick={handleSave} disabled={saving}
            className="px-6 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-60 shadow-sm">
            <Save className="w-4 h-4" />
            {saving ? 'Đang lưu...' : (blog ? 'Cập nhật' : 'Đăng bài')}
          </button>
        </div>
      </div>
      )}

      {/* ── Publish settings ── */}
      <div className="bg-white p-4 rounded-2xl border border-[#E9E9E7] shadow-sm flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6 relative z-10">
        <div className="flex items-center gap-3 shrink-0">
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" checked={isPublished} onChange={e => setIsPublished(e.target.checked)} />
            <div className="w-[34px] h-[20px] bg-[#CFCFCB] rounded-full peer peer-checked:after:translate-x-[14px] peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600" />
          </label>
          <span className="text-xs font-semibold" style={{ color: isPublished ? '#448361' : '#787774' }}>
            {isPublished ? '✓ Công khai' : '✎ Nháp'}
          </span>
        </div>
        <div className="hidden lg:block w-px h-6 bg-[#E9E9E7]" />
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-bold text-[#AEACA8] uppercase">Khối</span>
          <div className="flex bg-[#F7F6F3] p-1 rounded-lg border border-[#E9E9E7]">
            {[{ lab: 'Tất cả', val: 0 }, { lab: '12', val: 12 }, { lab: '11', val: 11 }, { lab: '10', val: 10 }].map(g => (
              <button key={g.val} type="button" onClick={() => setGrade(g.val)}
                className="px-3 py-1.5 text-xs font-semibold rounded-md transition-all"
                style={{ background: grade === g.val ? '#6B7CDB' : 'transparent', color: grade === g.val ? '#fff' : '#787774' }}>
                {g.lab}
              </button>
            ))}
          </div>
        </div>
        <div className="hidden lg:block w-px h-6 bg-[#E9E9E7]" />
        <div className="flex flex-col md:flex-row md:items-center gap-4 flex-1">
          <div className="flex items-center gap-2 flex-1">
            <span className="text-xs font-bold text-[#AEACA8] uppercase shrink-0">Chuyên mục</span>
            <input type="text" list="sol-cat-list" placeholder="Chọn hoặc nhập..."
              className="w-full p-2.5 rounded-lg border border-[#E9E9E7] outline-none focus:border-indigo-500 text-sm font-medium"
              value={category} onChange={e => setCategory(e.target.value)} />
            <datalist id="sol-cat-list">{CATEGORIES.map(c => <option key={c} value={c} />)}</datalist>
          </div>
          <div className="hidden md:block w-px h-6 bg-[#E9E9E7]" />
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-bold text-[#AEACA8] uppercase">Mức độ</span>
            <div className="flex bg-[#F7F6F3] p-1 rounded-lg border border-[#E9E9E7]">
              {[
                { val: 0, lab: '—', col: '#AEACA8' },
                { val: 1, lab: 'Mức 1', col: '#448361' },
                { val: 2, lab: 'Mức 2', col: '#6B7CDB' },
                { val: 3, lab: 'Mức 3', col: '#D9730D' },
                { val: 4, lab: 'Mức 4', col: '#9065B0' },
              ].map(m => (
                <button key={m.val} type="button" onClick={() => setLevel(m.val)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-md transition-all"
                  style={{ background: level === m.val ? m.col : 'transparent', color: level === m.val ? '#fff' : '#787774' }}>
                  {m.lab}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">

        {/* ════════ EDITOR ════════ */}
        <div className="xl:col-span-6 flex flex-col gap-6">

          {/* Thông tin đề + Tabs câu */}
          <div className="p-6 rounded-2xl bg-white border border-[#E9E9E7] shadow-sm space-y-5">
            <h3 className="font-semibold text-[#1A1A1A] flex items-center gap-2 text-lg">
              <BookOpen className="w-5 h-5 text-indigo-500" /> Thông tin đề thi
            </h3>
            <div>
              <label className="block text-sm font-semibold mb-2 text-[#1A1A1A]">Tên đề thi / Nguồn</label>
              <input className="w-full p-3 rounded-lg border border-[#E9E9E7] outline-none focus:border-indigo-500 text-sm transition-colors"
                placeholder="VD: THPT QG 2024"
                value={examName} onChange={e => setExamName(e.target.value)} />
            </div>

            {/* Tabs */}
            <div className="pt-2 border-t border-[#E9E9E7]">
              <div className="flex items-center flex-wrap gap-2 mb-4">
                {questions.map((q, idx) => (
                  <button key={idx} onClick={() => setActiveQIdx(idx)}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${activeQIdx === idx ? 'bg-indigo-600 text-white shadow-sm' : 'bg-[#F7F6F3] text-[#787774] border border-[#E9E9E7] hover:bg-white'}`}>
                    {q.questionNo || `Câu ${idx + 1}`}
                    {/* Badge loại bài */}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${activeQIdx === idx ? 'bg-indigo-500 text-indigo-100' : 'bg-gray-200 text-gray-500'}`}>
                      {q.type === 'dung_sai' ? 'Đ/S' : q.type === 'trac_nghiem' ? 'TN' : 'TL'}
                    </span>
                    {questions.length > 1 && (
                      <span onClick={e => { e.stopPropagation(); removeQuestion(idx); }}
                        className={`w-5 h-5 rounded-full flex items-center justify-center -mr-1 ${activeQIdx === idx ? 'hover:bg-indigo-700 text-indigo-100' : 'hover:bg-red-100 text-red-400'}`}>
                        <X className="w-3 h-3" />
                      </span>
                    )}
                  </button>
                ))}
                <button onClick={addQuestion}
                  className="px-3 py-2 rounded-lg text-sm font-semibold border-2 border-dashed border-[#DCDCDA] text-[#787774] hover:border-indigo-400 hover:text-indigo-600 transition-all flex items-center gap-1">
                  <Plus className="w-4 h-4" /> Thêm câu
                </button>
                <button
                  type="button"
                  onClick={() => setShowJsonModal(true)}
                  className="px-3 py-2 rounded-lg text-sm font-semibold border border-[#E9E9E7] bg-white text-[#37352F] hover:bg-[#F7F6F3] hover:border-[#DCDCDA] transition-all flex items-center gap-1.5 shadow-sm"
                  title="Nạp toàn bộ đề thi từ JSON (hỗ trợ trắc nghiệm, đúng sai, trả lời ngắn và tự động vẽ TikZ)"
                >
                  <FileCode className="w-4 h-4 text-indigo-600" /> Nhập từ JSON
                </button>
              </div>

              {/* Info câu đang active */}
              <div className="space-y-4">
                {/* Loại câu hỏi — 3 nút */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#F7F6F3] border border-[#E9E9E7]">
                  <span className="text-sm font-semibold text-[#57564F]">Loại câu hỏi</span>
                  <div className="flex gap-1.5">
                    {([
                      { val: 'tu_luan'     as QuestionType, label: 'Trả lời ngắn', bg: '#6B7CDB', ring: '#EEF0FB' },
                      { val: 'dung_sai'    as QuestionType, label: 'Đúng / Sai',   bg: '#D9730D', ring: '#FFF3E8' },
                      { val: 'trac_nghiem' as QuestionType, label: 'Trắc nghiệm', bg: '#448361', ring: '#EAF3EE' },
                    ] as const).map(opt => (
                      <button key={opt.val}
                        onClick={() => updateQ('type', opt.val)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all border"
                        style={{
                          background: activeQuestion.type === opt.val ? opt.bg : '#fff',
                          color:      activeQuestion.type === opt.val ? '#fff' : '#787774',
                          borderColor: activeQuestion.type === opt.val ? opt.bg : '#E9E9E7',
                        }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2 text-[#1A1A1A]">Số bài / Số câu</label>
                  <input className="w-full p-3 rounded-lg border border-[#E9E9E7] outline-none focus:border-indigo-500 text-sm transition-colors"
                    placeholder="VD: Câu 4"
                    value={activeQuestion.questionNo} onChange={e => updateQ('questionNo', e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2 text-[#1A1A1A]">Mô tả đề bài (Text)</label>
                  <AutoResizeTextarea rows={2}
                    className="w-full p-3 rounded-lg border border-[#E9E9E7] outline-none focus:border-indigo-500 text-sm text-gray-700 transition-colors"
                    placeholder={activeQuestion.type === 'dung_sai'
                      ? "VD: Trong ống tia điện tử, người ta tạo ra chùm tia electron nhờ điện áp U = 2,70 kV..."
                      : "Một vật dao động điều hòa..."}
                    value={activeQuestion.qText} onChange={e => updateQ('qText', e.target.value)} />
                </div>

                {/* ── Khung vẽ hình TikZ / LaTeX tinh gọn, tối giản ── */}
                <div className="p-3.5 rounded-xl border border-[#E9E9E7] bg-white space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[#1A1A1A]">Hình vẽ minh họa (TikZ)</span>
                      <span className="text-[11px] text-[#787774] font-normal">(tùy chọn)</span>
                    </div>
                    {activeQuestion.imageSvg && (
                      <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Đã có hình
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-[#787774] leading-relaxed">
                    Dán mã TikZ để tự động vẽ hình. Gõ <code className="bg-[#F1F0EC] text-[#1A1A1A] px-1 py-0.5 rounded font-mono font-medium">[image]</code> vào đề bài nếu muốn chèn giữa các đoạn.
                  </p>

                  <AutoResizeTextarea
                    rows={3}
                    className="w-full p-2.5 rounded-lg border border-[#E9E9E7] bg-[#FAFAFA] focus:bg-white outline-none focus:border-[#1A1A1A] text-xs font-mono text-gray-800 transition-colors"
                    placeholder={`VD:\n\\begin{tikzpicture}\n  \\draw[thick, ->] (0,0) -- (3,0) node[right] {$x$};\n  \\draw[thick, ->] (0,0) -- (0,3) node[above] {$y$};\n  \\draw[red, thick] (0,0) circle (1.2);\n\\end{tikzpicture}`}
                    value={activeQuestion.tikzCode || ''}
                    onChange={e => updateQ('tikzCode', e.target.value)}
                    onFocus={e => trackFocus(`q-tikz-${activeQIdx}`, e.target)}
                  />

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-0.5">
                    <button
                      type="button"
                      onClick={handleRenderTikz}
                      disabled={renderingTikz || !activeQuestion.tikzCode?.trim()}
                      className={`inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        renderingTikz || !activeQuestion.tikzCode?.trim()
                          ? 'bg-[#F1F0EC] text-[#AEACA8] cursor-not-allowed border border-[#E2E1DD]'
                          : 'bg-[#1A1A1A] hover:bg-[#333] text-white cursor-pointer active:scale-95 shadow-sm'
                      }`}
                    >
                      {renderingTikz ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin mr-1.5" /> Đang vẽ hình...
                        </>
                      ) : (
                        'Xem trước hình vẽ'
                      )}
                    </button>

                    {activeQuestion.imageSvg && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-[#787774] text-[11px]">Bố cục:</span>
                        {(['auto', 'right', 'bottom'] as const).map(l => (
                          <button
                            key={l}
                            type="button"
                            onClick={() => updateQ('imageLayout', l)}
                            className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-all ${
                              (activeQuestion.imageLayout || 'auto') === l
                                ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]'
                                : 'bg-white text-[#57564F] border-[#E9E9E7] hover:bg-[#F7F6F3]'
                            }`}
                          >
                            {l === 'auto' ? 'Tự động' : l === 'right' ? 'Cột phải' : 'Ở dưới'}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => { updateQ('imageSvg', ''); updateQ('tikzCode', ''); }}
                          className="ml-2 text-[11px] text-rose-500 hover:underline"
                        >
                          Xóa hình
                        </button>
                      </div>
                    )}
                  </div>

                  {tikzError && (
                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{tikzError}</span>
                    </div>
                  )}

                  {/* Ảnh render tức thì ngay trong ô nhập */}
                  {activeQuestion.imageSvg && (
                    <div className="mt-3 p-3 bg-white border border-indigo-200 rounded-lg flex flex-col items-center shadow-sm">
                      <div className="text-[11px] text-indigo-600 font-semibold mb-2 flex items-center gap-1.5 self-start">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Ảnh vector SVG đã sẵn sàng:
                      </div>
                      <div
                        className="max-w-full overflow-x-auto flex justify-center [&>svg]:max-w-full [&>svg]:h-auto"
                        dangerouslySetInnerHTML={{ __html: activeQuestion.imageSvg }}
                      />
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>

          {/* ── TỰ LUẬN: Lời giải chi tiết (1 ô duy nhất) ── */}
          {activeQuestion.type === 'tu_luan' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-[#1A1A1A] flex items-center gap-2 text-lg">
                  <Layers className="w-5 h-5 text-indigo-500" /> Lời giải chi tiết — {activeQuestion.questionNo || `Câu ${activeQIdx + 1}`}
                </h3>
                <span className="text-xs text-[#787774]">Tự động căn đều & nhận diện Text + LaTeX ($...$, $$...$$)</span>
              </div>
              <div className="bg-white border border-[#E9E9E7] rounded-xl p-3 shadow-sm focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-50 transition-all">
                <AutoResizeTextarea
                  rows={8}
                  className="w-full p-2 outline-none text-sm text-gray-800 font-sans leading-relaxed"
                  style={{ minHeight: '160px' }}
                  placeholder="Nhập hoặc dán toàn bộ lời giải vào đây (hỗ trợ văn bản thường và công thức toán $E = mc^2$, $$\int f(x)dx$$)... Tự động căn đều 2 bên mép!"
                  value={activeQuestion.solution}
                  onChange={e => updateQ('solution', e.target.value)}
                  onFocus={e => trackFocus(`q-sol-${activeQIdx}`, e.target)}
                />
              </div>
            </div>
          )}

          {/* ── ĐÚNG/SAI: 4 mệnh đề riêng + 1 ô giải chung ── */}
          {activeQuestion.type === 'dung_sai' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-[#1A1A1A] flex items-center gap-2 text-lg">
                <Layers className="w-5 h-5 text-amber-500" /> 4 Mệnh đề Đúng / Sai — {activeQuestion.questionNo || `Câu ${activeQIdx + 1}`}
              </h3>

              {/* Khung dán nhanh 4 mệnh đề */}
              <div className="bg-[#FAF9F6] border border-[#E9E9E7] rounded-xl p-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-[#787774]">
                  <span className="font-semibold text-[#1A1A1A]">Dán nhanh 4 mệnh đề (a, b, c, d)</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[#9B9A97]">Tự động phân bổ xuống 4 ô bên dưới</span>
                    {quickBatchInput && (
                      <button
                        type="button"
                        onClick={() => setQuickBatchInput('')}
                        className="text-[11px] text-[#787774] hover:text-[#1A1A1A] underline"
                      >
                        Xóa
                      </button>
                    )}
                  </div>
                </div>
                <textarea
                  rows={5}
                  style={{ minHeight: '125px' }}
                  className="w-full p-3 bg-white rounded-lg border border-[#E9E9E7] text-sm text-[#1A1A1A] placeholder:text-[#9B9A97] outline-none focus:border-[#1A1A1A] transition-colors resize-y leading-relaxed font-sans"
                  placeholder="Dán cụm 4 mệnh đề vào đây (VD: a) ... b) ... c) ... d) hoặc 4 dòng riêng). Chữ sẽ tự động nhảy vào từng ô bên dưới."
                  value={quickBatchInput}
                  onChange={e => handleBatchStatementsChange(e.target.value)}
                />
              </div>

              <div className="space-y-3">
                {activeQuestion.statements.map((st, si) => (
                  <StatementEditor key={si} st={st} si={si} onUpdate={updStatement} onFocus={trackFocus} />
                ))}
              </div>

              {/* 1 ô giải chung cho Đúng/Sai */}
              <div className="pt-3 border-t border-[#E9E9E7] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-[#787774] uppercase tracking-wider">
                    Hướng dẫn giải chi tiết (chung cho 4 mệnh đề)
                  </div>
                  <span className="text-xs text-[#787774]">Hỗ trợ Text & LaTeX ($...$, $$...$$)</span>
                </div>
                <div className="bg-white border border-[#E9E9E7] rounded-xl p-3 shadow-sm focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-50 transition-all">
                  <AutoResizeTextarea
                    rows={8}
                    className="w-full p-2 outline-none text-sm text-gray-800 font-sans leading-relaxed"
                    style={{ minHeight: '160px' }}
                    placeholder="Nhập hoặc dán lời giải / lý giải cho các mệnh đề a, b, c, d vào đây... Tự động căn đều và render LaTeX!"
                    value={activeQuestion.solution}
                    onChange={e => updateQ('solution', e.target.value)}
                    onFocus={e => trackFocus(`q-sol-${activeQIdx}`, e.target)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── TRẮC NGHIỆM: 4 đáp án + 1 ô giải chi tiết ── */}
          {activeQuestion.type === 'trac_nghiem' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-[#1A1A1A] flex items-center gap-2 text-lg">
                <Layers className="w-5 h-5 text-emerald-500" /> 4 Phương án lựa chọn — {activeQuestion.questionNo || `Câu ${activeQIdx + 1}`}
              </h3>

              {/* Khung dán nhanh 4 đáp án */}
              <div className="bg-[#FAF9F6] border border-[#E9E9E7] rounded-xl p-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-[#787774]">
                  <span className="font-semibold text-[#1A1A1A]">Dán nhanh 4 đáp án (A, B, C, D)</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[#9B9A97]">Tự động phân bổ xuống 4 ô bên dưới</span>
                    {quickBatchInput && (
                      <button
                        type="button"
                        onClick={() => setQuickBatchInput('')}
                        className="text-[11px] text-[#787774] hover:text-[#1A1A1A] underline"
                      >
                        Xóa
                      </button>
                    )}
                  </div>
                </div>
                <textarea
                  rows={5}
                  style={{ minHeight: '125px' }}
                  className="w-full p-3 bg-white rounded-lg border border-[#E9E9E7] text-sm text-[#1A1A1A] placeholder:text-[#9B9A97] outline-none focus:border-[#1A1A1A] transition-colors resize-y leading-relaxed font-sans"
                  placeholder="Dán cụm 4 đáp án vào đây (VD: A. ... B. ... C. ... D. hoặc 4 dòng riêng). Chữ sẽ tự động nhảy vào từng ô bên dưới."
                  value={quickBatchInput}
                  onChange={e => handleBatchChoicesChange(e.target.value)}
                />
              </div>

              {/* 4 lựa chọn A/B/C/D */}
              <div className="space-y-2">
                {['A', 'B', 'C', 'D'].map((lbl, ci) => (
                  <div key={lbl} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateQ('correctChoice', activeQuestion.correctChoice === lbl ? '' : lbl)}
                      className="w-8 h-8 rounded-full text-sm font-bold shrink-0 border-2 transition-all"
                      style={{
                        background: activeQuestion.correctChoice === lbl ? '#448361' : '#fff',
                        color: activeQuestion.correctChoice === lbl ? '#fff' : '#787774',
                        borderColor: activeQuestion.correctChoice === lbl ? '#448361' : '#E9E9E7',
                      }}
                    >{lbl}</button>
                    <input
                      className="flex-1 p-2.5 rounded-lg border outline-none focus:border-emerald-400 text-sm transition-colors"
                      style={{ borderColor: activeQuestion.correctChoice === lbl ? '#44836150' : '#E9E9E7', background: activeQuestion.correctChoice === lbl ? '#EAF3EE' : '#fff' }}
                      placeholder={`Đáp án ${lbl}... (hỗ trợ gõ $...$ công thức)`}
                      value={activeQuestion.choices[ci] || ''}
                      onChange={e => { const c = [...activeQuestion.choices]; c[ci] = e.target.value; updateQ('choices', c); }}
                    />
                  </div>
                ))}
              </div>

              {/* 1 ô giải chi tiết cho Trắc nghiệm */}
              <div className="pt-3 border-t border-[#E9E9E7] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-[#787774] uppercase tracking-wider">Lời giải chi tiết</div>
                  <span className="text-xs text-[#787774]">Hỗ trợ Text & LaTeX ($...$, $$...$$)</span>
                </div>
                <div className="bg-white border border-[#E9E9E7] rounded-xl p-3 shadow-sm focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-50 transition-all">
                  <AutoResizeTextarea
                    rows={8}
                    className="w-full p-2 outline-none text-sm text-gray-800 font-sans leading-relaxed"
                    style={{ minHeight: '160px' }}
                    placeholder="Nhập hoặc dán toàn bộ lời giải chi tiết của câu trắc nghiệm vào đây... Tự động căn đều và render LaTeX!"
                    value={activeQuestion.solution}
                    onChange={e => updateQ('solution', e.target.value)}
                    onFocus={e => trackFocus(`q-sol-${activeQIdx}`, e.target)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ════════ PREVIEW ════════ */}
        <div className="xl:col-span-6 h-[calc(100vh-200px)] sticky top-20">
          <div className="h-full border border-[#E9E9E7] rounded-2xl bg-white shadow-sm flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E9E9E7] flex justify-between items-center bg-[#FCFCFA] shrink-0">
              <h3 className="font-semibold text-[#1A1A1A] flex items-center gap-2">
                <Eye className="w-4 h-4 text-indigo-500" /> Xem trước kết quả
              </h3>
            </div>
            <div className="p-6 overflow-y-auto flex-1 bg-[#F7F6F3]" style={{ fontFamily: "'KaTeX_Main', 'Computer Modern', serif" }}>
              <style>{`.solution-editor-preview, .solution-editor-preview *:not(svg):not(svg *) { font-family: 'KaTeX_Main', 'Computer Modern', serif !important; } .solution-editor-preview .font-mono { font-family: monospace !important; }`}</style>
              <div className="solution-editor-preview space-y-12">
                {questions.map((q, qIdx) => (
                  <div key={qIdx} className={`space-y-5 ${qIdx !== activeQIdx ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                    {(examName || q.questionNo || q.qText || q.qFormula || q.imageSvg || q.tikzCode) && (
                      <div>
                        {examName && <div className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-1.5">{examName}</div>}
                        <div className="font-bold text-2xl text-indigo-900 mb-1">{q.questionNo || `Câu ${qIdx + 1}`}</div>
                        {/* Badge loại bài */}
                        <span className={`inline-block text-xs font-bold px-2.5 py-0.5 rounded-full mb-3 ${q.type === 'dung_sai' ? 'bg-amber-100 text-amber-700 border border-amber-300' : q.type === 'trac_nghiem' ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' : 'bg-indigo-100 text-indigo-700 border border-indigo-200'}`}>
                          {q.type === 'dung_sai' ? 'Đúng / Sai' : q.type === 'trac_nghiem' ? 'Trắc nghiệm' : 'Trả lời ngắn'}
                        </span>
                        <div className="bg-white border-l-[3px] border-indigo-400 rounded-r-xl p-5 shadow-sm">
                          {(() => {
                            const hasImg = !!(q.imageSvg || q.imageUrl || q.imageTelegramFileId);
                            const isRight = (q.imageLayout === 'right') || (q.imageLayout === 'auto');

                            const imageElem = hasImg ? (
                              <div className="w-full flex justify-center items-center py-1 px-2 bg-transparent overflow-x-auto">
                                {q.imageSvg ? (
                                  <div
                                    className="max-w-full flex justify-center [&>svg]:max-w-full [&>svg]:h-auto"
                                    dangerouslySetInnerHTML={{ __html: q.imageSvg }}
                                  />
                                ) : q.imageUrl ? (
                                  <img src={q.imageUrl} alt="Sơ đồ" className="max-w-full h-auto" />
                                ) : q.imageTelegramFileId ? (
                                  <img src={`${CLOUDFLARE_PROXY_URL}/getFile/${q.imageTelegramFileId}`} alt="Sơ đồ" className="max-w-full h-auto" />
                                ) : null}
                              </div>
                            ) : null;

                            const hasImagePlaceholder = hasImg && /\[image\]/i.test(q.qText || '');

                            if (hasImagePlaceholder) {
                              const parts = (q.qText || '').split(/\[image\]/i);
                              const beforeText = parts[0] || '';
                              const afterText = parts.slice(1).join('[image]') || '';
                              return (
                                <div>
                                  {beforeText.trim() && <p className="text-[14px] text-gray-700 leading-relaxed mb-3 whitespace-pre-wrap"><TextWithMath text={beforeText} /></p>}
                                  <div className="my-4">{imageElem}</div>
                                  {afterText.trim() && <p className="text-[14px] text-gray-700 leading-relaxed mb-3 whitespace-pre-wrap"><TextWithMath text={afterText} /></p>}
                                  {q.qFormula && <KatexSpan tex={q.qFormula} block />}
                                </div>
                              );
                            }

                            if (hasImg && isRight && (q.qText || q.qFormula)) {
                              return (
                                <div className="flex flex-col md:flex-row gap-5 items-start">
                                  <div className="flex-1 min-w-0">
                                    {q.qText && <p className="text-[14px] text-gray-700 leading-relaxed mb-3 whitespace-pre-wrap"><TextWithMath text={q.qText} /></p>}
                                    {q.qFormula && <KatexSpan tex={q.qFormula} block />}
                                  </div>
                                  <div className="w-full md:w-[42%] max-w-[340px] shrink-0">
                                    {imageElem}
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <div>
                                {q.qText && <p className="text-[14px] text-gray-700 leading-relaxed mb-3 whitespace-pre-wrap"><TextWithMath text={q.qText} /></p>}
                                {q.qFormula && <KatexSpan tex={q.qFormula} block />}
                                {hasImg && <div className={q.qText || q.qFormula ? "mt-4" : ""}>{imageElem}</div>}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    )}

                    {/* Preview tự luận */}
                    {q.type === 'tu_luan' && (q.solution || q.steps?.some((s: Step) => s.title || s.formula || s.text)) && (
                      <div>
                        <div className="text-[10px] font-mono text-[#AEACA8] uppercase tracking-[0.15em] flex items-center gap-3 mb-3">
                          Lời giải chi tiết <div className="h-[1px] flex-1 bg-[#E9E9E7]" />
                        </div>
                        <div className="bg-white border border-[#E9E9E7] rounded-xl p-4 shadow-sm text-[14px] text-gray-800 leading-relaxed">
                          <TextWithMath text={q.solution || convertStepsToSolution(q.steps)} />
                        </div>
                      </div>
                    )}

                    {/* Preview đúng/sai */}
                    {q.type === 'dung_sai' && (
                      <div className="space-y-4">
                        {q.statements.some((s: Statement) => s.claim || s.claim_latex) && (
                          <div>
                            <div className="text-[10px] font-mono text-[#AEACA8] uppercase tracking-[0.15em] flex items-center gap-3 mb-3">
                              Phân tích 4 mệnh đề <div className="h-[1px] flex-1 bg-[#E9E9E7]" />
                            </div>
                            {q.statements.map((st: Statement, i: number) =>
                              (st.claim || st.claim_latex)
                                ? <StatementPreview key={i} st={st} />
                                : null
                            )}
                          </div>
                        )}
                        {(q.solution || q.statements.some(st => st.steps?.some(s => s.title || s.text || s.formula))) && (
                          <div>
                            <div className="text-[10px] font-mono text-[#AEACA8] uppercase tracking-[0.15em] flex items-center gap-3 mb-3">
                              Hướng dẫn giải chi tiết <div className="h-[1px] flex-1 bg-[#E9E9E7]" />
                            </div>
                            <div className="bg-white border border-[#E9E9E7] rounded-xl p-4 shadow-sm text-[14px] text-gray-800 leading-relaxed">
                              <TextWithMath text={q.solution || q.statements.map(st => `**Ý ${st.label.toUpperCase()}:**\n${convertStepsToSolution(st.steps)}`).filter(s => !s.endsWith(':**\n')).join('\n\n')} />
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Preview trắc nghiệm */}
                    {q.type === 'trac_nghiem' && (
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          {['A','B','C','D'].map((lbl, ci) => q.choices?.[ci] ? (
                            <div key={lbl} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: q.correctChoice === lbl ? '#EAF3EE' : '#fff', border: `1px solid ${q.correctChoice === lbl ? '#44836150' : '#E9E9E7'}` }}>
                              <span className="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0" style={{ background: q.correctChoice === lbl ? '#448361' : '#F1F0EC', color: q.correctChoice === lbl ? '#fff' : '#787774' }}>{lbl}</span>
                              <span className="text-[13px] text-[#1A1A1A]"><TextWithMath text={q.choices[ci]} /></span>
                              {q.correctChoice === lbl && <span className="ml-auto text-xs font-bold text-emerald-600">✓ Đúng</span>}
                            </div>
                          ) : null)}
                        </div>
                        {(q.solution || q.solutionSteps?.some((s: Step) => s.title || s.formula || s.text)) && (
                          <div>
                            <div className="text-[10px] font-mono text-[#AEACA8] uppercase tracking-[0.15em] flex items-center gap-3 mb-3">
                              Lời giải chi tiết <div className="h-[1px] flex-1 bg-[#E9E9E7]" />
                            </div>
                            <div className="bg-white border border-[#E9E9E7] rounded-xl p-4 shadow-sm text-[14px] text-gray-800 leading-relaxed">
                              <TextWithMath text={q.solution || convertStepsToSolution(q.solutionSteps)} />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {!examName && !activeQuestion.qText && !activeQuestion.qFormula && !activeQuestion.imageSvg && !activeQuestion.tikzCode && (
                  <div className="flex flex-col items-center justify-center text-gray-400 mt-28 opacity-60">
                    <Eye className="w-12 h-12 mb-4" />
                    <p className="text-sm">Bắt đầu nhập liệu để xem trước...</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ── Action bar + Local Toast (khi hideTopBar=true, parent không render nút lưu) ── */}
      {hideTopBar && (
        <div className="mt-6 pt-5 border-t border-[#E9E9E7] space-y-3">

          {/* Local toast */}
          {localToast && (
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium"
              style={{
                background: localToast.type === 'success' ? '#EAF3EE' : localToast.type === 'error' ? '#FEE2E2' : '#EEF0FB',
                border: `1px solid ${localToast.type === 'success' ? '#B7D9C4' : localToast.type === 'error' ? '#FECACA' : '#C5CAFA'}`,
                color: localToast.type === 'success' ? '#448361' : localToast.type === 'error' ? '#E03E3E' : '#3D3D8D',
              }}
            >
              {localToast.type === 'success' && <span>✓</span>}
              {localToast.type === 'error'   && <span>✗</span>}
              {localToast.type === 'warning' && <span className="animate-spin inline-block">↻</span>}
              {localToast.msg}
            </div>
          )}

          {/* Nút lưu */}
          <div className="flex items-center gap-3 flex-wrap">
            {blog && deleteBlog && (
              <button
                onClick={async () => {
                  if (!window.confirm('Xóa bài viết này?')) return;
                  setSaving(true);
                  const ok = await deleteBlog(blog.id);
                  setSaving(false);
                  if (ok && onBack) onBack();
                }}
                disabled={saving}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-red-50 text-red-600 border border-red-200 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" /> Xóa bài
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-8 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-60 shadow-sm"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Đang lưu & sync...' : (blog ? 'Cập nhật Lời Giải' : 'Đăng bài Lời Giải')}
            </button>
          </div>
        </div>
      )}

      {/* ── Modal: Nhập đề thi từ JSON ── */}
      {showJsonModal && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 select-none animate-fade-in flex items-center justify-center p-4"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 99999,
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(5px)',
            WebkitBackdropFilter: 'blur(5px)',
          }}
          onClick={() => {
            if (!importingJson) setShowJsonModal(false);
          }}
        >
          <div
            className="w-full max-w-3xl rounded-2xl overflow-hidden bg-white shadow-2xl border border-[#E9E9E7] flex flex-col max-h-[90vh]"
            style={{
              boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(0,0,0,0.05)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#E9E9E7] flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <FileCode className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1A1A1A]">Nhập đề thi từ JSON</h3>
                  <p className="text-xs text-[#787774]">Dán cấu trúc JSON để nạp nhanh đề thi, đáp án, lời giải và tự động render hình vẽ TikZ</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!importingJson) setShowJsonModal(false);
                }}
                disabled={importingJson}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#787774] hover:bg-[#F7F6F3] hover:text-[#1A1A1A] transition-colors disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4">
              {/* Quick Actions Bar */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setJsonInput(SAMPLE_PHYSICS_EXAM_JSON)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#F7F6F3] hover:bg-[#EFEFED] text-[#37352F] border border-[#E9E9E7] transition-all flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    Dán mẫu 3 câu thử nghiệm (có hình vẽ TikZ)
                  </button>
                  {jsonInput && (
                    <button
                      type="button"
                      onClick={() => setJsonInput('')}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-all"
                    >
                      Xóa nội dung
                    </button>
                  )}
                </div>

                {/* Parsing Status Preview */}
                {parsedPreview && (
                  <div className="text-xs text-[#787774] flex items-center gap-1.5">
                    {parsedPreview.error ? (
                      <span className="text-red-500 font-medium flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> {parsedPreview.error}
                      </span>
                    ) : (
                      <span className="text-emerald-600 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Phát hiện {parsedPreview.count} câu hỏi {parsedPreview.tikzCount > 0 ? `(${parsedPreview.tikzCount} hình TikZ)` : ''}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Textarea */}
              <div className="relative">
                <textarea
                  value={jsonInput}
                  onChange={e => setJsonInput(e.target.value)}
                  placeholder={`{\n  "exam_name": "Chuyên đề Từ trường...",\n  "questions": [\n    {\n      "questionNo": "Câu 1",\n      "type": "trac_nghiem",\n      "qText": "Nội dung câu hỏi...",\n      "choices": ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"],\n      "correctChoice": "A",\n      "solution": "Lời giải chi tiết...",\n      "tikzCode": "\\\\begin{tikzpicture}...\\\\end{tikzpicture}"\n    }\n  ]\n}`}
                  className="w-full h-72 p-3.5 rounded-xl font-mono text-xs bg-[#FAFAFA] border border-[#E9E9E7] text-[#1A1A1A] focus:outline-none focus:bg-white focus:border-[#2383E2] transition-colors resize-y leading-relaxed"
                  spellCheck={false}
                />
              </div>

              {/* Format Guide */}
              <div className="p-3.5 rounded-xl bg-[#F7F6F3] border border-[#E9E9E7] text-[12px] text-[#787774] leading-relaxed">
                <p className="font-semibold text-[#37352F] mb-1">💡 Hướng dẫn cấu trúc JSON:</p>
                <p>• Hỗ trợ đối tượng <code>&#123; exam_name, questions: [...] &#125;</code> hoặc mảng trực tiếp <code>[...]</code>.</p>
                <p>• Các trường mỗi câu: <code>questionNo</code>, <code>type</code> (<code>'trac_nghiem'</code> | <code>'dung_sai'</code> | <code>'tu_luan'</code>), <code>qText</code>, <code>choices</code>, <code>correctChoice</code>, <code>statements</code>, <code>solution</code>, <code>tikzCode</code>.</p>
                <p>• Hệ thống sẽ tự động gọi Kroki API để sinh ảnh vector SVG chất lượng cao cho các câu có mã <code>tikzCode</code>.</p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-[#E9E9E7] bg-[#FAFAFA] flex items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowJsonModal(false)}
                disabled={importingJson}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#57564F] hover:bg-[#EFEFED] border border-[#E9E9E7] transition-colors disabled:opacity-50"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={handleImportJson}
                disabled={!jsonInput.trim() || importingJson}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm"
              >
                {importingJson ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Đang xử lý & vẽ hình...
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    Nạp vào trình soạn
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
