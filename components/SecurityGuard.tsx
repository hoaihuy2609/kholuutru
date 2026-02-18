
import React, { useEffect, useState } from 'react';
import { ShieldAlert, Lock } from 'lucide-react';

const SecurityGuard: React.FC = () => {
    const [isBlurred, setIsBlurred] = useState(false);

    useEffect(() => {
        // --- CÁCH 1: LÀM MỜ KHI MẤT TIÊU ĐIỂM HOẶC CHUYỂN TAB ---
        const handleBlur = () => setIsBlurred(true);
        const handleFocus = () => setIsBlurred(false);
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                setIsBlurred(true);
            }
        };

        window.addEventListener('blur', handleBlur);
        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // --- CÁCH 2: CHẶN CHUỘT PHẢI & PHÍM TẮT ---
        const handleContextMenu = (e: MouseEvent) => {
            e.preventDefault();
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            // Chặn F12
            if (e.key === 'F12') {
                e.preventDefault();
            }
            // Chặn Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C (DevTools)
            if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) {
                e.preventDefault();
            }
            // Chặn Ctrl+U (View Source)
            if (e.ctrlKey && e.key === 'u') {
                e.preventDefault();
            }
            // Chặn Ctrl+S (Save Page)
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
            }
            // Chặn Ctrl+P (Print) - Sẽ có thêm CSS chặn in ấn
            if (e.ctrlKey && e.key === 'p') {
                e.preventDefault();
            }
        };

        document.addEventListener('contextmenu', handleContextMenu);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('blur', handleBlur);
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            document.removeEventListener('contextmenu', handleContextMenu);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    if (!isBlurred) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/20 backdrop-blur-2xl animate-fade-in pointer-events-none select-none">
            <div className="bg-white/80 p-8 rounded-3xl shadow-2xl border border-white/50 flex flex-col items-center gap-4 text-center transform scale-110">
                <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 animate-pulse">
                    <ShieldAlert className="w-10 h-10" />
                </div>
                <div className="space-y-1">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 justify-center">
                        <Lock className="w-5 h-5" /> Hệ Thống Đang Bảo Vệ
                    </h2>
                    <p className="text-sm text-slate-500 font-medium">
                        Nội dung bị ẩn để bảo đảm an toàn dữ liệu bài giảng. <br />
                        Vui lòng quay lại cửa sổ ứng dụng để tiếp tục.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default SecurityGuard;
