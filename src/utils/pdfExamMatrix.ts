import { layoutPdfText, type PdfTextFragment } from './pdfTextLayout';
import { matrixLevel, matrixQuestionType, matrixReferences, normalizeMatrixText, type MatrixQuestionType, type MatrixRow } from './examMatrix';

export interface MatrixPage {
    fragments: PdfTextFragment[];
    rules: number[][];
}

const outcomeHeader = /^(?:yeu cau(?: can dat)?|yccd|muc tieu(?: danh gia)?)$/;
const topicHeader = /^(?:chu de|noi dung(?: kien thuc)?|don vi kien thuc|bai hoc|mach noi dung)$/;
const countHeader = /^(?:so (?:luong )?cau(?: hoi)?(?: y)?|so y)$/;
const referenceHeader = /^(?:cau hoi|vi tri(?: cau)?|so thu tu cau|cau so|ma cau)$/;
const sectionName = /\bphan (?:[ivx]+|\d+)\b/;
const genericObjectiveHeader = /^(?:tn|tnkq|trac nghiem(?: khach quan)?)$/;

function distinctCoordinates(values: number[]) {
    return values.sort((a, b) => a - b).filter((value, index, sorted) => index === 0 || value - sorted[index - 1] > 2);
}

function between(edges: number[], point: number) {
    const upper = edges.findIndex(edge => edge > point);
    return upper > 0 ? [edges[upper - 1], edges[upper]] : undefined;
}

function cellText(fragments: PdfTextFragment[]) {
    return layoutPdfText(fragments).text.replace(/\s+/g, ' ').trim();
}

function createGrid({ rules, fragments }: MatrixPage) {
    const horizontal = rules.filter(([left, bottom, right, top]) => top - bottom <= 2 && right - left > 12);
    const vertical = rules.filter(([left, bottom, right, top]) => right - left <= 2 && top - bottom > 8);
    const xEdges = distinctCoordinates(vertical.map(([left, , right]) => (left + right) / 2));
    const yEdges = distinctCoordinates(horizontal.map(([, bottom, , top]) => (bottom + top) / 2));
    const columns = xEdges.slice(1).map((right, index) => (right + xEdges[index]) / 2);
    const rows = yEdges.slice(1).map((top, index) => (top + yEdges[index]) / 2).reverse();
    const cache = new Map<string, { text: string; bottom: number; top: number; key: string }>();

    function cell(x: number, y: number) {
        const horizontalEdges = distinctCoordinates(horizontal
            .filter(([left, , right]) => x > left && x < right)
            .map(([, bottom, , top]) => (bottom + top) / 2));
        const verticalEdges = distinctCoordinates(vertical
            .filter(([, bottom, , top]) => y > bottom && y < top)
            .map(([left, , right]) => (left + right) / 2));
        const yRange = between(horizontalEdges, y);
        const xRange = between(verticalEdges, x);
        if (!xRange || !yRange) return { text: '', bottom: y, top: y, key: '' };
        const [left, right] = xRange;
        const [bottom, top] = yRange;
        const key = [left, right, bottom, top].join(',');
        let result = cache.get(key);
        if (!result) {
            const text = cellText(fragments.filter(fragment => {
                const middleX = fragment.x + fragment.width / 2;
                const middleY = fragment.y + fragment.height * 0.3;
                return middleX > left && middleX < right && middleY > bottom && middleY < top;
            }));
            result = { text, bottom, top, key };
            cache.set(key, result);
        }
        return result;
    }
    return { columns, rows, cell };
}

