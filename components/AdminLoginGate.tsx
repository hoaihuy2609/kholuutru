import React, { useState } from 'react';
import { RefreshCw, KeyRound, Lock, ShieldAlert, Atom } from 'lucide-react';

interface AdminLoginGateProps {
    onLogin: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    onCancel: () => void;
}

const AdminLoginGate: React.FC<AdminLoginGateProps> = ({ onLogin, onCancel }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!email.trim()) { setError('Vui lòng nhập email!'); return; }
        if (!password) { setError('Vui lòng nhập mật khẩu!'); return; }

        setError('');
        setIsLoading(true);
        try {
            const result = await onLogin(email.trim(), password);
            if (!result.success) {
                setError(result.error || 'Sai thông tin đăng nhập!');
            }
            // On success, App.tsx will re-render with isAdmin=true and show the dashboard
        } catch {
            setError('Lỗi kết nối đến máy chủ!');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div
            className="min-h-screen flex flex-col items-center justify-center px-4"
            style={{ background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)' }}
        >
            {/* Background decor */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #6B7CDB, transparent)' }} />
                <div className="absolute bottom-1/4 right-1/4 w-72 h-72 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #A78BFA, transparent)' }} />
            </div>

            {/* Card */}
            <div
                className="relative w-full max-w-sm rounded-2xl overflow-hidden"
                style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    backdropFilter: 'blur(20px)',
                    boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
                }}
            >
                {/* Header */}
                <div className="px-8 pt-8 pb-6 text-center">
                    <div
                        className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, #6B7CDB, #A78BFA)' }}
                    >
                        <Atom className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-xl font-bold text-white mb-1">PhysiVault Admin</h1>
                    <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                        Đăng nhập để truy cập bảng quản trị
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="px-8 pb-8 space-y-4">
                    {/* Email */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>
                            Email quản trị viên
                        </label>
                        <div className="relative">
                            <KeyRound
                                className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
                                style={{ color: 'rgba(255,255,255,0.3)' }}
                            />
                            <input
                                type="email"
                                value={email}
                                onChange={e => { setEmail(e.target.value); setError(''); }}
                                placeholder="admin@example.com"
                                autoFocus
                                onKeyDown={e => e.key === 'Enter' && document.getElementById('ag-pwd')?.focus()}
                                className="w-full rounded-xl text-sm text-white placeholder-white/30 outline-none transition-all"
                                style={{
                                    background: 'rgba(255,255,255,0.08)',
                                    border: '1px solid rgba(255,255,255,0.12)',
                                    padding: '11px 14px 11px 42px',
                                }}
                                onFocus={e => (e.currentTarget.style.borderColor = 'rgba(107,124,219,0.6)')}
                                onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')}
                            />
                        </div>
                    </div>

                    {/* Password */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>
                            Mật khẩu
                        </label>
                        <div className="relative">
                            <Lock
                                className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
                                style={{ color: 'rgba(255,255,255,0.3)' }}
                            />
                            <input
                                id="ag-pwd"
                                type="password"
                                value={password}
                                onChange={e => { setPassword(e.target.value); setError(''); }}
                                placeholder="••••••••"
                                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                                className="w-full rounded-xl text-sm text-white placeholder-white/30 outline-none transition-all"
                                style={{
                                    background: 'rgba(255,255,255,0.08)',
                                    border: '1px solid rgba(255,255,255,0.12)',
                                    padding: '11px 14px 11px 42px',
                                }}
                                onFocus={e => (e.currentTarget.style.borderColor = 'rgba(107,124,219,0.6)')}
                                onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')}
                            />
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div
                            className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm"
                            style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5' }}
                        >
                            <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                        style={{
                            background: 'linear-gradient(135deg, #6B7CDB, #A78BFA)',
                            boxShadow: '0 4px 15px rgba(107,124,219,0.3)',
                        }}
                        onMouseEnter={e => !isLoading && ((e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)')}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'}
                    >
                        {isLoading ? (
                            <><RefreshCw className="w-4 h-4 animate-spin" /> Đang xác thực...</>
                        ) : (
                            'Đăng nhập'
                        )}
                    </button>

                    {/* Back */}
                    <button
                        type="button"
                        onClick={onCancel}
                        className="w-full py-2.5 text-sm font-medium rounded-xl transition-colors"
                        style={{ color: 'rgba(255,255,255,0.4)' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.7)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.4)'}
                    >
                        ← Quay về trang chủ
                    </button>
                </form>
            </div>

            {/* Branding */}
            <p className="relative mt-8 text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
                PHYSIVAULT · ADMIN PORTAL
            </p>
        </div>
    );
};

export default AdminLoginGate;
