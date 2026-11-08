import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BlogPost } from '../types';
import { BookOpen, Plus, Search, Filter, FileText, Check, Sparkles, ChevronLeft, Folder, X, RotateCcw } from 'lucide-react';
import ExamStyleModal from './ExamStyleModal';
import TreeTableOfContents, { indexFolderBlogs, loadPhysicsTree, savePhysicsTree, selectTreeNode, TreeNode, TreeSelection } from './TreeTableOfContents';
import { SelectedQuestionItem } from '../src/services/examLatexService';
import { CLOUDFLARE_PROXY_URL } from '../src/lib/telegram';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// ─────────────────────────────────────────────────────────────
// Mini renderers — tái sử dụng logic của SolutionRenderer để
// hiển thị đề bài trực tiếp trên card (đồng nhất 100% với
// giao diện chi tiết khi click vào)
// ─────────────────────────────────────────────────────────────

function KatexInlineCard({ tex }: { tex: string }) {
    const ref = useRef<HTMLSpanElement>(null);
    useEffect(() => {
        if (!ref.current || !tex?.trim()) return;
        try { katex.render(tex, ref.current, { throwOnError: false, displayMode: false }); }
        catch (_) {}
    }, [tex]);
    return <span ref={ref} />;
}

function KatexBlockCard({ tex }: { tex: string }) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!ref.current || !tex?.trim()) return;
        try { katex.render(tex, ref.current, { throwOnError: false, displayMode: true }); }
        catch (_) {}
    }, [tex]);
    return <div ref={ref} style={{ textAlign: 'center', padding: '4px 0', overflowX: 'auto' }} />;
}

function renderMathCard(text: string): React.ReactNode[] {
    return text.split(/(\$[^$]+\$|\\\([^)]*\\\))/g).map((part, i) => {
        if (part.startsWith('$') && part.endsWith('$') && part.length > 1)
            return <KatexInlineCard key={i} tex={part.slice(1, -1)} />;
        if (part.startsWith('\\(') && part.endsWith('\\)') && part.length > 3)
            return <KatexInlineCard key={i} tex={part.slice(2, -2)} />;
        return <span key={i}>{part}</span>;
    });
}

function TextWithMathCard({ text }: { text: string }) {
    if (!text) return null;
    return (
        <>
            {text.split(/(\[center\][\s\S]*?\[\/center\]|\[justify\][\s\S]*?\[\/justify\])/g).map((block, i) => {
                if (block.startsWith('[center]') && block.endsWith('[/center]'))
                    return <div key={i} style={{ textAlign: 'center' }}>{renderMathCard(block.slice(8, -9))}</div>;
                if (block.startsWith('[justify]') && block.endsWith('[/justify]'))
                    return <div key={i} style={{ textAlign: 'justify' }}>{renderMathCard(block.slice(9, -10))}</div>;
                return <React.Fragment key={i}>{renderMathCard(block)}</React.Fragment>;
            })}
        </>
    );
}

// Parse blog.content → lấy câu hỏi đầu tiên để hiển thị trên card
interface CardQuestionData {
    questionNo: string;
    questionText: string;
    questionLatex: string;
    type: 'tu_luan' | 'dung_sai' | 'trac_nghiem';
    imageSvg?: string;
    imageUrl?: string;
    imageTelegramFileId?: string;
    imageLayout?: 'auto' | 'right' | 'bottom';
}

function parseCardQuestion(content: string): CardQuestionData | null {
    try {
        const parsed = JSON.parse(content);
        if (parsed.type !== 'physics_solution' || !parsed.data) return null;
        const data = parsed.data;
        if (data.questions && data.questions.length > 0) {
            const q = data.questions[0];
            return {
                questionNo: q.question_no || '',
                questionText: q.question_text || '',
                questionLatex: q.question_latex || '',
                type: q.type === 'dung_sai' ? 'dung_sai' : q.type === 'trac_nghiem' ? 'trac_nghiem' : 'tu_luan',
                imageSvg: q.image_svg || q.imageSvg || '',
                imageUrl: q.image_url || q.imageUrl || '',
                imageTelegramFileId: q.image_telegram_file_id || q.imageTelegramFileId || '',
                imageLayout: q.image_layout || q.imageLayout || 'auto',
            };
        }
        // Backward compat: root-level single question
        return {
            questionNo: data.question_no || '',
            questionText: data.question_text || '',
            questionLatex: data.question_latex || '',
            type: 'tu_luan',
            imageSvg: data.image_svg || data.imageSvg || '',
            imageUrl: data.image_url || data.imageUrl || '',
            imageTelegramFileId: data.image_telegram_file_id || data.imageTelegramFileId || '',
            imageLayout: data.image_layout || data.imageLayout || 'auto',
        };
    } catch {
        return null;
    }
}

// ─────────────────────────────────────────────────────────────
// CARD THUMBNAIL: Khung đề bài (toàn bộ card là đề bài)
// ─────────────────────────────────────────────────────────────

interface QuestionCardProps {
    blog: BlogPost;
    isAdmin: boolean;
    onEditBlog?: (blog: BlogPost) => void;
    onClick: () => void;
    gc: { bg: string; text: string; dot: string };
    isSelected?: boolean;
    onToggleSelect?: () => void;
}

