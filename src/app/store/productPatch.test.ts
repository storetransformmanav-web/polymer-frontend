import { describe, expect, it } from 'vitest'
import type {
  ProductDetail,
  ProductImage,
  ProductListItem,
} from '../../lib/api/endpoints.ts'
import {
  hideRemovedImages,
  keepPreviewImages,
  patchDetail,
  patchListItem,
  patchMetafields,
  patchTags,
} from './productPatch.ts'

const row = {
  id: 'p1',
  title: 'Old',
  handle: 'old',
  status: 'ACTIVE',
  vendor: 'V',
  product_type: 'T',
  tags: ['a', 'b'],
  price_min: '1.00',
} as unknown as ProductListItem

const detail = {
  id: 'p1',
  title: 'Old',
  handle: 'old',
  status: 'ACTIVE',
  vendor: 'V',
  description_html: '<p>x</p>',
  tags: ['a', 'b'],
  template_suffix: '',
  seo: { title: 'S', description: 'D' },
  collections: [
    { id: 'c1', title: 'One' },
    { id: 'c2', title: 'Two' },
  ],
  variants: [
    { id: 'v1', price: '10.00', sku: 'S1', compare_at_price: null },
    { id: 'v2', price: '20.00', sku: 'S2', compare_at_price: null },
  ],
  images: [
    { id: 'i1', alt_text: null },
    { id: 'i2', alt_text: 'two' },
    { id: 'i3', alt_text: 'three' },
  ],
} as unknown as ProductDetail

describe('patchTags', () => {
  it('replaces, adds and removes', () => {
    expect(patchTags(['a', 'b'], { tags: ['x'] })).toEqual(['x'])
    expect(patchTags(['a', 'b'], { tags_add: ['c', 'a'] })).toEqual(['a', 'b', 'c'])
    expect(patchTags(['a', 'b'], { tags_remove: ['a'] })).toEqual(['b'])
  })
})

describe('patchListItem', () => {
  it('applies the changed fields only', () => {
    const next = patchListItem(row, { title: 'New', tags_add: ['c'] })

    expect(next).toMatchObject({
      title: 'New',
      handle: 'old',
      vendor: 'V',
      tags: ['a', 'b', 'c'],
    })
    expect(next.price_min).toBe('1.00')
    expect(row.title).toBe('Old') // the original is not mutated
  })
})

describe('patchDetail', () => {
  it('applies basics and SEO, and keeps the rest', () => {
    const next = patchDetail(detail, {
      title: 'New',
      status: 'DRAFT',
      seo: { title: 'New SEO', description: 'D2' },
    })

    expect(next).toMatchObject({
      title: 'New',
      status: 'DRAFT',
      handle: 'old',
      vendor: 'V',
    })
    expect(next.seo).toEqual({ title: 'New SEO', description: 'D2' })
  })

  it('removes collections and variants, and updates variant fields as text', () => {
    const next = patchDetail(detail, {
      collections_remove: [' one '],
      variants_remove: ['v2'],
      variants: [{ id: 'v1', price: 12.5, compare_at_price: null, sku: 'NEW' }],
    })

    expect(next.collections.map((c) => c.id)).toEqual(['c2'])
    expect(next.variants).toHaveLength(1)
    expect(next.variants[0]).toMatchObject({
      id: 'v1',
      price: '12.5',
      sku: 'NEW',
      compare_at_price: null,
    })
  })

  it('removes, re-labels and re-orders images', () => {
    const next = patchDetail(detail, {
      media_remove: ['i2'],
      media_update: [{ attachment_id: 'i1', alt: 'one' }],
      media_order: ['i3', 'i1'],
    })

    expect(next.images.map((image) => image.id)).toEqual(['i3', 'i1'])
    expect(next.images.find((image) => image.id === 'i1')?.alt_text).toBe('one')
  })

  it('does not mutate the cached product', () => {
    patchDetail(detail, { title: 'Changed', collections_remove: ['One'] })

    expect(detail.title).toBe('Old')
    expect(detail.collections).toHaveLength(2)
  })
})

