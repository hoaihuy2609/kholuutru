import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Target, Plus, Trash2, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { StudyPlanItem } from '../types';

interface StudyPlannerProps {
    onLoadPlans: () => Promise<StudyPlanItem[]>;
    onSavePlan: (taskName: string, dueDate: string, color?: string) => Promise<StudyPlanItem | null>;
    onUpdatePlan: (id: string, updates: Partial<StudyPlanItem>) => Promise<boolean>;
    onDeletePlan: (id: string) => Promise<boolean>;
}

const COLORS = [
    { id: 'red', value: '#E03E3E', label: 'Quan trọng', bg: '#FEF2F2', border: '#FECACA' },
    { id: 'blue', value: '#6B7CDB', label: 'Bình thường', bg: '#EEF0FB', border: '#C7CEFF' },
    { id: 'green', value: '#448361', label: 'Ôn tập', bg: '#EAF3EE', border: '#A7D7BC' },
    { id: 'yellow', value: '#D9730D', label: 'Lưu ý', bg: '#FFF3E8', border: '#F5C796' },
];

// ── Teal / Cyan palette ──
const ACCENT = '#0D9488';           // teal-600
const ACCENT_DARK = '#0F766E';      // teal-700
const ACCENT_LIGHT = '#F0FDFA';     // teal-50
const ACCENT_MID = '#99F6E4';       // teal-200
const ACCENT_BORDER = '#5EEAD4';    // teal-300

