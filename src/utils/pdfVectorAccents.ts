import { OPS, Util, type PDFPageProxy } from 'pdfjs-dist';
import { convertPdfMathToLatex } from './pdfMathLatex';
import type { PdfTextFragment } from './pdfTextLayout';

type OperatorList = Awaited<ReturnType<PDFPageProxy['getOperatorList']>>;

export function restorePdfVectorAccents(fragments: PdfTextFragment[], operators: OperatorList) {
    const arrows: { x: number; y: number; width: number; height: number }[] = [];
    const stack: number[][] = [];
    let matrix = [1, 0, 0, 1, 0, 0];
    operators.fnArray.forEach((op, index) => {
        const args = operators.argsArray[index];
        if (op === OPS.save) stack.push(matrix);
        if (op === OPS.restore) matrix = stack.pop() ?? matrix;
        if (op === OPS.transform) matrix = Util.transform(matrix, args);
        if (op !== OPS.constructPath || args?.[0] !== OPS.fill) return;

        // KaTeX renders \vec as a filled SVG outline, outside the PDF text layer.
        // Recognize its path signature instead of treating arbitrary lines as arrows.
        const path = args[1]?.[0];
        const bounds = args[2];
        if (path?.length !== 146 || path[0] !== 0 || path[1] !== 377 || path[2] !== 20
            || bounds?.[0] !== 29 || bounds[1] !== 0 || bounds[2] !== 471 || bounds[3] !== 198
            || matrix[1] !== 0 || matrix[2] !== 0) return;

        const x1 = bounds[0] * matrix[0] + matrix[4];
        const x2 = bounds[2] * matrix[0] + matrix[4];
        const y1 = bounds[1] * matrix[3] + matrix[5];
        const y2 = bounds[3] * matrix[3] + matrix[5];
        arrows.push({ x: (x1 + x2) / 2, y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) });
    });

    const replacements = new Map<PdfTextFragment, PdfTextFragment>();
    const consumed = new Set<PdfTextFragment>();
    for (const arrow of arrows) {
        const candidates = fragments.filter(fragment => {
            const rise = (arrow.y - fragment.y) / fragment.height;
            return /^[A-Za-zα-ωΑ-Ω]$/.test(fragment.text.trim()) && rise >= 0.52 && rise <= 1.18
                && arrow.width >= fragment.height * 0.25 && arrow.width <= fragment.height * 0.65
                && arrow.height <= fragment.height * 0.4
                && arrow.x >= fragment.x && arrow.x <= fragment.x + fragment.width;
        });
        if (candidates.length !== 1) continue;
        const [base] = candidates;
        if (replacements.has(base)) continue;
        const scripts = fragments.filter(fragment => {
            const gap = fragment.x - base.x - base.width;
            const drop = (base.y - fragment.y) / base.height;
            return /^\d+$/.test(fragment.text.trim()) && !consumed.has(fragment)
                && drop >= 0.12 && drop <= 0.45 && fragment.height <= base.height * 0.82
                && gap >= -base.height * 0.1 && gap <= base.height * 0.18;
        });
        const script = scripts.length === 1 ? scripts[0] : undefined;
        const original = base.text.trim() + '\u20D7';
        const vector = convertPdfMathToLatex(original);
        if (vector === original) continue;
        if (script) consumed.add(script);
        replacements.set(base, {
            ...base,
            text: script ? vector.slice(0, -1) + '_{' + script.text.trim() + '}$' : vector,
            width: script ? script.x + script.width - base.x : base.width,
        });
    }
    return {
        fragments: fragments.filter(fragment => !consumed.has(fragment)).map(fragment => replacements.get(fragment) ?? fragment),
        needsReview: arrows.length > 0,
    };
}
