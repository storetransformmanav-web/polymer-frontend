import { describe, expect, it } from 'vitest'
import { buildCsv, parseCsv } from '../../../lib/csv.ts'
import { buildSampleCustomerCsv, summarizeCustomerCsv } from './importCsv.ts'

describe('summarizeCustomerCsv', () => {
  it('counts the customers and reads the first one', () => {
    const result = summarizeCustomerCsv(
      buildCsv(
        [
          'First Name',
          'Last Name',
          'Email',
          'Accepts Email Marketing',
          'Default Address City',
          'Default Address Country Code',
          'Phone',
          'Tags',
          'Note',
        ],
        [
          [
            'Jane',
            'Example',
            'jane@example.com',
            'yes',
            'Leeds',
            'GB',
            '0770',
            'b2b',
            'Hi',
          ],
          ['Sam', 'Sample', 'sam@example.com', 'no', '', '', '', '', ''],
        ],
      ),
    )
    expect(result).toEqual({
      ok: true,
      summary: {
        customers: 2,
        subscribed: 1,
        first: {
          name: 'Jane Example',
          email: 'jane@example.com',
          phone: '0770',
          marketing: 'Yes',
          location: 'Leeds, GB',
          tags: 'b2b',
          note: 'Hi',
        },
      },
    })
  })

  it('counts the same email once, in any case, and keeps a row with only a phone', () => {
    const result = summarizeCustomerCsv(
      'Email,Phone\na@example.com,\nA@EXAMPLE.COM,\n,0770\n,\n',
    )
    expect(result.ok && result.summary.customers).toBe(2)
  })

  it('reads the older headings too', () => {
    const result = summarizeCustomerCsv(
      'Email,Accepts Marketing,City,Country Code\na@example.com,TRUE,York,GB\n',
    )
    expect(result.ok && result.summary.first.marketing).toBe('Yes')
    expect(result.ok && result.summary.first.location).toBe('York, GB')
  })

  it('refuses a file that is not a customers file, saying why', () => {
    const products = summarizeCustomerCsv('Handle,Title\nmop,Mop\n')
    expect(products).toEqual({
      ok: false,
      error: expect.stringContaining('no “Email” or “Phone” column') as string,
    })
    expect(summarizeCustomerCsv('')).toEqual({ ok: false, error: 'This file is empty.' })
    expect(summarizeCustomerCsv('Email,Phone\n')).toEqual({
      ok: false,
      error: 'This file has the column headings but no customers.',
    })
  })

  it('reads its own sample file', () => {
    const sample = buildSampleCustomerCsv()
    const result = summarizeCustomerCsv(sample)
    expect(result.ok && result.summary.customers).toBe(2)
    // A sample phone must not start with `+`: the CSV writer would guard it with an apostrophe.
    expect(parseCsv(sample).flat().join()).not.toContain("'")
  })
})
