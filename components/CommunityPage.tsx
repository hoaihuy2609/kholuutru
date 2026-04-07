import React from 'react';
import { Users } from 'lucide-react';
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
