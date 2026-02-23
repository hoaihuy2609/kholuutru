import React, { useState } from 'react';
import {
    X, CheckCircle2, Settings, ShieldCheck, ChevronRight, ChevronLeft,
    MessageCircle, Bot, Send, Copy, Check, User, Phone,
    KeyRound, ShieldAlert, Monitor, Unlock, Upload, Lock
} from 'lucide-react';

interface GuideModalProps {
    isOpen: boolean;
    onClose: () => void;
    isAdmin: boolean;
}

// ── Step definitions ──────────────────────────────────────────────────────────
const steps = [
    {
        id: 1,
        label: 'Mở trợ lý AI',
        shortDesc: 'Nhấn nút chatbot ở góc màn hình',
        icon: MessageCircle,
        color: '#D9730D',
        bg: '#FFF3E8',
    },
    {
        id: 2,
        label: 'Nhận mã kích hoạt',
        shortDesc: 'Nhập SĐT, Bot cấp mã PV duy nhất',
        icon: Bot,
        color: '#D9730D',
        bg: '#FFF3E8',
    },
    {
        id: 3,
        label: 'Nhập mã mở khóa',
        shortDesc: 'Vào Cài đặt, dán mã để mở khóa',
        icon: Settings,
        color: '#6B7CDB',
        bg: '#EEF0FB',
    },
    {
        id: 4,
        label: 'Nhập học liệu',
        shortDesc: 'Upload file bài giảng từ thầy',
        icon: Upload,
        color: '#9065B0',
        bg: '#F3ECF8',
    },
];

