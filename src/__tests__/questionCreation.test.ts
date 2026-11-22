import { describe, expect, it } from 'vitest';
import type { BlogPost, StudyLesson } from '../../types';
import { parseQuestionCreateFile, planQuestionCreate, undoQuestionCreate, type QuestionCreateBatch } from '../utils/questionCreation';
import { readOutcomeQuestions } from '../utils/outcomeExchange';

const tn = { type: 'trac_nghiem', question_text: 'Hiệu suất cho biết', choices: ['A1', 'B1', 'C1', 'D1'], correctChoice: 'B',
    cognitive_level: 1, solution: 'Chọn B.', spec_line: 'g10-ch3-27-B2', programme_row: 'g10-ch3-yc10a', programme_match: 'direct' };
const tl = { type: 'tu_luan', question_text: 'Tính nhiệt lượng.', cognitive_level: 3, solution: '$Q = 20$ J.', short_answer: '20', spec_line: 'g10-ch3-23-V1',
    image_svg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>', image_layout: 'bottom' };
const ds = { type: 'dung_sai', question_text: 'Một quạt điện.', solution: 'a) Đúng…', statements: 'abcd'.split('').map((label, index) =>
    ({ label, claim: 'Ý ' + label, verdict: index % 2 === 0, cognitive_level: index < 2 ? 1 : 2, ...(index < 2 ? { spec_line: 'g10-ch3-27-B1' } : {}) })) };
const file = (groups: unknown[], extra: Record<string, unknown> = {}) => JSON.stringify({ schema: 'physivault.questions.create.v1',
    chapter_id: 'g10-ch3', import_id: 'dot-1', source_note: 'Câu do AI hỗ trợ biên soạn', groups, ...extra });
const existingLesson: StudyLesson = { kind: 'study_lesson', id: 'L1', title: 'Câu bổ sung · Bài 27', grade: 10,
    studySection: { chapterId: 'g10-ch3', questionType: 'trac_nghiem' }, is_published: false };
const existingBlog: BlogPost = { id: 'B0', title: 'Câu bổ sung · Bài 27', summary: '', cover_image: '', category: 'Lời giải', tags: [],
    is_published: true, grade: 10, created_at: 'x', updated_at: 'x', studySection: { chapterId: 'g10-ch3', questionType: 'trac_nghiem', lessonId: 'L1' },
    content: JSON.stringify({ type: 'physics_solution', data: { questions: [{ type: 'trac_nghiem', question_no: 'Câu 1', question_text: 'Cũ' },
        { type: 'trac_nghiem', question_no: 'Câu 2', question_text: 'Cũ 2' }] } }) };

describe('new questions from JSON', () => {
    it('rejects incomplete questions with readable reasons', () => {
        expect(() => parseQuestionCreateFile(file([{ lesson_title: 'X', type: 'trac_nghiem', questions: [{ ...tn, correctChoice: 'E' }] }])))
            .toThrow('X · câu 1: thiếu đáp án đúng');
        expect(() => parseQuestionCreateFile(file([{ lesson_title: 'X', type: 'tu_luan', questions: [{ ...tl, short_answer: undefined }] }])))
            .toThrow('thiếu đáp số');
        expect(() => parseQuestionCreateFile(file([{ lesson_title: 'X', type: 'trac_nghiem', questions: [{ ...tn, cognitive_level: 2 }] }])))
            .toThrow('mức của dòng YCCĐ khác mức của câu');
        expect(() => parseQuestionCreateFile(file([{ lesson_title: 'X', type: 'dung_sai', questions: [{ ...ds, statements: ds.statements.slice(0, 3) }] }])))
            .toThrow('cần đủ 4 ý');
        expect(() => parseQuestionCreateFile(file([{ lesson_title: 'X', type: 'trac_nghiem', questions: [{ ...tn, extra: 1 }] }])))
            .toThrow('trường lạ: extra');
    });

    it('adds lessons and numbered questions, continues an existing lesson, and refuses the same file twice', () => {
        const parsed = parseQuestionCreateFile(file([
            { lesson_title: 'Câu bổ sung · Bài 27', type: 'trac_nghiem', questions: [tn, tn] },
            { lesson_title: 'Câu bổ sung · Bài 23', type: 'tu_luan', questions: [tl] },
            { lesson_title: 'Câu bổ sung · Bài 27', type: 'dung_sai', questions: [ds] },
        ]));
        let id = 0;
        const plan = planQuestionCreate([existingBlog, existingLesson], parsed, [], 'now', () => 'id' + ++id);
        expect(plan.groups.map(group => [group.title, group.type, group.newLesson, group.first])).toEqual([
            ['Câu bổ sung · Bài 27', 'trac_nghiem', false, 3], ['Câu bổ sung · Bài 23', 'tu_luan', true, 1], ['Câu bổ sung · Bài 27', 'dung_sai', true, 1]]);
        expect(plan.lessons.map(lesson => lesson.studySection.questionType)).toEqual(['tu_luan', 'dung_sai']);
        const [mc, short, tf] = plan.blogs.map(blog => readOutcomeQuestions(blog).questions);
        expect(mc.map(question => question.question_no)).toEqual(['Câu 3', 'Câu 4']);
        expect(mc[0]).toMatchObject({ correctChoice: 'B', cognitive_level: 1, spec_line: 'g10-ch3-27-B2', programme_row: 'g10-ch3-yc10a',
            source_note: 'Câu do AI hỗ trợ biên soạn', solutionSteps: [{ text: 'Chọn B.' }] });
        expect(short[0]).toMatchObject({ solution: '$Q = 20$ J.\nTrả lời ngắn: 20.', image_layout: 'bottom', cognitive_level: 3 });
        expect(tf[0].statements.map((item: { spec_line?: string; cognitive_level: number }) => [item.cognitive_level, item.spec_line]))
            .toEqual([[1, 'g10-ch3-27-B1'], [1, 'g10-ch3-27-B1'], [2, undefined], [2, undefined]]);
        expect(plan.blogs.every(blog => blog.is_published && blog.tags.includes('Câu do AI hỗ trợ biên soạn'))).toBe(true);
        const batch: QuestionCreateBatch = { id: 'b', import_id: 'dot-1', chapter_id: 'g10-ch3', created_at: 'now',
            blog_ids: plan.blogs.map(blog => blog.id), lesson_ids: plan.lessons.map(lesson => lesson.id), count: 4 };
        expect(() => planQuestionCreate([], parsed, [batch])).toThrow('đã được nạp');
        expect(() => planQuestionCreate([], parsed, [{ ...batch, undone_at: 'later' }])).not.toThrow();

        const records = [...plan.blogs, existingBlog, existingLesson, ...plan.lessons];
        const undone = undoQuestionCreate(records, batch);
        expect(undone.map(record => record.id).sort()).toEqual(['B0', 'L1']);
        expect(() => undoQuestionCreate(records.map(record => record.id === plan.blogs[0].id ? { ...record, updated_at: 'edited' } : record), batch))
            .toThrow('đã được sửa');
    });
});
