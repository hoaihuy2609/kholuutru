/**
 * AdminLiveManager.tsx — Tab "Live & Bài Giảng" trong AdminDashboard
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Tv2, BookOpen, Plus, Edit3, Trash2, Save, X,
  ChevronDown, ChevronRight, RefreshCw, Radio, RadioTower,
} from 'lucide-react';
import {
  getLiveConfig, updateLiveConfig,
  getChapters, createChapter, updateChapter, deleteChapter,
  getVideos, createVideo, updateVideo, deleteVideo,
} from '../src/services/liveService';
import { LiveConfig, LectureChapter, LectureVideo } from '../types';

interface AdminLiveManagerProps {
  onShowToast: (msg: string, type: 'success' | 'error' | 'warning') => void;
}

/* ── Shared styles (theo design system AdminDashboard) ─── */
const inputSt: React.CSSProperties = {
  width: '100%', background: '#F7F6F3', border: '1px solid #E9E9E7',
  borderRadius: '8px', padding: '9px 12px', fontSize: '14px',
  color: '#1A1A1A', outline: 'none',
};

const btnPrimary: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '6px',
  padding: '8px 14px', borderRadius: '8px', fontSize: '13px',
  fontWeight: 500, background: '#6B7CDB', color: '#fff', border: 'none', cursor: 'pointer',
};

const btnSecondary: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '6px',
  padding: '8px 14px', borderRadius: '8px', fontSize: '13px',
  fontWeight: 500, background: '#F1F0EC', color: '#57564F',
  border: '1px solid #E9E9E7', cursor: 'pointer',
};

const btnDanger: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '6px',
  padding: '6px 10px', borderRadius: '7px', fontSize: '12px',
  fontWeight: 500, background: '#FEF2F2', color: '#E03E3E',
  border: '1px solid #FECACA', cursor: 'pointer',
};

const card: React.CSSProperties = {
  background: '#fff', borderRadius: '12px',
  border: '1px solid #E9E9E7', padding: '20px',
  marginBottom: '16px',
};

/* ────────────────────────────────────────────────────────── */

