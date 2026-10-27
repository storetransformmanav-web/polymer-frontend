import { describe, expect, it } from 'vitest'
import {
  collectionKey,
  offerFoundCollections,
  type KnownCollection,
} from './collectionSuggestions.ts'

const make = (n: number, title = `Collection ${n}`): KnownCollection => ({
  id: `id-${n}`,
  shopify_id: n,
  title,
  handle: title.toLowerCase().replace(/ /g, '-'),
  collection_type: n % 2 ? 'smart' : 'custom',
})

describe('offerFoundCollections', () => {
  const found = [
    make(1, 'Aaa bags'),
    make(2, 'Bags'),
    make(3, 'Carrier bags'),
    make(4, 'Bags on roll'),
  ]

  it('keeps the backend order and rows untouched', () => {
    expect(offerFoundCollections(found, 4, new Set()).shown.map((c) => c.title)).toEqual([
      'Aaa bags',
      'Bags',
      'Carrier bags',
      'Bags on roll',
    ])
  })

  it('leaves out the ones the product is in and corrects the total by them', () => {
    const result = offerFoundCollections(found, 4, new Set(['bags']))
    expect(result.shown.map((c) => c.id)).toEqual(['id-1', 'id-3', 'id-4'])
    expect(result.total).toBe(3)
  })

  it('counts the matches on later pages in the total, and shows only the limit', () => {
    const result = offerFoundCollections(found, 149, new Set(), 2)
    expect(result.shown).toHaveLength(2)
    expect(result.total).toBe(149)
  })
})

describe('collectionKey', () => {
  it('compares names trimmed and in any case', () => {
    expect(collectionKey('  Food Packaging ')).toBe(collectionKey('food packaging'))
  })
})
