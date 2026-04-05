import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, Image, X, Pencil, Trash2, User, RefreshCw, AlertCircle } from 'lucide-react';
import { ExamComment } from '../types';
import {
    fetchComments, postComment, deleteComment,
    uploadCommentImage, getNickname, saveNickname,
} from '../src/services/commentService';

const ACCENT = '#6B7CDB';

interface ExamCommentSectionProps {
    examId: string;
    examTitle: string;
    isAdmin: boolean;
    adminKey?: string; // VITE_ADMIN_KEY để xác thực xóa
    hideHeader?: boolean;
    nestedLevel?: number;
}

// ── Helpers ─────────────────────────────────────────────────────
function timeAgo(ms: number): string {
    const diff = Date.now() - ms;
    if (diff < 60_000) return 'Vừa xong';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} phút trước`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} giờ trước`;
    return new Date(ms).toLocaleDateString('vi-VN');
}

function getAvatarColor(name: string): string {
    const colors = ['#6B7CDB', '#448361', '#D9730D', '#9065B0', '#E03E3E', '#0369A1'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
}

// ── Main Component ──────────────────────────────────────────────
const ExamCommentSection: React.FC<ExamCommentSectionProps> = ({
    examId, examTitle, isAdmin, adminKey, hideHeader, nestedLevel = 0
}) => {
    const [comments, setComments] = useState<ExamComment[]>([]);
    const [loading, setLoading] = useState(true);
    const [text, setText] = useState('');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [expandedReplyId, setExpandedReplyId] = useState<string | null>(null);

    // Nickname
    const [nickname, setNickname] = useState(getNickname);
    const [editingNickname, setEditingNickname] = useState(false);
    const [nicknameInput, setNicknameInput] = useState(nickname);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // ── Load comments ───────────────────────────────────────────
    useEffect(() => {
        setLoading(true);
        fetchComments(examId)
            .then(data => setComments(data.sort((a, b) => a.created_at - b.created_at)))
            .catch(() => setComments([]))
            .finally(() => setLoading(false));
    }, [examId]);

    // ── Chọn ảnh ────────────────────────────────────────────────
    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { setError('Ảnh tối đa 5MB'); return; }
        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
        setError('');
    };

    const removeImage = () => {
        setImageFile(null);
        if (imagePreview) URL.revokeObjectURL(imagePreview);
        setImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // ── Lưu nickname ─────────────────────────────────────────────
    const handleSaveNickname = () => {
        const trimmed = nicknameInput.trim();
        if (!trimmed) return;
        saveNickname(trimmed);
        setNickname(trimmed);
        setEditingNickname(false);
    };

    // ── Gửi comment ──────────────────────────────────────────────
    const handleSubmit = async () => {
        if (!text.trim() && !imageFile) return;
        if (!nickname) { setEditingNickname(true); setError('Vui lòng đặt tên hiển thị trước'); return; }
        setError('');
        setSubmitting(true);
        try {
            let imageUrl: string | undefined;
            if (imageFile) {
                setUploading(true);
                imageUrl = await uploadCommentImage(imageFile);
                setUploading(false);
            }
            const newComment = await postComment(examId, text, imageUrl);
            setComments(prev => [...prev, newComment]);
            setText('');
            removeImage();
        } catch (err: any) {
            setError(err.message || 'Có lỗi xảy ra, thử lại sau');
        } finally {
            setSubmitting(false);
            setUploading(false);
        }
    };

    // ── Admin xóa comment ────────────────────────────────────────
    const handleDelete = async (commentId: string) => {
        if (!window.confirm('Xóa bình luận này?')) return;
        try {
            await deleteComment(commentId, adminKey || '');
            setComments(prev => prev.filter(c => c.id !== commentId));
        } catch (err: any) {
            alert('Lỗi xóa: ' + err.message);
        }
    };

    return (
        <div className="mt-6 rounded-2xl overflow-hidden" style={{ border: hideHeader ? 'none' : '1px solid #E9E9E7', background: hideHeader ? 'transparent' : '#FFFFFF' }}>

            {/* Header */}
            {!hideHeader && (
                <div className="flex items-center gap-2.5 px-5 py-3.5" style={{ borderBottom: '1px solid #E9E9E7' }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#EEF0FB' }}>
                    <MessageCircle className="w-4 h-4" style={{ color: ACCENT }} />
                </div>
                <div>
                    <h3 className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>
                        Thảo luận đề thi
                    </h3>
                    <p className="text-[11px]" style={{ color: '#AEACA8' }}>{examTitle}</p>
                </div>
                <span
                    className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: '#EEF0FB', color: ACCENT }}
                >
                    {comments.length} bình luận
                </span>
                </div>
            )}

            <div className={`${hideHeader ? 'p-0 pt-2' : 'p-5'} space-y-5`}>

                {/* Comment List */}
                {loading ? (
                    <div className="flex items-center justify-center gap-2 py-8" style={{ color: '#AEACA8' }}>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Đang tải bình luận...</span>
                    </div>
                ) : comments.length === 0 ? (
                    <div className="text-center py-10" style={{ color: '#AEACA8' }}>
                        <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="text-sm">Chưa có bình luận nào. Hãy là người đầu tiên!</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {comments.map((comment, index) => {
                            const isLast = index === comments.length - 1;
                            return (
                                <div key={comment.id} className="group flex gap-2 relative">
                                    {(nestedLevel || 0) > 0 && (
                                        <>
                                            {/* Đường đâm ngược lên Avatar của Cha (chỉ mọc ở Comment đầu tiên) */}
                                            {index === 0 && (
                                                <div className="absolute top-[-35px] -left-[24px] w-[2px] h-[35px] bg-[#CED0D4]" />
                                            )}
                                            {/* Rẽ nhánh ngang bo cong vào Avatar con */}
                                            <div className="absolute top-0 -left-[24px] w-[24px] h-[20px] border-b-[2px] border-l-[2px] border-[#CED0D4] rounded-bl-xl z-0" />
                                            
                                            {/* Thân dọc tiếp tục đâm xuống Comment kế tiếp (nếu chưa phải là cuối cùng) */}
                                            {!isLast && (
                                                <div className="absolute top-[20px] -left-[24px] w-[2px] bottom-[-12px] bg-[#CED0D4] z-0" />
                                            )}
                                        </>
                                    )}

                                    {/* Avatar */}
                                    <div
                                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 mt-1 relative z-10"
                                        style={{ background: getAvatarColor(comment.author_name) }}
                                    >
                                        {comment.author_name.charAt(0).toUpperCase()}
                                    </div>

                                <div className="flex-1 min-w-0">
                                    {/* Bubble */}
                                    <div className="inline-block px-3 py-2.5 rounded-2xl bg-[#F0F2F5] max-w-full">
                                        <span className="text-[13px] font-bold block mb-0.5" style={{ color: '#1A1A1A' }}>
                                            {comment.author_name}
                                        </span>
                                        {comment.text && (
                                            <p className="text-[14px] leading-relaxed whitespace-pre-wrap break-words" style={{ color: '#1A1A1A' }}>
                                                {comment.text}
                                            </p>
                                        )}
                                        {comment.image_url && (
                                            <a href={comment.image_url} target="_blank" rel="noopener noreferrer" className="mt-2 block">
                                                <img
                                                    src={comment.image_url}
                                                    alt="Ảnh đính kèm"
                                                    className="max-h-60 rounded-lg object-cover transition-opacity hover:opacity-90 border border-[#E9E9E7]"
                                                    loading="lazy"
                                                />
                                            </a>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-4 mt-1 ml-2">
                                        <span className="text-[12px] font-medium" style={{ color: '#65676B' }}>
                                            {timeAgo(comment.created_at)}
                                        </span>
                                        {(nestedLevel || 0) < 1 && (
                                            <button
                                                onClick={() => setExpandedReplyId(expandedReplyId === comment.id ? null : comment.id)}
                                                className="text-[12px] font-bold cursor-pointer hover:underline"
                                                style={{ color: expandedReplyId === comment.id ? '#1877F2' : '#65676B' }}
                                            >
                                                {expandedReplyId === comment.id ? 'Đóng' : 'Trả lời'}
                                            </button>
                                        )}
                                        {isAdmin && (
                                            <button
                                                onClick={() => handleDelete(comment.id)}
                                                className="opacity-0 group-hover:opacity-100 text-[12px] font-bold text-red-500 hover:underline transition-opacity"
                                            >
                                                Xóa
                                            </button>
                                        )}
                                    </div>

                                    {/* Nested Replies */}
                                    {expandedReplyId === comment.id && (
                                        <div className="mt-1 relative">
                                            <div className="pl-10">
                                                <ExamCommentSection
                                                    hideHeader
                                                    nestedLevel={(nestedLevel || 0) + 1}
                                                    examId={comment.id}
                                                    examTitle={`Trả lời ${comment.author_name}`}
                                                    isAdmin={isAdmin}
                                                    adminKey={adminKey}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            );
                        })}
                    </div>
                )}

                <div className="h-px w-full" style={{ background: '#E9E9E7' }} />


                {/* Nickname Bar */}
                <div className="flex items-center gap-2 p-2.5 rounded-xl" style={{ background: '#FAFAF9', border: '1px solid #E9E9E7' }}>
                    <User className="w-3.5 h-3.5 shrink-0" style={{ color: '#AEACA8' }} />
                    {editingNickname ? (
                        <div className="flex gap-2 flex-1">
                            <input
                                autoFocus
                                type="text"
                                value={nicknameInput}
                                onChange={e => setNicknameInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSaveNickname()}
                                placeholder="Nhập tên hiển thị của bạn..."
                                maxLength={30}
                                className="flex-1 text-sm outline-none bg-transparent"
                                style={{ color: '#1A1A1A' }}
                            />
                            <button
                                onClick={handleSaveNickname}
                                className="text-xs font-semibold px-3 py-1 rounded-lg transition-colors"
                                style={{ background: ACCENT, color: '#fff' }}
                            >
                                Lưu
                            </button>
                            <button
                                onClick={() => { setEditingNickname(false); setNicknameInput(nickname); }}
                                className="text-xs px-2 py-1 rounded-lg transition-colors"
                                style={{ color: '#787774' }}
                            >
                                Hủy
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 flex-1">
                            <span className="text-sm" style={{ color: nickname ? '#1A1A1A' : '#AEACA8' }}>
                                {nickname || 'Chưa đặt tên hiển thị'}
                            </span>
                            <button
                                onClick={() => { setEditingNickname(true); setNicknameInput(nickname); }}
                                className="ml-auto p-1 rounded-md transition-colors"
                                title="Đổi tên hiển thị"
                                style={{ color: '#AEACA8' }}
                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F1F0EC'}
                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                            >
                                <Pencil className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}
                </div>

                {/* Input Box */}
                <div className="rounded-xl overflow-hidden" style={{ border: `1.5px solid ${error ? '#E03E3E' : '#E9E9E7'}` }}>
                    <textarea
                        value={text}
                        onChange={e => { setText(e.target.value); setError(''); }}
                        onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSubmit(); }}
                        placeholder="Chia sẻ thắc mắc hoặc góp ý về đề thi... (Ctrl+Enter để gửi)"
                        rows={3}
                        className="w-full resize-none outline-none px-4 pt-3 pb-2 text-sm"
                        style={{ background: '#FAFAF9', color: '#1A1A1A' }}
                    />

                    {/* Image preview */}
                    {imagePreview && (
                        <div className="px-4 pb-2 relative inline-block">
                            <img
                                src={imagePreview}
                                alt="preview"
                                className="max-h-36 rounded-lg object-cover border"
                                style={{ borderColor: '#E9E9E7' }}
                            />
                            <button
                                onClick={removeImage}
                                className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center"
                                style={{ background: 'rgba(0,0,0,0.5)' }}
                            >
                                <X className="w-3 h-3 text-white" />
                            </button>
                        </div>
                    )}

                    <div className="flex items-center justify-between px-3 py-2" style={{ borderTop: '1px solid #E9E9E7', background: '#F7F6F3' }}>
                        <div className="flex items-center gap-1">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleImageChange}
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                                style={{ color: '#787774' }}
                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#E9E9E7'}
                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                                title="Đính kèm ảnh"
                            >
                                <Image className="w-3.5 h-3.5" />
                                Ảnh
                            </button>
                        </div>

                        <button
                            onClick={handleSubmit}
                            disabled={submitting || (!text.trim() && !imageFile)}
                            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 disabled:opacity-50"
                            style={{ background: ACCENT, color: '#fff' }}
                        >
                            {submitting
                                ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" />{uploading ? 'Đang tải ảnh...' : 'Đang gửi...'}</>
                                : <><Send className="w-3.5 h-3.5" />Gửi</>
                            }
                        </button>
                    </div>
                </div>

                {/* Error message */}
                {error && (
                    <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg animate-fade-in" style={{ background: '#FEF0F0', color: '#E03E3E', border: '1px solid #FECACA' }}>
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        {error}
                    </div>
                )}

                {/* End of Input Section */}

            </div>
        </div>
    );
};

export default ExamCommentSection;
