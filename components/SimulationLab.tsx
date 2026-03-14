import React, { useState } from 'react';
import { ChevronRight, ChevronDown, FlaskConical, ArrowLeft, Activity, Zap, Atom } from 'lucide-react';

// ── Import các simulation từ Google AI Studio ──────────────────────
import CarSimulation from './simulations/CarSimulation';
import WaterBoilingSimulation from './simulations/WaterBoilingSimulation';

// ── Danh sách thí nghiệm ──────────────────────────────────────────
export interface SimulationItem {
    id: string;
    title: string;
    description: string;
    category: 'mechanics' | 'optics' | 'electromagnetism' | 'thermodynamics' | 'waves' | 'modern';
    grade: number; // 10, 11, 12
    thumbnail: string; // emoji
    aiStudioUrl?: string;
    component?: React.FC;
}

const CATEGORY_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
    mechanics: { label: 'Cơ học', color: '#6B7CDB', bg: '#EEF0FB', border: '#D4D9F5' },
    optics: { label: 'Quang học', color: '#D9730D', bg: '#FFF3E8', border: '#FED7AA' },
    electromagnetism: { label: 'Điện từ', color: '#E03E3E', bg: '#FEE2E2', border: '#FECACA' },
    thermodynamics: { label: 'Nhiệt học', color: '#448361', bg: '#EAF3EE', border: '#BBD6C7' },
    waves: { label: 'Sóng', color: '#9065B0', bg: '#F3ECF8', border: '#DCC8EC' },
    modern: { label: 'Vật lý hiện đại', color: '#2878BD', bg: '#EBF5FF', border: '#B3D9F5' },
};

// ── Cấu hình khối lớp — giống Dashboard (10=green, 11=blue, 12=purple) ──
const GRADE_CONFIG: Record<number, {
    label: string;
    color: string;
    colorLight: string;
    colorBorder: string;
    icon: React.ElementType;
}> = {
    10: { label: 'Lớp 10', color: '#448361', colorLight: '#EAF3EE', colorBorder: '#B7D9C4', icon: Activity },
    11: { label: 'Lớp 11', color: '#6B7CDB', colorLight: '#EEF0FB', colorBorder: '#B8C1EF', icon: Zap },
    12: { label: 'Lớp 12', color: '#9065B0', colorLight: '#F3ECF8', colorBorder: '#C8A8DC', icon: Atom },
};

// ── Thí nghiệm ──
const SIMULATIONS: SimulationItem[] = [
    {
        id: 'car-motion',
        title: 'Chuyển động của xe',
        description: 'Mô phỏng chuyển động thẳng biến đổi đều của xe với đồ thị Vận tốc - Thời gian đồng bộ.',
        category: 'mechanics',
        grade: 10,
        thumbnail: '🚗',
        aiStudioUrl: 'https://ai.studio/apps/1019ba63-7aa7-479c-b53d-ee1d0f2cd4dd',
        component: CarSimulation,
    },
    {
        id: 'water-boiling',
        title: 'Đo Nhiệt Hoá Hơi Riêng',
        description: 'Thực hành xác định nhiệt hóa hơi riêng L của nước tại 100°C bằng số liệu thực tế.',
        category: 'thermodynamics',
        grade: 12,
        thumbnail: '⚗',
        component: WaterBoilingSimulation,
    },
    // ── Thêm thí nghiệm mới ở đây ──
];

const GRADE_ORDER = [10, 11, 12];

interface SimulationLabProps {
    onBack?: () => void;
}

