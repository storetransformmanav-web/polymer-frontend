import { describe, expect, it } from 'vitest'
import type { ProductCreateResult } from '../../../lib/api/endpoints.ts'
import {
  blankCreateDraft,
  blankMetafield,
  blankOption,
  buildCreateBody,
  buildListItem,
  firstImageUrl,
  isCreateDirty,
  syncVariants,
  validateCreateDraft,
  variantCombinations,
  type CreateDraft,
} from './createDraft.ts'
import { blankMedia } from './editDraft.ts'

/** A draft that is ready to be sent. */
function valid(overrides: Partial<CreateDraft> = {}): CreateDraft {
  const draft = blankCreateDraft('polymer-uk')
  draft.title = 'Sushi Tray'
  draft.variants[0].price = '9.99'
  return { ...draft, ...overrides }
}

/** Applies options the way the form does (variants follow). */
function withOptions(draft: CreateDraft, options: { name: string; values: string[] }[]) {
  return syncVariants({
    ...draft,
    options: options.map((option) => ({ ...blankOption(), ...option })),
  })
}

describe('variants follow the options', () => {
  it('is one variant without options', () => {
    expect(variantCombinations([])).toEqual([[]])
    expect(valid().variants).toHaveLength(1)
  })

  it('is every combination of the values, in option order', () => {
    const combos = variantCombinations([
      { ...blankOption(), name: 'Size', values: ['S', 'L'] },
      { ...blankOption(), name: 'Colour', values: ['Red', 'Blue', 'Green'] },
    ])

    expect(combos).toHaveLength(6)
    expect(combos[0]).toEqual(['S', 'Red'])
    expect(combos[5]).toEqual(['L', 'Green'])
  })

  it('ignores an option that has no name or no values yet', () => {
    expect(
      variantCombinations([
        { ...blankOption(), name: 'Size', values: ['S'] },
        { ...blankOption(), name: '', values: ['x'] },
        { ...blankOption(), name: 'Colour', values: [] },
      ]),
    ).toEqual([['S']])
  })

  it('keeps what was typed for a combination that still exists, and seeds new ones with the price', () => {
    let draft = withOptions(valid(), [{ name: 'Size', values: ['S'] }])
    draft.variants[0].sku = 'SKU-S'
    draft.variants[0].price = '12.50'

    draft = withOptions(draft, [{ name: 'Size', values: ['S', 'L'] }])

    expect(draft.variants.map((variant) => variant.optionValues)).toEqual([['S'], ['L']])
    expect(draft.variants[0].sku).toBe('SKU-S')
    // The new one starts with the first variant's price, but not its SKU.
    expect(draft.variants[1].price).toBe('12.50')
    expect(draft.variants[1].sku).toBe('')
  })

  it('goes back to a single variant when the options are removed, keeping the price', () => {
    let draft = withOptions(valid(), [{ name: 'Size', values: ['S', 'L'] }])
    draft = syncVariants({ ...draft, options: [] })

    expect(draft.variants).toHaveLength(1)
    expect(draft.variants[0].optionValues).toEqual([])
    expect(draft.variants[0].price).toBe('9.99')
  })
})

