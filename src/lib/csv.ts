export type CsvCell = string | number | null | undefined

/** Spreadsheets run a cell that starts with one of these as a formula. */
const FORMULA_START = /^[=+\-@\t\r]/

/**
 * One CSV field. Text is quoted when it holds a comma, quote or line break (quotes
 * doubled), and text that a spreadsheet would run as a formula (`=`, `+`, `-`, `@`…)
 * gets a leading apostrophe so a name or title can never execute anything.
 * Numbers are written as they are.
 */
export function csvCell(value: CsvCell): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  const text = FORMULA_START.test(value) ? `'${value}` : value
  return /[",\r\n]/.test(text) || text !== text.trim()
    ? `"${text.replace(/"/g, '""')}"`
    : text
}

/** The whole file: a header row, then the rows, lines ending in CRLF. */
export function buildCsv(
  headers: readonly string[],
  rows: readonly (readonly CsvCell[])[],
): string {
  const lines = [
    headers.map((header) => csvCell(header)).join(','),
    ...rows.map((row) => row.map(csvCell).join(',')),
  ]
  return `${lines.join('\r\n')}\r\n`
}
