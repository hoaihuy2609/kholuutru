import { outcomeScore, type EnergyMatrixTopic, type MatrixMatchEvidence } from './examMatrix';

type GoalSeed = readonly [id: string, label: string, aliases?: readonly string[]];
type SourceEntry = readonly [source: string, goals: readonly GoalSeed[]];

const curriculum: Record<EnergyMatrixTopic, readonly SourceEntry[]> = {
    work: [
        ['Chế tạo mô hình đơn giản minh hoạ được định luật bảo toàn năng lượng, liên quan đến một số dạng năng lượng khác nhau.', [
            ['energy-model', 'Chế tạo mô hình đơn giản minh hoạ định luật bảo toàn năng lượng'],
        ]],
        ['Trình bày được ví dụ chứng tỏ có thể truyền năng lượng từ vật này sang vật khác bằng cách thực hiện công.', [
            ['work-transfer', 'Trình bày được ví dụ truyền năng lượng từ vật này sang vật khác bằng cách thực hiện công', [
                'Nêu được ví dụ về sự truyền năng lượng bằng cách thực hiện công',
                'Nhận biết được ví dụ truyền năng lượng bằng cách thực hiện công',
                'Nhận biết được hiện tượng truyền năng lượng giữa các vật thông qua tác dụng lực',
            ]],
        ]],
        ['Nêu được biểu thức tính công bằng tích của lực tác dụng và độ dịch chuyển theo phương của lực, nêu được đơn vị đo công là đơn vị đo năng lượng (với 1 J = 1 Nm); Tính được công trong một số trường hợp đơn giản.', [
            ['work-expression', 'Nêu được biểu thức tính công khi vật dịch chuyển theo phương của lực', [
                'Nêu được công thức tính công cơ học',
                'Nhận biết được công thức tính công của lực',
            ]],
            ['work-unit', 'Nêu được đơn vị đo công và mối liên hệ 1 J = 1 N·m', [
                'Nêu được đơn vị đo công',
                'Nhận biết được đơn vị đo công trong hệ SI',
                'Xác định được đơn vị của công cơ học',
            ]],
            ['work-calculate', 'Tính được công trong một số trường hợp đơn giản', [
                'Tính được công của lực',
                'Tính được công cơ học của lực tác dụng lên vật',
                'Vận dụng được công thức tính công của lực',
            ]],
        ]],
    ],
    'mechanical-energy': [
        ['Từ phương trình chuyển động thẳng biến đổi đều với vận tốc ban đầu bằng không, rút ra được động năng của vật có giá trị bằng công của lực tác dụng lên vật.', [
            ['work-kinetic', 'Rút ra được hệ thức giữa động năng và công của lực khi vật chuyển động thẳng biến đổi đều từ trạng thái nghỉ'],
        ]],
        ['Nêu được công thức tính thế năng trong trường trọng lực đều, vận dụng được trong một số trường hợp đơn giản.', [
            ['potential-expression', 'Nêu được công thức tính thế năng trong trường trọng lực đều', ['Nêu được công thức tính thế năng trọng trường']],
            ['potential-apply', 'Vận dụng được công thức thế năng trọng trường trong trường hợp đơn giản', ['Tính được thế năng trọng trường của vật']],
        ]],
        ['Phân tích được sự chuyển hoá động năng và thế năng của vật trong một số trường hợp đơn giản.', [
            ['energy-conversion', 'Phân tích được sự chuyển hoá giữa động năng và thế năng trong trường hợp đơn giản', [
                'Phân tích được sự chuyển hóa giữa động năng và thế năng của vật',
                'Mô tả được sự chuyển hóa giữa động năng và thế năng',
            ]],
        ]],
        ['Nêu được khái niệm cơ năng; phát biểu được định luật bảo toàn cơ năng và vận dụng được định luật bảo toàn cơ năng trong một số trường hợp đơn giản.', [
            ['mechanical-definition', 'Nêu được khái niệm cơ năng', ['Nhận biết được cơ năng là tổng động năng và thế năng']],
            ['mechanical-law', 'Phát biểu được định luật bảo toàn cơ năng', ['Nêu được định luật bảo toàn cơ năng']],
            ['mechanical-apply', 'Vận dụng được định luật bảo toàn cơ năng trong một số trường hợp đơn giản', [
                'Vận dụng được định luật bảo toàn cơ năng',
                'Áp dụng định luật bảo toàn cơ năng để giải bài tập',
                'Vận dụng được định luật bảo toàn cơ năng để tính vận tốc của vật',
                'Vận dụng được định luật bảo toàn cơ năng cho con lắc đơn',
            ]],
        ]],
    ],
    power: [
        ['Từ một số tình huống thực tế, thảo luận để nêu được ý nghĩa vật lí và định nghĩa công suất.', [
            ['power-meaning', 'Nêu được ý nghĩa vật lí của công suất từ tình huống thực tế', ['Nêu được ý nghĩa vật lí của công suất']],
            ['power-definition', 'Nêu được định nghĩa công suất từ tình huống thực tế', ['Nêu được định nghĩa công suất', 'Nêu được công thức định nghĩa công suất']],
        ]],
        ['Vận dụng được mối liên hệ công suất (hay tốc độ thực hiện công) với tích của lực và vận tốc trong một số tình huống thực tế.', [
            ['power-force-velocity', 'Vận dụng được mối liên hệ giữa công suất, lực và vận tốc trong tình huống thực tế', [
                'Tính được công suất từ lực và vận tốc',
                'Vận dụng được công thức công suất bằng tích của lực và vận tốc',
            ]],
        ]],
        ['Từ tình huống thực tế, thảo luận để nêu được định nghĩa hiệu suất, vận dụng được hiệu suất trong một số trường hợp thực tế.', [
            ['efficiency-definition', 'Nêu được định nghĩa hiệu suất từ tình huống thực tế', ['Nêu được định nghĩa hiệu suất']],
            ['efficiency-apply', 'Vận dụng được hiệu suất trong một số trường hợp thực tế', ['Tính được hiệu suất', 'Vận dụng được công thức tính hiệu suất']],
        ]],
    ],
};

export interface EnergyCurriculumGoal {
    id: string;
    label: string;
    source: string;
    aliases: readonly string[];
}

const goalsByTopic = new Map(Object.entries(curriculum).map(([topic, entries]) => [
    topic,
    entries.flatMap(([source, seeds]): EnergyCurriculumGoal[] => seeds.map(([id, label, aliases = []]) => ({ id, label, source, aliases }))),
]));
const noGoals: readonly EnergyCurriculumGoal[] = [];

export function energyCurriculumGoals(topic: string): readonly EnergyCurriculumGoal[] {
    return goalsByTopic.get(topic) ?? noGoals;
}

export function matchEnergyCurriculumGoal(goal: EnergyCurriculumGoal, outcomes: readonly string[]) {
    let best: MatrixMatchEvidence | undefined;
    for (const outcome of outcomes) {
        const score = Math.max(outcomeScore(goal.label, outcome),
            ...goal.aliases.map(alias => Math.min(0.9, outcomeScore(alias, outcome))));
        if (score > (best?.score ?? 0)) {
            best = { rowIndex: 0, lineIndex: 0, requirement: goal.label, outcome, score };
        }
        if (score === 1) break;
    }
    return best ? { score: best.score, evidence: [best] } : { score: 0, evidence: [] };
}
