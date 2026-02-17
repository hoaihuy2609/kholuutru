import React from 'react';
import { Atom, FolderOpen, Home, Settings } from 'lucide-react';
import { GradeLevel } from '../types';

interface SidebarProps {
  currentGrade: GradeLevel | null;
  onSelectGrade: (grade: GradeLevel | null) => void;
  onOpenSettings?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentGrade, onSelectGrade, onOpenSettings }) => {
  return (
    <div className="w-64 h-full flex flex-col hidden md:flex fixed left-0 top-0 z-10 glass border-r border-white/20 shadow-xl backdrop-blur-xl bg-white/80">
      <div className="p-6 flex items-center gap-3 border-b border-gray-100/50">
        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white transform hover:scale-110 hover:rotate-12 transition-all duration-500">
          <Atom className="w-6 h-6 animate-pulse" />
        </div>
        <div>
          <h1 className="font-bold text-xl text-gray-800 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">PhysiVault</h1>
          <p className="text-xs text-slate-500 font-medium tracking-wide">Kho lưu trữ vật lý</p>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
        <button
          onClick={() => onSelectGrade(null)}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group ${currentGrade === null
            ? 'bg-gradient-to-r from-indigo-500/10 to-purple-500/10 text-indigo-700 font-semibold shadow-sm border border-indigo-100/50'
            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 hover:translate-x-1'
            }`}
        >
          <Home className={`w-5 h-5 transition-colors ${currentGrade === null ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
          Tổng quan
        </button>

        <div className="pt-6 pb-2">
          <p className="px-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Khối Lớp</p>
        </div>

        {[GradeLevel.Grade12, GradeLevel.Grade11, GradeLevel.Grade10].map((grade) => (
          <button
            key={grade}
            onClick={() => onSelectGrade(grade)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group ${currentGrade === grade
              ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30 transform scale-[1.02]'
              : 'text-slate-600 hover:bg-white hover:shadow-md hover:border-slate-100 border border-transparent'
              }`}
          >
            <FolderOpen className={`w-5 h-5 transition-colors ${currentGrade === grade ? 'text-white' : 'text-slate-400 group-hover:text-indigo-500'}`} />
            <span className="font-medium">Lớp {grade}</span>
            {currentGrade === grade && (
              <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            )}
          </button>
        ))}



      </nav>

      <div className="p-4 border-t border-gray-100/50 bg-gray-50/50">
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:bg-white hover:text-indigo-600 hover:shadow-md transition-all duration-300 border border-transparent hover:border-gray-100"
        >
          <Settings className="w-5 h-5 transition-transform group-hover:rotate-90" />
          <span className="font-medium">Cài đặt & Đồng bộ</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
