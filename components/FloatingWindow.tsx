import React, { useEffect, useState, useRef } from 'react';
import { X, Maximize2, Minimize2 } from 'lucide-react';

interface FloatingWindowProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    defaultWidth?: number;
    defaultHeight?: number;
}

const FloatingWindow: React.FC<FloatingWindowProps> = ({
    isOpen,
    onClose,
    title,
    children,
    defaultWidth = 1200,
    defaultHeight = 800
}) => {
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [size, setSize] = useState({ width: defaultWidth, height: defaultHeight });
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [isMaximized, setIsMaximized] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
    const [resizeDirection, setResizeDirection] = useState<string>('');
    const windowRef = useRef<HTMLDivElement>(null);

    // Center window on mount
    useEffect(() => {
        if (isOpen && !isDragging) {
            const centerX = (window.innerWidth - size.width) / 2;
            const centerY = (window.innerHeight - size.height) / 2;
            setPosition({ x: Math.max(0, centerX), y: Math.max(0, centerY) });
        }
    }, [isOpen]);

    // Lock body scroll when open
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

    // Handle keyboard shortcuts
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            window.addEventListener('keydown', handleEscape);
        }
        return () => window.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    // Handle dragging
    const handleMouseDown = (e: React.MouseEvent) => {
        if (isMaximized) return;
        setIsDragging(true);
        setDragStart({
            x: e.clientX - position.x,
            y: e.clientY - position.y
        });
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (isDragging && !isMaximized) {
            const newX = e.clientX - dragStart.x;
            const newY = e.clientY - dragStart.y;
            setPosition({
                x: Math.max(0, Math.min(newX, window.innerWidth - size.width)),
                y: Math.max(0, Math.min(newY, window.innerHeight - 100))
            });
        }

        if (isResizing) {
            handleResize(e);
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        setIsResizing(false);
    };

    useEffect(() => {
        if (isDragging || isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, isResizing, dragStart, position, resizeStart]);

    // Handle resizing
    const startResize = (e: React.MouseEvent, direction: string) => {
        e.stopPropagation();
        setIsResizing(true);
        setResizeDirection(direction);
        setResizeStart({
            x: e.clientX,
            y: e.clientY,
            width: size.width,
            height: size.height
        });
    };

    const handleResize = (e: MouseEvent) => {
        const deltaX = e.clientX - resizeStart.x;
        const deltaY = e.clientY - resizeStart.y;
        let newWidth = size.width;
        let newHeight = size.height;
        let newX = position.x;
        let newY = position.y;

        if (resizeDirection.includes('e')) {
            newWidth = Math.max(600, resizeStart.width + deltaX);
        }
        if (resizeDirection.includes('s')) {
            newHeight = Math.max(400, resizeStart.height + deltaY);
        }
        if (resizeDirection.includes('w')) {
            newWidth = Math.max(600, resizeStart.width - deltaX);
            newX = position.x + (size.width - newWidth);
        }
        if (resizeDirection.includes('n')) {
            newHeight = Math.max(400, resizeStart.height - deltaY);
            newY = position.y + (size.height - newHeight);
        }

        setSize({ width: newWidth, height: newHeight });
        if (resizeDirection.includes('w') || resizeDirection.includes('n')) {
            setPosition({ x: newX, y: newY });
        }
    };

    const toggleMaximize = () => {
        if (isMaximized) {
            setIsMaximized(false);
            setSize({ width: defaultWidth, height: defaultHeight });
            const centerX = (window.innerWidth - defaultWidth) / 2;
            const centerY = (window.innerHeight - defaultHeight) / 2;
            setPosition({ x: centerX, y: centerY });
        } else {
            setIsMaximized(true);
            setSize({ width: window.innerWidth, height: window.innerHeight });
            setPosition({ x: 0, y: 0 });
        }
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="modal-overlay" onClick={onClose} />
            <div
                ref={windowRef}
                className="floating-window"
                style={{
                    left: `${position.x}px`,
                    top: `${position.y}px`,
                    width: `${size.width}px`,
                    height: `${size.height}px`
                }}
            >
                {/* Header */}
                <div
                    className="floating-window-header"
                    onMouseDown={handleMouseDown}
                    style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                >
                    <h3 className="text-lg font-bold text-slate-800 truncate pr-4" title={title}>
                        {title}
                    </h3>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={toggleMaximize}
                            className="p-2 hover:bg-slate-100 rounded-lg transition-all text-slate-400 hover:text-slate-600"
                        >
                            {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-400 hover:text-slate-600 active:scale-90"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="floating-window-content">
                    {children}
                </div>

                {/* Resize Handles */}
                {!isMaximized && (
                    <>
                        <div className="resize-handle resize-n" onMouseDown={(e) => startResize(e, 'n')} />
                        <div className="resize-handle resize-s" onMouseDown={(e) => startResize(e, 's')} />
                        <div className="resize-handle resize-e" onMouseDown={(e) => startResize(e, 'e')} />
                        <div className="resize-handle resize-w" onMouseDown={(e) => startResize(e, 'w')} />
                        <div className="resize-handle resize-ne" onMouseDown={(e) => startResize(e, 'ne')} />
                        <div className="resize-handle resize-nw" onMouseDown={(e) => startResize(e, 'nw')} />
                        <div className="resize-handle resize-se" onMouseDown={(e) => startResize(e, 'se')} />
                        <div className="resize-handle resize-sw" onMouseDown={(e) => startResize(e, 'sw')} />
                    </>
                )}
            </div>
        </>
    );
};

export default FloatingWindow;
