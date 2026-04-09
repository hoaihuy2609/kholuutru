import React, { useState } from 'react';
import { ArrowLeft, Swords } from 'lucide-react';
import MathText from './MathText';

interface Props {
  onBack: () => void;
}

const DuelArena: React.FC<Props> = ({ onBack }) => {
  const [demoQuestion] = useState('Đấu Trường 1v1 đang được phát triển.\n\nDemo: Tính công năng $W = \\frac{1}{2}mv^2$ của một vật có $m = 2kg$, $v = 3m/s$.');
  
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
        <h2 className="text-2xl font-semibold" style={{ color: '#1A1A1A' }}>⚔️ Đấu Trường 1v1</h2>
      </div>
      <div className="p-6 rounded-2xl" style={{ background: '#FFFFFF', border: '1px solid #E03E3E33' }}>
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: '#E03E3E' }}>
          <Swords className="w-5 h-5" /> Trạng thái: Đang xây dựng
        </h3>
        <MathText content={demoQuestion} className="text-[#1A1A1A]" />
      </div>
    </div>
  );
};

export default DuelArena;
