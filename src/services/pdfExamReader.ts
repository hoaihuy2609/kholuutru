import { getDocument, GlobalWorkerOptions, OPS } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { parsePdfExam } from '../utils/pdfExamQuestions';
import { layoutPdfText } from '../utils/pdfTextLayout';
import { restorePdfVectorAccents } from '../utils/pdfVectorAccents';

GlobalWorkerOptions.workerSrc = workerUrl;

export async function readPdfExam(file: File, onProgress: (page: number, total: number) => void) {
    const task = getDocument({ data: await file.arrayBuffer(), isEvalSupported: false });
    try {
        const pdf = await task.promise;
        const pages: string[] = [];
        const emptyPages: number[] = [];
        const reviewPages = new Set<number>();
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
            onProgress(pageNumber, pdf.numPages);
            const page = await pdf.getPage(pageNumber);
            const content = await page.getTextContent();
            const fragments = content.items.flatMap(item => {
                if (!('str' in item) || !item.str) return [];
                const [, , , , x, y] = item.transform;
                return [{ text: item.str, x, y, width: item.width, height: item.height }];
            });
            const operators = await page.getOperatorList();
            const restored = restorePdfVectorAccents(fragments, operators);
            const { text, needsReview } = layoutPdfText(restored.fragments);
            if (!text.trim()) emptyPages.push(pageNumber);
            if (restored.needsReview || needsReview || operators.fnArray.some(op => op === OPS.paintImageXObject || op === OPS.paintInlineImageXObject
                || op === OPS.paintImageMaskXObject || op === OPS.paintImageXObjectRepeat)) reviewPages.add(pageNumber);
            page.cleanup();
            pages.push(text);
        }
        const { questions, unmatchedEntries } = parsePdfExam(pages);
        for (const question of questions) {
            const { page, answerPage, solutionPage } = question.source;
            if (reviewPages.has(page) || (answerPage && reviewPages.has(answerPage))
                || (solutionPage && reviewPages.has(solutionPage))) question.needsVisualReview = true;
        }
        return { questions, emptyPages, unmatchedEntries };
    } finally {
        await task.destroy();
    }
}
