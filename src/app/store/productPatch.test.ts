import { describe, expect, it } from 'vitest'
import type { ProductDetail, ProductListItem } from '../../lib/api/endpoints.ts'
import { patchDetail, patchListItem, patchTags } from './productPatch.ts'

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
      collections_remove: ['c1'],
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
    patchDetail(detail, { title: 'Changed', collections_remove: ['c1'] })

    expect(detail.title).toBe('Old')
    expect(detail.collections).toHaveLength(2)
  })
})
