import { describe, expect, it } from 'vitest';
import type { BlogPost } from '../../types';
import { makeOutcomeExport, parseOutcomeResult, patchOutcomeBlogs, previewOutcomeResult, readOutcomeQuestions,
  reverseOutcomeChanges } from '../utils/outcomeExchange';

export function outcomeFixture(): BlogPost {
  const questions = [
    { type: 'trac_nghiem', question_no: 'Câu 1', question_text: 'Tính công $A=Fs$.', learning_outcomes: ['Yêu cầu cũ'],
      choices: ['1', '2', '3', '4'], correctChoice: 'A', solution: 'Lời giải', image_telegram_file_id: 'telegram-question',
      image_width: 45, image_layout: 'right', solution_images: [{ id: 's1', file_id: 'telegram-solution', width: 60 }] },
    { type: 'dung_sai', question_no: 'Câu 2', question_text: 'Đúng hay sai?', statements: [{ text: 'Công có đơn vị J', isCorrect: true }],
      question_images: [{ id: 'q2', file_id: 'image-2' }] },
    { type: 'tu_luan', question_no: 'Câu 3', question_text: 'Tính công suất', answer: '20', learning_outcomes: [] },
  ];
  return { id: 'post', title: 'Bài công', content: JSON.stringify({ type: 'physics_solution', data: { ...questions[0], questions } }),
    summary: 'Tóm tắt', cover_image: 'cover', category: 'Lời giải', tags: ['tag'], is_published: false,
    grade: 10, level: 2, studySection: { chapterId: 'g10-ch3', questionType: 'trac_nghiem', lessonId: 'lesson' },
    created_at: 'old', updated_at: 'old' };
}
const resultFor = (updates: unknown[]) => parseOutcomeResult(JSON.stringify({ schema: 'physivault.outcomes.update.v1',
  export_id: 'export', chapter_id: 'g10-ch3', updates }));
const update = (id = 'post:0') => ({ question_id: id, learning_outcomes: ['Tính được công của lực không đổi.'] });
const prepare = (blog = outcomeFixture()) => makeOutcomeExport([blog], [], 'g10-ch3', 'export');

