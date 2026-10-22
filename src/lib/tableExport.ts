import { buildCsv } from './csv.ts'
import { buildXlsx } from './xlsx.ts'

/**
 * Turning a list of records into a downloadable file: which columns, and the format
 * (Excel or CSV). Knows nothing about products or customers — each feature describes
 * its own columns.
 */

export type ExportFormat = 'xlsx' | 'csv'

export const EXPORT_FORMATS: readonly {
  value: ExportFormat
  label: string
  extension: string
  description: string
}[] = [
  {
    value: 'xlsx',
    label: 'Excel (.xlsx)',
    extension: 'xlsx',
    description: 'Best for analysis and reporting',
  },
  {
    value: 'csv',
    label: 'CSV (.csv)',
    extension: 'csv',
    description: 'Works with most tools',
  },
]

export type ExportCell = string | number | null | undefined

export interface ExportColumn<T, Id extends string = string> {
  id: Id
  /** The column's heading in the file, and its name in the picker. */
  header: string
  /** How an Excel file writes it: a whole number, a price with two decimals, or text. */
  kind: 'text' | 'integer' | 'decimal'
  /** Column width in the Excel file, in characters. */
  width: number
  value: (item: T) => ExportCell
}

/** The chosen columns, in the file's fixed order (a duplicate or unknown id is ignored). */
export function pickColumns<T, Id extends string>(
  all: readonly ExportColumn<T, Id>[],
  ids: Iterable<Id>,
): ExportColumn<T, Id>[] {
  const wanted = new Set(ids)
  return all.filter((column) => wanted.has(column.id))
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/** The file for the chosen format and columns. */
export function buildTableFile<T>(
  format: ExportFormat,
  items: readonly T[],
  columns: readonly ExportColumn<T>[],
  sheetName: string,
): Blob {
  const rows = items.map((item) => columns.map((column) => column.value(item)))
  if (format === 'csv') {
    // A UTF-8 byte-order mark first, so Excel reads accents and £ correctly.
    return new Blob(
      [
        '\uFEFF',
        buildCsv(
          columns.map((column) => column.header),
          rows,
        ),
      ],
      { type: 'text/csv;charset=utf-8' },
    )
  }
  const bytes = buildXlsx(
    sheetName,
    columns.map((column) => ({
      header: column.header,
      width: column.width,
      format: column.kind,
    })),
    rows,
  )
  return new Blob([bytes.buffer as ArrayBuffer], { type: XLSX_MIME })
}

/** "products-page-2-2026-10-22.xlsx" / "customers-all-2026-10-22.csv" (the local date). */
export function exportFilename(
  base: string,
  scope: { kind: 'page'; page: number } | { kind: 'all' },
  format: ExportFormat,
  now: Date = new Date(),
): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const name = scope.kind === 'page' ? `${base}-page-${scope.page}` : `${base}-all`
  return `${name}-${date}.${format}`
}
