import { useEffect, useRef, useState } from 'react';
import { Printer } from 'lucide-react';
import SolutionRenderer from './SolutionRenderer';
import { prepareOutcomeReviewPrint } from '../src/services/outcomeExchangeService';
import { STUDY_QUESTION_TYPES } from '../src/utils/studyLibrary';
import { reviewSections } from '../src/utils/outcomeReviewPrint';

const button = 'inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-stone-50 disabled:opacity-50';
type Preview = Awaited<ReturnType<typeof prepareOutcomeReviewPrint>>;

async function checkImages(root: ParentNode) {
  const images = Array.from(root.querySelectorAll('img'));
  let timer: ReturnType<typeof setTimeout> | undefined;
  const failures = new Set<HTMLImageElement>(images);
  try {
    await Promise.race([
      Promise.allSettled(images.map(async img => {
        img.loading = 'eager';
        await img.decode();
        if (img.naturalWidth > 0) failures.delete(img);
      })),
      new Promise<void>(resolve => { timer = setTimeout(resolve, 25000); }),
    ]);
    return [...new Set(Array.from(failures, img => img.closest<HTMLElement>('[data-review-question]')?.dataset.reviewQuestion ?? 'Ảnh minh họa'))];
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

async function openPrintPreview(content: HTMLElement, title: string) {
  const popup = window.open('', '_blank');
  if (!popup) throw new Error('Trình duyệt đang chặn cửa sổ in. Hãy cho phép mở cửa sổ rồi thử lại.');
  try {
    popup.opener = null;
    const doc = popup.document;
    doc.title = title;
    doc.documentElement.lang = 'vi';
    const base = doc.createElement('base');
    base.href = document.baseURI;
    doc.head.append(base);
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'), element => {
      const copy = doc.importNode(element, true);
      if (copy.tagName !== 'LINK') { doc.head.append(copy); return Promise.resolve(); }
      return new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Không tải được định dạng trang in. Hãy thử lại.')), 25000);
        copy.addEventListener('load', () => { clearTimeout(timer); resolve(); }, { once: true });
        copy.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Không tải được định dạng trang in.')); }, { once: true });
        doc.head.append(copy);
      });
    });
    const style = doc.createElement('style');
    style.textContent = `
      @page { size: A4; margin: 12mm; }
      body { margin: 0; color: #171717; background: white; }
      .review-paper { max-width: 185mm; margin: 0 auto; padding: 12px; }
      .review-paper img { max-width: 100%; max-height: 155mm; object-fit: contain; break-inside: avoid; }
      .review-paper article { margin-bottom: 18px; padding-bottom: 12px; border-bottom: 1px solid #bbb; }
      .review-paper article > header, .review-paper h2 { break-after: avoid; }
      @media print {
        .review-paper { max-width: none; padding: 0; }
        .review-paper > section + section { break-before: page; }
        .review-paper * { print-color-adjust: exact; }
      }
    `;
    doc.head.append(style);
    doc.body.append(doc.importNode(content, true));
    const [, failed] = await Promise.all([Promise.all(styles), checkImages(doc.body)]);
    if (failed.length) throw new Error(`Ảnh không tải được trong cửa sổ in: ${failed.join(', ')}.`);
    await doc.fonts.ready;
    popup.focus();
    popup.print();
  } catch (error) {
    popup.close();
    throw error;
  }
}

