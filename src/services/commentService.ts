// src/services/commentService.ts
// ────────────────────────────────────────────────────────────────
// Tất cả giao tiếp với Cloudflare Worker cho tính năng Comment đề thi.
// Stack: Text → Cloudflare D1 | Ảnh → Cloudflare R2
// ────────────────────────────────────────────────────────────────

import { ExamComment } from '../../types';
import { getMachineId } from '../hooks/useCloudStorage';

const WORKER_URL = import.meta.env.VITE_CLOUDFLARE_PROXY_URL || '';

// ── Nickname (lưu local, không cần server) ──────────────────────
const NICKNAME_KEY = 'pv_user_nickname';

export function getNickname(): string {
    return localStorage.getItem(NICKNAME_KEY) || '';
}

export function saveNickname(nickname: string): void {
    localStorage.setItem(NICKNAME_KEY, nickname.trim());
}

// ── Upload ảnh lên Cloudflare R2 ───────────────────────────────
export async function uploadCommentImage(file: File): Promise<string> {
    if (!WORKER_URL) throw new Error('CLOUDFLARE_PROXY_URL chưa được cấu hình');
    if (file.size > 5 * 1024 * 1024) throw new Error('Ảnh tối đa 5MB');

    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `comments/${Date.now()}-${getMachineId().slice(0, 8)}.${ext}`;

    const res = await fetch(`${WORKER_URL}/upload-image`, {
        method: 'POST',
        headers: {
            'Content-Type': file.type,
            'x-file-name': encodeURIComponent(fileName),
        },
        body: file,
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || 'Upload ảnh thất bại');
    }

    const { url } = await res.json();
    return url; // Public URL của ảnh trên R2
}

// ── Lấy danh sách comment theo đề thi ──────────────────────────
export async function fetchComments(examId: string): Promise<ExamComment[]> {
    if (!WORKER_URL) return [];

    const res = await fetch(`${WORKER_URL}/comments?exam_id=${encodeURIComponent(examId)}`, {
        headers: { Referer: window.location.origin + '/' },
    });

    if (!res.ok) return [];
    const data = await res.json();
    return (data as ExamComment[]).filter(c => !c.is_deleted);
}

// ── Đăng comment mới ───────────────────────────────────────────
export async function postComment(
    examId: string,
    text: string,
    imageUrl?: string
): Promise<ExamComment> {
    if (!WORKER_URL) throw new Error('CLOUDFLARE_PROXY_URL chưa được cấu hình');

    const nickname = getNickname();
    if (!nickname) throw new Error('Vui lòng đặt tên hiển thị trước khi bình luận');

    const machineId = getMachineId();
    const comment: Omit<ExamComment, 'id'> = {
        exam_id: examId,
        author_id: machineId,
        author_name: nickname,
        text: text.trim(),
        image_url: imageUrl,
        created_at: Date.now(),
    };

    const res = await fetch(`${WORKER_URL}/comments`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Referer: window.location.origin + '/',
        },
        body: JSON.stringify(comment),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || 'Đăng bình luận thất bại');
    }

    return res.json();
}

// ── Admin xóa comment ──────────────────────────────────────────
export async function deleteComment(commentId: string, adminKey: string): Promise<void> {
    if (!WORKER_URL) throw new Error('CLOUDFLARE_PROXY_URL chưa được cấu hình');

    const res = await fetch(`${WORKER_URL}/comments/${commentId}`, {
        method: 'DELETE',
        headers: {
            Authorization: `Bearer ${adminKey}`,
            Referer: window.location.origin + '/',
        },
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || 'Xóa bình luận thất bại');
    }
}
