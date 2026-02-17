import React, { useState, useEffect } from 'react';
import { Clock, Calendar, Edit2, Check, X } from 'lucide-react';

const CountdownTimer: React.FC = () => {
    const [examDate, setExamDate] = useState<string>(() => {
        return localStorage.getItem('physivault_exam_date') || '';
    });
    const [isEditing, setIsEditing] = useState(false);
    const [tempDate, setTempDate] = useState(examDate);
    const [timeLeft, setTimeLeft] = useState({
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0
    });

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
        <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-3xl p-6 shadow-xl shadow-indigo-500/5 relative overflow-hidden group">
            {/* Decorative background */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-colors"></div>

            <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl text-white shadow-lg shadow-indigo-200 animate-pulse">
                        <Clock className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                            Đếm ngược kỳ thi
                            {!isEditing && (
                                <button
                                    onClick={() => { setTempDate(examDate); setIsEditing(true); }}
                                    className="p-1.5 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                >
                                    <Edit2 className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </h3>
                        <p className="text-slate-500 text-sm font-medium">
                            {hasTargetDate ? (isExpired ? 'Kỳ thi đã đến!' : 'Thời gian còn lại để ôn tập') : 'Chưa đặt ngày thi'}
                        </p>
                    </div>
                </div>

                {isEditing ? (
                    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4 duration-300">
                        <input
                            type="datetime-local"
                            value={tempDate}
                            onChange={(e) => setTempDate(e.target.value)}
                            className="px-4 py-2 rounded-xl border border-indigo-100 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm font-medium text-slate-700 bg-white"
                        />
                        <button
                            onClick={handleSave}
                            className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-md shadow-indigo-100 transition-all active:scale-95"
                        >
                            <Check className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => setIsEditing(false)}
                            className="p-2.5 bg-white text-slate-400 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all active:scale-95"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center gap-3">
                        {!hasTargetDate ? (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="flex items-center gap-2 px-6 py-2.5 bg-white border border-indigo-100 text-indigo-600 rounded-xl font-bold text-sm hover:bg-indigo-50 hover:shadow-md transition-all active:scale-95"
                            >
                                <Calendar className="w-4 h-4" />
                                Đặt ngày thi ngay
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
                                            <div className="min-w-[50px] sm:min-w-[64px] h-12 sm:h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-white/80 transition-transform hover:scale-105 duration-300">
                                                <span className="text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-b from-slate-800 to-slate-500">
                                                    {String(item.value).padStart(2, '0')}
                                                </span>
                                            </div>
                                            <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">{item.label}</span>
                                        </div>
                                        {index < 3 && (
                                            <div className="text-xl font-bold text-slate-300 pb-6">:</div>
                                        )}
                                    </React.Fragment>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CountdownTimer;
