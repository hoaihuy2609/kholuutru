import React, { useState, useRef, useCallback } from 'react';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import {
  Upload, FileText, Shuffle, Download, Eye, AlertCircle,
  CheckCircle2, Info, RefreshCw, Settings2, ArrowRight, X,
  FileSpreadsheet, Hash, ChevronDown, ChevronUp
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────
/** A single XML run (<w:r>) — smallest unit of formatted text */
interface XmlRun {
  raw: string;       // raw XML string of <w:r>...</w:r>
  text: string;      // plain text extracted
  bold: boolean;
  underline: boolean;
}

/** A single paragraph (<w:p>) */
interface XmlParagraph {
  raw: string;       // raw XML of entire <w:p>...</w:p>
  runs: XmlRun[];
  text: string;      // concatenated text of all runs
}

/** Layout of answers for a single question */
type AnswerLayout = '4-lines' | '2-lines' | '1-line';

/** A parsed answer option */
interface AnswerOption {
  label: string;           // 'A', 'B', 'C', 'D'
  /** All XML runs belonging to this answer (including the label run) */
  contentRuns: XmlRun[];
  isCorrect: boolean;
  text: string;            // plain text preview
}

/** A fully parsed question */
interface ParsedQuestion {
  index: number;           // 0-based index in original file
  /** XML paragraphs that form the question stem (before answers) */
  stemParagraphs: XmlParagraph[];
  answers: AnswerOption[];
  layout: AnswerLayout;
  /** Raw XML paragraphs that hold the answers (for layout reconstruction) */
  answerParagraphs: XmlParagraph[];
  stemText: string;        // plain text preview
}

/** Result of shuffling a single exam variant */
interface ShuffledExam {
  code: string;           // e.g. '001'
  questions: {
    originalIdx: number;
    newIdx: number;
    answerMapping: { originalLabel: string; newLabel: string }[];
    correctNewLabel: string;
  }[];
}

// ── XML Helpers ────────────────────────────────────────────────────────────

/** Extract all <w:p> from document XML body */
const extractParagraphs = (bodyXml: string): XmlParagraph[] => {
  const paragraphs: XmlParagraph[] = [];
  // Match <w:p ...>...</w:p> or self-closing <w:p/>
  const pRegex = /<w:p[\s>][\s\S]*?<\/w:p>/g;
  let pMatch;
  while ((pMatch = pRegex.exec(bodyXml)) !== null) {
    const pRaw = pMatch[0];
    const runs = extractRuns(pRaw);
    paragraphs.push({
      raw: pRaw,
      runs,
      text: runs.map(r => r.text).join(''),
    });
  }
  return paragraphs;
};

/** Extract all <w:r> from a paragraph */
const extractRuns = (paragraphXml: string): XmlRun[] => {
  const runs: XmlRun[] = [];
  const rRegex = /<w:r[\s>][\s\S]*?<\/w:r>/g;
  let rMatch;
  while ((rMatch = rRegex.exec(paragraphXml)) !== null) {
    const raw = rMatch[0];
    // Extract text from <w:t>
    const textParts: string[] = [];
    const tRegex = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
    let tMatch;
    while ((tMatch = tRegex.exec(raw)) !== null) {
      textParts.push(tMatch[1]);
    }
    const text = textParts.join('');

    // Check for bold: <w:b/> or <w:b w:val="true"/> — but NOT <w:bCs/> (complex script bold)
    const rPr = raw.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/)?.[1] || '';
    // Only match <w:b> tags that are NOT <w:bCs>
    const boldRaw = rPr.replace(/<w:bCs[^>]*\/?>/g, '').replace(/<\/w:bCs>/g, '');
    const bold = /<w:b\s*\/>/.test(boldRaw) ||
                 /<w:b\s+w:val\s*=\s*"(true|1)"/.test(boldRaw) ||
                 (/<w:b[\s>]/.test(boldRaw) && !/<w:b\s+w:val\s*=\s*"(false|0)"/.test(boldRaw));

    // Check for underline: <w:u w:val="single"/> etc — but NOT "none"
    const underline = (/<w:u\s/.test(rPr) && !/<w:u\s+w:val\s*=\s*"none"/.test(rPr)) ||
                      /<w:u\/>/.test(rPr);

    runs.push({ raw, text, bold, underline });
  }
  return runs;
};

/** Check if a paragraph text starts with a question marker like "Câu 1:" or "Câu 1." */
const isQuestionStart = (text: string): boolean => {
  return /^[\s]*[Cc][aâ]u\s+\d+/i.test(text.trim());
};

/** Check if text starts with an answer label (A. B. C. D.) */
const getAnswerLabel = (text: string): string | null => {
  const m = text.trim().match(/^([A-Da-d])\s*[.)]\s*/);
  return m ? m[1].toUpperCase() : null;
};

