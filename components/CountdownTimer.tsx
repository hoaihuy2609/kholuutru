import React, { useState, useEffect } from 'react';
import { Clock, Calendar, Edit2, Check, X, Target } from 'lucide-react';

const CountdownTimer: React.FC = () => {
    const [examDate, setExamDate] = useState<string>(() => {
        return localStorage.getItem('physivault_exam_date') || '';
    });
    const [isEditing, setIsEditing] = useState(false);

    // Mặc định là 8h sáng ngày mai nếu chưa có ngày
    const getDefaultDate = () => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        d.setHours(8, 0, 0, 0);
        return d.toISOString().slice(0, 16);
    };

    const [tempDate, setTempDate] = useState(examDate || getDefaultDate());
    const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

    useEffect(() => {
        if (!examDate) return;
        const calculateTimeLeft = () => {
            const difference = +new Date(examDate) - +new Date();
            if (difference > 0) {
                setTimeLeft({
                    days: Math.floor(difference / (1000 * 60 * 60 * 24)),
                    hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
                    minutes: Math.floor((difference / 1000 / 60) % 60),
                    seconds: Math.floor((difference / 1000) % 60)
                });
            } else {
                setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
            }
        };
        calculateTimeLeft();
        const timer = setInterval(calculateTimeLeft, 1000);
        return () => clearInterval(timer);
    }, [examDate]);

    const handleSave = () => {
        setExamDate(tempDate);
        localStorage.setItem('physivault_exam_date', tempDate);
        setIsEditing(false);
    };

    const hasTargetDate = !!examDate;
    const isExpired = hasTargetDate && +new Date(examDate) <= +new Date();

    return (
        <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-3xl p-6 shadow-xl shadow-indigo-500/5 relative overflow-hidden group transition-all duration-500">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-500/5 rounded-full blur-3xl group-hover:bg-indigo-500/10 transition-colors"></div>

            {!isEditing ? (
                <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
                    <div className="flex items-center gap-4">
                        <div className="p-3.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl text-white shadow-lg shadow-indigo-100 animate-float">
                            <Clock className="w-7 h-7" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 text-xl flex items-center gap-2">
                                Hành trình đến kỳ thi
                                <button
                                    onClick={() => { setTempDate(examDate || getDefaultDate()); setIsEditing(true); }}
                                    className="p-1.5 bg-slate-100 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                    title="Chỉnh sửa ngày thi"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                            </h3>
                            <p className="text-slate-500 font-medium">
                                {hasTargetDate
                                    ? (isExpired ? 'Thời gian đã điểm!' : `Mục tiêu: ${new Date(examDate).toLocaleDateString('vi-VN')} lúc ${new Date(examDate).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`)
                                    : 'Hãy đặt mục tiêu cho kỳ thi sắp tới của bạn'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {!hasTargetDate ? (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-95"
                            >
                                <Target className="w-5 h-5" />
                                Thiết lập ngay
                            </button>
                        ) : (
                            <div className="flex items-center gap-2">
                                {[
                                    { label: 'Ngày', value: timeLeft.days },
                                    { label: 'Giờ', value: timeLeft.hours },
                                    { label: 'Phút', value: timeLeft.minutes },
                                    { label: 'Giây', value: timeLeft.seconds },
                                ].map((item, index) => (
                                    <React.Fragment key={item.label}>
                                        <div className="flex flex-col items-center">
                                            <div className="min-w-[55px] sm:min-w-[70px] h-14 sm:h-20 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-white/80 transition-transform hover:scale-105 duration-300">
                                                <span className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-b from-indigo-700 to-indigo-400">
                                                    {String(item.value).padStart(2, '0')}
                                                </span>
                                            </div>
                                            <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">{item.label}</span>
                                        </div>
                                        {index < 3 && (
                                            <div className="text-2xl font-bold text-indigo-200 pb-6">:</div>
                                        )}
                                    </React.Fragment>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="relative z-10 animate-in fade-in zoom-in-95 duration-300">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <Calendar className="w-6 h-6 text-indigo-600" />
                            Cài đặt mục tiêu thi cử
                        </h3>
                        <button onClick={() => setIsEditing(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="max-w-md">
                        <div className="space-y-4">
                            <label className="block text-sm font-bold text-slate-600 ml-1 uppercase tracking-wider">
                                Chọn ngày & giờ thi dự kiến:
                            </label>
                            <input
                                type="datetime-local"
                                value={tempDate}
                                onChange={(e) => setTempDate(e.target.value)}
                                className="w-full px-5 py-4 rounded-2xl border-2 border-indigo-50 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all text-lg font-bold text-slate-700 bg-white/80 shadow-inner"
                            />
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={handleSave}
                                    className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <Check className="w-6 h-6" />
                                    Xác nhận mục tiêu
                                </button>
                                <button
                                    onClick={() => setIsEditing(false)}
                                    className="px-6 py-4 bg-white text-slate-500 border border-slate-200 rounded-2xl font-bold hover:bg-slate-50 transition-all font-bold"
                                >
                                    Hủy
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CountdownTimer;
