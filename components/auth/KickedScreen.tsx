import React from 'react';
import { ShieldOff, Ban } from 'lucide-react';

export default function KickedScreen() {
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
          {/* Red accent top bar */}
          <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg,#E03E3E,#F87171)' }} />

          <div className="p-8 text-center space-y-6">
            {/* Icon with ring glow */}
            <div className="mx-auto relative w-fit">
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto"
                style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}
              >
                <ShieldOff className="w-9 h-9 text-[#E03E3E]" />
              </div>
              {/* Pulse ring */}
              <div
                className="absolute inset-0 rounded-2xl animate-ping opacity-10"
                style={{ background: '#E03E3E' }}
              />
            </div>

            {/* Text */}
            <div className="space-y-2.5">
              <div
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full"
                style={{ background: '#FEF2F2', color: '#E03E3E', border: '1px solid #FECACA' }}
              >
                <Ban className="w-3 h-3" />
                Quyền truy cập bị thu hồi
              </div>
              <h1 className="text-xl font-semibold tracking-tight" style={{ color: '#1A1A1A' }}>
                Thiết bị này đã bị khóa
              </h1>
              <p className="text-sm leading-relaxed" style={{ color: '#787774' }}>
                Quản trị viên đã thu hồi quyền truy cập của thiết bị bạn.
                Bạn không thể xem tài liệu trên thiết bị này nữa.
              </p>
            </div>

            {/* Info rows */}
            <div
              className="rounded-xl overflow-hidden text-left"
              style={{ border: '1px solid #E9E9E7' }}
            >
              <div
                className="flex items-center justify-between px-4 py-3 text-xs"
                style={{ background: '#F7F6F3', borderBottom: '1px solid #E9E9E7' }}
              >
                <span style={{ color: '#AEACA8', fontWeight: 600 }}>TRẠNG THÁI</span>
                <span
                  className="flex items-center gap-1.5 font-bold uppercase tracking-wide"
                  style={{ color: '#E03E3E' }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#E03E3E] animate-pulse inline-block" />
                  Đã bị khóa
                </span>
              </div>
              <div
                className="px-4 py-3.5 space-y-1"
                style={{ background: '#FFFFFF' }}
              >
                <p className="text-xs font-medium" style={{ color: '#57564F' }}>
                  Nếu bạn cho rằng đây là nhầm lẫn, hãy liên hệ:
                </p>
                <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>
                  Thầy Huy — Quản trị viên PhysiVault
                </p>
              </div>
            </div>

            {/* Contact CTA */}
            <a
              href="https://zalo.me"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              style={{ background: '#1A1A1A', color: '#FFFFFF' }}
            >
              Liên hệ hỗ trợ
            </a>
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
