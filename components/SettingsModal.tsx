
import React, { useRef, useState, useEffect } from 'react';
import { Download, Upload, X, ShieldAlert, Lock, Unlock, KeyRound, Monitor, UserCheck, ShieldCheck, History } from 'lucide-react';
import { useCloudStorage, exportData, importData, getMachineId, generateActivationKey } from '../src/hooks/useCloudStorage';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onShowToast: (message: string, type: 'success' | 'error' | 'warning') => void;
    isAdmin: boolean;
    onToggleAdmin: (status: boolean) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onShowToast, isAdmin, onToggleAdmin }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { lessons, storedFiles, isActivated, activateSystem } = useCloudStorage();
    const [password, setPassword] = useState('');
    const [showPassInput, setShowPassInput] = useState(false);

    // Activation States
    const [myMachineId, setMyMachineId] = useState('');
    const [studentKeyInput, setStudentKeyInput] = useState('');
    const [adminTargetId, setAdminTargetId] = useState('');
    const [generatedKey, setGeneratedKey] = useState('');
    const [activationHistory, setActivationHistory] = useState<{ id: string, key: string, date: number }[]>([]);

    useEffect(() => {
        if (isOpen) {
            setMyMachineId(getMachineId());
            const history = localStorage.getItem('pv_activation_history');
            if (history) setActivationHistory(JSON.parse(history));
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleGenerateKey = () => {
        if (!adminTargetId.trim()) {
            onShowToast('Vui lòng nhập Mã máy của học sinh', 'warning');
            return;
        }
        const key = generateActivationKey(adminTargetId.trim());
        setGeneratedKey(key);

        const newHistory = [{ id: adminTargetId, key, date: Date.now() }, ...activationHistory].slice(0, 10);
        setActivationHistory(newHistory);
        localStorage.setItem('pv_activation_history', JSON.stringify(newHistory));
        onShowToast('Đã tạo mã kích hoạt thành công!', 'success');
    };

    const handleActivate = () => {
        if (activateSystem(studentKeyInput.trim())) {
            onShowToast('Kích hoạt hệ thống thành công!', 'success');
            setStudentKeyInput('');
        } else {
            onShowToast('Mã kích hoạt không hợp lệ cho máy này!', 'error');
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
                className="bg-white rounded-3xl shadow-2xl w-full max-w-[450px] overflow-hidden animate-scale-in border border-slate-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <h3 className="font-bold text-base text-slate-800">Cài đặt & Bảo mật</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="p-5 space-y-5 max-h-[85vh] overflow-y-auto custom-scrollbar">
                    {/* Admin Access Section */}
                    <div className="bg-slate-50/80 rounded-2xl border border-slate-200/60 overflow-hidden shadow-sm">
                        <div className="p-4 flex items-center justify-between bg-white border-b border-slate-100">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-xl ${isAdmin ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-500'}`}>
                                    {isAdmin ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-1">Quyền truy cập</span>
                                    <span className={`text-sm font-bold ${isAdmin ? 'text-green-600' : 'text-slate-700'}`}>
                                        {isAdmin ? 'Quản trị viên' : 'Chế độ Học sinh'}
                                    </span>
                                </div>
                            </div>

                            {!isAdmin ? (
                                <button
                                    onClick={() => setShowPassInput(!showPassInput)}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-all border border-indigo-100"
                                >
                                    <KeyRound className="w-3.5 h-3.5" />
                                    Mở khóa Admin
                                </button>
                            ) : (
                                <button
                                    onClick={() => onToggleAdmin(false)}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition-all border border-red-100"
                                >
                                    Thoát Admin
                                </button>
                            )}
                        </div>

                        <div className="p-4">
                            {!isAdmin && showPassInput ? (
                                <div className="space-y-3 animate-in slide-in-from-top-2 duration-300">
                                    <div className="relative">
                                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            type="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="Nhập mã xác thực hệ thống..."
                                            className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                                            onKeyDown={(e) => e.key === 'Enter' && handleVerifyPassword()}
                                            autoFocus
                                        />
                                    </div>
                                    <button
                                        onClick={handleVerifyPassword}
                                        className="w-full py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-all active:scale-[0.98]"
                                    >
                                        Xác thực quyền Admin
                                    </button>
                                </div>
                            ) : (
                                <p className="text-[11px] text-slate-500 leading-relaxed italic">
                                    {isAdmin
                                        ? 'Bạn đang ở chế độ Quản trị: Có toàn quyền thêm, sửa, xóa nội dung và cấp mã kích hoạt.'
                                        : 'Bạn đang ở chế độ Học sinh: Hệ thống sẽ hạn chế tính năng nhập dữ liệu nếu chưa được kích hoạt.'}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Activation Section (Only for Students if not activated) */}
                    {!isAdmin && !isActivated && (
                        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 space-y-3 animate-pulse-subtle">
                            <div className="flex items-center gap-2 text-amber-700 font-bold text-sm">
                                <ShieldAlert className="w-5 h-5" />
                                Yêu cầu kích hoạt
                            </div>
                            <div className="space-y-2">
                                <span className="text-[10px] text-amber-800 font-bold uppercase">Mã máy của bạn:</span>
                                <div className="flex gap-2">
                                    <code className="flex-1 p-2 bg-white rounded-lg border border-amber-200 text-xs font-mono font-bold text-center select-all">
                                        {myMachineId}
                                    </code>
                                    <button
                                        onClick={() => { navigator.clipboard.writeText(myMachineId); onShowToast('Đã copy mã máy!', 'success'); }}
                                        className="px-2 bg-white rounded-lg border border-amber-200 text-amber-600 hover:bg-amber-100"
                                    >
                                        Copy
                                    </button>
                                </div>
                                <p className="text-[10px] text-amber-600 italic">Gửi mã này cho giáo viên để nhận Mã kích hoạt bài giảng.</p>
                            </div>
                            <div className="pt-2 flex gap-2">
                                <input
                                    type="text"
                                    value={studentKeyInput}
                                    onChange={(e) => setStudentKeyInput(e.target.value.toUpperCase())}
                                    placeholder="Nhập mã kích hoạt (PV-...)"
                                    className="flex-1 px-3 py-2 text-xs rounded-xl border border-amber-200 outline-none focus:ring-2 focus:ring-amber-500/20"
                                />
                                <button
                                    onClick={handleActivate}
                                    className="px-4 py-2 bg-amber-600 text-white text-xs font-bold rounded-xl hover:bg-amber-700 transition-colors"
                                >
                                    Mở khóa
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Admin Key Generator Section */}
                    {isAdmin && (
                        <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-200 space-y-4">
                            <div className="flex items-center gap-2 text-indigo-700 font-bold text-sm">
                                <UserCheck className="w-5 h-5" />
                                Trạm cấp mã học sinh
                            </div>
                            <div className="space-y-2">
                                <div className="relative">
                                    <Monitor className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        value={adminTargetId}
                                        onChange={(e) => setAdminTargetId(e.target.value.toUpperCase())}
                                        placeholder="Dán Mã máy học sinh gửi vào đây..."
                                        className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-indigo-200 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                    />
                                </div>
                                <button
                                    onClick={handleGenerateKey}
                                    className="w-full py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                                >
                                    <ShieldCheck className="w-4 h-4" />
                                    Tạo Mã Mở Khóa
                                </button>
                            </div>

                            {generatedKey && (
                                <div className="p-3 bg-white rounded-xl border border-indigo-100 space-y-2 animate-in zoom-in-95">
                                    <span className="text-[10px] text-indigo-400 font-bold uppercase">Mã kích hoạt mới:</span>
                                    <div className="flex gap-2">
                                        <div className="flex-1 p-2 bg-indigo-50 text-indigo-700 font-mono font-bold text-center text-sm rounded-lg border border-indigo-100">
                                            {generatedKey}
                                        </div>
                                        <button
                                            onClick={() => { navigator.clipboard.writeText(generatedKey); onShowToast('Đã copy mã kích hoạt!', 'success'); }}
                                            className="px-3 bg-indigo-600 text-white rounded-lg text-xs hover:bg-indigo-700"
                                        >
                                            Copy
                                        </button>
                                    </div>
                                </div>
                            )}

                            {activationHistory.length > 0 && (
                                <div className="pt-2 border-t border-indigo-100">
                                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase mb-2">
                                        <History className="w-3 h-3" />
                                        Lịch sử cấp mã (Tổng: {activationHistory.length})
                                    </div>
                                    <div className="space-y-1.5 max-h-[100px] overflow-y-auto custom-scrollbar">
                                        {activationHistory.map((h, i) => (
                                            <div key={i} className="flex justify-between items-center text-[10px] p-1.5 bg-white/50 rounded-lg border border-indigo-50">
                                                <span className="font-mono text-slate-500">{h.id}</span>
                                                <span className="font-bold text-indigo-600 select-all">{h.key}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {isAdmin && (
                        <div className="space-y-4 animate-in fade-in duration-300 pt-2">
                            <h4 className="font-semibold text-slate-700 flex items-center gap-2">
                                <Download className="w-5 h-5 text-indigo-600" />
                                Xuất dữ liệu bảo mật
                            </h4>
                            <p className="text-sm text-slate-500 italic text-[11px]">
                                Hệ thống sẽ mã hóa Base64 bằng AES-256. Bạn có thể đặt mật khẩu riêng cho file này.
                            </p>
                            <button
                                onClick={handleExport}
                                className="w-full py-3 px-4 bg-indigo-600 text-white font-bold rounded-xl shadow-md hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 border border-indigo-500 active:scale-95"
                            >
                                <Download className="w-5 h-5" />
                                Xuất file bài giảng (.json)
                            </button>
                            <div className="h-px bg-gray-100"></div>
                        </div>
                    )}

                    <div className="space-y-4">
                        <h4 className="font-semibold text-slate-700 flex items-center gap-2">
                            <Upload className="w-5 h-5 text-purple-600" />
                            Nhập dữ liệu bài giảng
                        </h4>

                        {(isActivated || isAdmin) ? (
                            <>
                                <p className="text-sm text-slate-500">
                                    Chọn file .json đã mở khóa để nạp học liệu.
                                </p>
                                <button
                                    onClick={handleImportClick}
                                    className="w-full py-3 px-4 bg-purple-50 hover:bg-purple-100 text-purple-700 font-medium rounded-xl transition-colors flex items-center justify-center gap-2 border border-purple-200"
                                >
                                    <Upload className="w-5 h-5" />
                                    Chọn file bài giảng (.json)
                                </button>
                            </>
                        ) : (
                            <div className="p-4 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center gap-2 text-slate-400 grayscale">
                                <Lock className="w-8 h-8 opacity-20" />
                                <span className="text-xs font-bold">Chức năng đang bị khóa</span>
                                <span className="text-[10px] text-center">Vui lòng nhập Mã kích hoạt phía trên để mở khóa chức năng này.</span>
                            </div>
                        )}

                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept=".json"
                            onChange={handleFileChange}
                        />
                    </div>

                    <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 flex gap-3 items-start">
                        <ShieldAlert className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-orange-700 leading-relaxed italic">
                            {isAdmin
                                ? "Lưu ý: Bạn có thể cấp mã cho nhiều máy khác nhau. Mỗi mã máy chỉ ứng với một mã kích hoạt duy nhất."
                                : "Lưu ý: File bài giảng được bảo mật nhiều lớp. Bạn cần có cả Mã kích hoạt và Mật khẩu file (nếu có) để xem nội dung."}
                        </p>
                    </div>
                </div>

                <div className="p-4 bg-gray-50 text-center border-t border-gray-100">
                    <button
                        onClick={onClose}
                        className="text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
                    >
                        Đóng cài đặt
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
