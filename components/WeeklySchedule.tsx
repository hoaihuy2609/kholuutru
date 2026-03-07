import React, { useState, useEffect } from 'react';
import { ScheduleItem } from '../types';
import { Calendar, Clock, Plus, Trash2, Edit2, ChevronLeft, ChevronRight, BookOpen, AlertCircle, Save, X } from 'lucide-react';

interface WeeklyScheduleProps {
    isAdmin: boolean;
    studentGrade: number | null;
    onLoadSchedules: (grade: number) => Promise<ScheduleItem[]>;
    onSaveSchedule: (schedule: Omit<ScheduleItem, 'id' | 'created_at'>) => Promise<ScheduleItem | null>;
    onUpdateSchedule: (id: string, updates: Partial<ScheduleItem>, grade: number) => Promise<boolean>;
    onDeleteSchedule: (id: string, grade: number) => Promise<boolean>;
}

const DAYS_OF_WEEK = [
    { id: 1, name: 'Thứ 2', dateOffset: 0 },
    { id: 2, name: 'Thứ 3', dateOffset: 1 },
    { id: 3, name: 'Thứ 4', dateOffset: 2 },
    { id: 4, name: 'Thứ 5', dateOffset: 3 },
    { id: 5, name: 'Thứ 6', dateOffset: 4 },
    { id: 6, name: 'Thứ 7', dateOffset: 5 },
];

const GRADES = [10, 11, 12];

const getMonDay = (d: Date) => {
    const day = d.getDay(),
        diff = d.getDate() - day + (day == 0 ? -6 : 1);
    const date = new Date(d);
    date.setDate(diff);
    return date;
};

const formatISODate = (d: Date) => {
    const tzOffset = d.getTimezoneOffset() * 60000;
    return (new Date(d.getTime() - tzOffset)).toISOString().slice(0, 10);
};