describe('keepPreviewImages', () => {
  const NOW = 1_000_000
  const preview = { url: 'https://cdn.example.com/typed.jpg', at: NOW - 5000 }
  const withImage = (image_url: string | null) =>
    ({ ...row, id: 'p1', image_url }) as unknown as ProductListItem

  it('puts the preview back on a row that came back without an image', () => {
    const result = keepPreviewImages([withImage(null)], { p1: preview }, NOW)

    expect(result.items[0].image_url).toBe(preview.url)
    expect(result.previews).toHaveProperty('p1')
  })

  it('forgets it once the row has an image of its own', () => {
    const result = keepPreviewImages(
      [withImage('https://cdn.shopify.com/real.jpg')],
      { p1: preview },
      NOW,
    )

    expect(result.items[0].image_url).toBe('https://cdn.shopify.com/real.jpg')
    expect(result.previews).toEqual({})
  })

  it('leaves other rows and an unchanged list alone', () => {
    const items = [{ ...withImage(null), id: 'other' }]
    const result = keepPreviewImages(items, { p1: preview }, NOW)

    expect(result.items).toBe(items)
    expect(result.previews).toHaveProperty('p1')
  })

  it('stops showing a preview after ten minutes', () => {
    const old = { ...preview, at: NOW - 11 * 60_000 }
    const result = keepPreviewImages([withImage(null)], { p1: old }, NOW)

    expect(result.items[0].image_url).toBeNull()
    expect(result.previews).toEqual({})
  })
})

describe('hideRemovedImages', () => {
  const image = (id: string, url: string) =>
    ({ id, url, alt_text: null, width: null, height: null, position: 1 }) as ProductImage
  const ONE = image('1', 'https://cdn.example.com/a.jpg?v=1')
  const TWO = image('2', 'https://cdn.example.com/b.jpg')
  const NOW = 1_000_000

  it('hides a deleted image the backend still lists', () => {
    const result = hideRemovedImages(
      [ONE, TWO],
      [{ id: '2', url: TWO.url, at: NOW - 5000 }],
      NOW,
    )

    expect(result.images).toEqual([ONE])
    expect(result.stillListed).toHaveLength(1)
  })

  it('matches by file when the image got a new id, ignoring the cache-busting query', () => {
    const renamed = image('99', 'https://cdn.example.com/a.jpg?v=2')
    const result = hideRemovedImages(
      [renamed, TWO],
      [{ id: '1', url: ONE.url, at: NOW - 5000 }],
      NOW,
    )

    expect(result.images).toEqual([TWO])
  })

  it('forgets a deleted image once the backend no longer lists it', () => {
    const result = hideRemovedImages(
      [ONE],
      [{ id: '2', url: TWO.url, at: NOW - 5000 }],
      NOW,
    )

    expect(result.images).toEqual([ONE])
    expect(result.stillListed).toEqual([])
  })

  it('gives up hiding after ten minutes, so an image that really is there is not lost', () => {
    const result = hideRemovedImages(
      [ONE, TWO],
      [{ id: '2', url: TWO.url, at: NOW - 11 * 60_000 }],
      NOW,
    )

    expect(result.images).toEqual([ONE, TWO])
    expect(result.stillListed).toEqual([])
  })
})

describe('patchMetafields', () => {
  const fields = [
    { namespace: 'apd', key: 'apd', type: 'json_string', value: 'old' },
    {
      namespace: 'custom',
      key: 'material',
      type: 'single_line_text_field',
      value: 'PET',
    },
  ]

  it('replaces the value of one that exists, and adds one that does not', () => {
    const next = patchMetafields(fields, {
      metafields: [
        { namespace: 'apd', key: 'apd', type: 'json_string', value: 'new' },
        {
          namespace: 'custom',
          key: 'colour',
          type: 'single_line_text_field',
          value: 'Red',
        },
      ],
    })

    expect(next.map((field) => [field.key, field.value])).toEqual([
      ['apd', 'new'],
      ['material', 'PET'],
      ['colour', 'Red'],
    ])
  })

  it('removes the ones named in metafields_remove', () => {
    const next = patchMetafields(fields, {
      metafields_remove: [{ namespace: 'custom', key: 'material' }],
    })

    expect(next.map((field) => field.key)).toEqual(['apd'])
  })

  it('returns the same list when the edit has no metafields', () => {
    expect(patchMetafields(fields, { title: 'x' })).toBe(fields)
  })

  it('is applied to a cached product by patchDetail', () => {
    const next = patchDetail(
      { ...detail, metafields: fields } as unknown as ProductDetail,
      {
        metafields: [{ namespace: 'apd', key: 'apd', type: 'json_string', value: 'new' }],
      },
    )

    expect(next.metafields[0].value).toBe('new')
  })
})
