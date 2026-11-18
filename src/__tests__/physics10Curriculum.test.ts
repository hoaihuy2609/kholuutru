import { describe, expect, it } from 'vitest';
import { curriculumRequirements, PHYSICS_10_REQUIREMENTS } from '../data/physics10Curriculum';
import { energyCurriculumGoals } from '../utils/energyCurriculum';
import { ENERGY_MATRIX_TOPICS } from '../utils/examMatrix';
import { STUDY_CHAPTERS } from '../utils/studyLibrary';

describe('physics 10 curriculum requirements', () => {
    it('holds all 69 grade-10 requirements with unique ids in known chapters', () => {
        expect(PHYSICS_10_REQUIREMENTS).toHaveLength(69);
        expect(new Set(PHYSICS_10_REQUIREMENTS.map(requirement => requirement.id)).size).toBe(69);
        const grade10 = new Set(STUDY_CHAPTERS.filter(chapter => chapter.grade === 10).map(chapter => chapter.id));
        expect(PHYSICS_10_REQUIREMENTS.every(requirement => grade10.has(requirement.chapterId))).toBe(true);
        expect(Object.fromEntries([...grade10].map(id => [id, curriculumRequirements(id).length]))).toEqual({
            'g10-ch0': 6, 'g10-ch1': 18, 'g10-ch2': 18, 'g10-ch3': 10, 'g10-ch4': 7, 'g10-ch5': 5, 'g10-ch6': 5,
        });
    });

    it('matches the chapter III goals word for word with the programme text', () => {
        const texts = new Set(curriculumRequirements('g10-ch3').map(requirement => requirement.text));
        const sources = new Set(ENERGY_MATRIX_TOPICS.flatMap(([topic]) => energyCurriculumGoals(topic).map(goal => goal.source)));
        expect([...sources].filter(source => !texts.has(source))).toEqual([]);
        expect([...texts].filter(text => !sources.has(text))).toEqual([]);
    });
});
