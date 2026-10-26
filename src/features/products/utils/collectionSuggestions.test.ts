import { describe, expect, it } from 'vitest'
import {
  collectionsOf,
  COLLECTION_LIST_LIMIT,
  matchCollections,
  type KnownCollection,
} from './collectionSuggestions.ts'

const make = (n: number, title = `Collection ${n}`): KnownCollection => ({
  id: `id-${n}`,
  shopify_id: n,
  title,
  handle: title.toLowerCase().replace(/ /g, '-'),
  collection_type: n % 2 ? 'smart' : 'custom',
})

describe('collectionsOf', () => {
  it('gathers each collection once, whichever product it came from, by title', () => {
    const result = collectionsOf([
      { collections: [make(2, 'Zebra'), make(1, 'Apple')] },
      { collections: [make(2, 'Zebra'), make(3, 'Mango')] },
      null,
      undefined,
    ])

    expect(result.map((collection) => collection.title)).toEqual([
      'Apple',
      'Mango',
      'Zebra',
    ])
  })
})

describe('matchCollections', () => {
  const known = Array.from({ length: 25 }, (_, i) => make(i + 1))

  it('gives every match — or only the first few when a limit is given — and says how many matched', () => {
    const all = matchCollections(known, '', new Set())
    expect(COLLECTION_LIST_LIMIT).toBe(10)
    expect(all.shown).toHaveLength(25)
    expect(all.total).toBe(25)

    const first = matchCollections(known, '', new Set(), COLLECTION_LIST_LIMIT)
    expect(first.shown).toHaveLength(10)
    expect(first.total).toBe(25)

    // Typed text: still ten at most, all of them matches.
    const typed = matchCollections(
      known,
      'collection 1',
      new Set(),
      COLLECTION_LIST_LIMIT,
    )
    expect(typed.shown).toHaveLength(10)
    expect(typed.total).toBe(11)
    expect(typed.shown.every((c) => c.title.toLowerCase().includes('collection 1'))).toBe(
      true,
    )
  })

  it('narrows by title, handle or id, in any case', () => {
    expect(matchCollections(known, 'COLLECTION 2', new Set()).total).toBe(7)
    expect(matchCollections(known, 'collection-25', new Set()).shown[0].id).toBe('id-25')
    expect(matchCollections(known, 'id-7', new Set()).shown.map((c) => c.id)).toEqual([
      'id-7',
    ])
  })

  it('leaves out collections the product is in or has been given, and puts title-starts first', () => {
    const list = [
      make(1, 'Best sellers'),
      make(2, 'Not the best'),
      make(3, 'Best of all'),
    ]

    expect(
      matchCollections(list, 'best', new Set(['id-3'])).shown.map((c) => c.title),
    ).toEqual(['Best sellers', 'Not the best'])
    expect(matchCollections(list, 'nothing like it', new Set()).total).toBe(0)
  })
})
