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
    const [gradeFilter, setGradeFilter] = useState<number>(0);
    const [showFilters, setShowFilters] = useState(false);

    useEffect(() => {
        const fetchBlogs = async () => {
            setLoading(true);
            const data = await getBlogs(isAdmin);
            setBlogs(data);
            if (onBlogsLoaded) onBlogsLoaded(data);
            setLoading(false);
        };
        fetchBlogs();
    }, [isAdmin]);

    // Categories và tags
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
        const gradeVal = b.grade || 0;
        const matchGrade = gradeFilter === 0 || gradeVal === gradeFilter || gradeVal === 0;
        return matchSearch && matchCat && matchTag && matchGrade;
    }), [blogs, searchQuery, selectedCategory, selectedTag, gradeFilter]);

    const hasActiveFilters = selectedCategory || selectedTag;

    const gradeTabs = [
        { label: 'Tất cả', value: 0, color: '#6B7CDB' },
        { label: 'Lớp 12', value: 12, color: '#9065B0' },
        { label: 'Lớp 11', value: 11, color: '#6B7CDB' },
        { label: 'Lớp 10', value: 10, color: '#448361' },
    ];

    return (
        <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6 animate-fade-in relative pb-20 font-sans">
            {/* Header & Search */}
            <div className="flex flex-col gap-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight mb-1" style={{ color: '#1A1A1A' }}>
                            {isAdmin ? '📝 Quản lý Blog' : '📚 Góc Học Tập'}
                        </h1>
                        <p className="text-sm" style={{ color: '#787774' }}>
                            {isAdmin
                                ? `Hệ thống lưu trữ bài viết & kiến thức chuyên sâu`
                                : 'Chia sẻ kiến thức, mẹo giải bài tập và tài liệu Vật Lý độc quyền.'}
                        </p>
                    </div>

                    {isAdmin && onCreateBlog && (
                        <button
                            onClick={onCreateBlog}
                            className="px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-sm"
                            style={{ background: '#1A1A1A', color: '#FFFFFF' }}
                        >
                            <Plus className="w-4 h-4" />
                            Viết bài mới
                        </button>
                    )}
                </div>

                {/* Grade Filter Bar - New! */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
                    {gradeTabs.map(tab => (
                        <button
                            key={tab.value}
                            onClick={() => setGradeFilter(tab.value)}
                            className="px-5 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all border shadow-sm"
                            style={{
                                background: gradeFilter === tab.value ? tab.color : '#FFFFFF',
                                color: gradeFilter === tab.value ? '#FFFFFF' : '#787774',
                                borderColor: gradeFilter === tab.value ? tab.color : '#E9E9E7'
                            }}
                        >
                            {tab.label}
                        </button>
                    ))}

                    <div className="h-6 w-[1px] bg-[#E9E9E7] mx-2 shrink-0"></div>

                    {/* Search Input In-line */}
                    <div
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm bg-white border border-[#E9E9E7] flex-1 min-w-[200px] shadow-sm"
                    >
                        <Search className="w-4 h-4 shrink-0 text-[#AEACA8]" />
                        <input
                            type="text"
                            placeholder="Tìm kiếm..."
                            className="bg-transparent border-none outline-none w-full placeholder:text-[#AEACA8]"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className="p-1 rounded-lg hover:bg-[#F7F6F3] text-[#AEACA8]"
                            title="Lọc chuyên sâu"
                        >
                            <Filter className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Sub-Filters (Category/Tags) */}
            {showFilters && (categories.length > 0 || allTags.length > 0) && (
                <div
                    className="p-5 rounded-2xl space-y-4 animate-scale-in"
                    style={{ background: '#FFFFFF', border: '1px solid #E9E9E7', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}
                >
                    {categories.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-bold uppercase text-[#AEACA8] mr-2">Chuyên mục:</span>
                            {categories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat === selectedCategory ? '' : cat)}
                                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                                    style={selectedCategory === cat
                                        ? { background: '#6B7CDB', color: '#FFF' }
                                        : { background: '#F7F6F3', color: '#57564F', border: '1px solid #E9E9E7' }}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    )}
                    {allTags.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-bold uppercase text-[#AEACA8] mr-2">Thẻ phổ biến:</span>
                            {allTags.map(tag => (
                                <button
                                    key={tag}
                                    onClick={() => setSelectedTag(tag === selectedTag ? '' : tag)}
                                    className="px-2.5 py-1 rounded-md text-[11px] font-medium transition-all"
                                    style={selectedTag === tag
                                        ? { background: '#EAF3EE', color: '#448361', border: '1px solid #B7D9C4' }
                                        : { background: '#F7F6F3', color: '#AEACA8' }}
                                >
                                    #{tag}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {loading ? (
                <div className="flex flex-col items-center justify-center py-32 gap-4">
                    <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                    <p className="text-sm font-medium text-[#AEACA8]">Đang tải kho kiến thức...</p>
                </div>
            ) : filteredBlogs.length === 0 ? (
                <div className="text-center py-24 rounded-3xl border-2 border-dashed border-[#E9E9E7] bg-white">
                    <BookOpen className="w-16 h-16 mx-auto mb-4 text-[#E9E9E7]" />
                    <h3 className="text-xl font-bold text-[#1A1A1A]">Ơ kìa, chưa có bài nào!</h3>
                    <p className="text-sm text-[#787774] mt-2 max-w-xs mx-auto">
                        Thầy Huy đang biên tập thêm nội dung bài viết cho phần này. Bro quay lại sau nhé!
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {filteredBlogs.map(blog => (
                        <article
                            key={blog.id}
                            className="group relative bg-white rounded-3xl overflow-hidden border border-[#E9E9E7] hover:border-indigo-200 hover:shadow-2xl hover:shadow-indigo-100 transition-all duration-300 flex flex-col cursor-pointer"
                            onClick={() => onReadBlog(blog)}
                        >
                            {/* Grade Badge - Absolute Floating */}
                            <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
                                <span
                                    className="px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full shadow-sm text-white border border-white/20 backdrop-blur-md"
                                    style={{ background: blog.grade === 10 ? '#448361' : blog.grade === 11 ? '#6B7CDB' : blog.grade === 12 ? '#9065B0' : '#1A1A1A' }}
                                >
                                    {blog.grade === 0 ? 'Chung' : `Lớp ${blog.grade}`}
                                </span>
                            </div>

                            {/* Status logic for admin */}
                            {isAdmin && (
                                <div className="absolute top-4 right-4 z-10">
                                    <span
                                        className="px-2.5 py-1 text-[9px] font-bold rounded-lg border backdrop-blur-md"
                                        style={blog.is_published
                                            ? { background: 'rgba(234, 243, 238, 0.9)', color: '#448361', borderColor: '#B7D9C4' }
                                            : { background: 'rgba(243, 236, 248, 0.9)', color: '#9065B0', borderColor: '#C8A8DC' }}
                                    >
                                        {blog.is_published ? 'Đã đăng' : 'Bản nháp'}
                                    </span>
                                </div>
                            )}

                            {/* Thumbnail area */}
                            <div className="relative h-44 overflow-hidden bg-[#F7F6F3]">
                                {blog.cover_image ? (
                                    <img
                                        src={blog.cover_image}
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                        alt={blog.title}
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <div
                                            className="w-16 h-16 rounded-3xl flex items-center justify-center"
                                            style={{ background: '#FFFFFF', border: '1px solid #E9E9E7' }}
                                        >
                                            <BookOpen className="w-8 h-8 text-[#E9E9E7]" />
                                        </div>
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            </div>

                            {/* Content area */}
                            <div className="p-6 flex-1 flex flex-col">
                                <div className="flex items-center gap-4 text-[11px] font-bold text-[#AEACA8] mb-3 uppercase tracking-wider">
                                    <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {new Date(blog.created_at).toLocaleDateString('vi-VN')}</span>
                                    <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {estimateReadTime(blog.content)}p</span>
                                </div>

                                <h3 className="text-xl font-bold text-[#1A1A1A] leading-tight mb-3 group-hover:text-indigo-600 transition-colors line-clamp-2">
                                    {blog.title}
                                </h3>

                                <p className="text-sm text-[#787774] leading-relaxed line-clamp-3 mb-6 flex-1">
                                    {blog.summary}
                                </p>

                                <div className="pt-4 border-t border-[#F7F6F3] flex items-center justify-between">
                                    {blog.category && (
                                        <span className="text-[10px] font-black uppercase text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md">
                                            {blog.category}
                                        </span>
                                    )}

                                    {isAdmin && onEditBlog ? (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onEditBlog(blog); }}
                                            className="p-2 rounded-xl bg-[#F7F6F3] text-[#787774] hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                                        >
                                            <Edit3 className="w-4 h-4" />
                                        </button>
                                    ) : (
                                        <div className="flex items-center gap-1 text-sm font-bold text-[#1A1A1A] group-hover:text-indigo-600 transition-colors">
                                            Đọc ngay <ChevronRight className="w-4 h-4" />
                                        </div>
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
