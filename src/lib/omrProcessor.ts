
// ─────────────────────────────────────────────────────────────────────────────
// omrProcessor.ts — Pure canvas-based OMR engine for BGD 2025 answer sheet
// No external dependencies required.
// ─────────────────────────────────────────────────────────────────────────────

export interface Point { x: number; y: number; }

export interface OMRAnswers {
  sbd: string;        // Số báo danh (6 chữ số)
  maDethi: string;    // Mã đề thi (3 chữ số)
  mc: string[];       // Phần I: 40 câu, mỗi câu: 'A'|'B'|'C'|'D'|''
  tf: { a: string; b: string; c: string; d: string }[]; // Phần II: 8 câu
  sa: string[];       // Phần III: 6 câu, mỗi câu là chuỗi số (VD: "3.14", "-5")
}

export interface OMRResult {
  answers: OMRAnswers;
  debugCanvas?: HTMLCanvasElement; // canvas đã được transform + đánh dấu bubble
  confidence: number;              // 0-1, tỉ lệ số ô nhận diện được rõ ràng
  anchorsFound: number;            // số anchor tìm được (tối đa 4)
}

// ─── Kích thước canvas chuẩn hóa (A4@300dpi) ────────────────────────────────
const W = 2480;
const H = 3508;

// ─── Vị trí anchor (4 góc phiếu) ────────────────────────────────────────────
const ANCHOR_REGIONS: { x: number; y: number; size: number }[] = [
  { x: 0.030, y: 0.020, size: 0.022 }, // Top-left
  { x: 0.930, y: 0.020, size: 0.022 }, // Top-right
  { x: 0.030, y: 0.980, size: 0.022 }, // Bottom-left
  { x: 0.930, y: 0.980, size: 0.022 }, // Bottom-right
];

// ─── SBD (Số báo danh) — 6 cột × 10 hàng (0–9) ─────────────────────────────
const SBD_CONFIG = {
  cols: 6, rows: 10,
  startX: 0.618, startY: 0.072,
  colStep: 0.038, rowStep: 0.020,
  r: 8,
};

// ─── Mã đề thi — 3 cột × 10 hàng (0–9) ─────────────────────────────────────
const MA_DE_CONFIG = {
  cols: 3, rows: 10,
  startX: 0.854, startY: 0.072,
  colStep: 0.038, rowStep: 0.020,
  r: 8,
};

// ─── Phần I: 40 câu ABCD — 4 nhóm × 10 câu ──────────────────────────────────
const PART1_CONFIG = {
  groups: [
    { startQ: 1,  startX: 0.060, startY: 0.385 },
    { startQ: 11, startX: 0.285, startY: 0.385 },
    { startQ: 21, startX: 0.510, startY: 0.385 },
    { startQ: 31, startX: 0.735, startY: 0.385 },
  ],
  rowStep: 0.032, colStep: 0.042,
  abcdOffsetX: 0.053,
  r: 10,
};

// ─── Phần II: 8 câu Đúng/Sai ────────────────────────────────────────────────
const PART2_CONFIG = {
  groups: [
    { cqs: [1, 2], startX: 0.060, startY: 0.780 },
    { cqs: [3, 4], startX: 0.285, startY: 0.780 },
    { cqs: [5, 6], startX: 0.510, startY: 0.780 },
    { cqs: [7, 8], startX: 0.735, startY: 0.780 },
  ],
  qColStep: 0.115, rowStep: 0.022,
  dsOffsetX: 0.032, dsStep: 0.040,
  r: 9,
};

// ─── Phần III: 6 câu trả lời ngắn ───────────────────────────────────────────
const PART3_CONFIG = {
  questions: [
    { startX: 0.060, startY: 0.892 },
    { startX: 0.215, startY: 0.892 },
    { startX: 0.375, startY: 0.892 },
    { startX: 0.530, startY: 0.892 },
    { startX: 0.685, startY: 0.892 },
    { startX: 0.843, startY: 0.892 },
  ],
  colStep: 0.065, rowStep: 0.018,
  r: 7,
  chars: ['-', '.', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
};

// ─────────────────────────────────────────────── HELPERS ──────────────────────

function sampleDarkness(
  data: Uint8ClampedArray, imgW: number,
  cx: number, cy: number, r: number
): number {
  let sum = 0, count = 0;
  const x0 = Math.max(0, Math.floor(cx - r));
  const x1 = Math.min(imgW - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const imgH = Math.floor(data.length / (imgW * 4));
  const y1 = Math.min(imgH - 1, Math.ceil(cy + r));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) {
        const idx = (y * imgW + x) * 4;
        const brightness = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
        sum += 255 - brightness;
        count++;
      }
    }
  }
  return count > 0 ? sum / count : 0;
}

