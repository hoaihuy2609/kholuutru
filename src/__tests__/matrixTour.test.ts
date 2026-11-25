import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hasSeenMatrixTour, markMatrixTourSeen, MATRIX_TOUR_STEPS, MATRIX_TOUR_STORAGE_KEY, placeTourCard } from '../utils/matrixTour';

const SOURCES = ['MatrixPlanner', 'LessonSpecification', 'MatrixPlanSpecification', 'MatrixExportDialog']
    .map(name => readFileSync(resolve(__dirname, '../../components', name + '.tsx'), 'utf8')).join('\n');

describe('các bước hướng dẫn soạn đề', () => {
    it('đi đủ quy trình từ chọn nội dung đến xuất PDF đề', () => {
        expect(MATRIX_TOUR_STEPS.map(step => step.id)).toEqual(['contents', 'matrix', 'points', 'suggest', 'export', 'compose']);
        expect(new Set(MATRIX_TOUR_STEPS.map(step => step.id)).size).toBe(MATRIX_TOUR_STEPS.length);
        expect(MATRIX_TOUR_STEPS.at(-1)!.body).toContain('Xuất PDF');
    });

    it('mọi chỗ được chỉ vào đều có trên giao diện (không chỉ vào chỗ không còn)', () => {
        const names = new Set(MATRIX_TOUR_STEPS.flatMap(step => [...step.targets]));
        for (const step of MATRIX_TOUR_STEPS) {
            const selector = step.waitFor?.match(/data-tour="([^"]+)"/)?.[1];
            if (selector) names.add(selector);
        }
        for (const name of names) expect(SOURCES, name).toContain(`data-tour="${name}"`);
    });

    it('bước cần giáo viên tự làm thì có lời nhắc', () => {
        for (const step of MATRIX_TOUR_STEPS) if (step.waitFor) expect(step.waitHint, step.id).toBeTruthy();
    });

    it('các nút được nhắc tới đúng tên trên giao diện', () => {
        const all = readFileSync(resolve(__dirname, '../../components/ExamStyleModal.tsx'), 'utf8') + SOURCES;
        for (const label of ['Gợi ý chọn câu', 'In / Lưu PDF', 'Xuất PDF', 'Trộn đề', 'Chia lại', 'Điểm mỗi câu']) expect(all, label).toContain(label);
    });
});

describe('ghi nhớ đã xem hướng dẫn', () => {
    it('lần đầu chưa xem, sau khi xong thì không tự mở nữa', () => {
        const data = new Map<string, string>();
        const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
        expect(hasSeenMatrixTour(storage)).toBe(false);
        markMatrixTourSeen(storage);
        expect(data.get(MATRIX_TOUR_STORAGE_KEY)).toBe('done');
        expect(hasSeenMatrixTour(storage)).toBe(true);
    });

    it('trình duyệt chặn bộ nhớ thì không lỗi và không làm phiền', () => {
        const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
        expect(hasSeenMatrixTour(blocked)).toBe(true);
        expect(() => markMatrixTourSeen(blocked)).not.toThrow();
        expect(hasSeenMatrixTour(undefined)).toBe(true);
    });
});

describe('vị trí thẻ hướng dẫn', () => {
    const viewport = { width: 1280, height: 800 };
    const card = { width: 360, height: 220 };
    const inside = ({ top, left }: { top: number; left: number }, view = viewport) => {
        expect(left).toBeGreaterThanOrEqual(12);
        expect(top).toBeGreaterThanOrEqual(12);
        expect(left + card.width).toBeLessThanOrEqual(view.width - 12);
        expect(top + card.height).toBeLessThanOrEqual(view.height - 12);
    };

    it('nằm dưới chỗ được chỉ khi còn chỗ', () => {
        const place = placeTourCard({ top: 100, left: 400, width: 200, height: 40 }, card, viewport);
        expect(place.side).toBe('bottom');
        expect(place.top).toBe(152);
        inside(place);
    });

    it('lên trên khi chỗ được chỉ ở sát đáy màn hình', () => {
        const place = placeTourCard({ top: 700, left: 1100, width: 160, height: 40 }, card, viewport);
        expect(place.side).toBe('top');
        inside(place);
    });

    it('sang phải khi chỗ được chỉ cao gần hết màn hình', () => {
        const place = placeTourCard({ top: 20, left: 20, width: 280, height: 760 }, card, viewport);
        expect(place.side).toBe('right');
        inside(place);
    });

    it('không còn chỗ nào thì nằm trong màn hình, sát mép dưới', () => {
        const phone = { width: 390, height: 760 };
        const place = placeTourCard({ top: 4, left: 4, width: 382, height: 752 }, { width: 366, height: 220 }, phone);
        expect(place.top + 220).toBeLessThanOrEqual(phone.height - 12);
        expect(place.left).toBeGreaterThanOrEqual(12);
    });

    it('không có chỗ được chỉ thì nằm giữa màn hình', () => {
        const place = placeTourCard(null, card, viewport);
        expect(place.side).toBe('center');
        expect(place.left).toBe(460);
        expect(place.top).toBe(290);
    });
});
