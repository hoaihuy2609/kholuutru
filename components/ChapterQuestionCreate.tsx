import { useEffect, useState } from 'react';
import { applyQuestionCreate, getQuestionCreateHistory, reviewQuestionCreate, undoQuestionCreateBatch } from '../src/services/outcomeExchangeService';
import { COGNITIVE_LEVELS } from '../src/utils/cognitiveLevels';
import { STUDY_QUESTION_TYPES } from '../src/utils/studyLibrary';
import { lessonLine } from '../src/data/lessonLines';
import { SolutionQuestionPrompt } from './SolutionRenderer';

const button = 'rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-stone-50 disabled:opacity-50';
const limit = 10 * 1024 * 1024;
const typeLabel = (type: string) => STUDY_QUESTION_TYPES.find(item => item.value === type)?.label ?? type;

/** Nạp câu mới vào kho từ JSON: xem trước từng câu, giáo viên xác nhận rồi mới lưu; mỗi đợt hoàn tác được. */
export default function ChapterQuestionCreate({ chapterId, busy, run, onApplied }: {
  chapterId: string; busy: boolean; run: (task: () => Promise<void>) => Promise<void>;
  onApplied: (count: number, undone?: boolean) => Promise<void>;
}) {
  const [text, setText] = useState('');
  const [review, setReview] = useState<Awaited<ReturnType<typeof reviewQuestionCreate>>>();
  const [history, setHistory] = useState<Awaited<ReturnType<typeof getQuestionCreateHistory>>>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [undoId, setUndoId] = useState('');
  useEffect(() => {
    let active = true;
    void run(async () => { const batches = await getQuestionCreateHistory(chapterId); if (active) setHistory(batches); });
    return () => { active = false; };
  }, [chapterId]);
  const reset = () => { setReview(undefined); setConfirmed(false); setUndoId(''); };
  const total = review?.plan.groups.reduce((sum, group) => sum + group.questions.length, 0) ?? 0;

  return <section className="space-y-4">
    <div className="space-y-3 rounded-xl border bg-white p-4">
      <h3 className="font-bold">Nạp câu mới vào kho</h3>
      <p className="text-sm text-stone-600">Dùng file JSON câu mới (physivault.questions.create.v1). Câu được thêm vào bài ghi trong file; bài chưa có thì được tạo mới. Câu có sẵn trong kho không bị thay đổi.</p>
      <input type="file" accept=".json,application/json" disabled={busy} aria-label="Chọn JSON câu mới"
        onChange={event => {
          const file = event.target.files?.[0]; event.target.value = '';
          if (!file) return;
          reset(); setText('');
          void run(async () => {
            if (file.size > limit) throw new Error('File tối đa 10 MB.');
            setText(await file.text());
          });
        }} />
      <button type="button" className={button} disabled={busy || !text.trim()} onClick={() => void run(async () => {
        reset();
        setReview(await reviewQuestionCreate(chapterId, text));
      })}>Kiểm tra và xem trước câu mới</button>
    </div>

    {review && <div className="space-y-3">
      <p className="font-semibold">{total} câu mới · {review.plan.groups.length} nhóm{review.file.source_note ? ' · ' + review.file.source_note : ''}</p>
      {review.plan.groups.map(group => <details key={group.title + group.type} className="rounded-xl border bg-white p-3 text-sm" open={review.plan.groups.length <= 3}>
        <summary className="cursor-pointer font-semibold">
          {group.title} · {typeLabel(group.type)} · {group.questions.length} câu (Câu {group.first}–{group.first + group.questions.length - 1})
          {group.newLesson && <span className="ml-2 rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-900">bài mới</span>}
        </summary>
        <div className="mt-3 space-y-3">
          {group.questions.map(question => <article key={question.question_no} className="space-y-2 rounded-lg border border-stone-200 p-3">
            <p className="text-xs text-stone-600"><span className="font-bold text-stone-900">{question.question_no}</span>
              {question.type !== 'dung_sai' && ' · ' + COGNITIVE_LEVELS[question.cognitive_level]}
              {question.type === 'trac_nghiem' && ' · đáp án ' + question.correctChoice}
              {question.spec_line && ' · ' + (lessonLine(question.spec_line)?.text ?? question.spec_line)}</p>
            <SolutionQuestionPrompt content={JSON.stringify({ type: 'physics_solution', data: { questions: [question] } })} />
            {question.type === 'dung_sai' && <ul className="space-y-1 text-xs text-stone-700">
              {question.statements.map((item: { label: string; verdict: boolean; cognitive_level: number; spec_line?: string }) => <li key={item.label}>
                {item.label}) {item.verdict ? 'Đúng' : 'Sai'} · {COGNITIVE_LEVELS[item.cognitive_level]}{item.spec_line ? ' · ' + (lessonLine(item.spec_line)?.text ?? item.spec_line) : ''}
              </li>)}
            </ul>}
            <details className="text-xs"><summary className="cursor-pointer font-semibold text-amber-900">Lời giải</summary>
              <p className="mt-1 whitespace-pre-wrap">{question.solution}</p></details>
          </article>)}
        </div>
      </details>)}
      <div className="sticky bottom-0 space-y-3 rounded-xl border bg-white p-4 shadow-sm">
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={confirmed} disabled={busy}
          onChange={event => setConfirmed(event.target.checked)} />Tôi đã rà các câu mới ở trên.</label>
        <button type="button" className={button + ' !bg-amber-800 !text-white'} disabled={busy || !confirmed}
          onClick={() => void run(async () => {
            const count = await applyQuestionCreate(chapterId, review.file);
            reset(); setText('');
            await onApplied(count);
            setHistory(await getQuestionCreateHistory(chapterId));
          })}>Thêm {total} câu vào kho</button>
      </div>
    </div>}

    {!!history.length && <details className="rounded-xl border bg-white p-4">
      <summary className="cursor-pointer font-semibold">Lịch sử nạp câu mới</summary>
      {history.map(batch => <div key={batch.id} className="mt-3 space-y-2 border-t pt-3 text-sm">
        <p>{batch.count} câu · {new Date(batch.created_at).toLocaleString('vi-VN')}{batch.undone_at ? ' · Đã hoàn tác' : ''}</p>
        {!batch.undone_at && <button type="button" className={button} disabled={busy} onClick={() => setUndoId(batch.id)}>Hoàn tác đợt này</button>}
        {undoId === batch.id && <div className="space-y-2 rounded-lg bg-amber-50 p-3">
          <p>Xóa {batch.count} câu của đợt này khỏi kho, cùng các bài đã tạo nếu bài không còn câu nào khác.</p>
          <button type="button" className={button} disabled={busy} onClick={() => void run(async () => {
            await undoQuestionCreateBatch(chapterId, batch.id);
            setUndoId('');
            await onApplied(batch.count, true);
            setHistory(await getQuestionCreateHistory(chapterId));
          })}>Xác nhận hoàn tác</button>
        </div>}
      </div>)}
    </details>}
  </section>;
}