const SimulationLab: React.FC<SimulationLabProps> = ({ onBack }) => {
    const [selectedSim, setSelectedSim] = useState<SimulationItem | null>(null);
    const [expandedGrades, setExpandedGrades] = useState<Record<number, boolean>>({ 10: true, 11: true, 12: true });

    const toggleGrade = (grade: number) => {
        setExpandedGrades(prev => ({ ...prev, [grade]: !prev[grade] }));
    };

    const simsByGrade = GRADE_ORDER.map(grade => ({
        grade,
        config: GRADE_CONFIG[grade],
        sims: SIMULATIONS.filter(s => s.grade === grade),
    }));

    // ── Simulation Viewer ──
    if (selectedSim) {
        const catConfig = CATEGORY_CONFIG[selectedSim.category];
        const gradeConfig = GRADE_CONFIG[selectedSim.grade];

        return (
            <div className="space-y-4 animate-fade-in">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setSelectedSim(null)}
                        className="p-2 rounded-lg transition-colors"
                        style={{ background: '#F1F0EC', border: '1px solid #E9E9E7', color: '#57564F' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#E9E9E7'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#F1F0EC'}
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span
                                className="inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded"
                                style={{ background: gradeConfig.colorLight, color: gradeConfig.color }}
                            >
                                {gradeConfig.label}
                            </span>
                            <span
                                className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded"
                                style={{ background: catConfig.bg, color: catConfig.color }}
                            >
                                {catConfig.label}
                            </span>
                        </div>
                        <h2 className="text-xl font-semibold" style={{ color: '#1A1A1A' }}>
                            {selectedSim.title}
                        </h2>
                    </div>
                </div>

                {/* Simulation Content */}
                <div
                    className="rounded-xl overflow-hidden"
                    style={{ background: '#FFFFFF', border: '1px solid #E9E9E7', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
                >
                    {selectedSim.component ? (
                        <selectedSim.component />
                    ) : (
                        <div className="flex flex-col items-center gap-4 py-20 px-5">
                            <div
                                className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
                                style={{ background: catConfig.bg, border: `1px solid ${catConfig.border}` }}
                            >
                                {selectedSim.thumbnail}
                            </div>
                            <div className="text-center max-w-xs">
                                <h3 className="font-semibold mb-1" style={{ color: '#1A1A1A' }}>{selectedSim.title}</h3>
                                <p className="text-sm leading-relaxed" style={{ color: '#787774' }}>{selectedSim.description}</p>
                            </div>
                            <span
                                className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full"
                                style={{ background: '#FFF3E8', color: '#D9730D', border: '1px solid #FED7AA' }}
                            >
                                <FlaskConical className="w-3.5 h-3.5" />
                                Đang chờ code từ Google AI Studio
                            </span>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ── Main View — Phân theo khối lớp ──
    return (
        <div className="space-y-6 animate-fade-in pb-10">

            {/* Breadcrumb */}
            {onBack && (
                <div className="flex items-center gap-1.5 text-sm" style={{ color: '#787774' }}>
                    <span
                        onClick={onBack}
                        className="cursor-pointer transition-colors"
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#6B7CDB'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#787774'}
                    >
                        Tổng quan
                    </span>
                    <ChevronRight className="w-3.5 h-3.5" style={{ color: '#CFCFCB' }} />
                    <span className="font-medium" style={{ color: '#1A1A1A' }}>Phòng Thí Nghiệm</span>
                </div>
            )}

            {/* Title Section */}
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <span
                        className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded"
                        style={{ background: '#EEF0FB', color: '#6B7CDB' }}
                    >
                        <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#6B7CDB' }} />
                        Phòng mô phỏng tương tác
                    </span>
                </div>

                <div className="flex items-start justify-between flex-wrap gap-3">
                    <div>
                        <h1 className="text-2xl font-semibold mb-1" style={{ color: '#1A1A1A' }}>
                            Phòng Thí Nghiệm
                        </h1>
                        <p className="text-sm" style={{ color: '#787774' }}>
                            Khám phá các hiện tượng vật lý qua mô phỏng tương tác
                        </p>
                    </div>

                    <div
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
                        style={{ background: '#FFFFFF', border: '1px solid #E9E9E7' }}
                    >
                        <FlaskConical className="w-4 h-4" style={{ color: '#6B7CDB' }} />
                        <span style={{ color: '#787774' }}>
                            <strong style={{ color: '#1A1A1A' }}>{SIMULATIONS.length}</strong> thí nghiệm
                        </span>
                    </div>
                </div>
            </div>

            {/* ── Grade Sections ── */}
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <h2 className="text-base font-semibold" style={{ color: '#1A1A1A' }}>Khối Lớp</h2>
                    <div className="flex-1 h-px" style={{ background: '#E9E9E7' }} />
                </div>

                <div className="space-y-4">
                    {simsByGrade.map(({ grade, config, sims }) => {
                        const isExpanded = expandedGrades[grade] !== false;
                        const GradeIcon = config.icon;

                        return (
                            <div
                                key={grade}
                                className="rounded-xl overflow-hidden"
                                style={{ background: '#FFFFFF', border: '1px solid #E9E9E7', borderTop: `3px solid ${config.color}` }}
                            >
                                {/* Section Header — giống ChapterView CategorySection */}
                                <div
                                    onClick={() => toggleGrade(grade)}
                                    className="flex items-center justify-between p-4 cursor-pointer select-none transition-colors"
                                    style={{ borderBottom: isExpanded ? '1px solid #E9E9E7' : 'none' }}
                                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#FAFAF9'}
                                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#FFFFFF'}
                                >
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-9 h-9 rounded-lg flex items-center justify-center"
                                            style={{ background: `${config.color}15` }}
                                        >
                                            <GradeIcon className="w-5 h-5" style={{ color: config.color }} />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>
                                                Vật Lý {config.label}
                                            </h3>
                                            <p className="text-xs mt-0.5" style={{ color: '#787774' }}>
                                                {sims.length > 0
                                                    ? `${sims.length} thí nghiệm mô phỏng`
                                                    : 'Đang chuẩn bị — sắp ra mắt!'
                                                }
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {sims.length > 0 && (
                                            <span
                                                className="text-xs font-medium px-2 py-0.5 rounded"
                                                style={{ background: '#F1F0EC', color: '#787774' }}
                                            >
                                                {sims.length} mục
                                            </span>
                                        )}
                                        <div
                                            className="flex items-center transition-transform duration-200"
                                            style={{
                                                color: '#AEACA8',
                                                transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                                            }}
                                        >
                                            <ChevronDown className="w-4 h-4" />
                                        </div>
                                    </div>
                                </div>

                                {/* Content */}
                                {isExpanded && (
                                    <div style={{ background: '#FAFAF9' }}>
                                        {sims.length > 0 ? (
                                            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                {sims.map((sim) => {
                                                    const catConfig = CATEGORY_CONFIG[sim.category];
                                                    const hasComponent = !!sim.component;

                                                    return (
                                                        <div
                                                            key={sim.id}
                                                            onClick={() => setSelectedSim(sim)}
                                                            className="rounded-xl overflow-hidden cursor-pointer transition-all group"
                                                            style={{ background: '#FFFFFF', border: '1px solid #E9E9E7' }}
                                                            onMouseEnter={e => {
                                                                (e.currentTarget as HTMLElement).style.borderColor = '#CFCFCB';
                                                                (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
                                                            }}
                                                            onMouseLeave={e => {
                                                                (e.currentTarget as HTMLElement).style.borderColor = '#E9E9E7';
                                                                (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                                                            }}
                                                        >
                                                            {/* Thumbnail */}
                                                            <div
                                                                className="h-28 flex items-center justify-center relative"
                                                                style={{ background: `linear-gradient(135deg, ${catConfig.bg} 0%, #FFFFFF 100%)` }}
                                                            >
                                                                <span className="text-4xl select-none" style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.08))' }}>
                                                                    {sim.thumbnail}
                                                                </span>

                                                                {/* Status badge */}
                                                                <div
                                                                    className="absolute top-2.5 right-2.5 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold"
                                                                    style={{
                                                                        background: hasComponent ? '#EAF3EE' : '#FFF3E8',
                                                                        color: hasComponent ? '#448361' : '#D9730D',
                                                                        border: `1px solid ${hasComponent ? '#BBD6C7' : '#FED7AA'}`,
                                                                    }}
                                                                >
                                                                    <span
                                                                        className="w-1 h-1 rounded-full inline-block"
                                                                        style={{ background: hasComponent ? '#448361' : '#D9730D' }}
                                                                    />
                                                                    {hasComponent ? 'Sẵn sàng' : 'Sắp có'}
                                                                </div>
                                                            </div>

                                                            {/* Info */}
                                                            <div className="p-3.5">
                                                                <h4 className="text-sm font-semibold mb-1.5" style={{ color: '#1A1A1A' }}>
                                                                    {sim.title}
                                                                </h4>
                                                                <p
                                                                    className="text-xs leading-relaxed mb-3"
                                                                    style={{
                                                                        color: '#787774',
                                                                        display: '-webkit-box',
                                                                        WebkitLineClamp: 2,
                                                                        WebkitBoxOrient: 'vertical',
                                                                        overflow: 'hidden',
                                                                    }}
                                                                >
                                                                    {sim.description}
                                                                </p>

                                                                <div className="flex items-center justify-between">
                                                                    <span
                                                                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                                                        style={{ background: catConfig.bg, color: catConfig.color, border: `1px solid ${catConfig.border}` }}
                                                                    >
                                                                        {catConfig.label}
                                                                    </span>
                                                                    <div className="flex items-center gap-1 text-sm font-medium" style={{ color: config.color }}>
                                                                        Mở
                                                                        <span className="transition-transform group-hover:translate-x-0.5">→</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            /* Empty state */
                                            <div className="py-10 text-center">
                                                <div
                                                    className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-2"
                                                    style={{ background: `${config.color}15` }}
                                                >
                                                    <FlaskConical className="w-5 h-5" style={{ color: config.color, opacity: 0.4 }} />
                                                </div>
                                                <p className="text-sm font-medium" style={{ color: '#AEACA8' }}>
                                                    Đang chuẩn bị thí nghiệm cho {config.label}
                                                </p>
                                                <p className="text-xs mt-1" style={{ color: '#CFCFCB' }}>
                                                    Quay lại sau nhé!
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default SimulationLab;
