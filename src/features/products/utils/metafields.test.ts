import { describe, expect, it } from 'vitest'
import {
  formatMetafieldValue,
  metafieldGroup,
  metafieldName,
  metafieldTypeLabel,
  rawMetafieldValue,
  readableMetafield,
  readableSections,
  readableValue,
} from './metafields.ts'

describe('metafieldName / metafieldGroup', () => {
  it('turns a key into plain words', () => {
    expect(metafieldName('my_fields', 'unit_of_sale')).toBe('Unit of sale')
    expect(metafieldName('custom', 'careInstructions')).toBe('Care instructions')
    expect(metafieldName('custom', 'pack-size')).toBe('Pack size')
  })

  it('knows the common fields and groups', () => {
    expect(metafieldName('global', 'title_tag')).toBe('SEO title')
    expect(metafieldName('apd', 'apd')).toBe('Description sections')
    expect(metafieldGroup('my_fields')).toBe('My fields')
    expect(metafieldGroup('global')).toBe('Search & SEO')
    expect(metafieldGroup('some_app')).toBe('Some app')
  })
})

describe('metafieldTypeLabel', () => {
  it('names the types in plain words', () => {
    expect(metafieldTypeLabel('number_integer')).toBe('Whole number')
    expect(metafieldTypeLabel('json_string')).toBe('Structured data')
    expect(metafieldTypeLabel('boolean')).toBe('Yes / No')
    expect(metafieldTypeLabel('list.single_line_text_field')).toBe(
      'List of text (one line)',
    )
    expect(metafieldTypeLabel('product_reference')).toBe('Product link')
    expect(metafieldTypeLabel('some_new_type')).toBe('Some new type')
    expect(metafieldTypeLabel(null)).toBe('Unknown')
  })
})

describe('formatMetafieldValue', () => {
  it('formats numbers, yes/no and dates', () => {
    expect(formatMetafieldValue('number_integer', '1500')).toEqual({
      kind: 'text',
      text: '1,500',
    })
    expect(formatMetafieldValue('boolean', 'true')).toEqual({ kind: 'text', text: 'Yes' })
    expect(formatMetafieldValue('boolean', 'false')).toEqual({ kind: 'text', text: 'No' })
    expect(formatMetafieldValue('date', '2026-10-14')).toEqual({
      kind: 'text',
      text: '14 Oct 2026',
    })
  })

  it('formats measures, money and ratings', () => {
    expect(formatMetafieldValue('weight', '{"value":2.5,"unit":"KILOGRAMS"}')).toEqual({
      kind: 'text',
      text: '2.5 kilograms',
    })
    expect(
      formatMetafieldValue('money', '{"amount":"5.00","currency_code":"GBP"}'),
    ).toEqual({ kind: 'text', text: '£5.00' })
    expect(
      formatMetafieldValue('rating', '{"value":"4.5","scale_min":"1","scale_max":"5"}'),
    ).toEqual({ kind: 'text', text: '4.5 / 5' })
  })

  it('shows lists as separate items', () => {
    expect(
      formatMetafieldValue('list.single_line_text_field', '["Plastic","Foil"]'),
    ).toEqual({ kind: 'list', items: ['Plastic', 'Foil'] })
    expect(formatMetafieldValue('json', '["a","b"]')).toEqual({
      kind: 'list',
      items: ['a', 'b'],
    })
  })

  it('shows a small object as label/value rows and a big one as a count', () => {
    expect(
      formatMetafieldValue('json_string', '{"pack_size":500,"colour":"black"}'),
    ).toEqual({
      kind: 'pairs',
      pairs: [
        ['Pack size', '500'],
        ['Colour', 'black'],
      ],
    })
    expect(
      formatMetafieldValue('json_string', '{"sections":[{"title":"A"}],"saved":true}'),
    ).toEqual({ kind: 'text', text: '2 settings' })
  })

  it('only links addresses that are http(s)', () => {
    expect(formatMetafieldValue('url', 'https://example.com/a')).toEqual({
      kind: 'link',
      href: 'https://example.com/a',
      text: 'https://example.com/a',
    })
    expect(formatMetafieldValue('url', 'javascript:alert(1)')).toEqual({
      kind: 'text',
      text: 'javascript:alert(1)',
    })
  })

  it('shows a colour, a reference and formatted text sensibly', () => {
    expect(formatMetafieldValue('color', '#557b97')).toEqual({
      kind: 'color',
      color: '#557b97',
    })
    expect(formatMetafieldValue('product_reference', 'gid://shopify/Product/42')).toEqual(
      {
        kind: 'text',
        text: 'Product 42',
      },
    )
    expect(
      formatMetafieldValue(
        'rich_text_field',
        '{"type":"root","children":[{"type":"paragraph","children":[{"type":"text","value":"Hello"}]}]}',
      ),
    ).toEqual({ kind: 'text', text: 'Hello' })
  })

  it('says a missing value is empty, and keeps plain text as it is', () => {
    expect(formatMetafieldValue('single_line_text_field', '')).toEqual({ kind: 'empty' })
    expect(formatMetafieldValue('single_line_text_field', null)).toEqual({
      kind: 'empty',
    })
    expect(formatMetafieldValue('single_line_text_field', 'Hello')).toEqual({
      kind: 'text',
      text: 'Hello',
    })
  })
})

