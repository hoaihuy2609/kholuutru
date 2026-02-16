import React, { useState } from 'react';
import { ArrowLeft, Plus, Folder, Trash2, ChevronRight, BookOpen } from 'lucide-react';
import { Chapter, Lesson } from '../types';

interface ChapterViewProps {
  chapter: Chapter;
  lessons: Lesson[];
  onBack: () => void;
  onCreateLesson: (name: string) => void;
  onSelectLesson: (lesson: Lesson) => void;
  onDeleteLesson: (lessonId: string) => void;
}

const ChapterView: React.FC<ChapterViewProps> = ({ 
  chapter, 
  lessons, 
  onBack, 
  onCreateLesson, 
  onSelectLesson, 
  onDeleteLesson 
}) => {
  const [newLessonName, setNewLessonName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newLessonName.trim()) {
      onCreateLesson(newLessonName.trim());
      setNewLessonName('');
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-white hover:shadow-md rounded-full transition-all text-gray-500"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{chapter.name}</h2>
          <p className="text-gray-500">{chapter.description}</p>
        </div>
      </div>

      {/* Create Lesson Section */}
      <div className="bg-indigo-50 rounded-2xl p-6 border border-indigo-100">
        <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-indigo-900 flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Quản lý bài học
            </h3>
            {!isCreating && (
                <button 
                    onClick={() => setIsCreating(true)}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm text-sm font-medium"
                >
                    <Plus className="w-4 h-4" />
                    Thêm bài mới
                </button>
            )}
        </div>

        {isCreating && (
            <form onSubmit={handleSubmit} className="flex gap-3 items-center animate-fade-in">
                <input
                    type="text"
                    value={newLessonName}
                    onChange={(e) => setNewLessonName(e.target.value)}
                    placeholder="Nhập tên bài học (VD: Bài 1: Động lượng)"
                    className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                    autoFocus
                />
                <button 
                    type="submit"
                    disabled={!newLessonName.trim()}
                    className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                    Lưu
                </button>
                <button 
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="bg-white text-gray-600 px-5 py-2.5 rounded-lg hover:bg-gray-50 border border-gray-200 font-medium"
                >
                    Hủy
                </button>
            </form>
        )}
      </div>

      {/* Lessons List */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-sm">{lessons.length}</span>
            Danh sách bài học
        </h3>
        
        {lessons.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-100 border-dashed">
             <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-50 mb-4">
                <Folder className="w-8 h-8 text-gray-300" />
             </div>
             <p className="text-gray-500 font-medium">Chưa có bài học nào được tạo.</p>
             <button 
                onClick={() => setIsCreating(true)}
                className="mt-4 text-indigo-600 font-medium hover:underline"
             >
                Tạo bài học đầu tiên
             </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {lessons.map((lesson) => (
              <div 
                key={lesson.id}
                onClick={() => onSelectLesson(lesson)}
                className="group bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Folder className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 group-hover:text-indigo-700 transition-colors">
                        {lesson.name}
                    </h4>
                    <p className="text-xs text-gray-400 mt-0.5">
                        Tạo ngày {new Date(lesson.createdAt).toLocaleDateString('vi-VN')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                    <button 
                        onClick={(e) => { e.stopPropagation(); onDeleteLesson(lesson.id); }}
                        className="p-2 text-gray-400 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        title="Xóa bài học"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                    <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-indigo-500" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChapterView;
