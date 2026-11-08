// src/services/tikzService.ts
// Biên dịch TikZ qua Kroki và lưu hình minh họa trên Telegram.

import { TELEGRAM_CHAT_ID, CLOUDFLARE_PROXY_URL, ADMIN_AUTH_HEADER } from '../lib/telegram';

export interface TikzRenderResult {
  svg: string;
  width: number;
  height: number;
  aspectRatio: number;
  recommendedLayout: 'right' | 'bottom';
}

/**
 * Biên dịch đoạn mã TikZ sang ảnh vector SVG thông qua Kroki API.
 * Tự động parse kích thước width/height để tính toán bố cục tối ưu (bên phải hay ở dưới).
 */
export async function renderTikzToSvg(tikzCode: string): Promise<TikzRenderResult> {
  const trimmed = tikzCode.trim();
  if (!trimmed) {
    throw new Error('Mã TikZ đang trống');
  }

  // Đảm bảo code được bọc đầy đủ gói LaTeX standalone và TikZ
  let finalCode = trimmed;
  if (!finalCode.includes('\\begin{tikzpicture}')) {
    finalCode = `\\begin{tikzpicture}\n${finalCode}\n\\end{tikzpicture}`;
  }
  if (!finalCode.includes('\\documentclass')) {
    finalCode = `\\documentclass{standalone}\n\\usepackage{tikz}\n\\usepackage{amsmath,amssymb}\n\\usetikzlibrary{arrows.meta}\n\\begin{document}\n${finalCode}\n\\end{document}`;
  }

  // Gọi Kroki API
  const res = await fetch('https://kroki.io/tikz/svg', {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
    body: finalCode,
  });

  if (!res.ok) {
    const errText = await res.text();
    // Bóc tách thông báo lỗi thân thiện từ LaTeX
    let userMsg = 'Không thể biên dịch mã TikZ.';
    if (errText.includes('LaTeX Error')) {
      const match = errText.match(/! LaTeX Error:([^\n]+)/);
      if (match) userMsg = `Lỗi cú pháp LaTeX: ${match[1].trim()}`;
    } else if (errText.includes('Undefined control sequence')) {
      userMsg = 'Lỗi LaTeX: Lệnh hoặc ký hiệu không xác định (Undefined control sequence).';
    }
    throw new Error(userMsg);
  }

  const svgText = await res.text();

  // Bóc tách width / height / viewBox từ SVG
  let width = 300;
  let height = 200;

  // 1. Thử parse viewBox="minX minY w h"
  const viewBoxMatch = svgText.match(/viewBox=['"]([^'"]+)['"]/);
  if (viewBoxMatch) {
    const parts = viewBoxMatch[1].trim().split(/[\s,]+/);
    if (parts.length === 4) {
      const vbW = parseFloat(parts[2]);
      const vbH = parseFloat(parts[3]);
      if (vbW > 0 && vbH > 0) {
        width = vbW;
        height = vbH;
      }
    }
  } else {
    // 2. Thử parse width="..." height="..."
    const wMatch = svgText.match(/width=['"]([\d.]+)pt?['"]/);
    const hMatch = svgText.match(/height=['"]([\d.]+)pt?['"]/);
    if (wMatch) width = parseFloat(wMatch[1]);
    if (hMatch) height = parseFloat(hMatch[1]);
  }

  const aspectRatio = width / (height || 1);
  // Nếu tỉ lệ >= 1.5: hình bè ngang dài -> đề xuất đặt ở dưới căn giữa
  // Nếu tỉ lệ < 1.5: hình gọn/vuông/dọc -> đề xuất đặt cột bên phải (2 cột)
  const recommendedLayout: 'right' | 'bottom' = aspectRatio >= 1.5 ? 'bottom' : 'right';

  return {
    svg: svgText,
    width: Math.round(width),
    height: Math.round(height),
    aspectRatio: parseFloat(aspectRatio.toFixed(2)),
    recommendedLayout,
  };
}

/**
 * Upload chuỗi SVG lên Telegram Channel qua Cloudflare Proxy.
 * Trả về telegram file_id vĩnh viễn.
 */
export async function uploadSvgToTelegram(svgContent: string, fileName: string = 'question_diagram.svg'): Promise<string | null> {
  const blob = new Blob([svgContent], { type: 'image/svg+xml' });
  return uploadIllustrationToTelegram(blob, fileName, '[TIKZ-SVG]');
}

export function uploadQuestionImageToTelegram(file: File): Promise<string | null> {
  return uploadIllustrationToTelegram(file, file.name, '[QUESTION-IMAGE]');
}

async function uploadIllustrationToTelegram(blob: Blob, fileName: string, label: string): Promise<string | null> {
  if (!TELEGRAM_CHAT_ID || !CLOUDFLARE_PROXY_URL) {
    console.warn('[tikzService] Telegram chưa cấu hình, bỏ qua upload.');
    return null;
  }

  try {
    const formData = new FormData();
    formData.append('chat_id', TELEGRAM_CHAT_ID);
    formData.append('document', blob, fileName);
    formData.append('caption', `${label} ${fileName}`);

    const res = await fetch(`${CLOUDFLARE_PROXY_URL}/proxy/sendDocument`, {
      method: 'POST',
      headers: {
        'Authorization': ADMIN_AUTH_HEADER,
      },
      body: formData,
    });

    if (!res.ok) {
      console.warn('[tikzService] Upload Telegram thất bại:', res.statusText);
      return null;
    }

    const data = await res.json();
    if (data.ok && data.result?.document?.file_id) {
      return data.result.document.file_id as string;
    }
    return null;
  } catch (err) {
    console.error('[tikzService] Lỗi khi tải hình minh họa lên Telegram:', err);
    return null;
  }
}
