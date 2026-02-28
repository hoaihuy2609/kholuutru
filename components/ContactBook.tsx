import React, { useState, useEffect } from 'react';
import { Award, RefreshCw, Calendar, FileText, CheckCircle } from 'lucide-react';
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

    const load = async () => {
        setLoading(true);
        try {
            // Nếu là admin, truyền undefined để lấy tất cả. Nếu là học sinh, lấy theo SĐT hiện tại.
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

    // Format date: DD/MM/YYYY HH:mm
    const formatDate = (isoStr: string) => {
        const d = new Date(isoStr);
        return d.toLocaleDateString('vi-VN') + ' ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    };

    const getScoreColor = (score: number) => {
        if (score >= 8) return { color: '#16A34A', bg: '#F0FDF4' }; // Green
        if (score >= 5) return { color: '#D9730D', bg: '#FFF7ED' }; // Orange
        return { color: '#E03E3E', bg: '#FEF2F2' }; // Red
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

            {/* Admin Stats / Search */}
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

            {/* List */}
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
                    <p className="font-semibold" style={{ color: '#57564F' }}>Chưa có dữ liệu thi</p>
                    <p className="text-sm mt-1 max-w-sm mx-auto leading-relaxed" style={{ color: '#AEACA8' }}>
                        {isAdmin ? 'Chưa có học sinh nào nộp bài thi.' : 'Bạn chưa nộp bài thi nào. Hãy vào mục Thi Thử để làm bài nhé!'}
                    </p>
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
                                {/* Left info */}
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

                                {/* Right score */}
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
    );
};

export default ContactBook;
