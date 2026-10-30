import { describe, expect, it } from 'vitest'
import type { ProductDetail } from '../../../lib/api/endpoints.ts'
import {
  blankAddedOption,
  blankMedia,
  blankNewVariant,
  blankStockRow,
  blankMetafieldEdit,
  buildMediaItems,
  buildUpdateBody,
  draftFromProduct,
  hasChanges,
  LIMITS,
  validateDraft,
  type ProductDraft,
  validateNewMedia,
  variantImageLinks,
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

  it('sends the category by name, and only when one was typed', () => {
    expect(edit(makeProduct(), () => undefined)).toEqual({})
    expect(
      edit(makeProduct(), (draft) => {
        draft.category = '  Food Container Covers '
      }),
    ).toEqual({ category: 'Food Container Covers' })
  })

  it('asks for the old address to redirect when the handle changes, unless that is switched off', () => {
    // Nothing about redirecting without a new handle.
    expect(edit(makeProduct(), () => undefined)).not.toHaveProperty('redirect_new_handle')

    expect(
      edit(makeProduct(), (draft) => {
        draft.handle = 'hinged-salad-container-500ml'
      }),
    ).toEqual({ handle: 'hinged-salad-container-500ml', redirect_new_handle: true })

    expect(
      edit(makeProduct(), (draft) => {
        draft.handle = 'hinged-salad-container-500ml'
        draft.redirectHandle = false
      }),
    ).toEqual({ handle: 'hinged-salad-container-500ml', redirect_new_handle: false })

    // Changing the box without changing the handle sends nothing.
    expect(
      edit(makeProduct(), (draft) => {
        draft.redirectHandle = false
      }),
    ).toEqual({})
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

  it('removes collections and adds new ones, both by name (ignoring ones already there)', () => {
    const body = edit(makeProduct(), (draft) => {
      draft.removedCollectionIds = [COLLECTION]
      draft.addedCollections = ['Food Packaging', ' food packaging ', 'All']
    })

    expect(body.collections_remove).toEqual(['All'])
    expect(body.collections_add).toEqual(['Food Packaging'])
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
/** A product with two metafields of its own (and a variant that has one). */
function withMetafields(): ProductDetail {
  const product = makeProduct()
  product.metafields = [
    {
      namespace: 'custom',
      key: 'material',
      type: 'single_line_text_field',
      value: 'Foil',
    },
    { namespace: 'custom', key: 'eco', type: 'boolean', value: 'true' },
    {
      namespace: 'apd',
      key: 'apd',
      type: 'json_string',
      value: JSON.stringify({
        sections: [{ title: 'A', content: '<p>x</p>', position: 0 }],
      }),
    },
    {
      namespace: 'global',
      key: 'title_tag',
      type: 'single_line_text_field',
      value: 'Hippo',
    },
  ]
  product.variants[0].metafields = [
    { namespace: 'my_fields', key: 'unit', type: 'number_integer', value: '500' },
  ]
  return product
}

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
  'redirect_new_handle',
  'category',
  'collections_add',
  'collections_remove',
  'collections_create',
  'options_update',
  'options_add',
  'variants',
  'variants_remove',
  'media_add',
  'media_update',
  'media_remove',
  'media_order',
  'metafields',
  'metafields_remove',
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
  'stock',
  'image_url',
  'remove_image',
  'image_attachment_id',
  'metafields',
  'metafields_remove',
])

describe('the update body only has fields the API has', () => {
  it('even when every editable field is changed at once', () => {
    const body = edit(withMetafields(), (draft) => {
      draft.title = 'T'
      draft.descriptionHtml = '<p>D</p>'
      draft.vendor = 'V'
      draft.productType = 'PT'
      draft.status = 'ARCHIVED'
      draft.handle = 'h'
      draft.templateSuffix = 'suffix'
      draft.category = 'Food Container Covers'
      draft.tags = ['new']
      draft.seoTitle = 'S'
      draft.seoDescription = 'SD'
      draft.addedCollections = ['Food Packaging']
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
      variant.taxCode = 'P0000000'
      draft.variants[1].removed = true
      // A product metafield changed, one added to a variant, one removed.
      draft.metafields[0].value = 'changed'
      draft.metafields[1].removed = true
      draft.metafields.push({
        ...blankMetafieldEdit(),
        variantId: VARIANT_A,
        metaKey: 'extra',
        value: 'x',
      })
    })

    expect(Object.keys(body).length).toBeGreaterThan(10)
    for (const key of Object.keys(body)) expect(API_FIELDS.has(key), key).toBe(true)
    expect(body.metafields).toBeDefined()
    expect(body.metafields_remove).toBeDefined()
    for (const variant of body.variants ?? []) {
      for (const key of Object.keys(variant)) {
        expect(API_VARIANT_FIELDS.has(key), `variants.${key}`).toBe(true)
      }
    }
    expect(Object.keys(body.variants?.[0] ?? {}).length).toBeGreaterThan(10)
  })
})

describe('stock, pictures, options and new variants in the update body', () => {
  const LOCATION = 60465184951
  const withStock = () => {
    const product = makeProduct()
    product.variants[0] = makeVariant(VARIANT_A, {
      image_url: 'https://cdn.example.com/1.jpg',
      inventory_levels: [
        { location_shopify_id: LOCATION, location_name: 'Unit 9', available: 5 },
        { location_shopify_id: 2, location_name: 'Shop', available: 0 },
      ],
    })
    return product
  }

  it('sends only the locations whose quantity was changed', () => {
    const body = edit(withStock(), (draft) => {
      draft.variants[0].stock[0].available = '12'
    })
    expect(body).toEqual({
      variants: [{ id: VARIANT_A, stock: [{ location_id: LOCATION, available: 12 }] }],
    })
    // Retyping the same number, or leaving a box blank, changes nothing.
    expect(
      edit(withStock(), (draft) => {
        draft.variants[0].stock[0].available = ' 5 '
        draft.variants[0].stock[1].available = ''
      }),
    ).toEqual({})
  })

  it('sends a location the variant had no stock at, or a row moved to another location', () => {
    const body = edit(withStock(), (draft) => {
      // The first row is moved to another location (same quantity); a third row is added.
      draft.variants[0].stock[0].locationId = '99'
      draft.variants[0].stock.push({
        ...blankStockRow(),
        locationId: '123',
        available: '7',
      })
    })
    expect(body.variants?.[0].stock).toEqual([
      { location_id: 99, available: 5 },
      { location_id: 123, available: 7 },
    ])
    // A new row with no quantity yet sends nothing.
    expect(
      edit(withStock(), (draft) => {
        draft.variants[0].stock.push({ ...blankStockRow(), locationId: '123' })
      }),
    ).toEqual({})
  })

  it('takes a variant picture off with remove_image, only when it has one', () => {
    expect(
      edit(withStock(), (draft) => {
        draft.variants[0].removeImage = true
      }),
    ).toEqual({ variants: [{ id: VARIANT_A, remove_image: true }] })
    // The second variant shows no picture, so there is nothing to take off.
    expect(
      edit(withStock(), (draft) => {
        draft.variants[1].removeImage = true
      }),
    ).toEqual({})
  })

  it('renames an option and its values, naming the option as it is now', () => {
    const body = edit(makeProduct(), (draft) => {
      draft.options[0].newName = ' Pack Size '
      draft.options[0].values[1].to = '50 pcs'
    })
    expect(body).toEqual({
      options_update: [
        {
          name: 'Size',
          new_name: 'Pack Size',
          values_rename: [{ from: 'M', to: '50 pcs' }],
        },
      ],
    })
    expect(edit(makeProduct(), () => undefined)).toEqual({})
  })

  it('adds an option, and a variant that has a value for every option', () => {
    const body = edit(makeProduct(), (draft) => {
      draft.addedOptions = [{ ...blankAddedOption(), name: 'Colour', values: ['Clear'] }]
      draft.newVariants = [
        {
          ...blankNewVariant('KILOGRAMS'),
          optionValues: ['L', ' Clear '],
          price: '39.99',
          weight: '4.5',
          sku: 'X-L',
          stock: [
            {
              ...blankStockRow(),
              locationId: '60465184951',
              available: '40',
            },
          ],
          imageUrl: ' https://cdn.example.com/n.jpg ',
        },
      ]
    })
    expect(body.options_add).toEqual([{ name: 'Colour', values: ['Clear'] }])
    expect(body.variants).toEqual([
      {
        option_values: ['L', 'Clear'],
        price: '39.99',
        taxable: true,
        inventory_policy: 'DENY',
        tracked: true,
        requires_shipping: true,
        sku: 'X-L',
        weight: '4.5',
        weight_unit: 'KILOGRAMS',
        stock: [{ location_id: 60465184951, available: 40 }],
        image_url: 'https://cdn.example.com/n.jpg',
      },
    ])
  })

  it('leaves out an added option that has no name or no values yet', () => {
    const body = edit(makeProduct(), (draft) => {
      draft.addedOptions = [blankAddedOption(), { ...blankAddedOption(), name: 'Colour' }]
    })
    expect(body).toEqual({})
  })
})

describe('validating options, stock and new variants', () => {
  const problems = (change: (draft: ProductDraft) => void) => {
    const product = makeProduct()
    const draft = draftFromProduct(product)
    change(draft)
    return validateDraft(product, draft)
  }

  it('wants a whole-number quantity', () => {
    const errors = problems((draft) => {
      draft.variants[0].stock = [
        { ...blankStockRow(), locationId: '1', available: '2.5' },
        { ...blankStockRow(), available: '4' },
        { ...blankStockRow(), locationId: '1', available: '3' },
      ]
    })
    expect(errors['variants.0.stock.0.quantity']).toBe('Enter a whole number, 0 or more')
    // A quantity needs a location, and a location is listed once.
    expect(errors['variants.0.stock.1.location']).toBe('Choose a location')
    expect(errors['variants.0.stock.2.location']).toBe('This location is already listed')
  })

  it('does not let an option or a value be blanked or repeated', () => {
    const errors = problems((draft) => {
      draft.options[0].newName = ' '
      draft.options[0].values[1].to = 's'
    })
    expect(errors['options.0.name']).toBe('Enter a name')
    expect(errors['options.0.values.1']).toBe('This value is already in the list')
    expect(
      problems((draft) => {
        draft.options[0].values[0].to = ''
      })['options.0.values.0'],
    ).toBe('Enter a value')
  })

  it('checks a new option: a name, a value, no clash, at most three', () => {
    expect(
      problems((draft) => {
        draft.addedOptions = [{ ...blankAddedOption(), name: 'size', values: ['x'] }]
      })['addedOptions.0.name'],
    ).toBe('The product already has an option with this name')
    expect(
      problems((draft) => {
        draft.addedOptions = [{ ...blankAddedOption(), name: 'Colour' }]
      })['addedOptions.0.values'],
    ).toBe('Add at least one value')
    expect(
      problems((draft) => {
        draft.addedOptions = ['A', 'B', 'C'].map((name) => ({
          ...blankAddedOption(),
          name,
          values: ['1'],
        }))
      }).addedOptions,
    ).toMatch(/at most 3 options/)
  })

  it('checks a new variant: values, price, picture, stock, and repeats', () => {
    const errors = problems((draft) => {
      draft.newVariants = [
        blankNewVariant(),
        {
          ...blankNewVariant(),
          optionValues: ['S'],
          price: '5',
          imageUrl: 'http://x.example/a.jpg',
          stock: [{ ...blankStockRow(), available: '3' }],
        },
      ]
    })
    expect(errors['newVariants.0.optionValues.0']).toBe('Choose a Size')
    expect(errors['newVariants.0.price']).toBe('Enter a price')
    expect(errors['newVariants.1.imageUrl']).toBe('Use a public https:// address')
    expect(errors['newVariants.1.stock.0.location']).toBe('Choose a location')
  })

  it('wants an option before a variant can be added', () => {
    const product = makeProduct()
    product.options = []
    const draft = draftFromProduct(product)
    draft.newVariants = [{ ...blankNewVariant(), price: '5' }]
    expect(validateDraft(product, draft)['newVariants.0.options']).toMatch(
      /Add an option first/,
    )
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

  it('checks that a collection to add has a name', () => {
    const errors = problems((d) => {
      d.addedCollections = ['  ', 'Food Packaging']
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

describe('metafields in the update body', () => {
  it('lists the product and variant details, but not the ones with their own editors', () => {
    const draft = draftFromProduct(withMetafields())

    expect(
      draft.metafields.map(
        (field) => `${field.variantId ?? 'product'}:${field.namespace}.${field.metaKey}`,
      ),
    ).toEqual([
      'product:custom.material',
      'product:custom.eco',
      `${VARIANT_A}:my_fields.unit`,
    ])
  })

  it('is empty when no metafield was touched', () => {
    expect(hasChanges(edit(withMetafields(), () => undefined))).toBe(false)
  })

  it('sends a changed product value with the type it already has, and nothing else', () => {
    const body = edit(withMetafields(), (draft) => {
      draft.metafields[0].value = 'Paper'
      // A different type typed on an existing detail is ignored: a type can't change in place.
      draft.metafields[0].type = 'multi_line_text_field'
    })

    expect(body).toEqual({
      metafields: [
        {
          namespace: 'custom',
          key: 'material',
          type: 'single_line_text_field',
          value: 'Paper',
        },
      ],
    })
  })

  it('puts a variant detail in that variant, not in the product', () => {
    const body = edit(withMetafields(), (draft) => {
      draft.metafields[2].value = '750'
    })

    expect(body).toEqual({
      variants: [
        {
          id: VARIANT_A,
          metafields: [
            { namespace: 'my_fields', key: 'unit', type: 'number_integer', value: '750' },
          ],
        },
      ],
    })
  })

  it('removes details by namespace and key, for the product and for a variant', () => {
    const body = edit(withMetafields(), (draft) => {
      draft.metafields[1].removed = true
      draft.metafields[2].removed = true
    })

    expect(body.metafields_remove).toEqual([{ namespace: 'custom', key: 'eco' }])
    expect(body.variants).toEqual([
      { id: VARIANT_A, metafields_remove: [{ namespace: 'my_fields', key: 'unit' }] },
    ])
  })

  it('adds a new detail to the product or to a variant, trimmed', () => {
    const body = edit(withMetafields(), (draft) => {
      draft.metafields.push({
        ...blankMetafieldEdit(),
        namespace: ' custom ',
        metaKey: ' size_note ',
        value: 'Large',
      })
      draft.metafields.push({
        ...blankMetafieldEdit(),
        variantId: VARIANT_B,
        type: 'number_integer',
        metaKey: 'pack',
        value: '12',
      })
    })

    expect(body.metafields).toEqual([
      {
        namespace: 'custom',
        key: 'size_note',
        type: 'single_line_text_field',
        value: 'Large',
      },
    ])
    expect(body.variants).toEqual([
      {
        id: VARIANT_B,
        metafields: [
          { namespace: 'custom', key: 'pack', type: 'number_integer', value: '12' },
        ],
      },
    ])
  })

  it('sends nothing for a new detail that was dropped, or for a removed variant’s details', () => {
    const body = edit(withMetafields(), (draft) => {
      draft.metafields.push({
        ...blankMetafieldEdit(),
        metaKey: 'gone',
        value: 'x',
        removed: true,
      })
      draft.metafields[2].value = '999'
      draft.variants[0].removed = true
    })

    expect(body).toEqual({ variants_remove: [VARIANT_A] })
  })

  it('keeps the description sections metafield beside the others', () => {
    const body = edit(withMetafields(), (draft) => {
      draft.metafields[0].value = 'Paper'
      draft.descriptionSections[0].title = 'Renamed'
    })

    expect(body.metafields?.map((field) => `${field.namespace}.${field.key}`)).toEqual([
      'custom.material',
      'apd.apd',
    ])
  })
})

describe('validating metafield edits', () => {
  const problems = (change: (draft: ProductDraft) => void) => {
    const product = withMetafields()
    const draft = draftFromProduct(product)
    change(draft)
    return validateDraft(product, draft)
  }

  it('accepts an untouched product, even with an odd existing value', () => {
    const product = withMetafields()
    product.metafields[0].value = ''
    expect(validateDraft(product, draftFromProduct(product))).toEqual({})
  })

  it('wants a value on a changed detail, pointing at Remove for an empty one', () => {
    expect(problems((d) => (d.metafields[0].value = '  '))['metafields.0.value']).toMatch(
      /Enter a value/,
    )
  })

  it('wants a namespace, key, type and value on a new detail', () => {
    const errors = problems((d) =>
      d.metafields.push({ ...blankMetafieldEdit(), namespace: '', type: ' ' }),
    )
    expect(errors['metafields.3.namespace']).toBe('Enter a namespace')
    expect(errors['metafields.3.metaKey']).toBe('Enter a key')
    expect(errors['metafields.3.type']).toBe('Choose a type')
    expect(errors['metafields.3.value']).toMatch(/Enter a value/)
  })

  it('refuses a detail the product already has, or one that has its own editor', () => {
    const dup = problems((d) =>
      d.metafields.push({ ...blankMetafieldEdit(), metaKey: 'material', value: 'x' }),
    )
    expect(dup['metafields.3.metaKey']).toMatch(/already has/)

    const own = problems((d) =>
      d.metafields.push({
        ...blankMetafieldEdit(),
        namespace: 'global',
        metaKey: 'title_tag',
        value: 'x',
      }),
    )
    expect(own['metafields.3.metaKey']).toMatch(/Description or SEO/)
  })

  it('wants a JSON array for a list, and caps the length of a variant tax code', () => {
    const errors = problems((d) => {
      d.metafields.push({
        ...blankMetafieldEdit(),
        metaKey: 'tags',
        type: 'list.single_line_text_field',
        value: 'Plastic, Paper',
      })
      d.variants[0].taxCode = 'x'.repeat(LIMITS.taxCode + 1)
    })
    expect(errors['metafields.3.value']).toMatch(/JSON array/)
    expect(errors['variants.0.taxCode']).toMatch(/at most 50/)
  })
})

describe('a variant tax code', () => {
  it('is sent only when one was typed, because the current code is not known', () => {
    expect(hasChanges(edit(makeProduct(), () => undefined))).toBe(false)

    const body = edit(makeProduct(), (draft) => {
      draft.variants[0].taxCode = '  P0000000 '
    })
    expect(body).toEqual({ variants: [{ id: VARIANT_A, tax_code: 'P0000000' }] })
  })
})

describe('a variant picture added by web address', () => {
  const ADDRESS = 'https://example.com/black.jpg'

  it('is added to the product media in the same update, not as a variant field', () => {
    const body = edit(makeProduct(), (draft) => {
      draft.variants[0].imageUrl = `  ${ADDRESS} `
    })

    expect(body).toEqual({ media_add: [{ url: ADDRESS, media_type: 'IMAGE' }] })
  })

  it('adds an address used by two variants once, and remembers which variants it is for', () => {
    const draft = draftFromProduct(makeProduct())
    draft.variants[0].imageUrl = ADDRESS
    draft.variants[1].imageUrl = ADDRESS

    expect(buildUpdateBody(makeProduct(), draft).media_add).toEqual([
      { url: ADDRESS, media_type: 'IMAGE' },
    ])
    expect(variantImageLinks(draft).links).toEqual([
      { variantId: VARIANT_A, url: ADDRESS },
      { variantId: VARIANT_B, url: ADDRESS },
    ])
  })

  it('wins over a picture chosen from the list, and ignores a removed variant', () => {
    const body = edit(makeProduct(), (draft) => {
      draft.variants[0].imageId = IMAGE_2
      draft.variants[0].imageUrl = ADDRESS
      draft.variants[1].imageUrl = 'https://example.com/gone.jpg'
      draft.variants[1].removed = true
    })

    expect(body.variants).toBeUndefined()
    expect(body.media_add).toEqual([{ url: ADDRESS, media_type: 'IMAGE' }])
    expect(body.variants_remove).toEqual([VARIANT_B])
  })

  it('needs a public https address of at most 2000 characters', () => {
    const problems = (url: string) => {
      const product = makeProduct()
      const draft = draftFromProduct(product)
      draft.variants[0].imageUrl = url
      return validateDraft(product, draft)['variants.0.imageUrl']
    }

    expect(problems('http://example.com/a.jpg')).toBe('Use a public https:// address')
    expect(problems('not a link')).toBe('Use a public https:// address')
    expect(problems(`https://example.com/${'a'.repeat(2000)}`)).toMatch(/at most 2000/)
    expect(problems(ADDRESS)).toBeUndefined()
    expect(problems('   ')).toBeUndefined()
  })
})
