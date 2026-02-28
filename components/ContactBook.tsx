import React, { useState, useEffect } from 'react';
import { Award, RefreshCw, Calendar, CheckCircle, Target, Activity } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from 'recharts';
import { ExamResultRecord } from '../types';

interface ContactBookProps {
    isAdmin: boolean;
    onLoadHistory: (phone?: string) => Promise<ExamResultRecord[]>;
}

const ACCENT = '#6B7CDB';

const ContactBook: React.FC<ContactBookProps> = ({ isAdmin, onLoadHistory }) => {
    const [history, setHistory] = useState<ExamResultRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'history' | 'analytics'>('history');

    // Target goal state
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
                // Match normalized phone check string length and leading 0 if needed
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
        if (score >= 8) return { color: '#16A34A', bg: '#F0FDF4' };
        if (score >= 5) return { color: '#D9730D', bg: '#FFF7ED' };
        return { color: '#E03E3E', bg: '#FEF2F2' };
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

    // Analytics Data Prep
    const chartData = [...history].sort((a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()).map((r, i) => ({
        index: i + 1,
        title: r.exam_title,
        score: r.score,
        date: formatDate(r.submitted_at)
    }));

    const avgScore = history.length > 0
        ? history.reduce((acc, curr) => acc + curr.score, 0) / history.length
        : 0;

    let recentTrendLabel = "0.0";
    let isPositiveTrend = true;
    if (chartData.length >= 6) {
        const last3 = chartData.slice(-3);
        const prev3 = chartData.slice(-6, -3);
        const avgLast3 = last3.reduce((acc, c) => acc + c.score, 0) / 3;
        const avgPrev3 = prev3.reduce((acc, c) => acc + c.score, 0) / 3;
        const diff = avgLast3 - avgPrev3;
        recentTrendLabel = (diff > 0 ? "+" : "") + diff.toFixed(2);
        isPositiveTrend = diff >= 0;
    } else if (chartData.length >= 2) {
        const diff = chartData[chartData.length - 1].score - chartData[chartData.length - 2].score;
        recentTrendLabel = (diff > 0 ? "+" : "") + diff.toFixed(2);
        isPositiveTrend = diff >= 0;
    }

    const maxScore = history.length > 0 ? Math.max(...history.map(r => r.score)) : 0;
    let streak = 0;
    for (let i = chartData.length - 1; i >= 0; i--) {
        if (chartData[i].score >= targetScore) {
            streak++;
        } else {
            break;
        }
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-semibold flex items-center gap-2" style={{ color: '#1A1A1A' }}>
                        <Award className="w-6 h-6" style={{ color: ACCENT }} />
                        Sổ liên lạc
                    </h1>
                    <p className="text-sm mt-1" style={{ color: '#787774' }}>
                        {isAdmin ? 'Quản lý kết quả thi của tất cả học sinh' : 'Xem lại lịch sử và kết quả các bài thi đã làm'}
                    </p>
                </div>
                <button
                    onClick={load}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all"
                    style={{ color: '#57564F', background: '#F1F0EC' }}
                    title="Tải lại danh sách"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Tải lại
                </button>
            </div>

            {/* Tabs */}
            <div className="flex p-1 rounded-xl w-fit" style={{ background: '#E9E9E7' }}>
                <button
                    onClick={() => setActiveTab('history')}
                    className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                    style={{
                        background: activeTab === 'history' ? '#fff' : 'transparent',
                        color: activeTab === 'history' ? '#1A1A1A' : '#787774',
                        boxShadow: activeTab === 'history' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
                    }}
                >
                    Nhật ký bài làm
                </button>
                <button
                    onClick={() => setActiveTab('analytics')}
                    className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                    style={{
                        background: activeTab === 'analytics' ? '#fff' : 'transparent',
                        color: activeTab === 'analytics' ? '#1A1A1A' : '#787774',
                        boxShadow: activeTab === 'analytics' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
                    }}
                >
                    Phân tích năng lực 🚀
                </button>
            </div>

            {/* --- TAB: HISTORY --- */}
            {activeTab === 'history' && (
                <div className="space-y-4 animate-fade-in">
                    {isAdmin && (
                        <div className="flex items-center gap-4">
                            <input
                                type="text"
                                placeholder="Tìm theo tên, SĐT hoặc bài thi..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="flex-1 px-4 py-2.5 rounded-xl text-sm transition-colors outline-none"
                                style={{ background: '#fff', border: '1px solid #E9E9E7', color: '#1A1A1A' }}
                            />
                            <div className="px-4 py-2.5 rounded-xl text-sm font-semibold" style={{ background: '#EEF0FB', color: ACCENT }}>
                                Tổng số bài thi: {history.length}
                            </div>
                        </div>
                    )}

                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <RefreshCw className="w-6 h-6 animate-spin" style={{ color: ACCENT }} />
                            <span className="ml-2 text-sm" style={{ color: '#787774' }}>Đang tải dữ liệu...</span>
                        </div>
                    ) : filteredHistory.length === 0 ? (
                        <div className="text-center py-16 rounded-2xl" style={{ border: '2px dashed #E9E9E7' }}>
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: '#F7F6F3', border: '1px solid #E9E9E7' }}>
                                <span className="text-xl">🏆</span>
                            </div>
                            <p className="font-semibold" style={{ color: '#57564F' }}>Chưa có bài thi nào phù hợp</p>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {filteredHistory.map((record) => {
                                const style = getScoreColor(record.score);
                                return (
                                    <div
                                        key={record.id}
                                        className="rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:shadow-md"
                                        style={{ background: '#fff', border: '1px solid #E9E9E7' }}
                                    >
                                        <div className="space-y-1.5 flex-1 min-w-0">
                                            <h3 className="font-bold text-base leading-tight truncate" style={{ color: '#1A1A1A' }}>
                                                {record.exam_title}
                                            </h3>
                                            <div className="flex flex-wrap items-center gap-3 text-sm" style={{ color: '#787774' }}>
                                                {isAdmin && (
                                                    <span className="font-medium" style={{ color: '#57564F' }}>
                                                        👤 {record.student_name} ({record.student_phone})
                                                    </span>
                                                )}
                                                <span className="flex items-center gap-1 text-xs">
                                                    <Calendar className="w-3.5 h-3.5" />
                                                    {formatDate(record.submitted_at)}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-6 shrink-0 pt-3 md:pt-0 border-t md:border-0" style={{ borderColor: '#F1F0EC' }}>
                                            <div className="text-center">
                                                <div className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: '#AEACA8' }}>Số câu</div>
                                                <div className="flex items-center gap-1 font-medium text-sm" style={{ color: '#57564F' }}>
                                                    <CheckCircle className="w-3.5 h-3.5" style={{ color: '#16A34A' }} />
                                                    {record.correct_answers}/{record.total_questions}
                                                </div>
                                            </div>
                                            <div
                                                className="w-16 h-16 rounded-2xl flex flex-col items-center justify-center shrink-0 border"
                                                style={{ background: style.bg, borderColor: style.color, color: style.color }}
                                            >
                                                <div className="text-lg font-black leading-none">{record.score.toFixed(2)}</div>
                                                <div className="text-[10px] font-bold uppercase tracking-wider mt-0.5">Điểm</div>
                                            </div>
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
                <div className="space-y-6 animate-fade-in">
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <RefreshCw className="w-6 h-6 animate-spin" style={{ color: ACCENT }} />
                            <span className="ml-2 text-sm" style={{ color: '#787774' }}>Đang tải phân tích...</span>
                        </div>
                    ) : history.length === 0 ? (
                        <div className="text-center py-16 rounded-2xl" style={{ border: '2px dashed #E9E9E7' }}>
                            <p className="font-semibold" style={{ color: '#57564F' }}>Chưa có dữ liệu để phân tích</p>
                            <p className="text-sm mt-1" style={{ color: '#AEACA8' }}>Hãy làm thêm bài thi để mở khoá tính năng này nhé!</p>
                        </div>
                    ) : (
                        <>
                            {/* Target Setter */}
                            <div className="p-5 rounded-2xl flex flex-wrap items-center justify-between gap-4" style={{ background: '#fff', border: '1px solid #E9E9E7' }}>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#FFF7ED' }}>
                                        <Target className="w-5 h-5" style={{ color: '#D9730D' }} />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-sm" style={{ color: '#1A1A1A' }}>Mục tiêu hiện tại 🎯</h3>
                                        <p className="text-xs mt-0.5" style={{ color: '#787774' }}>Vượt mức này để gia tăng chuỗi liên tiếp</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        step="0.5"
                                        min="0"
                                        max="10"
                                        value={targetScore}
                                        onChange={handleTargetChange}
                                        className="w-20 px-3 py-2 text-center font-bold text-lg rounded-xl border-2 focus:outline-none transition-colors"
                                        style={{ borderColor: '#E9E9E7', color: '#D9730D', background: '#FFF7ED' }}
                                        onFocus={e => (e.target as HTMLElement).style.borderColor = '#D9730D'}
                                        onBlur={e => (e.target as HTMLElement).style.borderColor = '#E9E9E7'}
                                    />
                                    <span className="text-sm font-bold" style={{ color: '#AEACA8' }}>Điểm</span>
                                </div>
                            </div>

                            {/* Stat Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="p-5 rounded-2xl" style={{ background: '#fff', border: '1px solid #E9E9E7' }}>
                                    <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#787774' }}>🏆 Điểm trung bình</div>
                                    <div className="text-3xl font-black" style={{ color: '#1A1A1A' }}>{avgScore.toFixed(2)}</div>
                                    <div className="text-xs font-medium mt-1" style={{ color: '#AEACA8' }}>Tổng cộng {history.length} bài thi</div>
                                </div>

                                <div className="p-5 rounded-2xl" style={{ background: '#fff', border: '1px solid #E9E9E7' }}>
                                    <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#787774' }}>🚀 Phong độ dạo này</div>
                                    <div className="text-3xl font-black" style={{ color: isPositiveTrend ? '#16A34A' : '#E03E3E' }}>
                                        {recentTrendLabel}
                                    </div>
                                    <div className="text-xs font-medium mt-1" style={{ color: '#AEACA8' }}>So với đợt thi trước</div>
                                </div>

                                <div className="p-5 rounded-2xl" style={{ background: '#fff', border: '1px solid #E9E9E7' }}>
                                    <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#787774' }}>🔥 Chuỗi phá đảo</div>
                                    <div className="text-3xl font-black" style={{ color: '#D9730D' }}>
                                        {streak} <span className="text-base font-bold">bài</span>
                                    </div>
                                    <div className="text-xs font-medium mt-1" style={{ color: '#AEACA8' }}>
                                        Đỉnh cao: {maxScore.toFixed(2)} đ
                                    </div>
                                </div>
                            </div>

                            {/* Sparkline Chart */}
                            <div className="p-5 rounded-2xl space-y-4" style={{ background: '#fff', border: '1px solid #E9E9E7' }}>
                                <div className="flex items-center gap-2">
                                    <Activity className="w-5 h-5" style={{ color: ACCENT }} />
                                    <h3 className="font-semibold text-sm" style={{ color: '#1A1A1A' }}>Bản đồ học tập (Từ cũ tới mới)</h3>
                                </div>
                                <div style={{ width: '100%', height: '250px', marginTop: '16px' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={ACCENT} stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor={ACCENT} stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <XAxis dataKey="index" hide />
                                            <YAxis domain={[0, 10]} hide />
                                            <Tooltip
                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                                labelStyle={{ color: '#787774', fontSize: '12px', marginBottom: '4px' }}
                                                itemStyle={{ color: '#1A1A1A', fontSize: '14px', fontWeight: 'bold' }}
                                                formatter={(val: number) => [`${val.toFixed(2)} điểm`, 'Đạt']}
                                                labelFormatter={(index: number) => {
                                                    const point = chartData.find(d => d.index === Number(index));
                                                    return point ? point.title : '';
                                                }}
                                            />
                                            <ReferenceLine y={targetScore} stroke="#E03E3E" strokeDasharray="3 3" />
                                            <Area
                                                type="monotone"
                                                dataKey="score"
                                                stroke={ACCENT}
                                                strokeWidth={3}
                                                fillOpacity={1}
                                                fill="url(#colorScore)"
                                                isAnimationActive={true}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="flex items-center justify-between text-[10px] uppercase tracking-wider font-semibold" style={{ color: '#AEACA8' }}>
                                    <span>← Sơ khai</span>
                                    <span className="flex items-center gap-1">
                                        <span className="w-4 h-0.5 inline-block" style={{ background: '#E03E3E' }} /> Đường mục tiêu ({targetScore} đ)
                                    </span>
                                    <span>HIỆN TẠI →</span>
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
