import { useEffect, useRef, useState } from 'react';
import { Download, FileJson, History, Printer, Upload } from 'lucide-react';
import OutcomeReviewPrint from './OutcomeReviewPrint';
import type { StudyLibrary } from '../types';
import { MatrixDialog } from './MatrixQuestionCard';
import { STUDY_QUESTION_TYPES } from '../src/utils/studyLibrary';
import type { OutcomePreview, OutcomeResult, OutcomeValue } from '../src/utils/outcomeExchange';
import { applyChapterOutcomes, exportChapterOutcomes, getOutcomeHistory, reviewChapterOutcomes,
  reviewOutcomeUndo, undoChapterOutcomes, type OutcomeBatch } from '../src/services/outcomeExchangeService';
import { getStudyLibrary } from '../src/services/blogService';

const button = 'inline-flex items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-stone-50 disabled:opacity-50';
const primary = button + ' !border-amber-800 !bg-amber-800 !text-white';
function downloadJson(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url; link.download = name; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Outcomes({ value }: { value: OutcomeValue }) {
  if (!value.present || value.value == null || (Array.isArray(value.value) && !value.value.length)) return <p className="text-stone-500">Chưa có YCCĐ</p>;
  const list = Array.isArray(value.value) ? value.value : [value.value];
  return <ul className="list-disc space-y-1 pl-4">{list.map((line, i) => <li key={i}>{typeof line === 'string' ? line : JSON.stringify(line)}</li>)}</ul>;
}

export default function ChapterOutcomeExchange({ chapter, onChanged }: {
  chapter: { id: string; name: string }; onChanged: (library: StudyLibrary) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'export' | 'import' | 'history' | 'pdf'>('export');
  const [prepared, setPrepared] = useState<Awaited<ReturnType<typeof exportChapterOutcomes>>>();
  const [text, setText] = useState('');
  const [review, setReview] = useState<{ preview: OutcomePreview; result?: OutcomeResult; batchId?: string }>();
  const [history, setHistory] = useState<OutcomeBatch[]>([]);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [acceptSkipped, setAcceptSkipped] = useState(false);

  const run = async (task: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(''); setNotice('');
    try { await task(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Chưa thực hiện được. Hãy thử lại.'); }
    finally { busyRef.current = false; setBusy(false); }
  };
  useEffect(() => {
    if (open) void run(async () => setHistory(await getOutcomeHistory(chapter.id)));
  }, [open, chapter.id]);

  const changeTab = (next: typeof tab) => {
    setTab(next); setReview(undefined); setConfirmed(false); setError(''); setNotice('');
  };
  const apply = () => run(async () => {
    if (!review || !confirmed || review.preview.errors.length) return;
    if (review.batchId) await undoChapterOutcomes(chapter.id, review.batchId);
    else if (review.result) await applyChapterOutcomes(chapter.id, review.result);
    else return;
    const count = review.preview.changes.length;
    setReview(undefined); setText(''); setConfirmed(false); setPrepared(undefined);
    setNotice(`Đã lưu ${count} câu trên máy và đưa vào hàng đợi đồng bộ. Theo dõi trạng thái “Kho câu hỏi” để biết khi đồng bộ xong.`);
    onChanged(await getStudyLibrary(true));
    setHistory(await getOutcomeHistory(chapter.id));
  });

  return <>
    <div className="flex justify-end">
      <button type="button" className={button} onClick={() => setOpen(true)}><FileJson className="size-4" /> Rà YCCĐ bằng JSON</button>
    </div>
    {open && <MatrixDialog title="Rà YCCĐ theo chương" subtitle={chapter.name} closeLabel="Đóng rà YCCĐ"
      onClose={() => { if (!busyRef.current) setOpen(false); }}>
      <div className="space-y-4">
        <p className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-950">
          Xuất toàn bộ loại câu và cả câu nháp trong chương. Khi nhập, chỉ cập nhật YCCĐ của các mã câu được gửi lại.
          Đề, đáp án, lời giải, mức độ và ảnh được giữ nguyên.
        </p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Thao tác YCCĐ">
          {([['export', '1. Xuất để rà', Download], ['import', '2. Nhập kết quả', Upload], ['pdf', 'Xuất PDF rà câu', Printer], ['history', 'Lịch sử / hoàn tác', History]] as const).map(([value, label, Icon]) =>
            <button type="button" key={value} disabled={busy} aria-pressed={tab === value} className={tab === value ? primary : button}
              onClick={() => changeTab(value)}><Icon className="size-4" />{label}</button>)}
        </div>
        <p className="text-xs text-stone-600">Nhập kết quả trên cùng trình duyệt đã xuất. Bản đối chiếu và lịch sử hoàn tác được lưu tại máy này; hãy giữ file JSON đã tải.</p>
        {error && <p role="alert" className="whitespace-pre-wrap rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">{error}</p>}
        {notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
        {busy && <p role="status" className="text-sm text-amber-900">Đang kiểm tra và xử lí…</p>}

        {tab === 'pdf' && <OutcomeReviewPrint chapter={chapter} />}

        {tab === 'export' && <section className="space-y-3 rounded-xl border bg-white p-4">
          <h3 className="font-bold">Xuất một lần cho cả chương</h3>
          <p className="text-sm text-stone-600">File gồm nội dung câu để AI đọc, YCCĐ hiện tại, mã đối chiếu và mẫu JSON trả về. Tham chiếu ảnh không thay thế việc xem ảnh gốc.</p>
          <button type="button" className={button} disabled={busy} onClick={() => run(async () => {
            setPrepared(undefined); setAcceptSkipped(false); setPrepared(await exportChapterOutcomes(chapter.id));
          })}>Kiểm tra và chuẩn bị file</button>
          {prepared && <>
            <div className="grid gap-2 sm:grid-cols-3">
              {STUDY_QUESTION_TYPES.map(type => <div key={type.value} className="rounded-lg bg-stone-50 p-3 text-sm">
                <p>{type.label}</p><strong>{prepared.manifest.sources.filter(q => q.type === type.value).length} câu</strong>
              </div>)}
            </div>
            <p className="text-sm font-semibold">Tổng {prepared.manifest.sources.length} câu · Đã gồm lý thuyết và tính toán</p>
            {!!prepared.skipped.length && <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
              <p>{prepared.skipped.length} bài chưa đọc được cấu trúc, sẽ không có trong file:</p>
              <ul className="my-2 list-disc pl-4">{prepared.skipped.map(item => <li key={item}>{item}</li>)}</ul>
              <label className="flex gap-2"><input type="checkbox" checked={acceptSkipped} onChange={e => setAcceptSkipped(e.target.checked)} />Tôi đã xem các bài bị bỏ qua.</label>
            </div>}
            <button type="button" className={primary} disabled={busy || (!!prepared.skipped.length && !acceptSkipped)} onClick={() => {
              downloadJson(`yccd-${chapter.id}-${prepared.manifest.export_id}.json`, prepared.file);
              setNotice('Đã tạo file tải xuống. Gửi file này cho AI, yêu cầu trả đúng result_format. Sau đó mở “Nhập kết quả”.');
            }}><Download className="size-4" />Tải JSON · {prepared.manifest.sources.length} câu</button>
          </>}
        </section>}

        {tab === 'import' && <section className="space-y-3 rounded-xl border bg-white p-4">
          <h3 className="font-bold">Nhập JSON YCCĐ đã xử lí</h3>
          <p className="text-sm text-stone-600">Dùng file kết quả theo mẫu trong file xuất. Có thể cập nhật một phần câu trong chương.</p>
          <input type="file" accept=".json,application/json" aria-label="Chọn file cập nhật YCCĐ" disabled={busy} className="block w-full text-sm"
            onChange={event => {
              const file = event.target.files?.[0]; event.target.value = '';
              if (!file) return;
              setReview(undefined); setConfirmed(false);
              void run(async () => {
                if (file.size > 10 * 1024 * 1024) throw new Error('File kết quả tối đa 10 MB. Chỉ gửi mã câu và YCCĐ, không gửi ảnh.');
                setText(await file.text());
              });
            }} />
          <textarea aria-label="JSON cập nhật YCCĐ" rows={7} value={text} disabled={busy}
            placeholder="Hoặc dán JSON kết quả tại đây…" className="w-full rounded-lg border border-stone-300 p-3 font-mono text-xs"
            onChange={e => { setText(e.target.value); setReview(undefined); setConfirmed(false); }} />
          <button type="button" className={button} disabled={busy || !text.trim()} onClick={() => run(async () => {
            setReview(undefined); setConfirmed(false);
            if (text.length > 10 * 1024 * 1024) throw new Error('JSON quá lớn. Chỉ nhập kết quả cập nhật YCCĐ.');
            setReview(await reviewChapterOutcomes(chapter.id, text));
          })}>Kiểm tra và xem trước</button>
        </section>}

        {tab === 'history' && <section className="space-y-3 rounded-xl border bg-white p-4">
          <h3 className="font-bold">Lịch sử trên trình duyệt này</h3>
          {!history.length && <p className="text-sm text-stone-500">Chưa có đợt cập nhật YCCĐ.</p>}
          {history.map(batch => <div key={batch.id} className="flex flex-wrap items-center justify-between gap-2 border-t py-3 text-sm">
            <div><strong>{batch.changes.length} câu</strong> · {new Date(batch.created_at).toLocaleString('vi-VN')}
              {batch.undone_at && <p className="text-emerald-700">Đã hoàn tác</p>}</div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={button} disabled={busy} onClick={() => downloadJson(`lich-su-yccd-${batch.id}.json`, batch)}>Tải bản đối chiếu</button>
              {!batch.undone_at && <button type="button" className={button} disabled={busy} onClick={() => run(async () => {
                setReview(undefined); setConfirmed(false);
                setReview({ batchId: batch.id, preview: await reviewOutcomeUndo(chapter.id, batch.id) });
              })}>Xem trước hoàn tác</button>}
            </div>
          </div>)}
        </section>}

        {review && <section className="space-y-3">
          <h3 className="font-bold">{review.batchId ? 'Xem trước hoàn tác' : 'Xem trước cập nhật'}</h3>
          <p className="text-sm">{review.preview.changes.length} câu thay đổi · {review.preview.unchanged} giữ nguyên · {review.preview.omitted} câu không gửi lại</p>
          {!!review.preview.errors.length && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
            <strong>Chưa thể áp dụng. Không câu nào được cập nhật khi còn lỗi.</strong>
            <ul className="mt-2 list-disc space-y-1 pl-4">{review.preview.errors.map((message, index) => <li key={index} className="whitespace-pre-wrap">{message}</li>)}</ul>
          </div>}
          {review.preview.changes.map(change => <article key={change.question_id} className="space-y-2 rounded-xl border bg-white p-4 text-sm">
            <h4 className="font-bold">{change.lesson} · {change.label}</h4>
            <p className="line-clamp-3 text-stone-600">{change.text}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-stone-50 p-3"><p className="mb-2 font-semibold">Hiện tại</p><Outcomes value={change.before} /></div>
              <div className="rounded-lg bg-emerald-50 p-3"><p className="mb-2 font-semibold text-emerald-900">Sau khi {review.batchId ? 'hoàn tác' : 'cập nhật'}</p><Outcomes value={change.after} /></div>
            </div>
          </article>)}
          {review.preview.changes.length > 0 && !review.preview.errors.length && <div className="sticky bottom-0 space-y-3 rounded-xl border border-amber-200 bg-white p-4 shadow-sm">
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)} className="mt-0.5" />
              Tôi đã rà thay đổi YCCĐ của {review.preview.changes.length} câu trong chương này.</label>
            <button type="button" className={primary} disabled={busy || !confirmed} onClick={apply}>
              {review.batchId ? 'Xác nhận hoàn tác' : 'Áp dụng YCCĐ mới'}</button>
          </div>}
        </section>}
      </div>
    </MatrixDialog>}
  </>;
}
