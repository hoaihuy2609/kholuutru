
import React, { useRef, useState, useEffect } from 'react';
import { Download, Upload, X, ShieldAlert, Lock, Unlock, KeyRound, Monitor, UserCheck, ShieldCheck, History, Trash2, LayoutDashboard, Phone } from 'lucide-react';
import { useCloudStorage, exportData, importData, getMachineId, generateActivationKey } from '../src/hooks/useCloudStorage';

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyMkOMHGB-SN17uS8lXVfnruVnnJZiVuNsTmPnQOMQWvme2g5QIeJZKKrkvaUwRsg_H/exec";

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onShowToast: (message: string, type: 'success' | 'error' | 'warning') => void;
    isAdmin: boolean;
    onToggleAdmin: (status: boolean) => void;
    onOpenDashboard: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onShowToast, isAdmin, onToggleAdmin, onOpenDashboard }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { lessons, storedFiles, isActivated, activateSystem } = useCloudStorage();
    const [password, setPassword] = useState('');
    const [showPassInput, setShowPassInput] = useState(false);

    // Activation States
    const [myMachineId, setMyMachineId] = useState('');
    const [studentKeyInput, setStudentKeyInput] = useState('');
    const [studentSdt, setStudentSdt] = useState(''); // New state for SĐT
    const [adminTargetId, setAdminTargetId] = useState('');
    const [adminTargetSdt, setAdminTargetSdt] = useState('');
    const [studentName, setStudentName] = useState('');
    const [generatedKey, setGeneratedKey] = useState('');
    const [activationHistory, setActivationHistory] = useState<{ id: string, name: string, key: string, date: number }[]>([]);

    useEffect(() => {
        if (isOpen) {
            setMyMachineId(getMachineId());
            const history = localStorage.getItem('pv_activation_history');
            if (history) setActivationHistory(JSON.parse(history));

            // Lấy SĐT đã kích hoạt hoặc SĐT đang chờ (từ chatbot)
            const savedSdt = localStorage.getItem('pv_activated_sdt');
            const pendingSdt = localStorage.getItem('pv_pending_sdt');
            if (pendingSdt) setStudentSdt(pendingSdt);
            else if (savedSdt) setStudentSdt(savedSdt);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleGenerateKey = async () => {
        const targetId = adminTargetId.trim();
        const name = studentName.trim();
        const sdt = adminTargetSdt.trim();

        if (!targetId) {
            onShowToast('Vui lòng nhập Mã máy của học sinh', 'warning');
            return;
        }
        if (!sdt) {
            onShowToast('Vui lòng nhập SĐT học sinh để tạo mã chính xác!', 'warning');
            return;
        }

        // Tạo mã kích hoạt
        const key = generateActivationKey(targetId, sdt);
        setGeneratedKey(key);

        // ĐỒNG BỘ LÊN GOOGLE SHEETS
        try {
            await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'add',
                    sdt: sdt,
                    name: name || 'Học sinh tự tạo',
                    machineId: targetId,
                    key: key
                })
            });
            onShowToast('Đã tạo mã và đồng bộ lên hệ thống!', 'success');
        } catch (error) {
            console.error(error);
            onShowToast('Đã tạo mã nhưng lỗi đồng bộ lên Sheets (Kiểm tra lại Script)', 'warning');
        }

        // Lưu vào lịch sử cục bộ
        const filteredHistory = activationHistory.filter(h => h.id !== targetId);
        const newHistory = [{ id: targetId, name: name || 'Học sinh mới', key, date: Date.now() }, ...filteredHistory].slice(0, 50);

        setActivationHistory(newHistory);
        localStorage.setItem('pv_activation_history', JSON.stringify(newHistory));

        setStudentName('');
        setAdminTargetSdt('');
    };

    const handleActivate = () => {
        const sdt = studentSdt.trim();
        const key = studentKeyInput.trim();

        if (!sdt) {
            onShowToast('Vui lòng nhập Số điện thoại đã đăng ký!', 'warning');
            return;
        }

        if (activateSystem(key, sdt)) {
            onShowToast('Kích hoạt hệ thống thành công!', 'success');
            setStudentKeyInput('');
        } else {
            onShowToast('Mã kích hoạt hoặc SĐT không khớp với máy này!', 'error');
        }
    };

    const handleDeleteHistory = (id: string) => {
        if (window.confirm('Bạn có chắc muốn xóa học sinh này khỏi danh sách?')) {
            const newHistory = activationHistory.filter(h => h.id !== id);
            setActivationHistory(newHistory);
            localStorage.setItem('pv_activation_history', JSON.stringify(newHistory));
            onShowToast('Đã xóa học sinh khỏi lịch sử', 'success');
        }
    };

    const handleExport = () => {
        if (!isAdmin) {
            onShowToast('Bạn không có quyền xuất dữ liệu!', 'error');
            return;
        }

        try {
            exportData(lessons, storedFiles);
            onShowToast('Đã xuất dữ liệu thành công!', 'success');
        } catch (error) {
            console.error(error);
            onShowToast('Lỗi khi xuất dữ liệu', 'error');
        }
    };

    const handleImportClick = () => {
        if (!isActivated && !isAdmin) {
            onShowToast('Vui lòng kích hoạt hệ thống trước khi nhập dữ liệu!', 'warning');
            return;
        }
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!window.confirm('Cảnh báo: Nhập dữ liệu sẽ GHI ĐÈ lên dữ liệu hiện tại nếu trùng lặp. Bạn có chắc chắn muốn tiếp tục?')) {
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        try {
            await importData(file);
            onShowToast('Đã nhập dữ liệu thành công! Vui lòng tải lại trang.', 'success');
            setTimeout(() => window.location.reload(), 1500);
        } catch (error: any) {
            console.error(error);
            onShowToast('Lỗi khi nhập dữ liệu: File không hợp lệ', 'error');
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleVerifyPassword = () => {
        const _authCheck = (p: string) => {
            const _ref = [84, 104, 97, 121, 72, 117, 121, 50, 48, 50, 54]
                .map(c => String.fromCharCode(c)).join('');
            return p === _ref;
        };

        if (_authCheck(password)) {
            onToggleAdmin(true);
            onShowToast('Đã kích hoạt quyền quản trị viên!', 'success');
            setShowPassInput(false);
            setPassword('');
        } else {
            onShowToast('Sai mã xác thực hệ thống!', 'error');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div
                className="bg-white rounded-3xl shadow-2xl w-full max-w-[600px] overflow-hidden animate-scale-in border border-slate-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <h3 className="font-bold text-lg text-slate-800">Cài đặt & Bảo mật Hệ thống</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="p-6 space-y-6 max-h-[85vh] overflow-y-auto custom-scrollbar">
                    {/* Admin Access Section */}
                    <div id="tour-admin-section" className="bg-slate-50/80 rounded-2xl border border-slate-200/60 overflow-hidden shadow-sm">
                        <div className="p-4 flex items-center justify-between bg-white border-b border-slate-100">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-xl ${isAdmin ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-500'}`}>
                                    {isAdmin ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-1">Quyền truy cập</span>
                                    <span className={`text-base font-bold ${isAdmin ? 'text-green-600' : 'text-slate-700'}`}>
                                        {isAdmin ? 'Quản trị viên' : 'Chế độ Học sinh'}
                                    </span>
                                </div>
                            </div>

                            {!isAdmin ? (
                                <button
                                    onClick={() => setShowPassInput(!showPassInput)}
                                    className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-sm font-bold hover:bg-indigo-100 transition-all border border-indigo-100"
                                >
                                    <KeyRound className="w-4 h-4" />
                                    Mở khóa Admin
                                </button>
                            ) : (
                                <div className="flex gap-2">
                                    <button
                                        onClick={onOpenDashboard}
                                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100"
                                    >
                                        <LayoutDashboard className="w-4 h-4" />
                                        Quản lý Học viên
                                    </button>
                                    <button
                                        onClick={() => onToggleAdmin(false)}
                                        className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-bold hover:bg-red-100 transition-all border border-red-100"
                                    >
                                        Thoát Admin
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="p-5">
                            {!isAdmin && showPassInput ? (
                                <div className="space-y-3 animate-in slide-in-from-top-2 duration-300">
                                    <div className="relative">
                                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            type="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="Nhập mã xác thực hệ thống..."
                                            className="w-full pl-10 pr-4 py-3 text-sm rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                                            onKeyDown={(e) => e.key === 'Enter' && handleVerifyPassword()}
                                            autoFocus
                                        />
                                    </div>
                                    <button
                                        onClick={handleVerifyPassword}
                                        className="w-full py-3 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-[0.98]"
                                    >
                                        Xác thực quyền Admin
                                    </button>
                                </div>
                            ) : (
                                <p className="text-xs text-slate-500 leading-relaxed italic">
                                    {isAdmin ? (
                                        'Bạn đang ở chế độ Quản trị: Có toàn quyền thêm, sửa, xóa nội dung và cấp mã kích hoạt cho học sinh.'
                                    ) : isActivated ? (
                                        <span className="text-green-600 font-bold flex items-center gap-1">
                                            <ShieldCheck className="w-3 h-3" /> Hệ thống đã được kích hoạt chính chủ. Bạn có thể nạp bài giảng mới.
                                        </span>
                                    ) : (
                                        'Bạn đang ở chế độ Học sinh: Các tính năng nạp dữ liệu sẽ bị hạn chế cho đến khi bạn nhập mã kích hoạt.'
                                    )}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Activation Section (Only for Students if not activated) */}
                    {!isAdmin && !isActivated && (
                        <div id="tour-activation-section" className="p-6 bg-amber-50/50 rounded-3xl border border-amber-200/40 space-y-6">
                            <div className="text-center space-y-2">
                                <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
                                    <KeyRound className="w-6 h-6" />
                                </div>
                                <h4 className="font-bold text-amber-800 text-lg">Kích hoạt tài khoản</h4>
                                <p className="text-xs text-amber-600/80 px-4 leading-relaxed">
                                    Hệ thống đã tự động nhận diện thiết bị. Vui lòng dán mã kích hoạt nhận từ <b>Bot PhysiVault</b> để bắt đầu học.
                                </p>
                            </div>

                            <div className="space-y-4">
                                {/* SĐT Input (Visible if not auto-filled or needs change) */}
                                <div className="relative">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-400">
                                        <Phone className="w-5 h-5" />
                                    </div>
                                    <input
                                        type="tel"
                                        value={studentSdt}
                                        onChange={(e) => setStudentSdt(e.target.value)}
                                        placeholder="Nhập Số điện thoại của bạn"
                                        className="w-full pl-12 pr-4 py-4 text-base font-bold rounded-2xl border-2 border-amber-200/50 outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 bg-white shadow-sm transition-all"
                                    />
                                    {localStorage.getItem('pv_pending_sdt') && (
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                            <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-1 rounded-lg font-bold">Tự động điền từ Bot</span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-400">
                                            <ShieldCheck className="w-5 h-5" />
                                        </div>
                                        <input
                                            type="text"
                                            value={studentKeyInput}
                                            onChange={(e) => setStudentKeyInput(e.target.value.toUpperCase())}
                                            placeholder="Dán mã PV-... vào đây"
                                            className="w-full pl-12 pr-4 py-4 text-base font-mono font-bold rounded-2xl border-2 border-amber-200/50 outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 bg-white shadow-sm transition-all"
                                        />
                                    </div>
                                    <button
                                        onClick={handleActivate}
                                        className="px-8 py-4 bg-amber-600 text-white font-bold rounded-2xl hover:bg-amber-700 transition-all shadow-lg shadow-amber-200 active:scale-95"
                                    >
                                        Mở khóa
                                    </button>
                                </div>

                                {/* Support Info (Minimalist) */}
                                <div className="flex items-center justify-between px-2 text-[10px] font-medium text-amber-600/60 font-mono">
                                    <div className="flex items-center gap-1.5 cursor-help group relative">
                                        <Monitor className="w-3 h-3" />
                                        <span>ID: {myMachineId}</span>
                                        <div className="absolute bottom-full left-0 mb-2 p-2 bg-slate-800 text-white rounded text-[9px] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                                            Mã máy định danh duy nhất
                                        </div>
                                    </div>
                                    <div className="text-[9px] italic opacity-70">
                                        * Nhập đúng SĐT để khớp với mã kích hoạt
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Admin Key Generator Section */}
                    {isAdmin && (
                        <div className="p-5 bg-indigo-50 rounded-2xl border border-indigo-200 space-y-5">
                            <div className="flex items-center gap-2 text-indigo-700 font-bold text-sm">
                                <UserCheck className="w-5 h-5" />
                                Trạm cấp mã học sinh
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <span className="text-[10px] text-slate-500 font-bold uppercase ml-1">Tên học sinh (Tùy chọn)</span>
                                    <input
                                        type="text"
                                        value={studentName}
                                        onChange={(e) => setStudentName(e.target.value)}
                                        placeholder="Ví dụ: Nguyễn Văn A..."
                                        className="w-full px-4 py-2.5 text-sm rounded-lg border border-indigo-100 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <span className="text-[10px] text-slate-500 font-bold uppercase ml-1">SĐT Học sinh (Bắt buộc)</span>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            type="tel"
                                            value={adminTargetSdt}
                                            onChange={(e) => setAdminTargetSdt(e.target.value)}
                                            placeholder="Nhập SĐT đã đăng ký..."
                                            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border border-indigo-100 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <span className="text-[10px] text-slate-500 font-bold uppercase ml-1">Mã máy học sinh (ID)</span>
                                    <div className="relative">
                                        <Monitor className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            type="text"
                                            value={adminTargetId}
                                            onChange={(e) => setAdminTargetId(e.target.value.toUpperCase())}
                                            placeholder="Dán mã máy học sinh..."
                                            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border border-indigo-100 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        />
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={handleGenerateKey}
                                className="w-full py-3 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-100"
                            >
                                <ShieldCheck className="w-5 h-5" />
                                Tạo & Lưu Mã Mở Khóa
                            </button>

                            {generatedKey && (
                                <div className="p-4 bg-white rounded-xl border border-indigo-100 space-y-3 animate-in zoom-in-95">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] text-indigo-400 font-bold uppercase">Mã kích hoạt vừa tạo:</span>
                                        {studentName && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">{studentName}</span>}
                                    </div>
                                    <div className="flex gap-2">
                                        <div className="flex-1 p-3 bg-indigo-50 text-indigo-700 font-mono font-bold text-center text-base rounded-lg border border-indigo-100">
                                            {generatedKey}
                                        </div>
                                        <button
                                            onClick={() => { navigator.clipboard.writeText(generatedKey); onShowToast('Đã copy mã kích hoạt!', 'success'); }}
                                            className="px-5 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700"
                                        >
                                            Copy
                                        </button>
                                    </div>
                                </div>
                            )}

                            {activationHistory.length > 0 && (
                                <div className="pt-4 border-t border-indigo-100">
                                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase mb-3">
                                        <History className="w-3 h-3" />
                                        Nhật ký cấp mã ({activationHistory.length})
                                    </div>
                                    <div className="space-y-2 max-h-[250px] overflow-y-auto custom-scrollbar pr-1">
                                        {activationHistory.map((h, i) => (
                                            <div key={i} className="flex flex-col md:flex-row md:items-center justify-between gap-2 p-3 bg-white border border-indigo-50 rounded-xl hover:shadow-md transition-all">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-bold text-indigo-500 uppercase leading-none mb-1">{h.name || 'Học sinh cũ'}</span>
                                                    <span className="text-xs font-mono text-slate-400">{h.id}</span>
                                                </div>
                                                <div className="flex items-center justify-between md:justify-end gap-3">
                                                    <span className="text-sm font-bold text-slate-700 font-mono bg-slate-50 px-3 py-1 rounded-lg border border-slate-100 select-all">{h.key}</span>
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => { navigator.clipboard.writeText(h.key); onShowToast('Đã copy mã!', 'success'); }}
                                                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                            title="Copy mã"
                                                        >
                                                            <span className="text-[10px] font-bold">COPY</span>
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteHistory(h.id)}
                                                            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="Xóa học sinh này"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {isAdmin && (
                        <div className="space-y-4 animate-in fade-in duration-300 pt-2">
                            <h4 className="font-bold text-slate-700 flex items-center gap-2">
                                <Download className="w-5 h-5 text-indigo-600" />
                                Quản lý dữ liệu hệ thống
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col justify-between">
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Xuất dữ liệu</span>
                                        <p className="text-[11px] text-slate-500 mt-1 mb-4">Tải toàn bộ bài giảng xuống máy tính (.json)</p>
                                    </div>
                                    <button
                                        onClick={handleExport}
                                        className="w-full py-2.5 bg-white border border-indigo-200 text-indigo-600 text-xs font-bold rounded-lg hover:bg-indigo-50 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Download className="w-4 h-4" />
                                        Xuất File
                                    </button>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col justify-between">
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Nhập dữ liệu</span>
                                        <p className="text-[11px] text-slate-500 mt-1 mb-4">Cập nhật nội dung mới từ file giáo viên gửi</p>
                                    </div>
                                    <button
                                        onClick={handleImportClick}
                                        className="w-full py-2.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Upload className="w-4 h-4" />
                                        Chọn & Nhập File
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {!isAdmin && (
                        <div id="tour-import-section" className="space-y-4">
                            <h4 className="font-bold text-slate-700 flex items-center gap-2">
                                <Upload className="w-5 h-5 text-purple-600" />
                                Nhập học liệu mới
                            </h4>

                            {isActivated ? (
                                <button
                                    onClick={handleImportClick}
                                    className="w-full py-4 px-4 bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 text-indigo-700 font-bold rounded-2xl transition-all flex items-center justify-center gap-3 border border-indigo-100 shadow-sm"
                                >
                                    <Upload className="w-6 h-6" />
                                    Chọn file bài giảng từ thầy (.json)
                                </button>
                            ) : (
                                <div className="p-6 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-3 text-slate-400 grayscale">
                                    <div className="p-3 bg-white rounded-full shadow-inner">
                                        <Lock className="w-6 h-6 opacity-40" />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-xs font-bold text-slate-500 mb-1">Chức năng đang bị khóa</p>
                                        <p className="text-[10px] leading-relaxed">Vui lòng kích hoạt mã ở phía trên để nạp bài giảng.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 flex gap-4 items-start">
                        <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                            <ShieldAlert className="w-5 h-5 shrink-0" />
                        </div>
                        <p className="text-xs text-blue-700/80 leading-relaxed font-medium italic">
                            {isAdmin
                                ? "Lưu ý cho Quản trị viên: Mỗi mã máy ứng với một mã kích hoạt duy nhất. Bạn có thể lưu tên học sinh để dễ quản lý nhật ký cấp mã."
                                : "Lưu ý cho Học sinh: Hệ thống cần được kích hoạt bằng mã duy nhất cho máy này để đảm bảo quyền truy cập học liệu chính thức."}
                        </p>
                    </div>
                </div>

                <div className="p-5 bg-slate-50 text-center border-t border-slate-100 flex items-center justify-center gap-6">
                    <button
                        onClick={onClose}
                        className="text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors"
                    >
                        Quay lại trang chủ
                    </button>
                </div>
            </div>

            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".json"
                onChange={handleFileChange}
            />
        </div>
    );
};

export default SettingsModal;