export const WeeklySchedule: React.FC<WeeklyScheduleProps> = ({
    isAdmin,
    studentGrade,
    onLoadSchedules,
    onSaveSchedule,
    onUpdateSchedule,
    onDeleteSchedule
}) => {
    const [selectedGrade, setSelectedGrade] = useState<number>(isAdmin ? 12 : (studentGrade || 12));
    const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getMonDay(new Date()));
    const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
    const [loading, setLoading] = useState(true);

    const [editingItem, setEditingItem] = useState<Partial<ScheduleItem> | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);

    useEffect(() => {
        if (!isAdmin && studentGrade) {
            setSelectedGrade(studentGrade);
        }
    }, [isAdmin, studentGrade]);

    useEffect(() => {
        fetchSchedules();
    }, [selectedGrade]);

    const fetchSchedules = async () => {
        setLoading(true);
        const data = await onLoadSchedules(selectedGrade);
        setSchedules(data || []);
        setLoading(false);
    };

    const handleNextWeek = () => {
        const next = new Date(currentWeekStart);
        next.setDate(next.getDate() + 7);
        setCurrentWeekStart(next);
    };

    const handlePrevWeek = () => {
        const prev = new Date(currentWeekStart);
        prev.setDate(prev.getDate() - 7);
        setCurrentWeekStart(prev);
    };

    const handleJumpToCurrentWeek = () => {
        setCurrentWeekStart(getMonDay(new Date()));
    };

    const handleSaveSchedule = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingItem || !editingItem.title || !editingItem.date || !editingItem.start_time || !editingItem.end_time) {
            alert("Vui lòng nhập đầy đủ thông tin!");
            return;
        }

        const payload: Omit<ScheduleItem, 'id' | 'created_at'> = {
            title: editingItem.title,
            description: editingItem.description || '',
            date: editingItem.date,
            start_time: editingItem.start_time,
            end_time: editingItem.end_time,
            grade: selectedGrade
        };

        if (editingItem.id) {
            const success = await onUpdateSchedule(editingItem.id, payload, selectedGrade);
            if (success) {
                setSchedules(prev => prev.map(s => s.id === editingItem.id ? { ...s, ...payload } : s));
            }
        } else {
            const newSchedule = await onSaveSchedule(payload);
            if (newSchedule) {
                setSchedules(prev => [...prev, newSchedule]);
            }
        }
        setIsFormOpen(false);
        setEditingItem(null);
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm("Bạn có chắc chắn muốn xóa lịch học này?")) {
            await onDeleteSchedule(id, selectedGrade);
            setSchedules(prev => prev.filter(s => s.id !== id));
        }
    };

    const openFormForNew = (dateStr: string) => {
        setEditingItem({
            date: dateStr,
            start_time: "19:00",
            end_time: "20:30",
            grade: selectedGrade,
            title: "",
            description: ""
        });
        setIsFormOpen(true);
    };

    const openFormForEdit = (item: ScheduleItem) => {
        setEditingItem(item);
        setIsFormOpen(true);
    };

    const currentWeekEnd = new Date(currentWeekStart);
    currentWeekEnd.setDate(currentWeekEnd.getDate() + 6);

    const formatHeaderDate = (d: Date) => d.toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric' });

    return (
        <div className="animate-fade-in flex flex-col gap-6 w-full">
            {isAdmin && (
                <div className="flex gap-2 bg-white p-1 rounded-lg w-max border border-gray-200 shadow-sm">
                    {GRADES.map(grade => (
                        <button
                            key={grade}
                            onClick={() => setSelectedGrade(grade)}
                            className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${selectedGrade === grade ? 'bg-[#448361] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
                        >
                            Khối {grade}
                        </button>
                    ))}
                </div>
            )}

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-[#448361]" />
                        Tuần từ {formatHeaderDate(currentWeekStart)} đến {formatHeaderDate(currentWeekEnd)}
                    </h2>
                    <div className="flex gap-1 items-center bg-gray-50 p-1 rounded-md border border-gray-200">
                        <button onClick={handlePrevWeek} className="p-1 rounded text-gray-600 hover:bg-gray-200 transition">
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button onClick={handleJumpToCurrentWeek} className="px-2 py-1 text-xs font-semibold text-[#448361] hover:bg-[#EAF3EE] rounded transition">
                            Hiện tại
                        </button>
                        <button onClick={handleNextWeek} className="p-1 rounded text-gray-600 hover:bg-gray-200 transition">
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center p-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#448361]"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {DAYS_OF_WEEK.map((day) => {
                        const cellDate = new Date(currentWeekStart);
                        cellDate.setDate(cellDate.getDate() + day.dateOffset);
                        const dateStr = formatISODate(cellDate);
                        const isToday = dateStr === formatISODate(new Date());

                        const dayItems = schedules.filter(s => s.date === dateStr).sort((a, b) => a.start_time.localeCompare(b.start_time));

                        return (
                            <div
                                key={day.id}
                                className="flex flex-col rounded-xl overflow-hidden transition-all duration-200 h-full"
                                style={{
                                    background: isToday ? '#F9FCFA' : '#FFFFFF',
                                    border: `1px solid ${isToday ? '#A7D7BC' : '#E9E9E7'}`,
                                    boxShadow: isToday ? '0 2px 8px rgba(0,0,0,0.06)' : 'none'
                                }}
                            >
                                {/* Day Header */}
                                <div
                                    className="py-2.5 px-4 flex justify-between items-center"
                                    style={{
                                        background: isToday ? '#EAF3EE' : '#F7F6F3',
                                        borderBottom: `1px solid ${isToday ? '#A7D7BC' : '#E9E9E7'}`
                                    }}
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: isToday ? '#448361' : '#787774' }}>{day.name}</div>
                                    </div>
                                    {isAdmin && (
                                        <button
                                            onClick={() => openFormForNew(dateStr)}
                                            className="p-1 transition-all rounded-md"
                                            style={{ color: isToday ? '#448361' : '#AEACA8' }}
                                            onMouseEnter={e => {
                                                (e.currentTarget as HTMLElement).style.background = isToday ? '#A7D7BC' : '#E9E9E7';
                                                (e.currentTarget as HTMLElement).style.color = isToday ? '#20402e' : '#1A1A1A';
                                            }}
                                            onMouseLeave={e => {
                                                (e.currentTarget as HTMLElement).style.background = 'transparent';
                                                (e.currentTarget as HTMLElement).style.color = isToday ? '#448361' : '#AEACA8';
                                            }}
                                            title="Thêm lịch"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>

                                {/* Items Content */}
                                <div className="p-3 flex-grow flex flex-col gap-2.5 min-h-[100px]">
                                    {dayItems.length === 0 ? (
                                        <div className="flex-grow flex items-center justify-center">
                                            <span className="text-[12px] font-medium italic" style={{ color: '#CFCFCB' }}>Trống</span>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-2.5">
                                            {dayItems.map(item => (
                                                <div
                                                    key={item.id}
                                                    className="group/item rounded-lg p-3 transition-all duration-200 flex flex-col relative w-full cursor-default"
                                                    style={{ background: '#FFFFFF', border: '1px solid #E9E9E7' }}
                                                    onMouseEnter={e => {
                                                        (e.currentTarget as HTMLElement).style.borderColor = '#CFCFCB';
                                                        (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)';
                                                        (e.currentTarget as HTMLElement).style.background = '#FAFAF9';
                                                    }}
                                                    onMouseLeave={e => {
                                                        (e.currentTarget as HTMLElement).style.borderColor = '#E9E9E7';
                                                        (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                                                        (e.currentTarget as HTMLElement).style.background = '#FFFFFF';
                                                    }}
                                                >
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div className="flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-md" style={{ color: '#D9730D', background: '#FFF3E8', border: '1px solid #F5C796' }}>
                                                            <Clock className="w-3 h-3" />
                                                            {item.start_time} - {item.end_time}
                                                        </div>
                                                        {isAdmin && (
                                                            <div className="flex gap-1 opacity-100 xl:opacity-0 group-hover/item:opacity-100 transition-opacity bg-transparent pl-1 z-10 rounded">
                                                                <button onClick={() => openFormForEdit(item)} className="p-1 rounded-md transition-colors" style={{ color: '#AEACA8' }} onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#EEF0FB'; (e.currentTarget as HTMLElement).style.color = '#6B7CDB'; }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#AEACA8'; }}>
                                                                    <Edit2 className="w-3.5 h-3.5" />
                                                                </button>
                                                                <button onClick={(e) => handleDelete(item.id, e)} className="p-1 rounded-md transition-colors" style={{ color: '#AEACA8' }} onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#FEF2F2'; (e.currentTarget as HTMLElement).style.color = '#E03E3E'; }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#AEACA8'; }}>
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="text-[13px] font-semibold leading-relaxed pr-6" style={{ color: '#1A1A1A' }}>
                                                        {item.title}
                                                    </div>
                                                    {item.description && (
                                                        <div className="text-[12px] font-medium whitespace-pre-wrap pl-2.5 mt-2 max-h-[60px] overflow-y-auto custom-scrollbar" style={{ borderLeft: '2px solid #E9E9E7', color: '#787774' }}>
                                                            {item.description}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {isFormOpen && isAdmin && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 animate-fade-in" style={{ border: '1px solid #E9E9E7' }}>
                        <div className="flex justify-between items-center mb-5">
                            <h3 className="text-lg font-bold text-gray-900">
                                {editingItem?.id ? 'Sửa chi tiết lịch trình' : 'Thêm mới lịch trình'}
                            </h3>
                            <button onClick={() => setIsFormOpen(false)} className="text-gray-400 hover:text-gray-900 bg-gray-100 p-1.5 rounded-lg">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveSchedule} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Tiêu đề (Lý 12 - Con Lắc Đơn...)</label>
                                <input
                                    type="text"
                                    value={editingItem?.title || ''}
                                    onChange={(e) => setEditingItem(p => ({ ...p, title: e.target.value }))}
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:border-[#448361] focus:ring-2 focus:ring-[#A7D7BC] outline-none transition-all"
                                    placeholder="Nội dung bài học..."
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Bắt đầu</label>
                                    <input
                                        type="time"
                                        value={editingItem?.start_time || ''}
                                        onChange={(e) => setEditingItem(p => ({ ...p, start_time: e.target.value }))}
                                        className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:border-[#448361] outline-none"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Kết thúc</label>
                                    <input
                                        type="time"
                                        value={editingItem?.end_time || ''}
                                        onChange={(e) => setEditingItem(p => ({ ...p, end_time: e.target.value }))}
                                        className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:border-[#448361] outline-none"
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider flex items-center justify-between">
                                    <span>Ghi chú chi tiết / Nội dung</span>
                                    <span className="text-[10px] text-blue-500 font-medium">Bao gồm Link Meet, HD học</span>
                                </label>
                                <textarea
                                    rows={4}
                                    value={editingItem?.description || ''}
                                    onChange={(e) => setEditingItem(p => ({ ...p, description: e.target.value }))}
                                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-[#448361] focus:ring-2 focus:ring-[#A7D7BC] outline-none transition-all resize-none font-medium custom-scrollbar"
                                    placeholder="Dán link meet vào đây, hoặc ghi chú nội dung dặn dò học sinh trước buổi."
                                />
                            </div>
                            <div className="pt-2 text-right">
                                <button type="submit" className="bg-[#448361] text-white font-bold py-2.5 px-6 rounded-xl hover:bg-[#32694a] transition-colors focus:ring-4 focus:ring-[#A7D7BC]">
                                    {editingItem?.id ? 'Lưu thay đổi' : 'Tạo lịch mới'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #E9E9E7;
                    border-radius: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #CFCFCB;
                }
            `}</style>
        </div>
    );
};