describe('rawMetafieldValue', () => {
  it('pretty-prints structured data and skips short plain text', () => {
    expect(rawMetafieldValue('json_string', '{"a":1}')).toBe('{\n  "a": 1\n}')
    expect(rawMetafieldValue('single_line_text_field', 'Hello')).toBeNull()
    expect(rawMetafieldValue('single_line_text_field', 'x'.repeat(200))).toHaveLength(200)
    expect(rawMetafieldValue('json', null)).toBeNull()
  })
})

describe('readableValue', () => {
  it('turns keys into plain names and true / false into Yes / No', () => {
    expect(
      readableValue({ accordian_multi: true, accentColor: '#557b97', count: 3 }),
    ).toEqual({
      kind: 'group',
      entries: [
        { label: 'Accordian multi', value: { kind: 'text', text: 'Yes' } },
        { label: 'Accent color', value: { kind: 'text', text: '#557b97' } },
        { label: 'Count', value: { kind: 'text', text: '3' } },
      ],
    })
    expect(readableValue(false)).toEqual({ kind: 'text', text: 'No' })
  })

  it('keeps lists as lists and nests groups', () => {
    expect(readableValue(['Plastic', { size: 'L' }])).toEqual({
      kind: 'list',
      items: [
        { kind: 'text', text: 'Plastic' },
        {
          kind: 'group',
          entries: [{ label: 'Size', value: { kind: 'text', text: 'L' } }],
        },
      ],
    })
  })

  it('treats text with tags as formatted text, never as plain code', () => {
    expect(readableValue('<p>Hello <b>there</b></p>')).toEqual({
      kind: 'html',
      html: '<p>Hello <b>there</b></p>',
    })
    expect(readableValue('2 < 3 and 5 > 4')).toEqual({
      kind: 'text',
      text: '2 < 3 and 5 > 4',
    })
  })

  it('says nothing is set for empty values', () => {
    for (const empty of [null, undefined, '', '   ', [], {}]) {
      expect(readableValue(empty)).toEqual({ kind: 'empty' })
    }
  })

  it('stops at a hundred list items and at a sensible depth', () => {
    const many = readableValue(Array.from({ length: 120 }, (_, index) => `v${index}`))
    expect(many.kind === 'list' && many.items).toHaveLength(101)
    expect(many.kind === 'list' && many.items[100]).toEqual({
      kind: 'text',
      text: '…and 20 more',
    })
    let deep: unknown = 'bottom'
    for (let level = 0; level < 12; level += 1) deep = { inner: deep }
    expect(JSON.stringify(readableValue(deep))).toContain(
      'more detail here than can be shown',
    )
  })
})

describe('readableMetafield', () => {
  it('reads structured values out of their JSON', () => {
    expect(
      readableMetafield('list.single_line_text_field', '["Plastic","Foil"]'),
    ).toEqual({
      kind: 'list',
      items: [
        { kind: 'text', text: 'Plastic' },
        { kind: 'text', text: 'Foil' },
      ],
    })
    expect(readableMetafield('json', '{"material":"PET"}')).toEqual({
      kind: 'group',
      entries: [{ label: 'Material', value: { kind: 'text', text: 'PET' } }],
    })
  })

  it('shows a value that is not valid JSON as the text it is', () => {
    expect(readableMetafield('json', '{not json')).toEqual({
      kind: 'text',
      text: '{not json',
    })
  })

  it('reads the words out of a rich-text value', () => {
    const rich = JSON.stringify({
      type: 'root',
      children: [
        { type: 'paragraph', children: [{ type: 'text', value: 'First line' }] },
        { type: 'paragraph', children: [{ type: 'text', value: 'Second line' }] },
      ],
    })
    expect(readableMetafield('rich_text_field', rich)).toEqual({
      kind: 'text',
      text: 'First line\nSecond line',
    })
  })

  it('says nothing is set for no value', () => {
    expect(readableMetafield('json', null)).toEqual({ kind: 'empty' })
  })
})

describe('readableSections', () => {
  const value = JSON.stringify({
    accordian_multi: false,
    sections: [
      { title: 'Information', content: '<p>y</p>', position: 1 },
      { title: 'Description', content: '<p>x</p>', position: 0 },
      { title: '  ', content: '<p>no title</p>', position: 2 },
    ],
  })

  it('lists the sections in their order, leaving out one with no title', () => {
    const read = readableSections(value)
    expect(read?.sections).toEqual([
      { title: 'Description', html: '<p>x</p>' },
      { title: 'Information', html: '<p>y</p>' },
    ])
  })

  it('keeps the other settings by name, without the sections', () => {
    expect(readableSections(value)?.settings).toEqual({
      kind: 'group',
      entries: [{ label: 'Accordian multi', value: { kind: 'text', text: 'No' } }],
    })
  })

  it('is null for a value that is not that shape', () => {
    expect(readableSections('{not json')).toBeNull()
    expect(readableSections('{"other":1}')).toBeNull()
    expect(readableSections('{"sections":[]}')).toBeNull()
    expect(readableSections(null)).toBeNull()
  })
})
