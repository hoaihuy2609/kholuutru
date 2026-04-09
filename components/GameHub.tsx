import React from 'react';
import { Zap, Swords, Trophy, Users, Lock, ChevronRight, Gamepad2, Star } from 'lucide-react';

interface GameHubProps {
  onPlayBlitz: () => void;
  onPlayDuel: () => void;
  onPlayKing: () => void;
  onPlayTeam: () => void;
  isAdmin?: boolean;
}

interface GameCard {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ElementType;
  accentColor: string;
  accentBg: string;
  tag: string;
  tagColor: string;
  tagBg: string;
  available: boolean;
  onPlay?: () => void;
  stats?: { label: string; value: string }[];
}

const GameHub: React.FC<GameHubProps> = ({ onPlayBlitz, onPlayDuel, onPlayKing, onPlayTeam, isAdmin }) => {
  const games: GameCard[] = [
    {
      id: 'blitz',
      title: 'Physics Blitz',
      subtitle: 'Thử thách 60 giây',
      description: 'Trả lời càng nhiều câu lý thuyết trong 60 giây càng tốt. Điểm x2 khi liên tiếp đúng!',
      icon: Zap,
      accentColor: '#F59E0B',
      accentBg: '#FFFBEB',
      tag: 'CHƠI NGAY',
      tagColor: '#fff',
      tagBg: '#F59E0B',
      available: true,
      onPlay: onPlayBlitz,
      stats: [
        { label: 'Thời gian', value: '60s' },
        { label: 'Câu hỏi', value: 'Ngẫu nhiên' },
        { label: 'Streak bonus', value: 'x2' },
      ],
    },
    {
      id: 'duel',
      title: 'Đấu Trường 1v1',
      subtitle: 'Thách đấu bạn bè',
      description: 'Thách đấu 1v1, ai giải đúng và nhanh hơn trong cùng bộ câu hỏi sẽ thắng. Async, không cần online cùng lúc.',
      icon: Swords,
      accentColor: '#E03E3E',
      accentBg: '#FEF2F2',
      tag: 'CHƠI NGAY',
      tagColor: '#fff',
      tagBg: '#E03E3E',
      available: true,
      onPlay: onPlayDuel,
      stats: [
        { label: 'Người chơi', value: '1v1' },
        { label: 'Câu hỏi', value: '10-20' },
        { label: 'Chế độ', value: 'Async' },
      ],
    },
    {
      id: 'king',
      title: 'Vua Lý Thuyết',
      subtitle: 'Tranh ngôi vương',
      description: 'Ai trả lời đúng câu khó nhất và nhiều nhất trong tuần sẽ đứng đầu bảng xếp hạng lớp.',
      icon: Trophy,
      accentColor: '#9065B0',
      accentBg: '#F3ECF8',
      tag: 'CHƠI NGAY',
      tagColor: '#fff',
      tagBg: '#9065B0',
      available: true,
      onPlay: onPlayKing,
      stats: [
        { label: 'Chu kỳ', value: 'Mỗi tuần' },
        { label: 'Xếp hạng', value: 'Top 10' },
        { label: 'Phần thưởng', value: '👑' },
      ],
    },
    {
      id: 'team',
      title: 'Đội Chiến',
      subtitle: 'Hợp tác nhóm',
      description: 'Chia thành 2 đội, mỗi người chọn một câu để đội mình trả lời. Đội nào trả lời đúng nhiều hơn thắng!',
      icon: Users,
      accentColor: '#448361',
      accentBg: '#EAF3EE',
      tag: 'CHƠI NGAY',
      tagColor: '#fff',
      tagBg: '#448361',
      available: true,
      onPlay: onPlayTeam,
      stats: [
        { label: 'Người chơi', value: '2-10' },
        { label: 'Đội', value: '2 nhóm' },
        { label: 'Thời gian', value: 'Tùy chọn' },
      ],
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #F59E0B, #EF4444)' }}
          >
            <Gamepad2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: '#1A1A1A' }}>
              Arena — Đấu Trường Vật Lý
            </h1>
            <p className="text-sm" style={{ color: '#787774' }}>
              Kiểm tra kiến thức qua các game tương tác thú vị
            </p>
          </div>
        </div>

        {/* Fun stats bar */}
        <div
          className="flex items-center gap-6 mt-4 p-3 rounded-xl"
          style={{ background: '#FFFFFF', border: '1px solid #E9E9E7' }}
        >
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4" style={{ color: '#F59E0B' }} />
            <span className="text-xs font-medium" style={{ color: '#57564F' }}>
              Câu hỏi lý thuyết ngắn · Không cần nhớ công thức · Chơi mọi lúc
            </span>
          </div>
        </div>
      </div>

      {/* Game Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {games.map(game => {
          const Icon = game.icon;
          return (
            <div
              key={game.id}
              className="rounded-2xl overflow-hidden transition-all duration-200"
              style={{
                background: '#FFFFFF',
                border: `1px solid ${game.available ? game.accentColor + '33' : '#E9E9E7'}`,
                boxShadow: game.available ? `0 4px 24px ${game.accentColor}18` : 'none',
                opacity: game.available ? 1 : 0.75,
              }}
            >
              {/* Card top accent bar */}
              <div
                className="h-1.5 w-full"
                style={{
                  background: game.available
                    ? `linear-gradient(90deg, ${game.accentColor}, ${game.accentColor}88)`
                    : '#E9E9E7',
                }}
              />

              <div className="p-5">
                {/* Header row */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center"
                      style={{ background: game.accentBg }}
                    >
                      <Icon className="w-5 h-5" style={{ color: game.accentColor }} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-base" style={{ color: '#1A1A1A' }}>
                        {game.title}
                      </h3>
                      <p className="text-xs" style={{ color: '#AEACA8' }}>
                        {game.subtitle}
                      </p>
                    </div>
                  </div>
                  <span
                    className="text-[10px] font-bold px-2 py-1 rounded-full shrink-0"
                    style={{ background: game.tagBg, color: game.tagColor }}
                  >
                    {game.tag}
                  </span>
                </div>

                {/* Description */}
                <p className="text-sm leading-relaxed mb-4" style={{ color: '#57564F' }}>
                  {game.description}
                </p>

                {/* Stats */}
                {game.stats && (
                  <div className="flex items-center gap-3 mb-4">
                    {game.stats.map(s => (
                      <div
                        key={s.label}
                        className="flex-1 text-center p-2 rounded-lg"
                        style={{ background: game.accentBg }}
                      >
                        <div className="text-xs font-bold" style={{ color: game.accentColor }}>
                          {s.value}
                        </div>
                        <div className="text-[10px]" style={{ color: '#AEACA8' }}>
                          {s.label}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* CTA Button */}
                {game.available ? (
                  <button
                    onClick={game.onPlay}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-all active:scale-95"
                    style={{
                      background: `linear-gradient(135deg, ${game.accentColor}, ${game.accentColor}CC)`,
                      boxShadow: `0 4px 16px ${game.accentColor}44`,
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.9'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
                  >
                    <Icon className="w-4 h-4" />
                    Bắt đầu chơi
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    disabled
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium cursor-not-allowed"
                    style={{ background: '#F1F0EC', color: '#AEACA8' }}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    Sắp ra mắt
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Admin hint */}
      {isAdmin && (
        <div
          className="p-4 rounded-xl flex items-center gap-3"
          style={{ background: '#EEF0FB', border: '1px solid #6B7CDB22' }}
        >
          <Gamepad2 className="w-4 h-4 shrink-0" style={{ color: '#6B7CDB' }} />
          <p className="text-sm" style={{ color: '#6B7CDB' }}>
            <strong>Admin:</strong> Vào <strong>PhysiVault Panel → Tab "Game"</strong> để soạn câu hỏi cho Physics Blitz.
          </p>
        </div>
      )}
    </div>
  );
};

export default GameHub;
