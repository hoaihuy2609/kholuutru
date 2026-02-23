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
            icon: <MessageCircle className="w-5 h-5 text-[#1A1A1A]" />
        },
        {
            title: "Bước 2: Nhận mã kích hoạt",
            desc: "Nhập SĐT của bạn, Bot sẽ tự động cấp mã PV duy nhất cho tài khoản.",
            icon: <Bot className="w-5 h-5 text-[#6B7CDB]" />
        },
        {
            title: "Bước 3: Mở khóa hệ thống",
            desc: "Vào Cài đặt, nhập SĐT và dán mã PV-... để truy cập toàn bộ tài liệu.",
            icon: <ShieldCheck className="w-5 h-5 text-[#D9730D]" />
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
                                    className={`group p-5 rounded-2xl transition-all duration-300 cursor-pointer border-l-4 ${isActive
                                        ? 'bg-white shadow-md border-[#D9730D]'
                                        : 'bg-transparent border-transparent hover:bg-white/40'
                                        }`}
                                >
                                    <div className="flex items-start gap-5">
                                        <div className={`mt-0.5 transition-all duration-500 ${isActive ? 'scale-110 opacity-100' : 'opacity-40 scale-100'}`}>
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
                    <div className="relative z-10 w-full max-w-[650px] aspect-[4/3] bg-white rounded-[40px] shadow-2xl border border-[#E9E9E7] overflow-hidden flex flex-col">
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
            {/* Browser Header */}
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

                    {/* Step Overlays */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">

                        {/* SCENE 1: BLACK CHATBOT ICON CLICK */}
                        {scene === 0 && (
                            <div className="absolute bottom-8 right-8 flex flex-col items-center gap-4 animate-bounce">
                                <div className="w-16 h-16 bg-[#2D2D2D] rounded-full shadow-2xl flex items-center justify-center ring-[6px] ring-white">
                                    <MessageCircle className="w-8 h-8 text-white" />
                                </div>
                                <div className="px-4 py-2 bg-white rounded-xl shadow-xl border border-[#E9E9E7] text-xs font-bold text-[#1A1A1A] whitespace-nowrap">
                                    CLICK VÀO ĐÂY
                                </div>
                            </div>
                        )}

                        {/* SCENE 2: REALISTIC CHAT INTERFACE */}
                        {scene === 1 && (
                            <div className="absolute bottom-10 right-10 w-[340px] bg-white rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] overflow-hidden border border-[#E9E9E7] animate-scale-in flex flex-col pointer-events-auto">
                                <div className="flex items-center gap-3 px-4 py-3 shrink-0" style={{ borderBottom: '1px solid #E9E9E7', borderTop: '3px solid #D9730D' }}>
                                    <div className="p-2 rounded-lg" style={{ background: '#FFF3E8' }}>
                                        <Bot className="w-4 h-4" style={{ color: '#D9730D' }} />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>PhysiVault AI</h4>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                            <span className="text-[10px]" style={{ color: '#787774' }}>Đang trực tuyến</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 h-[320px] bg-[#FAFAF9] space-y-4 overflow-y-auto">
                                    <div className="flex justify-start gap-2 max-w-[90%]">
                                        <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 bg-[#FFF3E8] text-[#D9730D]">
                                            <Bot className="w-3.5 h-3.5" />
                                        </div>
                                        <div className="px-3 py-2 text-sm leading-relaxed bg-white border border-[#E9E9E7] text-[#1A1A1A]" style={{ borderRadius: '2px 12px 12px 12px' }}>
                                            Chào bạn! Mình là trợ lý PhysiVault. Cần mình giúp gì cho bạn hôm nay?
                                        </div>
                                    </div>

                                    <div className="flex justify-end gap-2 max-w-[90%] ml-auto animate-slide-up">
                                        <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 bg-[#EEF0FB] text-[#6B7CDB]">
                                            <User className="w-3.5 h-3.5" />
                                        </div>
                                        <div className="px-3 py-2 text-sm leading-relaxed bg-[#2D2D2D] text-white" style={{ borderRadius: '12px 2px 12px 12px' }}>
                                            09xx-xxx-xxx
                                        </div>
                                    </div>

                                    <div className="space-y-3 animate-slide-up delay-100">
                                        <div className="flex justify-start gap-2 max-w-[90%]">
                                            <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 bg-[#FFF3E8] text-[#D9730D]">
                                                <Bot className="w-3.5 h-3.5" />
                                            </div>
                                            <div className="px-3 py-2 text-sm leading-relaxed bg-white border border-[#E9E9E7] text-[#1A1A1A]" style={{ borderRadius: '2px 12px 12px 12px' }}>
                                                Xác thực thành công! Mã kích hoạt của bạn là:
                                            </div>
                                        </div>
                                        <div className="flex justify-start gap-2 max-w-[90%]">
                                            <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 bg-[#FFF3E8] text-[#D9730D]">
                                                <Bot className="w-3.5 h-3.5" />
                                            </div>
                                            <div className="px-3 py-2 text-sm leading-relaxed bg-white border border-[#E9E9E7] text-[#1A1A1A] flex items-center gap-2" style={{ borderRadius: '2px 12px 12px 12px' }}>
                                                <code className="font-mono font-bold tracking-wider">PV-XXXX-XXXX-XXXX</code>
                                                <Copy className="w-3.5 h-3.5 text-[#AEACA8]" />
                                            </div>
                                        </div>
                                        <div className="flex justify-start gap-2 max-w-[90%]">
                                            <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 bg-[#FFF3E8] text-[#D9730D]">
                                                <Bot className="w-3.5 h-3.5" />
                                            </div>
                                            <div className="px-3 py-2 text-sm leading-relaxed bg-white border border-[#E9E9E7] text-[#1A1A1A]" style={{ borderRadius: '2px 12px 12px 12px' }}>
                                                Bạn hãy copy mã này và dán vào phần "Mở khóa học viên" trong Cài đặt nhé.
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-3 bg-white" style={{ borderTop: '1px solid #E9E9E7' }}>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 text-sm p-2 px-3 bg-[#F7F6F3] border border-[#E9E9E7] rounded-lg text-[#AEACA8]">
                                            Nhập số điện thoại...
                                        </div>
                                        <div className="p-2.5 rounded-lg text-white bg-[#D9730D]">
                                            <Send className="w-4 h-4" />
                                        </div>
                                    </div>
                                    <div className="mt-2 flex items-center justify-center gap-4 text-[10px] text-[#AEACA8]">
                                        <span className="flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Tự động 24/7</span>
                                        <span className="flex items-center gap-1"><Bot className="w-3 h-3" /> Chặn dùng chung</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* SCENE 3: PIXEL-PERFECT SETTINGS MODAL MATCHING ACTUAL UI */}
                        {scene === 2 && (
                            <div className="absolute inset-0 bg-[#00000040] backdrop-blur-[4px] flex items-center justify-center p-6 z-[30]">
                                <div className="w-full max-w-[580px] bg-white rounded-[12px] shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-[#E9E9E7] overflow-hidden animate-scale-in flex flex-col pointer-events-auto">
                                    {/* Modal Header matches SettingsModal.tsx lines 161-178 */}
                                    <div className="px-5 py-3.5 border-b border-[#E9E9E7] flex items-center justify-between">
                                        <h3 className="font-semibold text-base text-[#1A1A1A]">Cài đặt & Bảo mật Hệ thống</h3>
                                        <X className="w-4 h-4 text-[#787774]" />
                                    </div>

                                    {/* Modal Body matches SettingsModal.tsx lines 181-652 */}
                                    <div className="p-5 space-y-4 max-h-[500px] overflow-y-auto">

                                        {/* Quyền truy cập Card (Simplified as student mode) */}
                                        <div className="border border-[#E9E9E7] rounded-xl overflow-hidden">
                                            <div className="flex items-center justify-between px-4 py-3 border-b border-[#E9E9E7]">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-[#F1F0EC] rounded-lg">
                                                        <Lock className="w-4 h-4 text-[#787774]" />
                                                    </div>
                                                    <div>
                                                        <div className="text-[10px] uppercase font-semibold tracking-wider text-[#AEACA8]">Quyền truy cập</div>
                                                        <div className="text-sm font-semibold text-[#1A1A1A]">Chế độ Học sinh</div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-[#E9E9E7] bg-[#F1F0EC] text-[#57564F]">
                                                    <KeyRound className="w-3.5 h-3.5" /> Mở khóa Admin
                                                </div>
                                            </div>
                                            <div className="px-4 py-3 bg-[#FAFAF9]">
                                                <p className="text-xs text-[#787774] leading-relaxed">
                                                    Bạn đang ở chế độ Học sinh: Các tính năng nạp dữ liệu sẽ bị hạn chế cho đến khi bạn nhập mã kích hoạt.
                                                </p>
                                            </div>
                                        </div>

                                        {/* Activation Section (THE FOCUS OF THIS STEP) */}
                                        <div className="border border-[#E9E9E7] rounded-xl overflow-hidden">
                                            <div className="flex items-center gap-3 px-4 py-3 border-b border-[#E9E9E7] border-l-[3px] border-l-[#D9730D]">
                                                <div className="p-2 bg-[#FFF3E8] rounded-lg">
                                                    <KeyRound className="w-4 h-4 text-[#D9730D]" />
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-semibold text-[#1A1A1A]">Kích hoạt tài khoản</h4>
                                                    <p className="text-xs text-[#787774] mt-0.5">
                                                        Dán mã kích hoạt nhận từ <span className="text-[#D9730D] font-bold">Bot PhysiVault</span> để bắt đầu học.
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="p-4 space-y-3 bg-[#FAFAF9]">
                                                {/* Phone input */}
                                                <div className="relative">
                                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#AEACA8]" />
                                                    <div className="w-full h-10 bg-white border border-[#E9E9E7] rounded-lg flex items-center pl-9 pr-4 text-[13px] text-[#AEACA8]">
                                                        Nhập Số điện thoại của bạn
                                                    </div>
                                                </div>
                                                {/* Key input with ORANGE BORDER focus style */}
                                                <div className="flex gap-2">
                                                    <div className="relative flex-1">
                                                        <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#AEACA8]" />
                                                        <div className="w-full h-10 bg-white border-2 border-[#3366FF] rounded-lg flex items-center pl-9 pr-4 shadow-[0_4px_20px_rgba(51,102,255,0.25)] animate-pulse-slow">
                                                            <div className="text-[14px] font-mono font-bold text-[#3366FF] tracking-wider">PV-XXXX-XXXX-XXXX</div>
                                                        </div>
                                                    </div>
                                                    <div className="px-5 h-10 bg-[#D9730D] text-white rounded-lg flex items-center font-semibold text-sm">
                                                        Mở khóa
                                                    </div>
                                                </div>
                                                {/* Footer metadata */}
                                                <div className="flex items-center justify-between text-[10px] text-[#AEACA8]">
                                                    <div className="flex items-center gap-1.5 font-mono">
                                                        <Monitor className="w-3 h-3" /> ID: 89C3-7DB0-0D28
                                                    </div>
                                                    <span className="italic">* Nhập đúng SĐT để khớp với mã kích hoạt</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Import Section (Locked) */}
                                        <div className="space-y-2">
                                            <h4 className="text-sm font-semibold flex items-center gap-2 text-[#1A1A1A]">
                                                <Upload className="w-4 h-4 text-[#9065B0]" /> Nhập học liệu mới
                                            </h4>
                                            <div className="p-5 border-2 border-dashed border-[#E9E9E7] rounded-lg flex flex-col items-center gap-2 opacity-50">
                                                <Lock className="w-5 h-5 text-[#AEACA8] opacity-40 ml-0.5" />
                                                <p className="text-xs font-medium text-[#787774]">Chức năng đang bị khóa</p>
                                                <p className="text-[10px] text-[#AEACA8]">Vui lòng kích hoạt mã ở phía trên để nạp bài giảng.</p>
                                            </div>
                                        </div>

                                        {/* Note Box */}
                                        <div className="flex gap-3 items-start px-4 py-3 bg-[#F7F6F3] border border-[#E9E9E7] rounded-lg mt-2">
                                            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-[#AEACA8]" />
                                            <p className="text-xs leading-relaxed text-[#787774]">
                                                Lưu ý cho Học sinh: Hệ thống cần được kích hoạt bằng mã duy nhất cho máy này để đảm bảo quyền truy cập học liệu chính thức.
                                            </p>
                                        </div>
                                    </div>

                                    {/* Footer matches SettingsModal.tsx line 655-668 */}
                                    <div className="px-5 py-3 border-t border-[#E9E9E7] text-center">
                                        <span className="text-sm text-[#787774] font-medium">Quay lại trang chủ</span>
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
