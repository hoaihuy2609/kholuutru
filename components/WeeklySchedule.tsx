import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ScheduleItem } from '../types';
import { Calendar, Clock, Plus, Trash2, Edit2, ChevronLeft, ChevronRight, Save, X } from 'lucide-react';

interface WeeklyScheduleProps {
    isAdmin: boolean;
    studentGrade: number | null;
    onLoadSchedules: (grade: number) => Promise<ScheduleItem[]>;
    onSaveSchedule: (schedule: Omit<ScheduleItem, 'id' | 'created_at'>) => Promise<ScheduleItem | null>;
    onUpdateSchedule: (id: string, updates: Partial<ScheduleItem>, grade: number) => Promise<boolean>;
    onDeleteSchedule: (id: string, grade: number) => Promise<boolean>;
}

const DAYS_OF_WEEK = [
    { id: 1, name: 'Thứ 2', short: 'T2', dateOffset: 0 },
    { id: 2, name: 'Thứ 3', short: 'T3', dateOffset: 1 },
    { id: 3, name: 'Thứ 4', short: 'T4', dateOffset: 2 },
    { id: 4, name: 'Thứ 5', short: 'T5', dateOffset: 3 },
    { id: 5, name: 'Thứ 6', short: 'T6', dateOffset: 4 },
    { id: 6, name: 'Thứ 7', short: 'T7', dateOffset: 5 },
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

const ACCENT_COLORS = [
    { bg: '#EEF0FB', border: '#6B7CDB', text: '#4B5CC4' },
    { bg: '#F3ECF8', border: '#9065B0', text: '#7B4FA0' },
    { bg: '#EAF3EE', border: '#448361', text: '#2E6B47' },
    { bg: '#FFF3E8', border: '#D9730D', text: '#B85C00' },
    { bg: '#FEF2F2', border: '#E03E3E', text: '#C52828' },
    { bg: '#E8F4FD', border: '#2B88D8', text: '#1A6DB8' },
];

export const WeeklySchedule: React.FC<WeeklyScheduleProps> = React.memo(({
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
        if (!isAdmin && studentGrade) setSelectedGrade(studentGrade);
    }, [isAdmin, studentGrade]);

    useEffect(() => { fetchSchedules(); }, [selectedGrade]);



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

    const handleJumpToCurrentWeek = () => setCurrentWeekStart(getMonDay(new Date()));

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
            if (success) setSchedules(prev => prev.map(s => s.id === editingItem.id ? { ...s, ...payload } : s));
        } else {
            const newSchedule = await onSaveSchedule(payload);
            if (newSchedule) setSchedules(prev => [...prev, newSchedule]);
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
        setEditingItem({ date: dateStr, start_time: "19:00", end_time: "20:30", grade: selectedGrade, title: "", description: "" });
        setIsFormOpen(true);
    };

    const openFormForEdit = (item: ScheduleItem) => {
        setEditingItem(item);
        setIsFormOpen(true);
    };

    const currentWeekEnd = new Date(currentWeekStart);
    currentWeekEnd.setDate(currentWeekEnd.getDate() + 5);

    const fmtDate = (d: Date) => d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    const fmtMonth = (d: Date) => d.toLocaleDateString('vi-VN', { month: 'long' });

    const todayStr = formatISODate(new Date());

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                            width: '36px', height: '36px', borderRadius: '10px',
                            background: 'linear-gradient(135deg, #448361, #5BA37A)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 2px 8px rgba(68,131,97,0.25)'
                        }}>
                            <Calendar style={{ width: '18px', height: '18px', color: '#fff' }} />
                        </div>
                        <div>
                            <div style={{ fontSize: '18px', fontWeight: 700, color: '#1A1A1A', lineHeight: 1.2 }}>
                                Lịch tuần
                            </div>
                            <div style={{ fontSize: '12px', color: '#787774', fontWeight: 500 }}>
                                {fmtDate(currentWeekStart)} — {fmtDate(currentWeekEnd)} · {fmtMonth(currentWeekStart)}
                            </div>
                        </div>
                    </div>



                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '2px',
                        background: '#F7F6F3', padding: '3px', borderRadius: '10px',
                        border: '1px solid #E9E9E7'
                    }}>
                        <button onClick={handlePrevWeek} style={{
                            padding: '6px', borderRadius: '7px', border: 'none', background: 'transparent',
                            color: '#787774', cursor: 'pointer', display: 'flex', transition: 'all 0.15s'
                        }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#E9E9E7'; e.currentTarget.style.color = '#1A1A1A'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#787774'; }}
                        >
                            <ChevronLeft style={{ width: '16px', height: '16px' }} />
                        </button>
                        <button onClick={handleJumpToCurrentWeek} style={{
                            padding: '4px 12px', borderRadius: '7px', border: 'none',
                            background: 'transparent', color: '#448361', cursor: 'pointer',
                            fontSize: '12px', fontWeight: 700, transition: 'all 0.15s'
                        }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#EAF3EE'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                        >
                            Hôm nay
                        </button>
                        <button onClick={handleNextWeek} style={{
                            padding: '6px', borderRadius: '7px', border: 'none', background: 'transparent',
                            color: '#787774', cursor: 'pointer', display: 'flex', transition: 'all 0.15s'
                        }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#E9E9E7'; e.currentTarget.style.color = '#1A1A1A'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#787774'; }}
                        >
                            <ChevronRight style={{ width: '16px', height: '16px' }} />
                        </button>
                    </div>
                </div>

                {isAdmin && (
                    <div style={{
                        display: 'flex', gap: '3px', background: '#F7F6F3', padding: '3px',
                        borderRadius: '10px', border: '1px solid #E9E9E7'
                    }}>
                        {GRADES.map(grade => {
                            const colors = {
                                10: { bg: '#6B7CDB', shadow: 'rgba(107,124,219,0.3)' },
                                11: { bg: '#9065B0', shadow: 'rgba(144,101,176,0.3)' },
                                12: { bg: '#448361', shadow: 'rgba(68,131,97,0.3)' }
                            }[grade as 10 | 11 | 12];
                            
                            return (
                                <button
                                    key={grade}
                                    onClick={() => setSelectedGrade(grade)}
                                    style={{
                                        padding: '5px 14px', borderRadius: '7px', border: 'none',
                                        fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        background: selectedGrade === grade ? colors.bg : 'transparent',
                                        color: selectedGrade === grade ? '#fff' : '#787774',
                                        boxShadow: selectedGrade === grade ? `0 2px 6px ${colors.shadow}` : 'none'
                                    }}
                                >
                                    Lớp {grade}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Schedule Grid */}
            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
                    <div className="animate-spin" style={{ width: '32px', height: '32px', borderRadius: '50%', border: '3px solid #EAF3EE', borderTopColor: '#448361' }} />
                </div>
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: '12px'
                }}>
                    {DAYS_OF_WEEK.map((day, dayIndex) => {
                        const cellDate = new Date(currentWeekStart);
                        cellDate.setDate(cellDate.getDate() + day.dateOffset);
                        const dateStr = formatISODate(cellDate);
                        const isToday = dateStr === todayStr;
                        const isPast = dateStr < todayStr;
                        const dayItems = schedules.filter(s => s.date === dateStr).sort((a, b) => a.start_time.localeCompare(b.start_time));
                        const dateNum = cellDate.getDate();

                        return (
                            <div
                                key={day.id}
                                style={{
                                    borderRadius: '14px',
                                    overflow: 'hidden',
                                    border: isToday ? '1.5px solid #448361' : '1px solid #E9E9E7',
                                    background: '#fff',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    transition: 'all 0.2s ease',
                                    opacity: isPast ? 0.6 : 1,
                                    boxShadow: isToday ? '0 4px 16px rgba(68,131,97,0.12)' : '0 1px 3px rgba(0,0,0,0.04)',
                                    position: 'relative',
                                }}
                                onMouseEnter={e => {
                                    if (!isToday) {
                                        e.currentTarget.style.borderColor = '#CFCFCB';
                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)';
                                    }
                                    e.currentTarget.style.opacity = '1';
                                }}
                                onMouseLeave={e => {
                                    if (!isToday) {
                                        e.currentTarget.style.borderColor = '#E9E9E7';
                                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
                                    }
                                    e.currentTarget.style.opacity = isPast ? '0.6' : '1';
                                }}
                            >
                                {/* Day Header */}
                                <div style={{
                                    padding: '10px 14px',
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    background: isToday ? 'linear-gradient(135deg, #EAF3EE, #F0F7F3)' : '#FAFAF9',
                                    borderBottom: `1px solid ${isToday ? '#C5E4D1' : '#F0F0EE'}`,
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{
                                            width: '32px', height: '32px', borderRadius: '9px',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '14px', fontWeight: 800,
                                            background: isToday ? '#448361' : '#F0F0EE',
                                            color: isToday ? '#fff' : '#787774',
                                            boxShadow: isToday ? '0 2px 6px rgba(68,131,97,0.3)' : 'none',
                                            transition: 'all 0.2s',
                                        }}>
                                            {dateNum}
                                        </div>
                                        <div>
                                            <div style={{
                                                fontSize: '13px', fontWeight: 700,
                                                color: isToday ? '#2E6B47' : '#1A1A1A',
                                                lineHeight: 1
                                            }}>
                                                {day.name}
                                            </div>
                                            {isToday && (
                                                <div style={{
                                                    fontSize: '10px', fontWeight: 700, color: '#448361',
                                                    letterSpacing: '0.05em', marginTop: '2px'
                                                }}>
                                                    HÔM NAY
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {isAdmin && (
                                        <button
                                            onClick={() => openFormForNew(dateStr)}
                                            style={{
                                                width: '28px', height: '28px', borderRadius: '8px', border: 'none',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                background: isToday ? '#C5E4D1' : '#F0F0EE',
                                                color: isToday ? '#2E6B47' : '#AEACA8',
                                                cursor: 'pointer', transition: 'all 0.15s'
                                            }}
                                            onMouseEnter={e => {
                                                e.currentTarget.style.background = isToday ? '#448361' : '#E9E9E7';
                                                e.currentTarget.style.color = isToday ? '#fff' : '#1A1A1A';
                                                e.currentTarget.style.transform = 'scale(1.05)';
                                            }}
                                            onMouseLeave={e => {
                                                e.currentTarget.style.background = isToday ? '#C5E4D1' : '#F0F0EE';
                                                e.currentTarget.style.color = isToday ? '#2E6B47' : '#AEACA8';
                                                e.currentTarget.style.transform = 'scale(1)';
                                            }}
                                            title="Thêm lịch"
                                        >
                                            <Plus style={{ width: '15px', height: '15px' }} />
                                        </button>
                                    )}
                                </div>

                                {/* Items */}
                                <div style={{
                                    padding: '10px 12px',
                                    flexGrow: 1, display: 'flex', flexDirection: 'column',
                                    gap: '8px', minHeight: '90px'
                                }}>
                                    {dayItems.length === 0 ? (
                                        <div style={{
                                            flexGrow: 1, display: 'flex', flexDirection: 'column',
                                            alignItems: 'center', justifyContent: 'center', gap: '6px',
                                            padding: '12px 0'
                                        }}>
                                            <div style={{
                                                width: '32px', height: '32px', borderRadius: '50%',
                                                background: '#F7F6F3', display: 'flex',
                                                alignItems: 'center', justifyContent: 'center'
                                            }}>
                                                <Calendar style={{ width: '14px', height: '14px', color: '#CFCFCB' }} />
                                            </div>
                                            <span style={{ fontSize: '11px', color: '#CFCFCB', fontWeight: 500 }}>
                                                Chưa có lịch
                                            </span>
                                        </div>
                                    ) : (
                                        dayItems.map((item, itemIdx) => {
                                            const accent = ACCENT_COLORS[itemIdx % ACCENT_COLORS.length];
                                            return (
                                                <div
                                                    key={item.id}
                                                    className="group/item"
                                                    style={{
                                                        borderRadius: '10px', padding: '10px 12px',
                                                        background: accent.bg,
                                                        borderLeft: `3px solid ${accent.border}`,
                                                        transition: 'all 0.15s',
                                                        cursor: 'default', position: 'relative'
                                                    }}
                                                    onMouseEnter={e => {
                                                        e.currentTarget.style.boxShadow = `0 2px 8px ${accent.border}20`;
                                                        e.currentTarget.style.transform = 'translateX(2px)';
                                                    }}
                                                    onMouseLeave={e => {
                                                        e.currentTarget.style.boxShadow = 'none';
                                                        e.currentTarget.style.transform = 'translateX(0)';
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                        <div style={{
                                                            display: 'flex', alignItems: 'center', gap: '5px',
                                                            fontSize: '10px', fontWeight: 700, color: accent.text,
                                                            letterSpacing: '0.02em'
                                                        }}>
                                                            <Clock style={{ width: '11px', height: '11px' }} />
                                                            {item.start_time} – {item.end_time}
                                                        </div>
                                                        {isAdmin && (
                                                            <div className="sched-actions" style={{
                                                                display: 'flex', gap: '2px',
                                                                opacity: 0, transition: 'opacity 0.15s'
                                                            }}>
                                                                <button onClick={() => openFormForEdit(item)} style={{
                                                                    padding: '3px', borderRadius: '5px', border: 'none',
                                                                    background: 'transparent', color: '#AEACA8', cursor: 'pointer',
                                                                    display: 'flex', transition: 'all 0.15s'
                                                                }}
                                                                    onMouseEnter={e => { e.currentTarget.style.background = '#EEF0FB'; e.currentTarget.style.color = '#6B7CDB'; }}
                                                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#AEACA8'; }}
                                                                >
                                                                    <Edit2 style={{ width: '12px', height: '12px' }} />
                                                                </button>
                                                                <button onClick={(e) => handleDelete(item.id, e)} style={{
                                                                    padding: '3px', borderRadius: '5px', border: 'none',
                                                                    background: 'transparent', color: '#AEACA8', cursor: 'pointer',
                                                                    display: 'flex', transition: 'all 0.15s'
                                                                }}
                                                                    onMouseEnter={e => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = '#E03E3E'; }}
                                                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#AEACA8'; }}
                                                                >
                                                                    <Trash2 style={{ width: '12px', height: '12px' }} />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div style={{
                                                        fontSize: '13px', fontWeight: 650, color: '#1A1A1A',
                                                        marginTop: '5px', lineHeight: 1.35
                                                    }}>
                                                        {item.title}
                                                    </div>
                                                    {item.description && (
                                                        <div className="custom-scrollbar" style={{
                                                            fontSize: '11px', color: '#787774', fontWeight: 500,
                                                            marginTop: '6px', paddingTop: '6px',
                                                            borderTop: `1px dashed ${accent.border}40`,
                                                            lineHeight: 1.5, maxHeight: '48px',
                                                            overflow: 'hidden', whiteSpace: 'pre-wrap'
                                                        }}>
                                                            {item.description}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal Form — rendered via Portal to cover full screen including sidebar */}
            {isFormOpen && isAdmin && createPortal(
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
                    backdropFilter: 'blur(4px)', zIndex: 9999,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '16px'
                }}>
                    <div className="animate-fade-in" style={{
                        background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '420px',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.15)', border: '1px solid #E9E9E7',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            padding: '18px 20px',
                            background: 'linear-gradient(135deg, #EAF3EE, #F0F7F3)',
                            borderBottom: '1px solid #E9E9E7',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{
                                    width: '32px', height: '32px', borderRadius: '9px',
                                    background: '#448361', display: 'flex',
                                    alignItems: 'center', justifyContent: 'center'
                                }}>
                                    <Calendar style={{ width: '16px', height: '16px', color: '#fff' }} />
                                </div>
                                <span style={{ fontSize: '16px', fontWeight: 700, color: '#1A1A1A' }}>
                                    {editingItem?.id ? 'Chỉnh sửa lịch' : 'Thêm lịch mới'}
                                </span>
                            </div>
                            <button onClick={() => setIsFormOpen(false)} style={{
                                width: '30px', height: '30px', borderRadius: '8px', border: 'none',
                                background: '#E9E9E7', color: '#787774', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.15s'
                            }}
                                onMouseEnter={e => { e.currentTarget.style.background = '#CFCFCB'; e.currentTarget.style.color = '#1A1A1A'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = '#E9E9E7'; e.currentTarget.style.color = '#787774'; }}
                            >
                                <X style={{ width: '16px', height: '16px' }} />
                            </button>
                        </div>
                        <form onSubmit={handleSaveSchedule} style={{ padding: '20px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#787774', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Tiêu đề
                                    </label>
                                    <input
                                        type="text"
                                        value={editingItem?.title || ''}
                                        onChange={(e) => setEditingItem(p => ({ ...p, title: e.target.value }))}
                                        style={{
                                            width: '100%', border: '1px solid #E9E9E7', borderRadius: '10px',
                                            padding: '10px 14px', fontSize: '14px', outline: 'none',
                                            transition: 'all 0.15s', boxSizing: 'border-box'
                                        }}
                                        onFocus={e => { e.target.style.borderColor = '#448361'; e.target.style.boxShadow = '0 0 0 3px rgba(68,131,97,0.12)'; }}
                                        onBlur={e => { e.target.style.borderColor = '#E9E9E7'; e.target.style.boxShadow = 'none'; }}
                                        placeholder="VD: Lý 12 — Dao Động Điều Hòa"
                                        required
                                    />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#787774', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            Bắt đầu
                                        </label>
                                        <input
                                            type="time"
                                            value={editingItem?.start_time || ''}
                                            onChange={(e) => setEditingItem(p => ({ ...p, start_time: e.target.value }))}
                                            style={{
                                                width: '100%', border: '1px solid #E9E9E7', borderRadius: '10px',
                                                padding: '10px 14px', fontSize: '14px', outline: 'none',
                                                transition: 'all 0.15s', boxSizing: 'border-box'
                                            }}
                                            onFocus={e => { e.target.style.borderColor = '#448361'; e.target.style.boxShadow = '0 0 0 3px rgba(68,131,97,0.12)'; }}
                                            onBlur={e => { e.target.style.borderColor = '#E9E9E7'; e.target.style.boxShadow = 'none'; }}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#787774', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            Kết thúc
                                        </label>
                                        <input
                                            type="time"
                                            value={editingItem?.end_time || ''}
                                            onChange={(e) => setEditingItem(p => ({ ...p, end_time: e.target.value }))}
                                            style={{
                                                width: '100%', border: '1px solid #E9E9E7', borderRadius: '10px',
                                                padding: '10px 14px', fontSize: '14px', outline: 'none',
                                                transition: 'all 0.15s', boxSizing: 'border-box'
                                            }}
                                            onFocus={e => { e.target.style.borderColor = '#448361'; e.target.style.boxShadow = '0 0 0 3px rgba(68,131,97,0.12)'; }}
                                            onBlur={e => { e.target.style.borderColor = '#E9E9E7'; e.target.style.boxShadow = 'none'; }}
                                            required
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', fontWeight: 700, color: '#787774', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        <span>Ghi chú</span>
                                        <span style={{ fontSize: '10px', color: '#6B7CDB', fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>Link Meet, nội dung...</span>
                                    </label>
                                    <textarea
                                        rows={3}
                                        value={editingItem?.description || ''}
                                        onChange={(e) => setEditingItem(p => ({ ...p, description: e.target.value }))}
                                        className="custom-scrollbar"
                                        style={{
                                            width: '100%', border: '1px solid #E9E9E7', borderRadius: '10px',
                                            padding: '10px 14px', fontSize: '13px', outline: 'none',
                                            transition: 'all 0.15s', resize: 'none', boxSizing: 'border-box',
                                            lineHeight: 1.6
                                        }}
                                        onFocus={e => { e.target.style.borderColor = '#448361'; e.target.style.boxShadow = '0 0 0 3px rgba(68,131,97,0.12)'; }}
                                        onBlur={e => { e.target.style.borderColor = '#E9E9E7'; e.target.style.boxShadow = 'none'; }}
                                        placeholder="Dán link meet, ghi chú dặn dò..."
                                    />
                                </div>
                            </div>
                            <div style={{ marginTop: '18px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                <button type="button" onClick={() => setIsFormOpen(false)} style={{
                                    padding: '9px 18px', borderRadius: '10px', border: '1px solid #E9E9E7',
                                    background: '#fff', color: '#787774', fontSize: '13px', fontWeight: 600,
                                    cursor: 'pointer', transition: 'all 0.15s'
                                }}
                                    onMouseEnter={e => { e.currentTarget.style.background = '#F7F6F3'; e.currentTarget.style.borderColor = '#CFCFCB'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#E9E9E7'; }}
                                >
                                    Hủy
                                </button>
                                <button type="submit" style={{
                                    padding: '9px 22px', borderRadius: '10px', border: 'none',
                                    background: 'linear-gradient(135deg, #448361, #5BA37A)',
                                    color: '#fff', fontSize: '13px', fontWeight: 700,
                                    cursor: 'pointer', transition: 'all 0.15s',
                                    boxShadow: '0 2px 8px rgba(68,131,97,0.3)',
                                    display: 'flex', alignItems: 'center', gap: '6px'
                                }}
                                    onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 14px rgba(68,131,97,0.4)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(68,131,97,0.3)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                                >
                                    <Save style={{ width: '14px', height: '14px' }} />
                                    {editingItem?.id ? 'Lưu thay đổi' : 'Tạo lịch'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            , document.body)}

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #E9E9E7; border-radius: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #CFCFCB; }
                .group\\/item:hover .sched-actions { opacity: 1 !important; }
            `}</style>
        </div>
    );
});
