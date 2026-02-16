import React, { useState, useRef } from 'react';
import { Upload, Scissors, Download, RefreshCw, AlertCircle, Search, X, ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react';

enum AppStatus {
    IDLE = 'idle',
    UPLOADING = 'uploading',
    PROCESSING = 'processing',
    SUCCESS = 'success',
    ERROR = 'error'
}

interface CroppedResult {
    id: string;
    dataUrl: string;
    label: string;
}

const SmartCrop: React.FC = () => {
    const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
    const [image, setImage] = useState<string | null>(null);
    const [prompt, setPrompt] = useState<string>('Cắt toàn bộ các câu hỏi trong đề bài này');
    const [results, setResults] = useState<CroppedResult[]>([]);
    const [previewIdx, setPreviewIdx] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState<number>(0);
    const [fileName, setFileName] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setFileName(file.name);
        setStatus(AppStatus.UPLOADING);
        setError(null);
        setResults([]);

        const reader = new FileReader();
        reader.onload = (event) => {
            setImage(event.target?.result as string);
            setStatus(AppStatus.IDLE);
        };
        reader.readAsDataURL(file);
    };

    const handleProcess = async () => {
        if (!image || !prompt) return;

        setStatus(AppStatus.PROCESSING);
        setProgress(10);
        setError(null);

        try {
            // Placeholder - Cần API key Gemini
            const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

            if (!apiKey) {
                throw new Error('Vui lòng thêm VITE_GEMINI_API_KEY vào file .env.local');
            }

            setProgress(30);

            // Giả lập kết quả (thực tế cần gọi API Gemini)
            await new Promise(resolve => setTimeout(resolve, 2000));

            setProgress(80);

            // Mock results
            const mockResults: CroppedResult[] = [
                {
                    id: '1',
                    dataUrl: image,
                    label: 'Câu 1'
                },
                {
                    id: '2',
                    dataUrl: image,
                    label: 'Câu 2'
                }
            ];

            setResults(mockResults);
            setProgress(100);
            setStatus(AppStatus.SUCCESS);
        } catch (err: any) {
            setError(err.message || 'Đã xảy ra lỗi trong quá trình xử lý');
            setStatus(AppStatus.ERROR);
        }
    };

    const handleDownloadZip = () => {
        // Placeholder for ZIP download
        alert('Tính năng tải ZIP sẽ được bổ sung sau khi có API key Gemini');
    };

    const reset = () => {
        setImage(null);
        setResults([]);
        setStatus(AppStatus.IDLE);
        setFileName(null);
        setPreviewIdx(null);
        setPrompt('Cắt toàn bộ các câu hỏi trong đề bài này');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-600 to-teal-600 rounded-2xl p-8 text-white">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                            <Scissors className="w-8 h-8" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold">SmartCrop AI</h1>
                            <p className="text-green-100 mt-1">Cắt ảnh thông minh với AI</p>
                        </div>
                    </div>
                    <button
                        onClick={reset}
                        className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors flex items-center gap-2"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Làm mới
                    </button>
                </div>
            </div>

            {/* Upload Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <span className="w-7 h-7 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-sm">1</span>
                    Tải file (Ảnh/PDF) và nhập yêu cầu
                </h2>

                <div className="grid md:grid-cols-2 gap-6">
                    {/* Image Upload */}
                    <div className="space-y-4">
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className={`relative aspect-video rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${image ? 'border-green-300 bg-green-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
                                }`}
                        >
                            {status === AppStatus.UPLOADING ? (
                                <div className="flex flex-col items-center">
                                    <RefreshCw className="w-8 h-8 text-green-500 animate-spin mb-2" />
                                    <p className="text-sm text-gray-500">Đang chuẩn bị file...</p>
                                </div>
                            ) : image ? (
                                <div className="relative w-full h-full flex items-center justify-center p-4">
                                    <img src={image} className="w-full h-full object-contain rounded-lg shadow-sm" alt="Preview" />
                                </div>
                            ) : (
                                <>
                                    <Upload className="w-10 h-10 text-gray-400 mb-2" />
                                    <p className="text-sm text-gray-500 font-medium">Nhấn để tải lên</p>
                                    <p className="text-xs text-gray-400 mt-1">Ảnh hoặc PDF đề bài</p>
                                </>
                            )}
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                accept="image/*,application/pdf"
                                className="hidden"
                            />
                        </div>
                    </div>

                    {/* Prompt Input */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                                <Search className="w-4 h-4" />
                                AI cần cắt gì từ file này?
                            </label>
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="VD: Cắt toàn bộ các câu hỏi trong đề này..."
                                className="w-full min-h-[120px] px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all text-gray-800 placeholder:text-gray-400 resize-none"
                            />
                        </div>

                        <button
                            onClick={handleProcess}
                            disabled={!image || !prompt || status === AppStatus.PROCESSING}
                            className={`w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${!image || !prompt || status === AppStatus.PROCESSING
                                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    : 'bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-200 active:scale-95'
                                }`}
                        >
                            {status === AppStatus.PROCESSING ? (
                                <>
                                    <RefreshCw className="w-5 h-5 animate-spin" />
                                    Đang xử lý {progress}%...
                                </>
                            ) : (
                                <>
                                    <Scissors className="w-5 h-5" />
                                    Cắt toàn bộ
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Processing Progress */}
            {status === AppStatus.PROCESSING && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="bg-blue-400 p-2 rounded-full">
                            <RefreshCw className="w-4 h-4 text-white animate-spin" />
                        </div>
                        <p className="text-sm text-blue-700 font-medium">
                            Gemini đang trích xuất dữ liệu. Vui lòng đợi trong giây lát...
                        </p>
                    </div>
                    <div className="w-full bg-blue-100 rounded-full h-2 mt-2">
                        <div className="bg-blue-500 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                    </div>
                </div>
            )}

            {/* Error */}
            {status === AppStatus.ERROR && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <p className="text-sm text-red-700 font-medium">{error}</p>
                </div>
            )}

            {/* Results */}
            {results.length > 0 && (
                <div className="animate-scale-in">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-semibold flex items-center gap-2">
                            <span className="w-7 h-7 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-sm">2</span>
                            Kết quả trích xuất ({results.length})
                        </h2>
                        <button
                            onClick={handleDownloadZip}
                            className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-gray-800 transition-all active:scale-95"
                        >
                            <Download className="w-4 h-4" />
                            Tải ZIP
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {results.map((res, idx) => (
                            <div
                                key={res.id}
                                onClick={() => setPreviewIdx(idx)}
                                className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm group hover:border-green-400 hover:shadow-md transition-all cursor-zoom-in active:scale-[0.98]"
                            >
                                <div className="relative aspect-auto max-h-[300px] overflow-hidden rounded-lg bg-gray-100">
                                    <img src={res.dataUrl} className="w-full h-full object-contain transition-transform group-hover:scale-[1.02]" alt={res.label} />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 flex items-center justify-center transition-all">
                                        <Maximize2 className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 drop-shadow-md" />
                                    </div>
                                </div>
                                <div className="mt-3 flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase truncate max-w-[80%]" title={res.label}>{res.label}</span>
                                    <span className="text-[10px] text-green-400 font-medium">#{idx + 1}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Preview Modal */}
            {previewIdx !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm p-4 animate-fade-in">
                    <button
                        onClick={() => setPreviewIdx(null)}
                        className="absolute top-6 right-6 text-white/70 hover:text-white transition-colors p-2 bg-white/10 hover:bg-white/20 rounded-lg"
                    >
                        <X className="w-6 h-6" />
                    </button>

                    <button
                        onClick={() => setPreviewIdx(previewIdx === 0 ? results.length - 1 : previewIdx - 1)}
                        className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 p-4 rounded-full text-white transition-all"
                    >
                        <ChevronLeft className="w-8 h-8" />
                    </button>

                    <div className="w-full h-full flex flex-col items-center justify-center">
                        <img
                            src={results[previewIdx].dataUrl}
                            className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
                            alt="Preview Full"
                        />
                        <div className="mt-6 text-center">
                            <p className="text-white font-medium text-lg">{results[previewIdx].label}</p>
                            <p className="text-white/50 text-sm mt-1">Ảnh {previewIdx + 1} / {results.length}</p>
                        </div>
                    </div>

                    <button
                        onClick={() => setPreviewIdx(previewIdx === results.length - 1 ? 0 : previewIdx + 1)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 p-4 rounded-full text-white transition-all"
                    >
                        <ChevronRight className="w-8 h-8" />
                    </button>
                </div>
            )}
        </div>
    );
};

export default SmartCrop;
