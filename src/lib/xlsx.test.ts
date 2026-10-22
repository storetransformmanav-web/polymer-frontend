import { crc32 } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { buildXlsx, type XlsxColumn } from './xlsx.ts'

/** Reads a stored ZIP back: name → bytes, checking each file's recorded size and CRC. */
function unzip(bytes: Uint8Array): Record<string, Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  // The end-of-central-directory record is the last 22 bytes (no comment is written).
  const end = bytes.length - 22
  expect(view.getUint32(end, true)).toBe(0x06054b50)
  const count = view.getUint16(end + 10, true)
  let at = view.getUint32(end + 16, true)
  const files: Record<string, Uint8Array> = {}
  for (let i = 0; i < count; i += 1) {
    expect(view.getUint32(at, true)).toBe(0x02014b50)
    const crc = view.getUint32(at + 16, true)
    const size = view.getUint32(at + 24, true)
    const nameLength = view.getUint16(at + 28, true)
    const local = view.getUint32(at + 42, true)
    const name = new TextDecoder().decode(bytes.slice(at + 46, at + 46 + nameLength))
    expect(view.getUint32(local, true)).toBe(0x04034b50)
    const dataStart = local + 30 + view.getUint16(local + 26, true)
    const data = bytes.slice(dataStart, dataStart + size)
    expect(crc32(data)).toBe(crc)
    files[name] = data
    at += 46 + nameLength
  }
  return files
}

const text = (data: Uint8Array) => new TextDecoder().decode(data)

const COLUMNS: XlsxColumn[] = [
  { header: 'Title', width: 30 },
  { header: 'ID', format: 'text' },
  { header: 'Price', format: 'decimal', width: 10 },
  { header: 'Stock', format: 'integer' },
]

function parse(xml: string) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  expect(doc.getElementsByTagName('parsererror')).toHaveLength(0)
  return doc
}

