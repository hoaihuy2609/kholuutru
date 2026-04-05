import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Image as ImageIcon, Trash2, User, Check, Send } from 'lucide-react';
import { ExamComment } from '../types';
import { fetchComments, postComment, deleteComment, uploadCommentImage, getNickname, saveNickname } from '../src/services/commentService';
import ExamCommentSection from './ExamCommentSection';

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

interface ForumFeedProps {
    isAdmin: boolean;
    adminKey?: string;
}

const ForumFeed: React.FC<ForumFeedProps> = ({ isAdmin, adminKey }) => {
    const [posts, setPosts] = useState<ExamComment[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Composer state
    const [text, setText] = useState('');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Reply state
    const [expandedPostId, setExpandedPostId] = useState<string | null>(null);

    // Nickname
    const [nickname, setNickname] = useState(getNickname());
    const [editingNickname, setEditingNickname] = useState(!nickname);
    const [nicknameInput, setNicknameInput] = useState(nickname);

    useEffect(() => {
        setLoading(true);
        fetchComments('GLOBAL_FORUM')
            .then(data => setPosts(data.sort((a, b) => b.created_at - a.created_at)))
            .catch(() => setPosts([]))
            .finally(() => setLoading(false));
    }, []);

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

    const handleSaveNickname = () => {
        const trimmed = nicknameInput.trim();
        if (!trimmed) return;
        saveNickname(trimmed);
        setNickname(trimmed);
        setEditingNickname(false);
    };

    const handleSubmitPost = async () => {
        if (!text.trim() && !imageFile) return;
        if (!nickname) { setEditingNickname(true); setError('Vui lòng đặt tên hiển thị trước'); return; }
        setError('');
        setSubmitting(true);
        try {
            let imageUrl: string | undefined;
            if (imageFile) {
                imageUrl = await uploadCommentImage(imageFile);
            }
            const newPost = await postComment('GLOBAL_FORUM', text, imageUrl);
            setPosts(prev => [newPost, ...prev]);
            setText('');
            removeImage();
        } catch (err: any) {
            setError(err.message || 'Lỗi đăng bài');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeletePost = async (postId: string) => {
        if (!window.confirm('Xóa bài học sinh úp này?')) return;
        try {
            await deleteComment(postId, adminKey || '');
            setPosts(prev => prev.filter(p => p.id !== postId));
        } catch (err: any) {
            alert('Lỗi xóa: ' + err.message);
        }
    };

    return (
        <div className="max-w-2xl mx-auto pb-20 animate-fade-in">
            {/* ── CREATE POST BOX ── */}
            <div className="bg-white rounded-2xl border border-[#E9E9E7] p-5 mb-8 shadow-sm">
                
                {/* Nickname */}
                <div className="flex items-center gap-2 px-3 py-2 bg-[#FAFAF9] rounded-xl border border-[#E9E9E7] mb-4">
                    <User className="w-4 h-4 text-[#AEACA8]" />
                    {editingNickname ? (
                        <div className="flex gap-2 flex-1">
                            <input
                                autoFocus
                                type="text"
                                value={nicknameInput}
                                onChange={e => setNicknameInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSaveNickname()}
                                placeholder="Nhập tên của bạn để đăng bài..."
                                maxLength={30}
                                className="flex-1 text-sm bg-transparent outline-none text-[#1A1A1A]"
                            />
                            <button onClick={handleSaveNickname} className="text-xs font-semibold px-3 py-1 bg-[#1A1A1A] text-white rounded-md">Lưu</button>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-between">
                            <span className="text-sm font-semibold text-[#1A1A1A]">{nickname}</span>
                            <button onClick={() => setEditingNickname(true)} className="text-[11px] font-medium text-[#6B7CDB] hover:underline">Sửa tên</button>
                        </div>
                    )}
                </div>

                {/* Text Input */}
                <textarea
                    value={text}
                    onChange={e => setText(e.target.value)}
                    placeholder="Bạn muốn hỏi bài hay thảo luận gì nào?"
                    className="w-full resize-none outline-none text-[15px] min-h-[80px] bg-transparent text-[#1A1A1A] placeholder-[#AEACA8]"
                />

                {imagePreview && (
                    <div className="relative inline-block mt-3 mb-2">
                        <img src={imagePreview} alt="preview" className="rounded-xl border border-[#E9E9E7] max-h-48 object-cover" />
                        <button
                            onClick={removeImage}
                            className="absolute -top-2 -right-2 w-6 h-6 bg-[#1A1A1A] text-white rounded-full flex items-center justify-center hover:bg-red-500 transition-colors"
                        >
                            <User className="hidden" /> {/* just to skip importing X icon, let's use text X */}
                            <span className="text-xs font-bold font-sans">×</span>
                        </button>
                    </div>
                )}

                {error && <p className="text-xs text-[#E03E3E] mt-2 font-medium">{error}</p>}

                {/* Actions */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#F0F0EE]">
                    <div>
                        <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageChange} className="hidden" />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-[#57564F] bg-[#F7F6F3] hover:bg-[#E9E9E7] transition-colors"
                        >
                            <ImageIcon className="w-4 h-4 text-[#448361]" />
                            Đính kèm ảnh
                        </button>
                    </div>

                    <button
                        onClick={handleSubmitPost}
                        disabled={submitting || (!text.trim() && !imageFile)}
                        className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ background: '#6B7CDB' }}
                    >
                        {submitting ? 'Đang đăng...' : 'Đăng bài'}
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* ── FEED LIST ── */}
            <div className="space-y-6">
                {loading && <div className="text-center py-10 text-[#AEACA8] text-sm">Đang tải bảng tin...</div>}
                
                {!loading && posts.length === 0 && (
                    <div className="text-center py-12 bg-white rounded-2xl border border-[#E9E9E7]">
                        <MessageCircle className="w-10 h-10 text-[#E9E9E7] mx-auto mb-3" />
                        <p className="text-[#787774] text-sm font-medium">Chưa có bài thảo luận nào.</p>
                        <p className="text-[#AEACA8] text-xs mt-1">Hãy đăng câu hỏi đầu tiên của bạn!</p>
                    </div>
                )}

                {posts.map(post => (
                    <div key={post.id} className="bg-white rounded-2xl border border-[#E9E9E7] shadow-sm overflow-hidden">
                        {/* Post Header */}
                        <div className="p-5 pb-3 flex gap-3">
                            <div
                                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                                style={{ background: getAvatarColor(post.author_name) }}
                            >
                                {post.author_name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-bold text-[15px] text-[#1A1A1A]">{post.author_name}</h4>
                                    {isAdmin && (
                                        <button onClick={() => handleDeletePost(post.id)} className="text-[#AEACA8] hover:text-[#E03E3E] transition-colors p-1">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                                <p className="text-xs text-[#AEACA8] font-medium">{timeAgo(post.created_at)}</p>
                            </div>
                        </div>

                        {/* Post Content */}
                        <div className="px-5 pb-3">
                            <p className="text-[15px] text-[#1A1A1A] whitespace-pre-wrap leading-relaxed">
                                {post.text}
                            </p>
                            {post.image_url && (
                                <div className="mt-3 rounded-xl overflow-hidden border border-[#E9E9E7]">
                                    <img src={post.image_url} alt="Post image" className="w-full h-auto" loading="lazy" />
                                </div>
                            )}
                        </div>

                        {/* Post Footer / Actions */}
                        <div className="px-5 py-3 border-t border-[#F0F0EE] flex items-center gap-4">
                            <button
                                onClick={() => setExpandedPostId(expandedPostId === post.id ? null : post.id)}
                                className="flex items-center gap-1.5 text-sm font-semibold transition-colors"
                                style={{ color: expandedPostId === post.id ? '#6B7CDB' : '#787774' }}
                            >
                                <MessageCircle className="w-4 h-4" />
                                {expandedPostId === post.id ? 'Thu gọn' : 'Bình luận'}
                            </button>
                        </div>

                        {/* Nested Comments (The Facebook trick) */}
                        {expandedPostId === post.id && (
                            <div className="px-5 py-4 bg-[#FAFAF9] border-t border-[#E9E9E7]">
                                <ExamCommentSection
                                    hideHeader
                                    examId={post.id}
                                    examTitle={`Bình luận bài của ${post.author_name}`}
                                    isAdmin={isAdmin}
                                    adminKey={adminKey}
                                />
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ForumFeed;
