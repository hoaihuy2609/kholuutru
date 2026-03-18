/**
 * omrProcessor.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Xử lý ảnh phiếu trắc nghiệm bằng OpenCV.js (Optical Mark Recognition).
 *
 * Thuật toán:
 *   1. Load OpenCV.js bất đồng bộ (chỉ 1 lần, cache lại vào window)
 *   2. Chuyển ảnh sang grayscale
 *   3. Adaptive threshold → ảnh nhị phân đen/trắng
 *   4. Tìm 4 hình vuông đen ở 4 góc (điểm neo - anchor markers)
 *   5. Perspective correction (warpPerspective) → phiếu phẳng ngay ngắn
 *   6. Chia grid theo số câu và 4 cột A/B/C/D
 *   7. Đếm pixel đen trong mỗi ô → ô nào nhiều pixel đen nhất = đáp án đã tô
 *   8. Trả về mảng đáp án + điểm số
 *
 * Layout phiếu trả lời chuẩn (PhysiVault Answer Sheet):
 *   - 4 marker đen ở 4 góc (5% mỗi chiều)
 *   - Grid đáp án: bắt đầu ở 10% top, kết thúc ở 92% height
 *   - Mỗi câu: 4 ô tròn đều nhau theo chiều ngang
 *   - 2 cột câu hỏi (trái: 1→N/2, phải: N/2+1→N)
 */

// ── Type declarations for OpenCV.js (global `cv`) ───────────────────────────
declare global {
  interface Window {
    cv: CVInstance;
    onOpenCvReady?: () => void;
  }
}

interface CVMat {
  rows: number;
  cols: number;
  data: Uint8Array;
  data32F: Float32Array;
  delete(): void;
}

interface CVRect {
  x: number;
  y: number;
  width: number;
  height: number;
}



interface CVMatVector {
  size(): number;
  get(i: number): CVMat;
  delete(): void;
}

