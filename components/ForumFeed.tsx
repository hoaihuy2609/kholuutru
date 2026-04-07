import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    MessageCircle, Image as ImageIcon, Trash2, User, Send, Share2,
    ThumbsUp, CheckCircle, Pin, ChevronLeft, RefreshCw, AlertCircle,
    Pencil, X, Image, BookOpen, FlameKindling, Search
} from 'lucide-react';
import { ExamComment } from '../types';
import {
    fetchComments, postComment, deleteComment,
    uploadCommentImage, getNickname, saveNickname
} from '../src/services/commentService';
import { useUIStore } from '../src/stores/useUIStore';
import { CURRICULUM } from '../constants';

// ── Constants ──────────────────────────────────────────────────────
const NAVY = '#23497c';
const NAVY_LIGHT = '#EEF2F8';
const BORDER = '#E9E9E7';
const BG_WARM = '#F7F6F3';
const TEXT_PRIMARY = '#1A1A1A';
const TEXT_SECONDARY = '#787774';
const TEXT_MUTED = '#AEACA8';
const ACCENT_BLUE = '#6B7CDB';
const ACCENT_BLUE_LIGHT = '#EEF0FB';
const ACCENT_GREEN = '#448361';
const ACCENT_GREEN_LIGHT = '#EAF3EE';
const REPLIES_PER_PAGE = 10;

const CATEGORIES = [
    { id: 'all', label: 'Tất cả', icon: null },
    { id: 'chung', label: 'Chung', icon: null },
    { id: 'vl10', label: 'Vật lý 10', icon: null },
    { id: 'vl11', label: 'Vật lý 11', icon: null },
    { id: 'vl12', label: 'Vật lý 12', icon: null },
];

const CATEGORY_DOTS: Record<string, string> = {
    chung: NAVY,
    vl10: '#448361',
    vl11: '#6B7CDB',
    vl12: '#9065B0',
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
    chung:  { bg: '#EEF2F8', text: NAVY },
    vl10:   { bg: '#EAF3EE', text: '#448361' },
    vl11:   { bg: '#EEF0FB', text: '#6B7CDB' },
    vl12:   { bg: '#F3ECF8', text: '#9065B0' },
};

// ── Helpers ─────────────────────────────────────────────────────────
function timeAgo(ms: number): string {
    const diff = Date.now() - ms;
    if (diff < 60_000) return 'Vừa xong';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} phút trước`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} giờ trước`;
    return new Date(ms).toLocaleDateString('vi-VN');
}

function getAvatarColor(name: string): string {
    const colors = [ACCENT_BLUE, ACCENT_GREEN, '#D9730D', '#9065B0', '#E03E3E', '#0369A1'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
}

function getUserRank(postCount: number): string {
    if (postCount <= 2) return 'Thành viên mới';
    if (postCount <= 10) return 'Học viên';
    if (postCount <= 30) return 'Học viên tích cực';
    return 'Thành viên kỳ cựu';
}

// ── General topics for "Chung" category ─────────────────────────────
const GENERAL_TOPICS = [
    { id: 'general-method', name: 'Phương pháp học tập' },
    { id: 'general-exam',   name: 'Đề thi & Tài liệu' },
    { id: 'general-career', name: 'Tư vấn hướng nghiệp' },
    { id: 'general-qa',     name: 'Góc hỏi đáp' },
    { id: 'general-chat',   name: 'Tán gẫu' },
];

// ── Helper: resolve tag label from tagId ──────────────────────────────
function resolveTagLabel(tagId: string): string | null {
    if (!tagId) return null;
    // Check general topics first
    const gen = GENERAL_TOPICS.find(t => t.id === tagId);
    if (gen) return gen.name;
    // Check curriculum chapters
    for (const grade of CURRICULUM) {
        const ch = grade.chapters.find(c => c.id === tagId);
        if (ch) return ch.name;
    }
    return null;
}

// ── Post content encoding/decoding ──────────────────────────────────
interface PostMeta { title: string; content: string; category: string; tag: string; solved: boolean; pinned: boolean; }

const decodePost = (raw: string): PostMeta => {
    try {
        const obj = JSON.parse(raw);
        if (obj.t && obj.c) {
            return {
                title: obj.t,
                content: obj.c,
                category: obj.cat || 'chung',
                tag: obj.tag || '',
                solved: obj.solved ?? false,
                pinned: obj.pinned ?? false,
            };
        }
    } catch { /* fallthrough */ }
    return { title: raw.length > 60 ? raw.substring(0, 60) + '...' : raw, content: raw, category: 'chung', tag: '', solved: false, pinned: false };
};

const encodePost = (title: string, content: string, category: string, tag: string) =>
    JSON.stringify({ t: title.trim(), c: content.trim(), cat: category, tag, solved: false, pinned: false });

// ── Tag Badge ─────────────────────────────────────────────────────────
const TagBadge: React.FC<{ tagId: string }> = ({ tagId }) => {
    const label = resolveTagLabel(tagId);
    if (!label) return null;
    return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium shrink-0"
            style={{ background: '#F1F0EC', color: TEXT_SECONDARY, border: `1px solid ${BORDER}` }}>
            {label}
        </span>
    );
};

// ── Category Badge ──────────────────────────────────────────────────
const CategoryBadge: React.FC<{ catId: string }> = ({ catId }) => {
    const cat = CATEGORIES.find(c => c.id === catId && c.id !== 'all');
    if (!cat) return null;
    const colors = CATEGORY_COLORS[catId] || { bg: '#EEF2F8', text: NAVY };
    return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold shrink-0"
            style={{ background: colors.bg, color: colors.text }}>
            {cat.label}
        </span>
    );
};

