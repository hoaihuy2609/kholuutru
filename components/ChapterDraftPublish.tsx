import { useEffect, useState } from 'react';
import { getPublishHistory, publishChapterDrafts, reviewChapterDrafts, undoPublishChapterDrafts } from '../src/services/outcomeExchangeService';
import type { DraftPost, PublishBatch } from '../src/utils/draftPublishing';
import { STUDY_QUESTION_TYPES } from '../src/utils/studyLibrary';

const button = 'rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-stone-50 disabled:opacity-50';
const typeLabel = (type: string) => STUDY_QUESTION_TYPES.find(item => item.value === type)?.label ?? type;

/** Công khai một lần mọi câu đang để nháp của chương; mỗi đợt hoàn tác được. */
export default function ChapterDraftPublish({ chapterId, busy, run, onApplied }: {
  chapterId: string; busy: boolean; run: (task: () => Promise<void>) => Promise<void>;
  onApplied: (count: number, undone?: boolean) => Promise<void>;
}) {
  const [drafts, setDrafts] = useState<DraftPost[]>();
  const [history, setHistory] = useState<PublishBatch[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [undoId, setUndoId] = useState('');
  const load = async () => { setDrafts(await reviewChapterDrafts(chapterId)); setHistory(await getPublishHistory(chapterId)); };
  useEffect(() => { void run(load); }, [chapterId]);
  const ready = drafts?.filter(draft => !draft.pendingImages) ?? [];
  const total = ready.reduce((sum, draft) => sum + draft.count, 0);

  return <section className="space-y-4">
    <div className="space-y-3 rounded-xl border bg-white p-4">
      <h3 className="font-bold">Công khai câu nháp</h3>
      <p className="text-sm text-stone-600">Câu nháp chỉ hiện khi đăng nhập admin. Công khai thì mọi người vào web đều thấy và dùng được để soạn đề.</p>
      {!drafts ? <p className="text-sm text-stone-600">Đang đọc kho…</p>
        : !drafts.length ? <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">Chương này không còn câu nháp nào.</p>
        : <>
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-stone-600"><th className="py-1 pr-3">Bài</th><th className="py-1 pr-3">Dạng</th><th className="py-1 text-right">Số câu</th></tr></thead>
            <tbody>{drafts.map(draft => <tr key={draft.id} className="border-t">
              <td className="py-1.5 pr-3">{draft.title}{draft.pendingImages && <span className="ml-2 text-xs text-amber-800">(ảnh đang tải lên, để lần sau)</span>}</td>
              <td className="py-1.5 pr-3">{typeLabel(draft.type)}</td><td className="py-1.5 text-right tabular-nums">{draft.count}</td></tr>)}</tbody>
          </table></div>
          <label className="flex gap-2 text-sm"><input type="checkbox" checked={confirmed} disabled={busy}
            onChange={event => setConfirmed(event.target.checked)} />Tôi đã xem danh sách và muốn công khai các câu này.</label>
          <button type="button" className={button + ' !bg-amber-800 !text-white'} disabled={busy || !confirmed || !ready.length}
            onClick={() => void run(async () => {
              const count = await publishChapterDrafts(chapterId, ready.map(draft => draft.id));
              setConfirmed(false);
              await onApplied(count);
              await load();
            })}>Công khai {total} câu</button>
        </>}
    </div>
    {!!history.length && <details className="rounded-xl border bg-white p-4">
      <summary className="cursor-pointer font-semibold">Lịch sử công khai</summary>
      {history.map(batch => <div key={batch.id} className="mt-3 space-y-2 border-t pt-3 text-sm">
        <p>{batch.count} câu · {new Date(batch.created_at).toLocaleString('vi-VN')}{batch.undone_at ? ' · Đã hoàn tác' : ''}</p>
        {!batch.undone_at && <button type="button" className={button} disabled={busy} onClick={() => setUndoId(batch.id)}>Đưa đợt này về nháp</button>}
        {undoId === batch.id && <div className="space-y-2 rounded-lg bg-amber-50 p-3">
          <p>Đưa {batch.count} câu của đợt này về lại nháp.</p>
          <button type="button" className={button} disabled={busy} onClick={() => void run(async () => {
            await undoPublishChapterDrafts(chapterId, batch.id);
            setUndoId('');
            await onApplied(batch.count, true);
            await load();
          })}>Xác nhận đưa về nháp</button>
        </div>}
      </div>)}
    </details>}
  </section>;
}