function QuestionCard({ blog, isAdmin, onEditBlog, onClick, gc, isSelected, onToggleSelect }: QuestionCardProps) {
    const q = parseCardQuestion(blog.content);
    const isDungSai    = q?.type === 'dung_sai';
    const isTracNghiem = q?.type === 'trac_nghiem';
    const hasImg = !!(q?.imageSvg || q?.imageUrl || q?.imageTelegramFileId);
    const hasQuestion = q && (q.questionText || q.questionLatex || hasImg);
    const isRight = (q?.imageLayout === 'right') || (q?.imageLayout === 'auto') || !q?.imageLayout;

    const imageElem = hasImg ? (
        <div style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            padding: '2px',
        }}>
            {q?.imageSvg ? (
                <div
                    style={{
                        maxWidth: '100%',
                        display: 'flex',
                        justifyContent: 'center',
                    }}
                    className="[&>svg]:max-w-full [&>svg]:h-auto [&>svg]:max-h-[190px] [&>svg]:object-contain"
                    dangerouslySetInnerHTML={{ __html: q.imageSvg }}
                />
            ) : q?.imageUrl ? (
                <img
                    src={q.imageUrl}
                    alt="Hình vẽ minh họa"
                    style={{ maxWidth: '100%', maxHeight: '190px', objectFit: 'contain' }}
                />
            ) : q?.imageTelegramFileId ? (
                <img
                    src={`${CLOUDFLARE_PROXY_URL}/getFile/${q.imageTelegramFileId}`}
                    alt="Hình vẽ minh họa"
                    style={{ maxWidth: '100%', maxHeight: '190px', objectFit: 'contain' }}
                />
            ) : null}
        </div>
    ) : null;

    return (
        <article
            onClick={onClick}
            style={{
                borderRadius: '14px',
                overflow: 'hidden',
                cursor: 'pointer',
                border: isSelected ? '2px solid #7B1113' : '1px solid #E9E9E7',
                background: '#fff',
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.2s',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            }}
            onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#CFCFCB';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.08)';
                e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={e => {
                e.currentTarget.style.borderColor = '#E9E9E7';
                e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)';
                e.currentTarget.style.transform = 'translateY(0)';
            }}
        >
            {/* ── Thanh Header ── */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                borderBottom: '1px solid #F0F0EE',
                background: '#FAFAFA',
                gap: '8px',
                flexShrink: 0,
            }}>
                {/* Bên trái: Số câu + Loại bài */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {q?.questionNo ? (
                        <span style={{
                            fontSize: '11px', fontWeight: 700, color: '#1A1A1A',
                            background: '#F1F0EC', padding: '2px 8px',
                            borderRadius: '5px', border: '1px solid #E2E1DD',
                        }}>
                            {q.questionNo}
                        </span>
                    ) : null}
                    <span style={{
                        fontSize: '10px', fontWeight: 700,
                        padding: '2px 8px', borderRadius: '5px',
                        background: isDungSai ? '#FEF3C7' : isTracNghiem ? '#EAF3EE' : '#EEF0FB',
                        color: isDungSai ? '#92400E' : isTracNghiem ? '#448361' : '#6B7CDB',
                        border: `1px solid ${isDungSai ? '#FDE68A' : isTracNghiem ? '#44836140' : '#D0D5F5'}`,
                    }}>
                        {isDungSai ? 'Đúng / Sai' : isTracNghiem ? 'Trắc nghiệm' : q ? 'Trả lời ngắn' : 'Bài viết'}
                    </span>
                    {/* Grade badge */}
                    <span style={{
                        fontSize: '10px', fontWeight: 700, letterSpacing: '0.02em',
                        padding: '2px 8px', borderRadius: '5px',
                        background: gc.bg, color: gc.text, border: `1px solid ${gc.dot}30`,
                    }}>
                        {(blog.grade || 0) === 0 ? 'Chung' : `Lớp ${blog.grade}`}
                    </span>
                </div>

                {/* Bên phải: Mức độ (placeholder) + Thêm + Admin status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {/* Mức độ thực tế */}
                    {(() => {
                        const lvlMap: Record<number, {label:string;bg:string;color:string;brd:string}> = {
                            1:{label:'Mức 1',bg:'#EAF3EE',color:'#448361',brd:'#44836130'},
                            2:{label:'Mức 2',bg:'#EEF0FB',color:'#6B7CDB',brd:'#6B7CDB30'},
                            3:{label:'Mức 3',bg:'#FFF3E8',color:'#D9730D',brd:'#D9730D30'},
                            4:{label:'Mức 4',bg:'#F3ECF8',color:'#9065B0',brd:'#9065B030'},
                        };
                        const lv = (blog as any).level || 0;
                        const s = lvlMap[lv];
                        return <span style={{
                            fontSize:'10px',fontWeight:700,
                            padding:'2px 8px',borderRadius:'5px',
                            background:s?.bg||'#F1F0EC',color:s?.color||'#AEACA8',
                            border:`1px solid ${s?.brd||'#E2E1DD'}`,
                        }}>{s?.label||'Mức —'}</span>;
                    })()}

                    {/* Nút Thêm vào đề thi */}
                    <button
                        onClick={e => {
                            e.stopPropagation();
                            if (onToggleSelect) onToggleSelect();
                        }}
                        title={isSelected ? "Bỏ chọn khỏi đề thi" : "Thêm vào đề thi kiểm tra"}
                        style={{
                            fontSize: '11px', fontWeight: 700, lineHeight: 1,
                            padding: '3px 8px', borderRadius: '5px',
                            background: isSelected ? '#7B1113' : '#F1F0EC',
                            color: isSelected ? '#fff' : '#787774',
                            border: `1px solid ${isSelected ? '#7B1113' : '#E2E1DD'}`,
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                            display: 'flex', alignItems: 'center', gap: '3px',
                        }}
                        onMouseEnter={e => {
                            if (!isSelected) {
                                e.currentTarget.style.background = '#EEF0FB';
                                e.currentTarget.style.color = '#6B7CDB';
                                e.currentTarget.style.borderColor = '#D0D5F5';
                            }
                        }}
                        onMouseLeave={e => {
                            if (!isSelected) {
                                e.currentTarget.style.background = '#F1F0EC';
                                e.currentTarget.style.color = '#787774';
                                e.currentTarget.style.borderColor = '#E2E1DD';
                            }
                        }}
                    >
                        {isSelected ? '✓ Đã chọn' : '+ Thêm'}
                    </button>

                    {/* Admin: nút Sửa (thay thế badge "Đã đăng / Nháp") */}
                    {isAdmin && onEditBlog && (
                        <button
                            onClick={e => { e.stopPropagation(); onEditBlog(blog); }}
                            title="Chỉnh sửa bài viết"
                            style={{
                                fontSize: '9px', fontWeight: 700,
                                padding: '2px 8px', borderRadius: '5px', cursor: 'pointer',
                                background: blog.is_published ? '#EAF3EE' : '#F3ECF8',
                                color: blog.is_published ? '#448361' : '#9065B0',
                                border: `1px solid ${blog.is_published ? '#B7D9C4' : '#C8A8DC'}`,
                                transition: 'all 0.15s',
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.background = '#EEF0FB';
                                e.currentTarget.style.color = '#6B7CDB';
                                e.currentTarget.style.borderColor = '#D0D5F5';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.background = blog.is_published ? '#EAF3EE' : '#F3ECF8';
                                e.currentTarget.style.color = blog.is_published ? '#448361' : '#9065B0';
                                e.currentTarget.style.borderColor = blog.is_published ? '#B7D9C4' : '#C8A8DC';
                            }}
                        >
                            ✎ Sửa
                        </button>
                    )}
                </div>
            </div>

            {/* ── Vùng đề bài: chiều cao cố định, scroll nếu đề dài ── */}
            {hasQuestion ? (
                <div
                    style={{
                        height: '240px',
                        overflowY: 'auto',
                        padding: '14px 16px',
                        fontSize: '15px',
                        color: '#374151',
                        lineHeight: 1.7,
                        fontFamily: "'KaTeX_Main', 'Computer Modern', serif",
                        scrollbarWidth: 'thin',
                        scrollbarColor: '#D1D5DB transparent',
                    }}
                    onWheel={e => e.stopPropagation()}
                >
                    <style>{`.katex { color: #1A1A1A !important; font-size: 1em !important; }`}</style>
                    {(() => {
                        const hasPlaceholder = hasImg && /\[image\]/i.test(q!.questionText || '');
                        if (hasPlaceholder) {
                            const parts = (q!.questionText || '').split(/\[image\]/i);
                            const before = parts[0] || '';
                            const after = parts.slice(1).join('[image]') || '';
                            return (
                                <div>
                                    {before.trim() && (
                                        <div style={{ marginBottom: '8px', whiteSpace: 'pre-wrap' }}>
                                            <TextWithMathCard text={before} />
                                        </div>
                                    )}
                                    <div style={{ margin: '8px 0', display: 'flex', justifyContent: 'center' }}>
                                        {imageElem}
                                    </div>
                                    {after.trim() && (
                                        <div style={{ marginBottom: q!.questionLatex ? '8px' : 0, whiteSpace: 'pre-wrap' }}>
                                            <TextWithMathCard text={after} />
                                        </div>
                                    )}
                                    {q!.questionLatex && <KatexBlockCard tex={q!.questionLatex} />}
                                </div>
                            );
                        }
                        if (hasImg && isRight) {
                            return (
                                <div className="flex flex-col sm:flex-row gap-4 items-start">
                                    <div className="flex-1 min-w-0">
                                        {q!.questionText && (
                                            <div style={{ marginBottom: q!.questionLatex ? '8px' : 0, whiteSpace: 'pre-wrap' }}>
                                                <TextWithMathCard text={q!.questionText} />
                                            </div>
                                        )}
                                        {q!.questionLatex && <KatexBlockCard tex={q!.questionLatex} />}
                                    </div>
                                    <div className="w-full sm:w-[38%] max-w-[320px] shrink-0 self-center">
                                        {imageElem}
                                    </div>
                                </div>
                            );
                        }
                        return (
                            <div>
                                {q!.questionText && (
                                    <div style={{ marginBottom: q!.questionLatex ? '8px' : 0, whiteSpace: 'pre-wrap' }}>
                                        <TextWithMathCard text={q!.questionText} />
                                    </div>
                                )}
                                {q!.questionLatex && <KatexBlockCard tex={q!.questionLatex} />}
                                {hasImg && (
                                    <div style={{ marginTop: '10px' }}>
                                        {imageElem}
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </div>
            ) : (
                /* Fallback: bài viết thường không phải lời giải */
                <div style={{
                    height: '240px', overflowY: 'auto', padding: '14px 16px',
                    fontSize: '15px', color: '#374151', lineHeight: 1.7,
                }}>
                    <p style={{ margin: 0, color: '#787774' }}>{blog.summary}</p>
                </div>
            )}
        </article>
    );
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────

interface BlogListProps {
    isAdmin: boolean;
    studentGrade?: number | null;
    onReadBlog: (blog: BlogPost) => void;
    onEditBlog?: (blog: BlogPost) => void;
    onCreateBlog?: () => void;
    onBlogsLoaded?: (blogs: BlogPost[]) => void;
    getBlogs: (isAdmin: boolean) => Promise<BlogPost[]>;
}

const estimateReadTime = (content: string): number =>
    Math.max(1, Math.ceil(content.trim().split(/\s+/).length / 200));

const GRADE_COLORS: Record<number, { bg: string; text: string; dot: string }> = {
    12: { bg: '#F3ECF8', text: '#9065B0', dot: '#9065B0' },
    11: { bg: '#EEF0FB', text: '#6B7CDB', dot: '#6B7CDB' },
    10: { bg: '#EAF3EE', text: '#448361', dot: '#448361' },
    0:  { bg: '#F1F0EC', text: '#787774', dot: '#AEACA8' },
};

const BlogList: React.FC<BlogListProps> = ({ isAdmin, studentGrade, onReadBlog, onEditBlog, onCreateBlog, onBlogsLoaded, getBlogs }) => {
    const [blogs, setBlogs] = useState<BlogPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [treeData, setTreeData] = useState(loadPhysicsTree);
    const [selectedTreeNode, setSelectedTreeNode] = useState<TreeSelection>({ type: 'all' });
    const [showMobileTree, setShowMobileTree] = useState(false);
    const mobileTreeOpener = useRef<HTMLButtonElement>(null);
    const mobileTreeClose = useRef<HTMLButtonElement>(null);

    // ── BỘ LỌC CHUYÊN SÂU (Question Format, Difficulty Level, Image/Diagram) ──
    const [questionTypeFilter, setQuestionTypeFilter] = useState<'all' | 'dung_sai' | 'trac_nghiem' | 'tu_luan'>('all');
    const [levelFilter, setLevelFilter] = useState<number>(0); // 0 = Tất cả, 1-4 = Mức độ 1 đến 4
    const [hasImageFilter, setHasImageFilter] = useState<boolean>(false); // Chỉ câu có hình vẽ / đồ thị

    const [showFilters, setShowFilters] = useState(false);
    const [selectedBlogIds, setSelectedBlogIds] = useState<string[]>([]);
    const [isExamModalOpen, setIsExamModalOpen] = useState(false);
    const navigate = useNavigate();

    const handleToggleSelect = (id: string) => {
        setSelectedBlogIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const selectedQuestions: SelectedQuestionItem[] = useMemo(() => {
        return blogs
            .filter(b => selectedBlogIds.includes(b.id))
            .map((b, idx) => {
                try {
                    const p = JSON.parse(b.content);
                    if (p.type === 'physics_solution' && p.data) {
                        const q = p.data.questions?.[0] || p.data;
                        return {
                            id: b.id,
                            questionNo: q.question_no || `Câu ${idx + 1}`,
                            qText: q.question_text || '',
                            qFormula: q.question_latex || '',
                            type: q.type === 'dung_sai' ? 'dung_sai' : q.type === 'trac_nghiem' ? 'trac_nghiem' : 'tu_luan',
                            choices: q.choices || [],
                            correctChoice: q.correctChoice || '',
                            statements: q.statements || [],
                            solution: q.solution || "",
                            solutionSteps: q.solutionSteps || [],
                            steps: q.steps || [],
                            level: b.level || 0,
                            tikzCode: q.tikz_code || q.tikzCode || '',
                            imageSvg: q.image_svg || q.imageSvg || '',
                            imageUrl: q.image_url || q.imageUrl || '',
                            imageTelegramFileId: q.image_telegram_file_id || q.imageTelegramFileId || '',
                            imageLayout: q.image_layout || q.imageLayout || 'auto',
                        };
                    }
                } catch (_) {}
                return {
                    id: b.id,
                    questionNo: `Câu ${idx + 1}`,
                    qText: b.summary || b.title,
                    type: 'tu_luan' as const,
                };
            });
    }, [blogs, selectedBlogIds]);

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

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(searchQuery), 200);
        return () => clearTimeout(t);
    }, [searchQuery]);

    const visibleBlogs = useMemo(() => blogs.filter(blog => {
        if (isAdmin) return true;
        return blog.category !== 'exam_paper' && (!studentGrade || !blog.grade || blog.grade === studentGrade);
    }), [blogs, isAdmin, studentGrade]);

    const visibleTree = useMemo(
        () => !isAdmin && studentGrade ? treeData.filter(node => node.grade === studentGrade) : treeData,
        [treeData, isAdmin, studentGrade]
    );
    const folderBlogs = useMemo(() => indexFolderBlogs(visibleTree, visibleBlogs), [visibleTree, visibleBlogs]);
    const activeTreeNode = selectedTreeNode.id && folderBlogs.has(selectedTreeNode.id)
        ? selectedTreeNode
        : null;
    const gradeFilter = activeTreeNode?.grade ?? 0;
    const selectedFolderIds = activeTreeNode?.id ? folderBlogs.get(activeTreeNode.id) : undefined;
    const inScopeBlogs = useMemo(
        () => selectedFolderIds ? visibleBlogs.filter(blog => selectedFolderIds.has(blog.id)) : visibleBlogs,
        [visibleBlogs, selectedFolderIds]
    );

    useEffect(() => {
        if (showMobileTree) mobileTreeClose.current?.focus();
    }, [showMobileTree]);

    const closeMobileTree = () => {
        if (!showMobileTree) return;
        setShowMobileTree(false);
        mobileTreeOpener.current?.focus();
    };

    const handleTreeChange = (tree: TreeNode[]) => {
        setTreeData(tree);
        savePhysicsTree(tree);
    };

    const selectGrade = (grade: number) => {
        const node = visibleTree.find(folder => folder.grade === grade);
        setSelectedTreeNode(node ? selectTreeNode(node) : { type: 'all' });
    };



    // ── TÍNH TOÁN BỘ ĐẾM LIÊN ĐỚI THÔNG MINH (FACETED COUNTS) ──
    // Đếm chính xác theo từng loại và mức độ liên đới với nhau (không bị đếm tổng nhầm)
    const facetCounts = useMemo(() => {
        // 2. ĐẾM CHO HÀNG LOẠI CÂU: Phụ thuộc vào levelFilter & hasImageFilter đang chọn
        const forTypeCounts = inScopeBlogs.filter(b => {
            if (levelFilter !== 0 && ((b as any).level || 0) !== levelFilter) return false;
            if (hasImageFilter) {
                const q = parseCardQuestion(b.content);
                if (!q || !(q.imageSvg || q.imageUrl || q.imageTelegramFileId)) return false;
            }
            return true;
        });

        let typeAll = forTypeCounts.length;
        let dungSai = 0;
        let tracNghiem = 0;
        let tuLuan = 0;
        forTypeCounts.forEach(b => {
            const q = parseCardQuestion(b.content);
            const qType = q?.type === 'dung_sai' ? 'dung_sai' : q?.type === 'trac_nghiem' ? 'trac_nghiem' : 'tu_luan';
            if (qType === 'dung_sai') dungSai++;
            else if (qType === 'trac_nghiem') tracNghiem++;
            else tuLuan++;
        });

        // 3. ĐẾM CHO HÀNG MỨC ĐỘ: Phụ thuộc vào questionTypeFilter & hasImageFilter đang chọn
        const forLevelCounts = inScopeBlogs.filter(b => {
            if (questionTypeFilter !== 'all') {
                const q = parseCardQuestion(b.content);
                const qType = q?.type === 'dung_sai' ? 'dung_sai' : q?.type === 'trac_nghiem' ? 'trac_nghiem' : 'tu_luan';
                if (qType !== questionTypeFilter) return false;
            }
            if (hasImageFilter) {
                const q = parseCardQuestion(b.content);
                if (!q || !(q.imageSvg || q.imageUrl || q.imageTelegramFileId)) return false;
            }
            return true;
        });

        let levelAll = forLevelCounts.length;
        let lvl1 = 0, lvl2 = 0, lvl3 = 0, lvl4 = 0;
        forLevelCounts.forEach(b => {
            const lv = (b as any).level || 0;
            if (lv === 1) lvl1++;
            else if (lv === 2) lvl2++;
            else if (lv === 3) lvl3++;
            else if (lv === 4) lvl4++;
        });

        // 4. ĐẾM CHO NÚT "CÓ HÌNH / ĐỒ THỊ": Phụ thuộc cả questionTypeFilter & levelFilter
        const forImageCount = inScopeBlogs.filter(b => {
            if (questionTypeFilter !== 'all') {
                const q = parseCardQuestion(b.content);
                const qType = q?.type === 'dung_sai' ? 'dung_sai' : q?.type === 'trac_nghiem' ? 'trac_nghiem' : 'tu_luan';
                if (qType !== questionTypeFilter) return false;
            }
            if (levelFilter !== 0 && ((b as any).level || 0) !== levelFilter) return false;
            return true;
        });

        let withImage = 0;
        forImageCount.forEach(b => {
            const q = parseCardQuestion(b.content);
            if (q && (q.imageSvg || q.imageUrl || q.imageTelegramFileId)) {
                withImage++;
            }
        });

        return {
            typeAll,
            dungSai,
            tracNghiem,
            tuLuan,
            levelAll,
            lvl1,
            lvl2,
            lvl3,
            lvl4,
            withImage,
            totalInScope: inScopeBlogs.length,
        };
    }, [inScopeBlogs, questionTypeFilter, levelFilter, hasImageFilter]);

    const isAnyFilterActive = questionTypeFilter !== 'all' || levelFilter !== 0 || hasImageFilter || searchQuery.trim() !== '';

    const handleResetAllFilters = () => {
        setQuestionTypeFilter('all');
        setLevelFilter(0);
        setHasImageFilter(false);
        setSearchQuery('');
    };

    const filteredBlogs = useMemo(() => inScopeBlogs.filter(b => {
        // ── LỌC THEO BỘ LỌC CHUYÊN SÂU ──
        // 1. Loại câu hỏi (Đúng/Sai, Trắc nghiệm 4 PA, Trả lời ngắn)
        if (questionTypeFilter !== 'all') {
            const q = parseCardQuestion(b.content);
            const qType = q?.type === 'dung_sai' ? 'dung_sai' : q?.type === 'trac_nghiem' ? 'trac_nghiem' : 'tu_luan';
            if (qType !== questionTypeFilter) return false;
        }

        // 2. Mức độ nhận thức (1: Nhận biết, 2: Thông hiểu, 3: Vận dụng, 4: Vận dụng cao)
        if (levelFilter !== 0) {
            const lv = (b as any).level || 0;
            if (lv !== levelFilter) return false;
        }

        // 3. Có hình ảnh / đồ thị
        if (hasImageFilter) {
            const q = parseCardQuestion(b.content);
            const hasImg = !!(q?.imageSvg || q?.imageUrl || q?.imageTelegramFileId);
            if (!hasImg) return false;
        }

        // Tìm kiếm theo từ khóa
        const q = debouncedSearch.toLowerCase();
        const matchSearch = !q || b.title.toLowerCase().includes(q) || b.summary.toLowerCase().includes(q) || (b.tags || []).some(t => t.toLowerCase().includes(q));
        return matchSearch;
    }), [inScopeBlogs, debouncedSearch, questionTypeFilter, levelFilter, hasImageFilter]);

    const allGradeTabs = [
        { label: 'Tất cả', value: 0, color: '#787774' },
        { label: 'Lớp 12', value: 12, color: '#9065B0' },
        { label: 'Lớp 11', value: 11, color: '#6B7CDB' },
        { label: 'Lớp 10', value: 10, color: '#448361' },
    ];
    // Học sinh chỉ thấy "Tất cả" + tab đúng khối của mình
    const gradeTabs = (!isAdmin && studentGrade)
        ? allGradeTabs.filter(t => t.value === 0 || t.value === studentGrade)
        : allGradeTabs;

    return (
        <div className="w-full max-w-[1720px] mx-auto p-4 md:p-6 lg:p-8 animate-fade-in relative pb-20" style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>
            {/* Nút quay lại trang chủ (khi góc học tập mở full-screen) */}
            <div style={{ marginBottom: '16px' }}>
                <button
                    onClick={() => navigate('/')}
                    style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        background: '#fff', border: '1px solid #E9E9E7', padding: '7px 16px',
                        borderRadius: '10px', fontSize: '13px', fontWeight: 600, color: '#57564F',
                        cursor: 'pointer', transition: 'all 0.15s', boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#1A1A1A'; e.currentTarget.style.borderColor = '#CFCFCB'; e.currentTarget.style.background = '#F7F6F3'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#57564F'; e.currentTarget.style.borderColor = '#E9E9E7'; e.currentTarget.style.background = '#fff'; }}
                >
                    <ChevronLeft style={{ width: '16px', height: '16px' }} /> Quay lại trang chủ
                </button>
            </div>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        width: '40px', height: '40px', borderRadius: '10px',
                        background: isAdmin ? '#EEF0FB' : '#F3ECF8',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                        {isAdmin
                            ? <FileText style={{ width: '20px', height: '20px', color: '#6B7CDB' }} />
                            : <BookOpen style={{ width: '20px', height: '20px', color: '#9065B0' }} />}
                    </div>
                    <div>
                        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#1A1A1A', lineHeight: 1.2 }}>
                            {isAdmin ? 'Quản lý Blog' : 'Góc Học Tập'}
                        </h1>
                        <p style={{ fontSize: '13px', color: '#787774', marginTop: '2px' }}>
                            {isAdmin ? 'Quản lý bài viết & kiến thức chuyên sâu' : 'Kiến thức, mẹo giải bài tập và tài liệu Vật Lý'}
                        </p>
                    </div>
                </div>

                {isAdmin && onCreateBlog && (
                    <button
                        onClick={onCreateBlog}
                        style={{
                            padding: '9px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: 600,
                            background: '#1A1A1A', color: '#fff', border: 'none', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '6px',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)', transition: 'all 0.15s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                    >
                        <Plus style={{ width: '15px', height: '15px' }} /> Viết bài mới
                    </button>
                )}
            </div>

            {/* ── BỐ CỤC 2 CỘT: Cột Trái (Mục lục cây thư mục) & Cột Phải (Kho học liệu & Bộ lọc) ── */}
            <div className="flex flex-col lg:flex-row gap-6 items-start mt-6">
                {/* ── CỘT TRÁI: MỤC LỤC CÂY THƯ MỤC 4 CẤP CHUẨN GDPT 2018 (Desktop) ── */}
                <aside className={(showMobileTree ? 'fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4 ' : 'hidden ')
                    + 'lg:sticky lg:inset-auto lg:top-6 lg:z-auto lg:block lg:w-[320px] lg:shrink-0 lg:p-0 xl:w-[350px]'}
                    aria-labelledby="physics-folder-panel-title"
                    onKeyDown={event => {
                        if (!showMobileTree || !mobileTreeClose.current?.getClientRects().length
                            || (event.target as HTMLElement).closest('dialog')) return;
                        if (event.key === 'Escape') closeMobileTree();
                        if (event.key !== 'Tab') return;
                        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)'))
                            .filter(control => control.getClientRects().length > 0);
                        const first = controls[0];
                        const last = controls.at(-1);
                        if (event.shiftKey ? event.target === first : event.target === last) {
                            event.preventDefault();
                            (event.shiftKey ? last : first)?.focus();
                        }
                    }}>
                    {showMobileTree && (
                        <div aria-hidden="true" className="absolute inset-0 bg-black/40 lg:hidden" onClick={closeMobileTree} />
                    )}
                    <div id="physics-folder-panel" className="relative flex h-[85dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-stone-200 bg-white shadow-sm sm:max-w-md sm:rounded-2xl lg:h-[min(740px,calc(100dvh-3rem))]">
                        <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-2.5">
                            <h2 id="physics-folder-panel-title" className="flex items-center gap-2 text-sm font-bold text-stone-800">
                                <Folder aria-hidden="true" className="size-4 text-amber-700" />
                                Mục lục Vật lý
                            </h2>
                            <button ref={mobileTreeClose} type="button" aria-label="Đóng mục lục" onClick={closeMobileTree}
                                className="grid size-9 place-items-center rounded-md text-stone-600 hover:bg-stone-100 lg:hidden">
                                <X aria-hidden="true" className="size-5" />
                            </button>
                        </div>
                        <TreeTableOfContents
                            treeData={visibleTree}
                            folderBlogs={folderBlogs}
                            totalCount={visibleBlogs.length}
                            selectedItem={activeTreeNode ?? { type: 'all' }}
                            onSelect={selection => {
                                setSelectedTreeNode(selection);
                                closeMobileTree();
                            }}
                            onTreeChange={handleTreeChange}
                            isAdmin={isAdmin}
                        />
                    </div>
                </aside>

                {/* ── CỘT PHẢI: BỘ LỌC + DANH SÁCH BÀI TẬP ── */}
                <div className="flex-1 min-w-0 w-full space-y-4">
                    {/* Nút mở Mục lục trên Mobile / Tablet */}
                    <div className="lg:hidden flex items-center justify-between bg-white p-3 rounded-xl border border-[#E9E9E7] shadow-2xs">
                        <button
                            ref={mobileTreeOpener}
                            type="button"
                            aria-expanded={showMobileTree}
                            aria-controls="physics-folder-panel"
                            onClick={() => setShowMobileTree(true)}
                            className="flex items-center gap-2 text-xs font-bold text-[#8C4A00] bg-[#FDF6ED] px-3.5 py-2 rounded-lg border border-[#F3DFC1]"
                        >
                            <Folder className="w-4 h-4 fill-[#F5A623] text-[#D9730D]" />
                            <span>Mục lục ({visibleBlogs.length} câu)</span>
                        </button>
                        {activeTreeNode && (
                            <span className="text-xs font-semibold text-[#8C4A00] truncate max-w-[160px]">
                                {activeTreeNode.name}
                            </span>
                        )}
                    </div>

                    {/* Thanh Breadcrumb khi đang chọn một thư mục bất kỳ trong cây */}
                    {activeTreeNode && (
                        <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#FDF4E7] border border-[#F6E1C4] text-xs">
                            <div className="flex items-center gap-2 min-w-0 pr-2">
                                <Folder className="w-4 h-4 fill-[#F5A623] text-[#D9730D] shrink-0" />
                                <span className="text-[#8C4A00] font-bold truncate">
                                    {activeTreeNode.name}
                                </span>
                                <span className="text-[11px] font-semibold text-[#8C4A00] bg-[#FAEDE0] px-2 py-0.5 rounded-full shrink-0">
                                    {filteredBlogs.length} câu
                                </span>
                            </div>
                            <button
                                onClick={() => selectGrade(0)}
                                className="text-xs font-bold text-[#8C4A00] hover:text-[#5C3000] underline shrink-0 cursor-pointer"
                            >
                                ✕ Xem tất cả
                            </button>
                        </div>
                    )}

                    {/* ── BỘ LỌC CHUYÊN SÂU (Smart Physics Filter Bar) ── */}
                    <div className="bg-white rounded-2xl border border-[#E9E9E7] p-3.5 space-y-2.5 shadow-2xs">
                        {/* Hàng 1: Khối lớp + Tìm kiếm + Có hình/đồ thị + Reset */}
                        <div className="flex items-center gap-2 flex-wrap">
                            {/* Tab khối lớp */}
                            <div className="flex items-center gap-1 bg-[#FAFAF9] p-1 rounded-xl border border-[#E9E9E7]">
                                {gradeTabs.map(tab => (
                                    <button
                                        key={tab.value}
                                        onClick={() => selectGrade(tab.value)}
                                        style={{
                                            backgroundColor: gradeFilter === tab.value ? tab.color : 'transparent',
                                            color: gradeFilter === tab.value ? '#fff' : '#787774',
                                        }}
                                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                            gradeFilter === tab.value ? 'shadow-2xs font-bold' : 'hover:bg-black/5'
                                        }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            {/* Ô tìm kiếm câu hỏi */}
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[#E2E0DB] bg-[#FAFAF9] flex-1 min-w-[180px] focus-within:border-[#C4630A] focus-within:bg-white transition-all">
                                <Search className="w-3.5 h-3.5 text-[#8F8E8C] shrink-0" />
                                <input
                                    type="text"
                                    placeholder="Tìm nội dung, công thức, từ khóa..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full text-xs text-[#1A1A1A] placeholder-[#9E9B97] bg-transparent outline-none"
                                />
                                {searchQuery && (
                                    <button onClick={() => setSearchQuery('')} className="text-[#8F8E8C] hover:text-[#1A1A1A] p-0.5">
                                        <X className="w-3 h-3" />
                                    </button>
                                )}
                            </div>

                            {/* Nút lọc Có hình vẽ / Đồ thị */}
                            <button
                                onClick={() => setHasImageFilter(!hasImageFilter)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                                    hasImageFilter
                                        ? 'bg-[#EEF0FB] text-[#4F62C9] border-[#C7D0F8] shadow-2xs font-bold'
                                        : 'bg-[#FAFAF9] text-[#57564F] border-[#E2E0DB] hover:bg-[#F0EFEB]'
                                }`}
                                title="Chỉ hiển thị các câu có hình vẽ minh họa hoặc đồ thị"
                            >
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>Có hình / Đồ thị</span>
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${hasImageFilter ? 'bg-[#DCE3FA] text-[#3649AF]' : 'bg-[#EAE8E4] text-[#787774]'}`}>
                                    {facetCounts.withImage}
                                </span>
                            </button>

                            {/* Nút Đặt lại tất cả lọc (hiện khi có lọc active) */}
                            {isAnyFilterActive && (
                                <button
                                    onClick={handleResetAllFilters}
                                    className="flex items-center gap-1 text-xs font-bold text-[#8C4A00] hover:text-[#5C3000] px-2.5 py-1.5 rounded-xl hover:bg-[#FDF6ED] transition-colors cursor-pointer"
                                >
                                    <RotateCcw className="w-3 h-3" />
                                    <span>Đặt lại</span>
                                </button>
                            )}
                        </div>

                        {/* Hàng 2: Bộ lọc Loại câu hỏi (Định dạng thi Bộ GD 2025) */}
                        <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-[#F2F1ED]">
                            <span className="text-[10.5px] font-bold text-[#8F8E8C] uppercase tracking-wider mr-1">Loại câu:</span>
                            {[
                                { id: 'all', label: 'Tất cả loại câu', count: facetCounts.typeAll },
                                { id: 'dung_sai', label: '⚖️ Đúng / Sai (Phần II)', count: facetCounts.dungSai, activeColor: 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]' },
                                { id: 'trac_nghiem', label: '⚡ Trắc nghiệm 4 PA (Phần I)', count: facetCounts.tracNghiem, activeColor: 'bg-[#EAF3EE] text-[#448361] border-[#44836140]' },
                                { id: 'tu_luan', label: '✏️ Trả lời ngắn (Phần III)', count: facetCounts.tuLuan, activeColor: 'bg-[#EEF0FB] text-[#6B7CDB] border-[#D0D5F5]' },
                            ].map(typeItem => {
                                const isActive = questionTypeFilter === typeItem.id;
                                return (
                                    <button
                                        key={typeItem.id}
                                        onClick={() => setQuestionTypeFilter(typeItem.id as any)}
                                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                                            isActive
                                                ? `${typeItem.activeColor || 'bg-[#1A1A1A] text-white border-[#1A1A1A]'} font-bold shadow-2xs`
                                                : 'bg-white text-[#57564F] border-[#E2E0DB] hover:bg-[#F7F6F3]'
                                        }`}
                                    >
                                        <span>{typeItem.label}</span>
                                        <span className={`text-[10px] tabular-nums px-1.5 py-0.2 rounded-full font-bold ${
                                            isActive ? 'bg-black/10' : 'bg-[#F0EFEB] text-[#787774]'
                                        }`}>
                                            {typeItem.count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Hàng 3: Bộ lọc Mức độ nhận thức (Độ khó chuẩn 4 mức) */}
                        <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-[#F2F1ED]">
                            <span className="text-[10.5px] font-bold text-[#8F8E8C] uppercase tracking-wider mr-1">Mức độ:</span>
                            {[
                                { id: 0, label: 'Tất cả mức', count: facetCounts.levelAll },
                                { id: 1, label: 'Mức 1: Nhận biết', count: facetCounts.lvl1, bg: '#EAF3EE', color: '#448361', border: '#44836130' },
                                { id: 2, label: 'Mức 2: Thông hiểu', count: facetCounts.lvl2, bg: '#EEF0FB', color: '#6B7CDB', border: '#6B7CDB30' },
                                { id: 3, label: 'Mức 3: Vận dụng', count: facetCounts.lvl3, bg: '#FFF3E8', color: '#D9730D', border: '#D9730D30' },
                                { id: 4, label: 'Mức 4: Vận dụng cao', count: facetCounts.lvl4, bg: '#F3ECF8', color: '#9065B0', border: '#9065B030' },
                            ].map(lvlItem => {
                                const isActive = levelFilter === lvlItem.id;
                                return (
                                    <button
                                        key={lvlItem.id}
                                        onClick={() => setLevelFilter(lvlItem.id)}
                                        style={{
                                            backgroundColor: isActive ? lvlItem.bg || '#1A1A1A' : '#fff',
                                            color: isActive ? lvlItem.color || '#fff' : '#57564F',
                                            borderColor: isActive ? lvlItem.border || '#1A1A1A' : '#E2E0DB',
                                        }}
                                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                                            isActive ? 'font-bold shadow-2xs' : 'hover:bg-[#F7F6F3]'
                                        }`}
                                    >
                                        <span>{lvlItem.label}</span>
                                        <span className="text-[10px] tabular-nums px-1.5 py-0.2 rounded-full font-bold bg-black/5">
                                            {lvlItem.count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Content */}
                    {loading ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: '12px' }}>
                            <div className="animate-spin" style={{ width: '32px', height: '32px', borderRadius: '50%', border: '3px solid #EEF0FB', borderTopColor: '#6B7CDB' }} />
                            <p style={{ fontSize: '13px', color: '#AEACA8', fontWeight: 500 }}>Đang tải bài viết...</p>
                        </div>
                    ) : filteredBlogs.length === 0 ? (
                        <div style={{
                            textAlign: 'center', padding: '64px 24px', borderRadius: '12px',
                            border: '1px solid #E9E9E7', background: '#fff'
                        }}>
                            <div style={{
                                width: '48px', height: '48px', borderRadius: '12px', background: '#F1F0EC',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px'
                            }}>
                                <BookOpen style={{ width: '22px', height: '22px', color: '#CFCFCB' }} />
                            </div>
                            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1A1A1A', marginBottom: '6px' }}>Chưa có bài viết nào</h3>
                            <p style={{ fontSize: '13px', color: '#AEACA8', maxWidth: '280px', margin: '0 auto' }}>
                                Thầy đang biên tập thêm nội dung. Quay lại sau nhé!
                            </p>
                        </div>
                    ) : (
                        /* ── Grid: 1 cột trên mobile, đúng 2 cột trên tablet/desktop ── */
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {filteredBlogs.map(blog => {
                                const gc = GRADE_COLORS[blog.grade || 0] || GRADE_COLORS[0];
                                return (
                                    <QuestionCard
                                        key={blog.id}
                                        blog={blog}
                                        isAdmin={isAdmin}
                                        onEditBlog={onEditBlog}
                                        onClick={() => onReadBlog(blog)}
                                        gc={gc}
                                        isSelected={selectedBlogIds.includes(blog.id)}
                                        onToggleSelect={() => handleToggleSelect(blog.id)}
                                    />
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* ── FLOATING BAR: Khi có câu hỏi được chọn ── */}
            {selectedBlogIds.length > 0 && (
                <div
                    style={{
                        position: 'fixed',
                        bottom: '24px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 40,
                        background: '#1A1A1A',
                        color: '#fff',
                        padding: '10px 20px',
                        borderRadius: '16px',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                        maxWidth: '92vw',
                        border: '1px solid rgba(255,255,255,0.1)',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600 }}>
                        <span style={{
                            minWidth: '22px', height: '22px', borderRadius: '50%',
                            background: '#7B1113', color: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '11px', fontWeight: 700, padding: '0 6px',
                        }}>
                            {selectedBlogIds.length}
                        </span>
                        <span>câu hỏi đã chọn</span>
                    </div>

                    <button
                        onClick={() => setSelectedBlogIds([])}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#AEACA8',
                            fontSize: '12px',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            padding: '4px 8px',
                        }}
                    >
                        Bỏ chọn
                    </button>

                    <button
                        onClick={() => setIsExamModalOpen(true)}
                        style={{
                            background: '#7B1113',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '10px',
                            padding: '8px 16px',
                            fontSize: '13px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 4px 12px rgba(123, 17, 19, 0.4)',
                            transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#920000'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#7B1113'; }}
                    >
                        <Sparkles style={{ width: '15px', height: '15px', color: '#FCD34D' }} />
                        <span>Biên soạn đề (LaTeX)</span>
                    </button>
                </div>
            )}

            {/* ── MODAL TÙY BIẾN STYLE & LAYOUT ── */}
            <ExamStyleModal
                isOpen={isExamModalOpen}
                onClose={() => setIsExamModalOpen(false)}
                questions={selectedQuestions}
            />
        </div>
    );
};

export default BlogList;
