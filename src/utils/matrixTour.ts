/**
 * Hướng dẫn lần đầu cho màn hình soạn đề theo ma trận (link công khai cho giáo viên).
 * Mỗi bước chỉ vào một phần tử có thuộc tính data-tour; bước có `waitFor` chỉ cho đi tiếp
 * khi giáo viên đã tự làm thao tác đó (giống phần hướng dẫn người chơi mới trong game).
 */

export interface MatrixTourStep {
    id: string;
    title: string;
    body: string;
    /** Giá trị data-tour cần chỉ vào, theo thứ tự ưu tiên. Không có cái nào thì thẻ nằm giữa màn hình. */
    targets: readonly string[];
    /** Bộ chọn CSS: khi có phần tử khớp thì bước đã làm xong. */
    waitFor?: string;
    /** Nhắc khi bước chưa làm xong. */
    waitHint?: string;
}

export const MATRIX_TOUR_STEPS: readonly MatrixTourStep[] = [
    {
        id: 'contents',
        title: 'Chọn nội dung kiểm tra',
        body: 'Tích chọn cả chương hoặc từng bài sẽ có trong đề. Mỗi bài được chọn hiện thành một dòng trong bảng ma trận.',
        targets: ['contents'],
        waitFor: '[data-tour="matrix-table"] tbody input',
        waitHint: 'Hãy tích chọn ít nhất một bài để đi tiếp.',
    },
    {
        id: 'matrix',
        title: 'Nhập số câu theo mức độ',
        body: 'Gõ số câu cho từng bài. Trắc nghiệm chia theo Nhận biết, Thông hiểu, Vận dụng; Đúng/Sai chỉ nhập số câu; Trả lời ngắn chỉ có mức Vận dụng.',
        targets: ['matrix-rows', 'matrix-table'],
        waitFor: '[data-tour="spec"]',
        waitHint: 'Hãy nhập số câu vào ít nhất một ô để đi tiếp.',
    },
    {
        id: 'points',
        title: 'Kiểm tra điểm',
        body: 'Web tự chia điểm mỗi câu và tính tỉ lệ từng mức. Dòng “Tổng” chuyển màu xanh khi đủ thang điểm. Muốn đổi điểm, sửa ô “Điểm mỗi câu”; bấm “Chia lại” để web chia lại từ đầu.',
        targets: ['matrix-total', 'matrix-table'],
    },
    {
        id: 'suggest',
        title: 'Chọn câu hỏi',
        body: 'Bấm “Gợi ý chọn câu” để web tự chọn câu đúng bài và đúng mức độ trong ma trận. Muốn tự chọn, mở từng bài rồi chọn câu.',
        targets: ['suggest', 'spec'],
    },
    {
        id: 'export',
        title: 'Xuất ma trận và bản đặc tả',
        body: 'Mở bản ma trận và bản đặc tả theo mẫu Công văn 7991. Rà lại, rồi bấm “In / Lưu PDF” ở góc trên để lưu thành tệp PDF.',
        targets: ['export', 'spec'],
    },
    {
        id: 'compose',
        title: 'Biên soạn và xuất đề',
        body: 'Mở trình biên soạn đề: điền tên trường, thời gian làm bài, bật “Trộn đề” nếu cần nhiều mã đề, rồi bấm “Xuất PDF”. Muốn xem lại hướng dẫn này, bấm nút “Hướng dẫn” ở góc màn hình.',
        targets: ['compose', 'spec'],
    },
];

export const MATRIX_TOUR_STORAGE_KEY = 'physivault_matrix_tour_v1';

type ReadStorage = Pick<Storage, 'getItem'>;
type WriteStorage = Pick<Storage, 'setItem'>;

function browserStorage(): Storage | undefined {
    try { return typeof window === 'undefined' ? undefined : window.localStorage; }
    catch { return undefined; }
}

/** Đã xem (hoặc đã bỏ qua) hướng dẫn trên máy này chưa. Lỗi bộ nhớ thì coi như đã xem để không làm phiền. */
export function hasSeenMatrixTour(storage: ReadStorage | undefined = browserStorage()): boolean {
    if (!storage) return true;
    try { return storage.getItem(MATRIX_TOUR_STORAGE_KEY) === 'done'; }
    catch { return true; }
}

export function markMatrixTourSeen(storage: WriteStorage | undefined = browserStorage()): void {
    try { storage?.setItem(MATRIX_TOUR_STORAGE_KEY, 'done'); }
    catch { /* Bộ nhớ trình duyệt bị chặn: lần sau hướng dẫn hiện lại, không sao. */ }
}

export interface TourRect { top: number; left: number; width: number; height: number; }
export interface TourSize { width: number; height: number; }
export type TourSide = 'bottom' | 'top' | 'right' | 'left' | 'center';

/**
 * Vị trí thẻ hướng dẫn quanh vùng được chỉ: ưu tiên dưới, rồi trên, phải, trái;
 * không đủ chỗ thì đặt sát mép dưới màn hình. Thẻ luôn nằm trọn trong màn hình.
 */
export function placeTourCard(target: TourRect | null, card: TourSize, viewport: TourSize, gap = 12, margin = 12):
    { top: number; left: number; side: TourSide } {
    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, Math.max(min, max)));
    const maxLeft = viewport.width - card.width - margin;
    const maxTop = viewport.height - card.height - margin;
    if (!target) return { side: 'center', left: clamp((viewport.width - card.width) / 2, margin, maxLeft), top: clamp((viewport.height - card.height) / 2, margin, maxTop) };

    const centeredLeft = clamp(target.left + target.width / 2 - card.width / 2, margin, maxLeft);
    const centeredTop = clamp(target.top + target.height / 2 - card.height / 2, margin, maxTop);
    const below = target.top + target.height + gap;
    if (below + card.height + margin <= viewport.height) return { side: 'bottom', top: below, left: centeredLeft };
    const above = target.top - gap - card.height;
    if (above >= margin) return { side: 'top', top: above, left: centeredLeft };
    const right = target.left + target.width + gap;
    if (right + card.width + margin <= viewport.width) return { side: 'right', top: centeredTop, left: right };
    const left = target.left - gap - card.width;
    if (left >= margin) return { side: 'left', top: centeredTop, left };
    return { side: 'bottom', top: clamp(maxTop, margin, maxTop), left: centeredLeft };
}