function findAnchorNear(
  data: Uint8ClampedArray, imgW: number, imgH: number,
  expectedX: number, expectedY: number, searchSize: number
): Point | null {
  const ex = expectedX * imgW;
  const ey = expectedY * imgH;
  const sw = searchSize * imgW;

  const x0 = Math.max(0, Math.floor(ex - sw));
  const x1 = Math.min(imgW - 1, Math.ceil(ex + sw));
  const y0 = Math.max(0, Math.floor(ey - sw));
  const y1 = Math.min(imgH - 1, Math.ceil(ey + sw));

  let bestScore = 0, bestX = ex, bestY = ey;
  const step = Math.max(1, Math.floor(sw / 20));
  const r = Math.floor(sw * 0.4);

  for (let y = y0; y <= y1; y += step) {
    for (let x = x0; x <= x1; x += step) {
      const score = sampleDarkness(data, imgW, x, y, r);
      if (score > bestScore) { bestScore = score; bestX = x; bestY = y; }
    }
  }
  return bestScore > 60 ? { x: bestX, y: bestY } : null;
}

// ─── Homography ───────────────────────────────────────────────────────────────

function gaussElimination(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) maxRow = row;
    }
    [M[col], M[maxRow]] = [M[maxRow], M[col]];
    for (let row = col + 1; row < n; row++) {
      const f = M[row][col] / M[col][col];
      for (let j = col; j <= n; j++) M[row][j] -= f * M[col][j];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = M[i][n] / M[i][i];
    for (let k = i - 1; k >= 0; k--) M[k][n] -= M[k][i] * x[i];
  }
  return x;
}

function computeHomography(src: Point[], dst: Point[]): number[] {
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: X, y: Y } = dst[i];
    A.push([x, y, 1, 0, 0, 0, -X * x, -X * y]);
    A.push([0, 0, 0, x, y, 1, -Y * x, -Y * y]);
    b.push(X);
    b.push(Y);
  }
  return [...gaussElimination(A, b), 1];
}

function applyHomography(H: number[], x: number, y: number): Point {
  const [h0, h1, h2, h3, h4, h5, h6, h7, h8] = H;
  const d = h6 * x + h7 * y + h8;
  return { x: (h0 * x + h1 * y + h2) / d, y: (h3 * x + h4 * y + h5) / d };
}

function warpPerspective(
  srcCanvas: HTMLCanvasElement, dstW: number, dstH: number,
  srcCorners: Point[], dstCorners: Point[]
): HTMLCanvasElement {
  const dst = document.createElement('canvas');
  dst.width = dstW; dst.height = dstH;
  const dstCtx = dst.getContext('2d')!;
  const H_inv = computeHomography(dstCorners, srcCorners);
  const srcCtx = srcCanvas.getContext('2d')!;
  const srcData = srcCtx.getImageData(0, 0, srcCanvas.width, srcCanvas.height);
  const dstData = dstCtx.createImageData(dstW, dstH);
  for (let dy = 0; dy < dstH; dy++) {
    for (let dx = 0; dx < dstW; dx++) {
      const { x: sx, y: sy } = applyHomography(H_inv, dx, dy);
      const sx0 = Math.floor(sx), sy0 = Math.floor(sy);
      if (sx0 >= 0 && sx0 < srcCanvas.width && sy0 >= 0 && sy0 < srcCanvas.height) {
        const si = (sy0 * srcCanvas.width + sx0) * 4;
        const di = (dy * dstW + dx) * 4;
        dstData.data[di] = srcData.data[si];
        dstData.data[di + 1] = srcData.data[si + 1];
        dstData.data[di + 2] = srcData.data[si + 2];
        dstData.data[di + 3] = srcData.data[si + 3];
      }
    }
  }
  dstCtx.putImageData(dstData, 0, 0);
  return dst;
}

// ─────────────────────────────────────────────── MAIN ─────────────────────────

