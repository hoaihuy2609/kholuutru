export const COGNITIVE_LEVELS = ['Chưa phân loại', 'Nhận biết', 'Thông hiểu', 'Vận dụng'] as const;
export type CognitiveLevel = 1 | 2 | 3;

export function readCognitiveLevel(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 4
    ? Math.min(value, 3) : 0;
}

type LeveledQuestion = {
  type?: string; cognitive_level?: unknown; level?: number;
  statements?: readonly { cognitive_level?: unknown; label?: string }[];
};

export function questionLevels(question: LeveledQuestion | undefined, fallback?: number): number[] {
  const defaultLevel = readCognitiveLevel(question?.cognitive_level ?? fallback ?? question?.level);
  if (question?.type === 'dung_sai' && question.statements?.length) {
    return question.statements.map(statement => statement.cognitive_level === undefined ? defaultLevel : readCognitiveLevel(statement.cognitive_level));
  }
  return [defaultLevel];
}

export function questionLevel(question: LeveledQuestion | undefined, fallback?: number): number {
  const levels = questionLevels(question, fallback);
  return levels.every(level => level === levels[0]) ? levels[0] : 0;
}

export function questionLevelLabel(question: LeveledQuestion | undefined, fallback?: number): string {
  const levels = [...new Set(questionLevels(question, fallback))];
  return levels.length === 1 ? COGNITIVE_LEVELS[levels[0]] : levels.map(level => COGNITIVE_LEVELS[level]).join(' / ');
}
