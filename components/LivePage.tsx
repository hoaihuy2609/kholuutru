/**
 * LivePage.tsx — Trang Live & Bài Giảng cho học viên
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Tv2, BookOpen, RefreshCw, ChevronDown, ChevronRight, Play, CheckCircle2, Clock, ChevronLeft } from 'lucide-react';
import {
  getLiveConfig, getChapters, getVideos, getProgress, buildEmbedUrl,
} from '../src/services/liveService';
import { LiveConfig, LectureChapter, LectureVideo, LectureProgress } from '../types';
import VideoPlayer from './VideoPlayer';

const LazyFallback = () => (
  <div className="flex items-center justify-center h-[40vh]">
    <RefreshCw className="w-6 h-6 animate-spin" style={{ color: '#6B7CDB' }} />
  </div>
);

interface LivePageProps {
  studentPhone: string | null;
  studentGrade: number | null;
  isAdmin?: boolean;
  onBack?: () => void;
}

const LivePage: React.FC<LivePageProps> = ({ studentPhone, studentGrade, isAdmin, onBack }) => {
  const [activeTab, setActiveTab] = useState<'live' | 'lectures'>('live');
  const [liveConfig, setLiveConfig] = useState<LiveConfig | null>(null);
  const [chapters, setChapters] = useState<LectureChapter[]>([]);
  const [videosByChapter, setVideosByChapter] = useState<Record<string, LectureVideo[]>>({});
  const [progress, setProgress] = useState<Record<string, LectureProgress>>({});
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [selectedVideo, setSelectedVideo] = useState<LectureVideo | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Load dữ liệu ──
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [cfg, chs] = await Promise.all([
        getLiveConfig(),
        getChapters(studentGrade ?? undefined),
      ]);
      setLiveConfig(cfg);
      setChapters(chs);

      // Load video cho tất cả chương
      const videosMap: Record<string, LectureVideo[]> = {};
      await Promise.all(
        chs.map(async (ch) => {
          const vids = await getVideos(ch.id);
          videosMap[ch.id] = vids;
        })
      );
      setVideosByChapter(videosMap);

      // Load tiến độ học sinh
      if (studentPhone) {
        const prog = await getProgress(studentPhone);
        const progMap: Record<string, LectureProgress> = {};
        prog.forEach(p => { progMap[p.video_id] = p; });
        setProgress(progMap);
      }
    } catch (err) {
      console.error('[LivePage] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [studentPhone, studentGrade]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const toggleChapter = (id: string) => {
    setExpandedChapters(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleProgressUpdate = useCallback((videoId: string, watchedSeconds: number, completed: boolean) => {
    setProgress(prev => ({
      ...prev,
      [videoId]: { video_id: videoId, watched_seconds: watchedSeconds, completed },
    }));
  }, []);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const getChapterProgress = (chapterId: string) => {
    const vids = videosByChapter[chapterId] || [];
    if (vids.length === 0) return null;
    const done = vids.filter(v => progress[v.id]?.completed).length;
    return { done, total: vids.length };
  };

  if (loading) return <LazyFallback />;

  // ── Tab styles ──
  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 16px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: active ? 500 : 400,
    color: active ? '#6B7CDB' : '#57564F',
    background: active ? '#EEF0FB' : 'transparent',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.15s',
  });

  return (
    <div className="animate-fade-in">
      {/* Back button */}
      {onBack && (
        <div style={{ marginBottom: '12px' }}>
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm font-medium hover:text-indigo-600 transition-colors"
            style={{ color: '#787774' }}
          >
            <ChevronLeft className="w-4 h-4" /> Quay lại
          </button>
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h1 className="text-2xl font-semibold mb-1" style={{ color: '#1A1A1A' }}>
          Live &amp; Bài Giảng
        </h1>
        <p className="text-sm" style={{ color: '#787774' }}>
          Xem buổi học trực tiếp và bài giảng được ghi lại
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: '#F1F0EC', padding: '4px', borderRadius: '10px', width: 'fit-content' }}>
        <button style={tabStyle(activeTab === 'live')} onClick={() => setActiveTab('live')}>
          <Tv2 style={{ width: 15, height: 15 }} />
          Đang Live
          {liveConfig?.is_live && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px', fontWeight: 700, color: '#E03E3E', marginLeft: '2px' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#E03E3E', animation: 'pulse 1.5s infinite' }} />
              LIVE
            </span>
          )}
        </button>
        <button style={tabStyle(activeTab === 'lectures')} onClick={() => setActiveTab('lectures')}>
          <BookOpen style={{ width: 15, height: 15 }} />
          Bài Giảng
        </button>
      </div>

      {/* ── Tab: Live ── */}
      {activeTab === 'live' && (
        <div>
          {liveConfig?.is_live && liveConfig.youtube_url ? (
            <div>
              {/* Badge live */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  background: '#FEF2F2', color: '#E03E3E',
                  padding: '4px 10px', borderRadius: '99px',
                  fontSize: '12px', fontWeight: 700,
                  border: '1px solid #FECACA',
                }}>
                  <span className="live-dot" />
                  ĐANG LIVE
                </span>
                {liveConfig.title && (
                  <span style={{ fontSize: '15px', fontWeight: 500, color: '#1A1A1A' }}>
                    {liveConfig.title}
                  </span>
                )}
              </div>

              {/* Video + Chat layout — max-width khớp YouTube.com (951px video + 410px chat) */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: liveConfig.chat_url ? '1fr 410px' : '1fr',
                gap: '20px',
                alignItems: 'stretch',
                maxWidth: '1380px',
                margin: '0 auto',
                width: '100%',
              }}>
                {/* Player — aspect-ratio 16:9 để không bị viền đen */}
                <div style={{ aspectRatio: '16/9', position: 'relative', background: '#000', borderRadius: '12px', overflow: 'hidden' }}>
                  <iframe
                    src={buildEmbedUrl(liveConfig.youtube_url, true)}
                    title={liveConfig.title || 'Live Stream'}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                  />
                </div>

                {/* Chat (YouTube Live Chat embed — bật khi có chat_url) */}
                {liveConfig.chat_url && (
                  <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #E9E9E7' }}>
                    <iframe
                      src={liveConfig.chat_url}
                      title="Live Chat"
                      style={{ width: '100%', height: '100%', border: 'none' }}
                    />
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Offline state */
            <div style={{
              textAlign: 'center', padding: '60px 24px',
              background: '#fff', borderRadius: '12px',
              border: '1px solid #E9E9E7',
            }}>
              <div style={{
                width: '56px', height: '56px', borderRadius: '16px',
                background: '#F1F0EC', display: 'flex', alignItems: 'center',
                justifyContent: 'center', margin: '0 auto 16px',
              }}>
                <Tv2 style={{ width: 28, height: 28, color: '#AEACA8' }} />
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1A1A1A', marginBottom: '8px' }}>
                Hiện chưa có buổi live
              </h3>
              <p style={{ fontSize: '14px', color: '#787774', marginBottom: '20px' }}>
                Lịch học sẽ được thông báo trong mục <strong>Mục Tiêu &amp; Lịch Trình</strong>.
              </p>
              <button
                onClick={() => setActiveTab('lectures')}
                style={{
                  padding: '8px 18px', borderRadius: '8px', fontSize: '13px',
                  fontWeight: 500, color: '#6B7CDB', background: '#EEF0FB',
                  border: '1px solid #B8C1EF', cursor: 'pointer',
                }}
              >
                Xem bài giảng đã ghi lại
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Bài Giảng ── */}
      {activeTab === 'lectures' && (
        <div style={{ display: 'grid', gridTemplateColumns: selectedVideo ? '320px 1fr' : '1fr', gap: '20px', alignItems: 'flex-start' }}>

          {/* Danh sách chương */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {chapters.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '48px 24px',
                background: '#fff', borderRadius: '12px', border: '1px solid #E9E9E7',
              }}>
                <BookOpen style={{ width: 32, height: 32, color: '#CFCFCB', margin: '0 auto 12px' }} />
                <p style={{ fontSize: '14px', color: '#787774' }}>Chưa có bài giảng nào</p>
              </div>
            ) : (
              chapters.map((chapter) => {
                const isExpanded = expandedChapters.has(chapter.id);
                const videos = videosByChapter[chapter.id] || [];
                const chapProgress = getChapterProgress(chapter.id);

                return (
                  <div
                    key={chapter.id}
                    style={{
                      background: '#fff',
                      borderRadius: '10px',
                      border: '1px solid #E9E9E7',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Chapter header */}
                    <button
                      onClick={() => toggleChapter(chapter.id)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center',
                        gap: '10px', padding: '12px 14px', background: 'none',
                        border: 'none', cursor: 'pointer', textAlign: 'left',
                      }}
                    >
                      {isExpanded
                        ? <ChevronDown style={{ width: 15, height: 15, color: '#AEACA8', flexShrink: 0 }} />
                        : <ChevronRight style={{ width: 15, height: 15, color: '#AEACA8', flexShrink: 0 }} />
                      }
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#1A1A1A', marginBottom: '2px' }}>
                          {chapter.title}
                        </div>
                        {chapProgress && (
                          <div style={{ fontSize: '11px', color: '#AEACA8' }}>
                            {chapProgress.done}/{chapProgress.total} bài đã xem
                          </div>
                        )}
                      </div>
                    </button>

                    {/* Videos list */}
                    {isExpanded && (
                      <div style={{ borderTop: '1px solid #F1F0EC' }}>
                        {videos.length === 0 ? (
                          <div style={{ padding: '12px 16px', fontSize: '13px', color: '#AEACA8' }}>
                            Chưa có bài nào trong chương này
                          </div>
                        ) : (
                          videos.map((video) => {
                            const prog = progress[video.id];
                            const isSelected = selectedVideo?.id === video.id;
                            const pct = prog && video.duration_seconds
                              ? Math.min(100, Math.round((prog.watched_seconds / video.duration_seconds) * 100))
                              : 0;

                            return (
                              <button
                                key={video.id}
                                onClick={() => setSelectedVideo(video)}
                                style={{
                                  width: '100%', display: 'flex', alignItems: 'flex-start',
                                  gap: '10px', padding: '10px 14px 10px 20px',
                                  background: isSelected ? '#EEF0FB' : 'none',
                                  border: 'none', borderTop: '1px solid #F7F6F3',
                                  cursor: 'pointer', textAlign: 'left',
                                  transition: 'background 0.15s',
                                }}
                                onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = '#FAFAFA'; }}
                                onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'none'; }}
                              >
                                {/* Icon trạng thái */}
                                <div style={{
                                  width: 28, height: 28, borderRadius: '8px', flexShrink: 0,
                                  background: prog?.completed ? '#EAF3EE' : isSelected ? '#EEF0FB' : '#F1F0EC',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1,
                                }}>
                                  {prog?.completed
                                    ? <CheckCircle2 style={{ width: 14, height: 14, color: '#448361' }} />
                                    : <Play style={{ width: 12, height: 12, color: isSelected ? '#6B7CDB' : '#AEACA8', marginLeft: 1 }} />
                                  }
                                </div>

                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: '13px', fontWeight: isSelected ? 500 : 400, color: isSelected ? '#6B7CDB' : '#1A1A1A', lineHeight: 1.4, marginBottom: '3px' }}>
                                    {video.title}
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {video.duration_seconds > 0 && (
                                      <span style={{ fontSize: '11px', color: '#AEACA8', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                        <Clock style={{ width: 10, height: 10 }} />
                                        {formatDuration(video.duration_seconds)}
                                      </span>
                                    )}
                                    {prog && !prog.completed && pct > 0 && (
                                      <span style={{ fontSize: '11px', color: '#6B7CDB' }}>
                                        {pct}%
                                      </span>
                                    )}
                                  </div>
                                  {/* Mini progress bar */}
                                  {prog && !prog.completed && pct > 0 && (
                                    <div style={{ height: 2, background: '#E9E9E7', borderRadius: '99px', marginTop: 5, overflow: 'hidden' }}>
                                      <div style={{ height: '100%', width: `${pct}%`, background: '#6B7CDB', borderRadius: '99px' }} />
                                    </div>
                                  )}
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Video player panel */}
          {selectedVideo && (
            <div style={{ position: 'sticky', top: '20px' }}>
              <div style={{
                background: '#fff', borderRadius: '12px',
                border: '1px solid #E9E9E7', overflow: 'hidden', padding: '16px',
              }}>
                <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#1A1A1A', marginBottom: '4px' }}>
                  {selectedVideo.title}
                </h2>
                {selectedVideo.description && (
                  <p style={{ fontSize: '13px', color: '#787774', marginBottom: '12px', lineHeight: 1.5 }}>
                    {selectedVideo.description}
                  </p>
                )}
                <VideoPlayer
                  video={selectedVideo}
                  studentPhone={studentPhone}
                  progress={progress[selectedVideo.id]}
                  onProgressUpdate={handleProgressUpdate}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pulse animation for live dot */}
      <style>{`
        .live-dot {
          display: inline-block;
          width: 7px; height: 7px;
          border-radius: 50%;
          background: #E03E3E;
          animation: live-pulse 1.4s ease-in-out infinite;
        }
        @keyframes live-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
      `}</style>
    </div>
  );
};

export default LivePage;
