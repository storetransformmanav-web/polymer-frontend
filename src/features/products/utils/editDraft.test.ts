import { describe, expect, it } from 'vitest'
import type { ProductDetail } from '../../../lib/api/endpoints.ts'
import {
  blankMedia,
  buildMediaItems,
  buildUpdateBody,
  draftFromProduct,
  hasChanges,
  LIMITS,
  validateDraft,
  type ProductDraft,
  validateNewMedia,
} from './editDraft.ts'

const VARIANT_A = '11111111-1111-4111-8111-111111111111'
const VARIANT_B = '22222222-2222-4222-8222-222222222222'
const IMAGE_1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const IMAGE_2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const IMAGE_3 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const COLLECTION = '33333333-3333-4333-8333-333333333333'

function makeVariant(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    shopify_id: 1,
    title: 'Default Title',
    sku: 'SKU-1',
    barcode: '',
    position: 1,
    price: '25.85',
    compare_at_price: null,
    cost: null,
    currency: 'GBP',
    taxable: true,
    weight: '100',
    weight_unit: 'GRAMS',
    requires_shipping: true,
    inventory_policy: 'DENY',
    inventory_management: 'SHOPIFY',
    inventory_levels: [],
    metafields: [],
    ...over,
  } as ProductDetail['variants'][number]
}

function makeProduct(): ProductDetail {
  return {
    id: 'p1',
    shopify_id: 1,
    title: 'Hippo Bag',
    handle: 'hippo-bag',
    description_html: '<p>Strong bag</p>',
    status: 'ACTIVE',
    vendor: 'Polymer',
    product_type: 'Bags',
    category: null,
    tags: ['bag', 'plastic'],
    template_suffix: '',
    seo: { title: 'Hippo', description: 'A bag' },
    currency: 'GBP',
    synced_at: '2026-01-01T00:00:00Z',
    options: [{ name: 'Size', position: 1, values: ['S', 'M'] }],
    images: [
      {
        id: IMAGE_1,
        url: 'https://cdn.example.com/1.jpg',
        alt_text: 'One',
        position: 1,
        media_type: 'IMAGE',
      },
      {
        id: IMAGE_2,
        url: 'https://cdn.example.com/2.jpg',
        alt_text: null,
        position: 2,
        media_type: 'IMAGE',
      },
      {
        id: IMAGE_3,
        url: 'https://cdn.example.com/3.jpg',
        alt_text: 'Three',
        position: 3,
        media_type: 'IMAGE',
      },
    ],
    variants: [
      makeVariant(VARIANT_A),
      makeVariant(VARIANT_B, { title: 'Large', sku: 'SKU-2' }),
    ],
    collections: [
      {
        id: COLLECTION,
        shopify_id: 1,
        title: 'All',
        handle: 'all',
        collection_type: 'smart',
      },
    ],
    metafields: [],
  } as unknown as ProductDetail
}

const edit = (product: ProductDetail, change: (draft: ProductDraft) => void) => {
  const draft = draftFromProduct(product)
  change(draft)
  return buildUpdateBody(product, draft)
}

