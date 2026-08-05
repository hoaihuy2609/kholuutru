/**
 * VideoPlayer.tsx — YouTube iframe player với progress tracking
 * Thiết kế để dễ thay bằng Vimeo hoặc thêm watermark sau.
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { LectureVideo, LectureProgress } from '../types';
import { saveProgress, buildEmbedUrl } from '../src/services/liveService';
import { CheckCircle2, Clock } from 'lucide-react';

interface VideoPlayerProps {
  video: LectureVideo;
  studentPhone: string | null;
  progress?: LectureProgress;
  onProgressUpdate?: (videoId: string, watchedSeconds: number, completed: boolean) => void;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

// Load YouTube IFrame API một lần duy nhất
let ytApiLoaded = false;
let ytApiCallbacks: Array<() => void> = [];

function loadYouTubeApi(callback: () => void) {
  if (window.YT && window.YT.Player) {
    callback();
    return;
  }
  ytApiCallbacks.push(callback);
  if (!ytApiLoaded) {
    ytApiLoaded = true;
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
    window.onYouTubeIframeAPIReady = () => {
      ytApiCallbacks.forEach(cb => cb());
      ytApiCallbacks = [];
    };
  }
}

const POLL_INTERVAL = 5000; // ms — poll tiến độ mỗi 5 giây

const VideoPlayer: React.FC<VideoPlayerProps> = ({ video, studentPhone, progress, onProgressUpdate }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSavedRef = useRef<number>(progress?.watched_seconds ?? 0);
  const iframeId = `yt-player-${video.id.replace(/-/g, '')}`;

  const [localWatched, setLocalWatched] = useState<number>(progress?.watched_seconds ?? 0);
  const [localCompleted, setLocalCompleted] = useState<boolean>(progress?.completed ?? false);

  const duration = video.duration_seconds || 1;
  const percent = Math.min(100, Math.round((localWatched / duration) * 100));

  const handlePoll = useCallback(async () => {
    if (!playerRef.current || !studentPhone) return;
    try {
      const state: number = playerRef.current.getPlayerState?.();
      if (state !== 1) return; // 1 = PLAYING

      const current: number = Math.floor(playerRef.current.getCurrentTime?.() ?? 0);
      if (current <= lastSavedRef.current) return;

      lastSavedRef.current = current;
      setLocalWatched(current);

      const completed = duration > 0 && current >= duration * 0.9;
      if (completed && !localCompleted) setLocalCompleted(true);

      onProgressUpdate?.(video.id, current, completed);
      await saveProgress(studentPhone, video.id, current, duration);
    } catch {
      // silent
    }
  }, [studentPhone, video.id, duration, localCompleted, onProgressUpdate]);

  useEffect(() => {
    setLocalWatched(progress?.watched_seconds ?? 0);
    setLocalCompleted(progress?.completed ?? false);
    lastSavedRef.current = progress?.watched_seconds ?? 0;
  }, [progress]);

  useEffect(() => {
    let player: any;

    loadYouTubeApi(() => {
      if (!document.getElementById(iframeId)) return;
      player = new window.YT.Player(iframeId, {
        events: {
          onReady: () => {
            playerRef.current = player;
            pollRef.current = setInterval(handlePoll, POLL_INTERVAL);
          },
          onStateChange: (e: any) => {
            if (e.data === 1) {
              // Bắt đầu play — nếu chưa có interval thì tạo
              if (!pollRef.current) {
                pollRef.current = setInterval(handlePoll, POLL_INTERVAL);
              }
            }
          },
        },
      });
    });

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
      try { player?.destroy?.(); } catch { /* ignore */ }
      playerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.id]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{ width: '100%' }}>
      {/* 16:9 Responsive container */}
      <div style={{ position: 'relative', paddingTop: '56.25%', background: '#000', borderRadius: '10px', overflow: 'hidden' }}>
        <iframe
          id={iframeId}
          src={buildEmbedUrl(video.youtube_url)}
          title={video.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{
            position: 'absolute', top: 0, left: 0,
            width: '100%', height: '100%',
            border: 'none',
          }}
        />
      </div>

      {/* Progress bar */}
      {studentPhone && (
        <div style={{ marginTop: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            {localCompleted ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#448361', fontWeight: 500 }}>
                <CheckCircle2 style={{ width: 14, height: 14 }} />
                Đã xem
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#787774' }}>
                <Clock style={{ width: 14, height: 14 }} />
                {percent}% đã xem
              </span>
            )}
            <span style={{ fontSize: '11px', color: '#AEACA8' }}>
              {formatTime(localWatched)} / {formatTime(duration)}
            </span>
          </div>
          <div style={{ height: '4px', background: '#E9E9E7', borderRadius: '99px', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${percent}%`,
                background: localCompleted ? '#448361' : '#6B7CDB',
                borderRadius: '99px',
                transition: 'width 0.5s ease',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