export default function OutcomeReviewPrint({ chapter }: { chapter: { id: string; name: string } }) {
  const paper = useRef<HTMLDivElement>(null);
  const latestLoad = useRef(0);
  const [preview, setPreview] = useState<Preview>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [imageErrors, setImageErrors] = useState<string[]>();
  const [imageCheck, setImageCheck] = useState(0);
  const title = `Phiếu rà câu hỏi · ${chapter.name}`;

  useEffect(() => {
    if (!preview || !paper.current) return;
    let active = true;
    void checkImages(paper.current).then(errors => { if (active) setImageErrors(errors); });
    return () => { active = false; };
  }, [preview, imageCheck]);

  async function load(file: File) {
    const attempt = ++latestLoad.current;
    setError(''); setPreview(undefined); setImageErrors(undefined); setLoading(true);
    try {
      if (file.size > 1024 * 1024) throw new Error('Danh sách rà phải nhỏ hơn 1 MB.');
      const prepared = await prepareOutcomeReviewPrint(chapter.id, await file.text());
      if (attempt === latestLoad.current) setPreview(prepared);
    } catch (e) {
      if (attempt === latestLoad.current) setError(e instanceof Error ? e.message : 'Không mở được danh sách rà.');
    } finally {
      if (attempt === latestLoad.current) setLoading(false);
    }
  }

  async function print() {
    if (!paper.current) return;
    setPrinting(true); setError('');
    try { await openPrintPreview(paper.current, title); }
    catch (e) { setError(e instanceof Error ? e.message : 'Không mở được cửa sổ in.'); }
    finally { setPrinting(false); }
  }

  const groups = (Object.keys(reviewSections) as (keyof typeof reviewSections)[]).map(key => ({
    key, label: reviewSections[key], cards: preview?.cards.filter(card => card.group === key) ?? [],
  }));
  const unavailable = preview?.cards.filter(card => card.missingImage) ?? [];
  return <section className="space-y-3 rounded-xl border bg-white p-4">
    <h3 className="font-bold">Xuất PDF rà câu theo danh sách</h3>
    <p className="text-sm text-stone-600">Chọn file danh sách trên trình duyệt đã xuất JSON của chương. Khi mở cửa sổ in, chọn Lưu dưới dạng PDF.</p>
    <input type="file" accept=".json,application/json" aria-label="Chọn danh sách câu cần rà" disabled={printing}
      onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void load(file); }} />
    {loading && <p role="status" className="text-sm">Đang đối chiếu danh sách với kho…</p>}
    {error && <p role="alert" className="text-sm text-red-900">{error}</p>}
    {preview && <>
      <p role="status" className="text-sm font-semibold">{preview.cards.length}/{preview.total} câu khớp · {groups.map(group => `${group.cards.length} ${group.label.toLowerCase()}`).join(' · ')}</p>
      {!!(preview.issues.length || unavailable.length || imageErrors?.length) && <ul role="alert" className="list-disc space-y-1 rounded bg-red-50 p-3 pl-8 text-sm text-red-900">
        {preview.issues.map(issue => <li key={issue}>{issue}</li>)}
        {unavailable.map(card => <li key={card.question_id}>Chưa có nguồn ảnh cho {card.lesson} · {card.label} · {card.question_id}.</li>)}
        {imageErrors?.map(question => <li key={question}>Ảnh không tải được: {question}.</li>)}
      </ul>}
      {!!preview.cards.length && !imageErrors && <p role="status" className="text-sm">Đang kiểm tra ảnh…</p>}
      <div className="sticky top-0 z-10 flex flex-wrap gap-2 bg-white py-2">
        <button type="button" className={button} disabled={printing || !preview.cards.length || !!preview.issues.length || !!unavailable.length || !imageErrors || !!imageErrors.length}
          onClick={() => void print()}><Printer className="size-4" />{printing ? 'Đang chuẩn bị trang in…' : 'In / Lưu PDF'}</button>
        {!!imageErrors?.length && <button type="button" className={button} disabled={printing}
          onClick={() => { setImageErrors(undefined); setImageCheck(count => count + 1); }}>Kiểm tra lại ảnh</button>}
      </div>
      <div key={imageCheck} ref={paper} className="review-paper space-y-5">
        <header>
          <h1 className="text-lg font-bold">Phiếu rà câu hỏi</h1><p>{chapter.name}</p>
          <ul className="mt-2 list-disc pl-5 text-sm">
            {groups.filter(group => group.cards.length).map(group => <li key={group.key}>{group.label} · {group.cards.length} câu</li>)}
          </ul>
        </header>
        {groups.filter(group => group.cards.length).map(group => <section key={group.key} className="space-y-4">
          <h2 className="border-b pb-2 text-base font-bold">{group.label} · {group.cards.length} câu</h2>
          {group.cards.map(card => <article key={card.question_id} data-review-question={`${card.lesson} · ${card.label} · ${card.question_id}`}
            className="space-y-3 rounded-lg border p-3">
            <header className="space-y-1 text-sm">
              <h3 className="font-bold">{[card.lesson, card.label, STUDY_QUESTION_TYPES.find(type => type.value === card.type)?.label,
                ...card.questionGroups].filter(Boolean).join(' · ')}</h3>
              <p className="break-all text-xs text-stone-600">{card.question_id}</p>
              <p className="whitespace-pre-wrap rounded bg-amber-50 p-2"><strong>Ghi chú rà. </strong>{card.note}</p>
            </header>
            <SolutionRenderer content={card.content} />
          </article>)}
        </section>)}
      </div>
    </>}
  </section>;
}
