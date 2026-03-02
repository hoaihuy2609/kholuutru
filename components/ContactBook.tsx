import React, { useState, useEffect } from 'react';
import { BookOpenCheck, RefreshCw, Calendar, CheckCircle, Target, TrendingUp, TrendingDown, Minus, Flame, Trophy, Hash } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine, CartesianGrid } from 'recharts';
import { ExamResultRecord } from '../types';

interface ContactBookProps {
    isAdmin: boolean;
    onLoadHistory: (phone?: string) => Promise<ExamResultRecord[]>;
}

const ACCENT = '#9065B0';
const ACCENT_LIGHT = '#F3ECF8';
const ACCENT_BORDER = '#D8BFE8';

const ContactBook: React.FC<ContactBookProps> = ({ isAdmin, onLoadHistory }) => {
    const [history, setHistory] = useState<ExamResultRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'history' | 'analytics'>('history');

    const [targetScore, setTargetScore] = useState<number>(() => {
        const saved = localStorage.getItem('pv_target_score');
        return saved ? parseFloat(saved) : 8.0;
    });

    const load = async () => {
        setLoading(true);
        try {
            const sdtStr = localStorage.getItem('pv_activated_sdt');
            let phoneToQuery = undefined;
            if (!isAdmin && sdtStr) {
                let normalizedPhone = sdtStr.trim();
                if (normalizedPhone.length === 9 && !normalizedPhone.startsWith('0')) {
                    normalizedPhone = '0' + normalizedPhone;
                }
                phoneToQuery = normalizedPhone;
            }
            const data = await onLoadHistory(phoneToQuery);
            setHistory(data || []);
        } catch { /* silent */ }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [isAdmin]);

    const formatDate = (isoStr: string) => {
        const d = new Date(isoStr);
        return d.toLocaleDateString('vi-VN') + ' ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    };

    const getScoreColor = (score: number) => {
        if (score >= 8) return '#448361';
        if (score >= 5) return '#D9730D';
        return '#E03E3E';
    };

    const getScoreBg = (score: number) => {
        if (score >= 8) return '#EAF3EE';
        if (score >= 5) return '#FFF3E8';
        return '#FEF2F2';
    };

    const handleTargetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = parseFloat(e.target.value);
        if (isNaN(val)) val = 0;
        if (val < 0) val = 0;
        if (val > 10) val = 10;
        setTargetScore(val);
        localStorage.setItem('pv_target_score', val.toString());
    };

    const filteredHistory = history.filter(record => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
            record.exam_title?.toLowerCase().includes(term) ||
            record.student_name?.toLowerCase().includes(term) ||
            record.student_phone?.includes(term)
        );
    });

    // Analytics
    const chartData = [...history].sort((a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()).map((r, i) => ({
        index: i + 1,
        title: r.exam_title,
        score: r.score,
        date: formatDate(r.submitted_at)
    }));

    const avgScore = history.length > 0
        ? history.reduce((acc, curr) => acc + curr.score, 0) / history.length
        : 0;

    let trendDiff = 0;
    if (chartData.length >= 6) {
        const last3 = chartData.slice(-3);
        const prev3 = chartData.slice(-6, -3);
        trendDiff = last3.reduce((acc, c) => acc + c.score, 0) / 3 - prev3.reduce((acc, c) => acc + c.score, 0) / 3;
    } else if (chartData.length >= 2) {
        trendDiff = chartData[chartData.length - 1].score - chartData[chartData.length - 2].score;
    }

    const maxScore = history.length > 0 ? Math.max(...history.map(r => r.score)) : 0;
    let streak = 0;
    for (let i = chartData.length - 1; i >= 0; i--) {
        if (chartData[i].score >= targetScore) streak++;
        else break;
    }

    const TrendIcon = trendDiff > 0 ? TrendingUp : trendDiff < 0 ? TrendingDown : Minus;

    return (
        <div className="space-y-6 animate-fade-in pb-10">

            {/* ── Header ── */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: ACCENT_LIGHT }}>
                        <BookOpenCheck className="w-5 h-5" style={{ color: ACCENT }} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-semibold" style={{ color: '#1A1A1A' }}>Sổ Liên Lạc</h1>
                        <p className="text-sm mt-0.5" style={{ color: '#787774' }}>
                            {isAdmin ? 'Quản lý kết quả thi của tất cả học sinh' : 'Lịch sử và tiến trình học tập'}
                        </p>
                    </div>
                </div>
                <button
                    onClick={load}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                    style={{ background: '#F1F0EC', border: '1px solid #E9E9E7', color: '#57564F' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#E9E9E7'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#F1F0EC'}
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} style={{ color: ACCENT }} />
                    Làm mới
                </button>
            </div>

            {/* ── Tabs ── */}
            <div className="flex items-center gap-2 border-b" style={{ borderColor: '#E9E9E7' }}>
                {(['history', 'analytics'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className="px-5 py-2.5 text-sm font-semibold transition-colors border-b-2"
                        style={{
                            color: activeTab === tab ? ACCENT : '#787774',
                            borderColor: activeTab === tab ? ACCENT : 'transparent',
                            marginBottom: '-1px',
                        }}
                        onMouseEnter={e => { if (activeTab !== tab) (e.currentTarget as HTMLElement).style.color = ACCENT; }}
                        onMouseLeave={e => { if (activeTab !== tab) (e.currentTarget as HTMLElement).style.color = '#787774'; }}
                    >
                        {tab === 'history' ? 'Nhật ký bài làm' : 'Phân tích'}
                    </button>
                ))}
            </div>

            {/* ── TAB: HISTORY ── */}
            {activeTab === 'history' && (
                <div className="space-y-4 animate-fade-in">
                    {/* Search + count */}
                    {isAdmin && (
                        <div className="flex items-center gap-3">
                            <input
                                type="text"
                                placeholder="Tìm theo tên, SĐT hoặc bài thi..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="flex-1 px-3 py-2 rounded-lg text-sm outline-none transition-colors"
                                style={{ background: '#FFFFFF', border: '1px solid #E9E9E7', color: '#1A1A1A' }}
                                onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = ACCENT; (e.currentTarget as HTMLElement).style.boxShadow = `0 0 0 3px ${ACCENT}18`; }}
                                onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = '#E9E9E7'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
                            />
                            <span className="text-xs font-medium px-2.5 py-1.5 rounded-lg whitespace-nowrap" style={{ background: '#F1F0EC', color: '#787774', border: '1px solid #E9E9E7' }}>
                                {history.length} bài thi
                            </span>
                        </div>
                    )}

                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <RefreshCw className="w-5 h-5 animate-spin" style={{ color: ACCENT }} />
                            <span className="ml-2 text-sm" style={{ color: '#787774' }}>Đang tải dữ liệu...</span>
                        </div>
                    ) : filteredHistory.length === 0 ? (
                        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E9E9E7', background: '#FFFFFF' }}>
                            <div className="py-12 text-center">
                                <div className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-3" style={{ background: '#F1F0EC' }}>
                                    <BookOpenCheck className="w-5 h-5" style={{ color: '#CFCFCB' }} />
                                </div>
                                <p className="text-sm font-medium" style={{ color: '#57564F' }}>Chưa có bài thi nào</p>
                                <p className="text-xs mt-1" style={{ color: '#AEACA8' }}>Kết quả sẽ hiển thị ở đây sau khi hoàn thành bài thi</p>
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E9E9E7', background: '#FFFFFF' }}>
                            {/* Table header */}
                            <div
                                className="hidden md:grid items-center px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider"
                                style={{
                                    gridTemplateColumns: isAdmin ? '1fr 150px 110px 80px' : '1fr 110px 80px',
                                    background: ACCENT_LIGHT,
                                    color: '#787774',
                                    borderBottom: '1px solid #E9E9E7',
                                    borderLeft: `3px solid ${ACCENT}`,
                                }}
                            >
                                <span>Bài thi</span>
                                {isAdmin && <span>Học sinh</span>}
                                <span className="text-center">Kết quả</span>
                                <span className="text-right">Điểm</span>
                            </div>

                            {/* Table rows */}
                            {filteredHistory.map((record, idx) => {
                                const scoreColor = getScoreColor(record.score);
                                const scoreBg = getScoreBg(record.score);
                                return (
                                    <div
                                        key={record.id}
                                        className="md:grid items-center px-4 py-3 transition-colors flex flex-col md:flex-row gap-2 md:gap-0"
                                        style={{
                                            gridTemplateColumns: isAdmin ? '1fr 150px 110px 80px' : '1fr 110px 80px',
                                            background: '#FFFFFF',
                                            borderBottom: idx < filteredHistory.length - 1 ? '1px solid #F1F0EC' : 'none',
                                        }}
                                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#FAFAF9'}
                                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#FFFFFF'}
                                    >
                                        {/* Exam title + date */}
                                        <div className="min-w-0">
                                            <div className="text-sm font-medium truncate" style={{ color: '#1A1A1A' }}>
                                                {record.exam_title}
                                            </div>
                                            <div className="flex items-center gap-1 mt-0.5 text-xs" style={{ color: '#AEACA8' }}>
                                                <Calendar className="w-3 h-3" />
                                                {formatDate(record.submitted_at)}
                                            </div>
                                        </div>

                                        {/* Student (admin only) */}
                                        {isAdmin && (
                                            <div className="text-xs" style={{ color: '#787774' }}>
                                                <div className="font-medium truncate">{record.student_name}</div>
                                                <div style={{ color: '#AEACA8' }}>{record.student_phone}</div>
                                            </div>
                                        )}

                                        {/* Correct answers */}
                                        <div className="text-center">
                                            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md" style={{ background: '#F1F0EC', color: '#57564F' }}>
                                                <CheckCircle className="w-3 h-3" style={{ color: '#448361' }} />
                                                {record.correct_answers}/{record.total_questions}
                                            </span>
                                        </div>

                                        {/* Score */}
                                        <div className="text-right">
                                            <span
                                                className="inline-block text-sm font-bold tabular-nums px-2 py-0.5 rounded-md"
                                                style={{ color: scoreColor, background: scoreBg }}
                                            >
                                                {record.score.toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ── TAB: ANALYTICS ── */}
            {activeTab === 'analytics' && (
                <div className="space-y-4 animate-fade-in">
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <RefreshCw className="w-5 h-5 animate-spin" style={{ color: ACCENT }} />
                            <span className="ml-2 text-sm" style={{ color: '#787774' }}>Đang tải phân tích...</span>
                        </div>
                    ) : history.length === 0 ? (
                        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E9E9E7', background: '#FFFFFF' }}>
                            <div className="py-12 text-center">
                                <div className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-3" style={{ background: '#F1F0EC' }}>
                                    <TrendingUp className="w-5 h-5" style={{ color: '#CFCFCB' }} />
                                </div>
                                <p className="text-sm font-medium" style={{ color: '#57564F' }}>Chưa có dữ liệu để phân tích</p>
                                <p className="text-xs mt-1" style={{ color: '#AEACA8' }}>Hãy hoàn thành bài thi để mở khoá phân tích</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Stats grid */}
                            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E9E9E7', background: '#FFFFFF' }}>
                                <div className="px-4 py-3" style={{ borderBottom: '1px solid #E9E9E7', borderLeft: `3px solid ${ACCENT}`, background: ACCENT_LIGHT }}>
                                    <h3 className="text-sm font-semibold" style={{ color: ACCENT }}>Tổng quan</h3>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0" style={{ borderColor: '#F1F0EC' }}>
                                    {/* Avg Score */}
                                    <div className="p-4 flex flex-col">
                                        <div className="flex items-center gap-1.5 mb-2">
                                            <Trophy className="w-3.5 h-3.5" style={{ color: '#AEACA8' }} />
                                            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#AEACA8' }}>Trung bình</span>
                                        </div>
                                        <span className="text-2xl font-bold tabular-nums" style={{ color: '#1A1A1A' }}>{avgScore.toFixed(2)}</span>
                                        <span className="text-[11px] mt-1" style={{ color: '#AEACA8' }}>{history.length} bài thi</span>
                                    </div>

                                    {/* Trend */}
                                    <div className="p-4 flex flex-col">
                                        <div className="flex items-center gap-1.5 mb-2">
                                            <TrendIcon className="w-3.5 h-3.5" style={{ color: '#AEACA8' }} />
                                            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#AEACA8' }}>Phong độ</span>
                                        </div>
                                        <span className="text-2xl font-bold tabular-nums" style={{ color: trendDiff >= 0 ? '#448361' : '#E03E3E' }}>
                                            {trendDiff > 0 ? '+' : ''}{trendDiff.toFixed(2)}
                                        </span>
                                        <span className="text-[11px] mt-1" style={{ color: '#AEACA8' }}>so với đợt trước</span>
                                    </div>

                                    {/* Streak */}
                                    <div className="p-4 flex flex-col relative overflow-hidden">
                                        {streak > 0 && <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(135deg, #FFF3E8 0%, transparent 70%)' }} />}
                                        <div className="flex items-center gap-1.5 mb-2 relative z-10">
                                            <Flame
                                                className={`w-4 h-4 transition-all duration-500 ${streak > 0 ? 'animate-flame' : ''}`}
                                                style={{
                                                    color: streak >= 3 ? '#EF4444' : streak > 0 ? '#F97316' : '#AEACA8',
                                                    fill: streak >= 3 ? '#EF4444' : streak >= 1 ? '#F97316' : 'none',
                                                    opacity: streak >= 3 ? 1 : streak > 0 ? 0.9 : 0.5,
                                                }}
                                            />
                                            <span className="text-[11px] font-semibold uppercase tracking-wider relative z-10" style={{ color: streak > 0 ? '#EA580C' : '#AEACA8' }}>
                                                Chuỗi
                                            </span>
                                        </div>
                                        <span className="text-2xl font-bold tabular-nums relative z-10" style={{ color: streak > 0 ? '#EA580C' : '#1A1A1A' }}>
                                            {streak} <span className="text-sm font-medium" style={{ color: '#787774' }}>bài</span>
                                        </span>
                                        <span className="text-[11px] mt-1 relative z-10" style={{ color: '#AEACA8' }}>đạt mục tiêu liên tiếp</span>
                                    </div>

                                    {/* Max */}
                                    <div className="p-4 flex flex-col">
                                        <div className="flex items-center gap-1.5 mb-2">
                                            <Hash className="w-3.5 h-3.5" style={{ color: '#AEACA8' }} />
                                            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#AEACA8' }}>Cao nhất</span>
                                        </div>
                                        <span className="text-2xl font-bold tabular-nums" style={{ color: '#1A1A1A' }}>{maxScore.toFixed(2)}</span>
                                        <span className="text-[11px] mt-1" style={{ color: '#AEACA8' }}>điểm đỉnh cao</span>
                                    </div>
                                </div>
                            </div>

                            {/* Target setter */}
                            <div className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: '#FFFFFF', border: '1px solid #E9E9E7' }}>
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: ACCENT_LIGHT }}>
                                        <Target className="w-3.5 h-3.5" style={{ color: ACCENT }} />
                                    </div>
                                    <span className="text-sm font-medium" style={{ color: '#1A1A1A' }}>Mục tiêu điểm số</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        step="0.5"
                                        min="0"
                                        max="10"
                                        value={targetScore}
                                        onChange={handleTargetChange}
                                        className="w-16 px-2 py-1 text-center font-semibold text-sm rounded-lg border focus:outline-none transition-colors"
                                        style={{ borderColor: '#E9E9E7', color: '#1A1A1A', background: '#F7F6F3' }}
                                        onFocus={e => { (e.target as HTMLElement).style.borderColor = ACCENT; (e.target as HTMLElement).style.background = '#fff'; (e.target as HTMLElement).style.boxShadow = `0 0 0 3px ${ACCENT}18`; }}
                                        onBlur={e => { (e.target as HTMLElement).style.borderColor = '#E9E9E7'; (e.target as HTMLElement).style.background = '#F7F6F3'; (e.target as HTMLElement).style.boxShadow = 'none'; }}
                                    />
                                    <span className="text-xs" style={{ color: '#AEACA8' }}>điểm</span>
                                </div>
                            </div>

                            {/* Chart */}
                            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E9E9E7', background: '#FFFFFF' }}>
                                <div className="px-4 py-3" style={{ borderBottom: '1px solid #E9E9E7', borderLeft: `3px solid ${ACCENT}`, background: ACCENT_LIGHT }}>
                                    <h3 className="text-sm font-semibold" style={{ color: ACCENT }}>Biểu đồ tiến trình</h3>
                                    <p className="text-xs mt-0.5" style={{ color: '#AEACA8' }}>Từ cũ → mới nhất</p>
                                </div>
                                <div className="p-4">
                                    <div style={{ width: '100%', height: '220px' }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                                                <defs>
                                                    <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor={ACCENT} stopOpacity={0.2} />
                                                        <stop offset="95%" stopColor={ACCENT} stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#F1F0EC" vertical={false} />
                                                <XAxis dataKey="index" tick={{ fontSize: 11, fill: '#AEACA8' }} axisLine={{ stroke: '#E9E9E7' }} tickLine={false} />
                                                <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: '#AEACA8' }} axisLine={false} tickLine={false} />
                                                <Tooltip
                                                    contentStyle={{
                                                        borderRadius: '10px',
                                                        border: '1px solid #E9E9E7',
                                                        boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                                                        fontSize: '13px',
                                                        background: '#fff',
                                                    }}
                                                    labelStyle={{ color: '#AEACA8', fontSize: '11px', marginBottom: '4px' }}
                                                    itemStyle={{ color: '#1A1A1A', fontWeight: 600 }}
                                                    formatter={(val: number) => [`${val.toFixed(2)} điểm`, '']}
                                                    labelFormatter={(index: number) => {
                                                        const point = chartData.find(d => d.index === Number(index));
                                                        return point ? point.title : '';
                                                    }}
                                                />
                                                <ReferenceLine y={targetScore} stroke="#E03E3E" strokeDasharray="4 4" strokeOpacity={0.5} />
                                                <Area
                                                    type="linear"
                                                    dataKey="score"
                                                    stroke={ACCENT}
                                                    strokeWidth={2}
                                                    fillOpacity={1}
                                                    fill="url(#colorScore)"
                                                    dot={{ r: 3, fill: ACCENT, strokeWidth: 0 }}
                                                    activeDot={{ r: 5, fill: ACCENT, strokeWidth: 2, stroke: '#fff' }}
                                                    isAnimationActive={true}
                                                />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="flex items-center gap-4 mt-3 text-[11px]" style={{ color: '#AEACA8' }}>
                                        <span className="flex items-center gap-1.5">
                                            <span className="w-3 h-0.5 inline-block rounded" style={{ background: ACCENT }} />
                                            Điểm số
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                            <span className="w-3 h-0.5 inline-block rounded" style={{ background: '#E03E3E', opacity: 0.5 }} />
                                            Mục tiêu ({targetScore}đ)
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default ContactBook;