// ── Avatar Component ────────────────────────────────────────────────
const Avatar: React.FC<{ name: string; size?: number }> = ({ name, size = 40 }) => (
    <div
        className="rounded-full flex items-center justify-center font-bold text-white shrink-0 shadow-sm"
        style={{ width: size, height: size, fontSize: size * 0.42, background: getAvatarColor(name) }}
    >
        {name.charAt(0).toUpperCase()}
    </div>
);

// ── Thread List Item ─────────────────────────────────────────────────
interface ThreadListItemProps {
    post: ExamComment;
    isAdmin: boolean;
    onClick: () => void;
    onDelete?: (id: string) => void;
    allPosts: ExamComment[];
}

const ThreadListItem: React.FC<ThreadListItemProps> = ({ post, isAdmin, onClick, onDelete, allPosts }) => {
    const { title, category, tag, solved, pinned } = decodePost(post.text);
    const [replyCount, setReplyCount] = useState<number | null>(null);
    const [lastActivity, setLastActivity] = useState<number>(post.created_at);
    const [lastReplier, setLastReplier] = useState<string>('');

    useEffect(() => {
        let alive = true;
        fetchComments(post.id).then(data => {
            if (!alive) return;
            setReplyCount(data.length);
            if (data.length > 0) {
                const sorted = [...data].sort((a, b) => b.created_at - a.created_at);
                setLastActivity(sorted[0].created_at);
                setLastReplier(sorted[0].author_name);
            }
        }).catch(() => {});
        return () => { alive = false; };
    }, [post.id]);

    // Count how many posts author has made across all posts
    const authorPostCount = allPosts.filter(p => p.author_name === post.author_name).length;

    return (
        <div
            className="flex items-stretch gap-0 cursor-pointer group transition-all"
            style={{ background: '#FFFFFF', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: `1px solid ${BORDER}`, marginBottom: 6 }}
            onClick={onClick}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 3px 12px rgba(0,0,0,0.08)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'}
        >
            {/* Left accent for pinned */}
            {pinned && <div className="w-1 shrink-0" style={{ background: '#D9730D', borderRadius: '12px 0 0 12px' }} />}

            <div className="flex-1 flex items-center gap-4 px-5 py-4">
                {/* Avatar */}
                <Avatar name={post.author_name} size={40} />

                {/* Main content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                        {pinned && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                                style={{ background: '#FEF3C7', color: '#B45309' }}>
                                <Pin className="w-3 h-3" /> Ghim
                            </span>
                        )}
                        <CategoryBadge catId={category} />
                        {tag && <TagBadge tagId={tag} />}
                        {solved && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                                style={{ background: ACCENT_GREEN_LIGHT, color: ACCENT_GREEN }}>
                                <CheckCircle className="w-3 h-3" /> Đã giải đáp
                            </span>
                        )}
                    </div>
                    <h3 className="font-semibold text-[15px] group-hover:text-blue-700 truncate mt-0.5 transition-colors"
                        style={{ color: NAVY }}>
                        {title}
                    </h3>
                    <div className="text-[12px] flex items-center gap-1.5 mt-1" style={{ color: TEXT_SECONDARY }}>
                        <span className="font-medium" style={{ color: TEXT_PRIMARY }}>{post.author_name}</span>
                        <span style={{ color: TEXT_MUTED }}>·</span>
                        <span>{timeAgo(post.created_at)}</span>
                        {replyCount !== null && replyCount > 0 && (
                            <>
                                <span style={{ color: TEXT_MUTED }}>·</span>
                                <span className="inline-flex items-center gap-1" style={{ color: NAVY }}>
                                    <MessageCircle className="w-3 h-3" /> {replyCount}
                                </span>
                            </>
                        )}
                    </div>
                </div>

                {/* Stats columns */}
                <div className="hidden md:flex items-center gap-6 shrink-0">
                    {/* Last activity */}
                    <div className="text-right min-w-[100px]">
                        {lastReplier ? (
                            <>
                                <div className="text-[12px] font-medium truncate" style={{ color: TEXT_PRIMARY }}>{lastReplier}</div>
                                <div className="text-[11px]" style={{ color: TEXT_MUTED }}>{timeAgo(lastActivity)}</div>
                            </>
                        ) : (
                            <div className="text-[11px]" style={{ color: TEXT_MUTED }}>{timeAgo(post.created_at)}</div>
                        )}
                    </div>
                </div>

                {/* Admin delete */}
                {isAdmin && (
                    <button
                        onClick={e => { e.stopPropagation(); onDelete?.(post.id); }}
                        className="hidden group-hover:flex items-center justify-center w-7 h-7 rounded-md transition-colors shrink-0"
                        style={{ color: '#E03E3E' }}
                        title="Xóa chủ đề"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                )}
            </div>
        </div>
    );
};

// ── Reply Item (VOZ 2-column style) ─────────────────────────────────
interface ReplyItemProps {
    comment: ExamComment;
    index: number;
    isAdmin: boolean;
    adminKey?: string;
    authorAllRepliesCount: number;
    onDelete: (id: string) => void;
}

