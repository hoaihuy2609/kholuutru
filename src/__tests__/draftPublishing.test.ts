import { describe, expect, it } from 'vitest';
import type { BlogPost, StudyLesson } from '../../types';
import { chapterDrafts, setPublished } from '../utils/draftPublishing';

const blog = (id: string, published: boolean, chapterId = 'g10-ch3', extra: object = {}): BlogPost => ({ id, title: 'BÀI ' + id, summary: '', cover_image: '',
    category: 'Lời giải', tags: [], is_published: published, grade: 10, created_at: 'x', updated_at: 'x',
    studySection: { chapterId, questionType: 'trac_nghiem', lessonId: 'L' },
    content: JSON.stringify({ type: 'physics_solution', data: { questions: [{ type: 'trac_nghiem', question_text: 'a' }, { type: 'trac_nghiem', question_text: 'b' }] } }), ...extra });
const lesson: StudyLesson = { kind: 'study_lesson', id: 'L', title: 'L', grade: 10, studySection: { chapterId: 'g10-ch3', questionType: 'trac_nghiem' }, is_published: false };

describe('publishing chapter drafts', () => {
    it('lists only draft question posts of the chapter, flags uploads, and toggles them both ways', () => {
        const records = [blog('a', false), blog('b', true), blog('c', false, 'g10-ch2'), blog('d', false, 'g10-ch3', { pendingImages: {} }), lesson];
        expect(chapterDrafts(records, 'g10-ch3').map(draft => [draft.id, draft.count, draft.pendingImages])).toEqual([['a', 2, false], ['d', 2, true]]);
        const published = setPublished(records, new Set(['a']), true, 'now');
        expect(published.find(record => record.id === 'a')).toMatchObject({ is_published: true, updated_at: 'now' });
        expect(published.find(record => record.id === 'L')).toBe(lesson);
        expect(setPublished(published, new Set(['a']), false, 'later').find(record => record.id === 'a')).toMatchObject({ is_published: false });
    });
});
