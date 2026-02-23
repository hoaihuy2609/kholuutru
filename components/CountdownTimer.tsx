import React, { useState, useEffect } from 'react';
import { Clock, Calendar, Edit2, Check, X, Target } from 'lucide-react';

interface CountdownTimerProps {
    isAdmin?: boolean;
}

const CountdownTimer: React.FC<CountdownTimerProps> = ({ isAdmin }) => {
    const [examDate, setExamDate] = useState<string>(() =>
        localStorage.getItem('physivault_exam_date') || ''
    );
    const [isEditing, setIsEditing] = useState(false);

    const getDefaultDate = () => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        d.setHours(8, 0, 0, 0);
        return d.toISOString().slice(0, 16);
    };

    const [tempDate, setTempDate] = useState(examDate || getDefaultDate());
    const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (!examDate) return;
        const calc = () => {
            const diff = +new Date(examDate) - +new Date();
            setTimeLeft(diff > 0 ? {
                days: Math.floor(diff / (1000 * 60 * 60 * 24)),
                hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
                minutes: Math.floor((diff / 1000 / 60) % 60),
                seconds: Math.floor((diff / 1000) % 60),
            } : { days: 0, hours: 0, minutes: 0, seconds: 0 });
        };
        calc();
        const t = setInterval(calc, 1000);
        return () => clearInterval(t);
    }, [examDate]);

    const handleSave = () => {
        setExamDate(tempDate);
        localStorage.setItem('physivault_exam_date', tempDate);
        setIsEditing(false);
    };

    const hasTargetDate = !!examDate;
    const isExpired = hasTargetDate && +new Date(examDate) <= +new Date();

    return (
        <div
            className="rounded-xl p-5 transition-colors"
            style={{ background: '#FFFFFF', border: '1px solid #E9E9E7' }}
        >
            {!isEditing ? (
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    {/* Left: clock + label */}
                    <div className="flex items-center gap-4">
                        {/* Clock widget */}
                        <div
                            className="flex flex-col items-center justify-center px-4 py-2.5 rounded-lg shrink-0"
                            style={{ background: '#F7F6F3', border: '1px solid #E9E9E7', minWidth: '80px' }}
                        >
                            <div className="text-sm font-semibold tabular-nums" style={{ color: '#1A1A1A', letterSpacing: '0.05em' }}>
                                {currentTime.getHours().toString().padStart(2, '0')}
                                <span className="text-[#AEACA8]">:</span>
                                {currentTime.getMinutes().toString().padStart(2, '0')}
                                <span className="text-xs ml-1 tabular-nums" style={{ color: '#AEACA8' }}>
                                    {currentTime.getSeconds().toString().padStart(2, '0')}
                                </span>
                            </div>
                            <div className="text-[9px] uppercase tracking-widest mt-0.5" style={{ color: '#AEACA8' }}>
                                Real-time
                            </div>
                        </div>

                        <div>
                            <h3 className="font-semibold flex items-center gap-2" style={{ color: '#1A1A1A' }}>
                                Hành trình đến kỳ thi
                                {isAdmin && (
                                    <button
                                        onClick={() => { setTempDate(examDate || getDefaultDate()); setIsEditing(true); }}
                                        className="p-1.5 rounded-md transition-colors"
                                        style={{ color: '#AEACA8' }}
                                        onMouseEnter={e => {
                                            (e.currentTarget as HTMLElement).style.background = '#F1F0EC';
                                            (e.currentTarget as HTMLElement).style.color = '#6B7CDB';
                                        }}
                                        onMouseLeave={e => {
                                            (e.currentTarget as HTMLElement).style.background = 'transparent';
                                            (e.currentTarget as HTMLElement).style.color = '#AEACA8';
                                        }}
                                        title="Chỉnh sửa ngày thi"
                                    >
                                        <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </h3>
                            <p className="text-sm mt-0.5" style={{ color: '#787774' }}>
                                {hasTargetDate
                                    ? (isExpired
                                        ? 'Thời gian đã điểm!'
                                        : `Mục tiêu: ${new Date(examDate).toLocaleDateString('vi-VN')} lúc ${new Date(examDate).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`)
                                    : 'Hãy đặt mục tiêu cho kỳ thi sắp tới'}
                            </p>
                        </div>
                    </div>

                    {/* Right: countdown or CTA */}
                    <div className="flex items-center gap-2">
                        {!hasTargetDate ? (
                            isAdmin ? (
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                                    style={{ background: '#EEF0FB', color: '#6B7CDB', border: '1px solid #6B7CDB22' }}
                                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.8'}
                                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
                                >
                                    <Target className="w-4 h-4" />
                                    Thiết lập ngay
                                </button>
                            ) : (
                                <span className="text-sm italic" style={{ color: '#AEACA8' }}>
                                    Chờ giáo viên thiết lập ngày thi...
                                </span>
                            )
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
                                            <div
                                                className="flex items-center justify-center rounded-lg tabular-nums"
                                                style={{
                                                    minWidth: '52px',
                                                    height: '52px',
                                                    background: '#F7F6F3',
                                                    border: '1px solid #E9E9E7',
                                                    fontSize: '1.25rem',
                                                    fontWeight: 600,
                                                    color: '#1A1A1A',
                                                }}
                                            >
                                                {String(item.value).padStart(2, '0')}
                                            </div>
                                            <span className="text-[10px] uppercase tracking-wider mt-1.5" style={{ color: '#AEACA8' }}>
                                                {item.label}
                                            </span>
                                        </div>
                                        {index < 3 && (
                                            <div className="text-xl font-light pb-5" style={{ color: '#CFCFCB' }}>:</div>
                                        )}
                                    </React.Fragment>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                /* Edit mode */
                <div className="animate-fade-in">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="font-semibold flex items-center gap-2" style={{ color: '#1A1A1A' }}>
                            <Calendar className="w-4 h-4" style={{ color: '#6B7CDB' }} />
                            Cài đặt mục tiêu thi cử
                        </h3>
                        <button
                            onClick={() => setIsEditing(false)}
                            className="p-1.5 rounded-md transition-colors"
                            style={{ color: '#AEACA8' }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F1F0EC'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="max-w-sm space-y-3">
                        <label className="text-xs font-medium uppercase tracking-wider" style={{ color: '#787774' }}>
                            Chọn ngày &amp; giờ thi dự kiến:
                        </label>
                        <input
                            type="datetime-local"
                            value={tempDate}
                            onChange={e => setTempDate(e.target.value)}
                            className="w-full px-4 py-3 rounded-lg text-sm font-medium outline-none transition-colors"
                            style={{
                                border: '1px solid #E9E9E7',
                                background: '#F7F6F3',
                                color: '#1A1A1A',
                            }}
                            onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = '#6B7CDB'}
                            onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = '#E9E9E7'}
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={handleSave}
                                className="flex-1 py-2.5 rounded-lg text-sm font-medium text-white flex items-center justify-center gap-2 transition-colors"
                                style={{ background: '#6B7CDB' }}
                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#5a6bc9'}
                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#6B7CDB'}
                            >
                                <Check className="w-4 h-4" />
                                Xác nhận mục tiêu
                            </button>
                            <button
                                onClick={() => setIsEditing(false)}
                                className="px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                                style={{ background: '#F1F0EC', color: '#57564F', border: '1px solid #E9E9E7' }}
                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#E9E9E7'}
                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#F1F0EC'}
                            >
                                Hủy
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CountdownTimer;
