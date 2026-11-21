import { useEffect, useState } from 'react';
import { applyChapterCognitive, getCognitiveHistory, reviewChapterCognitive, undoChapterCognitive } from '../src/services/outcomeExchangeService';
import { COGNITIVE_LEVELS, questionLevelLabel } from '../src/utils/cognitiveLevels';
import { PROGRAMME_MATCH_LABELS, programmeRow, programmeRowLabel, readProgrammeMatch } from '../src/data/programmeRows';
import { lessonLine, lessonLineLabel } from '../src/data/lessonLines';

const button = 'rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-stone-50 disabled:opacity-50';
const limit = 10 * 1024 * 1024;

export default function ChapterCognitiveExchange({ chapterId, busy, run, onApplied, initialText = '' }: {
  chapterId: string; busy: boolean; run: (task: () => Promise<void>) => Promise<void>;
  onApplied: (count: number) => Promise<void>;
  /** Update prepared elsewhere (the level review), shown ready to check. */
  initialText?: string;
}) {
  const [text, setText] = useState(initialText);
  const [review, setReview] = useState<Awaited<ReturnType<typeof reviewChapterCognitive>>>();
  const [history, setHistory] = useState<Awaited<ReturnType<typeof getCognitiveHistory>>>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [undoId, setUndoId] = useState('');
  useEffect(() => {
    let active = true;
    void run(async () => { const batches = await getCognitiveHistory(chapterId); if (active) setHistory(batches); });
    return () => { active = false; };
  }, [chapterId]);
  const reset = () => { setReview(undefined); setConfirmed(false); setUndoId(''); };

  return <section className="space-y-4">
    <div className="space-y-3 rounded-xl border bg-white p-4">
      <h3 className="font-bold">Nhập mức độ theo câu và mệnh đề</h3>
      <p className="text-sm text-stone-600">Nhận biết · Thông hiểu · Vận dụng. Câu Đúng/Sai lưu riêng mức độ của a, b, c, d. File này cũng dùng để gắn câu vào dòng YCCĐ chương trình của bản đặc tả.</p>
      <input type="file" accept=".json,application/json" disabled={busy} aria-label="Chọn JSON mức độ"
        onChange={event => {
          const file = event.target.files?.[0]; event.target.value = '';
          if (!file) return;
          reset(); setText('');
          void run(async () => {
            if (file.size > limit) throw new Error('File tối đa 10 MB.');
            setText(await file.text());
          });
        }} />
      <textarea rows={6} className="w-full rounded-lg border border-stone-300 p-3 font-mono text-xs"
        aria-label="JSON mức độ" placeholder="Hoặc dán JSON mức độ tại đây…" value={text} disabled={busy}
        onChange={event => { reset(); setText(event.target.value); }} />
      <button type="button" className={button} disabled={busy || !text.trim()} onClick={() => void run(async () => {
        reset();
        if (text.length > limit) throw new Error('File tối đa 10 MB.');
        setReview(await reviewChapterCognitive(chapterId, text));
      })}>Kiểm tra và xem trước mức độ</button>
    </div>
    {review && <div className="space-y-3">
      <p className="font-semibold">{review.preview.changes.length} câu thay đổi · {review.preview.unchanged} câu đã khớp</p>
      {!!review.preview.errors.length && <ul role="alert" className="list-disc rounded-lg bg-red-50 p-4 pl-8 text-sm text-red-900">
        {review.preview.errors.map((error, index) => <li key={index}>{error}</li>)}
      </ul>}
      {review.preview.changes.map(change => <article key={change.source.question_id} className="space-y-2 rounded-xl border bg-white p-3 text-sm">
        <h4 className="font-semibold">{change.source.lesson} · {change.source.label}</h4>
        <p className="line-clamp-2 text-stone-500">{change.source.text}</p>
        {change.fields.map(field => {
          if (field.key === 'statements') return <div key={field.key} className="flex flex-wrap gap-2">
            {(field.after.value as { label: string; cognitive_level?: number; spec_line?: string }[]).map((statement, index) => {
              const before = (field.before.value as { cognitive_level?: number; spec_line?: string }[])[index];
              const line = lessonLine(statement.spec_line);
              return <span key={statement.label} className="rounded bg-blue-50 px-2 py-1 text-blue-950">
                {statement.label}) {before.cognitive_level === statement.cognitive_level ? COGNITIVE_LEVELS[statement.cognitive_level ?? 0]
                  : COGNITIVE_LEVELS[before.cognitive_level ?? 0] + ' → ' + COGNITIVE_LEVELS[statement.cognitive_level ?? 0]}
                {before.spec_line !== statement.spec_line && <span className="block text-xs text-blue-900">{line ? lessonLineLabel(line) : 'chưa có dòng YCCĐ'}</span>}
              </span>;
            })}
          </div>;
          if (field.key === 'spec_line') {
            const line = lessonLine(field.after.value);
            return <p key={field.key}><span className="font-semibold">Dòng YCCĐ: </span>{line ? lessonLineLabel(line) : String(field.after.value)}</p>;
          }
          if (field.key === 'programme_row') {
            const row = programmeRow(field.after.value);
            const before = programmeRow(field.before.value);
            return <p key={field.key}><span className="font-semibold">YCCĐ chương trình: </span>
              {before ? programmeRowLabel(before) + ' → ' : ''}{row ? programmeRowLabel(row) + ' · ' + row.text : String(field.after.value)}</p>;
          }
          if (field.key === 'programme_match') {
            const match = readProgrammeMatch(field.after.value);
            return <p key={field.key} className="text-stone-600">Mức khớp: {match ? PROGRAMME_MATCH_LABELS[match] : String(field.after.value)}</p>;
          }
          if (field.key === 'learning_outcomes') return <ul key={field.key} className="list-disc pl-4">
            {(field.after.value as string[]).map(outcome => <li key={outcome}>{outcome}</li>)}
          </ul>;
          return <p key={field.key}>{COGNITIVE_LEVELS[Number(field.before.value) || 0]} → {COGNITIVE_LEVELS[Number(field.after.value)]}</p>;
        })}
      </article>)}
      {!!review.preview.changes.length && !review.preview.errors.length && <div className="sticky bottom-0 space-y-3 rounded-xl border bg-white p-4 shadow-sm">
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={confirmed} disabled={busy}
          onChange={event => setConfirmed(event.target.checked)} />Tôi đã rà các thay đổi của những câu hiển thị.</label>
        <button type="button" className={button + ' !bg-amber-800 !text-white'} disabled={busy || !confirmed}
          onClick={() => void run(async () => {
            const count = review.preview.changes.length;
            await applyChapterCognitive(chapterId, review.result, review.preview.changes);
            reset(); setText('');
            await onApplied(count);
            setHistory(await getCognitiveHistory(chapterId));
          })}>Áp dụng mức độ</button>
      </div>}
    </div>}
    {!!history.length && <details className="rounded-xl border bg-white p-4">
      <summary className="cursor-pointer font-semibold">Lịch sử mức độ</summary>
      {history.map(batch => <div key={batch.id} className="mt-3 space-y-2 border-t pt-3 text-sm">
        <p>{batch.changes.length} câu · {new Date(batch.created_at).toLocaleString('vi-VN')}{batch.undone_at ? ' · Đã hoàn tác' : ''}</p>
        {!batch.undone_at && <button type="button" className={button} disabled={busy}
          onClick={() => { reset(); setUndoId(batch.id); }}>Xem trước hoàn tác</button>}
        {undoId === batch.id && <div className="space-y-2 rounded-lg bg-amber-50 p-3">
          {batch.changes.map(change => <p key={change.source.question_id}>
            {change.source.lesson} · {change.source.label}
            {change.fields.filter(field => field.key === 'cognitive_level').map(field =>
              ' · ' + COGNITIVE_LEVELS[Number(field.after.value)] + ' → ' + COGNITIVE_LEVELS[Number(field.before.value) || 0])}
            {change.fields.filter(field => field.key === 'statements').map(field =>
              ' · ' + (field.before.value as { label: string; cognitive_level?: number }[]).map(statement =>
                statement.label + ') ' + questionLevelLabel({ cognitive_level: statement.cognitive_level })).join(' · '))}
          </p>)}
          <button type="button" disabled={busy} className={button} onClick={() => void run(async () => {
            await undoChapterCognitive(chapterId, batch.id);
            reset();
            await onApplied(batch.changes.length);
            setHistory(await getCognitiveHistory(chapterId));
          })}>Xác nhận hoàn tác mức độ</button>
        </div>}
      </div>)}
    </details>}
  </section>;
}
