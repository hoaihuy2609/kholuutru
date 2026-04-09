import React, { useState } from 'react';
import { ArrowLeft, Users } from 'lucide-react';
import MathText from './MathText';

interface Props {
  onBack: () => void;
}

const TeamBattle: React.FC<Props> = ({ onBack }) => {
  const [demoQuestion] = useState('Đội Chiến đang được phát triển.\n\nDemo: Trong dao động điều hòa, pha dao động được tính bằng công thức $\\phi = \\omega t + \\phi_0$.');
  
  return (
    <div className="animate-fade-in space-y-6 pb-10">
      <div className="flex items-center gap-3">
        <button 
          onClick={onBack} 
          className="p-2 rounded-lg transition-colors" 
          style={{ background: '#F1F0EC', border: '1px solid #E9E9E7', color: '#57564F' }}
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h2 className="text-2xl font-semibold" style={{ color: '#1A1A1A' }}>👥 Đội Chiến</h2>
      </div>
      <div className="p-6 rounded-2xl" style={{ background: '#FFFFFF', border: '1px solid #44836133' }}>
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: '#448361' }}>
          <Users className="w-5 h-5" /> Trạng thái: Đang xây dựng
        </h3>
        <MathText content={demoQuestion} className="text-[#1A1A1A]" />
      </div>
    </div>
  );
};

export default TeamBattle;
