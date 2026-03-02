import React, { useState, useEffect } from 'react';
import { BookOpenCheck, RefreshCw, Calendar, CheckCircle, Target, TrendingUp, TrendingDown, Minus, Flame, Trophy, Hash } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine, CartesianGrid } from 'recharts';
import { ExamResultRecord } from '../types';

interface ContactBookProps {
    isAdmin: boolean;
    onLoadHistory: (phone?: string) => Promise<ExamResultRecord[]>;
}

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
        const avgLast3 = last3.reduce((acc, c) => acc + c.score, 0) / 3;
        const avgPrev3 = prev3.reduce((acc, c) => acc + c.score, 0) / 3;
        trendDiff = avgLast3 - avgPrev3;
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
        <div className="space-y-5 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-xl font-semibold flex items-center gap-2" style={{ color: '#1A1A1A' }}>
                        <BookOpenCheck className="w-5 h-5" style={{ color: '#787774' }} />
                        Sổ liên lạc
                    </h1>
                    <p className="text-sm mt-0.5" style={{ color: '#AEACA8' }}>
                        {isAdmin ? 'Quản lý kết quả thi của tất cả học sinh' : 'Lịch sử và tiến trình học tập'}
                    </p>
                </div>
                <button
                    onClick={load}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-all"
                    style={{ color: '#57564F', background: '#F1F0EC', border: '1px solid #E9E9E7' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#E9E9E7'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#F1F0EC'}
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    Tải lại
                </button>
            </div>

            {/* Tabs — Notion style segmented control */}
            <div className="flex gap-0" style={{ borderBottom: '1px solid #E9E9E7' }}>
                <button
                    onClick={() => setActiveTab('history')}
                    className="px-4 py-2 text-sm font-medium transition-all relative"
                    style={{
                        color: activeTab === 'history' ? '#1A1A1A' : '#AEACA8',
                    }}
                >
                    Nhật ký bài làm
                    {activeTab === 'history' && (
                        <span className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: '#1A1A1A' }} />
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('analytics')}
                    className="px-4 py-2 text-sm font-medium transition-all relative"
                    style={{
                        color: activeTab === 'analytics' ? '#1A1A1A' : '#AEACA8',
                    }}
                >
                    Phân tích
                    {activeTab === 'analytics' && (
                        <span className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: '#1A1A1A' }} />
                    )}
                </button>
            </div>

            {/* --- TAB: HISTORY --- */}
            {activeTab === 'history' && (
                <div className="space-y-3 animate-fade-in">
                    {/* Search + count */}
                    {isAdmin && (
                        <div className="flex items-center gap-3">
                            <input
                                type="text"
                                placeholder="Tìm theo tên, SĐT hoặc bài thi..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="flex-1 px-3 py-2 rounded-md text-sm transition-colors outline-none"
                                style={{ background: '#fff', border: '1px solid #E9E9E7', color: '#1A1A1A' }}
                                onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = '#CFCFCB'}
                                onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = '#E9E9E7'}
                            />
                            <span className="text-xs font-medium px-2.5 py-1.5 rounded-md" style={{ background: '#F1F0EC', color: '#787774' }}>
                                {history.length} bài thi
                            </span>
                        </div>
                    )}

                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <RefreshCw className="w-5 h-5 animate-spin" style={{ color: '#AEACA8' }} />
                            <span className="ml-2 text-sm" style={{ color: '#AEACA8' }}>Đang tải dữ liệu...</span>
                        </div>
                    ) : filteredHistory.length === 0 ? (
                        <div className="text-center py-16">
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-3" style={{ background: '#F7F6F3', border: '1px solid #E9E9E7' }}>
                                <BookOpenCheck className="w-5 h-5" style={{ color: '#AEACA8' }} />
                            </div>
                            <p className="text-sm font-medium" style={{ color: '#57564F' }}>Chưa có bài thi nào</p>
                            <p className="text-xs mt-1" style={{ color: '#AEACA8' }}>Kết quả sẽ hiển thị ở đây sau khi hoàn thành bài thi</p>
                        </div>
                    ) : (
                        /* Table-style list */
                        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #E9E9E7' }}>
                            {/* Table header */}
                            <div
                                className="hidden md:grid items-center px-4 py-2 text-[11px] font-semibold uppercase tracking-wider"
                                style={{
                                    gridTemplateColumns: isAdmin ? '1fr 140px 100px 80px' : '1fr 100px 80px',
                                    background: '#F7F6F3',
                                    color: '#AEACA8',
                                    borderBottom: '1px solid #E9E9E7'
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
                                return (
                                    <div
                                        key={record.id}
                                        className="md:grid items-center px-4 py-3 transition-colors flex flex-col md:flex-row gap-2 md:gap-0"
                                        style={{
                                            gridTemplateColumns: isAdmin ? '1fr 140px 100px 80px' : '1fr 100px 80px',
                                            background: '#fff',
                                            borderBottom: idx < filteredHistory.length - 1 ? '1px solid #F1F0EC' : 'none',
                                        }}
                                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#FAFAF9'}
                                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#fff'}
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
                                            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded" style={{ background: '#F7F6F3', color: '#57564F' }}>
                                                <CheckCircle className="w-3 h-3" style={{ color: '#448361' }} />
                                                {record.correct_answers}/{record.total_questions}
                                            </span>
                                        </div>

                                        {/* Score */}
                                        <div className="text-right">
                                            <span
                                                className="text-sm font-bold tabular-nums"
                                                style={{ color: scoreColor }}
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

            {/* --- TAB: ANALYTICS --- */}
            {activeTab === 'analytics' && (
                <div className="space-y-4 animate-fade-in">
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <RefreshCw className="w-5 h-5 animate-spin" style={{ color: '#AEACA8' }} />
                            <span className="ml-2 text-sm" style={{ color: '#AEACA8' }}>Đang tải phân tích...</span>
                        </div>
                    ) : history.length === 0 ? (
                        <div className="text-center py-16">
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-3" style={{ background: '#F7F6F3', border: '1px solid #E9E9E7' }}>
                                <TrendingUp className="w-5 h-5" style={{ color: '#AEACA8' }} />
                            </div>
                            <p className="text-sm font-medium" style={{ color: '#57564F' }}>Chưa có dữ liệu để phân tích</p>
                            <p className="text-xs mt-1" style={{ color: '#AEACA8' }}>Hãy hoàn thành bài thi để mở khoá phân tích</p>
                        </div>
                    ) : (
                        <>
                            {/* Compact summary bar */}
                            <div
                                className="grid grid-cols-2 md:grid-cols-4 gap-px rounded-lg overflow-hidden"
                                style={{ background: '#E9E9E7', border: '1px solid #E9E9E7' }}
                            >
                                {/* Avg Score */}
                                <div className="p-4 flex flex-col" style={{ background: '#fff' }}>
                                    <div className="flex items-center gap-1.5 mb-2">
                                        <Trophy className="w-3.5 h-3.5" style={{ color: '#AEACA8' }} />
                                        <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: '#AEACA8' }}>Trung bình</span>
                                    </div>
                                    <span className="text-2xl font-bold tabular-nums" style={{ color: '#1A1A1A' }}>{avgScore.toFixed(2)}</span>
                                    <span className="text-[11px] mt-1" style={{ color: '#AEACA8' }}>{history.length} bài thi</span>
                                </div>

                                {/* Trend */}
                                <div className="p-4 flex flex-col" style={{ background: '#fff' }}>
                                    <div className="flex items-center gap-1.5 mb-2">
                                        <TrendIcon className="w-3.5 h-3.5" style={{ color: '#AEACA8' }} />
                                        <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: '#AEACA8' }}>Phong độ</span>
                                    </div>
                                    <span className="text-2xl font-bold tabular-nums" style={{ color: trendDiff >= 0 ? '#448361' : '#E03E3E' }}>
                                        {trendDiff > 0 ? '+' : ''}{trendDiff.toFixed(2)}
                                    </span>
                                    <span className="text-[11px] mt-1" style={{ color: '#AEACA8' }}>so với đợt trước</span>
                                </div>

                                {/* Streak */}
                                <div className="p-4 flex flex-col relative overflow-hidden group" style={{ background: '#fff' }}>
                                    {/* Nền highlight mờ mờ khi có chuỗi */}
                                    {streak > 0 && <div className="absolute inset-0 bg-gradient-to-br from-orange-50 to-transparent opacity-50 pointer-events-none" />}
                                    <div className="flex items-center gap-1.5 mb-2 relative z-10">
                                        <Flame
                                            className="w-4 h-4 transition-all duration-700 ease-out"
                                            style={{
                                                color: streak > 0 ? '#F97316' : '#AEACA8',
                                                filter: streak > 0 ? 'drop-shadow(0 0 5px rgba(249, 115, 22, 0.5))' : 'none',
                                                transform: streak > 0 ? 'scale(1.1)' : 'scale(1)',
                                                fill: streak >= 3 ? '#F97316' : 'none' // Nếu chuỗi >= 3 bài thì tô full màu rực luôn
                                            }}
                                        />
                                        <span className="text-[11px] font-medium uppercase tracking-wider relative z-10" style={{ color: streak > 0 ? '#EA580C' : '#AEACA8' }}>
                                            Chuỗi
                                        </span>
                                    </div>
                                    <span className="text-2xl font-bold tabular-nums relative z-10" style={{ color: streak > 0 ? '#EA580C' : '#1A1A1A' }}>
                                        {streak} <span className="text-sm font-medium" style={{ color: '#787774' }}>bài</span>
                                    </span>
                                    <span className="text-[11px] mt-1 relative z-10" style={{ color: '#AEACA8' }}>đạt mục tiêu liên tiếp</span>
                                </div>

                                {/* Max */}
                                <div className="p-4 flex flex-col" style={{ background: '#fff' }}>
                                    <div className="flex items-center gap-1.5 mb-2">
                                        <Hash className="w-3.5 h-3.5" style={{ color: '#AEACA8' }} />
                                        <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: '#AEACA8' }}>Cao nhất</span>
                                    </div>
                                    <span className="text-2xl font-bold tabular-nums" style={{ color: '#1A1A1A' }}>{maxScore.toFixed(2)}</span>
                                    <span className="text-[11px] mt-1" style={{ color: '#AEACA8' }}>điểm đỉnh cao</span>
                                </div>
                            </div>

                            {/* Target setter — inline, minimal */}
                            <div
                                className="flex items-center justify-between px-4 py-3 rounded-lg"
                                style={{ background: '#F7F6F3', border: '1px solid #E9E9E7' }}
                            >
                                <div className="flex items-center gap-2">
                                    <Target className="w-4 h-4" style={{ color: '#787774' }} />
                                    <span className="text-sm" style={{ color: '#57564F' }}>Mục tiêu điểm số</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <input
                                        type="number"
                                        step="0.5"
                                        min="0"
                                        max="10"
                                        value={targetScore}
                                        onChange={handleTargetChange}
                                        className="w-16 px-2 py-1 text-center font-semibold text-sm rounded-md border focus:outline-none transition-colors"
                                        style={{ borderColor: '#E9E9E7', color: '#1A1A1A', background: '#fff' }}
                                        onFocus={e => (e.target as HTMLElement).style.borderColor = '#CFCFCB'}
                                        onBlur={e => (e.target as HTMLElement).style.borderColor = '#E9E9E7'}
                                    />
                                    <span className="text-xs" style={{ color: '#AEACA8' }}>điểm</span>
                                </div>
                            </div>

                            {/* Chart — clean, monochrome */}
                            <div className="p-5 rounded-lg" style={{ background: '#fff', border: '1px solid #E9E9E7' }}>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-medium" style={{ color: '#1A1A1A' }}>Biểu đồ tiến trình</h3>
                                    <span className="text-[11px]" style={{ color: '#AEACA8' }}>Từ cũ → mới</span>
                                </div>
                                <div style={{ width: '100%', height: '220px' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.25} />
                                                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#F1F0EC" vertical={false} />
                                            <XAxis dataKey="index" tick={{ fontSize: 11, fill: '#AEACA8' }} axisLine={{ stroke: '#E9E9E7' }} tickLine={false} />
                                            <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: '#AEACA8' }} axisLine={false} tickLine={false} />
                                            <Tooltip
                                                contentStyle={{
                                                    borderRadius: '8px',
                                                    border: '1px solid #E9E9E7',
                                                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
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
                                            <ReferenceLine
                                                y={targetScore}
                                                stroke="#E03E3E"
                                                strokeDasharray="4 4"
                                                strokeOpacity={0.5}
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="score"
                                                stroke="#10B981"
                                                strokeWidth={2}
                                                fillOpacity={1}
                                                fill="url(#colorScore)"
                                                dot={{ r: 3, fill: '#10B981', strokeWidth: 0 }}
                                                activeDot={{ r: 5, fill: '#10B981', strokeWidth: 2, stroke: '#fff' }}
                                                isAnimationActive={true}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                                {/* Legend */}
                                <div className="flex items-center gap-4 mt-3 text-[11px]" style={{ color: '#AEACA8' }}>
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-3 h-0.5 inline-block rounded" style={{ background: '#10B981' }} />
                                        Điểm số
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-3 h-0.5 inline-block rounded" style={{ background: '#E03E3E', opacity: 0.5 }} />
                                        Mục tiêu ({targetScore}đ)
                                    </span>
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
