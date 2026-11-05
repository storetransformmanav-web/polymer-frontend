import { describe, expect, it } from 'vitest'
import {
  blankSection,
  buildSectionsMetafield,
  canAddDescriptionSections,
  DEFAULT_APD_SETTINGS,
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
    // The old REST label `json_string` is written as Shopify's `json`.
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
      { ...blankSection(), title: 'Delivery', content: '<p>2 days</p>' },
    ]

    const value = JSON.parse(sent(p, drafts)!.value)
    expect(value.sections.map((s: { title: string }) => s.title)).toEqual([
      'Product Description',
      'Delivery',
    ])
    expect(value.sections[1]).toEqual({
      title: 'Delivery',
      content: '<p>2 days</p>',
      position: 1,
      chosen: false,
      selected: false,
    })
  })

  it('uses the metafield’s own type', () => {
    const p = product(field(SETTINGS, { type: 'json' }))
    const drafts = draftSections(p)
    drafts[0].title = 'X'
    expect(sent(p, drafts)?.type).toBe('json')
  })
})

/**
 * The metafield the description app saves, as the backend shows it (every setting, then the two
 * sections). A product created or given its first sections must carry exactly this text.
 */
const APP_VALUE =
  '{"saved":true,"kind":1,"overwrite_styles":false,"inherit_fonts":true,"rounded_corners":true,"disable":false,"font_size":1,"spacing":1,"bold_section_titles":true,"border_color":"#e2e2e2","text_color":"#5e5e5e","heading_color":"#121212","accent_color":"#557b97","accordian_open":2,"accordian_heading_color":"#121212","accordian_icon_color":"#5e5e5e","accordian_side_borders":false,"accordian_multi":false,"accordian_border_color":"#e2e2e2","accordian_bg_color":"rgba(255,255,255,0)","accordian_icon":1,"switcher_style":2,"tabs_bordered":false,"switcher_swipe":false,"bottom_line_text_color":"#121212","bottom_line_color":"#e2e2e2","bottom_line_active_color":"#557b97","bottom_line_inactive_text_color":"#848484","tabs_border_color":"#e2e2e2","tabs_color":"#121212","tabs_bg_color":"rgba(255,255,255,0)","tabs_inactive_color":"#848484","tabs_hover_bg_color":"#f5f5f5","ios_active_bg_color":"#557b97","ios_bg_color":"rgba(255,255,255,0)","ios_active_color":"#fff","ios_color":"#557b97","buttons_active_bg_color":"#557b97","buttons_bg_color":"#f1f1f1","buttons_active_color":"#fff","buttons_color":"#5e5e5e","sections":[{"title":"Product Description","content":"<p>First&nbsp;text</p>","position":0,"chosen":false,"selected":false},{"title":"Product Information","content":"<p><strong>Specifications:</strong></p><table><tbody><tr><td>FT001</td></tr></tbody></table>","position":1,"chosen":false,"selected":false}]}'

describe('the exact text of the apd metafield', () => {
  const drafts = () => [
    {
      ...blankSection(),
      title: 'Product Description',
      content: '<p>First&nbsp;text</p>',
    },
    {
      ...blankSection(),
      title: 'Product Information',
      content:
        '<p><strong>Specifications:</strong></p><table><tbody><tr><td>FT001</td></tr></tbody></table>',
    },
  ]

  it('a new metafield is character for character what the description app saves', () => {
    const metafield = buildSectionsMetafield(product(), drafts())
    expect(metafield).toMatchObject({ namespace: 'apd', key: 'apd', type: 'json_string' })
    expect(metafield?.value).toBe(APP_VALUE)
  })

  it('editing a product that has it writes the same text back, only the section text changed', () => {
    const p = product(field(APP_VALUE))
    const edited = draftSections(p)
    edited[0].content = '<p>Second text</p>'

    const metafield = buildSectionsMetafield(p, edited)
    expect(metafield?.type).toBe('json_string')
    expect(metafield?.value).toBe(
      APP_VALUE.replace('<p>First&nbsp;text</p>', '<p>Second text</p>'),
    )
  })
})

describe('adding sections to a product that has none', () => {
  const first = () => [
    { ...blankSection(), title: ' Product Description ', content: '<p>Strong box.</p>' },
    { ...blankSection(), title: 'Product Information', content: '<p>Sizes</p>' },
  ]

  it('creates the apd metafield, as Add product sends it, for a product without one', () => {
    expect(draftSections(product())).toEqual([])
    expect(canAddDescriptionSections(product())).toBe(true)

    const metafield = buildSectionsMetafield(product(), first())
    expect(metafield).toMatchObject({ namespace: 'apd', key: 'apd', type: 'json_string' })
    expect(JSON.parse(metafield?.value ?? '')).toEqual({
      ...DEFAULT_APD_SETTINGS,
      sections: [
        {
          title: 'Product Description',
          content: '<p>Strong box.</p>',
          position: 0,
          chosen: false,
          selected: false,
        },
        {
          title: 'Product Information',
          content: '<p>Sizes</p>',
          position: 1,
          chosen: false,
          selected: false,
        },
      ],
    })
    // No sections typed: nothing is sent.
    expect(buildSectionsMetafield(product(), [])).toBeNull()
  })

  it('leaves out a new section that has no text yet', () => {
    const drafts = [
      { ...blankSection(), title: 'Product Description', content: '<p>Strong box.</p>' },
      { ...blankSection(), title: 'Product Information', content: '<p>&nbsp;</p>' },
    ]
    const value = JSON.parse(buildSectionsMetafield(product(), drafts)?.value ?? '')
    expect(value.sections.map((section: { title: string }) => section.title)).toEqual([
      'Product Description',
    ])
    expect(buildSectionsMetafield(product(), [drafts[1]])).toBeNull()
  })

  it('keeps the settings and type of a readable metafield that holds no section', () => {
    const empty = product(field({ ...SETTINGS, sections: [] }, { type: 'json' }))
    expect(readDescriptionSections(empty)).toBeNull()
    expect(canAddDescriptionSections(empty)).toBe(true)

    const metafield = buildSectionsMetafield(empty, first())
    expect(metafield?.type).toBe('json')
    const value = JSON.parse(metafield?.value ?? '')
    expect(value).toMatchObject({ border_color: '#e2e2e2', accordian_open: 2 })
    expect(value.sections.map((section: { title: string }) => section.title)).toEqual([
      'Product Description',
      'Product Information',
    ])
  })

  it('never writes over a metafield it cannot read', () => {
    const damaged = product(field('{not json'))
    expect(canAddDescriptionSections(damaged)).toBe(false)
    expect(buildSectionsMetafield(damaged, first())).toBeNull()
  })
})