interface CVInstance {
  Mat: new (rows?: number, cols?: number, type?: number) => CVMat;
  MatVector: new () => CVMatVector;
  imread(canvas: HTMLCanvasElement): CVMat;
  imshow(canvas: HTMLCanvasElement, mat: CVMat): void;
  cvtColor(src: CVMat, dst: CVMat, code: number): void;
  GaussianBlur(src: CVMat, dst: CVMat, ksize: { width: number; height: number }, sigmaX: number): void;
  threshold(src: CVMat, dst: CVMat, thresh: number, maxval: number, type: number): void;
  adaptiveThreshold(src: CVMat, dst: CVMat, maxValue: number, adaptiveMethod: number, thresholdType: number, blockSize: number, C: number): void;
  findContours(image: CVMat, contours: CVMatVector, hierarchy: CVMat, mode: number, method: number): void;
  contourArea(contour: CVMat): number;
  boundingRect(contour: CVMat): CVRect;
  approxPolyDP(curve: CVMat, approxCurve: CVMat, epsilon: number, closed: boolean): void;
  arcLength(curve: CVMat, closed: boolean): number;
  getPerspectiveTransform(src: CVMat, dst: CVMat): CVMat;
  warpPerspective(src: CVMat, dst: CVMat, M: CVMat, dsize: { width: number; height: number }): void;
  mean(src: CVMat, mask?: CVMat): number[];
  resize(src: CVMat, dst: CVMat, dsize: { width: number; height: number }): void;
  Rect(x: number, y: number, w: number, h: number): CVRect;
  matFromArray(rows: number, cols: number, type: number, array: number[]): CVMat;
  Size(w: number, h: number): { width: number; height: number };
  // Constants
  COLOR_RGBA2GRAY: number;
  COLOR_GRAY2RGBA: number;
  THRESH_BINARY_INV: number;
  THRESH_OTSU: number;
  ADAPTIVE_THRESH_GAUSSIAN_C: number;
  THRESH_BINARY: number;
  RETR_EXTERNAL: number;
  CHAIN_APPROX_SIMPLE: number;
  CV_32FC2: number;
  CV_8UC1: number;
  CV_8UC4: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const OPENCV_CDN = 'https://docs.opencv.org/4.8.0/opencv.js';

/** Kích thước chuẩn mà ảnh sẽ được warp về (output phiếu chuẩn hóa) */
const NORMALIZED_W = 800;
const NORMALIZED_H = 1100;

/** Vị trí grid đáp án trong phiếu đã chuẩn hóa (tỷ lệ 0–1) */
const GRID_CONFIG = {
  // Cột trái (câu 1 → N/2): tọa độ X trung tâm 4 ô ABCD
  LEFT_COL_X_START: 0.07,   // Cạnh trái của khu vực cột 1
  LEFT_COL_X_END:   0.47,   // Cạnh phải của khu vực cột 1
  // Cột phải (câu N/2+1 → N):
  RIGHT_COL_X_START: 0.53,
  RIGHT_COL_X_END:   0.93,
  // Grid theo chiều dọc
  GRID_Y_START: 0.12,       // Dòng đầu tiên bắt đầu ở 12% chiều cao
  GRID_Y_END:   0.94,       // Dòng cuối kết thúc ở 94% chiều cao
};

// ── OpenCV.js Loader ─────────────────────────────────────────────────────────

let cvReady: Promise<CVInstance> | null = null;

/**
 * Lazy-load OpenCV.js một lần duy nhất, cache vào Promise.
 */
export function loadOpenCV(): Promise<CVInstance> {
  if (cvReady) return cvReady;

  // Nếu đã được load rồi (ví dụ từ CDN script tag trong index.html)
  if (window.cv && typeof window.cv.imread === 'function') {
    cvReady = Promise.resolve(window.cv);
    return cvReady;
  }

  cvReady = new Promise<CVInstance>((resolve, reject) => {
    // Thêm callback trước khi inject script
    window.onOpenCvReady = () => {
      if (window.cv) resolve(window.cv);
      else reject(new Error('OpenCV loaded but cv object not found'));
    };

    const script = document.createElement('script');
    script.src = OPENCV_CDN;
    script.async = true;
    // OpenCV.js gọi window.onOpenCvReady() khi xong
    script.setAttribute('data-pv-omr', '1');
    script.onerror = () => reject(new Error('Không tải được OpenCV.js. Kiểm tra kết nối mạng.'));

    // Timeout 30s
    const timeoutId = setTimeout(() => {
      reject(new Error('Hết thời gian tải OpenCV.js (30s). Thử lại sau.'));
    }, 30000);

    const originalReady = window.onOpenCvReady;
    window.onOpenCvReady = () => {
      clearTimeout(timeoutId);
      originalReady?.();
    };

    document.head.appendChild(script);
  });

  return cvReady;
}

// ── Kết quả trả về ───────────────────────────────────────────────────────────

export interface OMRResult {
  studentAnswers: (string | null)[];
  score: number;           // Điểm thang 10
  totalQuestions: number;
  correctCount: number;
  wrongIndexes: number[];
  blankIndexes: number[];
  debugCanvas?: HTMLCanvasElement; // Canvas debug (optional)
}

export type AnswerKey = Record<number, string>; // { 0: 'A', 1: 'B', ... }

// ── Fallback Processor (không cần OpenCV) ─────────────────────────────────────

/**
 * Phiên bản đơn giản KHÔNG dùng OpenCV.
 * Chỉ đọc brightness pixel thô để detect ô tô.
 * Dùng khi OpenCV chưa load xong hoặc bị lỗi.
 */
export function processOMRFallback(
  canvas: HTMLCanvasElement,
  answerKey: AnswerKey,
  totalQuestions: number
): OMRResult {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context không khả dụng');

  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height).data;
  const ANSWER_OPTIONS = ['A', 'B', 'C', 'D'];
  const studentAnswers: (string | null)[] = [];

  // Chia grid đơn giản: N hàng × 4 cột
  const half = Math.ceil(totalQuestions / 2);

