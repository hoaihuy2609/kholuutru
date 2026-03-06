import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import 'katex/dist/katex.min.css';
import { BlogPost } from '../types';
import { Calendar, ChevronLeft, Tag } from 'lucide-react';

interface BlogDetailProps {
    blog: BlogPost;
    onBack: () => void;
}

const BlogDetail: React.FC<BlogDetailProps> = ({ blog, onBack }) => {
    return (
        <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8 animate-fade-in relative pb-20">
            {/* Back Button */}
            <button
                onClick={onBack}
                className="flex items-center gap-1.5 text-sm font-medium hover:text-indigo-600 transition-colors"
                style={{ color: '#787774' }}
            >
                <ChevronLeft className="w-4 h-4" /> Quay lại danh sách
            </button>

            {/* Header Info */}
            <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                    {blog.category && (
                        <span className="text-[12px] uppercase font-bold px-3 py-1 rounded-full bg-[#EEF0FB] text-[#6B7CDB]">
                            {blog.category}
                        </span>
                    )}
                    <span className="flex items-center gap-1.5 text-sm" style={{ color: '#AEACA8' }}>
                        <Calendar className="w-4 h-4" />
                        {new Date(blog.created_at).toLocaleDateString('vi-VN')}
                    </span>
                </div>

                <h1 className="text-3xl md:text-5xl font-bold leading-tight" style={{ color: '#1A1A1A' }}>
                    {blog.title}
                </h1>

                <p className="text-xl md:text-2xl font-light italic leading-relaxed" style={{ color: '#787774' }}>
                    "{blog.summary}"
                </p>

                {blog.tags && blog.tags.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap pt-2">
                        <Tag className="w-4 h-4" style={{ color: '#AEACA8' }} />
                        {blog.tags.map(tag => (
                            <span key={tag} className="text-xs px-2 py-1 rounded bg-[#F1F0EC] text-[#57564F]">
                                #{tag}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            <div className="h-px w-full my-6 bg-gradient-to-r from-[#F1F0EC] via-[#E9E9E7] to-[#F1F0EC]" />

            {/* Cover Image */}
            {blog.cover_image && (
                <div className="rounded-2xl overflow-hidden shadow-sm" style={{ border: '1px solid #E9E9E7' }}>
                    <img src={blog.cover_image} alt={blog.title} className="w-full h-auto max-h-[500px] object-cover" />
                </div>
            )}

            {/* Content Rendering */}
            <div
                className="prose prose-lg max-w-none text-[#1A1A1A] leading-relaxed"
                style={{
                    '--tw-prose-body': '#1A1A1A',
                    '--tw-prose-headings': '#1A1A1A',
                    '--tw-prose-links': '#6B7CDB',
                    fontFamily: 'Inter, sans-serif'
                } as any}
            >
                <ReactMarkdown
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[rehypeKatex, rehypeRaw]}
                    components={{
                        h1: ({ node, ...props }: any) => <h1 className="text-3xl font-bold mt-10 mb-5 pb-2 border-b border-[#F1F0EC]" {...props} />,
                        h2: ({ node, ...props }: any) => <h2 className="text-2xl font-bold mt-8 mb-4 text-[#1A1A1A]" {...props} />,
                        h3: ({ node, ...props }: any) => <h3 className="text-xl font-bold mt-6 mb-3 text-[#1A1A1A]" {...props} />,
                        p: ({ node, ...props }: any) => <p className="mb-6 leading-[1.8] text-[#333333]" {...props} />,
                        ul: ({ node, ...props }: any) => <ul className="list-disc pl-6 mb-6 space-y-2 text-[#333333]" {...props} />,
                        ol: ({ node, ...props }: any) => <ol className="list-decimal pl-6 mb-6 space-y-2 text-[#333333]" {...props} />,
                        li: ({ node, ...props }: any) => <li className="pl-2 leading-[1.8]" {...props} />,
                        blockquote: ({ node, ...props }: any) => (
                            <blockquote
                                className="border-l-4 pl-4 py-2 my-6 italic text-[#57564F] bg-[#F7F6F3] rounded-r-lg"
                                style={{ borderColor: '#6B7CDB' }}
                                {...props}
                            />
                        ),
                        code: ({ node, inline, ...props }: any) =>
                            inline ? (
                                <code className="bg-[#F1F0EC] text-[#E03E3E] px-1.5 py-0.5 rounded text-sm font-mono" {...props} />
                            ) : (
                                <pre className="bg-[#1A1A1A] text-[#F7F6F3] p-4 rounded-xl overflow-x-auto my-6 font-mono text-sm leading-relaxed" {...props} />
                            ),
                        a: ({ node, ...props }: any) => <a className="text-[#6B7CDB] hover:underline font-medium" {...props} />,
                        img: ({ node, ...props }: any) => (
                            <span className="block my-8">
                                <img className="rounded-xl shadow-sm border border-[#E9E9E7] max-w-full h-auto mx-auto" {...props} />
                                {props.alt && <span className="block text-center text-sm text-[#AEACA8] mt-2 italic">{props.alt}</span>}
                            </span>
                        ),
                    }}
                >
                    {blog.content}
                </ReactMarkdown>
            </div>
        </div >
    );
};

export default BlogDetail;
