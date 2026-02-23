import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, Settings, ShieldCheck, ChevronRight, MessageCircle, Bot, Send, RefreshCw, Lock } from 'lucide-react';

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
            desc: "Nhấn vào biểu tượng Chatbot màu đen ở góc màn hình để bắt đầu.",
            icon: <MessageCircle className="w-5 h-5 text-[#1A1A1A]" />
        },
        {
            title: "Bước 2: Nhận mã kích hoạt",
            desc: "Nhập SĐT của bạn vào khung chat. Bot sẽ tự động cấp mã PV duy nhất.",
            icon: <Bot className="w-5 h-5 text-[#6B7CDB]" />
        },
        {
            title: "Bước 3: Mở khóa hệ thống",
            desc: "Vào Cài đặt, dán mã PV-... vào ô kích hoạt để truy cập toàn bộ tài liệu.",
            icon: <ShieldCheck className="w-5 h-5 text-[#D9730D]" />
        }
    ];

    useEffect(() => {
        if (!isOpen || !isPlaying) return;
        const timer = setInterval(() => {
            setActiveScene(prev => (prev + 1) % activationSteps.length);
        }, 6000);
        return () => clearInterval(timer);
    }, [isOpen, isPlaying, activationSteps.length]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fade-in text-sans">
            <div
                className="bg-[#F7F6F3] rounded-[32px] shadow-2xl w-full max-w-6xl overflow-hidden animate-scale-in border border-[#E9E9E7] flex flex-col md:flex-row h-[90vh] md:h-[700px]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Left Info Panel */}
                <div className="w-full md:w-[380px] bg-[#F1F0EC] p-8 border-r border-[#E9E9E7] flex flex-col">
                    <div className="flex items-center gap-4 mb-10">
                        <div className="p-3 bg-white border border-[#E9E9E7] rounded-2xl shadow-sm">
                            <ShieldCheck className="w-7 h-7 text-[#D9730D]" />
                        </div>
                        <div>
                            <h2 className="font-bold text-lg text-[#1A1A1A] leading-tight">Hướng dẫn kích hoạt</h2>
                            <p className="text-[11px] text-[#787774] font-semibold uppercase tracking-[0.15em] mt-0.5">PhysiVault System</p>
                        </div>
                    </div>

                    <div className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                        {activationSteps.map((step, idx) => {
                            const isActive = activeScene === idx;
                            return (
                                <div
                                    key={idx}
                                    onClick={() => { setActiveScene(idx); setIsPlaying(false); }}
                                    className={`group p-5 rounded-2xl transition-all cursor-pointer border-l-4 ${isActive
                                        ? 'bg-white shadow-md border-[#D9730D]'
                                        : 'bg-transparent border-transparent hover:bg-white/40'
                                        }`}
                                >
                                    <div className="flex items-start gap-5">
                                        <div className={`mt-0.5 transition-all duration-300 ${isActive ? 'scale-110 opacity-100' : 'opacity-40 scale-100'}`}>
                                            {step.icon}
                                        </div>
                                        <div className="flex-1">
                                            <h4 className={`text-[15px] font-bold transition-colors ${isActive ? 'text-[#1A1A1A]' : 'text-[#787774]'}`}>{step.title}</h4>
                                            <p className="text-[13px] text-[#787774] mt-1.5 leading-relaxed font-medium">{step.desc}</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-8 pt-8 border-t border-[#E9E9E7]">
                        <button
                            onClick={onClose}
                            className="w-full py-4 bg-[#1A1A1A] text-white text-[15px] font-bold rounded-2xl hover:bg-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-black/5"
                        >
                            Tôi đã hiểu
                            <CheckCircle2 className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Right Simulation Panel */}
                <div className="flex-1 bg-[#F7F6F3] relative overflow-hidden flex items-center justify-center p-6 md:p-12">
                    <div className="relative z-10 w-full max-w-[650px] aspect-[4/3] bg-white rounded-3xl shadow-2xl border border-[#E9E9E7] overflow-hidden flex flex-col">
                        <SimulatedAppView scene={activeScene} />
                    </div>
                    {/* Decorative Elements */}
                    <div className="absolute top-0 right-0 w-80 h-80 bg-[#EEF0FB] rounded-full blur-[100px] opacity-60 -mr-40 -mt-40" />
                    <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#FFF3E8] rounded-full blur-[100px] opacity-60 -ml-40 -mb-40" />
                </div>

                <button
                    onClick={onClose}
                    className="absolute top-8 right-8 p-2.5 h-12 w-12 flex items-center justify-center hover:bg-[#EBEBEA] rounded-full transition-colors z-[70]"
                >
                    <X className="w-6 h-6 text-[#787774]" />
                </button>
            </div>
        </div>
    );
};

const SimulatedAppView: React.FC<{ scene: number }> = ({ scene }) => {
    return (
        <div className="w-full h-full flex flex-col overflow-hidden font-sans bg-[#F7F6F3]">
            {/* Header */}
            <div className="h-12 bg-white border-b border-[#E9E9E7] flex items-center px-6 justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#E9E9E7]" />
                        <div className="w-2.5 h-2.5 rounded-full bg-[#E9E9E7]" />
                        <div className="w-2.5 h-2.5 rounded-full bg-[#E9E9E7]" />
                    </div>
                </div>
                <div className="h-2.5 w-32 bg-[#F1F0EC] rounded-full" />
                <div className="flex items-center gap-4">
                    <div className="w-5 h-5 rounded-lg bg-[#6B7CDB]/10 border border-[#6B7CDB]/20" />
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar */}
                <div className="w-32 md:w-40 bg-[#F1F0EC] border-r border-[#E9E9E7] h-full p-5 space-y-4 shrink-0">
                    <div className="h-5 w-full bg-white rounded-lg shadow-sm border border-[#E9E9E7] mb-6" />
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="flex items-center gap-3">
                            <div className="w-4 h-4 rounded-md bg-[#E9E9E7]" />
                            <div className="h-1.5 w-full bg-[#E9E9E7] rounded-full" />
                        </div>
                    ))}
                    <div className={`mt-auto p-3 rounded-xl transition-all flex items-center gap-3 shadow-sm ${scene === 2 ? 'bg-[#1A1A1A] ring-4 ring-[#1A1A1A]/10' : 'bg-white border border-[#E9E9E7]'}`}>
                        <Settings className={`w-4 h-4 ${scene === 2 ? 'text-white' : 'text-[#787774]'}`} />
                        <div className={`h-1.5 w-full rounded-full ${scene === 2 ? 'bg-white/40' : 'bg-[#F1F0EC]'}`} />
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 p-8 relative flex flex-col">
                    <div className="space-y-3 mb-8">
                        <div className="h-6 w-40 bg-[#1A1A1A]/10 rounded-lg" />
                        <div className="h-2.5 w-64 bg-[#AEACA8]/20 rounded-full" />
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        {[1, 2].map(i => (
                            <div key={i} className="bg-white p-6 rounded-2xl border border-[#E9E9E7] shadow-sm space-y-4">
                                <div className="h-10 w-10 bg-[#F1F0EC] rounded-xl" />
                                <div className="space-y-2">
                                    <div className="h-2 w-full bg-[#F1F0EC] rounded-full" />
                                    <div className="h-2 w-2/3 bg-[#F1F0EC] rounded-full" />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Step-specific Overlays */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">

                        {/* SCENE 1: CHATBOT ICON CLICK */}
                        {scene === 0 && (
                            <div className="absolute bottom-8 right-8 flex flex-col items-center gap-4 animate-bounce">
                                <div className="w-16 h-16 bg-[#1A1A1A] rounded-2xl shadow-2xl flex items-center justify-center ring-[6px] ring-white">
                                    <MessageCircle className="w-8 h-8 text-white" />
                                </div>
                                <div className="px-4 py-2 bg-white rounded-xl shadow-xl border border-[#E9E9E7] text-xs font-bold text-[#1A1A1A] whitespace-nowrap">
                                    CLICK VÀO ĐÂY
                                </div>
                            </div>
                        )}

                        {/* SCENE 2: REALISTIC CHAT INTERFACE */}
                        {scene === 1 && (
                            <div className="absolute bottom-10 right-10 w-[350px] bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden border border-orange-500/20 animate-scale-in flex flex-col pointer-events-auto">
                                {/* Chat Header */}
                                <div className="p-4 border-b-2 border-orange-500 flex items-center justify-between bg-white">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-2xl bg-[#FFF3E8] flex items-center justify-center border border-orange-100">
                                            <Bot className="w-5 h-5 text-orange-600" />
                                        </div>
                                        <div>
                                            <div className="font-bold text-sm text-slate-800">PhysiVault AI</div>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <div className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20 animate-pulse" />
                                                <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Đang trực tuyến</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                </div>

                                {/* Chat Body */}
                                <div className="p-5 h-[280px] bg-slate-50/50 space-y-5 overflow-y-auto">
                                    <div className="flex gap-3">
                                        <div className="w-7 h-7 rounded-lg bg-[#FFF3E8] flex items-center justify-center shrink-0 border border-orange-100">
                                            <Bot className="w-4 h-4 text-orange-500" />
                                        </div>
                                        <div className="bg-white border border-slate-100 p-3.5 rounded-2xl rounded-tl-none shadow-sm max-w-[85%] text-[13px] text-slate-700 leading-relaxed font-medium">
                                            Chào bạn! Mình là trợ lý PhysiVault. Cần mình giúp gì cho bạn hôm nay?
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-end gap-1.5">
                                        <div className="bg-[#1A1A1A] text-white p-3 px-4 rounded-2xl rounded-tr-none shadow-md text-[13px] font-medium animate-slide-up">
                                            09xx-xxx-xxx
                                        </div>
                                    </div>

                                    <div className="flex gap-3 animate-slide-up">
                                        <div className="w-7 h-7 rounded-lg bg-[#FFF3E8] flex items-center justify-center shrink-0 border border-orange-100">
                                            <Bot className="w-4 h-4 text-orange-500" />
                                        </div>
                                        <div className="space-y-3 max-w-[85%]">
                                            <div className="bg-white border border-slate-100 p-3.5 rounded-2xl rounded-tl-none shadow-sm text-[13px] text-slate-700 leading-relaxed font-medium">
                                                Bot đã nhận diện SĐT. Đây là mã kích hoạt của bạn:
                                            </div>
                                            <div className="bg-[#EEF0FB] p-4 rounded-2xl border-2 border-[#6B7CDB]/30 shadow-inner flex flex-col items-center gap-2 group cursor-copy hover:border-[#6B7CDB] transition-all">
                                                <div className="text-[10px] font-bold text-[#6B7CDB] uppercase tracking-[0.2em] opacity-80">MÃ CỦA BẠN</div>
                                                <div className="text-[18px] font-mono font-black text-[#6B7CDB] tracking-widest">PV-8X2A-9M3L</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Chat Input Area */}
                                <div className="p-4 bg-white border-t border-slate-100">
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 h-11 bg-slate-50 rounded-xl border border-orange-500 px-4 flex items-center justify-between text-[13px] text-slate-400 font-medium">
                                            <span>Nhập số điện thoại...</span>
                                        </div>
                                        <div className="w-11 h-11 bg-orange-600 rounded-xl shadow-lg shadow-orange-200 flex items-center justify-center">
                                            <Send className="w-5 h-5 text-white" />
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center mt-3 px-2">
                                        <div className="flex items-center gap-1.5 opacity-40">
                                            <RefreshCw className="w-3 h-3" />
                                            <span className="text-[9px] font-bold uppercase tracking-wider">Tự động 24/7</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 opacity-40">
                                            <Lock className="w-3 h-3" />
                                            <span className="text-[9px] font-bold uppercase tracking-wider">Chặn dùng chung</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* SCENE 3: SETTINGS MODAL ACTIVATION */}
                        {scene === 2 && (
                            <div className="absolute inset-0 bg-white/60 backdrop-blur-[4px] flex items-center justify-center p-8 z-[30]">
                                <div className="w-full max-w-[380px] bg-white rounded-[40px] border border-orange-500/20 shadow-[0_30px_60px_-12px_rgba(0,0,0,0.15)] p-8 animate-scale-in flex flex-col gap-6">
                                    <div className="flex items-center justify-between border-b border-[#F7F6F3] pb-5">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-slate-50 rounded-xl">
                                                <Settings className="w-5 h-5 text-slate-600" />
                                            </div>
                                            <div className="h-2.5 w-32 bg-[#1A1A1A] rounded-full" />
                                        </div>
                                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                                            <X className="w-4 h-4 text-slate-400" />
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <div className="h-1.5 w-24 bg-[#AEACA8] rounded-full ml-1" />
                                            <div className="h-12 w-full bg-[#F7F6F3] rounded-2xl border border-[#E9E9E7] flex items-center px-5">
                                                <div className="text-[13px] font-medium text-slate-400">09xx-xxx-xxx</div>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="h-1.5 w-32 bg-[#AEACA8] rounded-full ml-1" />
                                            <div className="h-12 w-full bg-white rounded-2xl border-2 border-orange-500 flex items-center px-5 shadow-[0_10px_20px_-5px_rgba(249,115,22,0.2)]">
                                                <div className="text-[15px] font-mono font-black text-orange-600 tracking-widest uppercase">PV-8X2A-9M3L</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="w-full py-4.5 bg-orange-600 rounded-2xl text-[14px] text-white font-bold text-center tracking-[0.1em] shadow-xl shadow-orange-200 active:scale-95 transition-all">
                                        MỞ KHÓA NGAY
                                    </div>

                                    <div className="flex items-center justify-center gap-2 opacity-30 mt-1">
                                        <Monitor className="w-3.5 h-3.5" />
                                        <div className="h-1 w-20 bg-slate-400 rounded-full" />
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
