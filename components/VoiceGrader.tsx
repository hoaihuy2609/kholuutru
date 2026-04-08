import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../src/lib/supabase';
import {
  Mic, MicOff, Download, RefreshCw, ChevronDown,
  Volume2, CheckCircle2, AlertCircle, FileSpreadsheet,
  Users, Trash2, RotateCcw, Info
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────
interface ClassInfo {
  id: string;
  name: string;
  grade: number;
}

interface StudentRow {
  stt: number;
  name: string;
  phone: string;
  score: string; // '' = chưa nhập, '0'-'10' = điểm
  highlight?: boolean; // vừa được điền bởi voice
}

// ── Web Speech API type shim ───────────────────────────────────────────────
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
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

/** Chuyển chữ số tiếng Việt sang số thực */
const parseVietnameseScore = (text: string): number | null => {
  const t = text.toLowerCase().trim();

  // Thay thế chữ số viết bằng chữ tiếng Việt
  const wordMap: Record<string, string> = {
    'không': '0', 'một': '1', 'hai': '2', 'ba': '3', 'bốn': '4',
    'năm': '5', 'sáu': '6', 'bảy': '7', 'tám': '8', 'chín': '9', 'mười': '10',
    'phẩy': '.', 'chấm': '.', 'phảy': '.', 'rưỡi': '.5',
    'mươi': '10',
  };

  let processed = t;
  for (const [word, digit] of Object.entries(wordMap)) {
    processed = processed.replace(new RegExp(word, 'g'), digit);
  }

  // Xử lý "8 5" -> "8.5", "8,5" -> "8.5"
  processed = processed.replace(/(\d)\s+(\d)/, '$1.$2').replace(',', '.');

  const match = processed.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const val = parseFloat(match[1]);
  if (isNaN(val) || val < 0 || val > 10) return null;
  return Math.round(val * 10) / 10;
};

/** Parse "số 5: tám phẩy năm" hoặc "số 5 tám rưỡi" → { index: 4, score: 8.5 } */
const parseVoiceCommand = (transcript: string): { index: number; score: number } | null => {
  const t = transcript.toLowerCase().trim();

  // Pattern: "số [N] [điểm] [score]" hoặc "[N] [score]"
  const patterns = [
    /số\s*(\d+)[,:.\s]+(.+)/,
    /(\d+)[,:.\s]+(.+)/,
  ];

  for (const pattern of patterns) {
    const m = t.match(pattern);
    if (m) {
      const idx = parseInt(m[1]) - 1; // convert 1-based to 0-based
      if (isNaN(idx) || idx < 0) continue;
      const score = parseVietnameseScore(m[2]);
      if (score !== null) return { index: idx, score };
    }
  }
  return null;
};

/** Format điểm để hiển thị */
const fmtScore = (s: string) => s === '' ? '—' : s;

// ── Main Component ─────────────────────────────────────────────────────────
const VoiceGrader: React.FC<{ onShowToast: (msg: string, type: 'success' | 'error' | 'warning') => void }> = ({ onShowToast }) => {
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassInfo | null>(null);
  const [examLabel, setExamLabel] = useState('');
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [lastCommand, setLastCommand] = useState('');
  const [filledCount, setFilledCount] = useState(0);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const studentsRef = useRef<StudentRow[]>([]);
  studentsRef.current = students;

  // ── Load classes ──
  useEffect(() => {
    supabase.from('classes').select('*').order('grade').order('name')
      .then(({ data }) => setClasses(data || []));
  }, []);

  // ── Load students by class ──
  const loadStudents = useCallback(async (cls: ClassInfo) => {
    setLoadingStudents(true);
    try {
      const { data, error } = await supabase
        .from('students')
        .select('phone, name')
        .eq('class_id', cls.id)
        .order('name', { ascending: true });

      if (error) throw error;

      // Sort Vietnamese by tên (last word)
      const sorted = (data || []).sort((a, b) => {
        const nameA = a.name.split(' ').pop() || a.name;
        const nameB = b.name.split(' ').pop() || b.name;
        return nameA.localeCompare(nameB, 'vi');
      });

      setStudents(sorted.map((s, i) => ({
        stt: i + 1,
        name: s.name,
        phone: s.phone,
        score: '',
      })));
      setFilledCount(0);
    } catch (e: any) {
      onShowToast('Lỗi tải danh sách: ' + e.message, 'error');
    } finally {
      setLoadingStudents(false);
    }
  }, [onShowToast]);

  useEffect(() => {
    if (selectedClass) loadStudents(selectedClass);
  }, [selectedClass, loadStudents]);

  // ── Voice Recognition setup ──
  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      onShowToast('Trình duyệt của bạn không hỗ trợ nhận diện giọng nói. Vui lòng dùng Google Chrome.', 'error');
      return;
    }

    const recognition = new SR();
    recognition.lang = 'vi-VN';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;

    let lastProcessedText = '';
    let processingTimeout: NodeJS.Timeout | null = null;

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        const transcript = result[0].transcript.trim().toLowerCase();
        
        if (result.isFinal) {
          setInterimText('');
          processTranscript(transcript);
        } else {
          interim += transcript;
          // Thử parse ngay cả khi chưa final để tăng tốc
          if (transcript !== lastProcessedText && transcript.length > 5) {
            if (processingTimeout) clearTimeout(processingTimeout);
            processingTimeout = setTimeout(() => {
              processTranscript(transcript);
              lastProcessedText = transcript;
            }, 300); // 300ms debounce để tránh nhảy số liên tục
          }
        }
      }
      setInterimText(interim);
    };

    const processTranscript = (transcript: string) => {
      const cmd = parseVoiceCommand(transcript);
      if (cmd) {
        const { index, score } = cmd;
        setStudents(prev => {
          if (index >= prev.length) return prev;
          // Nếu điểm giống hệt điểm cũ thì không cần cập nhật để tránh nháy giao diện
          if (prev[index].score === String(score)) return prev;

          const updated = prev.map((s, i) =>
            i === index
              ? { ...s, score: String(score), highlight: true }
              : { ...s, highlight: false }
          );
          setFilledCount(updated.filter(s => s.score !== '').length);
          return updated;
        });
        setLastCommand(`✅ Số ${index + 1} → ${score} điểm`);
        
        // Hiệu ứng highlight ngắn hơn để cảm giác nhanh hơn
        setTimeout(() => {
          setStudents(prev => prev.map(s => ({ ...s, highlight: false })));
        }, 800);
      } else if (transcript.length > 10) {
        // Chỉ hiện lỗi khi chuỗi đủ dài để tránh hiện lỗi khi đang nói dở
        setLastCommand(`❓ Không nhận ra: "${transcript}"`);
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
      onShowToast('Lỗi micro. Vui lòng thử lại.', 'error');
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
    recognitionRef.current = recognition;
    setIsListening(true);
  }, [onShowToast]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
    setInterimText('');
  }, []);

  // ── Score editing ──
  const updateScore = (stt: number, value: string) => {
    setStudents(prev => {
      const updated = prev.map(s =>
        s.stt === stt ? { ...s, score: value } : s
      );
      setFilledCount(updated.filter(s => s.score !== '').length);
      return updated;
    });
  };

  const clearAllScores = () => {
    if (!window.confirm('Xóa toàn bộ điểm đã nhập?')) return;
    setStudents(prev => prev.map(s => ({ ...s, score: '' })));
    setFilledCount(0);
  };

  // ── Export Excel (chuẩn format vnEdu) ──
  const exportToExcel = () => {
    if (students.length === 0) {
      onShowToast('Chưa có danh sách học sinh.', 'warning');
      return;
    }

    // Build CSV with BOM for Excel to recognize UTF-8
    const BOM = '\uFEFF';
    const header = `STT,Họ và Tên,Số điện thoại,${examLabel || 'Điểm kiểm tra'}`;
    const rows = students.map(s =>
      `${s.stt},"${s.name}",${s.phone},${s.score || ''}`
    );
    const csv = BOM + [header, ...rows].join('\r\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedClass?.name || 'lop'}_${examLabel || 'diem'}_${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onShowToast('Đã xuất file! Mở bằng Excel rồi upload lên vnEdu.', 'success');
  };

  const progress = students.length > 0 ? (filledCount / students.length) * 100 : 0;

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-5xl mx-auto">

      {/* ── Header Card ── */}
      <div className="rounded-xl p-5 flex items-start gap-4" style={{ background: '#EEF0FB', border: '1px solid #C8D0F5' }}>
        <div className="p-2.5 rounded-xl shrink-0" style={{ background: '#6B7CDB' }}>
          <Mic className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-base font-semibold" style={{ color: '#1A1A1A' }}>Trợ lý Nhập Điểm bằng Giọng Nói</h2>
          <p className="text-sm mt-0.5" style={{ color: '#57564F' }}>
            Sắp xếp bài thi theo thứ tự danh sách → Bấm micro → Đọc <b>"Số 1: tám phẩy năm"</b> → Điểm tự động điền vào đúng ô.
          </p>
        </div>
      </div>

      {/* ── Setup Row ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Class selector */}
        <div className="rounded-xl p-4" style={{ background: '#fff', border: '1px solid #E9E9E7' }}>
          <label className="text-[10px] font-semibold uppercase tracking-wider block mb-2" style={{ color: '#AEACA8' }}>
            <Users className="w-3.5 h-3.5 inline mr-1" />Chọn lớp
          </label>
          <select
            value={selectedClass?.id || ''}
            onChange={e => {
              const cls = classes.find(c => c.id === e.target.value) || null;
              setSelectedClass(cls);
            }}
            className="w-full rounded-lg px-3 py-2.5 text-sm"
            style={{ background: '#F7F6F3', border: '1px solid #E9E9E7', color: '#1A1A1A', outline: 'none' }}
          >
            <option value="">— Chọn lớp —</option>
            {[12, 11, 10].map(g => (
              <optgroup key={g} label={`Khối ${g}`}>
                {classes.filter(c => c.grade === g).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Exam label */}
        <div className="rounded-xl p-4" style={{ background: '#fff', border: '1px solid #E9E9E7' }}>
          <label className="text-[10px] font-semibold uppercase tracking-wider block mb-2" style={{ color: '#AEACA8' }}>
            <FileSpreadsheet className="w-3.5 h-3.5 inline mr-1" />Tên bài kiểm tra (ghi vào file)
          </label>
          <input
            type="text"
            value={examLabel}
            onChange={e => setExamLabel(e.target.value)}
            placeholder="Ví dụ: Kiểm tra 15 phút HK2"
            className="w-full rounded-lg px-3 py-2.5 text-sm"
            style={{ background: '#F7F6F3', border: '1px solid #E9E9E7', color: '#1A1A1A', outline: 'none' }}
          />
        </div>
      </div>

      {/* ── Voice Control Panel ── */}
      {selectedClass && students.length > 0 && (
        <div className="rounded-xl p-5 space-y-4" style={{ background: '#fff', border: '1px solid #E9E9E7' }}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>
                {selectedClass.name} — {students.length} học sinh
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#787774' }}>
                Đã nhập: <b style={{ color: '#448361' }}>{filledCount}</b> / {students.length}
              </p>
            </div>
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
                onClick={exportToExcel}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors text-white"
                style={{ background: '#448361' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#376a50'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#448361'}
              >
                <Download className="w-4 h-4" />Xuất file vnEdu
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#F1F0EC' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progress}%`, background: progress === 100 ? '#448361' : '#6B7CDB' }}
            />
          </div>

          {/* Big Mic Button */}
          <div className="flex flex-col items-center gap-3 py-4">
            <button
              onClick={isListening ? stopListening : startListening}
              className="relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg"
              style={{
                background: isListening ? '#E03E3E' : '#6B7CDB',
                boxShadow: isListening ? '0 0 0 8px #E03E3E22' : '0 4px 20px rgba(107,124,219,0.35)',
              }}
            >
              {isListening ? (
                <MicOff className="w-8 h-8 text-white" />
              ) : (
                <Mic className="w-8 h-8 text-white" />
              )}
              {isListening && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-pulse border-2 border-white" />
              )}
            </button>

            <p className="text-sm font-medium" style={{ color: isListening ? '#E03E3E' : '#AEACA8' }}>
              {isListening ? '🎙️ Đang nghe... Đọc: "Số 1: tám phẩy năm"' : 'Bấm để bắt đầu đọc điểm'}
            </p>

            {/* Interim text */}
            {interimText && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg w-full max-w-sm" style={{ background: '#FFF7ED', border: '1px solid #FDDBA0' }}>
                <Volume2 className="w-4 h-4 shrink-0" style={{ color: '#D9730D' }} />
                <span className="text-sm italic" style={{ color: '#D9730D' }}>{interimText}</span>
              </div>
            )}

            {/* Last command result */}
            {lastCommand && (
              <div
                className="flex items-center gap-2 px-4 py-2 rounded-lg w-full max-w-sm"
                style={{
                  background: lastCommand.startsWith('✅') ? '#EAF3EE' : '#FEF0F0',
                  border: `1px solid ${lastCommand.startsWith('✅') ? '#B7D9C4' : '#F5C2C2'}`,
                }}
              >
                {lastCommand.startsWith('✅')
                  ? <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: '#448361' }} />
                  : <AlertCircle className="w-4 h-4 shrink-0" style={{ color: '#E03E3E' }} />
                }
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
              <b>Cách đọc:</b> "Số 1: tám phẩy năm" | "Số 2: bảy rưỡi" | "Số 3: chín" — Mỗi lần đọc xong một câu, dừng khoảng 0.5 giây để hệ thống xử lý.
            </p>
          </div>
        </div>
      )}

      {/* ── Grade Table ── */}
      {!selectedClass && (
        <div className="rounded-xl py-16 flex flex-col items-center gap-3" style={{ background: '#fff', border: '1px solid #E9E9E7' }}>
          <Users className="w-10 h-10" style={{ color: '#E9E9E7' }} />
          <p className="text-sm" style={{ color: '#AEACA8' }}>Chọn lớp để bắt đầu nhập điểm</p>
        </div>
      )}

      {loadingStudents && (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-6 h-6 animate-spin" style={{ color: '#6B7CDB' }} />
        </div>
      )}

      {selectedClass && !loadingStudents && students.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E9E9E7' }}>
          <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #E9E9E7', background: '#FAFAF9' }}>
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#AEACA8' }}>
              Bảng điểm — {selectedClass.name}
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
                  {['STT', 'Họ và Tên', 'SĐT', 'Điểm số'].map((h, i) => (
                    <th
                      key={h}
                      className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: '#AEACA8', borderBottom: '1px solid #E9E9E7', textAlign: i === 3 ? 'center' : 'left', width: i === 0 ? '60px' : i === 3 ? '120px' : 'auto' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr
                    key={s.stt}
                    style={{
                      borderBottom: '1px solid #F1F0EC',
                      background: s.highlight ? '#EEF0FB' : 'transparent',
                      transition: 'background 0.3s',
                    }}
                  >
                    <td className="px-5 py-3">
                      <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: '#F1F0EC', color: '#787774' }}>
                        {s.stt}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm font-medium" style={{ color: s.highlight ? '#6B7CDB' : '#1A1A1A' }}>
                      {s.name}
                      {s.highlight && <span className="ml-2 text-xs" style={{ color: '#6B7CDB' }}>← vừa điền</span>}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs" style={{ color: '#AEACA8' }}>{s.phone}</td>
                    <td className="px-5 py-3 text-center">
                      <input
                        type="number"
                        min="0"
                        max="10"
                        step="0.1"
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

          {/* Footer export */}
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderTop: '1px solid #E9E9E7', background: '#FAFAF9' }}>
            <p className="text-xs" style={{ color: '#787774' }}>
              File CSV xuất ra sẽ đúng thứ tự & định dạng để upload lên vnEdu
            </p>
            <button
              onClick={exportToExcel}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors"
              style={{ background: '#448361' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#376a50'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#448361'}
            >
              <Download className="w-4 h-4" />
              Xuất file vnEdu (.csv)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceGrader;
