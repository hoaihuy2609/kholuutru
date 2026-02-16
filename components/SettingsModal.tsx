
import React, { useRef } from 'react';
import { Download, Upload, X, ShieldAlert } from 'lucide-react';
import { useCloudStorage, exportData, importData } from '../src/hooks/useCloudStorage';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onShowToast: (message: string, type: 'success' | 'error' | 'warning') => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onShowToast }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { lessons, storedFiles } = useCloudStorage();

    if (!isOpen) return null;

    const handleExport = () => {
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
            // Reload to reflect changes since we might be mixing cloud/local logic or need a refresh
            setTimeout(() => window.location.reload(), 1500);
        } catch (error) {
            console.error(error);
            onShowToast('Lỗi khi nhập dữ liệu: File không hợp lệ', 'error');
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
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
                    <div className="space-y-4">
                        <h4 className="font-semibold text-slate-700 flex items-center gap-2">
                            <Download className="w-5 h-5 text-indigo-600" />
                            Sao lưu & Xuất dữ liệu
                        </h4>
                        <p className="text-sm text-slate-500">
                            Tải xuống toàn bộ bài học và file PDF hiện có về máy. Bạn có thể dùng file này để nạp vào thiết bị khác.
                        </p>
                        <button
                            onClick={handleExport}
                            className="w-full py-3 px-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium rounded-xl transition-colors flex items-center justify-center gap-2 border border-indigo-200"
                        >
                            <Download className="w-5 h-5" />
                            Xuất dữ liệu ngay (.json)
                        </button>
                    </div>

                    <div className="h-px bg-gray-100"></div>

                    <div className="space-y-4">
                        <h4 className="font-semibold text-slate-700 flex items-center gap-2">
                            <Upload className="w-5 h-5 text-purple-600" />
                            Khôi phục & Nhập dữ liệu
                        </h4>
                        <p className="text-sm text-slate-500">
                            Nạp dữ liệu từ file backup (.json). Dữ liệu sẽ được đồng bộ hóa và sắp xếp tự động vào đúng bài học.
                        </p>
                        <button
                            onClick={handleImportClick}
                            className="w-full py-3 px-4 bg-purple-50 hover:bg-purple-100 text-purple-700 font-medium rounded-xl transition-colors flex items-center justify-center gap-2 border border-purple-200"
                        >
                            <Upload className="w-5 h-5" />
                            Chọn file để nhập
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
                            Lưu ý: Tính năng này giúp bạn chuyển dữ liệu giữa các máy tính/điện thoại mà không cần đăng nhập. Hãy giữ file backup cẩn thận.
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
