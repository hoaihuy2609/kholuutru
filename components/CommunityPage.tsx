import React from 'react';
import { Users, MessageCircle, TrendingUp, Shield } from 'lucide-react';
import ForumFeed from './ForumFeed';

interface CommunityPageProps {
    isAdmin: boolean;
}

// ── Design tokens (match PhysiVault palette) ──────────────────────
const NAVY = '#23497c';
const BORDER = '#E9E9E7';
const TEXT_PRIMARY = '#1A1A1A';
const TEXT_SECONDARY = '#787774';
const TEXT_MUTED = '#AEACA8';
const BG_WARM = '#F7F6F3';

const CommunityPage: React.FC<CommunityPageProps> = ({ isAdmin }) => {
    const adminKey = import.meta.env.VITE_COMMENT_ADMIN_KEY;

    return (
        <div
            className="min-h-screen animate-fade-in"
            style={{ background: BG_WARM, fontFamily: "'Inter', -apple-system, sans-serif" }}
        >
            {/* ── Page Header ─────────────────────────────────────────────── */}
            <div
                className="sticky top-0 z-20 px-5 py-4 border-b"
                style={{ background: '#FFFFFF', borderColor: BORDER }}
            >
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                            style={{ background: '#EEF2F8' }}
                        >
                            <Users className="w-5 h-5" style={{ color: NAVY }} />
                        </div>
                        <div>
                            <h1 className="font-bold text-[17px] leading-tight" style={{ color: TEXT_PRIMARY }}>
                                Cộng Đồng Thảo Luận
                            </h1>
                            <p className="text-[12px] leading-tight" style={{ color: TEXT_MUTED }}>
                                Đặt câu hỏi · Chia sẻ kiến thức · Học cùng nhau
                            </p>
                        </div>
                    </div>

                    {/* Info chips */}
                    <div className="hidden md:flex items-center gap-2">
                        <span
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium"
                            style={{ background: '#EEF2F8', color: NAVY }}
                        >
                            <MessageCircle className="w-3.5 h-3.5" />
                            Hỏi đáp Vật lý
                        </span>
                        <span
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium"
                            style={{ background: '#EAF3EE', color: '#448361' }}
                        >
                            <TrendingUp className="w-3.5 h-3.5" />
                            Cộng đồng hoạt động
                        </span>
                        {isAdmin && (
                            <span
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold"
                                style={{ background: '#F3ECF8', color: '#9065B0' }}
                            >
                                <Shield className="w-3.5 h-3.5" />
                                Quản trị viên
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Rules Banner (subtle, not intrusive) ─────────────────────── */}
            <div
                className="border-b px-5 py-2.5"
                style={{ background: '#FEFDF9', borderColor: '#F0EDDE' }}
            >
                <div className="max-w-4xl mx-auto flex gap-4 text-[11px] flex-wrap" style={{ color: TEXT_SECONDARY }}>
                    <span>📐 Đặt câu hỏi rõ ràng, kèm công thức nếu cần</span>
                    <span>·</span>
                    <span>🤝 Tôn trọng và hỗ trợ lẫn nhau</span>
                    <span>·</span>
                    <span>✅ Đánh dấu đã giải đáp khi có câu trả lời phù hợp</span>
                </div>
            </div>

            {/* ── Forum Feed ──────────────────────────────────────────────── */}
            <div className="max-w-4xl mx-auto px-4 py-5">
                <ForumFeed isAdmin={isAdmin} adminKey={adminKey} />
            </div>
        </div>
    );
};

export default CommunityPage;
