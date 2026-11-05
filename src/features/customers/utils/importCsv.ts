import { buildCsv, parseCsv } from '../../../lib/csv.ts'

/**
 * What the import dialog tells you about a customers CSV before anything is sent: how many
 * customers it holds, and its first customer as it will look. It is read in the browser, from
 * the file's own text, so the preview doesn't depend on what the backend's check answers.
 */

export interface ImportCustomerPreview {
  name: string
  email: string
  phone: string
  /** "Yes" / "No" as the file says; empty when it doesn't. */
  marketing: string
  /** "Leeds, GB". */
  location: string
  tags: string
  note: string
}

export interface CustomerImportSummary {
  /** Different customers, by email (or phone, for a row without one). */
  customers: number
  /** How many of them accept email marketing. */
  subscribed: number
  first: ImportCustomerPreview
}

export type CustomerImportCsvResult =
  { ok: true; summary: CustomerImportSummary } | { ok: false; error: string }

/** The columns of Shopify's customer layout (a column may be missing: it just reads as blank). */
const SAMPLE_HEADERS = [
  'First Name',
  'Last Name',
  'Email',
  'Accepts Email Marketing',
  'Default Address Company',
  'Default Address Address1',
  'Default Address Address2',
  'Default Address City',
  'Default Address Province Code',
  'Default Address Country Code',
  'Default Address Zip',
  'Default Address Phone',
  'Phone',
  'Accepts SMS Marketing',
  'Tags',
  'Note',
  'Tax Exempt',
]

export const SAMPLE_CUSTOMER_IMPORT_FILENAME = 'sample-customers-import.csv'

/** A small example file in Shopify's layout: two made-up customers. */
export function buildSampleCustomerCsv(): string {
  const row = (values: Record<string, string>) =>
    SAMPLE_HEADERS.map((header) => values[header] ?? '')
  return buildCsv(SAMPLE_HEADERS, [
    row({
      'First Name': 'Jane',
      'Last Name': 'Example',
      Email: 'jane@example.com',
      'Accepts Email Marketing': 'yes',
      'Default Address Address1': '1 High Street',
      'Default Address City': 'Leeds',
      'Default Address Country Code': 'GB',
      'Default Address Zip': 'LS1 1AA',
      Phone: '07700 900123',
      'Accepts SMS Marketing': 'no',
      Tags: 'wholesale, b2b',
      Note: 'Prefers morning deliveries',
      'Tax Exempt': 'no',
    }),
    row({
      'First Name': 'Sam',
      'Last Name': 'Sample',
      Email: 'sam@example.com',
      'Accepts Email Marketing': 'no',
      'Accepts SMS Marketing': 'no',
      'Tax Exempt': 'no',
    }),
  ])
}

const YES = new Set(['yes', 'y', 'true', '1'])
const NO = new Set(['no', 'n', 'false', '0'])

/** Reads the CSV text; a file that isn't a customers CSV answers with what is wrong. */
export function summarizeCustomerCsv(text: string): CustomerImportCsvResult {
  const rows = parseCsv(text)
  if (rows.length === 0) return { ok: false, error: 'This file is empty.' }

  const column = new Map<string, number>()
  rows[0].forEach((name, index) => {
    const key = name.trim().toLowerCase()
    if (key && !column.has(key)) column.set(key, index)
  })
  /** The first of `names` (a current heading, then older spellings) with a value in this row. */
  const read = (row: readonly string[], ...names: string[]) => {
    for (const name of names) {
      const value = (row[column.get(name) ?? -1] ?? '').trim()
      if (value) return value
    }
    return ''
  }
  const emailOf = (row: readonly string[]) => read(row, 'email', 'email address')
  const phoneOf = (row: readonly string[]) => read(row, 'phone', 'default address phone')

  const hasEmail = column.has('email') || column.has('email address')
  const hasPhone = column.has('phone') || column.has('default address phone')
  if (!hasEmail && !hasPhone) {
    return {
      ok: false,
      error:
        'This doesn’t look like a customers file: its first row has no “Email” or “Phone” column. Use the sample CSV or an export from this page as the template.',
    }
  }

  const data = rows.slice(1).filter((row) => emailOf(row) !== '' || phoneOf(row) !== '')
  if (data.length === 0) {
    return { ok: false, error: 'This file has the column headings but no customers.' }
  }

  const marketingOf = (row: readonly string[]) =>
    read(row, 'accepts email marketing', 'accepts marketing').toLowerCase()

  const seen = new Set<string>()
  let subscribed = 0
  for (const row of data) {
    const key = (emailOf(row) || phoneOf(row)).toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    if (YES.has(marketingOf(row))) subscribed += 1
  }

  const head = data[0]
  const marketing = marketingOf(head)
  return {
    ok: true,
    summary: {
      customers: seen.size,
      subscribed,
      first: {
        name: [read(head, 'first name'), read(head, 'last name')]
          .filter(Boolean)
          .join(' '),
        email: emailOf(head),
        phone: phoneOf(head),
        marketing: YES.has(marketing) ? 'Yes' : NO.has(marketing) ? 'No' : '',
        location: [
          read(head, 'default address city', 'city'),
          read(head, 'default address country code', 'country code', 'country'),
        ]
          .filter(Boolean)
          .join(', '),
        tags: read(head, 'tags'),
        note: read(head, 'note'),
      },
    },
  }
}
