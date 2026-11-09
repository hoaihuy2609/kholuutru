export interface PdfTextFragment {
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
}

export function layoutPdfText(fragments: PdfTextFragment[]) {
    const lines: { y: number; height: number; fragments: PdfTextFragment[] }[] = [];
    let needsReview = false;
    for (const fragment of [...fragments].sort((first, second) => second.y - first.y)) {
        const last = lines.at(-1);
        if (last && Math.abs(last.y - fragment.y) <= Math.max(last.height, fragment.height, 1) * 0.45) {
            if (Math.abs(last.y - fragment.y) > 0.5) needsReview = true;
            last.fragments.push(fragment);
            if (fragment.height > last.height) {
                last.y = fragment.y;
                last.height = fragment.height;
            }
        } else {
            lines.push({ y: fragment.y, height: fragment.height, fragments: [fragment] });
        }
    }
    const text = lines.map(line => {
        const pieces = line.fragments.sort((first, second) => first.x - second.x);
        let rightEdge = pieces[0].x;
        let text = '';
        for (const piece of pieces) {
            const gap = piece.x - rightEdge;
            if (gap >= Math.max(line.height, 1) * 0.1 && !/\s$/.test(text) && !/^\s/.test(piece.text)) text += ' ';
            if (gap < -Math.max(line.height, 1) * 0.2 && piece.text.trim()) needsReview = true;
            text += piece.text;
            rightEdge = Math.max(rightEdge, piece.x + piece.width);
        }
        return text.trim();
    }).join('\n');
    return { text, needsReview };
}
