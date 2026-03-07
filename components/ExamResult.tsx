import React, { useState, useRef, useEffect } from 'react';
import { CheckCircle, XCircle, Minus, RotateCcw, Home, Clock, HelpCircle, Send, ChevronDown } from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { Exam, ExamSubmission, ExamTFAnswer } from '../types';
import { calcScore } from './ExamView';

interface ExamResultProps {
    exam: Exam;
    submission: ExamSubmission;
    onRetry: () => void;
    onBack: () => void;
    onSubmitVote?: (part: string, qNum: number) => Promise<{ success: boolean; error?: string }>;
    onShowToast?: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

const tf_keys: (keyof ExamTFAnswer)[] = ['a', 'b', 'c', 'd'];

const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    if (m === 0) return `${s} giây`;
    return `${m} phút ${s} giây`;
};

const ScoreBadge = ({ score, total }: { score: number; total: number }) => {
    const pct = score / total;
    const color = pct >= 0.8 ? '#16A34A' : pct >= 0.5 ? '#D9730D' : '#E03E3E';
    const bg = pct >= 0.8 ? '#F0FDF4' : pct >= 0.5 ? '#FFF7ED' : '#FEF2F2';
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold"
            style={{ background: bg, color }}>
            {score}/{total}đ
        </span>
    );
};