  // Xử lý từng câu
  for (let q = 0; q < totalQuestions; q++) {
    const isRight = q >= half;
    const localRow = isRight ? q - half : q;
    const totalRows = isRight ? totalQuestions - half : half;

    const colConfig = isRight ? GRID_CONFIG.RIGHT_COL_X_START : GRID_CONFIG.LEFT_COL_X_START;
    const colEnd = isRight ? GRID_CONFIG.RIGHT_COL_X_END : GRID_CONFIG.LEFT_COL_X_END;

    const rowY1 = Math.floor((GRID_CONFIG.GRID_Y_START + (localRow / totalRows) * (GRID_CONFIG.GRID_Y_END - GRID_CONFIG.GRID_Y_START)) * height);
    const rowY2 = Math.floor((GRID_CONFIG.GRID_Y_START + ((localRow + 1) / totalRows) * (GRID_CONFIG.GRID_Y_END - GRID_CONFIG.GRID_Y_START)) * height);
    const colW = colEnd - colConfig;

    let selectedCol = -1;
    let darkest = 240;

    for (let c = 0; c < 4; c++) {
      const x1 = Math.floor((colConfig + (c / 4) * colW) * width);
      const x2 = Math.floor((colConfig + ((c + 1) / 4) * colW) * width);

      let total = 0, count = 0;
      for (let py = rowY1; py < rowY2 && py < height; py++) {
        for (let px = x1; px < x2 && px < width; px++) {
          const i = (py * width + px) * 4;
          total += (imageData[i] * 0.299 + imageData[i + 1] * 0.587 + imageData[i + 2] * 0.114);
          count++;
        }
      }
      const avg = count > 0 ? total / count : 255;
      if (avg < darkest) { darkest = avg; selectedCol = c; }
    }

    studentAnswers.push(darkest < 180 ? ANSWER_OPTIONS[selectedCol] : null);
  }

  return calcScore(studentAnswers, answerKey, totalQuestions);
}

// ── OpenCV-based Processor ────────────────────────────────────────────────────

/**
 * Xử lý chính có OpenCV.
 * Thực hiện perspective correction trước khi quét grid.
 */