/** Detect if a set of runs is bold+underline (correct answer marker).
 *
 *  Strategy (in priority order):
 *  1. Any run is BOTH bold + underline → definitive correct answer
 *  2. The FIRST non-empty run (the label, e.g. "A.") is bold+underline → correct
 *  3. Fallback: any run is underline-only (in case teacher forgot bold) → correct
 *     but ONLY if there's exactly 1 underlined answer in the whole question (handled upstream)
 */
const isCorrectMarker = (runs: XmlRun[]): boolean => {
  const contentRuns = runs.filter(r => r.text.trim().length > 0);
  if (contentRuns.length === 0) return false;

  // Priority 1 & 2: any run with BOTH bold+underline → correct
  const hasBoldUnderline = contentRuns.some(r => r.bold && r.underline);
  if (hasBoldUnderline) return true;

  // Priority 3: fallback — first run (label) has underline only
  // This handles cases where teacher only applied underline without bold
  const firstRun = contentRuns[0];
  if (firstRun?.underline) return true;

  return false;
};

// ── Main Parser ────────────────────────────────────────────────────────────

const parseDocxQuestions = (paragraphs: XmlParagraph[]): ParsedQuestion[] => {
  const questions: ParsedQuestion[] = [];
  let currentStemParagraphs: XmlParagraph[] = [];
  let currentAnswerParagraphs: XmlParagraph[] = [];
  let currentAnswers: AnswerOption[] = [];
  let inQuestion = false;
  let questionIndex = 0;

  const finalizeQuestion = () => {
    if (!inQuestion || currentAnswers.length === 0) return;

    // Detect layout
    let layout: AnswerLayout = '4-lines';
    if (currentAnswerParagraphs.length === 1) {
      layout = '1-line';
    } else if (currentAnswerParagraphs.length === 2) {
      layout = '2-lines';
    } else {
      layout = '4-lines';
    }

    questions.push({
      index: questionIndex++,
      stemParagraphs: [...currentStemParagraphs],
      answers: [...currentAnswers],
      layout,
      answerParagraphs: [...currentAnswerParagraphs],
      stemText: currentStemParagraphs.map(p => p.text).join(' ').trim(),
    });

    currentStemParagraphs = [];
    currentAnswerParagraphs = [];
    currentAnswers = [];
  };

  for (const para of paragraphs) {
    const text = para.text.trim();
    if (!text) continue;

    // Check if this paragraph starts a new question
    if (isQuestionStart(text)) {
      // Finalize previous question if any
      finalizeQuestion();
      inQuestion = true;
      currentStemParagraphs = [para];
      continue;
    }

    if (!inQuestion) continue;

    // Try to find answer labels in this paragraph
    const answersInPara = findAnswersInParagraph(para);

    if (answersInPara.length > 0) {
      currentAnswerParagraphs.push(para);
      currentAnswers.push(...answersInPara);
    } else if (currentAnswers.length === 0) {
      // Still part of the stem (multi-paragraph question text)
      currentStemParagraphs.push(para);
    }
    // If we already have some answers but this paragraph has no label,
    // it might be a continuation — treat as stem overflow (rare case)
  }

  // Finalize last question
  finalizeQuestion();

  return questions;
};

/** Find answer options within a single paragraph (handles 1/2/4 answers per paragraph) */
const findAnswersInParagraph = (para: XmlParagraph): AnswerOption[] => {
  const answers: AnswerOption[] = [];
  const runs = para.runs;
  if (runs.length === 0) return answers;

  // Strategy: scan runs left-to-right, detect answer labels
  let currentLabel: string | null = null;
  let currentRuns: XmlRun[] = [];

  const finalizeAnswer = () => {
    if (currentLabel && currentRuns.length > 0) {
      const isCorrect = isCorrectMarker(currentRuns);
      answers.push({
        label: currentLabel,
        contentRuns: [...currentRuns],
        isCorrect,
        text: currentRuns.map(r => r.text).join('').trim(),
      });
    }
    currentRuns = [];
  };

  for (const run of runs) {
    const label = getAnswerLabel(run.text);
    if (label) {
      // Finalize previous answer if any
      finalizeAnswer();
      currentLabel = label;
      currentRuns = [run];
    } else if (currentLabel) {
      currentRuns.push(run);
    }
  }
  finalizeAnswer();

  return answers;
};

// ── Shuffler Algorithm ─────────────────────────────────────────────────────