const AdminLiveManager: React.FC<AdminLiveManagerProps> = ({ onShowToast }) => {
  const [section, setSection] = useState<'live' | 'lectures'>('live');

  // ── Live Config state ──
  const [liveConfig, setLiveConfig] = useState<LiveConfig>({ is_live: false, youtube_url: '', chat_url: '', title: '' });
  const [liveForm, setLiveForm] = useState<LiveConfig>({ is_live: false, youtube_url: '', chat_url: '', title: '' });
  const [liveSaving, setLiveSaving] = useState(false);

  // ── Chapters state ──
  const [chapters, setChapters] = useState<LectureChapter[]>([]);
  const [videosByChapter, setVideosByChapter] = useState<Record<string, LectureVideo[]>>({});
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [loadingChapters, setLoadingChapters] = useState(false);

  // ── Chapter form ──
  const [chapterModal, setChapterModal] = useState<{ mode: 'add' | 'edit'; data?: LectureChapter } | null>(null);
  const [chapterForm, setChapterForm] = useState({ title: '', description: '', order: 0, grade: 0 });
  const [chapterSaving, setChapterSaving] = useState(false);

  // ── Video form ──
  const [videoModal, setVideoModal] = useState<{ mode: 'add' | 'edit'; chapterId: string; data?: LectureVideo } | null>(null);
  const [videoForm, setVideoForm] = useState({ title: '', description: '', youtube_url: '', duration_seconds: 0, order: 0 });
  const [videoSaving, setVideoSaving] = useState(false);

  /* Load live config */
  useEffect(() => {
    getLiveConfig().then(cfg => {
      setLiveConfig(cfg);
      setLiveForm(cfg);
    }).catch(() => onShowToast('Không tải được cấu hình live', 'error'));
  }, []);

  /* Load chapters */
  const loadChapters = useCallback(async () => {
    setLoadingChapters(true);
    try {
      const chs = await getChapters();
      setChapters(chs);
      const map: Record<string, LectureVideo[]> = {};
      await Promise.all(chs.map(async ch => {
        map[ch.id] = await getVideos(ch.id);
      }));
      setVideosByChapter(map);
    } catch { onShowToast('Không tải được danh sách chương', 'error'); }
    finally { setLoadingChapters(false); }
  }, [onShowToast]);

  useEffect(() => { if (section === 'lectures') loadChapters(); }, [section, loadChapters]);

  /* ── Live handlers ── */
  const handleSaveLive = async () => {
    setLiveSaving(true);
    try {
      await updateLiveConfig(liveForm);
      setLiveConfig(liveForm);
      onShowToast(liveForm.is_live ? '🔴 Đã bật Live!' : '⚫ Đã tắt Live', 'success');
    } catch (e: any) { onShowToast('Lỗi lưu cấu hình: ' + e.message, 'error'); }
    finally { setLiveSaving(false); }
  };

  /* ── Chapter handlers ── */
  const openAddChapter = () => {
    setChapterForm({ title: '', description: '', order: chapters.length, grade: 0 });
    setChapterModal({ mode: 'add' });
  };

  const openEditChapter = (ch: LectureChapter) => {
    setChapterForm({ title: ch.title, description: ch.description, order: ch.order, grade: ch.grade });
    setChapterModal({ mode: 'edit', data: ch });
  };

  const handleSaveChapter = async () => {
    if (!chapterForm.title.trim()) { onShowToast('Vui lòng nhập tên chương', 'warning'); return; }
    setChapterSaving(true);
    try {
      if (chapterModal?.mode === 'add') {
        await createChapter(chapterForm.title.trim(), chapterForm.description, chapterForm.order, chapterForm.grade);
        onShowToast('Đã thêm chương mới!', 'success');
      } else if (chapterModal?.data) {
        await updateChapter(chapterModal.data.id, chapterForm);
        onShowToast('Đã cập nhật chương!', 'success');
      }
      setChapterModal(null);
      loadChapters();
    } catch (e: any) { onShowToast('Lỗi: ' + e.message, 'error'); }
    finally { setChapterSaving(false); }
  };

  const handleDeleteChapter = async (ch: LectureChapter) => {
    if (!window.confirm(`Xóa chương "${ch.title}" và toàn bộ bài giảng bên trong?`)) return;
    try {
      await deleteChapter(ch.id);
      onShowToast('Đã xóa chương', 'success');
      loadChapters();
    } catch (e: any) { onShowToast('Lỗi xóa: ' + e.message, 'error'); }
  };

  /* ── Video handlers ── */
  const openAddVideo = (chapterId: string) => {
    const vids = videosByChapter[chapterId] || [];
    setVideoForm({ title: '', description: '', youtube_url: '', duration_seconds: 0, order: vids.length });
    setVideoModal({ mode: 'add', chapterId });
  };

  const openEditVideo = (chapterId: string, v: LectureVideo) => {
    setVideoForm({ title: v.title, description: v.description, youtube_url: v.youtube_url, duration_seconds: v.duration_seconds, order: v.order });
    setVideoModal({ mode: 'edit', chapterId, data: v });
  };

  const handleSaveVideo = async () => {
    if (!videoForm.title.trim()) { onShowToast('Vui lòng nhập tên bài giảng', 'warning'); return; }
    if (!videoForm.youtube_url.trim()) { onShowToast('Vui lòng nhập YouTube URL', 'warning'); return; }
    if (!videoModal) return;
    setVideoSaving(true);
    try {
      if (videoModal.mode === 'add') {
        await createVideo(videoModal.chapterId, videoForm.title.trim(), videoForm.description, videoForm.youtube_url.trim(), videoForm.duration_seconds, videoForm.order);
        onShowToast('Đã thêm bài giảng!', 'success');
      } else if (videoModal.data) {
        await updateVideo(videoModal.data.id, videoForm);
        onShowToast('Đã cập nhật bài giảng!', 'success');
      }
      setVideoModal(null);
      loadChapters();
    } catch (e: any) { onShowToast('Lỗi: ' + e.message, 'error'); }
    finally { setVideoSaving(false); }
  };

  const handleDeleteVideo = async (v: LectureVideo) => {
    if (!window.confirm(`Xóa bài giảng "${v.title}"?`)) return;
    try {
      await deleteVideo(v.id);
      onShowToast('Đã xóa bài giảng', 'success');
      loadChapters();
    } catch (e: any) { onShowToast('Lỗi xóa: ' + e.message, 'error'); }
  };

  /* ── Render ── */
  return (
    <div style={{ maxWidth: '800px' }}>

      {/* Section switcher */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: '#F1F0EC', padding: '4px', borderRadius: '10px', width: 'fit-content' }}>
        {([
          { key: 'live', icon: Radio, label: 'Quản lý Live' },
          { key: 'lectures', icon: BookOpen, label: 'Quản lý Bài Giảng' },
        ] as const).map(({ key, icon: Icon, label }) => (
          <button key={key} onClick={() => setSection(key as 'live' | 'lectures')} style={{
            padding: '7px 14px', borderRadius: '8px', fontSize: '13px', border: 'none', cursor: 'pointer',
            fontWeight: section === key ? 500 : 400,
            color: section === key ? '#6B7CDB' : '#57564F',
            background: section === key ? '#EEF0FB' : 'transparent',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            <Icon style={{ width: 14, height: 14 }} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Section: Live Config ── */}
      {section === 'live' && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <RadioTower style={{ width: 18, height: 18, color: liveConfig.is_live ? '#E03E3E' : '#AEACA8' }} />
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#1A1A1A', margin: 0 }}>Cấu hình Live Stream</h3>
          </div>

          {/* Toggle is_live */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: liveForm.is_live ? '#FEF2F2' : '#F7F6F3', borderRadius: '10px', marginBottom: '14px', border: `1px solid ${liveForm.is_live ? '#FECACA' : '#E9E9E7'}` }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 500, color: liveForm.is_live ? '#E03E3E' : '#1A1A1A' }}>
                {liveForm.is_live ? '🔴 Đang LIVE' : '⚫ Offline'}
              </div>
              <div style={{ fontSize: '12px', color: '#787774', marginTop: 2 }}>
                Bật để học viên thấy player live trên web
              </div>
            </div>
            <button
              onClick={() => setLiveForm(f => ({ ...f, is_live: !f.is_live }))}
              style={{
                width: 42, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                background: liveForm.is_live ? '#E03E3E' : '#D1D0CC',
                position: 'relative', transition: 'background 0.2s',
              }}
            >
              <span style={{
                position: 'absolute', top: 2,
                left: liveForm.is_live ? 20 : 2,
                width: 20, height: 20, borderRadius: '50%', background: '#fff',
                transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 500, color: '#57564F', display: 'block', marginBottom: '5px' }}>
                Tiêu đề buổi live
              </label>
              <input
                style={inputSt} placeholder="VD: Buổi 5 — Dao động cơ"
                value={liveForm.title}
                onChange={e => setLiveForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 500, color: '#57564F', display: 'block', marginBottom: '5px' }}>
                YouTube URL / iframe src <span style={{ color: '#E03E3E' }}>*</span>
              </label>
              <input
                style={inputSt}
                placeholder="https://www.youtube.com/embed/VIDEO_ID hoặc paste iframe src"
                value={liveForm.youtube_url}
                onChange={e => setLiveForm(f => ({ ...f, youtube_url: e.target.value }))}
              />
              <p style={{ fontSize: '11px', color: '#AEACA8', marginTop: '4px' }}>
                Dán URL embed hoặc toàn bộ thẻ &lt;iframe&gt; từ YouTube đều được
              </p>
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 500, color: '#57564F', display: 'block', marginBottom: '5px' }}>
                YouTube Live Chat URL <span style={{ color: '#AEACA8' }}>(tuỳ chọn — để trống nếu chưa cần)</span>
              </label>
              <input
                style={inputSt}
                placeholder="https://www.youtube.com/live_chat?v=VIDEO_ID&embed_domain=..."
                value={liveForm.chat_url}
                onChange={e => setLiveForm(f => ({ ...f, chat_url: e.target.value }))}
              />
            </div>
          </div>

          <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
            <button onClick={handleSaveLive} disabled={liveSaving} style={{ ...btnPrimary, opacity: liveSaving ? 0.7 : 1 }}>
              {liveSaving ? <RefreshCw style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> : <Save style={{ width: 14, height: 14 }} />}
              {liveSaving ? 'Đang lưu...' : 'Lưu cấu hình'}
            </button>
            <button onClick={() => setLiveForm(liveConfig)} style={btnSecondary}>
              <X style={{ width: 14, height: 14 }} /> Hoàn tác
            </button>
          </div>
        </div>
      )}

      {/* ── Section: Lectures ── */}
      {section === 'lectures' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#1A1A1A', margin: 0 }}>
              Danh sách Chương ({chapters.length})
            </h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={loadChapters} style={btnSecondary}>
                <RefreshCw style={{ width: 13, height: 13 }} />
              </button>
              <button onClick={openAddChapter} style={btnPrimary}>
                <Plus style={{ width: 14, height: 14 }} /> Thêm chương
              </button>
            </div>
          </div>

          {loadingChapters ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
              <RefreshCw style={{ width: 20, height: 20, color: '#6B7CDB', animation: 'spin 1s linear infinite' }} />
            </div>
          ) : chapters.length === 0 ? (
            <div style={{ ...card, textAlign: 'center', padding: '40px', color: '#787774' }}>
              Chưa có chương nào. Bấm "Thêm chương" để bắt đầu.
            </div>
          ) : (
            chapters.map(ch => {
              const isExpanded = expandedChapters.has(ch.id);
              const videos = videosByChapter[ch.id] || [];
              return (
                <div key={ch.id} style={{ ...card, padding: '0', overflow: 'hidden', marginBottom: '10px' }}>
                  {/* Chapter header */}
                  <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', gap: '8px' }}>
                    <button onClick={() => setExpandedChapters(prev => { const n = new Set(prev); n.has(ch.id) ? n.delete(ch.id) : n.add(ch.id); return n; })}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', flex: 1, gap: '8px', padding: 0 }}
                    >
                      {isExpanded ? <ChevronDown style={{ width: 15, height: 15, color: '#AEACA8' }} /> : <ChevronRight style={{ width: 15, height: 15, color: '#AEACA8' }} />}
                      <div style={{ textAlign: 'left', flex: 1 }}>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#1A1A1A' }}>{ch.title}</div>
                        <div style={{ fontSize: '12px', color: '#AEACA8' }}>
                          {videos.length} bài
                          {ch.grade > 0 ? ` · Lớp ${ch.grade}` : ' · Tất cả lớp'}
                          {ch.description ? ` · ${ch.description}` : ''}
                        </div>
                      </div>
                    </button>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => openEditChapter(ch)} style={{ ...btnSecondary, padding: '5px 10px', fontSize: '12px' }}>
                        <Edit3 style={{ width: 12, height: 12 }} /> Sửa
                      </button>
                      <button onClick={() => handleDeleteChapter(ch)} style={btnDanger}>
                        <Trash2 style={{ width: 12, height: 12 }} />
                      </button>
                    </div>
                  </div>

                  {/* Videos */}
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid #F1F0EC' }}>
                      {videos.map(v => (
                        <div key={v.id} style={{ display: 'flex', alignItems: 'center', padding: '10px 16px 10px 36px', borderTop: '1px solid #F7F6F3', gap: '10px' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '13px', fontWeight: 500, color: '#1A1A1A' }}>{v.title}</div>
                            <div style={{ fontSize: '12px', color: '#AEACA8', marginTop: 2 }}>
                              {v.duration_seconds > 0 ? `${Math.floor(v.duration_seconds / 60)} phút` : 'Chưa điền thời lượng'}
                              {v.description ? ` · ${v.description}` : ''}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => openEditVideo(ch.id, v)} style={{ ...btnSecondary, padding: '5px 10px', fontSize: '12px' }}>
                              <Edit3 style={{ width: 12, height: 12 }} /> Sửa
                            </button>
                            <button onClick={() => handleDeleteVideo(v)} style={btnDanger}>
                              <Trash2 style={{ width: 12, height: 12 }} />
                            </button>
                          </div>
                        </div>
                      ))}
                      <div style={{ padding: '10px 16px 10px 36px', borderTop: videos.length > 0 ? '1px solid #F7F6F3' : undefined }}>
                        <button onClick={() => openAddVideo(ch.id)} style={{ ...btnSecondary, fontSize: '12px', padding: '6px 12px' }}>
                          <Plus style={{ width: 13, height: 13 }} /> Thêm bài giảng
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── Modal: Chapter ── */}
      {chapterModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,26,26,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '14px', padding: '24px', width: '100%', maxWidth: '440px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1A1A1A', marginBottom: '16px' }}>
              {chapterModal.mode === 'add' ? 'Thêm chương mới' : 'Sửa chương'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 500, color: '#57564F', display: 'block', marginBottom: 4 }}>Tên chương *</label>
                <input style={inputSt} value={chapterForm.title} onChange={e => setChapterForm(f => ({ ...f, title: e.target.value }))} placeholder="VD: Chương 1 — Dao động cơ" />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 500, color: '#57564F', display: 'block', marginBottom: 4 }}>Mô tả</label>
                <input style={inputSt} value={chapterForm.description} onChange={e => setChapterForm(f => ({ ...f, description: e.target.value }))} placeholder="Mô tả ngắn (tuỳ chọn)" />
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '12px', fontWeight: 500, color: '#57564F', display: 'block', marginBottom: 4 }}>Thứ tự</label>
                  <input style={inputSt} type="number" min={0} value={chapterForm.order} onChange={e => setChapterForm(f => ({ ...f, order: Number(e.target.value) }))} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '12px', fontWeight: 500, color: '#57564F', display: 'block', marginBottom: 4 }}>Lớp</label>
                  <select style={{ ...inputSt }} value={chapterForm.grade} onChange={e => setChapterForm(f => ({ ...f, grade: Number(e.target.value) }))}>
                    <option value={0}>Tất cả lớp</option>
                    <option value={10}>Lớp 10</option>
                    <option value={11}>Lớp 11</option>
                    <option value={12}>Lớp 12</option>
                  </select>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button onClick={() => setChapterModal(null)} style={btnSecondary}>Huỷ</button>
              <button onClick={handleSaveChapter} disabled={chapterSaving} style={{ ...btnPrimary, opacity: chapterSaving ? 0.7 : 1 }}>
                {chapterSaving ? <RefreshCw style={{ width: 13, height: 13, animation: 'spin 1s linear infinite' }} /> : <Save style={{ width: 13, height: 13 }} />}
                {chapterModal.mode === 'add' ? 'Thêm' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Video ── */}
      {videoModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,26,26,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '14px', padding: '24px', width: '100%', maxWidth: '480px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1A1A1A', marginBottom: '16px' }}>
              {videoModal.mode === 'add' ? 'Thêm bài giảng' : 'Sửa bài giảng'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 500, color: '#57564F', display: 'block', marginBottom: 4 }}>Tên bài giảng *</label>
                <input style={inputSt} value={videoForm.title} onChange={e => setVideoForm(f => ({ ...f, title: e.target.value }))} placeholder="VD: Buổi 1 — Dao động điều hòa" />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 500, color: '#57564F', display: 'block', marginBottom: 4 }}>Mô tả</label>
                <input style={inputSt} value={videoForm.description} onChange={e => setVideoForm(f => ({ ...f, description: e.target.value }))} placeholder="Nội dung ngắn (tuỳ chọn)" />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 500, color: '#57564F', display: 'block', marginBottom: 4 }}>YouTube URL / iframe src *</label>
                <input style={inputSt} value={videoForm.youtube_url} onChange={e => setVideoForm(f => ({ ...f, youtube_url: e.target.value }))} placeholder="https://www.youtube.com/embed/VIDEO_ID hoặc paste link YouTube" />
                <p style={{ fontSize: '11px', color: '#AEACA8', marginTop: 3 }}>Paste URL embed hoặc link YouTube thường đều được</p>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '12px', fontWeight: 500, color: '#57564F', display: 'block', marginBottom: 4 }}>Thời lượng (giây)</label>
                  <input style={inputSt} type="number" min={0} value={videoForm.duration_seconds} onChange={e => setVideoForm(f => ({ ...f, duration_seconds: Number(e.target.value) }))} placeholder="VD: 3600 = 1 giờ" />
                  <p style={{ fontSize: '11px', color: '#AEACA8', marginTop: 3 }}>Dùng để tính % tiến độ. 1 phút = 60 giây.</p>
                </div>
                <div style={{ flex: 0.5 }}>
                  <label style={{ fontSize: '12px', fontWeight: 500, color: '#57564F', display: 'block', marginBottom: 4 }}>Thứ tự</label>
                  <input style={inputSt} type="number" min={0} value={videoForm.order} onChange={e => setVideoForm(f => ({ ...f, order: Number(e.target.value) }))} />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button onClick={() => setVideoModal(null)} style={btnSecondary}>Huỷ</button>
              <button onClick={handleSaveVideo} disabled={videoSaving} style={{ ...btnPrimary, opacity: videoSaving ? 0.7 : 1 }}>
                {videoSaving ? <RefreshCw style={{ width: 13, height: 13, animation: 'spin 1s linear infinite' }} /> : <Save style={{ width: 13, height: 13 }} />}
                {videoModal.mode === 'add' ? 'Thêm' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default AdminLiveManager;
