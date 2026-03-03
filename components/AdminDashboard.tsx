import { supabase } from '../src/lib/supabase';

import React, { useState, useEffect } from 'react';
import {
    Users, UserPlus, Trash2, Search, RefreshCw,
    ShieldCheck, Monitor, Phone,
    TrendingUp, UserCheck, ShieldAlert, LayoutDashboard,
    UserMinus, RotateCcw, Ban, ArrowLeft, X, CloudUpload, ClipboardList,
    Plus, Edit3, FolderOpen, ChevronRight, GraduationCap, Building2, Settings2
} from 'lucide-react';
import ExamManager from './ExamManager';
import { Exam } from '../types';

interface Student {
    sdt: string;
    name: string;
    machineId: string;
    key: string;
    status: string;
    grade?: number;
    class_id?: string;
}

interface ClassInfo {
    id: string;
    name: string;
    grade: number;
    created_at?: string;
}

interface AdminDashboardProps {
    onBack: () => void;
    onShowToast: (msg: string, type: 'success' | 'error' | 'warning') => void;
    onOpenGitHubSync: () => void;
    onUploadExamPdf?: (file: File, onProgress: (pct: number) => void) => Promise<{ fileId: string; fileName: string }>;
    onSaveExam?: (exams: Exam[]) => Promise<void>;
    onDeleteExam?: (examId: string, allExams: Exam[]) => Promise<void>;
    onLoadExams?: () => Promise<Exam[]>;
}

/* Shared inline input style */
const inputSt: React.CSSProperties = {
    width: '100%',
    background: '#F7F6F3',
    border: '1px solid #E9E9E7',
    borderRadius: '8px',
    padding: '10px 12px',
    fontSize: '14px',
    color: '#1A1A1A',
    outline: 'none',
};

