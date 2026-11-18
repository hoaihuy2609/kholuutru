import { ENERGY_MATRIX_CHAPTER_ID } from './examMatrix';
import { energyCurriculumGoals, matchEnergyCurriculumGoal } from './energyCurriculum';
import { fitsCounts, matchesMatrixPlanSlot, subtractCounts, trueFalseCounts, trueFalseGroup, type MatrixPlanSlot, type StatementCounts } from './matrixPlan';

type Candidate = Parameters<typeof matchesMatrixPlanSlot>[1] & { item: { id: string }; outcomes: readonly string[] };

export interface AutoPick {
    questionId: string;
    curriculumId?: string;
    pickedOutcome?: string;
}

export interface AutoPickOptions {
    /** Question ids already used by other slots. */
    used?: Iterable<string>;
    /** How many slots already use each curriculum goal, to spread new picks over the goals. */
    goalUsage?: ReadonlyMap<string, number>;
    /** Goal the teacher already chose for a slot; it is honoured when it has matching questions. */
    preferredGoal?: ReadonlyMap<string, string>;
    /** Extra condition per slot, e.g. the textbook lesson the teacher picked. */
    accepts?: (slot: MatrixPlanSlot, candidate: Candidate) => boolean;
    /** True-false statements per level already taken by chosen questions that stay, keyed by trueFalseGroup. */
    reservedStatements?: ReadonlyMap<string, StatementCounts>;
    /** Question ids to skip when another question is available (re-roll). */
    avoid?: Iterable<string>;
    rng?: () => number;
}

/**
 * Picks one question per slot at random among valid ones: right topic, level and format,
 * not used elsewhere, and spread over the curriculum goals that still have the fewest picks.
 * Slots with the fewest options go first so scarce slots are not starved.
 */
export function autoPickMatrixPlan<T extends Candidate>(
    targets: readonly MatrixPlanSlot[], candidates: readonly T[], options: AutoPickOptions = {},
) {
    const rng = options.rng ?? Math.random;
    const used = new Set(options.used);
    const avoid = new Set(options.avoid);
    const usage = new Map(options.goalUsage);
    const pick = <V,>(list: readonly V[]) => list[Math.floor(rng() * list.length)];
    const eligibleFor = (slot: MatrixPlanSlot) => candidates.filter(candidate => !used.has(candidate.item.id) && matchesMatrixPlanSlot(slot, candidate)
        && (!options.accepts || options.accepts(slot, candidate)));
    const order = targets.filter(slot => slot.canChoose)
        .map(slot => ({ slot, count: eligibleFor(slot).length })).sort((a, b) => a.count - b.count);
    const picks = new Map<string, AutoPick>();
    const unfilled: string[] = [];

    // True-false questions of one content are chosen together: their statement levels must add up to the content's total.
    const trueFalse = new Map<string, MatrixPlanSlot[]>();
    for (const slot of targets) {
        if (!slot.canChoose || !slot.statementBudget) continue;
        trueFalse.set(trueFalseGroup(slot), [...(trueFalse.get(trueFalseGroup(slot)) ?? []), slot]);
    }
    for (const [group, slots] of trueFalse) {
        const remaining = subtractCounts(slots[0].statementBudget!, [options.reservedStatements?.get(group) ?? [0, 0, 0]]);
        const pool = slots.map(slot => {
            const all = eligibleFor(slot).flatMap(candidate => {
                const counts = trueFalseCounts(candidate.item as Parameters<typeof trueFalseCounts>[0]);
                return counts ? [{ candidate, counts }] : [];
            });
            // Prefer questions other than the ones being replaced, then shuffle.
            return [...all].map(entry => ({ entry, key: (avoid.has(entry.candidate.item.id) ? 1 : 0) + rng() }))
                .sort((a, b) => a.key - b.key).map(({ entry }) => entry);
        });
        const chosen: { candidate: T; counts: StatementCounts }[] = [];
        const taken = new Set<string>();
        const search = (index: number, left: StatementCounts): boolean => {
            if (index === slots.length) return true;
            const tried = new Set<string>();
            for (const option of pool[index]) {
                const pattern = option.counts.join(',');
                if (tried.has(pattern) || taken.has(option.candidate.item.id) || !fitsCounts(left, option.counts)) continue;
                tried.add(pattern);
                chosen.push(option);
                taken.add(option.candidate.item.id);
                if (search(index + 1, subtractCounts(left, [option.counts]))) return true;
                chosen.pop();
                taken.delete(option.candidate.item.id);
            }
            return false;
        };
        if (!search(0, remaining)) { unfilled.push(...slots.map(slot => slot.id)); continue; }
        slots.forEach((slot, index) => {
            used.add(chosen[index].candidate.item.id);
            picks.set(slot.id, { questionId: chosen[index].candidate.item.id });
        });
    }

    for (const { slot } of order) {
        if (slot.statementBudget) continue;
        const all = eligibleFor(slot);
        const fresh = all.filter(candidate => !avoid.has(candidate.item.id));
        const eligible = fresh.length ? fresh : all;
        if (!eligible.length) { unfilled.push(slot.id); continue; }
        const preferred = options.preferredGoal?.get(slot.id);
        const goals = slot.chapterId === ENERGY_MATRIX_CHAPTER_ID ? energyCurriculumGoals(slot.topicId) : [];
        const byGoal = goals.filter(goal => !preferred || goal.id === preferred).flatMap(goal => {
            const matches = eligible.flatMap(candidate => {
                const match = matchEnergyCurriculumGoal(goal, candidate.outcomes);
                return match.score > 0 ? [{ candidate, outcome: match.evidence[0]?.outcome }] : [];
            });
            return matches.length ? [{ goal, matches }] : [];
        });
        let chosen: { candidate: T; outcome?: string };
        let curriculumId: string | undefined;
        if (byGoal.length) {
            const fewest = Math.min(...byGoal.map(({ goal }) => usage.get(goal.id) ?? 0));
            const group = pick(byGoal.filter(({ goal }) => (usage.get(goal.id) ?? 0) === fewest));
            chosen = pick(group.matches);
            curriculumId = group.goal.id;
            usage.set(curriculumId, fewest + 1);
        } else {
            chosen = { candidate: pick(eligible) };
        }
        used.add(chosen.candidate.item.id);
        picks.set(slot.id, { questionId: chosen.candidate.item.id, curriculumId, pickedOutcome: chosen.outcome });
    }
    return { picks, unfilled };
}
