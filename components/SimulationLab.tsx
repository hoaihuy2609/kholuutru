import React, { useState } from 'react';
import { ChevronRight, FlaskConical, ArrowLeft } from 'lucide-react';

// ── Import các simulation từ Google AI Studio ──────────────────────
import CarSimulation from './simulations/CarSimulation';

// ── Danh sách thí nghiệm ──────────────────────────────────────────
// Mỗi thí nghiệm từ Google AI Studio là một component React hoàn chỉnh
// (đã có đầy đủ tương tác bên trong), chỉ cần nhúng vào đây
export interface SimulationItem {
    id: string;
    title: string;
    description: string;
    category: 'mechanics' | 'optics' | 'electromagnetism' | 'thermodynamics' | 'waves' | 'modern';
    grade: number; // 10, 11, 12
    thumbnail: string; // emoji
    aiStudioUrl?: string; // link tới app trên AI Studio
    component?: React.FC; // Component simulation đã có đầy đủ tương tác
}

const CATEGORY_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
    mechanics: { label: 'Cơ học', color: '#6B7CDB', bg: '#EEF0FB', border: '#D4D9F5' },
    optics: { label: 'Quang học', color: '#D9730D', bg: '#FFF7ED', border: '#FED7AA' },
    electromagnetism: { label: 'Điện từ', color: '#E03E3E', bg: '#FEF2F2', border: '#FECACA' },
    thermodynamics: { label: 'Nhiệt học', color: '#448361', bg: '#EAF3EE', border: '#BBD6C7' },
    waves: { label: 'Sóng', color: '#9065B0', bg: '#F3ECF8', border: '#DCC8EC' },
    modern: { label: 'Vật lý hiện đại', color: '#2878BD', bg: '#EBF5FF', border: '#B3D9F5' },
};

// ── Thí nghiệm đã có code thật từ AI Studio ──
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
    // ── Thêm thí nghiệm mới ở đây ──
    // Chỉ cần:
    // 1. Tải file zip từ Google AI Studio
    // 2. Copy component vào thư mục components/simulations/
    // 3. Import và thêm vào mảng này
];

interface SimulationLabProps {
    onBack?: () => void;
}

