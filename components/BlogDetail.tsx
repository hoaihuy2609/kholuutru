import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import 'katex/dist/katex.min.css';
import { BlogPost } from '../types';
import { Calendar, ChevronLeft, Tag, Clock, Copy, Check, List } from 'lucide-react';
import SolutionRenderer from './SolutionRenderer';

interface BlogDetailProps {
    blog: BlogPost;
    onBack: () => void;
    relatedBlogs?: BlogPost[];
    onReadRelated?: (blog: BlogPost) => void;
}

const estimateReadTime = (content: string): number => {
    try {
        const p = JSON.parse(content);
        if (p.type === 'physics_solution') return 0; // JSON blob — không tính thời gian đọc
    } catch (_) {}
    return Math.max(1, Math.ceil(content.trim().split(/\s+/).length / 200));
};

// Trích xuất heading từ markdown để tạo mục lục
interface Heading { id: string; text: string; level: number }
const extractHeadings = (content: string): Heading[] => {
    const regex = /^(#{1,3})\s+(.+)$/gm;
    const headings: Heading[] = [];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
        const text = match[2].replace(/\*\*/g, '').replace(/\*/g, '').trim();
        headings.push({
            level: match[1].length,
            text,
            id: text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
        });
    }
    return headings;
};

// Code block với nút copy
const CodeBlock: React.FC<{ children?: React.ReactNode; className?: string }> = ({ children, className }) => {
    const [copied, setCopied] = useState(false);
    const code = typeof children === 'string' ? children : String(children || '');

    const handleCopy = () => {
        navigator.clipboard.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <div className="relative my-6 rounded-xl overflow-hidden" style={{ background: '#1e1e2e' }}>
            <div className="flex items-center justify-between px-4 py-2" style={{ background: '#12121a', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <span className="text-xs font-mono" style={{ color: '#7c7c9a' }}>
                    {className?.replace('language-', '') || 'code'}
                </span>
                <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-md transition-all"
                    style={{ color: copied ? '#a6e3a1' : '#7c7c9a', background: 'rgba(255,255,255,0.05)' }}
                >
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copied ? 'Đã copy!' : 'Copy'}
                </button>
            </div>
            <pre className="p-4 overflow-x-auto font-mono text-sm leading-relaxed" style={{ color: '#cdd6f4', margin: 0 }}>
                <code>{children}</code>
            </pre>
        </div>
    );
};

const BlogDetail: React.FC<BlogDetailProps> = ({ blog, onBack, relatedBlogs = [], onReadRelated }) => {
    const [showToc, setShowToc] = useState(false);
    const [activeHeading, setActiveHeading] = useState('');
    const [readProgress, setReadProgress] = useState(0);
    const [showScrollTop, setShowScrollTop] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);

    const headings = useMemo(() => extractHeadings(blog.content), [blog.content]);
    const readTime = useMemo(() => estimateReadTime(blog.content), [blog.content]);

    // Reading progress bar + scroll-to-top
    useEffect(() => {
        const handleScroll = () => {
            const scrollTop = window.scrollY;
            const docHeight = document.documentElement.scrollHeight - window.innerHeight;
            setReadProgress(docHeight > 0 ? Math.min(100, (scrollTop / docHeight) * 100) : 0);
            setShowScrollTop(scrollTop > 400);
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Scroll spy: highlight heading đang đọc
    useEffect(() => {
        if (headings.length === 0) return;
        const observer = new IntersectionObserver(
            entries => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        setActiveHeading(entry.target.id);
                        break;
                    }
                }
            },
            { rootMargin: '-20% 0px -70% 0px' }
        );
        const el = contentRef.current;
        if (el) {
            el.querySelectorAll('h1[id], h2[id], h3[id]').forEach(h => observer.observe(h));
        }
        return () => observer.disconnect();
    }, [headings]);

    const scrollToHeading = (id: string) => {
        const el = document.getElementById(id);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setShowToc(false);
        }
    };

    const makeId = (text: string) =>
        String(text).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    const parsedSolution = useMemo(() => {
        try {
            const parsed = JSON.parse(blog.content);
            if (parsed.type === 'physics_solution') return parsed;
        } catch (e) { }
        return null;
    }, [blog.content]);

    if (parsedSolution) {
        return (
            <div className="max-w-4xl mx-auto p-4 md:p-8 animate-fade-in relative pb-20">
                <button
                    onClick={onBack}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        fontSize: '13px', fontWeight: 500, color: '#787774',
                        background: 'none', border: 'none', cursor: 'pointer',
                        marginBottom: '28px', padding: '6px 10px 6px 4px', borderRadius: '8px',
                        transition: 'all 0.15s'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#F1F0EC'; e.currentTarget.style.color = '#1A1A1A'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#787774'; }}
                >
                    <ChevronLeft style={{ width: '16px', height: '16px' }} /> Quay lại
                </button>
                <div style={{ position: 'relative' }}>
                    <SolutionRenderer content={blog.content} />
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-8 animate-fade-in relative pb-20">
            {/* Reading Progress Bar */}
            <div style={{
                position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
                height: '3px', background: '#F0F0EE'
            }}>
                <div style={{
                    height: '100%', width: `${readProgress}%`,
                    background: 'linear-gradient(90deg, #6B7CDB, #9065B0)',
                    transition: 'width 0.1s linear', borderRadius: '0 2px 2px 0'
                }} />
            </div>

            {/* Back Button */}
            <button
                onClick={onBack}
                style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    fontSize: '13px', fontWeight: 500, color: '#787774',
                    background: 'none', border: 'none', cursor: 'pointer',
                    marginBottom: '28px', padding: '6px 10px 6px 4px', borderRadius: '8px',
                    transition: 'all 0.15s'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#F1F0EC'; e.currentTarget.style.color = '#1A1A1A'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#787774'; }}
            >
                <ChevronLeft style={{ width: '16px', height: '16px' }} /> Quay lại
            </button>

            {/* Header Info */}
            <div style={{ marginBottom: '28px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                    {blog.category && (
                        <span style={{
                            fontSize: '10px', textTransform: 'uppercase', fontWeight: 700,
                            padding: '4px 10px', borderRadius: '6px',
                            background: '#EEF0FB', color: '#6B7CDB', letterSpacing: '0.03em'
                        }}>
                            {blog.category}
                        </span>
                    )}
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#AEACA8' }}>
                        <Calendar style={{ width: '13px', height: '13px' }} />
                        {new Date(blog.created_at).toLocaleDateString('vi-VN', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>
                    {readTime > 0 && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#AEACA8' }}>
                        <Clock style={{ width: '13px', height: '13px' }} />
                        {readTime} phút đọc
                    </span>
                    )}
                    {headings.length > 2 && (
                        <button
                            onClick={() => setShowToc(!showToc)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '5px',
                                fontSize: '12px', fontWeight: 600, padding: '4px 12px', borderRadius: '6px',
                                border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                                background: showToc ? '#EEF0FB' : '#F1F0EC',
                                color: showToc ? '#6B7CDB' : '#57564F'
                            }}
                        >
                            <List style={{ width: '13px', height: '13px' }} />
                            Mục lục
                        </button>
                    )}
                </div>

                <h1 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 700, lineHeight: 1.25, color: '#1A1A1A', marginBottom: '12px' }}>
                    {blog.title}
                </h1>

                <p style={{ fontSize: '16px', fontStyle: 'italic', lineHeight: 1.7, color: '#787774' }}>
                    "{blog.summary}"
                </p>

                {blog.tags && blog.tags.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '12px' }}>
                        <Tag style={{ width: '13px', height: '13px', color: '#AEACA8' }} />
                        {blog.tags.map(tag => (
                            <span key={tag} style={{
                                fontSize: '11px', padding: '3px 8px', borderRadius: '5px',
                                background: '#F1F0EC', color: '#57564F', fontWeight: 500
                            }}>#{tag}</span>
                        ))}
                    </div>
                )}
            </div>

            {/* Table of Contents */}
            {showToc && headings.length > 0 && (
                <div
                    className="mb-8 p-5 rounded-2xl"
                    style={{ background: '#F7F6F3', border: '1px solid var(--color-border)' }}
                >
                    <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#AEACA8' }}>Mục lục</p>
                    <nav className="space-y-1.5">
                        {headings.map((h, i) => (
                            <button
                                key={i}
                                onClick={() => scrollToHeading(h.id)}
                                className="block w-full text-left text-sm transition-colors hover:text-indigo-600 truncate"
                                style={{
                                    paddingLeft: `${(h.level - 1) * 16}px`,
                                    color: activeHeading === h.id ? '#6B7CDB' : 'var(--color-text-secondary)',
                                    fontWeight: h.level === 1 ? 600 : 400
                                }}
                            >
                                {h.level === 1 ? '▸ ' : h.level === 2 ? '• ' : '◦ '}
                                {h.text}
                            </button>
                        ))}
                    </nav>
                </div>
            )}

            <div className="h-px w-full mb-8" style={{ background: 'linear-gradient(to right, transparent, var(--color-border), transparent)' }} />

            {/* Cover Image */}
            {blog.cover_image && (
                <div className="rounded-2xl overflow-hidden shadow-sm mb-10" style={{ border: '1px solid var(--color-border)' }}>
                    <img src={blog.cover_image} alt={blog.title} className="w-full h-auto max-h-[500px] object-cover" />
                </div>
            )}

            {/* Content */}
            <div ref={contentRef} className="prose prose-lg max-w-none" style={{ fontFamily: "'Inter', 'Georgia', serif" }}>
                <ReactMarkdown
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[rehypeKatex, rehypeRaw]}
                    components={{
                        h1: ({ node, children, ...props }: any) => {
                            const text = String(children);
                            const id = makeId(text);
                            return <h1 id={id} className="text-3xl font-bold mt-12 mb-5 pb-3 scroll-mt-24" style={{ color: 'var(--color-text-primary)', borderBottom: '1px solid var(--color-border)' }} {...props}>{children}</h1>;
                        },
                        h2: ({ node, children, ...props }: any) => {
                            const text = String(children);
                            const id = makeId(text);
                            return <h2 id={id} className="text-2xl font-bold mt-10 mb-4 scroll-mt-24" style={{ color: 'var(--color-text-primary)' }} {...props}>{children}</h2>;
                        },
                        h3: ({ node, children, ...props }: any) => {
                            const text = String(children);
                            const id = makeId(text);
                            return <h3 id={id} className="text-xl font-bold mt-8 mb-3 scroll-mt-24" style={{ color: 'var(--color-text-primary)' }} {...props}>{children}</h3>;
                        },
                        p: ({ node, ...props }: any) => (
                            <p className="mb-6 leading-[1.85] text-lg" style={{ color: 'var(--color-text-primary)' }} {...props} />
                        ),
                        ul: ({ node, ...props }: any) => (
                            <ul className="list-disc pl-6 mb-6 space-y-2" style={{ color: 'var(--color-text-primary)' }} {...props} />
                        ),
                        ol: ({ node, ...props }: any) => (
                            <ol className="list-decimal pl-6 mb-6 space-y-2" style={{ color: 'var(--color-text-primary)' }} {...props} />
                        ),
                        li: ({ node, ...props }: any) => (
                            <li className="pl-2 leading-[1.8] text-[17px]" style={{ color: 'var(--color-text-primary)' }} {...props} />
                        ),
                        blockquote: ({ node, ...props }: any) => (
                            <blockquote
                                className="border-l-4 pl-5 py-3 my-8 rounded-r-xl"
                                style={{ borderColor: '#6B7CDB', background: '#EEF0FB', color: '#3D3D8D' }}
                                {...props}
                            />
                        ),
                        code: ({ node, inline, className, children, ...props }: any) =>
                            inline ? (
                                <code
                                    className="px-1.5 py-0.5 rounded text-sm font-mono"
                                    style={{ background: '#F1F0EC', color: '#E03E3E' }}
                                    {...props}
                                >
                                    {children}
                                </code>
                            ) : (
                                <CodeBlock className={className}>{children}</CodeBlock>
                            ),
                        pre: ({ node, ...props }: any) => <>{props.children}</>,
                        a: ({ node, ...props }: any) => (
                            <a
                                className="font-medium underline underline-offset-3 decoration-[#6B7CDB]/40 hover:decoration-[#6B7CDB]"
                                style={{ color: '#6B7CDB' }}
                                target="_blank"
                                rel="noopener noreferrer"
                                {...props}
                            />
                        ),
                        img: ({ node, ...props }: any) => (
                            <span className="block my-10 text-center">
                                <img
                                    className="rounded-xl shadow-md inline-block max-w-full h-auto"
                                    style={{ border: '1px solid var(--color-border)' }}
                                    loading="lazy"
                                    {...props}
                                />
                                {props.alt && (
                                    <span className="block text-sm mt-2 italic" style={{ color: '#AEACA8' }}>{props.alt}</span>
                                )}
                            </span>
                        ),
                        hr: () => (
                            <div className="my-10 h-px" style={{ background: 'linear-gradient(to right, transparent, var(--color-border), transparent)' }} />
                        ),
                        table: ({ node, ...props }: any) => (
                            <div className="overflow-x-auto my-6 rounded-xl" style={{ border: '1px solid var(--color-border)' }}>
                                <table className="w-full text-sm" {...props} />
                            </div>
                        ),
                        thead: ({ node, ...props }: any) => (
                            <thead style={{ background: '#F7F6F3' }} {...props} />
                        ),
                        th: ({ node, ...props }: any) => (
                            <th className="px-4 py-3 text-left font-semibold text-sm" style={{ color: 'var(--color-text-primary)', borderBottom: '1px solid var(--color-border)' }} {...props} />
                        ),
                        td: ({ node, ...props }: any) => (
                            <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border)' }} {...props} />
                        ),
                    }}
                >
                    {blog.content}
                </ReactMarkdown>
            </div>

            {/* Related Posts */}
            {relatedBlogs.length > 0 && (
                <div className="mt-16 pt-10" style={{ borderTop: '1px solid var(--color-border)' }}>
                    <h3 className="text-lg font-bold mb-6" style={{ color: 'var(--color-text-primary)' }}>Bài viết liên quan</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {relatedBlogs.map(related => (
                            <button
                                key={related.id}
                                onClick={() => onReadRelated ? onReadRelated(related) : onBack()}
                                className="text-left p-4 rounded-xl transition-all hover:-translate-y-0.5 hover:shadow-md"
                                style={{ background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)' }}
                            >
                                {related.category && (
                                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-[#EEF0FB] text-[#6B7CDB] mb-2 inline-block">
                                        {related.category}
                                    </span>
                                )}
                                <p className="font-semibold text-sm line-clamp-2 mb-1" style={{ color: 'var(--color-text-primary)' }}>
                                    {related.title}
                                </p>
                                <p className="text-xs" style={{ color: '#AEACA8' }}>
                                    {estimateReadTime(related.content)} phút đọc
                                </p>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Scroll to Top */}
            {showScrollTop && (
                <button
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    className="animate-fade-in"
                    style={{
                        position: 'fixed', bottom: '24px', right: '24px', zIndex: 40,
                        width: '42px', height: '42px', borderRadius: '12px',
                        background: '#fff', border: '1px solid #E9E9E7',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', transition: 'all 0.2s',
                        color: '#787774', fontSize: '18px'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#6B7CDB'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#6B7CDB'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#787774'; e.currentTarget.style.borderColor = '#E9E9E7'; }}
                    title="Về đầu trang"
                >
                    ↑
                </button>
            )}
        </div>
    );
};

export default BlogDetail;
