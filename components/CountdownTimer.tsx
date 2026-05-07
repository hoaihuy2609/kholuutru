import React, { useState, useEffect, useCallback } from 'react';
import { Clock, Calendar, Edit2, Check, X, Target, Atom, Zap, Activity } from 'lucide-react';
import { supabase } from '../src/lib/supabase';

// ── Types ─────────────────────────────────────────────────────────
interface ExamSetting {
    date: string;  // datetime-local string, ví dụ: "2026-05-11T08:00"
    name: string;
}

type GradeSettings = Record<number, ExamSetting>;

interface CountdownTimerProps {
    isAdmin?: boolean;
    studentGrade?: number | null; // null = admin (thấy tất cả)
}

// ── Grade config ──────────────────────────────────────────────────
const GRADE_CFG: Record<number, { label: string; color: string; bg: string; border: string; icon: React.ElementType }> = {
    10: { label: 'Lớp 10', color: '#448361', bg: '#EAF3EE', border: '#B7D9C4', icon: Activity },
    11: { label: 'Lớp 11', color: '#6B7CDB', bg: '#EEF0FB', border: '#B8C1EF', icon: Zap },
    12: { label: 'Lớp 12', color: '#9065B0', bg: '#F3ECF8', border: '#C8A8DC', icon: Atom },
};

const DEFAULT_NAME = 'Hành trình đến kỳ thi';
const SETTING_KEY = (grade: number) => `exam_deadline_${grade}`;

// ── Supabase helpers ──────────────────────────────────────────────
async function fetchSettingFromDB(grade: number): Promise<ExamSetting | null> {
    try {
        const { data, error } = await supabase.rpc('get_app_setting', {
            p_key: SETTING_KEY(grade),
        });
        if (error || !data) return null;
        return JSON.parse(data as string) as ExamSetting;
    } catch {
        return null;
    }
}

async function saveSettingToDB(grade: number, setting: ExamSetting): Promise<boolean> {
    try {
        const { error } = await supabase.rpc('admin_upsert_app_setting', {
            p_key: SETTING_KEY(grade),
            p_value: JSON.stringify(setting),
        });
        return !error;
    } catch {
        return false;
    }
}

// ── Countdown calculation ─────────────────────────────────────────
function calcTimeLeft(dateStr: string) {
    const diff = +new Date(dateStr) - +new Date();
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    return {
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / 1000 / 60) % 60),
        seconds: Math.floor((diff / 1000) % 60),
    };
}