describe('buildUpdateBody', () => {
  it('is empty when nothing changed — so there is nothing to save', () => {
    const product = makeProduct()
    const body = buildUpdateBody(product, draftFromProduct(product))

    expect(body).toEqual({})
    expect(hasChanges(body)).toBe(false)
  })

  it('sends only the fields that changed, trimmed', () => {
    const body = edit(makeProduct(), (draft) => {
      draft.title = '  Hippo Bag XL  '
      draft.vendor = 'Packaging By Polymer'
      draft.status = 'DRAFT'
    })

    expect(body).toEqual({
      title: 'Hippo Bag XL',
      vendor: 'Packaging By Polymer',
      status: 'DRAFT',
    })
  })

  it('can clear a text field, and never offers "unlisted" as a status to save', () => {
    const product = makeProduct()
    product.status = 'UNLISTED'

    // Unchanged (still unlisted): nothing is sent for status.
    expect(edit(product, () => undefined)).toEqual({})

    const body = edit(product, (draft) => {
      draft.productType = ''
      draft.status = 'UNLISTED'
    })
    expect(body).toEqual({ product_type: '' })
  })

  it('changes tags as an add/remove diff, not a replacement', () => {
    const body = edit(makeProduct(), (draft) => {
      draft.tags = ['bag', 'eco', 'sale']
    })

    expect(body.tags).toBeUndefined()
    expect(body.tags_add).toEqual(['eco', 'sale'])
    expect(body.tags_remove).toEqual(['plastic'])
  })

  it('sends both SEO fields when either changes', () => {
    const body = edit(makeProduct(), (draft) => {
      draft.seoTitle = 'Hippo carrier bag'
    })

    expect(body).toEqual({ seo: { title: 'Hippo carrier bag', description: 'A bag' } })
  })

  it('removes collections, and adds new ones by id (ignoring ones already there)', () => {
    const NEW = '44444444-4444-4444-8444-444444444444'
    const body = edit(makeProduct(), (draft) => {
      draft.removedCollectionIds = [COLLECTION]
      draft.addedCollectionIds = [NEW, NEW, COLLECTION]
    })

    expect(body.collections_remove).toEqual([COLLECTION])
    expect(body.collections_add).toEqual([NEW])
  })

  describe('variants', () => {
    it('sends only the changed fields of only the changed variants, keyed by id', () => {
      const body = edit(makeProduct(), (draft) => {
        draft.variants[0].price = '30'
        draft.variants[0].compareAtPrice = '35.50'
        draft.variants[0].taxable = false
      })

      expect(body.variants).toEqual([
        { id: VARIANT_A, price: '30', compare_at_price: '35.50', taxable: false },
      ])
    })

    it('treats the same number written differently as unchanged', () => {
      const body = edit(makeProduct(), (draft) => {
        draft.variants[0].price = '25.850'
      })

      expect(body).toEqual({})
    })

    it('sends null to clear a compare-at price, cost or weight', () => {
      const product = makeProduct()
      product.variants[0] = makeVariant(VARIANT_A, {
        compare_at_price: '40.00',
        cost: '10.00',
      })
      const body = edit(product, (draft) => {
        draft.variants[0].compareAtPrice = ''
        draft.variants[0].cost = ''
        draft.variants[0].weight = ''
      })

      expect(body.variants).toEqual([
        { id: VARIANT_A, compare_at_price: null, cost: null, weight: null },
      ])
    })

    it('never sends a new variant — only existing ones are edited or removed', () => {
      const body = edit(makeProduct(), (draft) => {
        draft.variants[0].price = '99'
      })

      expect(body.variants).toEqual([{ id: VARIANT_A, price: '99' }])
      expect(JSON.stringify(body)).not.toContain('option_values')
    })

    it('preselects the picture a variant already shows (matched by file), and sends nothing for it', () => {
      const product = makeProduct()
      product.variants[0] = makeVariant(VARIANT_A, {
        // The store's address carries a cache-busting query the image list doesn't.
        image_url: 'https://cdn.example.com/2.jpg?v=99',
      })
      const draft = draftFromProduct(product)

      expect(draft.variants[0].imageId).toBe(IMAGE_2)
      expect(draft.variants[1].imageId).toBe('')
      expect(buildUpdateBody(product, draft)).toEqual({})
    })

    it('sends image_attachment_id only when the variant is given a different picture', () => {
      const product = makeProduct()
      product.variants[0] = makeVariant(VARIANT_A, {
        image_url: 'https://cdn.example.com/2.jpg',
      })

      const same = edit(product, (draft) => {
        draft.variants[0].imageId = IMAGE_2
      })
      expect(same).toEqual({})

      const changed = edit(product, (draft) => {
        draft.variants[0].imageId = IMAGE_3
      })
      expect(changed.variants).toEqual([{ id: VARIANT_A, image_attachment_id: IMAGE_3 }])

      // A variant with no picture can be given one.
      const given = edit(product, (draft) => {
        draft.variants[1].imageId = IMAGE_1
      })
      expect(given.variants).toEqual([{ id: VARIANT_B, image_attachment_id: IMAGE_1 }])
    })

    it('removes a variant, and ignores edits to a variant being removed', () => {
      const body = edit(makeProduct(), (draft) => {
        draft.variants[1].price = '99'
        draft.variants[1].removed = true
      })

      expect(body.variants_remove).toEqual([VARIANT_B])
      expect(body.variants).toBeUndefined()
    })
  })

  describe('media', () => {
    it('updates alt text, and sends nothing about files — adding and removing are their own calls', () => {
      const body = edit(makeProduct(), (draft) => {
        draft.images[1].alt = 'Two'
      })

      expect(body.media_update).toEqual([{ attachment_id: IMAGE_2, alt: 'Two' }])
      expect(body.media_add).toBeUndefined()
      expect(body.media_remove).toBeUndefined()
      expect(body.media_order).toBeUndefined()
    })

    it('sends the new order (first = featured) only when it changed', () => {
      const body = edit(makeProduct(), (draft) => {
        draft.images = [draft.images[2], draft.images[0], draft.images[1]]
      })

      expect(body.media_order).toEqual([IMAGE_3, IMAGE_1, IMAGE_2])
    })
  })
})

