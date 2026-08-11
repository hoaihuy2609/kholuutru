/**
 * liveService.ts — Service cho tính năng Live & Bài Giảng
 * Thiết kế để dễ nâng cấp: thêm Vimeo, watermark, chat Supabase v.v.
 */

import { supabase } from '../lib/supabase';
import { LiveConfig, LectureChapter, LectureVideo, LectureProgress } from '../../types';

// ── Live Config ───────────────────────────────────────────────────

export async function getLiveConfig(): Promise<LiveConfig> {
  const { data, error } = await supabase
    .from('live_config')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  if (error) throw error;
  return data ?? { is_live: false, youtube_url: '', chat_url: '', title: '' };
}

export async function updateLiveConfig(config: Partial<Omit<LiveConfig, 'id' | 'updated_at'>>): Promise<void> {
  const { error } = await supabase.rpc('admin_update_live_config', {
    p_is_live:     config.is_live    ?? false,
    p_youtube_url: config.youtube_url ?? '',
    p_chat_url:    config.chat_url    ?? '',
    p_title:       config.title       ?? '',
  });
  if (error) throw error;
}

// ── Lecture Chapters ──────────────────────────────────────────────

export async function getChapters(grade?: number): Promise<LectureChapter[]> {
  let query = supabase
    .from('lecture_chapters')
    .select('*')
    .order('order', { ascending: true })
    .order('created_at', { ascending: true });

  // Nếu có grade cụ thể (10/11/12): hiện grade=0 (tất cả lớp) VÀ grade khớp
  // Nếu grade null/undefined: chỉ hiện grade=0 (tránh lộ chapters riêng)
  if (grade && grade > 0) {
    query = query.or(`grade.eq.0,grade.eq.${grade}`);
  } else {
    query = query.eq('grade', 0);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createChapter(
  title: string,
  description: string,
  order: number,
  grade: number
): Promise<LectureChapter> {
  const { data, error } = await supabase.rpc('admin_create_lecture_chapter', {
    p_title: title,
    p_description: description,
    p_pos: order,
    p_grade: grade,
  });
  if (error) throw error;
  return data;
}

export async function updateChapter(
  id: string,
  fields: Partial<Pick<LectureChapter, 'title' | 'description' | 'order' | 'grade'>>
): Promise<void> {
  const { error } = await supabase.rpc('admin_update_lecture_chapter', {
    p_id:          id,
    p_title:       fields.title       ?? '',
    p_description: fields.description ?? '',
    p_pos:         fields.order       ?? 0,
    p_grade:       fields.grade       ?? 0,
  });
  if (error) throw error;
}

export async function deleteChapter(id: string): Promise<void> {
  const { error } = await supabase.rpc('admin_delete_lecture_chapter', { p_id: id });
  if (error) throw error;
}

// ── Lecture Videos ────────────────────────────────────────────────

export async function getVideos(chapterId: string): Promise<LectureVideo[]> {
  const { data, error } = await supabase
    .from('lecture_videos')
    .select('*')
    .eq('chapter_id', chapterId)
    .order('order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createVideo(
  chapterId: string,
  title: string,
  description: string,
  youtubeUrl: string,
  durationSeconds: number,
  order: number
): Promise<LectureVideo> {
  const { data, error } = await supabase.rpc('admin_create_lecture_video', {
    p_chapter_id:       chapterId,
    p_title:            title,
    p_description:      description,
    p_youtube_url:      youtubeUrl,
    p_duration_seconds: durationSeconds,
    p_pos:              order,
  });
  if (error) throw error;
  return data;
}

export async function updateVideo(
  id: string,
  fields: Partial<Pick<LectureVideo, 'title' | 'description' | 'youtube_url' | 'duration_seconds' | 'order'>>
): Promise<void> {
  const { error } = await supabase.rpc('admin_update_lecture_video', {
    p_id:               id,
    p_title:            fields.title            ?? '',
    p_description:      fields.description      ?? '',
    p_youtube_url:      fields.youtube_url      ?? '',
    p_duration_seconds: fields.duration_seconds ?? 0,
    p_pos:              fields.order            ?? 0,
  });
  if (error) throw error;
}

export async function deleteVideo(id: string): Promise<void> {
  const { error } = await supabase.rpc('admin_delete_lecture_video', { p_id: id });
  if (error) throw error;
}

// ── Lecture Progress ──────────────────────────────────────────────

export async function getProgress(studentPhone: string): Promise<LectureProgress[]> {
  const { data, error } = await supabase
    .from('lecture_progress')
    .select('video_id, watched_seconds, completed, updated_at')
    .eq('student_phone', studentPhone);

  if (error) throw error;
  return data || [];
}

export async function saveProgress(
  studentPhone: string,
  videoId: string,
  watchedSeconds: number,
  durationSeconds: number
): Promise<void> {
  const completed = durationSeconds > 0 && watchedSeconds >= durationSeconds * 0.9;

  const { error } = await supabase.rpc('upsert_lecture_progress', {
    p_student_phone:  studentPhone,
    p_video_id:       videoId,
    p_watched_seconds: watchedSeconds,
    p_completed:      completed,
  });

  // Silent fail — progress tracking không nên block UX
  if (error) console.warn('[LiveService] saveProgress error:', error.message);
}

// ── Helper: extract YouTube video ID ─────────────────────────────

export function extractYoutubeId(urlOrIframe: string): string | null {
  // Xử lý iframe src
  const srcMatch = urlOrIframe.match(/src="([^"]+)"/);
  const url = srcMatch ? srcMatch[1] : urlOrIframe;

  const patterns = [
    /(?:youtube\.com\/embed\/)([^?&"]+)/,
    /(?:youtube\.com\/watch\?v=)([^&"]+)/,
    /(?:youtu\.be\/)([^?&"]+)/,
    /(?:youtube\.com\/live\/)([^?&"]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export function extractYoutubeChatUrl(videoId: string, domain: string): string {
  return `https://www.youtube.com/live_chat?v=${videoId}&embed_domain=${domain}`;
}

export function buildEmbedUrl(videoIdOrUrl: string, autoplay = false): string {
  const id = extractYoutubeId(videoIdOrUrl) ?? videoIdOrUrl;
  const params = new URLSearchParams({
    enablejsapi: '1',
    rel: '0',
    modestbranding: '1',
    ...(autoplay ? { autoplay: '1' } : {}),
  });
  return `https://www.youtube.com/embed/${id}?${params.toString()}`;
}
