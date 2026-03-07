import React, { useState, useEffect, useRef } from 'react';
import { BlogPost } from '../types';
import { useCloudStorage } from '../src/hooks/useCloudStorage';
import {
    ChevronLeft, Save, Trash2, Eye, PenTool, Bold, Italic, List,
    ImageIcon, Link as LinkIcon, HelpCircle, AlignLeft, AlignCenter,
    AlignRight, AlignJustify, Type, Hash, Quote, Code2, Table,
    X, CheckCircle, AlertCircle, RefreshCw
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import 'katex/dist/katex.min.css';

interface AdminBlogEditorProps {
    blog: BlogPost | null;
    onBack: () => void;
    onSaved: (blog: BlogPost) => void;
}

const CATEGORIES = ['Lý thuyết', 'Mẹo giải bài', 'Kinh nghiệm', 'Tin tức', 'Đề cương', 'Khác'];

const AdminBlogEditor: React.FC<AdminBlogEditorProps> = ({ blog, onBack, onSaved }) => {
    const { saveBlog, deleteBlog, syncBlogs } = useCloudStorage();
    const [pendingSync, setPendingSync] = useState(false); // flag cần sync lên Telegram
    const [isSyncingBlog, setIsSyncingBlog] = useState(false);

    const [formData, setFormData] = useState<Partial<BlogPost>>({
        title: '', summary: '', content: '', cover_image: '', category: '', is_published: false,
        grade: 0,
        tags: []
    });
    const [isPreview, setIsPreview] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showHelper, setShowHelper] = useState(false);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'warning' } | null>(null);
    const [wordCount, setWordCount] = useState(0);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (blog) {
            setFormData({
                id: blog.id, title: blog.title, summary: blog.summary,
                content: blog.content, cover_image: blog.cover_image,
                category: blog.category, tags: blog.tags || [],
                is_published: blog.is_published,
                grade: blog.grade ?? 0,
            });
        }
    }, [blog]);

    useEffect(() => {
        const words = (formData.content || '').trim().split(/\s+/).filter(w => w).length;
        setWordCount(words);
    }, [formData.content]);

    const showToast = (msg: string, type: 'success' | 'error' | 'warning' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleChange = (field: keyof BlogPost, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleTagsChange = (val: string) => {
        handleChange('tags', val.split(',').map(t => t.trim()).filter(t => t));
    };

    const handleSave = async () => {
        if (!formData.title?.trim()) { showToast('Vui lòng nhập tiêu đề!', 'error'); return; }
        if (!formData.content?.trim()) { showToast('Vui lòng nhập nội dung!', 'error'); return; }
        setIsSaving(true);
        const saved = await saveBlog(formData);
        setIsSaving(false);
        if (saved) {
            // Nếu bài đã published → auto-sync luôn để học sinh thấy ngay
            if (formData.is_published) {
                showToast('Đã lưu! Đang sync lên Telegram...', 'warning');
                setIsSyncingBlog(true);
                const result = await syncBlogs();
                setIsSyncingBlog(false);
                if (result.success) {
                    showToast(`Sync xong! ${result.blogCount} bài viết đã lên Telegram.`);
                    setPendingSync(false);
                } else {
                    showToast('Sync thất bại! Vui lòng thử lại.', 'error');
                    setPendingSync(true);
                }
            } else {
                showToast('Đã lưu bản nháp. Bật “Hiển thị cho học sinh” khi sẵn sàng đăng.');
                setPendingSync(true);
            }
            onSaved(saved);
        } else {
            showToast('Lưu thất bại, vui lòng thử lại.', 'error');
        }
    };

    const handleSyncNow = async () => {
        setIsSyncingBlog(true);
        const result = await syncBlogs();
        setIsSyncingBlog(false);
        if (result.success) {
            showToast(`🚀 Sync xong! ${result.blogCount} bài viết đã lên Telegram.`);
            setPendingSync(false);
        } else {
            showToast('❌ Sync thất bại! Kiểm tra kết nối.', 'error');
        }
    };

    const handleDelete = async () => {
        if (!blog) return;
        if (!window.confirm('Bạn có chắc chắn muốn xóa bài viết này vĩnh viễn không?')) return;
        setIsSaving(true);
        const ok = await deleteBlog(blog.id);
        if (!ok) {
            setIsSaving(false);
            showToast('❌ Lỗi khi xóa!', 'error');
            return;
        }
        // Sync lên Telegram NGAY để Telegram cũng phản ánh bài đã xóa
        // Nếu không sync trước, BlogList sẽ kéo lại bài cũ từ Telegram khi re-mount
        showToast('🗑️ Đã xóa! Đang sync lên Telegram...');
        setIsSyncingBlog(true);
        const result = await syncBlogs();
        setIsSyncingBlog(false);
        setIsSaving(false);
        if (result.success) {
            showToast('✅ Đã xóa và sync xong!');
        } else {
            showToast('⚠️ Đã xóa local. Sync thất bại — Telegram chưa cập nhật.', 'error');
        }
        onBack();
    };

    const insertTextAtCursor = (prefix: string, suffix: string = '') => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const current = formData.content || '';
        const selected = current.substring(start, end);
        const newText = current.substring(0, start) + prefix + selected + suffix + current.substring(end);
        handleChange('content', newText);
        const newPos = start + prefix.length + selected.length + suffix.length;
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(newPos, newPos);
        }, 0);
    };

    const toolbarButtons = [
        { icon: <Bold className="w-4 h-4" />, tip: 'In đậm (Ctrl+B)', action: () => insertTextAtCursor('**', '**') },
        { icon: <Italic className="w-4 h-4" />, tip: 'In nghiêng (Ctrl+I)', action: () => insertTextAtCursor('*', '*') },
        { divider: true },
        { icon: <Hash className="w-4 h-4" />, tip: 'Tiêu đề H2', action: () => insertTextAtCursor('\n## ', '\n') },
        { icon: <Type className="w-4 h-4" />, tip: 'Tiêu đề H3', action: () => insertTextAtCursor('\n### ', '\n') },
        { divider: true },
        { icon: <List className="w-4 h-4" />, tip: 'Danh sách bullet', action: () => insertTextAtCursor('\n- ') },
        { icon: <span className="text-xs font-bold font-mono">1.</span>, tip: 'Danh sách số', action: () => insertTextAtCursor('\n1. ') },
        { icon: <Quote className="w-4 h-4" />, tip: 'Trích dẫn', action: () => insertTextAtCursor('\n> ') },
        { divider: true },
        { icon: <LinkIcon className="w-4 h-4" />, tip: 'Chèn link', action: () => insertTextAtCursor('[Tên link](', ')') },
        { icon: <ImageIcon className="w-4 h-4" />, tip: 'Chèn ảnh qua URL', action: () => insertTextAtCursor('![Mô tả](', ')') },
        { divider: true },
        { icon: <Code2 className="w-4 h-4" />, tip: 'Code block', action: () => insertTextAtCursor('\n```\n', '\n```\n') },
        { icon: <span className="text-xs font-bold font-mono italic">fx</span>, tip: 'Công thức toán (LaTeX)', action: () => insertTextAtCursor('\n$$\n', '\n$$\n'), highlight: true },
        { icon: <Table className="w-4 h-4" />, tip: 'Bảng Markdown', action: () => insertTextAtCursor('\n| Cột 1 | Cột 2 | Cột 3 |\n| ----- | ----- | ----- |\n| A     | B     | C     |\n') },
        { divider: true },
        { icon: <AlignLeft className="w-4 h-4" />, tip: 'Căn trái', action: () => insertTextAtCursor('<div align="left">\n\n', '\n\n</div>') },
        { icon: <AlignCenter className="w-4 h-4" />, tip: 'Căn giữa', action: () => insertTextAtCursor('<div align="center">\n\n', '\n\n</div>') },
        { icon: <AlignRight className="w-4 h-4" />, tip: 'Căn phải', action: () => insertTextAtCursor('<div align="right">\n\n', '\n\n</div>') },
        { icon: <AlignJustify className="w-4 h-4" />, tip: 'Căn đều', action: () => insertTextAtCursor('<div align="justify">\n\n', '\n\n</div>') },
    ];

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6 animate-fade-in relative pb-20">
            {/* Toast */}
            {toast && (
                <div
                    className="fixed top-5 right-5 z-50 flex items-start gap-3 px-4 py-3.5 rounded-2xl animate-fade-in"
                    style={{
                        background: '#FFFFFF',
                        border: `1px solid ${toast.type === 'success' ? '#B7D9C4' : toast.type === 'error' ? '#FECACA' : '#E9E9E7'}`,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
                        maxWidth: '340px',
                    }}
                >
                    <div
                        className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                        style={{ background: toast.type === 'success' ? '#EAF3EE' : toast.type === 'error' ? '#FEE2E2' : '#EEF0FB' }}
                    >
                        {toast.type === 'success'
                            ? <CheckCircle className="w-4 h-4" style={{ color: '#448361' }} />
                            : toast.type === 'error'
                                ? <AlertCircle className="w-4 h-4" style={{ color: '#E03E3E' }} />
                                : <RefreshCw className="w-4 h-4 animate-spin" style={{ color: '#6B7CDB' }} />
                        }
                    </div>
                    <p className="text-sm font-medium leading-snug" style={{ color: '#1A1A1A' }}>{toast.msg}</p>
                </div>
            )}


            {/* Top Bar */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <button
                    onClick={onBack}
                    className="flex items-center gap-1.5 text-sm font-medium hover:text-indigo-600 transition-colors"
                    style={{ color: '#787774' }}
                >
                    <ChevronLeft className="w-4 h-4" /> Quay lại
                </button>

                <div className="flex items-center gap-3 flex-wrap">
                    {blog && (
                        <button
                            onClick={handleDelete}
                            disabled={isSaving || isSyncingBlog}
                            className="px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-red-50 text-red-600 transition-colors disabled:opacity-50"
                        >
                            <Trash2 className="w-4 h-4" /> Xóa bài
                        </button>
                    )}

                    <button
                        onClick={() => setIsPreview(!isPreview)}
                        className="px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all"
                        style={{ background: '#F1F0EC', color: '#1A1A1A' }}
                    >
                        {isPreview ? <><PenTool className="w-4 h-4" /> Chỉnh sửa</> : <><Eye className="w-4 h-4" /> Xem trước</>}
                    </button>

                    <button
                        onClick={handleSave}
                        disabled={isSaving || isSyncingBlog}
                        className="px-6 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-60"
                    >
                        <Save className="w-4 h-4" />
                        {isSaving ? 'Đang lưu...' : isSyncingBlog ? 'Đang sync...' : blog ? 'Cập nhật' : 'Đăng bài'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Editor Area */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="space-y-4 p-6 rounded-2xl bg-white border border-[#E9E9E7]">
                        {/* Title */}
                        <div>
                            <label className="block text-sm font-semibold mb-1 text-[#1A1A1A]">Tiêu đề bài viết *</label>
                            <input
                                type="text"
                                placeholder="Nhập tiêu đề hấp dẫn..."
                                className="w-full p-3 rounded-lg border border-[#E9E9E7] outline-none focus:border-indigo-500 font-semibold text-xl"
                                value={formData.title}
                                onChange={e => handleChange('title', e.target.value)}
                                disabled={isPreview}
                            />
                        </div>

                        {/* Summary */}
                        <div>
                            <label className="block text-sm font-semibold mb-1 text-[#1A1A1A]">Tóm tắt ngắn *</label>
                            <textarea
                                placeholder="1-3 câu giới thiệu, hiển thị ở thẻ bài viết..."
                                className="w-full p-3 rounded-lg border border-[#E9E9E7] outline-none focus:border-indigo-500 resize-none"
                                rows={3}
                                value={formData.summary}
                                onChange={e => handleChange('summary', e.target.value)}
                                disabled={isPreview}
                            />
                        </div>

                        {/* Content */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-sm font-semibold text-[#1A1A1A]">Nội dung bài viết *</label>
                                <div className="flex items-center gap-2 text-xs text-[#AEACA8]">
                                    <span>{wordCount} từ · {Math.max(1, Math.ceil(wordCount / 200))} phút đọc</span>
                                    <button
                                        onClick={() => setShowHelper(!showHelper)}
                                        className="p-1 hover:bg-gray-100 rounded text-gray-400 transition-colors"
                                        title="Hướng dẫn Markdown"
                                    >
                                        <HelpCircle className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Toolbar */}
                            {!isPreview && (
                                <div
                                    className="flex flex-wrap items-center gap-0.5 p-2 border border-b-0 rounded-t-lg"
                                    style={{ background: '#F7F6F3', borderColor: '#E9E9E7' }}
                                >
                                    {toolbarButtons.map((btn, i) =>
                                        'divider' in btn ? (
                                            <div key={i} className="w-px h-5 mx-1" style={{ background: '#DCDCDA' }} />
                                        ) : (
                                            <button
                                                key={i}
                                                onClick={btn.action}
                                                title={btn.tip}
                                                className="p-1.5 rounded transition-colors flex items-center justify-center min-w-[28px]"
                                                style={{ color: btn.highlight ? '#6B7CDB' : '#57564F' }}
                                                onMouseEnter={e => (e.currentTarget.style.background = '#E9E9E7')}
                                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                            >
                                                {btn.icon}
                                            </button>
                                        )
                                    )}
                                </div>
                            )}

                            {/* Helper panel */}
                            {showHelper && !isPreview && (
                                <div
                                    className="text-xs p-3 border border-t-0 mb-0 leading-relaxed"
                                    style={{ background: '#EEF0FB', color: '#3D3D8D', borderColor: '#C5CAFA' }}
                                >
                                    <strong>📖 Mẹo nhanh:</strong> <code className="bg-white/60 px-1 rounded">**đậm**</code> · <code className="bg-white/60 px-1 rounded">*nghiêng*</code> · <code className="bg-white/60 px-1 rounded">## Tiêu đề</code> · <code className="bg-white/60 px-1 rounded">$$E=mc^2$$</code> (LaTeX) · <code className="bg-white/60 px-1 rounded">&gt; trích dẫn</code> · <code className="bg-white/60 px-1 rounded">`code`</code>
                                </div>
                            )}

                            {/* Textarea / Preview */}
                            {isPreview ? (
                                <div
                                    className="p-6 rounded-b-lg border min-h-[400px] prose prose-indigo max-w-none"
                                    style={{ background: '#F7F6F3', borderColor: '#E9E9E7' }}
                                >
                                    <ReactMarkdown
                                        remarkPlugins={[remarkMath]}
                                        rehypePlugins={[rehypeKatex, rehypeRaw]}
                                    >
                                        {formData.content || '*Chưa có nội dung*'}
                                    </ReactMarkdown>
                                </div>
                            ) : (
                                <textarea
                                    ref={textareaRef}
                                    id="blog-content-textarea"
                                    placeholder="Nhập nội dung bài viết bằng Markdown... Bắt đầu với ## Tiêu đề"
                                    className="w-full p-4 border border-[#E9E9E7] outline-none focus:border-indigo-500 font-mono text-sm leading-relaxed rounded-b-lg resize-none"
                                    style={{ minHeight: '500px' }}
                                    value={formData.content}
                                    onChange={e => handleChange('content', e.target.value)}
                                    onKeyDown={e => {
                                        // Tab support
                                        if (e.key === 'Tab') {
                                            e.preventDefault();
                                            insertTextAtCursor('  ');
                                        }
                                    }}
                                />
                            )}
                        </div>
                    </div>
                </div>

                {/* Sidebar */}
                <div className="space-y-5">
                    {/* Publish settings */}
                    <div className="p-5 rounded-2xl bg-white border border-[#E9E9E7] space-y-5">
                        <h3 className="font-semibold text-[#1A1A1A]">Cài đặt xuất bản</h3>

                        {/* Toggle publish */}
                        <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: '#F7F6F3', border: '1px solid #E9E9E7' }}>
                            <div>
                                <span className="block font-medium text-sm text-[#1A1A1A]">Trạng thái</span>
                                <span className="text-[11px]" style={{ color: formData.is_published ? '#448361' : '#787774' }}>
                                    {formData.is_published ? '✓ Hiển thị cho học sinh' : '✎ Chỉ Admin thấy'}
                                </span>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={formData.is_published}
                                    onChange={e => handleChange('is_published', e.target.checked)}
                                />
                                <div className="w-9 h-5 bg-[#CFCFCB] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                            </label>
                        </div>

                        {/* Grade Selection */}
                        <div>
                            <label className="block text-sm font-semibold mb-1.5 text-[#1A1A1A]">Khối lớp</label>
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { lab: 'Tất cả khối', val: 0 },
                                    { lab: 'Lớp 12', val: 12 },
                                    { lab: 'Lớp 11', val: 11 },
                                    { lab: 'Lớp 10', val: 10 }
                                ].map(g => (
                                    <button
                                        key={g.val}
                                        type="button"
                                        onClick={() => handleChange('grade', g.val)}
                                        className="py-2 text-xs font-semibold rounded-lg border transition-all"
                                        style={{
                                            background: (formData.grade || 0) === g.val ? '#6B7CDB' : '#FFFFFF',
                                            color: (formData.grade || 0) === g.val ? '#FFFFFF' : '#787774',
                                            borderColor: (formData.grade || 0) === g.val ? '#6B7CDB' : '#E9E9E7'
                                        }}
                                    >
                                        {g.lab}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Category */}
                        <div>
                            <label className="block text-sm font-semibold mb-1.5 text-[#1A1A1A]">Chuyên mục</label>
                            <select
                                className="w-full p-3 rounded-lg border border-[#E9E9E7] outline-none focus:border-indigo-500 text-sm bg-white"
                                value={formData.category}
                                onChange={e => handleChange('category', e.target.value)}
                            >
                                <option value="">-- Chọn chuyên mục --</option>
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            {/* Hoặc nhập tùy chỉnh */}
                            <input
                                type="text"
                                placeholder="Hoặc nhập tùy chỉnh..."
                                className="w-full mt-2 p-2.5 rounded-lg border border-[#E9E9E7] outline-none focus:border-indigo-500 text-sm"
                                value={formData.category}
                                onChange={e => handleChange('category', e.target.value)}
                            />
                        </div>

                        {/* Tags */}
                        <div>
                            <label className="block text-sm font-semibold mb-1.5 text-[#1A1A1A]">Thẻ (Tags)</label>
                            <input
                                type="text"
                                placeholder="VD: vatly12, dongdien, nangluong"
                                className="w-full p-3 rounded-lg border border-[#E9E9E7] outline-none focus:border-indigo-500 text-sm"
                                value={(formData.tags || []).join(', ')}
                                onChange={e => handleTagsChange(e.target.value)}
                            />
                            <p className="text-[11px] mt-1" style={{ color: '#AEACA8' }}>Ngăn cách bằng dấu phẩy</p>
                            {(formData.tags || []).length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                    {(formData.tags || []).map(tag => (
                                        <span key={tag} className="text-xs px-2 py-0.5 rounded-md flex items-center gap-1" style={{ background: '#EEF0FB', color: '#6B7CDB' }}>
                                            #{tag}
                                            <button onClick={() => handleChange('tags', (formData.tags || []).filter(t => t !== tag))} className="hover:text-red-500">
                                                <X className="w-3 h-3" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Quick stats */}
                    <div className="p-5 rounded-2xl bg-white border border-[#E9E9E7]">
                        <h3 className="font-semibold text-[#1A1A1A] mb-3">Thống kê bài viết</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span style={{ color: '#787774' }}>Số từ</span>
                                <span className="font-medium" style={{ color: '#1A1A1A' }}>{wordCount.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span style={{ color: '#787774' }}>P.đọc ước tính</span>
                                <span className="font-medium" style={{ color: '#1A1A1A' }}>{Math.max(1, Math.ceil(wordCount / 200))} phút</span>
                            </div>
                            <div className="flex justify-between">
                                <span style={{ color: '#787774' }}>Số ký tự</span>
                                <span className="font-medium" style={{ color: '#1A1A1A' }}>{(formData.content || '').length.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default AdminBlogEditor;
