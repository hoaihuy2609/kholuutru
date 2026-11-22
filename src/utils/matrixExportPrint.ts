import katex from 'katex';
import katexStyles from 'katex/dist/katex.min.css?inline';
import { MATRIX_LEVELS } from './examMatrix';
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
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const colors: Record<MatrixExportType, string> = {
    trac_nghiem: 'blue', dung_sai: 'violet', tu_luan: 'amber', written: 'green',
};

export function matrixExportHtml(document: MatrixExportDocument, draft = false) {
    const { settings, formats, topics, units } = document;
    const hasStatements = formats.some(format => format.type === 'dung_sai');
    const blueprintRows: string[] = [];
    const chapterIds = [...new Set(topics.map(topic => topic.chapterId))];
    const orderedTopics = chapterIds.flatMap(chapterId => topics.filter(topic => topic.chapterId === chapterId));
    for (const [chapterIndex, chapterId] of chapterIds.entries()) {
        const chapterTopics = orderedTopics.filter(topic => topic.chapterId === chapterId);
        for (const [index, topic] of chapterTopics.entries()) {
            blueprintRows.push(`<tr>${index === 0 ? `<td rowspan="${chapterTopics.length}">${chapterIndex + 1}</td>
                <th class="left chapter" rowspan="${chapterTopics.length}">${text(topic.chapter)}</th>` : ''}
                <th class="left">${text(topic.topic)}</th><td>${topic.periods === undefined ? '-' : n(topic.periods)}</td>
                ${formats.map(({ type }) => [1, 2, 3].map(level => `<td class="${colors[type]}">${topic.actual[type][level] || '-'}</td>`).join('')).join('')}
                <td>${sum(Object.values(topic.actual).flat())}</td></tr>`);
        }
    }
    const totals = formats.map(({ type }) => [1, 2, 3].map(level => units.filter(unit => unit.type === type && unit.level === level).length));
    const points = formats.map(({ type }) => sum(units.filter(unit => unit.type === type).map(unit => unit.points)));
    const specification: string[] = [];
    const widthCount = 3 + formats.length * 2;
    let topicNumber = 0;
    for (const chapterId of chapterIds) {
        const chapterTopics = orderedTopics.filter(topic => topic.chapterId === chapterId);
        const totalPeriods = sum(chapterTopics.map(topic => topic.periods ?? 0));
        const periodsComplete = chapterTopics.every(topic => topic.periods !== undefined);
        specification.push(`<tr class="chapter-band"><th colspan="${widthCount}" class="left">${text(chapterTopics[0].chapter)}${periodsComplete ? ' - ' + n(totalPeriods) + ' tiết' : ''}</th></tr>`);
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
                    specification.push(`<tr class="level-row">${frame()}<td class="left"><strong>${text(MATRIX_LEVELS[row.level])}:</strong></td>
                        ${formats.map(() => '<td></td><td></td>').join('')}</tr>`);
                    previousLevel = row.level;
                }
                specification.push(`<tr>${frame()}<td class="left outcome">${text(row.outcome || 'Chưa xác định YCCĐ')}</td>
                    ${formats.map(({ type }) => `<td>${row.references[type].length || '-'}</td>`).join('')}
                    ${formats.map(({ type }) => `<td class="references">${row.references[type].map(escape).join(', ') || '-'}</td>`).join('')}</tr>`);
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
            <p>Mức độ: ${[1, 2, 3].map(level => text(MATRIX_LEVELS[level]) + ' ' + n(document.totalScore ? document.levelScores[level] / document.totalScore * 100 : 0) + '%').join('; ')}.</p></div>
            <table class="blueprint"><colgroup><col style="width:3%"><col style="width:14%"><col style="width:20%"><col style="width:4%">
            ${formats.map(() => [1, 2, 3].map(() => `<col style="width:${53 / (formats.length * 3)}%">`).join('')).join('')}<col style="width:6%"></colgroup>
            <thead><tr><th rowspan="3">TT</th><th rowspan="3">Chương/<br>chủ đề</th><th rowspan="3">Nội dung/<br>đơn vị kiến thức</th><th rowspan="3">Số<br>tiết</th><th colspan="${formats.length * 3}">Số câu hỏi/ý ở các mức độ đánh giá</th><th rowspan="3">Tổng<br>câu/ý</th></tr>
            <tr>${formats.map(({ type, label, part }) => `<th colspan="3" class="${colors[type]}">Phần ${part}<br>${text(label)}${type === 'dung_sai' ? ' (ý)' : ''}</th>`).join('')}</tr>
            <tr>${formats.map(({ type }) => [1, 2, 3].map(level => `<th class="${colors[type]}">${text(MATRIX_LEVELS[level])}</th>`).join('')).join('')}</tr></thead>
            <tbody>${blueprintRows.join('')}</tbody><tbody class="totals">
            <tr><th colspan="4" class="left">Tổng số câu/ý theo mức độ</th>${totals.map((counts, index) => counts.map(count => `<td class="${colors[formats[index].type]}">${count}</td>`).join('')).join('')}<td>${document.unitCount}</td></tr>
            <tr><th colspan="4" class="left">Tổng theo loại câu</th>${formats.map(({ type }) => `<td colspan="3">${document.typeQuestionCounts[type]} câu${type === 'dung_sai' ? ' / ' + units.filter(unit => unit.type === type).length + ' ý' : ''}</td>`).join('')}<td>${document.questionCount} câu</td></tr>
            <tr><th colspan="4" class="left">Tổng điểm</th>${points.map(point => `<td colspan="3">${n(point)}</td>`).join('')}<td>${n(document.totalScore)}</td></tr>
            </tbody></table>
            <table class="level-summary"><thead><tr><th>Cấp độ nhận thức</th>${[1, 2, 3].map(level => `<th>${text(MATRIX_LEVELS[level])}</th>`).join('')}<th>Tổng</th></tr></thead>
            <tbody><tr><th class="left">Số câu/ý</th>${[1, 2, 3].map(level => `<td>${document.levelCounts[level]}</td>`).join('')}<td>${document.unitCount}</td></tr>
            <tr><th class="left">Số điểm</th>${[1, 2, 3].map(level => `<td>${n(document.levelScores[level])}</td>`).join('')}<td>${n(document.totalScore)}</td></tr>
            <tr><th class="left">Tỉ lệ điểm (%)</th>${[1, 2, 3].map(level => `<td>${n(document.totalScore ? document.levelScores[level] / document.totalScore * 100 : 0)}</td>`).join('')}<td>${document.totalScore ? '100' : '0'}</td></tr></tbody></table>
            <p class="note">${formats.map(({ type, label }) => text(label) + ': ' + n(settings.points[type]) + ' điểm/câu').join('; ')}.
            ${hasStatements ? 'Điểm Đúng/Sai được phân bổ đều cho 4 ý để tính tỉ lệ mức độ trong ma trận; khi chấm, mỗi câu Đúng/Sai tính theo số ý đúng: 1 ý 0,1 điểm; 2 ý 0,25 điểm; 3 ý 0,5 điểm; 4 ý 1 điểm.' : ''}</p>${warnings}
        </section>
        <section class="specification-section"><h2>II. BẢN ĐẶC TẢ ĐỀ KIỂM TRA</h2>
            <table class="specification"><colgroup><col style="width:4%"><col style="width:17%"><col style="width:40%">
            ${formats.map(() => `<col style="width:${countWidth}%">`).join('')}${formats.map(() => `<col style="width:${referenceWidth}%">`).join('')}</colgroup>
            <thead><tr><th rowspan="2">STT</th><th rowspan="2">Nội dung/<br>đơn vị kiến thức</th><th rowspan="2">Mức độ đánh giá / Yêu cầu cần đạt</th><th colspan="${formats.length}">Số câu/ý</th><th colspan="${formats.length}">Mã câu/ý trong đề</th></tr>
            <tr>${[0, 1].map(() => formats.map(({ type, part }) => `<th class="${colors[type]}">Phần ${part}</th>`).join('')).join('')}</tr></thead>
            <tbody>${specification.join('')}</tbody><tbody class="totals"><tr><th colspan="3" class="left">Tổng số câu/ý</th>${formats.map(({ type }) => `<td>${units.filter(unit => unit.type === type).length}</td>`).join('')}<td colspan="${formats.length}">${document.questionCount} câu / ${document.unitCount} câu, ý</td></tr></tbody></table>
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
        .merged { border-top-style: hidden; }
        .chapter { background: #f3f6fa; }
        .chapter-band { background: #e9e7f5; break-after: avoid; }
        .blue { background: #e5effc; } .violet { background: #efe7fc; }
        .amber { background: #fff2cf; } .green { background: #dbf3e7; }
        .totals { background: #f0f4f8; font-weight: bold; break-inside: avoid; }
        .level-summary { width: 66%; margin-top: 3mm; break-inside: avoid; }
        .level-summary th:first-child { width: 38%; }
        .note { font-size: 9.5pt; margin-top: 2mm; }
        .outcome { line-height: 1.3; }
        .level-row td:nth-child(n+3) { background: #f7f5ee; }
        .level-row { break-after: avoid; }
        .references { font-weight: bold; }
        .draft-banner, .draft-note { padding: 2mm; border: .3mm solid #b45309; color: #92400e; }
        .draft-banner { text-align: center; font-weight: bold; }
        .draft-note { font-size: 10pt; margin-top: 3mm; }
        .specification-section { break-before: page; }
        .katex { font-size: 1em; } .katex-display { margin: 1mm 0; }
        @media screen { body { width: 297mm; min-height: 210mm; padding: 12mm 10mm 14mm; } .specification-section { margin-top: 12mm; border-top: 1px dashed #aaa; padding-top: 3mm; } }
        @media print { * { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
    </style></head><body>${body}</body></html>`;
}
