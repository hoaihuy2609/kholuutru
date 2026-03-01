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

const ACCENT = '#6B7CDB';

// Chuẩn hoá SĐT để lấy lớp
const getStudentGrade = (): number => {
    return parseInt(localStorage.getItem('physivault_grade') || '12', 10);
};

// Format thời gian relative
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
    onGetNotifications,
    onGetFetchedIds,
    onMarkFetched,
    onFetchLessons,
    onShowToast,
    isAdmin,
    onDeleteNotification,
}) => {
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [fetchedIds, setFetchedIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    // fetchingId: ID của notification đang được fetch (để hiện loading per-item)
    const [fetchingId, setFetchingId] = useState<string | null>(null);
    const [fetchProgress, setFetchProgress] = useState(0);

    const grade = getStudentGrade();

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [notifs, fetched] = await Promise.all([
                onGetNotifications(grade),
                onGetFetchedIds(),
            ]);
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
        if (fetchingId) return; // Đang fetch rồi, chờ thôi
        setFetchingId(notif.id);
        setFetchProgress(0);
        try {
            const result = await onFetchLessons(grade, (pct) => setFetchProgress(pct));
            if (result.success) {
                // Đánh dấu đã fetch
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

    // Số thông báo chưa fetch
    const unreadCount = notifications.filter(n => n.fetch_enabled && !fetchedIds.has(n.id)).length;

    return (
        <div className="space-y-6 animate-fade-in">
            {/* ── Header ── */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold flex items-center gap-2.5" style={{ color: '#1A1A1A' }}>
                        <span>🔔</span> Thông Báo
                        {unreadCount > 0 && (
                            <span
                                className="text-xs font-bold px-2 py-0.5 rounded-full"
                                style={{ background: '#E03E3E', color: '#fff' }}
                            >
                                {unreadCount} mới
                            </span>
                        )}
                    </h1>
                    <p className="text-sm mt-1" style={{ color: '#787774' }}>
                        Thầy thông báo tài liệu mới — bấm <strong>Lấy bài về</strong> để cập nhật kho học liệu của bạn.
                    </p>
                </div>
                <button
                    onClick={load}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all"
                    style={{ color: '#57564F', background: '#F1F0EC' }}
                    title="Tải lại"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Tải lại
                </button>
            </div>

            {/* ── Grade Badge ── */}
            <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold"
                style={{ background: '#EEF0FB', color: ACCENT }}
            >
                <span className="w-2 h-2 rounded-full" style={{ background: ACCENT }} />
                Thông báo dành cho Lớp {grade}
            </div>

            {/* ── Content ── */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <RefreshCw className="w-6 h-6 animate-spin" style={{ color: ACCENT }} />
                    <span className="ml-2 text-sm" style={{ color: '#787774' }}>Đang tải thông báo...</span>
                </div>
            ) : notifications.length === 0 ? (
                /* Empty State */
                <div
                    className="text-center py-20 rounded-2xl"
                    style={{ border: '2px dashed #E9E9E7' }}
                >
                    <div
                        className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                        style={{ background: '#F1F0EC' }}
                    >
                        <BellOff className="w-7 h-7" style={{ color: '#CFCFCB' }} />
                    </div>
                    <p className="font-semibold text-base" style={{ color: '#57564F' }}>Chưa có thông báo nào</p>
                    <p className="text-sm mt-1.5 max-w-xs mx-auto leading-relaxed" style={{ color: '#AEACA8' }}>
                        Khi thầy đăng tài liệu mới, thông báo sẽ xuất hiện tại đây để bạn tải về.
                    </p>
                </div>
            ) : (
                /* Notification List */
                <div className="grid gap-4">
                    {notifications.map((notif) => {
                        const isFetched = fetchedIds.has(notif.id);
                        const isFetchingThis = fetchingId === notif.id;
                        const canFetch = notif.fetch_enabled && !isFetched && !fetchingId;

                        return (
                            <div
                                key={notif.id}
                                className="rounded-2xl overflow-hidden transition-all group"
                                style={{
                                    background: '#fff',
                                    border: `1px solid ${isFetched ? '#E9E9E7' : '#C7CEFF'}`,
                                    boxShadow: isFetched
                                        ? '0 1px 4px rgba(0,0,0,0.04)'
                                        : '0 4px 20px rgba(107,124,219,0.10)',
                                    opacity: isFetched ? 0.75 : 1,
                                }}
                            >
                                {/* Top accent bar */}
                                <div
                                    className="h-1"
                                    style={{
                                        background: isFetched
                                            ? '#E9E9E7'
                                            : `linear-gradient(90deg, ${ACCENT}, #93ACFF)`,
                                    }}
                                />

                                <div className="p-5">
                                    <div className="flex items-start gap-4">
                                        {/* Icon */}
                                        <div
                                            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                                            style={{
                                                background: isFetched ? '#F1F0EC' : '#EEF0FB',
                                            }}
                                        >
                                            {isFetched
                                                ? <CheckCircle2 className="w-5 h-5" style={{ color: '#448361' }} />
                                                : <Bell className="w-5 h-5" style={{ color: ACCENT }} />
                                            }
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                {!isFetched && notif.fetch_enabled && (
                                                    <span
                                                        className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
                                                        style={{ background: '#EEF0FB', color: ACCENT }}
                                                    >
                                                        Mới
                                                    </span>
                                                )}
                                                {isFetched && (
                                                    <span
                                                        className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
                                                        style={{ background: '#EDFDF5', color: '#448361' }}
                                                    >
                                                        Đã cập nhật
                                                    </span>
                                                )}
                                            </div>

                                            <p
                                                className="text-sm leading-relaxed"
                                                style={{ color: isFetched ? '#787774' : '#1A1A1A' }}
                                            >
                                                {notif.message}
                                            </p>

                                            <div className="flex items-center gap-1.5 mt-2" style={{ color: '#AEACA8' }}>
                                                <Clock className="w-3.5 h-3.5" />
                                                <span className="text-xs">{formatRelativeTime(notif.created_at)}</span>
                                            </div>
                                        </div>

                                        {/* Nút Xóa (Dành cho Admin) */}
                                        {isAdmin && (
                                            <button
                                                onClick={() => handleDelete(notif.id)}
                                                className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all ml-auto hover:bg-red-50"
                                                title="Xóa thông báo"
                                            >
                                                <Trash2 className="w-4 h-4 text-red-500" />
                                            </button>
                                        )}
                                    </div>

                                    {/* Fetch Button Area */}
                                    {notif.fetch_enabled && (
                                        <div className="mt-4 pt-4" style={{ borderTop: '1px solid #F1F0EC' }}>
                                            {isFetched ? (
                                                <div className="flex items-center gap-2">
                                                    <CheckCircle2 className="w-4 h-4" style={{ color: '#448361' }} />
                                                    <span className="text-sm font-medium" style={{ color: '#448361' }}>
                                                        Kho tài liệu đã được cập nhật
                                                    </span>
                                                </div>
                                            ) : isFetchingThis ? (
                                                /* Progress bar khi đang fetch */
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <RefreshCw className="w-4 h-4 animate-spin" style={{ color: ACCENT }} />
                                                            <span className="text-sm font-medium" style={{ color: ACCENT }}>
                                                                Đang tải tài liệu về...
                                                            </span>
                                                        </div>
                                                        <span className="text-xs font-bold" style={{ color: ACCENT }}>
                                                            {fetchProgress}%
                                                        </span>
                                                    </div>
                                                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#EEF0FB' }}>
                                                        <div
                                                            className="h-full rounded-full transition-all duration-300"
                                                            style={{
                                                                width: `${fetchProgress}%`,
                                                                background: `linear-gradient(90deg, ${ACCENT}, #93ACFF)`,
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => handleFetch(notif)}
                                                    disabled={!canFetch}
                                                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]"
                                                    style={{
                                                        background: canFetch ? ACCENT : '#F1F0EC',
                                                        color: canFetch ? '#fff' : '#AEACA8',
                                                        cursor: canFetch ? 'pointer' : 'not-allowed',
                                                    }}
                                                    onMouseEnter={e => {
                                                        if (canFetch) (e.currentTarget as HTMLElement).style.background = '#5566CC';
                                                    }}
                                                    onMouseLeave={e => {
                                                        if (canFetch) (e.currentTarget as HTMLElement).style.background = ACCENT;
                                                    }}
                                                >
                                                    <CloudDownload className="w-4 h-4" />
                                                    Lấy bài về
                                                </button>
                                            )}
                                        </div>
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
