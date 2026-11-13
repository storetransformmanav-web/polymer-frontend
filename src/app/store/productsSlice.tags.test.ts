import { describe, expect, it } from 'vitest'
import type { ProductDetail } from '../../lib/api/endpoints.ts'
import {
  detailsKey,
  fetchProductDetails,
  productsReducer,
  productTagsSynced,
} from './productsSlice.ts'

const product = (id: string, handle: string, tags: string[]): ProductDetail =>
  ({
    id,
    handle,
    title: handle,
    tags,
    images: [],
    variants: [],
    metafields: [],
    collections: [],
  }) as unknown as ProductDetail

/** A state that has the product's details cached, as if it had been opened. */
const withDetails = (data: ProductDetail) =>
  productsReducer(
    undefined,
    fetchProductDetails.fulfilled({ data, fetchedAt: Date.now() }, 'request', {
      id: data.id,
    }),
  )

describe('tags a lock gives to its products (productTagsSynced)', () => {
  it('shows the keys on the product at once, found by its handle, and marks it stale', () => {
    const state = productsReducer(
      withDetails(product('p1', 'hippo-bag', ['sale'])),
      productTagsSynced({ refs: ['hippo-bag'], add: ['b2b'], remove: [] }),
    )

    const entry = state.details[detailsKey('p1')]
    expect(entry.data?.tags).toEqual(['sale', 'b2b'])
    // Read again quietly the next time it is shown.
    expect(entry.fetchedAt).toBeNull()
    expect(state.facets.tags).toContain('b2b')
  })

  it('takes a key off the product when the lock loses it, found by its id too', () => {
    const state = productsReducer(
      withDetails(product('p1', 'hippo-bag', ['sale', 'b2b'])),
      productTagsSynced({ refs: ['p1'], add: [], remove: ['b2b'] }),
    )

    expect(state.details[detailsKey('p1')].data?.tags).toEqual(['sale'])
  })

  it('leaves other products alone, and does nothing when no tag changed', () => {
    const before = withDetails(product('p2', 'gift-box', ['sale']))

    const other = productsReducer(
      before,
      productTagsSynced({ refs: ['hippo-bag'], add: ['b2b'], remove: [] }),
    )
    expect(other.details[detailsKey('p2')].data?.tags).toEqual(['sale'])

    const none = productsReducer(
      before,
      productTagsSynced({ refs: ['gift-box'], add: [], remove: [] }),
    )
    expect(none).toBe(before)
  })
})