/** Fisher-Yates shuffle */
const shuffleArray = <T,>(arr: T[]): T[] => {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

const LABELS = ['A', 'B', 'C', 'D'];

const generateShuffledExams = (
  questions: ParsedQuestion[],
  numExams: number,
  shuffleQuestions: boolean,
  shuffleAnswers: boolean
): ShuffledExam[] => {
  const exams: ShuffledExam[] = [];

  for (let e = 0; e < numExams; e++) {
    const code = String(e + 1).padStart(3, '0');
    const questionOrder = shuffleQuestions ? shuffleArray(questions.map((_, i) => i)) : questions.map((_, i) => i);

    const shuffledQuestions = questionOrder.map((origIdx, newIdx) => {
      const q = questions[origIdx];
      const answerOrder = shuffleAnswers ? shuffleArray([0, 1, 2, 3].slice(0, q.answers.length)) : q.answers.map((_, i) => i);

      const mapping = answerOrder.map((origAnsIdx, newAnsIdx) => ({
        originalLabel: q.answers[origAnsIdx].label,
        newLabel: LABELS[newAnsIdx],
      }));

      // Find which new label is correct
      const correctOrigIdx = q.answers.findIndex(a => a.isCorrect);
      const correctNewLabel = correctOrigIdx >= 0
        ? mapping.find(m => m.originalLabel === q.answers[correctOrigIdx].label)?.newLabel || '?'
        : '?';

      return {
        originalIdx: origIdx,
        newIdx,
        answerMapping: mapping,
        correctNewLabel,
      };
    });

    exams.push({ code, questions: shuffledQuestions });
  }

  return exams;
};

// ── DOCX Builder ───────────────────────────────────────────────────────────

/** Build a new document.xml body from shuffled exam data */
const buildShuffledDocumentXml = (
  originalDocXml: string,
  originalParagraphs: XmlParagraph[],
  questions: ParsedQuestion[],
  shuffledExam: ShuffledExam,
  examCode: string
): string => {
  // Extract everything before <w:body> content and after it
  const bodyStartMatch = originalDocXml.match(/<w:body[^>]*>/);
  const bodyEndIdx = originalDocXml.lastIndexOf('</w:body>');
  if (!bodyStartMatch || bodyEndIdx === -1) return originalDocXml;

  const beforeBody = originalDocXml.substring(0, bodyStartMatch.index! + bodyStartMatch[0].length);
  const afterBody = originalDocXml.substring(bodyEndIdx);

  // Build new body content
  let newBodyParagraphs: string[] = [];

  // Add a header paragraph with exam code
  newBodyParagraphs.push(buildExamCodeHeader(examCode));

  // Add each shuffled question
  for (const sq of shuffledExam.questions) {
    const origQ = questions[sq.originalIdx];

    // Renumber the question stem
    const stemParas = origQ.stemParagraphs.map(p => {
      let raw = p.raw;
      // Replace "Câu X:" with new numbering
      raw = raw.replace(
        /([Cc][aâ]u\s+)\d+/,
        `$1${sq.newIdx + 1}`
      );
      return raw;
    });
    newBodyParagraphs.push(...stemParas);

    // Build answer paragraphs with shuffled order, preserving layout
    const answerParas = buildShuffledAnswerParagraphs(origQ, sq.answerMapping);
    newBodyParagraphs.push(...answerParas);
  }

  return beforeBody + '\n' + newBodyParagraphs.join('\n') + '\n' + afterBody;
};

/** Build the exam code header paragraph */
const buildExamCodeHeader = (code: string): string => {
  return `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="28"/></w:rPr><w:t xml:space="preserve">Mã đề: ${code}</w:t></w:r></w:p>`;
};

/** Build shuffled answer paragraphs preserving the original layout */
const buildShuffledAnswerParagraphs = (
  question: ParsedQuestion,
  answerMapping: { originalLabel: string; newLabel: string }[]
): string[] => {
  const { layout, answers, answerParagraphs } = question;

  // Create reordered answers: answerMapping[i] says "new position i gets original label X"
  const reorderedAnswers = answerMapping.map(m => {
    const origAnswer = answers.find(a => a.label === m.originalLabel)!;
    return {
      ...origAnswer,
      newLabel: m.newLabel,
    };
  });

  if (layout === '4-lines') {
    // Each answer on its own paragraph
    return reorderedAnswers.map(ans => {
      return buildAnswerParagraph(ans.newLabel, ans.contentRuns, answerParagraphs[0]?.raw);
    });
  } else if (layout === '2-lines') {
    // 2 answers per paragraph
    const paras: string[] = [];
    for (let i = 0; i < reorderedAnswers.length; i += 2) {
      const pair = reorderedAnswers.slice(i, i + 2);
      paras.push(buildMultiAnswerParagraph(pair, answerParagraphs[Math.floor(i / 2)]?.raw));
    }
    return paras;
  } else {
    // 1-line: all answers in one paragraph
    return [buildMultiAnswerParagraph(reorderedAnswers, answerParagraphs[0]?.raw)];
  }
};

/** Build a single-answer paragraph */
const buildAnswerParagraph = (
  label: string,
  contentRuns: XmlRun[],
  templateParaXml?: string
): string => {
  // Extract paragraph properties from template if available
  let pPr = '';
  if (templateParaXml) {
    const pPrMatch = templateParaXml.match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
    if (pPrMatch) pPr = pPrMatch[0];
  }

  // Build runs: first run has the new label, rest are content (stripped of bold/underline)
  const labelRun = buildCleanRun(contentRuns[0], label);
  const otherRuns = contentRuns.slice(1).map(r => stripBoldUnderline(r.raw));

  return `<w:p>${pPr}${labelRun}${otherRuns.join('')}</w:p>`;
};

/** Build a multi-answer paragraph (2 or 4 answers on same line) */
const buildMultiAnswerParagraph = (
  answers: { newLabel: string; contentRuns: XmlRun[] }[],
  templateParaXml?: string
): string => {
  let pPr = '';
  if (templateParaXml) {
    const pPrMatch = templateParaXml.match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
    if (pPrMatch) pPr = pPrMatch[0];
  }

  let allRuns = '';
  for (let i = 0; i < answers.length; i++) {
    const ans = answers[i];
    // Add tab separator between answers (except first)
    if (i > 0) {
      allRuns += `<w:r><w:tab/></w:r>`;
    }
    const labelRun = buildCleanRun(ans.contentRuns[0], ans.newLabel);
    const otherRuns = ans.contentRuns.slice(1).map(r => stripBoldUnderline(r.raw));
    allRuns += labelRun + otherRuns.join('');
  }

  return `<w:p>${pPr}${allRuns}</w:p>`;
};

/** Build a clean run with new label text, stripping bold/underline */
const buildCleanRun = (templateRun: XmlRun, newLabel: string): string => {
  let raw = templateRun.raw;
  // Strip bold and underline from rPr
  raw = stripBoldUnderline(raw);
  // Replace the label text (A., B., etc.) with new label
  raw = raw.replace(
    /(<w:t[^>]*>)\s*[A-Da-d]\s*([.)]\s*)/,
    `$1${newLabel}$2`
  );
  return raw;
};

