import React from 'react';
import { CheckCircle, XCircle, Minus, RotateCcw, Home, Clock, Award } from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { Exam, ExamSubmission, ExamTFAnswer } from '../types';
import { calcScore } from './ExamView';

interface ExamResultProps {
    exam: Exam;
    submission: ExamSubmission;
    onRetry: () => void;
    onBack: () => void;
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

const ExamResult: React.FC<ExamResultProps> = ({ exam, submission, onRetry, onBack }) => {
    const score = calcScore(submission, exam.answers);
    const tfKeys: (keyof ExamTFAnswer)[] = ['a', 'b', 'c', 'd'];

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
                                { label: 'Trắc nghiệm', score: score.mc, max: 4.5, color: ACCENT, bg: '#EEF0FB' },
                                { label: 'Đúng/Sai', score: score.tf, max: 4.0, color: '#7C4FAE', bg: '#F5F3FF' },
                                { label: 'Trả lời ngắn', score: score.sa, max: 1.5, color: '#D9730D', bg: '#FFF7ED' },
                            ].map(s => (
                                <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: s.bg }}>
                                    <div className="text-xl font-bold" style={{ color: s.color }}>{s.score.toFixed(2)}</div>
                                    <div className="text-[10px] mt-0.5" style={{ color: '#787774' }}>{s.label}</div>
                                    <div className="text-[10px]" style={{ color: '#AEACA8' }}>/ {s.max}đ</div>
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

                {/* ── Actions ── */}
                <div className="flex gap-3 pb-8">
                    <button
                        onClick={onBack}
                        className="flex-1 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                        style={{ background: '#F1F0EC', color: '#57564F' }}
                    >
                        <Home className="w-4 h-4" />
                        Về trang chủ
                    </button>
                    <button
                        onClick={onRetry}
                        className="flex-1 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                        style={{ background: ACCENT, color: '#fff' }}
                    >
                        <RotateCcw className="w-4 h-4" />
                        Làm lại
                    </button>
                </div>

            </div>
        </div>
    );
};

export default ExamResult;
