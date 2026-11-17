import { useEffect, useState } from 'react';
import { applyChapterCorrections, getCorrectionHistory, reviewChapterCorrections,
  reviewCorrectionUndo, undoChapterCorrections } from '../src/services/outcomeExchangeService';
import type { QuestionCorrection, QuestionCorrectionFile } from '../src/utils/questionCorrections';

const limit = 10 * 1024 * 1024;
const button = 'rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-stone-50 disabled:opacity-50';
const labels: Record<string, string> = { question_text: 'Đề bài', solution: 'Lời giải', correctChoice: 'Đáp án' };
type Review = { changes: QuestionCorrection[]; errors: string[]; input?: QuestionCorrectionFile; batchId?: string };
type Statement = { label: string; claim: string; verdict: boolean };
const describeStatement = (statement: Statement) => `${statement.claim}\nĐáp án: ${statement.verdict ? 'Đúng' : 'Sai'}`;

export function displayChanges(change: QuestionCorrection, undo: boolean) {
  return change.fields.flatMap(({ key, before, after }) => {
    const a = undo ? after.value : before.value;
    const b = undo ? before.value : after.value;
    if (key === 'choices') return (a as string[]).flatMap((text, i) => {
      const next = (b as string[])[i];
      return text === next ? [] : [{ label: `Phương án ${'ABCD'[i]}`, a: text, b: next }];
    });
    if (key === 'statements') return (a as Statement[]).flatMap((item, i) => {
      const next = (b as Statement[])[i];
      return item.claim === next.claim && item.verdict === next.verdict ? []
        : [{ label: `Mệnh đề ${item.label.toUpperCase()}`, a: describeStatement(item), b: describeStatement(next) }];
    });
    return labels[key] ? [{ label: labels[key], a: String(a ?? ''), b: String(b ?? '') }] : [];
  });
}

export default function ChapterQuestionCorrections({ chapterId, busy, run, onApplied }: {
  chapterId: string; busy: boolean;
  run: (task: () => Promise<void>) => Promise<void>;
  onApplied: (count: number, undone: boolean) => Promise<void>;
}) {
  const [text, setText] = useState('');
  const [review, setReview] = useState<Review>();
  const [history, setHistory] = useState<Awaited<ReturnType<typeof getCorrectionHistory>>>([]);
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => {
    let active = true;
    void run(async () => {
      const batches = await getCorrectionHistory(chapterId);
      if (active) setHistory(batches);
    });
    return () => { active = false; };
  }, [chapterId]);

  function resetReview() {
    setReview(undefined);
    setConfirmed(false);
  }

  const apply = () => run(async () => {
    if (!review || !confirmed || review.errors.length || !review.changes.length) return;
    if (review.batchId) await undoChapterCorrections(chapterId, review.batchId);
    else if (review.input) await applyChapterCorrections(chapterId, review.input);
    else return;
    resetReview();
    setText('');
    await onApplied(review.changes.length, !!review.batchId);
    setHistory(await getCorrectionHistory(chapterId));
  });

  return <div className="space-y-4">
    <section className="space-y-3 rounded-xl border bg-white p-4">
      <h3 className="font-bold">Nhập bản sửa nội dung câu</h3>
      <p className="text-sm text-stone-600">Chọn file sửa của lượt xuất trên trình duyệt này để xem đề, phương án, đáp án và lời giải trước và sau.</p>
      <input type="file" accept=".json,application/json" aria-label="Chọn file sửa nội dung" disabled={busy}
        className="block w-full text-sm" onChange={event => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          resetReview();
          setText('');
          void run(async () => {
            if (file.size > limit) throw new Error('File sửa nội dung tối đa 10 MB.');
            setText(await file.text());
          });
        }} />
      <textarea rows={5} aria-label="JSON sửa nội dung" placeholder="Hoặc dán JSON tại đây…" value={text}
        disabled={busy} className="w-full rounded-lg border border-stone-300 p-3 font-mono text-xs"
        onChange={event => { setText(event.target.value); resetReview(); }} />
      <button type="button" className={button} disabled={busy || !text.trim()} onClick={() => void run(async () => {
        resetReview();
        if (text.length > limit) throw new Error('File sửa nội dung tối đa 10 MB.');
        setReview(await reviewChapterCorrections(chapterId, text));
      })}>Kiểm tra và xem trước</button>
    </section>

    {!!history.length && <details className="rounded-xl border bg-white p-4">
      <summary className="cursor-pointer font-semibold">Lịch sử sửa nội dung trên trình duyệt này</summary>
      {history.map(batch => <div key={batch.id} className="flex flex-wrap items-center justify-between gap-2 border-t py-3 text-sm first:mt-3">
        <p>{batch.changes.length} câu · {new Date(batch.created_at).toLocaleString('vi-VN')}{batch.undone_at ? ' · Đã hoàn tác' : ''}</p>
        {!batch.undone_at && <button type="button" disabled={busy} className={button} onClick={() => void run(async () => {
          resetReview();
          setReview({ batchId: batch.id, changes: await reviewCorrectionUndo(chapterId, batch.id), errors: [] });
        })}>Xem trước hoàn tác</button>}
      </div>)}
    </details>}

    {review && <section className="space-y-3">
      <h3 className="font-bold">{review.batchId ? 'Xem trước hoàn tác' : 'Xem trước bản sửa'} · {review.changes.length} câu</h3>
      {!!review.errors.length && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
        <strong>Chưa thể áp dụng. Không câu nào được lưu khi còn lỗi.</strong>
        <ul className="mt-2 list-disc pl-4">{review.errors.map((message, index) => <li key={index}>{message}</li>)}</ul>
      </div>}
      {review.changes.map((change, index) => <details key={change.source.question_id} open={index === 0 || undefined}
        className="rounded-xl border bg-white p-4 text-sm">
        <summary className="cursor-pointer font-semibold">{change.source.lesson} · {change.source.label}</summary>
        {displayChanges(change, !!review.batchId).map(({ label, a, b }) => <div key={label} className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="min-w-0 rounded-lg bg-stone-50 p-3">
            <p className="font-semibold">{label} · Hiện tại</p><p className="whitespace-pre-wrap break-words">{a || 'Chưa có'}</p>
          </div>
          <div className="min-w-0 rounded-lg bg-emerald-50 p-3">
            <p className="font-semibold text-emerald-900">{label} · Sau khi {review.batchId ? 'hoàn tác' : 'sửa'}</p>
            <p className="whitespace-pre-wrap break-words">{b || 'Chưa có'}</p>
          </div>
        </div>)}
      </details>)}
      {!!review.changes.length && !review.errors.length && <div className="sticky bottom-0 space-y-3 rounded-xl border border-amber-200 bg-white p-4 shadow-sm">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)} className="mt-0.5" />
          Tôi đã rà thay đổi của {review.changes.length} câu.
        </label>
        <button type="button" className={button + ' !border-amber-800 !bg-amber-800 !text-white'} disabled={busy || !confirmed}
          onClick={() => void apply()}>{review.batchId ? 'Xác nhận hoàn tác' : 'Áp dụng bản sửa'}</button>
      </div>}
    </section>}
  </div>;
}
