/**
 * Điểm mỗi câu theo từng ô (dạng × mức) của ma trận. Mỗi câu Đúng/Sai 1 điểm (quy định của Bộ GD&ĐT);
 * thang điểm còn lại chia cho các dạng khác thành số tròn 0,25, mỗi ô một mức điểm. Phần dư được cộng thêm
 * từng 0,25 cho cả ô, ưu tiên ô Vận dụng rồi Thông hiểu, sao cho tổng sát thang điểm nhất mà không vượt.
 */

export const TRUE_FALSE_POINTS = 1;
export const POINT_STEP = 0.25;

export interface PointColumn { key: string; type: string; level: number; count: number }

const round = (value: number) => Math.round(value * 10000) / 10000;

export function splitColumnPoints(columns: readonly PointColumn[], scale: number): Record<string, number> {
    const others = columns.filter(column => column.type !== 'dung_sai' && column.count > 0);
    const trueFalse = columns.filter(column => column.type === 'dung_sai').reduce((sum, column) => sum + column.count, 0);
    const questions = others.reduce((sum, column) => sum + column.count, 0);
    if (!questions) return {};
    const remaining = scale - trueFalse * TRUE_FALSE_POINTS;
    const base = Math.max(POINT_STEP, Math.floor(remaining / questions / POINT_STEP + 1e-9) * POINT_STEP);
    const steps = Math.max(0, Math.floor((remaining - base * questions) / POINT_STEP + 1e-9));
    // Chọn số bước 0,25 cộng thêm cho mỗi ô: tổng bước (tính theo số câu) lớn nhất không vượt `steps`,
    // rồi ít "chi phí" nhất (cộng cho ô Biết đắt hơn ô Hiểu, ô Hiểu đắt hơn ô Vận dụng).
    const cost = (level: number) => level === 3 ? 1 : level === 2 ? 2 : 3;
    let best: { cost: number; picks: number[] }[] = Array.from({ length: steps + 1 }, () => ({ cost: Infinity, picks: [] }));
    best[0] = { cost: 0, picks: [] };
    for (const column of others) {
        const next = best.map(() => ({ cost: Infinity, picks: [] as number[] }));
        for (let total = 0; total <= steps; total++) {
            if (best[total].cost === Infinity) continue;
            for (let extra = 0; total + extra * column.count <= steps && extra <= 8; extra++) {
                const reach = total + extra * column.count;
                // Ưu tiên cộng ít bước cho nhiều ô hơn là dồn nhiều bước vào một ô.
                const value = best[total].cost + extra * column.count * cost(column.level) + extra * extra * 2;
                if (value < next[reach].cost) next[reach] = { cost: value, picks: [...best[total].picks, extra] };
            }
        }
        best = next;
    }
    let reach = steps;
    while (reach > 0 && best[reach].cost === Infinity) reach--;
    const picks = best[reach].picks;
    return Object.fromEntries(others.map((column, index) => [column.key, round(base + (picks[index] ?? 0) * POINT_STEP)]));
}