// ── Main Component ────────────────────────────────────────────────────────────
const GuideModal: React.FC<GuideModalProps> = ({ isOpen, onClose, isAdmin }) => {
    const [activeStep, setActiveStep] = useState(0); // 0-indexed

    if (!isOpen) return null;

    const isFirst = activeStep === 0;
    const isLast = activeStep === steps.length - 1;

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-3 md:p-4 bg-black/40 backdrop-blur-sm animate-fade-in font-sans"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-[14px] shadow-2xl w-full max-w-5xl overflow-hidden animate-scale-in border border-[#E9E9E7] flex flex-col"
                style={{ maxHeight: '92vh' }}
                onClick={e => e.stopPropagation()}
            >
                {/* ── Header ── */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E9E9E7] bg-white shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-[#FFF3E8] rounded-lg">
                            <ShieldCheck className="w-4 h-4 text-[#D9730D]" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-sm text-[#1A1A1A]">Hướng dẫn kích hoạt hệ thống</h3>
                            <p className="text-[11px] text-[#AEACA8] mt-0.5">Làm theo từng bước để mở khóa toàn bộ tài liệu</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-md hover:bg-[#F1F0EC] transition-colors text-[#787774]"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* ── Stepper Progress Bar ── */}
                <div className="px-5 py-4 bg-[#FAFAF9] border-b border-[#E9E9E7] shrink-0">
                    <div className="flex items-center gap-0">
                        {steps.map((step, idx) => {
                            const Icon = step.icon;
                            const isActive = idx === activeStep;
                            const isDone = idx < activeStep;
                            return (
                                <React.Fragment key={step.id}>
                                    {/* Step node */}
                                    <button
                                        onClick={() => setActiveStep(idx)}
                                        className="flex flex-col items-center gap-1.5 group focus:outline-none"
                                        style={{ minWidth: 0, flex: '0 0 auto' }}
                                    >
                                        <div
                                            className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 shrink-0"
                                            style={{
                                                background: isDone ? '#448361' : isActive ? step.color : '#F1F0EC',
                                                boxShadow: isActive ? `0 0 0 3px ${step.color}22` : 'none',
                                            }}
                                        >
                                            {isDone
                                                ? <Check className="w-4 h-4 text-white" />
                                                : <Icon className="w-4 h-4" style={{ color: isActive ? '#FFFFFF' : '#AEACA8' }} />
                                            }
                                        </div>
                                        <span
                                            className="text-[11px] font-semibold hidden sm:block max-w-[80px] text-center leading-tight"
                                            style={{ color: isActive ? step.color : isDone ? '#448361' : '#AEACA8' }}
                                        >
                                            {step.label}
                                        </span>
                                    </button>

                                    {/* Connector line */}
                                    {idx < steps.length - 1 && (
                                        <div className="flex-1 h-0.5 mx-2" style={{ background: idx < activeStep ? '#448361' : '#E9E9E7', minWidth: '20px' }} />
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>

                {/* ── Body: Two-column layout ── */}
                <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">

                    {/* Left: Description panel */}
                    <div className="w-full md:w-[280px] shrink-0 flex flex-col bg-white border-b md:border-b-0 md:border-r border-[#E9E9E7]">
                        <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
                            <StepDescription step={steps[activeStep]} stepIndex={activeStep} />
                        </div>

                        {/* Navigation buttons */}
                        <div className="p-5 border-t border-[#E9E9E7] space-y-2.5">
                            {isLast ? (
                                <button
                                    onClick={onClose}
                                    className="w-full py-3 bg-[#448361] text-white text-sm font-bold rounded-xl hover:bg-[#3a7055] transition-all flex items-center justify-center gap-2 shadow-sm active:scale-[0.98]"
                                >
                                    <CheckCircle2 className="w-4 h-4" />
                                    Tôi đã hiểu, bắt đầu thôi!
                                </button>
                            ) : (
                                <button
                                    onClick={() => setActiveStep(s => s + 1)}
                                    className="w-full py-3 text-white text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm active:scale-[0.98]"
                                    style={{ background: steps[activeStep].color }}
                                >
                                    Bước tiếp theo
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            )}
                            {!isFirst && (
                                <button
                                    onClick={() => setActiveStep(s => s - 1)}
                                    className="w-full py-2.5 text-sm font-medium rounded-xl transition-all flex items-center justify-center gap-2 text-[#787774] hover:bg-[#F1F0EC] active:scale-[0.98]"
                                >
                                    <ChevronLeft className="w-3.5 h-3.5" />
                                    Quay lại
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Right: Simulation panel */}
                    <div className="flex-1 bg-[#F7F6F3] relative overflow-hidden flex items-center justify-center p-4 md:p-10 min-h-[300px] md:min-h-0">
                        {/* Decorative blur */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#6B7CDB]/5 rounded-full blur-[100px] pointer-events-none" />

                        <div className="relative z-10 w-full max-w-[640px] bg-white rounded-[12px] shadow-xl border border-[#E9E9E7] overflow-hidden flex flex-col aspect-[16/10]">
                            <SimulationView stepIndex={activeStep} />
                        </div>

                        {/* Step badge */}
                        <div
                            className="absolute bottom-4 right-4 px-3 py-1.5 rounded-full text-[11px] font-bold"
                            style={{ background: steps[activeStep].bg, color: steps[activeStep].color }}
                        >
                            Bước {activeStep + 1} / {steps.length}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ── Step Description Left Panel ───────────────────────────────────────────────
const StepDescription: React.FC<{ step: typeof steps[0]; stepIndex: number }> = ({ step, stepIndex }) => {
    const Icon = step.icon;

    const descriptions: { title: string; bullets: string[] }[] = [
        {
            title: 'Mở trợ lý PhysiVault AI',
            bullets: [
                'Nhìn vào góc dưới bên phải màn hình',
                'Nhấn vào nút tròn màu đen có biểu tượng bong bóng chat',
                'Cửa sổ trợ lý AI sẽ hiện ra ngay lập tức',
            ],
        },
        {
            title: 'Nhập SĐT để nhận mã',
            bullets: [
                'Bot sẽ hỏi và bạn gõ số điện thoại đã đăng ký với thầy Huy',
                'Nhấn Enter hoặc nút gửi (mũi tên cam)',
                'Bot xác thực và trả về mã dạng PV-XXXX-XXXX-XXXX',
                'Nhấn nút Copy để sao chép mã vào clipboard',
            ],
        },
        {
            title: 'Dán mã vào Cài đặt',
            bullets: [
                'Nhấn vào "Settings & Sync" ở sidebar (hoặc icon ⚙ trên mobile)',
                'Nhập lại đúng số điện thoại của bạn vào ô SĐT',
                'Dán mã PV-... vào ô bên cạnh (Ctrl+V hoặc nhấn giữ để Paste)',
                'Nhấn nút cam "Mở khóa" để hoàn tất',
            ],
        },
        {
            title: 'Nhập học liệu từ thầy',
            bullets: [
                'Sau khi kích hoạt, mục "Nhập học liệu mới" sẽ được mở khóa',
                'Nhấn nút "Chọn file bài giảng từ thầy (.json)"',
                'Chọn file .json do thầy Huy cung cấp trên thiết bị của bạn',
                'Xác nhận để hệ thống tự động nạp toàn bộ bài giảng',
            ],
        },
    ];

    const desc = descriptions[stepIndex];

    return (
        <div className="animate-fade-in space-y-5">
            {/* Icon + Title */}
            <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl" style={{ background: step.bg }}>
                    <Icon className="w-5 h-5" style={{ color: step.color }} />
                </div>
                <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: step.color }}>
                        Bước {stepIndex + 1}
                    </div>
                    <h4 className="text-sm font-bold text-[#1A1A1A] leading-snug mt-0.5">
                        {desc.title}
                    </h4>
                </div>
            </div>

            {/* Bullets */}
            <div className="space-y-2.5">
                {desc.bullets.map((b, i) => (
                    <div key={i} className="flex items-start gap-3">
                        <div
                            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5"
                            style={{ background: step.bg, color: step.color }}
                        >
                            {i + 1}
                        </div>
                        <p className="text-[12.5px] text-[#57564F] leading-relaxed">{b}</p>
                    </div>
                ))}
            </div>

            {/* Tip box */}
            {stepIndex === 1 && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#FFF3E8] border border-[#D9730D]/20">
                    <ShieldAlert className="w-3.5 h-3.5 text-[#D9730D] shrink-0 mt-0.5" />
                    <p className="text-[11px] text-[#D9730D] leading-relaxed font-medium">
                        SĐT phải là số <strong>đã đăng ký với thầy Huy</strong>. Nếu chưa đăng ký, liên hệ thầy trước.
                    </p>
                </div>
            )}
            {stepIndex === 2 && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#EEF0FB] border border-[#6B7CDB]/20">
                    <ShieldAlert className="w-3.5 h-3.5 text-[#6B7CDB] shrink-0 mt-0.5" />
                    <p className="text-[11px] text-[#6B7CDB] leading-relaxed font-medium">
                        Nhập <strong>đúng SĐT</strong> như lúc nhắn Bot. Sai SĐT sẽ không khớp với mã PV.
                    </p>
                </div>
            )}
            {stepIndex === 3 && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#F3ECF8] border border-[#9065B0]/20">
                    <ShieldAlert className="w-3.5 h-3.5 text-[#9065B0] shrink-0 mt-0.5" />
                    <p className="text-[11px] text-[#9065B0] leading-relaxed font-medium">
                        File .json do <strong>thầy Huy cung cấp</strong> chứa toàn bộ bài giảng. Không tự tạo file này.
                    </p>
                </div>
            )}
        </div>
    );
};

// ── Simulation Views ──────────────────────────────────────────────────────────
const SimulationView: React.FC<{ stepIndex: number }> = ({ stepIndex }) => {
    return (
        <div className="w-full h-full flex flex-col overflow-hidden font-sans bg-[#FAFAF9]">
            {/* Browser chrome */}
            <div className="h-9 bg-white border-b border-[#E9E9E7] flex items-center px-4 justify-between shrink-0">
                <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
                </div>
                <div className="h-5 w-48 bg-[#F1F0EC] rounded-md border border-[#E9E9E7] flex items-center px-2 gap-2">
                    <div className="w-2.5 h-2.5 bg-[#D9730D]/30 rounded-sm shrink-0" />
                    <span className="text-[9px] text-[#AEACA8] font-medium">physivault.app</span>
                </div>
                <div className="w-7 h-7 rounded-full bg-[#F1F0EC]" />
            </div>

            {/* App area */}
            <div className="flex-1 flex overflow-hidden relative">
                {/* Sidebar mockup */}
                <div className="w-28 bg-[#F1F0EC] border-r border-[#E9E9E7] h-full p-3 space-y-3 shrink-0 flex flex-col">
                    <div className="h-3.5 w-full bg-white rounded-md shadow-sm border border-[#E9E9E7]" />
                    {[1, 2, 3].map(i => (
                        <div key={i} className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-sm bg-[#DDE2F7]" />
                            <div className="h-1 flex-1 bg-[#DDE2F7]/50 rounded-full" />
                        </div>
                    ))}
                    <div className="flex-1" />
                    {/* Settings button — highlight on step 3 */}
                    <div
                        className="p-2 rounded-lg flex items-center gap-1.5 transition-all duration-300"
                        style={
                            stepIndex === 2
                                ? { background: '#1A1A1A', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }
                                : { background: 'white', border: '1px solid #E9E9E7' }
                        }
                    >
                        <Settings className="w-3 h-3 shrink-0" style={{ color: stepIndex === 2 ? 'white' : '#787774' }} />
                        <div className="h-1 flex-1 rounded-full" style={{ background: stepIndex === 2 ? 'rgba(255,255,255,0.3)' : '#E9E9E7' }} />
                    </div>
                </div>

                {/* Main content */}
                <div className="flex-1 p-5 bg-white relative overflow-hidden">
                    {/* Default content skeleton */}
                    <div className="space-y-2 mb-4">
                        <div className="h-4 w-28 bg-[#1A1A1A]/70 rounded-md" />
                        <div className="h-1.5 w-40 bg-[#AEACA8]/20 rounded-full" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="p-3 rounded-xl border border-[#E9E9E7] bg-[#FAFAF9] space-y-2">
                                <div className="w-7 h-7 bg-white border border-[#E9E9E7] rounded-lg" />
                                <div className="space-y-1">
                                    <div className="h-1.5 bg-[#E9E9E7] rounded-full" />
                                    <div className="h-1.5 w-2/3 bg-[#E9E9E7] rounded-full" />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* ── Step 1: Chatbot button bounce ── */}
                    {stepIndex === 0 && (
                        <div className="absolute bottom-4 right-4 flex flex-col items-center gap-2 animate-bounce z-20">
                            <div
                                className="w-12 h-12 rounded-full flex items-center justify-center border-2 border-white"
                                style={{ background: '#2D2D2D', boxShadow: '0 4px 16px rgba(0,0,0,0.25)' }}
                            >
                                <MessageCircle className="w-6 h-6 text-white" />
                            </div>
                            <div
                                className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider"
                                style={{ background: 'white', color: '#1A1A1A', border: '1px solid #E9E9E7', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                            >
                                Nhấn tại đây!
                            </div>
                        </div>
                    )}

                    {/* ── Step 2: Chat window open, conversation shown ── */}
                    {stepIndex === 1 && (
                        <div
                            className="absolute bottom-3 right-3 flex flex-col overflow-hidden animate-scale-in origin-bottom-right z-20"
                            style={{
                                width: '230px',
                                height: '280px',
                                background: '#FFFFFF',
                                border: '1px solid #E9E9E7',
                                borderRadius: '12px',
                                boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                            }}
                        >
                            {/* Chat header */}
                            <div
                                className="flex items-center gap-2 px-3 py-2 shrink-0"
                                style={{ borderBottom: '1px solid #E9E9E7', borderTop: '3px solid #D9730D' }}
                            >
                                <div className="p-1.5 rounded-lg bg-[#FFF3E8]">
                                    <Bot className="w-3 h-3 text-[#D9730D]" />
                                </div>
                                <div>
                                    <div className="text-[11px] font-semibold text-[#1A1A1A]">PhysiVault AI</div>
                                    <div className="flex items-center gap-1 mt-0.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
                                        <span className="text-[9px] text-[#787774]">Đang trực tuyến</span>
                                    </div>
                                </div>
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-hidden p-2.5 space-y-2" style={{ background: '#FAFAF9' }}>
                                {/* Bot greeting */}
                                <div className="flex gap-1.5">
                                    <div className="w-5 h-5 rounded-full shrink-0 mt-0.5 flex items-center justify-center bg-[#FFF3E8]">
                                        <Bot className="w-3 h-3 text-[#D9730D]" />
                                    </div>
                                    <div
                                        className="px-2 py-1.5 text-[10px] leading-relaxed text-[#1A1A1A] bg-white border border-[#E9E9E7] max-w-[80%]"
                                        style={{ borderRadius: '2px 8px 8px 8px' }}
                                    >
                                        Chào! Nhập SĐT đã đăng ký với thầy Huy nhé.
                                    </div>
                                </div>
                                {/* User message */}
                                <div className="flex gap-1.5 justify-end">
                                    <div
                                        className="px-2 py-1.5 text-[10px] leading-relaxed text-white max-w-[80%]"
                                        style={{ background: '#2D2D2D', borderRadius: '8px 2px 8px 8px' }}
                                    >
                                        09xx-xxx-xxx
                                    </div>
                                    <div className="w-5 h-5 rounded-full shrink-0 mt-0.5 flex items-center justify-center bg-[#EEF0FB]">
                                        <User className="w-3 h-3 text-[#6B7CDB]" />
                                    </div>
                                </div>
                                {/* Bot + Code */}
                                <div className="flex gap-1.5">
                                    <div className="w-5 h-5 rounded-full shrink-0 mt-0.5 flex items-center justify-center bg-[#FFF3E8]">
                                        <Bot className="w-3 h-3 text-[#D9730D]" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <div
                                            className="px-2 py-1.5 text-[10px] leading-relaxed text-[#1A1A1A] bg-white border border-[#E9E9E7]"
                                            style={{ borderRadius: '2px 8px 8px 8px' }}
                                        >
                                            Xác thực thành công! Mã của bạn:
                                        </div>
                                        <div
                                            className="px-2 py-1.5 text-[10px] font-mono font-bold text-[#1A1A1A] bg-white flex items-center gap-1.5"
                                            style={{ border: '1.5px solid #D9730D', borderRadius: '2px 8px 8px 8px' }}
                                        >
                                            <span>PV-XXXX-XXXX</span>
                                            <Copy className="w-2.5 h-2.5 text-[#AEACA8]" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Input */}
                            <div className="p-2 shrink-0 bg-white border-t border-[#E9E9E7] flex gap-1.5">
                                <div
                                    className="flex-1 h-7 rounded-lg text-[9px] flex items-center px-2 text-[#AEACA8]"
                                    style={{ background: '#F7F6F3', border: '1px solid #E9E9E7' }}
                                >
                                    Nhập số điện thoại...
                                </div>
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#D9730D]">
                                    <Send className="w-3 h-3 text-white" />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Step 3: Settings modal — POST-ACTIVATION state ── */}
                    {stepIndex === 2 && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[1px] z-20">
                            <div className="w-[310px] bg-white rounded-[12px] shadow-2xl border border-[#E9E9E7] overflow-hidden animate-scale-in flex flex-col">
                                {/* Modal header */}
                                <div className="px-4 py-3 border-b border-[#E9E9E7] flex items-center justify-between">
                                    <span className="text-[11px] font-semibold text-[#1A1A1A]">Cài đặt &amp; Bảo mật Hệ thống</span>
                                    <X className="w-3 h-3 text-[#787774]" />
                                </div>

                                {/* Body */}
                                <div className="p-3.5 space-y-3">
                                    {/* Access row — now activated (student mode) */}
                                    <div className="rounded-xl border border-[#E9E9E7] overflow-hidden">
                                        <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#E9E9E7]">
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 bg-[#F1F0EC] rounded-lg">
                                                    <Lock className="w-3.5 h-3.5 text-[#787774]" />
                                                </div>
                                                <div>
                                                    <div className="text-[8px] uppercase font-bold tracking-wider text-[#AEACA8]">Quyền truy cập</div>
                                                    <div className="text-[11px] font-semibold text-[#1A1A1A]">Chế độ Học sinh</div>
                                                </div>
                                            </div>
                                            <div
                                                className="flex items-center gap-1 text-[9px] font-semibold px-2 py-1 rounded-lg"
                                                style={{ background: '#F1F0EC', color: '#57564F', border: '1px solid #E9E9E7' }}
                                            >
                                                <KeyRound className="w-2.5 h-2.5" /> Mở khóa Admin
                                            </div>
                                        </div>
                                        {/* Green success message */}
                                        <div className="px-3 py-2.5 bg-[#FAFAF9]">
                                            <span className="flex items-center gap-1.5 text-[10px] font-semibold" style={{ color: '#448361' }}>
                                                <ShieldCheck className="w-3 h-3" />
                                                Hệ thống đã được kích hoạt. Bạn có thể nạp bài giảng mới.
                                            </span>
                                        </div>
                                    </div>

                                    {/* Import section — now unlocked */}
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#1A1A1A]">
                                            <Upload className="w-3.5 h-3.5 text-[#9065B0]" />
                                            Nhập học liệu mới
                                        </div>
                                        <div
                                            className="w-full py-2.5 rounded-lg flex items-center justify-center gap-1.5 text-[10px] font-semibold"
                                            style={{ background: '#F3ECF8', color: '#9065B0', border: '1px solid #9065B033' }}
                                        >
                                            <Upload className="w-3 h-3" />
                                            Chọn file bài giảng từ thầy (.json)
                                        </div>
                                    </div>

                                    {/* Note */}
                                    <div
                                        className="flex items-start gap-2 px-3 py-2.5 rounded-lg"
                                        style={{ background: '#F7F6F3', border: '1px solid #E9E9E7' }}
                                    >
                                        <ShieldAlert className="w-3 h-3 text-[#AEACA8] shrink-0 mt-0.5" />
                                        <p className="text-[9px] leading-relaxed text-[#787774]">
                                            Lưu ý cho Học sinh: Hệ thống cần được kích hoạt bằng mã duy nhất cho máy này để đảm bảo quyền truy cập học liệu chính thức.
                                        </p>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="px-4 py-2.5 border-t border-[#E9E9E7] text-center">
                                    <span className="text-[10px] text-[#AEACA8] font-medium">Quay lại trang chủ</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Step 4: Upload / Import flow ── */}
                    {stepIndex === 3 && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[1px] z-20">
                            <div className="w-[310px] bg-white rounded-[12px] shadow-2xl border border-[#E9E9E7] overflow-hidden animate-scale-in flex flex-col">
                                {/* Modal header */}
                                <div className="px-4 py-3 border-b border-[#E9E9E7] flex items-center justify-between">
                                    <span className="text-[11px] font-semibold text-[#1A1A1A]">Cài đặt &amp; Bảo mật Hệ thống</span>
                                    <X className="w-3 h-3 text-[#787774]" />
                                </div>

                                {/* Body */}
                                <div className="p-3.5 space-y-3">
                                    {/* Import section highlight */}
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#1A1A1A]">
                                            <Upload className="w-3.5 h-3.5 text-[#9065B0]" />
                                            Nhập học liệu mới
                                        </div>
                                        {/* Upload button — highlighted / pulsing */}
                                        <div
                                            className="w-full py-3 rounded-lg flex items-center justify-center gap-1.5 text-[11px] font-semibold animate-pulse"
                                            style={{
                                                background: '#F3ECF8',
                                                color: '#9065B0',
                                                border: '2px solid #9065B0',
                                                boxShadow: '0 0 0 4px rgba(144,101,176,0.1)',
                                            }}
                                        >
                                            <Upload className="w-3.5 h-3.5" />
                                            Chọn file bài giảng từ thầy (.json)
                                        </div>
                                    </div>

                                    {/* File selected state */}
                                    <div
                                        className="rounded-lg p-2.5 flex items-center gap-2.5"
                                        style={{ background: '#F3ECF8', border: '1px solid #9065B033' }}
                                    >
                                        <div
                                            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                            style={{ background: '#9065B0' }}
                                        >
                                            <Upload className="w-4 h-4 text-white" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-[10px] font-bold text-[#1A1A1A] truncate">baiGiang_VatLy_2025.json</div>
                                            <div className="text-[9px] text-[#9065B0] mt-0.5">Đang nhập dữ liệu...</div>
                                            {/* Progress bar */}
                                            <div className="mt-1.5 h-1 rounded-full bg-[#E9E9E7] overflow-hidden">
                                                <div
                                                    className="h-full rounded-full"
                                                    style={{ width: '70%', background: '#9065B0' }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Success tip */}
                                    <div
                                        className="flex items-center gap-2 px-3 py-2.5 rounded-lg"
                                        style={{ background: '#EAF3EE', border: '1px solid #44836133' }}
                                    >
                                        <CheckCircle2 className="w-3.5 h-3.5 text-[#448361] shrink-0" />
                                        <p className="text-[9px] leading-relaxed font-semibold" style={{ color: '#448361' }}>
                                            Nhập xong — tải lại trang để xem bài giảng!
                                        </p>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="px-4 py-2.5 border-t border-[#E9E9E7] text-center">
                                    <span className="text-[10px] text-[#AEACA8] font-medium">Quay lại trang chủ</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GuideModal;
