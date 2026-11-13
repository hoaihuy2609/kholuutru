export interface QuestionTableData {
  headers: string[];
  rows: string[][];
}

export function normalizeQuestionTable(value: unknown): QuestionTableData | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const { headers, rows } = value as Record<string, unknown>;
  const isTextRow = (row: unknown): row is string[] =>
    Array.isArray(row) && row.every(cell => typeof cell === 'string');
  if (!isTextRow(headers) || !headers.length || !Array.isArray(rows)
    || !rows.every(row => isTextRow(row) && row.length === headers.length)) return undefined;
  return { headers, rows };
}
