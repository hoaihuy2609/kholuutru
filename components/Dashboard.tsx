import React from 'react';
import { GradeLevel } from '../types';
import { CURRICULUM } from '../constants';
import { BookOpen, FileText, Activity, Zap, Atom, TrendingUp, Users, Folder } from 'lucide-react';
import CountdownTimer from './CountdownTimer';

interface DashboardProps {
  onSelectGrade: (grade: GradeLevel) => void;
  fileCounts: Record<string, number>;
  isAdmin: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({ onSelectGrade, fileCounts, isAdmin }) => {

  const getGradeInfo = (grade: GradeLevel) => {
    switch (grade) {
      case GradeLevel.Grade12: return {
        icon: Atom,
        gradient: 'from-violet-500 to-fuchsia-600',
        shadow: 'shadow-fuchsia-500/20',
        bg: 'bg-fuchsia-50'
      };
      case GradeLevel.Grade11: return {
        icon: Zap,
        gradient: 'from-blue-500 to-cyan-500',
        shadow: 'shadow-cyan-500/20',
        bg: 'bg-cyan-50'
      };
      case GradeLevel.Grade10: return {
        icon: Activity,
        gradient: 'from-emerald-500 to-teal-600',
        shadow: 'shadow-teal-500/20',
        bg: 'bg-teal-50'
      };
      default: return {
        icon: BookOpen,
        gradient: 'from-slate-500 to-slate-600',
        shadow: 'shadow-slate-500/20',
        bg: 'bg-slate-50'
      };
    }
  };

  const totalFiles = Object.values(fileCounts).reduce((a: number, b: number) => a + b, 0);

  return (
    <div className="space-y-10 animate-fade-in pb-10">
      {/* Hero Section */}
      <div className="relative rounded-3xl p-8 md:p-10 overflow-hidden shadow-2xl shadow-indigo-500/10 border border-white/40 isolate">
        {/* Background Mesh Gradient */}
        <div className="absolute inset-0 -z-10 bg-white/60 backdrop-blur-xl"></div>
        <div className="absolute top-0 right-0 -z-20 w-[600px] h-[600px] bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full blur-3xl opacity-60 translate-x-1/3 -translate-y-1/4"></div>
        <div className="absolute bottom-0 left-0 -z-20 w-[500px] h-[500px] bg-gradient-to-tr from-blue-100 to-cyan-100 rounded-full blur-3xl opacity-60 -translate-x-1/4 translate-y-1/4"></div>

        <div className="relative z-10 grid md:grid-cols-2 gap-8 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-bold uppercase tracking-wider mb-4 shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
              </span>
              Hệ thống quản lý thông minh
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-slate-800 mb-4 tracking-tight leading-tight">
              Chào mừng đến với <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">PhysiVault</span>
            </h1>
            <p className="text-slate-500 text-lg mb-4 max-w-lg leading-relaxed">
              Nền tảng lưu trữ và quản lý tài liệu Vật Lý toàn diện. Truy cập bài giảng, đề thi và tài liệu tham khảo mọi lúc, mọi nơi.
            </p>
            <div className="flex flex-col gap-3 mb-10">
              {/* Developer Badge */}
              <div className="flex items-center gap-3 px-5 py-2.5 bg-slate-900 border border-slate-800 rounded-2xl w-fit shadow-lg shadow-slate-200 hover:-translate-y-0.5 transition-all group">
                <div className="p-1 bg-indigo-500 rounded-lg text-white group-hover:bg-white group-hover:text-indigo-600 transition-colors">
                  <Activity className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Thiết kế & Phát triển</span>
                  <a
                    href="https://www.facebook.com/hoaihuy2609"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white font-bold text-sm hover:text-indigo-400 transition-colors"
                  >
                    Nguyễn Trần Hoài Huy
                  </a>
                </div>
              </div>

              {/* Source & Author Badge */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-2.5 bg-white/60 border border-slate-100 rounded-2xl w-fit backdrop-blur-sm shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600">
                    <Users className="w-4 h-4" />
                  </div>
                  <span className="text-slate-600 font-semibold tracking-tight text-sm">
                    Tài liệu: <a
                      href="https://www.facebook.com/groups/1657860147904528"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:text-indigo-700 hover:underline transition-all"
                    >
                      Group Vật Lý Physics
                    </a>
                  </span>
                </div>
                <div className="hidden sm:block w-1.5 h-1.5 rounded-full bg-slate-200"></div>
                <div className="text-slate-500 font-medium text-sm">
                  Tác giả: <a
                    href="https://www.facebook.com/groups/1657860147904528/user/100079937809863"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-800 font-bold hover:text-indigo-700 transition-all"
                  >
                    Thái Văn Thành
                  </a>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-3 px-5 py-3 bg-white/80 rounded-2xl shadow-sm border border-white/50 backdrop-blur-sm">
                <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-800">{totalFiles}</div>
                  <div className="text-xs text-slate-400 font-medium uppercase">Tài liệu</div>
                </div>
              </div>

              <div className="flex items-center gap-3 px-5 py-3 bg-white/80 rounded-2xl shadow-sm border border-white/50 backdrop-blur-sm">
                <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-800">3</div>
                  <div className="text-xs text-slate-400 font-medium uppercase">Khối lớp</div>
                </div>
              </div>

              <div className="flex items-center gap-3 px-5 py-3 bg-white/80 rounded-2xl shadow-sm border border-white/50 backdrop-blur-sm">
                <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                  <Folder className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-800">15+</div>
                  <div className="text-xs text-slate-400 font-medium uppercase">Chương học</div>
                </div>
              </div>
            </div>
          </div>

          <div className="hidden md:block relative">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-full blur-3xl transform"></div>
            <img
              src="https://illustrations.popsy.co/amber/student-going-to-school.svg"
              alt="Student"
              className="relative w-full h-auto drop-shadow-2xl animate-float"
            />
          </div>
        </div>
      </div>

      {/* Countdown Timer */}
      <CountdownTimer isAdmin={isAdmin} />

      {/* Grade Selection */}
      <div>
        <div className="flex items-center justify-between mb-8 px-2">
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <span className="w-1.5 h-8 bg-indigo-600 rounded-full block"></span>
            Khối Lớp
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {CURRICULUM.map((grade) => {
            const { icon: Icon, gradient, shadow, bg } = getGradeInfo(grade.level);

            return (
              <button
                key={grade.level}
                onClick={() => onSelectGrade(grade.level)}
                className="group relative flex flex-col rounded-3xl overflow-hidden transition-all duration-500 bg-white hover:-translate-y-2"
              >
                {/* Card Glow Effect */}
                <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl`}></div>

                {/* Card Content Wrapper */}
                <div className="relative m-[2px] bg-white rounded-[22px] flex flex-col h-full overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-500">
                  {/* Top Gradient Banner */}
                  <div className={`h-32 bg-gradient-to-br ${gradient} p-6 relative overflow-hidden`}>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/5 rounded-full blur-xl -ml-10 -mb-10 pointer-events-none"></div>

                    <div className="relative z-10 flex justify-between items-start">
                      <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl border border-white/30 text-white shadow-lg">
                        <Atom className="w-8 h-8 animate-pulse" />
                      </div>
                      <span className="px-3 py-1 bg-white/20 backdrop-blur-md border border-white/30 rounded-full text-white text-xs font-bold shadow-sm">
                        {fileCounts[grade.level] || 0} FILE
                      </span>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-6 flex-1 flex flex-col">
                    <h3 className="text-2xl font-bold text-slate-800 mb-2 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-indigo-600 group-hover:to-purple-600 transition-all">
                      {grade.title}
                    </h3>
                    <p className="text-sm text-slate-500 line-clamp-3 mb-6 flex-1 leading-relaxed">
                      Khám phá kho tàng kiến thức {grade.title.toLowerCase()}. Bao gồm các chuyên đề: {grade.chapters.slice(0, 3).map(c => c.name.split(':')[1]).join(', ')}...
                    </p>

                    <div className={`mt-auto flex items-center justify-center p-3 rounded-xl ${bg} group-hover:bg-indigo-50 transition-colors`}>
                      <span className={`text-sm font-bold bg-clip-text text-transparent bg-gradient-to-r ${gradient} group-hover:text-indigo-600 transition-all`}>
                        Truy cập ngay
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  );
};
export default Dashboard;