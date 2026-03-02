import React, { useState, useEffect, useCallback } from 'react';
import { Bell, BellOff, CloudDownload, CheckCircle2, RefreshCw, Clock, Trash2 } from 'lucide-react';
import { NotificationItem } from '../types';

interface NotificationPageProps {
    onGetNotifications: (grade: number) => Promise<NotificationItem[]>;
    onGetFetchedIds: () => Promise<Set<string>>;
    onMarkFetched: (notifId: string) => Promise<boolean>;
    onFetchLessons: (grade: number, onProgress?: (pct: number) => void) => Promise<{ success: boolean; lessonCount: number; fileCount: number }>;
    onShowToast: (msg: string, type: 'success' | 'error' | 'warning') => void;
    isAdmin?: boolean;
    onDeleteNotification?: (notifId: string) => Promise<boolean>;
}

const ACCENT = '#E03E3E';
const ACCENT_LIGHT = '#FEF2F2';
const ACCENT_BORDER = '#FECACA';

const getStudentGrade = (): number => parseInt(localStorage.getItem('physivault_grade') || '12', 10);

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
    onFetchLessons, onShowToast, isAdmin, onDeleteNotification,
}) => {
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [fetchedIds, setFetchedIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [fetchingId, setFetchingId] = useState<string | null>(null);
    const [fetchProgress, setFetchProgress] = useState(0);

    const grade = getStudentGrade();

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [notifs, fetched] = await Promise.all([onGetNotifications(grade), onGetFetchedIds()]);
            setNotifications(notifs);
            setFetchedIds(fetched);
        } catch (e) {
            console.error('Lỗi tải thông báo:', e);
        } finally {
            setLoading(false);
        }
    }, [grade]);

    useEffect(() => { load(); }, [load]);

    const handleFetch = async (notif: NotificationItem) => {
        if (fetchingId) return;
        setFetchingId(notif.id);
        setFetchProgress(0);
        try {
            const result = await onFetchLessons(grade, (pct) => setFetchProgress(pct));
            if (result.success) {
                await onMarkFetched(notif.id);
                setFetchedIds(prev => new Set([...prev, notif.id]));
                onShowToast(`✅ Đã tải về ${result.fileCount} tài liệu mới!`, 'success');
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

    const unreadCount = notifications.filter(n => n.fetch_enabled && !fetchedIds.has(n.id)).length;

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
                        <p className="text-sm mt-0.5" style={{ color: '#787774' }}>
                            Thầy thông báo tài liệu mới — bấm <strong style={{ color: '#1A1A1A' }}>Lấy bài về</strong> để cập nhật.
                        </p>
                    </div>
                </div>
                <button
                    onClick={load}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                    style={{ background: '#F1F0EC', border: '1px solid #E9E9E7', color: '#57564F' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#E9E9E7'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#F1F0EC'}
                    title="Làm mới thông báo"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} style={{ color: ACCENT }} />
                    Làm mới
                </button>
            </div>

            {/* ── Grade badge ── */}
            <div
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-md"
                style={{ background: ACCENT_LIGHT, color: ACCENT }}
            >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: ACCENT }} />
                Thông báo dành cho Lớp {grade}
            </div>

            {/* ── Content ── */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <RefreshCw className="w-5 h-5 animate-spin" style={{ color: ACCENT }} />
                    <span className="ml-2 text-sm" style={{ color: '#787774' }}>Đang tải thông báo...</span>
                </div>
            ) : notifications.length === 0 ? (
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
                    {notifications.map((notif, idx) => {
                        const isFetched = fetchedIds.has(notif.id);
                        const isFetchingThis = fetchingId === notif.id;
                        const canFetch = notif.fetch_enabled && !isFetched && !fetchingId;
                        const isNew = notif.fetch_enabled && !isFetched;

                        return (
                            <div
                                key={notif.id}
                                className="group relative transition-colors"
                                style={{
                                    borderBottom: idx < notifications.length - 1 ? '1px solid #F1F0EC' : 'none',
                                    opacity: isFetched ? 0.75 : 1,
                                    borderLeft: isNew ? '3px solid #6B7CDB' : '3px solid transparent',
                                }}
                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#FAFAF9'}
                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                            >
                                <div className="flex items-start gap-3 px-4 py-4">
                                    {/* Icon */}
                                    <div
                                        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                                        style={{ background: isFetched ? '#EAF3EE' : '#EEF0FB' }}
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
                                                    className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                                                    style={{ background: '#EEF0FB', color: ACCENT }}
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
                                        </div>

                                        <p className="text-sm leading-relaxed" style={{ color: isFetched ? '#787774' : '#1A1A1A' }}>
                                            {notif.message}
                                        </p>

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
                                                        <div className="h-1 rounded-full overflow-hidden" style={{ background: '#EEF0FB' }}>
                                                            <div
                                                                className="h-full rounded-full transition-all duration-300"
                                                                style={{ width: `${fetchProgress}%`, background: `linear-gradient(90deg, ${ACCENT}, #93ACFF)` }}
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
                                                        onMouseEnter={e => { if (canFetch) (e.currentTarget as HTMLElement).style.background = '#5a6bc9'; }}
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
