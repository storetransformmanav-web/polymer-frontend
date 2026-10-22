import type { ProductListItem } from '../../../lib/api/endpoints.ts'
import { EXPORT_COLUMNS, type ExportCell, type ExportColumn } from './exportColumns.ts'

/** Spreadsheets run a cell that starts with one of these as a formula. */
const FORMULA_START = /^[=+\-@\t\r]/

/**
 * One CSV field. Text is quoted when it holds a comma, quote or line break (quotes
 * doubled), and text that a spreadsheet would run as a formula (`=`, `+`, `-`, `@`…)
 * gets a leading apostrophe so a product title can never execute anything.
 * Numbers are written as they are.
 */
export function csvCell(value: ExportCell): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  const text = FORMULA_START.test(value) ? `'${value}` : value
  return /[",\r\n]/.test(text) || text !== text.trim()
    ? `"${text.replace(/"/g, '""')}"`
    : text
}

/** The whole file: a header row, then a row per product, lines ending in CRLF. */
export function buildProductsCsv(
  items: readonly ProductListItem[],
  columns: readonly ExportColumn[] = EXPORT_COLUMNS,
): string {
  const lines = [
    columns.map((column) => csvCell(column.header)).join(','),
    ...items.map((item) =>
      columns.map((column) => csvCell(column.value(item))).join(','),
    ),
  ]
  return `${lines.join('\r\n')}\r\n`
}
