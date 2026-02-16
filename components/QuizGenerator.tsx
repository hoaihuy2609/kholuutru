import React, { useState, useEffect } from 'react';
import { Sparkles, FileQuestion, Check, Copy, Share2, PlayCircle, Clock, AlertCircle } from 'lucide-react';
import { StoredFile } from '../types';

interface QuizGeneratorProps {
    lessonName: string;
    files: StoredFile[];
    onClose: () => void;
}

interface Question {
    id: number;
    text: string;
    options: string[];
    correctAnswer: number; // Index 0-3
    explanation: string;
}

const MOCK_QUESTIONS: Question[] = [
    {
        id: 1,
        text: "Một vật dao động điều hòa với biên độ A = 4cm, tần số f = 10Hz. Vận tốc cực đại của vật là?",
        options: ["80π cm/s", "40π cm/s", "20π cm/s", "10π cm/s"],
        correctAnswer: 0,
        explanation: "Vận tốc cực đại v_max = ωA = 2πf.A = 2π.10.4 = 80π cm/s."
    },
    {
        id: 2,
        text: "Chọn câu sai khi nói về dao động điều hòa:",
        options: [
            "Gia tốc biến đổi điều hòa sớm pha π/2 so với vận tốc.",
            "Vận tốc biến đổi điều hòa sớm pha π/2 so với li độ.",
            "Gia tốc biến đổi điều hòa ngược pha so với li độ.",
            "Vận tốc biến đổi điều hòa cùng pha so với li độ."
        ],
        correctAnswer: 3,
        explanation: "Vận tốc sớm pha π/2 so với li độ, nên không thể cùng pha."
    },
    {
        id: 3,
        text: "Trong dao động điều hòa, động năng của vật biến thiên tuần hoàn với chu kỳ T' bằng:",
        options: ["T", "T/2", "2T", "T/4"],
        correctAnswer: 1,
        explanation: "Động năng và thế năng biến thiên tuần hoàn với tần số f' = 2f và chu kỳ T' = T/2."
    },
    {
        id: 4,
        text: "Một con lắc lò xo gồm vật nặng m = 100g và lò xo có độ cứng k = 40N/m. Chu kỳ dao động của con lắc là:",
        options: ["0.314s", "0.628s", "0.157s", "0.4s"],
        correctAnswer: 0,
        explanation: "T = 2π√(m/k) = 2π√(0.1/40) = 2π√(1/400) = 2π(1/20) = π/10 ≈ 0.314s."
    },
    {
        id: 5,
        text: "Khi nói về năng lượng của một vật dao động điều hòa, phát biểu nào sau đây là đúng?",
        options: [
            "Cứ mỗi chu kỳ dao động, có 4 thời điểm động năng bằng thế năng.",
            "Thế năng của vật đạt cực đại khi vật ở vị trí cân bằng.",
            "Động năng của vật đạt cực đại khi vật ở biên.",
            "Thế năng và động năng của vật biến thiên cùng tần số với li độ."
        ],
        correctAnswer: 0,
        explanation: "Trong một chu kỳ, có 4 lần Wđ = Wt tại các vị trí x = ±A/√2."
    }
];

