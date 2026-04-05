import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Bell, BellOff, CloudDownload, CheckCircle2, RefreshCw, Clock, Trash2, Send, MessageSquarePlus, ChevronDown, Megaphone, Video } from 'lucide-react';
import { NotificationItem } from '../types';

interface NotificationPageProps {
    onGetNotifications: (grade: number) => Promise<NotificationItem[]>;
    onGetFetchedIds: () => Promise<Set<string>>;
    onMarkFetched: (notifId: string) => Promise<boolean>;
    onFetchLessons: (grade: number, onProgress?: (pct: number) => void) => Promise<{ success: boolean; lessonCount: number; fileCount: number }>;
    onShowToast: (msg: string, type: 'success' | 'error' | 'warning') => void;
    isAdmin?: boolean;
    onDeleteNotification?: (notifId: string) => Promise<boolean>;
    onCreateNotification?: (message: string, grade: number) => Promise<boolean>;
}

const ACCENT = '#E03E3E';
const ACCENT_LIGHT = '#FEF2F2';
const ACCENT_BORDER = '#FECACA';

const getStudentGrade = (): number => parseInt(localStorage.getItem('physivault_grade') || '12', 10);

const GRADE_CONFIG = [
    { grade: 12, label: 'Khối 12', accent: '#9065B0', bg: '#F3ECF8' },
    { grade: 11, label: 'Khối 11', accent: '#6B7CDB', bg: '#EEF0FB' },
    { grade: 10, label: 'Khối 10', accent: '#448361', bg: '#EAF3EE' },
];

