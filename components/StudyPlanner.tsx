import React, { useState, useEffect } from 'react';
import { Calendar, CheckSquare, Plus, Trash2, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { StudyPlanItem } from '../types';

interface StudyPlannerProps {
    onLoadPlans: () => Promise<StudyPlanItem[]>;
    onSavePlan: (taskName: string, dueDate: string, color?: string) => Promise<StudyPlanItem | null>;
    onUpdatePlan: (id: string, updates: Partial<StudyPlanItem>) => Promise<boolean>;
    onDeletePlan: (id: string) => Promise<boolean>;
}

const COLORS = [
    { id: 'red', value: '#E03E3E', label: 'Quan trọng', bg: '#FEF2F2' },
    { id: 'blue', value: '#6B7CDB', label: 'Bình thường', bg: '#EEF0FB' },
    { id: 'green', value: '#448361', label: 'Ôn tập', bg: '#EDFDF5' },
    { id: 'yellow', value: '#D9730D', label: 'Lưu ý', bg: '#FFF7ED' },
];

const StudyPlanner: React.FC<StudyPlannerProps> = ({ onLoadPlans, onSavePlan, onUpdatePlan, onDeletePlan }) => {
    const [plans, setPlans] = useState<StudyPlanItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [currentMonthView, setCurrentMonthView] = useState<Date>(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

    // New task state
    const [newTaskName, setNewTaskName] = useState('');
    const [newTaskColor, setNewTaskColor] = useState(COLORS[1]);
    const [isAddingTask, setIsAddingTask] = useState(false);

    useEffect(() => {
        fetchPlans();
    }, []);

    const fetchPlans = async () => {
        setLoading(true);
        const data = await onLoadPlans();
        setPlans(data);
        setLoading(false);
    };

    const toISODate = (d: Date) => {
        const tzOffset = d.getTimezoneOffset() * 60000; // offset in milliseconds
        return (new Date(d.getTime() - tzOffset)).toISOString().slice(0, 10);
    };

    const getCalendarDays = (monthStart: Date) => {
        const year = monthStart.getFullYear();
        const month = monthStart.getMonth();
        const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 is Sun
        const offset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1; // Mon = 0, Sun = 6
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const daysArray = [];
        // Prev month padding
        const prevMonthDays = new Date(year, month, 0).getDate();
        for (let i = offset - 1; i >= 0; i--) {
            daysArray.push({ date: new Date(year, month - 1, prevMonthDays - i), isCurrentMonth: false });
        }
        // Current month
        for (let i = 1; i <= daysInMonth; i++) {
            daysArray.push({ date: new Date(year, month, i), isCurrentMonth: true });
        }
        // Next month padding (make it 6 rows = 42 days total)
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

        const newTask = await onSavePlan(
            newTaskName.trim(),
            selectedStr,
            newTaskColor.value
        );

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
        if (!success) {
            setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, is_completed: !updated } : p));
        }
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setPlans(prev => prev.filter(p => p.id !== id));
        await onDeletePlan(id);
    };

    const formatMonthYear = (d: Date) => {
        return `Tháng ${d.getMonth() + 1}, ${d.getFullYear()}`;
    };

    const handleNextMonth = () => setCurrentMonthView(new Date(currentMonthView.getFullYear(), currentMonthView.getMonth() + 1, 1));
    const handlePrevMonth = () => setCurrentMonthView(new Date(currentMonthView.getFullYear(), currentMonthView.getMonth() - 1, 1));
    const handleJumpToToday = () => {
        const today = new Date();
        setSelectedDate(today);
        setCurrentMonthView(new Date(today.getFullYear(), today.getMonth(), 1));
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6 pt-2 pb-10">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold mb-1" style={{ color: '#37352f' }}>
                    Mục Tiêu &amp; Lịch Trình
                </h1>
                <p className="text-[15px] opacity-70" style={{ color: '#37352f' }}>Thêm nhiệm vụ và theo dõi tiến độ mỗi ngày.</p>
            </div>

            <div className="flex flex-col md:flex-row gap-10 items-start mt-8">
                {/* LEFT COLUMN: MINI CALENDAR */}
                <div className="w-full md:w-80 flex-shrink-0">
                    <div className="sticky top-6">
                        {/* Month Header */}
                        <div className="flex items-center justify-between mb-4 px-1">
                            <h2 className="text-[15px] font-semibold" style={{ color: '#37352f' }}>
                                {formatMonthYear(currentMonthView)}
                            </h2>
                            <div className="flex items-center gap-1">
                                <button onClick={handlePrevMonth} className="p-1 rounded text-gray-500 hover:bg-gray-100 transition-colors">
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <button onClick={handleJumpToToday} className="text-[12px] font-semibold px-2 py-0.5 rounded text-gray-600 hover:bg-gray-100 transition-colors mx-1">
                                    Hôm nay
                                </button>
                                <button onClick={handleNextMonth} className="p-1 rounded text-gray-500 hover:bg-gray-100 transition-colors">
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Calendar Grid */}
                        <div className="w-full">
                            {/* Days of week */}
                            <div className="grid grid-cols-7 gap-1 mb-2">
                                {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(day => (
                                    <div key={day} className="text-center text-[11px] font-semibold text-gray-400 py-1">
                                        {day}
                                    </div>
                                ))}
                            </div>

                            {/* Days */}
                            <div className="grid grid-cols-7 gap-1">
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
                                            className={`
                                                relative w-full aspect-square flex flex-col items-center justify-center rounded-lg cursor-pointer transition-colors
                                                ${isSelected ? 'bg-red-500 shadow-sm' : 'hover:bg-gray-50'}
                                            `}
                                        >
                                            <span
                                                className={`text-[13px] ${isSelected ? 'text-white' : (isToday ? 'text-red-500 font-semibold' : (!dObj.isCurrentMonth ? 'text-gray-300' : 'text-[#37352f]'))}`}
                                                style={{ fontWeight: isSelected ? 600 : (isToday ? 600 : 400) }}
                                            >
                                                {dObj.date.getDate()}
                                            </span>
                                            {/* Dot for tasks */}
                                            {hasTasks && (
                                                <span className={`w-1 h-1 rounded-full absolute bottom-1.5 ${isSelected ? 'bg-white' : (allDone ? 'bg-gray-300' : 'bg-[#37352f]')}`} />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>


                {/* RIGHT COLUMN: TASK LIST */}
                <div className="w-full md:flex-1">
                    <div className="mb-6">
                        <h3 className="text-[26px] font-bold" style={{ color: '#37352f' }}>
                            {selectedDate.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        </h3>
                        {/* Minimalist Progress Line */}
                        {currentPlans.length > 0 && (
                            <div className="mt-4 flex items-center gap-3">
                                <span className="text-[13px] font-medium text-gray-500 whitespace-nowrap">
                                    {currentPlans.filter(p => p.is_completed).length} / {currentPlans.length} hoàn thành
                                </span>
                                <div className="flex-1 h-[3px] bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-emerald-500 transition-all duration-500"
                                        style={{ width: `${(currentPlans.filter(p => p.is_completed).length / currentPlans.length) * 100}%` }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {loading ? (
                        <div className="py-20 text-gray-400 text-sm">Đang tải kế hoạch...</div>
                    ) : (
                        <div className="space-y-1">
                            {/* Incomplete Tasks */}
                            {incompletePlans.map(plan => {
                                const colorObj = COLORS.find(c => c.value === plan.color) || COLORS[1];

                                return (
                                    <div
                                        key={plan.id}
                                        className="group relative flex items-center justify-between px-2 py-2 rounded-md hover:bg-[#F2F1EE] transition-colors"
                                    >
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            {/* Checkbox */}
                                            <button
                                                onClick={() => handleToggleComplete(plan)}
                                                className="w-[16px] h-[16px] rounded-[4px] flex items-center justify-center shrink-0 transition-colors border bg-transparent border-gray-400 hover:border-gray-600"
                                            >
                                            </button>

                                            {/* Content */}
                                            <p className="text-[15px] leading-snug truncate text-[#37352F] flex-1">
                                                {plan.task_name}
                                            </p>

                                            {/* Pill Badge */}
                                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border whitespace-nowrap shrink-0 opacity-80" style={{ backgroundColor: colorObj.bg, color: colorObj.value, borderColor: colorObj.value + '40' }}>
                                                {colorObj.label}
                                            </span>
                                        </div>

                                        {/* Delete btn */}
                                        <button
                                            onClick={(e) => handleDelete(plan.id, e)}
                                            className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:bg-gray-200 hover:text-red-500 transition-colors rounded shrink-0 ml-2"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                );
                            })}

                            {/* Completed Tasks */}
                            {completedPlans.length > 0 && (
                                <div className="mt-8 mb-4 border-t border-gray-100 pt-4">
                                    <h4 className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider pl-2 mb-2">Đã hoàn thành</h4>
                                    {completedPlans.map(plan => {
                                        return (
                                            <div
                                                key={plan.id}
                                                className="group relative flex items-center justify-between px-2 py-2 rounded-md hover:bg-[#F2F1EE] transition-colors opacity-70"
                                            >
                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                    {/* Checkbox */}
                                                    <button
                                                        onClick={() => handleToggleComplete(plan)}
                                                        className="w-[16px] h-[16px] rounded-[4px] flex items-center justify-center shrink-0 transition-colors border bg-gray-200 border-gray-300 hover:bg-gray-300"
                                                    >
                                                        <Check className="w-3 h-3 text-gray-500" strokeWidth={4} />
                                                    </button>

                                                    {/* Content */}
                                                    <p className="text-[15px] leading-snug truncate text-gray-400 line-through flex-1">
                                                        {plan.task_name}
                                                    </p>
                                                </div>

                                                {/* Delete btn */}
                                                <button
                                                    onClick={(e) => handleDelete(plan.id, e)}
                                                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:bg-gray-200 hover:text-red-500 transition-colors rounded shrink-0 ml-2"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Add Task Area */}
                            {!isAddingTask ? (
                                <button
                                    onClick={() => setIsAddingTask(true)}
                                    className="flex items-center gap-2 px-2 py-2.5 w-full text-left text-[14px] text-gray-400 hover:text-gray-600 hover:bg-[#F2F1EE] rounded-md transition-colors mt-1"
                                >
                                    <Plus className="w-4 h-4 ml-0.5" />
                                    <span>Thêm nhiệm vụ mới...</span>
                                </button>
                            ) : (
                                <form onSubmit={handleAddTask} className="flex items-center gap-2 px-1 py-1 mt-1 bg-white border border-[#E9E9E7] rounded-md shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
                                    <input
                                        type="text"
                                        autoFocus
                                        value={newTaskName}
                                        onChange={(e) => setNewTaskName(e.target.value)}
                                        placeholder="Nhấn Enter để lưu..."
                                        className="flex-1 bg-transparent border-none focus:ring-0 text-[14px] px-2 py-1.5 text-[#37352F] placeholder:text-gray-400 outline-none"
                                    />

                                    {/* Color Picker */}
                                    <div className="flex items-center gap-1.5 px-2 border-l border-gray-100">
                                        {COLORS.map(c => (
                                            <div
                                                key={c.id}
                                                onClick={() => setNewTaskColor(c)}
                                                className={`w-4 h-4 rounded-full cursor-pointer flex items-center justify-center transition-transform ${newTaskColor.id === c.id ? 'scale-110 shadow-sm ring-2 ring-offset-1' : 'hover:scale-110'}`}
                                                style={{ backgroundColor: c.value, '--tw-ring-color': c.value } as any}
                                            />
                                        ))}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => setIsAddingTask(false)}
                                        className="px-2 py-1.5 text-[12px] font-medium text-gray-500 hover:bg-gray-100 rounded mr-1"
                                    >
                                        Hủy
                                    </button>
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
