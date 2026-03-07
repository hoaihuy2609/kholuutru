import React, { useState, useEffect, useRef } from 'react';
import { Video, X } from 'lucide-react';

export default function FloatingMeetButton() {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const links = [
        { grade: 10, url: 'https://meet.google.com/vch-rjum-kus' },
        { grade: 11, url: 'https://meet.google.com/kup-kyii-ess' },
        { grade: 12, url: 'https://meet.google.com/omz-jvty-osn' },
    ];

    return (
        <div className="fixed bottom-24 md:bottom-8 right-6 z-50 animate-fade-in" ref={menuRef}>
            {/* Menu Options */}
            <div
                className={`absolute bottom-[110%] mb-1 right-0 w-52 rounded-2xl shadow-xl overflow-hidden transition-all duration-300 origin-bottom-right ${isOpen ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}`}
                style={{ background: '#FFFFFF', border: '1px solid #E9E9E7' }}
            >
                <div className="px-4 py-3 border-b" style={{ background: '#F7F6F3', borderColor: '#E9E9E7' }}>
                    <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#57564F' }}>
                        Lớp học Trực tuyến
                    </p>
                </div>
                <div className="p-2 space-y-1">
                    {links.map((link) => (
                        <a
                            key={link.grade}
                            href={link.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors group"
                            style={{ background: 'transparent' }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#EEF0FB';
                                (e.currentTarget.querySelector('.icon-bg') as HTMLElement)!.style.background = '#6B7CDB';
                                (e.currentTarget.querySelector('.icon-bg') as HTMLElement)!.style.color = '#FFFFFF';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                                (e.currentTarget.querySelector('.icon-bg') as HTMLElement)!.style.background = '#EEF0FB';
                                (e.currentTarget.querySelector('.icon-bg') as HTMLElement)!.style.color = '#6B7CDB';
                            }}
                            onClick={() => setIsOpen(false)}
                        >
                            <div
                                className="icon-bg w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                                style={{ background: '#EEF0FB', color: '#6B7CDB' }}
                            >
                                <Video className="w-4 h-4" />
                            </div>
                            <span className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>
                                Khối {link.grade}
                            </span>
                        </a>
                    ))}
                </div>
            </div>

            {/* Main Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 relative group hover:scale-[1.05] active:scale-[0.95]"
                style={{ background: '#6B7CDB', color: '#FFFFFF', boxShadow: '0 8px 24px rgba(107, 124, 219, 0.4)' }}
            >
                {!isOpen && (
                    <span className="absolute inset-0 rounded-full animate-ping opacity-[0.15] group-hover:opacity-30" style={{ background: '#6B7CDB' }} />
                )}
                <div className="relative z-10 transition-transform duration-300" style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                    {isOpen ? <X className="w-6 h-6" /> : <Video className="w-6 h-6" />}
                </div>
            </button>
        </div>
    );
}
