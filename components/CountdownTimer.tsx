import React, { useState, useEffect } from 'react';
import { Clock, Calendar, Edit2, Check, X, Target } from 'lucide-react';

interface CountdownTimerProps {
    isAdmin?: boolean;
}

const CountdownTimer: React.FC<CountdownTimerProps> = ({ isAdmin }) => {
    const [examDate, setExamDate] = useState<string>(() =>
        localStorage.getItem('physivault_exam_date') || ''
    );
    const [examName, setExamName] = useState<string>(() =>
        localStorage.getItem('physivault_exam_name') || 'Hành trình đến kỳ thi'
    );
    const [isEditing, setIsEditing] = useState(false);

    const getDefaultDate = () => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        d.setHours(8, 0, 0, 0);
        return d.toISOString().slice(0, 16);
    };

    const [tempDate, setTempDate] = useState(examDate || getDefaultDate());
    const [tempName, setTempName] = useState(examName);
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
        setExamName(tempName);
        localStorage.setItem('physivault_exam_date', tempDate);
        localStorage.setItem('physivault_exam_name', tempName);
        setIsEditing(false);
    };

    const hasTargetDate = !!examDate;
    const isExpired = hasTargetDate && +new Date(examDate) <= +new Date();

    return (
        <div
            className="rounded-xl p-6 transition-all"
            style={{ background: '#FFFFFF', border: '1px solid #E9E9E7', boxShadow: 'var(--shadow-sm)' }}
        >
            {!isEditing ? (
                <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                    {/* Left: clock + label */}
                    <div className="flex items-center gap-5">
                        {/* Clock widget */}
                        <div
                            className="flex flex-col items-center justify-center px-5 py-3 rounded-xl shrink-0"
                            style={{ background: '#F7F6F3', border: '1px solid #E9E9E7', minWidth: '95px' }}
                        >
                            <div className="text-base font-semibold tabular-nums" style={{ color: '#1A1A1A', letterSpacing: '0.05em' }}>
                                {currentTime.getHours().toString().padStart(2, '0')}
                                <span className="text-[#AEACA8] mx-0.5 animate-pulse">:</span>
                                {currentTime.getMinutes().toString().padStart(2, '0')}
                                <span className="text-[10px] ml-1.5 tabular-nums font-normal" style={{ color: '#AEACA8' }}>
                                    {currentTime.getSeconds().toString().padStart(2, '0')}
                                </span>
                            </div>
                            <div className="text-[9px] uppercase tracking-[0.2em] font-bold mt-1" style={{ color: '#AEACA8' }}>
                                Hiện tại
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-lg font-semibold" style={{ color: '#1A1A1A' }}>
                                    {examName}
                                </h3>
                                {isAdmin && (
                                    <button
                                        onClick={() => {
                                            setTempDate(examDate || getDefaultDate());
                                            setTempName(examName);
                                            setIsEditing(true);
                                        }}
                                        className="p-1.5 rounded-lg transition-all"
                                        style={{ color: '#AEACA8' }}
                                        onMouseEnter={e => {
                                            (e.currentTarget as HTMLElement).style.background = '#F1F0EC';
                                            (e.currentTarget as HTMLElement).style.color = '#6B7CDB';
                                        }}
                                        onMouseLeave={e => {
                                            (e.currentTarget as HTMLElement).style.background = 'transparent';
                                            (e.currentTarget as HTMLElement).style.color = '#AEACA8';
                                        }}
                                        title="Chỉnh sửa kỳ thi"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <Calendar className="w-3.5 h-3.5" style={{ color: '#AEACA8' }} />
                                <span className="text-sm font-medium" style={{ color: '#787774' }}>
                                    {hasTargetDate
                                        ? (isExpired
                                            ? 'Thời gian đã điểm!'
                                            : `${new Date(examDate).toLocaleDateString('vi-VN')} · ${new Date(examDate).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`)
                                        : 'Hãy đặt mục tiêu cho kỳ thi sắp tới'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Right: countdown or CTA */}
                    <div className="flex items-center">
                        {!hasTargetDate ? (
                            isAdmin ? (
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm"
                                    style={{ background: '#6B7CDB', color: '#FFFFFF' }}
                                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.9'}
                                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
                                >
                                    <Target className="w-4 h-4" />
                                    Thiết lập mục tiêu
                                </button>
                            ) : (
                                <div className="px-4 py-2 rounded-lg border border-dashed text-sm italic" style={{ borderColor: '#E9E9E7', color: '#AEACA8' }}>
                                    Chờ giáo viên thiết lập...
                                </div>
                            )
                        ) : (
                            <div className="flex items-center gap-3">
                                {[
                                    { label: 'Ngày', value: timeLeft.days, color: '#6B7CDB' },
                                    { label: 'Giờ', value: timeLeft.hours, color: '#9065B0' },
                                    { label: 'Phút', value: timeLeft.minutes, color: '#448361' },
                                    { label: 'Giây', value: timeLeft.seconds, color: '#D9730D' },
                                ].map((item, index) => (
                                    <React.Fragment key={item.label}>
                                        <div className="flex flex-col items-center group">
                                            <div
                                                className="flex items-center justify-center rounded-xl tabular-nums shadow-sm transition-transform group-hover:scale-105"
                                                style={{
                                                    minWidth: '60px',
                                                    height: '60px',
                                                    background: '#FFFFFF',
                                                    border: `1px solid #E9E9E7`,
                                                    borderBottom: `3px solid ${item.color}22`,
                                                    fontSize: '1.5rem',
                                                    fontWeight: 700,
                                                    color: '#1A1A1A',
                                                }}
                                            >
                                                {String(item.value).padStart(2, '0')}
                                            </div>
                                            <span className="text-[10px] font-bold uppercase tracking-[0.15em] mt-2" style={{ color: '#AEACA8' }}>
                                                {item.label}
                                            </span>
                                        </div>
                                        {index < 3 && (
                                            <div className="text-xl font-medium pb-7" style={{ color: '#E9E9E7' }}>:</div>
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
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-lg" style={{ background: '#EEF0FB' }}>
                                <Target className="w-5 h-5" style={{ color: '#6B7CDB' }} />
                            </div>
                            <h3 className="text-lg font-semibold" style={{ color: '#1A1A1A' }}>
                                Cài đặt mục tiêu thi cử
                            </h3>
                        </div>
                        <button
                            onClick={() => setIsEditing(false)}
                            className="p-2 rounded-lg transition-all"
                            style={{ color: '#AEACA8' }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F1F0EC'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6 max-w-4xl">
                        {/* Name Input */}
                        <div className="space-y-2">
                            <label className="text-[11px] font-bold uppercase tracking-wider pl-1" style={{ color: '#AEACA8' }}>
                                Tên sự kiện / Kỳ thi
                            </label>
                            <input
                                type="text"
                                placeholder="Ví dụ: Kỳ thi THPT Quốc Gia"
                                value={tempName}
                                onChange={e => setTempName(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none transition-all"
                                style={{
                                    border: '1px solid #E9E9E7',
                                    background: '#F7F6F3',
                                    color: '#1A1A1A',
                                }}
                                onFocus={e => {
                                    (e.currentTarget as HTMLElement).style.borderColor = '#6B7CDB';
                                    (e.currentTarget as HTMLElement).style.background = '#FFFFFF';
                                }}
                                onBlur={e => {
                                    (e.currentTarget as HTMLElement).style.borderColor = '#E9E9E7';
                                    (e.currentTarget as HTMLElement).style.background = '#F7F6F3';
                                }}
                            />
                        </div>

                        {/* Date Input */}
                        <div className="space-y-2">
                            <label className="text-[11px] font-bold uppercase tracking-wider pl-1" style={{ color: '#AEACA8' }}>
                                Thời điểm diễn ra
                            </label>
                            <input
                                type="datetime-local"
                                value={tempDate}
                                onChange={e => setTempDate(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none transition-all"
                                style={{
                                    border: '1px solid #E9E9E7',
                                    background: '#F7F6F3',
                                    color: '#1A1A1A',
                                }}
                                onFocus={e => {
                                    (e.currentTarget as HTMLElement).style.borderColor = '#6B7CDB';
                                    (e.currentTarget as HTMLElement).style.background = '#FFFFFF';
                                }}
                                onBlur={e => {
                                    (e.currentTarget as HTMLElement).style.borderColor = '#E9E9E7';
                                    (e.currentTarget as HTMLElement).style.background = '#F7F6F3';
                                }}
                            />
                        </div>

                        <div className="md:col-span-2 flex gap-3 pt-2">
                            <button
                                onClick={handleSave}
                                className="flex-1 py-3 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all shadow-md shadow-indigo-200"
                                style={{ background: '#6B7CDB' }}
                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.9'}
                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
                            >
                                <Check className="w-4 h-4" />
                                Lưu thiết lập
                            </button>
                            <button
                                onClick={() => setIsEditing(false)}
                                className="px-8 py-3 rounded-xl text-sm font-semibold transition-all"
                                style={{ background: '#F1F0EC', color: '#57564F', border: '1px solid #E9E9E7' }}
                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#E9E9E7'}
                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#F1F0EC'}
                            >
                                Hủy bỏ
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CountdownTimer;
