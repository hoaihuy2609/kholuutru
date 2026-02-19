
import React, { useState, useEffect } from 'react';
import { X, BookOpen, Monitor, KeyRound, Upload, CheckCircle2, Settings, Atom, FolderOpen, Home, ShieldCheck, LayoutDashboard, Phone, UserCheck, ChevronRight, FileText, MessageCircle, Bot } from 'lucide-react';

interface GuideModalProps {
    isOpen: boolean;
    onClose: () => void;
    isAdmin: boolean;
}

const GuideModal: React.FC<GuideModalProps> = ({ isOpen, onClose, isAdmin }) => {
    const [activeScene, setActiveScene] = useState<number>(0);
    const [isPlaying, setIsPlaying] = useState(true);
    const [guideTab, setGuideTab] = useState<'usage' | 'activation'>('usage');

    const usageScenes = [
        {
            title: "1. CHỌN KHỐI LỚP",
            desc: "Tại trang chủ, nhấn vào thẻ Lớp 10, 11 hoặc 12 để bắt đầu học.",
            icon: <LayoutDashboard className="w-5 h-5 text-indigo-500" />
        },
        {
            title: "2. TÌM BÀI HỌC",
            desc: "Sử dụng thanh tìm kiếm hoặc chọn theo Chương để tìm tài liệu nhanh nhất.",
            icon: <FolderOpen className="w-5 h-5 text-blue-500" />
        },
        {
            title: "3. XEM TÀI LIỆU",
            desc: "Nhấn vào tài liệu để xem PDF hoặc làm Quiz trắc nghiệm trực tuyến.",
            icon: <BookOpen className="w-5 h-5 text-emerald-500" />
        }
    ];

    const activationScenes = [
        {
            title: "BƯỚC 1: MỞ CHATBOT",
            desc: "Nhấn vào biểu tượng Chatbot màu CAM ở trang chủ để bắt đầu.",
            icon: <Atom className="w-5 h-5 text-orange-500" />
        },
        {
            title: "BƯỚC 2: NHẬN MÃ PV",
            desc: "Nhập SĐT của bạn vào Chatbot. Bot sẽ tự động cấp mã kích hoạt.",
            icon: <Phone className="w-5 h-5 text-blue-500" />
        },
        {
            title: "BƯỚC 3: KÍCH HOẠT",
            desc: "Vào Cài đặt -> Dán mã PV-... vào ô kích hoạt để mở khóa toàn bộ.",
            icon: <ShieldCheck className="w-5 h-5 text-emerald-500" />
        }
    ];

    const scenes = guideTab === 'usage' ? usageScenes : activationScenes;

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
                            onClick={() => { setGuideTab('usage'); setActiveScene(0); }}
                            className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all ${guideTab === 'usage' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                        >
                            CÁCH HỌC TẬP
                        </button>
                        <button
                            onClick={() => { setGuideTab('activation'); setActiveScene(0); }}
                            className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all ${guideTab === 'activation' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                        >
                            KÍCH HOẠT MÃ
                        </button>
                    </div>

                    <div className="space-y-4 flex-1">
                        {scenes.map((scene, idx) => {
                            const colors = [
                                { active: 'bg-white border-blue-200 shadow-md ring-2 ring-blue-500/10', icon: 'bg-blue-500 text-white', text: 'text-blue-700' },
                                { active: guideTab === 'activation' ? 'bg-white border-orange-200 shadow-md ring-2 ring-orange-500/10' : 'bg-white border-indigo-200 shadow-md ring-2 ring-indigo-500/10', icon: guideTab === 'activation' ? 'bg-orange-500 text-white' : 'bg-indigo-600 text-white', text: guideTab === 'activation' ? 'text-orange-700' : 'text-indigo-700' },
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
                        <SimulatedAppView scene={activeScene} guideTab={guideTab} />
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

const SimulatedAppView: React.FC<{ scene: number, guideTab: 'usage' | 'activation' }> = ({ scene, guideTab }) => {
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
                            {/* Usage Simulation */}
                            {guideTab === 'usage' ? (
                                scene === 0 ? (
                                    <div className="grid grid-cols-2 gap-2">
                                        {[1, 2, 3].map(i => (
                                            <div key={i} className={`p-4 rounded-xl border-2 transition-all ${i === 2 ? 'border-indigo-600 bg-indigo-50 shadow-lg scale-105' : 'border-slate-100'}`}>
                                                <div className="h-6 w-6 bg-indigo-100 rounded-lg mb-2" />
                                                <div className="h-1.5 w-full bg-slate-200 rounded" />
                                            </div>
                                        ))}
                                    </div>
                                ) : scene === 1 ? (
                                    <div className="space-y-3">
                                        <div className="p-2 bg-slate-100 rounded-xl flex items-center gap-2 border-2 border-indigo-600 shadow-md">
                                            <div className="h-4 w-4 bg-slate-400 rounded-full" />
                                            <div className="h-2 w-full bg-slate-200 rounded" />
                                        </div>
                                        <div className="space-y-1">
                                            {[1, 2].map(i => (
                                                <div key={i} className="p-2 border border-slate-100 rounded-lg flex items-center justify-between">
                                                    <div className="h-1.5 w-24 bg-slate-200 rounded" />
                                                    <ChevronRight className="w-3 h-3 text-slate-300" />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-4 bg-white rounded-2xl border-2 border-emerald-500 shadow-xl space-y-4">
                                        <div className="flex items-center gap-3 border-b pb-3">
                                            <FileText className="w-5 h-5 text-emerald-600" />
                                            <div className="h-2 w-32 bg-slate-200 rounded" />
                                        </div>
                                        <div className="space-y-2">
                                            <div className="h-1.5 w-full bg-slate-100 rounded" />
                                            <div className="h-1.5 w-4/5 bg-slate-100 rounded" />
                                        </div>
                                        <div className="pt-2">
                                            <div className="w-full py-2 bg-emerald-600 rounded-xl text-[8px] text-white font-bold text-center">XEM TÀI LIỆU</div>
                                        </div>
                                    </div>
                                )
                            ) : (
                                /* Activation Simulation */
                                scene === 0 ? (
                                    <div className="p-6 flex flex-col items-center justify-center space-y-4">
                                        <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-orange-500 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-200 animate-bounce">
                                            <MessageCircle className="w-8 h-8 text-white" />
                                        </div>
                                        <div className="text-[10px] font-black text-orange-600 uppercase tracking-widest text-center">
                                            Nhấn vào Chatbot màu cam
                                        </div>
                                    </div>
                                ) : scene === 1 ? (
                                    <div className="p-4 bg-white rounded-2xl border-2 border-blue-400 shadow-xl space-y-3">
                                        <div className="flex items-center gap-2 text-blue-600">
                                            <Bot className="w-4 h-4" />
                                            <span className="text-[8px] font-bold">PHYSI VAULT BOT</span>
                                        </div>
                                        <div className="p-2 bg-slate-50 rounded-lg border border-slate-100 text-[8px] font-mono text-slate-500">
                                            Nhập SĐT của bạn...
                                        </div>
                                        <div className="p-2 bg-blue-50 rounded-lg border border-blue-200 text-[8px] font-mono text-blue-700 font-bold">
                                            Mã: PV-XXXX-XXXX
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="p-3 rounded-2xl border-2 border-emerald-400 bg-emerald-50 shadow-lg">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Phone className="w-3 h-3 text-emerald-600" />
                                                <div className="h-1.5 w-20 rounded bg-emerald-200" />
                                            </div>
                                            <div className="h-8 bg-white rounded-xl border border-slate-100 flex items-center justify-between px-3 text-[10px] font-bold text-slate-400">
                                                <span>09xx-xxx-xxx</span>
                                                <span className="text-[7px] bg-emerald-100 text-emerald-600 px-1 rounded">TỰ ĐỘNG</span>
                                            </div>
                                        </div>
                                        <div className="p-3 rounded-2xl border-2 border-emerald-400 bg-emerald-50 shadow-lg">
                                            <div className="flex items-center gap-2 mb-2">
                                                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                                <div className="h-1.5 w-24 rounded bg-emerald-200" />
                                            </div>
                                            <div className="h-8 bg-white rounded-xl border border-slate-100 flex items-center px-3 text-[10px] font-mono font-bold text-emerald-600">
                                                PV-XXXX-XXXX
                                            </div>
                                        </div>
                                        <div className="w-full py-3 bg-amber-600 rounded-2xl text-[10px] font-black text-white text-center shadow-lg shadow-amber-200 scale-95">
                                            MỞ KHÓA NGAY
                                        </div>
                                    </div>
                                )
                            )}

                            {/* ID Section (The real one) */}
                            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between px-1">
                                <div className="flex items-center gap-2">
                                    <Monitor className="w-3 h-3 text-slate-400" />
                                    <div className="h-1.5 w-16 bg-slate-200 rounded" />
                                </div>
                                <div className="text-[8px] font-black px-2 py-1 rounded bg-slate-100 text-slate-400">
                                    ID: ABC-XYZ
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
