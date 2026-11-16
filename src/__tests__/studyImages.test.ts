import { describe, expect, it, vi } from 'vitest';
import { layoutStudySolutionImages, matchStudyImageFiles, readStudyImages, studyImageParts, studyImageSrc } from '../utils/studyImages';

vi.mock('../lib/telegram', () => ({ CLOUDFLARE_PROXY_URL: 'https://telegram.test' }));

describe('study question images', () => {
    it('ghép đúng mã gốc và để trống khi tên file hoặc mã vị trí bị trùng', () => {
        const stem = new File(['png'], 'P1_C04_H01.PNG', { type: 'image/png' });
        const solution = new File(['jpeg'], 'p1_c04_lg01.JPG', { type: 'image/jpeg' });
        const duplicate = new File(['png'], 'p1_c04_h01.png', { type: 'image/png' });
        const targets = [{ id: 'stem', key: 'p1_c04_h01' }, { id: 'solution', key: 'p1_c04_lg01' }];
        expect(matchStudyImageFiles([stem, solution], targets).map(entry => entry.targetId)).toEqual(['stem', 'solution']);
        expect(matchStudyImageFiles([stem, duplicate], targets).map(entry => entry.targetId)).toEqual(['', '']);
        expect(matchStudyImageFiles([stem], [...targets, { ...targets[0], id: 'another' }])[0].targetId).toBe('');
    });

    it('giữ mã chờ ảnh và chèn ảnh đúng vị trí trong lời giải', () => {
        const images = readStudyImages([{ key: 'p2_c04_lg01', file_id: 'telegram/image' }, { url: '/extra.png' }],
            ['P2_C04_LG01.PNG', 'p2_c04_lg02']);
        expect(images).toHaveLength(3);
        expect(studyImageParts('Phân tích lực\n[image:P2_C04_LG01]\nKết luận', images)).toEqual([
            'Phân tích lực\n', images[0], '\nKết luận', images[1],
        ]);
        expect(studyImageSrc(images[0])).toBe('https://telegram.test/getFile/telegram%2Fimage');
        expect(studyImageParts('[image:p2_c04_lg02]', images)).toContain('[image:p2_c04_lg02]');
    });

    it('giữ dữ liệu TikZ, kích thước và bố cục, đồng thời ưu tiên vị trí chèn trong lời giải', () => {
        const images = readStudyImages([
            { key: 'force', svg: '<svg/>', tikz: '\\draw;', width: 40, layout: 'right' },
            { url: '/bottom.png', layout: 'bottom' },
            { key: 'inline', url: '/inline.png', layout: 'right' },
        ]);
        expect(images[0]).toMatchObject({ tikz: '\\draw;', width: 40, layout: 'right' });
        expect(studyImageSrc(images[0])).toBe('data:image/svg+xml,%3Csvg%2F%3E');
        const { body, sideImages } = layoutStudySolutionImages('Phân tích lực\n[image:inline]\nKết luận', images);
        expect(sideImages).toEqual([images[0]]);
        expect(body).toEqual(['Phân tích lực\n', images[2], '\nKết luận', images[1]]);
        expect(layoutStudySolutionImages('', images).sideImages).toEqual([]);
    });
});
