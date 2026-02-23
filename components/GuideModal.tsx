import React, { useState, useEffect } from 'react';
import { X, BookOpen, Monitor, KeyRound, CheckCircle2, Settings, Atom, FolderOpen, ShieldCheck, LayoutDashboard, Phone, ChevronRight, FileText, MessageCircle, Bot } from 'lucide-react';

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
            title: "Khám phá kho tri thức",
            desc: "Chọn khối lớp (10, 11, hoặc 12) ngay tại trang chủ để bắt đầu hành trình.",
            icon: <LayoutDashboard className="w-5 h-5 text-[#6B7CDB]" />
        },
        {
            title: "Tìm bài học nhanh chóng",
            desc: "Dùng thanh tìm kiếm hoặc duyệt theo từng chương để tìm tài liệu bạn cần.",
            icon: <FolderOpen className="w-5 h-5 text-[#9065B0]" />
        },
        {
            title: "Chinh phục kiến thức",
            desc: "Nhấn vào bài học để xem tài liệu PDF hoặc thử sức với các bài Quiz.",
            icon: <FileText className="w-5 h-5 text-[#448361]" />
        }
    ];

    const activationScenes = [
        {
            title: "Trò chuyện cùng Bot",
            desc: "Nhấn vào biểu tượng Chatbot màu cam để gặp trợ lý ảo PhysiVault.",
            icon: <MessageCircle className="w-5 h-5 text-[#D9730D]" />
        },
        {
            title: "Nhận mã định danh PV",
            desc: "Nhập số điện thoại của bạn, Bot sẽ tự động cấp mã kích hoạt cá nhân.",
            icon: <Bot className="w-5 h-5 text-[#6B7CDB]" />
        },
        {
            title: "Mở khóa giới hạn",
            desc: "Vào Cài đặt, dán mã PV-... vào ô kích hoạt để xem toàn bộ tài liệu.",
            icon: <ShieldCheck className="w-5 h-5 text-[#448361]" />
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm animate-fade-in">
            <div
                className="bg-[#F7F6F3] rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden animate-scale-in border border-[#E9E9E7] flex flex-col md:flex-row h-[90vh] md:h-[650px]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Left Info Panel */}
                <div className="w-full md:w-[350px] bg-[#F1F0EC] p-6 border-r border-[#E9E9E7] flex flex-col">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="p-2.5 bg-[#FFFFFF] border border-[#E9E9E7] rounded-xl shadow-sm">
                            <BookOpen className="w-6 h-6 text-[#1A1A1A]" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-base text-[#1A1A1A] leading-tight">Hướng dẫn nhanh</h2>
                            <p className="text-[11px] text-[#787774] font-medium uppercase tracking-wider">Học sinh & Thành viên</p>
                        </div>
                    </div>

                    {/* Path Selector - Notion Style */}
                    <div className="flex bg-[#EBEBEA] p-1 rounded-xl mb-8">
                        <button
                            onClick={() => { setGuideTab('usage'); setActiveScene(0); }}
                            className={`flex-1 py-2 text-[11px] font-semibold rounded-lg transition-all ${guideTab === 'usage' ? 'bg-white text-[#1A1A1A] shadow-sm' : 'text-[#787774] hover:text-[#1A1A1A]'}`}
                        >
                            CÁCH HỌC TẬP
                        </button>
                        <button
                            onClick={() => { setGuideTab('activation'); setActiveScene(0); }}
                            className={`flex-1 py-2 text-[11px] font-semibold rounded-lg transition-all ${guideTab === 'activation' ? 'bg-white text-[#1A1A1A] shadow-sm' : 'text-[#787774] hover:text-[#1A1A1A]'}`}
                        >
                            KÍCH HOẠT MÃ
                        </button>
                    </div>

                    <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                        {scenes.map((scene, idx) => {
                            const isActive = activeScene === idx;
                            return (
                                <div
                                    key={idx}
                                    onClick={() => { setActiveScene(idx); setIsPlaying(false); }}
                                    className={`group p-4 rounded-xl transition-all cursor-pointer border-l-4 ${isActive
                                        ? 'bg-white shadow-sm border-[#6B7CDB]'
                                        : 'bg-transparent border-transparent hover:bg-white/40'
                                        }`}
                                >
                                    <div className="flex items-start gap-4">
                                        <div className={`mt-0.5 transition-transform ${isActive ? 'scale-110' : 'opacity-60'}`}>
                                            {scene.icon}
                                        </div>
                                        <div>
                                            <h4 className={`text-sm font-semibold transition-colors ${isActive ? 'text-[#1A1A1A]' : 'text-[#787774]'}`}>{scene.title}</h4>
                                            <p className="text-xs text-[#787774] mt-1 leading-relaxed">{scene.desc}</p>
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
                        <SimulatedAppView scene={activeScene} guideTab={guideTab} />
                    </div>
                    {/* Decorative Blobs */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-[#EEF0FB] rounded-full blur-3xl opacity-50 -mr-32 -mt-32" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#F3ECF8] rounded-full blur-3xl opacity-50 -ml-32 -mb-32" />
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

const SimulatedAppView: React.FC<{ scene: number, guideTab: 'usage' | 'activation' }> = ({ scene, guideTab }) => {
    return (
        <div className="w-full h-full flex flex-col overflow-hidden font-sans bg-[#F7F6F3]">
            {/* Header/Top Bar */}
            <div className="h-10 bg-white border-b border-[#E9E9E7] flex items-center px-4 justify-between shrink-0">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#E9E9E7]" />
                    <div className="w-2 h-2 rounded-full bg-[#E9E9E7]" />
                    <div className="w-2 h-2 rounded-full bg-[#E9E9E7]" />
                </div>
                <div className="h-1.5 w-24 bg-[#F1F0EC] rounded-full" />
                <div className="w-4 h-4 rounded bg-[#F1F0EC]" />
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Simulated Sidebar */}
                <div className="w-24 md:w-32 bg-[#F1F0EC] border-r border-[#E9E9E7] h-full p-4 space-y-3 shrink-0">
                    <div className="h-4 w-full bg-[#FFFFFF] rounded shadow-sm mb-4" />
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded bg-[#E9E9E7]" />
                            <div className="h-1 w-full bg-[#E9E9E7] rounded" />
                        </div>
                    ))}
                    <div className={`mt-auto p-2 rounded-lg transition-all flex items-center gap-2 ${guideTab === 'activation' && scene === 2 ? 'bg-[#6B7CDB] shadow-md' : 'bg-white border border-[#E9E9E7]'}`}>
                        <Settings className={`w-3 h-3 ${guideTab === 'activation' && scene === 2 ? 'text-white' : 'text-[#787774]'}`} />
                        <div className={`h-1 w-full rounded ${guideTab === 'activation' && scene === 2 ? 'bg-white/40' : 'bg-[#F1F0EC]'}`} />
                    </div>
                </div>

                {/* Simulated Main Content */}
                <div className="flex-1 p-6 space-y-6 relative flex flex-col">
                    <div className="space-y-2">
                        <div className="h-4 w-32 bg-[#1A1A1A]/10 rounded" />
                        <div className="h-2 w-48 bg-[#AEACA8]/20 rounded" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {[1, 2].map(i => (
                            <div key={i} className="bg-white p-4 rounded-xl border border-[#E9E9E7] shadow-sm space-y-3">
                                <div className="h-6 w-6 bg-[#F1F0EC] rounded-lg" />
                                <div className="h-1.5 w-full bg-[#F1F0EC] rounded" />
                            </div>
                        ))}
                    </div>

                    {/* OVERLAYS based on current scene */}
                    <div className="absolute inset-0 flex items-center justify-center p-4">
                        {/* Tab 1: USAGE */}
                        {guideTab === 'usage' && (
                            <div className="w-full h-full flex items-center justify-center">
                                {scene === 0 && (
                                    <div className="grid grid-cols-2 gap-3 w-4/5 animate-scale-in">
                                        {[10, 11, 12].map(num => (
                                            <div key={num} className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${num === 12 ? 'border-[#6B7CDB] bg-white shadow-lg -translate-y-1' : 'border-[#E9E9E7] bg-white/50 opacity-40'}`}>
                                                <div className="w-8 h-8 rounded-lg bg-[#6B7CDB]/10 flex items-center justify-center">
                                                    <Atom className="w-4 h-4 text-[#6B7CDB]" />
                                                </div>
                                                <div className="h-1.5 w-12 bg-[#F1F0EC] rounded" />
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {scene === 1 && (
                                    <div className="w-4/5 bg-white rounded-2xl border-2 border-[#9065B0] shadow-xl p-4 animate-scale-in space-y-4">
                                        <div className="flex items-center gap-2 p-2 bg-[#F7F6F3] rounded-lg border border-[#E9E9E7]">
                                            <div className="w-3 h-3 rounded-full bg-[#CFCFCB]" />
                                            <div className="h-1 w-24 bg-[#E9E9E7] rounded" />
                                        </div>
                                        <div className="space-y-2">
                                            {[1, 2].map(i => (
                                                <div key={i} className={`flex items-center justify-between p-2 rounded-lg border ${i === 1 ? 'border-[#9065B0] bg-[#F3ECF8]' : 'border-[#E9E9E7]'}`}>
                                                    <div className="h-1.5 w-32 bg-[#CFCFCB] rounded" />
                                                    <ChevronRight className="w-3 h-3 text-[#CFCFCB]" />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {scene === 2 && (
                                    <div className="w-3/4 aspect-video bg-white rounded-2xl border-2 border-[#448361] shadow-2xl p-5 animate-scale-in flex flex-col justify-between">
                                        <div className="flex items-center gap-3 border-b border-[#F1F0EC] pb-4">
                                            <div className="w-10 h-10 rounded-xl bg-[#448361]/10 flex items-center justify-center">
                                                <FileText className="w-5 h-5 text-[#448361]" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <div className="h-2 w-24 bg-[#1A1A1A] rounded" />
                                                <div className="h-1.5 w-32 bg-[#787774] rounded" />
                                            </div>
                                        </div>
                                        <div className="h-1.5 w-full bg-[#F1F0EC] rounded-full" />
                                        <div className="h-1.5 w-4/5 bg-[#F1F0EC] rounded-full" />
                                        <div className="w-full py-2.5 bg-[#448361] rounded-xl text-[10px] text-white font-bold text-center tracking-wider">
                                            BẮT ĐẦU ÔN LUYỆN
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Tab 2: ACTIVATION */}
                        {guideTab === 'activation' && (
                            <div className="w-full h-full flex items-center justify-center">
                                {scene === 0 && (
                                    <div className="flex flex-col items-center gap-4 animate-scale-in">
                                        <div className="w-16 h-16 rounded-2xl bg-[#D9730D] shadow-lg shadow-orange-200 flex items-center justify-center animate-bounce">
                                            <Bot className="w-8 h-8 text-white" />
                                        </div>
                                        <div className="px-4 py-2 bg-white rounded-full border border-[#E9E9E7] shadow-sm text-[10px] font-bold text-[#D9730D]">
                                            NHẤN BIỂU TƯỢNG BOT
                                        </div>
                                    </div>
                                )}
                                {scene === 1 && (
                                    <div className="w-3/4 bg-white rounded-2xl border-2 border-[#6B7CDB] shadow-2xl p-4 animate-scale-in space-y-4">
                                        <div className="flex items-center gap-2 mb-2 p-1 border-b border-[#F1F0EC]">
                                            <Bot className="w-4 h-4 text-[#6B7CDB]" />
                                            <div className="h-1.5 w-24 bg-[#6B7CDB]/30 rounded" />
                                        </div>
                                        <div className="p-3 bg-[#F7F6F3] rounded-xl border border-[#E9E9E7] flex items-center gap-3">
                                            <div className="w-4 h-4 rounded bg-[#CFCFCB]" />
                                            <div className="h-1.5 w-full bg-[#E9E9E7] rounded" />
                                        </div>
                                        <div className="p-3 bg-[#EEF0FB] rounded-xl border border-[#6B7CDB]/30 flex flex-col gap-2">
                                            <div className="h-1 w-16 bg-[#6B7CDB]/40 rounded" />
                                            <div className="text-[12px] font-mono font-bold text-[#6B7CDB] tracking-widest">
                                                PV-XXXX-XXXX
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {scene === 2 && (
                                    <div className="w-full h-full flex items-center justify-center p-6 bg-white/40 backdrop-blur-[2px]">
                                        <div className="w-3/4 bg-white rounded-3xl border border-[#E9E9E7] shadow-2xl p-6 animate-scale-in space-y-6">
                                            <div className="flex items-center justify-between border-b border-[#F1F0EC] pb-4">
                                                <div className="flex items-center gap-2">
                                                    <Settings className="w-4 h-4 text-[#787774]" />
                                                    <div className="h-2 w-24 bg-[#1A1A1A] rounded" />
                                                </div>
                                                <X className="w-4 h-4 text-[#CFCFCB]" />
                                            </div>
                                            <div className="space-y-2">
                                                <div className="h-1 w-20 bg-[#AEACA8] rounded mb-1" />
                                                <div className="h-10 w-full bg-[#F7F6F3] rounded-xl border-2 border-[#448361] flex items-center px-4">
                                                    <div className="h-2 w-32 bg-[#448361]/20 rounded" />
                                                </div>
                                            </div>
                                            <div className="w-full py-3 bg-[#1A1A1A] rounded-xl text-[10px] text-white font-bold text-center tracking-[0.2em]">
                                                KÍCH HOẠT NGAY
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GuideModal;
