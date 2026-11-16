import { useEffect, useState } from 'react';
import type { StudyImageField } from '../src/utils/studyImages';
import { matchStudyImageFiles, validStudyImage } from '../src/utils/studyImages';
import { sharpenStudyImage } from '../src/utils/sharpenStudyImage';

export interface StudyImageTarget {
  id: string;
  key: string;
  question: number;
  field: StudyImageField;
  slot: number;
  label: string;
  attached: boolean;
}

export function useImageFileUrl(file?: File) {
  const [preview, setPreview] = useState<{ file: File; url: string }>();
  useEffect(() => {
    if (!file) {
      setPreview(undefined);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview({ file, url });
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return preview?.file === file ? preview?.url : undefined;
}

export function StudyImageThumbnail({ file, src, alt }: { file?: File; src?: string; alt: string }) {
  const local = useImageFileUrl(file);
  return local || src ? <img src={local || src} alt={alt} loading="lazy"
    className="h-16 w-24 shrink-0 rounded border border-stone-200 object-contain" /> : null;
}

export default function StudyImageBatch({ targets, disabled, onApply, onProcessing }: {
  targets: StudyImageTarget[];
  disabled?: boolean;
  onApply: (entries: { target: StudyImageTarget; file: File }[]) => void;
  onProcessing: (processing: boolean) => void;
}) {
  const [entries, setEntries] = useState<{ file: File; targetId: string }[]>([]);
  const [invalid, setInvalid] = useState(0);
  const [sharpen, setSharpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [keptOriginal, setKeptOriginal] = useState(0);
  const activeEntries = entries.filter(entry => targets.some(target => target.id === entry.targetId));
  const duplicates = new Set(activeEntries.map(entry => entry.targetId)).size !== activeEntries.length;

  function selectFiles(files: File[]) {
    const valid = files.filter(validStudyImage);
    setInvalid(files.length - valid.length);
    setKeptOriginal(0);
    setEntries(matchStudyImageFiles(valid, targets));
  }

  async function applyImages() {
    if (duplicates || !activeEntries.length || processing || disabled) return;
    setProcessing(true);
    onProcessing(true);
    try {
      const assignments = [];
      let kept = 0;
      for (const entry of activeEntries) {
        const file = sharpen ? await sharpenStudyImage(entry.file).catch(() => entry.file) : entry.file;
        if (sharpen && file === entry.file) kept++;
        assignments.push({ target: targets.find(target => target.id === entry.targetId)!, file });
      }
      onApply(assignments);
      setEntries(entries.filter(entry => !activeEntries.includes(entry)));
      setKeptOriginal(kept);
    } finally {
      setProcessing(false);
      onProcessing(false);
    }
  }

  return (
    <details className="space-y-2 rounded-lg border border-stone-200 bg-white p-3 text-sm">
      <summary className="cursor-pointer font-semibold text-amber-900">Ghép ảnh hàng loạt ({targets.length} vị trí)</summary>
      <p className="text-xs text-stone-600">Chọn ảnh PNG/JPG tối đa 5 MB mỗi ảnh. Web ghép tên ảnh với mã trong JSON.</p>
      <input type="file" accept="image/png,image/jpeg" multiple disabled={disabled || processing} aria-label="Chọn lô ảnh"
        className="block max-w-full text-xs" onChange={event => {
          selectFiles(Array.from(event.target.files ?? []));
          event.target.value = '';
        }} />
      {!!invalid && <p role="alert" className="text-xs text-red-700">Có {invalid} ảnh sai định dạng hoặc dung lượng.</p>}
      {!!keptOriginal && <p role="status" className="text-xs text-stone-600">Đã giữ ảnh gốc cho {keptOriginal} ảnh vì ảnh quá lớn hoặc trình duyệt không xử lý được.</p>}
      {!!entries.length && (
        <>
          <p role="status" className="text-xs">{activeEntries.length} ảnh đã chọn vị trí · {entries.length - activeEntries.length} ảnh cần kiểm tra</p>
          <ul className="max-h-72 divide-y divide-stone-100 overflow-y-auto">
            {entries.map(({ file, targetId }, index) => (
              <li key={index} className="flex flex-wrap items-center gap-2 py-2">
                <StudyImageThumbnail file={file} alt={file.name} />
                <div className="min-w-0 flex-1">
                  <p className="break-all text-xs">{file.name}</p>
                  <select aria-label={'Vị trí cho ' + file.name} value={targetId} disabled={disabled || processing}
                    className="mt-1 w-full rounded border border-stone-200 p-1.5 text-xs"
                    onChange={event => setEntries(previous => previous.map((entry, i) =>
                      i === index ? { ...entry, targetId: event.target.value } : entry))}>
                    <option value="">Chưa ghép</option>
                    {targets.map(target => <option key={target.id} value={target.id}>
                      {target.label} · {target.key}{target.attached ? ' (thay ảnh)' : ''}
                    </option>)}
                  </select>
                </div>
              </li>
            ))}
          </ul>
          {duplicates && <p role="alert" className="text-xs text-red-700">Mỗi vị trí chỉ nhận một ảnh.</p>}
          <label className="flex items-center gap-2 py-1 text-xs">
            <input type="checkbox" checked={sharpen} disabled={disabled || processing} onChange={event => setSharpen(event.target.checked)} />
            Làm nét nhẹ trước khi gắn
          </label>
          <button type="button" disabled={disabled || processing || !activeEntries.length || duplicates}
            className="rounded bg-amber-800 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            onClick={applyImages}>{processing ? 'Đang xử lý ảnh…' : `Gắn ${activeEntries.length} ảnh`}</button>
        </>
      )}
    </details>
  );
}
