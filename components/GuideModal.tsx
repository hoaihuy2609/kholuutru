
import React, { useState } from 'react';
import { X, BookOpen, GraduationCap, UserCog, CheckCircle2, Copy, ShieldCheck, Download, Upload, KeyRound, Monitor } from 'lucide-react';

interface GuideModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const GuideModal: React.FC<GuideModalProps> = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState<'student' | 'teacher'>('student');

    if (!isOpen) return null;

    const studentSteps = [
        {
            title: "Lấy Mã Máy",
            desc: "Vào phần 'Cài đặt', copy dãy 12 ký tự tại mục 'Mã máy của bạn'.",
            icon: <Monitor className="w-5 h-5" />,
            color: "blue"
        },
        {
            title: "Gửi cho Thầy/Cô",
            desc: "Gửi mã máy vừa copy cho giáo viên để nhận 'Mã kích hoạt' tương ứng.",
            icon: <KeyRound className="w-5 h-5" />,
            color: "purple"
        },
        {
            title: "Kích hoạt Hệ thống",
            desc: "Dán mã nhận được vào ô 'Mã kích hoạt' và nhấn 'Mở khóa'.",
            icon: <ShieldCheck className="w-5 h-5" />,
            color: "green"
        },
        {
            title: "Nạp Bài Giảng",
            desc: "Sử dụng tính năng 'Nhập học liệu' để nạp file .json thầy gửi vào máy.",
            icon: <Upload className="w-5 h-5" />,
            color: "indigo"
        }
    ];

    const teacherSteps = [
        {
            title: "Mở khóa Admin",
            desc: "Nhấn 'Mở khóa Admin' trong Cài đặt và nhập mật khẩu của bạn.",
            icon: <UserCog className="w-5 h-5" />,
            color: "indigo"
        },
        {
            title: "Cấp Mã Học Sinh",
            desc: "Dán mã máy học sinh vào 'Trạm cấp mã' để tạo khóa kích hoạt PV-...",
            icon: <KeyRound className="w-5 h-5" />,
            color: "blue"
        },
        {
            title: "Quản lý Dữ liệu",
            desc: "Soạn bài giảng xong, dùng 'Xuất File' để lưu dữ liệu (.json) gửi cho học sinh.",
            icon: <Download className="w-5 h-5" />,
            color: "purple"
        },
        {
            title: "Bảo mật",
            desc: "Mỗi mã máy là duy nhất, mã kích hoạt chỉ có tác dụng trên đúng máy đó.",
            icon: <ShieldCheck className="w-5 h-5" />,
            color: "orange"
        }
    ];

    const getStepStyles = (color: string) => {
        const styles: Record<string, string> = {
            blue: "bg-blue-50 text-blue-600",
            purple: "bg-purple-50 text-purple-600",
            green: "bg-green-50 text-green-600",
            indigo: "bg-indigo-50 text-indigo-600",
            orange: "bg-orange-50 text-orange-600",
        };
        return styles[color] || "bg-slate-50 text-slate-600";
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-fade-in">
            <div
                className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl overflow-hidden animate-scale-in border border-white/20"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="relative p-8 bg-gradient-to-br from-indigo-600 to-purple-700 text-white overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
                    <div className="absolute bottom-0 left-0 w-40 h-40 bg-purple-400/20 rounded-full -ml-10 -mb-10 blur-2xl"></div>

                    <div className="relative flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-white/20 backdrop-blur-md rounded-2xl">
                                <BookOpen className="w-6 h-6 text-white" />
                            </div>
                            <h2 className="text-2xl font-bold tracking-tight">Trung tâm Hướng dẫn</h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/20 rounded-full transition-colors"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                    <p className="text-indigo-100 text-sm font-medium opacity-90 max-w-md">
                        Mọi thứ bạn cần biết để bắt đầu sử dụng PhysiVault một cách chuyên nghiệp nhất.
                    </p>
                </div>

                {/* Tabs selection */}
                <div className="flex p-2 bg-slate-50 border-b border-slate-100 items-center justify-center gap-2">
                    <button
                        onClick={() => setActiveTab('student')}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-2xl text-sm font-bold transition-all ${activeTab === 'student'
                            ? 'bg-white text-indigo-600 shadow-sm border border-indigo-100'
                            : 'text-slate-500 hover:bg-slate-100'
                            }`}
                    >
                        <GraduationCap className="w-4 h-4" />
                        Dành cho Học sinh
                    </button>
                    <button
                        onClick={() => setActiveTab('teacher')}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-2xl text-sm font-bold transition-all ${activeTab === 'teacher'
                            ? 'bg-white text-purple-600 shadow-sm border border-purple-100'
                            : 'text-slate-500 hover:bg-slate-100'
                            }`}
                    >
                        <UserCog className="w-4 h-4" />
                        Dành cho Giáo viên
                    </button>
                </div>

                {/* Content */}
                <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {(activeTab === 'student' ? studentSteps : teacherSteps).map((step, idx) => (
                            <div key={idx} className="group relative p-5 bg-slate-50 hover:bg-white rounded-2xl border border-slate-100 hover:border-indigo-200 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/5">
                                <div className="flex items-start gap-4">
                                    <div className={`mt-1 p-2.5 rounded-xl ${getStepStyles(step.color)} group-hover:scale-110 transition-transform duration-500`}>
                                        {step.icon}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Bước {idx + 1}</span>
                                            <CheckCircle2 className="w-3 h-3 text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                        <h4 className="font-bold text-slate-800 mb-1.5">{step.title}</h4>
                                        <p className="text-xs text-slate-500 leading-relaxed font-medium">
                                            {step.desc}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-8 p-5 bg-indigo-50/50 rounded-2xl border border-indigo-100 flex items-start gap-4">
                        <div className="p-2 bg-white rounded-xl shadow-sm">
                            <KeyRound className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                            <h5 className="text-sm font-bold text-indigo-900 mb-1">Mẹo nhỏ</h5>
                            <p className="text-xs text-indigo-700/80 leading-relaxed">
                                {activeTab === 'student'
                                    ? "Bạn có thể dùng chung file .json bài giảng cho bất kỳ máy nào, nhưng mỗi máy cần một mã mở khóa riêng biệt được cấp bởi giáo viên."
                                    : "Hãy luôn lưu giữ file .json dữ liệu của bạn ở một nơi an toàn như Google Drive để có thể phục hồi bài giảng bất cứ khi nào."}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="flex -space-x-2">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="w-6 h-6 rounded-full border-2 border-white bg-slate-200" />
                            ))}
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">+120 học sinh đã tham gia</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="px-8 py-2.5 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-200"
                    >
                        Tôi đã hiểu
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GuideModal;
