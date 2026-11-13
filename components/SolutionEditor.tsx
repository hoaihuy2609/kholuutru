// SolutionEditor.tsx — v2 (Merge Tự Luận + Đúng/Sai)
// Tương thích ngược hoàn toàn với data cũ (không có `type`)

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { SolutionQuestions } from './SolutionRenderer';
import { supabase } from "../src/lib/supabase";
import { useUIStore } from "../src/stores/useUIStore";
import { SolutionStep as Step, SolutionStatement as Statement, StudyQuestionGroup, StudyQuestionType } from '../types';
import { isStudyQuestionGroup, STUDY_QUESTION_GROUPS, supportsStudyGroups } from '../src/utils/studyLibrary';
import {
  ChevronLeft, ChevronRight, Save, Trash2, ArrowUp, ArrowDown,
  Plus, Eye, BookOpen, Layers, X, ToggleLeft, ToggleRight,
  Image as ImageIcon, Sparkles, RefreshCw, CheckCircle2, AlertCircle,
  FileCode, Download
} from 'lucide-react';
import { CLOUDFLARE_PROXY_URL } from "../src/lib/telegram";
import { MAX_QUESTION_IMAGE_WIDTH, MIN_QUESTION_IMAGE_WIDTH, normalizeQuestionImageWidth } from '../src/utils/questionImage';
import { normalizeQuestionTable, type QuestionTableData } from '../src/utils/questionTable';
import { renderTikzToSvg, uploadQuestionImageToTelegram, uploadSvgToTelegram } from "../src/services/tikzService";
import { pdfSolutionText, type PdfQuestionSource } from '../src/utils/pdfExamQuestions';
import { importedQuestionOutcomes, matrixMatchScore, questionOutcomes, type MatrixQuestionDraft } from '../src/utils/examMatrix';
import type { ReviewedPdfQuestion } from './PdfExamImport';

const PdfExamImport = React.lazy(() => import('./PdfExamImport'));

function OutcomesJsonInput({ onApply }: { onApply: (outcomes: string[]) => void }) {
  const panel = useRef<HTMLDetailsElement>(null);
  const [json, setJson] = useState('');
  const [error, setError] = useState('');

  function apply() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      setError('Cú pháp JSON chưa hợp lệ.');
      return;
    }
    try {
      const value = parsed && typeof parsed === 'object' && 'learning_outcomes' in parsed
        ? parsed.learning_outcomes : parsed;
      const outcomes = importedQuestionOutcomes(value);
      if (!outcomes.length) {
        setError('JSON cần có ít nhất một yêu cầu cần đạt.');
        return;
      }
      onApply(outcomes);
      setJson('');
      setError('');
      if (panel.current) panel.current.open = false;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Không đọc được yêu cầu cần đạt.');
    }
  }

  return (
    <details ref={panel} className="rounded-md border border-stone-200 px-2.5 py-1.5 text-sm">
      <summary className="cursor-pointer font-semibold text-amber-900">Nhập yêu cầu từ JSON</summary>
      <div className="mt-2 space-y-2">
        <textarea aria-label="JSON yêu cầu cần đạt" rows={3} spellCheck={false}
          className="block w-full rounded-md border border-stone-200 p-2 font-mono text-xs"
          placeholder={'["Nêu được khái niệm từ trường"]'}
          value={json} onChange={event => { setJson(event.target.value); setError(''); }} />
        <p className="text-xs text-stone-600">Các yêu cầu sẽ được thêm vào câu đang soạn.</p>
        {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
        <button type="button" disabled={!json.trim()} onClick={apply}
          className="rounded-md bg-amber-800 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
          Thêm vào câu này
        </button>
      </div>
    </details>
  );
}

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
type QuestionType = StudyQuestionType;