const StudyPlanner: React.FC<StudyPlannerProps> = ({ onLoadPlans, onSavePlan, onUpdatePlan, onDeletePlan }) => {
    const [plans, setPlans] = useState<StudyPlanItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [currentMonthView, setCurrentMonthView] = useState<Date>(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    const [newTaskName, setNewTaskName] = useState('');
    const [newTaskColor, setNewTaskColor] = useState(COLORS[1]);
    const [isAddingTask, setIsAddingTask] = useState(false);

    useEffect(() => { fetchPlans(); }, []);

    const fetchPlans = async () => {
        setLoading(true);
        const data = await onLoadPlans();
        setPlans(data);
        setLoading(false);
    };

    const toISODate = (d: Date) => {
        const tzOffset = d.getTimezoneOffset() * 60000;
        return (new Date(d.getTime() - tzOffset)).toISOString().slice(0, 10);
    };

    const getCalendarDays = (monthStart: Date) => {
        const year = monthStart.getFullYear();
        const month = monthStart.getMonth();
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const offset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysArray = [];
        const prevMonthDays = new Date(year, month, 0).getDate();
        for (let i = offset - 1; i >= 0; i--) {
            daysArray.push({ date: new Date(year, month - 1, prevMonthDays - i), isCurrentMonth: false });
        }
        for (let i = 1; i <= daysInMonth; i++) {
            daysArray.push({ date: new Date(year, month, i), isCurrentMonth: true });
        }
        const remaining = 42 - daysArray.length;
        for (let i = 1; i <= remaining; i++) {
            daysArray.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
        }
        return daysArray;
    };

    const todayStr = toISODate(new Date());
    const selectedStr = toISODate(selectedDate);
    const calendarDays = getCalendarDays(currentMonthView);
    const currentPlans = plans.filter(p => p.due_date === selectedStr);
    const incompletePlans = currentPlans.filter(p => !p.is_completed);
    const completedPlans = currentPlans.filter(p => p.is_completed);

    const handleAddTask = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!newTaskName.trim()) return;
        const newTask = await onSavePlan(newTaskName.trim(), selectedStr, newTaskColor.value);
        if (newTask) {
            setPlans(prev => [...prev, newTask]);
            setNewTaskName('');
            setIsAddingTask(false);
        } else {
            alert("Lỗi: Không thể lưu kế hoạch. Vui lòng kiểm tra lại kết nối hoặc CSDL!");
        }
    };

    const handleToggleComplete = async (plan: StudyPlanItem) => {
        const updated = !plan.is_completed;
        setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, is_completed: updated } : p));
        const success = await onUpdatePlan(plan.id, { is_completed: updated });
        if (!success) setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, is_completed: !updated } : p));
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setPlans(prev => prev.filter(p => p.id !== id));
        await onDeletePlan(id);
    };

    const formatMonthYear = (d: Date) => `Tháng ${d.getMonth() + 1}, ${d.getFullYear()}`;
    const handleNextMonth = () => setCurrentMonthView(new Date(currentMonthView.getFullYear(), currentMonthView.getMonth() + 1, 1));
    const handlePrevMonth = () => setCurrentMonthView(new Date(currentMonthView.getFullYear(), currentMonthView.getMonth() - 1, 1));
    const handleJumpToToday = () => {
        const today = new Date();
        setSelectedDate(today);
        setCurrentMonthView(new Date(today.getFullYear(), today.getMonth(), 1));
    };

    return (
        <div className="space-y-6 animate-fade-in pb-10">

            {/* ── Header ── */}
            <div className="flex items-center gap-3">
                <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'linear-gradient(135deg, #2DD4BF 0%, #0D9488 100%)', boxShadow: '0 4px 12px rgba(13,148,136,0.35)' }}
                >
                    <Target className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>Mục Tiêu &amp; Lịch Trình</h1>
                    <p className="text-sm mt-0.5" style={{ color: '#787774' }}>Lên kế hoạch, chinh phục mục tiêu mỗi ngày.</p>
                </div>
            </div>

            {/* ── Main layout ── */}
            <div className="flex flex-col md:flex-row gap-6 items-start">

                {/* ── LEFT: CALENDAR ── */}
                <div className="w-full md:w-72 flex-shrink-0">
                    <div className="sticky top-6 rounded-2xl overflow-hidden" style={{ border: '1px solid #CCFBF1', background: '#FFFFFF', boxShadow: '0 2px 12px rgba(13,148,136,0.08)' }}>
                        {/* Calendar header */}
                        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #CCFBF1', background: 'linear-gradient(90deg, #F0FDFA, #CCFBF1)' }}>
                            <span className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>{formatMonthYear(currentMonthView)}</span>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={handlePrevMonth}
                                    className="p-1.5 rounded-md transition-colors"
                                    style={{ color: '#787774' }}
                                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#E9E9E7'}
                                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                                >
                                    <ChevronLeft className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={handleJumpToToday}
                                    className="text-[11px] font-semibold px-2 py-0.5 rounded-md transition-colors"
                                    style={{ color: ACCENT }}
                                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = ACCENT_LIGHT}
                                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                                >
                                    Hôm nay
                                </button>
                                <button
                                    onClick={handleNextMonth}
                                    className="p-1.5 rounded-md transition-colors"
                                    style={{ color: '#787774' }}
                                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#E9E9E7'}
                                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                                >
                                    <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>

                        {/* Calendar grid */}
                        <div className="p-3">
                            {/* Days of week */}
                            <div className="grid grid-cols-7 gap-0.5 mb-1">
                                {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(day => (
                                    <div key={day} className="text-center text-[10px] font-semibold py-1" style={{ color: '#AEACA8' }}>
                                        {day}
                                    </div>
                                ))}
                            </div>
                            {/* Days */}
                            <div className="grid grid-cols-7 gap-0.5">
                                {calendarDays.map((dObj, i) => {
                                    const dateStr = toISODate(dObj.date);
                                    const isSelected = dateStr === selectedStr;
                                    const isToday = dateStr === todayStr;
                                    const dayPlans = plans.filter(p => p.due_date === dateStr);
                                    const hasTasks = dayPlans.length > 0;
                                    const allDone = hasTasks && dayPlans.every(p => p.is_completed);

                                    return (
                                        <button
                                            key={i}
                                            onClick={() => setSelectedDate(dObj.date)}
                                            className="relative aspect-square flex flex-col items-center justify-center rounded-lg cursor-pointer transition-all duration-200 active:scale-95"
                                            style={{
                                                background: isSelected ? 'linear-gradient(135deg, #2DD4BF, #0D9488)' : isToday ? ACCENT_LIGHT : 'transparent',
                                                border: isSelected ? 'none' : isToday ? `1px solid ${ACCENT}40` : '1px solid transparent',
                                                boxShadow: isSelected ? '0 2px 8px rgba(13,148,136,0.35)' : 'none',
                                            }}
                                            onMouseEnter={e => {
                                                if (!isSelected) (e.currentTarget as HTMLElement).style.background = '#F7F6F3';
                                            }}
                                            onMouseLeave={e => {
                                                if (!isSelected) (e.currentTarget as HTMLElement).style.background = isToday ? ACCENT_LIGHT : 'transparent';
                                            }}
                                        >
                                            <span
                                                className="text-[12px] leading-none"
                                                style={{
                                                    color: isSelected ? '#fff' : isToday ? ACCENT : !dObj.isCurrentMonth ? '#CFCFCB' : '#1A1A1A',
                                                    fontWeight: isSelected || isToday ? 700 : 500,
                                                }}
                                            >
                                                {dObj.date.getDate()}
                                            </span>
                                            {hasTasks && (
                                                <span
                                                    className="w-1 h-1 rounded-full absolute bottom-1"
                                                    style={{ background: isSelected ? '#fff' : allDone ? '#10B981' : ACCENT }}
                                                />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Legend */}
                        <div className="px-3 pb-3 flex items-center gap-3 text-[10px]" style={{ color: '#AEACA8' }}>
                            <span className="flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: ACCENT }} />
                                Có nhiệm vụ
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#448361' }} />
                                Hoàn thành
                            </span>
                        </div>
                    </div>
                </div>

                {/* ── RIGHT: TASK LIST ── */}
                <div className="w-full md:flex-1">
                    {/* Date heading */}
                    <div className="mb-4">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full" style={{ background: 'linear-gradient(135deg, #CCFBF1, #99F6E4)', color: ACCENT_DARK }}>
                                <CalendarIcon className="w-3 h-3 inline mr-1" />
                                {selectedDate.toLocaleDateString('vi-VN', { weekday: 'long' })}
                            </span>
                        </div>
                        <h2 className="text-2xl font-semibold" style={{ color: '#1A1A1A' }}>
                            {selectedDate.toLocaleDateString('vi-VN', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </h2>
                        {/* Progress bar */}
                        {currentPlans.length > 0 && (
                            <div className="mt-3 flex items-center gap-3">
                                <span className="text-[13px] font-semibold whitespace-nowrap" style={{ color: ACCENT_DARK }}>
                                    {currentPlans.filter(p => p.is_completed).length}/{currentPlans.length} hoàn thành
                                </span>
                                <div className="flex-1 h-[4px] rounded-full overflow-hidden" style={{ background: ACCENT_MID }}>
                                    <div
                                        className="h-full rounded-full transition-all duration-500"
                                        style={{
                                            width: `${(currentPlans.filter(p => p.is_completed).length / currentPlans.length) * 100}%`,
                                            background: 'linear-gradient(90deg, #2DD4BF, #0D9488)'
                                        }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <span className="text-sm" style={{ color: '#AEACA8' }}>Đang tải kế hoạch...</span>
                        </div>
                    ) : (
                        <div className="space-y-1.5">
                            {/* Incomplete Tasks */}
                            {incompletePlans.length === 0 && completedPlans.length === 0 && (
                                <div className="rounded-xl py-10 text-center" style={{ border: '1px dashed #E9E9E7' }}>
                                    <CalendarIcon className="w-8 h-8 mx-auto mb-2" style={{ color: '#CFCFCB' }} />
                                    <p className="text-sm font-medium" style={{ color: '#787774' }}>Chưa có nhiệm vụ nào</p>
                                    <p className="text-xs mt-0.5" style={{ color: '#AEACA8' }}>Bấm "+" để thêm nhiệm vụ mới</p>
                                </div>
                            )}

                            {incompletePlans.map(plan => {
                                const colorObj = COLORS.find(c => c.value === plan.color) || COLORS[1];
                                return (
                                    <div
                                        key={plan.id}
                                        className="group flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200"
                                        style={{ background: '#FFFFFF', border: '1px solid #E9E9E7' }}
                                        onMouseEnter={e => {
                                            (e.currentTarget as HTMLElement).style.borderColor = colorObj.border;
                                            (e.currentTarget as HTMLElement).style.background = colorObj.bg;
                                        }}
                                        onMouseLeave={e => {
                                            (e.currentTarget as HTMLElement).style.borderColor = '#E9E9E7';
                                            (e.currentTarget as HTMLElement).style.background = '#FFFFFF';
                                        }}
                                    >
                                        {/* Checkbox */}
                                        <button
                                            onClick={() => handleToggleComplete(plan)}
                                            className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-all hover:scale-110 active:scale-95"
                                            style={{ border: `2px solid ${colorObj.value}`, background: 'transparent' }}
                                        />

                                        {/* Content */}
                                        <p className="text-sm font-medium flex-1 truncate" style={{ color: '#1A1A1A' }}>
                                            {plan.task_name}
                                        </p>

                                        {/* Tag */}
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0" style={{ background: colorObj.bg, color: colorObj.value, border: `1px solid ${colorObj.border}` }}>
                                            {colorObj.label}
                                        </span>

                                        {/* Delete */}
                                        <button
                                            onClick={(e) => handleDelete(plan.id, e)}
                                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-all active:scale-90"
                                            style={{ color: '#AEACA8' }}
                                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#FEF2F2'; (e.currentTarget as HTMLElement).style.color = '#E03E3E'; }}
                                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#AEACA8'; }}
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                );
                            })}

                            {/* Completed Tasks */}
                            {completedPlans.length > 0 && (
                                <div className="mt-6">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="flex-1 h-px" style={{ background: '#E9E9E7' }} />
                                        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#AEACA8' }}>Đã hoàn thành</span>
                                        <div className="flex-1 h-px" style={{ background: '#E9E9E7' }} />
                                    </div>
                                    {completedPlans.map(plan => (
                                        <div
                                            key={plan.id}
                                            className="group flex items-center gap-3 px-3 py-3 rounded-xl transition-colors mb-1.5"
                                            style={{ background: '#FAFAF9', border: '1px solid #F1F0EC' }}
                                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F1F0EC'}
                                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#FAFAF9'}
                                        >
                                            <button
                                                onClick={() => handleToggleComplete(plan)}
                                                className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-all hover:scale-110 active:scale-95"
                                                style={{ background: '#448361', border: '2px solid #448361' }}
                                            >
                                                <Check className="w-3 h-3 text-white" strokeWidth={3} />
                                            </button>
                                            <p className="text-sm font-medium flex-1 truncate line-through" style={{ color: '#AEACA8' }}>
                                                {plan.task_name}
                                            </p>
                                            <button
                                                onClick={(e) => handleDelete(plan.id, e)}
                                                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-all active:scale-90"
                                                style={{ color: '#AEACA8' }}
                                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#FEF2F2'; (e.currentTarget as HTMLElement).style.color = '#E03E3E'; }}
                                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#AEACA8'; }}
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Add Task */}
                            {!isAddingTask ? (
                                <button
                                    onClick={() => setIsAddingTask(true)}
                                    className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-colors mt-2"
                                    style={{ color: ACCENT, border: `1px dashed ${ACCENT_BORDER}`, background: 'transparent' }}
                                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = ACCENT_LIGHT; (e.currentTarget as HTMLElement).style.borderStyle = 'solid'; }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.borderStyle = 'dashed'; }}
                                >
                                    <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: ACCENT_LIGHT, border: `1px solid ${ACCENT_BORDER}` }}>
                                        <Plus className="w-3 h-3" style={{ color: ACCENT }} />
                                    </div>
                                    Thêm nhiệm vụ mới...
                                </button>
                            ) : (
                                <form
                                    onSubmit={handleAddTask}
                                    className="flex items-center gap-2 p-2 mt-2 rounded-xl"
                                    style={{ background: '#FFFFFF', border: `1.5px solid ${ACCENT}`, boxShadow: `0 0 0 3px ${ACCENT}20` }}
                                >
                                    <input
                                        type="text"
                                        autoFocus
                                        value={newTaskName}
                                        onChange={(e) => setNewTaskName(e.target.value)}
                                        placeholder="Tên nhiệm vụ (nhấn Enter để lưu)..."
                                        className="flex-1 bg-transparent border-none text-sm px-2 py-1 font-medium outline-none"
                                        style={{ color: '#1A1A1A' }}
                                    />
                                    {/* Color pickers */}
                                    <div className="flex items-center gap-1.5 px-2" style={{ borderLeft: '1px solid #E9E9E7' }}>
                                        {COLORS.map(c => (
                                            <button
                                                key={c.id}
                                                type="button"
                                                onClick={() => setNewTaskColor(c)}
                                                className="w-4 h-4 rounded-full transition-all duration-200"
                                                style={{
                                                    background: c.value,
                                                    outline: newTaskColor.id === c.id ? `2px solid ${c.value}` : 'none',
                                                    outlineOffset: '2px',
                                                    transform: newTaskColor.id === c.id ? 'scale(1.15)' : 'scale(1)',
                                                    opacity: newTaskColor.id === c.id ? 1 : 0.5,
                                                }}
                                            />
                                        ))}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            type="submit"
                                            className="px-4 py-1.5 text-xs font-bold rounded-xl transition-all text-white active:scale-95"
                                            style={{ background: 'linear-gradient(135deg, #2DD4BF, #0D9488)', boxShadow: '0 2px 8px rgba(13,148,136,0.35)' }}
                                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(13,148,136,0.45)'}
                                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(13,148,136,0.35)'}
                                        >
                                            Lưu
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setIsAddingTask(false)}
                                            className="px-3 py-1.5 text-xs font-bold rounded-lg transition-colors active:scale-95"
                                            style={{ background: '#F1F0EC', color: '#787774' }}
                                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#E9E9E7'; (e.currentTarget as HTMLElement).style.color = '#1A1A1A'; }}
                                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#F1F0EC'; (e.currentTarget as HTMLElement).style.color = '#787774'; }}
                                        >
                                            Hủy
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StudyPlanner;