describe('validateCreateDraft', () => {
  it('accepts a title, a store and one priced variant', () => {
    expect(validateCreateDraft(valid())).toEqual({})
  })

  it('needs a store, a title and a price', () => {
    const draft = blankCreateDraft('')
    const errors = validateCreateDraft(draft)

    expect(errors.shop).toBeDefined()
    expect(errors.title).toBe('Enter a title')
    expect(errors['variants.0.price']).toBe('Enter a price')
  })

  it('checks lengths against the API limits', () => {
    const errors = validateCreateDraft(
      valid({
        title: 'a'.repeat(256),
        vendor: 'v'.repeat(256),
        seoTitle: 's'.repeat(71),
        seoDescription: 'd'.repeat(321),
        templateSuffix: 't'.repeat(101),
        categoryGid: 'c'.repeat(121),
      }),
    )

    for (const key of [
      'title',
      'vendor',
      'seoTitle',
      'seoDescription',
      'templateSuffix',
      'categoryGid',
    ]) {
      expect(errors[key]).toMatch(/at most/)
    }
  })

  it('accepts only non-negative numbers for prices, cost and weight', () => {
    const draft = valid({ weight: '-1' })
    draft.variants[0].price = 'abc'
    draft.variants[0].compareAtPrice = '1,5'
    draft.variants[0].cost = '-2'

    const errors = validateCreateDraft(draft)

    expect(errors['variants.0.price']).toBeDefined()
    expect(errors['variants.0.compareAtPrice']).toBeDefined()
    expect(errors['variants.0.cost']).toBeDefined()
    expect(errors.weight).toBeDefined()
  })

  it('needs a name and a value for each option, with different names, and at most three options', () => {
    let draft = valid()
    draft = withOptions(draft, [
      { name: 'Size', values: ['S'] },
      { name: 'size', values: ['L'] },
      { name: 'Colour', values: [] },
      { name: '', values: ['x'] },
    ])

    const errors = validateCreateDraft(draft)

    expect(errors['options.1.name']).toMatch(/different/)
    expect(errors['options.2.values']).toBeDefined()
    expect(errors['options.3.name']).toBeDefined()
    expect(errors.options).toMatch(/at most 3/)
  })

  it('refuses options that would make more than 100 variants', () => {
    const draft = withOptions(valid(), [
      { name: 'A', values: Array.from({ length: 11 }, (_, i) => `a${i}`) },
      { name: 'B', values: Array.from({ length: 10 }, (_, i) => `b${i}`) },
    ])
    for (const variant of draft.variants) variant.price = '1'

    expect(draft.variants).toHaveLength(110)
    expect(validateCreateDraft(draft).variants).toMatch(/110 variants/)
  })

  it('checks stock is a whole number, but only when a location is chosen', () => {
    const draft = valid()
    draft.variants[0].stock = '2.5'
    expect(validateCreateDraft(draft)['variants.0.stock']).toBeUndefined()

    expect(
      validateCreateDraft({ ...draft, locationId: '123' })['variants.0.stock'],
    ).toBeDefined()
  })

  it('wants public https addresses for media, skipping blank rows', () => {
    const draft = valid({
      media: [
        { ...blankMedia(), url: 'https://cdn.example.com/a.jpg' },
        blankMedia(),
        { ...blankMedia(), url: 'http://insecure.example.com/b.jpg' },
        { ...blankMedia(), url: '', alt: 'only alt' },
      ],
    })

    const errors = validateCreateDraft(draft)

    expect(errors['media.0.url']).toBeUndefined()
    expect(errors['media.1.url']).toBeUndefined()
    expect(errors['media.2.url']).toMatch(/https/)
    expect(errors['media.3.url']).toBeDefined()
  })

  it('only lets a variant show a picture that is in the media list', () => {
    const draft = valid({
      media: [{ ...blankMedia(), url: 'https://cdn.example.com/a.jpg' }],
    })
    draft.variants[0].imageUrl = 'https://cdn.example.com/other.jpg'

    expect(validateCreateDraft(draft)['variants.0.imageUrl']).toBeDefined()
    draft.variants[0].imageUrl = 'https://cdn.example.com/a.jpg'
    expect(validateCreateDraft(draft)['variants.0.imageUrl']).toBeUndefined()
  })

  it('checks collection ids and metafields, skipping an untouched metafield row', () => {
    const draft = valid({
      collections: ['3fa85f64-5717-4562-b3fc-2c963f66afa6', 'not-an-id'],
      metafields: [blankMetafield(), { ...blankMetafield(), metaKey: 'material' }],
    })

    const errors = validateCreateDraft(draft)

    expect(errors['collections.0']).toBeUndefined()
    expect(errors['collections.1']).toBeDefined()
    expect(errors['metafields.0.value']).toBeUndefined()
    expect(errors['metafields.1.value']).toBe('Enter a value')
  })
})

describe('buildCreateBody', () => {
  it('sends only what the user filled in, for a simple product', () => {
    expect(buildCreateBody(valid())).toEqual({
      shop: 'polymer-uk',
      title: 'Sushi Tray',
      status: 'DRAFT',
      gift_card: false,
      variants: [
        {
          price: '9.99',
          taxable: true,
          inventory_policy: 'DENY',
          tracked: true,
          requires_shipping: true,
        },
      ],
    })
  })

  it('sends everything that was entered', () => {
    const draft = withOptions(
      valid({
        descriptionHtml: '<p>Strong</p>',
        vendor: ' Polymer ',
        productType: 'Trays',
        status: 'ACTIVE',
        handle: 'sushi-tray',
        tags: ['a', 'b'],
        seoTitle: 'SEO',
        seoDescription: 'About',
        templateSuffix: 'wide',
        categoryGid: 'gid://shopify/TaxonomyCategory/aa',
        giftCard: true,
        weight: '1.5',
        weightUnit: 'KILOGRAMS',
        taxable: false,
        locationId: '77',
        media: [
          { ...blankMedia(), url: ' https://cdn.example.com/a.jpg ', alt: 'A' },
          blankMedia(),
        ],
        collections: ['3fa85f64-5717-4562-b3fc-2c963f66afa6'],
        metafields: [
          { ...blankMetafield(), metaKey: 'material', value: 'PET' },
          blankMetafield(),
        ],
      }),
      [{ name: 'Size', values: ['S', 'L'] }],
    )
    draft.variants[0].sku = 'S-1'
    draft.variants[0].stock = '12'
    draft.variants[0].imageUrl = 'https://cdn.example.com/a.jpg'
    draft.variants[1].compareAtPrice = '12'
    draft.variants[1].cost = '4'

    const body = buildCreateBody(draft)

    expect(body).toMatchObject({
      shop: 'polymer-uk',
      title: 'Sushi Tray',
      description_html: '<p>Strong</p>',
      vendor: 'Polymer',
      product_type: 'Trays',
      status: 'ACTIVE',
      handle: 'sushi-tray',
      tags: ['a', 'b'],
      seo: { title: 'SEO', description: 'About' },
      template_suffix: 'wide',
      category_gid: 'gid://shopify/TaxonomyCategory/aa',
      gift_card: true,
      options: [{ name: 'Size', values: ['S', 'L'] }],
      media: [{ url: 'https://cdn.example.com/a.jpg', alt: 'A', media_type: 'IMAGE' }],
      collections: ['3fa85f64-5717-4562-b3fc-2c963f66afa6'],
      metafields: [
        {
          namespace: 'custom',
          key: 'material',
          type: 'single_line_text_field',
          value: 'PET',
        },
      ],
    })
    expect(body.variants).toHaveLength(2)
    expect(body.variants[0]).toMatchObject({
      option_values: ['S'],
      price: '9.99',
      sku: 'S-1',
      taxable: false,
      weight: '1.5',
      weight_unit: 'KILOGRAMS',
      stock: [{ location_id: 77, available: 12 }],
      image_url: 'https://cdn.example.com/a.jpg',
    })
    expect(body.variants[1]).toMatchObject({
      option_values: ['L'],
      compare_at_price: '12',
      cost: '4',
    })
    expect(body.variants[1].stock).toBeUndefined()
  })

  it('leaves out stock when no location was chosen, and empty optional fields', () => {
    const draft = valid()
    draft.variants[0].stock = '5'
    const body = buildCreateBody(draft)

    expect(body.variants[0].stock).toBeUndefined()
    expect(body).not.toHaveProperty('vendor')
    expect(body).not.toHaveProperty('seo')
    expect(body).not.toHaveProperty('options')
    expect(body).not.toHaveProperty('media')
  })
})

