/**
 * A small writer for Excel workbooks (.xlsx), so a table can be exported without a
 * spreadsheet library. An .xlsx file is a ZIP of XML parts; this writes the handful a
 * one-sheet table needs (stored, not compressed): a bold header row that stays in view
 * while scrolling, filter buttons on the header, column widths, and numbers as real numbers.
 *
 * Text is written as inline strings, which Excel always treats as text — a cell that
 * starts with `=` or `+` is shown as it is and never run as a formula.
 */

export type XlsxCell = string | number | null | undefined

export interface XlsxColumn {
  header: string
  /** Width in characters (default 16). */
  width?: number
  /** `integer` / `decimal` write numbers (0 / 0.00); anything else is text. */
  format?: 'text' | 'integer' | 'decimal'
}

/** Excel's limits. */
const MAX_CELL_CHARS = 32_767
const MAX_SHEET_NAME = 31

// --- ZIP (stored) --------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

interface ZipEntry {
  name: string
  data: Uint8Array
}

/** A ZIP archive with every file stored as it is (no compression). */
function zip(entries: ZipEntry[], now: Date): Uint8Array {
  const encoder = new TextEncoder()
  const dosTime =
    (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)
  const dosDate =
    ((Math.max(now.getFullYear(), 1980) - 1980) << 9) |
    ((now.getMonth() + 1) << 5) |
    now.getDate()

  const parts: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0

  for (const entry of entries) {
    const name = encoder.encode(entry.name)
    const crc = crc32(entry.data)

    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true)
    local.setUint16(4, 20, true) // version needed
    local.setUint16(6, 0x0800, true) // flags: names are UTF-8
    local.setUint16(8, 0, true) // method: stored
    local.setUint16(10, dosTime, true)
    local.setUint16(12, dosDate, true)
    local.setUint32(14, crc, true)
    local.setUint32(18, entry.data.length, true)
    local.setUint32(22, entry.data.length, true)
    local.setUint16(26, name.length, true)
    local.setUint16(28, 0, true)
    parts.push(new Uint8Array(local.buffer), name, entry.data)

    const head = new DataView(new ArrayBuffer(46))
    head.setUint32(0, 0x02014b50, true)
    head.setUint16(4, 20, true) // version made by
    head.setUint16(6, 20, true) // version needed
    head.setUint16(8, 0x0800, true)
    head.setUint16(10, 0, true)
    head.setUint16(12, dosTime, true)
    head.setUint16(14, dosDate, true)
    head.setUint32(16, crc, true)
    head.setUint32(20, entry.data.length, true)
    head.setUint32(24, entry.data.length, true)
    head.setUint16(28, name.length, true)
    head.setUint32(42, offset, true)
    central.push(new Uint8Array(head.buffer), name)

    offset += 30 + name.length + entry.data.length
  }

  const centralSize = central.reduce((sum, part) => sum + part.length, 0)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true)
  end.setUint16(8, entries.length, true)
  end.setUint16(10, entries.length, true)
  end.setUint32(12, centralSize, true)
  end.setUint32(16, offset, true)

  const all = [...parts, ...central, new Uint8Array(end.buffer)]
  const out = new Uint8Array(all.reduce((sum, part) => sum + part.length, 0))
  let at = 0
  for (const part of all) {
    out.set(part, at)
    at += part.length
  }
  return out
}

// --- XML ---------------------------------------------------------------------------

/** Can XML 1.0 hold this character? (Most control characters, lone surrogates and U+FFFE/FFFF cannot.) */
function isXmlChar(code: number): boolean {
  return (
    code === 0x9 ||
    code === 0xa ||
    code === 0xd ||
    (code >= 0x20 && code < 0xd800) ||
    (code >= 0xe000 && code < 0xfffe) ||
    code >= 0x10000
  )
}

/** The text without the characters XML cannot hold. */
function stripInvalidXml(text: string): string {
  let out = ''
  for (const char of text) {
    if (isXmlChar(char.codePointAt(0) ?? 0)) out += char
  }
  return out
}

