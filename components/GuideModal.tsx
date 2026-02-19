
import React, { useState, useEffect } from 'react';
import { X, BookOpen, Monitor, KeyRound, Upload, CheckCircle2, Settings, Atom, FolderOpen, Home, ShieldCheck, LayoutDashboard, Phone } from 'lucide-react';

interface GuideModalProps {
    isOpen: boolean;
    onClose: () => void;
    isAdmin: boolean;
}

const GuideModal: React.FC<GuideModalProps> = ({ isOpen, onClose, isAdmin }) => {
    const [activeScene, setActiveScene] = useState<number>(0);
    const [isPlaying, setIsPlaying] = useState(true);

    const scenes = [
        {
            title: "Bước 1: Lấy Mã Máy (ID)",
            desc: "Vào Cài đặt -> Copy dãy ID máy gửi cho thầy hoặc nhập vào Bot.",
            icon: <Monitor className="w-5 h-5 text-amber-500" />
        },
        {
            title: "Bước 2: Chat lấy mã tự động",
            desc: "Nhấn biểu tượng Chatbot ở góc phải màn hình để nhận mã PV-...",
            icon: <Atom className="w-5 h-5 text-indigo-500" />
        },
        {
            title: "Bước 3: Mở khóa & Học tập",
            desc: "Nhập SĐT của bạn và dán mã kích hoạt vào App để bắt đầu bài học.",
            icon: <ShieldCheck className="w-5 h-5 text-emerald-500" />
        }
    ];

    useEffect(() => {
        if (!isOpen || !isPlaying) return;
        const timer = setInterval(() => {
            setActiveScene(prev => (prev + 1) % scenes.length);
        }, 5000); // 5 seconds per scene
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
                    <div className="flex items-center gap-3 mb-8">
                        <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-200">
                            <BookOpen className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="font-bold text-lg text-slate-800 leading-tight">Hướng dẫn nhanh</h2>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Dành cho {isAdmin ? 'Quản trị viên' : 'Học sinh'}</p>
                        </div>
                    </div>

                    <div className="space-y-4 flex-1">
                        {scenes.map((scene, idx) => {
                            const colors = [
                                { active: 'bg-white border-amber-200 shadow-md ring-2 ring-amber-500/10', icon: 'bg-amber-500 text-white', text: 'text-amber-700' },
                                { active: 'bg-white border-emerald-200 shadow-md ring-2 ring-emerald-500/10', icon: 'bg-emerald-500 text-white', text: 'text-emerald-700' },
                                { active: 'bg-white border-indigo-200 shadow-md ring-2 ring-indigo-500/10', icon: 'bg-indigo-600 text-white', text: 'text-indigo-700' }
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
                        <SimulatedAppView scene={activeScene} />

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

const SimulatedAppView: React.FC<{ scene: number }> = ({ scene }) => {
    return (
        <div className="w-full h-full flex overflow-hidden font-sans">
            {/* Sidebar Sub-UI */}
            <div className="w-32 bg-white/90 border-r border-slate-100 h-full flex flex-col p-3 gap-3">
                <div className="flex items-center gap-2 mb-2">
                    <Atom className="w-6 h-6 text-indigo-600" />
                    <div className="h-2 w-12 bg-indigo-100 rounded" />
                </div>
                <div className="flex items-center gap-2 p-1.5 bg-indigo-50 rounded-lg">
                    <Home className="w-3 h-3 text-indigo-600" />
                    <div className="h-1.5 w-10 bg-indigo-200 rounded" />
                </div>
                {[1, 2, 3].map(i => (
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
                    <div className="h-10 w-10 bg-white rounded-full shadow-sm" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 space-y-3">
                            <div className="h-8 w-8 bg-indigo-50 rounded-lg" />
                            <div className="h-2 w-full bg-slate-100 rounded" />
                            <div className="h-2 w-2/3 bg-slate-50 rounded" />
                        </div>
                    ))}
                </div>

                {/* Simulated Settings Modal Popup */}
                {scene >= 0 && (
                    <div className={`absolute inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-500`}>
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-300">
                            <div className="bg-slate-50 p-3 border-b border-slate-100 flex justify-between items-center">
                                <div className="h-3 w-24 bg-slate-300 rounded" />
                                <X className="w-3 h-3 text-slate-400" />
                            </div>

                            <div className="p-4 space-y-4">
                                {/* Scene 1: Machine ID highlighting */}
                                <div className={`p-3 rounded-xl border-2 transition-all ${scene === 0 ? 'border-amber-400 bg-amber-50 shadow-lg' : 'border-slate-100 bg-slate-50'}`}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <Monitor className={`w-4 h-4 ${scene === 0 ? 'text-amber-600' : 'text-slate-400'}`} />
                                        <div className={`h-2 w-20 rounded ${scene === 0 ? 'bg-amber-200' : 'bg-slate-200'}`} />
                                    </div>
                                    <div className="flex gap-1.5">
                                        <div className="flex-1 h-8 bg-white rounded border border-slate-200 items-center flex justify-center text-[10px] font-mono text-slate-400">ABC-123-XYZ...</div>
                                        <div className={`px-3 flex items-center h-8 rounded text-[10px] font-bold transition-all ${scene === 0 ? 'bg-amber-500 text-white animate-pulse' : 'bg-slate-200 text-slate-400'}`}>
                                            {scene === 0 ? 'BẤM COPY' : 'COPY'}
                                        </div>
                                    </div>
                                </div>

                                {/* Scene 2: Chatbot Interaction highlighting */}
                                <div className={`p-3 rounded-xl border-2 transition-all ${scene === 1 ? 'border-indigo-400 bg-indigo-50 shadow-lg scale-105' : 'border-slate-100 opacity-50'}`}>
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white animate-bounce">
                                            <Atom className="w-6 h-6" />
                                        </div>
                                        <div className="flex-1 space-y-2">
                                            <div className="h-2 w-20 bg-indigo-200 rounded" />
                                            <div className="h-1.5 w-32 bg-slate-200 rounded" />
                                        </div>
                                    </div>
                                    <div className="mt-3 py-2 px-3 bg-white rounded-lg border border-indigo-100 text-[9px] font-bold text-indigo-600 text-center uppercase tracking-widest">
                                        Đang trò chuyện với Bot...
                                    </div>
                                </div>

                                {/* Scene 3: SĐT + Key Activation */}
                                <div className={`p-3 rounded-xl border-2 transition-all ${scene === 2 ? 'border-emerald-400 bg-emerald-50 shadow-lg scale-105' : 'border-slate-100'}`}>
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <Phone className="w-3 h-3 text-emerald-600" />
                                            <div className="h-6 flex-1 bg-white border border-emerald-100 rounded flex items-center px-2 text-[9px] font-bold text-slate-400">09xx-xxx-xxx</div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                            <div className="h-6 flex-1 bg-white border border-emerald-100 rounded flex items-center px-2 text-[9px] font-bold text-emerald-600">PV-XXXX-XXXX</div>
                                        </div>
                                        <div className="w-full h-8 bg-emerald-600 text-white rounded-xl text-[9px] font-black flex items-center justify-center shadow-lg shadow-emerald-200">
                                            MỞ KHÓA NGAY
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default GuideModal;
