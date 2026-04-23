import React, { useState, useRef, useCallback, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  Mic, MicOff, Download, RefreshCw,
  Volume2, CheckCircle2, AlertCircle, FileSpreadsheet,
  RotateCcw, Info, Upload, FileText, ArrowRight, Settings2, ChevronRight
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

interface StudentRow {
  stt: number;
  name: string;
  /** key = column header, value = score string ('' if empty) */
  scores: Record<string, string>;
  highlight?: boolean;
}

/** Cấu trúc file gốc */
interface ImportedFile {
  type: 'csv' | 'xlsx';
  csvLines?: string[];
  csvDelimiter?: string;
  xlsxWorkbook?: XLSX.WorkBook;
  xlsxSheetName?: string;
  headerRowIdx: number;
  nameColIdx: number;
  /** All column headers from file */
  allHeaders: string[];
  /** Indices of score columns that user selected */
  scoreColIndices: number[];
  originalFileName: string;
}

interface ColumnMapping {
  nameColIdx: number;
  scoreColIndices: number[];
}

/** Active cell in the grid */
interface ActiveCell {
  studentIdx: number; // index in students[]
  colKey: string;     // column header
}

// ── Web Speech API type shim ───────────────────────────────────────────────
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}
interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
  length: number;
}
interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
  length: number;
}
interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
  }
}
interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: Event) => void) | null;
  onend: (() => void) | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * 3-layer Vietnamese score parser:
 * Layer 1: Normalize special words
 * Layer 2: Parse to float
 * Layer 3: Validate context (0–10 scale)
 */
const parseVietnameseScore = (text: string): number | null => {
  let t = text.toLowerCase().trim();

  // Layer 1: Normalize special words → digits/symbols
  const replacements: [RegExp, string][] = [
    [/\bmười\b/g, '10'],
    [/\bchín\b/g, '9'],
    [/\btám\b/g, '8'],
    [/\bbảy\b/g, '7'],
    [/\bsáu\b/g, '6'],
    [/\bnăm\b/g, '5'],
    [/\bbốn\b/g, '4'],
    [/\bba\b/g, '3'],
    [/\bhai\b/g, '2'],
    [/\bmột\b/g, '1'],
    [/\bkhông\b/g, '0'],
    // Decimal separators
    [/\bphẩy\b|\bphảy\b|\bchấm\b/g, '.'],
    // "rưỡi" → ".5" (appended to the preceding digit)
    [/\s*rưỡi\b/g, '.5'],
    // "lăm" after a dot → "5"  (e.g. "bảy phẩy lăm" → "7.5")
    [/\.\s*lăm\b/g, '.5'],
    // "lăm" standalone after a digit (e.g. "bảy lăm" → "7.5")
    [/(\d)\s+lăm\b/g, '$1.5'],
    // "hai lăm" after a dot → ".25"
    [/\.\s*hai\s+lăm\b/g, '.25'],
    // "bảy lăm" after a dot → ".75"
    [/\.\s*bảy\s+lăm\b/g, '.75'],
    // Remove remaining noise words
    [/\bđiểm\b|\bđ\b/g, ''],
    [/,/g, '.'],
  ];

  for (const [pattern, replacement] of replacements) {
    t = t.replace(pattern, replacement);
  }

  // Collapse multiple spaces
  t = t.replace(/\s+/g, ' ').trim();

  // Layer 2: Extract first valid number pattern
  const match = t.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const val = parseFloat(match[1]);

  // Layer 3: Validate context
  if (isNaN(val) || val < 0 || val > 10) {
    // Ambiguous: e.g. "bảy lăm" → "75" → out of range → try as 7.5
    if (val > 10 && val < 100) {
      const s = String(Math.round(val));
      // Try split at position 1: "75" → 7 and 5 → 7.5
      const intPart = parseInt(s[0]);
      const decPart = parseInt(s.slice(1));
      if (!isNaN(intPart) && !isNaN(decPart) && intPart <= 10 && decPart <= 9) {
        const candidate = parseFloat(`${intPart}.${decPart}`);
        if (candidate >= 0 && candidate <= 10) return Math.round(candidate * 100) / 100;
      }
    }
    return null;
  }
  return Math.round(val * 100) / 100;
};

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();

