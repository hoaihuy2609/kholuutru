import { describe, expect, it } from 'vitest';
import type { BlogPost } from '../../types';
import { makeOutcomeExport, readOutcomeQuestions } from '../utils/outcomeExchange';
import { parseCognitiveResult, previewCognitiveResult } from '../utils/cognitiveExchange';
import { patchQuestionCorrections, previewQuestionCorrections } from '../utils/questionCorrections';
import { questionLevel, questionLevels, readCognitiveLevel } from '../utils/cognitiveLevels';
import { matrixMatch, matrixSlots, type MatrixRow } from '../utils/examMatrix';

const chapter = 'g10-ch3';
const q = { type: 'dung_sai', question_no: 'Câu 1', question_text: 'Một vật rơi tự do.',
  question_images: [{ key: 'h1', file_id: 'image' }], solution_images: [{ file_id: 'solution-image' }],
  statements: 'abcd'.split('').map(label => ({ label, claim: label, verdict: true, steps: [] })),
  learning_outcomes: ['YCCĐ mới đã nhập'], solution: 'Lời giải' };
function fixture(): BlogPost {
  return { id: 'post', title: 'Bài công', grade: 10, level: 2, category: 'Lời giải', summary: '', cover_image: '',
    tags: [], is_published: true, created_at: 'old', updated_at: 'old',
    studySection: { chapterId: chapter, questionType: 'dung_sai' },
    content: JSON.stringify({ type: 'physics_solution', data: { ...q, questions: [q, { ...q, question_no: 'Câu 2' }] } }) };
}

