import React, { useState, useEffect } from 'react';
import { ClipboardList, Clock, Play, RefreshCw, ChevronRight, FileText } from 'lucide-react';
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
            const sorted = data.sort((a, b) => b.createdAt - a.createdAt);
            setExams(sorted);
        } catch { /* silent */ }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold" style={{ color: '#1A1A1A' }}>🎯 Thi Thử</h1>
                    <p className="text-sm mt-1" style={{ color: '#787774' }}>
                        Chọn đề thi để bắt đầu. Cấu trúc chuẩn THPT 2025 — 18 TN · 4 Đúng/Sai · 6 Ngắn
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

            {/* Scoring Info */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: 'Trắc nghiệm', sub: '18 câu × 0.25đ', max: '4.5đ', color: ACCENT, bg: '#EEF0FB' },
                    { label: 'Đúng / Sai', sub: '4 câu · thang lũy tiến', max: '4đ', color: '#7C4FAE', bg: '#F5F3FF' },
                    { label: 'Trả lời ngắn', sub: '6 câu × 0.25đ', max: '1.5đ', color: '#D9730D', bg: '#FFF7ED' },
                ].map(s => (
                    <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: s.bg }}>
                        <div className="text-base font-bold" style={{ color: s.color }}>{s.max}</div>
                        <div className="text-xs font-semibold mt-0.5" style={{ color: s.color }}>{s.label}</div>
                        <div className="text-[10px] mt-0.5" style={{ color: '#AEACA8' }}>{s.sub}</div>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-2 border-b" style={{ borderColor: '#E9E9E7' }}>
                {[12, 11, 10].map(grade => (
                    <button
                        key={grade}
                        onClick={() => setActiveTab(grade)}
                        className={`px-5 py-3 text-sm font-semibold transition-colors border-b-2`}
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

            {/* Exam List */}
            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <RefreshCw className="w-6 h-6 animate-spin" style={{ color: ACCENT }} />
                    <span className="ml-2 text-sm" style={{ color: '#787774' }}>Đang tải đề thi...</span>
                </div>
            ) : activeTab !== studentGrade ? (
                <div className="text-center py-16 rounded-2xl" style={{ border: '2px dashed #E9E9E7' }}>
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
                        <span className="text-xl">🔒</span>
                    </div>
                    <p className="font-semibold" style={{ color: '#E03E3E' }}>Quyền truy cập bị hạn chế</p>
                    <p className="text-sm mt-1 max-w-sm mx-auto leading-relaxed" style={{ color: '#787774' }}>
                        Tài khoản của bạn chỉ được cấp quyền xem và làm đề thi của Khối {studentGrade}.
                    </p>
                </div>
            ) : (() => {
                const filteredExams = exams.filter(e => (!e.grade && activeTab === 12) || e.grade === activeTab);

                if (filteredExams.length === 0) {
                    return (
                        <div className="text-center py-16 rounded-2xl" style={{ border: '2px dashed #E9E9E7' }}>
                            <ClipboardList className="w-12 h-12 mx-auto mb-3" style={{ color: '#CFCFCB' }} />
                            <p className="font-medium" style={{ color: '#787774' }}>Chưa có đề thi nào cho Lớp {activeTab}</p>
                            <p className="text-sm mt-1" style={{ color: '#AEACA8' }}>Thầy/cô sẽ đăng đề thi sớm nhé!</p>
                        </div>
                    );
                }

                return (
                    <div className="grid gap-4">
                        {filteredExams.map((exam, idx) => (
                            <div
                                key={exam.id}
                                className="rounded-2xl overflow-hidden transition-all cursor-pointer group"
                                style={{ background: '#fff', border: '1px solid #E9E9E7', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
                                onClick={() => onSelectExam(exam)}
                                onMouseEnter={e => {
                                    (e.currentTarget as HTMLElement).style.borderColor = '#C7CEFF';
                                    (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(107,124,219,0.12)';
                                }}
                                onMouseLeave={e => {
                                    (e.currentTarget as HTMLElement).style.borderColor = '#E9E9E7';
                                    (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)';
                                }}
                            >
                                {/* Top accent */}
                                <div className="h-1" style={{ background: `linear-gradient(90deg, ${ACCENT}, #93ACFF)` }} />

                                <div className="p-5 flex items-center gap-4">
                                    {/* Number badge */}
                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 font-black text-xl"
                                        style={{ background: '#EEF0FB', color: ACCENT }}>
                                        {idx + 1}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold text-base leading-tight truncate" style={{ color: '#1A1A1A' }}>
                                            {exam.title}
                                        </h3>
                                        <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                                            <span className="flex items-center gap-1 text-xs" style={{ color: '#787774' }}>
                                                <Clock className="w-3.5 h-3.5" />
                                                {exam.duration} phút
                                            </span>
                                            <span className="flex items-center gap-1 text-xs" style={{ color: '#787774' }}>
                                                <FileText className="w-3.5 h-3.5" />
                                                {exam.pdfFileName}
                                            </span>
                                            <span className="text-xs" style={{ color: '#AEACA8' }}>
                                                {new Date(exam.createdAt).toLocaleDateString('vi-VN')}
                                            </span>
                                        </div>
                                    </div>

                                    {/* CTA */}
                                    <button
                                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 shrink-0"
                                        style={{ background: ACCENT, color: '#fff' }}
                                        onClick={e => { e.stopPropagation(); onSelectExam(exam); }}
                                    >
                                        <Play className="w-3.5 h-3.5" />
                                        Bắt đầu
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                );
            })()}
        </div>
    );
};

export default ExamListPage;