describe('buildXlsx', () => {
  const build = (rows: (string | number | null)[][], sheet = 'Products') =>
    unzip(buildXlsx(sheet, COLUMNS, rows, new Date(2026, 9, 22, 10, 30, 0)))

  it('is a ZIP with the parts of a one-sheet workbook, all valid XML', () => {
    const files = build([['Hippo Bag', '15393751269761', '25.85', 7]])

    expect(Object.keys(files).sort()).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/workbook.xml',
      'xl/worksheets/sheet1.xml',
    ])
    for (const data of Object.values(files)) parse(text(data))
    expect(text(files['xl/workbook.xml'])).toContain('name="Products"')
  })

  it('writes a bold header row, then one row per entry, with text as text and numbers as numbers', () => {
    const files = build([
      ['Hippo Bag', '15393751269761', '25.85', 7],
      ['Desk', '2', '10', 0],
    ])
    const sheet = parse(text(files['xl/worksheets/sheet1.xml']))

    const cell = (ref: string) => sheet.querySelector(`c[r="${ref}"]`)
    expect(cell('A1')?.getAttribute('s')).toBe('1') // header style
    expect(cell('A1')?.textContent).toBe('Title')
    expect(cell('A2')?.textContent).toBe('Hippo Bag')
    expect(cell('A2')?.getAttribute('t')).toBe('inlineStr')
    // A long id stays text: a number would lose digits.
    expect(cell('B2')?.getAttribute('t')).toBe('inlineStr')
    expect(cell('B2')?.textContent).toBe('15393751269761')
    // Prices and counts are real numbers with their format.
    expect(cell('C2')?.getAttribute('t')).toBeNull()
    expect(cell('C2')?.querySelector('v')?.textContent).toBe('25.85')
    expect(cell('C2')?.getAttribute('s')).toBe('3')
    expect(cell('D2')?.querySelector('v')?.textContent).toBe('7')
    expect(cell('D2')?.getAttribute('s')).toBe('2')
    expect(cell('D3')?.querySelector('v')?.textContent).toBe('0')
    expect(sheet.querySelectorAll('row')).toHaveLength(3)
  })

  it('freezes the header, adds filter buttons over the whole table and sets column widths', () => {
    const sheet = parse(text(build([['a', 'b', '1', 1]])['xl/worksheets/sheet1.xml']))

    expect(sheet.querySelector('pane')?.getAttribute('state')).toBe('frozen')
    expect(sheet.querySelector('autoFilter')?.getAttribute('ref')).toBe('A1:D2')
    expect(sheet.querySelector('dimension')?.getAttribute('ref')).toBe('A1:D2')
    const widths = [...sheet.querySelectorAll('col')].map((c) => c.getAttribute('width'))
    expect(widths).toEqual(['30', '16', '10', '16'])
  })

  it('leaves empty cells out, and writes a number that is not a number as text', () => {
    const sheet = parse(
      text(build([['x', null, 'n/a', null]])['xl/worksheets/sheet1.xml']),
    )

    expect(sheet.querySelector('c[r="B2"]')).toBeNull()
    expect(sheet.querySelector('c[r="D2"]')).toBeNull()
    expect(sheet.querySelector('c[r="C2"]')?.getAttribute('t')).toBe('inlineStr')
    expect(sheet.querySelector('c[r="C2"]')?.textContent).toBe('n/a')
  })

  it('keeps text exactly as it is — markup, accents, spaces — and never as a formula', () => {
    const tricky = '=SUM(A1:A9) <b>"Café" & £</b>  '
    const sheet = parse(text(build([[tricky, 'b', '1', 1]])['xl/worksheets/sheet1.xml']))

    const a2 = sheet.querySelector('c[r="A2"]')!
    expect(a2.textContent).toBe(tricky)
    // Inline text, never a formula element.
    expect(a2.getAttribute('t')).toBe('inlineStr')
    expect(sheet.querySelector('f')).toBeNull()
  })

  it('drops characters XML cannot hold instead of producing a broken file', () => {
    const sheet = parse(
      text(
        build([['bad\u0000\u0001\u001fchars\tkept', 'b', '1', 1]])[
          'xl/worksheets/sheet1.xml'
        ],
      ),
    )

    expect(sheet.querySelector('c[r="A2"]')?.textContent).toBe('badchars\tkept')
  })

  it('cuts a cell at Excel’s limit of 32 767 characters', () => {
    const sheet = parse(
      text(build([['x'.repeat(40_000), 'b', '1', 1]])['xl/worksheets/sheet1.xml']),
    )

    expect(sheet.querySelector('c[r="A2"]')?.textContent).toHaveLength(32_767)
  })

  it('names columns past Z correctly', () => {
    const wide = Array.from({ length: 28 }, (_, i) => ({ header: `H${i + 1}` }))
    const files = unzip(buildXlsx('Wide', wide, [Array.from({ length: 28 }, () => 'v')]))
    const sheet = parse(text(files['xl/worksheets/sheet1.xml']))

    expect(sheet.querySelector('c[r="Z1"]')?.textContent).toBe('H26')
    expect(sheet.querySelector('c[r="AA1"]')?.textContent).toBe('H27')
    expect(sheet.querySelector('c[r="AB2"]')?.textContent).toBe('v')
    expect(sheet.querySelector('autoFilter')?.getAttribute('ref')).toBe('A1:AB2')
  })

  it('makes a valid sheet name, and a header-only workbook for no rows', () => {
    const files = unzip(buildXlsx('Bad:/name?[1]', COLUMNS, []))

    expect(text(files['xl/workbook.xml'])).toContain('name="Bad  name  1"')
    const sheet = parse(text(files['xl/worksheets/sheet1.xml']))
    expect(sheet.querySelectorAll('row')).toHaveLength(1)
    expect(sheet.querySelector('autoFilter')?.getAttribute('ref')).toBe('A1:D1')
  })
})
