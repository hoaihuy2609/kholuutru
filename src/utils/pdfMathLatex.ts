const superscripts = '⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾';
const subscripts = '₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎';
const scriptValues = '0123456789+-=()';
const vectorMarks = '\u20D6\u20D7';

// Keep this opt-in: superscript glyphs can also be footnote markers.
const annotatedSymbol = new RegExp(
    '(?<![\\p{L}\\p{N}_])([A-Za-zµα-ωΑ-Ω]+|\\d+(?:[.,]\\d+)?)([' + superscripts + subscripts + vectorMarks + ']+)',
    'gu',
);
const mathSpan = /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$[^$\n]+\$)/g;
const greek: Record<string, string> = {
    µ: '\\mu', μ: '\\mu', α: '\\alpha', β: '\\beta', γ: '\\gamma',
    Δ: '\\Delta', θ: '\\theta', λ: '\\lambda', π: '\\pi', ρ: '\\rho',
    σ: '\\sigma', φ: '\\phi', ω: '\\omega', Ω: '\\Omega',
};
const units = new Set(['cm', 'mm', 'km', 'dm', 'ms', 'kg', 'mol']);

export function convertPdfMathToLatex(text: string) {
    return text.split(mathSpan).map((segment, index) => index % 2 === 1 ? segment
        : segment.replace(annotatedSymbol, (original, base: string, marks: string) => {
            let above = '';
            let below = '';
            let arrow = '';
            for (const mark of marks) {
                if (superscripts.includes(mark)) above += scriptValues[superscripts.indexOf(mark)];
                else if (subscripts.includes(mark)) below += scriptValues[subscripts.indexOf(mark)];
                else if (arrow) return original;
                else arrow = mark === '\u20D7' ? '\\vec' : '\\overleftarrow';
            }
            // A word or a symbol we cannot represent safely stays as it was.
            const isUnit = units.has(base);
            const symbol = greek[base] ?? (isUnit ? '\\mathrm{' + base + '}'
                : /^(?:[A-Za-z]|\d+(?:[.,]\d+)?)$/.test(base) ? base : '');
            if (!symbol || (arrow && (isUnit || /^\d/.test(base)))) return original;
            const latex = (arrow ? arrow + '{' + symbol + '}' : symbol)
                + (below ? '_{' + below + '}' : '') + (above ? '^{' + above + '}' : '');
            return '$' + latex + '$';
        })).join('');
}