const ExamResult: React.FC<ExamResultProps> = ({ exam, submission, onRetry, onBack, onSubmitVote, onShowToast }) => {
    const score = calcScore(submission, exam.answers);
    const tfKeys: (keyof ExamTFAnswer)[] = ['a', 'b', 'c', 'd'];
    const [votePart, setVotePart] = useState('');
    const [voteNum, setVoteNum] = useState('');
    const [isVoting, setIsVoting] = useState(false);

    // Custom dropdown state
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!dropdownOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [dropdownOpen]);

    const VOTE_OPTIONS = [
        { value: 'Phần I', label: 'Phần I: Trắc nghiệm ABCD' },
        { value: 'Phần II', label: 'Phần II: Đúng / Sai' },
        { value: 'Phần III', label: 'Phần III: Trả lời ngắn' },
    ];

    const handleVote = async () => {
        if (!votePart || !voteNum) {
            onShowToast?.('Vui lòng chọn phần thi và nhập số câu.', 'warning');
            return;
        }

        setIsVoting(true);
        try {
            if (onSubmitVote) {
                const res = await onSubmitVote(votePart, parseInt(voteNum, 10));
                if (res.success) {
                    onShowToast?.(`Đã gửi vote cho câu ${voteNum} - ${votePart} thành công. Thầy sẽ ưu tiên giải câu này!`, 'success');
                    setVoteNum('');
                    setVotePart('');
                } else {
                    onShowToast?.(res.error || 'Lỗi khi gửi vote', 'error');
                }
            }
        } catch (e) {
            onShowToast?.('Lỗi hệ thống khi gửi vote', 'error');
        } finally {
            setIsVoting(false);
        }
    };

    const pct = score.total / 10;
    const grade = pct >= 0.9 ? { label: 'Xuất sắc', color: '#16A34A', bg: '#F0FDF4', emoji: '🥇' }
        : pct >= 0.8 ? { label: 'Giỏi', color: '#2563EB', bg: '#EFF6FF', emoji: '🥈' }
            : pct >= 0.65 ? { label: 'Khá', color: '#D9730D', bg: '#FFF7ED', emoji: '👍' }
                : pct >= 0.5 ? { label: 'Trung bình', color: '#7C4FAE', bg: '#F5F3FF', emoji: '📖' }
                    : { label: 'Cần cố gắng', color: '#E03E3E', bg: '#FEF2F2', emoji: '💪' };

    const ACCENT = '#6B7CDB';

    const radarData = [
        { subject: 'T.Nghiệm ABCD', score: Math.round((score.mc / 4.5) * 100), fullMark: 100 },
        { subject: 'Đúng / Sai', score: Math.round((score.tf / 4.0) * 100), fullMark: 100 },
        { subject: 'Trả lời ngắn', score: Math.round((score.sa / 1.5) * 100), fullMark: 100 },
    ];

    return (
        <div className="fixed inset-0 z-40 overflow-y-auto" style={{ background: '#F7F6F3' }}>
            <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

                {/* ── Score Card ── */}
                <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
                    {/* Gradient top bar */}
                    <div className="h-2" style={{ background: `linear-gradient(90deg, ${ACCENT}, #93ACFF)` }} />

                    <div className="p-6 text-center space-y-4">
                        {/* Big score */}
                        <div>
                            <div
                                className="text-7xl font-black tabular-nums"
                                style={{ color: score.total >= 5 ? '#1A1A1A' : '#E03E3E' }}
                            >
                                {score.total.toFixed(2)}
                            </div>
                            <div className="text-base mt-1" style={{ color: '#AEACA8' }}>/ 10 điểm</div>
                        </div>

                        {/* Badge */}
                        <div
                            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold"
                            style={{ background: grade.bg, color: grade.color }}
                        >
                            <span>{grade.emoji}</span>
                            {grade.label}
                        </div>

                        {/* Breakdown */}
                        <div className="grid grid-cols-3 gap-3 pt-2">
                            {[
                                { label: 'Trắc nghiệm', score: score.mc, max: 4.5, color: ACCENT, bg: '#EEF0FB', hoverBg: '#E2E6FF', border: '#D6DEFD' },
                                { label: 'Đúng/Sai', score: score.tf, max: 4.0, color: '#7C4FAE', bg: '#F5F3FF', hoverBg: '#EBE2F4', border: '#E7DDF0' },
                                { label: 'Trả lời ngắn', score: score.sa, max: 1.5, color: '#D9730D', bg: '#FFF7ED', hoverBg: '#FFEDD5', border: '#FDE0B4' },
                            ].map(s => (
                                <div key={s.label} className="rounded-xl p-3 text-center transition-all duration-300 transform hover:-translate-y-1 hover:shadow-sm"
                                    style={{ background: s.bg, border: `1px solid ${s.border}` }}
                                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = s.hoverBg; }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = s.bg; }}
                                >
                                    <div className="text-xl font-bold transition-transform duration-300" style={{ color: s.color }}>{s.score.toFixed(2)}</div>
                                    <div className="text-[10.5px] font-semibold mt-1 uppercase tracking-wide opacity-80" style={{ color: s.color }}>{s.label}</div>
                                    <div className="text-[10px] font-medium" style={{ color: '#AEACA8' }}>tối đa {s.max}đ</div>
                                </div>
                            ))}
                        </div>

                        {/* Time */}
                        <div className="flex items-center justify-center gap-1.5 text-xs pb-2" style={{ color: '#AEACA8' }}>
                            <Clock className="w-3.5 h-3.5" />
                            Thời gian làm bài: {formatTime(submission.timeTaken)}
                        </div>

                        {/* ── Radar Chart (Phân tích sức mạnh) ── */}
                        <div style={{ width: '100%', height: 260, marginTop: '20px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <RadarChart cx="50%" cy="50%" outerRadius="65%" data={radarData}>
                                    <PolarGrid stroke="#E9E9E7" />
                                    <PolarAngleAxis
                                        dataKey="subject"
                                        tick={{ fill: '#787774', fontSize: 11, fontWeight: 600 }}
                                    />
                                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                    <Radar
                                        name="Điểm số (%)"
                                        dataKey="score"
                                        stroke={ACCENT}
                                        fill={ACCENT}
                                        fillOpacity={0.4}
                                        isAnimationActive={true}
                                    />
                                </RadarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* ── Phần I Chi tiết ── */}
                <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E9E9E7' }}>
                    <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #F1F0EC', background: '#EEF0FB' }}>
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center" style={{ background: ACCENT, color: '#fff' }}>I</div>
                            <span className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>Trắc nghiệm ABCD</span>
                        </div>
                        <ScoreBadge score={score.mc} total={4.5} />
                    </div>
                    <div className="p-4">
                        <div className="grid grid-cols-3 gap-2">
                            {submission.mc.map((stuAns, i) => {
                                const correct = exam.answers.mc[i];
                                const isRight = stuAns && correct && stuAns === correct;
                                const isWrong = stuAns && correct && stuAns !== correct;
                                return (
                                    <div
                                        key={i}
                                        className="flex items-center gap-2 px-3 py-2 rounded-xl"
                                        style={{
                                            background: isRight ? '#F0FDF4' : isWrong ? '#FEF2F2' : '#F7F6F3',
                                            border: `1px solid ${isRight ? '#86EFAC' : isWrong ? '#FECACA' : '#E9E9E7'}`,
                                        }}
                                    >
                                        <span className="text-xs font-medium w-10 shrink-0" style={{ color: '#787774' }}>Câu {i + 1}</span>
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            {isRight && <CheckCircle className="w-3.5 h-3.5 shrink-0" style={{ color: '#16A34A' }} />}
                                            {isWrong && <XCircle className="w-3.5 h-3.5 shrink-0" style={{ color: '#E03E3E' }} />}
                                            {!stuAns && <Minus className="w-3.5 h-3.5 shrink-0" style={{ color: '#CFCFCB' }} />}
                                            <span className="text-xs font-bold" style={{ color: isRight ? '#16A34A' : isWrong ? '#E03E3E' : '#AEACA8' }}>
                                                {stuAns || '—'}
                                            </span>
                                            {isWrong && <span className="text-xs" style={{ color: '#16A34A' }}>→{correct}</span>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* ── Phần II Chi tiết ── */}
                <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E9E9E7' }}>
                    <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #F1F0EC', background: '#F5F3FF' }}>
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center" style={{ background: '#7C4FAE', color: '#fff' }}>II</div>
                            <span className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>Đúng / Sai</span>
                        </div>
                        <ScoreBadge score={score.tf} total={4.0} />
                    </div>
                    <div className="p-4 space-y-3">
                        {submission.tf.map((stuTF, qi) => {
                            const corTF = exam.answers.tf[qi];
                            const correctCount = tfKeys.filter(k => stuTF[k] && corTF[k] && stuTF[k] === corTF[k]).length;
                            const qScore = correctCount === 1 ? 0.1 : correctCount === 2 ? 0.25 : correctCount === 3 ? 0.5 : correctCount === 4 ? 1 : 0;
                            return (
                                <div key={qi} className="p-3 rounded-xl" style={{ background: '#F7F6F3', border: '1px solid #E9E9E7' }}>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>Câu {19 + qi}</span>
                                        <span className="text-xs font-bold px-2 py-0.5 rounded-md"
                                            style={{ background: qScore > 0 ? '#F0FDF4' : '#FEF2F2', color: qScore > 0 ? '#16A34A' : '#E03E3E' }}>
                                            {qScore}đ
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        {tfKeys.map(key => {
                                            const stu = stuTF[key];
                                            const cor = corTF?.[key];
                                            const isRight = stu && cor && stu === cor;
                                            const isWrong = stu && cor && stu !== cor;
                                            return (
                                                <div key={key} className="flex items-center gap-2">
                                                    <span className="text-xs font-semibold w-4" style={{ color: '#787774' }}>{key})</span>
                                                    <div className="flex items-center gap-1.5">
                                                        {isRight && <CheckCircle className="w-3 h-3" style={{ color: '#16A34A' }} />}
                                                        {isWrong && <XCircle className="w-3 h-3" style={{ color: '#E03E3E' }} />}
                                                        {!stu && <Minus className="w-3 h-3" style={{ color: '#CFCFCB' }} />}
                                                        <span className="text-xs font-medium" style={{ color: isRight ? '#16A34A' : isWrong ? '#E03E3E' : '#AEACA8' }}>
                                                            {stu === 'D' ? 'Đúng' : stu === 'S' ? 'Sai' : '—'}
                                                        </span>
                                                        {isWrong && <span className="text-xs" style={{ color: '#16A34A' }}>→{cor === 'D' ? 'Đúng' : 'Sai'}</span>}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ── Phần III Chi tiết ── */}
                <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E9E9E7' }}>
                    <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #F1F0EC', background: '#FFF7ED' }}>
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center" style={{ background: '#D9730D', color: '#fff' }}>III</div>
                            <span className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>Trả lời ngắn</span>
                        </div>
                        <ScoreBadge score={score.sa} total={1.5} />
                    </div>
                    <div className="p-4 space-y-2">
                        {submission.sa.map((stuAns, i) => {
                            const correct = exam.answers.sa[i];
                            const normalizeSA = (s: string) => s.trim().replace(',', '.').toLowerCase();
                            const isRight = stuAns && correct && normalizeSA(stuAns) === normalizeSA(correct);
                            const isWrong = stuAns && correct && normalizeSA(stuAns) !== normalizeSA(correct);
                            return (
                                <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl"
                                    style={{
                                        background: isRight ? '#F0FDF4' : isWrong ? '#FEF2F2' : '#F7F6F3',
                                        border: `1px solid ${isRight ? '#86EFAC' : isWrong ? '#FECACA' : '#E9E9E7'}`,
                                    }}>
                                    <span className="text-xs font-medium w-14 shrink-0" style={{ color: '#787774' }}>Câu {23 + i}</span>
                                    <div className="flex items-center gap-2 flex-1">
                                        {isRight && <CheckCircle className="w-4 h-4 shrink-0" style={{ color: '#16A34A' }} />}
                                        {isWrong && <XCircle className="w-4 h-4 shrink-0" style={{ color: '#E03E3E' }} />}
                                        {!stuAns && <Minus className="w-4 h-4 shrink-0" style={{ color: '#CFCFCB' }} />}
                                        <span className="text-sm font-medium" style={{ color: isRight ? '#16A34A' : isWrong ? '#E03E3E' : '#AEACA8' }}>
                                            {stuAns || '(Bỏ trống)'}
                                        </span>
                                        {isWrong && (
                                            <span className="text-sm ml-2" style={{ color: '#16A34A' }}>→ {correct}</span>
                                        )}
                                    </div>
                                    <span className="text-xs font-bold" style={{ color: isRight ? '#16A34A' : '#AEACA8' }}>
                                        {isRight ? '0.25đ' : '0đ'}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ── Vote Section ── */}
                <div className="rounded-2xl" style={{ background: '#fff', border: '1px solid #E9E9E7' }}>
                    <div className="px-5 py-3 flex items-center justify-between rounded-t-2xl" style={{ borderBottom: '1px solid #F1F0EC', background: '#FAFAFA' }}>
                        <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: '#FFF7ED' }}>
                                <HelpCircle className="w-4 h-4" style={{ color: '#D9730D' }} />
                            </div>
                            <span className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>Báo cáo câu hỏi khó</span>
                        </div>
                    </div>
                    <div className="p-5 space-y-4">
                        <p className="text-[13px] leading-relaxed" style={{ color: '#57564F' }}>
                            Bạn có gặp khó khăn với câu hỏi nào trong đề không? Hãy gửi lại (tối đa 3 câu/đề) để thầy ưu tiên ra video giải chi tiết nhé!
                        </p>
                        <div className="flex gap-3 items-center flex-wrap">
                            <div className="flex-1 min-w-[200px] relative" ref={dropdownRef}>
                                <button
                                    onClick={() => setDropdownOpen(!dropdownOpen)}
                                    className="w-full flex items-center justify-between rounded-xl text-sm px-4 py-2.5 transition-all duration-300 text-left outline-none"
                                    style={{
                                        background: dropdownOpen ? '#fff' : '#F7F6F3',
                                        border: `1px solid ${dropdownOpen ? ACCENT : '#E9E9E7'}`,
                                        color: votePart ? '#1A1A1A' : '#787774',
                                        boxShadow: dropdownOpen ? `0 0 0 2px ${ACCENT}20` : 'none'
                                    }}
                                >
                                    <span className="truncate block flex-1">
                                        {votePart ? VOTE_OPTIONS.find(o => o.value === votePart)?.label : 'Chọn phần thi...'}
                                    </span>
                                    <ChevronDown
                                        className="w-4 h-4 shrink-0 transition-transform duration-200 ml-2"
                                        style={{
                                            color: dropdownOpen ? ACCENT : '#AEACA8',
                                            transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)'
                                        }}
                                    />
                                </button>

                                {dropdownOpen && (
                                    <div
                                        className="absolute top-full left-0 w-full mt-1.5 rounded-xl overflow-hidden z-20"
                                        style={{
                                            background: '#FFFFFF',
                                            border: '1px solid #E9E9E7',
                                            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                                        }}
                                    >
                                        <div className="p-1">
                                            {VOTE_OPTIONS.map(opt => {
                                                const isActive = votePart === opt.value;
                                                return (
                                                    <button
                                                        key={opt.value}
                                                        onClick={() => {
                                                            setVotePart(opt.value);
                                                            setDropdownOpen(false);
                                                        }}
                                                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm rounded-lg transition-colors"
                                                        style={{
                                                            background: isActive ? '#F3ECF8' : 'transparent',
                                                            color: isActive ? '#9065B0' : '#57564F',
                                                            fontWeight: isActive ? 500 : 400,
                                                        }}
                                                        onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = '#F7F6F3'; }}
                                                        onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                                    >
                                                        <span className="flex-1">{opt.label}</span>
                                                        {isActive && (
                                                            <CheckCircle className="w-4 h-4 shrink-0" style={{ color: '#9065B0' }} />
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="w-32 relative">
                                <input
                                    type="number"
                                    placeholder="Số câu (VD: 1)"
                                    className="w-full rounded-xl text-sm px-4 py-2.5 outline-none transition-all duration-300"
                                    style={{ background: '#F7F6F3', border: '1px solid #E9E9E7', color: '#1A1A1A' }}
                                    min={1}
                                    value={voteNum}
                                    onChange={(e) => setVoteNum(e.target.value)}
                                    onFocus={e => { (e.target.style.borderColor = ACCENT); (e.target.style.background = '#fff'); }}
                                    onBlur={e => { (e.target.style.borderColor = '#E9E9E7'); (e.target.style.background = '#F7F6F3'); }}
                                />
                            </div>
                            <button
                                onClick={handleVote}
                                disabled={isVoting}
                                className={`px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2.5 transition-all duration-300 active:scale-95 group hover:-translate-y-[1px] ${isVoting ? 'opacity-50 cursor-not-allowed' : ''}`}
                                style={{ background: '#1A1A1A', color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                                onMouseEnter={e => {
                                    if (!isVoting) {
                                        (e.currentTarget as HTMLElement).style.background = '#333';
                                        (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 16px rgba(0,0,0,0.12)';
                                    }
                                }}
                                onMouseLeave={e => {
                                    if (!isVoting) {
                                        (e.currentTarget as HTMLElement).style.background = '#1A1A1A';
                                        (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                                    }
                                }}
                            >
                                <Send className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                                {isVoting ? 'Đang gửi...' : 'Gửi yêu cầu'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── Actions ── */}
                <div className="flex gap-4 pb-8">
                    <button
                        onClick={onBack}
                        className="flex-1 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-300 active:scale-95 group hover:-translate-y-[1px]"
                        style={{ background: '#F1F0EC', color: '#57564F' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#E9E9E7'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#F1F0EC'; }}
                    >
                        <Home className="w-4 h-4 transition-transform group-hover:scale-110" />
                        Về trang chủ
                    </button>
                    <button
                        onClick={onRetry}
                        className="flex-1 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-300 active:scale-95 group hover:-translate-y-[1px]"
                        style={{ background: ACCENT, color: '#fff', boxShadow: '0 4px 12px rgba(107,124,219,0.2)' }}
                        onMouseEnter={e => {
                            (e.currentTarget as HTMLElement).style.background = '#5566CC';
                            (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(107,124,219,0.4)';
                        }}
                        onMouseLeave={e => {
                            (e.currentTarget as HTMLElement).style.background = ACCENT;
                            (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(107,124,219,0.2)';
                        }}
                    >
                        <RotateCcw className="w-4 h-4 transition-transform group-hover:-rotate-90" />
                        Làm lại
                    </button>
                </div>

            </div>
        </div>
    );
};

export default ExamResult;
