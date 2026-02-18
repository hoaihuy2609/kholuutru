import React, { useEffect, useState } from 'react';
import { X, Maximize2, Minimize2 } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    maxWidth?: string;
    fullScreen?: boolean;
}

const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    children,
    maxWidth = '600px',
    fullScreen: initialFullScreen = false
}) => {
    const [isMaximized, setIsMaximized] = useState(initialFullScreen);

    useEffect(() => {
        if (isOpen) {
            setIsMaximized(initialFullScreen);
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [initialFullScreen, isOpen]);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            window.addEventListener('keydown', handleEscape);
        }
        return () => window.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-4">
            {/* Backdrop with high blur */}
            <div
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-md animate-fade-in"
                onClick={onClose}
            />

            <div
                className={`
                    relative bg-white shadow-2xl transition-all duration-500 ease-out flex flex-col overflow-hidden
                    ${isMaximized
                        ? 'w-screen h-screen rounded-0 md:rounded-0'
                        : 'w-full rounded-2xl md:rounded-3xl border border-white/20'
                    }
                    animate-scale-in
                `}
                style={{
                    maxWidth: isMaximized ? '100vw' : maxWidth,
                    height: isMaximized ? '100vh' : 'auto',
                    maxHeight: isMaximized ? '100vh' : '92vh'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header - Sleek and subtle */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white/95 backdrop-blur-sm z-10">
                    <div className="flex flex-col min-w-0 pr-4">
                        <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-0.5">Tài liệu học tập</span>
                        <h3 className="text-base font-bold text-slate-800 truncate leading-tight" title={title}>
                            {title}
                        </h3>
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setIsMaximized(!isMaximized)}
                            className="p-2.5 hover:bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-xl transition-all active:scale-90"
                            title={isMaximized ? "Thu nhỏ" : "Phóng to"}
                        >
                            {isMaximized ? <Minimize2 className="w-4.5 h-4.5" /> : <Maximize2 className="w-4.5 h-4.5" />}
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-xl transition-all active:scale-90"
                            title="Đóng"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-auto bg-slate-50/30">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default Modal;