const detectDelimiter = (line: string): string => {
  const counts = { ',': 0, '\t': 0, ';': 0 };
  for (const char of line) {
    if (char in counts) counts[char as keyof typeof counts]++;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
};

const parseCsvLine = (line: string, delimiter: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
};

const MAPPING_STORAGE_KEY = 'voiceGrader_columnMapping_v2';

// ── Main Component ─────────────────────────────────────────────────────────
const VoiceGrader: React.FC<{ onShowToast: (msg: string, type: 'success' | 'error' | 'warning') => void }> = ({ onShowToast }) => {

  // ── State ──
  const [step, setStep] = useState<'upload' | 'mapping' | 'grading'>('upload');
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [rawFile, setRawFile] = useState<{ type: 'csv' | 'xlsx'; fileName: string; csvLines?: string[]; csvDelimiter?: string; xlsxWorkbook?: XLSX.WorkBook; xlsxSheetName?: string; headerRowIdx: number; allHeaders: string[] } | null>(null);

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [importedFile, setImportedFile] = useState<ImportedFile | null>(null);

  // Mapping step state
  const [nameColIdx, setNameColIdx] = useState<number>(-1);
  const [selectedScoreCols, setSelectedScoreCols] = useState<number[]>([]);

  // Voice
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [lastCommand, setLastCommand] = useState('');
  const [activeCell, setActiveCell] = useState<ActiveCell | null>(null);

  const [isDragging, setIsDragging] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const studentsRef = useRef<StudentRow[]>([]);
  const activeCellRef = useRef<ActiveCell | null>(null);
  const importedFileRef = useRef<ImportedFile | null>(null);
  const activeTrRef = useRef<HTMLTableRowElement | null>(null);

  studentsRef.current = students;
  activeCellRef.current = activeCell;
  importedFileRef.current = importedFile;

  // Derived
  const scoreColKeys: string[] = importedFile
    ? importedFile.scoreColIndices.map(i => importedFile.allHeaders[i])
    : [];
  const totalCells = students.length * scoreColKeys.length;
  const filledCells = students.reduce((acc, s) =>
    acc + scoreColKeys.filter(k => s.scores[k] !== '').length, 0);
  const progress = totalCells > 0 ? (filledCells / totalCells) * 100 : 0;
  const hasFile = importedFile !== null;

  // Auto-scroll active row into view
  useEffect(() => {
    if (activeTrRef.current) {
      activeTrRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [activeCell]);

  // ── Advance active cell (right → down, wrapping) ──
  const advanceActiveCell = useCallback(() => {
    const file = importedFileRef.current;
    const cell = activeCellRef.current;
    const sts = studentsRef.current;
    if (!file || !cell || sts.length === 0) return;

    const keys = file.scoreColIndices.map(i => file.allHeaders[i]);
    const colIdx = keys.indexOf(cell.colKey);
    const nextColIdx = colIdx + 1;

    if (nextColIdx < keys.length) {
      // Move right within same student
      setActiveCell({ studentIdx: cell.studentIdx, colKey: keys[nextColIdx] });
    } else {
      // Move to next student, first column
      const nextStudentIdx = cell.studentIdx + 1;
      if (nextStudentIdx < sts.length) {
        setActiveCell({ studentIdx: nextStudentIdx, colKey: keys[0] });
      } else {
        // All done
        setActiveCell(null);
      }
    }
  }, []);

  // ── Voice Recognition ──
  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      onShowToast('Trình duyệt không hỗ trợ nhận diện giọng nói. Dùng Google Chrome.', 'error');
      return;
    }

    // Init active cell at first empty cell if none
    if (!activeCellRef.current) {
      const file = importedFileRef.current;
      const sts = studentsRef.current;
      if (file && sts.length > 0) {
        const keys = file.scoreColIndices.map(i => file.allHeaders[i]);
        // Find first empty cell
        let found = false;
        for (let si = 0; si < sts.length && !found; si++) {
          for (const k of keys) {
            if (sts[si].scores[k] === '') {
              setActiveCell({ studentIdx: si, colKey: k });
              activeCellRef.current = { studentIdx: si, colKey: k };
              found = true;
              break;
            }
          }
        }
        if (!found) {
          // All filled, start from beginning
          setActiveCell({ studentIdx: 0, colKey: keys[0] });
          activeCellRef.current = { studentIdx: 0, colKey: keys[0] };
        }
      }
    }

    const recognition = new SR();
    recognition.lang = 'vi-VN';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;

    let lastFinalTranscript = '';

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        const transcript = result[0].transcript.trim();
        if (result.isFinal) {
          setInterimText('');
          // Deduplicate: skip if same as last final
          if (transcript === lastFinalTranscript) continue;
          lastFinalTranscript = transcript;

          const score = parseVietnameseScore(transcript);
          if (score !== null) {
            const cell = activeCellRef.current;
            if (!cell) return;
            setStudents(prev => {
              const updated = prev.map((s, i) =>
                i === cell.studentIdx
                  ? { ...s, scores: { ...s.scores, [cell.colKey]: String(score) }, highlight: true }
                  : s
              );
              return updated;
            });
            setLastCommand(`✅ ${studentsRef.current[cell.studentIdx]?.name} — ${cell.colKey}: ${score}`);
            setTimeout(() => setStudents(prev => prev.map(s => ({ ...s, highlight: false }))), 800);
            advanceActiveCell();
          } else if (transcript.length > 2) {
            setLastCommand(`❓ Không nhận ra: "${transcript}"`);
          }
        } else {
          interim += transcript;
        }
      }
      if (interim) setInterimText(interim);
    };

    recognition.onerror = () => {
      setIsListening(false);
      onShowToast('Lỗi micro. Vui lòng thử lại.', 'error');
    };
    recognition.onend = () => setIsListening(false);
    recognition.start();
    recognitionRef.current = recognition;
    setIsListening(true);
  }, [onShowToast, advanceActiveCell]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
    setInterimText('');
  }, []);

  const updateScore = (studentIdx: number, colKey: string, value: string) => {
    setStudents(prev => prev.map((s, i) =>
      i === studentIdx ? { ...s, scores: { ...s.scores, [colKey]: value } } : s
    ));
  };

  const clearAllScores = () => {
    if (!window.confirm('Xóa toàn bộ điểm đã nhập?')) return;
    setStudents(prev => prev.map(s => ({
      ...s,
      scores: Object.fromEntries(Object.keys(s.scores).map(k => [k, '']))
    })));
    setActiveCell(null);
  };

  const resetAll = () => {
    if (!window.confirm('Bỏ file hiện tại và import lại?')) return;
    stopListening();
    setStudents([]);
    setImportedFile(null);
    setRawFile(null);
    setRawRows([]);
    setStep('upload');
    setLastCommand('');
    setActiveCell(null);
  };

  // ── Build student list from raw rows ──
  const buildStudentList = (
    rows: string[][],
    headerRowIdx: number,
    nameColIdx: number,
    scoreColIndices: number[],
    allHeaders: string[]
  ): StudentRow[] => {
    const dataRows = rows.slice(headerRowIdx + 1);
    const result: StudentRow[] = [];
    let stt = 1;
    for (const row of dataRows) {
      const name = String(row[nameColIdx] || '').trim();
      if (!name || /^\d+$/.test(name)) continue;
      const scores: Record<string, string> = {};
      for (const colIdx of scoreColIndices) {
        const key = allHeaders[colIdx];
        const raw = String(row[colIdx] || '').trim();
        const val = parseFloat(raw);
        scores[key] = (!isNaN(val) && val >= 0 && val <= 10) ? String(val) : '';
      }
      result.push({ stt: stt++, name, scores });
    }
    return result;
  };

  // ── Read file → determine headers → go to mapping step ──
  const importVnEduFile = useCallback((file: File) => {
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    const isXlsx = ext === 'xlsx' || ext === 'xls';
    const reader = new FileReader();

    if (isXlsx) {
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: 'array' });
          const sheetName = wb.SheetNames[0];
          const ws = wb.Sheets[sheetName];
          const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as string[][];

          const headerRowIdx = rows.findIndex(row =>
            row.some(cell => /h[oọ].*t[eê]n|h[aọ].*v[aà].*t[eê]n/i.test(String(cell)))
          );
          if (headerRowIdx === -1) {
            onShowToast('Không tìm thấy cột "Họ và Tên" trong file Excel.', 'error');
            return;
          }
          const allHeaders = rows[headerRowIdx].map(c => String(c));

          // Try to load saved mapping
          const saved = tryLoadMapping(allHeaders);
          if (saved) {
            applyMappingAndFinish(rows, headerRowIdx, allHeaders, saved, {
              type: 'xlsx', fileName: file.name, xlsxWorkbook: wb, xlsxSheetName: sheetName, headerRowIdx, allHeaders
            });
          } else {
            setRawRows(rows);
            setRawFile({ type: 'xlsx', fileName: file.name, xlsxWorkbook: wb, xlsxSheetName: sheetName, headerRowIdx, allHeaders });
            // Pre-select name col
            const nameIdx = allHeaders.findIndex(c => /h[oọ].*t[eê]n|h[aọ].*v[aà].*t[eê]n/i.test(c));
            setNameColIdx(nameIdx >= 0 ? nameIdx : 0);
            // Pre-select likely score columns
            const preScore = allHeaders.map((h, i) => ({ h, i }))
              .filter(({ h }) => /đi[eê]m|diem|score|point|miệng|kiểm|tx|gk|ck|hk/i.test(h))
              .map(({ i }) => i);
            setSelectedScoreCols(preScore.length > 0 ? preScore : []);
            setStep('mapping');
          }
        } catch (err: any) {
          onShowToast('Lỗi đọc file Excel: ' + err.message, 'error');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = (e) => {
        try {
          const raw = e.target?.result as string;
          const text = raw.startsWith('\uFEFF') ? raw.slice(1) : raw;
          const lines = text.split(/\r?\n/);
          const firstNonEmpty = lines.find(l => l.trim()) || '';
          const delimiter = detectDelimiter(firstNonEmpty);
          const rows: string[][] = lines.map(l => parseCsvLine(l, delimiter));

          const headerRowIdx = rows.findIndex(row =>
            row.some(cell => /h[oọ].*t[eê]n|h[aọ].*v[aà].*t[eê]n/i.test(String(cell)))
          );
          if (headerRowIdx === -1) {
            onShowToast('Không tìm thấy cột "Họ và Tên" trong file CSV.', 'error');
            return;
          }
          const allHeaders = rows[headerRowIdx].map(c => String(c));

          const saved = tryLoadMapping(allHeaders);
          if (saved) {
            applyMappingAndFinish(rows, headerRowIdx, allHeaders, saved, {
              type: 'csv', fileName: file.name, csvLines: lines, csvDelimiter: delimiter, headerRowIdx, allHeaders
            });
          } else {
            setRawRows(rows);
            setRawFile({ type: 'csv', fileName: file.name, csvLines: lines, csvDelimiter: delimiter, headerRowIdx, allHeaders });
            const nameIdx = allHeaders.findIndex(c => /h[oọ].*t[eê]n|h[aọ].*v[aà].*t[eê]n/i.test(c));
            setNameColIdx(nameIdx >= 0 ? nameIdx : 0);
            const preScore = allHeaders.map((h, i) => ({ h, i }))
              .filter(({ h }) => /đi[eê]m|diem|score|point|miệng|kiểm|tx|gk|ck|hk/i.test(h))
              .map(({ i }) => i);
            setSelectedScoreCols(preScore.length > 0 ? preScore : []);
            setStep('mapping');
          }
        } catch (err: any) {
          onShowToast('Lỗi đọc file CSV: ' + err.message, 'error');
        }
      };
      reader.readAsText(file, 'utf-8');
    }
  }, [onShowToast]);

  const tryLoadMapping = (allHeaders: string[]): ColumnMapping | null => {
    try {
      const saved = localStorage.getItem(MAPPING_STORAGE_KEY);
      if (!saved) return null;
      const parsed = JSON.parse(saved) as { headers: string[]; mapping: ColumnMapping };
      // Check if headers match (same set, same order)
      if (JSON.stringify(parsed.headers) === JSON.stringify(allHeaders)) {
        return parsed.mapping;
      }
    } catch { }
    return null;
  };

  const applyMappingAndFinish = (
    rows: string[][],
    headerRowIdx: number,
    allHeaders: string[],
    mapping: ColumnMapping,
    fileInfo: typeof rawFile
  ) => {
    if (!fileInfo) return;
    const studentList = buildStudentList(rows, headerRowIdx, mapping.nameColIdx, mapping.scoreColIndices, allHeaders);
    if (studentList.length === 0) {
      onShowToast('Không đọc được danh sách học sinh từ file.', 'error');
      return;
    }
    setStudents(studentList);
    const file: ImportedFile = {
      type: fileInfo.type,
      fileName: fileInfo.fileName,
      csvLines: fileInfo.csvLines,
      csvDelimiter: fileInfo.csvDelimiter,
      xlsxWorkbook: fileInfo.xlsxWorkbook,
      xlsxSheetName: fileInfo.xlsxSheetName,
      headerRowIdx,
      nameColIdx: mapping.nameColIdx,
      allHeaders,
      scoreColIndices: mapping.scoreColIndices,
      originalFileName: fileInfo.fileName,
    } as any;
    setImportedFile(file);
    setStep('grading');
    setLastCommand('');
    setActiveCell(null);
    onShowToast(`Đã tải ${studentList.length} học sinh · ${mapping.scoreColIndices.length} cột điểm!`, 'success');
  };

  const confirmMapping = () => {
    if (nameColIdx < 0) { onShowToast('Vui lòng chọn cột Họ tên.', 'warning'); return; }
    if (selectedScoreCols.length === 0) { onShowToast('Vui lòng chọn ít nhất 1 cột điểm.', 'warning'); return; }
    if (!rawFile) return;

    const mapping: ColumnMapping = { nameColIdx, scoreColIndices: selectedScoreCols };
    // Save mapping
    localStorage.setItem(MAPPING_STORAGE_KEY, JSON.stringify({ headers: rawFile.allHeaders, mapping }));
    applyMappingAndFinish(rawRows, rawFile.headerRowIdx, rawFile.allHeaders, mapping, rawFile);
  };

  // ── Drag & Drop ──
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) importVnEduFile(file);
  }, [importVnEduFile]);

  // ── Export ──
  const exportToOriginalFormat = () => {
    if (!importedFile) return;

    const scoreMap = new Map<string, Record<string, string>>();
    for (const s of students) {
      scoreMap.set(normalize(s.name), s.scores);
    }

    if (importedFile.type === 'xlsx' && importedFile.xlsxWorkbook) {
      const wb = importedFile.xlsxWorkbook;
      const ws = wb.Sheets[importedFile.xlsxSheetName!];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][];

      for (let r = importedFile.headerRowIdx + 1; r < rows.length; r++) {
        const row = rows[r];
        const name = String(row[importedFile.nameColIdx] || '');
        if (!name) continue;
        const scores = scoreMap.get(normalize(name));
        if (!scores) continue;
        for (const colIdx of importedFile.scoreColIndices) {
          const key = importedFile.allHeaders[colIdx];
          const score = scores[key];
          if (score !== undefined && score !== '') {
            row[colIdx] = parseFloat(score);
          }
        }
      }

      const newWs = XLSX.utils.aoa_to_sheet(rows);
      newWs['!merges'] = ws['!merges'];
      newWs['!cols'] = ws['!cols'];
      const newWb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(newWb, newWs, importedFile.xlsxSheetName);
      XLSX.writeFile(newWb, importedFile.originalFileName);
      onShowToast('Đã xuất file Excel! Upload lên vnEdu ngay được.', 'success');

    } else if (importedFile.type === 'csv' && importedFile.csvLines) {
      const delimiter = importedFile.csvDelimiter!;
      const lines = [...importedFile.csvLines];

      for (let i = importedFile.headerRowIdx + 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const cols = parseCsvLine(lines[i], delimiter);
        const name = cols[importedFile.nameColIdx];
        if (!name) continue;
        const scores = scoreMap.get(normalize(name));
        if (!scores) continue;
        for (const colIdx of importedFile.scoreColIndices) {
          const key = importedFile.allHeaders[colIdx];
          const score = scores[key];
          if (score !== undefined && score !== '') cols[colIdx] = score;
        }
        lines[i] = cols.map((c, idx) =>
          idx === importedFile.nameColIdx ? `"${c}"` : c
        ).join(delimiter);
      }

      const BOM = '\uFEFF';
      const csv = BOM + lines.join('\r\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = importedFile.originalFileName;
      a.click();
      URL.revokeObjectURL(url);
      onShowToast('Đã xuất file CSV! Upload lên vnEdu ngay được.', 'success');
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="rounded-xl p-5 flex items-start gap-4" style={{ background: '#EEF0FB', border: '1px solid #C8D0F5' }}>
        <div className="p-2.5 rounded-xl shrink-0" style={{ background: '#6B7CDB' }}>
          <Mic className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-base font-semibold" style={{ color: '#1A1A1A' }}>Trợ lý Nhập Điểm bằng Giọng Nói</h2>
          <p className="text-sm mt-0.5" style={{ color: '#57564F' }}>
            Tải file từ vnEdu → Chọn cột điểm → Đọc điểm từng ô bằng giọng nói → Xuất file để upload lại vnEdu.
          </p>
          <div className="flex items-center gap-3 mt-2 text-xs" style={{ color: '#787774' }}>
            <span className="flex items-center gap-1"><span className="font-bold" style={{ color: '#6B7CDB' }}>1.</span> Import file</span>
            <ArrowRight className="w-3 h-3" />
            <span className="flex items-center gap-1"><span className="font-bold" style={{ color: '#6B7CDB' }}>2.</span> Chọn cột</span>
            <ArrowRight className="w-3 h-3" />
            <span className="flex items-center gap-1"><span className="font-bold" style={{ color: '#6B7CDB' }}>3.</span> Đọc điểm</span>
            <ArrowRight className="w-3 h-3" />
            <span className="flex items-center gap-1"><span className="font-bold" style={{ color: '#6B7CDB' }}>4.</span> Xuất file</span>
          </div>
        </div>
      </div>

      {/* ── STEP 1: Upload ── */}
      {step === 'upload' && (
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
              <p className="text-base font-semibold" style={{ color: '#1A1A1A' }}>Kéo thả file vnEdu vào đây</p>
              <p className="text-sm mt-1" style={{ color: '#787774' }}>
                Hỗ trợ file <b>.xlsx</b>, <b>.xls</b>, <b>.csv</b> — tải thẳng từ vnEdu về là dùng được
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div style={{ height: '1px', width: '60px', background: '#E9E9E7' }} />
              <span className="text-xs" style={{ color: '#AEACA8' }}>hoặc</span>
              <div style={{ height: '1px', width: '60px', background: '#E9E9E7' }} />
            </div>
            <input
              ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) importVnEduFile(f); e.target.value = ''; }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
              style={{ background: '#6B7CDB', color: '#fff' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#5a6bc9'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#6B7CDB'}
            >
              <FileSpreadsheet className="w-4 h-4" />
              Chọn file từ máy tính
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Column Mapping ── */}
      {step === 'mapping' && rawFile && (
        <div className="rounded-xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E9E9E7' }}>
          <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid #E9E9E7', background: '#FAFAF9' }}>
            <Settings2 className="w-4 h-4" style={{ color: '#6B7CDB' }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>Chọn cột điểm cần nhập</p>
              <p className="text-xs mt-0.5" style={{ color: '#787774' }}>Cấu hình này sẽ được lưu lại cho lần sau</p>
            </div>
          </div>

          <div className="p-5 space-y-5">
            {/* Name column */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#AEACA8' }}>Cột Họ và Tên</p>
              <select
                value={nameColIdx}
                onChange={e => setNameColIdx(Number(e.target.value))}
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{ border: '1px solid #D0D5F7', background: '#FAFAF9', color: '#1A1A1A', outline: 'none' }}
              >
                <option value={-1}>-- Chọn cột --</option>
                {rawFile.allHeaders.map((h, i) => (
                  <option key={i} value={i}>{h || `(cột ${i + 1})`}</option>
                ))}
              </select>
            </div>

            {/* Score columns */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#AEACA8' }}>
                Các cột điểm cần nhập <span style={{ color: '#6B7CDB' }}>({selectedScoreCols.length} đã chọn)</span>
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {rawFile.allHeaders.map((h, i) => {
                  if (i === nameColIdx || !h.trim()) return null;
                  const checked = selectedScoreCols.includes(i);
                  return (
                    <label
                      key={i}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all"
                      style={{
                        border: `1px solid ${checked ? '#6B7CDB' : '#E9E9E7'}`,
                        background: checked ? '#EEF0FB' : '#FAFAF9',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setSelectedScoreCols(prev =>
                            checked ? prev.filter(x => x !== i) : [...prev, i]
                          );
                        }}
                        style={{ accentColor: '#6B7CDB' }}
                      />
                      <span className="text-sm font-medium" style={{ color: checked ? '#6B7CDB' : '#57564F' }}>
                        {h || `Cột ${i + 1}`}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Preview order */}
            {selectedScoreCols.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap px-3 py-2.5 rounded-lg" style={{ background: '#F7F6F3' }}>
                <span className="text-xs font-medium mr-1" style={{ color: '#787774' }}>Thứ tự đọc:</span>
                {selectedScoreCols.map((i, pos) => (
                  <React.Fragment key={i}>
                    <span className="text-xs px-2 py-0.5 rounded font-semibold" style={{ background: '#EEF0FB', color: '#6B7CDB' }}>
                      {rawFile.allHeaders[i] || `Cột ${i + 1}`}
                    </span>
                    {pos < selectedScoreCols.length - 1 && <ChevronRight className="w-3 h-3" style={{ color: '#AEACA8' }} />}
                  </React.Fragment>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={() => setStep('upload')}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{ color: '#787774', border: '1px solid #E9E9E7' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F1F0EC'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                ← Quay lại
              </button>
              <button
                onClick={confirmMapping}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors"
                style={{ background: '#6B7CDB' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#5a6bc9'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#6B7CDB'}
              >
                Lưu cấu hình & Bắt đầu nhập điểm →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 3: Grading ── */}
      {step === 'grading' && hasFile && (
        <>
          {/* File info + reset */}
          <div className="rounded-xl p-4 flex items-center justify-between gap-3" style={{ background: '#fff', border: '1px solid #E9E9E7' }}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ background: '#EAF3EE' }}>
                {importedFile!.type === 'xlsx'
                  ? <FileSpreadsheet className="w-4 h-4" style={{ color: '#448361' }} />
                  : <FileText className="w-4 h-4" style={{ color: '#448361' }} />}
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>{importedFile!.originalFileName}</p>
                <p className="text-xs mt-0.5" style={{ color: '#787774' }}>
                  {students.length} học sinh · {scoreColKeys.length} cột · Đã nhập: <span style={{ color: '#448361', fontWeight: 600 }}>{filledCells}</span>/{totalCells}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  // Go back to mapping (clear saved mapping so user can re-configure)
                  localStorage.removeItem(MAPPING_STORAGE_KEY);
                  stopListening();
                  setStep('mapping');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{ color: '#6B7CDB', border: '1px solid #C8D0F5' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#EEF0FB'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                <Settings2 className="w-3.5 h-3.5" />
                Cấu hình cột
              </button>
              <button
                onClick={resetAll}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{ color: '#787774', border: '1px solid #E9E9E7' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F1F0EC'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Đổi file
              </button>
            </div>
          </div>

          {/* Voice Control */}
          <div className="rounded-xl p-5 space-y-4" style={{ background: '#fff', border: '1px solid #E9E9E7' }}>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>Nhập điểm bằng giọng nói</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={clearAllScores}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                  style={{ color: '#787774', border: '1px solid #E9E9E7' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#FEF0F0'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  <RotateCcw className="w-3.5 h-3.5" />Xóa điểm
                </button>
                <button
                  onClick={exportToOriginalFormat}
                  disabled={filledCells === 0}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors text-white"
                  style={{ background: filledCells === 0 ? '#AEACA8' : '#448361', cursor: filledCells === 0 ? 'not-allowed' : 'pointer' }}
                  onMouseEnter={e => { if (filledCells > 0) (e.currentTarget as HTMLElement).style.background = '#376a50'; }}
                  onMouseLeave={e => { if (filledCells > 0) (e.currentTarget as HTMLElement).style.background = '#448361'; }}
                >
                  <Download className="w-4 h-4" />
                  Xuất {importedFile!.type === 'xlsx' ? 'Excel' : 'CSV'} vnEdu
                </button>
              </div>
            </div>

            {/* Progress */}
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#F1F0EC' }}>
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progress}%`, background: progress === 100 ? '#448361' : '#6B7CDB' }} />
            </div>

            {/* Active cell indicator */}
            {activeCell && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg" style={{ background: '#EEF0FB', border: '1px solid #C8D0F5' }}>
                <span className="text-xs font-medium" style={{ color: '#6B7CDB' }}>
                  🎯 Đang nhập: <b>{students[activeCell.studentIdx]?.name}</b> — cột <b>{activeCell.colKey}</b>
                </span>
              </div>
            )}

            {/* Mic button */}
            <div className="flex flex-col items-center gap-3 py-4">
              <button
                onClick={isListening ? stopListening : startListening}
                className="relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg"
                style={{
                  background: isListening ? '#E03E3E' : '#6B7CDB',
                  boxShadow: isListening ? '0 0 0 8px #E03E3E22' : '0 4px 20px rgba(107,124,219,0.35)',
                }}
              >
                {isListening ? <MicOff className="w-8 h-8 text-white" /> : <Mic className="w-8 h-8 text-white" />}
                {isListening && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-pulse border-2 border-white" />}
              </button>

              <p className="text-sm font-medium" style={{ color: isListening ? '#E03E3E' : '#AEACA8' }}>
                {isListening
                  ? `🎙️ Đang nghe... Đọc điểm ${activeCell ? `"${activeCell.colKey}"` : ''}`
                  : 'Bấm để bắt đầu đọc điểm'}
              </p>

              {interimText && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg w-full max-w-sm" style={{ background: '#FFF7ED', border: '1px solid #FDDBA0' }}>
                  <Volume2 className="w-4 h-4 shrink-0" style={{ color: '#D9730D' }} />
                  <span className="text-sm italic" style={{ color: '#D9730D' }}>{interimText}</span>
                </div>
              )}

              {lastCommand && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg w-full max-w-sm"
                  style={{
                    background: lastCommand.startsWith('✅') ? '#EAF3EE' : '#FEF0F0',
                    border: `1px solid ${lastCommand.startsWith('✅') ? '#B7D9C4' : '#F5C2C2'}`,
                  }}>
                  {lastCommand.startsWith('✅')
                    ? <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: '#448361' }} />
                    : <AlertCircle className="w-4 h-4 shrink-0" style={{ color: '#E03E3E' }} />}
                  <span className="text-sm font-medium" style={{ color: lastCommand.startsWith('✅') ? '#448361' : '#E03E3E' }}>
                    {lastCommand}
                  </span>
                </div>
              )}
            </div>

            {/* Tips */}
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg" style={{ background: '#F7F6F3' }}>
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: '#AEACA8' }} />
              <p className="text-[11px]" style={{ color: '#787774' }}>
                <b>Cách dùng:</b> Bấm micro → Đọc 1 số (ví dụ: "tám rưỡi", "chín phẩy hai lăm") → Web tự nhảy sang ô kế tiếp.
                {scoreColKeys.length > 1 && <> Thứ tự: <b>{scoreColKeys.join(' → ')}</b>.</>}
              </p>
            </div>
          </div>

          {/* Grade Table */}
          <div className="rounded-xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E9E9E7' }}>
            <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #E9E9E7', background: '#FAFAF9' }}>
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#AEACA8' }}>
                Bảng điểm — {importedFile!.originalFileName}
              </span>
              <span className="text-xs" style={{ color: '#787774' }}>
                {filledCells === totalCells && totalCells > 0
                  ? <span style={{ color: '#448361' }}>✅ Đã nhập đủ!</span>
                  : `Còn ${totalCells - filledCells} ô trống`}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr style={{ background: '#FAFAF9' }}>
                    <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: '#AEACA8', borderBottom: '1px solid #E9E9E7', width: '50px' }}>STT</th>
                    <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: '#AEACA8', borderBottom: '1px solid #E9E9E7' }}>Họ và Tên</th>
                    {scoreColKeys.map(k => (
                      <th key={k} className="px-3 py-3 text-[10px] font-semibold uppercase tracking-wider text-center"
                        style={{ color: '#AEACA8', borderBottom: '1px solid #E9E9E7', minWidth: '90px' }}>
                        {k}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {students.map((s, si) => {
                    const isActiveRow = activeCell?.studentIdx === si;
                    return (
                      <tr
                        key={s.stt}
                        ref={isActiveRow ? activeTrRef : null}
                        style={{
                          borderBottom: '1px solid #F1F0EC',
                          background: s.highlight ? '#EEF0FB' : isActiveRow ? '#FAFBFF' : 'transparent',
                          transition: 'background 0.3s',
                        }}
                      >
                        <td className="px-4 py-2.5">
                          <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: '#F1F0EC', color: '#787774' }}>{s.stt}</span>
                        </td>
                        <td className="px-4 py-2.5 text-sm font-medium" style={{ color: s.highlight ? '#6B7CDB' : '#1A1A1A' }}>
                          {s.name}
                          {s.highlight && <span className="ml-2 text-xs" style={{ color: '#6B7CDB' }}>← vừa điền</span>}
                        </td>
                        {scoreColKeys.map(k => {
                          const isActiveCell = activeCell?.studentIdx === si && activeCell?.colKey === k;
                          const score = s.scores[k];
                          return (
                            <td key={k} className="px-3 py-2.5 text-center">
                              <input
                                type="number" min="0" max="10" step="0.01"
                                value={score}
                                onChange={e => updateScore(si, k, e.target.value)}
                                onClick={() => setActiveCell({ studentIdx: si, colKey: k })}
                                placeholder="—"
                                className="w-20 rounded-lg px-2 py-1.5 text-center text-sm font-semibold transition-all"
                                style={{
                                  background: isActiveCell ? '#EEF0FB' : score !== '' ? '#EAF3EE' : '#F7F6F3',
                                  border: `2px solid ${isActiveCell ? '#6B7CDB' : score !== '' ? '#B7D9C4' : '#E9E9E7'}`,
                                  color: isActiveCell ? '#6B7CDB' : score !== '' ? '#448361' : '#AEACA8',
                                  outline: 'none',
                                  boxShadow: isActiveCell ? '0 0 0 3px #6B7CDB22' : 'none',
                                }}
                                onFocus={e => {
                                  setActiveCell({ studentIdx: si, colKey: k });
                                  (e.currentTarget as HTMLElement).style.borderColor = '#6B7CDB';
                                }}
                                onBlur={e => {
                                  (e.currentTarget as HTMLElement).style.borderColor =
                                    activeCell?.studentIdx === si && activeCell?.colKey === k ? '#6B7CDB' :
                                      score !== '' ? '#B7D9C4' : '#E9E9E7';
                                }}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="px-5 py-4 flex items-center justify-between" style={{ borderTop: '1px solid #E9E9E7', background: '#FAFAF9' }}>
              <p className="text-xs" style={{ color: '#787774' }}>
                Xuất ra sẽ ghi điểm vào đúng file gốc <b>{importedFile!.originalFileName}</b> để upload lên vnEdu
              </p>
              <button
                onClick={exportToOriginalFormat}
                disabled={filledCells === 0}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors"
                style={{ background: filledCells === 0 ? '#AEACA8' : '#448361', cursor: filledCells === 0 ? 'not-allowed' : 'pointer' }}
                onMouseEnter={e => { if (filledCells > 0) (e.currentTarget as HTMLElement).style.background = '#376a50'; }}
                onMouseLeave={e => { if (filledCells > 0) (e.currentTarget as HTMLElement).style.background = '#448361'; }}
              >
                <Download className="w-4 h-4" />
                Xuất {importedFile!.type === 'xlsx' ? 'Excel' : 'CSV'} vnEdu
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default VoiceGrader;
