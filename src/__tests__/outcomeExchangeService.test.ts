import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BlogPost } from '../../types';

const state = vi.hoisted(() => ({
  db: new Map<string, any>(), loaded: true, failCommit: false,
  sync: vi.fn(), beforeTransaction: undefined as (() => void) | undefined,
}));
vi.mock('../lib/db', () => ({
  dbGet: async (key: string) => structuredClone(state.db.get(key)),
  dbUpdate: async (key: string, updater: (value: any) => any) => state.db.set(key, updater(structuredClone(state.db.get(key)))),
  dbUpdateBatch: async (keys: string[], updater: (values: Record<string, any>) => Record<string, any>) => {
    state.beforeTransaction?.();
    const next = updater(Object.fromEntries(keys.map(key => [key, structuredClone(state.db.get(key))])));
    if (state.failCommit) throw new Error('Disk quota exceeded');
    for (const [key, value] of Object.entries(next)) state.db.set(key, value);
  },
}));
vi.mock('../services/blogService', () => ({
  fetchBlogsForEditing: async () => ({ loaded: state.loaded }),
  getStudyLibrary: async () => ({ blogs: structuredClone(state.db.get('physivault_blogs_local') ?? []).filter((r: any) => !r.kind), lessons: [] }),
  syncBlogs: state.sync,
}));
import { applyChapterOutcomes, exportChapterOutcomes, getOutcomeHistory, reviewChapterOutcomes,
  reviewOutcomeUndo, undoChapterOutcomes, OUTCOME_SYNC_KEY } from '../services/outcomeExchangeService';

const KEY = 'physivault_blogs_local';
const chapter = 'g10-ch3';
const fixture = (): BlogPost => ({ id: 'post', title: 'Bài công', summary: '', cover_image: 'cover', tags: [],
  grade: 10, level: 2, category: 'Lời giải', is_published: true, created_at: 'old', updated_at: 'old',
  studySection: { chapterId: chapter, questionType: 'trac_nghiem' },
  content: JSON.stringify({ type: 'physics_solution', data: {
    type: 'trac_nghiem', question_text: 'Tính công', choices: ['1', '2', '3', '4'], correctChoice: 'A',
    image_telegram_file_id: 'original-image', solution: 'Lời giải', learning_outcomes: ['Cũ'],
  } }),
});
async function prepare() {
  const exported = await exportChapterOutcomes(chapter);
  const text = JSON.stringify({ schema: 'physivault.outcomes.update.v1', export_id: exported.manifest.export_id,
    chapter_id: chapter, updates: [{ question_id: 'post:0', learning_outcomes: ['Tính được công.'] }] });
  return { exported, text, review: await reviewChapterOutcomes(chapter, text) };
}

describe('outcome exchange transactions', () => {
  beforeEach(() => {
    state.db.clear(); state.loaded = true; state.failCommit = false; state.beforeTransaction = undefined;
    state.sync.mockReset().mockResolvedValue({ success: true });
    state.db.set(KEY, [fixture(), { id: 'lesson', kind: 'study_lesson', title: 'Bài công' }]);
  });

  it('export and preview never change source records or schedule publication', async () => {
    const original = structuredClone(state.db.get(KEY));
    const { exported, review } = await prepare();
    expect(exported.manifest.sources).toHaveLength(1);
    expect(review.preview.changes).toHaveLength(1);
    expect(state.db.get(KEY)).toEqual(original);
    expect(state.sync).not.toHaveBeenCalled();
  });

  it('commits patch, backup and durable pending marker together; supports reload and guarded undo', async () => {
    const original = structuredClone(state.db.get(KEY));
    const { review } = await prepare();
    const batch = await applyChapterOutcomes(chapter, review.result);
    expect(state.db.get(OUTCOME_SYNC_KEY)).toBe(batch.id);
    expect(await getOutcomeHistory(chapter)).toEqual([batch]);
    expect(state.sync).toHaveBeenCalledTimes(1);
    const current = state.db.get(KEY);
    expect(current[1]).toEqual(original[1]);
    expect(JSON.parse(current[0].content).data.image_telegram_file_id).toBe('original-image');
    expect(JSON.parse(current[0].content).data.learning_outcomes).toEqual(['Tính được công.']);
    expect((await reviewOutcomeUndo(chapter, batch.id)).errors).toEqual([]);
    await undoChapterOutcomes(chapter, batch.id);
    expect(JSON.parse(state.db.get(KEY)[0].content)).toEqual(JSON.parse(original[0].content));
    expect((await getOutcomeHistory(chapter))[0].undone_at).toBeTruthy();
    await expect(undoChapterOutcomes(chapter, batch.id)).rejects.toThrow();
  });

  it('writes nothing when committing the journal fails', async () => {
    const { review } = await prepare();
    const original = structuredClone(state.db.get(KEY));
    state.failCommit = true;
    await expect(applyChapterOutcomes(chapter, review.result)).rejects.toThrow('Disk quota');
    expect(state.db.get(KEY)).toEqual(original);
    expect(await getOutcomeHistory(chapter)).toEqual([]);
    expect(state.db.get(OUTCOME_SYNC_KEY)).toBeUndefined();
    expect(state.sync).not.toHaveBeenCalled();
  });

  it('revalidates changes inside the write transaction after a successful preview', async () => {
    const { review } = await prepare();
    state.beforeTransaction = () => {
      const records = state.db.get(KEY); const doc = JSON.parse(records[0].content);
      doc.data.solution = 'Lời giải vừa sửa'; records[0].content = JSON.stringify(doc);
    };
    await expect(applyChapterOutcomes(chapter, review.result)).rejects.toThrow('đã đổi');
    expect(JSON.parse(state.db.get(KEY)[0].content).data.learning_outcomes).toEqual(['Cũ']);
    expect(await getOutcomeHistory(chapter)).toEqual([]);
    expect(state.sync).not.toHaveBeenCalled();
  });

  it('blocks unfamiliar exports, other chapters, partial invalid batches and outdated cached libraries', async () => {
    const { review } = await prepare();
    await expect(applyChapterOutcomes('g10-ch4', review.result)).rejects.toThrow('chương khác');
    await expect(applyChapterOutcomes(chapter, { ...review.result, export_id: 'unknown' })).rejects.toThrow('bản đối chiếu');
    await expect(applyChapterOutcomes(chapter, { ...review.result, updates: [...review.result.updates,
      { question_id: 'unknown', learning_outcomes: ['Mới'] }] })).rejects.toThrow('không có');
    expect(JSON.parse(state.db.get(KEY)[0].content).data.learning_outcomes).toEqual(['Cũ']);
    state.loaded = false;
    await expect(exportChapterOutcomes(chapter)).rejects.toThrow('bản kho mới nhất');
    await expect(applyChapterOutcomes(chapter, review.result)).rejects.toThrow('bản kho mới nhất');
    expect(state.sync).not.toHaveBeenCalled();
  });
});
