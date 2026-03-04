import React, { useState } from 'react';
import { ChevronRight, FlaskConical, Play, RotateCcw, Pause, Maximize2, Minimize2, ArrowLeft } from 'lucide-react';

// ── Danh sách thí nghiệm mẫu ──────────────────────────────────────
// Khi bạn tạo mô phỏng từ Google AI Studio, thêm vào mảng này
export interface SimulationItem {
    id: string;
    title: string;
    description: string;
    category: 'mechanics' | 'optics' | 'electromagnetism' | 'thermodynamics' | 'waves' | 'modern';
    grade: number; // 10, 11, 12
    thumbnail?: string; // emoji hoặc icon placeholder
    // Component mô phỏng sẽ được thêm sau
    component?: React.FC<{ width: number; height: number }>;
}

const CATEGORY_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
    mechanics: { label: 'Cơ học', color: '#6B7CDB', bg: '#EEF0FB', border: '#D4D9F5' },
    optics: { label: 'Quang học', color: '#D9730D', bg: '#FFF7ED', border: '#FED7AA' },
    electromagnetism: { label: 'Điện từ', color: '#E03E3E', bg: '#FEF2F2', border: '#FECACA' },
    thermodynamics: { label: 'Nhiệt học', color: '#448361', bg: '#EAF3EE', border: '#BBD6C7' },
    waves: { label: 'Sóng', color: '#9065B0', bg: '#F3ECF8', border: '#DCC8EC' },
    modern: { label: 'Vật lý hiện đại', color: '#2878BD', bg: '#EBF5FF', border: '#B3D9F5' },
};

// Danh sách thí nghiệm placeholder — sẽ được thay bằng code thật từ AI Studio
const SIMULATIONS: SimulationItem[] = [
    {
        id: 'pendulum',
        title: 'Con lắc đơn',
        description: 'Mô phỏng dao động của con lắc đơn. Thay đổi chiều dài dây, góc ban đầu và quan sát chu kỳ dao động.',
        category: 'mechanics',
        grade: 12,
        thumbnail: '🔔',
    },
    {
        id: 'free-fall',
        title: 'Rơi tự do',
        description: 'Thả vật từ độ cao bất kỳ và quan sát chuyển động rơi tự do dưới tác dụng của trọng lực.',
        category: 'mechanics',
        grade: 10,
        thumbnail: '🍎',
    },
    {
        id: 'light-reflection',
        title: 'Phản xạ ánh sáng',
        description: 'Chiếu tia sáng vào gương phẳng, gương cầu lồi/lõm và quan sát hiện tượng phản xạ.',
        category: 'optics',
        grade: 11,
        thumbnail: '🔦',
    },
    {
        id: 'spring-mass',
        title: 'Con lắc lò xo',
        description: 'Mô phỏng dao động của hệ lò xo - vật nặng. Thay đổi độ cứng k, khối lượng m.',
        category: 'mechanics',
        grade: 12,
        thumbnail: '🌀',
    },
    {
        id: 'electric-circuit',
        title: 'Mạch điện cơ bản',
        description: 'Lắp ráp mạch điện với nguồn, điện trở, bóng đèn. Đo dòng điện và hiệu điện thế.',
        category: 'electromagnetism',
        grade: 11,
        thumbnail: '⚡',
    },
    {
        id: 'wave-interference',
        title: 'Giao thoa sóng',
        description: 'Hai nguồn sóng kết hợp tạo ra hiện tượng giao thoa. Quan sát vân giao thoa trên màn.',
        category: 'waves',
        grade: 12,
        thumbnail: '🌊',
    },
];

interface SimulationLabProps {
    onBack?: () => void;
}

