import React from 'react';
import { GradeData, GradeLevel } from '../types';
import { CURRICULUM } from '../constants';
import { BookOpen, FileText, Activity, Zap, Atom } from 'lucide-react';

interface DashboardProps {
  onSelectGrade: (grade: GradeLevel) => void;
  fileCounts: Record<string, number>; // Total files per grade
}

const Dashboard: React.FC<DashboardProps> = ({ onSelectGrade, fileCounts }) => {
  
  const getIconForGrade = (grade: GradeLevel) => {
    switch (grade) {
      case GradeLevel.Grade12: return <Atom className="w-8 h-8 text-white" />; // Nuclear/Modern physics
      case GradeLevel.Grade11: return <Zap className="w-8 h-8 text-white" />; // Electricity/Oscillation
      case GradeLevel.Grade10: return <Activity className="w-8 h-8 text-white" />; // Mechanics
      default: return <BookOpen className="w-8 h-8 text-white" />;
    }
  };

  const getGradientForGrade = (grade: GradeLevel) => {
    switch (grade) {
      case GradeLevel.Grade12: return 'from-indigo-500 to-purple-600';
      case GradeLevel.Grade11: return 'from-blue-500 to-cyan-500';
      case GradeLevel.Grade10: return 'from-emerald-500 to-teal-600';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  const totalFiles = Object.values(fileCounts).reduce((a: number, b: number) => a + b, 0);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 relative overflow-hidden">
        <div className="relative z-10">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Chào mừng trở lại! 👋</h1>
          <p className="text-gray-500 max-w-2xl">
            Quản lý và lưu trữ tài liệu Vật Lý của bạn một cách dễ dàng. Chọn khối lớp để bắt đầu truy cập hoặc tải lên tài liệu mới.
          </p>
          <div className="mt-6 flex items-center gap-6">
            <div className="flex flex-col">
                <span className="text-3xl font-bold text-indigo-600">{totalFiles}</span>
                <span className="text-sm text-gray-400 font-medium uppercase tracking-wide">Tổng số tài liệu</span>
            </div>
            <div className="w-px h-10 bg-gray-200"></div>
            <div className="flex flex-col">
                <span className="text-3xl font-bold text-indigo-600">3</span>
                <span className="text-sm text-gray-400 font-medium uppercase tracking-wide">Khối lớp</span>
            </div>
             <div className="w-px h-10 bg-gray-200"></div>
            <div className="flex flex-col">
                <span className="text-3xl font-bold text-indigo-600">15</span>
                <span className="text-sm text-gray-400 font-medium uppercase tracking-wide">Chương học</span>
            </div>
          </div>
        </div>
        
        {/* Decorative background element */}
        <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-indigo-50 to-transparent opacity-50 pointer-events-none"></div>
        <Atom className="absolute -bottom-10 -right-10 w-64 h-64 text-indigo-50 transform rotate-12 pointer-events-none" />
      </div>

      <div>
        <h2 className="text-xl font-bold text-gray-800 mb-6">Chọn Khối Lớp</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {CURRICULUM.map((grade) => (
            <button
              key={grade.level}
              onClick={() => onSelectGrade(grade.level)}
              className="group relative flex flex-col h-64 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 bg-white border border-gray-100 hover:-translate-y-1"
            >
              <div className={`h-32 w-full bg-gradient-to-br ${getGradientForGrade(grade.level)} flex items-center justify-center relative`}>
                <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-10 transition-opacity"></div>
                {getIconForGrade(grade.level)}
                <span className="absolute bottom-4 right-4 text-white/90 text-sm font-medium bg-white/20 px-2 py-1 rounded backdrop-blur-sm">
                    {fileCounts[grade.level] || 0} tài liệu
                </span>
              </div>
              <div className="p-6 flex-1 flex flex-col items-start justify-between bg-white w-full text-left">
                <div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">{grade.title}</h3>
                  <p className="text-sm text-gray-500 line-clamp-2">
                    {grade.chapters.map(c => c.name.split(':')[1]).join(', ')}...
                  </p>
                </div>
                <div className="mt-4 text-indigo-600 font-semibold text-sm flex items-center gap-1 group-hover:gap-2 transition-all">
                    Xem chi tiết <span className="text-lg">→</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;