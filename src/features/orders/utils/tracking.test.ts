import { describe, expect, it } from 'vitest'
import {
  fulfillmentTracking,
  notesCount,
  orderTracking,
  splitAttributes,
} from './tracking.ts'

describe('fulfillmentTracking', () => {
  it('reads a fulfillment’s company, number and link', () => {
    expect(
      fulfillmentTracking([
        {
          name: '#1.1',
          tracking_company: 'DPD',
          tracking_number: '123',
          tracking_url: 'https://t.example/123',
        },
      ]),
    ).toEqual([
      {
        key: 'fulfillment-0-0',
        label: '#1.1',
        company: 'DPD',
        number: '123',
        url: 'https://t.example/123',
      },
    ])
  })

  it('pairs several numbers with their links, and reads a tracking_info list', () => {
    const entries = fulfillmentTracking([
      { tracking_numbers: ['A', 'B'], tracking_urls: ['https://t/A', 'https://t/B'] },
      { tracking_info: [{ company: 'UPS', number: 'C', url: 'https://t/C' }] },
    ])
    expect(entries.map((e) => [e.label, e.company, e.number, e.url])).toEqual([
      ['Fulfillment 1', null, 'A', 'https://t/A'],
      ['Fulfillment 1', null, 'B', 'https://t/B'],
      ['Fulfillment 2', 'UPS', 'C', 'https://t/C'],
    ])
  })

  it('leaves out a fulfillment with nothing to track', () => {
    expect(
      fulfillmentTracking([{ status: 'success' }, { tracking_number: '  ' }]),
    ).toEqual([])
  })
})

describe('splitAttributes', () => {
  it('takes the tracking ones out: an address is a link, anything else a number', () => {
    const { tracking, details } = splitAttributes([
      { key: 'Tracking Number', value: 'ABC-1' },
      { key: 'tracking_url', value: 'https://t.example/x' },
      { key: 'utm_source', value: 'google' },
      { key: 'tracking_empty', value: '' },
    ])
    expect(tracking.map((e) => [e.label, e.number, e.url])).toEqual([
      ['Tracking number', 'ABC-1', null],
      ['Tracking url', null, 'https://t.example/x'],
    ])
    expect(details.map((d) => d.key)).toEqual(['utm_source', 'tracking_empty'])
  })
})

describe('notesCount', () => {
  it('counts the note, the parcels and the other details', () => {
    const order = {
      note: 'Leave it',
      fulfillments: [{ tracking_number: '1' }],
      note_attributes: [
        { key: 'tracking', value: 'X' },
        { key: 'a', value: 'b' },
      ],
    }
    expect(orderTracking(order).tracking).toHaveLength(2)
    expect(notesCount(order)).toBe(4)
    expect(notesCount({ note: '  ', fulfillments: [], note_attributes: [] })).toBe(0)
  })
})