/** The fields `PUT /products/{id}` accepts (from the API's ProductUpdate / VariantIn). */
const API_FIELDS = new Set([
  'title',
  'description_html',
  'vendor',
  'product_type',
  'status',
  'handle',
  'tags',
  'tags_add',
  'tags_remove',
  'seo',
  'template_suffix',
  'category_gid',
  'collections_add',
  'collections_remove',
  'variants',
  'variants_remove',
  'media_add',
  'media_update',
  'media_remove',
  'media_order',
  'metafields',
])
const API_VARIANT_FIELDS = new Set([
  'id',
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
  'image_attachment_id',
])

describe('the update body only has fields the API has', () => {
  it('even when every editable field is changed at once', () => {
    const body = edit(makeProduct(), (draft) => {
      draft.title = 'T'
      draft.descriptionHtml = '<p>D</p>'
      draft.vendor = 'V'
      draft.productType = 'PT'
      draft.status = 'ARCHIVED'
      draft.handle = 'h'
      draft.templateSuffix = 'suffix'
      draft.categoryGid = 'gid://shopify/TaxonomyCategory/aa-1'
      draft.tags = ['new']
      draft.seoTitle = 'S'
      draft.seoDescription = 'SD'
      draft.addedCollectionIds = ['44444444-4444-4444-8444-444444444444']
      draft.removedCollectionIds = [COLLECTION]
      draft.images[0].alt = 'changed'
      draft.images = [draft.images[1], draft.images[0], draft.images[2]]
      const variant = draft.variants[0]
      variant.price = '1'
      variant.compareAtPrice = '2'
      variant.sku = 'S'
      variant.barcode = 'B'
      variant.taxable = !variant.taxable
      variant.inventoryPolicy = variant.inventoryPolicy === 'DENY' ? 'CONTINUE' : 'DENY'
      variant.tracked = !variant.tracked
      variant.requiresShipping = !variant.requiresShipping
      variant.cost = '3'
      variant.weight = '4'
      variant.weightUnit = 'KILOGRAMS'
      variant.imageId = IMAGE_1
      draft.variants[1].removed = true
    })

    expect(Object.keys(body).length).toBeGreaterThan(10)
    for (const key of Object.keys(body)) expect(API_FIELDS.has(key), key).toBe(true)
    for (const variant of body.variants ?? []) {
      for (const key of Object.keys(variant)) {
        expect(API_VARIANT_FIELDS.has(key), `variants.${key}`).toBe(true)
      }
    }
    expect(Object.keys(body.variants?.[0] ?? {}).length).toBeGreaterThan(10)
  })
})

describe('validateDraft', () => {
  const problems = (change: (draft: ProductDraft) => void) => {
    const product = makeProduct()
    const draft = draftFromProduct(product)
    change(draft)
    return validateDraft(product, draft)
  }

  it('accepts an untouched product', () => {
    expect(problems(() => undefined)).toEqual({})
  })

  it('requires a title within the length limit', () => {
    expect(problems((d) => (d.title = '   ')).title).toBe('Enter a title')
    expect(problems((d) => (d.title = 'x'.repeat(LIMITS.title + 1))).title).toMatch(
      /at most 255/,
    )
    expect(problems((d) => (d.title = 'x'.repeat(LIMITS.title))).title).toBeUndefined()
  })

  it('holds SEO text to the search-engine limits', () => {
    const errors = problems((d) => {
      d.seoTitle = 'x'.repeat(71)
      d.seoDescription = 'y'.repeat(321)
    })

    expect(errors.seoTitle).toMatch(/at most 70/)
    expect(errors.seoDescription).toMatch(/at most 320/)
  })

  it('rejects negative, non-numeric or exponent prices and weights', () => {
    const errors = problems((d) => {
      d.variants[0].price = '-5'
      d.variants[0].compareAtPrice = 'abc'
      d.variants[0].cost = '1e3'
      d.variants[1].weight = '12,5'
    })

    expect(errors['variants.0.price']).toBeDefined()
    expect(errors['variants.0.compareAtPrice']).toBeDefined()
    expect(errors['variants.0.cost']).toBeDefined()
    expect(errors['variants.1.weight']).toBeDefined()
  })

  it('does not let every variant be removed', () => {
    const errors = problems((d) =>
      d.variants.forEach((variant) => (variant.removed = true)),
    )

    expect(errors.variants).toBe('A product needs at least one variant')
    // Removing all but one is fine.
    const some = problems((d) => {
      d.variants[0].removed = true
    })
    expect(some.variants).toBeUndefined()
  })

  it('does not validate a variant that is being removed', () => {
    const errors = problems((d) => {
      d.variants[0].price = 'nonsense'
      d.variants[0].removed = true
    })

    expect(errors).toEqual({})
  })

  it('checks that a collection to add is a real id', () => {
    const errors = problems((d) => {
      d.addedCollectionIds = ['not-a-uuid', '44444444-4444-4444-8444-444444444444']
    })

    expect(errors['addedCollections.0']).toBeDefined()
    expect(errors['addedCollections.1']).toBeUndefined()
  })
})