export async function processOMRImage(
  imageFile: File | HTMLImageElement | HTMLCanvasElement,
  debug = false
): Promise<OMRResult> {

  // Load ảnh vào canvas
  const srcCanvas = document.createElement('canvas');
  const srcCtx = srcCanvas.getContext('2d')!;

  await new Promise<void>((resolve) => {
    if (imageFile instanceof File) {
      const img = new Image();
      img.onload = () => {
        srcCanvas.width = img.naturalWidth;
        srcCanvas.height = img.naturalHeight;
        srcCtx.drawImage(img, 0, 0);
        resolve();
      };
      img.src = URL.createObjectURL(imageFile);
    } else if (imageFile instanceof HTMLImageElement) {
      srcCanvas.width = imageFile.naturalWidth;
      srcCanvas.height = imageFile.naturalHeight;
      srcCtx.drawImage(imageFile, 0, 0);
      resolve();
    } else {
      srcCanvas.width = (imageFile as HTMLCanvasElement).width;
      srcCanvas.height = (imageFile as HTMLCanvasElement).height;
      srcCtx.drawImage(imageFile as HTMLCanvasElement, 0, 0);
      resolve();
    }
  });

  const iW = srcCanvas.width, iH = srcCanvas.height;
  const rawData = srcCtx.getImageData(0, 0, iW, iH).data;

  // Tìm anchor góc
  const foundAnchors = ANCHOR_REGIONS.map(a =>
    findAnchorNear(rawData, iW, iH, a.x, a.y, a.size)
  );
  const validAnchors = foundAnchors.filter(Boolean) as Point[];

  // Perspective transform
  let workCanvas: HTMLCanvasElement;
  if (validAnchors.length >= 4) {
    const srcCorners: Point[] = [foundAnchors[0]!, foundAnchors[1]!, foundAnchors[2]!, foundAnchors[3]!];
    const dstCorners: Point[] = [{ x: 0, y: 0 }, { x: W - 1, y: 0 }, { x: 0, y: H - 1 }, { x: W - 1, y: H - 1 }];
    workCanvas = warpPerspective(srcCanvas, W, H, srcCorners, dstCorners);
  } else {
    workCanvas = document.createElement('canvas');
    workCanvas.width = W; workCanvas.height = H;
    workCanvas.getContext('2d')!.drawImage(srcCanvas, 0, 0, W, H);
  }

  const wCtx = workCanvas.getContext('2d')!;
  const wData = wCtx.getImageData(0, 0, W, H).data;

  // Debug canvas
  let dbgCanvas: HTMLCanvasElement | undefined;
  let dbgCtx: CanvasRenderingContext2D | undefined;
  if (debug) {
    dbgCanvas = document.createElement('canvas');
    dbgCanvas.width = W; dbgCanvas.height = H;
    dbgCtx = dbgCanvas.getContext('2d')!;
    dbgCtx.drawImage(workCanvas, 0, 0);
  }

  let totalBubbles = 0, clearBubbles = 0;

  function readBubble(cx: number, cy: number, r: number): boolean {
    const dark = sampleDarkness(wData, W, cx, cy, r);
    totalBubbles++;
    if (dark > 110 || dark < 30) clearBubbles++;
    const filled = dark > 80;
    if (dbgCtx) {
      dbgCtx.beginPath();
      dbgCtx.arc(cx, cy, 14, 0, Math.PI * 2);
      dbgCtx.strokeStyle = filled ? '#00cc44' : '#ff333344';
      dbgCtx.lineWidth = 4;
      dbgCtx.stroke();
    }
    return filled;
  }

  // ── Đọc SBD ────────────────────────────────────────────────────────────────
  const sbdDigits: string[] = [];
  for (let col = 0; col < SBD_CONFIG.cols; col++) {
    let found = '';
    for (let row = 0; row < SBD_CONFIG.rows; row++) {
      const cx = (SBD_CONFIG.startX + col * SBD_CONFIG.colStep) * W;
      const cy = (SBD_CONFIG.startY + row * SBD_CONFIG.rowStep) * H;
      if (readBubble(cx, cy, SBD_CONFIG.r)) { found = String(row); break; }
    }
    sbdDigits.push(found);
  }

  // ── Đọc Mã đề ───────────────────────────────────────────────────────────────
  const maDeDigits: string[] = [];
  for (let col = 0; col < MA_DE_CONFIG.cols; col++) {
    let found = '';
    for (let row = 0; row < MA_DE_CONFIG.rows; row++) {
      const cx = (MA_DE_CONFIG.startX + col * MA_DE_CONFIG.colStep) * W;
      const cy = (MA_DE_CONFIG.startY + row * MA_DE_CONFIG.rowStep) * H;
      if (readBubble(cx, cy, MA_DE_CONFIG.r)) { found = String(row); break; }
    }
    maDeDigits.push(found);
  }

  // ── Đọc Phần I ─────────────────────────────────────────────────────────────
  const mc: string[] = new Array(40).fill('');
  const abcd = ['A', 'B', 'C', 'D'];
  for (const grp of PART1_CONFIG.groups) {
    for (let q = 0; q < 10; q++) {
      const qIdx = grp.startQ - 1 + q;
      const cy = (grp.startY + q * PART1_CONFIG.rowStep) * H;
      for (let c = 0; c < 4; c++) {
        const cx = (grp.startX + PART1_CONFIG.abcdOffsetX + c * PART1_CONFIG.colStep) * W;
        if (readBubble(cx, cy, PART1_CONFIG.r)) {
          mc[qIdx] = mc[qIdx] ? '?' : abcd[c];
        }
      }
    }
  }

  // ── Đọc Phần II ────────────────────────────────────────────────────────────
  const tf: OMRAnswers['tf'] = Array.from({ length: 8 }, () => ({ a: '', b: '', c: '', d: '' }));
  const tfKeys = ['a', 'b', 'c', 'd'] as const;
  for (const grp of PART2_CONFIG.groups) {
    for (let qi = 0; qi < 2; qi++) {
      const qNum = grp.cqs[qi] - 1;
      const qStartX = grp.startX + qi * PART2_CONFIG.qColStep;
      for (let ki = 0; ki < 4; ki++) {
        const cy = (grp.startY + ki * PART2_CONFIG.rowStep) * H;
        const cxD = (qStartX + PART2_CONFIG.dsOffsetX) * W;
        const cxS = (qStartX + PART2_CONFIG.dsOffsetX + PART2_CONFIG.dsStep) * W;
        const filledD = readBubble(cxD, cy, PART2_CONFIG.r);
        const filledS = readBubble(cxS, cy, PART2_CONFIG.r);
        if (filledD && !filledS) tf[qNum][tfKeys[ki]] = 'D';
        else if (filledS && !filledD) tf[qNum][tfKeys[ki]] = 'S';
      }
    }
  }

  // ── Đọc Phần III ───────────────────────────────────────────────────────────
  const sa: string[] = [];
  for (let qi = 0; qi < 6; qi++) {
    const qCfg = PART3_CONFIG.questions[qi];
    let answer = '';
    for (let col = 0; col < 2; col++) {
      let charFound = '';
      for (let row = 0; row < PART3_CONFIG.chars.length; row++) {
        const cx = (qCfg.startX + col * PART3_CONFIG.colStep) * W;
        const cy = (qCfg.startY + row * PART3_CONFIG.rowStep) * H;
        if (readBubble(cx, cy, PART3_CONFIG.r)) { charFound = PART3_CONFIG.chars[row]; break; }
      }
      answer += charFound;
    }
    sa.push(answer.trim());
  }

  return {
    answers: { sbd: sbdDigits.join(''), maDethi: maDeDigits.join(''), mc, tf, sa },
    debugCanvas: dbgCanvas,
    confidence: totalBubbles > 0 ? clearBubbles / totalBubbles : 0,
    anchorsFound: validAnchors.length,
  };
}

