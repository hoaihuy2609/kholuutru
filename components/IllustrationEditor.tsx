import { useState } from 'react';
import { CheckCircle2, Image as ImageIcon } from 'lucide-react';
import { renderTikzToSvg } from '../src/services/tikzService';
import { MAX_QUESTION_IMAGE_WIDTH, MIN_QUESTION_IMAGE_WIDTH } from '../src/utils/questionImage';
import { studyImageSrc, validStudyImage, type EditableStudyImage } from '../src/utils/studyImages';
import { useImageFileUrl } from './StudyImageBatch';

const layouts = [
  { value: 'auto', label: 'Tự động' },
  { value: 'right', label: 'Cột phải' },
  { value: 'bottom', label: 'Ở dưới' },
] as const;
const button = 'rounded-md border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-stone-800 hover:bg-amber-50 disabled:opacity-50';

export default function IllustrationEditor({ image, target, disabled, onChange, onBusy, onTikzFocus }: {
  image: EditableStudyImage;
  target: 'đề bài' | 'lời giải';
  disabled: boolean;
  onChange: (image: EditableStudyImage, additionalFiles?: File[]) => void;
  onBusy: (busy: boolean) => void;
  onTikzFocus?: (element: HTMLTextAreaElement) => void;
}) {
  const filePreview = useImageFileUrl(image.file);
  const src = filePreview || studyImageSrc(image);
  const hasImage = !!(image.file || src);
  const [error, setError] = useState('');
  const [rendering, setRendering] = useState(false);
  const label = target === 'đề bài' ? 'Hình minh họa' : 'Hình minh họa lời giải';

  function attach(files: File[]) {
    if (disabled || !files.length) return;
    const [file, ...additionalFiles] = files.filter(validStudyImage);
    setError((file ? additionalFiles.length + 1 : 0) === files.length ? '' : 'Chỉ nhận ảnh PNG/JPG tối đa 5 MB mỗi ảnh.');
    if (file) onChange({ key: image.key, width: image.width, layout: image.layout ?? 'auto', file }, additionalFiles);
  }

  async function renderTikz() {
    if (disabled || !image.tikz?.trim()) return;
    setError('');
    setRendering(true);
    onBusy(true);
    try {
      const result = await renderTikzToSvg(image.tikz);
      onChange({ key: image.key, width: image.width, tikz: image.tikz, svg: result.svg,
        layout: !image.layout || image.layout === 'auto' ? result.recommendedLayout : image.layout });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Chưa vẽ được hình. Thử lại nhé.');
    } finally {
      setRendering(false);
      onBusy(false);
    }
  }

  return (
    <div role="group" aria-label={label} tabIndex={0}
      onPaste={event => {
        const files = Array.from(event.clipboardData.files).filter(item => item.type.startsWith('image/'));
        if (!files.length) return;
        event.preventDefault();
        attach(target === 'lời giải' ? files : files.slice(0, 1));
      }}
      className="space-y-2.5 rounded-lg border border-stone-200 bg-stone-50 p-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-600">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-stone-900">{label}</span>
          <span className="text-stone-500">(tùy chọn)</span>
          {image.key && <code className="text-stone-600">{image.key}</code>}
        </div>
        <label className={button + ' inline-flex items-center gap-1.5 focus-within:ring-1 focus-within:ring-amber-600'}>
          <ImageIcon aria-hidden="true" className="size-3.5 text-amber-800" /> {hasImage ? 'Thay ảnh' : 'Chèn ảnh'}
          <input className="sr-only" type="file" accept="image/png,image/jpeg" disabled={disabled} multiple={target === 'lời giải'} aria-label={'Chọn ảnh cho ' + target}
            onChange={event => {
              const files = Array.from(event.currentTarget.files ?? []);
              event.currentTarget.value = '';
              attach(files);
            }} />
        </label>
      </div>
      <p className="text-[11px] leading-relaxed text-stone-600">
        Bấm vào khung rồi nhấn Ctrl+V để dán ảnh, hoặc chọn ảnh PNG/JPG tối đa 5 MB. Gõ <code>[image]</code> vào {target} để đặt hình giữa các đoạn.
      </p>
      <textarea rows={4} aria-label={'Mã TikZ cho ' + target} value={image.tikz ?? ''} disabled={disabled}
        onChange={event => onChange({ ...image, tikz: event.currentTarget.value })}
        onFocus={event => onTikzFocus?.(event.currentTarget)}
        placeholder={'VD:\n\\begin{tikzpicture}\n  \\draw[->] (0,0) -- (2,0) node[right] {$\\vec{F}$};\n\\end{tikzpicture}'}
        className="w-full resize-y rounded-lg border border-stone-200 bg-white p-2.5 font-mono text-xs outline-none focus:border-amber-600" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" className={button} onClick={renderTikz} disabled={disabled || !image.tikz?.trim()}>
          {rendering ? 'Đang vẽ hình…' : 'Xem trước hình vẽ'}
        </button>
        {hasImage && <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-stone-500">Bố cục</span>
          {layouts.map(({ value, label }) => (
            <button key={value} type="button" disabled={disabled} aria-pressed={(image.layout ?? 'auto') === value}
              className={button + ((image.layout ?? 'auto') === value ? ' !bg-stone-900 !text-white' : '')}
              onClick={() => onChange({ ...image, layout: value })}>{label}</button>
          ))}
          <button type="button" disabled={disabled} className="ml-1 text-xs text-rose-700 hover:underline"
            onClick={() => { setError(''); onChange({ key: image.key }); }}>Xóa hình</button>
        </div>}
      </div>
      {hasImage && (
        <div className="flex flex-wrap items-center gap-2 border-t border-stone-200 pt-2.5 text-xs">
          <label className="flex min-w-0 flex-[1_1_13rem] items-center gap-2 font-medium text-stone-700">
            Kích thước ảnh
            <input type="range" min={MIN_QUESTION_IMAGE_WIDTH} max={MAX_QUESTION_IMAGE_WIDTH} className="min-w-16 flex-1 accent-amber-800"
              value={image.width ?? MAX_QUESTION_IMAGE_WIDTH} disabled={disabled}
              aria-valuetext={image.width === undefined ? 'Tự động' : image.width + '%'}
              onChange={event => onChange({ ...image, width: event.currentTarget.valueAsNumber })} />
          </label>
          <span className="w-9 text-right tabular-nums">{image.width === undefined ? '—' : image.width + '%'}</span>
          <button type="button" className={button} disabled={disabled || image.width === undefined}
            onClick={() => onChange({ ...image, width: undefined })}>Về tự động</button>
        </div>
      )}
      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">{error}</p>}
      {src && <div className="flex flex-col items-center rounded-lg border border-stone-200 bg-white p-3">
        <p className="mb-2 flex items-center gap-1.5 self-start text-xs font-semibold text-amber-900">
          <CheckCircle2 aria-hidden="true" className="size-3.5" /> Xem trước hình
        </p>
        <img src={src} alt={label} style={{ width: image.width === undefined ? undefined : image.width + '%' }}
          className="max-h-60 max-w-full object-contain" />
      </div>}
    </div>
  );
}
