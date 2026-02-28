import React, { useState, useEffect } from 'react';
import { Calendar, CheckSquare, Plus, Trash2, ChevronLeft, ChevronRight, Check, Send } from 'lucide-react';
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

    // New task state
    const [newTaskName, setNewTaskName] = useState('');
    const [newTaskColor, setNewTaskColor] = useState(COLORS[1]);

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

    const getDaysArray = (start: Date, daysToAdd: number = 7) => {
        const arr = [];
        for (let i = 0; i < daysToAdd; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i - 3); // 3 days ago till 3 days ahead
            arr.push(d);
        }
        return arr;
    };

    const todayStr = toISODate(new Date());
    const selectedStr = toISODate(selectedDate);
    const days = getDaysArray(selectedDate, 7);

    const currentPlans = plans.filter(p => p.due_date === selectedStr);

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
        } else {
            alert("Lỗi: Không thể lưu kế hoạch. Vui lòng kiểm tra lại kết nối hoặc CSDL!");
        }
    };

    const handleToggleComplete = async (plan: StudyPlanItem) => {
        const updated = !plan.is_completed;
        setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, is_completed: updated } : p));
        const success = await onUpdatePlan(plan.id, { is_completed: updated });
        if (!success) {
            // rollback
            setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, is_completed: !updated } : p));
        }
    };

    const handleDelete = async (id: string) => {
        setPlans(prev => prev.filter(p => p.id !== id));
        await onDeletePlan(id);
    };



    const getDayName = (d: Date) => {
        const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
        return days[d.getDay()];
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">

            {/* Header */}
            <div>
                <h1 className="text-2xl font-semibold mb-1" style={{ color: '#1A1A1A' }}>
                    Mục Tiêu &amp; Lịch Trình
                </h1>
                <p className="text-sm" style={{ color: '#787774' }}>Lên kế hoạch học tập, đính kèm bài thi và theo dõi tiến độ mỗi ngày.</p>
            </div>

            {/* Timeline Calendar */}
            <div
                className="rounded-2xl p-4 md:p-6"
                style={{ background: '#FFFFFF', border: '1px solid #E9E9E7', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}
            >
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#AEACA8' }}>
                        Lịch trình 7 ngày
                    </h2>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() - 1); setSelectedDate(d); }}
                            className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4 text-gray-500" />
                        </button>
                        <button
                            onClick={() => setSelectedDate(new Date())}
                            className="text-[11px] font-semibold px-2 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                        >Hôm nay
                        </button>
                        <button
                            onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() + 1); setSelectedDate(d); }}
                            className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
                        >
                            <ChevronRight className="w-4 h-4 text-gray-500" />
                        </button>
                    </div>
                </div>

                <div className="flex justify-between items-center overflow-x-auto hide-scrollbar gap-2 pb-2">
                    {days.map((d, i) => {
                        const dateStr = toISODate(d);
                        const isSelected = dateStr === selectedStr;
                        const isToday = dateStr === todayStr;

                        return (
                            <button
                                key={i}
                                onClick={() => setSelectedDate(d)}
                                className={`flex-1 min-w-[64px] flex flex-col items-center justify-center p-3 rounded-xl transition-all ${isSelected ? 'shadow-sm translate-y-[-2px]' : 'hover:bg-gray-50 opacity-70'
                                    }`}
                                style={{
                                    background: isSelected ? '#1A1A1A' : 'transparent',
                                    color: isSelected ? '#FFFFFF' : '#1A1A1A',
                                    border: isSelected ? '1px solid #1A1A1A' : '1px solid transparent',
                                }}
                            >
                                <span className="text-[10px] uppercase font-semibold mb-1 opacity-80">
                                    {isToday ? 'Hôm nay' : getDayName(d)}
                                </span>
                                <span className="text-lg font-bold">
                                    {d.getDate()}
                                </span>
                                {/* Dots indicating tasks */}
                                <div className="flex gap-0.5 mt-1.5 h-1">
                                    {plans.filter(p => p.due_date === dateStr).slice(0, 3).map((p, idx) => (
                                        <span key={idx} className="w-1 h-1 rounded-full" style={{ backgroundColor: isSelected ? '#FFFFFF' : p.color || '#6B7CDB' }} />
                                    ))}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Tasks List */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>Nhiệm vụ trong ngày</h3>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: '#F1F0EC', color: '#57564F' }}>
                        {currentPlans.filter(p => p.is_completed).length} / {currentPlans.length} hoàn thành
                    </span>
                </div>

                {loading ? (
                    <div className="text-center py-10 text-gray-500 text-sm">Đang tải kế hoạch...</div>
                ) : currentPlans.length > 0 ? (
                    <div className="space-y-3">
                        {currentPlans.map(plan => {
                            const colorObj = COLORS.find(c => c.value === plan.color) || COLORS[1];

                            return (
                                <div
                                    key={plan.id}
                                    className={`group relative flex items-start gap-4 p-4 rounded-xl transition-all ${plan.is_completed ? 'opacity-60' : ''}`}
                                    style={{
                                        background: '#FFFFFF',
                                        border: `1px solid ${plan.is_completed ? '#E9E9E7' : colorObj.value + '40'}`,
                                        borderLeft: `4px solid ${plan.is_completed ? '#E9E9E7' : colorObj.value}`,
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                                    }}
                                >
                                    {/* Checkbox */}
                                    <button
                                        onClick={() => handleToggleComplete(plan)}
                                        className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 transition-colors border ${plan.is_completed ? 'bg-gray-200 border-gray-300' : 'bg-white border-gray-300 hover:border-gray-400'}`}
                                    >
                                        {plan.is_completed && <Check className="w-3.5 h-3.5 text-gray-600" />}
                                    </button>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm font-medium ${plan.is_completed ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                                            {plan.task_name}
                                        </p>
                                    </div>

                                    {/* Delete btn */}
                                    <button
                                        onClick={() => handleDelete(plan.id)}
                                        className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded-md hover:bg-red-50"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-10 px-4 rounded-xl" style={{ border: '1px dashed #CFCFCB', background: '#FFFFFF' }}>
                        <CheckSquare className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                        <p className="text-sm font-medium text-gray-900">Chưa có nhiệm vụ nào</p>
                        <p className="text-xs text-gray-500 mt-1">Bắt đầu lên kế hoạch cho hôm nay để tăng năng suất!</p>
                    </div>
                )}

                {/* Add Task Input */}
                <div className="mt-4 p-2.5 bg-white rounded-xl border border-gray-200 focus-within:ring-2 focus-within:ring-indigo-100 focus-within:border-indigo-300 transition-all shadow-sm">
                    <form onSubmit={handleAddTask} className="flex items-center gap-2">
                        <div className="p-2 text-indigo-600 bg-indigo-50 rounded-lg">
                            <Plus className="w-4 h-4" />
                        </div>
                        <input
                            type="text"
                            value={newTaskName}
                            onChange={(e) => setNewTaskName(e.target.value)}
                            placeholder="Thêm nhiệm vụ mới..."
                            className="flex-1 bg-transparent border-none focus:ring-0 text-sm px-1 py-1"
                        />

                        {/* Color Picker */}
                        <div className="flex items-center gap-1 border-l border-gray-200 pl-2">
                            {COLORS.map(c => (
                                <div
                                    key={c.id}
                                    onClick={() => setNewTaskColor(c)}
                                    className={`w-5 h-5 rounded-full cursor-pointer flex items-center justify-center transition-transform ${newTaskColor.id === c.id ? 'scale-110 ring-2 ring-offset-1' : 'hover:scale-110'}`}
                                    style={{ backgroundColor: c.value, '--tw-ring-color': c.value } as any}
                                />
                            ))}
                        </div>

                        {/* Send Button */}
                        <button type="submit" disabled={!newTaskName.trim()} className={`ml-1 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${newTaskName.trim() ? 'bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700 cursor-pointer' : 'bg-gray-100 border-gray-100 text-gray-400 cursor-not-allowed'}`}>
                            <Send className="w-3.5 h-3.5" />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default StudyPlanner;
