import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../src/lib/supabase';
import {
    BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer, ReferenceLine, AreaChart, Area,
} from 'recharts';
import {
    TrendingUp, TrendingDown, Users, Award, AlertTriangle,
    Search, Download, RefreshCw, BarChart2, UserX,
    ChevronRight, ChevronUp, ChevronDown, Minus, BookOpen, CheckCircle, ArrowLeft, X,
    Sparkles, Target, Zap, Star, Brain, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { ExamResultRecord } from '../types';

// ── Grade config ──────────────────────────────────────────────────
const GRADE_CFG = {
    10: { label: 'Lớp 10', color: '#448361', bg: '#EAF3EE' },
    11: { label: 'Lớp 11', color: '#6B7CDB', bg: '#EEF0FB' },
    12: { label: 'Lớp 12', color: '#9065B0', bg: '#F3ECF8' },
} as const;

const GRADE_OPTIONS = [
    { value: 10 as const, label: 'Lớp 10', color: '#448361', bg: '#EAF3EE' },
    { value: 11 as const, label: 'Lớp 11', color: '#6B7CDB', bg: '#EEF0FB' },
    { value: 12 as const, label: 'Lớp 12', color: '#9065B0', bg: '#F3ECF8' },
];

// Legacy score buckets (overview tab)
const SCORE_BUCKETS = [
    { label: '0–2', min: 0, max: 2, fill: '#E03E3E' },
    { label: '2–4', min: 2, max: 4, fill: '#E03E3E' },
    { label: '4–5', min: 4, max: 5, fill: '#D9730D' },
    { label: '5–6', min: 5, max: 6, fill: '#D9730D' },
    { label: '6–7', min: 6, max: 7, fill: '#6B7CDB' },
    { label: '7–8', min: 7, max: 8, fill: '#6B7CDB' },
    { label: '8–9', min: 8, max: 9, fill: '#448361' },
    { label: '9–10', min: 9, max: 10.1, fill: '#448361' },
];
// New score buckets for exam analysis (6 bands as required)
const SCORE_BUCKETS_NEW = [
    { label: '0–2', min: 0, max: 2, fill: '#EF4444' },
    { label: '2–4', min: 2, max: 4, fill: '#F97316' },
    { label: '4–6', min: 4, max: 6, fill: '#FBBF24' },
    { label: '6–8', min: 6, max: 8, fill: '#60A5FA' },
    { label: '8–9', min: 8, max: 9, fill: '#34D399' },
    { label: '9–10', min: 9, max: 10.1, fill: '#10B981' },
];

const TOOLTIP_STYLE: React.CSSProperties = {
    borderRadius: '10px',
    border: '1px solid #E9E9E7',
    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
    fontSize: '13px',
    background: '#fff',
};

function scoreColor(s: number) {
    if (s >= 8) return '#448361';
    if (s >= 5) return '#D9730D';
    return '#E03E3E';
}
function scoreBg(s: number) {
    if (s >= 8) return '#EAF3EE';
    if (s >= 5) return '#FFF3E8';
    return '#FEF0F0';
}
function scoreCellBg(s: number): string {
    if (s >= 8) return '#dcfce7';
    if (s < 5) return '#fee2e2';
    return 'transparent';
}
function scoreTextColor(s: number): string {
    if (s >= 8) return '#166534';
    if (s < 5) return '#991b1b';
    return '#1a1a1a';
}

// ── StudentProfile ────────────────────────────────────────────────
interface StudentProfile {
    phone: string;
    name: string;
    grade: number;
    scores: number[];
    exams: string[];
    dates: string[];
    avg: number;
    best: number;
    worst: number;
    trend: number;
}

function buildProfiles(records: ExamResultRecord[]): StudentProfile[] {
    const map: Record<string, StudentProfile> = {};
    for (const r of records) {
        if (!map[r.student_phone]) {
            map[r.student_phone] = {
                phone: r.student_phone,
                name: r.student_name,
                grade: r.grade,
                scores: [], exams: [], dates: [],
                avg: 0, best: 0, worst: 0, trend: 0,
            };
        }
        map[r.student_phone].scores.push(r.score);
        map[r.student_phone].exams.push(r.exam_title);
        map[r.student_phone].dates.push(r.submitted_at);
    }
    return Object.values(map).map(s => {
        const avg = s.scores.reduce((a, b) => a + b, 0) / s.scores.length;
        const trend = s.scores.length >= 2 ? s.scores[s.scores.length - 1] - s.scores[0] : 0;
        return { ...s, avg, best: Math.max(...s.scores), worst: Math.min(...s.scores), trend };
    });
}

// ── StudentDetailModal ────────────────────────────────────────────
interface StudentDetailModalProps {
    studentName: string;
    studentPhone: string;
    records: ExamResultRecord[];
    onClose: () => void;
}
const StudentDetailModal: React.FC<StudentDetailModalProps> = ({ studentName, studentPhone, records, onClose }) => {
    const sorted = useMemo(
        () => [...records].sort((a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()),
        [records],
    );
    const avg = sorted.length > 0 ? sorted.reduce((s, r) => s + r.score, 0) / sorted.length : 0;
    const best = sorted.length > 0 ? Math.max(...sorted.map(r => r.score)) : 0;
    const worst = sorted.length > 0 ? Math.min(...sorted.map(r => r.score)) : 0;
    const initials = studentName.trim().split(/\s+/).filter(Boolean).map(p => p[0]).join('').toUpperCase().slice(0, 2);
    const maskedPhone = studentPhone.length >= 6 ? studentPhone.slice(0, 3) + ' **** ' + studentPhone.slice(-2) : studentPhone;

    useEffect(() => {
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prevOverflow; };
    }, []);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [onClose]);

    const portalTarget = typeof document !== 'undefined' ? document.body : null;
    if (!portalTarget) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 animate-fade-in"
            style={{ background: 'rgba(26,26,26,0.45)' }}
        >
            <div
                className="w-full overflow-hidden animate-scale-in"
                style={{
                    maxWidth: '560px',
                    background: '#FFFFFF',
                    border: '1px solid #E9E9E7',
                    borderRadius: '16px',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
                    maxHeight: '80vh',
                    display: 'flex',
                    flexDirection: 'column',
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #E9E9E7', background: '#EEF0FB' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0" style={{ background: '#6B7CDB' }}>
                            {initials}
                        </div>
                        <div>
                            <h3 className="text-base font-bold" style={{ color: '#1A1A1A' }}>{studentName}</h3>
                            <p className="text-xs mt-0.5" style={{ color: '#787774' }}>{maskedPhone} · {sorted.length} bài thi</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex gap-4">
                            <div className="text-center">
                                <div className="text-xl font-bold" style={{ color: scoreTextColor(avg) }}>{avg.toFixed(2)}</div>
                                <div className="text-[10px] uppercase tracking-wider" style={{ color: '#AEACA8' }}>Điểm TB</div>
                            </div>
                            <div className="text-center">
                                <div className="text-xl font-bold" style={{ color: scoreTextColor(best) }}>{best.toFixed(1)}</div>
                                <div className="text-[10px] uppercase tracking-wider" style={{ color: '#AEACA8' }}>Cao nhất</div>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ color: '#787774' }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#E9E9E7'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                            title="Đóng (Esc)"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Table */}
                <div style={{ overflowY: 'auto', flex: 1 }}>
                    {sorted.length === 0 ? (
                        <div className="py-12 text-center">
                            <BookOpen className="w-8 h-8 mx-auto mb-2" style={{ color: '#CFCFCB' }} />
                            <p className="text-sm" style={{ color: '#AEACA8' }}>Chưa có bài thi nào</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr style={{ background: '#F7F6F3', borderBottom: '2px solid #E9E9E7' }}>
                                    <th className="px-4 py-2.5 text-center text-xs font-semibold" style={{ color: '#787774', width: 40 }}>#</th>
                                    <th className="px-4 py-2.5 text-left text-xs font-semibold" style={{ color: '#787774' }}>Bài Thi</th>
                                    <th className="px-4 py-2.5 text-center text-xs font-semibold" style={{ color: '#787774', width: 75 }}>Điểm</th>
                                    <th className="px-4 py-2.5 text-center text-xs font-semibold" style={{ color: '#787774', width: 105 }}>Ngày Thi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sorted.map((r, idx) => (
                                    <tr key={`${r.exam_id}-${idx}`} style={{ borderBottom: '1px solid #F1F0EC', background: idx % 2 === 0 ? '#fff' : '#FAFAF9' }}>
                                        <td className="px-4 py-2.5 text-center text-xs" style={{ color: '#AEACA8' }}>{idx + 1}</td>
                                        <td className="px-4 py-2.5 text-sm" style={{ color: '#1A1A1A' }}>{r.exam_title}</td>
                                        <td className="px-4 py-2.5 text-center">
                                            <span className="inline-block px-2 py-0.5 rounded text-xs font-bold" style={{ background: scoreCellBg(r.score), color: scoreTextColor(r.score) }}>
                                                {r.score.toFixed(1)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5 text-center text-xs" style={{ color: '#AEACA8' }}>
                                            {new Date(r.submitted_at).toLocaleDateString('vi-VN')}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 flex items-center justify-between text-xs" style={{ borderTop: '1px solid #E9E9E7', background: '#FAFAF9' }}>
                    <span style={{ color: '#AEACA8' }}>
                        {sorted.length} bài · Thấp nhất:{' '}
                        <span style={{ color: scoreTextColor(worst), fontWeight: 600 }}>{worst.toFixed(1)}</span>
                    </span>
                    <button
                        onClick={onClose}
                        className="px-4 py-1.5 rounded-lg text-xs font-medium transition-colors"
                        style={{ background: '#EEF0FB', color: '#6B7CDB' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#DDE1F8'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#EEF0FB'}
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>,
        portalTarget,
    );
};
// ── Main component ────────────────────────────────────────────────
// ── GradebookTable child component ───────────────────────────────
interface GradebookRow {
    phone: string;
    name: string;
    scores: Record<string, number>;
    avg: number;
}
interface GradebookTableProps {
    rows: GradebookRow[];
    examColumns: { id: string; title: string }[];
    sortAsc: boolean;
    onToggleSort: () => void;
    onSelectStudent?: (phone: string, name: string) => void;
}
const GradebookTable: React.FC<GradebookTableProps> = ({ rows, examColumns, sortAsc, onToggleSort, onSelectStudent }) => {
    if (rows.length === 0) {
        return (
            <div className="rounded-xl py-16 text-center" style={{ background: '#fff', border: '1px solid #E9E9E7' }}>
                <BookOpen className="w-10 h-10 mx-auto mb-3" style={{ color: '#CFCFCB' }} />
                <p className="text-sm font-medium" style={{ color: '#57564F' }}>Lớp này chưa có dữ liệu bài thi</p>
                <p className="text-xs mt-1" style={{ color: '#AEACA8' }}>Học sinh cần hoàn thành ít nhất 1 bài thi</p>
            </div>
        );
    }
    return (
        <div className="rounded-xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E9E9E7' }}>
            {/* Legend */}
            <div className="px-4 py-2 flex items-center gap-4 text-[11px]" style={{ borderBottom: '1px solid #F1F0EC', background: '#FAFAF9', color: '#AEACA8' }}>
                <span className="font-semibold" style={{ color: '#57564F' }}>Chú thích:</span>
                <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#dcfce7' }} />
                    <span style={{ color: '#166534' }}>≥ 8 — Giỏi</span>
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#fee2e2' }} />
                    <span style={{ color: '#991b1b' }}>&lt; 5 — Chưa đạt</span>
                </span>
            </div>
            {/* Scrollable table */}
            <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse" style={{ minWidth: 'max-content' }}>
                    <thead>
                        <tr style={{ background: '#F7F6F3', borderBottom: '2px solid #E9E9E7' }}>
                            <th className="px-3 py-3 text-center font-semibold text-xs" style={{ color: '#787774', position: 'sticky', left: 0, background: '#F7F6F3', zIndex: 20, width: 48, boxShadow: '2px 0 4px rgba(0,0,0,0.04)' }}>
                                STT
                            </th>
                            <th className="px-4 py-3 text-left font-semibold text-xs" style={{ color: '#787774', position: 'sticky', left: 48, background: '#F7F6F3', zIndex: 20, minWidth: 160, boxShadow: '2px 0 4px rgba(0,0,0,0.04)' }}>
                                Tên Học Sinh
                            </th>
                            {examColumns.map(col => (
                                <th key={col.id} className="px-3 py-3 text-center font-semibold text-xs" style={{ color: '#787774', minWidth: 100 }} title={col.title}>
                                    <div className="max-w-[88px] mx-auto truncate">{col.title}</div>
                                </th>
                            ))}
                            <th
                                className="px-3 py-3 text-center font-semibold text-xs cursor-pointer select-none"
                                style={{ color: '#6B7CDB', background: '#EEF0FB', position: 'sticky', right: 0, zIndex: 20, minWidth: 105, boxShadow: '-2px 0 4px rgba(0,0,0,0.04)', whiteSpace: 'nowrap' }}
                                onClick={onToggleSort}
                            >
                                <span className="flex items-center justify-center gap-1">
                                    Điểm TB
                                    {sortAsc ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                </span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, idx) => {
                            const rowBase = idx % 2 === 0 ? '#fff' : '#FAFAF9';
                            const avgBg = scoreCellBg(row.avg) !== 'transparent' ? scoreCellBg(row.avg) : rowBase;
                            return (
                                <tr key={row.phone} style={{ borderBottom: '1px solid #F1F0EC' }}>
                                    <td className="px-3 py-2.5 text-xs text-center" style={{ color: '#AEACA8', position: 'sticky', left: 0, background: rowBase, zIndex: 10, boxShadow: '2px 0 4px rgba(0,0,0,0.04)' }}>
                                        {idx + 1}
                                    </td>
                                    <td
                                        className="px-4 py-2.5 font-medium text-sm cursor-pointer"
                                        style={{ color: '#6B7CDB', position: 'sticky', left: 48, background: rowBase, zIndex: 10, boxShadow: '2px 0 4px rgba(0,0,0,0.04)', textDecoration: 'underline', textDecorationColor: '#6B7CDB66' }}
                                        onClick={() => onSelectStudent?.(row.phone, row.name)}
                                        title="Xem bảng điểm cá nhân"
                                    >
                                        {row.name}
                                    </td>
                                    {examColumns.map(col => {
                                        const score = row.scores[col.id];
                                        return (
                                            <td key={col.id} className="px-3 py-2.5 text-center" style={{ background: rowBase }}>
                                                {score !== undefined ? (
                                                    <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold" style={{ background: scoreCellBg(score), color: scoreTextColor(score) }}>
                                                        {score.toFixed(1)}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs" style={{ color: '#D1D0CB' }}>—</span>
                                                )}
                                            </td>
                                        );
                                    })}
                                    <td className="px-3 py-2.5 text-center font-bold text-sm" style={{ color: scoreTextColor(row.avg), background: avgBg, position: 'sticky', right: 0, zIndex: 10, boxShadow: '-2px 0 4px rgba(0,0,0,0.04)' }}>
                                        {row.avg.toFixed(2)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <div className="px-4 py-2.5 text-xs" style={{ borderTop: '1px solid #F1F0EC', color: '#AEACA8' }}>
                {rows.length} học sinh · {examColumns.length} bài kiểm tra
            </div>
        </div>
    );
};

// ── ExamAnalysis child component ──────────────────────────────────
interface ExamAnalysisProps {
    examRecords: ExamResultRecord[];
    totalStudentsInGrade: number;
}
const ExamAnalysis: React.FC<ExamAnalysisProps> = ({ examRecords, totalStudentsInGrade }) => {
    const studentBestScores = useMemo(() => {
        const map = new Map<string, { name: string; phone: string; score: number }>();
        for (const r of examRecords) {
            const existing = map.get(r.student_phone);
            if (!existing || r.score > existing.score) {
                map.set(r.student_phone, { name: r.student_name, phone: r.student_phone, score: r.score });
            }
        }
        return Array.from(map.values());
    }, [examRecords]);
    const count = studentBestScores.length;
    const scores = useMemo(() => studentBestScores.map(s => s.score), [studentBestScores]);
    const avgScore = count > 0 ? scores.reduce((a, b) => a + b, 0) / count : 0;
    const maxScore = count > 0 ? Math.max(...scores) : 0;
    const minScore = count > 0 ? Math.min(...scores) : 0;
    const distribution = useMemo(
        () => SCORE_BUCKETS_NEW.map(b => ({ label: b.label, count: scores.filter(s => s >= b.min && s < b.max).length, fill: b.fill })),
        [scores],
    );
    const topStudents = useMemo(
        () => [...studentBestScores].filter(s => s.score >= 8).sort((a, b) => b.score - a.score),
        [studentBestScores],
    );
    const concernStudents = useMemo(
        () => [...studentBestScores].filter(s => s.score < 5).sort((a, b) => a.score - b.score),
        [studentBestScores],
    );
    if (count === 0) {
        return (
            <div className="rounded-xl py-16 text-center" style={{ background: '#fff', border: '1px solid #E9E9E7' }}>
                <BarChart2 className="w-10 h-10 mx-auto mb-3" style={{ color: '#CFCFCB' }} />
                <p className="text-sm font-medium" style={{ color: '#57564F' }}>Chưa có kết quả cho bài thi này</p>
                <p className="text-xs mt-1" style={{ color: '#AEACA8' }}>Hãy chọn một bài kiểm tra khác hoặc chờ học sinh nộp bài</p>
            </div>
        );
    }
    const statCards = [
        { label: 'Sĩ số lớp', value: String(totalStudentsInGrade), sub: 'học sinh', color: '#9065B0', bg: '#F3ECF8', Icon: Users },
        { label: 'Tham gia', value: String(count), sub: 'bài nộp', color: '#6B7CDB', bg: '#EEF0FB', Icon: BookOpen },
        { label: 'Điểm cao nhất', value: maxScore.toFixed(1), sub: '/ 10', color: '#448361', bg: '#EAF3EE', Icon: Award },
        { label: 'Điểm thấp nhất', value: minScore.toFixed(1), sub: '/ 10', color: '#E03E3E', bg: '#FEF0F0', Icon: TrendingDown },
        { label: 'Điểm TB đề', value: avgScore.toFixed(2), sub: '/ 10', color: avgScore >= 5 ? '#D9730D' : '#E03E3E', bg: avgScore >= 5 ? '#FFF3E8' : '#FEF0F0', Icon: BarChart2 },
    ] as const;
    return (
        <div className="space-y-4">
            {/* Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {statCards.map(card => (
                    <div key={card.label} className="rounded-xl p-4" style={{ background: '#fff', border: '1px solid #E9E9E7', borderLeft: `3px solid ${card.color}` }}>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-semibold uppercase tracking-wider leading-tight" style={{ color: '#AEACA8' }}>{card.label}</span>
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: card.bg }}>
                                <card.Icon className="w-3.5 h-3.5" style={{ color: card.color }} />
                            </div>
                        </div>
                        <div className="text-2xl font-bold" style={{ color: card.color }}>{card.value}</div>
                        <div className="text-[11px] mt-0.5" style={{ color: '#AEACA8' }}>{card.sub}</div>
                    </div>
                ))}
            </div>
            {/* Score Distribution */}
            <div className="rounded-xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E9E9E7' }}>
                <div className="px-4 py-3" style={{ borderBottom: '1px solid #E9E9E7', borderLeft: '3px solid #D9730D', background: '#FFF3E8' }}>
                    <h3 className="text-sm font-semibold" style={{ color: '#D9730D' }}>Phổ Điểm Bài Thi</h3>
                    <p className="text-[11px]" style={{ color: '#AEACA8' }}>Phân bố điểm số của {count} học sinh</p>
                </div>
                <div className="p-4">
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={distribution} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F1F0EC" vertical={false} />
                            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#AEACA8' }} axisLine={{ stroke: '#E9E9E7' }} tickLine={false} />
                            <YAxis tick={{ fontSize: 11, fill: '#AEACA8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`${v} học sinh`, 'Số lượng']} />
                            <Bar dataKey="count" name="Số học sinh" radius={[5, 5, 0, 0]}>
                                {distribution.map((entry, i) => <Cell key={i} fill={entry.fill} fillOpacity={0.85} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
            {/* Vinh Danh & Cần Chú Ý */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Top scorers */}
                <div className="rounded-xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E9E9E7' }}>
                    <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #E9E9E7', borderLeft: '3px solid #448361', background: '#EAF3EE' }}>
                        <Star className="w-4 h-4 shrink-0" style={{ color: '#448361' }} />
                        <div>
                            <h3 className="text-sm font-semibold" style={{ color: '#448361' }}>Bảng Vinh Danh</h3>
                            <p className="text-[11px]" style={{ color: '#6B9B7B' }}>Học sinh đạt ≥ 8 điểm · {topStudents.length} em</p>
                        </div>
                    </div>
                    <div>
                        {topStudents.length === 0 ? (
                            <p className="px-4 py-8 text-sm text-center" style={{ color: '#AEACA8' }}>Không có học sinh đạt ≥ 8 điểm</p>
                        ) : topStudents.map((s, idx) => (
                            <div key={s.phone} className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: idx < topStudents.length - 1 ? '1px solid #F1F0EC' : 'none' }}>
                                <div className="flex items-center gap-2.5">
                                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: idx === 0 ? '#FEF9C3' : '#EAF3EE', color: idx === 0 ? '#854D0E' : '#448361' }}>
                                        {idx + 1}
                                    </span>
                                    <span className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{s.name}</span>
                                </div>
                                <span className="text-sm font-bold px-2.5 py-0.5 rounded-lg" style={{ background: '#dcfce7', color: '#166534' }}>{s.score.toFixed(1)}</span>
                            </div>
                        ))}
                    </div>
                </div>
                {/* Concern students */}
                <div className="rounded-xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E9E9E7' }}>
                    <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #E9E9E7', borderLeft: '3px solid #E03E3E', background: '#FEF0F0' }}>
                        <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: '#E03E3E' }} />
                        <div>
                            <h3 className="text-sm font-semibold" style={{ color: '#E03E3E' }}>Nhóm Cần Chú Ý</h3>
                            <p className="text-[11px]" style={{ color: '#C97C7C' }}>Điểm dưới 5 · {concernStudents.length} em</p>
                        </div>
                    </div>
                    <div>
                        {concernStudents.length === 0 ? (
                            <div className="px-4 py-8 text-center">
                                <p className="text-sm font-medium" style={{ color: '#448361' }}>Tuyệt vời! 🎉</p>
                                <p className="text-xs mt-1" style={{ color: '#AEACA8' }}>Không có học sinh nào dưới 5 điểm</p>
                            </div>
                        ) : concernStudents.map((s, idx) => (
                            <div key={s.phone} className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: idx < concernStudents.length - 1 ? '1px solid #F1F0EC' : 'none' }}>
                                <div className="flex items-center gap-2.5">
                                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: '#FEF0F0', color: '#E03E3E' }}>
                                        {idx + 1}
                                    </span>
                                    <span className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{s.name}</span>
                                </div>
                                <span className="text-sm font-bold px-2.5 py-0.5 rounded-lg" style={{ background: '#fee2e2', color: '#991b1b' }}>{s.score.toFixed(1)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ── StatsPanel (Main) ─────────────────────────────────────────────
const StatsPanel: React.FC = () => {
    const [records, setRecords] = useState<ExamResultRecord[]>([]);
    const [loading, setLoading] = useState(true);
    // classMap: id -> name
    const [classMap, setClassMap] = useState<Record<string, string>>({});
    // studentClassMap: phone -> class_id
    const [studentClassMap, setStudentClassMap] = useState<Record<string, string>>({});

    // ── DATA FETCHING — PRESERVED EXACTLY, DO NOT MODIFY ─────────

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [resultsRes, classesRes, studentsRes] = await Promise.all([
                supabase
                    .from('exam_results')
                    .select('*')
                    .order('submitted_at', { ascending: true }),
                supabase
                    .from('classes')
                    .select('id, name'),
                supabase
                    .from('students')
                    .select('phone, class_id'),
            ]);
            setRecords((resultsRes.data as ExamResultRecord[]) || []);
            const newClassMap: Record<string, string> = {};
            for (const c of (classesRes.data || [])) {
                newClassMap[(c as { id: string; name: string }).id] = (c as { id: string; name: string }).name;
            }
            setClassMap(newClassMap);
            const newStudentClassMap: Record<string, string> = {};
            for (const s of (studentsRes.data || [])) {
                const row = s as { phone: string; class_id: string };
                if (row.phone && row.class_id) newStudentClassMap[row.phone] = row.class_id;
            }
            setStudentClassMap(newStudentClassMap);
        } catch (e) { console.error(e); }
        setLoading(false);
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    // ── NEW VIEW STATE ────────────────────────────────────────────
    const [selectedGrade, setSelectedGrade] = useState<10 | 11 | 12>(10);
    const [activeView, setActiveView] = useState<'gradebook' | 'exam-analysis'>('gradebook');
    const [selectedExamId, setSelectedExamId] = useState<string>('');
    const [sortAsc, setSortAsc] = useState(false);
    const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');
    const [selectedStudentPhone, setSelectedStudentPhone] = useState<string>('');
    const [selectedStudentName, setSelectedStudentName] = useState<string>('');

    // ── NEW VIEW: Derived data (useMemo only, no extra fetches) ───
    const gradeRecords = useMemo(
        () => records.filter(r => r.grade === selectedGrade),
        [records, selectedGrade],
    );

    const uniqueClasses = useMemo(() => {
        const set = new Set<string>();
        for (const r of gradeRecords) {
            const classId = studentClassMap[r.student_phone];
            const className = classId ? classMap[classId] : undefined;
            if (className) set.add(className);
        }
        return Array.from(set).sort();
    }, [gradeRecords, studentClassMap, classMap]);

    // Reset class filter when grade changes
    useEffect(() => { setSelectedClassFilter('all'); }, [selectedGrade]);

    const filteredByClassRecords = useMemo(
        () => selectedClassFilter === 'all'
            ? gradeRecords
            : gradeRecords.filter(r => {
                const classId = studentClassMap[r.student_phone];
                const className = classId ? classMap[classId] : undefined;
                return className === selectedClassFilter;
            }),
        [gradeRecords, selectedClassFilter, studentClassMap, classMap],
    );

    const examList = useMemo(() => {
        const map = new Map<string, string>();
        for (const r of filteredByClassRecords) {
            if (!map.has(r.exam_id)) map.set(r.exam_id, r.exam_title);
        }
        return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
    }, [filteredByClassRecords]);
    useEffect(() => {
        if (examList.length > 0 && !examList.some(e => e.id === selectedExamId)) {
            setSelectedExamId(examList[0].id);
        } else if (examList.length === 0) {
            setSelectedExamId('');
        }
    }, [examList, selectedExamId]);
    const gradebookData = useMemo(() => {
        const studentMap = new Map<string, { name: string; scores: Record<string, number> }>();
        for (const r of filteredByClassRecords) {
            if (!studentMap.has(r.student_phone)) {
                studentMap.set(r.student_phone, { name: r.student_name, scores: {} });
            }
            studentMap.get(r.student_phone)!.scores[r.exam_id] = r.score;
        }
        const rows = Array.from(studentMap.entries()).map(([phone, data]) => {
            const vals = Object.values(data.scores);
            const avg = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
            return { phone, name: data.name, scores: data.scores, avg };
        });
        const sorted = [...rows].sort((a, b) => sortAsc ? a.avg - b.avg : b.avg - a.avg);
        return { rows: sorted, examColumns: examList };
    }, [filteredByClassRecords, examList, sortAsc]);
    const selectedExamRecords = useMemo(
        () => filteredByClassRecords.filter(r => r.exam_id === selectedExamId),
        [filteredByClassRecords, selectedExamId],
    );
    const totalStudentsInGrade = useMemo(
        () => new Set(filteredByClassRecords.map(r => r.student_phone)).size,
        [filteredByClassRecords],
    );
    const gradeCfg = GRADE_OPTIONS.find(g => g.value === selectedGrade)!;
    const exportCSVNew = () => {
        const { examColumns, rows } = gradebookData;
        
        const headerCols = ['"Họ tên"', ...examColumns.map(e => `"${e.title}"`), '"Điểm TB"'];
        const header = headerCols.join(',') + '\n';
        
        const csvRows = rows.map(row => {
            const scores = examColumns.map(exam => {
                const score = row.scores[exam.id];
                return score !== undefined ? score.toFixed(2) : '""';
            });
            return [
                `"${row.name}"`,
                ...scores,
                row.avg.toFixed(2)
            ].join(',');
        }).join('\n');

        const classNameDisplay = selectedClassFilter === 'all' ? 'TatCa' : selectedClassFilter.replace(/\s+/g, '_');
        const fileName = `Diem_Lop${selectedGrade}_${classNameDisplay}_${new Date().toISOString().slice(0, 10)}.csv`;

        const blob = new Blob(['\uFEFF' + header + csvRows], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = fileName;
        a.click(); URL.revokeObjectURL(url);
    };


    // ── Render ────────────────────────────────────────────────────
    return (
        <div className="space-y-5 pb-10 animate-fade-in">

            {/* ══════════════════════════════════════════════════════════
                SECTION A — Header & Global Controls
            ══════════════════════════════════════════════════════════ */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div>
                    <h2
                        className="text-2xl font-bold tracking-tight"
                        style={{ color: '#1A1A1A' }}
                    >
                        Sổ Điểm &amp; Quản Lý Học Sinh
                    </h2>
                    <p className="text-sm mt-1.5" style={{ color: '#787774' }}>
                        {loading ? (
                            'Đang tải dữ liệu…'
                        ) : (
                            <>
                                <span className="font-semibold" style={{ color: gradeCfg.color }}>
                                    {gradeCfg.label}
                                </span>
                                {' · '}
                                <span>{gradeRecords.length} bản ghi</span>
                                {' · '}
                                <span>{totalStudentsInGrade} học sinh</span>
                            </>
                        )}
                    </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={fetchData}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-80 disabled:opacity-50"
                        style={{
                            background: '#fff',
                            border: '1px solid #E9E9E7',
                            color: '#57564F',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                        }}
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Làm mới
                    </button>
                    <button
                        onClick={exportCSVNew}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
                        style={{
                            background: '#448361',
                            color: '#fff',
                            boxShadow: '0 2px 6px rgba(68,131,97,0.25)',
                        }}
                    >
                        <Download className="w-4 h-4" />
                        Xuất CSV
                    </button>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════
                SECTION B — Cascading Toolbar
            ══════════════════════════════════════════════════════════ */}
            <div
                className="rounded-2xl flex flex-wrap items-center gap-2 p-2"
                style={{
                    background: '#fff',
                    border: '1px solid #E9E9E7',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                }}
            >
                {/* ── Group 1: Grade Selector ── */}
                <div
                    className="flex items-center gap-1 p-1 rounded-xl"
                    style={{ background: '#F7F6F3' }}
                >
                    {GRADE_OPTIONS.map(g => {
                        const isActive = selectedGrade === g.value;
                        return (
                            <button
                                key={g.value}
                                onClick={() => setSelectedGrade(g.value)}
                                className="px-4 py-1.5 rounded-lg text-[13px] font-semibold transition-all"
                                style={{
                                    background: isActive ? g.color : 'transparent',
                                    color: isActive ? '#fff' : '#787774',
                                    boxShadow: isActive ? `0 2px 6px ${g.color}40` : 'none',
                                }}
                            >
                                {g.label}
                            </button>
                        );
                    })}
                </div>

                {/* Divider */}
                <div className="self-stretch w-px" style={{ background: '#E9E9E7' }} />

                {/* ── Group 1b: Class Selector ── */}
                <div className="flex items-center gap-2">
                    <span
                        className="text-[11px] font-semibold uppercase tracking-wider shrink-0"
                        style={{ color: '#AEACA8' }}
                    >
                        Lớp:
                    </span>
                    <select
                        value={selectedClassFilter}
                        onChange={e => setSelectedClassFilter(e.target.value)}
                        className="text-[13px] font-semibold rounded-xl px-3 py-1.5 outline-none cursor-pointer transition-all"
                        style={{
                            background: selectedClassFilter === 'all' ? '#F7F6F3' : '#EEF0FB',
                            border: `1px solid ${selectedClassFilter === 'all' ? '#E9E9E7' : '#6B7CDB44'}`,
                            color: selectedClassFilter === 'all' ? '#787774' : '#6B7CDB',
                        }}
                    >
                        <option value="all">Tất cả lớp</option>
                        {uniqueClasses.map(cls => (
                            <option key={cls} value={cls}>{cls}</option>
                        ))}
                        {uniqueClasses.length === 0 && (
                            <option disabled value="">— Chưa phân lớp —</option>
                        )}
                    </select>
                </div>

                {/* Divider */}
                <div className="self-stretch w-px" style={{ background: '#E9E9E7' }} />

                {/* ── Group 2: View Mode Toggle ── */}
                <div
                    className="flex items-center gap-1 p-1 rounded-xl"
                    style={{ background: '#F7F6F3' }}
                >
                    {(
                        [
                            {
                                key: 'gradebook' as const,
                                label: 'Sổ Điểm Lớp',
                                Icon: BookOpen,
                                activeColor: '#6B7CDB',
                                activeBg: '#EEF0FB',
                            },
                            {
                                key: 'exam-analysis' as const,
                                label: 'Phân Tích Đề Thi',
                                Icon: BarChart2,
                                activeColor: '#D9730D',
                                activeBg: '#FFF3E8',
                            },
                        ] as const
                    ).map(tab => {
                        const isActive = activeView === tab.key;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setActiveView(tab.key)}
                                className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-[13px] font-semibold transition-all"
                                style={{
                                    background: isActive ? tab.activeBg : 'transparent',
                                    color: isActive ? tab.activeColor : '#787774',
                                    border: isActive
                                        ? `1px solid ${tab.activeColor}33`
                                        : '1px solid transparent',
                                }}
                            >
                                <tab.Icon className="w-3.5 h-3.5" />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* ── Group 3: Exam Selector (exam-analysis only) ── */}
                {activeView === 'exam-analysis' && (
                    <>
                        <div className="self-stretch w-px" style={{ background: '#E9E9E7' }} />
                        <div className="flex items-center gap-2 px-1 flex-1 min-w-0">
                            <span
                                className="text-[11px] font-semibold uppercase tracking-wider shrink-0"
                                style={{ color: '#AEACA8' }}
                            >
                                Đề thi:
                            </span>
                            <select
                                value={selectedExamId}
                                onChange={e => setSelectedExamId(e.target.value)}
                                className="flex-1 min-w-0 text-sm font-medium rounded-xl px-3 py-1.5 outline-none transition-all cursor-pointer"
                                style={{
                                    background: '#FFF3E8',
                                    border: '1px solid #D9730D33',
                                    color: '#92400E',
                                    maxWidth: '340px',
                                }}
                            >
                                {examList.length === 0 ? (
                                    <option value="">— Chưa có bài thi nào —</option>
                                ) : (
                                    examList.map(e => (
                                        <option key={e.id} value={e.id}>{e.title}</option>
                                    ))
                                )}
                            </select>
                        </div>
                    </>
                )}
            </div>

            {/* ══════════════════════════════════════════════════════════
                SECTION C — Dynamic Main Content
            ══════════════════════════════════════════════════════════ */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-32 gap-3">
                    <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center"
                        style={{ background: '#EEF0FB' }}
                    >
                        <RefreshCw className="w-6 h-6 animate-spin" style={{ color: '#6B7CDB' }} />
                    </div>
                    <div className="text-center">
                        <p className="text-sm font-semibold" style={{ color: '#57564F' }}>
                            Đang tải dữ liệu
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: '#AEACA8' }}>
                            Vui lòng chờ trong giây lát…
                        </p>
                    </div>
                </div>
            ) : activeView === 'gradebook' ? (
                <GradebookTable
                    rows={gradebookData.rows}
                    examColumns={gradebookData.examColumns}
                    sortAsc={sortAsc}
                    onToggleSort={() => setSortAsc(s => !s)}
                    onSelectStudent={(phone, name) => { setSelectedStudentPhone(phone); setSelectedStudentName(name); }}
                />
            ) : (
                <ExamAnalysis
                    examRecords={selectedExamRecords}
                    totalStudentsInGrade={totalStudentsInGrade}
                />
            )}

            {/* Student detail modal */}
            {selectedStudentPhone && (
                <StudentDetailModal
                    studentName={selectedStudentName}
                    studentPhone={selectedStudentPhone}
                    records={filteredByClassRecords.filter(r => r.student_phone === selectedStudentPhone)}
                    onClose={() => setSelectedStudentPhone('')}
                />
            )}
        </div>
    );
};

export default StatsPanel;





