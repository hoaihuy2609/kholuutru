import React, { useState, useEffect } from 'react';
import { BlogPost } from '../types';
import { useCloudStorage } from '../src/hooks/useCloudStorage';
import { ChevronLeft, Save, Trash2, Eye, PenTool, Bold, Italic, List, ImageIcon, Link as LinkIcon, HelpCircle, AlignLeft, AlignCenter, AlignRight, AlignJustify } from 'lucide-react';
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

const AdminBlogEditor: React.FC<AdminBlogEditorProps> = ({ blog, onBack, onSaved }) => {
    const { saveBlog, deleteBlog } = useCloudStorage();

    const [formData, setFormData] = useState<Partial<BlogPost>>({
        title: '',
        summary: '',
        content: '',
        cover_image: '',
        category: '',
        tags: [],
        is_published: false,
    });
    const [isPreview, setIsPreview] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showHelper, setShowHelper] = useState(false);

    useEffect(() => {
        if (blog) {
            setFormData({
                id: blog.id,
                title: blog.title,
                summary: blog.summary,
                content: blog.content,
                cover_image: blog.cover_image,
                category: blog.category,
                tags: blog.tags || [],
                is_published: blog.is_published,
            });
        }
    }, [blog]);

    const handleChange = (field: keyof BlogPost, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleTagsChange = (val: string) => {
        const tags = val.split(',').map(t => t.trim()).filter(t => t);
        handleChange('tags', tags);
    };

    const handleSave = async () => {
        setIsSaving(true);
        const saved = await saveBlog(formData);
        setIsSaving(false);
        if (saved) {
            onSaved(saved);
        } else {
            alert('Lỗi khi lưu bài viết!');
        }
    };

    const handleDelete = async () => {
        if (blog && window.confirm('Bạn có chắc chắn muốn xóa bài viết này vĩnh viễn?')) {
            setIsSaving(true);
            const ok = await deleteBlog(blog.id);
            setIsSaving(false);
            if (ok) {
                onBack();
            } else {
                alert('Lỗi khi xóa bài viết!');
            }
        }
    };

    const insertTextAtCursor = (prefix: string, suffix: string = '') => {
        const textarea = document.getElementById('blog-content-textarea') as HTMLTextAreaElement;
        if (!textarea) return;

        const startPos = textarea.selectionStart;
        const endPos = textarea.selectionEnd;
        const currentText = formData.content || '';

        let newText;
        let newCursorPos;

        if (startPos !== endPos) {
            // Text is selected
            const selectedText = currentText.substring(startPos, endPos);
            newText = currentText.substring(0, startPos) + prefix + selectedText + suffix + currentText.substring(endPos);
            newCursorPos = startPos + prefix.length + selectedText.length + suffix.length;
        } else {
            // No text selected
            newText = currentText.substring(0, startPos) + prefix + suffix + currentText.substring(endPos);
            newCursorPos = startPos + prefix.length;
        }

        handleChange('content', newText);

        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
    };
    return (
        <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6 animate-fade-in relative pb-20">
            {/* Top Bar */}
            <div className="flex items-center justify-between">
                <button
                    onClick={onBack}
                    className="flex items-center gap-1.5 text-sm font-medium hover:text-indigo-600 transition-colors"
                    style={{ color: '#787774' }}
                >
                    <ChevronLeft className="w-4 h-4" /> Quay lại
                </button>

                <div className="flex items-center gap-3">
                    {blog && (
                        <button
                            onClick={handleDelete}
                            disabled={isSaving}
                            className="px-4 py-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 hover:bg-red-50 text-red-600 transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                            Xóa bài
                        </button>
                    )}

                    <button
                        onClick={() => setIsPreview(!isPreview)}
                        className="px-4 py-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                        style={{ background: '#F1F0EC', color: '#1A1A1A' }}
                    >
                        {isPreview ? <><PenTool className="w-4 h-4" /> Chỉnh sửa</> : <><Eye className="w-4 h-4" /> Xem trước</>}
                    </button>

                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-6 py-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-50"
                    >
                        <Save className="w-4 h-4" />
                        {isSaving ? 'Đang lưu...' : 'Lưu & Cập nhật'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Editor Area */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="space-y-4 p-6 rounded-2xl bg-white border border-[#E9E9E7]">
                        <div>
                            <label className="block text-sm font-semibold mb-1 text-[#1A1A1A]">Tiêu đề bài viết</label>
                            <input
                                type="text"
                                placeholder="Nhập tiêu đề..."
                                className="w-full p-3 rounded-lg border border-[#E9E9E7] outline-none focus:border-indigo-500 font-semibold text-xl"
                                value={formData.title}
                                onChange={e => handleChange('title', e.target.value)}
                                disabled={isPreview}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold mb-1 text-[#1A1A1A]">Tóm tắt (hiển thị ở thẻ)</label>
                            <textarea
                                placeholder="Một vài dòng giới thiệu ngắn gọn..."
                                className="w-full p-3 rounded-lg border border-[#E9E9E7] outline-none focus:border-indigo-500 min-h-[80px]"
                                value={formData.summary}
                                onChange={e => handleChange('summary', e.target.value)}
                                disabled={isPreview}
                            />
                        </div>

                        <div>
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-sm font-semibold text-[#1A1A1A]">
                                        Nội dung (Nên học cách dùng Markdown)
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setShowHelper(!showHelper)}
                                            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
                                            title="Hướng dẫn gõ Markdown"
                                        >
                                            <HelpCircle className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {!isPreview && (
                                    <div className="flex flex-wrap items-center gap-1 p-2 bg-[#F7F6F3] border border-b-0 border-[#E9E9E7] rounded-t-lg">
                                        <button onClick={() => insertTextAtCursor('**', '** ')} className="p-1.5 hover:bg-[#E9E9E7] rounded text-[#57564F] transition-colors" title="In đậm"><Bold className="w-4 h-4" /></button>
                                        <button onClick={() => insertTextAtCursor('*', '* ')} className="p-1.5 hover:bg-[#E9E9E7] rounded text-[#57564F] transition-colors" title="In nghiêng"><Italic className="w-4 h-4" /></button>
                                        <div className="w-px h-4 bg-[#DCDCDA] mx-1"></div>
                                        <button onClick={() => insertTextAtCursor('\n- ')} className="p-1.5 hover:bg-[#E9E9E7] rounded text-[#57564F] transition-colors" title="Đánh Bullet"><List className="w-4 h-4" /></button>
                                        <div className="w-px h-4 bg-[#DCDCDA] mx-1"></div>
                                        <button onClick={() => insertTextAtCursor('![Mô tả ảnh](Link_ảnh_vào_đây)\n')} className="p-1.5 hover:bg-[#E9E9E7] rounded text-[#57564F] transition-colors" title="Chèn Ảnh (Dùng link)"><ImageIcon className="w-4 h-4" /></button>
                                        <button onClick={() => insertTextAtCursor('[Tên đường dẫn](Link_vào_đây) ')} className="p-1.5 hover:bg-[#E9E9E7] rounded text-[#57564F] transition-colors" title="Chèn Link"><LinkIcon className="w-4 h-4" /></button>
                                        <div className="w-px h-4 bg-[#DCDCDA] mx-1"></div>
                                        <button onClick={() => insertTextAtCursor('\n$$\n', '\n$$\n')} className="p-1.5 hover:bg-[#E9E9E7] rounded text-indigo-600 font-bold transition-colors text-sm font-mono" title="Chèn công thức Toán/Lý">fx</button>
                                        <div className="w-px h-4 bg-[#DCDCDA] mx-1"></div>
                                        <button onClick={() => insertTextAtCursor('<div align="left">\n\n', '\n\n</div>')} className="p-1.5 hover:bg-[#E9E9E7] rounded text-[#57564F] transition-colors" title="Căn trái"><AlignLeft className="w-4 h-4" /></button>
                                        <button onClick={() => insertTextAtCursor('<div align="center">\n\n', '\n\n</div>')} className="p-1.5 hover:bg-[#E9E9E7] rounded text-[#57564F] transition-colors" title="Căn giữa"><AlignCenter className="w-4 h-4" /></button>
                                        <button onClick={() => insertTextAtCursor('<div align="right">\n\n', '\n\n</div>')} className="p-1.5 hover:bg-[#E9E9E7] rounded text-[#57564F] transition-colors" title="Căn phải"><AlignRight className="w-4 h-4" /></button>
                                        <button onClick={() => insertTextAtCursor('<div align="justify">\n\n', '\n\n</div>')} className="p-1.5 hover:bg-[#E9E9E7] rounded text-[#57564F] transition-colors" title="Căn đều hai bên"><AlignJustify className="w-4 h-4" /></button>
                                    </div>
                                )}

                                {showHelper && !isPreview && (
                                    <div className="text-xs p-3 bg-indigo-50 text-indigo-800 rounded-b-lg border border-indigo-100 border-t-0 mb-2 leading-relaxed">
                                        <strong>Mẹo Markdown nhanh:</strong><br />
                                        - Chèn chữ: Dùng cách số 1 (chụp ảnh gõ LaTeX) copy vào giữa 2 dấu $$, ví dụ: <code className="bg-white px-1">$$ \frac{1}{2}mv^2 $$</code><br />
                                        - In nghiêng kẹp dấu *: <code className="bg-white px-1">*in nghiêng*</code><br />
                                        - In đậm kẹp 2 dấu sao: <code className="bg-white px-1">**in đậm**</code>
                                    </div>
                                )}

                                {isPreview ? (
                                    <div
                                        className="p-6 rounded-b-lg border border-[#E9E9E7] min-h-[400px] prose prose-indigo max-w-none bg-[#F7F6F3]"
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
                                        id="blog-content-textarea"
                                        placeholder="Nhập nội dung bài viết..."
                                        className={`w-full p-4 border border-[#E9E9E7] outline-none focus:border-indigo-500 min-h-[500px] font-mono text-sm leading-relaxed ${showHelper ? 'rounded-b-lg' : 'rounded-b-lg'}`}
                                        value={formData.content}
                                        onChange={e => handleChange('content', e.target.value)}
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sidebar Settings */}
                <div className="space-y-6">
                    <div className="p-6 rounded-2xl bg-white border border-[#E9E9E7] space-y-5">
                        <h3 className="font-semibold text-[#1A1A1A] text-lg mb-2">Cài đặt bài viết</h3>

                        {/* Trạng thái xuất bản */}
                        <div className="flex items-center justify-between p-3 rounded-xl border border-[#E9E9E7] bg-[#F7F6F3]">
                            <div>
                                <span className="block font-medium text-sm text-[#1A1A1A]">Trạng thái</span>
                                <span className="text-[11px] text-[#787774]">{formData.is_published ? 'Hiển thị cho học sinh' : 'Chỉ Admin thấy'}</span>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={formData.is_published}
                                    onChange={(e) => handleChange('is_published', e.target.checked)}
                                    disabled={isPreview}
                                />
                                <div className={"w-9 h-5 bg-[#CFCFCB] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#AEACA8] after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"}></div>
                            </label>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold mb-1 text-[#1A1A1A]">Chuyên mục</label>
                            <input
                                type="text"
                                placeholder="VD: Lý thuyết, Tin tức, Mẹo vặt"
                                className="w-full p-3 rounded-lg border border-[#E9E9E7] outline-none focus:border-indigo-500 text-sm"
                                value={formData.category}
                                onChange={e => handleChange('category', e.target.value)}
                                disabled={isPreview}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold mb-1 text-[#1A1A1A]">Thẻ (Tags)</label>
                            <input
                                type="text"
                                placeholder="Ngăn cách bằng dấu phẩy (VD: bai12, dongluc)"
                                className="w-full p-3 rounded-lg border border-[#E9E9E7] outline-none focus:border-indigo-500 text-sm"
                                value={(formData.tags || []).join(', ')}
                                onChange={e => handleTagsChange(e.target.value)}
                                disabled={isPreview}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold mb-1 text-[#1A1A1A]">Ảnh đại diện (URL)</label>
                            <input
                                type="url"
                                placeholder="https://example.com/image.jpg"
                                className="w-full p-3 rounded-lg border border-[#E9E9E7] outline-none focus:border-indigo-500 text-sm"
                                value={formData.cover_image}
                                onChange={e => handleChange('cover_image', e.target.value)}
                                disabled={isPreview}
                            />
                            {formData.cover_image && (
                                <div className="mt-3 rounded-lg overflow-hidden border border-[#E9E9E7] bg-[#F7F6F3]">
                                    <img src={formData.cover_image} alt="Cover Preview" className="w-full h-32 object-cover" />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminBlogEditor;
