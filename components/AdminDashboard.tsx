
import React, { useState, useEffect } from 'react';
import {
    Users, UserPlus, Trash2, Search, RefreshCw,
    ShieldCheck, Monitor, Phone,
    TrendingUp, UserCheck, ShieldAlert, LayoutDashboard,
    UserMinus, RotateCcw, Ban, ArrowLeft, X
} from 'lucide-react';

interface Student {
    sdt: string;
    name: string;
    machineId: string;
    key: string;
    status: string;
}

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxqtcHkPal4oAB0R0A6s2WmxsS6SOxsQefruSPZXEJm_c_Ivl6sW_HnqOVDxUuoAH-W/exec";

interface AdminDashboardProps {
    onBack: () => void;
    onShowToast: (msg: string, type: 'success' | 'error' | 'warning') => void;
}

/* Shared inline input style */
const inputSt: React.CSSProperties = {
    width: '100%',
    background: '#F7F6F3',
    border: '1px solid #E9E9E7',
    borderRadius: '8px',
    padding: '10px 12px',
    fontSize: '14px',
    color: '#1A1A1A',
    outline: 'none',
};

const Loader2 = ({ className }: { className?: string }) => (
    <RefreshCw className={`${className} animate-spin`} />
);

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack, onShowToast }) => {
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newStudent, setNewStudent] = useState({ sdt: '', name: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchStudents = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=list`);
            const result = await response.json();
            if (result.success) setStudents(result.data);
            else onShowToast(result.msg || 'Lỗi lấy dữ liệu', 'error');
        } catch {
            onShowToast('Không thể kết nối với hệ thống quản lý', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchStudents(); }, []);

    const handleAddStudent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newStudent.sdt || !newStudent.name) return;
        setIsSubmitting(true);
        try {
            await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify({ action: 'add', sdt: newStudent.sdt, name: newStudent.name })
            });
            onShowToast('Đã gửi yêu cầu thêm học viên!', 'success');
            setIsAddModalOpen(false);
            setNewStudent({ sdt: '', name: '' });
            setTimeout(fetchStudents, 2000);
        } catch {
            onShowToast('Lỗi khi thêm học viên', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteStudent = async (sdt: string) => {
        if (!window.confirm(`Bạn có chắc muốn xóa học viên ${sdt} không?`)) return;
        try {
            await fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'delete', sdt }) });
            onShowToast('Đã gửi yêu cầu xóa!', 'warning');
            setTimeout(fetchStudents, 2000);
        } catch { onShowToast('Lỗi khi xóa học viên', 'error'); }
    };

    const handleKickStudent = async (sdt: string, name: string) => {
        if (!window.confirm(`Bạn có chắc muốn KICK học viên "${name}" (${sdt}) không?\n\nHọc viên sẽ không thể truy cập tài liệu nữa.`)) return;
        try {
            await fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'kick', sdt }) });
            onShowToast(`Đã kick học viên ${name}!`, 'success');
            setTimeout(fetchStudents, 2000);
        } catch { onShowToast('Lỗi khi kick học viên', 'error'); }
    };

    const handleUnkickStudent = async (sdt: string, name: string) => {
        if (!window.confirm(`Mở khóa cho học viên "${name}" (${sdt})?\n\nHọc viên sẽ cần kích hoạt lại từ đầu.`)) return;
        try {
            await fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'unkick', sdt }) });
            onShowToast(`Đã mở khóa cho ${name}!`, 'success');
            setTimeout(fetchStudents, 2000);
        } catch { onShowToast('Lỗi khi mở khóa học viên', 'error'); }
    };

    const filteredStudents = students.filter(s =>
        s.sdt.includes(searchTerm) || s.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const stats = {
        total: students.length,
        activated: students.filter(s => s.machineId && s.status !== 'KICKED').length,
        pending: students.filter(s => !s.machineId && s.status !== 'KICKED').length,
        kicked: students.filter(s => s.status === 'KICKED').length,
    };

    /* Stat card config */
    const statCards = [
        {
            label: 'Tổng học viên',
            value: stats.total,
            icon: <Users className="w-5 h-5" />,
            accent: '#6B7CDB',
            bg: '#EEF0FB',
            sub: <span className="flex items-center gap-1 text-[11px]" style={{ color: '#6B7CDB' }}><TrendingUp className="w-3 h-3" /> +12% so với tháng trước</span>,
        },
        {
            label: 'Đã kích hoạt',
            value: stats.activated,
            icon: <ShieldCheck className="w-5 h-5" />,
            accent: '#448361',
            bg: '#EAF3EE',
            sub: <span className="text-[11px]" style={{ color: '#787774' }}>Hiệu suất: <b style={{ color: '#448361' }}>{Math.round((stats.activated / stats.total) * 100 || 0)}%</b> đã vào học</span>,
        },
        {
            label: 'Đang chờ',
            value: stats.pending,
            icon: <ShieldAlert className="w-5 h-5" />,
            accent: '#D9730D',
            bg: '#FFF3E8',
            sub: <span className="text-[11px] italic" style={{ color: '#787774' }}>Cần hỗ trợ các bạn chưa vào được app</span>,
        },
        {
            label: 'Bị Kick',
            value: stats.kicked,
            icon: <Ban className="w-5 h-5" />,
            accent: '#E03E3E',
            bg: '#FEF0F0',
            sub: <span className="text-[11px] italic" style={{ color: '#787774' }}>Đã bị thu hồi quyền truy cập</span>,
        },
    ];

    return (
        <div className="fixed inset-0 z-[60] flex flex-col font-sans overflow-hidden animate-fade-in" style={{ background: '#F7F6F3' }}>

            {/* ── Top nav ── */}
            <div className="flex items-center justify-between px-6 py-3.5" style={{ background: '#FFFFFF', borderBottom: '1px solid #E9E9E7' }}>
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: '#787774' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F1F0EC'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg" style={{ background: '#EEF0FB' }}>
                            <LayoutDashboard className="w-4 h-4" style={{ color: '#6B7CDB' }} />
                        </div>
                        <div>
                            <h1 className="text-base font-semibold" style={{ color: '#1A1A1A' }}>PhysiVault Panel</h1>
                            <p className="text-[10px] uppercase tracking-widest" style={{ color: '#AEACA8' }}>Hệ thống quản trị học viên v4.0</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div
                        className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium"
                        style={{ background: '#EEF0FB', color: '#6B7CDB' }}
                    >
                        <UserCheck className="w-4 h-4" />
                        Thầy Huy Online
                    </div>
                    <button
                        onClick={fetchStudents}
                        className="p-2 rounded-lg transition-colors"
                        style={{ color: '#787774', border: '1px solid #E9E9E7', background: '#FFFFFF' }}
                        title="Tải lại dữ liệu"
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F1F0EC'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#FFFFFF'}
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* ── Main scroll area ── */}
            <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6 custom-scrollbar">

                {/* Stat cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {statCards.map((card) => (
                        <div
                            key={card.label}
                            className="rounded-xl p-5 flex flex-col gap-3 transition-shadow"
                            style={{ background: '#FFFFFF', border: '1px solid #E9E9E7', borderLeft: `3px solid ${card.accent}` }}
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#AEACA8' }}>{card.label}</span>
                                <div className="p-1.5 rounded-lg" style={{ background: card.bg, color: card.accent }}>
                                    {card.icon}
                                </div>
                            </div>
                            <div className="text-3xl font-bold" style={{ color: card.accent }}>{card.value}</div>
                            <div>{card.sub}</div>
                        </div>
                    ))}
                </div>

                {/* Table section */}
                <div className="rounded-xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E9E9E7' }}>
                    {/* Table toolbar */}
                    <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3" style={{ borderBottom: '1px solid #E9E9E7' }}>
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#AEACA8' }} />
                            <input
                                type="text"
                                placeholder="Tìm theo tên hoặc SĐT..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                style={{ ...inputSt, paddingLeft: '36px' }}
                                onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = '#6B7CDB'}
                                onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = '#E9E9E7'}
                            />
                        </div>
                        <button
                            onClick={() => setIsAddModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white rounded-lg transition-colors whitespace-nowrap"
                            style={{ background: '#6B7CDB' }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#5a6bc9'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#6B7CDB'}
                        >
                            <UserPlus className="w-4 h-4" />
                            Thêm học viên mới
                        </button>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr style={{ background: '#FAFAF9' }}>
                                    {['Học viên', 'Số điện thoại', 'Mã máy (ID)', 'Mã kích hoạt', 'Trạng thái', 'Lệnh'].map((h, i) => (
                                        <th
                                            key={h}
                                            className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider"
                                            style={{ color: '#AEACA8', textAlign: i === 5 ? 'right' : 'left', borderBottom: '1px solid #E9E9E7' }}
                                        >
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="px-5 py-16 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <Loader2 className="w-8 h-8" style={{ color: '#6B7CDB' } as React.CSSProperties} />
                                                <p className="text-sm" style={{ color: '#787774' }}>Đang nạp dữ liệu từ Google Sheets...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredStudents.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-5 py-16 text-center text-sm italic" style={{ color: '#AEACA8' }}>
                                            Không tìm thấy học viên nào phù hợp.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredStudents.map((s, idx) => {
                                        const isKicked = s.status === 'KICKED';
                                        return (
                                            <tr
                                                key={idx}
                                                style={{
                                                    borderBottom: '1px solid #F1F0EC',
                                                    background: isKicked ? '#FEF8F8' : 'transparent',
                                                    opacity: isKicked ? 0.75 : 1,
                                                }}
                                                onMouseEnter={e => !isKicked && ((e.currentTarget as HTMLElement).style.background = '#FAFAF9')}
                                                onMouseLeave={e => !isKicked && ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                                            >
                                                {/* Student name */}
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div
                                                            className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-semibold shrink-0"
                                                            style={{
                                                                background: isKicked ? '#E03E3E' : s.machineId ? '#6B7CDB' : '#E9E9E7',
                                                                color: isKicked || s.machineId ? '#FFFFFF' : '#787774',
                                                            }}
                                                        >
                                                            {isKicked ? <Ban className="w-4 h-4" /> : s.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-medium" style={{ color: isKicked ? '#E03E3E' : '#1A1A1A', textDecoration: isKicked ? 'line-through' : 'none' }}>
                                                                {s.name}
                                                            </p>
                                                            <p className="text-[10px] uppercase tracking-tight" style={{ color: '#AEACA8' }}>
                                                                {isKicked ? 'Đã bị kick' : s.machineId ? 'Đang hoạt động' : 'Chưa kích hoạt'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>
                                                {/* Phone */}
                                                <td className="px-5 py-4 font-mono text-sm" style={{ color: '#1A1A1A' }}>{s.sdt}</td>
                                                {/* Machine ID */}
                                                <td className="px-5 py-4">
                                                    {s.machineId ? (
                                                        <span
                                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium"
                                                            style={{ background: '#EAF3EE', color: '#448361', border: '1px solid #44836122' }}
                                                        >
                                                            <Monitor className="w-3 h-3" />
                                                            {s.machineId}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] italic px-2 py-1 rounded" style={{ background: '#F1F0EC', color: '#AEACA8' }}>
                                                            Chưa vào máy
                                                        </span>
                                                    )}
                                                </td>
                                                {/* Key */}
                                                <td className="px-5 py-4">
                                                    {s.key ? (
                                                        <span
                                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium"
                                                            style={{ background: '#EEF0FB', color: '#6B7CDB', border: '1px solid #6B7CDB22' }}
                                                        >
                                                            {s.key}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs" style={{ color: '#CFCFCB' }}>—</span>
                                                    )}
                                                </td>
                                                {/* Status */}
                                                <td className="px-5 py-4">
                                                    {isKicked ? (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium" style={{ background: '#FEF0F0', color: '#E03E3E', border: '1px solid #E03E3E22' }}>
                                                            <Ban className="w-3 h-3" /> ĐÃ KICK
                                                        </span>
                                                    ) : s.machineId ? (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium" style={{ background: '#EAF3EE', color: '#448361', border: '1px solid #44836122' }}>
                                                            <ShieldCheck className="w-3 h-3" /> Hoạt động
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium" style={{ background: '#FFF3E8', color: '#D9730D', border: '1px solid #D9730D22' }}>
                                                            <ShieldAlert className="w-3 h-3" /> Chờ
                                                        </span>
                                                    )}
                                                </td>
                                                {/* Actions */}
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center justify-end gap-1">
                                                        {isKicked ? (
                                                            <button
                                                                onClick={() => handleUnkickStudent(s.sdt, s.name)}
                                                                className="p-2 rounded-lg transition-colors"
                                                                style={{ color: '#CFCFCB' }}
                                                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#448361'; (e.currentTarget as HTMLElement).style.background = '#EAF3EE'; }}
                                                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#CFCFCB'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                                                title="Mở khóa học viên"
                                                            >
                                                                <RotateCcw className="w-4 h-4" />
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleKickStudent(s.sdt, s.name)}
                                                                className="p-2 rounded-lg transition-colors"
                                                                style={{ color: '#CFCFCB' }}
                                                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#D9730D'; (e.currentTarget as HTMLElement).style.background = '#FFF3E8'; }}
                                                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#CFCFCB'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                                                title="Kick học viên"
                                                            >
                                                                <UserMinus className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => handleDeleteStudent(s.sdt)}
                                                            className="p-2 rounded-lg transition-colors"
                                                            style={{ color: '#CFCFCB' }}
                                                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#E03E3E'; (e.currentTarget as HTMLElement).style.background = '#FEF0F0'; }}
                                                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#CFCFCB'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                                            title="Xóa học viên"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* ── Add Student Modal ── */}
            {isAddModalOpen && (
                <div
                    className="fixed inset-0 z-[70] flex items-center justify-center p-4 animate-fade-in"
                    style={{ background: 'rgba(26,26,26,0.45)' }}
                    onClick={() => setIsAddModalOpen(false)}
                >
                    <div
                        className="w-full overflow-hidden animate-scale-in"
                        style={{ maxWidth: '400px', background: '#FFFFFF', border: '1px solid #E9E9E7', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Modal header */}
                        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #E9E9E7' }}>
                            <div>
                                <h3 className="text-base font-semibold" style={{ color: '#1A1A1A' }}>Thêm học viên mới</h3>
                                <p className="text-xs mt-0.5" style={{ color: '#787774' }}>Nhập đúng SĐT để hệ thống cấp mã</p>
                            </div>
                            <button
                                onClick={() => setIsAddModalOpen(false)}
                                className="p-1.5 rounded-lg transition-colors"
                                style={{ color: '#787774' }}
                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F1F0EC'}
                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <form onSubmit={handleAddStudent} className="p-5 space-y-4">
                            {/* Name */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#AEACA8' }}>Tên học viên</label>
                                <div className="relative">
                                    <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: '#AEACA8' }} />
                                    <input
                                        type="text" required
                                        value={newStudent.name}
                                        onChange={e => setNewStudent({ ...newStudent, name: e.target.value })}
                                        placeholder="Ví dụ: Nguyễn Trần Hoài Huy"
                                        style={{ ...inputSt, paddingLeft: '32px' }}
                                        onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = '#6B7CDB'}
                                        onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = '#E9E9E7'}
                                    />
                                </div>
                            </div>
                            {/* Phone */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#AEACA8' }}>Số điện thoại</label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: '#AEACA8' }} />
                                    <input
                                        type="tel" required
                                        value={newStudent.sdt}
                                        onChange={e => setNewStudent({ ...newStudent, sdt: e.target.value })}
                                        placeholder="Ví dụ: 0985032870"
                                        style={{ ...inputSt, paddingLeft: '32px' }}
                                        onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = '#6B7CDB'}
                                        onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = '#E9E9E7'}
                                    />
                                </div>
                            </div>
                            {/* Buttons */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors"
                                    style={{ background: '#F1F0EC', color: '#57564F', border: '1px solid #E9E9E7' }}
                                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#E9E9E7'}
                                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#F1F0EC'}
                                >
                                    Hủy bỏ
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex-1 py-2.5 text-sm font-medium text-white rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                                    style={{ background: '#6B7CDB' }}
                                    onMouseEnter={e => !isSubmitting && ((e.currentTarget as HTMLElement).style.background = '#5a6bc9')}
                                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#6B7CDB'}
                                >
                                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Lưu học viên'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