const QuizGenerator: React.FC<QuizGeneratorProps> = ({ lessonName, files, onClose }) => {
    const [step, setStep] = useState<'idle' | 'analyzing' | 'generating' | 'complete'>('idle');
    const [progress, setProgress] = useState(0);
    const [generatedLink, setGeneratedLink] = useState('');
    const [isCopied, setIsCopied] = useState(false);

    useEffect(() => {
        if (step === 'analyzing') {
            const interval = setInterval(() => {
                setProgress(prev => {
                    if (prev >= 100) {
                        clearInterval(interval);
                        setStep('generating');
                        return 0;
                    }
                    return prev + 5;
                });
            }, 100);
            return () => clearInterval(interval);
        }

        if (step === 'generating') {
            const interval = setInterval(() => {
                setProgress(prev => {
                    if (prev >= 100) {
                        clearInterval(interval);
                        setStep('complete');
                        setGeneratedLink(`https://physivault.app/exam/${Math.random().toString(36).substr(2, 9)}`);
                        return 100;
                    }
                    return prev + 10;
                });
            }, 150);
            return () => clearInterval(interval);
        }
    }, [step]);

    const handleCreateQuiz = () => {
        setStep('analyzing');
    };

    const handleCopyLink = () => {
        navigator.clipboard.writeText(generatedLink);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-1 bg-white/20 rounded-lg text-xs font-bold backdrop-blur-md border border-white/20">
                                AI Beta
                            </span>
                            <span className="text-white/80 text-sm font-medium">Auto Quiz Generator</span>
                        </div>
                        <h3 className="text-2xl font-bold">Tạo bài kiểm tra tự động</h3>
                        <p className="text-indigo-100 text-sm mt-1">Dựa trên {files.length} tài liệu của bài: {lessonName}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-8 flex-1 overflow-y-auto">

                    {step === 'idle' && (
                        <div className="text-center space-y-6">
                            <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4 animate-float">
                                <Sparkles className="w-12 h-12 text-indigo-600" />
                            </div>
                            <div>
                                <h4 className="text-xl font-bold text-slate-800 mb-2">Sẵn sàng tạo đề thi?</h4>
                                <p className="text-slate-500 max-w-md mx-auto">
                                    Hệ thống AI sẽ phân tích nội dung từ {files.length} file PDF bạn đã tải lên để tạo ra bộ câu hỏi trắc nghiệm tổng hợp.
                                </p>
                            </div>

                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-left">
                                <h5 className="font-semibold text-slate-700 mb-2 flex items-center gap-2">
                                    <FileQuestion className="w-4 h-4" /> Cấu trúc đề dự kiến:
                                </h5>
                                <ul className="space-y-2 text-sm text-slate-600">
                                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> 10 câu hỏi trắc nghiệm</li>
                                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> Cấp độ: Nhận biết - Thông hiểu - Vận dụng</li>
                                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> Có lời giải chi tiết từng câu</li>
                                </ul>
                            </div>

                            <button
                                onClick={handleCreateQuiz}
                                disabled={files.length === 0}
                                className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold text-lg hover:shadow-xl hover:-translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {files.length === 0 ? "Vui lòng tải lên tài liệu trước" : "Bắt đầu tạo đề ngay"}
                            </button>
                        </div>
                    )}

                    {(step === 'analyzing' || step === 'generating') && (
                        <div className="text-center py-10">
                            <div className="relative w-32 h-32 mx-auto mb-8">
                                <svg className="w-full h-full transform -rotate-90">
                                    <circle
                                        cx="64"
                                        cy="64"
                                        r="60"
                                        stroke="currentColor"
                                        strokeWidth="8"
                                        fill="transparent"
                                        className="text-slate-100"
                                    />
                                    <circle
                                        cx="64"
                                        cy="64"
                                        r="60"
                                        stroke="currentColor"
                                        strokeWidth="8"
                                        fill="transparent"
                                        strokeDasharray={377}
                                        strokeDashoffset={377 - (377 * progress) / 100}
                                        className={`text-indigo-600 transition-all duration-300 ${step === 'generating' ? 'text-purple-600' : ''}`}
                                    />
                                </svg>
                                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-2xl font-bold text-slate-700">
                                    {progress}%
                                </div>
                            </div>
                            <h4 className="text-xl font-bold text-slate-800 animate-pulse">
                                {step === 'analyzing' ? 'Đang phân tích tài liệu...' : 'Đang soạn câu hỏi...'}
                            </h4>
                            <p className="text-slate-500 mt-2">
                                {step === 'analyzing'
                                    ? 'AI đang đọc nội dung các file PDF của bạn'
                                    : 'Đang tổng hợp kiến thức và tạo đáp án chi tiết'}
                            </p>
                        </div>
                    )}

                    {step === 'complete' && (
                        <div className="space-y-6">
                            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3 text-green-800">
                                <div className="bg-green-100 p-2 rounded-full">
                                    <Check className="w-5 h-5 text-green-600" />
                                </div>
                                <span className="font-semibold">Đã tạo bài kiểm tra thành công!</span>
                            </div>

                            <div className="border border-slate-200 rounded-xl overflow-hidden">
                                <div className="bg-slate-50 p-3 border-b border-slate-200 flex justify-between items-center">
                                    <span className="font-semibold text-slate-700">Xem trước (5 câu đầu)</span>
                                    <span className="text-xs px-2 py-1 bg-white border rounded text-slate-500">Mã đề: PHY-{Math.floor(Math.random() * 1000)}</span>
                                </div>
                                <div className="max-h-60 overflow-y-auto p-4 space-y-4 bg-white">
                                    {MOCK_QUESTIONS.map((q, idx) => (
                                        <div key={q.id} className="pb-4 border-b border-slate-100 last:border-0 last:pb-0">
                                            <p className="font-medium text-slate-800 mb-2">Câu {idx + 1}: {q.text}</p>
                                            <div className="grid grid-cols-2 gap-2">
                                                {q.options.map((opt, i) => (
                                                    <div key={i} className={`text-sm p-2 rounded border ${i === q.correctAnswer ? 'bg-green-50 border-green-200 text-green-800' : 'bg-slate-50 border-slate-100 text-slate-600'}`}>
                                                        {String.fromCharCode(65 + i)}. {opt}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-indigo-50 rounded-xl p-6 border border-indigo-100 text-center">
                                <h5 className="font-bold text-indigo-900 mb-1">Chia sẻ bài kiểm tra này</h5>
                                <p className="text-indigo-600/80 text-sm mb-4">Gửi link này cho học sinh để làm bài trực tuyến</p>

                                <div className="flex gap-2">
                                    <div className="flex-1 bg-white border border-indigo-200 rounded-lg px-4 py-3 text-slate-600 text-sm truncate flex items-center">
                                        {generatedLink}
                                    </div>
                                    <button
                                        onClick={handleCopyLink}
                                        className="px-6 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors flex items-center gap-2 min-w-[140px] justify-center"
                                    >
                                        {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                        {isCopied ? "Đã copy" : "Copy Link"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default QuizGenerator;