export async function processOMRWithOpenCV(
  canvas: HTMLCanvasElement,
  answerKey: AnswerKey,
  totalQuestions: number
): Promise<OMRResult> {
  const cv = await loadOpenCV();
  const ANSWER_OPTIONS = ['A', 'B', 'C', 'D'];

  let src: CVMat | null = null;
  let gray: CVMat | null = null;
  let binary: CVMat | null = null;
  let contours: CVMatVector | null = null;
  let hierarchy: CVMat | null = null;
  let warped: CVMat | null = null;
  let M: CVMat | null = null;
  let srcPts: CVMat | null = null;
  let dstPts: CVMat | null = null;

  try {
    // 1. Đọc ảnh từ canvas
    src = cv.imread(canvas);

    // 2. Chuyển sang grayscale
    gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    // 3. Gaussian blur để giảm nhiễu
    cv.GaussianBlur(gray, gray, cv.Size(5, 5), 0);

    // 4. Threshold để phát hiện marker đen ở 4 góc
    binary = new cv.Mat();
    cv.threshold(gray, binary, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);

    // 5. Tìm contours
    contours = new cv.MatVector();
    hierarchy = new cv.Mat();
    cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    // 6. Tìm 4 marker hình vuông ở 4 góc (diện tích ~2-8% của ảnh)
    const imageArea = canvas.width * canvas.height;
    const markers: { cx: number; cy: number; area: number }[] = [];

    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const area = cv.contourArea(contour);
      const minArea = imageArea * 0.001;
      const maxArea = imageArea * 0.05;

      if (area > minArea && area < maxArea) {
        const rect = cv.boundingRect(contour);
        const aspectRatio = rect.width / rect.height;
        // Marker phải gần vuông (aspect ratio ~1)
        if (aspectRatio > 0.5 && aspectRatio < 2.0) {
          markers.push({
            cx: rect.x + rect.width / 2,
            cy: rect.y + rect.height / 2,
            area,
          });
        }
      }
    }

    // 7. Nếu tìm được ≥4 marker, thực hiện perspective correction
    let processCanvas: HTMLCanvasElement = canvas;

    if (markers.length >= 4) {
      // Sắp xếp markers: TL, TR, BL, BR  
      markers.sort((a, b) => a.cy - b.cy); // Sắp theo Y
      const topMarkers = markers.slice(0, 2).sort((a, b) => a.cx - b.cx);
      const bottomMarkers = markers.slice(-2).sort((a, b) => a.cx - b.cx);

      const tl = topMarkers[0];
      const tr = topMarkers[1];
      const bl = bottomMarkers[0];
      const br = bottomMarkers[1];

      if (tl && tr && bl && br) {
        // Source points (các góc trong ảnh gốc)
        srcPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
          tl.cx, tl.cy,
          tr.cx, tr.cy,
          br.cx, br.cy,
          bl.cx, bl.cy,
        ]);

        // Destination points (góc trong ảnh đã chuẩn hóa)
        dstPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
          0, 0,
          NORMALIZED_W, 0,
          NORMALIZED_W, NORMALIZED_H,
          0, NORMALIZED_H,
        ]);

        M = cv.getPerspectiveTransform(srcPts, dstPts);
        warped = new cv.Mat();
        cv.warpPerspective(src, warped, M, cv.Size(NORMALIZED_W, NORMALIZED_H));

        // Vẽ ảnh đã warp ra canvas tạm
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = NORMALIZED_W;
        tempCanvas.height = NORMALIZED_H;
        cv.imshow(tempCanvas, warped);
        processCanvas = tempCanvas;
      }
    }

    // 8. Quét grid đáp án từ ảnh đã chuẩn hóa (hoặc ảnh gốc nếu ko tìm được marker)
    const procCtx = processCanvas.getContext('2d');
    if (!procCtx) throw new Error('Không khởi tạo được canvas context');

    const procData = procCtx.getImageData(0, 0, processCanvas.width, processCanvas.height).data;
    const W = processCanvas.width;
    const H = processCanvas.height;
    const half = Math.ceil(totalQuestions / 2);
    const studentAnswers: (string | null)[] = [];

    for (let q = 0; q < totalQuestions; q++) {
      const isRight = q >= half;
      const localRow = isRight ? q - half : q;
      const totalRows = isRight ? totalQuestions - half : half;

      const xStart = isRight ? GRID_CONFIG.RIGHT_COL_X_START : GRID_CONFIG.LEFT_COL_X_START;
      const xEnd   = isRight ? GRID_CONFIG.RIGHT_COL_X_END    : GRID_CONFIG.LEFT_COL_X_END;

      // Padding nhỏ giữa các hàng
      const paddingRatio = 0.08;
      const rowFraction = (GRID_CONFIG.GRID_Y_END - GRID_CONFIG.GRID_Y_START) / totalRows;
      const rowY1 = Math.floor((GRID_CONFIG.GRID_Y_START + localRow * rowFraction + rowFraction * paddingRatio) * H);
      const rowY2 = Math.floor((GRID_CONFIG.GRID_Y_START + (localRow + 1) * rowFraction - rowFraction * paddingRatio) * H);
      const colW = (xEnd - xStart) / 4;

      let selectedCol = -1;
      let darkestAvg = 240;

      for (let c = 0; c < 4; c++) {
        // Padding ngang nhỏ trong mỗi ô
        const pad = 0.1;
        const cx1 = Math.floor((xStart + (c + pad) * colW) * W);
        const cx2 = Math.floor((xStart + (c + 1 - pad) * colW) * W);

        let totalBrightness = 0;
        let count = 0;

        for (let py = rowY1; py < rowY2 && py < H; py++) {
          for (let px = cx1; px < cx2 && px < W; px++) {
            const i = (py * W + px) * 4;
            const gray = procData[i] * 0.299 + procData[i + 1] * 0.587 + procData[i + 2] * 0.114;
            totalBrightness += gray;
            count++;
          }
        }

        const avg = count > 0 ? totalBrightness / count : 255;
        if (avg < darkestAvg) {
          darkestAvg = avg;
          selectedCol = c;
        }
      }

      // Ngưỡng detect: ô tô phải đủ tối (< 160 brightness)
      studentAnswers.push(darkestAvg < 160 ? ANSWER_OPTIONS[selectedCol] : null);
    }

    return calcScore(studentAnswers, answerKey, totalQuestions);

  } finally {
    // QUAN TRỌNG: Giải phóng bộ nhớ OpenCV (Mat phải luôn được delete sau khi dùng)
    src?.delete();
    gray?.delete();
    binary?.delete();
    contours?.delete();
    hierarchy?.delete();
    warped?.delete();
    M?.delete();
    srcPts?.delete();
    dstPts?.delete();
  }
}

// ── Score Calculator ─────────────────────────────────────────────────────────

function calcScore(
  studentAnswers: (string | null)[],
  answerKey: AnswerKey,
  totalQuestions: number
): OMRResult {
  let correctCount = 0;
  const wrongIndexes: number[] = [];
  const blankIndexes: number[] = [];

  for (let i = 0; i < totalQuestions; i++) {
    const studentAns = studentAnswers[i];
    const correctAns = answerKey[i];
    if (studentAns === null) {
      blankIndexes.push(i);
    } else if (studentAns === correctAns) {
      correctCount++;
    } else {
      wrongIndexes.push(i);
    }
  }

  const score = parseFloat(((correctCount / totalQuestions) * 10).toFixed(2));

  return {
    studentAnswers,
    score,
    totalQuestions,
    correctCount,
    wrongIndexes,
    blankIndexes,
  };
}
