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
            <div className="flex items-center justify-between p-1">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#1A1A1A' }}>🎯 Bài Thi Thử</h1>
                    <p className="text-sm mt-1.5" style={{ color: '#787774', fontWeight: 500 }}>
                        Cấu trúc chuẩn Bộ GD&ĐT 2025 — 18 TN · 4 Đ/S · 6 Ngắn
                    </p>
                </div>
                <button
                    onClick={load}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-all shadow-sm active:scale-95 hover:shadow-md"
                    style={{ color: '#1A1A1A', background: '#fff', border: '1px solid #E9E9E7' }}
                    title="Tải lại danh sách"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} style={{ color: ACCENT }} />
                    Làm mới
                </button>
            </div>

            {/* Scoring Info */}
            <div className="grid grid-cols-3 gap-3 md:gap-4">
                {[
                    { label: 'Trắc nghiệm', sub: '18 câu × 0.25đ', max: '4.5 đ', color: '#4F65DA', bg: 'linear-gradient(135deg, #EEF0FB 0%, #F5F7FF 100%)', border: '#E2E8F4' },
                    { label: 'Đúng / Sai', sub: '4 câu lũy tiến', max: '4.0 đ', color: '#7C4FAE', bg: 'linear-gradient(135deg, #F5F3FF 0%, #FAF5FF 100%)', border: '#EBE2F4' },
                    { label: 'Trả lời ngắn', sub: '6 câu × 0.25đ', max: '1.5 đ', color: '#D9730D', bg: 'linear-gradient(135deg, #FFF7ED 0%, #FFFAEE 100%)', border: '#F5E6D3' },
                ].map(s => (
                    <div key={s.label} className="rounded-2xl p-4 text-center transition-transform hover:-translate-y-0.5" style={{ background: s.bg, border: `1px solid ${s.border}` }}>
                        <div className="text-lg font-black" style={{ color: s.color }}>{s.max}</div>
                        <div className="text-[13px] font-bold mt-1" style={{ color: s.color }}>{s.label}</div>
                        <div className="text-[11px] font-medium mt-1" style={{ color: '#AEACA8' }}>{s.sub}</div>
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
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
                        {filteredExams.map((exam, idx) => (
                            <div
                                key={exam.id}
                                className="group rounded-2xl overflow-hidden transition-all duration-300 ease-out cursor-pointer relative"
                                style={{
                                    background: '#fff',
                                    border: '1px solid #E9E9E7',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                                }}
                                onClick={() => onSelectExam(exam)}
                                onMouseEnter={e => {
                                    (e.currentTarget as HTMLElement).style.borderColor = '#B7C4FD';
                                    (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(107,124,219,0.08)';
                                    (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                                }}
                                onMouseLeave={e => {
                                    (e.currentTarget as HTMLElement).style.borderColor = '#E9E9E7';
                                    (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.02)';
                                    (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                                }}
                            >
                                {/* Gradient hover background effect */}
                                <div className="absolute inset-0 bg-gradient-to-r from-indigo-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                                <div className="p-4 md:p-5 flex items-center gap-4 relative z-10">
                                    {/* Number badge */}
                                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 font-black text-xl transition-transform group-hover:scale-110 duration-300 origin-center"
                                        style={{ background: '#EEF0FB', color: ACCENT, boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.5)' }}>
                                        {idx + 1}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-base leading-snug truncate transition-colors group-hover:text-indigo-700" style={{ color: '#1A1A1A' }}>
                                            {exam.title}
                                        </h3>
                                        <div className="flex items-center gap-3 md:gap-4 mt-2 flex-wrap">
                                            <span className="flex items-center gap-1.5 text-[13px] font-medium" style={{ color: '#787774' }}>
                                                <div className="p-1 rounded-md bg-gray-50 border border-gray-100"><Clock className="w-3.5 h-3.5" style={{ color: '#F59E0B' }} /></div>
                                                {exam.duration} phút
                                            </span>
                                            <span className="flex items-center gap-1.5 text-[13px] font-medium" style={{ color: '#787774' }}>
                                                <div className="p-1 rounded-md bg-gray-50 border border-gray-100"><FileText className="w-3.5 h-3.5" style={{ color: ACCENT }} /></div>
                                                {exam.pdfFileName}
                                            </span>
                                            <span className="text-[12px] font-medium px-2 py-0.5 rounded-full" style={{ background: '#F7F6F3', color: '#AEACA8' }}>
                                                {new Date(exam.createdAt).toLocaleDateString('vi-VN')}
                                            </span>
                                        </div>
                                    </div>

                                    {/* CTA */}
                                    <button
                                        className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 active:scale-95 shrink-0 group-hover:shadow-[0_4px_12px_rgba(107,124,219,0.3)]"
                                        style={{ background: ACCENT, color: '#fff' }}
                                        onClick={e => { e.stopPropagation(); onSelectExam(exam); }}
                                    >
                                        Bắt đầu <ChevronRight className="w-4 h-4" />
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
