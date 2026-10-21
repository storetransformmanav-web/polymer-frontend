import { describe, expect, it } from 'vitest'
import { readDescriptionSections } from './descriptionSections.ts'

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
