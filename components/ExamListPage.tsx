import React, { useState, useEffect } from 'react';
import { ClipboardList, Clock, Play, RefreshCw, ChevronRight, FileText, Lock, Zap } from 'lucide-react';
import { Exam } from '../types';

interface ExamListPageProps {
    onSelectExam: (exam: Exam) => void;
    onLoadExams: () => Promise<Exam[]>;
}

// ── Amber / Golden palette ──
const ACCENT = '#D97706';          // amber-600
const ACCENT_DARK = '#B45309';     // amber-700
const ACCENT_LIGHT = '#FFFBEB';    // amber-50
const ACCENT_MID = '#FDE68A';      // amber-200
const ACCENT_BORDER = '#FCD34D';   // amber-300

const ExamListPage: React.FC<ExamListPageProps> = ({ onSelectExam, onLoadExams }) => {
    const [exams, setExams] = useState<Exam[]>([]);
    const [loading, setLoading] = useState(true);
    const [studentGrade] = useState(() => parseInt(localStorage.getItem('physivault_grade') || '12', 10));
    const [activeTab, setActiveTab] = useState<number>(studentGrade);

    const load = async () => {
        setLoading(true);
        try {
            const data = await onLoadExams();
            setExams(data.sort((a, b) => b.createdAt - a.createdAt));
        } catch { /* silent */ }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    const scoringInfo = [
        { label: 'Trắc nghiệm', sub: '18 câu × 0.25đ', max: '4.5 đ', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
        { label: 'Đúng / Sai', sub: '4 câu lũy tiến', max: '4.0 đ', color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
        { label: 'Trả lời ngắn', sub: '6 câu × 0.25đ', max: '1.5 đ', color: '#0D9488', bg: '#F0FDFA', border: '#99F6E4' },
    ];

    return (
        <div className="space-y-6 animate-fade-in pb-10">

            {/* ── Header ── */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 relative overflow-hidden"
                        style={{ background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)', boxShadow: '0 4px 12px rgba(217,119,6,0.35)' }}
                    >
                        <Zap className="w-5 h-5 text-white" fill="white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>Bài Thi Thử</h1>
                        <p className="text-sm mt-0.5" style={{ color: '#787774' }}>Cấu trúc chuẩn Bộ GD&ĐT 2025</p>
                    </div>
                </div>
                <button
                    onClick={load}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                    style={{ background: '#F1F0EC', border: '1px solid #E9E9E7', color: '#57564F' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#E9E9E7'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#F1F0EC'}
                    title="Tải lại danh sách"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} style={{ color: ACCENT }} />
                    Làm mới
                </button>
            </div>

            {/* ── Scoring Info ── */}
            <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #FDE68A', background: 'linear-gradient(135deg, #FFFBEB 0%, #FFF8E1 100%)' }}>
                <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #FDE68A' }}>
                    <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: ACCENT }}>
                        <FileText className="w-3 h-3 text-white" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold" style={{ color: ACCENT_DARK }}>Cơ cấu điểm số</h3>
                        <p className="text-xs mt-0.5" style={{ color: '#92400E' }}>Tổng 10 điểm — 28 câu hỏi</p>
                    </div>
                </div>
                <div className="grid grid-cols-3 divide-x" style={{ borderColor: '#FDE68A' }}>
                    {scoringInfo.map(s => (
                        <div key={s.label} className="p-4 text-center" style={{ background: 'transparent' }}>
                            <div
                                className="w-9 h-9 rounded-xl flex items-center justify-center mx-auto mb-2"
                                style={{ background: s.bg, border: `1px solid ${s.border}` }}
                            >
                                <FileText className="w-4.5 h-4.5" style={{ color: s.color, width: 18, height: 18 }} />
                            </div>
                            <div className="text-2xl font-extrabold tabular-nums" style={{ color: s.color }}>{s.max}</div>
                            <div className="text-[13px] font-semibold mt-0.5" style={{ color: '#1A1A1A' }}>{s.label}</div>
                            <div className="text-[11px] mt-1" style={{ color: '#92400E', opacity: 0.65 }}>{s.sub}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Tabs ── */}
            <div className="flex items-center gap-1 p-1 rounded-xl w-fit" style={{ background: '#F1F0EC', border: '1px solid #E9E9E7' }}>
                {[12, 11, 10].map(grade => (
                    <button
                        key={grade}
                        onClick={() => setActiveTab(grade)}
                        className="px-5 py-2 text-sm font-bold rounded-lg transition-all duration-200"
                        style={
                            activeTab === grade
                                ? { background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: '#fff', boxShadow: '0 2px 8px rgba(217,119,6,0.40)' }
                                : { color: '#787774', background: 'transparent' }
                        }
                    >
                        Lớp {grade}
                    </button>
                ))}
            </div>

            {/* ── Exam List ── */}
            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <RefreshCw className="w-5 h-5 animate-spin" style={{ color: ACCENT }} />
                    <span className="ml-2 text-sm" style={{ color: '#787774' }}>Đang tải đề thi...</span>
                </div>
            ) : activeTab !== studentGrade ? (
                <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #E9E9E7', background: '#FFFFFF' }}>
                    <div className="py-12 text-center px-6">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
                            <Lock className="w-6 h-6" style={{ color: '#E03E3E' }} />
                        </div>
                        <p className="font-bold text-lg" style={{ color: '#E03E3E' }}>Quyền truy cập bị hạn chế</p>
                        <p className="text-sm mt-1 max-w-sm mx-auto leading-relaxed" style={{ color: '#787774' }}>
                            Tài khoản của bạn chỉ được xem đề thi Khối {studentGrade}.
                        </p>
                    </div>
                </div>
            ) : (() => {
                const filteredExams = exams.filter(e => (!e.grade && activeTab === 12) || e.grade === activeTab);
                if (filteredExams.length === 0) {
                    return (
                        <div className="rounded-2xl overflow-hidden" style={{ border: '1px dashed #FDE68A', background: ACCENT_LIGHT }}>
                            <div className="py-12 text-center">
                                <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: '#FEF3C7', border: '1px solid #FDE68A' }}>
                                    <ClipboardList className="w-6 h-6" style={{ color: ACCENT }} />
                                </div>
                                <p className="font-semibold" style={{ color: ACCENT_DARK }}>Chưa có đề thi nào</p>
                                <p className="text-sm mt-1" style={{ color: '#92400E', opacity: 0.7 }}>Thầy/cô sẽ đăng đề thi sớm nhé!</p>
                            </div>
                        </div>
                    );
                }
                return (
                    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #E9E9E7', background: '#FFFFFF', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                        {/* Section header */}
                        <div className="px-4 py-2.5 flex items-center justify-between" style={{ background: 'linear-gradient(90deg, #FFFBEB, #FFF8E1)', borderBottom: '1px solid #FDE68A' }}>
                            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: ACCENT }}>
                                {filteredExams.length} đề thi · Lớp {activeTab}
                            </span>
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: ACCENT_MID, color: ACCENT_DARK }}>
                                Mới nhất trên đầu
                            </span>
                        </div>

                        {filteredExams.map((exam, idx) => (
                            <div
                                key={exam.id}
                                className="flex items-center gap-4 px-4 py-3.5 cursor-pointer transition-all group"
                                style={{
                                    borderBottom: idx < filteredExams.length - 1 ? '1px solid #F1F0EC' : 'none',
                                    background: '#FFFFFF',
                                }}
                                onClick={() => onSelectExam(exam)}
                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = ACCENT_LIGHT}
                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#FFFFFF'}
                            >
                                {/* Index badge */}
                                <div
                                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-extrabold text-sm transition-all group-hover:scale-105"
                                    style={{ background: 'linear-gradient(135deg, #FDE68A, #FCD34D)', color: ACCENT_DARK, border: '1px solid #FCD34D' }}
                                >
                                    {idx + 1}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-sm font-bold truncate" style={{ color: '#1A1A1A' }}>
                                        {exam.title}
                                    </h3>
                                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                                        <span className="flex items-center gap-1 text-xs font-medium" style={{ color: ACCENT_DARK }}>
                                            <Clock className="w-3 h-3" />
                                            {exam.duration} phút
                                        </span>
                                        <span className="flex items-center gap-1 text-xs truncate max-w-[180px]" style={{ color: '#AEACA8' }}>
                                            <FileText className="w-3 h-3" />
                                            {exam.pdfFileName}
                                        </span>
                                        <span className="text-[11px] px-1.5 py-0.5 rounded-md font-medium" style={{ background: '#FEF3C7', color: '#92400E' }}>
                                            {new Date(exam.createdAt).toLocaleDateString('vi-VN')}
                                        </span>
                                    </div>
                                </div>

                                {/* CTA */}
                                <button
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold shrink-0 transition-all active:scale-95"
                                    style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: '#fff', boxShadow: '0 2px 8px rgba(217,119,6,0.35)' }}
                                    onClick={e => { e.stopPropagation(); onSelectExam(exam); }}
                                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(217,119,6,0.5)'}
                                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(217,119,6,0.35)'}
                                >
                                    <Play className="w-3.5 h-3.5" fill="white" />
                                    Làm bài
                                    <ChevronRight className="w-3.5 h-3.5 opacity-70" />
                                </button>
                            </div>
                        ))}
                    </div>
                );
            })()}
        </div>
    );
};

export default ExamListPage;