const escapeXml = (text: string) =>
  stripInvalidXml(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
const MAIN_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const PKG_REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships'

/** 1 → "A", 27 → "AA". */
function columnName(index: number): string {
  let name = ''
  let n = index
  while (n > 0) {
    const rest = (n - 1) % 26
    name = String.fromCharCode(65 + rest) + name
    n = Math.floor((n - 1) / 26)
  }
  return name
}

/** Cell styles (positions in `cellXfs` below). */
const STYLE = { header: 1, integer: 2, decimal: 3 } as const

const STYLES_XML = `${XML_HEAD}<styleSheet xmlns="${MAIN_NS}">
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE6F0E8"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="4">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="2" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`

function textCell(ref: string, value: string, style?: number): string {
  const text = value.length > MAX_CELL_CHARS ? value.slice(0, MAX_CELL_CHARS) : value
  const s = style ? ` s="${style}"` : ''
  return `<c r="${ref}" t="inlineStr"${s}><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`
}

function cellXml(
  ref: string,
  value: XlsxCell,
  format: NonNullable<XlsxColumn['format']>,
): string {
  if (value === null || value === undefined || value === '') return ''
  if (format !== 'text') {
    const number = typeof value === 'number' ? value : Number(value)
    if (Number.isFinite(number)) {
      return `<c r="${ref}" s="${STYLE[format]}"><v>${number}</v></c>`
    }
  }
  return textCell(ref, String(value))
}

/** A valid sheet name: no `[]:*?/\`, at most 31 characters. */
function safeSheetName(name: string): string {
  const cleaned = name
    .replace(/[[\]:*?/\\]/g, ' ')
    .trim()
    .slice(0, MAX_SHEET_NAME)
  return cleaned || 'Sheet1'
}

/**
 * The workbook as bytes: one sheet with a header row (`columns`) and a row per
 * entry of `rows` (each row lists its cells in the columns' order).
 */
export function buildXlsx(
  sheetName: string,
  columns: readonly XlsxColumn[],
  rows: readonly (readonly XlsxCell[])[],
  now: Date = new Date(),
): Uint8Array {
  const lastColumn = columnName(Math.max(columns.length, 1))
  const lastRow = rows.length + 1

  const headerRow = `<row r="1">${columns
    .map((column, index) =>
      textCell(`${columnName(index + 1)}1`, column.header, STYLE.header),
    )
    .join('')}</row>`
  const bodyRows = rows
    .map((row, rowIndex) => {
      const r = rowIndex + 2
      const cells = columns
        .map((column, index) =>
          cellXml(`${columnName(index + 1)}${r}`, row[index], column.format ?? 'text'),
        )
        .join('')
      return `<row r="${r}">${cells}</row>`
    })
    .join('')

  const sheet = `${XML_HEAD}<worksheet xmlns="${MAIN_NS}">
<dimension ref="A1:${lastColumn}${lastRow}"/>
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${columns
    .map(
      (column, index) =>
        `<col min="${index + 1}" max="${index + 1}" width="${column.width ?? 16}" customWidth="1"/>`,
    )
    .join('')}</cols>
<sheetData>${headerRow}${bodyRows}</sheetData>
<autoFilter ref="A1:${lastColumn}${lastRow}"/>
</worksheet>`

  const encoder = new TextEncoder()
  const file = (name: string, xml: string): ZipEntry => ({
    name,
    data: encoder.encode(xml),
  })

  return zip(
    [
      file(
        '[Content_Types].xml',
        `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`,
      ),
      file(
        '_rels/.rels',
        `${XML_HEAD}<Relationships xmlns="${PKG_REL_NS}"><Relationship Id="rId1" Type="${REL_NS}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
      ),
      file(
        'xl/workbook.xml',
        `${XML_HEAD}<workbook xmlns="${MAIN_NS}" xmlns:r="${REL_NS}"><sheets><sheet name="${escapeXml(
          safeSheetName(sheetName),
        )}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      ),
      file(
        'xl/_rels/workbook.xml.rels',
        `${XML_HEAD}<Relationships xmlns="${PKG_REL_NS}"><Relationship Id="rId1" Type="${REL_NS}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${REL_NS}/styles" Target="styles.xml"/></Relationships>`,
      ),
      file('xl/styles.xml', STYLES_XML),
      file('xl/worksheets/sheet1.xml', sheet),
    ],
    now,
  )
}
