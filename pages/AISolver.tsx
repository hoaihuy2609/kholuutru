import React, { useState } from 'react';
import { Sparkles, Upload, FileImage, X, Download, Copy, Check } from 'lucide-react';

enum AppStatus {
    IDLE = 'idle',
    SOLVING = 'solving',
    SUCCESS = 'success',
    ERROR = 'error'
}

interface ImageData {
    base64: string;
    mimeType: string;
    preview: string;
}

const AISolver: React.FC = () => {
    const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
    const [error, setError] = useState<string | null>(null);
    const [latexResult, setLatexResult] = useState<string>('');
    const [images, setImages] = useState<ImageData[]>([]);
    const [copied, setCopied] = useState(false);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const newImages: ImageData[] = [];
        const maxFiles = Math.min(files.length, 5);

        for (let i = 0; i < maxFiles; i++) {
            const file = files[i];
            const reader = new FileReader();

            reader.onload = (event) => {
                const base64 = event.target?.result as string;
                newImages.push({
                    base64: base64.split(',')[1],
                    mimeType: file.type,
                    preview: base64
                });

                if (newImages.length === maxFiles) {
                    setImages(prev => [...prev, ...newImages]);
                }
            };

            reader.readAsDataURL(file);
        }
    };

    const removeImage = (index: number) => {
        setImages(prev => prev.filter((_, i) => i !== index));
    };

    const handleSolve = async () => {
        if (images.length === 0) return;

        setStatus(AppStatus.SOLVING);
        setError(null);

        try {
            // Placeholder - Cần API key Gemini
            const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

            if (!apiKey) {
                throw new Error('Vui lòng thêm VITE_GEMINI_API_KEY vào file .env.local');
            }

            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [
                                { text: "Giải chi tiết các bài toán/vật lý trong ảnh và xuất kết quả dưới dạng LaTeX. Bao gồm: đề bài, lời giải từng bước, công thức LaTeX." },
                                ...images.map(img => ({
                                    inline_data: {
                                        mime_type: img.mimeType,
                                        data: img.base64
                                    }
                                }))
                            ]
                        }]
                    })
                }
            );

            const data = await response.json();
            const result = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

            setLatexResult(result);
            setStatus(AppStatus.SUCCESS);
        } catch (err: any) {
            setError(err.message || 'Đã xảy ra lỗi không xác định');
            setStatus(AppStatus.ERROR);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(latexResult);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-8 text-white">
                <div className="flex items-center gap-3 mb-3">
                    <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                        <Sparkles className="w-8 h-8" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold">AI Solver</h1>
                        <p className="text-purple-100 mt-1">Giải toán & vật lý tự động với AI</p>
                    </div>
                </div>
            </div>

            {/* Upload Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">1. Tải lên đề bài</h2>
                <p className="text-gray-500 mb-4">Chọn tối đa 5 ảnh bài tập toán/lý từ máy của bạn</p>

                <label className="block">
                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-indigo-400 hover:bg-indigo-50/50 transition-all cursor-pointer">
                        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-600 font-medium">Click để chọn ảnh</p>
                        <p className="text-sm text-gray-400 mt-1">PNG, JPG, JPEG (Tối đa 5 ảnh)</p>
                    </div>
                    <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageUpload}
                        className="hidden"
                        disabled={status === AppStatus.SOLVING}
                    />
                </label>

                {/* Image Preview */}
                {images.length > 0 && (
                    <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-4">
                        {images.map((img, idx) => (
                            <div key={idx} className="relative group">
                                <img
                                    src={img.preview}
                                    alt={`Preview ${idx + 1}`}
                                    className="w-full h-32 object-cover rounded-lg border-2 border-gray-200"
                                />
                                <button
                                    onClick={() => removeImage(idx)}
                                    className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                                <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                                    #{idx + 1}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Solve Button */}
                <button
                    onClick={handleSolve}
                    disabled={images.length === 0 || status === AppStatus.SOLVING}
                    className={`mt-6 w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all ${images.length === 0 || status === AppStatus.SOLVING
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg hover:-translate-y-1'
                        }`}
                >
                    {status === AppStatus.SOLVING ? (
                        <>
                            <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                            Đang xử lý {images.length} câu hỏi...
                        </>
                    ) : (
                        <>
                            <Sparkles className="w-6 h-6" />
                            Giải {images.length > 0 ? `${images.length} Bài` : 'Ngay'} & Xuất LaTeX
                        </>
                    )}
                </button>

                {/* Error */}
                {error && (
                    <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
                        {error}
                    </div>
                )}
            </div>

            {/* Result Section */}
            {status === AppStatus.SUCCESS && latexResult && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 animate-scale-in">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-gray-800">2. Kết quả LaTeX</h2>
                        <button
                            onClick={copyToClipboard}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors"
                        >
                            {copied ? (
                                <>
                                    <Check className="w-4 h-4" />
                                    Đã sao chép!
                                </>
                            ) : (
                                <>
                                    <Copy className="w-4 h-4" />
                                    Sao chép
                                </>
                            )}
                        </button>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-6 font-mono text-sm overflow-x-auto">
                        <pre className="whitespace-pre-wrap">{latexResult}</pre>
                    </div>

                    <div className="mt-4 flex gap-3">
                        <button className="flex-1 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2">
                            <Download className="w-5 h-5" />
                            Tải xuống .tex
                        </button>
                        <button className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
                            <FileImage className="w-5 h-5" />
                            Xuất PDF
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AISolver;
