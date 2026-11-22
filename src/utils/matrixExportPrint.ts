import katex from 'katex';
import katexStyles from 'katex/dist/katex.min.css?inline';
import { matrixSpecificationRows, type MatrixExportDocument, type MatrixExportType } from './matrixExport';

const escape = (text: string) => text.replace(/[&<>"']/g, char =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const text = (value: string) => value.split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\])/g)
    .map((part, index) => {
        if (index % 2 === 0) return escape(part).replace(/\n/g, '<br>');
        const displayMode = part.startsWith('$$') || part.startsWith('\\[');
        const delimiterLength = part.startsWith('$') && !displayMode ? 1 : 2;
        return katex.renderToString(part.slice(delimiterLength, -delimiterLength), { displayMode, throwOnError: false, trust: false });
    }).join('');
export const matrixExportNumber = (number: number) => Number.isFinite(number)
    ? new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 4 }).format(number) : '-';
const n = matrixExportNumber;
/** Tỉ lệ phần trăm, 1 chữ số thập phân. */
const pct = (number: number) => Number.isFinite(number)
    ? new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(number) : '-';
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
/** Tên mức theo mẫu Công văn 7991. */
const LEVELS = ['', 'Biết', 'Hiểu', 'Vận dụng'];
const colors: Record<MatrixExportType, string> = {
    trac_nghiem: 'blue', dung_sai: 'violet', tu_luan: 'amber', written: 'green',
};

export interface MatrixExportHtmlOptions {
    /** Bản rà soát trên màn hình: ô YCCĐ gõ sửa được, mã câu bấm được. Không dùng khi in. */
    editable?: boolean;
    /** Khóa câu/ý đã được giáo viên sửa YCCĐ tay (đánh dấu trên màn hình). */
    edited?: ReadonlySet<string>;
}

