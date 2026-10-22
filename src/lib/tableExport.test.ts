import { describe, expect, it } from 'vitest'
import {
  buildTableFile,
  exportFilename,
  pickColumns,
  type ExportColumn,
} from './tableExport.ts'

interface Row {
  name: string
  price: string
  qty: number
}

type Id = 'name' | 'price' | 'qty'

const COLUMNS: ExportColumn<Row, Id>[] = [
  { id: 'name', header: 'Name', kind: 'text', width: 20, value: (r) => r.name },
  { id: 'price', header: 'Price', kind: 'decimal', width: 10, value: (r) => r.price },
  { id: 'qty', header: 'Qty', kind: 'integer', width: 8, value: (r) => r.qty },
]
const ROWS: Row[] = [
  { name: 'Desk', price: '25.85', qty: 3 },
  { name: '=SUM(A1)', price: '10', qty: 0 },
]

describe('pickColumns', () => {
  it('keeps the file’s own order whatever order the ids come in, and ignores repeats', () => {
    expect(pickColumns(COLUMNS, ['qty', 'name']).map((c) => c.id)).toEqual([
      'name',
      'qty',
    ])
    expect(pickColumns(COLUMNS, ['qty', 'qty']).map((c) => c.id)).toEqual(['qty'])
    expect(pickColumns(COLUMNS, [])).toEqual([])
  })
})

describe('buildTableFile', () => {
  it('makes a CSV with a byte-order mark for Excel, the chosen columns and formula-safe text', async () => {
    const blob = buildTableFile(
      'csv',
      ROWS,
      pickColumns(COLUMNS, ['name', 'price']),
      'Rows',
    )

    expect(blob.type).toBe('text/csv;charset=utf-8')
    const bytes = new Uint8Array(await blob.arrayBuffer())
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    expect(await blob.text()).toContain("Name,Price\r\nDesk,25.85\r\n'=SUM(A1),10\r\n")
  })

  it('makes an Excel workbook (a ZIP file) with the right type', async () => {
    const blob = buildTableFile('xlsx', ROWS, COLUMNS, 'Rows')

    expect(blob.type).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    const bytes = new Uint8Array(await blob.arrayBuffer())
    // "PK\x03\x04": the start of a ZIP archive.
    expect([...bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04])
  })
})

describe('exportFilename', () => {
  const date = new Date(2026, 9, 5, 14, 30)

  it('names a page export after its page, the local date and the format', () => {
    expect(exportFilename('products', { kind: 'page', page: 3 }, 'xlsx', date)).toBe(
      'products-page-3-2026-10-05.xlsx',
    )
    expect(exportFilename('customers', { kind: 'page', page: 1 }, 'csv', date)).toBe(
      'customers-page-1-2026-10-05.csv',
    )
  })

  it('names an export of everything after the date', () => {
    expect(exportFilename('customers', { kind: 'all' }, 'xlsx', date)).toBe(
      'customers-all-2026-10-05.xlsx',
    )
  })
})
