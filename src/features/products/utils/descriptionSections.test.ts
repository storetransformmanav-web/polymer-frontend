import { describe, expect, it } from 'vitest'
import {
  blankSection,
  buildSectionsMetafield,
  draftSections,
  readDescriptionSections,
} from './descriptionSections.ts'

/** The `apd` metafield as the API returns it (a JSON string inside the JSON answer). */
const INFORMATION_HTML =
  '<p>&nbsp;</p><p><strong>Specifications:</strong></p><p>&nbsp;</p><ul><li>Product type: Microwave food container with lid</li><li>Suitable for hot and cold food</li></ul><p>&nbsp;</p><p><strong>Capacity:</strong></p><p>&nbsp;</p><figure class="table"><table><tbody><tr><td><strong>Product Code</strong></td><td><strong>Capacity</strong></td></tr><tr><td>MC01H</td><td>500ml</td></tr><tr><td>MC02H</td><td>650ml</td></tr></tbody></table></figure>'

const SETTINGS = {
  saved: true,
  kind: 1,
  overwrite_styles: false,
  accordian_open: 2,
  accordian_multi: false,
  border_color: '#e2e2e2',
  sections: [
    {
      title: 'Product Description',
      content:
        '<p>These Hippo Microwave Containers with Lids offer a dependable and affordable packaging option.</p><p>&nbsp;</p><p>Suitable for microwave reheating.</p>',
      position: 0,
      chosen: false,
      selected: false,
    },
    {
      title: 'Product Information',
      content: INFORMATION_HTML,
      position: 1,
      chosen: false,
      selected: false,
    },
  ],
}

const field = (value: unknown, over: Record<string, unknown> = {}) => ({
  namespace: 'apd',
  key: 'apd',
  type: 'json_string',
  value: typeof value === 'string' ? value : JSON.stringify(value),
  ...over,
})
const product = (...metafields: ReturnType<typeof field>[]) => ({ metafields })

describe('readDescriptionSections', () => {
  it('reads the sections from the apd metafield, in order, with their HTML', () => {
    const result = readDescriptionSections(product(field(SETTINGS)))

    expect(result?.sections.map((section) => section.title)).toEqual([
      'Product Description',
      'Product Information',
    ])
    expect(result?.sections[0].content).toContain('Hippo Microwave Containers')
    expect(result?.sections[1].content).toBe(INFORMATION_HTML)
  })

  it('knows whether more than one section may stay open', () => {
    expect(readDescriptionSections(product(field(SETTINGS)))?.multi).toBe(false)
    expect(
      readDescriptionSections(product(field({ ...SETTINGS, accordian_multi: true })))
        ?.multi,
    ).toBe(true)
    expect(
      readDescriptionSections(
        product(field({ sections: [{ title: 'A', content: 'x' }] })),
      )?.multi,
    ).toBe(true)
  })

  it('orders sections by their saved position, not the order they came in', () => {
    const result = readDescriptionSections(
      product(
        field({
          sections: [
            { title: 'Second', content: 'b', position: 1 },
            { title: 'First', content: 'a', position: 0 },
          ],
        }),
      ),
    )

    expect(result?.sections.map((section) => section.title)).toEqual(['First', 'Second'])
  })

  it('has nothing when the metafield is missing or is another one', () => {
    expect(readDescriptionSections(product())).toBeNull()
    expect(
      readDescriptionSections(product(field(SETTINGS, { namespace: 'custom' }))),
    ).toBeNull()
    expect(readDescriptionSections(product(field(SETTINGS, { key: 'other' })))).toBeNull()
    expect(readDescriptionSections(null)).toBeNull()
    expect(readDescriptionSections(undefined)).toBeNull()
  })

  it('has nothing when the value is not the expected JSON, or has no titled section', () => {
    expect(readDescriptionSections(product(field('{not json')))).toBeNull()
    expect(readDescriptionSections(product(field('"just text"')))).toBeNull()
    expect(readDescriptionSections(product(field({ sections: 'nope' })))).toBeNull()
    expect(readDescriptionSections(product(field({ sections: [] })))).toBeNull()
    expect(
      readDescriptionSections(
        product(field({ sections: [{ title: '  ', content: 'x' }] })),
      ),
    ).toBeNull()
    expect(readDescriptionSections(product(field('', {})))).toBeNull()
  })

  it('keeps a titled section even when its content is empty', () => {
    const result = readDescriptionSections(
      product(field({ sections: [{ title: 'Delivery', content: null }] })),
    )

    expect(result?.sections).toEqual([{ title: 'Delivery', content: '' }])
  })
})

describe('editing the sections', () => {
  const sent = (...args: Parameters<typeof buildSectionsMetafield>) =>
    buildSectionsMetafield(...args)

  it('sends nothing when nothing changed (the HTML is never re-written)', () => {
    const p = product(field(SETTINGS))
    expect(sent(p, draftSections(p))).toBeNull()
    // Spaces around a title are not a change either.
    const drafts = draftSections(p)
    drafts[0].title = '  Product Description '
    expect(sent(p, drafts)).toBeNull()
  })

  it('sends the whole apd metafield, keeping every setting and each section’s own settings', () => {
    const p = product(field(SETTINGS))
    const drafts = draftSections(p)
    drafts[1].title = 'Details'
    drafts[1].content = '<p>New</p>'

    const metafield = sent(p, drafts)!
    expect(metafield).toMatchObject({ namespace: 'apd', key: 'apd', type: 'json_string' })
    expect(JSON.parse(metafield.value)).toEqual({
      ...SETTINGS,
      sections: [
        SETTINGS.sections[0],
        { ...SETTINGS.sections[1], title: 'Details', content: '<p>New</p>', position: 1 },
      ],
    })
  })

  it('writes the new order into each section’s position', () => {
    const p = product(field(SETTINGS))
    const drafts = draftSections(p).reverse()

    const value = JSON.parse(sent(p, drafts)!.value)
    expect(
      value.sections.map((s: { title: string; position: number }) => [
        s.title,
        s.position,
      ]),
    ).toEqual([
      ['Product Information', 0],
      ['Product Description', 1],
    ])
  })

  it('adds and removes sections', () => {
    const p = product(field(SETTINGS))
    const drafts = [
      ...draftSections(p).slice(0, 1),
      { ...blankSection(), title: 'Delivery' },
    ]

    const value = JSON.parse(sent(p, drafts)!.value)
    expect(value.sections.map((s: { title: string }) => s.title)).toEqual([
      'Product Description',
      'Delivery',
    ])
    expect(value.sections[1]).toEqual({ title: 'Delivery', content: '', position: 1 })
  })

  it('uses the metafield’s own type, and does nothing for a product without sections', () => {
    const p = product(field(SETTINGS, { type: 'json' }))
    const drafts = draftSections(p)
    drafts[0].title = 'X'
    expect(sent(p, drafts)?.type).toBe('json')

    expect(draftSections(product())).toEqual([])
    expect(sent(product(), [{ ...blankSection(), title: 'X' }])).toBeNull()
    expect(
      sent(product(field('{not json')), [{ ...blankSection(), title: 'X' }]),
    ).toBeNull()
  })
})