export function matrixExportHtml(document: MatrixExportDocument, draft = false, options: MatrixExportHtmlOptions = {}) {
    const { editable = false, edited } = options;
    const { settings, formats, topics, units } = document;
    const hasStatements = formats.some(format => format.type === 'dung_sai');
    const blueprintRows: string[] = [];
    const chapterIds = [...new Set(topics.map(topic => topic.chapterId))];
    const orderedTopics = chapterIds.flatMap(chapterId => topics.filter(topic => topic.chapterId === chapterId));
    const percent = (points: number) => pct(document.totalScore ? points / document.totalScore * 100 : 0);
    for (const [chapterIndex, chapterId] of chapterIds.entries()) {
        const chapterTopics = orderedTopics.filter(topic => topic.chapterId === chapterId);
        for (const [index, topic] of chapterTopics.entries()) {
            const levelTotal = (level: number) => sum(formats.map(({ type }) => topic.actual[type][level]));
            blueprintRows.push(`<tr>${index === 0 ? `<td rowspan="${chapterTopics.length}">${chapterIndex + 1}</td>
                <th class="left chapter" rowspan="${chapterTopics.length}">${text(topic.chapter)}</th>` : ''}
                <th class="left">${text(topic.topic)}</th>
                ${formats.map(({ type }) => [1, 2, 3].map(level => `<td class="${colors[type]}">${topic.actual[type][level] || ''}</td>`).join('')).join('')}
                ${[1, 2, 3].map(level => `<td>${levelTotal(level) || ''}</td>`).join('')}
                <td>${percent(sum(topic.units.map(unit => unit.points)))}</td></tr>`);
        }
    }
    const totals = formats.map(({ type }) => [1, 2, 3].map(level => units.filter(unit => unit.type === type && unit.level === level).length));
    const points = formats.map(({ type }) => sum(units.filter(unit => unit.type === type).map(unit => unit.points)));
    const specification: string[] = [];
    const widthCount = 3 + formats.length * 2;
    let topicNumber = 0;
    for (const chapterId of chapterIds) {
        const chapterTopics = orderedTopics.filter(topic => topic.chapterId === chapterId);
        specification.push(`<tr class="chapter-band"><th colspan="${widthCount}" class="left">${text(chapterTopics[0].chapter)}</th></tr>`);
        for (const topic of chapterTopics) {
            topicNumber++;
            const rows = matrixSpecificationRows(topic.units);
            let previousLevel = 0;
            let first = true;
            // One frame per content: only its first row carries the number and name; the next rows leave those cells
            // empty with a hidden top border. Avoids tall rowspan cells, which Chromium may push to an almost empty page.
            const frame = () => {
                const cells = first ? `<td>${topicNumber}</td><th class="left">${text(topic.topic)}</th>` : '<td class="merged"></td><th class="left merged"></th>';
                first = false;
                return cells;
            };
            for (const row of rows) {
                // Each level has its own heading row; its requirements follow, one per row.
                if (row.level !== previousLevel) {
                    specification.push(`<tr class="level-row">${frame()}<td class="left"><strong>${text(LEVELS[row.level])}:</strong></td>
                        ${formats.map(() => '<td></td><td></td>').join('')}</tr>`);
                    previousLevel = row.level;
                }
                const editedRow = editable && row.units.some(unit => edited?.has(unit.key));
                const cellAttributes = editable ? ` contenteditable="true" spellcheck="false" title="Bấm để sửa YCCĐ của cả dòng"`
                    + ` data-keys="${escape(row.units.map(unit => unit.key).join('\n'))}" data-raw="${escape(row.outcome)}"` : '';
                const references = (type: MatrixExportType) => editable
                    ? row.units.filter(unit => unit.type === type).map(unit => `<span class="ref" data-question="${escape(unit.questionId)}" title="Xem câu này trong đề">${escape(unit.reference)}</span>`).join(', ')
                    : row.references[type].map(escape).join(', ');
                specification.push(`<tr${editedRow ? ' class="edited"' : ''}>${frame()}<td class="left outcome"${cellAttributes}>${text(row.outcome || 'Chưa xác định YCCĐ')}</td>
                    ${formats.map(({ type }) => `<td>${row.references[type].length || '-'}</td>`).join('')}
                    ${formats.map(({ type }) => `<td class="references">${references(type) || '-'}</td>`).join('')}</tr>`);
            }
            if (!rows.length) specification.push(`<tr><td>${topicNumber}</td><th class="left">${text(topic.topic)}</th><td class="left">Chưa chọn câu.</td>${formats.map(() => '<td>-</td><td>-</td>').join('')}</tr>`);
        }
    }
    const countWidth = formats.length === 1 ? 12 : 6;
    const referenceWidth = (100 - 4 - 17 - 40 - formats.length * countWidth) / formats.length;
    const warnings = draft && document.issues.length
        ? `<aside class="draft-note"><strong>BẢN NHÁP - chưa chốt theo ma trận phân bổ.</strong><br>${document.issues.map(text).join('<br>')}</aside>` : '';
    const scope = settings.scope.trim() || [...new Set(topics.map(topic => topic.chapter))].join('; ');
    const body = `<header class="document-header">
            ${settings.school.trim() ? `<p class="school">${text(settings.school)}</p>` : ''}
            <h1>MA TRẬN VÀ BẢN ĐẶC TẢ<br>${text(settings.title)}</h1>
        </header>${draft ? '<p class="draft-banner">BẢN NHÁP - SỐ LIỆU THEO CÂU ĐÃ CHỌN</p>' : ''}
        <section class="matrix-section"><h2>I. MA TRẬN ĐỀ KIỂM TRA</h2>
            <div class="exam-info"><p>Thời gian làm bài: ${n(settings.duration)} phút. Môn: Vật lí. Lớp: 10.${settings.examCode.trim() ? ' Mã đề: ' + text(settings.examCode) + '.' : ''}</p>
            ${settings.assessmentTime.trim() ? `<p>Thời điểm kiểm tra: ${text(settings.assessmentTime)}</p>` : ''}
            <p>Nội dung/phạm vi kiểm tra: ${text(scope)}</p>
            <p>Cấu trúc: ${document.questionCount} câu${hasStatements ? ', ' + document.unitCount + ' câu/ý được đánh giá' : ''}; ${n(document.totalScore)} điểm.</p>
            <p>Mức độ: ${[1, 2, 3].map(level => text(LEVELS[level]) + ' ' + pct(document.totalScore ? document.levelScores[level] / document.totalScore * 100 : 0) + '%').join('; ')}.</p></div>
            <table class="blueprint"><colgroup><col style="width:3%"><col style="width:12%"><col style="width:17%">
            ${Array.from({ length: formats.length * 3 + 3 }, () => `<col style="width:${62 / (formats.length * 3 + 3)}%">`).join('')}<col style="width:6%"></colgroup>
            <thead><tr><th rowspan="3">TT</th><th rowspan="3">Chủ đề/<br>Chương</th><th rowspan="3">Nội dung/<br>đơn vị kiến thức</th><th colspan="${formats.length * 3}">Mức độ đánh giá</th><th colspan="3" rowspan="2">Tổng</th><th rowspan="3">Tỷ lệ<br>%<br>điểm</th></tr>
            <tr>${formats.map(({ type, label }) => `<th colspan="3" class="type-head ${colors[type]}">${text(label)}</th>`).join('')}</tr>
            <tr>${formats.map(({ type }) => [1, 2, 3].map(level => `<th class="${colors[type]}">${LEVELS[level]}</th>`).join('')).join('')}${[1, 2, 3].map(level => `<th>${LEVELS[level]}</th>`).join('')}</tr></thead>
            <tbody>${blueprintRows.join('')}</tbody><tbody class="totals">
            <tr><th colspan="3" class="right">Tổng số câu/lệnh hỏi</th>${totals.map((counts, index) => counts.map(count => `<td class="${colors[formats[index].type]}">${count}</td>`).join('')).join('')}${[1, 2, 3].map(level => `<td>${document.levelCounts[level]}</td>`).join('')}<td class="blank"></td></tr>
            <tr><th colspan="3" class="right">Tổng số điểm</th>${points.map(point => `<td colspan="3">${n(point)}</td>`).join('')}${[1, 2, 3].map(level => `<td>${n(document.levelScores[level])}</td>`).join('')}<td></td></tr>
            <tr><th colspan="3" class="right">Tỷ lệ %</th>${points.map(point => `<td colspan="3">${percent(point)}</td>`).join('')}${[1, 2, 3].map(level => `<td>${percent(document.levelScores[level])}</td>`).join('')}<td></td></tr>
            </tbody></table>${warnings}
        </section>
        <section class="specification-section"><h2>II. BẢN ĐẶC TẢ ĐỀ KIỂM TRA</h2>
            <table class="specification"><colgroup><col style="width:4%"><col style="width:17%"><col style="width:40%">
            ${formats.map(() => `<col style="width:${countWidth}%">`).join('')}${formats.map(() => `<col style="width:${referenceWidth}%">`).join('')}</colgroup>
            <thead><tr><th rowspan="2">STT</th><th rowspan="2">Nội dung/<br>đơn vị kiến thức</th><th rowspan="2">Mức độ đánh giá / Yêu cầu cần đạt</th><th colspan="${formats.length}">Số câu/ý</th><th colspan="${formats.length}">Mã câu/ý trong đề</th></tr>
            <tr>${[0, 1].map(() => formats.map(({ type, label }) => `<th class="type-head ${colors[type]}">${text(label)}</th>`).join('')).join('')}</tr></thead>
            <tbody>${specification.join('')}</tbody><tbody class="totals"><tr><th colspan="3" class="left">Tổng số câu/ý</th>${formats.map(({ type }) => `<td>${units.filter(unit => unit.type === type).length}</td>`).join('')}<td colspan="${formats.length}">${document.questionCount} câu / ${document.unitCount} câu, ý</td></tr></tbody></table>
            <p class="parts-note">Mã câu/ý đánh số theo từng phần của đề: ${formats.map(({ part, label }) => 'Phần ' + part + ' – ' + text(label)).join('; ')}.</p>
        </section>`;
    return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${escape(settings.title)} - Ma trận và đặc tả${draft ? ' - Bản nháp' : ''}</title><style>
        ${katexStyles}
        @page { size: A4 landscape; margin: 12mm 10mm 14mm; @bottom-center { content: "Trang " counter(page); font: italic 10pt "Times New Roman", serif; } }
        * { box-sizing: border-box; }
        body { margin: 0; color: #17243b; background: white; font: 11pt/1.25 "Times New Roman", serif; }
        h1 { margin: 0 0 3mm; text-align: center; font-size: 15pt; line-height: 1.25; }
        h2 { font-size: 12pt; margin: 2mm 0; break-after: avoid; }
        p { margin: .6mm 0; }
        .school { text-align: center; font-weight: bold; margin-bottom: 2mm; }
        .code { text-align: right; }
        .exam-info { margin-bottom: 3mm; }
        table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 10.5pt; }
        th, td { border: .25mm solid #73849c; padding: 1.1mm 1mm; text-align: center; vertical-align: middle; overflow-wrap: anywhere; }
        th { font-weight: bold; }
        thead { display: table-header-group; background: #e0f2f1; }
        tr { break-inside: avoid; }
        .left { text-align: left; }
        .right { text-align: right; }
        .blank { background: #d9d9d9; }
        .merged { border-top-style: hidden; }
        .chapter { background: #f3f6fa; }
        .chapter-band { background: #e9e7f5; break-after: avoid; }
        .blue { background: #e5effc; } .violet { background: #efe7fc; }
        .amber { background: #fff2cf; } .green { background: #dbf3e7; }
        .totals { background: #f0f4f8; font-weight: bold; break-inside: avoid; }
        .level-summary { width: 66%; margin-top: 3mm; break-inside: avoid; }
        .level-summary th:first-child { width: 38%; }
        .note { font-size: 9.5pt; margin-top: 2mm; }
        td.outcome { line-height: 1.3; text-align: justify; }
        .type-head { font-style: italic; font-weight: normal; }
        .parts-note { font-size: 9.5pt; margin-top: 2mm; }
        .level-row td:nth-child(n+3) { background: #f7f5ee; }
        .level-row { break-after: avoid; }
        .references { font-weight: bold; }
        .draft-banner, .draft-note { padding: 2mm; border: .3mm solid #b45309; color: #92400e; }
        .draft-banner { text-align: center; font-weight: bold; }
        .draft-note { font-size: 10pt; margin-top: 3mm; }
        .specification-section { break-before: page; }
        .katex { font-size: 1em; } .katex-display { margin: 1mm 0; }
        @media screen { body { width: 297mm; min-height: 210mm; padding: 12mm 10mm 14mm; } .specification-section { margin-top: 12mm; border-top: 1px dashed #aaa; padding-top: 3mm; } }
        ${editable ? `@media screen {
            .outcome[contenteditable] { cursor: text; outline: 1px dashed #d6b37a; outline-offset: -2px; }
            .outcome[contenteditable]:hover { background: #fffbeb; }
            .outcome[contenteditable]:focus { outline: 2px solid #b45309; background: #fff; }
            tr.edited > .outcome { box-shadow: inset 4px 0 0 #d97706; }
            .ref { cursor: pointer; text-decoration: underline dotted; text-underline-offset: 2px; }
            .ref:hover { color: #92400e; }
            .hl { background: #fde68a !important; }
            tr.hl-row > td, tr.hl-row > th { background: #fef3c7 !important; }
        }` : ''}
        @media print { * { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
    </style></head><body>${body}</body></html>`;
}
