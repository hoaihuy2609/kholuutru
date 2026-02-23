
import React, { useRef, useState, useEffect } from 'react';
import { Download, Upload, X, ShieldAlert, Lock, Unlock, KeyRound, Monitor, UserCheck, ShieldCheck, History, Trash2, LayoutDashboard, Phone } from 'lucide-react';
import { useCloudStorage, exportData, importData, getMachineId, generateActivationKey } from '../src/hooks/useCloudStorage';

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxqtcHkPal4oAB0R0A6s2WmxsS6SOxsQefruSPZXEJm_c_Ivl6sW_HnqOVDxUuoAH-W/exec";

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onShowToast: (message: string, type: 'success' | 'error' | 'warning') => void;
    isAdmin: boolean;
    onToggleAdmin: (status: boolean) => void;
    onOpenDashboard: () => void;
}

/* ── Tiny shared input style ── */
const inputStyle: React.CSSProperties = {
    background: '#FFFFFF',
    border: '1px solid #E9E9E7',
    borderRadius: '8px',
    color: '#1A1A1A',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.15s',
    width: '100%',
};

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onShowToast, isAdmin, onToggleAdmin, onOpenDashboard }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { lessons, storedFiles, isActivated, activateSystem } = useCloudStorage();
    const [password, setPassword] = useState('');
    const [showPassInput, setShowPassInput] = useState(false);

    const [myMachineId, setMyMachineId] = useState('');
    const [studentKeyInput, setStudentKeyInput] = useState('');
    const [studentSdt, setStudentSdt] = useState('');
    const [adminTargetId, setAdminTargetId] = useState('');
    const [adminTargetSdt, setAdminTargetSdt] = useState('');
    const [studentName, setStudentName] = useState('');
    const [generatedKey, setGeneratedKey] = useState('');
    const [activationHistory, setActivationHistory] = useState<{ id: string; name: string; key: string; date: number }[]>([]);

    useEffect(() => {
        if (isOpen) {
            setMyMachineId(getMachineId());
            const history = localStorage.getItem('pv_activation_history');
            if (history) setActivationHistory(JSON.parse(history));
            const savedSdt = localStorage.getItem('pv_activated_sdt');
            const pendingSdt = localStorage.getItem('pv_pending_sdt');
            if (pendingSdt) setStudentSdt(pendingSdt);
            else if (savedSdt) setStudentSdt(savedSdt);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    /* ── Handlers (unchanged logic) ── */
    const handleGenerateKey = async () => {
        const targetId = adminTargetId.trim();
        const name = studentName.trim();
        const sdt = adminTargetSdt.trim();
        if (!targetId) { onShowToast('Vui lòng nhập Mã máy của học sinh', 'warning'); return; }
        if (!sdt) { onShowToast('Vui lòng nhập SĐT học sinh để tạo mã chính xác!', 'warning'); return; }
        const key = generateActivationKey(targetId, sdt);
        setGeneratedKey(key);
        try {
            await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify({ action: 'add', sdt, name: name || 'Học sinh tự tạo', machineId: targetId, key }),
            });
            onShowToast('Đã tạo mã và đồng bộ lên hệ thống!', 'success');
        } catch {
            onShowToast('Đã tạo mã nhưng lỗi đồng bộ lên Sheets (Kiểm tra lại Script)', 'warning');
        }
        const filteredHistory = activationHistory.filter(h => h.id !== targetId);
        const newHistory = [{ id: targetId, name: name || 'Học sinh mới', key, date: Date.now() }, ...filteredHistory].slice(0, 50);
        setActivationHistory(newHistory);
        localStorage.setItem('pv_activation_history', JSON.stringify(newHistory));
        setStudentName('');
        setAdminTargetSdt('');
    };

    const handleActivate = () => {
        const sdt = studentSdt.trim();
        const key = studentKeyInput.trim();
        if (!sdt) { onShowToast('Vui lòng nhập Số điện thoại đã đăng ký!', 'warning'); return; }
        if (activateSystem(key, sdt)) {
            onShowToast('Kích hoạt hệ thống thành công!', 'success');
            setStudentKeyInput('');
        } else {
            onShowToast('Mã kích hoạt hoặc SĐT không khớp với máy này!', 'error');
        }
    };

    const handleDeleteHistory = (id: string) => {
        if (window.confirm('Bạn có chắc muốn xóa học sinh này khỏi danh sách?')) {
            const newHistory = activationHistory.filter(h => h.id !== id);
            setActivationHistory(newHistory);
            localStorage.setItem('pv_activation_history', JSON.stringify(newHistory));
            onShowToast('Đã xóa học sinh khỏi lịch sử', 'success');
        }
    };

    const handleExport = () => {
        if (!isAdmin) { onShowToast('Bạn không có quyền xuất dữ liệu!', 'error'); return; }
        try { exportData(lessons, storedFiles); onShowToast('Đã xuất dữ liệu thành công!', 'success'); }
        catch { onShowToast('Lỗi khi xuất dữ liệu', 'error'); }
    };

    const handleImportClick = () => {
        if (!isActivated && !isAdmin) { onShowToast('Vui lòng kích hoạt hệ thống trước khi nhập dữ liệu!', 'warning'); return; }
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!window.confirm('Cảnh báo: Nhập dữ liệu sẽ GHI ĐÈ lên dữ liệu hiện tại nếu trùng lặp. Bạn có chắc chắn muốn tiếp tục?')) {
            if (fileInputRef.current) fileInputRef.current.value = ''; return;
        }
        try {
            await importData(file);
            onShowToast('Đã nhập dữ liệu thành công! Vui lòng tải lại trang.', 'success');
            setTimeout(() => window.location.reload(), 1500);
        } catch {
            onShowToast('Lỗi khi nhập dữ liệu: File không hợp lệ', 'error');
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleVerifyPassword = () => {
        const _ref = [84, 104, 97, 121, 72, 117, 121, 50, 48, 50, 54].map(c => String.fromCharCode(c)).join('');
        if (password === _ref) {
            onToggleAdmin(true);
            onShowToast('Đã kích hoạt quyền quản trị viên!', 'success');
            setShowPassInput(false);
            setPassword('');
        } else {
            onShowToast('Sai mã xác thực hệ thống!', 'error');
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
            style={{ background: 'rgba(26,26,26,0.45)' }}
        >
            <div
                className="w-full overflow-hidden animate-scale-in"
                style={{
                    maxWidth: '580px',
                    background: '#FFFFFF',
                    border: '1px solid #E9E9E7',
                    borderRadius: '12px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div
                    className="flex items-center justify-between px-5 py-3.5"
                    style={{ borderBottom: '1px solid #E9E9E7' }}
                >
                    <h3 className="font-semibold text-base" style={{ color: '#1A1A1A' }}>
                        Cài đặt &amp; Bảo mật Hệ thống
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-md transition-colors"
                        style={{ color: '#787774' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F1F0EC'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Scrollable body */}
                <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar" style={{ maxHeight: '80vh' }}>

                    {/* ── Access / Admin section ── */}
                    <div
                        id="tour-admin-section"
                        className="rounded-xl overflow-hidden"
                        style={{ border: '1px solid #E9E9E7' }}
                    >
                        {/* Row */}
                        <div
                            className="flex items-center justify-between px-4 py-3"
                            style={{ borderBottom: showPassInput || !isAdmin ? '1px solid #E9E9E7' : undefined }}
                        >
                            <div className="flex items-center gap-3">
                                <div
                                    className="p-2 rounded-lg"
                                    style={{ background: isAdmin ? '#EAF3EE' : '#F1F0EC' }}
                                >
                                    {isAdmin
                                        ? <Unlock className="w-4 h-4" style={{ color: '#448361' }} />
                                        : <Lock className="w-4 h-4" style={{ color: '#787774' }} />}
                                </div>
                                <div>
                                    <div className="text-[10px] uppercase font-semibold tracking-wider" style={{ color: '#AEACA8' }}>
                                        Quyền truy cập
                                    </div>
                                    <div className="text-sm font-semibold" style={{ color: isAdmin ? '#448361' : '#1A1A1A' }}>
                                        {isAdmin ? 'Quản trị viên' : 'Chế độ Học sinh'}
                                    </div>
                                </div>
                            </div>

                            {/* Admin controls */}
                            {!isAdmin ? (
                                <button
                                    onClick={() => setShowPassInput(!showPassInput)}
                                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                                    style={{ background: '#F1F0EC', color: '#57564F', border: '1px solid #E9E9E7' }}
                                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#E9E9E7'}
                                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#F1F0EC'}
                                >
                                    <KeyRound className="w-3.5 h-3.5" />
                                    Mở khóa Admin
                                </button>
                            ) : (
                                <div className="flex gap-2">
                                    <button
                                        onClick={onOpenDashboard}
                                        className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg text-white transition-colors"
                                        style={{ background: '#6B7CDB' }}
                                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#5a6bc9'}
                                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#6B7CDB'}
                                    >
                                        <LayoutDashboard className="w-3.5 h-3.5" />
                                        Quản lý Học viên
                                    </button>
                                    <button
                                        onClick={() => onToggleAdmin(false)}
                                        className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                                        style={{ background: '#FEF0F0', color: '#E03E3E', border: '1px solid #FECACA' }}
                                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#FECACA'}
                                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#FEF0F0'}
                                    >
                                        Thoát Admin
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Password input or status text */}
                        <div className="px-4 py-3" style={{ background: '#FAFAF9' }}>
                            {!isAdmin && showPassInput ? (
                                <div className="space-y-2 animate-fade-in">
                                    <div className="relative">
                                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: '#AEACA8' }} />
                                        <input
                                            type="password"
                                            value={password}
                                            onChange={e => setPassword(e.target.value)}
                                            placeholder="Nhập mã xác thực hệ thống..."
                                            style={{ ...inputStyle, padding: '8px 12px 8px 36px' }}
                                            onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = '#6B7CDB'}
                                            onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = '#E9E9E7'}
                                            onKeyDown={e => e.key === 'Enter' && handleVerifyPassword()}
                                            autoFocus
                                        />
                                    </div>
                                    <button
                                        onClick={handleVerifyPassword}
                                        className="w-full py-2 text-sm font-medium text-white rounded-lg transition-colors"
                                        style={{ background: '#6B7CDB' }}
                                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#5a6bc9'}
                                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#6B7CDB'}
                                    >
                                        Xác thực quyền Admin
                                    </button>
                                </div>
                            ) : (
                                <p className="text-xs leading-relaxed" style={{ color: '#787774' }}>
                                    {isAdmin ? (
                                        'Bạn đang ở chế độ Quản trị: Có toàn quyền thêm, sửa, xóa nội dung và cấp mã kích hoạt cho học sinh.'
                                    ) : isActivated ? (
                                        <span className="flex items-center gap-1.5" style={{ color: '#448361', fontWeight: 500 }}>
                                            <ShieldCheck className="w-3.5 h-3.5" />
                                            Hệ thống đã được kích hoạt. Bạn có thể nạp bài giảng mới.
                                        </span>
                                    ) : (
                                        'Bạn đang ở chế độ Học sinh: Các tính năng nạp dữ liệu sẽ bị hạn chế cho đến khi bạn nhập mã kích hoạt.'
                                    )}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* ── Activation section (Student, not yet activated) ── */}
                    {!isAdmin && !isActivated && (
                        <div
                            id="tour-activation-section"
                            className="rounded-xl overflow-hidden"
                            style={{ border: '1px solid #E9E9E7' }}
                        >
                            {/* Section header */}
                            <div
                                className="flex items-center gap-3 px-4 py-3"
                                style={{ borderBottom: '1px solid #E9E9E7', borderLeft: '3px solid #D9730D' }}
                            >
                                <div className="p-2 rounded-lg" style={{ background: '#FFF3E8' }}>
                                    <KeyRound className="w-4 h-4" style={{ color: '#D9730D' }} />
                                </div>
                                <div>
                                    <h4 className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>Kích hoạt tài khoản</h4>
                                    <p className="text-xs mt-0.5" style={{ color: '#787774' }}>
                                        Dán mã kích hoạt nhận từ <span style={{ color: '#D9730D', fontWeight: 600 }}>Bot PhysiVault</span> để bắt đầu học.
                                    </p>
                                </div>
                            </div>

                            {/* Inputs */}
                            <div className="p-4 space-y-3" style={{ background: '#FAFAF9' }}>
                                {/* Phone */}
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: '#AEACA8' }} />
                                    <input
                                        type="tel"
                                        value={studentSdt}
                                        onChange={e => setStudentSdt(e.target.value)}
                                        placeholder="Nhập Số điện thoại của bạn"
                                        style={{ ...inputStyle, padding: '10px 12px 10px 36px' }}
                                        onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = '#D9730D'}
                                        onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = '#E9E9E7'}
                                    />
                                    {localStorage.getItem('pv_pending_sdt') && (
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                            <span
                                                className="text-[10px] px-2 py-0.5 rounded font-medium"
                                                style={{ background: '#FFF3E8', color: '#D9730D' }}
                                            >
                                                Tự động điền
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Key + Unlock button */}
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: '#AEACA8' }} />
                                        <input
                                            type="text"
                                            value={studentKeyInput}
                                            onChange={e => setStudentKeyInput(e.target.value.toUpperCase())}
                                            placeholder="Dán mã PV-... vào đây"
                                            className="font-mono"
                                            style={{ ...inputStyle, padding: '10px 12px 10px 36px' }}
                                            onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = '#D9730D'}
                                            onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = '#E9E9E7'}
                                        />
                                    </div>
                                    <button
                                        onClick={handleActivate}
                                        className="px-5 text-sm font-semibold text-white rounded-lg transition-colors"
                                        style={{ background: '#D9730D' }}
                                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#c4650b'}
                                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#D9730D'}
                                    >
                                        Mở khóa
                                    </button>
                                </div>

                                {/* Machine ID */}
                                <div className="flex items-center justify-between text-[10px]" style={{ color: '#AEACA8' }}>
                                    <div className="flex items-center gap-1.5 font-mono">
                                        <Monitor className="w-3 h-3" />
                                        ID: {myMachineId}
                                    </div>
                                    <span className="italic">* Nhập đúng SĐT để khớp với mã kích hoạt</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Admin key generator ── */}
                    {isAdmin && (
                        <div
                            className="rounded-xl overflow-hidden"
                            style={{ border: '1px solid #E9E9E7' }}
                        >
                            <div
                                className="flex items-center gap-3 px-4 py-3"
                                style={{ borderBottom: '1px solid #E9E9E7', borderLeft: '3px solid #6B7CDB' }}
                            >
                                <div className="p-2 rounded-lg" style={{ background: '#EEF0FB' }}>
                                    <UserCheck className="w-4 h-4" style={{ color: '#6B7CDB' }} />
                                </div>
                                <h4 className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>Trạm cấp mã học sinh</h4>
                            </div>

                            <div className="p-4 space-y-3" style={{ background: '#FAFAF9' }}>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {/* Student name */}
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#AEACA8' }}>
                                            Tên học sinh (Tùy chọn)
                                        </label>
                                        <input
                                            type="text"
                                            value={studentName}
                                            onChange={e => setStudentName(e.target.value)}
                                            placeholder="Ví dụ: Nguyễn Văn A..."
                                            style={{ ...inputStyle, padding: '8px 12px' }}
                                            onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = '#6B7CDB'}
                                            onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = '#E9E9E7'}
                                        />
                                    </div>
                                    {/* Student phone */}
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#AEACA8' }}>
                                            SĐT Học sinh (Bắt buộc)
                                        </label>
                                        <div className="relative">
                                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: '#AEACA8' }} />
                                            <input
                                                type="tel"
                                                value={adminTargetSdt}
                                                onChange={e => setAdminTargetSdt(e.target.value)}
                                                placeholder="Nhập SĐT đã đăng ký..."
                                                style={{ ...inputStyle, padding: '8px 12px 8px 34px' }}
                                                onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = '#6B7CDB'}
                                                onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = '#E9E9E7'}
                                            />
                                        </div>
                                    </div>
                                    {/* Machine ID */}
                                    <div className="space-y-1.5 md:col-span-2">
                                        <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#AEACA8' }}>
                                            Mã máy học sinh (ID)
                                        </label>
                                        <div className="relative">
                                            <Monitor className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: '#AEACA8' }} />
                                            <input
                                                type="text"
                                                value={adminTargetId}
                                                onChange={e => setAdminTargetId(e.target.value.toUpperCase())}
                                                placeholder="Dán mã máy học sinh..."
                                                className="font-mono"
                                                style={{ ...inputStyle, padding: '8px 12px 8px 34px' }}
                                                onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = '#6B7CDB'}
                                                onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = '#E9E9E7'}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={handleGenerateKey}
                                    className="w-full py-2.5 text-sm font-medium text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                                    style={{ background: '#6B7CDB' }}
                                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#5a6bc9'}
                                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#6B7CDB'}
                                >
                                    <ShieldCheck className="w-4 h-4" />
                                    Tạo &amp; Lưu Mã Mở Khóa
                                </button>

                                {/* Generated key result */}
                                {generatedKey && (
                                    <div
                                        className="rounded-lg p-3 space-y-2 animate-fade-in"
                                        style={{ background: '#EEF0FB', border: '1px solid #6B7CDB33' }}
                                    >
                                        <div className="text-[10px] font-semibold uppercase" style={{ color: '#6B7CDB' }}>
                                            Mã kích hoạt vừa tạo:
                                        </div>
                                        <div className="flex gap-2">
                                            <div
                                                className="flex-1 py-2 px-3 rounded-lg font-mono font-semibold text-center text-sm"
                                                style={{ background: '#FFFFFF', color: '#1A1A1A', border: '1px solid #E9E9E7' }}
                                            >
                                                {generatedKey}
                                            </div>
                                            <button
                                                onClick={() => { navigator.clipboard.writeText(generatedKey); onShowToast('Đã copy mã kích hoạt!', 'success'); }}
                                                className="px-4 text-sm font-medium text-white rounded-lg transition-colors"
                                                style={{ background: '#6B7CDB' }}
                                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#5a6bc9'}
                                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#6B7CDB'}
                                            >
                                                Copy
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* History */}
                                {activationHistory.length > 0 && (
                                    <div className="pt-3 space-y-2" style={{ borderTop: '1px solid #E9E9E7' }}>
                                        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase" style={{ color: '#AEACA8' }}>
                                            <History className="w-3 h-3" />
                                            Nhật ký cấp mã ({activationHistory.length})
                                        </div>
                                        <div className="space-y-1.5 max-h-56 overflow-y-auto custom-scrollbar pr-0.5">
                                            {activationHistory.map((h, i) => (
                                                <div
                                                    key={i}
                                                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg"
                                                    style={{ background: '#FFFFFF', border: '1px solid #E9E9E7' }}
                                                >
                                                    <div className="min-w-0">
                                                        <div className="text-[10px] font-semibold truncate" style={{ color: '#6B7CDB' }}>
                                                            {h.name || 'Học sinh cũ'}
                                                        </div>
                                                        <div className="text-[10px] font-mono truncate" style={{ color: '#AEACA8' }}>{h.id}</div>
                                                    </div>
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <span
                                                            className="text-xs font-mono font-semibold px-2 py-1 rounded select-all"
                                                            style={{ background: '#F1F0EC', color: '#1A1A1A' }}
                                                        >
                                                            {h.key}
                                                        </span>
                                                        <button
                                                            onClick={() => { navigator.clipboard.writeText(h.key); onShowToast('Đã copy mã!', 'success'); }}
                                                            className="px-2 py-1 text-[10px] font-semibold rounded transition-colors"
                                                            style={{ color: '#6B7CDB' }}
                                                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#EEF0FB'}
                                                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                                                        >
                                                            COPY
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteHistory(h.id)}
                                                            className="p-1.5 rounded transition-colors"
                                                            style={{ color: '#CFCFCB' }}
                                                            onMouseEnter={e => {
                                                                (e.currentTarget as HTMLElement).style.color = '#E03E3E';
                                                                (e.currentTarget as HTMLElement).style.background = '#FEF0F0';
                                                            }}
                                                            onMouseLeave={e => {
                                                                (e.currentTarget as HTMLElement).style.color = '#CFCFCB';
                                                                (e.currentTarget as HTMLElement).style.background = 'transparent';
                                                            }}
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── Data management (Admin) ── */}
                    {isAdmin && (
                        <div
                            className="rounded-xl overflow-hidden"
                            style={{ border: '1px solid #E9E9E7' }}
                        >
                            <div
                                className="flex items-center gap-3 px-4 py-3"
                                style={{ borderBottom: '1px solid #E9E9E7', borderLeft: '3px solid #448361' }}
                            >
                                <div className="p-2 rounded-lg" style={{ background: '#EAF3EE' }}>
                                    <Download className="w-4 h-4" style={{ color: '#448361' }} />
                                </div>
                                <h4 className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>Quản lý dữ liệu hệ thống</h4>
                            </div>
                            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3" style={{ background: '#FAFAF9' }}>
                                {/* Export */}
                                <div className="rounded-lg p-3 space-y-3" style={{ background: '#FFFFFF', border: '1px solid #E9E9E7' }}>
                                    <div>
                                        <div className="text-[10px] font-semibold uppercase" style={{ color: '#AEACA8' }}>Xuất dữ liệu</div>
                                        <p className="text-xs mt-1" style={{ color: '#787774' }}>Tải toàn bộ bài giảng xuống máy tính (.json)</p>
                                    </div>
                                    <button
                                        onClick={handleExport}
                                        className="w-full py-2 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                                        style={{ background: '#EAF3EE', color: '#448361', border: '1px solid #44836133' }}
                                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#D5E8DD'}
                                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#EAF3EE'}
                                    >
                                        <Download className="w-3.5 h-3.5" />
                                        Xuất File
                                    </button>
                                </div>
                                {/* Import */}
                                <div className="rounded-lg p-3 space-y-3" style={{ background: '#FFFFFF', border: '1px solid #E9E9E7' }}>
                                    <div>
                                        <div className="text-[10px] font-semibold uppercase" style={{ color: '#AEACA8' }}>Nhập dữ liệu</div>
                                        <p className="text-xs mt-1" style={{ color: '#787774' }}>Cập nhật nội dung mới từ file giáo viên gửi</p>
                                    </div>
                                    <button
                                        onClick={handleImportClick}
                                        className="w-full py-2 text-xs font-medium rounded-lg text-white transition-colors flex items-center justify-center gap-2"
                                        style={{ background: '#6B7CDB' }}
                                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#5a6bc9'}
                                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#6B7CDB'}
                                    >
                                        <Upload className="w-3.5 h-3.5" />
                                        Chọn &amp; Nhập File
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Import for students ── */}
                    {!isAdmin && (
                        <div id="tour-import-section" className="space-y-2">
                            <h4 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#1A1A1A' }}>
                                <Upload className="w-4 h-4" style={{ color: '#9065B0' }} />
                                Nhập học liệu mới
                            </h4>
                            {isActivated ? (
                                <button
                                    onClick={handleImportClick}
                                    className="w-full py-3 px-4 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                                    style={{ background: '#F3ECF8', color: '#9065B0', border: '1px solid #9065B033' }}
                                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#E8D9F3'}
                                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#F3ECF8'}
                                >
                                    <Upload className="w-4 h-4" />
                                    Chọn file bài giảng từ thầy (.json)
                                </button>
                            ) : (
                                <div
                                    className="p-5 rounded-lg flex flex-col items-center text-center gap-2"
                                    style={{ border: '2px dashed #E9E9E7', color: '#AEACA8' }}
                                >
                                    <Lock className="w-5 h-5" style={{ opacity: 0.4 }} />
                                    <p className="text-xs font-medium" style={{ color: '#787774' }}>Chức năng đang bị khóa</p>
                                    <p className="text-[10px]">Vui lòng kích hoạt mã ở phía trên để nạp bài giảng.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Note box ── */}
                    <div
                        className="flex gap-3 items-start px-4 py-3 rounded-lg"
                        style={{ background: '#F7F6F3', border: '1px solid #E9E9E7' }}
                    >
                        <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#AEACA8' }} />
                        <p className="text-xs leading-relaxed" style={{ color: '#787774' }}>
                            {isAdmin
                                ? 'Lưu ý cho Quản trị viên: Mỗi mã máy ứng với một mã kích hoạt duy nhất. Bạn có thể lưu tên học sinh để dễ quản lý nhật ký cấp mã.'
                                : 'Lưu ý cho Học sinh: Hệ thống cần được kích hoạt bằng mã duy nhất cho máy này để đảm bảo quyền truy cập học liệu chính thức.'}
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div
                    className="px-5 py-3 text-center"
                    style={{ borderTop: '1px solid #E9E9E7' }}
                >
                    <button
                        onClick={onClose}
                        className="text-sm transition-colors"
                        style={{ color: '#787774' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#1A1A1A'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#787774'}
                    >
                        Quay lại trang chủ
                    </button>
                </div>
            </div>

            <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleFileChange} />
        </div>
    );
};

export default SettingsModal;
