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

/** "CSV for Excel…" gets a byte-order mark so accents and £ read correctly; "plain" is the file as sent. */
export type ExportFileFormat = 'excel' | 'plain'

/** The file to save: the text as sent, with a UTF-8 byte-order mark first for Excel. */
export function csvFile(text: string, format: ExportFileFormat): Blob {
  const body = text.startsWith('\ufeff') ? text.slice(1) : text
  return new Blob(format === 'excel' ? ['\ufeff', body] : [body], {
    type: 'text/csv;charset=utf-8',
  })
}

/** `customers_export_all-stores_20261027-1240.csv` — the name the backend's own files have. */
export function csvExportFilename(
  noun: string,
  shop: string | undefined,
  now: Date = new Date(),
): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
  const store = (shop ?? '').replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '')
  return `${noun}_export_${store || 'all-stores'}_${stamp}.csv`
}
