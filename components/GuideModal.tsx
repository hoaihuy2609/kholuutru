import React, { useState, useEffect } from 'react';
import { X, BookOpen, Monitor, CheckCircle2, Settings, ShieldCheck, Phone, ChevronRight, MessageCircle, Bot, Send } from 'lucide-react';

interface GuideModalProps {
    isOpen: boolean;
    onClose: () => void;
    isAdmin: boolean;
}

const GuideModal: React.FC<GuideModalProps> = ({ isOpen, onClose, isAdmin }) => {
    const [activeScene, setActiveScene] = useState<number>(0);
    const [isPlaying, setIsPlaying] = useState(true);

    const activationSteps = [
        {
            title: "Bước 1: Mở trợ lý ảo",
            desc: "Nhấn vào biểu tượng Chatbot màu đen ở góc màn hình để bắt đầu trò chuyện.",
            icon: <MessageCircle className="w-5 h-5 text-[#1A1A1A]" />
        },
        {
            title: "Bước 2: Nhận mã PV",
            desc: "Nhập số điện thoại của bạn vào khung chat. Bot sẽ tự động cấp mã kích hoạt PV.",
            icon: <Bot className="w-5 h-5 text-[#6B7CDB]" />
        },
        {
            title: "Bước 3: Dán mã & Mở khóa",
            desc: "Vào Cài đặt, nhập SĐT và dán mã PV vào ô kích hoạt để mở khóa toàn bộ tài liệu.",
            icon: <ShieldCheck className="w-5 h-5 text-[#D9730D]" />
        }
    ];

    useEffect(() => {
        if (!isOpen || !isPlaying) return;
        const timer = setInterval(() => {
            setActiveScene(prev => (prev + 1) % activationSteps.length);
        }, 5000);
        return () => clearInterval(timer);
    }, [isOpen, isPlaying, activationSteps.length]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm animate-fade-in text-sans">
            <div
                className="bg-[#F7F6F3] rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden animate-scale-in border border-[#E9E9E7] flex flex-col md:flex-row h-[90vh] md:h-[650px]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Left Info Panel */}
                <div className="w-full md:w-[350px] bg-[#F1F0EC] p-6 border-r border-[#E9E9E7] flex flex-col">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="p-2.5 bg-[#FFFFFF] border border-[#E9E9E7] rounded-xl shadow-sm">
                            <ShieldCheck className="w-6 h-6 text-[#D9730D]" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-base text-[#1A1A1A] leading-tight">Hướng dẫn kích hoạt</h2>
                            <p className="text-[11px] text-[#787774] font-medium uppercase tracking-wider">Học sinh & Thành viên</p>
                        </div>
                    </div>

                    <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                        {activationSteps.map((step, idx) => {
                            const isActive = activeScene === idx;
                            return (
                                <div
                                    key={idx}
                                    onClick={() => { setActiveScene(idx); setIsPlaying(false); }}
                                    className={`group p-4 rounded-xl transition-all cursor-pointer border-l-4 ${isActive
                                        ? 'bg-white shadow-sm border-[#D9730D]'
                                        : 'bg-transparent border-transparent hover:bg-white/40'
                                        }`}
                                >
                                    <div className="flex items-start gap-4">
                                        <div className={`mt-0.5 transition-transform ${isActive ? 'scale-110' : 'opacity-60'}`}>
                                            {step.icon}
                                        </div>
                                        <div>
                                            <h4 className={`text-sm font-semibold transition-colors ${isActive ? 'text-[#1A1A1A]' : 'text-[#787774]'}`}>{step.title}</h4>
                                            <p className="text-xs text-[#787774] mt-1 leading-relaxed">{step.desc}</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-6 pt-6 border-t border-[#E9E9E7]">
                        <button
                            onClick={onClose}
                            className="w-full py-3 bg-[#1A1A1A] text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2"
                        >
                            Tôi đã hiểu
                            <CheckCircle2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Right Simulation Panel */}
                <div className="flex-1 bg-[#F7F6F3] relative overflow-hidden flex items-center justify-center p-8 md:p-12">
                    <div className="relative z-10 w-full max-w-[550px] aspect-[4/3] bg-white rounded-2xl shadow-xl border border-[#E9E9E7] overflow-hidden">
                        <SimulatedAppView scene={activeScene} />
                    </div>
                    {/* Decorative Blobs */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-[#EEF0FB] rounded-full blur-3xl opacity-50 -mr-32 -mt-32" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#FFF3E8] rounded-full blur-3xl opacity-50 -ml-32 -mb-32" />
                </div>

                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 p-2 h-10 w-10 flex items-center justify-center hover:bg-[#EBEBEA] rounded-full transition-colors"
                >
                    <X className="w-5 h-5 text-[#787774]" />
                </button>
            </div>
        </div>
    );
};

const SimulatedAppView: React.FC<{ scene: number }> = ({ scene }) => {
    return (
        <div className="w-full h-full flex flex-col overflow-hidden font-sans bg-[#F7F6F3]">
            {/* Header */}
            <div className="h-10 bg-white border-b border-[#E9E9E7] flex items-center px-4 justify-between shrink-0">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#E9E9E7]" />
                    <div className="w-2 h-2 rounded-full bg-[#E9E9E7]" />
                    <div className="w-2 h-2 rounded-full bg-[#E9E9E7]" />
                </div>
                <div className="h-2 w-24 bg-[#F1F0EC] rounded-full" />
                <div className="w-4 h-4 rounded-md bg-[#6B7CDB]/10 border border-[#6B7CDB]/20" />
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar */}
                <div className="w-24 md:w-32 bg-[#F1F0EC] border-r border-[#E9E9E7] h-full p-4 space-y-3 shrink-0">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded bg-[#E9E9E7]" />
                            <div className="h-1.5 w-full bg-[#E9E9E7] rounded" />
                        </div>
                    ))}
                    <div className={`mt-auto p-2 rounded-lg transition-all flex items-center gap-2 ${scene === 2 ? 'bg-[#1A1A1A] shadow-md ring-4 ring-[#1A1A1A]/10' : 'bg-white border border-[#E9E9E7]'}`}>
                        <Settings className={`w-3 h-3 ${scene === 2 ? 'text-white' : 'text-[#787774]'}`} />
                        <div className={`h-1 w-full rounded ${scene === 2 ? 'bg-white/40' : 'bg-[#F1F0EC]'}`} />
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 p-6 relative flex flex-col">
                    <div className="space-y-2 mb-6">
                        <div className="h-5 w-32 bg-[#1A1A1A]/10 rounded" />
                        <div className="h-2 w-48 bg-[#AEACA8]/20 rounded" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {[1, 2].map(i => (
                            <div key={i} className="bg-white p-4 rounded-xl border border-[#E9E9E7] shadow-sm space-y-3">
                                <div className="h-8 w-8 bg-[#F1F0EC] rounded-lg" />
                                <div className="h-2 w-full bg-[#F1F0EC] rounded" />
                            </div>
                        ))}
                    </div>

                    {/* Step-specific Overlays */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">

                        {/* SCENE 1: CHATBOT ICON CLICK */}
                        {scene === 0 && (
                            <div className="absolute bottom-6 right-6 flex flex-col items-center gap-3 animate-bounce">
                                <div className="w-14 h-14 bg-[#1A1A1A] rounded-full shadow-xl flex items-center justify-center ring-4 ring-white">
                                    <MessageCircle className="w-7 h-7 text-white" />
                                </div>
                                <div className="px-3 py-1.5 bg-white rounded-lg shadow-lg border border-[#E9E9E7] text-[10px] font-bold text-[#1A1A1A] whitespace-nowrap">
                                    NHẤN VÀO ĐÂY
                                </div>
                            </div>
                        )}

                        {/* SCENE 2: CHATBOT INPUT */}
                        {scene === 1 && (
                            <div className="w-4/5 bg-white rounded-3xl border-2 border-[#1A1A1A] shadow-2xl p-4 animate-scale-in flex flex-col gap-4">
                                <div className="flex items-center gap-2 border-b border-[#F7F6F3] pb-3">
                                    <div className="w-8 h-8 rounded-full bg-[#1A1A1A] flex items-center justify-center">
                                        <Bot className="w-4 h-4 text-white" />
                                    </div>
                                    <div className="space-y-1">
                                        <div className="h-2 w-24 bg-[#1A1A1A] rounded" />
                                        <div className="h-1 w-16 bg-[#AEACA8] rounded" />
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <div className="p-3 bg-[#F7F6F3] rounded-xl border border-[#E9E9E7] flex items-center justify-between">
                                        <span className="text-[10px] font-medium text-[#787774]">09xx-xxx-xxx</span>
                                        <Send className="w-3 h-3 text-[#1A1A1A]" />
                                    </div>
                                    <div className="p-3 bg-[#EEF0FB] rounded-xl border border-[#6B7CDB]/30 flex flex-col gap-1.5">
                                        <div className="text-[8px] font-bold text-[#6B7CDB]">MÃ CỦA BẠN:</div>
                                        <div className="text-sm font-mono font-bold text-[#6B7CDB] tracking-[0.2em]">PV-8X2A-9M3L</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* SCENE 3: SETTINGS MODAL ACTIVATION */}
                        {scene === 2 && (
                            <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex items-center justify-center p-6">
                                <div className="w-full max-w-[320px] bg-white rounded-[2rem] border border-[#E9E9E7] shadow-2xl p-6 animate-scale-in space-y-5">
                                    <div className="flex items-center justify-between border-b border-[#F7F6F3] pb-4">
                                        <div className="flex items-center gap-2">
                                            <Settings className="w-4 h-4 text-[#787774]" />
                                            <div className="h-2 w-20 bg-[#1A1A1A] rounded" />
                                        </div>
                                        <X className="w-4 h-4 text-[#CFCFCB]" />
                                    </div>

                                    <div className="space-y-3">
                                        <div className="space-y-1.5">
                                            <div className="h-1.5 w-16 bg-[#AEACA8] rounded pl-1" />
                                            <div className="h-10 w-full bg-[#F7F6F3] rounded-xl border border-[#E9E9E7] flex items-center px-4">
                                                <div className="h-1.5 w-24 bg-[#AEACA8]/40 rounded" />
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <div className="h-1.5 w-20 bg-[#AEACA8] rounded pl-1" />
                                            <div className="h-10 w-full bg-white rounded-xl border-2 border-[#D9730D] flex items-center px-4 shadow-[0_0_15px_-5px_#D9730D]">
                                                <div className="h-2 w-32 bg-[#D9730D]/30 rounded font-mono text-[10px]">PV-8X2A-9M3L</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="w-full py-3.5 bg-[#D9730D] rounded-xl text-[11px] text-white font-bold text-center tracking-widest shadow-lg shadow-orange-100">
                                        KÍCH HOẠT NGAY
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
};

export default GuideModal;
