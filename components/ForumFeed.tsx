import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Image as ImageIcon, Trash2, User, Check, Send, Share2, ThumbsUp } from 'lucide-react';
import { ExamComment } from '../types';
import { fetchComments, postComment, deleteComment, uploadCommentImage, getNickname, saveNickname } from '../src/services/commentService';
import ExamCommentSection from './ExamCommentSection';
import { useUIStore } from '../src/stores/useUIStore';

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

// ── Helpers Parsing ─────────────────────────────────────────────
const parsePostContent = (raw: string) => {
    try {
        const obj = JSON.parse(raw);
        if (obj.t && obj.c) return { title: obj.t, content: obj.c };
        return { title: 'Không có tiêu đề', content: raw };
    } catch {
        const titleExtract = raw.length > 50 ? raw.substring(0, 50) + '...' : raw;
        return { title: titleExtract, content: raw };
    }
};
const buildPostContent = (title: string, content: string) => JSON.stringify({ t: title.trim(), c: content.trim() });

// ── Single Topic Item Component ─────────────────────────────────
const ThreadListItem: React.FC<{ post: ExamComment; onClick: () => void }> = ({ post, onClick }) => {
    const { title } = parsePostContent(post.text);
    const [replyCount, setReplyCount] = useState<number | null>(null);
    const [lastActivity, setLastActivity] = useState<number>(post.created_at);

    useEffect(() => {
        let isMounted = true;
        fetchComments(post.id).then(data => {
            if (isMounted) {
                setReplyCount(data.length);
                if (data.length > 0) setLastActivity(Math.max(...data.map(c => c.created_at)));
            }
        }).catch(() => {});
        return () => { isMounted = false; };
    }, [post.id]);

    return (
        <div onClick={onClick} className="flex gap-4 p-4 border-b border-[#E9E9E7] hover:bg-[#F3F4F6] cursor-pointer transition-colors group bg-white">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-[19px] font-medium text-white shrink-0 shadow-sm" style={{ background: getAvatarColor(post.author_name) }}>
                {post.author_name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                     {post.image_url && (
                         <span className="px-2 py-0.5 bg-[#FEF9C3] text-[#A16207] text-[11px] font-semibold rounded shrink-0">
                            Video + ảnh
                         </span>
                     )}
                     <h3 className="font-semibold text-[16px] text-[#1877F2] group-hover:underline break-words">{title}</h3>
                </div>
                <div className="text-[13px] text-[#65676B] flex items-center gap-1.5 font-medium">
                    <span>{post.author_name}</span>
                    <span>·</span>
                    <span>Góc học tập</span>
                </div>
                <div className="text-[13px] text-[#8E8D8A] mt-1 flex items-center gap-1.5">
                    <span>Trả lời: {replyCount !== null ? replyCount : '...'}</span>
                    <span>·</span>
                    <span>{timeAgo(lastActivity)}</span>
                </div>
            </div>
        </div>
    );
};

const ForumFeed: React.FC<ForumFeedProps> = ({ isAdmin, adminKey }) => {
    const [posts, setPosts] = useState<ExamComment[]>([]);
    const [loading, setLoading] = useState(true);
    
    // View state
    const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

    const setForumTopicActive = useUIStore(state => state.setForumTopicActive);

    useEffect(() => {
        setForumTopicActive(activeThreadId !== null);
        return () => setForumTopicActive(false);
    }, [activeThreadId, setForumTopicActive]);

    // Composer state
    const [titleStr, setTitleStr] = useState('');
    const [text, setText] = useState('');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

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
        if (!titleStr.trim()) { setError('Vui lòng nhập tiêu đề!'); return; }
        if (!text.trim() && !imageFile) { setError('Vui lòng điền nội dung!'); return; }
        if (!nickname) { setEditingNickname(true); setError('Vui lòng đặt tên hiển thị trước'); return; }
        
        setError('');
        setSubmitting(true);
        try {
            let imageUrl: string | undefined;
            if (imageFile) imageUrl = await uploadCommentImage(imageFile);
            
            const encoded = buildPostContent(titleStr, text);
            const newPost = await postComment('GLOBAL_FORUM', encoded, imageUrl);
            setPosts(prev => [newPost, ...prev]);
            setTitleStr('');
            setText('');
            removeImage();
            setActiveThreadId(newPost.id); // View thread immediately
        } catch (err: any) {
            setError(err.message || 'Lỗi tạo chủ đề');
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

    // ── THREAD DETAIL VIEW ──
    const activeThread = activeThreadId ? posts.find(p => p.id === activeThreadId) : null;
    if (activeThread) {
        const { title, content } = parsePostContent(activeThread.text);
        return (
            <div className="w-full mx-auto pb-20 animate-fade-in shadow-sm rounded-lg bg-white min-h-screen">
                {/* Header Back Button */}
                <div className="p-4 bg-[#23497c] flex items-center shadow-md sticky top-0 z-50">
                    <button onClick={() => setActiveThreadId(null)} className="text-white text-sm font-semibold flex items-center gap-1 hover:underline">
                        ← Góc học tập
                    </button>
                </div>

                <div className="mb-6 pt-2">
                    <h1 className="text-[24px] md:text-[26px] font-bold text-[#1A1A1A] mb-1">{title}</h1>
                    <div className="flex items-center gap-1.5 text-[13px] text-[#8C8C8C]">
                        <span className="font-bold text-[#185886] hover:underline cursor-pointer">{activeThread.author_name}</span>
                        <span className="opacity-60">·</span>
                        <span>{new Date(activeThread.created_at).toLocaleDateString('vi-VN')} lúc {new Date(activeThread.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                </div>

                    {/* Original Post Content (Post #1) */}
                    <div className="flex border border-[#E5E7EB] mb-4 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.05)] rounded-lg overflow-hidden transition-all hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
                        {/* Left Profile Column */}
                        <div className="w-[120px] md:w-[150px] p-4 flex flex-col items-center bg-white shrink-0 border-r border-[#E5E7EB]">
                            <div className="w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center text-white text-[24px] font-bold mb-2" style={{ background: getAvatarColor(activeThread.author_name) }}>
                                {activeThread.author_name.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-[13px] font-bold text-[#185886] hover:underline cursor-pointer text-center w-full break-words">{activeThread.author_name}</span>
                            <span className="text-[11px] text-[#8C8C8C] mt-1 text-center">Người đăng</span>
                        </div>

                        {/* Right Content Column */}
                        <div className="flex-1 min-w-0 flex flex-col bg-white">
                            {/* Header */}
                            <div className="flex items-center justify-between px-3 py-2 border-b border-[#F0F0F0] text-[12px] text-[#8C8C8C]">
                                <span>{new Date(activeThread.created_at).toLocaleDateString('vi-VN')}</span>
                                <div className="flex items-center gap-3">
                                   <button className="hover:text-[#185886]" title="Chia sẻ"><Share2 className="w-3.5 h-3.5" /></button>
                                   <span className="font-semibold">#1</span>
                                </div>
                            </div>

                            {/* Body */}
                            <div className="p-4 flex-1">
                                <p className="text-[15px] leading-relaxed text-[#141414] whitespace-pre-wrap font-sans">{content}</p>
                                {activeThread.image_url && (
                                    <div className="mt-4 border-t border-dashed border-[#E5E5E5] pt-4">
                                        <img src={activeThread.image_url} className="max-h-[500px] object-cover" />
                                    </div>
                                )}
                            </div>

                            {/* Footer / Reactions (Removed) */}

                            {isAdmin && (
                                <div className="px-4 pb-3">
                                    <button onClick={() => { handleDeletePost(activeThread.id); setActiveThreadId(null); }} className="text-[11px] font-bold text-red-500 hover:underline">
                                        [Xóa Topic]
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                {/* Replies Thread */}
                <div className="bg-transparent flex flex-col">
                    <ExamCommentSection
                        examId={activeThread.id}
                        examTitle={title}
                        isAdmin={isAdmin}
                        adminKey={adminKey}
                        hideHeader={true}
                    />
                </div>
            </div>
        );
    }

    // ── THREAD LIST VIEW ──
    return (
        <div className="w-full mx-auto pb-20 animate-fade-in bg-white rounded-xl shadow-sm border border-[#E9E9E7] overflow-hidden">
            {/* Header */}
            <div className="bg-[#23497c] px-4 py-3 text-white font-bold text-[16px] shadow-sm flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-white" />
                Diễn đàn Thảo Luận
            </div>

            {/* Create Topic Area */}
            <div className="p-5 border-b-[4px] border-[#F0F2F5] bg-[#FAFAF9]">
                <h2 className="text-[#1A1A1A] font-bold text-[15px] mb-3">Tạo chủ đề mới</h2>
                {/* Nickname Input */}
                <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-[#E9E9E7] mb-3 max-w-sm">
                    <User className="w-4 h-4 text-[#AEACA8]" />
                    {editingNickname ? (
                        <div className="flex gap-2 flex-1">
                            <input autoFocus type="text" value={nicknameInput} onChange={e => setNicknameInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSaveNickname()} placeholder="Tên hiển thị..." maxLength={30} className="flex-1 text-sm bg-transparent outline-none" />
                            <button onClick={handleSaveNickname} className="text-xs font-semibold px-2 py-1 bg-[#1A1A1A] text-white rounded">Lưu</button>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-between">
                            <span className="text-sm font-semibold text-[#1A1A1A]">{nickname}</span>
                            <button onClick={() => setEditingNickname(true)} className="text-[11px] font-medium text-[#6B7CDB] hover:underline">Đổi tên</button>
                        </div>
                    )}
                </div>

                <input
                    type="text"
                    value={titleStr}
                    onChange={e => setTitleStr(e.target.value)}
                    placeholder="Tiêu đề thảo luận..."
                    className="w-full px-3 py-2 text-sm border border-[#E9E9E7] rounded-lg mb-2 outline-none font-bold placeholder-[#AEACA8] focus:border-[#23497c]"
                />
                <textarea
                    value={text}
                    onChange={e => setText(e.target.value)}
                    placeholder="Nội dung chuyên sâu..."
                    className="w-full resize-none outline-none p-3 text-[14px] min-h-[80px] bg-white border border-[#E9E9E7] rounded-lg focus:border-[#23497c]"
                />

                {imagePreview && (
                    <div className="relative inline-block mt-2">
                        <img src={imagePreview} className="rounded border border-[#E9E9E7] max-h-32" />
                        <button onClick={removeImage} className="absolute -top-2 -right-2 w-5 h-5 bg-black text-white rounded-full flex items-center justify-center font-bold text-xs hover:bg-red-500">×</button>
                    </div>
                )}

                {error && <p className="text-xs text-[#E03E3E] mt-2 font-medium">{error}</p>}

                <div className="flex items-center justify-between mt-3">
                    <div className="relative">
                        <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageChange} className="hidden" />
                        <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1 px-3 py-1.5 rounded bg-white border border-[#E9E9E7] text-xs font-semibold text-[#57564F] hover:bg-[#F0F2F5]">
                            <ImageIcon className="w-3.5 h-3.5 text-[#A16207]" />
                            Chèn ảnh
                        </button>
                    </div>
                    <button onClick={handleSubmitPost} disabled={submitting || (!titleStr.trim())} className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-[#23497c] text-xs font-bold text-white disabled:opacity-50 hover:bg-[#1e3f6b]">
                        {submitting ? 'Đang tạo...' : 'Đăng bài'}
                        <Send className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* Topic List */}
            <div className="bg-[#E5E7EB] h-1" /> {/* Divider */}
            <div>
                {loading && <div className="text-center py-10 text-[#AEACA8] text-sm">Đang tải danh sách...</div>}
                {!loading && posts.length === 0 && (
                    <div className="text-center py-12">
                        <p className="text-[#AEACA8] text-sm font-medium">Chưa có bài thảo luận nào.</p>
                    </div>
                )}
                {posts.map(post => (
                    <ThreadListItem key={post.id} post={post} onClick={() => setActiveThreadId(post.id)} />
                ))}
            </div>
        </div>
    );
};

export default ForumFeed;
