import { getDocument, GlobalWorkerOptions, OPS } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { parsePdfExam } from '../utils/pdfExamQuestions';

GlobalWorkerOptions.workerSrc = workerUrl;

export async function readPdfExam(file: File, onProgress: (page: number, total: number) => void) {
    const task = getDocument({ data: await file.arrayBuffer(), isEvalSupported: false });
    try {
        const pdf = await task.promise;
        const pages: string[] = [];
        const emptyPages: number[] = [];
        const pagesWithImages = new Set<number>();
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
            onProgress(pageNumber, pdf.numPages);
            const page = await pdf.getPage(pageNumber);
            const content = await page.getTextContent();
            let text = '';
            let previous: { x: number; y: number; width: number; height: number } | undefined;
            for (const item of content.items) {
                if (!('str' in item)) continue;
                const [, , , , x, y] = item.transform;
                if (previous && !text.endsWith('\n')) {
                    const lineHeight = Math.max(item.height, previous.height, 1);
                    if (Math.abs(previous.y - y) > lineHeight * 0.75 || x < previous.x - lineHeight) text += '\n';
                    else if (x - previous.x - previous.width > lineHeight * 0.12) text += ' ';
                }
                text += item.str + (item.hasEOL ? '\n' : '');
                if (item.str) previous = { x, y, width: item.width, height: item.height };
            }
            if (!text.trim()) emptyPages.push(pageNumber);
            const operators = await page.getOperatorList();
            if (operators.fnArray.some(op => op === OPS.paintImageXObject || op === OPS.paintInlineImageXObject
                || op === OPS.paintImageMaskXObject || op === OPS.paintImageXObjectRepeat)) pagesWithImages.add(pageNumber);
            page.cleanup();
            pages.push(text);
        }
        const questions = parsePdfExam(pages);
        for (const question of questions) {
            if (pagesWithImages.has(question.source.page)) question.needsVisualReview = true;
        }
        return { questions, emptyPages };
    } finally {
        await task.destroy();
    }
}
