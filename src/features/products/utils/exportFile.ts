import { buildXlsx } from '../../../lib/xlsx.ts'
import type { ProductListItem } from '../../../lib/api/endpoints.ts'
import type { ExportColumn } from './exportColumns.ts'
import { buildProductsCsv } from './exportCsv.ts'

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

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/** The file for the chosen format and columns. */
export function buildProductsFile(
  format: ExportFormat,
  items: readonly ProductListItem[],
  columns: readonly ExportColumn[],
): Blob {
  if (format === 'csv') {
    // A UTF-8 byte-order mark first, so Excel reads accents and £ correctly.
    return new Blob(['\uFEFF', buildProductsCsv(items, columns)], {
      type: 'text/csv;charset=utf-8',
    })
  }
  const bytes = buildXlsx(
    'Products',
    columns.map((column) => ({
      header: column.header,
      width: column.width,
      format: column.kind,
    })),
    items.map((item) => columns.map((column) => column.value(item))),
  )
  return new Blob([bytes.buffer as ArrayBuffer], { type: XLSX_MIME })
}

/** "products-page-2-2026-10-22.xlsx" / "products-all-2026-10-22.csv" (the local date). */
export function exportFilename(
  scope: { kind: 'page'; page: number } | { kind: 'all' },
  format: ExportFormat,
  now: Date = new Date(),
): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const base = scope.kind === 'page' ? `products-page-${scope.page}` : 'products-all'
  return `${base}-${date}.${format}`
}