describe('buildListItem', () => {
  const RESULT: ProductCreateResult = {
    product_id: 'new-id',
    shopify_id: 999,
    shopify_gid: 'gid://shopify/Product/999',
    handle: 'sushi-tray',
    title: 'Sushi Tray',
    status: 'DRAFT',
    shop: 'polymer-uk',
    variants: 2,
    media: 1,
    message: 'Product created in Shopify and the CRM',
  }

  it('is the row the product shows as in the list', () => {
    const draft = withOptions(
      valid({
        vendor: 'Polymer',
        productType: 'Trays',
        tags: ['x'],
        tracked: true,
        locationId: '77',
        media: [{ ...blankMedia(), url: 'https://cdn.example.com/a.jpg' }],
      }),
      [{ name: 'Size', values: ['S', 'L'] }],
    )
    draft.variants[0].price = '5'
    draft.variants[1].price = '7.5'
    draft.variants[0].stock = '3'
    draft.variants[1].stock = '4'

    const item = buildListItem(draft, RESULT, {
      key: 'polymer-uk',
      name: 'Polymer UK',
      currency: 'GBP',
    })

    expect(item).toMatchObject({
      id: 'new-id',
      shopify_id: 999,
      title: 'Sushi Tray',
      handle: 'sushi-tray',
      status: 'DRAFT',
      vendor: 'Polymer',
      product_type: 'Trays',
      tags: ['x'],
      image_url: 'https://cdn.example.com/a.jpg',
      price_min: '5.00',
      price_max: '7.50',
      currency: 'GBP',
      variants_count: 2,
      total_inventory: 7,
    })
    expect(item.shop?.key).toBe('polymer-uk')
  })

  it('has no stock figure when none was given', () => {
    expect(buildListItem(valid(), RESULT, null).total_inventory).toBeNull()
  })
})

describe('firstImageUrl', () => {
  it('is the first image address, trimmed', () => {
    const draft = valid({
      media: [
        { ...blankMedia(), url: '  https://cdn.example.com/a.jpg ' },
        { ...blankMedia(), url: 'https://cdn.example.com/b.jpg' },
      ],
    })
    expect(firstImageUrl(draft)).toBe('https://cdn.example.com/a.jpg')
  })

  it('skips empty rows and videos', () => {
    const draft = valid({
      media: [
        blankMedia(),
        {
          ...blankMedia(),
          url: 'https://cdn.example.com/v.mp4',
          mediaType: 'EXTERNAL_VIDEO',
        },
        { ...blankMedia(), url: 'https://cdn.example.com/b.jpg' },
      ],
    })
    expect(firstImageUrl(draft)).toBe('https://cdn.example.com/b.jpg')
  })

  it('is null without an image', () => {
    expect(firstImageUrl(valid())).toBeNull()
    expect(firstImageUrl(valid({ media: [blankMedia()] }))).toBeNull()
  })
})

describe('isCreateDirty', () => {
  it('is false for a fresh form, true as soon as anything is entered', () => {
    expect(isCreateDirty(blankCreateDraft('polymer-uk'))).toBe(false)
    expect(isCreateDirty({ ...blankCreateDraft('polymer-uk'), title: 'x' })).toBe(true)
    expect(isCreateDirty({ ...blankCreateDraft('polymer-uk'), tags: ['x'] })).toBe(true)

    const priced = blankCreateDraft('polymer-uk')
    priced.variants[0].price = '1'
    expect(isCreateDirty(priced)).toBe(true)
  })
})
