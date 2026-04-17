import React, { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
  Mic, MicOff, Download, RefreshCw,
  Volume2, CheckCircle2, AlertCircle, FileSpreadsheet,
  RotateCcw, Info, Upload, FileText, ArrowRight
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────
interface StudentRow {
  stt: number;
  name: string;
  score: string;
  highlight?: boolean;
}

/** Lưu trữ toàn bộ cấu trúc file gốc từ vnEdu */
interface ImportedFile {
  type: 'csv' | 'xlsx';
  csvLines?: string[];
  csvDelimiter?: string;
  xlsxWorkbook?: XLSX.WorkBook;
  xlsxSheetName?: string;
  headerRowIdx: number;
  nameColIdx: number;
  scoreColIdx: number;
  originalFileName: string;
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

const parseVietnameseScore = (text: string): number | null => {
  const t = text.toLowerCase().trim();
  const wordMap: Record<string, string> = {
    'không': '0', 'một': '1', 'hai': '2', 'ba': '3', 'bốn': '4',
    'năm': '5', 'lăm': '5', 'sáu': '6', 'bảy': '7', 'tám': '8', 'chín': '9', 'mười': '10',
    'phẩy': '.', 'chấm': '.', 'phảy': '.', 'rưỡi': '.5', 'mươi': '10',
  };
  let processed = t;
  for (const [word, digit] of Object.entries(wordMap)) {
    processed = processed.replace(new RegExp(word, 'g'), digit);
  }
  processed = processed.replace(/(\d)\s+(\d)/, '$1.$2').replace(',', '.');
  const match = processed.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const val = parseFloat(match[1]);
  if (isNaN(val) || val < 0 || val > 10) return null;
  return Math.round(val * 100) / 100;
};

const trySplitAmbiguousNumber = (n: number): { index: number; score: number } | null => {
  const s = String(n);
  if (s.length < 2) return null;
  const cuts = s.length === 3 ? [1, 2] : [1];
  for (const cut of cuts) {
    const studentPart = parseInt(s.slice(0, cut));
    const scorePart = parseFloat(s.slice(cut));
    if (studentPart > 0 && !isNaN(scorePart) && scorePart >= 0 && scorePart <= 10) {
      return { index: studentPart - 1, score: Math.round(scorePart * 100) / 100 };
    }
  }
  return null;
};

const parseAllVoiceCommands = (transcript: string): { index: number; score: number }[] => {
  const t = transcript.toLowerCase().trim();
  const results: { index: number; score: number }[] = [];
  const segmentRegex = /(?:số\s*(\d+)|(?:^|[,;\s])(\d+)\s*[:.]) \s*(.*?)(?=\s*(?:số\s*\d+|(?:^|[,;\s])\d+\s*[:.])|$)/g;
  let match;
  while ((match = segmentRegex.exec(t)) !== null) {
    const numStr = match[1] || match[2];
    const scoreText = match[3];
    if (!numStr || !scoreText) continue;
    const n = parseInt(numStr);
    const idx = n - 1;
    if (isNaN(idx) || idx < 0) continue;
    const score = parseVietnameseScore(scoreText);
    if (score !== null) {
      results.push({ index: idx, score });
    } else if (n > 10) {
      const split = trySplitAmbiguousNumber(n);
      if (split) results.push(split);
    }
  }
  if (results.length === 0) {
    const patterns = [/số\s*(\d+)[,:.\s]+(.+)/, /(\d+)[,:.\s]+(.+)/];
    for (const pattern of patterns) {
      const m = t.match(pattern);
      if (m) {
        const n2 = parseInt(m[1]);
        const idx = n2 - 1;
        if (isNaN(idx) || idx < 0) continue;
        const score = parseVietnameseScore(m[2]);
        if (score !== null) { results.push({ index: idx, score }); break; }
        else if (n2 > 10) {
          const split = trySplitAmbiguousNumber(n2);
          if (split) { results.push(split); break; }
        }
      }
    }
  }
  return results;
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

// ── Main Component ─────────────────────────────────────────────────────────
const VoiceGrader: React.FC<{ onShowToast: (msg: string, type: 'success' | 'error' | 'warning') => void }> = ({ onShowToast }) => {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [importedFile, setImportedFile] = useState<ImportedFile | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [lastCommand, setLastCommand] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const filledCount = students.filter(s => s.score !== '').length;
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const studentsRef = useRef<StudentRow[]>([]);
  studentsRef.current = students;

  // ── Voice Recognition ──
  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      onShowToast('Trình duyệt không hỗ trợ nhận diện giọng nói. Dùng Google Chrome.', 'error');
      return;
    }
    const recognition = new SR();
    recognition.lang = 'vi-VN';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;
    let processedByInterim = new Set<string>();

    const processTranscript = (transcript: string, isFinal: boolean) => {
      const cmds = parseAllVoiceCommands(transcript);
      if (cmds.length > 0) {
        const newCmds = isFinal ? cmds : cmds.filter(c => !processedByInterim.has(`${c.index}:${c.score}`));
        if (newCmds.length === 0) return;
        setStudents(prev => {
          let updated = [...prev];
          let changed = false;
          for (const { index, score } of newCmds) {
            if (index >= updated.length) continue;
            if (updated[index].score === String(score)) continue;
            updated = updated.map((s, i) => i === index ? { ...s, score: String(score), highlight: true } : s);
            if (!isFinal) processedByInterim.add(`${index}:${score}`);
            changed = true;
          }
          return changed ? updated : prev;
        });
        const label = newCmds.map(c => `Số ${c.index + 1} → ${c.score}`).join(', ');
        setLastCommand(`✅ ${label} điểm`);
        setTimeout(() => setStudents(prev => prev.map(s => ({ ...s, highlight: false }))), 1000);
      } else if (isFinal && transcript.length > 10) {
        setLastCommand(`❓ Không nhận ra: "${transcript}"`);
      }
    };

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        const transcript = result[0].transcript.trim().toLowerCase();
        if (result.isFinal) {
          setInterimText('');
          processTranscript(transcript, true);
          processedByInterim = new Set();
        } else {
          interim += transcript;
          processTranscript(transcript, false);
        }
      }
      setInterimText(interim);
    };
    recognition.onerror = () => { setIsListening(false); onShowToast('Lỗi micro. Vui lòng thử lại.', 'error'); };
    recognition.onend = () => setIsListening(false);
    recognition.start();
    recognitionRef.current = recognition;
    setIsListening(true);
  }, [onShowToast]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
    setInterimText('');
  }, []);

  const updateScore = (stt: number, value: string) => {
    setStudents(prev => prev.map(s => s.stt === stt ? { ...s, score: value } : s));
  };

  const clearAllScores = () => {
    if (!window.confirm('Xóa toàn bộ điểm đã nhập?')) return;
    setStudents(prev => prev.map(s => ({ ...s, score: '' })));
  };

  const resetAll = () => {
    if (!window.confirm('Bỏ file hiện tại và import lại?')) return;
    stopListening();
    setStudents([]);
    setImportedFile(null);
    setLastCommand('');
  };

  // ── Parse students from rows ──
  const buildStudentList = (
    rows: string[][],
    headerRowIdx: number,
    nameColIdx: number,
    scoreColIdx: number
  ): StudentRow[] => {
    const dataRows = rows.slice(headerRowIdx + 1);
    const result: StudentRow[] = [];
    let stt = 1;
    for (const row of dataRows) {
      const name = String(row[nameColIdx] || '').trim();
      if (!name) continue;
      // Bỏ dòng chỉ chứa số thứ tự hoặc rỗng
      if (/^\d+$/.test(name)) continue;
      const existingScore = String(row[scoreColIdx] || '').trim();
      const scoreVal = parseFloat(existingScore);
      result.push({
        stt: stt++,
        name,
        score: (!isNaN(scoreVal) && scoreVal >= 0 && scoreVal <= 10) ? String(scoreVal) : '',
      });
    }
    return result;
  };

  // ── Import file ──
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

          const headerRow = rows[headerRowIdx].map(c => String(c));
          const nameColIdx = headerRow.findIndex(c => /h[oọ].*t[eê]n|h[aọ].*v[aà].*t[eê]n/i.test(c));
          let scoreColIdx = headerRow.findIndex(c => /đi[eê]m|diem|score|point/i.test(c));
          if (scoreColIdx === -1) scoreColIdx = headerRow.length - 1;

          const studentList = buildStudentList(rows, headerRowIdx, nameColIdx, scoreColIdx);
          if (studentList.length === 0) {
            onShowToast('Không đọc được danh sách học sinh từ file.', 'error');
            return;
          }

          setStudents(studentList);
          setImportedFile({
            type: 'xlsx',
            xlsxWorkbook: wb,
            xlsxSheetName: sheetName,
            headerRowIdx,
            nameColIdx,
            scoreColIdx,
            originalFileName: file.name,
          });
          setLastCommand('');
          onShowToast(`Đã tải ${studentList.length} học sinh từ file Excel!`, 'success');
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

          const headerRowIdx = lines.findIndex(l =>
            /h[oọ].*t[eê]n|h[aọ].*v[aà].*t[eê]n/i.test(l)
          );
          if (headerRowIdx === -1) {
            onShowToast('Không tìm thấy cột "Họ và Tên" trong file CSV.', 'error');
            return;
          }

          const headerCols = parseCsvLine(lines[headerRowIdx], delimiter);
          const nameColIdx = headerCols.findIndex(c => /h[oọ].*t[eê]n|h[aọ].*v[aà].*t[eê]n/i.test(c));
          let scoreColIdx = headerCols.findIndex(c => /đi[eê]m|diem|score|point/i.test(c));
          if (scoreColIdx === -1) scoreColIdx = headerCols.length - 1;

          // Chuyển CSV lines → rows 2D để dùng chung buildStudentList
          const rows: string[][] = lines.map(l => parseCsvLine(l, delimiter));
          const studentList = buildStudentList(rows, headerRowIdx, nameColIdx, scoreColIdx);
          if (studentList.length === 0) {
            onShowToast('Không đọc được danh sách học sinh từ file.', 'error');
            return;
          }

          setStudents(studentList);
          setImportedFile({
            type: 'csv',
            csvLines: lines,
            csvDelimiter: delimiter,
            headerRowIdx,
            nameColIdx,
            scoreColIdx,
            originalFileName: file.name,
          });
          setLastCommand('');
          onShowToast(`Đã tải ${studentList.length} học sinh từ file CSV!`, 'success');
        } catch (err: any) {
          onShowToast('Lỗi đọc file CSV: ' + err.message, 'error');
        }
      };
      reader.readAsText(file, 'utf-8');
    }
  }, [onShowToast]);

  // ── Drag & Drop ──
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) importVnEduFile(file);
  }, [importVnEduFile]);

  // ── Export: ghi điểm vào file gốc ──
  const exportToOriginalFormat = () => {
    if (!importedFile) return;

    const scoreMap = new Map<string, string>();
    for (const s of students) {
      scoreMap.set(normalize(s.name), s.score);
    }

    if (importedFile.type === 'xlsx' && importedFile.xlsxWorkbook) {
      const wb = importedFile.xlsxWorkbook;
      const ws = wb.Sheets[importedFile.xlsxSheetName!];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][];

      for (let r = importedFile.headerRowIdx + 1; r < rows.length; r++) {
        const row = rows[r];
        const name = String(row[importedFile.nameColIdx] || '');
        if (!name) continue;
        const score = scoreMap.get(normalize(name));
        if (score !== undefined && score !== '') {
          row[importedFile.scoreColIdx] = parseFloat(score);
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
        const score = scoreMap.get(normalize(name));
        if (score !== undefined && score !== '') {
          cols[importedFile.scoreColIdx] = score;
          lines[i] = cols.map((c, idx) =>
            idx === importedFile.nameColIdx ? `"${c}"` : c
          ).join(delimiter);
        }
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

  const progress = students.length > 0 ? (filledCount / students.length) * 100 : 0;
  const hasFile = importedFile !== null;

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
            Tải file từ vnEdu → Import vào đây → Đọc điểm bằng giọng nói → Xuất file y hệt để upload lại vnEdu.
          </p>
          <div className="flex items-center gap-3 mt-2 text-xs" style={{ color: '#787774' }}>
            <span className="flex items-center gap-1"><span className="font-bold" style={{ color: '#6B7CDB' }}>1.</span> Import file vnEdu</span>
            <ArrowRight className="w-3 h-3" />
            <span className="flex items-center gap-1"><span className="font-bold" style={{ color: '#6B7CDB' }}>2.</span> Đọc điểm</span>
            <ArrowRight className="w-3 h-3" />
            <span className="flex items-center gap-1"><span className="font-bold" style={{ color: '#6B7CDB' }}>3.</span> Xuất file</span>
          </div>
        </div>
      </div>

      {/* ── BƯỚC 1: Import file ── */}
      {!hasFile && (
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
                Kéo thả file vnEdu vào đây
              </p>
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
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) importVnEduFile(f);
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
              <FileSpreadsheet className="w-4 h-4" />
              Chọn file từ máy tính
            </button>
          </div>
        </div>
      )}

      {/* ── SAU KHI CÓ FILE: Voice Control + Export ── */}
      {hasFile && (
        <>
          {/* File đang dùng + reset */}
          <div className="rounded-xl p-4 flex items-center justify-between gap-3" style={{ background: '#fff', border: '1px solid #E9E9E7' }}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ background: '#EAF3EE' }}>
                {importedFile!.type === 'xlsx'
                  ? <FileSpreadsheet className="w-4 h-4" style={{ color: '#448361' }} />
                  : <FileText className="w-4 h-4" style={{ color: '#448361' }} />
                }
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>{importedFile!.originalFileName}</p>
                <p className="text-xs mt-0.5" style={{ color: '#787774' }}>
                  {students.length} học sinh · Đã nhập: <span style={{ color: '#448361', fontWeight: 600 }}>{filledCount}</span>/{students.length}
                </p>
              </div>
            </div>
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
                  disabled={filledCount === 0}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors text-white"
                  style={{ background: filledCount === 0 ? '#AEACA8' : '#448361', cursor: filledCount === 0 ? 'not-allowed' : 'pointer' }}
                  onMouseEnter={e => { if (filledCount > 0) (e.currentTarget as HTMLElement).style.background = '#376a50'; }}
                  onMouseLeave={e => { if (filledCount > 0) (e.currentTarget as HTMLElement).style.background = '#448361'; }}
                >
                  <Download className="w-4 h-4" />
                  Xuất {importedFile!.type === 'xlsx' ? 'Excel' : 'CSV'} vnEdu
                </button>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#F1F0EC' }}>
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progress}%`, background: progress === 100 ? '#448361' : '#6B7CDB' }} />
            </div>

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
                {isListening ? '🎙️ Đang nghe... Đọc: "Số 1: tám phẩy năm"' : 'Bấm để bắt đầu đọc điểm'}
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
                <b>Cách đọc 1 em:</b> "Số 1: tám phẩy năm" | "Số 2: bảy rưỡi" — <b>Nhiều em cùng lúc:</b> "Số 1 tám, số 2 chín rưỡi, số 3 bảy"
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
                {filledCount === students.length && filledCount > 0
                  ? <span style={{ color: '#448361' }}>✅ Đã nhập đủ!</span>
                  : `Còn ${students.length - filledCount} ô trống`}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr style={{ background: '#FAFAF9' }}>
                    {['STT', 'Họ và Tên', 'Điểm số'].map((h, i) => (
                      <th key={h} className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider"
                        style={{ color: '#AEACA8', borderBottom: '1px solid #E9E9E7', textAlign: i === 2 ? 'center' : 'left', width: i === 0 ? '60px' : i === 2 ? '120px' : 'auto' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s.stt} style={{ borderBottom: '1px solid #F1F0EC', background: s.highlight ? '#EEF0FB' : 'transparent', transition: 'background 0.3s' }}>
                      <td className="px-5 py-3">
                        <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: '#F1F0EC', color: '#787774' }}>{s.stt}</span>
                      </td>
                      <td className="px-5 py-3 text-sm font-medium" style={{ color: s.highlight ? '#6B7CDB' : '#1A1A1A' }}>
                        {s.name}
                        {s.highlight && <span className="ml-2 text-xs" style={{ color: '#6B7CDB' }}>← vừa điền</span>}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <input
                          type="number" min="0" max="10" step="0.1"
                          value={s.score}
                          onChange={e => updateScore(s.stt, e.target.value)}
                          placeholder="—"
                          className="w-20 rounded-lg px-2 py-1.5 text-center text-sm font-semibold transition-all"
                          style={{
                            background: s.score !== '' ? '#EAF3EE' : '#F7F6F3',
                            border: `1px solid ${s.score !== '' ? '#B7D9C4' : '#E9E9E7'}`,
                            color: s.score !== '' ? '#448361' : '#AEACA8',
                            outline: 'none',
                          }}
                          onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = '#6B7CDB'}
                          onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = s.score !== '' ? '#B7D9C4' : '#E9E9E7'}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-5 py-4 flex items-center justify-between" style={{ borderTop: '1px solid #E9E9E7', background: '#FAFAF9' }}>
              <p className="text-xs" style={{ color: '#787774' }}>
                Xuất ra sẽ ghi điểm vào đúng file gốc <b>{importedFile!.originalFileName}</b> để upload lên vnEdu
              </p>
              <button
                onClick={exportToOriginalFormat}
                disabled={filledCount === 0}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors"
                style={{ background: filledCount === 0 ? '#AEACA8' : '#448361', cursor: filledCount === 0 ? 'not-allowed' : 'pointer' }}
                onMouseEnter={e => { if (filledCount > 0) (e.currentTarget as HTMLElement).style.background = '#376a50'; }}
                onMouseLeave={e => { if (filledCount > 0) (e.currentTarget as HTMLElement).style.background = '#448361'; }}
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
