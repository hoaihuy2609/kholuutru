
import React, { useState, useEffect } from 'react';
import { X, BookOpen, Monitor, KeyRound, Upload, CheckCircle2, Settings, Atom, FolderOpen, Home, ShieldCheck, LayoutDashboard, Phone, UserCheck } from 'lucide-react';

interface GuideModalProps {
    isOpen: boolean;
    onClose: () => void;
    isAdmin: boolean;
}

const GuideModal: React.FC<GuideModalProps> = ({ isOpen, onClose, isAdmin }) => {
    const [activeScene, setActiveScene] = useState<number>(0);
    const [isPlaying, setIsPlaying] = useState(true);
    const [guidePath, setGuidePath] = useState<'bot' | 'manual'>('bot');

    const botScenes = [
        {
            title: "CÁCH 1: QUA CHATBOT (Tự động)",
            desc: "Bước 1: Vào Cài đặt -> Copy mã máy (ID).",
            icon: <Monitor className="w-5 h-5" />
        },
        {
            title: "Bước 2: Chat lấy mã",
            desc: "Nhấn icon Chatbot góc phải, nhập SĐT & ID máy để nhận mã PV-...",
            icon: <Atom className="w-5 h-5 text-indigo-500" />
        },
        {
            title: "Bước 3: Mở khóa",
            desc: "Nhập SĐT & Mã nhận được vào Cài đặt để kích hoạt.",
            icon: <ShieldCheck className="w-5 h-5 text-emerald-500" />
        }
    ];

    const manualScenes = [
        {
            title: "CÁCH 2: QUA THẦY HUY (Thủ công)",
            desc: "Bước 1: Trực tiếp gửi Mã máy (ID) và SĐT cho thầy.",
            icon: <UserCheck className="w-5 h-5 text-blue-500" />
        },
        {
            title: "Bước 2: Nhận mã",
            desc: "Thầy sẽ gửi lại cho bạn một mã kích hoạt PV-XXXX.",
            icon: <KeyRound className="w-5 h-5 text-amber-500" />
        },
        {
            title: "Bước 3: Kích hoạt",
            desc: "Vào Cài đặt -> Nhập đúng SĐT và dán mã Thầy gửi.",
            icon: <ShieldCheck className="w-5 h-5 text-emerald-500" />
        }
    ];

    const scenes = guidePath === 'bot' ? botScenes : manualScenes;

    useEffect(() => {
        if (!isOpen || !isPlaying) return;
        const timer = setInterval(() => {
            setActiveScene(prev => (prev + 1) % scenes.length);
        }, 5000);
        return () => clearInterval(timer);
    }, [isOpen, isPlaying, scenes.length]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
            <div
                className="bg-white rounded-[32px] shadow-2xl w-full max-w-5xl overflow-hidden animate-scale-in border border-slate-200 flex flex-col md:flex-row h-[85vh] md:h-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Left Info Panel */}
                <div className="w-full md:w-80 bg-slate-50 p-8 border-r border-slate-100 flex flex-col">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-200">
                            <BookOpen className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="font-bold text-lg text-slate-800 leading-tight">Hướng dẫn nhanh</h2>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Dành cho Học sinh</p>
                        </div>
                    </div>

                    {/* Path Selector */}
                    <div className="flex bg-slate-200/50 p-1 rounded-xl mb-6">
                        <button
                            onClick={() => { setGuidePath('bot'); setActiveScene(0); }}
                            className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all ${guidePath === 'bot' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                        >
                            TỰ ĐỘNG (BOT)
                        </button>
                        <button
                            onClick={() => { setGuidePath('manual'); setActiveScene(0); }}
                            className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all ${guidePath === 'manual' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                        >
                            THỦ CÔNG (THẦY)
                        </button>
                    </div>

                    <div className="space-y-4 flex-1">
                        {scenes.map((scene, idx) => {
                            const colors = [
                                { active: 'bg-white border-blue-200 shadow-md ring-2 ring-blue-500/10', icon: 'bg-blue-500 text-white', text: 'text-blue-700' },
                                { active: guidePath === 'bot' ? 'bg-white border-indigo-200 shadow-md ring-2 ring-indigo-500/10' : 'bg-white border-amber-200 shadow-md ring-2 ring-amber-500/10', icon: guidePath === 'bot' ? 'bg-indigo-600 text-white' : 'bg-amber-500 text-white', text: guidePath === 'bot' ? 'text-indigo-700' : 'text-amber-700' },
                                { active: 'bg-white border-emerald-200 shadow-md ring-2 ring-emerald-500/10', icon: 'bg-emerald-500 text-white', text: 'text-emerald-700' }
                            ];
                            const theme = colors[idx];

                            return (
                                <div
                                    key={idx}
                                    onClick={() => { setActiveScene(idx); }}
                                    className={`group p-4 rounded-2xl border transition-all cursor-pointer ${activeScene === idx
                                        ? theme.active
                                        : 'bg-transparent border-transparent hover:bg-white/50 hover:border-slate-200'
                                        }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={`p-2 rounded-xl transition-colors ${activeScene === idx ? theme.icon : 'bg-slate-200 text-slate-500'}`}>
                                            {scene.icon}
                                        </div>
                                        <div>
                                            <h4 className={`text-sm font-bold transition-colors ${activeScene === idx ? theme.text : 'text-slate-700'}`}>{scene.title}</h4>
                                            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{scene.desc}</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-8 pt-8 border-t border-slate-200">
                        <button
                            onClick={onClose}
                            className="w-full py-4 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-200"
                        >
                            Tôi đã hiểu
                            <CheckCircle2 className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Right Simulation Panel ("The Clip") */}
                <div className="flex-1 bg-slate-100 relative overflow-hidden flex items-center justify-center p-8">
                    {/* The Active Simulation Component */}
                    <div className="relative z-10 w-full max-w-[640px] aspect-video bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
                        <SimulatedAppView scene={activeScene} guidePath={guidePath} />

                    </div>

                </div>

                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-full transition-colors md:text-slate-400"
                >
                    <X className="w-6 h-6" />
                </button>
            </div>
        </div>
    );
};

const SimulatedAppView: React.FC<{ scene: number, guidePath: 'bot' | 'manual' }> = ({ scene, guidePath }) => {
    return (
        <div className="w-full h-full flex overflow-hidden font-sans">
            {/* Sidebar Sub-UI */}
            <div className="w-32 bg-white/90 border-r border-slate-100 h-full flex flex-col p-3 gap-3">
                <div className="flex items-center gap-2 mb-2">
                    <Atom className="w-6 h-6 text-indigo-600" />
                    <div className="h-2 w-12 bg-indigo-100 rounded" />
                </div>
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="flex items-center gap-2 p-1.5">
                        <FolderOpen className="w-3 h-3 text-slate-300" />
                        <div className="h-1.5 w-8 bg-slate-100 rounded" />
                    </div>
                ))}
                <div className={`mt-auto flex items-center gap-2 p-2 rounded-lg transition-all ${scene >= 0 ? 'bg-indigo-600 shadow-md ring-4 ring-indigo-500/20' : 'bg-slate-50'}`}>
                    <Settings className={`w-4 h-4 ${scene >= 0 ? 'text-white' : 'text-slate-400'}`} />
                    <div className={`h-1.5 w-10 rounded ${scene >= 0 ? 'bg-white/40' : 'bg-slate-200'}`} />
                </div>
            </div>

            {/* Main Content Sub-UI */}
            <div className="flex-1 bg-slate-50 p-6 flex flex-col gap-6 relative">
                <div className="flex justify-between items-end">
                    <div className="space-y-2">
                        <div className="h-4 w-32 bg-indigo-200 rounded animate-pulse" />
                        <div className="h-2 w-48 bg-slate-200 rounded" />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    {[1, 2].map(i => (
                        <div key={i} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 space-y-3">
                            <div className="h-8 w-8 bg-indigo-50 rounded-lg" />
                            <div className="h-2 w-full bg-slate-100 rounded" />
                        </div>
                    ))}
                </div>

                {/* Simulated Settings Modal Popup */}
                <div className={`absolute inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-500`}>
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-300 border border-white">
                        <div className="bg-slate-50/80 p-3 border-b border-slate-100 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <Settings className="w-3 h-3 text-slate-500" />
                                <div className="h-2 w-24 bg-slate-300 rounded" />
                            </div>
                            <X className="w-3 h-3 text-slate-400" />
                        </div>

                        <div className="p-5 space-y-4">
                            {/* Path-Specific Visuals */}
                            {guidePath === 'bot' && scene === 1 ? (
                                <div className="p-4 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-200 text-white space-y-3 animate-bounce">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-white/20 p-2 rounded-xl">
                                            <Atom className="w-5 h-5" />
                                        </div>
                                        <span className="text-[10px] font-black uppercase">Đang lấy mã tự động...</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
                                        <div className="h-full bg-white animate-progress" />
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {/* SĐT Input Field (The real one) */}
                                    <div className={`p-3 rounded-2xl border-2 transition-all ${scene === 2 || (guidePath === 'manual' && scene === 0) ? 'border-amber-400 bg-amber-50 shadow-lg' : 'border-slate-100'}`}>
                                        <div className="flex items-center gap-2 mb-2">
                                            <Phone className={`w-3 h-3 ${scene === 2 ? 'text-amber-600' : 'text-slate-400'}`} />
                                            <div className={`h-1.5 w-20 rounded ${scene === 2 ? 'bg-amber-200' : 'bg-slate-200'}`} />
                                        </div>
                                        <div className="h-8 bg-white rounded-xl border border-slate-100 flex items-center px-3 text-[10px] font-bold text-slate-400 italic">
                                            {scene === 2 ? '09xx-xxx-xxx' : 'Nhập SĐT của bạn...'}
                                        </div>
                                    </div>

                                    {/* Key Input Field */}
                                    <div className={`p-3 rounded-2xl border-2 transition-all ${scene === 2 ? 'border-emerald-400 bg-emerald-50 shadow-lg' : 'border-slate-100'}`}>
                                        <div className="flex items-center gap-2 mb-2">
                                            <ShieldCheck className={`w-3 h-3 ${scene === 2 ? 'text-emerald-600' : 'text-slate-400'}`} />
                                            <div className="h-1.5 w-24 rounded bg-slate-100" />
                                        </div>
                                        <div className="h-8 bg-white rounded-xl border border-slate-100 flex items-center px-3 text-[10px] font-mono font-bold text-emerald-600">
                                            {scene === 2 ? 'PV-XXXX-XXXX' : 'PV-...'}
                                        </div>
                                    </div>

                                    {/* Activate Button */}
                                    <div className={`w-full py-3 rounded-2xl text-[10px] font-black text-center transition-all ${scene === 2 ? 'bg-amber-600 text-white shadow-lg shadow-amber-200 scale-95' : 'bg-slate-100 text-slate-400'}`}>
                                        MỞ KHÓA NGAY
                                    </div>
                                </div>
                            )}

                            {/* ID Section (The real one) */}
                            <div className={`mt-4 pt-4 border-t border-slate-100 flex items-center justify-between px-1 ${scene === 0 ? 'animate-pulse' : ''}`}>
                                <div className="flex items-center gap-2">
                                    <Monitor className="w-3 h-3 text-slate-400" />
                                    <div className="h-1.5 w-16 bg-slate-200 rounded" />
                                </div>
                                <div className={`text-[8px] font-black px-2 py-1 rounded transition-all ${scene === 0 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                    {scene === 0 ? 'VỪA COPY' : 'ID: ABC-XYZ'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default GuideModal;
