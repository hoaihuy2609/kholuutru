import React, { useState, useEffect, useMemo } from 'react';
import { BlogPost } from '../types';
import { useCloudStorage } from '../src/hooks/useCloudStorage';
import { BookOpen, Calendar, ChevronRight, Edit3, Plus, Search, Clock, Tag, Filter, X } from 'lucide-react';

interface BlogListProps {
    isAdmin: boolean;
    onReadBlog: (blog: BlogPost) => void;
    onEditBlog?: (blog: BlogPost) => void;
    onCreateBlog?: () => void;
    onBlogsLoaded?: (blogs: BlogPost[]) => void;
}

const estimateReadTime = (content: string): number => {
    const words = content.trim().split(/\s+/).length;
    return Math.max(1, Math.ceil(words / 200)); // ~200 từ/phút
};

const BlogList: React.FC<BlogListProps> = ({ isAdmin, onReadBlog, onEditBlog, onCreateBlog, onBlogsLoaded }) => {
    const { getBlogs } = useCloudStorage();
    const [blogs, setBlogs] = useState<BlogPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedTag, setSelectedTag] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    useEffect(() => {
        const fetchBlogs = async () => {
            setLoading(true);
            const data = await getBlogs(isAdmin);
            setBlogs(data);
            if (onBlogsLoaded) onBlogsLoaded(data); // căng bản cho related posts
            setLoading(false);
        };
        fetchBlogs();
    }, [isAdmin]);

    // Lấy danh sách categories và tags duy nhất
    const categories = useMemo(() =>
        [...new Set(blogs.map(b => b.category).filter(Boolean))],
        [blogs]
    );
    const allTags = useMemo(() =>
        [...new Set(blogs.flatMap(b => b.tags || []))],
        [blogs]
    );

    const filteredBlogs = useMemo(() => blogs.filter(b => {
        const q = searchQuery.toLowerCase();
        const matchSearch = !q || b.title.toLowerCase().includes(q) || b.summary.toLowerCase().includes(q) || (b.tags || []).some(t => t.toLowerCase().includes(q));
        const matchCat = !selectedCategory || b.category === selectedCategory;
        const matchTag = !selectedTag || (b.tags || []).includes(selectedTag);
        return matchSearch && matchCat && matchTag;
    }), [blogs, searchQuery, selectedCategory, selectedTag]);

    const hasActiveFilters = selectedCategory || selectedTag;

    return (
        <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8 animate-fade-in relative pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold mb-2 tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
                        {isAdmin ? '📝 Quản lý Blog Kiến Thức' : '📚 Góc Học Tập'}
                    </h1>
                    <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                        {isAdmin
                            ? `${blogs.length} bài viết · ${blogs.filter(b => b.is_published).length} đã xuất bản`
                            : 'Các bài viết chia sẻ kiến thức, kinh nghiệm và mẹo giải bài tập Vật Lý.'}
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* Search */}
                    <div
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm flex-1 min-w-0"
                        style={{ background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)' }}
                    >
                        <Search className="w-4 h-4 shrink-0" style={{ color: '#AEACA8' }} />
                        <input
                            type="text"
                            placeholder="Tìm kiếm bài viết, thẻ..."
                            className="bg-transparent border-none outline-none w-full placeholder:text-[#AEACA8] min-w-0"
                            style={{ color: 'var(--color-text-primary)' }}
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="shrink-0 text-[#AEACA8] hover:text-[#57564F]">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Filter button */}
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="px-3 py-2 rounded-xl text-sm font-medium flex items-center gap-1.5 transition-all shrink-0"
                        style={{
                            background: hasActiveFilters ? '#EEF0FB' : 'var(--color-bg-primary)',
                            color: hasActiveFilters ? '#6B7CDB' : 'var(--color-text-secondary)',
                            border: `1px solid ${hasActiveFilters ? '#C5CAFA' : 'var(--color-border)'}`
                        }}
                    >
                        <Filter className="w-4 h-4" />
                        Lọc {hasActiveFilters && <span className="bg-[#6B7CDB] text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">!</span>}
                    </button>

                    {isAdmin && onCreateBlog && (
                        <button
                            onClick={onCreateBlog}
                            className="px-4 py-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] shrink-0"
                            style={{ background: '#1A1A1A', color: '#FFFFFF' }}
                        >
                            <Plus className="w-4 h-4" />
                            Viết bài
                        </button>
                    )}
                </div>
            </div>

            {/* Filter Panel */}
            {showFilters && (categories.length > 0 || allTags.length > 0) && (
                <div
                    className="p-4 rounded-2xl space-y-4"
                    style={{ background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)' }}
                >
                    {categories.length > 0 && (
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#AEACA8' }}>Chuyên mục</p>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => setSelectedCategory('')}
                                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                                    style={!selectedCategory
                                        ? { background: '#1A1A1A', color: '#FFF' }
                                        : { background: '#F1F0EC', color: '#57564F' }}
                                >
                                    Tất cả
                                </button>
                                {categories.map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => setSelectedCategory(cat === selectedCategory ? '' : cat)}
                                        className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                                        style={selectedCategory === cat
                                            ? { background: '#6B7CDB', color: '#FFF' }
                                            : { background: '#F1F0EC', color: '#57564F' }}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {allTags.length > 0 && (
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#AEACA8' }}>Thẻ</p>
                            <div className="flex flex-wrap gap-2">
                                {allTags.map(tag => (
                                    <button
                                        key={tag}
                                        onClick={() => setSelectedTag(tag === selectedTag ? '' : tag)}
                                        className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1"
                                        style={selectedTag === tag
                                            ? { background: '#EAF3EE', color: '#448361', border: '1px solid #B7D9C4' }
                                            : { background: '#F1F0EC', color: '#57564F', border: '1px solid transparent' }}
                                    >
                                        # {tag}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {hasActiveFilters && (
                        <button
                            onClick={() => { setSelectedCategory(''); setSelectedTag(''); }}
                            className="text-xs text-red-500 hover:underline flex items-center gap-1"
                        >
                            <X className="w-3 h-3" /> Xóa bộ lọc
                        </button>
                    )}
                </div>
            )}

            {/* Stats summary row */}
            {!loading && filteredBlogs.length > 0 && (
                <p className="text-xs" style={{ color: '#AEACA8' }}>
                    Hiển thị {filteredBlogs.length} / {blogs.length} bài viết
                    {hasActiveFilters && ' (đang lọc)'}
                </p>
            )}

            {loading ? (
                <div className="flex justify-center items-center py-20">
                    <div className="animate-spin w-8 h-8 rounded-full border-t-2 border-[#6B7CDB]"></div>
                </div>
            ) : filteredBlogs.length === 0 ? (
                <div
                    className="text-center py-20 rounded-2xl border border-dashed"
                    style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-primary)' }}
                >
                    <BookOpen className="w-12 h-12 mx-auto mb-4" style={{ color: '#CFCFCB' }} />
                    <h3 className="text-lg font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>
                        {searchQuery || hasActiveFilters ? 'Không tìm thấy bài viết' : 'Chưa có bài viết nào'}
                    </h3>
                    <p className="text-sm" style={{ color: '#787774' }}>
                        {searchQuery || hasActiveFilters
                            ? 'Thử thay đổi từ khóa hoặc bộ lọc nhé.'
                            : isAdmin ? 'Bấm vào "Viết bài" để đăng chia sẻ mới nhé.' : 'Thầy Huy đang chuẩn bị các bài viết, quay lại sau nhé!'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredBlogs.map(blog => (
                        <article
                            key={blog.id}
                            className="group cursor-pointer rounded-2xl overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
                            style={{ background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)' }}
                            onClick={() => onReadBlog(blog)}
                        >
                            {/* Cover Image */}
                            <div
                                className="w-full h-48 border-b relative overflow-hidden shrink-0 flex items-center justify-center"
                                style={{ background: '#F7F6F3', borderColor: 'var(--color-border)' }}
                            >
                                {blog.cover_image ? (
                                    <img
                                        src={blog.cover_image}
                                        alt={blog.title}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        loading="lazy"
                                    />
                                ) : (
                                    <BookOpen className="w-10 h-10" style={{ color: '#CFCFCB' }} />
                                )}

                                {/* Badges */}
                                <div className="absolute top-3 left-3 flex gap-2">
                                    {isAdmin && (
                                        <span
                                            className="px-2 py-1 text-[10px] font-bold rounded-md uppercase tracking-wide"
                                            style={blog.is_published
                                                ? { background: '#EAF3EE', color: '#448361', border: '1px solid #B7D9C4' }
                                                : { background: '#F3ECF8', color: '#9065B0', border: '1px solid #C8A8DC' }}
                                        >
                                            {blog.is_published ? '✓ Đã xuất bản' : '✎ Bản nháp'}
                                        </span>
                                    )}
                                </div>

                                {blog.category && (
                                    <div className="absolute top-3 right-3 text-[10px] uppercase font-bold px-2.5 py-1 rounded-md bg-white/90 backdrop-blur-sm border border-[#E9E9E7] shadow-sm text-[#57564F]">
                                        {blog.category}
                                    </div>
                                )}
                            </div>

                            {/* Content */}
                            <div className="p-5 flex-1 flex flex-col">
                                {/* Meta row */}
                                <div className="flex items-center gap-3 text-xs mb-3" style={{ color: '#AEACA8' }}>
                                    <span className="flex items-center gap-1">
                                        <Calendar className="w-3.5 h-3.5" />
                                        {new Date(blog.created_at).toLocaleDateString('vi-VN')}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Clock className="w-3.5 h-3.5" />
                                        {estimateReadTime(blog.content)} phút đọc
                                    </span>
                                </div>

                                <h3 className="text-lg font-bold leading-tight mb-2 group-hover:text-indigo-600 transition-colors line-clamp-2" style={{ color: 'var(--color-text-primary)' }}>
                                    {blog.title}
                                </h3>

                                <p className="text-sm leading-relaxed line-clamp-3 mb-4 flex-1" style={{ color: '#787774' }}>
                                    {blog.summary}
                                </p>

                                {/* Tags */}
                                {blog.tags && blog.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mb-4">
                                        {blog.tags.slice(0, 3).map(tag => (
                                            <span
                                                key={tag}
                                                className="text-[11px] px-2 py-0.5 rounded-md"
                                                style={{ background: '#F1F0EC', color: '#787774' }}
                                            >
                                                #{tag}
                                            </span>
                                        ))}
                                        {blog.tags.length > 3 && (
                                            <span className="text-[11px] px-2 py-0.5 rounded-md" style={{ color: '#AEACA8' }}>
                                                +{blog.tags.length - 3}
                                            </span>
                                        )}
                                    </div>
                                )}

                                <div className="pt-4 border-t border-[#F1F0EC] flex items-center justify-between">
                                    {isAdmin && onEditBlog ? (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onEditBlog(blog); }}
                                            className="text-indigo-600 text-sm font-medium flex items-center gap-1.5 hover:underline"
                                        >
                                            <Edit3 className="w-4 h-4" /> Chỉnh sửa
                                        </button>
                                    ) : (
                                        <span className="text-sm font-medium flex items-center gap-1 transition-colors group-hover:text-indigo-600" style={{ color: 'var(--color-text-primary)' }}>
                                            Đọc tiếp <ChevronRight className="w-4 h-4" />
                                        </span>
                                    )}
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </div>
    );
};

export default BlogList;
