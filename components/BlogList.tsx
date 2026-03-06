import React, { useState, useEffect } from 'react';
import { BlogPost } from '../types';
import { useCloudStorage } from '../src/hooks/useCloudStorage';
import { BookOpen, Calendar, ChevronRight, Edit3, Plus, Search } from 'lucide-react';

interface BlogListProps {
    isAdmin: boolean;
    onReadBlog: (blog: BlogPost) => void;
    onEditBlog?: (blog: BlogPost) => void;
    onCreateBlog?: () => void;
}

const BlogList: React.FC<BlogListProps> = ({ isAdmin, onReadBlog, onEditBlog, onCreateBlog }) => {
    const { getBlogs } = useCloudStorage();
    const [blogs, setBlogs] = useState<BlogPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const fetchBlogs = async () => {
            setLoading(true);
            const data = await getBlogs(isAdmin);
            setBlogs(data);
            setLoading(false);
        };
        fetchBlogs();
    }, [isAdmin]);

    const filteredBlogs = blogs.filter(b =>
        b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.summary.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8 animate-fade-in relative pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold mb-2 tracking-tight" style={{ color: '#1A1A1A' }}>
                        {isAdmin ? 'Quản lý Blog Kiến Thức' : 'Góc Học Tập'}
                    </h1>
                    <p className="text-sm" style={{ color: '#787774' }}>
                        {isAdmin ? 'Viết và quản lý các bài chia sẻ kiến thức, tin tức.' : 'Đọc các bài viết chia sẻ kiến thức, kinh nghiệm, và mẹo giải bài tập Vật Lý.'}
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Search */}
                    <div
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm w-full md:w-64"
                        style={{ background: '#FFFFFF', border: '1px solid #E9E9E7' }}
                    >
                        <Search className="w-4 h-4 shrink-0" style={{ color: '#AEACA8' }} />
                        <input
                            type="text"
                            placeholder="Tìm kiếm bài viết..."
                            className="bg-transparent border-none outline-none w-full placeholder:text-[#AEACA8]"
                            style={{ color: '#1A1A1A' }}
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>

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

            {loading ? (
                <div className="flex justify-center items-center py-20">
                    <div className="animate-spin w-8 h-8 rounded-full border-t-2 border-[#6B7CDB]"></div>
                </div>
            ) : filteredBlogs.length === 0 ? (
                <div
                    className="text-center py-20 rounded-2xl border border-dashed"
                    style={{ borderColor: '#E9E9E7', background: '#FFFFFF' }}
                >
                    <BookOpen className="w-12 h-12 mx-auto mb-4" style={{ color: '#CFCFCB' }} />
                    <h3 className="text-lg font-medium mb-1" style={{ color: '#1A1A1A' }}>
                        {searchQuery ? 'Không tìm thấy bài viết' : 'Chưa có bài viết nào'}
                    </h3>
                    <p className="text-sm" style={{ color: '#787774' }}>
                        {searchQuery ? 'Thử thay đổi từ khóa tìm kiếm nhé.' : isAdmin ? 'Bấm vào "Viết bài" để đăng chia sẻ mới nhé.' : 'Thầy Huy đang chuẩn bị các bài viết chia sẻ kiến thức, quay lại sau nhé!'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredBlogs.map(blog => (
                        <div
                            key={blog.id}
                            className="group cursor-pointer rounded-2xl overflow-hidden flex flex-col transition-all bg-white relative"
                            style={{ border: '1px solid #E9E9E7' }}
                            onClick={() => onReadBlog(blog)}
                        >
                            {/* Cover Image */}
                            <div
                                className="w-full h-48 bg-[#F7F6F3] border-b relative overflow-hidden shrink-0 flex items-center justify-center"
                                style={{ borderColor: '#E9E9E7' }}
                            >
                                {blog.cover_image ? (
                                    <img src={blog.cover_image} alt={blog.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                ) : (
                                    <BookOpen className="w-10 h-10" style={{ color: '#CFCFCB' }} />
                                )}

                                {isAdmin && (
                                    <div className="absolute top-3 left-3 flex gap-2">
                                        <span
                                            className="px-2 py-1 text-[10px] font-bold rounded-md uppercase tracking-wide"
                                            style={blog.is_published
                                                ? { background: '#EAF3EE', color: '#448361', border: '1px solid #B7D9C4' }
                                                : { background: '#F3ECF8', color: '#9065B0', border: '1px solid #C8A8DC' }}
                                        >
                                            {blog.is_published ? 'Đã xuất bản' : 'Bản nháp'}
                                        </span>
                                    </div>
                                )}

                                {blog.category && (
                                    <div className="absolute top-3 right-3 text-[10px] uppercase font-bold px-2.5 py-1 rounded-md bg-white border border-[#E9E9E7] shadow-sm text-[#57564F]">
                                        {blog.category}
                                    </div>
                                )}
                            </div>

                            {/* Content */}
                            <div className="p-5 flex-1 flex flex-col">
                                <div className="flex items-center gap-1.5 text-xs text-[#AEACA8] mb-3">
                                    <Calendar className="w-3.5 h-3.5" />
                                    <span>{new Date(blog.created_at).toLocaleDateString('vi-VN')}</span>
                                </div>

                                <h3 className="text-lg font-bold leading-tight mb-2 group-hover:text-indigo-600 transition-colors line-clamp-2 text-[#1A1A1A]">
                                    {blog.title}
                                </h3>

                                <p className="text-sm text-[#787774] leading-relaxed line-clamp-3 mb-4 flex-1">
                                    {blog.summary}
                                </p>

                                <div className="pt-4 border-t border-[#F1F0EC] flex items-center justify-between">
                                    {isAdmin && onEditBlog ? (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onEditBlog(blog); }}
                                            className="text-indigo-600 text-sm font-medium flex items-center gap-1.5 hover:underline"
                                        >
                                            <Edit3 className="w-4 h-4" /> Chỉnh sửa
                                        </button>
                                    ) : (
                                        <span className="text-sm font-medium text-[#1A1A1A] group-hover:text-indigo-600 flex items-center gap-1 transition-colors">
                                            Đọc tiếp <ChevronRight className="w-4 h-4" />
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default BlogList;
