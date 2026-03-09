import React from 'react';
import { WifiOff } from 'lucide-react';

export default function OfflineExpiredScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 font-sans" style={{ background: '#F7F6F3' }}>
      {/* Subtle grid pattern */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg,#1A1A1A 0,#1A1A1A 1px,transparent 0,transparent 50%),repeating-linear-gradient(90deg,#1A1A1A 0,#1A1A1A 1px,transparent 0,transparent 50%)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative max-w-sm w-full animate-fade-in">
        {/* Brand top */}
        <div className="text-center mb-8">
          <span className="text-[11px] font-bold uppercase tracking-[0.25em]" style={{ color: '#CFCFCB' }}>
            PhysiVault
          </span>
        </div>

        {/* Main card */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: '#FFFFFF', border: '1px solid #E9E9E7', boxShadow: '0 8px 32px rgba(0,0,0,0.06)' }}
        >
          {/* Orange accent top bar */}
          <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg,#D9730D,#F59E0B)' }} />

          <div className="p-8 text-center space-y-6">
            {/* Icon */}
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto"
              style={{ background: '#FFF7ED', border: '1px solid #FED7AA' }}
            >
              <WifiOff className="w-9 h-9 text-[#D9730D]" />
            </div>

            {/* Text */}
            <div className="space-y-2.5">
              <div
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full"
                style={{ background: '#FFF7ED', color: '#D9730D', border: '1px solid #FED7AA' }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#D9730D] animate-pulse inline-block" />
                Yêu cầu kết nối mạng
              </div>
              <h1 className="text-xl font-semibold tracking-tight" style={{ color: '#1A1A1A' }}>
                Phiên xác minh đã hết hạn
              </h1>
              <p className="text-sm leading-relaxed" style={{ color: '#787774' }}>
                Hệ thống không thể xác minh quyền truy cập của bạn khi offline quá 24 giờ.
                Vui lòng kết nối mạng để tiếp tục.
              </p>
            </div>

            {/* Info box */}
            <div
              className="rounded-xl p-4 text-left space-y-2"
              style={{ background: '#F7F6F3', border: '1px solid #E9E9E7' }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#AEACA8' }}>Lưu ý</p>
              <p className="text-xs leading-relaxed" style={{ color: '#57564F' }}>
                Quyền truy cập vẫn còn hiệu lực. Chỉ cần kết nối WiFi hoặc 4G rồi tải lại trang là tiếp tục học được ngay.
              </p>
            </div>

            {/* Action */}
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              style={{ background: '#D9730D', color: '#FFFFFF' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#c4650b'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#D9730D'}
            >
              Tải lại trang
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-[10px] uppercase tracking-[0.2em] font-bold" style={{ color: '#CFCFCB' }}>
            PhysiVault · Security System
          </p>
        </div>
      </div>
    </div>
  );
}
