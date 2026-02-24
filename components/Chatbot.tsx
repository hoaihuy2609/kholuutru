
import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Bot, User, Loader2, RefreshCw, Copy, Check } from 'lucide-react';
import { getMachineId } from '../src/hooks/useCloudStorage';

interface Message {
    id: string;
    text: string;
    sender: 'bot' | 'user';
    timestamp: number;
}

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwnnT7SdQmDy9nJsGytSYtOviOl8zYLDFTT1Kc2qZ26hu1yfinIE6LIgpCzVKvZSGsv/exec";

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

    const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    useEffect(() => { scrollToBottom(); }, [messages]);

    const addMessage = (text: string, sender: 'bot' | 'user') => {
        setMessages(prev => [...prev, { id: Date.now().toString(), text, sender, timestamp: Date.now() }]);
    };

    const handleSend = async () => {
        if (!inputValue.trim() || isLoading) return;
        const userText = inputValue.trim();
        setInputValue('');
        addMessage(userText, 'user');

        if (step === 'intro' || step === 'ask_phone') {
            if (!/^\d{10,11}$/.test(userText.replace(/\D/g, ''))) {
                setTimeout(() => addMessage('Vui lòng nhập số điện thoại hợp lệ (10-11 chữ số) đã đăng ký với thầy Huy nhé.', 'bot'), 500);
                return;
            }
            setIsLoading(true);
            try {
                const machineId = getMachineId();
                await fetch(GOOGLE_SCRIPT_URL, {
                    method: 'POST', mode: 'no-cors',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sdt: userText, machineId })
                });
                const realResponse = await fetch(GOOGLE_SCRIPT_URL + "?sdt=" + userText + "&machineId=" + machineId);
                const result = await realResponse.json();

                if (result.success) {
                    addMessage('Xác thực thành công! Mã kích hoạt của bạn là:', 'bot');
                    addMessage(result.key, 'bot');
                    addMessage('Bạn hãy copy mã này và dán vào phần "Mở khóa học viên" trong Cài đặt nhé.', 'bot');
                    localStorage.setItem('pv_pending_sdt', userText);
                    setStep('done');
                } else {
                    addMessage(result.msg || 'Không tìm thấy thông tin của bạn. Bạn đã đóng học phí chưa nhỉ?', 'bot');
                }
            } catch {
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
        <div className="fixed bottom-6 right-6 z-40 font-sans">
            {/* Toggle button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-13 h-13 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 active:scale-95"
                style={{
                    width: '52px', height: '52px',
                    background: isOpen ? '#1A1A1A' : '#2D2D2D',
                    border: '1px solid rgba(255,255,255,0.1)',
                }}
            >
                {isOpen
                    ? <X className="text-white w-5 h-5" />
                    : <MessageCircle className="text-white w-6 h-6" />}
            </button>

            {/* Chat window */}
            {isOpen && (
                <div
                    className="absolute bottom-16 right-0 flex flex-col overflow-hidden animate-scale-in origin-bottom-right"
                    style={{
                        width: '340px',
                        maxWidth: 'calc(100vw - 3rem)',
                        height: '480px',
                        background: '#FFFFFF',
                        border: '1px solid #E9E9E7',
                        borderRadius: '12px',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                    }}
                >
                    {/* Header */}
                    <div
                        className="flex items-center gap-3 px-4 py-3 shrink-0"
                        style={{ borderBottom: '1px solid #E9E9E7', borderTop: '3px solid #D9730D' }}
                    >
                        <div className="p-2 rounded-lg" style={{ background: '#FFF3E8' }}>
                            <Bot className="w-4 h-4" style={{ color: '#D9730D' }} />
                        </div>
                        <div>
                            <h4 className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>PhysiVault AI</h4>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                <span className="text-[10px]" style={{ color: '#787774' }}>Đang trực tuyến</span>
                            </div>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar" style={{ background: '#FAFAF9' }}>
                        {messages.map(msg => (
                            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                                <div className={`flex gap-2 max-w-[85%] ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                    {/* Avatar */}
                                    <div
                                        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                                        style={{
                                            background: msg.sender === 'user' ? '#EEF0FB' : '#FFF3E8',
                                            color: msg.sender === 'user' ? '#6B7CDB' : '#D9730D',
                                        }}
                                    >
                                        {msg.sender === 'user'
                                            ? <User className="w-3.5 h-3.5" />
                                            : <Bot className="w-3.5 h-3.5" />}
                                    </div>
                                    {/* Bubble */}
                                    <div
                                        className="px-3 py-2 text-sm leading-relaxed"
                                        style={{
                                            borderRadius: msg.sender === 'user'
                                                ? '12px 2px 12px 12px'
                                                : '2px 12px 12px 12px',
                                            background: msg.sender === 'user' ? '#2D2D2D' : '#FFFFFF',
                                            color: msg.sender === 'user' ? '#FFFFFF' : '#1A1A1A',
                                            border: msg.sender === 'user' ? 'none' : '1px solid #E9E9E7',
                                        }}
                                    >
                                        {msg.text.startsWith('PV-') ? (
                                            <div className="flex items-center gap-2">
                                                <code className="font-mono font-semibold">{msg.text}</code>
                                                <button
                                                    onClick={() => handleCopy(msg.text)}
                                                    className="p-1 rounded transition-colors"
                                                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F1F0EC'}
                                                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                                                >
                                                    {copySuccess
                                                        ? <Check className="w-3.5 h-3.5" style={{ color: '#448361' }} />
                                                        : <Copy className="w-3.5 h-3.5" style={{ color: '#AEACA8' }} />}
                                                </button>
                                            </div>
                                        ) : msg.text}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Loading indicator */}
                        {isLoading && (
                            <div className="flex justify-start animate-fade-in">
                                <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: '#FFFFFF', border: '1px solid #E9E9E7' }}>
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" style={{ color: '#D9730D' }} />
                                    <span className="text-xs italic" style={{ color: '#787774' }}>Đang check danh sách...</span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input area */}
                    <div className="p-3 shrink-0" style={{ borderTop: '1px solid #E9E9E7', background: '#FFFFFF' }}>
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={inputValue}
                                onChange={e => setInputValue(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSend()}
                                placeholder={step === 'done' ? 'Cảm ơn bạn nhé!' : 'Nhập số điện thoại...'}
                                disabled={step === 'done'}
                                className="flex-1 text-sm outline-none transition-colors"
                                style={{
                                    background: '#F7F6F3',
                                    border: '1px solid #E9E9E7',
                                    borderRadius: '8px',
                                    padding: '8px 12px',
                                    color: '#1A1A1A',
                                }}
                                onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = '#D9730D'}
                                onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = '#E9E9E7'}
                            />
                            <button
                                onClick={handleSend}
                                disabled={!inputValue.trim() || isLoading || step === 'done'}
                                className="p-2.5 rounded-lg text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                style={{ background: '#D9730D' }}
                                onMouseEnter={e => !((e.currentTarget as HTMLButtonElement).disabled) && ((e.currentTarget as HTMLElement).style.background = '#c4650b')}
                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#D9730D'}
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </div>
                        {/* Footer hints */}
                        <div className="mt-2 flex items-center justify-center gap-4 text-[10px]" style={{ color: '#AEACA8' }}>
                            <span className="flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Tự động 24/7</span>
                            <span className="flex items-center gap-1"><Bot className="w-3 h-3" /> Chặn dùng chung</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Chatbot;
