
import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Bot, User, Loader2, RefreshCw, Copy, Check } from 'lucide-react';
import { getMachineId } from '../src/hooks/useCloudStorage';

interface Message {
    id: string;
    text: string;
    sender: 'bot' | 'user';
    timestamp: number;
}

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzt2gglP1LeDYp73pYSt63_b98doEl7unjERSF1E7vYXlndK6t_cfFgFhw_2O3ewMqs/exec";

const Chatbot: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            text: 'Chào bạn! Mình là trợ lý PhysiVault. Cần mình giúp gì cho bạn hôm nay?',
            sender: 'bot',
            timestamp: Date.now()
        }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [step, setStep] = useState<'intro' | 'ask_phone' | 'done'>('intro');
    const [copySuccess, setCopySuccess] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const addMessage = (text: string, sender: 'bot' | 'user') => {
        const newMessage: Message = {
            id: Date.now().toString(),
            text,
            sender,
            timestamp: Date.now()
        };
        setMessages(prev => [...prev, newMessage]);
    };

    const handleSend = async () => {
        if (!inputValue.trim() || isLoading) return;

        const userText = inputValue.trim();
        setInputValue('');
        addMessage(userText, 'user');

        if (step === 'intro' || step === 'ask_phone') {
            // Kiểm tra định dạng SĐT cơ bản
            if (!/^\d{10,11}$/.test(userText.replace(/\D/g, ''))) {
                setTimeout(() => {
                    addMessage('Vui lòng nhập số điện thoại hợp lệ (10-11 chữ số) đã đăng ký với thầy Huy nhé.', 'bot');
                }, 500);
                return;
            }

            setIsLoading(true);
            try {
                const machineId = getMachineId();
                const response = await fetch(GOOGLE_SCRIPT_URL, {
                    method: 'POST',
                    mode: 'no-cors', // Cần mode no-cors cho Google Apps Script nếu không có CORS header
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        sdt: userText,
                        machineId: machineId
                    })
                });

                // Vì no-cors không đọc được body, chúng ta sẽ phải dùng một mẹo khác hoặc 
                // hy vọng Google Script đã được thiết lập đúng.
                // Thực tế doPost của Google Script trả về JSON, nhưng fetch 'no-cors' sẽ trả về opaque response.
                // Để xịn nhất, ta nên dùng JSONP hoặc chấp nhận fetch bình thường nếu Script cho phép.

                // Thử fetch bình thường trước
                const realResponse = await fetch(GOOGLE_SCRIPT_URL + "?sdt=" + userText + "&machineId=" + machineId);
                const result = await realResponse.json();

                if (result.success) {
                    addMessage(`Xác thực thành công! Mã kích hoạt của bạn là:`, 'bot');
                    addMessage(result.key, 'bot');
                    addMessage('Bạn hãy copy mã này và dán vào phần "Mở khóa học viên" trong Cài đặt nhé.', 'bot');
                    setStep('done');
                } else {
                    addMessage(result.msg || 'Không tìm thấy thông tin của bạn. Bạn đã đóng học phí chưa nhỉ?', 'bot');
                }
            } catch (error) {
                console.error(error);
                addMessage('Có lỗi kết nối với "bộ não" của thầy Huy. Bạn thử nhắn lại SĐT xem sao nhé.', 'bot');
            } finally {
                setIsLoading(false);
            }
        }
    };

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    };

    return (
        <div className="fixed bottom-6 right-6 z-[100] font-sans">
            {/* Chat Bubble Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 transform active:scale-95 ${isOpen
                    ? 'bg-slate-800 rotate-90'
                    : 'bg-gradient-to-tr from-orange-500 to-amber-500 hover:shadow-orange-500/40'
                    }`}
            >
                {isOpen ? <X className="text-white w-6 h-6" /> : <MessageCircle className="text-white w-7 h-7 animate-pulse-subtle" />}
            </button>

            {/* Chat Window */}
            {isOpen && (
                <div className="absolute bottom-20 right-0 w-[350px] max-w-[calc(100vw-3rem)] h-[500px] bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 overflow-hidden flex flex-col animate-scale-in origin-bottom-right">
                    {/* Header */}
                    <div className="p-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-md">
                            <Bot className="w-6 h-6" />
                        </div>
                        <div>
                            <h4 className="font-bold text-sm">PhysiVault AI</h4>
                            <div className="flex items-center gap-1">
                                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                                <span className="text-[10px] opacity-80">Đang trực tuyến</span>
                            </div>
                        </div>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-50/50">
                        {messages.map((msg) => (
                            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                                <div className={`flex gap-2 max-w-[85%] ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${msg.sender === 'user' ? 'bg-indigo-100 text-indigo-600' : 'bg-orange-100 text-orange-600'
                                        }`}>
                                        {msg.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                                    </div>
                                    <div className={`p-3 rounded-2xl text-sm leading-relaxed shadow-sm ${msg.sender === 'user'
                                        ? 'bg-indigo-600 text-white rounded-tr-none'
                                        : 'bg-white text-slate-700 rounded-tl-none border border-slate-100'
                                        }`}>
                                        {msg.text.startsWith('PV-') ? (
                                            <div className="flex items-center gap-2">
                                                <code className="font-mono font-bold text-base">{msg.text}</code>
                                                <button
                                                    onClick={() => handleCopy(msg.text)}
                                                    className="p-1 hover:bg-black/5 rounded group transition-colors"
                                                >
                                                    {copySuccess ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 opacity-50 group-hover:opacity-100" />}
                                                </button>
                                            </div>
                                        ) : msg.text}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex justify-start animate-fade-in">
                                <div className="flex gap-2 items-center bg-white/50 p-2 rounded-xl border border-slate-100">
                                    <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                                    <span className="text-xs text-slate-400 italic">Đang check danh sách...</span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-4 bg-white border-t border-slate-100">
                        <div className="relative flex items-center gap-2">
                            <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                placeholder={step === 'done' ? 'Cảm ơn bạn nhé!' : "Nhập số điện thoại..."}
                                disabled={step === 'done'}
                                className="flex-1 bg-slate-100 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-500/20 outline-none transition-all pr-12"
                            />
                            <button
                                onClick={handleSend}
                                disabled={!inputValue.trim() || isLoading || step === 'done'}
                                className="absolute right-1 w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center hover:bg-orange-600 disabled:opacity-50 disabled:hover:bg-orange-50 transition-all shadow-md shadow-orange-200 active:scale-90"
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="mt-2 flex items-center justify-center gap-4 text-[10px] text-slate-400 font-medium">
                            <span className="flex items-center gap-1 italic"><RefreshCw className="w-3 h-3" /> Tự động 24/7</span>
                            <span className="flex items-center gap-1 italic"><Bot className="w-3 h-3" /> Chặn dùng chung</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Chatbot;
