import React, { useState, useEffect, useCallback } from 'react';
import { Bell, BellOff, CloudDownload, CheckCircle2, RefreshCw, Clock, Trash2, Sparkles } from 'lucide-react';
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

// ── Violet / Purple palette ──
const ACCENT = '#7C3AED';           // violet-700
const ACCENT_DARK = '#6D28D9';      // violet-800
const ACCENT_LIGHT = '#F5F3FF';     // violet-50
const ACCENT_MID = '#DDD6FE';       // violet-200
const ACCENT_BORDER = '#C4B5FD';    // violet-300

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
                    <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 relative"
                        style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)', boxShadow: '0 4px 12px rgba(124,58,237,0.35)' }}
                    >
                        <Bell className="w-5 h-5 text-white" />
                        {unreadCount > 0 && (
                            <span
                                className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9px] font-black"
                                style={{ background: '#EF4444', color: '#fff', boxShadow: '0 0 0 2px #fff' }}
                            >
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>Thông Báo</h1>
                            {unreadCount > 0 && (
                                <span
                                    className="text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse"
                                    style={{ background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)', color: '#fff' }}
                                >
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
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full"
                style={{ background: 'linear-gradient(135deg, #EDE9FE, #F5F3FF)', color: ACCENT, border: '1px solid #DDD6FE' }}
            >
                <Sparkles className="w-3 h-3" />
                Thông báo dành cho Lớp {grade}
            </div>

            {/* ── Content ── */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <RefreshCw className="w-5 h-5 animate-spin" style={{ color: ACCENT }} />
                    <span className="ml-2 text-sm" style={{ color: '#787774' }}>Đang tải thông báo...</span>
                </div>
            ) : notifications.length === 0 ? (
                <div className="rounded-2xl overflow-hidden" style={{ border: '1px dashed #DDD6FE', background: ACCENT_LIGHT }}>
                    <div className="py-16 text-center">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: '#EDE9FE', border: '1px solid #DDD6FE' }}>
                            <BellOff className="w-6 h-6" style={{ color: ACCENT }} />
                        </div>
                        <p className="font-semibold" style={{ color: ACCENT_DARK }}>Chưa có thông báo nào</p>
                        <p className="text-sm mt-1 max-w-xs mx-auto leading-relaxed" style={{ color: '#787774' }}>
                            Khi thầy đăng tài liệu mới, thông báo sẽ xuất hiện tại đây để bạn tải về.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #E9E9E7', background: '#FFFFFF', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                    {/* Section header */}
                    <div
                        className="px-4 py-3 flex items-center justify-between"
                        style={{ background: 'linear-gradient(90deg, #F5F3FF, #EDE9FE)', borderBottom: '1px solid #DDD6FE' }}
                    >
                        <div>
                            <h3 className="text-sm font-bold" style={{ color: ACCENT_DARK }}>Danh sách thông báo</h3>
                            <p className="text-xs mt-0.5" style={{ color: '#6D28D9', opacity: 0.7 }}>
                                {unreadCount > 0 ? `${unreadCount} thông báo chưa cập nhật` : 'Tất cả đã được cập nhật ✓'}
                            </p>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: ACCENT_MID, color: ACCENT_DARK }}>
                            {notifications.length} thông báo
                        </span>
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
                                className="group relative transition-all"
                                style={{
                                    borderBottom: idx < notifications.length - 1 ? '1px solid #F1F0EC' : 'none',
                                    opacity: isFetched ? 0.72 : 1,
                                    borderLeft: isNew ? `3px solid ${ACCENT}` : '3px solid transparent',
                                }}
                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#FAFAF9'}
                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                            >
                                <div className="flex items-start gap-3 px-4 py-4">
                                    {/* Icon */}
                                    <div
                                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                                        style={{
                                            background: isFetched
                                                ? 'linear-gradient(135deg, #D1FAE5, #A7F3D0)'
                                                : 'linear-gradient(135deg, #EDE9FE, #DDD6FE)',
                                        }}
                                    >
                                        {isFetched
                                            ? <CheckCircle2 className="w-5 h-5" style={{ color: '#059669' }} />
                                            : <Bell className="w-5 h-5" style={{ color: ACCENT }} />
                                        }
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                            {!isFetched && notif.fetch_enabled && (
                                                <span
                                                    className="text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider"
                                                    style={{ background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)', color: '#fff' }}
                                                >
                                                    Mới
                                                </span>
                                            )}
                                            {isFetched && (
                                                <span
                                                    className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                                                    style={{ background: '#D1FAE5', color: '#059669' }}
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
                                                        <CheckCircle2 className="w-3.5 h-3.5" style={{ color: '#059669' }} />
                                                        <span className="text-xs font-semibold" style={{ color: '#059669' }}>
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
                                                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: ACCENT_MID }}>
                                                            <div
                                                                className="h-full rounded-full transition-all duration-300"
                                                                style={{ width: `${fetchProgress}%`, background: `linear-gradient(90deg, #8B5CF6, ${ACCENT})` }}
                                                            />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => handleFetch(notif)}
                                                        disabled={!canFetch}
                                                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95"
                                                        style={{
                                                            background: canFetch
                                                                ? 'linear-gradient(135deg, #8B5CF6, #7C3AED)'
                                                                : '#F1F0EC',
                                                            color: canFetch ? '#fff' : '#AEACA8',
                                                            cursor: canFetch ? 'pointer' : 'not-allowed',
                                                            boxShadow: canFetch ? '0 2px 8px rgba(124,58,237,0.35)' : 'none',
                                                        }}
                                                        onMouseEnter={e => { if (canFetch) (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(124,58,237,0.45)'; }}
                                                        onMouseLeave={e => { if (canFetch) (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(124,58,237,0.35)'; }}
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