// ─── Tính điểm BGD 2025 ───────────────────────────────────────────────────────

export interface AnswerKey {
  mc: string[];
  tf: { a: string; b: string; c: string; d: string }[];
  sa: string[];
}

export interface ScoreResult {
  mc: number; tf: number; sa: number; total: number;
  mcDetail: boolean[];
  tfDetail: number[];
  saDetail: boolean[];
}

export function scoreOMR(answers: OMRAnswers, key: AnswerKey): ScoreResult {
  let mcScore = 0;
  const mcDetail = answers.mc.map((ans, i) => {
    const ok = ans === key.mc[i];
    if (ok) mcScore += 0.25;
    return ok;
  });

  let tfScore = 0;
  const tfKeys = ['a', 'b', 'c', 'd'] as const;
  const tfDetail = answers.tf.map((ans, i) => {
    const k = key.tf[i];
    const correct = k ? tfKeys.filter(ki => ans[ki] === k[ki] && ans[ki] !== '').length : 0;
    if (correct === 1) tfScore += 0.1;
    else if (correct === 2) tfScore += 0.25;
    else if (correct === 3) tfScore += 0.5;
    else if (correct === 4) tfScore += 1.0;
    return correct;
  });

  let saScore = 0;
  const saDetail = answers.sa.map((ans, i) => {
    const ok = (ans || '').replace(',', '.').trim().toLowerCase() ===
               (key.sa[i] || '').replace(',', '.').trim().toLowerCase();
    if (ok) saScore += 0.25;
    return ok;
  });

  return {
    mc: Math.round(mcScore * 100) / 100,
    tf: Math.round(tfScore * 100) / 100,
    sa: Math.round(saScore * 100) / 100,
    total: Math.round((mcScore + tfScore + saScore) * 100) / 100,
    mcDetail, tfDetail, saDetail,
  };
}
