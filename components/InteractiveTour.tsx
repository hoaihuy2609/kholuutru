
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronRight, ChevronLeft, X, Lightbulb, CheckCircle2 } from 'lucide-react';

export interface TourStep {
    id: string;
    targetId: string;
    title: string;
    description: string;
    position: 'top' | 'bottom' | 'left' | 'right';
    action?: () => void;
}

interface InteractiveTourProps {
    isOpen: boolean;
    onClose: () => void;
    isAdminMode: boolean;
}

const InteractiveTour: React.FC<InteractiveTourProps> = ({ isOpen, onClose, isAdminMode }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);

    const steps = useMemo<TourStep[]>(() => {
        const baseSteps: TourStep[] = [
            {
                id: 'welcome',
                targetId: 'tour-logo',
                title: 'Chào mừng bạn đến với PhysiVault!',
                description: 'Kho lưu trữ vật lý thông minh dành cho giáo viên và học sinh. Hãy để mình dẫn bạn đi tham quan một vòng nhé.',
                position: 'bottom'
            },
            {
                id: 'settings',
                targetId: 'tour-settings-btn',
                title: 'Trung tâm Điều khiển',
                description: 'Mọi thao tác quan trọng như Kích hoạt, Xuất/Nhập dữ liệu đều nằm ở đây.',
                position: 'right',
                action: () => {
                    const btn = document.getElementById('tour-settings-btn');
                    if (btn) btn.click();
                }
            },
            {
                id: 'activation',
                targetId: 'tour-activation-section',
                title: 'Kích hoạt Hệ thống',
                description: 'Học sinh sẽ lấy Mã máy ở đây gửi cho giáo viên, và dán Mã kích hoạt nhận được vào ô bên dưới.',
                position: 'top'
            },
            {
                id: 'import',
                targetId: 'tour-import-section',
                title: 'Nạp Bài Giảng',
                description: 'Sau khi kích hoạt, bạn có thể nạp các file .json bài giảng mà thầy cô gửi vào hệ thống.',
                position: 'top'
            }
        ];

        const adminSteps: TourStep[] = [
            {
                id: 'admin',
                targetId: 'tour-admin-section',
                title: 'Quyền Quản Trị',
                description: 'Giáo viên có thể mở khóa Admin tại đây để cấp mã cho học sinh và quản lý nội dung.',
                position: 'bottom'
            }
        ];

        return isAdminMode ? [...baseSteps, ...adminSteps] : baseSteps;
    }, [isAdminMode]);

    const updateSpotlight = useCallback(() => {
        const step = steps[currentStep];
        if (!step) return;

        const element = document.getElementById(step.targetId);
        if (element) {
            setSpotlightRect(element.getBoundingClientRect());
            if (step.action) {
                // Delay action slightly to ensure UI is ready
                setTimeout(step.action, 100);
            }
        } else {
            setSpotlightRect(null);
        }
    }, [currentStep, steps]);

    useEffect(() => {
        if (isOpen) {
            updateSpotlight();
            window.addEventListener('resize', updateSpotlight);
            window.addEventListener('scroll', updateSpotlight, true);
        }
        return () => {
            window.removeEventListener('resize', updateSpotlight);
            window.removeEventListener('scroll', updateSpotlight, true);
        };
    }, [isOpen, updateSpotlight]);

    if (!isOpen || !steps[currentStep]) return null;

    const step = steps[currentStep];
    const isLastStep = currentStep === steps.length - 1;

    const getTooltipStyle = () => {
        if (!spotlightRect) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

        const gap = 16;
        const { top, left, right, bottom, width, height } = spotlightRect;

        switch (step.position) {
            case 'top':
                return { bottom: window.innerHeight - top + gap, left: left + width / 2, transform: 'translateX(-50%)' };
            case 'bottom':
                return { top: bottom + gap, left: left + width / 2, transform: 'translateX(-50%)' };
            case 'left':
                return { top: top + height / 2, right: window.innerWidth - left + gap, transform: 'translateY(-50%)' };
            case 'right':
                return { top: top + height / 2, left: right + gap, transform: 'translateY(-50%)' };
            default:
                return {};
        }
    };

    return (
        <div className="fixed inset-0 z-[100] overflow-hidden pointer-events-none">
            {/* Dark Overlay with Spotlight Hole */}
            <div
                className="absolute inset-0 bg-slate-900/70 backdrop-blur-[2px] pointer-events-auto transition-all duration-500"
                style={{
                    clipPath: spotlightRect
                        ? `polygon(0% 0%, 0% 100%, ${spotlightRect.left}px 100%, ${spotlightRect.left}px ${spotlightRect.top}px, ${spotlightRect.right}px ${spotlightRect.top}px, ${spotlightRect.right}px ${spotlightRect.bottom}px, ${spotlightRect.left}px ${spotlightRect.bottom}px, ${spotlightRect.left}px 100%, 100% 100%, 100% 0%)`
                        : 'none'
                }}
            />

            {/* Spotlight Border Glow */}
            {spotlightRect && (
                <div
                    className="absolute border-2 border-indigo-400 rounded-xl shadow-[0_0_20px_rgba(129,140,248,0.5)] transition-all duration-300 pointer-events-none"
                    style={{
                        top: spotlightRect.top - 4,
                        left: spotlightRect.left - 4,
                        width: spotlightRect.width + 8,
                        height: spotlightRect.height + 8,
                    }}
                />
            )}

            {/* Tooltip Card */}
            <div
                className="absolute bg-white rounded-2xl shadow-2xl p-6 w-[320px] pointer-events-auto animate-in zoom-in-95 duration-300 border border-indigo-100"
                style={getTooltipStyle() as React.CSSProperties}
            >
                <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600">
                        <Lightbulb className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Bước {currentStep + 1} / {steps.length}</span>
                </div>

                <h3 className="text-lg font-bold text-slate-800 mb-2">{step.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed mb-6 font-medium">
                    {step.description}
                </p>

                <div className="flex items-center justify-between">
                    <button
                        onClick={onClose}
                        className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        Bỏ qua
                    </button>

                    <div className="flex gap-2">
                        {currentStep > 0 && (
                            <button
                                onClick={() => setCurrentStep(prev => prev - 1)}
                                className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                        )}

                        <button
                            onClick={() => {
                                if (isLastStep) onClose();
                                else setCurrentStep(prev => prev + 1);
                            }}
                            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95"
                        >
                            {isLastStep ? 'Hoàn tất' : 'Tiếp theo'}
                            {!isLastStep && <ChevronRight className="w-4 h-4" />}
                            {isLastStep && <CheckCircle2 className="w-4 h-4" />}
                        </button>
                    </div>
                </div>

                {/* Arrow */}
                <div
                    className={`absolute w-3 h-3 bg-white rotate-45 border-indigo-100 ${step.position === 'top' ? 'bottom-[-7px] left-1/2 -translate-x-1/2 border-b border-r' :
                            step.position === 'bottom' ? 'top-[-7px] left-1/2 -translate-x-1/2 border-t border-l' :
                                step.position === 'left' ? 'right-[-7px] top-1/2 -translate-y-1/2 border-t border-r' :
                                    'left-[-7px] top-1/2 -translate-y-1/2 border-b border-l'
                        }`}
                />
            </div>

            {/* Close Button Top Right */}
            <button
                onClick={onClose}
                className="absolute top-8 right-8 p-3 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-full text-white pointer-events-auto transition-all active:scale-90"
            >
                <X className="w-6 h-6" />
            </button>
        </div>
    );
};

export default InteractiveTour;
