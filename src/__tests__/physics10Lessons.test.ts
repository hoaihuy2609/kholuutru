import { describe, expect, it } from 'vitest';
import { PHYSICS_10_REQUIREMENTS } from '../data/physics10Curriculum';
import { lessonRequirements, PHYSICS_10_LESSONS, textbookLessonFor, textbookLessons } from '../data/physics10Lessons';

describe('physics 10 textbook lessons', () => {
    it('lists the 34 KNTT lessons in order and links only to known requirements', () => {
        expect(PHYSICS_10_LESSONS.map(lesson => lesson.number)).toEqual(Array.from({ length: 34 }, (_, index) => index + 1));
        for (const lesson of PHYSICS_10_LESSONS) expect(lessonRequirements(lesson)).toHaveLength(lesson.requirements.length);
    });

    it('teaches every programme requirement in at least one lesson', () => {
        const taught = new Set(PHYSICS_10_LESSONS.flatMap(lesson => lesson.requirements));
        expect(PHYSICS_10_REQUIREMENTS.filter(requirement => !taught.has(requirement.id)).map(requirement => requirement.id)).toEqual([]);
    });

    it('maps the stored chapter III lesson titles onto the five textbook lessons', () => {
        const titles = ['BÀI 5: HIỆU SUẤT', 'BÀI 4.2: ĐỊNH LUẬT BẢO TOÀN CƠ NĂNG', 'BÀI 4.1: CƠ NĂNG', 'BÀI 3.2: THẾ NĂNG',
            'BÀI 3.1: ĐỘNG NĂNG', 'BÀI 2: CÔNG SUẤT', 'BÀI 1: NĂNG LƯỢNG VÀ CÔNG CƠ HỌC', 'BÀI 4.2: CON LẮC ĐƠN',
            'BÀI 4.1: CƠ NĂNG - ĐỊNH LUẬT BẢO TOÀN CƠ NĂNG', 'BÀI 4: THẾ NĂNG', 'BÀI 3: ĐỘNG NĂNG', 'BÀI 1.2: CÔNG CƠ HỌC', 'BÀI 1.1: NĂNG LƯỢNG'];
        const numbers = new Set(titles.map(title => textbookLessonFor('g10-ch3', title)?.number));
        expect([...numbers].sort()).toEqual([23, 24, 25, 26, 27]);
        expect(textbookLessonFor('g10-ch3', 'Bài 24. Công suất')?.number).toBe(24);
        expect(textbookLessonFor('g10-ch1', 'BÀI 2: CÔNG SUẤT')).toBeUndefined();
        expect(textbookLessons('g10-ch5').map(lesson => lesson.number)).toEqual([31, 32]);
    });
});