/** Remove bold and underline formatting from a run's XML */
const stripBoldUnderline = (runXml: string): string => {
  let result = runXml;
  // Remove <w:b/> or <w:b .../>
  result = result.replace(/<w:b\s*\/>/g, '');
  result = result.replace(/<w:b[^\/]*>[\s\S]*?<\/w:b>/g, '');
  result = result.replace(/<w:b\s[^>]*\/>/g, '');
  // Remove <w:u .../> or <w:u/>
  result = result.replace(/<w:u\s*\/>/g, '');
  result = result.replace(/<w:u\s[^>]*\/>/g, '');
  result = result.replace(/<w:u[^\/]*>[\s\S]*?<\/w:u>/g, '');
  return result;
};

// ── Answer Key Excel Builder ───────────────────────────────────────────────

const buildAnswerKeyExcel = (
  exams: ShuffledExam[],
  totalQuestions: number
): Uint8Array => {
  const wb = XLSX.utils.book_new();

  // Sheet 1: All answer keys
  const headers = ['Câu', ...exams.map(e => `Mã đề ${e.code}`)];
  const rows: (string | number)[][] = [];

  for (let q = 0; q < totalQuestions; q++) {
    const row: (string | number)[] = [q + 1];
    for (const exam of exams) {
      const sq = exam.questions[q];
      row.push(sq ? sq.correctNewLabel : '?');
    }
    rows.push(row);
  }

  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws['!cols'] = [
    { wch: 6 },
    ...exams.map(() => ({ wch: 12 })),
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Đáp án');

  return new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }));
};

// ── Main Component ─────────────────────────────────────────────────────────