describe('per-question cognitive levels', () => {
  it('uses explicit statement levels, preserves unclassified choices and normalizes legacy level 4', () => {
    expect(readCognitiveLevel(4)).toBe(3);
    expect(questionLevel({ type: 'tu_luan', cognitive_level: 1 }, 2)).toBe(1);
    expect(questionLevel({ type: 'tu_luan' }, 4)).toBe(3);
    expect(questionLevels({ type: 'dung_sai', statements: [{}, { cognitive_level: 0 }, { cognitive_level: 3 }] }, 2)).toEqual([2, 0, 3]);
    expect(questionLevel({ type: 'dung_sai', statements: [{ cognitive_level: 1 }, { cognitive_level: 2 }] }, 2)).toBe(0);
  });

  it('advances only verified content history and patches statements with a complete rollback', () => {
    const blogs = [fixture()];
    const { manifest } = makeOutcomeExport(blogs, [], chapter, 'exp');
    const patch = { schema: 'physivault.questions.update.v1' as const, export_id: 'exp', chapter_id: chapter,
      updates: [{ question_id: 'post:0', set: { question_text: 'Một vật rơi tự do từ nghỉ.' } }] };
    const prior = previewQuestionCorrections(blogs, manifest, patch).changes;
    const current = patchQuestionCorrections(blogs, chapter, prior);
    const result = parseCognitiveResult(JSON.stringify({ schema: 'physivault.cognitive.update.v1', export_id: 'exp', chapter_id: chapter,
      updates: [{ question_id: 'post:0', statement_levels: [1, 2, 2, 3] }] }));
    expect(previewCognitiveResult(current, manifest, result, []).errors).toHaveLength(1);
    const history = [{ export_id: 'exp', chapter_id: chapter, created_at: '2026-11-18', changes: prior }];
    const preview = previewCognitiveResult(current, manifest, result, history);
    expect(preview.errors).toEqual([]);
    const edited = patchQuestionCorrections(current, chapter, preview.changes);
    const parsed = readOutcomeQuestions(edited[0]);
    expect(parsed.questions[0].statements.map((s: any) => s.cognitive_level)).toEqual([1, 2, 2, 3]);
    expect(parsed.document.data.statements).toEqual(parsed.questions[0].statements);
    expect(parsed.questions[0]).toMatchObject({ question_images: q.question_images,
      solution_images: q.solution_images, solution: q.solution, learning_outcomes: q.learning_outcomes });
    expect(parsed.questions[1]).toEqual(readOutcomeQuestions(current[0]).questions[1]);
    expect(previewCognitiveResult(edited, manifest, result, history).changes).toEqual([]);
    const restored = patchQuestionCorrections(edited, chapter, preview.changes, true);
    expect(JSON.parse(restored[0].content)).toEqual(JSON.parse(current[0].content));
    const changed = structuredClone(edited);
    const doc = JSON.parse(changed[0].content);
    doc.data.questions[0].statements[0].cognitive_level = 3;
    changed[0].content = JSON.stringify(doc);
    expect(() => patchQuestionCorrections(changed, chapter, preview.changes, true)).toThrow('thay đổi');
  });

  it('stores the programme row on corrected questions without levels, mirrors the root and keeps the export valid', () => {
    const blogs = [fixture()];
    const { manifest } = makeOutcomeExport(blogs, [], chapter, 'exp');
    const patch = { schema: 'physivault.questions.update.v1' as const, export_id: 'exp', chapter_id: chapter,
      updates: [{ question_id: 'post:0', set: { question_text: 'Một vật rơi tự do từ nghỉ.' } }] };
    const prior = previewQuestionCorrections(blogs, manifest, patch).changes;
    const current = patchQuestionCorrections(blogs, chapter, prior);
    const history = [{ export_id: 'exp', chapter_id: chapter, created_at: '2026-11-18', changes: prior }];
    const result = parseCognitiveResult(JSON.stringify({ schema: 'physivault.cognitive.update.v1', export_id: 'exp', chapter_id: chapter,
      updates: [{ question_id: 'post:0', programme_row: 'g10-ch3-yc07b', programme_match: 'direct' },
        { question_id: 'post:1', programme_row: 'g10-ch3-yc01', programme_match: 'extended' }] }));
    const preview = previewCognitiveResult(current, manifest, result, history);
    expect(preview.errors).toEqual([]);
    expect(preview.changes).toHaveLength(2);
    const edited = patchQuestionCorrections(current, chapter, preview.changes);
    const parsed = readOutcomeQuestions(edited[0]);
    expect(parsed.questions[0]).toMatchObject({ programme_row: 'g10-ch3-yc07b', programme_match: 'direct' });
    expect(parsed.questions[0].statements).toEqual(q.statements);
    expect(parsed.document.data.programme_row).toBe('g10-ch3-yc07b');
    expect(parsed.questions[1]).toMatchObject({ programme_row: 'g10-ch3-yc01', programme_match: 'extended' });
    // Classification fields do not count as content: a later import against the same export still applies.
    expect(previewCognitiveResult(edited, manifest, result, history)).toMatchObject({ errors: [], changes: [], unchanged: 2 });
  });

  it('rejects programme rows of another chapter, unknown rows and rows without a match', () => {
    const packet = (update: Record<string, unknown>) => JSON.stringify({ schema: 'physivault.cognitive.update.v1',
      export_id: 'exp', chapter_id: chapter, updates: [{ question_id: 'post:0', ...update }] });
    expect(() => parseCognitiveResult(packet({ programme_row: 'g10-ch3-yc03' , programme_match: 'direct' }))).toThrow();
    expect(() => parseCognitiveResult(packet({ programme_row: 'g10-ch3-yc03b' }))).toThrow();
    expect(() => parseCognitiveResult(packet({ programme_row: 'g10-ch3-yc03b', programme_match: 'close' }))).toThrow();
    expect(() => parseCognitiveResult(packet({}))).toThrow();
    expect(() => parseCognitiveResult(packet({ cognitive_level: 1, statement_levels: [1, 1, 1, 1] }))).toThrow();
    expect(parseCognitiveResult(packet({ programme_row: 'g10-ch3-yc03b', programme_match: 'direct' })).updates).toHaveLength(1);
  });

  it('rejects malformed level packets including duplicated question IDs and incomplete statement arrays', () => {
    const input = { schema: 'physivault.cognitive.update.v1', chapter_id: chapter, export_id: 'exp',
      updates: [{ question_id: 'post:0', statement_levels: [1, 2, 3] }] };
    expect(() => parseCognitiveResult(JSON.stringify(input))).toThrow();
    input.updates[0].statement_levels.push(4);
    expect(() => parseCognitiveResult(JSON.stringify(input))).toThrow();
    input.updates[0].statement_levels[3] = 3;
    input.updates.push(input.updates[0]);
    expect(() => parseCognitiveResult(JSON.stringify(input))).toThrow();
  });

  it('matches per-statement references from imported specifications at their actual levels', () => {
    const first: MatrixRow = { section: 'II', topic: 'Công', outcome: 'Tính công', type: 'dung_sai', level: 1,
      count: 1, countUnit: 'statement', references: ['C1a'] };
    const second = { ...first, level: 3, references: ['C1d'] };
    const candidate = { type: 'dung_sai' as const, level: 0, outcomes: ['Tính công'],
      statements: 'abcd'.split('').map((label, i) => ({ label, cognitive_level: [1, 2, 2, 3][i] })) };
    expect(matrixMatch([first, second], candidate).score).toBe(1);
    expect(matrixMatch([{ ...first, level: 2 }, second], candidate).score).toBe(0);
  });

  it('restricts each imported specification slot to its own question references', () => {
    const row: MatrixRow = { section: 'II', topic: 'Công', outcome: 'Tính công', type: 'dung_sai',
      level: 1, countUnit: 'statement', count: 4, references: ['C1a', 'C1b', 'C2c', 'C2d'] };
    const other = { ...row, level: 3, references: ['C1c', 'C1d', 'C2a', 'C2b'] };
    const { slots } = matrixSlots([row, other]);
    expect(slots).toHaveLength(2);
    const candidate = { type: 'dung_sai' as const, level: 0, outcomes: ['Tính công'],
      statements: 'abcd'.split('').map((label, i) => ({ label, cognitive_level: [1, 1, 3, 3][i] })) };
    expect(matrixMatch(slots[0].rows, candidate).score).toBe(1);
    expect(matrixMatch(slots[1].rows, candidate).score).toBe(0);
    expect(row.references).toEqual(['C1a', 'C1b', 'C2c', 'C2d']);
  });
});
