import { describe, expect, it } from 'vitest'
import { buildCsv, csvCell, parseCsv } from './csv.ts'

describe('parseCsv', () => {
  it('reads rows and cells, with CRLF, LF or CR line ends and a final line end or none', () => {
    const expected = [
      ['a', 'b'],
      ['1', '2'],
    ]
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual(expected)
    expect(parseCsv('a,b\n1,2')).toEqual(expected)
    expect(parseCsv('a,b\r1,2\r')).toEqual(expected)
  })

  it('reads quoted cells: commas, doubled quotes and line breaks inside', () => {
    expect(parseCsv('"a, b","say ""hi""","line1\nline2"\n')).toEqual([
      ['a, b', 'say "hi"', 'line1\nline2'],
    ])
  })

  it('keeps empty cells, and skips blank lines', () => {
    expect(parseCsv('a,,c\n\n,,\n')).toEqual([
      ['a', '', 'c'],
      ['', '', ''],
    ])
  })

  it('drops a leading byte-order mark', () => {
    expect(parseCsv('﻿Handle,Title\n')).toEqual([['Handle', 'Title']])
  })

  it('reads back what buildCsv wrote', () => {
    const headers = ['Handle', 'Body (HTML)', 'Note']
    const rows = [
      ['hippo-bag', '<p>Hello, "world"</p>', 'two\nlines'],
      ['mop', '', ' padded '],
    ]
    expect(parseCsv(buildCsv(headers, rows))).toEqual([headers, ...rows])
  })

  it('gives nothing for an empty file', () => {
    expect(parseCsv('')).toEqual([])
    expect(parseCsv('\n\n')).toEqual([])
  })
})

describe('csvCell', () => {
  it('writes plain text and numbers as they are, and nothing for a missing value', () => {
    expect(csvCell('Hippo Bag')).toBe('Hippo Bag')
    expect(csvCell(7)).toBe('7')
    expect(csvCell(-3)).toBe('-3')
    expect(csvCell(0)).toBe('0')
    expect(csvCell(null)).toBe('')
    expect(csvCell(undefined)).toBe('')
    expect(csvCell('')).toBe('')
    expect(csvCell(Number.NaN)).toBe('')
  })

  it('quotes text with a comma, a quote or a line break, doubling the quotes', () => {
    expect(csvCell('Bags, large')).toBe('"Bags, large"')
    expect(csvCell('The "Big" one')).toBe('"The ""Big"" one"')
    expect(csvCell('two\nlines')).toBe('"two\nlines"')
    expect(csvCell('two\r\nlines')).toBe('"two\r\nlines"')
    expect(csvCell(' padded ')).toBe('" padded "')
  })

  it('stops a spreadsheet running text as a formula', () => {
    expect(csvCell('=SUM(A1:A9)')).toBe("'=SUM(A1:A9)")
    expect(csvCell('+44 20 7946 0000')).toBe("'+44 20 7946 0000")
    expect(csvCell('-5% off')).toBe("'-5% off")
    expect(csvCell('@mention')).toBe("'@mention")
    expect(csvCell('\tTabbed')).toBe("'\tTabbed")
    expect(csvCell('=HYPERLINK("http://evil","x")')).toBe(
      `"'=HYPERLINK(""http://evil"",""x"")"`,
    )
    // Only a *leading* character matters.
    expect(csvCell('a=b')).toBe('a=b')
  })
})

describe('buildCsv', () => {
  it('is a header row, then a row per entry, in CRLF lines with a closing line break', () => {
    expect(
      buildCsv(
        ['Name', 'Qty'],
        [
          ['Desk, large', 2],
          ['Lamp', null],
        ],
      ),
    ).toBe('Name,Qty\r\n"Desk, large",2\r\nLamp,\r\n')
  })

  it('is just the header for no rows', () => {
    expect(buildCsv(['A', 'B'], [])).toBe('A,B\r\n')
  })

  it('quotes a header that needs it too', () => {
    expect(buildCsv(['Price, GBP'], [])).toBe('"Price, GBP"\r\n')
  })
})
