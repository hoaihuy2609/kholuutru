import DOMPurify from 'dompurify';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import renderMathInElement from 'katex/contrib/auto-render';
import 'katex/dist/katex.min.css';
import { CLOUDFLARE_PROXY_URL } from '../lib/telegram';
import { buildExamPdfHtml, type ExamStyleConfig, type SelectedQuestionItem } from './examLatexService';

const pixelsPerMm = 96 / 25.4;
const pageWidth = 210;
const pageHeight = 297;
const horizontalMargin = 15;
const verticalMargin = 18;
const contentWidth = pageWidth - 2 * horizontalMargin;
const contentHeight = pageHeight - 2 * verticalMargin;

export async function downloadExamPdf(questions: SelectedQuestionItem[], config: ExamStyleConfig) {
  const staging = document.createElement('div');
  staging.setAttribute('aria-hidden', 'true');
  staging.style.cssText = 'position:fixed;left:-10000px;top:0;pointer-events:none;background:white;';
  const source = document.createElement('div');
  const page = document.createElement('div');
  const font = config.mathFont === 'Times New Roman' ? 'Times New Roman, serif' : 'KaTeX_Main, Times New Roman, serif';
  const textStyle = 'width:' + contentWidth * pixelsPerMm + 'px;display:flow-root;font:12pt/1.4 ' + font
    + ';color:#1a1a1a;overflow-wrap:break-word;';
  source.style.cssText = textStyle;
  page.style.cssText = textStyle + 'position:relative;';
  const content = document.createElement('div');
  content.style.display = 'flow-root';
  page.append(content);
  if (config.enableWatermark && config.watermarkText.trim()) {
    const watermark = document.createElement('div');
    watermark.textContent = config.watermarkText;
    watermark.style.cssText = 'position:absolute;top:50%;left:50%;width:90%;text-align:center;transform:translate(-50%,-50%) rotate(-30deg);font:700 36pt serif;color:rgba(0,0,0,.10);';
    page.prepend(watermark);
    content.style.position = 'relative';
  }
  source.innerHTML = DOMPurify.sanitize(buildExamPdfHtml(questions, config), {
    FORBID_TAGS: ['style', 'foreignObject'],
  });
  staging.append(source, page);

  const imageUrls: string[] = [];
  try {
    for (const svg of source.querySelectorAll('svg')) {
      svg.style.maxWidth = '100%';
      svg.style.height = 'auto';
    }
    const images = Array.from(source.querySelectorAll('img'));
    // Nạp lần lượt để mọi URL tạm đều được thu hồi, kể cả khi một ảnh lỗi.
    for (const image of images) {
      const telegramId = image.dataset.telegramImage;
      const url = telegramId && CLOUDFLARE_PROXY_URL
        ? CLOUDFLARE_PROXY_URL + '/getFile/' + encodeURIComponent(telegramId)
        : image.getAttribute('src');
      try {
        if (!url) throw new Error('Missing image URL');
        const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
        if (!response.ok) throw new Error('Image unavailable');
        const objectUrl = URL.createObjectURL(await response.blob());
        imageUrls.push(objectUrl);
        image.src = objectUrl;
        await image.decode();
      } catch {
        throw new Error('Không tải được hình minh họa trong đề. Vui lòng thử lại.');
      }
    }

    renderMathInElement(source, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false },
        { left: '\\(', right: '\\)', display: false },
        { left: '\\[', right: '\\]', display: true },
      ],
      output: 'html',
      throwOnError: false,
    });
    for (const math of source.querySelectorAll<HTMLElement>('.katex')) {
      math.style.color = config.mathColor;
      math.style.fontSize = '1em';
    }
    document.body.append(staging);
    await document.fonts.ready;

    const pdf = new jsPDF({ format: 'a4', unit: 'mm', compress: true });
    let renderedPages = 0;
    const renderPage = async () => {
      if (!content.childElementCount) return;
      page.style.minHeight = contentHeight * pixelsPerMm + 'px';
      const canvas = await html2canvas(page, {
        backgroundColor: '#ffffff',
        scale: 2.5,
        logging: false,
      });
      const ratio = Math.min(contentWidth / canvas.width, contentHeight / canvas.height);
      const width = canvas.width * ratio;
      if (renderedPages++) pdf.addPage();
      pdf.addImage(canvas, 'PNG', (pageWidth - width) / 2, verticalMargin, width, canvas.height * ratio);
      canvas.width = 0;
      canvas.height = 0;
      content.replaceChildren();
    };

    let block = document.createElement('div');
    block.style.display = 'flow-root';
    for (const element of Array.from(source.children)) {
      if (element.hasAttribute('data-new-page')) await renderPage();
      block.append(element);
      if (element.hasAttribute('data-keep-with-next')) continue;

      const pageHasContent = content.childElementCount > 0;
      content.append(block);
      if (pageHasContent && content.getBoundingClientRect().height > contentHeight * pixelsPerMm) {
        block.remove();
        await renderPage();
        content.append(block);
      }
      block = document.createElement('div');
      block.style.display = 'flow-root';
    }
    if (block.childElementCount) content.append(block);
    await renderPage();
    pdf.save('De_Thi_' + config.subject + '_Ma_' + config.examCode + '.pdf');
  } finally {
    staging.remove();
    imageUrls.forEach(url => URL.revokeObjectURL(url));
  }
}