export function parsePdfMatrix(pages: MatrixPage[]) {
    const rows: MatrixRow[] = [];
    const unreadPages: number[] = [];
    const grades = new Set<number>();
    const sectionTypes = new Map<string, Set<MatrixQuestionType>>();
    const levels = new Map<string, number>();
    let topic = '';
    let currentLevel = 0;

    const grids = pages.map(createGrid);
    pages.forEach(({ fragments }, index) => {
        const grid = grids[index];
        const labels = new Set(grid.rows.flatMap(y => grid.columns.map(x => grid.cell(x, y).text)));
        const text = layoutPdfText(fragments).text;
        for (const [, grade] of normalizeMatrixText(text).matchAll(/\bvat (?:ly|li) (?:lop )?(10|11|12)\b/g)) {
            grades.add(Number(grade));
        }
        for (const line of text.split('\n')) labels.add(line);
        for (const label of labels) {
            const match = /^(phan (?:[ivx]+|\d+))\b(.*)$/.exec(normalizeMatrixText(label));
            if (!match || sectionName.test(match[2])) continue;
            const type = matrixQuestionType(match[2]);
            if (!type) continue;
            const types = sectionTypes.get(match[1]) ?? new Set();
            types.add(type);
            sectionTypes.set(match[1], types);
        }
    });

    pages.forEach((page, pageIndex) => {
        if (!page.fragments.length) {
            unreadPages.push(pageIndex + 1);
            return;
        }
        const grid = grids[pageIndex];
        const headerY = grid.rows.find(y => grid.columns.some(x => {
            const label = normalizeMatrixText(grid.cell(x, y).text);
            return outcomeHeader.test(label) || label === 'muc do danh gia';
        }));
        if (headerY === undefined) return;

        const labels = grid.columns.map(x => normalizeMatrixText(grid.cell(x, headerY).text));
        const exactOutcome = labels.findIndex(label => outcomeHeader.test(label));
        const outcomeColumn = grid.columns[exactOutcome >= 0 ? exactOutcome : labels.indexOf('muc do danh gia')];
        const header = grid.cell(outcomeColumn, headerY);
        const headerRows = grid.rows.filter(y => y > header.bottom && y < header.top);
        const body = grid.rows.filter(y => y < header.bottom);
        const topicColumns = grid.columns.filter((_, index) => topicHeader.test(labels[index]));
        const levelColumn = grid.columns[labels.findIndex((label, index) =>
            grid.columns[index] !== outcomeColumn && /^(?:muc do(?: danh gia| tu duy)?|cap do tu duy)$/.test(label))];
        const typeColumn = grid.columns[labels.findIndex(label => /^(?:loai cau(?: hoi)?|dang cau(?: hoi)?|hinh thuc)$/.test(label))];
        const sectionColumn = grid.columns[labels.indexOf('phan')];
        const logicalColumns = [...new Map(grid.columns.flatMap(x => {
            const cells = headerRows.map(y => grid.cell(x, y));
            const key = cells.map(cell => cell.key).join('|');
            return cells.some(cell => cell.text)
                ? [[key, { x, headers: [...new Set(cells.map(cell => cell.text).filter(Boolean))] }] as const] : [];
        })).values()];

        const seen = new Set<number>();
        for (const y of body) {
            const requirement = grid.cell(outcomeColumn, y);
            if (!requirement.text || seen.has(requirement.bottom)) continue;
            seen.add(requirement.bottom);
            const label = normalizeMatrixText(requirement.text);
            if (/^(?:tong|ti le|ty le)\b/.test(label)) continue;
            const topics = topicColumns.map(x => grid.cell(x, y).text).filter(value => value && !topicHeader.test(normalizeMatrixText(value)));
            topic = [...new Set(topics)].join(' · ') || topic;
            const headingLevel = matrixLevel(requirement.text);
            if (headingLevel) {
                currentLevel = headingLevel;
                continue;
            }
            const sectionCell = sectionColumn === undefined ? '' : grid.cell(sectionColumn, y).text;
            const typeCell = typeColumn === undefined ? '' : grid.cell(typeColumn, y).text;
            const rowLevel = (levelColumn === undefined ? 0 : matrixLevel(grid.cell(levelColumn, y).text)) || currentLevel;
            const entries = new Map<string, MatrixRow>();

            logicalColumns.forEach(({ x, headers }) => {
                const heading = headers.map(normalizeMatrixText);
                const genericObjective = headers.find(value => genericObjectiveHeader.test(normalizeMatrixText(value)));
                const part = headers.find(value => sectionName.test(normalizeMatrixText(value))) || sectionCell || genericObjective || '';
                const section = part.match(/phần\s+(?:[ivx]+|\d+)/i)?.[0] || part;
                const sectionKey = normalizeMatrixText(section);
                const headerType = matrixQuestionType(headers.join(' '));
                const knownTypes = sectionTypes.get(sectionKey);
                const sectionType = knownTypes?.size === 1 ? [...knownTypes][0] : '';
                const type = matrixQuestionType(typeCell) || headerType || sectionType;
                const columnLevel = heading.map(matrixLevel).find(Boolean) || rowLevel;
                const isReference = heading.some(value => referenceHeader.test(value));
                const isCount = !isReference && (heading.some(value => countHeader.test(value)) || !!headerType || !!genericObjective);
                if (!isCount && !isReference) return;
                const value = grid.cell(x, y).text;
                const refs = isReference ? matrixReferences(value) : [];
                const count = isCount && /^\d{1,2}$/.test(value) ? Number(value) : 0;
                if (!refs.length && !count) return;
                const key = `${sectionKey}:${type}:${columnLevel}`;
                const entry = entries.get(key) ?? {
                    section, topic, outcome: requirement.text, type, level: columnLevel, count: 0, references: [], page: pageIndex + 1,
                };
                entry.count += count;
                entry.references.push(...refs);
                entries.set(key, entry);
            });
            const values = [...entries.values()];
            // A reference and its count may be printed under different sections in the source.
            const onlyCount = values.find(entry => entry.count && !entry.references.length);
            const onlyRefs = values.find(entry => !entry.count && entry.references.length);
            if (values.length === 2 && onlyCount && onlyRefs && onlyCount.count === onlyRefs.references.length) {
                onlyCount.references = onlyRefs.references;
                onlyCount.sourceNote = `PDF ghi số lượng ở ${onlyCount.section || 'một cột'} và vị trí ở ${onlyRefs.section || 'cột khác'}. Hãy đối chiếu.`;
                values.splice(values.indexOf(onlyRefs), 1);
            }
            for (const entry of values) {
                entry.references = [...new Set(entry.references)];
                entry.count ||= entry.references.length;
                rows.push(entry);
            }
        }
    });
    return { rows, unreadPages, grades: [...grades].sort((a, b) => a - b) };
}
