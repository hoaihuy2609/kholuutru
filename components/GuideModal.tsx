import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, Settings, ShieldCheck, ChevronRight, MessageCircle, Bot, Send, RefreshCw, Lock, User, Copy, Monitor, Key, Upload, Phone, ShieldAlert, KeyRound, Unlock, LayoutDashboard } from 'lucide-react';

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
            icon: <MessageCircle className="w-5 h-5" />
        },
        {
            title: "Bước 2: Nhận mã kích hoạt",
            desc: "Nhập SĐT của bạn, Bot sẽ tự động cấp mã PV duy nhất cho tài khoản.",
            icon: <Bot className="w-5 h-5" />
        },
        {
            title: "Bước 3: Mở khóa hệ thống",
            desc: "Vào Cài đặt, nhập SĐT và dán mã PV-... để truy cập toàn bộ tài liệu.",
            icon: <ShieldCheck className="w-5 h-5" />
        }
    ];

    useEffect(() => {
        if (!isOpen || !isPlaying) return;
        const timer = setInterval(() => {
            setActiveScene(prev => (prev + 1) % activationSteps.length);
        }, 7000);
        return () => clearInterval(timer);
    }, [isOpen, isPlaying, activationSteps.length]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in text-sans">
            <div
                className="bg-white rounded-[12px] shadow-2xl w-full max-w-6xl overflow-hidden animate-scale-in border border-[#E9E9E7] flex flex-col h-[90vh] md:h-[720px]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Unified Header matching SettingsModal style */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E9E9E7] bg-white shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-[#FFF3E8] rounded-lg">
                            <ShieldCheck className="w-4 h-4 text-[#D9730D]" />
                        </div>
                        <h3 className="font-semibold text-base text-[#1A1A1A]">Hướng dẫn kích hoạt & Mở khóa Hệ thống</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-md hover:bg-[#F1F0EC] transition-colors text-[#787774]"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                    {/* Left Sidebar matching App Sidebar style */}
                    <div className="w-full md:w-[320px] bg-[#F1F0EC] border-r border-[#E9E9E7] flex flex-col shrink-0">
                        <div className="p-6 space-y-3 flex-1 overflow-y-auto custom-scrollbar">
                            {activationSteps.map((step, idx) => {
                                const isActive = activeScene === idx;
                                return (
                                    <div
                                        key={idx}
                                        onClick={() => { setActiveScene(idx); setIsPlaying(false); }}
                                        className={`group relative p-4 rounded-xl transition-all duration-200 cursor-pointer ${isActive
                                            ? 'bg-white shadow-sm translate-x-1'
                                            : 'hover:bg-white/40'
                                            }`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`p-2 rounded-lg transition-colors ${isActive ? 'bg-[#FFF3E8] text-[#D9730D]' : 'bg-white/60 text-[#AEACA8]'}`}>
                                                {step.icon}
                                            </div>
                                            <div className="flex-1 overflow-hidden">
                                                <h4 className={`text-sm font-bold truncate transition-colors ${isActive ? 'text-[#1A1A1A]' : 'text-[#787774]'}`}>{step.title}</h4>
                                                {isActive && (
                                                    <p className="text-[12px] text-[#787774] mt-1 leading-relaxed animate-fade-in font-medium">
                                                        {step.desc}
                                                    </p>
                                                )}
                                            </div>
                                            {isActive && <ChevronRight className="w-4 h-4 text-[#D9730D] shrink-0" />}
                                        </div>
                                        {isActive && (
                                            <div className="absolute left-0 top-3 bottom-3 w-1 bg-[#D9730D] rounded-full" />
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Sidebar Footer */}
                        <div className="p-6 border-t border-[#E9E9E7]/60">
                            <button
                                onClick={onClose}
                                className="w-full py-3 bg-[#1A1A1A] text-white text-sm font-bold rounded-xl hover:bg-black transition-all flex items-center justify-center gap-2 shadow-sm active:scale-[0.98]"
                            >
                                Tôi đã hiểu
                                <CheckCircle2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Right Simulation Panel */}
                    <div className="flex-1 bg-[#F7F6F3] relative overflow-hidden flex items-center justify-center p-6 md:p-12">
                        <div className="relative z-10 w-full max-w-[680px] aspect-[16/10] bg-white rounded-[12px] shadow-xl border border-[#E9E9E7] overflow-hidden flex flex-col">
                            <SimulatedAppView scene={activeScene} />
                        </div>
                        {/* Decorative background blur */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#6B7CDB]/5 rounded-full blur-[120px] pointer-events-none" />
                    </div>
                </div>
            </div>
        </div>
    );
};

const SimulatedAppView: React.FC<{ scene: number }> = ({ scene }) => {
    return (
        <div className="w-full h-full flex flex-col overflow-hidden font-sans bg-[#FAFAF9]">
            {/* Browser Header */}
            <div className="h-10 bg-white border-b border-[#E9E9E7] flex items-center px-4 justify-between shrink-0">
                <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
                </div>
                <div className="h-5 w-48 bg-[#F1F0EC] rounded-md border border-[#E9E9E7] flex items-center px-2">
                    <div className="w-3 h-3 bg-[#AEACA8]/20 rounded shrink-0" />
                    <div className="ml-2 h-1.5 w-full bg-[#AEACA8]/10 rounded-full" />
                </div>
                <div className="w-8 h-8 rounded-full bg-[#F1F0EC]" />
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar Mockup */}
                <div className="w-32 bg-[#F1F0EC] border-r border-[#E9E9E7] h-full p-4 space-y-4 shrink-0">
                    <div className="h-4 w-full bg-white rounded shadow-sm border border-[#E9E9E7] mb-4" />
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-md bg-[#DDE2F7]" />
                            <div className="h-1 w-full bg-[#DDE2F7]/50 rounded-full" />
                        </div>
                    ))}
                    <div className={`mt-auto p-2 rounded-lg flex items-center gap-2 transition-all ${scene === 2 ? 'bg-[#1A1A1A] text-white shadow-md ring-2 ring-[#1A1A1A]/10' : 'bg-white border border-[#E9E9E7] text-[#787774]'}`}>
                        <Settings className="w-3.5 h-3.5" />
                        <div className={`h-1 w-full rounded-full ${scene === 2 ? 'bg-white/40' : 'bg-[#F1F0EC]'}`} />
                    </div>
                </div>

                {/* Content Area Mockup */}
                <div className="flex-1 p-6 relative flex flex-col bg-white">
                    <div className="flex items-center justify-between mb-8">
                        <div className="space-y-2">
                            <div className="h-5 w-32 bg-[#1A1A1A]/80 rounded-md" />
                            <div className="h-1.5 w-48 bg-[#AEACA8]/30 rounded-full" />
                        </div>
                        <div className="flex gap-2">
                            <div className="w-8 h-8 rounded-lg bg-[#F7F6F3] border border-[#E9E9E7]" />
                            <div className="w-8 h-8 rounded-lg bg-[#F7F6F3] border border-[#E9E9E7]" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="p-4 rounded-xl border border-[#E9E9E7] bg-[#FAFAF9] space-y-3">
                                <div className="h-8 w-8 bg-white border border-[#E9E9E7] rounded-lg shadow-sm" />
                                <div className="space-y-1.5">
                                    <div className="h-1.5 w-full bg-[#E9E9E7] rounded-full" />
                                    <div className="h-1.5 w-2/3 bg-[#E9E9E7] rounded-full" />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Simulation Overlays */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                        {/* Scene 1: Chatbot click highlight */}
                        {scene === 0 && (
                            <div className="absolute bottom-6 right-6 flex flex-col items-center gap-3 animate-bounce">
                                <div className="w-14 h-14 bg-[#2D2D2D] rounded-full shadow-lg flex items-center justify-center border-4 border-white">
                                    <MessageCircle className="w-7 h-7 text-white" />
                                </div>
                                <div className="px-3 py-1.5 bg-white rounded-lg shadow-md border border-[#E9E9E7] text-[10px] font-black text-[#1A1A1A] uppercase tracking-wider">
                                    Nhấn để mở Bot
                                </div>
                            </div>
                        )}

                        {/* Scene 2: High-fidelity Chat Interface */}
                        {scene === 1 && (
                            <div className="absolute bottom-8 right-8 w-[320px] bg-white rounded-[12px] shadow-xl overflow-hidden border border-[#E9E9E7] animate-scale-in flex flex-col pointer-events-auto">
                                <div className="flex items-center gap-3 px-4 py-3 shrink-0" style={{ borderBottom: '1px solid #E9E9E7', borderTop: '3px solid #D9730D' }}>
                                    <div className="p-1.5 rounded-lg bg-[#FFF3E8]">
                                        <Bot className="w-3.5 h-3.5 text-[#D9730D]" />
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-bold text-[#1A1A1A]">PhysiVault AI</h4>
                                        <div className="flex items-center gap-1 mt-0.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                            <span className="text-[9px] text-[#787774]">Đang trực tuyến</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-4 h-[280px] bg-[#FAFAF9] space-y-3 overflow-y-auto custom-scrollbar">
                                    <div className="flex justify-start gap-2 max-w-[90%]">
                                        <div className="w-5 h-5 rounded-full bg-[#FFF3E8] text-[#D9730D] flex items-center justify-center shrink-0 mt-0.5">
                                            <Bot className="w-3 h-3" />
                                        </div>
                                        <div className="px-3 py-2 text-xs bg-white border border-[#E9E9E7] text-[#1A1A1A]" style={{ borderRadius: '2px 12px 12px 12px' }}>
                                            Chào bạn! Nhập SĐT để lấy mã nhé.
                                        </div>
                                    </div>
                                    <div className="flex justify-end gap-2 max-w-[90%] ml-auto">
                                        <div className="px-3 py-2 text-xs bg-[#2D2D2D] text-white" style={{ borderRadius: '12px 2px 12px 12px' }}>
                                            09xx-xxx-xxx
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-start gap-2 max-w-[90%]">
                                            <div className="w-5 h-5 rounded-full bg-[#FFF3E8] text-[#D9730D] flex items-center justify-center shrink-0 mt-0.5">
                                                <Bot className="w-3 h-3" />
                                            </div>
                                            <div className="px-3 py-2 text-xs bg-white border border-[#E9E9E7] text-[#1A1A1A]" style={{ borderRadius: '2px 12px 12px 12px' }}>
                                                Mã kích hoạt của bạn là:
                                            </div>
                                        </div>
                                        <div className="flex justify-start gap-2 max-w-[90%]">
                                            <div className="w-5 h-5 rounded-full bg-[#FFF3E8] text-[#D9730D] flex items-center justify-center shrink-0 mt-0.5">
                                                <Bot className="w-3 h-3" />
                                            </div>
                                            <div className="px-3 py-2 text-xs bg-white border-2 border-[#D9730D] text-[#1A1A1A] flex items-center gap-2 font-mono font-bold" style={{ borderRadius: '2px 12px 12px 12px' }}>
                                                PV-XXXX-XXXX-XXXX
                                                <Copy className="w-3 h-3 text-[#AEACA8]" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-3 bg-white border-t border-[#E9E9E7]">
                                    <div className="h-9 bg-[#F7F6F3] border border-[#E9E9E7] rounded-lg px-3 flex items-center text-xs text-[#AEACA8]">
                                        Nhập SĐT...
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Scene 3: PIXEL-PERFECT SETTINGSMODAL REPLICA */}
                        {scene === 2 && (
                            <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px] flex items-center justify-center p-4 z-[30]">
                                <div className="w-full max-w-[480px] bg-white rounded-[12px] shadow-2xl border border-[#E9E9E7] overflow-hidden animate-scale-in flex flex-col pointer-events-auto">
                                    {/* Modal Header */}
                                    <div className="px-5 py-3.5 border-b border-[#E9E9E7] flex items-center justify-between bg-white">
                                        <h3 className="font-semibold text-sm text-[#1A1A1A]">Cài đặt & Bảo mật Hệ thống</h3>
                                        <X className="w-3.5 h-3.5 text-[#787774]" />
                                    </div>

                                    {/* Modal Body */}
                                    <div className="p-5 space-y-4 max-h-[380px] overflow-y-auto custom-scrollbar">
                                        {/* Quyền truy cập Section */}
                                        <div className="border border-[#E9E9E7] rounded-xl overflow-hidden">
                                            <div className="flex items-center justify-between px-4 py-3 border-b border-[#E9E9E7]">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-[#F1F0EC] rounded-lg">
                                                        <Lock className="w-4 h-4 text-[#787774]" />
                                                    </div>
                                                    <div>
                                                        <div className="text-[9px] uppercase font-bold tracking-wider text-[#AEACA8]">Quyền truy cập</div>
                                                        <div className="text-xs font-bold text-[#1A1A1A]">Chế độ Học sinh</div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-[#E9E9E7] bg-[#F1F0EC] text-[#57564F]">
                                                    <KeyRound className="w-3 h-3" /> Mở khóa Admin
                                                </div>
                                            </div>
                                            <div className="px-4 py-3 bg-[#FAFAF9]">
                                                <p className="text-[11px] text-[#787774] leading-relaxed">
                                                    Tính năng nạp dữ liệu bị hạn chế cho đến khi bạn nhập mã kích hoạt.
                                                </p>
                                            </div>
                                        </div>

                                        {/* Activation Section (THE FOCUS) */}
                                        <div className="border border-[#E9E9E7] rounded-xl overflow-hidden">
                                            <div className="flex items-center gap-3 px-4 py-3 border-b border-[#E9E9E7] border-l-[3px] border-l-[#D9730D]">
                                                <div className="p-1.5 bg-[#FFF3E8] rounded-lg">
                                                    <KeyRound className="w-4 h-4 text-[#D9730D]" />
                                                </div>
                                                <div>
                                                    <h4 className="text-xs font-bold text-[#1A1A1A]">Kích hoạt tài khoản</h4>
                                                    <p className="text-[10px] text-[#787774] mt-0.5 font-medium">
                                                        Dán mã kích hoạt nhận từ <span className="text-[#D9730D] font-bold">Bot PhysiVault</span>
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="p-4 space-y-3 bg-[#FAFAF9]">
                                                <div className="relative">
                                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#AEACA8]" />
                                                    <div className="w-full h-10 bg-white border border-[#E9E9E7] rounded-lg flex items-center pl-9 pr-4 text-[12px] text-[#AEACA8] font-medium">
                                                        Nhập Số điện thoại của bạn
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <div className="relative flex-1">
                                                        <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#AEACA8]" />
                                                        <div className="w-full h-10 bg-white border-2 border-[#3366FF] rounded-lg flex items-center pl-9 pr-4 shadow-[0_4px_16px_rgba(51,102,255,0.2)] animate-pulse-slow">
                                                            <div className="text-[13px] font-mono font-black text-[#3366FF] tracking-wider">PV-XXXX-XXXX-XXXX</div>
                                                        </div>
                                                    </div>
                                                    <div className="px-4 h-10 bg-[#D9730D] text-white rounded-lg flex items-center font-bold text-xs shadow-md">
                                                        Mở khóa
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between text-[9px] text-[#AEACA8] font-bold uppercase tracking-wider">
                                                    <div className="flex items-center gap-1"><Monitor className="w-3 h-3" /> ID: 89C3-7DB0-0D28</div>
                                                    <span className="italic font-medium normal-case text-[#D9730D]/60">* Nhập đúng SĐT để khớp mã</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Import Section (Locked) */}
                                        <div className="space-y-2">
                                            <h4 className="text-[11px] font-bold flex items-center gap-2 text-[#1A1A1A]">
                                                <Upload className="w-3.5 h-3.5 text-[#9065B0]" /> Nhập học liệu mới
                                            </h4>
                                            <div className="p-4 border-2 border-dashed border-[#E9E9E7] rounded-xl flex flex-col items-center gap-2 opacity-50 bg-[#FAFAF9]">
                                                <Lock className="w-5 h-5 text-[#AEACA8] opacity-30" />
                                                <div className="text-center">
                                                    <p className="text-[10px] font-bold text-[#787774]">Chức năng đang bị khóa</p>
                                                    <p className="text-[9px] text-[#AEACA8]">Kích hoạt mã để nạp bài giảng.</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Note Box */}
                                        <div className="flex gap-3 items-start px-4 py-3 bg-[#F7F6F3] border border-[#E9E9E7] rounded-xl">
                                            <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#AEACA8]" />
                                            <p className="text-[11px] leading-relaxed text-[#787774] font-medium">
                                                Hệ thống cần được kích hoạt bằng mã duy nhất để đảm bảo quyền truy cập chính thức.
                                            </p>
                                        </div>
                                    </div>

                                    {/* Footer */}
                                    <div className="px-5 py-3 border-t border-[#E9E9E7] text-center bg-white">
                                        <span className="text-xs text-[#AEACA8] font-bold hover:text-[#1A1A1A] transition-colors cursor-pointer">Quay lại trang chủ</span>
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