const SimulationLab: React.FC<SimulationLabProps> = ({ onBack }) => {
    const [selectedSim, setSelectedSim] = useState<SimulationItem | null>(null);
    const [filterCategory, setFilterCategory] = useState<string>('all');
    const [filterGrade, setFilterGrade] = useState<number>(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const filteredSims = SIMULATIONS.filter(sim => {
        if (filterCategory !== 'all' && sim.category !== filterCategory) return false;
        if (filterGrade !== 0 && sim.grade !== filterGrade) return false;
        return true;
    });

    // ── Simulation Viewer ──
    if (selectedSim) {
        return (
            <div className={`animate-fade-in ${isFullscreen ? 'fixed inset-0 z-50' : ''}`} style={{ background: isFullscreen ? '#F7F6F3' : 'transparent' }}>
                {/* Header */}
                <div className="flex items-center justify-between mb-4 px-1" style={isFullscreen ? { padding: '16px 24px', marginBottom: 0, borderBottom: '1px solid #E9E9E7', background: '#FFFFFF' } : {}}>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => { setSelectedSim(null); setIsPlaying(false); setIsFullscreen(false); }}
                            className="p-2 rounded-lg transition-colors"
                            style={{ color: '#57564F' }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#EBEBEA'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h2 className="text-lg font-semibold" style={{ color: '#1A1A1A' }}>{selectedSim.title}</h2>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span
                                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                    style={{
                                        background: CATEGORY_CONFIG[selectedSim.category].bg,
                                        color: CATEGORY_CONFIG[selectedSim.category].color,
                                        border: `1px solid ${CATEGORY_CONFIG[selectedSim.category].border}`,
                                    }}
                                >
                                    {CATEGORY_CONFIG[selectedSim.category].label}
                                </span>
                                <span className="text-[11px]" style={{ color: '#AEACA8' }}>Lớp {selectedSim.grade}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsPlaying(!isPlaying)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all active:scale-95"
                            style={{
                                background: isPlaying ? '#FEF2F2' : '#EEF0FB',
                                color: isPlaying ? '#E03E3E' : '#6B7CDB',
                                border: `1px solid ${isPlaying ? '#FECACA' : '#D4D9F5'}`,
                            }}
                        >
                            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                            {isPlaying ? 'Tạm dừng' : 'Chạy'}
                        </button>
                        <button
                            onClick={() => setIsPlaying(false)}
                            className="p-2 rounded-lg transition-colors"
                            style={{ color: '#57564F', border: '1px solid #E9E9E7' }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#EBEBEA'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                            title="Đặt lại"
                        >
                            <RotateCcw className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setIsFullscreen(!isFullscreen)}
                            className="p-2 rounded-lg transition-colors"
                            style={{ color: '#57564F', border: '1px solid #E9E9E7' }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#EBEBEA'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                            title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
                        >
                            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        </button>
                    </div>
                </div>

                {/* Simulation Canvas Area */}
                <div className={`${isFullscreen ? 'p-6' : ''}`} style={isFullscreen ? { height: 'calc(100vh - 73px)' } : {}}>
                    <div
                        className="rounded-2xl overflow-hidden relative"
                        style={{
                            background: '#FFFFFF',
                            border: '1px solid #E9E9E7',
                            boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
                            height: isFullscreen ? '100%' : '480px',
                        }}
                    >
                        {/* Canvas placeholder — sẽ bị thay bằng code từ AI Studio */}
                        {selectedSim.component ? (
                            <selectedSim.component width={800} height={isFullscreen ? 600 : 480} />
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                                {/* Animated placeholder */}
                                <div className="relative">
                                    <div
                                        className="w-24 h-24 rounded-3xl flex items-center justify-center text-4xl"
                                        style={{
                                            background: `linear-gradient(135deg, ${CATEGORY_CONFIG[selectedSim.category].bg}, ${CATEGORY_CONFIG[selectedSim.category].border})`,
                                            border: `2px solid ${CATEGORY_CONFIG[selectedSim.category].border}`,
                                        }}
                                    >
                                        {selectedSim.thumbnail}
                                    </div>
                                    {/* Pulse ring */}
                                    <div
                                        className="absolute inset-0 rounded-3xl animate-ping opacity-20"
                                        style={{ background: CATEGORY_CONFIG[selectedSim.category].color }}
                                    />
                                </div>

                                <div className="text-center max-w-sm">
                                    <h3 className="font-semibold text-base mb-1" style={{ color: '#1A1A1A' }}>
                                        {selectedSim.title}
                                    </h3>
                                    <p className="text-sm leading-relaxed" style={{ color: '#787774' }}>
                                        {selectedSim.description}
                                    </p>
                                </div>

                                {/* Status badge */}
                                <div
                                    className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium"
                                    style={{
                                        background: '#FFF7ED',
                                        color: '#D9730D',
                                        border: '1px solid #FED7AA',
                                    }}
                                >
                                    <FlaskConical className="w-4 h-4" />
                                    Đang chờ code mô phỏng từ Google AI Studio
                                </div>

                                <p className="text-xs mt-2" style={{ color: '#AEACA8' }}>
                                    Paste code HTML/JS vào chat để mình tích hợp vào đây nhé!
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Controls Panel */}
                    {!isFullscreen && (
                        <div
                            className="mt-4 rounded-xl p-4"
                            style={{ background: '#FFFFFF', border: '1px solid #E9E9E7' }}
                        >
                            <h4 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#AEACA8' }}>
                                Điều chỉnh thông số
                            </h4>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Placeholder controls */}
                                <div>
                                    <label className="text-sm font-medium mb-1 block" style={{ color: '#57564F' }}>
                                        Tham số 1
                                    </label>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        defaultValue="50"
                                        className="w-full accent-[#6B7CDB]"
                                    />
                                    <div className="flex justify-between text-[11px] mt-0.5" style={{ color: '#AEACA8' }}>
                                        <span>Min</span>
                                        <span>Max</span>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-sm font-medium mb-1 block" style={{ color: '#57564F' }}>
                                        Tham số 2
                                    </label>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        defaultValue="50"
                                        className="w-full accent-[#6B7CDB]"
                                    />
                                    <div className="flex justify-between text-[11px] mt-0.5" style={{ color: '#AEACA8' }}>
                                        <span>Min</span>
                                        <span>Max</span>
                                    </div>
                                </div>
                            </div>

                            <p className="text-xs mt-3 italic" style={{ color: '#AEACA8' }}>
                                * Các thanh điều chỉnh sẽ được kết nối khi có code mô phỏng thật
                            </p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ── Simulation List (Main View) ──
    return (
        <div className="space-y-6 animate-fade-in">
            {/* Breadcrumb */}
            {onBack && (
                <div className="flex items-center gap-1.5 text-sm" style={{ color: '#787774' }}>
                    <span
                        onClick={onBack}
                        className="cursor-pointer transition-colors"
                        style={{ color: '#787774' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#6B7CDB'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#787774'}
                    >
                        Tổng quan
                    </span>
                    <ChevronRight className="w-3.5 h-3.5" style={{ color: '#CFCFCB' }} />
                    <span className="font-medium" style={{ color: '#1A1A1A' }}>Phòng Thí Nghiệm</span>
                </div>
            )}

            {/* Title */}
            <div className="flex items-start justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="p-2.5 rounded-xl" style={{ background: 'linear-gradient(135deg, #EEF0FB, #F3ECF8)' }}>
                            <FlaskConical className="w-6 h-6" style={{ color: '#6B7CDB' }} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-semibold" style={{ color: '#1A1A1A' }}>
                                Phòng Thí Nghiệm
                            </h1>
                            <p className="text-sm" style={{ color: '#787774' }}>
                                Khám phá các hiện tượng vật lý qua mô phỏng tương tác
                            </p>
                        </div>
                    </div>
                </div>

                {/* Stats badge */}
                <div
                    className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl text-sm"
                    style={{ background: '#FFFFFF', border: '1px solid #E9E9E7' }}
                >
                    <FlaskConical className="w-4 h-4" style={{ color: '#6B7CDB' }} />
                    <span style={{ color: '#57564F' }}>
                        <strong style={{ color: '#1A1A1A' }}>{SIMULATIONS.length}</strong> thí nghiệm
                    </span>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
                {/* Category filter */}
                <div className="flex items-center gap-1 flex-wrap">
                    <button
                        onClick={() => setFilterCategory('all')}
                        className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                        style={{
                            background: filterCategory === 'all' ? '#1A1A1A' : '#FFFFFF',
                            color: filterCategory === 'all' ? '#FFFFFF' : '#57564F',
                            border: `1px solid ${filterCategory === 'all' ? '#1A1A1A' : '#E9E9E7'}`,
                        }}
                    >
                        Tất cả
                    </button>
                    {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                        <button
                            key={key}
                            onClick={() => setFilterCategory(key)}
                            className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                            style={{
                                background: filterCategory === key ? config.bg : '#FFFFFF',
                                color: filterCategory === key ? config.color : '#57564F',
                                border: `1px solid ${filterCategory === key ? config.border : '#E9E9E7'}`,
                            }}
                        >
                            {config.label}
                        </button>
                    ))}
                </div>

                {/* Grade filter */}
                <div className="hidden sm:flex items-center gap-1 ml-auto">
                    {[0, 10, 11, 12].map(g => (
                        <button
                            key={g}
                            onClick={() => setFilterGrade(g)}
                            className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                            style={{
                                background: filterGrade === g ? '#EEF0FB' : 'transparent',
                                color: filterGrade === g ? '#6B7CDB' : '#AEACA8',
                                border: `1px solid ${filterGrade === g ? '#D4D9F5' : 'transparent'}`,
                            }}
                        >
                            {g === 0 ? 'Tất cả lớp' : `Lớp ${g}`}
                        </button>
                    ))}
                </div>
            </div>

            {/* Simulation Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSims.map((sim) => {
                    const catConfig = CATEGORY_CONFIG[sim.category];
                    const hasComponent = !!sim.component;

                    return (
                        <div
                            key={sim.id}
                            onClick={() => setSelectedSim(sim)}
                            className="rounded-xl overflow-hidden cursor-pointer group transition-all duration-200"
                            style={{ background: '#FFFFFF', border: '1px solid #E9E9E7' }}
                            onMouseEnter={e => {
                                (e.currentTarget as HTMLElement).style.borderColor = catConfig.border;
                                (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 16px rgba(0,0,0,0.08)`;
                                (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                            }}
                            onMouseLeave={e => {
                                (e.currentTarget as HTMLElement).style.borderColor = '#E9E9E7';
                                (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                            }}
                        >
                            {/* Thumbnail area */}
                            <div
                                className="h-36 flex items-center justify-center relative"
                                style={{
                                    background: `linear-gradient(135deg, ${catConfig.bg} 0%, #FFFFFF 100%)`,
                                }}
                            >
                                <span className="text-5xl select-none" style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.1))' }}>
                                    {sim.thumbnail}
                                </span>

                                {/* Status dot */}
                                <div
                                    className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-semibold"
                                    style={{
                                        background: hasComponent ? '#EAF3EE' : '#FFF7ED',
                                        color: hasComponent ? '#448361' : '#D9730D',
                                        border: `1px solid ${hasComponent ? '#BBD6C7' : '#FED7AA'}`,
                                    }}
                                >
                                    <span
                                        className="w-1.5 h-1.5 rounded-full"
                                        style={{ background: hasComponent ? '#448361' : '#D9730D' }}
                                    />
                                    {hasComponent ? 'Sẵn sàng' : 'Đang phát triển'}
                                </div>

                                {/* Grade badge */}
                                <div
                                    className="absolute top-3 left-3 px-2 py-1 rounded-full text-[10px] font-bold"
                                    style={{
                                        background: 'rgba(255,255,255,0.9)',
                                        color: '#57564F',
                                        border: '1px solid #E9E9E7',
                                        backdropFilter: 'blur(8px)',
                                    }}
                                >
                                    Lớp {sim.grade}
                                </div>

                                {/* Play overlay on hover */}
                                <div
                                    className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                                    style={{ background: 'rgba(26,26,26,0.05)' }}
                                >
                                    <div
                                        className="w-12 h-12 rounded-full flex items-center justify-center"
                                        style={{
                                            background: 'rgba(255,255,255,0.95)',
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                                        }}
                                    >
                                        <Play className="w-5 h-5 ml-0.5" style={{ color: catConfig.color }} />
                                    </div>
                                </div>
                            </div>

                            {/* Info */}
                            <div className="p-4">
                                <div className="flex items-start justify-between mb-2">
                                    <h3 className="font-semibold text-sm" style={{ color: '#1A1A1A' }}>
                                        {sim.title}
                                    </h3>
                                </div>
                                <p className="text-xs leading-relaxed line-clamp-2 mb-3" style={{ color: '#787774' }}>
                                    {sim.description}
                                </p>

                                <div className="flex items-center justify-between">
                                    <span
                                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                        style={{
                                            background: catConfig.bg,
                                            color: catConfig.color,
                                            border: `1px solid ${catConfig.border}`,
                                        }}
                                    >
                                        {catConfig.label}
                                    </span>
                                    <ChevronRight className="w-4 h-4" style={{ color: '#CFCFCB' }} />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Empty state */}
            {filteredSims.length === 0 && (
                <div className="text-center py-16">
                    <FlaskConical className="w-12 h-12 mx-auto mb-3" style={{ color: '#CFCFCB' }} />
                    <h3 className="font-semibold mb-1" style={{ color: '#57564F' }}>Chưa có thí nghiệm nào</h3>
                    <p className="text-sm" style={{ color: '#AEACA8' }}>
                        Thử thay đổi bộ lọc hoặc quay lại sau nhé!
                    </p>
                </div>
            )}

            {/* Info banner */}
            <div
                className="rounded-xl p-4 flex items-start gap-3"
                style={{ background: '#EEF0FB', border: '1px solid #D4D9F5' }}
            >
                <FlaskConical className="w-5 h-5 shrink-0 mt-0.5" style={{ color: '#6B7CDB' }} />
                <div>
                    <h4 className="text-sm font-semibold mb-0.5" style={{ color: '#4A5AC7' }}>
                        Cách thêm thí nghiệm mới
                    </h4>
                    <p className="text-xs leading-relaxed" style={{ color: '#6B7CDB' }}>
                        Tạo mô phỏng trên Google AI Studio bằng HTML5 Canvas + JavaScript, sau đó gửi code cho admin để tích hợp vào đây. Mỗi thí nghiệm sẽ có nút Play/Pause, Reset và các thanh điều chỉnh thông số.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default SimulationLab;