const Loader2 = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
    <RefreshCw className={`${className} animate-spin`} style={style} />
);

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack, onShowToast, onOpenGitHubSync, onUploadExamPdf, onSaveExam, onDeleteExam, onLoadExams }) => {
    const [activeTab, setActiveTab] = useState<'students' | 'exams'>('students');
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newStudent, setNewStudent] = useState({ sdt: '', name: '', grade: 12, class_id: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);

    // ── Grade & Class filter ──
    const [gradeFilter, setGradeFilter] = useState<number | null>(null);
    const [classFilter, setClassFilter] = useState<string | null>(null);
    const [classes, setClasses] = useState<ClassInfo[]>([]);

    // ── Class management modal ──
    const [isClassModalOpen, setIsClassModalOpen] = useState(false);
    const [newClassName, setNewClassName] = useState('');
    const [newClassGrade, setNewClassGrade] = useState(12);
    const [editingClass, setEditingClass] = useState<ClassInfo | null>(null);

    const refreshClasses = async () => {
        try {
            const { data, error } = await supabase.from('classes').select('*').order('grade', { ascending: true }).order('name', { ascending: true });
            if (error) throw error;
            setClasses(data || []);
        } catch (err) {
            console.error('[Admin] Lỗi tải danh sách lớp:', err);
        }
    };

    const refreshStudents = async () => {
        setLoading(true);
        console.log("[Admin] Đang tải danh sách học sinh từ Supabase...");
        try {
            const { data, error } = await supabase.from('students').select('*').order('created_at', { ascending: false });
            if (error) throw error;

            const normalized: Student[] = (data || []).map(row => ({
                sdt: row.phone || '',
                name: row.name || 'Học viên',
                machineId: row.machine_id || '',
                key: row.activation_key || '',
                status: row.is_active === false ? 'KICKED' : (row.machine_id ? 'ACTIVATED' : 'PENDING'),
                grade: row.grade || 12,
                class_id: row.class_id || '',
            }));
            setStudents(normalized);
        } catch (err) {
            console.error("[Admin] Lỗi kết nối Supabase:", err);
            setStudents([]);
        } finally {
            setLoading(false);
        }
    };

    // ── Class CRUD ──
    const handleAddClass = async () => {
        if (!newClassName.trim()) return;
        try {
            const { error } = await supabase.from('classes').insert([{ name: newClassName.trim(), grade: newClassGrade }]);
            if (error) throw error;
            onShowToast(`Đã tạo lớp ${newClassName.trim()}!`, 'success');
            setNewClassName('');
            refreshClasses();
        } catch (e: any) { onShowToast('Lỗi: ' + e.message, 'error'); }
    };

    const handleUpdateClass = async () => {
        if (!editingClass || !newClassName.trim()) return;
        try {
            const { error } = await supabase.from('classes').update({ name: newClassName.trim(), grade: newClassGrade }).eq('id', editingClass.id);
            if (error) throw error;
            onShowToast(`Đã cập nhật lớp!`, 'success');
            setEditingClass(null);
            setNewClassName('');
            refreshClasses();
            refreshStudents();
        } catch (e: any) { onShowToast('Lỗi: ' + e.message, 'error'); }
    };

    const handleDeleteClass = async (cls: ClassInfo) => {
        if (!window.confirm(`Xóa lớp "${cls.name}"? Học sinh trong lớp sẽ chuyển sang trạng thái "Chưa xếp lớp".`)) return;
        try {
            const { error } = await supabase.from('classes').delete().eq('id', cls.id);
            if (error) throw error;
            onShowToast(`Đã xóa lớp ${cls.name}!`, 'warning');
            if (classFilter === cls.id) setClassFilter(null);
            refreshClasses();
            refreshStudents();
        } catch (e: any) { onShowToast('Lỗi: ' + e.message, 'error'); }
    };

    const handleUpdateStudentClass = async (sdt: string, classId: string | null) => {
        try {
            const { error } = await supabase.from('students').update({ class_id: classId }).eq('phone', sdt);
            if (error) throw error;
            onShowToast('Đã cập nhật lớp cho học viên!', 'success');
            refreshStudents();
        } catch (e: any) { onShowToast('Lỗi: ' + e.message, 'error'); }
    };

    useEffect(() => { refreshStudents(); refreshClasses(); }, []);

    const handleAddStudent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newStudent.sdt || !newStudent.name) return;
        setIsSubmitting(true);
        console.log("[Admin] Đang thêm học viên lên Supabase:", newStudent);

        try {
            let phoneStr = String(newStudent.sdt).trim();
            if (phoneStr.length === 9 && !phoneStr.startsWith('0')) phoneStr = '0' + phoneStr;

            const { error } = await supabase.from('students').insert([{
                phone: phoneStr,
                name: newStudent.name.trim(),
                grade: newStudent.grade,
                class_id: newStudent.class_id || null,
                is_active: true,
                activation_key: '',
                machine_id: '',
                device_limit: 1
            }]);

            if (error) throw error;

            onShowToast('Đã thêm học viên lên Supabase!', 'success');
            setIsAddModalOpen(false);
            setNewStudent({ sdt: '', name: '', grade: 12, class_id: '' });
            refreshStudents();
        } catch (err: any) {
            console.error("[Admin] Lỗi khi thêm:", err);
            onShowToast('Lỗi Supabase: ' + err.message, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteStudent = async (sdt: string) => {
        if (!window.confirm(`Bạn có chắc muốn xóa học viên ${sdt} không?`)) return;
        try {
            const { error } = await supabase.from('students').delete().eq('phone', sdt);
            if (error) throw error;
            onShowToast('Đã xóa học viên!', 'warning');
            setTimeout(refreshStudents, 500);
        } catch (e: any) { onShowToast('Lỗi khi xóa học viên: ' + e.message, 'error'); }
    };

    const handleKickStudent = async (sdt: string, name: string) => {
        if (!window.confirm(`Bạn có chắc muốn KICK học viên "${name}" (${sdt}) không?\n\nHọc viên sẽ không thể truy cập tài liệu nữa.`)) return;
        try {
            const { error } = await supabase.from('students').update({ is_active: false }).eq('phone', sdt);
            if (error) throw error;
            onShowToast(`Đã kick học viên ${name}!`, 'success');
            setTimeout(refreshStudents, 500);
        } catch (e: any) { onShowToast('Lỗi khi kick học viên: ' + e.message, 'error'); }
    };

    const handleUnkickStudent = async (sdt: string, name: string) => {
        if (!window.confirm(`Mở khóa cho học viên "${name}" (${sdt})?\n\nHọc viên sẽ cần kích hoạt lại từ đầu.`)) return;
        try {
            const { error } = await supabase.from('students').update({ is_active: true, machine_id: '', activation_key: '' }).eq('phone', sdt);
            if (error) throw error;
            onShowToast(`Đã mở khóa cho ${name}!`, 'success');
            setTimeout(refreshStudents, 500);
        } catch (e: any) { onShowToast('Lỗi khi mở khóa học viên: ' + e.message, 'error'); }
    };

    const filteredStudents = (students || []).filter(s => {
        if (!s) return false;
        const sdt = s.sdt || '';
        const name = s.name || '';
        const matchSearch = sdt.includes(searchTerm) || name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchGrade = gradeFilter === null || s.grade === gradeFilter;
        const matchClass = classFilter === null || s.class_id === classFilter;
        // Special filter: 'unassigned' = students without any class
        const matchUnassigned = classFilter === 'unassigned' ? (!s.class_id || s.class_id === '') : true;
        return matchSearch && matchGrade && (classFilter === 'unassigned' ? matchUnassigned : matchClass);
    });

    const classesForGrade = gradeFilter ? classes.filter(c => c.grade === gradeFilter) : classes;
    const getClassName = (classId?: string) => {
        if (!classId) return null;
        return classes.find(c => c.id === classId)?.name || null;
    };

    const stats = {
        total: students.length,
        activated: students.filter(s => s && s.machineId && s.status !== 'KICKED').length,
        pending: students.filter(s => s && !s.machineId && s.status !== 'KICKED').length,
        kicked: students.filter(s => s && s.status === 'KICKED').length,
    };

    /* Stat card config */
    const statCards = [
        {
            label: 'Tổng học viên',
            value: stats.total,
            icon: <Users className="w-5 h-5" />,
            accent: '#6B7CDB',
            bg: '#EEF0FB',
            sub: <span className="flex items-center gap-1 text-[11px]" style={{ color: '#6B7CDB' }}><TrendingUp className="w-3 h-3" /> +12% so với tháng trước</span>,
        },
        {
            label: 'Đã kích hoạt',
            value: stats.activated,
            icon: <ShieldCheck className="w-5 h-5" />,
            accent: '#448361',
            bg: '#EAF3EE',
            sub: <span className="text-[11px]" style={{ color: '#787774' }}>Hiệu suất: <b style={{ color: '#448361' }}>{Math.round((stats.activated / stats.total) * 100 || 0)}%</b> đã vào học</span>,
        },
        {
            label: 'Đang chờ',
            value: stats.pending,
            icon: <ShieldAlert className="w-5 h-5" />,
            accent: '#D9730D',
            bg: '#FFF3E8',
            sub: <span className="text-[11px] italic" style={{ color: '#787774' }}>Cần hỗ trợ các bạn chưa vào được app</span>,
        },
        {
            label: 'Bị Kick',
            value: stats.kicked,
            icon: <Ban className="w-5 h-5" />,
            accent: '#E03E3E',
            bg: '#FEF0F0',
            sub: <span className="text-[11px] italic" style={{ color: '#787774' }}>Đã bị thu hồi quyền truy cập</span>,
        },
    ];

    return (
        <div className="fixed inset-0 z-[60] flex flex-col font-sans overflow-hidden animate-fade-in" style={{ background: '#F7F6F3' }}>


            {/* ── Top nav ── */}
            <div className="flex items-center justify-between px-6 py-3.5" style={{ background: '#FFFFFF', borderBottom: '1px solid #E9E9E7' }}>
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: '#787774' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F1F0EC'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg" style={{ background: '#EEF0FB' }}>
                            <LayoutDashboard className="w-4 h-4" style={{ color: '#6B7CDB' }} />
                        </div>
                        <div>
                            <h1 className="text-base font-semibold" style={{ color: '#1A1A1A' }}>PhysiVault Panel</h1>
                            <p className="text-[10px] uppercase tracking-widest" style={{ color: '#AEACA8' }}>Hệ thống quản trị học viên v4.0</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div
                        className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium"
                        style={{ background: '#EEF0FB', color: '#6B7CDB' }}
                    >
                        <UserCheck className="w-4 h-4" />
                        Thầy Huy Online
                    </div>
                    <button
                        onClick={onOpenGitHubSync}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors"
                        style={{ background: '#EAF3EE', color: '#448361', border: '1px solid #44836133' }}
                        title="Quản lý & Sync bài giảng lên GitHub"
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#D5E8DD'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#EAF3EE'}
                    >
                        <CloudUpload className="w-4 h-4" />
                        <span className="hidden md:inline">Cloud Sync</span>
                    </button>
                    <button
                        onClick={refreshStudents}
                        className="p-2 rounded-lg transition-colors"
                        style={{ color: '#787774', border: '1px solid #E9E9E7', background: '#FFFFFF' }}
                        title="Tải lại dữ liệu"
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F1F0EC'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#FFFFFF'}
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* ── Tab Bar ── */}
            <div className="flex shrink-0 px-6 pt-2" style={{ borderBottom: '1px solid #E9E9E7', background: '#fff' }}>
                {[
                    { key: 'students', label: 'Học Sinh', icon: <Users className="w-4 h-4" /> },
                    { key: 'exams', label: 'Đề Thi', icon: <ClipboardList className="w-4 h-4" /> },
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key as any)}
                        className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-all border-b-2"
                        style={{
                            borderColor: activeTab === tab.key ? '#6B7CDB' : 'transparent',
                            color: activeTab === tab.key ? '#6B7CDB' : '#787774',
                        }}
                    >
                        {tab.icon}{tab.label}
                    </button>
                ))}
            </div>

            {/* ── Main scroll area ── */}
            <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6 custom-scrollbar">

                {/* ── Exam Tab ── */}
                {activeTab === 'exams' && onUploadExamPdf && onSaveExam && onDeleteExam && onLoadExams && (
                    <ExamManager
                        onShowToast={onShowToast}
                        onUploadExamPdf={onUploadExamPdf}
                        onSaveExam={onSaveExam}
                        onDeleteExam={onDeleteExam}
                        onLoadExams={onLoadExams}
                    />
                )}

                {/* ── Students Tab ── */}
                {activeTab !== 'students' ? null : (<>

                    {/* Stat cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {statCards.map((card) => (
                            <div
                                key={card.label}
                                className="rounded-xl p-5 flex flex-col gap-3 transition-shadow"
                                style={{ background: '#FFFFFF', border: '1px solid #E9E9E7', borderLeft: `3px solid ${card.accent}` }}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#AEACA8' }}>{card.label}</span>
                                    <div className="p-1.5 rounded-lg" style={{ background: card.bg, color: card.accent }}>
                                        {card.icon}
                                    </div>
                                </div>
                                <div className="text-3xl font-bold" style={{ color: card.accent }}>{card.value}</div>
                                <div>{card.sub}</div>
                            </div>
                        ))}
                    </div>

                    {/* ── Grade & Class Filter Bar ── */}
                    <div className="rounded-xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E9E9E7' }}>
                        <div className="p-4 flex flex-col gap-3">
                            {/* Grade filter row */}
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center gap-1.5">
                                    <GraduationCap className="w-4 h-4" style={{ color: '#6B7CDB' }} />
                                    <span className="text-xs font-semibold" style={{ color: '#787774' }}>Lọc theo khối:</span>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    {[
                                        { label: 'Tất cả', value: null, accent: '#9065B0', bg: '#F3ECF8' },
                                        { label: 'Khối 12', value: 12, accent: '#9065B0', bg: '#F3ECF8' },
                                        { label: 'Khối 11', value: 11, accent: '#6B7CDB', bg: '#EEF0FB' },
                                        { label: 'Khối 10', value: 10, accent: '#448361', bg: '#EAF3EE' },
                                    ].map(g => {
                                        const isActive = gradeFilter === g.value;
                                        return (
                                            <button
                                                key={String(g.value)}
                                                onClick={() => { setGradeFilter(g.value); setClassFilter(null); }}
                                                className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all"
                                                style={{
                                                    background: isActive ? g.accent : '#F7F6F3',
                                                    color: isActive ? '#fff' : '#787774',
                                                    border: `1px solid ${isActive ? g.accent : '#E9E9E7'}`,
                                                }}
                                            >
                                                {g.label}
                                                {g.value !== null && (
                                                    <span className="ml-1 opacity-75">
                                                        ({students.filter(s => s.grade === g.value).length})
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                    <button
                                        onClick={() => setIsClassModalOpen(true)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all"
                                        style={{ background: '#F7F6F3', color: '#787774', border: '1px solid #E9E9E7' }}
                                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#EEF0FB'; (e.currentTarget as HTMLElement).style.color = '#6B7CDB'; }}
                                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#F7F6F3'; (e.currentTarget as HTMLElement).style.color = '#787774'; }}
                                    >
                                        <Settings2 className="w-3.5 h-3.5" />
                                        Quản lý lớp
                                    </button>
                                </div>
                            </div>

                            {/* Class filter row (only shows when a grade is selected) */}
                            {gradeFilter !== null && (
                                <div className="flex items-center gap-2 flex-wrap pl-5 pt-1" style={{ borderTop: '1px solid #F1F0EC' }}>
                                    <Building2 className="w-3.5 h-3.5" style={{ color: '#AEACA8' }} />
                                    <button
                                        onClick={() => setClassFilter(null)}
                                        className="px-2.5 py-1 text-[11px] font-medium rounded-md transition-all"
                                        style={{
                                            background: classFilter === null ? '#6B7CDB' : '#F7F6F3',
                                            color: classFilter === null ? '#fff' : '#787774',
                                            border: `1px solid ${classFilter === null ? '#6B7CDB' : '#E9E9E7'}`,
                                        }}
                                    >
                                        Tất cả lớp
                                    </button>
                                    {classesForGrade.map(cls => {
                                        const count = students.filter(s => s.class_id === cls.id).length;
                                        const isActive = classFilter === cls.id;
                                        return (
                                            <button
                                                key={cls.id}
                                                onClick={() => setClassFilter(cls.id)}
                                                className="px-2.5 py-1 text-[11px] font-medium rounded-md transition-all"
                                                style={{
                                                    background: isActive ? '#6B7CDB' : '#F7F6F3',
                                                    color: isActive ? '#fff' : '#787774',
                                                    border: `1px solid ${isActive ? '#6B7CDB' : '#E9E9E7'}`,
                                                }}
                                            >
                                                {cls.name} <span className="opacity-60">({count})</span>
                                            </button>
                                        );
                                    })}
                                    <button
                                        onClick={() => setClassFilter('unassigned')}
                                        className="px-2.5 py-1 text-[11px] font-medium rounded-md transition-all italic"
                                        style={{
                                            background: classFilter === 'unassigned' ? '#D9730D' : '#F7F6F3',
                                            color: classFilter === 'unassigned' ? '#fff' : '#AEACA8',
                                            border: `1px solid ${classFilter === 'unassigned' ? '#D9730D' : '#E9E9E7'}`,
                                        }}
                                    >
                                        Chưa xếp lớp ({students.filter(s => s.grade === gradeFilter && (!s.class_id || s.class_id === '')).length})
                                    </button>
                                    {classesForGrade.length === 0 && (
                                        <span className="text-[11px] italic" style={{ color: '#AEACA8' }}>
                                            Chưa có lớp nào. Bấm "Quản lý lớp" để tạo mới.
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Table section */}
                    <div className="rounded-xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E9E9E7' }}>
                        {/* Table toolbar */}
                        <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3" style={{ borderBottom: '1px solid #E9E9E7' }}>
                            <div className="relative flex-1 max-w-sm">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#AEACA8' }} />
                                <input
                                    type="text"
                                    placeholder="Tìm theo tên hoặc SĐT..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    style={{ ...inputSt, paddingLeft: '36px' }}
                                    onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = '#6B7CDB'}
                                    onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = '#E9E9E7'}
                                />
                            </div>
                            <button
                                onClick={() => setIsAddModalOpen(true)}
                                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white rounded-lg transition-colors whitespace-nowrap"
                                style={{ background: '#6B7CDB' }}
                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#5a6bc9'}
                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#6B7CDB'}
                            >
                                <UserPlus className="w-4 h-4" />
                                Thêm học viên mới
                            </button>
                        </div>

                        {/* Table */}
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr style={{ background: '#FAFAF9' }}>
                                        {['Học viên', 'Lớp', 'Số điện thoại', 'Mã máy', 'Kích hoạt', 'Trạng thái', 'Quản lý'].map((h, i) => (
                                            <th
                                                key={h}
                                                className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider"
                                                style={{ color: '#AEACA8', textAlign: i === 6 ? 'right' : 'left', borderBottom: '1px solid #E9E9E7' }}
                                            >
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan={7} className="px-5 py-16 text-center">
                                                <div className="flex flex-col items-center gap-3">
                                                    <Loader2 className="w-8 h-8" style={{ color: '#6B7CDB' } as React.CSSProperties} />
                                                    <p className="text-sm" style={{ color: '#787774' }}>Đang nạp dữ liệu từ Supabase...</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : filteredStudents.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-5 py-16 text-center text-sm italic" style={{ color: '#AEACA8' }}>
                                                Không tìm thấy học viên nào phù hợp.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredStudents.map((s, idx) => {
                                            const isKicked = s.status === 'KICKED';
                                            return (
                                                <tr
                                                    key={idx}
                                                    style={{
                                                        borderBottom: '1px solid #F1F0EC',
                                                        background: isKicked ? '#FEF8F8' : 'transparent',
                                                        opacity: isKicked ? 0.75 : 1,
                                                    }}
                                                    onMouseEnter={e => !isKicked && ((e.currentTarget as HTMLElement).style.background = '#FAFAF9')}
                                                    onMouseLeave={e => !isKicked && ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                                                >
                                                    {/* Student name */}
                                                    <td className="px-5 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div
                                                                className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-semibold shrink-0"
                                                                style={{
                                                                    background: isKicked ? '#E03E3E' : s.machineId ? '#6B7CDB' : '#E9E9E7',
                                                                    color: isKicked || s.machineId ? '#FFFFFF' : '#787774',
                                                                }}
                                                            >
                                                                {isKicked ? <Ban className="w-4 h-4" /> : (s.name || 'H').charAt(0).toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-medium" style={{ color: isKicked ? '#E03E3E' : '#1A1A1A', textDecoration: isKicked ? 'line-through' : 'none' }}>
                                                                    {s.name || 'Học sinh'}
                                                                </p>
                                                                <p className="text-[10px] uppercase tracking-tight" style={{ color: '#AEACA8' }}>
                                                                    {isKicked ? 'Đã bị kick' : s.machineId ? 'Đang hoạt động' : 'Chưa kích hoạt'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    {/* Grade & Class */}
                                                    <td className="px-5 py-4">
                                                        <div className="flex flex-col gap-1">
                                                            <span
                                                                className="px-2 py-0.5 rounded-md text-[10px] font-bold inline-block w-fit"
                                                                style={{
                                                                    background: s.grade === 12 ? '#F3ECF8' : s.grade === 11 ? '#EEF0FB' : '#EAF3EE',
                                                                    color: s.grade === 12 ? '#9065B0' : s.grade === 11 ? '#6B7CDB' : '#448361'
                                                                }}
                                                            >
                                                                Khối {s.grade || 12}
                                                            </span>
                                                            <select
                                                                value={s.class_id || ''}
                                                                onChange={e => handleUpdateStudentClass(s.sdt, e.target.value || null)}
                                                                className="text-[11px] px-1.5 py-0.5 rounded border cursor-pointer"
                                                                style={{ background: '#F7F6F3', border: '1px solid #E9E9E7', color: '#57564F', maxWidth: '110px' }}
                                                            >
                                                                <option value="">Chưa xếp lớp</option>
                                                                {classes.filter(c => c.grade === s.grade).map(c => (
                                                                    <option key={c.id} value={c.id}>{c.name}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    </td>
                                                    {/* Phone */}
                                                    <td className="px-5 py-4 font-mono text-sm" style={{ color: '#1A1A1A' }}>{s.sdt}</td>
                                                    {/* Machine ID */}
                                                    <td className="px-5 py-4">
                                                        {s.machineId ? (
                                                            <span
                                                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium"
                                                                style={{ background: '#EAF3EE', color: '#448361', border: '1px solid #44836122' }}
                                                            >
                                                                <Monitor className="w-3 h-3" />
                                                                {s.machineId}
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] italic px-2 py-1 rounded" style={{ background: '#F1F0EC', color: '#AEACA8' }}>
                                                                Chưa vào máy
                                                            </span>
                                                        )}
                                                    </td>
                                                    {/* Key */}
                                                    <td className="px-5 py-4">
                                                        {s.key ? (
                                                            <span
                                                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium"
                                                                style={{ background: '#EEF0FB', color: '#6B7CDB', border: '1px solid #6B7CDB22' }}
                                                            >
                                                                {s.key}
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs" style={{ color: '#CFCFCB' }}>—</span>
                                                        )}
                                                    </td>
                                                    {/* Status */}
                                                    <td className="px-5 py-4">
                                                        {isKicked ? (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium" style={{ background: '#FEF0F0', color: '#E03E3E', border: '1px solid #E03E3E22' }}>
                                                                <Ban className="w-3 h-3" /> ĐÃ KICK
                                                            </span>
                                                        ) : s.machineId ? (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium" style={{ background: '#EAF3EE', color: '#448361', border: '1px solid #44836122' }}>
                                                                <ShieldCheck className="w-3 h-3" /> Hoạt động
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium" style={{ background: '#FFF3E8', color: '#D9730D', border: '1px solid #D9730D22' }}>
                                                                <ShieldAlert className="w-3 h-3" /> Chờ
                                                            </span>
                                                        )}
                                                    </td>
                                                    {/* Actions */}
                                                    <td className="px-5 py-4">
                                                        <div className="flex items-center justify-end gap-1">
                                                            {isKicked ? (
                                                                <button
                                                                    onClick={() => handleUnkickStudent(s.sdt, s.name)}
                                                                    className="p-2 rounded-lg transition-colors"
                                                                    style={{ color: '#CFCFCB' }}
                                                                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#448361'; (e.currentTarget as HTMLElement).style.background = '#EAF3EE'; }}
                                                                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#CFCFCB'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                                                    title="Mở khóa học viên"
                                                                >
                                                                    <RotateCcw className="w-4 h-4" />
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    onClick={() => handleKickStudent(s.sdt, s.name)}
                                                                    className="p-2 rounded-lg transition-colors"
                                                                    style={{ color: '#CFCFCB' }}
                                                                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#D9730D'; (e.currentTarget as HTMLElement).style.background = '#FFF3E8'; }}
                                                                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#CFCFCB'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                                                    title="Kick học viên"
                                                                >
                                                                    <UserMinus className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => handleDeleteStudent(s.sdt)}
                                                                className="p-2 rounded-lg transition-colors"
                                                                style={{ color: '#CFCFCB' }}
                                                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#E03E3E'; (e.currentTarget as HTMLElement).style.background = '#FEF0F0'; }}
                                                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#CFCFCB'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                                                title="Xóa học viên"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>) /* end students tab */}
            </div>

            {/* ── Add Student Modal ── */}
            {isAddModalOpen && (
                <div
                    className="fixed inset-0 z-[70] flex items-center justify-center p-4 animate-fade-in"
                    style={{ background: 'rgba(26,26,26,0.45)' }}
                    onClick={() => setIsAddModalOpen(false)}
                >
                    <div
                        className="w-full overflow-hidden animate-scale-in"
                        style={{ maxWidth: '400px', background: '#FFFFFF', border: '1px solid #E9E9E7', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Modal header */}
                        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #E9E9E7' }}>
                            <div>
                                <h3 className="text-base font-semibold" style={{ color: '#1A1A1A' }}>Thêm học viên mới</h3>
                                <p className="text-xs mt-0.5" style={{ color: '#787774' }}>Nhập đúng SĐT để hệ thống cấp mã</p>
                            </div>
                            <button
                                onClick={() => setIsAddModalOpen(false)}
                                className="p-1.5 rounded-lg transition-colors"
                                style={{ color: '#787774' }}
                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F1F0EC'}
                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <form onSubmit={handleAddStudent} className="p-5 space-y-4">
                            {/* Name */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#AEACA8' }}>Tên học viên</label>
                                <div className="relative">
                                    <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: '#AEACA8' }} />
                                    <input
                                        type="text" required
                                        value={newStudent.name}
                                        onChange={e => setNewStudent({ ...newStudent, name: e.target.value })}
                                        placeholder="Ví dụ: Nguyễn Trần Hoài Huy"
                                        style={{ ...inputSt, paddingLeft: '32px' }}
                                        onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = '#6B7CDB'}
                                        onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = '#E9E9E7'}
                                    />
                                </div>
                            </div>
                            {/* Grade Selection */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#AEACA8' }}>Khối lớp</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[12, 11, 10].map(g => (
                                        <button
                                            key={g}
                                            type="button"
                                            onClick={() => setNewStudent({ ...newStudent, grade: g })}
                                            className="py-2 text-xs font-semibold rounded-lg border transition-all"
                                            style={{
                                                background: newStudent.grade === g ? '#6B7CDB' : '#FFFFFF',
                                                color: newStudent.grade === g ? '#FFFFFF' : '#787774',
                                                borderColor: newStudent.grade === g ? '#6B7CDB' : '#E9E9E7'
                                            }}
                                        >
                                            Lớp {g}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Class Selection */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#AEACA8' }}>Xếp vào lớp</label>
                                <select
                                    value={newStudent.class_id}
                                    onChange={e => setNewStudent({ ...newStudent, class_id: e.target.value })}
                                    style={{ ...inputSt, cursor: 'pointer' }}
                                >
                                    <option value="">— Chưa xếp lớp —</option>
                                    {classes.filter(c => c.grade === newStudent.grade).map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Phone */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#AEACA8' }}>Số điện thoại</label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: '#AEACA8' }} />
                                    <input
                                        type="tel" required
                                        value={newStudent.sdt}
                                        onChange={e => setNewStudent({ ...newStudent, sdt: e.target.value })}
                                        placeholder="Ví dụ: 0985032870"
                                        style={{ ...inputSt, paddingLeft: '32px' }}
                                        onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = '#6B7CDB'}
                                        onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = '#E9E9E7'}
                                    />
                                </div>
                            </div>
                            {/* Buttons */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors"
                                    style={{ background: '#F1F0EC', color: '#57564F', border: '1px solid #E9E9E7' }}
                                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#E9E9E7'}
                                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#F1F0EC'}
                                >
                                    Hủy bỏ
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex-1 py-2.5 text-sm font-medium text-white rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                                    style={{ background: '#6B7CDB' }}
                                    onMouseEnter={e => !isSubmitting && ((e.currentTarget as HTMLElement).style.background = '#5a6bc9')}
                                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#6B7CDB'}
                                >
                                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Lưu học viên'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Class Management Modal ── */}
            {isClassModalOpen && (
                <div
                    className="fixed inset-0 z-[70] flex items-center justify-center p-4 animate-fade-in"
                    style={{ background: 'rgba(26,26,26,0.45)' }}
                    onClick={() => { setIsClassModalOpen(false); setEditingClass(null); setNewClassName(''); }}
                >
                    <div
                        className="w-full overflow-hidden animate-scale-in"
                        style={{ maxWidth: '480px', background: '#FFFFFF', border: '1px solid #E9E9E7', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Modal header */}
                        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #E9E9E7' }}>
                            <div className="flex items-center gap-2">
                                <div className="p-2 rounded-lg" style={{ background: '#EEF0FB' }}>
                                    <Building2 className="w-4 h-4" style={{ color: '#6B7CDB' }} />
                                </div>
                                <div>
                                    <h3 className="text-base font-semibold" style={{ color: '#1A1A1A' }}>Quản lý Lớp học</h3>
                                    <p className="text-xs mt-0.5" style={{ color: '#787774' }}>Tạo, sửa, xóa lớp theo khối</p>
                                </div>
                            </div>
                            <button
                                onClick={() => { setIsClassModalOpen(false); setEditingClass(null); setNewClassName(''); }}
                                className="p-1.5 rounded-lg transition-colors"
                                style={{ color: '#787774' }}
                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F1F0EC'}
                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                            {/* Add/Edit class form */}
                            <div className="flex flex-col gap-3 p-4 rounded-lg" style={{ background: '#F7F6F3', border: '1px solid #E9E9E7' }}>
                                <p className="text-xs font-semibold" style={{ color: '#787774' }}>
                                    {editingClass ? `✏️ Đang sửa: ${editingClass.name}` : '➕ Thêm lớp mới'}
                                </p>
                                <div className="flex gap-2">
                                    <select
                                        value={newClassGrade}
                                        onChange={e => setNewClassGrade(Number(e.target.value))}
                                        className="text-xs px-2 py-2 rounded-lg border cursor-pointer"
                                        style={{ background: '#fff', border: '1px solid #E9E9E7', color: '#57564F' }}
                                    >
                                        <option value={12}>Khối 12</option>
                                        <option value={11}>Khối 11</option>
                                        <option value={10}>Khối 10</option>
                                    </select>
                                    <input
                                        type="text"
                                        value={newClassName}
                                        onChange={e => setNewClassName(e.target.value)}
                                        placeholder="Tên lớp (vd: 12A1)"
                                        className="flex-1 text-sm px-3 py-2 rounded-lg border"
                                        style={{ background: '#fff', border: '1px solid #E9E9E7', color: '#1A1A1A', outline: 'none' }}
                                        onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = '#6B7CDB'}
                                        onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = '#E9E9E7'}
                                    />
                                    <button
                                        onClick={editingClass ? handleUpdateClass : handleAddClass}
                                        className="px-4 py-2 text-xs font-semibold text-white rounded-lg transition-colors"
                                        style={{ background: editingClass ? '#448361' : '#6B7CDB' }}
                                    >
                                        {editingClass ? 'Cập nhật' : 'Tạo lớp'}
                                    </button>
                                    {editingClass && (
                                        <button
                                            onClick={() => { setEditingClass(null); setNewClassName(''); }}
                                            className="px-3 py-2 text-xs rounded-lg"
                                            style={{ background: '#F1F0EC', color: '#787774' }}
                                        >
                                            Hủy
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Classes list by grade */}
                            {[12, 11, 10].map(grade => {
                                const gradeClasses = classes.filter(c => c.grade === grade);
                                if (gradeClasses.length === 0) return null;
                                const gradeColors = grade === 12 ? { accent: '#9065B0', bg: '#F3ECF8' } : grade === 11 ? { accent: '#6B7CDB', bg: '#EEF0FB' } : { accent: '#448361', bg: '#EAF3EE' };
                                return (
                                    <div key={grade}>
                                        <div className="flex items-center gap-2 mb-2">
                                            <GraduationCap className="w-3.5 h-3.5" style={{ color: gradeColors.accent }} />
                                            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: gradeColors.accent }}>Khối {grade}</span>
                                            <span className="text-[10px]" style={{ color: '#AEACA8' }}>({gradeClasses.length} lớp)</span>
                                        </div>
                                        <div className="space-y-1.5">
                                            {gradeClasses.map(cls => {
                                                const count = students.filter(s => s.class_id === cls.id).length;
                                                return (
                                                    <div
                                                        key={cls.id}
                                                        className="flex items-center justify-between p-3 rounded-lg transition-colors"
                                                        style={{ background: '#fff', border: '1px solid #E9E9E7' }}
                                                    >
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold" style={{ background: gradeColors.bg, color: gradeColors.accent }}>
                                                                {cls.name.slice(-2)}
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{cls.name}</p>
                                                                <p className="text-[10px]" style={{ color: '#AEACA8' }}>{count} học viên</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                onClick={() => { setEditingClass(cls); setNewClassName(cls.name); setNewClassGrade(cls.grade); }}
                                                                className="p-1.5 rounded-lg transition-colors"
                                                                style={{ color: '#CFCFCB' }}
                                                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#6B7CDB'; (e.currentTarget as HTMLElement).style.background = '#EEF0FB'; }}
                                                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#CFCFCB'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                                            >
                                                                <Edit3 className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteClass(cls)}
                                                                className="p-1.5 rounded-lg transition-colors"
                                                                style={{ color: '#CFCFCB' }}
                                                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#E03E3E'; (e.currentTarget as HTMLElement).style.background = '#FEF0F0'; }}
                                                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#CFCFCB'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}

                            {classes.length === 0 && (
                                <div className="text-center py-6">
                                    <Building2 className="w-10 h-10 mx-auto mb-2" style={{ color: '#E9E9E7' }} />
                                    <p className="text-sm" style={{ color: '#AEACA8' }}>Chưa có lớp nào. Hãy tạo lớp đầu tiên!</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