interface Question {
  questionNo: string;
  qText: string;
  qFormula: string;
  questionTable?: QuestionTableData;
  outcomeText: string;
  type: QuestionType;
  groups: StudyQuestionGroup[];
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
  imageFile?: File;        // Ảnh cục bộ chưa lưu
  imageLayout?: 'auto' | 'right' | 'bottom'; // Bố cục ảnh
  imageWidth?: number;
  pdfSource?: PdfQuestionSource;
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

const emptyQuestion = (type: StudyQuestionType = 'tu_luan', group?: StudyQuestionGroup): Question => ({
  questionNo: "",
  qText: "",
  qFormula: "",
  outcomeText: "",
  type,
  groups: group && supportsStudyGroups(type) ? [group] : [],
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
    questionTable: normalizeQuestionTable(q.question_table ?? q.questionTable),
    qFormula:   q.question_latex || q.qFormula || "",
    outcomeText: questionOutcomes(q.learning_outcomes).join('\n'),
    type:       qType,
    groups: Array.isArray(q.question_groups) ? q.question_groups.filter(isStudyQuestionGroup) : [],
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
    imageWidth: normalizeQuestionImageWidth(q.image_width ?? q.imageWidth),
    pdfSource: q.pdf_source,
  };
};

function serializeQuestion(q: Question, questionNo: string) {
  const outcomes = questionOutcomes(q.outcomeText.split('\n'));
  return {
    question_no:    questionNo,
    question_text:  q.qText,
    question_table: q.questionTable,
    question_latex: q.qFormula,
    type:           q.type,
    ...(outcomes.length ? { learning_outcomes: outcomes } : {}),
    ...(supportsStudyGroups(q.type) && q.groups.length ? { question_groups: q.groups } : {}),
    solution:       q.solution || '',
    tikz_code:      q.tikzCode || '',
    image_svg:      q.imageSvg || '',
    image_url:      q.imageUrl || '',
    image_telegram_file_id: q.imageTelegramFileId || '',
    image_layout:   q.imageLayout || 'auto',
    image_width:    q.imageWidth,
    pdf_source:     q.pdfSource,
    // Tự luận: lưu cả solution và steps tương thích
    steps:         q.type === 'tu_luan'    ? (q.solution ? [{ title: '', text: q.solution, formula: '', formula2: '' }] : q.steps) : [],
    // Đúng/sai: lưu statements
    statements:    q.type === 'dung_sai'   ? q.statements    : [],
    // Trắc nghiệm: lưu choices + correctChoice + solutionSteps
    choices:       q.type === 'trac_nghiem' ? q.choices       : [],
    correctChoice: q.type === 'trac_nghiem' ? q.correctChoice : '',
    solutionSteps: q.type === 'trac_nghiem' ? (q.solution ? [{ title: '', text: q.solution, formula: '', formula2: '' }] : q.solutionSteps) : [],
  };
}

// Dữ liệu mẫu 3 câu thử nghiệm (có hình ảnh TikZ) trích từ đề Chuyên đề 1.1 Từ trường của dòng điện thẳng
const SAMPLE_PHYSICS_EXAM_JSON = JSON.stringify({
  exam_name: "Chuyên đề 1.1: Từ trường của dòng điện thẳng",
  questions: [
    {
      questionNo: "Câu 1",
      type: "trac_nghiem",
      learning_outcomes: ["Tính được độ lớn cảm ứng từ do dòng điện thẳng dài gây ra tại một điểm."],
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
      learning_outcomes: ["Xác định được vị trí có cảm ứng từ tổng hợp bằng không do các dòng điện thẳng song song gây ra."],
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
      learning_outcomes: ["Xác định được vị trí có cảm ứng từ tổng hợp bằng không do hai dòng điện thẳng vuông góc gây ra."],
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
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────
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
  return (
    <div className="space-y-2 px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold text-stone-800">
          <span className="grid size-6 place-items-center rounded-md bg-amber-50 text-xs font-bold text-amber-900">
            {st.label.toUpperCase()}
          </span>
          Mệnh đề {st.label.toUpperCase()}
        </span>
        <div className="flex items-center gap-1.5">
          <button type="button" aria-pressed={st.verdict === true}
            onClick={() => onUpdate(si, { ...st, verdict: st.verdict === true ? null : true })}
            className={'min-h-8 rounded-md border px-2.5 text-xs font-semibold '
              + (st.verdict === true ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-stone-200 text-stone-700 hover:bg-emerald-50')}>
            ✓ Đúng
          </button>
          <button type="button" aria-pressed={st.verdict === false}
            onClick={() => onUpdate(si, { ...st, verdict: st.verdict === false ? null : false })}
            className={'min-h-8 rounded-md border px-2.5 text-xs font-semibold '
              + (st.verdict === false ? 'border-red-300 bg-red-50 text-red-800' : 'border-stone-200 text-stone-700 hover:bg-red-50')}>
            ✗ Sai
          </button>
        </div>
      </div>
      <AutoResizeTextarea rows={2}
        className="w-full rounded-lg border border-stone-200 px-2.5 py-2 text-sm text-stone-800 outline-none focus:border-amber-600"
        placeholder={'Nội dung mệnh đề ' + st.label.toUpperCase() + '… (hỗ trợ công thức $…$)'}
        value={st.claim}
        onChange={e => onUpdate(si, { ...st, claim: e.target.value })}
        onFocus={e => onFocus('stmt-' + si, e.target)}
      />
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
  studyPlacement?: React.ReactNode;
  studyDefaults?: { title: string; firstQuestionNumber: number };
  studyGrade?: number;
  studyQuestionType?: StudyQuestionType;
  initialQuestionIndex?: number;
  initialQuestionGroup?: StudyQuestionGroup;
  savedOutcomes?: string[];
  matrixDraft?: MatrixQuestionDraft;
}

export default function SolutionEditor({
  blog, saveBlog, deleteBlog, syncBlogs, onSaved, onBack, switchToMarkdown, switchToExamPaper, hideTopBar,
  studyPlacement, studyDefaults, studyGrade, studyQuestionType, initialQuestionIndex = 0, initialQuestionGroup, savedOutcomes = [], matrixDraft
}: SolutionEditorProps) {
  const splitImportedQuestions = !!saveBlog && !studyGrade;
  const [examName,   setExamName]   = useState("");
  const [questions,  setQuestions]  = useState<Question[]>(() => [{
    ...emptyQuestion(matrixDraft?.type ?? studyQuestionType, initialQuestionGroup),
    outcomeText: matrixDraft?.outcomes.join('\n') ?? '',
  }]);
  const [activeQIdx, setActiveQIdx] = useState(0);
  const [saving,     setSaving]     = useState(false);
  const [uploadingSaveImages, setUploadingSaveImages] = useState(false);

  const [category,     setCategory]     = useState("");
  const [level,        setLevel]        = useState(matrixDraft?.level ?? 0);
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
  const questionTable = activeQuestion.questionTable;
  const imageInput = useRef<HTMLInputElement>(null);
  const uploadedImageIds = useRef(new WeakMap<File, string>());
  const [imagePreview, setImagePreview] = useState<{ file: File; url: string }>();
  const imageFile = activeQuestion.imageFile;
  useEffect(() => {
    if (!imageFile) {
      setImagePreview(undefined);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreview({ file: imageFile, url });
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);
  const localImageUrl = imagePreview?.file === imageFile ? imagePreview?.url : undefined;
  const imageUrl = localImageUrl || activeQuestion.imageUrl
    || (CLOUDFLARE_PROXY_URL && activeQuestion.imageTelegramFileId
      ? CLOUDFLARE_PROXY_URL + '/getFile/' + encodeURIComponent(activeQuestion.imageTelegramFileId) : '');
  const hasIllustration = !!(activeQuestion.imageSvg || imageUrl);
  const illustrationWidth = activeQuestion.imageWidth === undefined ? undefined : { width: activeQuestion.imageWidth + '%' };
  const questionNumber = (question: Question, index: number) => {
    const automatic = 'Câu ' + ((studyDefaults?.firstQuestionNumber ?? 1) + index);
    return studyDefaults && !blog?.id ? automatic : question.questionNo || automatic;
  };
  const activeNumber = questionNumber(activeQuestion, activeQIdx);
  const previewQuestion = serializeQuestion(
    localImageUrl ? { ...activeQuestion, imageUrl: localImageUrl } : activeQuestion, activeNumber,
  );
  const hasPreview = previewQuestion.question_text || previewQuestion.question_latex || previewQuestion.question_table || previewQuestion.image_svg
    || previewQuestion.image_url || previewQuestion.image_telegram_file_id || previewQuestion.solution || previewQuestion.choices.some(Boolean)
    || previewQuestion.statements.some(statement => statement.claim || statement.claim_latex || convertStepsToSolution(statement.steps))
    || convertStepsToSolution(previewQuestion.steps) || convertStepsToSolution(previewQuestion.solutionSteps);
  const [renderingTikz, setRenderingTikz] = useState(false);
  const [tikzError, setTikzError] = useState<string | null>(null);
  const illustrationBusy = saving || renderingTikz;

  const attachImage = (file: File) => {
    if (illustrationBusy) return;
    if (file.type !== 'image/png' && file.type !== 'image/jpeg') {
      showToast('Vui lòng dùng ảnh PNG hoặc JPG.', 'error');
      return;
    }
    if (!file.size || file.size > 5 * 1024 * 1024) {
      showToast('Ảnh phải có dung lượng lớn hơn 0 và tối đa 5 MB.', 'error');
      return;
    }
    setTikzError(null);
    updateQuestion({ imageFile: file, imageUrl: '', imageSvg: '', imageTelegramFileId: '', tikzCode: '' });
  };

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
      updateQuestion({
        imageSvg: res.svg,
        imageFile: undefined,
        imageUrl: '',
        imageTelegramFileId: '',
        imageLayout: !activeQuestion.imageLayout || activeQuestion.imageLayout === 'auto'
          ? res.recommendedLayout : activeQuestion.imageLayout,
      });
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
  const [showPdfModal, setShowPdfModal] = useState(false);
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
        else if (parsed.questionNo || parsed.qText || parsed.question_text || parsed.question_table || parsed.questionTable) list = [parsed];
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
        } else if (parsed.questionNo || parsed.qText || parsed.question_text || parsed.question_table || parsed.questionTable) {
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

      const normalizedList: Question[] = rawQuestions.map((raw, index) => {
        const question = normalizeQuestion(raw);
        if ((raw.question_table !== undefined || raw.questionTable !== undefined) && !question.questionTable) {
          throw new Error(`Câu thứ ${index + 1}. Bảng cần ít nhất một tiêu đề cột và mỗi hàng phải có số ô văn bản bằng số tiêu đề.`);
        }
        if (raw.learning_outcomes !== undefined) {
          try {
            question.outcomeText = importedQuestionOutcomes(raw.learning_outcomes).join('\n');
          } catch (error) {
            throw new Error(`Câu thứ ${index + 1}. ${(error as Error).message}`);
          }
        }
        if (initialQuestionGroup && supportsStudyGroups(question.type) && !Array.isArray(raw.question_groups)) {
          question.groups = [initialQuestionGroup];
        }
        return question;
      });

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

      // TÍN HIỆU TỰ ĐỘNG TÁCH CARD:
      // Nếu JSON chứa từ 2 câu hỏi trở lên (normalizedList.length > 1) và có hàm saveBlog
      if (normalizedList.length > 1 && splitImportedQuestions && saveBlog) {
        let createdCount = 0;
        for (let i = 0; i < normalizedList.length; i++) {
          const q = normalizedList[i];
          const singleSerialized = serializeQuestion(q, q.questionNo || `Câu ${i + 1}`);

          const singleSolutionData = {
            type: 'physics_solution',
            data: {
              exam_name: importedExamName || examName || 'Bài tập Vật lý',
              questions: [singleSerialized],
              question_no: singleSerialized.question_no,
              question_text: singleSerialized.question_text,
              question_latex: singleSerialized.question_latex,
              steps: singleSerialized.steps,
            }
          };

          const postTitle = importedExamName
            ? `[${importedExamName}] - ${singleSerialized.question_no}`
            : `[Lời giải] - ${singleSerialized.question_no}`;

          // Nếu đang sửa bài cũ, câu đầu tiên cập nhật bài cũ, các câu sau tạo mới
          const isFirstOfExisting = (i === 0 && blog?.id);

          const payload = {
            id: isFirstOfExisting ? blog.id : undefined,
            title: postTitle,
            summary: (q.qText || '').substring(0, 150) || 'Hướng dẫn giải chi tiết bằng LaTeX.',
            content: JSON.stringify(singleSolutionData),
            category: category || 'Lời giải',
            is_published: true,
            tags: [],
            level: level || 1,
            grade: grade || 0,
          };

          await saveBlog(payload);
          createdCount++;
        }

        void syncBlogs?.();
        setShowJsonModal(false);
        showToast(`Phát hiện ${createdCount} câu hỏi -> Đã tự động tách thành ${createdCount} Cards riêng biệt thành công!`, 'success');
        if (onBack) onBack();
      } else {
        // Một bài trong chương giữ nguyên các câu hỏi nhập cùng nhau.
        setQuestions(normalizedList);
        setActiveQIdx(0);
        setShowJsonModal(false);

        const svgNote = renderedCount > 0 ? ` (đã sinh tự động ${renderedCount} hình vẽ vector SVG)` : '';
        showToast(`Đã nạp ${normalizedList.length} câu hỏi vào trình soạn${svgNote}!`, 'success');
      }
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

          // Bài cũ có thể chỉ lưu một câu ở cấp data.
          const savedQuestions = Array.isArray(parsed.data.questions) && parsed.data.questions.length
            ? parsed.data.questions : [parsed.data];
          setQuestions(savedQuestions.map(normalizeQuestion));
          setActiveQIdx(savedQuestions[initialQuestionIndex] ? initialQuestionIndex : 0);
        }
      } catch (e) {
        console.error("Failed to parse physics solution data", e);
      }
    }
  }, [blog, initialQuestionIndex]);

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
  const updateQuestion = (fields: Partial<Question>) =>
    setQuestions(prev => prev.map((q, i) => i === activeQIdx ? { ...q, ...fields } : q));

  const updateQ = (key: keyof Question, val: any) => updateQuestion({ [key]: val });

  const addQuestion = () => {
    if (illustrationBusy) return;
    setQuestions(prev => [...prev, emptyQuestion(studyQuestionType, initialQuestionGroup)]);
    setActiveQIdx(questions.length);
  };

  const removeQuestion = (idx: number) => {
    if (illustrationBusy || questions.length <= 1) return;
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
  const persistQuestions = async (batch: Question[], source: string, targetGrade: number, published: boolean) => {
      // Ảnh tải lên cần có file_id trước khi lưu. SVG vẫn có thể dùng bản nhúng.
      setUploadingSaveImages(batch.some(q => q.imageFile ? !uploadedImageIds.current.has(q.imageFile) : q.imageSvg && !q.imageTelegramFileId));
      const uploads = await Promise.allSettled(batch.map(async (q, idx) => {
        if (q.imageFile) {
          const file = q.imageFile;
          const fileId = uploadedImageIds.current.get(file) ?? await uploadQuestionImageToTelegram(file);
          if (!fileId) throw new Error('Tải ảnh lên Telegram thất bại. Hãy thử lưu lại.');
          uploadedImageIds.current.set(file, fileId);
          return { ...q, imageFile: undefined, imageTelegramFileId: fileId };
        }
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
      setUploadingSaveImages(false);
      const processedQuestions = uploads.map((upload, index) => {
        if (upload.status === 'fulfilled') return upload.value;
        const reason = upload.reason instanceof Error ? upload.reason.message : 'Không tải được ảnh. Hãy thử lưu lại.';
        throw new Error(`Ảnh của ${questionNumber(batch[index], index)}. ${reason}`);
      });

      // Serialize mỗi câu hỏi tùy theo type
      const serializedQuestions = processedQuestions.map((q, index) =>
        serializeQuestion(q, studyDefaults ? questionNumber(q, index) : q.questionNo));

      const savedExamName = studyDefaults ? source.trim() || blog?.title || studyDefaults.title : source;
      const solutionData = {
        type: 'physics_solution',
        data: {
          exam_name: savedExamName,
          questions: serializedQuestions,
          // Backward compat: giữ root-level của câu đầu
          question_no:    serializedQuestions[0].question_no,
          question_text:  serializedQuestions[0].question_text,
          question_latex: serializedQuestions[0].question_latex,
          steps:          batch[0].type === 'tu_luan' ? batch[0].steps : [],
        }
      };

      const titleStr = studyGrade ? savedExamName.trim() : batch.length === 1
        ? `[Giải chi tiết] ${source} - ${batch[0].questionNo}`
        : `[Giải chi tiết] ${source} (${batch.length} câu)`;

      const payload = {
        id: blog?.id,
        title: titleStr,
        summary: batch[0].qText.substring(0, 150) || 'Hướng dẫn giải chi tiết bằng LaTeX.',
        content: JSON.stringify(solutionData),
        category: category || 'Lời giải',
        is_published: published,
        tags: [],
        level,
        grade: targetGrade,
      };

      if (saveBlog) {
        const saved = await saveBlog(payload);
        if (saved) {
          void syncBlogs?.();
          showToast(published ? 'Đã lưu bài viết!' : 'Đã lưu bản nháp!', 'success');
          if (onSaved) onSaved(saved);
        } else throw new Error("Lưu thất bại.");
      } else {
        const { error } = await supabase.from("solutions").insert(solutionData.data);
        if (error) throw error;
        showToast("Đã lưu (standalone mode)!", "success");
        setQuestions([emptyQuestion()]);
      }
  };

  const handleSave = async () => {
    if (illustrationBusy) return;
    if (matrixDraft) {
      if (!studyGrade) {
        showToast('Chọn chương trong Góc Học Tập để lưu câu hỏi.', 'error');
        return;
      }
      if (!activeQuestion.qText.trim() && !activeQuestion.qFormula.trim() && !activeQuestion.questionTable && !activeQuestion.imageFile
          && !activeQuestion.imageSvg && !activeQuestion.imageTelegramFileId && !activeQuestion.imageUrl) {
        showToast('Nhập đề bài hoặc thêm hình cho câu hỏi.', 'error');
        return;
      }
      const outcomes = questionOutcomes(activeQuestion.outcomeText.split('\n'));
      if (!matrixMatchScore(matrixDraft.rows, { type: activeQuestion.type, level, outcomes })) {
        showToast('Yêu cầu cần đạt phải khớp với vị trí đang soạn trong ma trận.', 'error');
        return;
      }
    }
    if (!studyDefaults && (!examName.trim() || questions.some(q => !q.questionNo))) {
      showToast("Vui lòng nhập tên đề và số câu cho tất cả các câu!", "error");
      return;
    }
    setSaving(true);
    try {
      await persistQuestions(questions, examName, grade, isPublished);
    } catch (err: any) {
      showToast("Lỗi: " + err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const savePdfBatch = async (source: string, targetGrade: number, reviewed: ReviewedPdfQuestion[]) => {
    if (studyGrade && !studyQuestionType) {
      throw new Error('Đóng màn hình nhập và chọn loại câu cho vị trí trong kho trước khi lưu.');
    }
    const batch = reviewed.map((question, index): Question => ({
      ...emptyQuestion(question.type, initialQuestionGroup),
      questionNo: 'Câu ' + (index + 1),
      qText: question.text.trim(),
      choices: question.options,
      correctChoice: question.type === 'trac_nghiem' ? question.answer : '',
      solution: pdfSolutionText(question),
      statements: STMT_LABELS.map((label, position) => ({
        ...emptyStatement(label), claim: question.options[position], verdict: question.verdicts[position],
      })),
      pdfSource: question.source,
      imageFile: question.imageFile,
    }));
    await persistQuestions(batch, source, targetGrade, false);
    setShowPdfModal(false);
  };

  const handleDelete = async () => {
    if (!blog || !deleteBlog || !window.confirm('Xóa bài viết này?')) return;
    setSaving(true);
    const deleted = await deleteBlog(blog.id);
    setSaving(false);
    if (!deleted) {
      showToast('Xóa thất bại. Vui lòng thử lại.', 'error');
      return;
    }
    void syncBlogs?.();
    onBack?.();
  };

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  const scopedLayout = !!studyPlacement;
  const publishControl = (
    <label className="inline-flex shrink-0 cursor-pointer items-center gap-2 text-xs font-semibold text-stone-700">
      <input type="checkbox" className="peer sr-only" checked={isPublished} onChange={e => setIsPublished(e.target.checked)} />
      <span aria-hidden="true" className="relative h-5 w-9 rounded-full bg-stone-300 transition-colors after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-amber-700 peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-amber-600 peer-focus-visible:ring-offset-2" />
      Công khai cho học sinh
    </label>
  );


  const gradeControl = (
    <div role="group" aria-label="Khối" className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-stone-700">Khối</span>
      <div className="flex flex-wrap gap-1 rounded-lg border border-stone-200 bg-stone-50 p-1">
        {[{ lab: 'Tất cả', val: 0 }, { lab: '12', val: 12 }, { lab: '11', val: 11 }, { lab: '10', val: 10 }].map(g => (
          <button key={g.val} type="button" aria-pressed={grade === g.val} onClick={() => setGrade(g.val)}
            className={'min-h-8 rounded-md px-2.5 text-xs font-semibold '
              + (grade === g.val ? 'bg-amber-100 text-amber-950' : 'text-stone-600 hover:bg-stone-100')}>
            {g.lab}
          </button>
        ))}
      </div>
    </div>
  );

  const levelControl = (
    <div role="group" aria-label="Mức độ" className="flex min-w-0 flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-stone-700">Mức độ</span>
      <div className="flex min-w-0 flex-wrap gap-1 rounded-lg border border-stone-200 bg-stone-50 p-1">
        {['—', 'Mức 1', 'Mức 2', 'Mức 3', 'Mức 4'].map((label, value) => (
          <button key={value} type="button" aria-pressed={level === value} onClick={() => setLevel(value)}
            disabled={!!matrixDraft?.level && value !== matrixDraft.level}
            aria-label={value === 0 ? 'Chưa chọn mức độ' : label}
            className={'min-h-8 rounded-md px-2.5 text-xs font-semibold '
              + (level === value ? 'bg-amber-100 text-amber-950' : 'text-stone-600 hover:bg-stone-100')}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
  const importControl = (
    <div className="flex flex-wrap items-center gap-2">
      {saveBlog && !blog && (
        <button type="button" disabled={illustrationBusy} onClick={() => setShowPdfModal(true)}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-xs font-semibold text-stone-800 hover:bg-stone-100">
          Nhập từ PDF
        </button>
      )}
      <button type="button" disabled={illustrationBusy} onClick={() => setShowJsonModal(true)}
      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-semibold text-amber-950 hover:bg-amber-100"
      title="Nạp đề thi từ JSON, hỗ trợ cả hình vẽ TikZ">
      <FileCode aria-hidden="true" className="size-4" /> Nhập từ JSON
      </button>
    </div>
  );

  return (
    <div className={hideTopBar ? "space-y-6 font-sans" : "max-w-[1920px] w-full mx-auto p-4 md:p-8 space-y-6 animate-fade-in relative pb-20 font-sans"}>
      {showPdfModal && (
        <React.Suspense fallback={<p role="status">Đang mở trình nhập PDF…</p>}>
          <PdfExamImport fixedGrade={studyGrade} requiredType={studyQuestionType}
            onClose={() => setShowPdfModal(false)} onSave={savePdfBatch} />
        </React.Suspense>
      )}

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
            <button onClick={handleDelete} disabled={saving} className="px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-red-50 text-red-600 transition-colors disabled:opacity-50">
              <Trash2 className="w-4 h-4" /> Xóa bài
            </button>
          )}
          <button onClick={handleSave} disabled={illustrationBusy}
            className="px-6 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-60 shadow-sm">
            <Save className="w-4 h-4" />
            {saving ? (uploadingSaveImages ? 'Đang tải hình…' : 'Đang lưu…') : (blog ? 'Cập nhật' : 'Đăng bài')}
          </button>
        </div>
      </div>
      )}

      {scopedLayout ? (
        <section aria-labelledby="solution-placement-heading"
          className="min-w-0 space-y-3 rounded-xl border border-stone-200 bg-white p-3.5 shadow-sm sm:p-4">
          <h2 id="solution-placement-heading" className="text-sm font-bold text-stone-900">Vị trí trong Góc Học Tập</h2>
          {studyPlacement}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-stone-100 pt-3">
            {!studyGrade && !matrixDraft && gradeControl}
            {levelControl}
          </div>
        </section>
      ) : (
        <>
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
            {!studyGrade && gradeControl}
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
              {levelControl}
            </div>
          </div>
        </>
      )}

      {/* ── Main grid ── */}
      <div className="grid min-w-0 grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">

        {/* ════════ EDITOR ════════ */}
        <div className="flex min-w-0 flex-col gap-5">

          {/* Thông tin đề và điều hướng câu hỏi */}
          <div className="space-y-4 rounded-xl border border-stone-200 bg-white p-3.5 shadow-sm sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-bold text-stone-900">
                <BookOpen aria-hidden="true" className="size-4 text-amber-800" /> Soạn câu hỏi
              </h3>
              {studyDefaults && !matrixDraft && importControl}
            </div>
            {!studyDefaults && <div>
              <label className="block text-sm font-semibold mb-2 text-[#1A1A1A]">Tên đề thi / Nguồn</label>
              <input className="w-full p-3 rounded-lg border border-[#E9E9E7] outline-none focus:border-indigo-500 text-sm transition-colors"
                placeholder="VD: THPT QG 2024"
                value={examName} onChange={e => setExamName(e.target.value)} />
            </div>}

            <div className="space-y-3 border-t border-stone-100 pt-3">
              {questions.length > 1 && <div role="group" aria-label="Điều hướng câu hỏi"
                className="flex flex-wrap items-center gap-1.5 rounded-lg border border-stone-200 bg-stone-50 p-2 text-sm">
                <button type="button" disabled={illustrationBusy || activeQIdx === 0} onClick={() => setActiveQIdx(activeQIdx - 1)}
                  className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 font-semibold text-stone-700 hover:bg-stone-200 disabled:opacity-40">
                  <ChevronLeft aria-hidden="true" className="size-4" /> Câu trước
                </button>
                <select aria-label="Câu đang soạn" value={activeQIdx} disabled={illustrationBusy}
                  onChange={event => setActiveQIdx(Number(event.target.value))}
                  className="min-h-9 min-w-0 max-w-full rounded-md border border-stone-200 bg-white px-2 font-semibold text-stone-900">
                  {questions.map((question, index) => <option key={index} value={index}>{questionNumber(question, index)}</option>)}
                </select>
                <span aria-label={`Vị trí ${activeQIdx + 1} trong ${questions.length} câu`}
                  className="px-1 text-xs tabular-nums text-stone-600">{activeQIdx + 1}/{questions.length}</span>
                <button type="button" disabled={illustrationBusy || activeQIdx === questions.length - 1} onClick={() => setActiveQIdx(activeQIdx + 1)}
                  className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 font-semibold text-stone-700 hover:bg-stone-200 disabled:opacity-40">
                  Câu sau <ChevronRight aria-hidden="true" className="size-4" />
                </button>
                <button type="button" disabled={illustrationBusy} onClick={() => removeQuestion(activeQIdx)} aria-label="Xóa câu đang soạn"
                  className="ml-auto grid size-9 place-items-center rounded-md text-stone-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-40">
                  <Trash2 aria-hidden="true" className="size-4" />
                </button>
              </div>}
              {!studyDefaults && <div className="flex flex-wrap items-center gap-2">
                <button onClick={addQuestion} disabled={illustrationBusy}
                  className="px-3 py-2 rounded-lg text-sm font-semibold border-2 border-dashed border-[#DCDCDA] text-[#787774] hover:border-indigo-400 hover:text-indigo-600 transition-all flex items-center gap-1">
                  <Plus className="w-4 h-4" /> Thêm câu
                </button>
                {importControl}
              </div>}

              {/* Info câu đang active */}
              <div className="space-y-4">
                {/* Loại câu hỏi — 3 nút */}
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                  <span className="text-sm font-semibold text-stone-700">Loại câu hỏi</span>
                  <div className="flex flex-wrap gap-1.5">
                    {([
                      { val: 'tu_luan', label: 'Trả lời ngắn' },
                      { val: 'dung_sai', label: 'Đúng / Sai' },
                      { val: 'trac_nghiem', label: 'Trắc nghiệm' },
                    ] as const).filter(opt => !matrixDraft || opt.val === matrixDraft.type).map(opt => (
                      <button key={opt.val} type="button" aria-pressed={activeQuestion.type === opt.val}
                        onClick={() => updateQ('type', opt.val)}
                        className={'min-h-8 rounded-md border px-2.5 text-xs font-semibold transition-colors '
                          + (activeQuestion.type === opt.val ? 'border-amber-300 bg-amber-100 text-amber-950' : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-100')}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {supportsStudyGroups(activeQuestion.type) && (
                  <div role="group" aria-label="Nhóm nội dung" className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span className="text-sm font-semibold text-stone-700">Nhóm nội dung</span>
                    {STUDY_QUESTION_GROUPS.map(({ value, label }) => {
                      const checked = activeQuestion.groups.includes(value);
                      return (
                        <label key={value} className={'inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-md border px-2 text-xs font-semibold '
                          + (checked ? 'border-amber-300 bg-amber-50 text-amber-950' : 'border-stone-200 text-stone-700 hover:bg-stone-50')}>
                          <input type="checkbox" checked={checked} className="accent-amber-800"
                            onChange={event => updateQ('groups', event.target.checked
                              ? [...activeQuestion.groups, value]
                              : activeQuestion.groups.filter(group => group !== value))} />
                          {label}
                        </label>
                      );
                    })}
                    <span className="text-xs text-stone-600">Có thể chọn cả hai</span>
                  </div>
                )}

                {studyDefaults ? (questions.length === 1 && (
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold text-stone-700">Số câu</span>
                    <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 font-semibold text-amber-950">{activeNumber}</span>
                    {!blog?.id && <span className="text-xs text-stone-600">Tự động</span>}
                  </div>
                )) : <div>
                  <label className="block text-sm font-semibold mb-2 text-[#1A1A1A]">Số bài / Số câu</label>
                  <input className="w-full p-3 rounded-lg border border-[#E9E9E7] outline-none focus:border-indigo-500 text-sm transition-colors"
                    placeholder="VD: Câu 4"
                    value={activeQuestion.questionNo} onChange={e => updateQ('questionNo', e.target.value)} />
                </div>}
                {activeQuestion.pdfSource && (
                  <p className="text-xs text-stone-600">
                    {examName && examName + ' · '}{activeQuestion.pdfSource.label} · Trang {activeQuestion.pdfSource.page}
                  </p>
                )}
                {saveBlog && <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-stone-800" htmlFor="question-learning-outcomes">Yêu cầu cần đạt</label>
                  <AutoResizeTextarea id="question-learning-outcomes" rows={2}
                    className="w-full rounded-lg border border-stone-200 p-3 text-sm text-stone-800 outline-none focus:border-amber-600"
                    placeholder="Ví dụ: Nêu được khái niệm điện trường"
                    value={activeQuestion.outcomeText} onChange={e => updateQ('outcomeText', e.target.value)} />
                  <p className="text-xs text-stone-600">Mỗi dòng một yêu cầu. Web dùng các yêu cầu này để tìm câu theo ma trận.</p>
                  <OutcomesJsonInput key={`${blog?.id ?? 'new'}:${activeQIdx}`} onApply={outcomes => {
                    updateQ('outcomeText', questionOutcomes([...activeQuestion.outcomeText.split('\n'), ...outcomes]).join('\n'));
                    showToast('Đã thêm yêu cầu cần đạt vào câu đang soạn.');
                  }} />
                  {savedOutcomes.length > 0 && <select aria-label="Thêm yêu cầu đã lưu" value=""
                    className="max-w-full rounded-md border border-stone-200 bg-white p-2 text-sm"
                    onChange={e => {
                      if (e.target.value) updateQ('outcomeText', questionOutcomes([...activeQuestion.outcomeText.split('\n'), e.target.value]).join('\n'));
                    }}>
                    <option value="">Thêm yêu cầu đã lưu…</option>
                    {savedOutcomes.map(outcome => <option key={outcome}>{outcome}</option>)}
                  </select>}
                </div>}
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-stone-800">Mô tả đề bài</label>
                  <AutoResizeTextarea rows={2}
                    className="w-full rounded-lg border border-stone-200 p-3 text-sm text-stone-800 outline-none focus:border-amber-600"
                    placeholder={activeQuestion.type === 'dung_sai'
                      ? "VD: Trong ống tia điện tử, người ta tạo ra chùm tia electron nhờ điện áp U = 2,70 kV..."
                      : "Một vật dao động điều hòa..."}
                    value={activeQuestion.qText} onChange={e => updateQ('qText', e.target.value)} />
                </div>

                {questionTable ? (
                  <fieldset className="min-w-0 space-y-2">
                    <legend className="mb-1 text-sm font-semibold text-stone-800">Bảng trong đề bài</legend>
                    <div className="overflow-x-auto">
                      <div className="grid items-start gap-2 pb-1"
                        style={{ gridTemplateColumns: `repeat(${questionTable.headers.length}, minmax(7rem, 1fr)) auto` }}>
                        {questionTable.headers.map((header, column) => (
                          <div key={column} className="flex min-w-0 items-center gap-1">
                            <input aria-label={`Tiêu đề cột ${column + 1}`} value={header}
                              className="w-full min-w-0 rounded-lg border border-stone-200 px-2 py-2 text-sm"
                              onChange={event => {
                                const headers = [...questionTable.headers];
                                headers[column] = event.target.value;
                                updateQuestion({ questionTable: { ...questionTable, headers } });
                              }} />
                            {questionTable.headers.length > 1 && (
                              <button type="button" className="shrink-0 rounded-lg px-1.5 py-2 text-stone-600 hover:bg-stone-100"
                                aria-label={`Xóa cột ${column + 1}`} title={`Xóa cột ${column + 1}`} onClick={() => {
                                  if ((header.trim() || questionTable.rows.some(row => row[column].trim()))
                                    && !window.confirm(`Xóa cột ${column + 1} và nội dung trong cột này?`)) return;
                                  updateQuestion({ questionTable: {
                                    headers: questionTable.headers.filter((_, i) => i !== column),
                                    rows: questionTable.rows.map(row => row.filter((_, i) => i !== column)),
                                  } });
                                }}>×</button>
                            )}
                          </div>
                        ))}
                        <span />
                        {questionTable.rows.map((row, index) => (
                          <React.Fragment key={index}>
                            {row.map((cell, column) => (
                              <AutoResizeTextarea key={column} rows={1} aria-label={`Hàng ${index + 1}, cột ${column + 1}`}
                                value={cell} className="min-w-0 rounded-lg border border-stone-200 px-2 py-2 text-sm"
                                onChange={event => {
                                  const nextRow = [...row];
                                  nextRow[column] = event.target.value;
                                  updateQuestion({ questionTable: {
                                    ...questionTable, rows: questionTable.rows.map((item, i) => i === index ? nextRow : item),
                                  } });
                                }} />
                            ))}
                            <button type="button" className="rounded-lg px-2 py-2 text-stone-600 hover:bg-stone-100"
                              aria-label={`Xóa hàng ${index + 1}`} onClick={() => {
                                updateQuestion({ questionTable: { ...questionTable, rows: questionTable.rows.filter((_, i) => i !== index) } });
                              }}>×</button>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm">
                      <button type="button" className="font-semibold text-amber-900" onClick={() =>
                        updateQuestion({ questionTable: { ...questionTable, rows: [...questionTable.rows, questionTable.headers.map(() => '')] } })
                      }>+ Thêm hàng</button>
                      <button type="button" className="font-semibold text-amber-900" onClick={() =>
                        updateQuestion({ questionTable: {
                          headers: [...questionTable.headers, ''],
                          rows: questionTable.rows.map(row => [...row, '']),
                        } })
                      }>+ Thêm cột</button>
                      <button type="button" className="text-red-700" onClick={() => updateQuestion({ questionTable: undefined })}>Xóa bảng</button>
                    </div>
                  </fieldset>
                ) : (
                  <button type="button" className="self-start rounded-lg border border-stone-200 px-3 py-2 text-sm font-semibold text-amber-900"
                    onClick={() => updateQuestion({ questionTable: { headers: ['Cột A', 'Cột B'], rows: [['', ''], ['', '']] } })}>
                    + Chèn bảng
                  </button>
                )}

                <div
                  role="group"
                  aria-label="Hình minh họa"
                  tabIndex={0}
                  onPaste={event => {
                    const file = Array.from(event.clipboardData.files).find(item => item.type.startsWith('image/'));
                    if (!file) return;
                    event.preventDefault();
                    attachImage(file);
                  }}
                  className="space-y-2.5 rounded-lg border border-stone-200 bg-stone-50 p-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-600"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[#1A1A1A]">Hình minh họa</span>
                      <span className="text-[11px] text-[#787774] font-normal">(tùy chọn)</span>
                    </div>
                    <input
                      ref={imageInput}
                      type="file"
                      accept="image/png,image/jpeg"
                      aria-label="Chọn ảnh PNG hoặc JPG"
                      hidden
                      onChange={event => {
                        const file = event.currentTarget.files?.[0];
                        event.currentTarget.value = '';
                        if (file) attachImage(file);
                      }}
                    />
                    <button
                      type="button"
                      disabled={illustrationBusy}
                      onClick={() => imageInput.current?.click()}
                      className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-stone-800 hover:bg-amber-50 disabled:opacity-60"
                    >
                      <ImageIcon aria-hidden="true" className="size-3.5 text-amber-800" />
                      {hasIllustration ? 'Thay ảnh' : 'Chèn ảnh'}
                    </button>
                  </div>

                  <p className="text-[11px] text-[#787774] leading-relaxed">
                    Bấm vào vùng này rồi nhấn Ctrl+V để dán ảnh, hoặc chọn ảnh PNG/JPG tối đa 5 MB. Gõ <code className="bg-[#F1F0EC] text-[#1A1A1A] px-1 py-0.5 rounded font-mono font-medium">[image]</code> vào đề bài để đặt hình giữa các đoạn.
                  </p>

                  <AutoResizeTextarea
                    rows={3}
                    aria-label="Mã TikZ"
                    disabled={illustrationBusy}
                    className="w-full rounded-lg border border-stone-200 bg-white p-2.5 font-mono text-xs text-stone-800 outline-none focus:border-amber-600"
                    placeholder={`VD:\n\\begin{tikzpicture}\n  \\draw[thick, ->] (0,0) -- (3,0) node[right] {$x$};\n  \\draw[thick, ->] (0,0) -- (0,3) node[above] {$y$};\n  \\draw[red, thick] (0,0) circle (1.2);\n\\end{tikzpicture}`}
                    value={activeQuestion.tikzCode || ''}
                    onChange={e => updateQ('tikzCode', e.target.value)}
                    onFocus={e => trackFocus(`q-tikz-${activeQIdx}`, e.target)}
                  />

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-0.5">
                    <button
                      type="button"
                      onClick={handleRenderTikz}
                      disabled={illustrationBusy || !activeQuestion.tikzCode?.trim()}
                      className={`inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        illustrationBusy || !activeQuestion.tikzCode?.trim()
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

                    {hasIllustration && (
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="text-[#787774] text-[11px]">Bố cục:</span>
                        {(['auto', 'right', 'bottom'] as const).map(l => (
                          <button
                            key={l}
                            type="button"
                            disabled={illustrationBusy}
                            aria-pressed={(activeQuestion.imageLayout || 'auto') === l}
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
                          disabled={illustrationBusy}
                          onClick={() => {
                            setTikzError(null);
                            updateQuestion({ imageFile: undefined, imageUrl: '', imageSvg: '', imageTelegramFileId: '', tikzCode: '', imageWidth: undefined });
                          }}
                          className="ml-2 text-[11px] text-rose-500 hover:underline"
                        >
                          Xóa hình
                        </button>
                      </div>
                    )}
                  </div>

                  {hasIllustration && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-stone-200 pt-2.5 text-xs">
                      <label className="flex min-w-0 flex-[1_1_13rem] flex-wrap items-center gap-2 font-medium text-stone-700">
                        Kích thước ảnh
                        <input
                          type="range"
                          min={MIN_QUESTION_IMAGE_WIDTH}
                          max={MAX_QUESTION_IMAGE_WIDTH}
                          value={activeQuestion.imageWidth ?? MAX_QUESTION_IMAGE_WIDTH}
                          aria-valuetext={activeQuestion.imageWidth === undefined ? 'Tự động' : activeQuestion.imageWidth + '%'}
                          disabled={illustrationBusy}
                          onChange={event => updateQ('imageWidth', event.currentTarget.valueAsNumber)}
                          className="min-w-24 flex-1 accent-amber-800"
                        />
                      </label>
                      <span className="w-10 text-right tabular-nums text-stone-700">
                        {activeQuestion.imageWidth === undefined ? '—' : activeQuestion.imageWidth + '%'}
                      </span>
                      <button type="button"
                        disabled={illustrationBusy || activeQuestion.imageWidth === undefined}
                        onClick={() => updateQ('imageWidth', undefined)}
                        className="rounded-md border border-stone-200 bg-white px-2 py-1 text-stone-700 hover:bg-amber-50 disabled:opacity-50">
                        Về tự động
                      </button>
                    </div>
                  )}

                  {tikzError && (
                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{tikzError}</span>
                    </div>
                  )}

                  {hasIllustration && (
                    <div className="mt-3 flex flex-col items-center rounded-lg border border-stone-200 bg-white p-3">
                      <div className="mb-2 flex items-center gap-1.5 self-start text-xs font-semibold text-amber-900">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Xem trước hình
                      </div>
                      {activeQuestion.imageSvg ? (
                        <div
                          className={'max-w-full overflow-x-auto flex justify-center [&>svg]:max-w-full [&>svg]:h-auto'
                            + (illustrationWidth ? ' [&>svg]:w-full' : '')}
                          style={illustrationWidth}
                          dangerouslySetInnerHTML={{ __html: activeQuestion.imageSvg }}
                        />
                      ) : (
                        <img src={imageUrl} alt="Hình minh họa câu hỏi" style={illustrationWidth} className="max-h-60 max-w-full object-contain" />
                      )}
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>

          {/* ── TỰ LUẬN: Lời giải chi tiết (1 ô duy nhất) ── */}
          {activeQuestion.type === 'tu_luan' && (
            <div className="space-y-3 rounded-xl border border-stone-200 bg-white p-3.5 shadow-sm sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-sm font-bold text-stone-900">
                  <Layers aria-hidden="true" className="size-4 text-amber-800" /> Lời giải chi tiết — {activeNumber}
                </h3>
                <span className="text-xs text-[#787774]">Tự động căn đều & nhận diện Text + LaTeX ($...$, $$...$$)</span>
              </div>
              <div className="rounded-lg border border-stone-200 p-2 focus-within:border-amber-600">
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
            <div className="space-y-3 rounded-xl border border-stone-200 bg-white p-3.5 shadow-sm sm:p-4">
              <h3 className="flex items-center gap-2 text-sm font-bold text-stone-900">
                <Layers aria-hidden="true" className="size-4 text-amber-800" /> 4 Mệnh đề Đúng / Sai — {activeNumber}
              </h3>

              {/* Khung dán nhanh 4 mệnh đề */}
              <div className="space-y-2 rounded-lg border border-stone-200 bg-stone-50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-stone-600">
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
                  rows={3}
                  style={{ minHeight: '90px' }}
                  className="w-full p-3 bg-white rounded-lg border border-[#E9E9E7] text-sm text-[#1A1A1A] placeholder:text-[#9B9A97] outline-none focus:border-[#1A1A1A] transition-colors resize-y leading-relaxed font-sans"
                  placeholder="Dán cụm 4 mệnh đề vào đây (VD: a) ... b) ... c) ... d) hoặc 4 dòng riêng). Chữ sẽ tự động nhảy vào từng ô bên dưới."
                  value={quickBatchInput}
                  onChange={e => handleBatchStatementsChange(e.target.value)}
                />
              </div>

              <div className="divide-y divide-stone-100 rounded-lg border border-stone-200">
                {activeQuestion.statements.map((st, si) => (
                  <StatementEditor key={si} st={st} si={si} onUpdate={updStatement} onFocus={trackFocus} />
                ))}
              </div>

              {/* 1 ô giải chung cho Đúng/Sai */}
              <div className="space-y-2 border-t border-stone-100 pt-3">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <div className="text-sm font-semibold text-stone-800">
                    Hướng dẫn giải chi tiết (chung cho 4 mệnh đề)
                  </div>
                  <span className="text-xs text-[#787774]">Hỗ trợ Text & LaTeX ($...$, $$...$$)</span>
                </div>
                <div className="rounded-lg border border-stone-200 p-2 focus-within:border-amber-600">
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
            <div className="space-y-3 rounded-xl border border-stone-200 bg-white p-3.5 shadow-sm sm:p-4">
              <h3 className="flex items-center gap-2 text-sm font-bold text-stone-900">
                <Layers aria-hidden="true" className="size-4 text-amber-800" /> 4 Phương án lựa chọn — {activeNumber}
              </h3>

              {/* Khung dán nhanh 4 đáp án */}
              <div className="bg-[#FAF9F6] border border-[#E9E9E7] rounded-xl p-3 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-stone-600">
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
                      className="min-w-0 flex-1 rounded-lg border p-2.5 text-sm outline-none focus:border-emerald-400"
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
                <div className="flex flex-wrap items-center justify-between gap-1">
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
        <div className="min-w-0 xl:sticky xl:top-20 xl:h-[calc(100dvh-7rem)]">
          <div className="flex h-full min-h-64 flex-col overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
            <div className="flex shrink-0 items-center justify-between border-b border-stone-100 bg-stone-50 px-3.5 py-3 sm:px-4">
              <h3 className="font-semibold text-[#1A1A1A] flex items-center gap-2">
                <Eye aria-hidden="true" className="size-4 text-amber-800" /> Xem trước kết quả
              </h3>
              {questions.length > 1 && <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-950">{activeNumber}</span>}
            </div>
            <div key={activeQIdx} className="min-w-0 flex-1 overflow-y-auto bg-stone-50 p-3.5 sm:p-4">
              {hasPreview ? (
                <SolutionQuestions questions={[previewQuestion]} />
              ) : (
                <div className="flex min-h-48 flex-col items-center justify-center gap-3 px-4 text-center text-stone-500">
                  <Eye aria-hidden="true" className="size-8" />
                  <p className="text-sm">Bắt đầu nhập liệu để xem trước...</p>
                </div>
              )}
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
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-stone-200 bg-white p-3 shadow-sm sm:p-4">
            {scopedLayout && publishControl}
            {blog && deleteBlog && (
              <button
                onClick={handleDelete}
                disabled={saving}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-red-50 text-red-600 border border-red-200 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" /> Xóa bài
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={illustrationBusy}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-amber-800 px-3.5 text-sm font-semibold text-white hover:bg-amber-900 disabled:opacity-60 sm:ml-auto"
            >
              <Save className="w-4 h-4" />
              {saving ? (uploadingSaveImages ? 'Đang tải hình…' : 'Đang lưu…') : (blog ? 'Cập nhật Lời Giải' : 'Đăng bài Lời Giải')}
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
                  <p className="text-xs text-[#787774]">Thêm <code>learning_outcomes</code> vào từng câu để nạp cả yêu cầu cần đạt.</p>
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
                        {parsedPreview.count > 1 && splitImportedQuestions
                          ? ` — Sẽ tự động tách thành ${parsedPreview.count} Cards riêng biệt`
                          : ' — Nạp vào cùng một bài'}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Textarea */}
              <div className="relative">
                <p className="mb-2 text-xs text-stone-600">
                  Bảng dùng <code>question_table</code>. Mỗi hàng trong <code>rows</code> có số ô bằng số tiêu đề trong <code>headers</code>.
                </p>
                <textarea
                  value={jsonInput}
                  onChange={e => setJsonInput(e.target.value)}
                  placeholder={`{\n  "exam_name": "Chuyên đề Từ trường...",\n  "questions": [\n    {\n      "questionNo": "Câu 1",\n      "type": "trac_nghiem",\n      "qText": "Nội dung câu hỏi...",\n      "learning_outcomes": ["Nêu được khái niệm từ trường"],\n      "choices": ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"],\n      "correctChoice": "A",\n      "solution": "Lời giải chi tiết...",\n      "tikzCode": "\\\\begin{tikzpicture}...\\\\end{tikzpicture}"\n    }\n  ]\n}`}
                  className="w-full h-80 p-3.5 rounded-xl font-mono text-xs bg-[#FAFAFA] border border-[#E9E9E7] text-[#1A1A1A] focus:outline-none focus:bg-white focus:border-[#2383E2] transition-colors resize-y leading-relaxed"
                  spellCheck={false}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-[#E9E9E7] bg-[#FAFAFA] flex items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowJsonModal(false)}
                disabled={importingJson}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#57564F] hover:bg-[#EFEFED] border border-[#E9E9E7] transition-colors disabled:opacity-50 cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={handleImportJson}
                disabled={!jsonInput.trim() || importingJson}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm cursor-pointer"
              >
                {importingJson ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Đang xử lý…
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    {parsedPreview && parsedPreview.count > 1 && splitImportedQuestions
                      ? `Tự động tách & Tạo ${parsedPreview.count} Cards`
                      : 'Nạp vào trình soạn'}
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