describe('the "Add media" form, for the documented three-image example', () => {
  const row = (url: string, alt: string) => ({ ...blankMedia(), url, alt })
  const rows = [
    row(
      'https://placehold.co/600x600?text=Small+Carrier+Bag',
      'Small white plastic carrier bag',
    ),
    row(
      'https://placehold.co/600x600?text=Large+Carrier+Bag',
      'Large white plastic carrier bag',
    ),
    row(
      'https://placehold.co/600x600?text=White+Plastic+Carrier+Bag',
      'White plastic carrier bag',
    ),
  ]

  it('is valid, and becomes exactly the documented { items } body', () => {
    expect(validateNewMedia(rows)).toEqual({})
    expect(buildMediaItems(rows)).toEqual([
      {
        url: 'https://placehold.co/600x600?text=Small+Carrier+Bag',
        media_type: 'IMAGE',
        alt: 'Small white plastic carrier bag',
      },
      {
        url: 'https://placehold.co/600x600?text=Large+Carrier+Bag',
        media_type: 'IMAGE',
        alt: 'Large white plastic carrier bag',
      },
      {
        url: 'https://placehold.co/600x600?text=White+Plastic+Carrier+Bag',
        media_type: 'IMAGE',
        alt: 'White plastic carrier bag',
      },
    ])
  })

  it('takes up to 20 files in one call, the API’s limit, and no more', () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      row('https://cdn.example.com/' + i + '.jpg', ''),
    )
    expect(validateNewMedia(many)).toEqual({})
    expect(
      validateNewMedia([...many, row('https://cdn.example.com/x.jpg', '')]).rows,
    ).toMatch(/at most 20/)
  })
})

describe('the "Add media" form', () => {
  const row = (url: string, alt = '') => ({ ...blankMedia(), url, alt })

  it('refuses the same address twice in one go, and never sends it twice', () => {
    const rows = [
      row('https://cdn.example.com/a.jpg'),
      row('https://cdn.example.com/b.jpg'),
      row('  HTTPS://cdn.example.com/A.jpg '),
    ]

    expect(validateNewMedia(rows)).toEqual({
      '2.url': 'This address is already in the list above',
    })
    // Even if it were sent, the second copy is dropped.
    expect(buildMediaItems(rows).map((item) => item.url)).toEqual([
      'https://cdn.example.com/a.jpg',
      'https://cdn.example.com/b.jpg',
    ])
  })

  it('turns filled rows into the items POST /media takes, skipping blank rows', () => {
    const items = buildMediaItems([
      row(' https://cdn.example.com/a.jpg ', 'First'),
      row(''),
      { ...row('https://cdn.example.com/b.mp4'), mediaType: 'VIDEO' },
    ])

    expect(items).toEqual([
      { url: 'https://cdn.example.com/a.jpg', alt: 'First', media_type: 'IMAGE' },
      { url: 'https://cdn.example.com/b.mp4', media_type: 'VIDEO' },
    ])
  })

  it('accepts only public https addresses, within the limits', () => {
    const errors = validateNewMedia([
      row('http://cdn.example.com/a.jpg'),
      row('javascript:alert(1)'),
      row('https://cdn.example.com/ok.jpg', 'a'.repeat(513)),
      row('https://cdn.example.com/fine.jpg'),
    ])

    expect(errors['0.url']).toMatch(/https/)
    expect(errors['1.url']).toMatch(/https/)
    expect(errors['2.url']).toBeUndefined()
    expect(errors['2.alt']).toMatch(/at most 512/)
    expect(errors['3.url']).toBeUndefined()
    expect(errors.rows).toBeUndefined()
  })

  it('needs at least one address, and ignores rows left entirely blank', () => {
    expect(validateNewMedia([row('')]).rows).toMatch(/at least one/)
    expect(validateNewMedia([row('https://cdn.example.com/a.jpg'), row('')])).toEqual({})
  })

  it('wants an address for a row that only has alt text', () => {
    expect(
      validateNewMedia([row('https://cdn.example.com/a.jpg'), row('', 'Only alt')])[
        '1.url'
      ],
    ).toBeDefined()
  })

  it('allows at most 20 files in one call', () => {
    const rows = Array.from({ length: 21 }, (_, i) =>
      row(`https://cdn.example.com/${i}.jpg`),
    )

    expect(validateNewMedia(rows).rows).toMatch(/at most 20/)
    expect(validateNewMedia(rows.slice(0, 20))).toEqual({})
  })
})