const ReplyItem: React.FC<ReplyItemProps> = ({ comment, index, isAdmin, adminKey, authorAllRepliesCount, onDelete }) => {
    const isAdminUser = comment.author_name === 'Admin' || comment.author_name.toLowerCase() === 'admin';
    const rank = isAdminUser ? 'Giảng viên' : getUserRank(authorAllRepliesCount);

    return (
        <div
            className="overflow-hidden transition-all"
            style={{ background: '#FFFFFF', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', border: `1px solid ${BORDER}` }}
        >
            {/* Comment header row */}
            <div className="flex items-center gap-3 px-4 py-3" style={{ background: '#FAFAF9', borderBottom: `1px solid ${BORDER}` }}>
                <Avatar name={comment.author_name} size={34} />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-[13px] font-bold" style={{ color: NAVY }}>{comment.author_name}</span>
                        {isAdminUser && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white" style={{ background: NAVY }}>Giảng viên</span>
                        )}
                        {!isAdminUser && (
                            <span className="text-[11px]" style={{ color: TEXT_MUTED }}>{rank}</span>
                        )}
                    </div>
                    <div className="text-[11px]" style={{ color: TEXT_MUTED }}>
                        {new Date(comment.created_at).toLocaleDateString('vi-VN')} lúc {new Date(comment.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        <span className="mx-1">·</span>
                        {authorAllRepliesCount} bài viết
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[12px] font-semibold" style={{ color: TEXT_MUTED }}>#{index + 2}</span>
                </div>
            </div>

            {/* Body */}
            <div className="px-5 py-4">
                <p className="text-[15px] leading-relaxed whitespace-pre-wrap" style={{ color: TEXT_PRIMARY }}>
                    {comment.text}
                </p>
                {comment.image_url && (
                    <div className="mt-4">
                        <img
                            src={comment.image_url}
                            alt="Ảnh đính kèm"
                            className="max-h-[400px] rounded-xl object-contain"
                            loading="lazy"
                        />
                    </div>
                )}
            </div>

            {/* Footer actions */}
            <div className="flex items-center gap-4 px-5 py-2.5 text-[12px]" style={{ color: TEXT_MUTED, borderTop: `1px solid #F0F0EE` }}>
                <button className="flex items-center gap-1 hover:text-green-600 transition-colors font-medium p-1 rounded-md"
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F0FFF4'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                    <ThumbsUp className="w-3.5 h-3.5" /> Hữu ích
                </button>
                {isAdmin && (
                    <button
                        onClick={() => onDelete(comment.id)}
                        className="ml-auto font-semibold transition-colors hover:underline"
                        style={{ color: '#E03E3E' }}
                    >
                        Xóa
                    </button>
                )}
            </div>
        </div>
    );
};

// ── Composer (shared) ───────────────────────────────────────────────
interface ComposerProps {
    placeholder: string;
    buttonLabel: string;
    onSubmit: (text: string, imageFile: File | null) => Promise<void>;
    compact?: boolean;
}

const Composer: React.FC<ComposerProps> = ({ placeholder, buttonLabel, onSubmit, compact = false }) => {
    const [text, setText] = useState('');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const fileRef = useRef<HTMLInputElement>(null);

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
        if (fileRef.current) fileRef.current.value = '';
    };

    const handleSubmit = async () => {
        if (!text.trim() && !imageFile) return;
        setSubmitting(true);
        setError('');
        try {
            await onSubmit(text, imageFile);
            setText('');
            removeImage();
        } catch (err: any) {
            setError(err.message || 'Có lỗi xảy ra');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div>
            <div className="rounded-xl overflow-hidden border" style={{ borderColor: error ? '#E03E3E' : BORDER }}>
                <textarea
                    value={text}
                    onChange={e => { setText(e.target.value); setError(''); }}
                    onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSubmit(); }}
                    placeholder={placeholder}
                    rows={compact ? 3 : 4}
                    className="w-full resize-none outline-none px-4 pt-3 pb-2 text-[14px]"
                    style={{ background: BG_WARM, color: TEXT_PRIMARY }}
                />
                {imagePreview && (
                    <div className="px-4 pb-2 relative inline-block">
                        <img src={imagePreview} className="max-h-32 rounded-lg border object-cover" style={{ borderColor: BORDER }} />
                        <button onClick={removeImage} className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
                            <X className="w-3 h-3 text-white" />
                        </button>
                    </div>
                )}
                <div className="flex items-center justify-between px-3 py-2 border-t" style={{ borderColor: BORDER, background: '#F1F0EC' }}>
                    <div className="flex gap-1">
                        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                        <button
                            onClick={() => fileRef.current?.click()}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                            style={{ color: TEXT_SECONDARY }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#E9E9E7'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                        >
                            <Image className="w-3.5 h-3.5" /> Đính kèm ảnh
                        </button>
                    </div>
                    <button
                        onClick={handleSubmit}
                        disabled={submitting || (!text.trim() && !imageFile)}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 disabled:opacity-50"
                        style={{ background: NAVY, color: '#fff' }}
                    >
                        {submitting ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Đang gửi...</> : <><Send className="w-3.5 h-3.5" /> {buttonLabel}</>}
                    </button>
                </div>
            </div>
            {error && (
                <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg mt-2" style={{ background: '#FEF0F0', color: '#E03E3E', border: '1px solid #FECACA' }}>
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
                </div>
            )}
        </div>
    );
};

// ── Nickname Bar ─────────────────────────────────────────────────────
const NicknameBar: React.FC = () => {
    const [nickname, setNickname] = useState(getNickname);
    const [editing, setEditing] = useState(false);
    const [input, setInput] = useState(nickname);

    const save = () => {
        const t = input.trim();
        if (!t) return;
        saveNickname(t);
        setNickname(t);
        setEditing(false);
    };

    return (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border" style={{ background: '#FFFFFF', borderColor: BORDER }}>
            <User className="w-4 h-4 shrink-0" style={{ color: TEXT_MUTED }} />
            {editing ? (
                <div className="flex gap-2 flex-1">
                    <input
                        autoFocus type="text" value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && save()}
                        placeholder="Tên hiển thị..." maxLength={30}
                        className="flex-1 text-sm outline-none bg-transparent"
                        style={{ color: TEXT_PRIMARY }}
                    />
                    <button onClick={save} className="text-xs font-semibold px-3 py-1 rounded-lg"
                        style={{ background: NAVY, color: '#fff' }}>Lưu</button>
                    <button onClick={() => { setEditing(false); setInput(nickname); }}
                        className="text-xs px-2 py-1 rounded-lg" style={{ color: TEXT_SECONDARY }}>Hủy</button>
                </div>
            ) : (
                <div className="flex items-center gap-2 flex-1">
                    <span className="text-sm font-medium" style={{ color: nickname ? TEXT_PRIMARY : TEXT_MUTED }}>
                        {nickname || 'Chưa đặt tên hiển thị'}
                    </span>
                    <button onClick={() => { setEditing(true); setInput(nickname); }}
                        className="ml-auto p-1 rounded-md transition-colors"
                        title="Đổi tên hiển thị" style={{ color: TEXT_MUTED }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F1F0EC'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                        <Pencil className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}
        </div>
    );
};

// ── Main Component ──────────────────────────────────────────────────
interface ForumFeedProps { isAdmin: boolean; adminKey?: string; }

const ForumFeed: React.FC<ForumFeedProps> = ({ isAdmin, adminKey }) => {
    const [posts, setPosts] = useState<ExamComment[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
    const [activeCategory, setActiveCategory] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [showComposer, setShowComposer] = useState(false);
    const setForumTopicActive = useUIStore(state => state.setForumTopicActive);

    // New post state
    const [newTitle, setNewTitle] = useState('');
    const [newCategory, setNewCategory] = useState('chung');
    const [newTag, setNewTag] = useState('');
    const [composerError, setComposerError] = useState('');
    const [creating, setCreating] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);
    const [newImageFile, setNewImageFile] = useState<File | null>(null);
    const [newImagePreview, setNewImagePreview] = useState<string | null>(null);
    const [newContent, setNewContent] = useState('');

    useEffect(() => {
        setForumTopicActive(activeThreadId !== null);
        return () => setForumTopicActive(false);
    }, [activeThreadId, setForumTopicActive]);

    useEffect(() => {
        setLoading(true);
        fetchComments('GLOBAL_FORUM')
            .then(data => setPosts(data.sort((a, b) => b.created_at - a.created_at)))
            .catch(() => setPosts([]))
            .finally(() => setLoading(false));
    }, []);

    const handleDeletePost = async (postId: string) => {
        if (!window.confirm('Xóa chủ đề này?')) return;
        try {
            await deleteComment(postId, adminKey || '');
            setPosts(prev => prev.filter(p => p.id !== postId));
            if (activeThreadId === postId) setActiveThreadId(null);
        } catch (err: any) { alert('Lỗi xóa: ' + err.message); }
    };

    const handleCreatePost = async () => {
        if (!newTitle.trim()) { setComposerError('Vui lòng nhập tiêu đề!'); return; }
        if (!newContent.trim() && !newImageFile) { setComposerError('Vui lòng nhập nội dung!'); return; }
        if (!newTag) { setComposerError('Vui lòng chọn chủ đề / chương!'); return; }
        const nick = getNickname();
        if (!nick) { setComposerError('Vui lòng đặt tên hiển thị trước khi đăng bài!'); return; }
        setComposerError('');
        setCreating(true);
        try {
            let imageUrl: string | undefined;
            if (newImageFile) imageUrl = await uploadCommentImage(newImageFile);
            const encoded = encodePost(newTitle, newContent, newCategory, newTag);
            const newPost = await postComment('GLOBAL_FORUM', encoded, imageUrl);
            setPosts(prev => [newPost, ...prev]);
            setNewTitle('');
            setNewContent('');
            setNewCategory('chung');
            setNewTag('');
            setNewImageFile(null);
            if (newImagePreview) URL.revokeObjectURL(newImagePreview);
            setNewImagePreview(null);
            setShowComposer(false);
            setActiveThreadId(newPost.id);
        } catch (err: any) {
            setComposerError(err.message || 'Lỗi tạo chủ đề');
        } finally {
            setCreating(false);
        }
    };

    // Helpers: get available tags for current category in composer
    const getTagsForCategory = (cat: string) => {
        if (cat === 'chung') return GENERAL_TOPICS.map(t => ({ id: t.id, name: t.name }));
        const catMap: Record<string, string> = { vl10: 'Vật Lý 10', vl11: 'Vật Lý 11', vl12: 'Vật Lý 12' };
        const grade = CURRICULUM.find(g => g.title === catMap[cat]);
        return grade ? grade.chapters.map(c => ({ id: c.id, name: c.name })) : [];
    };

    const filteredPosts = posts.filter(p => {
        const { category, title, content } = decodePost(p.text);
        // Filter by category tab
        if (activeCategory !== 'all' && category !== activeCategory) return false;
        // Filter by search query
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const inTitle = title.toLowerCase().includes(q);
            const inContent = content.toLowerCase().includes(q);
            const inAuthor = p.author_name.toLowerCase().includes(q);
            if (!inTitle && !inContent && !inAuthor) return false;
        }
        return true;
    });

    // ── Thread Detail View ───────────────────────────────────────────
    if (activeThreadId) {
        const activeThread = posts.find(p => p.id === activeThreadId);
        if (!activeThread) { setActiveThreadId(null); return null; }
        const { title, content, category, solved, pinned } = decodePost(activeThread.text);
        const isAdminAuthor = activeThread.author_name === 'Admin' || activeThread.author_name.toLowerCase() === 'admin';
        const authorPostCount = posts.filter(p => p.author_name === activeThread.author_name).length;
        const rank = isAdminAuthor ? 'Giảng viên' : getUserRank(authorPostCount);

        return <ThreadDetail
            thread={activeThread}
            title={title}
            content={content}
            category={category}
            solved={solved}
            isAdmin={isAdmin}
            adminKey={adminKey}
            rank={rank}
            isAdminAuthor={isAdminAuthor}
            authorPostCount={authorPostCount}
            onBack={() => setActiveThreadId(null)}
            onDeletePost={handleDeletePost}
        />;
    }

    // ── Thread List View ─────────────────────────────────────────────
    return (
        <div className="w-full mx-auto pb-20 animate-fade-in">
            {/* ── Control Bar: Category tabs + Search + New post button ────── */}
            <div className="flex flex-col gap-2 py-3">
                {/* Row 1: Category tabs + New post button */}
                <div className="flex items-center justify-between gap-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                    <div className="flex items-center p-1 rounded-xl shrink-0" style={{ background: '#F1F0EC' }}>
                        {CATEGORIES.map(cat => {
                            const isActive = activeCategory === cat.id;
                            const dot = CATEGORY_DOTS[cat.id];
                            const activeColor = cat.id === 'all' ? NAVY : CATEGORY_DOTS[cat.id];
                            return (
                                <button
                                    key={cat.id}
                                    onClick={() => setActiveCategory(cat.id)}
                                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[13px] font-semibold whitespace-nowrap transition-all shrink-0"
                                    style={{
                                        background: isActive ? '#FFFFFF' : 'transparent',
                                        color: isActive ? activeColor : TEXT_SECONDARY,
                                        boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                    }}
                                >
                                    {dot && (
                                        <span
                                            style={{
                                                width: 6, height: 6, borderRadius: '50%',
                                                background: isActive ? dot : '#AEACA8',
                                                display: 'inline-block', flexShrink: 0,
                                                transition: 'background 0.2s'
                                            }}
                                        />
                                    )}
                                    {cat.label}
                                </button>
                            );
                        })}
                    </div>
                    <button
                        onClick={() => setShowComposer(v => !v)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-semibold transition-all shrink-0"
                        style={{
                            background: showComposer ? NAVY : '#FFFFFF',
                            color: showComposer ? '#FFFFFF' :  NAVY,
                            border: `1px solid ${NAVY}`,
                            boxShadow: showComposer ? '0 2px 8px rgba(35,73,124,0.2)' : 'none',
                        }}
                        onMouseEnter={e => { if (!showComposer) { (e.currentTarget as HTMLElement).style.background = NAVY_LIGHT; } }}
                        onMouseLeave={e => { if (!showComposer) { (e.currentTarget as HTMLElement).style.background = '#FFFFFF'; } }}
                    >
                        <Pencil className="w-3.5 h-3.5" />
                        Tạo chủ đề
                    </button>
                </div>
                {/* Row 2: Search bar */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: TEXT_MUTED }} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Tìm kiếm bài viết, tiêu đề, người đăng..."
                        className="w-full pl-9 pr-4 py-2 rounded-xl text-[13px] outline-none transition-all"
                        style={{ background: '#FFFFFF', border: `1px solid ${BORDER}`, color: TEXT_PRIMARY }}
                        onFocus={e => (e.currentTarget.style.borderColor = NAVY)}
                        onBlur={e => (e.currentTarget.style.borderColor = BORDER)}
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full"
                            style={{ color: TEXT_MUTED }}
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* ── Composer (collapsible) ──────────────────────────────────── */}
            {showComposer && (
                <div className="rounded-2xl p-5 mb-4 animate-fade-in" style={{ background: '#FFFFFF', border: `1px solid ${BORDER}`, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-bold text-[15px]" style={{ color: TEXT_PRIMARY }}>✏️ Tạo chủ đề mới</h2>
                        <button onClick={() => { setShowComposer(false); setComposerError(''); }}
                            className="p-1.5 rounded-lg transition-colors" style={{ color: TEXT_MUTED }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F1F0EC'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Nickname inline */}
                    <div className="mb-3"><NicknameBar /></div>

                    {/* Category selector */}
                    <div className="flex flex-wrap gap-2 mb-3">
                        {CATEGORIES.filter(c => c.id !== 'all').map(cat => {
                            const colors = CATEGORY_COLORS[cat.id];
                            const dot = CATEGORY_DOTS[cat.id];
                            const isSelected = newCategory === cat.id;
                            return (
                                <button
                                    key={cat.id}
                                    onClick={() => { setNewCategory(cat.id); setNewTag(''); }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all"
                                    style={{
                                        background: isSelected ? colors.bg : 'transparent',
                                        color: isSelected ? colors.text : TEXT_SECONDARY,
                                        border: `1px solid ${isSelected ? colors.text + '40' : BORDER}`,
                                    }}
                                >
                                    {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot, display: 'inline-block', flexShrink: 0 }} />}
                                    {cat.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Tag / Chapter selector */}
                    <div className="mb-3">
                        <p className="text-[11px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: TEXT_MUTED }}>
                            {newCategory === 'chung' ? 'Chủ đề' : 'Chương'}
                        </p>
                        <div className="flex flex-wrap gap-1.5" style={{ maxHeight: 120, overflowY: 'auto', scrollbarWidth: 'thin' }}>
                            {getTagsForCategory(newCategory).map(tag => (
                                <button
                                    key={tag.id}
                                    onClick={() => setNewTag(tag.id)}
                                    className="px-2.5 py-1 rounded-lg text-[12px] font-medium transition-all"
                                    style={{
                                        background: newTag === tag.id ? NAVY : '#F1F0EC',
                                        color: newTag === tag.id ? '#FFFFFF' : TEXT_SECONDARY,
                                        border: `1px solid ${newTag === tag.id ? NAVY : BORDER}`,
                                    }}
                                >
                                    {tag.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Title */}
                    <input
                        type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)}
                        placeholder="Tiêu đề thảo luận..."
                        className="w-full px-4 py-3 text-[14px] rounded-xl mb-2.5 outline-none font-semibold placeholder-[#AEACA8] transition-all"
                        style={{ background: BG_WARM, color: TEXT_PRIMARY, border: `1.5px solid transparent` }}
                        onFocus={e => e.currentTarget.style.borderColor = NAVY}
                        onBlur={e => e.currentTarget.style.borderColor = 'transparent'}
                    />

                    {/* Content */}
                    <textarea
                        value={newContent} onChange={e => setNewContent(e.target.value)}
                        placeholder="Mô tả câu hỏi hoặc nội dung thảo luận..."
                        className="w-full resize-none outline-none px-4 py-3 text-[14px] rounded-xl min-h-[100px] transition-all"
                        style={{ background: BG_WARM, color: TEXT_PRIMARY, border: `1.5px solid transparent` }}
                        onFocus={e => e.currentTarget.style.borderColor = NAVY}
                        onBlur={e => e.currentTarget.style.borderColor = 'transparent'}
                    />

                    {/* Image preview */}
                    {newImagePreview && (
                        <div className="relative inline-block mt-2">
                            <img src={newImagePreview} className="rounded-xl max-h-28 object-cover" style={{ border: `1px solid ${BORDER}` }} />
                            <button onClick={() => { setNewImageFile(null); if (newImagePreview) URL.revokeObjectURL(newImagePreview); setNewImagePreview(null); if (fileRef.current) fileRef.current.value = ''; }}
                                className="absolute -top-2 -right-2 w-5 h-5 bg-black text-white rounded-full flex items-center justify-center font-bold text-xs hover:bg-red-500">×</button>
                        </div>
                    )}

                    {composerError && (
                        <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg mt-2" style={{ background: '#FEF0F0', color: '#E03E3E', border: '1px solid #FECACA' }}>
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {composerError}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-between mt-4 pt-3" style={{ borderTop: `1px solid ${BORDER}` }}>
                        <div>
                            <input ref={fileRef} type="file" accept="image/*" className="hidden"
                                onChange={e => { const f = e.target.files?.[0]; if (!f) return; if (f.size > 5 * 1024 * 1024) { setComposerError('Ảnh tối đa 5MB'); return; } setNewImageFile(f); setNewImagePreview(URL.createObjectURL(f)); }} />
                            <button onClick={() => fileRef.current?.click()}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                                style={{ color: TEXT_SECONDARY }}
                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F1F0EC'}
                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                                <ImageIcon className="w-3.5 h-3.5" /> Đính kèm ảnh
                            </button>
                        </div>
                        <button onClick={handleCreatePost} disabled={creating || !newTitle.trim()}
                            className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-[13px] font-semibold transition-all disabled:opacity-50"
                            style={{ background: NAVY, color: '#fff', boxShadow: '0 2px 8px rgba(35,73,124,0.2)' }}>
                            {creating ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Đang đăng...</> : <><Send className="w-3.5 h-3.5" /> Đăng bài</>}
                        </button>
                    </div>
                </div>
            )}

            {/* ── Thread list ─────────────────────────────────────────────── */}
            <div className="flex flex-col">
                {loading && (
                    <div className="flex items-center justify-center gap-2 py-16" style={{ color: TEXT_MUTED }}>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        <span className="text-sm">Đang tải danh sách...</span>
                    </div>
                )}
                {!loading && filteredPosts.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl" style={{ background: '#FFFFFF', border: `1px solid ${BORDER}` }}>
                        <BookOpen className="w-10 h-10 mb-3" style={{ color: TEXT_MUTED }} />
                        <p className="text-sm font-medium" style={{ color: TEXT_MUTED }}>Chưa có chủ đề nào.</p>
                        <p className="text-xs mt-1" style={{ color: TEXT_MUTED }}>Hãy là người đầu tiên đặt câu hỏi!</p>
                    </div>
                )}
                {filteredPosts.map(post => (
                    <ThreadListItem
                        key={post.id}
                        post={post}
                        isAdmin={isAdmin}
                        onClick={() => setActiveThreadId(post.id)}
                        onDelete={handleDeletePost}
                        allPosts={posts}
                    />
                ))}
            </div>
        </div>
    );
};

// ── Thread Detail (separated for clarity) ───────────────────────────
interface ThreadDetailProps {
    thread: ExamComment;
    title: string;
    content: string;
    category: string;
    solved: boolean;
    isAdmin: boolean;
    adminKey?: string;
    rank: string;
    isAdminAuthor: boolean;
    authorPostCount: number;
    onBack: () => void;
    onDeletePost: (id: string) => void;
}

const ThreadDetail: React.FC<ThreadDetailProps> = ({
    thread, title, content, category, solved, isAdmin, adminKey,
    rank, isAdminAuthor, authorPostCount, onBack, onDeletePost
}) => {
    const [replies, setReplies] = useState<ExamComment[]>([]);
    const [loadingReplies, setLoadingReplies] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        setLoadingReplies(true);
        setCurrentPage(1);
        fetchComments(thread.id)
            .then(data => setReplies(data.sort((a, b) => a.created_at - b.created_at)))
            .catch(() => setReplies([]))
            .finally(() => setLoadingReplies(false));
    }, [thread.id]);

    const handleDeleteReply = async (commentId: string) => {
        if (!window.confirm('Xóa bình luận này?')) return;
        try {
            await deleteComment(commentId, adminKey || '');
            setReplies(prev => prev.filter(c => c.id !== commentId));
        } catch (err: any) { alert('Lỗi xóa: ' + err.message); }
    };

    const handleSubmitReply = async (text: string, imageFile: File | null) => {
        const nick = getNickname();
        if (!nick) throw new Error('Vui lòng đặt tên hiển thị trước khi gửi!');
        let imageUrl: string | undefined;
        if (imageFile) imageUrl = await uploadCommentImage(imageFile);
        const newReply = await postComment(thread.id, text, imageUrl);
        setReplies(prev => {
            const updated = [...prev, newReply];
            // Jump to last page so the new reply is visible
            setCurrentPage(Math.ceil(updated.length / REPLIES_PER_PAGE));
            return updated;
        });
    };

    // Count each replier's total replies IN THIS THREAD for rank calculation
    const replierCounts: Record<string, number> = {};
    replies.forEach(r => { replierCounts[r.author_name] = (replierCounts[r.author_name] || 0) + 1; });

    // ── Pagination helpers ──────────────────────────────────────────
    const totalPages = Math.max(1, Math.ceil(replies.length / REPLIES_PER_PAGE));
    const pageStart = (currentPage - 1) * REPLIES_PER_PAGE;
    const paginatedReplies = replies.slice(pageStart, pageStart + REPLIES_PER_PAGE);

    // Global reply index offset so #2, #3... numbers stay correct across pages
    const replyIndexOffset = pageStart;

    // Pagination bar component (inline)
    const PaginationBar = () => {
        if (totalPages <= 1) return null;
        // Show at most 5 page numbers centered around current page
        const range: number[] = [];
        const delta = 2;
        for (let i = Math.max(1, currentPage - delta); i <= Math.min(totalPages, currentPage + delta); i++) {
            range.push(i);
        }
        const btnBase = {
            display: 'inline-flex' as const,
            alignItems: 'center' as const,
            justifyContent: 'center' as const,
            width: 32,
            height: 32,
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            border: `1px solid ${BORDER}`,
            cursor: 'pointer',
            transition: 'all .15s',
        };
        return (
            <div className="flex items-center justify-center gap-1.5 py-2">
                {/* Prev */}
                <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    style={{ ...btnBase, background: currentPage === 1 ? '#F1F0EC' : '#FFFFFF', color: currentPage === 1 ? TEXT_MUTED : TEXT_PRIMARY, opacity: currentPage === 1 ? 0.5 : 1 }}
                    title="Trang trước"
                >
                    ‹
                </button>

                {/* First page + ellipsis */}
                {range[0] > 1 && (
                    <>
                        <button onClick={() => setCurrentPage(1)} style={{ ...btnBase, background: '#FFFFFF', color: TEXT_PRIMARY }}>1</button>
                        {range[0] > 2 && <span style={{ color: TEXT_MUTED, fontSize: 13 }}>…</span>}
                    </>
                )}

                {/* Numbered pages */}
                {range.map(p => (
                    <button
                        key={p}
                        onClick={() => setCurrentPage(p)}
                        style={{
                            ...btnBase,
                            background: p === currentPage ? NAVY : '#FFFFFF',
                            color: p === currentPage ? '#FFFFFF' : TEXT_PRIMARY,
                            borderColor: p === currentPage ? NAVY : BORDER,
                        }}
                    >
                        {p}
                    </button>
                ))}

                {/* Last page + ellipsis */}
                {range[range.length - 1] < totalPages && (
                    <>
                        {range[range.length - 1] < totalPages - 1 && <span style={{ color: TEXT_MUTED, fontSize: 13 }}>…</span>}
                        <button onClick={() => setCurrentPage(totalPages)} style={{ ...btnBase, background: '#FFFFFF', color: TEXT_PRIMARY }}>{totalPages}</button>
                    </>
                )}

                {/* Next */}
                <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    style={{ ...btnBase, background: currentPage === totalPages ? '#F1F0EC' : '#FFFFFF', color: currentPage === totalPages ? TEXT_MUTED : TEXT_PRIMARY, opacity: currentPage === totalPages ? 0.5 : 1 }}
                    title="Trang sau"
                >
                    ›
                </button>

                <span className="ml-2 text-[11px]" style={{ color: TEXT_MUTED }}>
                    {pageStart + 1}–{Math.min(pageStart + REPLIES_PER_PAGE, replies.length)} / {replies.length}
                </span>
            </div>
        );
    };

    return (
        <div className="w-full mx-auto pb-20 animate-fade-in min-h-screen bg-transparent">
            {/* Clean nav header */}
            <div className="flex items-center gap-3 py-4">
                <button onClick={onBack}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-all"
                    style={{ color: TEXT_SECONDARY }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F1F0EC'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                    <ChevronLeft className="w-4 h-4" />
                    Quay lại
                </button>
                <div className="flex items-center gap-2">
                    <CategoryBadge catId={category} />
                    <TagBadge tagId={thread.text ? (decodePost(thread.text).tag || '') : ''} />
                    {solved && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: ACCENT_GREEN_LIGHT, color: ACCENT_GREEN }}>
                            <CheckCircle className="w-3 h-3" /> Đã giải đáp
                        </span>
                    )}
                </div>
            </div>

            {/* Thread title */}
            <div className="pb-5">
                <h1 className="text-[22px] md:text-[24px] font-bold leading-snug" style={{ color: TEXT_PRIMARY }}>{title}</h1>
                <div className="flex items-center gap-2 mt-2 text-[12px]" style={{ color: TEXT_SECONDARY }}>
                    <span className="font-semibold" style={{ color: NAVY }}>{thread.author_name}</span>
                    <span style={{ color: TEXT_MUTED }}>·</span>
                    <span>{new Date(thread.created_at).toLocaleDateString('vi-VN')} lúc {new Date(thread.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                    {isAdmin && (
                        <>
                            <span style={{ color: TEXT_MUTED }}>·</span>
                            <button
                                onClick={() => onDeletePost(thread.id)}
                                className="font-semibold hover:underline" style={{ color: '#E03E3E' }}>
                                Xóa chủ đề
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Cards zone */}
            <div className="flex flex-col gap-3">

            {/* Original Post card (Post #1) */}
            <div
                className="overflow-hidden"
                style={{ background: '#FFFFFF', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', border: `1px solid ${BORDER}` }}
            >
                {/* Post header */}
                <div className="flex items-center gap-3 px-5 py-3" style={{ background: '#FAFAF9', borderBottom: `1px solid ${BORDER}` }}>
                    <Avatar name={thread.author_name} size={38} />
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="text-[13px] font-bold" style={{ color: NAVY }}>{thread.author_name}</span>
                            {isAdminAuthor ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white" style={{ background: NAVY }}>Giảng viên</span>
                            ) : (
                                <span className="text-[11px]" style={{ color: TEXT_MUTED }}>{rank}</span>
                            )}
                        </div>
                        <div className="text-[11px]" style={{ color: TEXT_MUTED }}>
                            {new Date(thread.created_at).toLocaleDateString('vi-VN')} lúc {new Date(thread.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                            <span className="mx-1">·</span>
                            {authorPostCount} bài viết
                        </div>
                    </div>
                    <span className="text-[12px] font-semibold shrink-0" style={{ color: TEXT_MUTED }}>#1</span>
                </div>

                {/* Post body */}
                <div className="px-5 py-4">
                    <p className="text-[15px] leading-relaxed whitespace-pre-wrap" style={{ color: TEXT_PRIMARY }}>{content}</p>
                    {thread.image_url && (
                        <div className="mt-4">
                            <img src={thread.image_url} className="max-h-[500px] rounded-xl object-contain" loading="lazy" />
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center gap-4 px-5 py-2.5 text-[12px]" style={{ color: TEXT_MUTED, borderTop: `1px solid #F0F0EE` }}>
                    <button className="flex items-center gap-1 hover:text-green-600 transition-colors font-medium p-1 rounded-md"
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F0FFF4'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                        <ThumbsUp className="w-3.5 h-3.5" /> Hữu ích
                    </button>
                </div>
            </div>

            {/* Reply count divider label */}
            {replies.length > 0 && (
                <div className="flex items-center gap-2 pt-1 pb-0 text-[12px] font-semibold uppercase tracking-wide"
                    style={{ color: TEXT_MUTED }}>
                    <MessageCircle className="w-3.5 h-3.5" />
                    {replies.length} câu trả lời
                </div>
            )}

            {/* Replies – paginated, each is a standalone card */}
            {loadingReplies ? (
                <div className="flex items-center justify-center gap-2 py-10" style={{ color: TEXT_MUTED }}>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Đang tải câu trả lời...</span>
                </div>
            ) : replies.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-center" style={{ color: TEXT_MUTED }}>
                    <MessageCircle className="w-8 h-8 mb-2 opacity-40" />
                    <p className="text-sm">Chưa có câu trả lời nào. Hãy là người đầu tiên!</p>
                </div>
            ) : (
                <>
                    {/* Pagination – top */}
                    <PaginationBar />

                    {paginatedReplies.map((reply, index) => (
                        <ReplyItem
                            key={reply.id}
                            comment={reply}
                            index={replyIndexOffset + index}
                            isAdmin={isAdmin}
                            adminKey={adminKey}
                            authorAllRepliesCount={replierCounts[reply.author_name] || 1}
                            onDelete={handleDeleteReply}
                        />
                    ))}

                    {/* Pagination – bottom */}
                    <PaginationBar />
                </>
            )}

            </div>{/* end cards zone */}

            {/* Reply composer */}
            <div className="mt-4 mb-4 p-5 rounded-2xl" style={{ background: '#FFFFFF', border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                <h3 className="text-[14px] font-bold mb-3 flex items-center gap-2" style={{ color: TEXT_PRIMARY }}>
                    <MessageCircle className="w-4 h-4" style={{ color: NAVY }} />
                    Gửi câu trả lời
                </h3>
                <div className="mb-3"><NicknameBar /></div>
                <Composer
                    placeholder="Chia sẻ kiến thức hoặc thắc mắc của bạn... (Ctrl+Enter để gửi)"
                    buttonLabel="Gửi trả lời"
                    onSubmit={handleSubmitReply}
                    compact
                />
            </div>
        </div>
    );
};

export default ForumFeed;
