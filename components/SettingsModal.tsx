
import React, { useRef, useState } from 'react';
import { Download, Upload, X, ShieldAlert, Lock, Unlock, KeyRound } from 'lucide-react';
import { useCloudStorage, exportData, importData } from '../src/hooks/useCloudStorage';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onShowToast: (message: string, type: 'success' | 'error' | 'warning') => void;
    isAdmin: boolean;
    onToggleAdmin: (status: boolean) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onShowToast, isAdmin, onToggleAdmin }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { lessons, storedFiles } = useCloudStorage();
    const [password, setPassword] = useState('');
    const [showPassInput, setShowPassInput] = useState(false);

    if (!isOpen) return null;


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
        } catch (error) {
            console.error(error);
            onShowToast('Lỗi khi nhập dữ liệu: File không hợp lệ', 'error');
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };
    const handleVerifyPassword = () => {
        // Internal System Access Validation (ID: 0x54687948)
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
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <h3 className="font-bold text-lg text-slate-800">Cài đặt & Đồng bộ</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Admin Access Section */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="font-bold text-slate-700 flex items-center gap-2">
                                {isAdmin ? <Unlock className="w-4 h-4 text-green-600" /> : <Lock className="w-4 h-4 text-slate-400" />}
                                Chế độ: {isAdmin ? 'Quản trị viên' : 'Học sinh'}
                            </h4>
                            {!isAdmin ? (
                                <button
                                    onClick={() => setShowPassInput(!showPassInput)}
                                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700 underline"
                                >
                                    Mở khóa Admin
                                </button>
                            ) : (
                                <button
                                    onClick={() => onToggleAdmin(false)}
                                    className="text-xs font-bold text-red-600 hover:text-red-700 underline"
                                >
                                    Thoát Admin
                                </button>
                            )}
                        </div>

                        {showPassInput && !isAdmin && (
                            <div className="mt-3 flex gap-2 animate-in slide-in-from-top-2 duration-200">
                                <div className="relative flex-1">
                                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Mật khẩu Admin..."
                                        className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 focus:border-indigo-500 outline-none"
                                        onKeyDown={(e) => e.key === 'Enter' && handleVerifyPassword()}
                                    />
                                </div>
                                <button
                                    onClick={handleVerifyPassword}
                                    className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors"
                                >
                                    Xác nhận
                                </button>
                            </div>
                        )}
                        <p className="text-[10px] text-slate-400 mt-1">
                            {isAdmin
                                ? 'Bạn đang có toàn quyền chỉnh sửa và xuất dữ liệu.'
                                : 'Học sinh chỉ có quyền xem và nhập dữ liệu từ giáo viên.'}
                        </p>
                    </div>

                    {isAdmin && (
                        <div className="space-y-4 animate-in fade-in duration-300">
                            <h4 className="font-semibold text-slate-700 flex items-center gap-2">
                                <Download className="w-5 h-5 text-indigo-600" />
                                Sao lưu & Xuất dữ liệu
                            </h4>
                            <p className="text-sm text-slate-500">
                                Xuất toàn bộ kho học liệu thành file JSON để gửi cho học sinh.
                            </p>
                            <button
                                onClick={handleExport}
                                className="w-full py-3 px-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium rounded-xl transition-colors flex items-center justify-center gap-2 border border-indigo-200"
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
                        <p className="text-sm text-slate-500">
                            Chọn file .json giáo viên gửi để cập nhật kho học liệu mới nhất.
                        </p>
                        <button
                            onClick={handleImportClick}
                            className="w-full py-3 px-4 bg-purple-50 hover:bg-purple-100 text-purple-700 font-medium rounded-xl transition-colors flex items-center justify-center gap-2 border border-purple-200"
                        >
                            <Upload className="w-5 h-5" />
                            Chọn file bài giảng (.json)
                        </button>
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
                        <p className="text-xs text-orange-700 leading-relaxed">
                            Lưu ý: Dữ liệu được lưu trữ cục bộ. Hãy dùng mã Admin để xuất file nếu bạn muốn chia sẻ bài giảng cho học sinh.
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
