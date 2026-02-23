import React, { useEffect, useState, useCallback } from 'react';
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
    maxWidth = '780px',
    fullScreen: initialFullScreen = false
}) => {
    const [isMaximized, setIsMaximized] = useState(initialFullScreen);
    // Key trick: remount content on fullscreen toggle so no transition glitch
    const [mountKey, setMountKey] = useState(0);

    const toggleMaximize = useCallback(() => {
        setIsMaximized(prev => !prev);
        setMountKey(k => k + 1); // force remount → instant, no size animation
    }, []);

    useEffect(() => {
        if (isOpen) {
            setIsMaximized(initialFullScreen);
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [initialFullScreen, isOpen]);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        if (isOpen) window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 animate-fade-in"
                style={{ background: 'rgba(26,26,26,0.50)' }}
                onClick={onClose}
            />

            {/* Modal container – key changes → instant remount, no size tween */}
            <div
                key={mountKey}
                className="relative flex flex-col animate-scale-in"
                style={isMaximized ? {
                    /* ── FULLSCREEN ── */
                    position: 'fixed',
                    inset: 0,
                    width: '100vw',
                    height: '100vh',
                    maxWidth: '100vw',
                    maxHeight: '100vh',
                    background: '#FFFFFF',
                    borderRadius: 0,
                    overflow: 'hidden',
                    zIndex: 1,
                } : {
                    /* ── WINDOWED ── */
                    position: 'relative',
                    width: '100%',
                    maxWidth: maxWidth,
                    maxHeight: '90vh',
                    background: '#FFFFFF',
                    border: '1px solid #E9E9E7',
                    borderRadius: '12px',
                    boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
                    overflow: 'hidden',
                    margin: '16px',
                    zIndex: 1,
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* ── Header ── */}
                <div
                    className="flex items-center justify-between px-5 py-3 shrink-0"
                    style={{ borderBottom: '1px solid #E9E9E7', background: '#FFFFFF' }}
                >
                    <div className="flex flex-col min-w-0 pr-4">
                        <span
                            className="text-[10px] font-semibold uppercase tracking-widest mb-0.5"
                            style={{ color: '#6B7CDB' }}
                        >
                            Tài liệu học tập
                        </span>
                        <h3
                            className="text-sm font-semibold truncate leading-tight"
                            style={{ color: '#1A1A1A' }}
                            title={title}
                        >
                            {title}
                        </h3>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                        {/* Maximize / Minimize */}
                        <button
                            onClick={toggleMaximize}
                            className="p-2 rounded-lg transition-colors"
                            style={{ color: '#787774' }}
                            onMouseEnter={e => {
                                (e.currentTarget as HTMLElement).style.background = '#F1F0EC';
                                (e.currentTarget as HTMLElement).style.color = '#1A1A1A';
                            }}
                            onMouseLeave={e => {
                                (e.currentTarget as HTMLElement).style.background = 'transparent';
                                (e.currentTarget as HTMLElement).style.color = '#787774';
                            }}
                            title={isMaximized ? 'Thu nhỏ (Esc)' : 'Toàn màn hình'}
                        >
                            {isMaximized
                                ? <Minimize2 className="w-4 h-4" />
                                : <Maximize2 className="w-4 h-4" />}
                        </button>

                        {/* Close */}
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg transition-colors"
                            style={{ color: '#787774' }}
                            onMouseEnter={e => {
                                (e.currentTarget as HTMLElement).style.background = '#FEF0F0';
                                (e.currentTarget as HTMLElement).style.color = '#E03E3E';
                            }}
                            onMouseLeave={e => {
                                (e.currentTarget as HTMLElement).style.background = 'transparent';
                                (e.currentTarget as HTMLElement).style.color = '#787774';
                            }}
                            title="Đóng (Esc)"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* ── Content ── */}
                <div
                    className="flex-1 overflow-auto"
                    style={{ background: '#1E1E1E' /* dark embed bg matches PDF viewer */ }}
                >
                    {children}
                </div>

                {/* ── Fullscreen hint bar ── */}
                {isMaximized && (
                    <div
                        className="shrink-0 flex items-center justify-center gap-3 py-1.5 text-[10px]"
                        style={{ background: '#F7F6F3', borderTop: '1px solid #E9E9E7', color: '#AEACA8' }}
                    >
                        <span>Nhấn</span>
                        <kbd
                            className="px-1.5 py-0.5 rounded text-[10px] font-mono"
                            style={{ background: '#E9E9E7', color: '#57564F' }}
                        >
                            Esc
                        </kbd>
                        <span>để thoát toàn màn hình</span>
                        <span>·</span>
                        <button
                            onClick={toggleMaximize}
                            className="underline transition-colors"
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#1A1A1A'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#AEACA8'}
                        >
                            Thu nhỏ
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Modal;
