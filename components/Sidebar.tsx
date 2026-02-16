import React from 'react';
import { BookOpen, FolderOpen, Home, Settings, Sparkles, Scissors } from 'lucide-react';
import { GradeLevel } from '../types';

interface SidebarProps {
  currentGrade: GradeLevel | null;
  currentPage: string;
  onSelectGrade: (grade: GradeLevel | null) => void;
  onSelectPage: (page: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentGrade, currentPage, onSelectGrade, onSelectPage }) => {
  const handlePageSelect = (page: string) => {
    onSelectPage(page);
    onSelectGrade(null); // Reset grade when switching pages
  };

  return (
    <div className="w-64 bg-white h-screen border-r border-gray-200 flex flex-col hidden md:flex fixed left-0 top-0 z-10">
      <div className="p-6 flex items-center gap-3 border-b border-gray-100">
        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
          <BookOpen className="text-white w-6 h-6" />
        </div>
        <div>
          <h1 className="font-bold text-xl text-gray-800 tracking-tight">PhysiVault</h1>
          <p className="text-xs text-gray-500 font-medium">Kho lưu trữ tài liệu</p>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        <button
          onClick={() => handlePageSelect('dashboard')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${currentPage === 'dashboard'
              ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-sm'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
        >
          <Home className="w-5 h-5" />
          Tổng quan
        </button>

        <div className="pt-4 pb-2">
          <p className="px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Khối Lớp</p>
        </div>

        <button
          onClick={() => {
            onSelectPage('dashboard');
            onSelectGrade(GradeLevel.Grade12);
          }}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${currentGrade === GradeLevel.Grade12 && currentPage === 'dashboard'
              ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-sm'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
        >
          <FolderOpen className="w-5 h-5" />
          Lớp 12
        </button>

        <button
          onClick={() => {
            onSelectPage('dashboard');
            onSelectGrade(GradeLevel.Grade11);
          }}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${currentGrade === GradeLevel.Grade11 && currentPage === 'dashboard'
              ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-sm'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
        >
          <FolderOpen className="w-5 h-5" />
          Lớp 11
        </button>

        <button
          onClick={() => {
            onSelectPage('dashboard');
            onSelectGrade(GradeLevel.Grade10);
          }}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${currentGrade === GradeLevel.Grade10 && currentPage === 'dashboard'
              ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-sm'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
        >
          <FolderOpen className="w-5 h-5" />
          Lớp 10
        </button>

        <div className="pt-4 pb-2">
          <p className="px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Công cụ AI</p>
        </div>

        <button
          onClick={() => handlePageSelect('ai-solver')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${currentPage === 'ai-solver'
              ? 'bg-purple-50 text-purple-700 font-semibold shadow-sm'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
        >
          <Sparkles className="w-5 h-5" />
          AI Solver
        </button>

        <button
          onClick={() => handlePageSelect('smart-crop')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${currentPage === 'smart-crop'
              ? 'bg-green-50 text-green-700 font-semibold shadow-sm'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
        >
          <Scissors className="w-5 h-5" />
          SmartCrop AI
        </button>
      </nav>

      <div className="p-4 border-t border-gray-100">
        <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors">
          <Settings className="w-5 h-5" />
          Cài đặt
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
