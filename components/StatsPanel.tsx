import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../src/lib/supabase';
import {
    BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer, ReferenceLine, AreaChart, Area,
} from 'recharts';
import {
    TrendingUp, TrendingDown, Users, Award, AlertTriangle,
    Search, Download, RefreshCw, BarChart2, UserX,
    ChevronRight, Minus, BookOpen, CheckCircle, ArrowLeft,
    Sparkles, Target, Zap, Star, Brain, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { ExamResultRecord } from '../types';

// ── Grade config ──────────────────────────────────────────────────
const GRADE_CFG = {
    10: { label: 'Lớp 10', color: '#448361', bg: '#EAF3EE' },
    11: { label: 'Lớp 11', color: '#6B7CDB', bg: '#EEF0FB' },
    12: { label: 'Lớp 12', color: '#9065B0', bg: '#F3ECF8' },
} as const;

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

// ── Main component ────────────────────────────────────────────────
const StatsPanel: React.FC = () => {
    const [records, setRecords] = useState<ExamResultRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [gradeFilter, setGradeFilter] = useState<number | null>(null);
    const [view, setView] = useState<'overview' | 'student' | 'concern'>('overview');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPhone, setSelectedPhone] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await supabase
                .from('exam_results')
                .select('*')
                .order('submitted_at', { ascending: true });
            setRecords((data as ExamResultRecord[]) || []);
        } catch (e) { console.error(e); }
        setLoading(false);
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    // ── Filtered records ──
    const filtered = useMemo(() =>
        gradeFilter ? records.filter(r => r.grade === gradeFilter) : records,
        [records, gradeFilter]
    );

    // ── Aggregate stats ──
    const totalExams = filtered.length;
    const avgScore = totalExams > 0 ? filtered.reduce((s, r) => s + r.score, 0) / totalExams : 0;
    const passRate = totalExams > 0 ? (filtered.filter(r => r.score >= 5).length / totalExams) * 100 : 0;
    const uniqueStudents = new Set(filtered.map(r => r.student_phone)).size;

    // Score distribution
    const scoreDistribution = SCORE_BUCKETS.map(b => ({
        label: b.label,
        count: filtered.filter(r => r.score >= b.min && r.score < b.max).length,
        fill: b.fill,
    }));

    // Trend: avg/max/min per exam (chronological)
    const trendData = useMemo(() => {
        const examMap: Record<string, { title: string; scores: number[] }> = {};
        for (const r of filtered) {
            if (!examMap[r.exam_id]) examMap[r.exam_id] = { title: r.exam_title?.slice(0, 18) || r.exam_id, scores: [] };
            examMap[r.exam_id].scores.push(r.score);
        }
        return Object.values(examMap).map(e => ({
            name: e.title,
            avg: parseFloat((e.scores.reduce((a, b) => a + b, 0) / e.scores.length).toFixed(2)),
            max: parseFloat(Math.max(...e.scores).toFixed(2)),
            min: parseFloat(Math.min(...e.scores).toFixed(2)),
        }));
    }, [filtered]);

    // Grade comparison (always use all records)
    const gradeComparison = [10, 11, 12].map(g => {
        const gr = records.filter(r => r.grade === g);
        const avg = gr.length > 0 ? gr.reduce((s, r) => s + r.score, 0) / gr.length : 0;
        const pass = gr.length > 0 ? (gr.filter(r => r.score >= 5).length / gr.length) * 100 : 0;
        const cfg = GRADE_CFG[g as keyof typeof GRADE_CFG];
        return { grade: cfg.label, avg: parseFloat(avg.toFixed(2)), passRate: parseFloat(pass.toFixed(1)), count: gr.length, color: cfg.color };
    });

    // Pie
    const pieData = [
        { name: 'Đạt (≥5)', value: filtered.filter(r => r.score >= 5).length, color: '#448361' },
        { name: 'Chưa đạt (<5)', value: filtered.filter(r => r.score < 5).length, color: '#E03E3E' },
    ];

    // Student profiles
    const profiles = useMemo(() => buildProfiles(filtered), [filtered]);
    const concernStudents = profiles.filter(s => s.avg < 5 || s.trend < -1).sort((a, b) => a.avg - b.avg);

    const searchedStudents = searchTerm.trim().length >= 2
        ? profiles.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.phone.includes(searchTerm))
        : [];

    // ── AI Insights (rule-based) ──
    const aiInsights = useMemo(() => {
        if (totalExams < 2 || profiles.length < 1) return null;

        const insights: { icon: React.ElementType; title: string; text: string; type: 'success' | 'warning' | 'danger' | 'info' }[] = [];

        // 1) Overall assessment
        if (avgScore >= 8) {
            insights.push({ icon: Star, title: 'Kết quả xuất sắc', text: `Điểm trung bình ${avgScore.toFixed(2)}/10 — lớp đang học rất tốt! Tỷ lệ đạt ${passRate.toFixed(0)}%.`, type: 'success' });
        } else if (avgScore >= 6.5) {
            insights.push({ icon: CheckCircle, title: 'Kết quả khá tốt', text: `Điểm trung bình ${avgScore.toFixed(2)}/10 — khá ổn định. Tỷ lệ đạt ${passRate.toFixed(0)}%.`, type: 'success' });
        } else if (avgScore >= 5) {
            insights.push({ icon: AlertTriangle, title: 'Cần cải thiện', text: `Điểm trung bình chỉ ${avgScore.toFixed(2)}/10 — nên tập trung vào nhóm học sinh có điểm dưới 5.`, type: 'warning' });
        } else {
            insights.push({ icon: AlertTriangle, title: 'Cảnh báo nghiêm trọng', text: `Điểm trung bình ${avgScore.toFixed(2)}/10 — đa số học sinh chưa đạt. Cần rà soát phương pháp giảng dạy.`, type: 'danger' });
        }

        // 2) Concern students count
        if (concernStudents.length > 0) {
            const pct = ((concernStudents.length / profiles.length) * 100).toFixed(0);
            insights.push({
                icon: Target,
                title: `${concernStudents.length} học sinh cần chú ý`,
                text: `Chiếm ${pct}% tổng số học sinh. Các em có điểm TB dưới 5 hoặc xu hướng giảm điểm liên tục.`,
                type: concernStudents.length >= profiles.length * 0.3 ? 'danger' : 'warning',
            });
        } else {
            insights.push({ icon: Award, title: 'Không có học sinh cần chú ý đặc biệt', text: 'Tất cả các em đều đạt từ 5 trở lên và không có xu hướng giảm. Rất tốt!', type: 'success' });
        }

        // 3) Trend analysis (compare first half vs second half of trendData)
        if (trendData.length >= 3) {
            const mid = Math.floor(trendData.length / 2);
            const firstHalf = trendData.slice(0, mid);
            const secondHalf = trendData.slice(mid);
            const avgFirst = firstHalf.reduce((s, d) => s + d.avg, 0) / firstHalf.length;
            const avgSecond = secondHalf.reduce((s, d) => s + d.avg, 0) / secondHalf.length;
            const diff = avgSecond - avgFirst;

            if (diff > 0.5) {
                insights.push({ icon: ArrowUpRight, title: 'Xu hướng tăng điểm', text: `Điểm TB các đề gần đây tăng ${diff.toFixed(2)} so với các đề trước. Học sinh đang tiến bộ!`, type: 'success' });
            } else if (diff < -0.5) {
                insights.push({ icon: ArrowDownRight, title: 'Xu hướng giảm điểm', text: `Điểm TB các đề gần đây giảm ${Math.abs(diff).toFixed(2)} so với trước. Nên xem lại độ khó đề hoặc nội dung ôn tập.`, type: 'danger' });
            } else {
                insights.push({ icon: Minus, title: 'Điểm số ổn định', text: `Điểm TB gần như không thay đổi qua các đề (biến động ${Math.abs(diff).toFixed(2)}). Lớp duy trì phong độ tốt.`, type: 'info' });
            }
        }

        // 4) Top performers
        const topStudents = [...profiles].sort((a, b) => b.avg - a.avg).slice(0, 3);
        if (topStudents.length > 0 && topStudents[0].scores.length >= 2) {
            const topNames = topStudents.map(s => s.name).join(', ');
            insights.push({
                icon: Star,
                title: 'Học sinh xuất sắc nhất',
                text: `${topNames} — với điểm TB lần lượt: ${topStudents.map(s => s.avg.toFixed(2)).join(', ')}.`,
                type: 'info',
            });
        }

        // 5) Grade comparison (only if no grade filter is active)
        if (!gradeFilter) {
            const gradesWithData = gradeComparison.filter(g => g.count > 0);
            if (gradesWithData.length >= 2) {
                const best = gradesWithData.reduce((a, b) => a.avg > b.avg ? a : b);
                const worst = gradesWithData.reduce((a, b) => a.avg < b.avg ? a : b);
                if (best.grade !== worst.grade) {
                    insights.push({
                        icon: Zap,
                        title: 'So sánh giữa các khối',
                        text: `${best.grade} học tốt nhất (TB: ${best.avg.toFixed(2)}), ${worst.grade} cần hỗ trợ thêm (TB: ${worst.avg.toFixed(2)}).`,
                        type: 'info',
                    });
                }
            }
        }

        // 6) Score distribution warning
        const lowScoreCount = filtered.filter(r => r.score < 4).length;
        const lowPct = totalExams > 0 ? (lowScoreCount / totalExams) * 100 : 0;
        if (lowPct > 20) {
            insights.push({
                icon: AlertTriangle,
                title: 'Nhiều bài điểm rất thấp',
                text: `${lowPct.toFixed(0)}% bài thi có điểm dưới 4 (${lowScoreCount}/${totalExams} bài). Nên xem lại phần kiến thức cơ bản.`,
                type: 'danger',
            });
        }

        return insights;
    }, [totalExams, avgScore, passRate, profiles, concernStudents, trendData, gradeFilter, gradeComparison, filtered]);

    const selectedProfile = selectedPhone ? profiles.find(p => p.phone === selectedPhone) : null;
    const selectedChartData = selectedProfile
        ? selectedProfile.scores.map((score, i) => ({ n: i + 1, score, exam: selectedProfile.exams[i]?.slice(0, 14) || `Bài ${i + 1}` }))
        : [];

    // Export CSV
    const exportCSV = () => {
        const header = 'Tên,SĐT,Đề thi,Điểm,Câu đúng,Tổng câu,Lớp,Thời gian\n';
        const rows = filtered.map(r =>
            `"${r.student_name}","${r.student_phone}","${r.exam_title}",${r.score},${r.correct_answers},${r.total_questions},${r.grade},"${new Date(r.submitted_at).toLocaleString('vi-VN')}"`
        ).join('\n');
        const blob = new Blob(['\uFEFF' + header + rows], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `physivault_stats_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // ── Render ────────────────────────────────────────────────────
    return (
        <div className="space-y-5 pb-10 animate-fade-in">

            {/* ── Header & Controls ── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl font-semibold" style={{ color: '#1A1A1A' }}>Thống kê & Báo cáo</h2>
                    <p className="text-sm mt-0.5" style={{ color: '#787774' }}>
                        {loading ? 'Đang tải...' : `${totalExams} lượt làm bài · ${uniqueStudents} học sinh`}
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Grade filter */}
                    {([null, 10, 11, 12] as (number | null)[]).map(g => {
                        const cfg = g ? GRADE_CFG[g as keyof typeof GRADE_CFG] : null;
                        const isActive = gradeFilter === g;
                        return (
                            <button
                                key={String(g)}
                                onClick={() => setGradeFilter(g)}
                                className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all"
                                style={{
                                    background: isActive ? (cfg?.color || '#1A1A1A') : '#F7F6F3',
                                    color: isActive ? '#fff' : '#787774',
                                    border: `1px solid ${isActive ? (cfg?.color || '#1A1A1A') : '#E9E9E7'}`,
                                }}
                            >
                                {g ? `Lớp ${g}` : 'Tất cả'}
                            </button>
                        );
                    })}
                    <button
                        onClick={fetchData} disabled={loading}
                        className="p-2 rounded-lg transition-colors"
                        style={{ background: '#F7F6F3', border: '1px solid #E9E9E7', color: '#787774' }}
                        title="Tải lại dữ liệu"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={exportCSV}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                        style={{ background: '#EAF3EE', color: '#448361', border: '1px solid #44836133' }}
                    >
                        <Download className="w-3.5 h-3.5" />
                        Xuất CSV
                    </button>
                </div>
            </div>

            {/* ── Sub-tabs ── */}
            <div className="flex items-center gap-1 border-b" style={{ borderColor: '#E9E9E7' }}>
                {[
                    { key: 'overview', label: 'Tổng quan', Icon: BarChart2 },
                    { key: 'student', label: 'Chi tiết học sinh', Icon: Search },
                    { key: 'concern', label: `Cần chú ý (${concernStudents.length})`, Icon: AlertTriangle },
                ].map(({ key, label, Icon }) => (
                    <button
                        key={key}
                        onClick={() => { setView(key as any); setSelectedPhone(null); }}
                        className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2"
                        style={{
                            color: view === key ? '#6B7CDB' : '#787774',
                            borderColor: view === key ? '#6B7CDB' : 'transparent',
                            marginBottom: '-1px',
                        }}
                    >
                        <Icon className="w-3.5 h-3.5" />
                        {label}
                    </button>
                ))}
            </div>

            {loading && (
                <div className="flex items-center justify-center py-24">
                    <RefreshCw className="w-6 h-6 animate-spin" style={{ color: '#6B7CDB' }} />
                    <span className="ml-3 text-sm" style={{ color: '#787774' }}>Đang tải dữ liệu thống kê...</span>
                </div>
            )}

            {/* ════════════════════════════════════════════════
                OVERVIEW VIEW
            ════════════════════════════════════════════════ */}
            {!loading && view === 'overview' && (
                <>
                    {/* Stat cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                            { label: 'Lượt làm bài', value: totalExams, sub: 'bài thi', color: '#6B7CDB', bg: '#EEF0FB', Icon: BookOpen },
                            { label: 'Điểm trung bình', value: avgScore.toFixed(2), sub: '/ 10 điểm', color: scoreColor(avgScore), bg: scoreBg(avgScore), Icon: Award },
                            { label: 'Tỷ lệ đạt', value: `${passRate.toFixed(1)}%`, sub: '≥ 5 điểm', color: passRate >= 70 ? '#448361' : '#D9730D', bg: passRate >= 70 ? '#EAF3EE' : '#FFF3E8', Icon: CheckCircle },
                            { label: 'Học sinh', value: uniqueStudents, sub: 'đã thi', color: '#9065B0', bg: '#F3ECF8', Icon: Users },
                        ].map(card => (
                            <div key={card.label} className="rounded-xl p-4" style={{ background: '#fff', border: '1px solid #E9E9E7', borderLeft: `3px solid ${card.color}` }}>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#AEACA8' }}>{card.label}</span>
                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: card.bg, color: card.color }}>
                                        <card.Icon className="w-3.5 h-3.5" />
                                    </div>
                                </div>
                                <div className="text-2xl font-bold" style={{ color: card.color }}>{card.value}</div>
                                <div className="text-[11px] mt-0.5" style={{ color: '#AEACA8' }}>{card.sub}</div>
                            </div>
                        ))}
                    </div>

                    {totalExams === 0 ? (
                        <div className="rounded-xl py-16 text-center" style={{ background: '#fff', border: '1px solid #E9E9E7' }}>
                            <BarChart2 className="w-10 h-10 mx-auto mb-3" style={{ color: '#CFCFCB' }} />
                            <p className="text-sm font-medium" style={{ color: '#57564F' }}>Chưa có dữ liệu bài thi</p>
                            <p className="text-xs mt-1" style={{ color: '#AEACA8' }}>Học sinh cần hoàn thành ít nhất 1 bài thi để xem thống kê</p>
                        </div>
                    ) : (
                        <>
                            {/* Row 1: line chart + pie */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                {/* Trend Line Chart */}
                                <div className="lg:col-span-2 rounded-xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E9E9E7' }}>
                                    <div className="px-4 py-3" style={{ borderBottom: '1px solid #E9E9E7', borderLeft: '3px solid #6B7CDB', background: '#EEF0FB' }}>
                                        <h3 className="text-sm font-semibold" style={{ color: '#6B7CDB' }}>Điểm trung bình theo từng đề</h3>
                                        <p className="text-[11px]" style={{ color: '#AEACA8' }}>Min / Trung bình / Max từng đề thi</p>
                                    </div>
                                    <div className="p-4">
                                        <ResponsiveContainer width="100%" height={210}>
                                            <LineChart data={trendData} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#F1F0EC" vertical={false} />
                                                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#AEACA8' }} axisLine={{ stroke: '#E9E9E7' }} tickLine={false} />
                                                <YAxis domain={[0, 10]} tick={{ fontSize: 10, fill: '#AEACA8' }} axisLine={false} tickLine={false} />
                                                <Tooltip contentStyle={TOOLTIP_STYLE} />
                                                <ReferenceLine y={5} stroke="#E03E3E" strokeDasharray="4 4" strokeOpacity={0.4} />
                                                <Line type="monotone" dataKey="max" stroke="#448361" strokeWidth={1.5} dot={{ r: 2 }} name="Cao nhất" strokeDasharray="5 3" />
                                                <Line type="monotone" dataKey="avg" stroke="#6B7CDB" strokeWidth={2.5} dot={{ r: 4, fill: '#6B7CDB' }} activeDot={{ r: 6 }} name="Trung bình" />
                                                <Line type="monotone" dataKey="min" stroke="#E03E3E" strokeWidth={1.5} dot={{ r: 2 }} name="Thấp nhất" strokeDasharray="5 3" />
                                                <Legend iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* Pie Chart */}
                                <div className="rounded-xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E9E9E7' }}>
                                    <div className="px-4 py-3" style={{ borderBottom: '1px solid #E9E9E7', borderLeft: '3px solid #448361', background: '#EAF3EE' }}>
                                        <h3 className="text-sm font-semibold" style={{ color: '#448361' }}>Tỷ lệ Đạt / Không đạt</h3>
                                    </div>
                                    <div className="p-4 flex flex-col items-center gap-3">
                                        <ResponsiveContainer width="100%" height={160}>
                                            <PieChart>
                                                <Pie data={pieData} cx="50%" cy="50%" innerRadius={48} outerRadius={72} dataKey="value" paddingAngle={3}>
                                                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                                                </Pie>
                                                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`${v} bài`, '']} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                        <div className="flex gap-4 text-xs">
                                            {pieData.map(p => (
                                                <div key={p.name} className="flex items-center gap-1.5">
                                                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
                                                    <span style={{ color: '#787774' }}>{p.name}</span>
                                                    <span className="font-bold" style={{ color: p.color }}>{p.value}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Score Distribution */}
                            <div className="rounded-xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E9E9E7' }}>
                                <div className="px-4 py-3" style={{ borderBottom: '1px solid #E9E9E7', borderLeft: '3px solid #D9730D', background: '#FFF3E8' }}>
                                    <h3 className="text-sm font-semibold" style={{ color: '#D9730D' }}>Phổ điểm (Histogram)</h3>
                                    <p className="text-[11px]" style={{ color: '#AEACA8' }}>Phân phối điểm số của tất cả lượt làm bài</p>
                                </div>
                                <div className="p-4">
                                    <ResponsiveContainer width="100%" height={180}>
                                        <BarChart data={scoreDistribution} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#F1F0EC" vertical={false} />
                                            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#AEACA8' }} axisLine={{ stroke: '#E9E9E7' }} tickLine={false} />
                                            <YAxis tick={{ fontSize: 11, fill: '#AEACA8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                                            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`${v} bài`, 'Số lượng']} />
                                            <Bar dataKey="count" name="Số bài" radius={[4, 4, 0, 0]}>
                                                {scoreDistribution.map((entry, i) => <Cell key={i} fill={entry.fill} fillOpacity={0.85} />)}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Grade Comparison */}
                            <div className="rounded-xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E9E9E7' }}>
                                <div className="px-4 py-3" style={{ borderBottom: '1px solid #E9E9E7', borderLeft: '3px solid #9065B0', background: '#F3ECF8' }}>
                                    <h3 className="text-sm font-semibold" style={{ color: '#9065B0' }}>So sánh các khối lớp</h3>
                                    <p className="text-[11px]" style={{ color: '#AEACA8' }}>Điểm trung bình và tỷ lệ đạt theo từng khối</p>
                                </div>
                                <div className="p-4 space-y-4">
                                    {/* Summary cards */}
                                    <div className="grid grid-cols-3 gap-3">
                                        {gradeComparison.map(g => (
                                            <div key={g.grade} className="rounded-lg p-3 text-center" style={{ background: '#FAFAF9', border: '1px solid #F1F0EC' }}>
                                                <div className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#AEACA8' }}>{g.grade}</div>
                                                <div className="text-2xl font-bold" style={{ color: g.color }}>{g.count > 0 ? g.avg.toFixed(2) : '—'}</div>
                                                <div className="text-[11px] mt-0.5" style={{ color: '#787774' }}>
                                                    {g.count > 0 ? `${g.passRate}% đạt · ${g.count} bài` : 'Chưa có dữ liệu'}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {/* Grouped bar chart */}
                                    <ResponsiveContainer width="100%" height={170}>
                                        <BarChart data={gradeComparison} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#F1F0EC" vertical={false} />
                                            <XAxis dataKey="grade" tick={{ fontSize: 11, fill: '#AEACA8' }} axisLine={{ stroke: '#E9E9E7' }} tickLine={false} />
                                            <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: '#AEACA8' }} axisLine={false} tickLine={false} />
                                            <Tooltip contentStyle={TOOLTIP_STYLE} />
                                            <ReferenceLine y={5} stroke="#E03E3E" strokeDasharray="4 4" strokeOpacity={0.4} />
                                            <Bar dataKey="avg" name="Điểm TB" radius={[5, 5, 0, 0]} maxBarSize={60}>
                                                {gradeComparison.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* ════════════════════════════════════════════════
                                AI INSIGHTS PANEL (Teacher)
                            ════════════════════════════════════════════════ */}
                            {aiInsights && aiInsights.length > 0 && (
                                <div className="rounded-xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E9E9E7' }}>
                                    <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #E9E9E7', background: 'linear-gradient(135deg, #EEF0FB 0%, #F3ECF8 100%)', borderLeft: '3px solid #6B7CDB' }}>
                                        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6B7CDB, #9065B0)' }}>
                                            <Brain className="w-3.5 h-3.5 text-white" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-semibold" style={{ color: '#6B7CDB' }}>Nhận xét thông minh</h3>
                                            <p className="text-[11px]" style={{ color: '#AEACA8' }}>Phân tích tự động dựa trên dữ liệu {gradeFilter ? `Lớp ${gradeFilter}` : 'toàn trường'}</p>
                                        </div>
                                    </div>
                                    <div className="p-4 space-y-3">
                                        {aiInsights.map((insight, idx) => {
                                            const colorMap = {
                                                success: { bg: '#EAF3EE', border: '#44836133', color: '#448361', iconBg: '#D1FAE5' },
                                                warning: { bg: '#FFF3E8', border: '#D9730D33', color: '#D9730D', iconBg: '#FEF3C7' },
                                                danger: { bg: '#FEF0F0', border: '#E03E3E33', color: '#E03E3E', iconBg: '#FEE2E2' },
                                                info: { bg: '#EEF0FB', border: '#6B7CDB33', color: '#6B7CDB', iconBg: '#E0E7FF' },
                                            };
                                            const c = colorMap[insight.type];
                                            const Icon = insight.icon;
                                            return (
                                                <div
                                                    key={idx}
                                                    className="flex items-start gap-3 rounded-xl p-3.5 transition-all"
                                                    style={{ background: c.bg, border: `1px solid ${c.border}` }}
                                                >
                                                    <div
                                                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                                                        style={{ background: c.iconBg }}
                                                    >
                                                        <Icon className="w-4 h-4" style={{ color: c.color }} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="text-sm font-semibold mb-0.5" style={{ color: c.color }}>
                                                            {insight.title}
                                                        </div>
                                                        <div className="text-xs leading-relaxed" style={{ color: '#57564F' }}>
                                                            {insight.text}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        <div className="flex items-center gap-1.5 pt-1 text-[10px]" style={{ color: '#AEACA8' }}>
                                            <Sparkles className="w-3 h-3" />
                                            <span>Phân tích tự động · Cập nhật realtime theo dữ liệu bài thi</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </>
            )}

            {/* ════════════════════════════════════════════════
                STUDENT DETAIL VIEW
            ════════════════════════════════════════════════ */}
            {!loading && view === 'student' && (
                <div className="space-y-4">
                    {!selectedPhone && (
                        <>
                            {/* Search box */}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#AEACA8' }} />
                                <input
                                    type="text"
                                    placeholder="Tìm theo tên hoặc số điện thoại học sinh..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none"
                                    style={{ background: '#fff', border: '1px solid #E9E9E7', color: '#1A1A1A', transition: 'border-color 0.15s' }}
                                    onFocus={e => (e.currentTarget.style.borderColor = '#6B7CDB')}
                                    onBlur={e => (e.currentTarget.style.borderColor = '#E9E9E7')}
                                />
                            </div>

                            {searchTerm.trim().length < 2 && (
                                <div className="rounded-xl py-12 text-center" style={{ background: '#fff', border: '1px solid #E9E9E7' }}>
                                    <Search className="w-8 h-8 mx-auto mb-2" style={{ color: '#CFCFCB' }} />
                                    <p className="text-sm" style={{ color: '#AEACA8' }}>Nhập ít nhất 2 ký tự để tìm kiếm học sinh</p>
                                </div>
                            )}

                            {searchTerm.trim().length >= 2 && (
                                <div className="rounded-xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E9E9E7' }}>
                                    {searchedStudents.length === 0 ? (
                                        <div className="py-10 text-center text-sm italic" style={{ color: '#AEACA8' }}>
                                            <UserX className="w-8 h-8 mx-auto mb-2" style={{ color: '#CFCFCB' }} />
                                            Không tìm thấy học sinh nào
                                        </div>
                                    ) : searchedStudents.map((s, idx) => {
                                        const cfg = GRADE_CFG[s.grade as keyof typeof GRADE_CFG];
                                        return (
                                            <div
                                                key={s.phone}
                                                className="flex items-center justify-between px-4 py-3 cursor-pointer transition-colors"
                                                style={{ borderBottom: idx < searchedStudents.length - 1 ? '1px solid #F1F0EC' : 'none', background: '#fff' }}
                                                onMouseEnter={e => (e.currentTarget.style.background = '#FAFAF9')}
                                                onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                                                onClick={() => setSelectedPhone(s.phone)}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold" style={{ background: cfg?.bg, color: cfg?.color }}>
                                                        {s.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{s.name}</div>
                                                        <div className="text-xs" style={{ color: '#AEACA8' }}>{s.phone} · {cfg?.label} · {s.scores.length} bài thi</div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-lg font-bold" style={{ color: scoreColor(s.avg) }}>{s.avg.toFixed(2)}</span>
                                                    <ChevronRight className="w-4 h-4" style={{ color: '#AEACA8' }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}

                    {/* Selected student detail */}
                    {selectedPhone && selectedProfile && (
                        <div className="space-y-4 animate-fade-in">
                            <button onClick={() => setSelectedPhone(null)} className="flex items-center gap-1.5 text-sm font-medium transition-colors" style={{ color: '#6B7CDB' }}>
                                <ArrowLeft className="w-4 h-4" />
                                Quay lại kết quả tìm kiếm
                            </button>

                            {/* Info card */}
                            <div className="rounded-xl p-5" style={{ background: '#fff', border: '1px solid #E9E9E7' }}>
                                <div className="flex items-center gap-3 mb-5">
                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold" style={{ background: '#EEF0FB', color: '#6B7CDB' }}>
                                        {selectedProfile.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <div className="text-base font-semibold" style={{ color: '#1A1A1A' }}>{selectedProfile.name}</div>
                                        <div className="text-xs mt-0.5" style={{ color: '#787774' }}>{selectedPhone} · {GRADE_CFG[selectedProfile.grade as keyof typeof GRADE_CFG]?.label}</div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {[
                                        { label: 'Số bài thi', value: selectedProfile.scores.length, color: '#6B7CDB' },
                                        { label: 'Điểm TB', value: selectedProfile.avg.toFixed(2), color: scoreColor(selectedProfile.avg) },
                                        { label: 'Cao nhất', value: selectedProfile.best.toFixed(2), color: '#448361' },
                                        { label: 'Thấp nhất', value: selectedProfile.worst.toFixed(2), color: scoreColor(selectedProfile.worst) },
                                    ].map(stat => (
                                        <div key={stat.label} className="rounded-lg p-3 text-center" style={{ background: '#FAFAF9', border: '1px solid #F1F0EC' }}>
                                            <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: '#AEACA8' }}>{stat.label}</div>
                                            <div className="text-xl font-bold" style={{ color: stat.color }}>{stat.value}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Student area chart */}
                            <div className="rounded-xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E9E9E7' }}>
                                <div className="px-4 py-3" style={{ borderBottom: '1px solid #E9E9E7', borderLeft: '3px solid #6B7CDB', background: '#EEF0FB' }}>
                                    <h3 className="text-sm font-semibold" style={{ color: '#6B7CDB' }}>Tiến trình điểm số</h3>
                                    <p className="text-[11px]" style={{ color: '#AEACA8' }}>Lịch sử từng bài thi theo thứ tự thời gian</p>
                                </div>
                                <div className="p-4">
                                    <ResponsiveContainer width="100%" height={210}>
                                        <AreaChart data={selectedChartData} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                                            <defs>
                                                <linearGradient id="studGrad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#6B7CDB" stopOpacity={0.2} />
                                                    <stop offset="95%" stopColor="#6B7CDB" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#F1F0EC" vertical={false} />
                                            <XAxis dataKey="exam" tick={{ fontSize: 10, fill: '#AEACA8' }} axisLine={{ stroke: '#E9E9E7' }} tickLine={false} />
                                            <YAxis domain={[0, 10]} tick={{ fontSize: 10, fill: '#AEACA8' }} axisLine={false} tickLine={false} />
                                            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`${v.toFixed(2)} điểm`, '']} />
                                            <ReferenceLine y={5} stroke="#E03E3E" strokeDasharray="4 4" strokeOpacity={0.4} />
                                            <Area type="linear" dataKey="score" stroke="#6B7CDB" strokeWidth={2.5} fill="url(#studGrad)" dot={{ r: 4, fill: '#6B7CDB' }} activeDot={{ r: 6 }} name="Điểm" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Exam history table */}
                            <div className="rounded-xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E9E9E7' }}>
                                <div className="px-4 py-3" style={{ borderBottom: '1px solid #E9E9E7', background: '#FAFAF9' }}>
                                    <h3 className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>Lịch sử từng bài thi</h3>
                                </div>
                                {records
                                    .filter(r => r.student_phone === selectedPhone)
                                    .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())
                                    .map((r, i, arr) => (
                                        <div key={r.id || i} className="flex items-center justify-between px-4 py-3" style={{ borderBottom: i < arr.length - 1 ? '1px solid #F1F0EC' : 'none' }}>
                                            <div>
                                                <div className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{r.exam_title}</div>
                                                <div className="text-xs mt-0.5" style={{ color: '#AEACA8' }}>
                                                    {new Date(r.submitted_at).toLocaleDateString('vi-VN')} · {r.correct_answers}/{r.total_questions} câu đúng
                                                </div>
                                            </div>
                                            <span className="text-sm font-bold px-2.5 py-1 rounded-lg" style={{ color: scoreColor(r.score), background: scoreBg(r.score) }}>
                                                {r.score.toFixed(2)}
                                            </span>
                                        </div>
                                    ))
                                }
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ════════════════════════════════════════════════
                CONCERN STUDENTS VIEW
            ════════════════════════════════════════════════ */}
            {!loading && view === 'concern' && (
                <div className="space-y-4">
                    {concernStudents.length === 0 ? (
                        <div className="rounded-xl py-16 text-center" style={{ background: '#fff', border: '1px solid #E9E9E7' }}>
                            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: '#EAF3EE' }}>
                                <Award className="w-6 h-6" style={{ color: '#448361' }} />
                            </div>
                            <p className="text-sm font-semibold" style={{ color: '#57564F' }}>Tất cả học sinh đều ổn! 🎉</p>
                            <p className="text-xs mt-1" style={{ color: '#AEACA8' }}>Không có học sinh nào cần đặc biệt chú ý</p>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg" style={{ background: '#FFF3E8', border: '1px solid #D9730D22' }}>
                                <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: '#D9730D' }} />
                                <span className="text-sm" style={{ color: '#D9730D' }}>
                                    <strong>{concernStudents.length} học sinh</strong> cần chú ý — điểm TB dưới 5 hoặc có xu hướng giảm
                                </span>
                            </div>

                            <div className="rounded-xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E9E9E7' }}>
                                {concernStudents.map((s, i) => {
                                    const TIcon = s.trend > 0 ? TrendingUp : s.trend < 0 ? TrendingDown : Minus;
                                    const trendColor = s.trend > 0 ? '#448361' : s.trend < 0 ? '#E03E3E' : '#787774';
                                    const cfg = GRADE_CFG[s.grade as keyof typeof GRADE_CFG];
                                    return (
                                        <div
                                            key={s.phone}
                                            className="flex items-center justify-between px-4 py-3 cursor-pointer transition-colors"
                                            style={{ borderBottom: i < concernStudents.length - 1 ? '1px solid #F1F0EC' : 'none', background: s.avg < 3 ? '#FEF8F8' : '#fff' }}
                                            onMouseEnter={e => (e.currentTarget.style.background = '#FAFAF9')}
                                            onMouseLeave={e => (e.currentTarget.style.background = s.avg < 3 ? '#FEF8F8' : '#fff')}
                                            onClick={() => { setView('student'); setSearchTerm(s.name); setSelectedPhone(s.phone); }}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold" style={{ background: '#FEF0F0', color: '#E03E3E' }}>
                                                    {s.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{s.name}</div>
                                                    <div className="text-xs" style={{ color: '#AEACA8' }}>{s.phone} · {cfg?.label} · {s.scores.length} bài</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <div className="text-sm font-bold" style={{ color: '#E03E3E' }}>{s.avg.toFixed(2)}</div>
                                                    <div className="text-[10px]" style={{ color: '#AEACA8' }}>điểm TB</div>
                                                </div>
                                                <div className="flex items-center gap-1 text-xs font-semibold" style={{ color: trendColor }}>
                                                    <TIcon className="w-3.5 h-3.5" />
                                                    {s.trend > 0 ? '+' : ''}{s.trend.toFixed(2)}
                                                </div>
                                                <ChevronRight className="w-4 h-4" style={{ color: '#AEACA8' }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default StatsPanel;