const formatRelativeTime = (isoString: string): string => {
    const now = new Date();
    const date = new Date(isoString);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays < 7) return `${diffDays} ngày trước`;
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const NotificationPage: React.FC<NotificationPageProps> = ({
    onGetNotifications, onGetFetchedIds, onMarkFetched,
    onFetchLessons, onShowToast, isAdmin, onDeleteNotification, onCreateNotification,
}) => {
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [fetchedIds, setFetchedIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [fetchingId, setFetchingId] = useState<string | null>(null);
    const [fetchProgress, setFetchProgress] = useState(0);
    const [adminGradeFilter, setAdminGradeFilter] = useState<number | null>(null);

    // ── Compose custom notification state ──
    const [showCompose, setShowCompose] = useState(false);
    const [composeMessage, setComposeMessage] = useState('');
    const [composeGrade, setComposeGrade] = useState<number>(12);
    const [composeSending, setComposeSending] = useState(false);
    const [composeAllGrades, setComposeAllGrades] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const grade = getStudentGrade();

    const load = useCallback(async () => {
        setLoading(true);
        try {
            if (isAdmin) {
                // Admin: load notifications for ALL 3 grades
                const [notifs10, notifs11, notifs12, fetched] = await Promise.all([
                    onGetNotifications(10),
                    onGetNotifications(11),
                    onGetNotifications(12),
                    onGetFetchedIds(),
                ]);
                // Merge and sort by created_at desc
                const allNotifs = [...notifs10, ...notifs11, ...notifs12]
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                setNotifications(allNotifs);
                setFetchedIds(fetched);
            } else {
                // Student: only load their grade
                const [notifs, fetched] = await Promise.all([onGetNotifications(grade), onGetFetchedIds()]);
                setNotifications(notifs);
                setFetchedIds(fetched);
            }
        } catch (e) {
            console.error('Lỗi tải thông báo:', e);
        } finally {
            setLoading(false);
        }
    }, [grade, isAdmin, onGetNotifications, onGetFetchedIds]);

    useEffect(() => { load(); }, [load]);

    const handleFetch = async (notif: NotificationItem) => {
        if (fetchingId) return;
        setFetchingId(notif.id);
        setFetchProgress(0);
        try {
            const fetchGrade = (notif as any).grade || grade;
            const result = await onFetchLessons(fetchGrade, (pct) => setFetchProgress(pct));
            if (result.success) {
                await onMarkFetched(notif.id);
                setFetchedIds(prev => new Set([...prev, notif.id]));
                if ((result as any).skipped) {
                    onShowToast('✅ Bạn đã có bản mới nhất! Không cần tải lại.', 'success');
                } else {
                    onShowToast(`✅ Đã tải về ${result.fileCount} tài liệu mới!`, 'success');
                }
            }
        } catch (err: any) {
            onShowToast(`Lỗi gọi bài: ${err.message}`, 'error');
        } finally {
            setFetchingId(null);
            setFetchProgress(0);
        }
    };

    const handleDelete = async (notifId: string) => {
        if (!isAdmin || !onDeleteNotification) return;
        if (!window.confirm("Thầy có chắc muốn xóa thông báo này chứ?")) return;
        try {
            const ok = await onDeleteNotification(notifId);
            if (ok) {
                setNotifications(prev => prev.filter(n => n.id !== notifId));
                onShowToast("Đã xóa thông báo", "success");
            } else {
                onShowToast("Lỗi khi xóa thông báo", "error");
            }
        } catch (e: any) {
            onShowToast(`Lỗi: ${e.message}`, "error");
        }
    };

    // ── Handle compose & send custom notification ──
    const handleSendCustomNotification = async () => {
        if (!onCreateNotification || !composeMessage.trim()) return;
        setComposeSending(true);
        try {
            if (composeAllGrades) {
                // Gửi cho tất cả các khối
                const results = await Promise.all([
                    onCreateNotification(composeMessage.trim(), 10),
                    onCreateNotification(composeMessage.trim(), 11),
                    onCreateNotification(composeMessage.trim(), 12),
                ]);
                if (results.every(r => r)) {
                    onShowToast('✅ Đã gửi thông báo cho tất cả khối!', 'success');
                } else {
                    onShowToast('Một số khối gửi thất bại', 'warning');
                }
            } else {
                const ok = await onCreateNotification(composeMessage.trim(), composeGrade);
                if (ok) {
                    const label = GRADE_CONFIG.find(g => g.grade === composeGrade)?.label || `Lớp ${composeGrade}`;
                    onShowToast(`✅ Đã gửi thông báo cho ${label}!`, 'success');
                } else {
                    onShowToast('Lỗi khi gửi thông báo', 'error');
                }
            }
            setComposeMessage('');
            setShowCompose(false);
            // Reload notifications
            load();
        } catch (e: any) {
            onShowToast(`Lỗi: ${e.message}`, 'error');
        } finally {
            setComposeSending(false);
        }
    };

    // Filter notifications based on admin grade filter
    const displayedNotifications = useMemo(() => {
        if (!isAdmin || adminGradeFilter === null) return notifications;
        return notifications.filter(n => (n as any).grade === adminGradeFilter);
    }, [notifications, isAdmin, adminGradeFilter]);

    const unreadCount = displayedNotifications.filter(n => n.fetch_enabled && !fetchedIds.has(n.id)).length;

    // Count per grade for admin filter badges
    const gradeCountMap = useMemo(() => {
        if (!isAdmin) return {};
        const map: Record<number, number> = { 10: 0, 11: 0, 12: 0 };
        notifications.forEach(n => {
            const g = (n as any).grade;
            if (g && map[g] !== undefined) map[g]++;
        });
        return map;
    }, [notifications, isAdmin]);

    return (
        <div className="space-y-6 animate-fade-in pb-10">

            {/* ── Header ── */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 relative" style={{ background: '#FEF2F2' }}>
                        <Bell className="w-5 h-5" style={{ color: '#E03E3E' }} />
                        {unreadCount > 0 && (
                            <span
                                className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full flex items-center justify-center text-[9px] font-black"
                                style={{ background: '#E03E3E', color: '#fff' }}
                            >
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-semibold" style={{ color: '#1A1A1A' }}>Thông Báo</h1>
                            {unreadCount > 0 && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: '#FEF2F2', color: '#E03E3E' }}>
                                    {unreadCount} mới
                                </span>
                            )}
                        </div>
                        <p className="hidden md:block text-sm mt-0.5" style={{ color: '#787774' }}>
                            {isAdmin
                                ? <>Quản lý thông báo — <strong style={{ color: '#1A1A1A' }}>Soạn thông báo</strong> tùy ý hoặc xóa thông báo cũ.</>
                                : <>Thầy thông báo tài liệu mới & tin nhắn — bấm <strong style={{ color: '#1A1A1A' }}>Lấy bài về</strong> để cập nhật.</>
                            }
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* ── Cá nhân hóa nút Meet hiển thị đúng khối ── */}
                    {(() => {
                        const stdGrade = grade; // grade is already getStudentGrade() or set. For admin, it defaults to 12 or we can handle it.
                        // Nếu là admin, ta có thể hiển thị chọn link dropdown hoặc tạm lấy mặc định khối 12 nếu thầy không chọn filter.
                        const targetGrade = isAdmin && adminGradeFilter ? adminGradeFilter : stdGrade;
                        const meetConfig = GRADE_CONFIG.find(g => g.grade === targetGrade) || GRADE_CONFIG[0];
                        const url = meetConfig.grade === 10 ? 'https://meet.google.com/vch-rjum-kus'
                            : meetConfig.grade === 11 ? 'https://meet.google.com/kup-kyii-ess'
                                : 'https://meet.google.com/omz-jvty-osn';
                        return (
                            <a
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="group relative overflow-hidden flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
                                style={{ background: meetConfig.bg, color: meetConfig.accent, border: `1px solid ${meetConfig.accent}40` }}
                                title={`Vào phòng Meet khối ${meetConfig.grade}`}
                            >
                                <div className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity" style={{ background: meetConfig.accent }} />
                                {/* Chấm đỏ live nhấp nháy */}
                                <div className="relative flex h-2 w-2 mr-0.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: '#E03E3E' }}></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: '#E03E3E' }}></span>
                                </div>
                                <Video className="w-4 h-4" />
                                <span className="hidden sm:inline">Meet {isAdmin && !adminGradeFilter ? 'Kho' : 'Khối'} {meetConfig.grade}</span>
                            </a>
                        );
                    })()}

                    <button
                        onClick={load}
                        disabled={loading}
                        className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                        style={{ background: '#F1F0EC', border: '1px solid #E9E9E7', color: '#57564F' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#E9E9E7'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#F1F0EC'}
                        title="Làm mới thông báo"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} style={{ color: ACCENT }} />
                        Làm mới
                    </button>
                </div>
            </div>

            {/* ── Admin: Compose + Filter Bar ── */}
            {isAdmin ? (
                <div className="space-y-3">
                    {/* Filter + Compose button row */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            onClick={() => setAdminGradeFilter(null)}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all"
                            style={{
                                background: adminGradeFilter === null ? '#1A1A1A' : '#F7F6F3',
                                color: adminGradeFilter === null ? '#fff' : '#787774',
                                border: `1px solid ${adminGradeFilter === null ? '#1A1A1A' : '#E9E9E7'}`,
                            }}
                        >
                            Tất cả
                            <span className="ml-1 opacity-75">({notifications.length})</span>
                        </button>
                        {GRADE_CONFIG.map(g => {
                            const isActive = adminGradeFilter === g.grade;
                            return (
                                <button
                                    key={g.grade}
                                    onClick={() => setAdminGradeFilter(g.grade)}
                                    className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all"
                                    style={{
                                        background: isActive ? g.accent : '#F7F6F3',
                                        color: isActive ? '#fff' : '#787774',
                                        border: `1px solid ${isActive ? g.accent : '#E9E9E7'}`,
                                    }}
                                >
                                    {g.label}
                                    <span className="ml-1 opacity-75">({gradeCountMap[g.grade] || 0})</span>
                                </button>
                            );
                        })}

                        {/* Compose button */}
                        {onCreateNotification && (
                            <button
                                onClick={() => { setShowCompose(prev => !prev); setTimeout(() => textareaRef.current?.focus(), 100); }}
                                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95"
                                style={{
                                    background: showCompose ? '#1A1A1A' : 'linear-gradient(135deg, #6B7CDB, #9065B0)',
                                    color: '#fff',
                                    boxShadow: showCompose ? 'none' : '0 2px 8px rgba(107,124,219,0.3)',
                                }}
                            >
                                <MessageSquarePlus className="w-3.5 h-3.5" />
                                {showCompose ? 'Đóng' : 'Soạn thông báo'}
                            </button>
                        )}
                    </div>

                    {/* ── Compose Form (Admin only) ── */}
                    {showCompose && onCreateNotification && (
                        <div
                            className="rounded-xl overflow-hidden animate-fade-in"
                            style={{
                                border: '1px solid #E9E9E7',
                                background: '#FFFFFF',
                                boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
                            }}
                        >
                            {/* Header */}
                            <div
                                className="px-4 py-3 flex items-center gap-2"
                                style={{ borderBottom: '1px solid #E9E9E7', background: 'linear-gradient(135deg, #F3ECF8, #EEF0FB)' }}
                            >
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#fff', border: '1px solid #E9E9E7' }}>
                                    <Megaphone className="w-3.5 h-3.5" style={{ color: '#6B7CDB' }} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>Soạn thông báo mới</h3>
                                    <p className="text-[11px]" style={{ color: '#787774' }}>Gửi thông báo tùy ý đến học sinh</p>
                                </div>
                            </div>

                            <div className="p-4 space-y-3">
                                {/* Textarea */}
                                <div>
                                    <textarea
                                        ref={textareaRef}
                                        value={composeMessage}
                                        onChange={e => setComposeMessage(e.target.value)}
                                        placeholder="Ví dụ: Tuần sau nghỉ học, các em nhớ ôn bài chuẩn bị kiểm tra nhé! 📚"
                                        rows={3}
                                        className="w-full px-3 py-2.5 rounded-lg text-sm resize-none focus:outline-none transition-all"
                                        style={{
                                            border: '1px solid #E9E9E7',
                                            background: '#F7F6F3',
                                            color: '#1A1A1A',
                                        }}
                                        onFocus={e => { (e.target as HTMLTextAreaElement).style.borderColor = '#6B7CDB'; (e.target as HTMLTextAreaElement).style.background = '#fff'; }}
                                        onBlur={e => { (e.target as HTMLTextAreaElement).style.borderColor = '#E9E9E7'; (e.target as HTMLTextAreaElement).style.background = '#F7F6F3'; }}
                                    />
                                    <div className="flex items-center justify-between mt-1">
                                        <span className="text-[10px]" style={{ color: '#AEACA8' }}>
                                            {composeMessage.length}/500 ký tự
                                        </span>
                                        {composeMessage.length > 500 && (
                                            <span className="text-[10px] font-medium" style={{ color: '#E03E3E' }}>Quá dài!</span>
                                        )}
                                    </div>
                                </div>

                                {/* Grade selector + Send all toggle */}
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-medium" style={{ color: '#57564F' }}>Gửi cho:</span>

                                    {/* All grades toggle */}
                                    <button
                                        onClick={() => setComposeAllGrades(prev => !prev)}
                                        className="px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all"
                                        style={{
                                            background: composeAllGrades ? '#1A1A1A' : '#F7F6F3',
                                            color: composeAllGrades ? '#fff' : '#787774',
                                            border: `1px solid ${composeAllGrades ? '#1A1A1A' : '#E9E9E7'}`,
                                        }}
                                    >
                                        Tất cả khối
                                    </button>

                                    {/* Individual grade selector */}
                                    {!composeAllGrades && GRADE_CONFIG.map(g => {
                                        const isSelected = composeGrade === g.grade;
                                        return (
                                            <button
                                                key={g.grade}
                                                onClick={() => setComposeGrade(g.grade)}
                                                className="px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all"
                                                style={{
                                                    background: isSelected ? g.accent : '#F7F6F3',
                                                    color: isSelected ? '#fff' : '#787774',
                                                    border: `1px solid ${isSelected ? g.accent : '#E9E9E7'}`,
                                                }}
                                            >
                                                {g.label}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Send button */}
                                <div className="flex items-center justify-end gap-2 pt-1">
                                    <button
                                        onClick={() => { setShowCompose(false); setComposeMessage(''); }}
                                        className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                                        style={{ background: '#F7F6F3', color: '#787774', border: '1px solid #E9E9E7' }}
                                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#E9E9E7'}
                                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#F7F6F3'}
                                    >
                                        Hủy
                                    </button>
                                    <button
                                        onClick={handleSendCustomNotification}
                                        disabled={!composeMessage.trim() || composeMessage.length > 500 || composeSending}
                                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95"
                                        style={{
                                            background: (!composeMessage.trim() || composeMessage.length > 500) ? '#E9E9E7' : 'linear-gradient(135deg, #6B7CDB, #9065B0)',
                                            color: (!composeMessage.trim() || composeMessage.length > 500) ? '#AEACA8' : '#fff',
                                            cursor: (!composeMessage.trim() || composeMessage.length > 500) ? 'not-allowed' : 'pointer',
                                            boxShadow: composeMessage.trim() && composeMessage.length <= 500 ? '0 2px 8px rgba(107,124,219,0.3)' : 'none',
                                        }}
                                    >
                                        {composeSending ? (
                                            <>
                                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                Đang gửi...
                                            </>
                                        ) : (
                                            <>
                                                <Send className="w-3.5 h-3.5" />
                                                Gửi thông báo
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-md"
                    style={{ background: ACCENT_LIGHT, color: ACCENT }}
                >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: ACCENT }} />
                    Thông báo dành cho Lớp {grade}
                </div>
            )}



            {/* ── Content ── */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <RefreshCw className="w-5 h-5 animate-spin" style={{ color: ACCENT }} />
                    <span className="ml-2 text-sm" style={{ color: '#787774' }}>Đang tải thông báo...</span>
                </div>
            ) : displayedNotifications.length === 0 ? (
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E9E9E7', background: '#FFFFFF' }}>
                    <div className="py-16 text-center">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-3" style={{ background: '#F1F0EC' }}>
                            <BellOff className="w-5 h-5" style={{ color: '#CFCFCB' }} />
                        </div>
                        <p className="font-medium" style={{ color: '#57564F' }}>Chưa có thông báo nào</p>
                        <p className="text-sm mt-1 max-w-xs mx-auto leading-relaxed" style={{ color: '#AEACA8' }}>
                            Khi thầy đăng tài liệu mới, thông báo sẽ xuất hiện tại đây để bạn tải về.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E9E9E7', background: '#FFFFFF' }}>
                    {/* Section header */}
                    <div
                        className="px-4 py-3"
                        style={{ borderBottom: '1px solid #E9E9E7', borderLeft: '3px solid #E03E3E', background: '#F7F6F3' }}
                    >
                        <h3 className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>
                            Danh sách thông báo
                        </h3>
                        <p className="text-xs mt-0.5" style={{ color: '#AEACA8' }}>
                            {unreadCount > 0 ? `${unreadCount} thông báo chưa cập nhật` : 'Tất cả đã được cập nhật'}
                        </p>
                    </div>

                    {/* Notification rows */}
                    {displayedNotifications.map((notif, idx) => {
                        const isFetched = fetchedIds.has(notif.id);
                        const isFetchingThis = fetchingId === notif.id;
                        const canFetch = notif.fetch_enabled && !isFetched && !fetchingId;
                        const isNew = notif.fetch_enabled && !isFetched;

                        return (
                            <div
                                key={notif.id}
                                className="group relative transition-colors"
                                style={{
                                    borderBottom: idx < displayedNotifications.length - 1 ? '1px solid #F1F0EC' : 'none',
                                    opacity: isFetched ? 0.75 : 1,
                                    borderLeft: isNew ? `3px solid ${ACCENT}` : '3px solid transparent',
                                }}
                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#FAFAF9'}
                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                            >
                                <div className="flex items-start gap-3 px-4 py-4">
                                    {/* Icon */}
                                    <div
                                        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                                        style={{ background: isFetched ? '#EAF3EE' : ACCENT_LIGHT }}
                                    >
                                        {isFetched
                                            ? <CheckCircle2 className="w-4.5 h-4.5" style={{ color: '#448361', width: 18, height: 18 }} />
                                            : <Bell className="w-4.5 h-4.5" style={{ color: ACCENT, width: 18, height: 18 }} />
                                        }
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                            {!isFetched && notif.fetch_enabled && (
                                                <span
                                                    className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider animate-pulse"
                                                    style={{ background: ACCENT_LIGHT, color: ACCENT }}
                                                >
                                                    Mới
                                                </span>
                                            )}
                                            {isFetched && (
                                                <span
                                                    className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                                                    style={{ background: '#EAF3EE', color: '#448361' }}
                                                >
                                                    Đã cập nhật
                                                </span>
                                            )}
                                            {/* Admin: show grade badge */}
                                            {isAdmin && (notif as any).grade && (() => {
                                                const gc = GRADE_CONFIG.find(g => g.grade === (notif as any).grade);
                                                return gc ? (
                                                    <span
                                                        className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                                                        style={{ background: gc.bg, color: gc.accent }}
                                                    >
                                                        {gc.label}
                                                    </span>
                                                ) : null;
                                            })()}
                                        </div>

                                        {notif.title && (
                                            <h4 className="text-sm font-bold mb-1" style={{ color: isFetched ? '#57564F' : '#1A1A1A' }}>
                                                {notif.title}
                                            </h4>
                                        )}

                                        <p className="text-sm leading-relaxed" style={{ color: isFetched ? '#787774' : '#57564F' }}>
                                            {notif.message}
                                        </p>
 
                                        {/* Badge for manual messages only */}
                                        {notif.type === 'manual' && (
                                            <span
                                                className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded mt-1.5"
                                                style={{ 
                                                    background: '#EEF0FB', 
                                                    color: '#6B7CDB',
                                                    border: `1px solid #D1D5DB50`
                                                }}
                                            >
                                                <Megaphone className="w-2.5 h-2.5" />
                                                Thông báo từ Thầy
                                            </span>
                                        )}


                                        <div className="flex items-center gap-1 mt-1.5" style={{ color: '#AEACA8' }}>
                                            <Clock className="w-3 h-3" />
                                            <span className="text-xs">{formatRelativeTime(notif.created_at)}</span>
                                        </div>

                                        {/* Fetch button area */}
                                        {notif.fetch_enabled && (
                                            <div className="mt-3">
                                                {isFetched ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <CheckCircle2 className="w-3.5 h-3.5" style={{ color: '#448361' }} />
                                                        <span className="text-xs font-medium" style={{ color: '#448361' }}>
                                                            Kho tài liệu đã được cập nhật
                                                        </span>
                                                    </div>
                                                ) : isFetchingThis ? (
                                                    <div className="space-y-1.5">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-1.5">
                                                                <RefreshCw className="w-3.5 h-3.5 animate-spin" style={{ color: ACCENT }} />
                                                                <span className="text-xs font-medium" style={{ color: ACCENT }}>Đang tải tài liệu...</span>
                                                            </div>
                                                            <span className="text-xs font-bold" style={{ color: ACCENT }}>{fetchProgress}%</span>
                                                        </div>
                                                        <div className="h-1 rounded-full overflow-hidden" style={{ background: ACCENT_LIGHT }}>
                                                            <div
                                                                className="h-full rounded-full transition-all duration-300"
                                                                style={{ width: `${fetchProgress}%`, background: `linear-gradient(90deg, ${ACCENT}99, ${ACCENT})` }}
                                                            />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => handleFetch(notif)}
                                                        disabled={!canFetch}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95"
                                                        style={{
                                                            background: canFetch ? ACCENT : '#F1F0EC',
                                                            color: canFetch ? '#fff' : '#AEACA8',
                                                            cursor: canFetch ? 'pointer' : 'not-allowed',
                                                        }}
                                                        onMouseEnter={e => { if (canFetch) (e.currentTarget as HTMLElement).style.background = '#c93232'; }}
                                                        onMouseLeave={e => { if (canFetch) (e.currentTarget as HTMLElement).style.background = ACCENT; }}
                                                    >
                                                        <CloudDownload className="w-3.5 h-3.5" />
                                                        Lấy bài về
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Admin delete */}
                                    {isAdmin && (
                                        <button
                                            onClick={() => handleDelete(notif.id)}
                                            className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all shrink-0"
                                            style={{ color: '#AEACA8' }}
                                            title="Xóa thông báo"
                                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#FEF2F2'; (e.currentTarget as HTMLElement).style.color = '#E03E3E'; }}
                                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#AEACA8'; }}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default NotificationPage;