describe('chapter outcome exchange', () => {
  it('exports all three types including drafts, excludes other chapters and reports unsupported posts', () => {
    const blog = outcomeFixture();
    const other = { ...blog, id: 'other', studySection: { ...blog.studySection!, chapterId: 'g10-ch4' } };
    const invalid = { ...blog, id: 'markdown', content: 'text' };
    const exported = makeOutcomeExport([blog, other, invalid], [], 'g10-ch3', 'export');
    expect(exported.file.question_count).toBe(3);
    expect(exported.file.questions.map(q => q.context.type)).toEqual(['trac_nghiem', 'dung_sai', 'tu_luan']);
    expect(exported.file.questions[0].is_published).toBe(false);
    expect(exported.skipped).toHaveLength(1);
    expect(exported.file.questions[0].context.image_telegram_file_id).toBe('telegram-question');
  });

  it('updates YCCĐ only and restores the exact JSON content, including absent outcomes and root mirror', () => {
    const blog = outcomeFixture();
    const original = JSON.parse(blog.content);
    delete original.data.learning_outcomes; // legacy root can differ from the first question
    blog.content = JSON.stringify(original);
    const { manifest } = prepare(blog);
    const preview = previewOutcomeResult([blog], manifest, resultFor([update(), update('post:1')]));
    expect(preview.errors).toEqual([]);
    expect(preview.omitted).toBe(1);
    const [patched] = patchOutcomeBlogs([blog], 'g10-ch3', preview.changes);
    const edited = JSON.parse(patched.content);
    const expected = structuredClone(original);
    expected.data.learning_outcomes = update().learning_outcomes;
    expected.data.questions[0].learning_outcomes = update().learning_outcomes;
    expected.data.questions[1].learning_outcomes = update().learning_outcomes;
    expect(edited).toEqual(expected);
    expect({ ...patched, content: blog.content, updated_at: blog.updated_at }).toEqual(blog);
    const [restored] = patchOutcomeBlogs([patched], 'g10-ch3', reverseOutcomeChanges(preview.changes));
    expect(JSON.parse(restored.content)).toEqual(original);
  });

  it('supports legacy single-question records without creating a questions array', () => {
    const blog = outcomeFixture();
    const doc = JSON.parse(blog.content); delete doc.data.questions;
    blog.content = JSON.stringify(doc);
    const { manifest } = prepare(blog);
    const preview = previewOutcomeResult([blog], manifest, resultFor([update()]));
    const [patched] = patchOutcomeBlogs([blog], 'g10-ch3', preview.changes);
    expect(JSON.parse(patched.content).data.questions).toBeUndefined();
    expect(readOutcomeQuestions(patched).questions[0].learning_outcomes).toEqual(update().learning_outcomes);
  });

  it.each(['duplicate', 'empty', 'extra', 'wrong-schema', 'non-string'])('rejects unsafe input: %s', mode => {
    const item: any = update();
    let items = [item];
    if (mode === 'duplicate') items = [item, item];
    if (mode === 'empty') item.learning_outcomes = [];
    if (mode === 'extra') item.image_url = 'overwrite';
    if (mode === 'non-string') item.learning_outcomes = [12];
    expect(() => mode === 'wrong-schema' ? parseOutcomeResult(JSON.stringify(prepare().file)) : resultFor(items)).toThrow();
  });

  it('blocks missing, foreign, reordered and changed questions instead of applying a partial batch', () => {
    const blog = outcomeFixture(); const { manifest } = prepare(blog);
    expect(previewOutcomeResult([blog], manifest, resultFor([update('other:0')])).errors).toHaveLength(1);
    expect(previewOutcomeResult([], manifest, resultFor([update()])).errors).toHaveLength(1);
    for (const mutate of [
      (doc: any) => { doc.data.questions.reverse(); },
      (doc: any) => { doc.data.questions[0].image_telegram_file_id = 'replaced'; },
      (doc: any) => { doc.data.questions[0].learning_outcomes = ['Newer manual edit']; },
    ]) {
      const doc = JSON.parse(blog.content); mutate(doc);
      const changed = { ...blog, content: JSON.stringify(doc) };
      expect(previewOutcomeResult([changed], manifest, resultFor([update(), update('post:1')])).errors.length).toBeGreaterThan(0);
      const preview = previewOutcomeResult([blog], manifest, resultFor([update(), update('post:1')]));
      expect(() => patchOutcomeBlogs([changed], 'g10-ch3', preview.changes)).toThrow();
    }
  });

  it('allows separate partial imports in the same post and never restores over a later edit', () => {
    const blog = outcomeFixture(); const { manifest } = prepare(blog);
    const first = previewOutcomeResult([blog], manifest, resultFor([update()]));
    const patched = patchOutcomeBlogs([blog], 'g10-ch3', first.changes);
    const second = previewOutcomeResult(patched, manifest, resultFor([update('post:1')]));
    expect(second.errors).toEqual([]);
    expect(previewOutcomeResult(patched, manifest, resultFor([update()])).errors).toHaveLength(1);
    const doc = JSON.parse(patched[0].content); doc.data.questions[0].learning_outcomes = ['Later change'];
    expect(() => patchOutcomeBlogs([{ ...patched[0], content: JSON.stringify(doc) }], 'g10-ch3', reverseOutcomeChanges(first.changes))).toThrow();
  });

  it('does not export embedded image data and does not modify the source image', () => {
    const blog = outcomeFixture(); const doc = JSON.parse(blog.content);
    doc.data.questions[0].image_url = 'data:image/png;base64,huge'; blog.content = JSON.stringify(doc);
    const exported = prepare(blog);
    expect(JSON.stringify(exported.file)).not.toContain('data:image/png');
    expect(blog.content).toContain('data:image/png');
  });
});
