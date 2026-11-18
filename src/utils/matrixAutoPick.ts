import { ENERGY_MATRIX_CHAPTER_ID } from './examMatrix';
import { energyCurriculumGoals, matchEnergyCurriculumGoal } from './energyCurriculum';
import { matchesMatrixPlanSlot, type MatrixPlanSlot } from './matrixPlan';

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

    for (const { slot } of order) {
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
