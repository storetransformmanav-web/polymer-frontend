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

/**
 * Reads CSV text into rows of cells — the other direction from `buildCsv`. Handles quoted
 * cells (doubled quotes, commas and line breaks inside), CRLF / LF / CR line ends and a
 * leading byte-order mark; a blank line is skipped. Nothing is interpreted: every cell is
 * the text exactly as it was written.
 */
export function parseCsv(text: string): string[][] {
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  // True once anything was read for the current row (so a blank line isn't a row).
  let started = false

  const endCell = () => {
    row.push(cell)
    cell = ''
  }
  const endRow = () => {
    if (started) {
      endCell()
      rows.push(row)
    }
    row = []
    started = false
  }

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i]
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          cell += '"'
          i += 1
        } else {
          quoted = false
        }
      } else {
        cell += char
      }
    } else if (char === '"') {
      quoted = true
      started = true
    } else if (char === ',') {
      started = true
      endCell()
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i += 1
      endRow()
    } else {
      started = true
      cell += char
    }
  }
  endRow()
  return rows
}
