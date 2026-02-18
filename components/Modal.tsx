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
        setIsMaximized(initialFullScreen);
    }, [initialFullScreen, isOpen]);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

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
        <>
            <div className="modal-overlay" onClick={onClose} />
            <div
                className={`modal-content ${isMaximized ? 'full-screen' : ''}`}
                style={{ maxWidth: isMaximized ? 'none' : maxWidth }}
            >
                <div className={`flex flex-col h-full ${isMaximized ? 'max-h-screen' : 'max-h-[92vh]'}`}>
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-10 font-sans">
                        <h3 className="text-lg font-bold text-slate-800 truncate pr-4" title={title}>
                            {title}
                        </h3>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setIsMaximized(!isMaximized)}
                                className="p-2 hover:bg-slate-100 rounded-lg transition-all text-slate-400 hover:text-slate-600"
                                title={isMaximized ? "Thu nhỏ" : "Phóng to"}
                            >
                                {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                            </button>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-400 hover:text-slate-600 active:scale-90"
                                title="Đóng"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-auto bg-slate-50/50">
                        {children}
                    </div>
                </div>
            </div>
        </>
    );
};

export default Modal;