const ExamShuffler: React.FC<{ onShowToast: (msg: string, type: 'success' | 'error' | 'warning') => void }> = ({ onShowToast }) => {
  // State
  const [file, setFile] = useState<File | null>(null);
  const [zipData, setZipData] = useState<JSZip | null>(null);
  const [documentXml, setDocumentXml] = useState<string>('');
  const [questions, setQuestions] = useState<ParsedQuestion[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [parseError, setParseError] = useState<string>('');

  // Settings
  const [numExams, setNumExams] = useState(4);
  const [shuffleQ, setShuffleQ] = useState(true);
  const [shuffleA, setShuffleA] = useState(true);

  // Preview
  const [showPreview, setShowPreview] = useState(false);
  const [previewExams, setPreviewExams] = useState<ShuffledExam[]>([]);
  const [previewExamIdx, setPreviewExamIdx] = useState(0);

  // Collapsible question list
  const [expandedQ, setExpandedQ] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── File Import ──
  const handleFile = useCallback(async (f: File) => {
    if (!f) return;
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (ext !== 'docx') {
      onShowToast('Chỉ hỗ trợ file .docx (Word 2007+). File .doc không được hỗ trợ.', 'error');
      return;
    }

    setIsParsing(true);
    setParseError('');
    setQuestions([]);
    setFile(f);

    try {
      const arrayBuffer = await f.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);
      const docXmlFile = zip.file('word/document.xml');
      if (!docXmlFile) {
        throw new Error('Không tìm thấy document.xml trong file Word.');
      }

      const docXml = await docXmlFile.async('string');
      setZipData(zip);
      setDocumentXml(docXml);

      // Extract body content
      const bodyMatch = docXml.match(/<w:body[^>]*>([\s\S]*?)<\/w:body>/);
      if (!bodyMatch) {
        throw new Error('Không tìm thấy nội dung (body) trong file Word.');
      }

      const bodyXml = bodyMatch[1];
      const paragraphs = extractParagraphs(bodyXml);
      const parsed = parseDocxQuestions(paragraphs);

      if (parsed.length === 0) {
        throw new Error('Không tìm thấy câu hỏi nào trong file. Đảm bảo mỗi câu bắt đầu bằng "Câu X:" hoặc "Câu X."');
      }

      // Validate: check for correct answer marking
      const noCorrect = parsed.filter(q => !q.answers.some(a => a.isCorrect));
      if (noCorrect.length > 0) {
        const nums = noCorrect.slice(0, 5).map(q => q.index + 1).join(', ');
        console.warn(`[ExamShuffler] Câu chưa đánh dấu đáp án đúng: ${nums}`);
      }

      setQuestions(parsed);
      onShowToast(`Đã nhận diện ${parsed.length} câu hỏi từ file "${f.name}"!`, 'success');
    } catch (err: any) {
      setParseError(err.message || 'Lỗi không xác định');
      onShowToast('Lỗi đọc file: ' + err.message, 'error');
    } finally {
      setIsParsing(false);
    }
  }, [onShowToast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }, [handleFile]);

  // ── Preview ──
  const handlePreview = () => {
    const exams = generateShuffledExams(questions, numExams, shuffleQ, shuffleA);
    setPreviewExams(exams);
    setPreviewExamIdx(0);
    setShowPreview(true);
  };

  // ── Export ──
  const handleExport = async () => {
    if (!zipData || !documentXml || questions.length === 0) return;

    setIsExporting(true);
    try {
      const exams = generateShuffledExams(questions, numExams, shuffleQ, shuffleA);

      // Extract paragraphs from original doc for building
      const bodyMatch = documentXml.match(/<w:body[^>]*>([\s\S]*?)<\/w:body>/);
      const bodyXml = bodyMatch?.[1] || '';
      const originalParagraphs = extractParagraphs(bodyXml);

      const outputZip = new JSZip();

      for (const exam of exams) {
        // Clone the original zip
        const examZip = new JSZip();
        for (const [path, zipEntry] of Object.entries(zipData.files)) {
          if (zipEntry.dir) {
            examZip.folder(path);
          } else if (path === 'word/document.xml') {
            // Replace document.xml with shuffled version
            const newDocXml = buildShuffledDocumentXml(
              documentXml,
              originalParagraphs,
              questions,
              exam,
              exam.code
            );
            examZip.file(path, newDocXml);
          } else {
            const content = await zipEntry.async('uint8array');
            examZip.file(path, content);
          }
        }

        const examBuffer = await examZip.generateAsync({ type: 'uint8array' });
        const baseName = file!.name.replace(/\.docx$/i, '');
        outputZip.file(`Ma_de_${exam.code}.docx`, examBuffer);
      }

      // Add answer key Excel
      const answerKeyData = buildAnswerKeyExcel(exams, questions.length);
      outputZip.file('Dap_an_tat_ca_ma_de.xlsx', answerKeyData);

      // Generate and download
      const finalZip = await outputZip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(finalZip);
      const a = document.createElement('a');
      a.href = url;
      const baseName = file!.name.replace(/\.docx$/i, '');
      a.download = `${baseName}_${numExams}_ma_de.zip`;
      a.click();
      URL.revokeObjectURL(url);

      onShowToast(`Đã xuất ${numExams} mã đề + file đáp án thành công!`, 'success');
    } catch (err: any) {
      onShowToast('Lỗi xuất file: ' + err.message, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // ── Reset ──
  const handleReset = () => {
    if (file && !window.confirm('Bỏ file hiện tại và chọn file khác?')) return;
    setFile(null);
    setZipData(null);
    setDocumentXml('');
    setQuestions([]);
    setParseError('');
    setShowPreview(false);
    setPreviewExams([]);
  };

  const hasFile = file !== null && questions.length > 0;
  const noCorrectCount = questions.filter(q => !q.answers.some(a => a.isCorrect)).length;

  // ── Render ──
  return (
    <div className="space-y-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="rounded-xl p-5 flex items-start gap-4" style={{ background: '#EEF0FB', border: '1px solid #C8D0F5' }}>
        <div className="p-2.5 rounded-xl shrink-0" style={{ background: '#6B7CDB' }}>
          <Shuffle className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-base font-semibold" style={{ color: '#1A1A1A' }}>Trộn Đề Thi Trắc Nghiệm</h2>
          <p className="text-sm mt-0.5" style={{ color: '#57564F' }}>
            Upload file Word đề gốc → Tự động trộn câu hỏi & đáp án → Tải về nhiều mã đề + bảng đáp án.
          </p>
          <div className="flex items-center gap-3 mt-2 text-xs" style={{ color: '#787774' }}>
            <span className="flex items-center gap-1"><span className="font-bold" style={{ color: '#6B7CDB' }}>1.</span> Upload .docx</span>
            <ArrowRight className="w-3 h-3" />
            <span className="flex items-center gap-1"><span className="font-bold" style={{ color: '#6B7CDB' }}>2.</span> Cấu hình</span>
            <ArrowRight className="w-3 h-3" />
            <span className="flex items-center gap-1"><span className="font-bold" style={{ color: '#6B7CDB' }}>3.</span> Xem trước & Xuất</span>
          </div>
        </div>
      </div>

      {/* Format guide */}
      <div className="rounded-xl p-4 flex items-start gap-3" style={{ background: '#FFF7ED', border: '1px solid #FDDBA0' }}>
        <Info className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#D9730D' }} />
        <div className="text-xs space-y-1" style={{ color: '#8B5E34' }}>
          <p className="font-semibold">Hướng dẫn soạn đề gốc:</p>
          <ul className="list-disc ml-4 space-y-0.5">
            <li>Mỗi câu bắt đầu bằng <b>"Câu 1:"</b>, <b>"Câu 2:"</b>... (hoặc "Câu 1.", "Câu 2.")</li>
            <li>Đáp án bắt đầu bằng <b>A.</b>, <b>B.</b>, <b>C.</b>, <b>D.</b> (hoặc A), B), C), D))</li>
            <li>Đáp án đúng: <b className="underline">in đậm + gạch chân</b> để phân biệt</li>
            <li>Hỗ trợ đáp án 4 hàng, 2 hàng, hoặc 1 hàng — giữ nguyên layout khi xuất</li>
          </ul>
        </div>
      </div>

      {/* ── STEP 1: Upload file ── */}
      {!hasFile && !isParsing && (
        <div
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className="rounded-xl transition-all duration-200"
          style={{
            border: `2px dashed ${isDragging ? '#6B7CDB' : '#D0D5F7'}`,
            background: isDragging ? '#EEF0FB' : '#FAFAF9',
            padding: '48px 24px',
          }}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: '#EEF0FB' }}>
              <Upload className="w-7 h-7" style={{ color: '#6B7CDB' }} />
            </div>
            <div className="text-center">
              <p className="text-base font-semibold" style={{ color: '#1A1A1A' }}>
                Kéo thả file đề thi vào đây
              </p>
              <p className="text-sm mt-1" style={{ color: '#787774' }}>
                Chỉ hỗ trợ file <b>.docx</b> (Word 2007 trở lên)
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div style={{ height: '1px', width: '60px', background: '#E9E9E7' }} />
              <span className="text-xs" style={{ color: '#AEACA8' }}>hoặc</span>
              <div style={{ height: '1px', width: '60px', background: '#E9E9E7' }} />
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = '';
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
              style={{ background: '#6B7CDB', color: '#fff' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#5a6bc9'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#6B7CDB'}
            >
              <FileText className="w-4 h-4" />
              Chọn file Word từ máy tính
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {isParsing && (
        <div className="rounded-xl p-12 flex flex-col items-center gap-4" style={{ background: '#fff', border: '1px solid #E9E9E7' }}>
          <RefreshCw className="w-8 h-8 animate-spin" style={{ color: '#6B7CDB' }} />
          <p className="text-sm font-medium" style={{ color: '#787774' }}>Đang phân tích file Word...</p>
        </div>
      )}

      {/* Parse Error */}
      {parseError && !isParsing && (
        <div className="rounded-xl p-5 flex items-start gap-3" style={{ background: '#FEF0F0', border: '1px solid #F5C2C2' }}>
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: '#E03E3E' }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: '#E03E3E' }}>Lỗi phân tích file</p>
            <p className="text-sm mt-1" style={{ color: '#9B3F3F' }}>{parseError}</p>
            <button
              onClick={handleReset}
              className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{ color: '#787774', border: '1px solid #E9E9E7' }}
            >
              <RefreshCw className="w-3.5 h-3.5" /> Thử lại
            </button>
          </div>
        </div>
      )}

      {/* ── AFTER PARSE: Settings + Preview + Export ── */}
      {hasFile && (
        <>
          {/* File info */}
          <div className="rounded-xl p-4 flex items-center justify-between gap-3" style={{ background: '#fff', border: '1px solid #E9E9E7' }}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ background: '#EAF3EE' }}>
                <FileText className="w-4 h-4" style={{ color: '#448361' }} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>{file!.name}</p>
                <p className="text-xs mt-0.5" style={{ color: '#787774' }}>
                  <span style={{ color: '#448361', fontWeight: 600 }}>{questions.length}</span> câu hỏi đã nhận diện
                  {noCorrectCount > 0 && (
                    <span style={{ color: '#D9730D' }}> · {noCorrectCount} câu chưa đánh dấu đáp án đúng</span>
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{ color: '#787774', border: '1px solid #E9E9E7' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F1F0EC'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
            >
              <RefreshCw className="w-3.5 h-3.5" /> Đổi file
            </button>
          </div>

          {/* Warning if some questions have no correct answer */}
          {noCorrectCount > 0 && (
            <div className="rounded-xl p-4 flex items-start gap-3" style={{ background: '#FFF3E8', border: '1px solid #FDDBA0' }}>
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#D9730D' }} />
              <div className="text-xs" style={{ color: '#8B5E34' }}>
                <p className="font-semibold">Cảnh báo: {noCorrectCount}/{questions.length} câu chưa có đáp án đúng</p>
                <p className="mt-0.5">Đáp án đúng cần được <b className="underline">in đậm + gạch chân</b> trong file Word gốc. Các câu chưa đánh dấu sẽ hiển thị "?" trong bảng đáp án.</p>
              </div>
            </div>
          )}

          {/* Questions preview (collapsible list) */}
          <div className="rounded-xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E9E9E7' }}>
            <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #E9E9E7', background: '#FAFAF9' }}>
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#AEACA8' }}>
                Danh sách câu hỏi đã nhận diện
              </span>
              <span className="text-xs" style={{ color: '#787774' }}>
                {questions.filter(q => q.answers.some(a => a.isCorrect)).length}/{questions.length} câu có đáp án đúng
              </span>
            </div>
            <div className="max-h-80 overflow-y-auto custom-scrollbar">
              {questions.map((q, idx) => {
                const hasCorrect = q.answers.some(a => a.isCorrect);
                const correctAns = q.answers.find(a => a.isCorrect);
                const isExpanded = expandedQ === idx;

                return (
                  <div key={idx} style={{ borderBottom: '1px solid #F1F0EC' }}>
                    <button
                      onClick={() => setExpandedQ(isExpanded ? null : idx)}
                      className="w-full px-5 py-3 flex items-center gap-3 text-left transition-colors"
                      style={{ background: isExpanded ? '#FAFAF9' : 'transparent' }}
                      onMouseEnter={e => { if (!isExpanded) (e.currentTarget as HTMLElement).style.background = '#FAFAF9'; }}
                      onMouseLeave={e => { if (!isExpanded) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      <span className="text-xs font-mono px-2 py-0.5 rounded shrink-0"
                        style={{ background: hasCorrect ? '#EAF3EE' : '#FFF3E8', color: hasCorrect ? '#448361' : '#D9730D' }}>
                        {idx + 1}
                      </span>
                      <span className="text-sm flex-1 truncate" style={{ color: '#1A1A1A' }}>
                        {q.stemText.substring(0, 120)}{q.stemText.length > 120 ? '...' : ''}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        {hasCorrect && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                            style={{ background: '#EAF3EE', color: '#448361' }}>
                            ĐÁ: {correctAns?.label}
                          </span>
                        )}
                        <span className="text-[10px] px-1.5 py-0.5 rounded"
                          style={{ background: '#F1F0EC', color: '#787774' }}>
                          {q.layout === '4-lines' ? '4 hàng' : q.layout === '2-lines' ? '2 hàng' : '1 hàng'}
                        </span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" style={{ color: '#AEACA8' }} /> : <ChevronDown className="w-3.5 h-3.5" style={{ color: '#AEACA8' }} />}
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="px-5 pb-3 pl-14 space-y-1">
                        {q.answers.map(a => (
                          <div key={a.label} className="flex items-center gap-2 text-sm" style={{ color: a.isCorrect ? '#448361' : '#57564F' }}>
                            {a.isCorrect ? (
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: '#448361' }} />
                            ) : (
                              <span className="w-3.5 h-3.5 shrink-0 rounded-full" style={{ border: '1.5px solid #E9E9E7' }} />
                            )}
                            <span style={{ fontWeight: a.isCorrect ? 600 : 400 }}>
                              {a.label}. {a.text.replace(/^[A-Da-d]\s*[.)]\s*/, '')}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Settings */}
          <div className="rounded-xl p-5 space-y-5" style={{ background: '#fff', border: '1px solid #E9E9E7' }}>
            <div className="flex items-center gap-2">
              <Settings2 className="w-4 h-4" style={{ color: '#6B7CDB' }} />
              <span className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>Cấu hình trộn đề</span>
            </div>

            {/* Number of exam codes */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-sm font-medium" style={{ color: '#1A1A1A' }}>Số lượng mã đề</p>
                <p className="text-xs mt-0.5" style={{ color: '#787774' }}>Mỗi mã đề là 1 file Word riêng biệt</p>
              </div>
              <div className="flex items-center gap-2">
                {[2, 4, 6, 8].map(n => (
                  <button
                    key={n}
                    onClick={() => setNumExams(n)}
                    className="w-10 h-10 rounded-lg text-sm font-semibold transition-all"
                    style={{
                      background: numExams === n ? '#6B7CDB' : '#F7F6F3',
                      color: numExams === n ? '#fff' : '#787774',
                      border: `1px solid ${numExams === n ? '#6B7CDB' : '#E9E9E7'}`,
                    }}
                  >
                    {n}
                  </button>
                ))}
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={numExams}
                  onChange={e => setNumExams(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                  className="w-16 h-10 rounded-lg text-center text-sm font-semibold"
                  style={{ background: '#F7F6F3', border: '1px solid #E9E9E7', color: '#1A1A1A', outline: 'none' }}
                  onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = '#6B7CDB'}
                  onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = '#E9E9E7'}
                />
              </div>
            </div>

            {/* Shuffle toggles */}
            <div className="flex gap-4 flex-wrap" style={{ borderTop: '1px solid #F1F0EC', paddingTop: '16px' }}>
              <label className="flex items-center gap-3 cursor-pointer select-none flex-1 min-w-[200px] p-3 rounded-lg transition-colors"
                style={{ background: shuffleQ ? '#EEF0FB' : '#F7F6F3', border: `1px solid ${shuffleQ ? '#C8D0F5' : '#E9E9E7'}` }}>
                <input type="checkbox" checked={shuffleQ} onChange={e => setShuffleQ(e.target.checked)}
                  className="w-4 h-4 accent-[#6B7CDB]" />
                <div>
                  <p className="text-sm font-medium" style={{ color: '#1A1A1A' }}>Trộn thứ tự câu hỏi</p>
                  <p className="text-xs" style={{ color: '#787774' }}>Câu 1 ở đề này có thể là Câu 5 ở đề khác</p>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer select-none flex-1 min-w-[200px] p-3 rounded-lg transition-colors"
                style={{ background: shuffleA ? '#EEF0FB' : '#F7F6F3', border: `1px solid ${shuffleA ? '#C8D0F5' : '#E9E9E7'}` }}>
                <input type="checkbox" checked={shuffleA} onChange={e => setShuffleA(e.target.checked)}
                  className="w-4 h-4 accent-[#6B7CDB]" />
                <div>
                  <p className="text-sm font-medium" style={{ color: '#1A1A1A' }}>Trộn thứ tự đáp án A/B/C/D</p>
                  <p className="text-xs" style={{ color: '#787774' }}>Đáp án A ở đề gốc có thể thành C ở đề khác</p>
                </div>
              </label>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <button
              onClick={handlePreview}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
              style={{ background: '#fff', color: '#6B7CDB', border: '1px solid #C8D0F5' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#EEF0FB'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#fff'}
            >
              <Eye className="w-4 h-4" />
              Xem trước bảng đáp án
            </button>
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors"
              style={{
                background: isExporting ? '#AEACA8' : '#448361',
                cursor: isExporting ? 'not-allowed' : 'pointer',
              }}
              onMouseEnter={e => { if (!isExporting) (e.currentTarget as HTMLElement).style.background = '#376a50'; }}
              onMouseLeave={e => { if (!isExporting) (e.currentTarget as HTMLElement).style.background = '#448361'; }}
            >
              {isExporting ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Đang xuất...</>
              ) : (
                <><Download className="w-4 h-4" /> Xuất {numExams} mã đề (.zip)</>
              )}
            </button>
          </div>

          {/* Preview Modal */}
          {showPreview && previewExams.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E9E9E7' }}>
              <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #E9E9E7', background: '#FAFAF9' }}>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#AEACA8' }}>
                    Xem trước bảng đáp án
                  </span>
                  <div className="flex items-center gap-1">
                    {previewExams.map((exam, idx) => (
                      <button
                        key={exam.code}
                        onClick={() => setPreviewExamIdx(idx)}
                        className="px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all"
                        style={{
                          background: previewExamIdx === idx ? '#6B7CDB' : '#F7F6F3',
                          color: previewExamIdx === idx ? '#fff' : '#787774',
                          border: `1px solid ${previewExamIdx === idx ? '#6B7CDB' : '#E9E9E7'}`,
                        }}
                      >
                        Đề {exam.code}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => setShowPreview(false)}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: '#787774' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F1F0EC'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr style={{ background: '#FAFAF9' }}>
                      {['Câu', 'Đáp án đúng', 'Gốc → Mới'].map(h => (
                        <th key={h} className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider"
                          style={{ color: '#AEACA8', borderBottom: '1px solid #E9E9E7' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewExams[previewExamIdx].questions.map(sq => (
                      <tr key={sq.newIdx} style={{ borderBottom: '1px solid #F1F0EC' }}>
                        <td className="px-5 py-2.5">
                          <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: '#F1F0EC', color: '#787774' }}>
                            {sq.newIdx + 1}
                          </span>
                        </td>
                        <td className="px-5 py-2.5">
                          <span className="text-sm font-bold px-2.5 py-1 rounded-lg"
                            style={{
                              background: sq.correctNewLabel === '?' ? '#FFF3E8' : '#EAF3EE',
                              color: sq.correctNewLabel === '?' ? '#D9730D' : '#448361',
                            }}>
                            {sq.correctNewLabel}
                          </span>
                        </td>
                        <td className="px-5 py-2.5">
                          <span className="text-xs font-mono" style={{ color: '#AEACA8' }}>
                            Câu gốc {sq.originalIdx + 1} → {sq.answerMapping.map(m => `${m.originalLabel}→${m.newLabel}`).join('  ')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ExamShuffler;