const SimulationLab: React.FC<SimulationLabProps> = ({ onBack }) => {
    const [selectedSim, setSelectedSim] = useState<SimulationItem | null>(null);

    // ── Simulation Viewer ──
    // Khi mở thí nghiệm: chỉ hiển thị component từ AI Studio,
    // vì bản thân component đã có đầy đủ tương tác (play, pause, reset, v.v.)
    if (selectedSim) {
        const catConfig = CATEGORY_CONFIG[selectedSim.category];

        return (
            <div className="animate-fade-in" style={{ maxWidth: '100%' }}>
                {/* Header bar */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '16px',
                    padding: '0 4px',
                    flexWrap: 'wrap',
                    gap: '8px',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <button
                            onClick={() => setSelectedSim(null)}
                            style={{
                                padding: '8px',
                                borderRadius: '8px',
                                border: 'none',
                                background: 'transparent',
                                color: '#57564F',
                                cursor: 'pointer',
                                transition: 'background 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#EBEBEA')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1A1A1A', margin: 0 }}>
                                {selectedSim.title}
                            </h2>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                                <span style={{
                                    fontSize: '10px',
                                    fontWeight: 600,
                                    padding: '2px 8px',
                                    borderRadius: '999px',
                                    background: catConfig.bg,
                                    color: catConfig.color,
                                    border: `1px solid ${catConfig.border}`,
                                }}>
                                    {catConfig.label}
                                </span>
                                <span style={{ fontSize: '11px', color: '#AEACA8' }}>Lớp {selectedSim.grade}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Simulation Content — component từ AI Studio tự quản lý tương tác */}
                <div style={{
                    borderRadius: '16px',
                    overflow: 'hidden',
                    background: '#FFFFFF',
                    border: '1px solid #E9E9E7',
                    boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
                }}>
                    {selectedSim.component ? (
                        <selectedSim.component />
                    ) : (
                        /* Placeholder nếu chưa có component */
                        <div style={{
                            padding: '80px 20px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '16px',
                        }}>
                            <div style={{
                                width: '80px',
                                height: '80px',
                                borderRadius: '20px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '36px',
                                background: `linear-gradient(135deg, ${catConfig.bg}, ${catConfig.border})`,
                                border: `2px solid ${catConfig.border}`,
                            }}>
                                {selectedSim.thumbnail}
                            </div>
                            <div style={{ textAlign: 'center', maxWidth: '320px' }}>
                                <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1A1A1A', margin: '0 0 4px' }}>
                                    {selectedSim.title}
                                </h3>
                                <p style={{ fontSize: '14px', color: '#787774', margin: 0, lineHeight: 1.5 }}>
                                    {selectedSim.description}
                                </p>
                            </div>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '8px 16px',
                                borderRadius: '999px',
                                fontSize: '13px',
                                fontWeight: 500,
                                background: '#FFF7ED',
                                color: '#D9730D',
                                border: '1px solid #FED7AA',
                            }}>
                                <FlaskConical size={16} />
                                Đang chờ code từ Google AI Studio
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ── Simulation List (Main View) ──
    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Breadcrumb */}
            {onBack && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#787774' }}>
                    <span
                        onClick={onBack}
                        style={{ cursor: 'pointer', transition: 'color 0.2s', color: '#787774' }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#6B7CDB')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#787774')}
                    >
                        Tổng quan
                    </span>
                    <ChevronRight size={14} style={{ color: '#CFCFCB' }} />
                    <span style={{ fontWeight: 500, color: '#1A1A1A' }}>Phòng Thí Nghiệm</span>
                </div>
            )}

            {/* Title */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                        <div style={{
                            padding: '10px',
                            borderRadius: '12px',
                            background: 'linear-gradient(135deg, #EEF0FB, #F3ECF8)',
                        }}>
                            <FlaskConical size={24} style={{ color: '#6B7CDB' }} />
                        </div>
                        <div>
                            <h1 style={{ fontSize: '24px', fontWeight: 600, color: '#1A1A1A', margin: 0 }}>
                                Phòng Thí Nghiệm
                            </h1>
                            <p style={{ fontSize: '14px', color: '#787774', margin: '2px 0 0' }}>
                                Khám phá các hiện tượng vật lý qua mô phỏng tương tác từ Google AI Studio
                            </p>
                        </div>
                    </div>
                </div>

                {/* Stats badge */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    borderRadius: '12px',
                    fontSize: '14px',
                    background: '#FFFFFF',
                    border: '1px solid #E9E9E7',
                }}>
                    <FlaskConical size={16} style={{ color: '#6B7CDB' }} />
                    <span style={{ color: '#57564F' }}>
                        <strong style={{ color: '#1A1A1A' }}>{SIMULATIONS.length}</strong> thí nghiệm
                    </span>
                </div>
            </div>


            {/* Simulation Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '16px',
            }}>
                {SIMULATIONS.map((sim) => {
                    const catConfig = CATEGORY_CONFIG[sim.category];
                    const hasComponent = !!sim.component;

                    return (
                        <div
                            key={sim.id}
                            onClick={() => setSelectedSim(sim)}
                            style={{
                                borderRadius: '12px',
                                overflow: 'hidden',
                                cursor: 'pointer',
                                background: '#FFFFFF',
                                border: '1px solid #E9E9E7',
                                transition: 'all 0.2s',
                            }}
                            onMouseEnter={e => {
                                (e.currentTarget as HTMLElement).style.borderColor = catConfig.border;
                                (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)';
                                (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                            }}
                            onMouseLeave={e => {
                                (e.currentTarget as HTMLElement).style.borderColor = '#E9E9E7';
                                (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                            }}
                        >
                            {/* Thumbnail area */}
                            <div style={{
                                height: '140px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                position: 'relative',
                                background: `linear-gradient(135deg, ${catConfig.bg} 0%, #FFFFFF 100%)`,
                            }}>
                                <span style={{
                                    fontSize: '48px',
                                    userSelect: 'none',
                                    filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.1))',
                                }}>
                                    {sim.thumbnail}
                                </span>

                                {/* Status dot */}
                                <div style={{
                                    position: 'absolute',
                                    top: '12px',
                                    right: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '4px 8px',
                                    borderRadius: '999px',
                                    fontSize: '10px',
                                    fontWeight: 600,
                                    background: hasComponent ? '#EAF3EE' : '#FFF7ED',
                                    color: hasComponent ? '#448361' : '#D9730D',
                                    border: `1px solid ${hasComponent ? '#BBD6C7' : '#FED7AA'}`,
                                }}>
                                    <span style={{
                                        width: '6px',
                                        height: '6px',
                                        borderRadius: '50%',
                                        background: hasComponent ? '#448361' : '#D9730D',
                                    }} />
                                    {hasComponent ? 'Sẵn sàng' : 'Đang phát triển'}
                                </div>

                                {/* Grade badge */}
                                <div style={{
                                    position: 'absolute',
                                    top: '12px',
                                    left: '12px',
                                    padding: '4px 8px',
                                    borderRadius: '999px',
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    background: 'rgba(255,255,255,0.9)',
                                    color: '#57564F',
                                    border: '1px solid #E9E9E7',
                                    backdropFilter: 'blur(8px)',
                                }}>
                                    Lớp {sim.grade}
                                </div>
                            </div>

                            {/* Info */}
                            <div style={{ padding: '16px' }}>
                                <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#1A1A1A', margin: '0 0 8px' }}>
                                    {sim.title}
                                </h3>
                                <p style={{
                                    fontSize: '12px',
                                    lineHeight: 1.5,
                                    color: '#787774',
                                    margin: '0 0 12px',
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                }}>
                                    {sim.description}
                                </p>

                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span style={{
                                        fontSize: '10px',
                                        fontWeight: 600,
                                        padding: '2px 8px',
                                        borderRadius: '999px',
                                        background: catConfig.bg,
                                        color: catConfig.color,
                                        border: `1px solid ${catConfig.border}`,
                                    }}>
                                        {catConfig.label}
                                    </span>
                                    <ChevronRight size={16} style={{ color: '#CFCFCB' }} />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Empty state */}
            {SIMULATIONS.length === 0 && (
                <div style={{ textAlign: 'center', padding: '64px 20px' }}>
                    <FlaskConical size={48} style={{ color: '#CFCFCB', margin: '0 auto 12px' }} />
                    <h3 style={{ fontWeight: 600, color: '#57564F', margin: '0 0 4px' }}>Chưa có thí nghiệm nào</h3>
                    <p style={{ fontSize: '14px', color: '#AEACA8', margin: 0 }}>
                        Quay lại sau nhé!
                    </p>
                </div>
            )}
        </div>
    );
};

export default SimulationLab;