function getDefaultDate() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(8, 0, 0, 0);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ─────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────
const CountdownTimer: React.FC<CountdownTimerProps> = ({ isAdmin, studentGrade }) => {
    // Admin: cài đặt cho cả 3 khối → activeGradeTab để chọn đang edit khối nào
    // Student: chỉ load khối của mình
    const [settings, setSettings] = useState<GradeSettings>({});
    const [activeGradeTab, setActiveGradeTab] = useState<number>(studentGrade ?? 12);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState(false);
    const [tempDate, setTempDate] = useState(getDefaultDate());
    const [tempName, setTempName] = useState(DEFAULT_NAME);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

    // Danh sách khối cần load (admin: 10/11/12, student: chỉ khối của mình)
    const gradesToLoad = isAdmin ? [10, 11, 12] : [studentGrade ?? 12];

    // ── Load settings từ Supabase ──
    const loadSettings = useCallback(async () => {
        const grades = isAdmin ? [10, 11, 12] : [studentGrade ?? 12];
        const results = await Promise.all(grades.map(async g => ({ g, s: await fetchSettingFromDB(g) })));
        const map: GradeSettings = {};
        results.forEach(({ g, s }) => { if (s) map[g] = s; });
        setSettings(map);
    }, [isAdmin, studentGrade]);

    useEffect(() => { loadSettings(); }, [loadSettings]);

    // ── Clock tick ──
    useEffect(() => {
        const t = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

    // ── Countdown tick cho khối đang xem ──
    const viewGrade = isAdmin ? activeGradeTab : (studentGrade ?? 12);
    const currentSetting = settings[viewGrade];

    useEffect(() => {
        if (!currentSetting?.date) { setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 }); return; }
        const calc = () => setTimeLeft(calcTimeLeft(currentSetting.date));
        calc();
        const t = setInterval(calc, 1000);
        return () => clearInterval(t);
    }, [currentSetting]);

    // ── Open edit for a grade ──
    const openEdit = (grade: number) => {
        const s = settings[grade];
        setTempDate(s?.date || getDefaultDate());
        setTempName(s?.name || DEFAULT_NAME);
        setActiveGradeTab(grade);
        setSaveError(false);
        setIsEditing(true);
    };

    // ── Save ──
    const handleSave = async () => {
        if (!tempDate) return;
        setIsSaving(true);
        setSaveError(false);
        const newSetting: ExamSetting = { date: tempDate, name: tempName || DEFAULT_NAME };
        const ok = await saveSettingToDB(activeGradeTab, newSetting);
        setIsSaving(false);
        if (ok) {
            setSettings(prev => ({ ...prev, [activeGradeTab]: newSetting }));
            setIsEditing(false);
        } else {
            // Giữ dialog mở và báo lỗi
            setSaveError(true);
        }
    };

    const hasDate = !!currentSetting?.date;
    const isExpired = hasDate && +new Date(currentSetting!.date) <= +new Date();
    const cfg = GRADE_CFG[viewGrade] ?? GRADE_CFG[12];

    return (
        <div
            className="rounded-xl transition-all"
            style={{
                background: '#FFFFFF',
                border: `1px solid ${hasDate ? cfg.border : '#E9E9E7'}`,
                boxShadow: hasDate ? `0 2px 12px ${cfg.color}18` : 'var(--shadow-sm)',
                transition: 'border-color 0.3s, box-shadow 0.3s',
            }}
        >
            {/* ── Top accent bar (khi đã có deadline) ── */}
            {hasDate && (
                <div className="h-[3px] w-full rounded-t-xl" style={{ background: `linear-gradient(90deg, ${cfg.color}, ${cfg.color}88)` }} />
            )}

            <div className="p-6">
                {!isEditing ? (
                    <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                        {/* Left: clock + label + grade tabs (admin) */}
                        <div className="flex items-center gap-5 w-full md:w-auto">
                            {/* Current clock */}
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

                            <div className="flex-1">
                                {/* Admin: grade tabs */}
                                {isAdmin && (
                                    <div className="flex gap-2 mb-3">
                                        {[10, 11, 12].map(g => {
                                            const c = GRADE_CFG[g];
                                            const GIcon = c.icon;
                                            const active = g === activeGradeTab;
                                            return (
                                                <button
                                                    key={g}
                                                    onClick={() => setActiveGradeTab(g)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                                                    style={{
                                                        background: active ? c.color : '#F1F0EC',
                                                        color: active ? '#fff' : '#787774',
                                                        border: `1px solid ${active ? c.color : '#E9E9E7'}`,
                                                    }}
                                                >
                                                    <GIcon className="w-3 h-3" />
                                                    {c.label}
                                                    {settings[g]?.date && (
                                                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: active ? '#fff' : c.color }} />
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Exam name + edit button */}
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="text-lg font-semibold" style={{ color: '#1A1A1A' }}>
                                        {currentSetting?.name || DEFAULT_NAME}
                                    </h3>
                                    {isAdmin && (
                                        <button
                                            onClick={() => openEdit(viewGrade)}
                                            className="p-1.5 rounded-lg transition-all"
                                            style={{ color: '#AEACA8' }}
                                            onMouseEnter={e => {
                                                (e.currentTarget as HTMLElement).style.background = '#F1F0EC';
                                                (e.currentTarget as HTMLElement).style.color = cfg.color;
                                            }}
                                            onMouseLeave={e => {
                                                (e.currentTarget as HTMLElement).style.background = 'transparent';
                                                (e.currentTarget as HTMLElement).style.color = '#AEACA8';
                                            }}
                                            title={`Chỉnh sửa deadline ${cfg.label}`}
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>

                                {/* Date display */}
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-3.5 h-3.5 shrink-0" style={{ color: '#AEACA8' }} />
                                    <span className="text-sm font-medium" style={{ color: '#787774' }}>
                                        {!hasDate
                                            ? (isAdmin ? `Chưa đặt deadline cho ${cfg.label}` : 'Chờ giáo viên thiết lập...')
                                            : isExpired
                                                ? 'Thời gian đã điểm!'
                                                : `${new Date(currentSetting!.date).toLocaleDateString('vi-VN')} · ${new Date(currentSetting!.date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`
                                        }
                                    </span>
                                    {/* Grade badge (student view) */}
                                    {!isAdmin && studentGrade && (
                                        <span
                                            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                            style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
                                        >
                                            {cfg.label}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Right: countdown or CTA */}
                        <div className="flex items-center shrink-0">
                            {!hasDate ? (
                                isAdmin ? (
                                    <button
                                        onClick={() => openEdit(viewGrade)}
                                        className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm"
                                        style={{ background: cfg.color, color: '#FFFFFF' }}
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
                                        { label: 'Ngày', value: timeLeft.days },
                                        { label: 'Giờ', value: timeLeft.hours },
                                        { label: 'Phút', value: timeLeft.minutes },
                                        { label: 'Giây', value: timeLeft.seconds },
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
                                                        borderBottom: `3px solid ${cfg.color}44`,
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
                    /* ── Edit mode ── */
                    <div className="animate-fade-in">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-lg" style={{ background: cfg.bg }}>
                                    <Target className="w-5 h-5" style={{ color: cfg.color }} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold" style={{ color: '#1A1A1A' }}>
                                        Thiết lập deadline
                                    </h3>
                                    {/* Grade selector khi đang edit (admin) */}
                                    {isAdmin && (
                                        <div className="flex gap-1.5 mt-1.5">
                                            {[10, 11, 12].map(g => {
                                                const c = GRADE_CFG[g];
                                                const active = g === activeGradeTab;
                                                return (
                                                    <button
                                                        key={g}
                                                        onClick={() => {
                                                            const s = settings[g];
                                                            setTempDate(s?.date || getDefaultDate());
                                                            setTempName(s?.name || DEFAULT_NAME);
                                                            setActiveGradeTab(g);
                                                        }}
                                                        className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition-all"
                                                        style={{
                                                            background: active ? c.color : '#F1F0EC',
                                                            color: active ? '#fff' : '#787774',
                                                            border: `1px solid ${active ? c.color : '#E9E9E7'}`,
                                                        }}
                                                    >
                                                        {c.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
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
                                    style={{ border: '1px solid #E9E9E7', background: '#F7F6F3', color: '#1A1A1A' }}
                                    onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = cfg.color; (e.currentTarget as HTMLElement).style.background = '#FFFFFF'; }}
                                    onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = '#E9E9E7'; (e.currentTarget as HTMLElement).style.background = '#F7F6F3'; }}
                                />
                            </div>

                            {/* Date Input */}
                            <div className="space-y-2">
                                <label className="text-[11px] font-bold uppercase tracking-wider pl-1" style={{ color: '#AEACA8' }}>
                                    Thời điểm diễn ra · <span style={{ color: cfg.color }}>{GRADE_CFG[activeGradeTab]?.label}</span>
                                </label>
                                <input
                                    type="datetime-local"
                                    value={tempDate}
                                    onChange={e => setTempDate(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none transition-all"
                                    style={{ border: '1px solid #E9E9E7', background: '#F7F6F3', color: '#1A1A1A' }}
                                    onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = cfg.color; (e.currentTarget as HTMLElement).style.background = '#FFFFFF'; }}
                                    onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = '#E9E9E7'; (e.currentTarget as HTMLElement).style.background = '#F7F6F3'; }}
                                />
                            </div>

                            {/* Error banner */}
                            {saveError && (
                                <div className="md:col-span-2 flex items-start gap-2.5 px-4 py-3 rounded-xl text-sm"
                                    style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C' }}>
                                    <span className="shrink-0 mt-0.5">⚠️</span>
                                    <div>
                                        <p className="font-semibold">Lưu thất bại!</p>
                                        <p className="text-xs mt-0.5" style={{ color: '#DC2626' }}>
                                            Không thể gọi RPC. Hãy chắc chắn bạn đã chạy file SQL migration <strong>app_settings.sql</strong> trên Supabase Dashboard (bao gồm lệnh GRANT).
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="md:col-span-2 flex gap-3 pt-2">
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="flex-1 py-3 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all"
                                    style={{ background: isSaving ? '#AEACA8' : cfg.color, cursor: isSaving ? 'not-allowed' : 'pointer' }}
                                    onMouseEnter={e => { if (!isSaving) (e.currentTarget as HTMLElement).style.opacity = '0.9'; }}
                                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
                                >
                                    {isSaving
                                        ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Đang lưu...</>
                                        : <><Check className="w-4 h-4" />Lưu deadline · {GRADE_CFG[activeGradeTab]?.label}</>
                                    }
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
        </div>
    );
};

export default CountdownTimer;
