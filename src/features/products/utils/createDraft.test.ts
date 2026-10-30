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
    const draft = valid()
    draft.variants[0].weight = '-1'
    draft.variants[0].price = 'abc'
    draft.variants[0].compareAtPrice = '1,5'
    draft.variants[0].cost = '-2'

    const errors = validateCreateDraft(draft)

    expect(errors['variants.0.price']).toBeDefined()
    expect(errors['variants.0.compareAtPrice']).toBeDefined()
    expect(errors['variants.0.cost']).toBeDefined()
    expect(errors['variants.0.weight']).toBeDefined()
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

  it('checks a variant picture address: https only, within the length limit', () => {
    const draft = valid()
    draft.variants[0].imageUrl = 'http://cdn.example.com/a.jpg'
    expect(validateCreateDraft(draft)['variants.0.imageUrl']).toMatch(/https/)

    draft.variants[0].imageUrl = 'not a url'
    expect(validateCreateDraft(draft)['variants.0.imageUrl']).toMatch(/https/)

    draft.variants[0].imageUrl = 'https://cdn.example.com/' + 'x'.repeat(2000)
    expect(validateCreateDraft(draft)['variants.0.imageUrl']).toMatch(/at most 2000/)

    draft.variants[0].imageUrl = ' https://cdn.example.com/a.jpg '
    expect(validateCreateDraft(draft)['variants.0.imageUrl']).toBeUndefined()
  })

  it('does not need a variant picture to be typed into Media first', () => {
    const draft = valid({
      media: [{ ...blankMedia(), url: 'https://cdn.example.com/a.jpg' }],
    })
    draft.variants[0].imageUrl = 'https://cdn.example.com/other.jpg'

    expect(validateCreateDraft(draft)['variants.0.imageUrl']).toBeUndefined()
  })

  it('counts variant pictures against the 50-file media limit', () => {
    const draft = valid({
      media: Array.from({ length: 50 }, (_, i) => ({
        ...blankMedia(),
        url: 'https://cdn.example.com/' + i + '.jpg',
      })),
    })
    draft.variants[0].imageUrl = 'https://cdn.example.com/extra.jpg'

    expect(validateCreateDraft(draft)['media.rows']).toMatch(/at most 50/)
    draft.variants[0].imageUrl = 'https://cdn.example.com/3.jpg'
    expect(validateCreateDraft(draft)['media.rows']).toBeUndefined()
  })

  it('holds the tax code to the API limit of 50 characters', () => {
    expect(validateCreateDraft(valid({ taxCode: 'x'.repeat(51) })).taxCode).toMatch(
      /at most 50/,
    )
    expect(
      validateCreateDraft(valid({ taxCode: 'x'.repeat(50) })).taxCode,
    ).toBeUndefined()
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
    draft.variants[0].weight = '1.5'
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

  it('sends the category by name, and trims it', () => {
    const draft = valid({ category: '  Food Container Covers  ' })
    const body = buildCreateBody(draft)

    expect(body.category).toBe('Food Container Covers')
    expect(body.category_gid).toBeUndefined()
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

  it('uses a variant picture when there is no product media, so the new row is not left without an image', () => {
    const draft = valid()
    draft.variants[0].imageUrl = ' https://cdn.example.com/v.jpg '

    expect(firstImageUrl(draft)).toBe('https://cdn.example.com/v.jpg')
    expect(
      buildListItem(
        draft,
        {
          product_id: 'new-id',
          shopify_id: 1,
          shopify_gid: null,
          handle: 'h',
          title: 'Sushi Tray',
          status: 'DRAFT',
          shop: 'polymer-uk',
          variants: 1,
          media: 1,
          message: '',
        },
        null,
      ).image_url,
    ).toBe('https://cdn.example.com/v.jpg')
  })

  it('prefers the product media over a variant picture', () => {
    const draft = valid({
      media: [{ ...blankMedia(), url: 'https://cdn.example.com/a.jpg' }],
    })
    draft.variants[0].imageUrl = 'https://cdn.example.com/v.jpg'

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

describe('variant pictures in the request', () => {
  const A = 'https://cdn.example.com/a.jpg'
  const B = 'https://cdn.example.com/b.jpg'

  it('sends a single variant its picture and lists it in media', () => {
    const draft = valid()
    draft.variants[0].imageUrl = ' ' + A + ' '
    const body = buildCreateBody(draft)

    expect(body.variants).toHaveLength(1)
    expect(body.variants[0].image_url).toBe(A)
    expect(body.variants[0].option_values).toBeUndefined()
    expect(body.media).toEqual([{ url: A, media_type: 'IMAGE' }])
  })

  it('gives each variant of a multi-variant product its own picture, matched by combination', () => {
    const draft = withOptions(valid(), [
      { name: 'Colour', values: ['Red', 'Blue', 'Green'] },
    ])
    draft.variants.forEach((variant) => (variant.price = '5'))
    draft.variants[0].imageUrl = A
    draft.variants[1].imageUrl = B
    const body = buildCreateBody(draft)

    expect(body.variants.map((v) => [v.option_values, v.image_url])).toEqual([
      [['Red'], A],
      [['Blue'], B],
      [['Green'], undefined],
    ])
  })

  it('keeps each picture with its own combination when the options change', () => {
    const draft = withOptions(valid(), [{ name: 'Size', values: ['S', 'L'] }])
    draft.variants.forEach((variant) => (variant.price = '5'))
    draft.variants[1].imageUrl = B

    const grown = syncVariants({
      ...draft,
      options: [{ ...draft.options[0], values: ['S', 'M', 'L'] }],
    })

    expect(grown.variants.map((v) => [v.optionValues[0], v.imageUrl])).toEqual([
      ['S', ''],
      ['M', ''],
      ['L', B],
    ])
  })

  it('adds a picture that is not in the media list after the product media, once', () => {
    const draft = withOptions(
      valid({ media: [{ ...blankMedia(), url: A, alt: 'Front' }] }),
      [{ name: 'Size', values: ['S', 'L'] }],
    )
    draft.variants.forEach((variant) => (variant.price = '5'))
    draft.variants[0].imageUrl = A
    draft.variants[1].imageUrl = B
    const body = buildCreateBody(draft)

    expect(body.media).toEqual([
      { url: A, alt: 'Front', media_type: 'IMAGE' },
      { url: B, media_type: 'IMAGE' },
    ])

    // Two variants sharing a new picture list it once.
    draft.variants[0].imageUrl = B
    expect(buildCreateBody(draft).media?.filter((item) => item.url === B)).toHaveLength(1)
  })

  it('sends no image_url, and no extra media, when no variant has a picture', () => {
    const body = buildCreateBody(valid())

    expect(body.variants[0]).not.toHaveProperty('image_url')
    expect(body).not.toHaveProperty('media')
  })
})

describe('the create body only has fields the API has', () => {
  const API_FIELDS = [
    'shop',
    'title',
    'description_html',
    'vendor',
    'product_type',
    'status',
    'handle',
    'tags',
    'seo',
    'template_suffix',
    'category',
    'category_gid',
    'gift_card',
    'options',
    'variants',
    'media',
    'collections',
    'metafields',
  ]
  const API_VARIANT_FIELDS = [
    'option_values',
    'price',
    'compare_at_price',
    'sku',
    'barcode',
    'taxable',
    'tax_code',
    'inventory_policy',
    'tracked',
    'requires_shipping',
    'cost',
    'weight',
    'weight_unit',
    'stock',
    'image_url',
  ]

  it('even with every field filled in', () => {
    const draft = withOptions(
      valid({
        descriptionHtml: '<p>x</p>',
        vendor: 'V',
        productType: 'T',
        status: 'ACTIVE',
        handle: 'h',
        tags: ['a'],
        seoTitle: 's',
        seoDescription: 'd',
        templateSuffix: 't',
        category: 'Food Container Covers',
        categoryGid: 'gid://shopify/TaxonomyCategory/aa',
        giftCard: true,
        taxCode: 'TC',
        locationId: '9',
        media: [{ ...blankMedia(), url: 'https://cdn.example.com/a.jpg', alt: 'x' }],
        collections: ['3fa85f64-5717-4562-b3fc-2c963f66afa6'],
        metafields: [{ ...blankMetafield(), metaKey: 'k', value: 'v' }],
      }),
      [{ name: 'Size', values: ['S', 'L'] }],
    )
    draft.variants.forEach((variant) => {
      variant.price = '5'
      variant.compareAtPrice = '6'
      variant.cost = '2'
      variant.weight = '2'
      variant.sku = 'SKU'
      variant.barcode = 'BC'
      variant.stock = '4'
      variant.imageUrl = 'https://cdn.example.com/a.jpg'
    })
    const body = buildCreateBody(draft)

    expect(Object.keys(body).sort()).toEqual([...API_FIELDS].sort())
    for (const variant of body.variants) {
      expect(Object.keys(variant).sort()).toEqual([...API_VARIANT_FIELDS].sort())
      expect(variant.tax_code).toBe('TC')
    }
  })
})

describe('weights and list metafields', () => {
  it('gives each variant its own weight, in the one unit', () => {
    const draft = withOptions(valid(), [{ name: 'Size', values: ['Small', 'Large'] }])
    draft.variants.forEach((variant) => (variant.price = '5'))
    draft.variants[0].weight = '0.10'
    draft.variants[1].weight = '0.15'
    const body = buildCreateBody(draft)

    expect(body.variants.map((v) => [v.weight, v.weight_unit])).toEqual([
      ['0.10', 'KILOGRAMS'],
      ['0.15', 'KILOGRAMS'],
    ])
  })

  it('leaves out the weight (and unit) of a variant without one', () => {
    const draft = withOptions(valid(), [{ name: 'Size', values: ['S', 'L'] }])
    draft.variants.forEach((variant) => (variant.price = '5'))
    draft.variants[0].weight = '1'
    const body = buildCreateBody(draft)

    expect(body.variants[1]).not.toHaveProperty('weight')
    expect(body.variants[1]).not.toHaveProperty('weight_unit')
  })

  it('seeds a new combination with the first variant’s weight', () => {
    const draft = withOptions(valid(), [{ name: 'Size', values: ['S'] }])
    draft.variants[0].weight = '2'
    const grown = syncVariants({
      ...draft,
      options: [{ ...draft.options[0], values: ['S', 'L'] }],
    })

    expect(grown.variants.map((v) => v.weight)).toEqual(['2', '2'])
  })

  it('takes a list metafield only with a JSON array as its value', () => {
    const draft = valid({
      metafields: [
        {
          ...blankMetafield(),
          metaKey: 'material',
          type: 'list.single_line_text_field',
          value: 'Plastic',
        },
      ],
    })
    expect(validateCreateDraft(draft)['metafields.0.value']).toMatch(/JSON array/)

    draft.metafields[0].value = '["Plastic"]'
    expect(validateCreateDraft(draft)['metafields.0.value']).toBeUndefined()

    // A plain text type is not held to that.
    draft.metafields[0].type = 'single_line_text_field'
    draft.metafields[0].value = 'Plastic'
    expect(validateCreateDraft(draft)['metafields.0.value']).toBeUndefined()
  })
})

describe('a complete product, as in the shared example request', () => {
  it('produces exactly that request from the form (empty optional fields left out)', () => {
    const IMG_S = 'https://placehold.co/600x600?text=Small+Carrier+Bag'
    const IMG_L = 'https://placehold.co/600x600?text=Large+Carrier+Bag'
    const IMG_W = 'https://placehold.co/600x600?text=White+Plastic+Carrier+Bag'
    const draft = withOptions(
      valid({
        shop: 'polymer-uk',
        title: 'Demo White Plastic Carrier Bag',
        descriptionHtml: '<h2>White Plastic Carrier Bag</h2><p>A durable bag.</p>',
        vendor: 'Packaging By Polymer',
        productType: 'Carrier Bags',
        status: 'DRAFT',
        handle: 'demo-white-plastic-carrier-bag',
        tags: ['plastic carrier bag', 'white bag', 'packaging', 'demo'],
        seoTitle: 'Demo White Plastic Carrier Bag',
        seoDescription: 'White plastic carrier bags for retail packaging.',
        templateSuffix: '',
        categoryGid: 'gid://shopify/TaxonomyCategory/bi-22-6',
        giftCard: false,
        weightUnit: 'KILOGRAMS',
        media: [
          { ...blankMedia(), url: IMG_S, alt: 'Small white plastic carrier bag' },
          { ...blankMedia(), url: IMG_L, alt: 'Large white plastic carrier bag' },
          { ...blankMedia(), url: IMG_W, alt: 'White plastic carrier bag' },
        ],
        collections: [],
        metafields: [
          {
            ...blankMetafield(),
            metaKey: 'material',
            type: 'list.single_line_text_field',
            value: '["Plastic"]',
          },
        ],
      }),
      [{ name: 'Size', values: ['Small', 'Large'] }],
    )
    Object.assign(draft.variants[0], {
      price: '16.50',
      compareAtPrice: '18.50',
      sku: 'DEMO-BAG-S',
      cost: '8.00',
      weight: '0.10',
      imageUrl: IMG_S,
    })
    Object.assign(draft.variants[1], {
      price: '17.50',
      compareAtPrice: '20.00',
      sku: 'DEMO-BAG-L',
      cost: '9.00',
      weight: '0.15',
      imageUrl: IMG_L,
    })

    expect(validateCreateDraft(draft)).toEqual({})
    const common = {
      taxable: true,
      inventory_policy: 'DENY',
      tracked: true,
      requires_shipping: true,
      weight_unit: 'KILOGRAMS',
    }
    expect(buildCreateBody(draft)).toEqual({
      shop: 'polymer-uk',
      title: 'Demo White Plastic Carrier Bag',
      description_html: '<h2>White Plastic Carrier Bag</h2><p>A durable bag.</p>',
      vendor: 'Packaging By Polymer',
      product_type: 'Carrier Bags',
      status: 'DRAFT',
      handle: 'demo-white-plastic-carrier-bag',
      tags: ['plastic carrier bag', 'white bag', 'packaging', 'demo'],
      seo: {
        title: 'Demo White Plastic Carrier Bag',
        description: 'White plastic carrier bags for retail packaging.',
      },
      category_gid: 'gid://shopify/TaxonomyCategory/bi-22-6',
      gift_card: false,
      options: [{ name: 'Size', values: ['Small', 'Large'] }],
      variants: [
        {
          ...common,
          option_values: ['Small'],
          price: '16.50',
          compare_at_price: '18.50',
          sku: 'DEMO-BAG-S',
          cost: '8.00',
          weight: '0.10',
          image_url: IMG_S,
        },
        {
          ...common,
          option_values: ['Large'],
          price: '17.50',
          compare_at_price: '20.00',
          sku: 'DEMO-BAG-L',
          cost: '9.00',
          weight: '0.15',
          image_url: IMG_L,
        },
      ],
      media: [
        { url: IMG_S, alt: 'Small white plastic carrier bag', media_type: 'IMAGE' },
        { url: IMG_L, alt: 'Large white plastic carrier bag', media_type: 'IMAGE' },
        { url: IMG_W, alt: 'White plastic carrier bag', media_type: 'IMAGE' },
      ],
      metafields: [
        {
          namespace: 'custom',
          key: 'material',
          type: 'list.single_line_text_field',
          value: '["Plastic"]',
        },
      ],
    })
  })
})

describe('media and variant pictures, as in the new shared create request', () => {
  const IMG_50 = 'https://cdn.shopify.com/s/files/1/0000/0000/files/hsc500-50.jpg'
  const IMG_250 = 'https://cdn.shopify.com/s/files/1/0000/0000/files/hsc500-250.jpg'

  it('sends each variant’s image_url and lists the same pictures once in media, with their alt text', () => {
    const draft = withOptions(
      valid({
        title: 'Hinged Salad Container 500ml',
        locationId: '60465184951',
        media: [
          { ...blankMedia(), url: IMG_50, alt: 'Pack of 50' },
          { ...blankMedia(), url: IMG_250, alt: 'Pack of 250' },
        ],
      }),
      [{ name: 'Pack size', values: ['50', '250'] }],
    )
    Object.assign(draft.variants[0], {
      price: '9.99',
      sku: 'HSC500-50',
      stock: '120',
      imageUrl: IMG_50,
    })
    Object.assign(draft.variants[1], {
      price: '39.99',
      sku: 'HSC500-250',
      stock: '40',
      imageUrl: IMG_250,
    })

    expect(validateCreateDraft(draft)).toEqual({})
    const body = buildCreateBody(draft)

    expect(body.options).toEqual([{ name: 'Pack size', values: ['50', '250'] }])
    expect(body.variants.map((variant) => variant.image_url)).toEqual([IMG_50, IMG_250])
    expect(body.variants.map((variant) => variant.stock)).toEqual([
      [{ location_id: 60465184951, available: 120 }],
      [{ location_id: 60465184951, available: 40 }],
    ])
    // The pictures the variants point at are already in `media`, so they are not added twice.
    expect(body.media).toEqual([
      { url: IMG_50, alt: 'Pack of 50', media_type: 'IMAGE' },
      { url: IMG_250, alt: 'Pack of 250', media_type: 'IMAGE' },
    ])
  })

  it('adds a variant picture that is not in the media list, after the product’s own pictures', () => {
    const draft = withOptions(
      valid({ media: [{ ...blankMedia(), url: IMG_50, alt: 'Pack of 50' }] }),
      [{ name: 'Pack size', values: ['50', '250'] }],
    )
    draft.variants[1].imageUrl = IMG_250

    expect(buildCreateBody(draft).media).toEqual([
      { url: IMG_50, alt: 'Pack of 50', media_type: 'IMAGE' },
      { url: IMG_250, media_type: 'IMAGE' },
    ])
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
