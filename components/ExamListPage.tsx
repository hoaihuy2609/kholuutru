import React, { useState, useEffect } from 'react';
import { ClipboardList, Clock, Play, RefreshCw, ChevronRight, FileText, Lock } from 'lucide-react';
import { Exam } from '../types';

interface ExamListPageProps {
    onSelectExam: (exam: Exam) => void;
    onLoadExams: () => Promise<Exam[]>;
}

const ACCENT = '#6B7CDB';

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
        { label: 'Trắc nghiệm', sub: '18 câu × 0.25đ', max: '4.5 đ', color: '#6B7CDB', bg: '#EEF0FB' },
        { label: 'Đúng / Sai', sub: '4 câu lũy tiến', max: '4.0 đ', color: '#9065B0', bg: '#F3ECF8' },
        { label: 'Trả lời ngắn', sub: '6 câu × 0.25đ', max: '1.5 đ', color: '#D9730D', bg: '#FFF3E8' },
    ];

    return (
        <div className="space-y-6 animate-fade-in pb-10">

            {/* ── Header ── */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#EEF0FB' }}>
                        <ClipboardList className="w-5 h-5" style={{ color: ACCENT }} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-semibold" style={{ color: '#1A1A1A' }}>Bài Thi Thử</h1>
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
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E9E9E7', background: '#FFFFFF' }}>
                <div className="px-4 py-3" style={{ borderBottom: '1px solid #E9E9E7', borderLeft: '3px solid #6B7CDB', background: '#FAFAF9' }}>
                    <h3 className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>Cơ cấu điểm số</h3>
                    <p className="text-xs mt-0.5" style={{ color: '#787774' }}>Tổng 10 điểm — 28 câu hỏi</p>
                </div>
                <div className="grid grid-cols-3 divide-x" style={{ borderColor: '#E9E9E7' }}>
                    {scoringInfo.map(s => (
                        <div key={s.label} className="p-4 text-center">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center mx-auto mb-2" style={{ background: s.bg }}>
                                <FileText className="w-4 h-4" style={{ color: s.color }} />
                            </div>
                            <div className="text-xl font-bold tabular-nums" style={{ color: s.color }}>{s.max}</div>
                            <div className="text-[13px] font-semibold mt-0.5" style={{ color: '#1A1A1A' }}>{s.label}</div>
                            <div className="text-[11px] mt-1" style={{ color: '#AEACA8' }}>{s.sub}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Tabs ── */}
            <div className="flex items-center gap-2 border-b" style={{ borderColor: '#E9E9E7' }}>
                {[12, 11, 10].map(grade => (
                    <button
                        key={grade}
                        onClick={() => setActiveTab(grade)}
                        className="px-5 py-2.5 text-sm font-semibold transition-colors border-b-2"
                        style={{
                            color: activeTab === grade ? ACCENT : '#787774',
                            borderColor: activeTab === grade ? ACCENT : 'transparent',
                            marginBottom: '-1px'
                        }}
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
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E9E9E7', background: '#FFFFFF' }}>
                    <div className="py-12 text-center px-6">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-3" style={{ background: '#FEF2F2' }}>
                            <Lock className="w-5 h-5" style={{ color: '#E03E3E' }} />
                        </div>
                        <p className="font-semibold" style={{ color: '#E03E3E' }}>Quyền truy cập bị hạn chế</p>
                        <p className="text-sm mt-1 max-w-sm mx-auto leading-relaxed" style={{ color: '#787774' }}>
                            Tài khoản của bạn chỉ được xem đề thi Khối {studentGrade}.
                        </p>
                    </div>
                </div>
            ) : (() => {
                const filteredExams = exams.filter(e => (!e.grade && activeTab === 12) || e.grade === activeTab);
                if (filteredExams.length === 0) {
                    return (
                        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E9E9E7', background: '#FFFFFF' }}>
                            <div className="py-12 text-center">
                                <div className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-3" style={{ background: '#F1F0EC' }}>
                                    <ClipboardList className="w-5 h-5" style={{ color: '#CFCFCB' }} />
                                </div>
                                <p className="font-medium" style={{ color: '#57564F' }}>Chưa có đề thi nào</p>
                                <p className="text-sm mt-1" style={{ color: '#AEACA8' }}>Thầy/cô sẽ đăng đề thi sớm nhé!</p>
                            </div>
                        </div>
                    );
                }
                return (
                    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E9E9E7', background: '#FFFFFF' }}>
                        {filteredExams.map((exam, idx) => (
                            <div
                                key={exam.id}
                                className="flex items-center gap-4 px-4 py-3.5 cursor-pointer transition-colors group"
                                style={{
                                    borderBottom: idx < filteredExams.length - 1 ? '1px solid #F1F0EC' : 'none',
                                    background: '#FFFFFF',
                                }}
                                onClick={() => onSelectExam(exam)}
                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F7F6F3'}
                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#FFFFFF'}
                            >
                                {/* Index badge */}
                                <div
                                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 font-bold text-sm"
                                    style={{ background: '#EEF0FB', color: ACCENT }}
                                >
                                    {idx + 1}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-sm font-semibold truncate" style={{ color: '#1A1A1A' }}>
                                        {exam.title}
                                    </h3>
                                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                                        <span className="flex items-center gap-1 text-xs" style={{ color: '#787774' }}>
                                            <Clock className="w-3 h-3" style={{ color: '#D9730D' }} />
                                            {exam.duration} phút
                                        </span>
                                        <span className="flex items-center gap-1 text-xs truncate max-w-[180px]" style={{ color: '#AEACA8' }}>
                                            <FileText className="w-3 h-3" />
                                            {exam.pdfFileName}
                                        </span>
                                        <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: '#F1F0EC', color: '#AEACA8' }}>
                                            {new Date(exam.createdAt).toLocaleDateString('vi-VN')}
                                        </span>
                                    </div>
                                </div>

                                {/* CTA */}
                                <button
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold shrink-0 transition-all active:scale-95"
                                    style={{ background: ACCENT, color: '#fff' }}
                                    onClick={e => { e.stopPropagation(); onSelectExam(exam); }}
                                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#5a6bc9'}
                                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ACCENT}
                                >
                                    <Play className="w-3.5 h-3.5" />
                                    Làm bài
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
