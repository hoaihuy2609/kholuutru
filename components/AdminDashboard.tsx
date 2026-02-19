
import React, { useState, useEffect } from 'react';
import {
    Users, UserPlus, Trash2, Search, RefreshCw,
    ShieldCheck, Monitor, Phone, Download, ArrowLeft,
    TrendingUp, UserCheck, ShieldAlert, LayoutDashboard
} from 'lucide-react';

interface Student {
    sdt: string;
    name: string;
    machineId: string;
    key: string;
}

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyMkOMHGB-SN17uS8lXVfnruVnnJZiVuNsTmPnQOMQWvme2g5QIeJZKKrkvaUwRsg_H/exec";

interface AdminDashboardProps {
    onBack: () => void;
    onShowToast: (msg: string, type: 'success' | 'error' | 'warning') => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack, onShowToast }) => {
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newStudent, setNewStudent] = useState({ sdt: '', name: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Fetch data from Google Sheets
    const fetchStudents = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=list`);
            const result = await response.json();
            if (result.success) {
                setStudents(result.data);
            } else {
                onShowToast(result.msg || 'Lỗi lấy dữ liệu', 'error');
            }
        } catch (error) {
            console.error(error);
            onShowToast('Không thể kết nối với hệ thống quản lý', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStudents();
    }, []);

    const handleAddStudent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newStudent.sdt || !newStudent.name) return;

        setIsSubmitting(true);
        try {
            const response = await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'add',
                    sdt: newStudent.sdt,
                    name: newStudent.name
                })
            });
            // Vì POST lên Google Script thường là no-cors hoặc trả về CORS error 
            // nhưng dữ liệu vẫn vào. Nếu muốn chính xác phải xử lý kỹ hơn.
            // Ở đây sau khi POST xong ta sẽ Fetch lại danh sách.
            onShowToast('Đã gửi yêu cầu thêm học viên!', 'success');
            setIsAddModalOpen(false);
            setNewStudent({ sdt: '', name: '' });
            setTimeout(fetchStudents, 2000); // Đợi 2s để Script xử lý xong
        } catch (error) {
            onShowToast('Lỗi khi thêm học viên', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteStudent = async (sdt: string) => {
        if (!window.confirm(`Bạn có chắc muốn xóa học viên ${sdt} không?`)) return;

        try {
            await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'delete',
                    sdt: sdt
                })
            });
            onShowToast('Đã gửi yêu cầu xóa!', 'warning');
            setTimeout(fetchStudents, 2000);
        } catch (error) {
            onShowToast('Lỗi khi xóa học viên', 'error');
        }
    };

    const filteredStudents = students.filter(s =>
        s.sdt.includes(searchTerm) || s.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const stats = {
        total: students.length,
        activated: students.filter(s => s.machineId).length,
        pending: students.filter(s => !s.machineId).length
    };

    return (
        <div className="fixed inset-0 z-[60] bg-slate-50 flex flex-col font-sans overflow-hidden animate-fade-in">
            {/* Top Navigation */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-all active:scale-95"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-200">
                            <LayoutDashboard className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-slate-800 tracking-tight">PhysiVault Panel</h1>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Hệ thống quản trị học viên v4.0</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-2xl text-indigo-600 font-bold text-sm">
                        <UserCheck className="w-4 h-4" />
                        Thầy Huy Online
                    </div>
                    <button
                        onClick={fetchStudents}
                        className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-all hover:rotate-180 duration-500"
                        title="Tải lại dữ liệu"
                    >
                        <RefreshCw className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto p-6 lg:p-10 space-y-8 custom-scrollbar">

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-[0.05] group-hover:scale-110 transition-transform duration-700">
                            <Users className="w-24 h-24" />
                        </div>
                        <div className="relative z-10 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Tổng học viên</p>
                                <h3 className="text-4xl font-black text-slate-800">{stats.total}</h3>
                            </div>
                            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                                <Users className="w-6 h-6" />
                            </div>
                        </div>
                        <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-blue-600 bg-blue-50/50 w-fit px-2 py-1 rounded-lg">
                            <TrendingUp className="w-3 h-3" /> +12% So với tháng trước
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-[0.05] group-hover:scale-110 transition-transform duration-700">
                            <ShieldCheck className="w-24 h-24" />
                        </div>
                        <div className="relative z-10 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Đã kích hoạt</p>
                                <h3 className="text-4xl font-black text-emerald-600">{stats.activated}</h3>
                            </div>
                            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                                <ShieldCheck className="w-6 h-6" />
                            </div>
                        </div>
                        <div className="mt-4 text-[10px] font-bold text-slate-400">
                            Hiệu suất: <span className="text-emerald-600">{Math.round((stats.activated / stats.total) * 100 || 0)}%</span> đã vào học
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-[0.05] group-hover:scale-110 transition-transform duration-700">
                            <ShieldAlert className="w-24 h-24" />
                        </div>
                        <div className="relative z-10 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Đang chờ</p>
                                <h3 className="text-4xl font-black text-orange-500">{stats.pending}</h3>
                            </div>
                            <div className="w-12 h-12 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center">
                                <ShieldAlert className="w-6 h-6" />
                            </div>
                        </div>
                        <div className="mt-4 text-[10px] font-bold text-slate-400 italic">
                            Cần hỗ trợ các bạn chưa vào được app
                        </div>
                    </div>
                </div>

                {/* Table Section */}
                <div className="bg-white rounded-[3rem] border border-slate-100 shadow-2xl shadow-slate-200/40 overflow-hidden flex flex-col">
                    <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Tìm theo tên hoặc SĐT..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-none rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium text-slate-700 placeholder:text-slate-400"
                            />
                        </div>
                        <button
                            onClick={() => setIsAddModalOpen(true)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-6 py-4 rounded-2xl shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 transition-all active:scale-95 whitespace-nowrap"
                        >
                            <UserPlus className="w-5 h-5" /> Thêm học viên mới
                        </button>
                    </div>

                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50">
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Học viên</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Số điện thoại</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Mã máy (ID)</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Mã kích hoạt</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Lệnh</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="px-8 py-20 text-center">
                                            <div className="flex flex-col items-center gap-4">
                                                <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                                                <p className="text-slate-500 font-bold text-sm">Đang nạp dữ liệu từ Google Sheets...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredStudents.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-8 py-20 text-center text-slate-400 italic">
                                            Không tìm thấy học viên nào phù hợp.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredStudents.map((s, idx) => (
                                        <tr key={idx} className="hover:bg-indigo-50/20 transition-colors group">
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shadow-sm ${s.machineId ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                                        {s.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-700">{s.name}</p>
                                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Thành viên mới</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5 font-mono font-bold text-slate-600">{s.sdt}</td>
                                            <td className="px-8 py-5">
                                                {s.machineId ? (
                                                    <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg w-fit font-mono text-xs font-bold border border-emerald-100">
                                                        <Monitor className="w-3 h-3" />
                                                        {s.machineId}
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase italic bg-slate-100 px-2 py-1 rounded">Chưa vào máy</span>
                                                )}
                                            </td>
                                            <td className="px-8 py-5">
                                                {s.key ? (
                                                    <div className="flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg w-fit font-mono text-xs font-bold border border-indigo-100">
                                                        {s.key}
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] font-bold text-slate-400 opacity-30">N/A</span>
                                                )}
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <button
                                                    onClick={() => handleDeleteStudent(s.sdt)}
                                                    className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                    title="Xóa học viên"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Add Student Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in" onClick={() => setIsAddModalOpen(false)}>
                    <div className="bg-white rounded-[3rem] w-full max-w-md overflow-hidden shadow-2xl animate-scale-in border border-white" onClick={e => e.stopPropagation()}>
                        <div className="p-8 bg-gradient-to-br from-indigo-600 to-purple-600 text-white">
                            <h3 className="text-2xl font-black mb-1">Thêm học viên mới</h3>
                            <p className="opacity-80 text-xs font-bold uppercase tracking-wider">Nhập đúng SĐT để hệ thống cấp mã</p>
                        </div>
                        <form onSubmit={handleAddStudent} className="p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Tên học viên</label>
                                <div className="relative">
                                    <UserPlus className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <input
                                        type="text"
                                        required
                                        value={newStudent.name}
                                        onChange={e => setNewStudent({ ...newStudent, name: e.target.value })}
                                        placeholder="Ví dụ: Nguyễn Trần Hoài Huy"
                                        className="w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 border-none font-bold text-slate-700"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Số điện thoại</label>
                                <div className="relative">
                                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <input
                                        type="tel"
                                        required
                                        value={newStudent.sdt}
                                        onChange={e => setNewStudent({ ...newStudent, sdt: e.target.value })}
                                        placeholder="Ví dụ: 0985032870"
                                        className="w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 border-none font-bold text-slate-700"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-4 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="flex-1 py-4 px-4 bg-slate-100 text-slate-500 font-bold rounded-2xl hover:bg-slate-200 transition-all"
                                >
                                    Hủy bỏ
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex-1 py-4 px-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Lưu học viên'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

const Loader2 = ({ className }: { className?: string }) => (
    <RefreshCw className={`${className} animate-spin`} />
);

export default AdminDashboard;
