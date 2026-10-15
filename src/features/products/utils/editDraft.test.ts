import { describe, expect, it } from 'vitest'
import type { ProductDetail } from '../../../lib/api/endpoints.ts'
import {
  blankMedia,
  buildMediaItems,
  blankVariant,
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

    it('removes a variant, and ignores edits to a variant being removed', () => {
      const body = edit(makeProduct(), (draft) => {
        draft.variants[1].price = '99'
        draft.variants[1].removed = true
      })

      expect(body.variants_remove).toEqual([VARIANT_B])
      expect(body.variants).toBeUndefined()
    })

    it('creates a variant with its option values and everything filled in', () => {
      const body = edit(makeProduct(), (draft) => {
        const variant = blankVariant(1)
        variant.optionValues = [' L ']
        variant.price = '31.5'
        variant.sku = ' SKU-3 '
        variant.weight = '200'
        draft.variants.push(variant)
      })

      expect(body.variants).toEqual([
        {
          option_values: ['L'],
          price: '31.5',
          sku: 'SKU-3',
          weight: '200',
          weight_unit: 'GRAMS',
          taxable: true,
          inventory_policy: 'DENY',
          tracked: true,
          requires_shipping: true,
        },
      ])
    })

    it('drops a new variant that was added and then removed again', () => {
      const body = edit(makeProduct(), (draft) => {
        const variant = blankVariant(1)
        variant.removed = true
        draft.variants.push(variant)
      })

      expect(body).toEqual({})
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

  it('needs a price and every option value for a new variant', () => {
    const errors = problems((d) => d.variants.push(blankVariant(1)))

    expect(errors['variants.2.price']).toBe('Enter a price')
    expect(errors['variants.2.optionValues']).toBeDefined()
  })

  it('does not let every variant be removed', () => {
    const errors = problems((d) =>
      d.variants.forEach((variant) => (variant.removed = true)),
    )

    expect(errors.variants).toBe('A product needs at least one variant')
    // ...but swapping one for a new variant is fine.
    const swapped = problems((d) => {
      d.variants.forEach((variant) => (variant.removed = true))
      const fresh = blankVariant(1)
      fresh.optionValues = ['L']
      fresh.price = '5'
      d.variants.push(fresh)
    })
    expect(swapped.variants).toBeUndefined()
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

describe('the "Add media" form', () => {
  const row = (url: string, alt = '') => ({ ...blankMedia(), url, alt })

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
    const rows = Array.from({ length: 21 }, () => row('https://cdn.example.com/a.jpg'))

    expect(validateNewMedia(rows).rows).toMatch(/at most 20/)
    expect(validateNewMedia(rows.slice(0, 20))).toEqual({})
  })
})
