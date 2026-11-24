import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from './client.ts'
import { api } from './endpoints.ts'

vi.mock('./client.ts', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

const post = vi.mocked(apiClient.post)

describe('POST /sync/products (api.sync.triggerProducts)', () => {
  beforeEach(() => {
    post.mockReset()
    post.mockResolvedValue({ message: 'Products sync started' })
  })

  it('sends the documented example: days in the query, plus the store, no body', async () => {
    const answer = await api.sync.triggerProducts({ shop: 'polymer-uk', days: 5 })

    expect(post).toHaveBeenCalledWith('/sync/products', undefined, {
      params: { shop: 'polymer-uk', days: 5 },
    })
    expect(answer).toEqual({ message: 'Products sync started' })
  })

  it('sends no days for a full import, and no shop when none is given', async () => {
    await api.sync.triggerProducts({ shop: 'polymer-uk', days: null })
    expect(post).toHaveBeenLastCalledWith('/sync/products', undefined, {
      params: { shop: 'polymer-uk' },
    })

    await api.sync.triggerProducts()
    expect(post).toHaveBeenLastCalledWith('/sync/products', undefined, { params: {} })
  })

  it('copes with an answer that has no message', async () => {
    post.mockResolvedValue(null)
    expect(await api.sync.triggerProducts({ days: 5 })).toEqual({ message: '' })
  })
})

describe('POST /sync/orders (api.sync.triggerOrders)', () => {
  beforeEach(() => {
    post.mockReset()
    post.mockResolvedValue({ message: 'Orders sync started' })
  })

  it('sends the documented "new" example: mode=new and the store, no body', async () => {
    const answer = await api.sync.triggerOrders({ mode: 'new', shop: 'polymer-uk' })

    expect(post).toHaveBeenCalledWith('/sync/orders', undefined, {
      params: { mode: 'new', shop: 'polymer-uk' },
    })
    expect(answer).toEqual({ message: 'Orders sync started' })
  })

  it('sends the documented refresh example: mode=refresh, days=90 and the store', async () => {
    await api.sync.triggerOrders({ mode: 'refresh', days: 90, shop: 'polymer-uk' })

    expect(post).toHaveBeenCalledWith('/sync/orders', undefined, {
      params: { mode: 'refresh', days: 90, shop: 'polymer-uk' },
    })
  })

  it('sends days only with a refresh, and no shop when none is given', async () => {
    await api.sync.triggerOrders({ mode: 'new', days: 30 })

    expect(post).toHaveBeenCalledWith('/sync/orders', undefined, {
      params: { mode: 'new' },
    })
  })

  it('copes with an answer that has no message', async () => {
    post.mockResolvedValue(null)
    expect(await api.sync.triggerOrders({ mode: 'new' })).toEqual({ message: '' })
  })
})

describe('POST /sync/customers (api.sync.triggerCustomers)', () => {
  beforeEach(() => {
    post.mockReset()
  })

  it('sends the store in the query and no body, and returns the backend’s message', async () => {
    post.mockResolvedValue({ message: 'Customer sync started.' })

    await expect(api.sync.triggerCustomers({ shop: 'polymer-uk' })).resolves.toEqual({
      message: 'Customer sync started.',
    })
    expect(post).toHaveBeenCalledWith('/sync/customers', undefined, {
      params: { shop: 'polymer-uk' },
    })
  })

  it('sends no shop when none is given, and copes with an answer without a message', async () => {
    post.mockResolvedValue(null)
    await expect(api.sync.triggerCustomers()).resolves.toEqual({ message: '' })
    expect(post).toHaveBeenCalledWith('/sync/customers', undefined, { params: {} })
  })
})

describe('POST /sync/collections (api.sync.triggerCollections)', () => {
  beforeEach(() => {
    post.mockReset()
  })

  it('sends all_products and the store in the query, no body, and reads the documented answer', async () => {
    post.mockResolvedValue({
      code: 200,
      status: 'OK',
      message: 'Collections synced from Shopify',
      result: [
        {
          shop: 'polymer-uk',
          run_id: '73d35452-e7c5-4254-9f9c-0de03b2d1565',
          collections: 155,
          updated: 6,
          unchanged: 149,
          removed: 0,
          product_links: 7348,
          left_for_next_sync: 0,
          error: null,
        },
      ],
    })

    const answer = await api.sync.triggerCollections({ shop: 'polymer-uk' })

    expect(post).toHaveBeenCalledWith('/sync/collections', undefined, {
      params: { all_products: false, shop: 'polymer-uk' },
      timeout: 180_000,
    })
    expect(answer.message).toBe('Collections synced from Shopify')
    expect(answer.results).toEqual([
      {
        shop: 'polymer-uk',
        collections: 155,
        updated: 6,
        unchanged: 149,
        removed: 0,
        productLinks: 7348,
        leftForNextSync: 0,
        error: null,
      },
    ])
  })

  it('sends all_products=true for the repair, and no shop when none is given', async () => {
    post.mockResolvedValue({})
    await api.sync.triggerCollections({ allProducts: true })
    expect(post).toHaveBeenCalledWith('/sync/collections', undefined, {
      params: { all_products: true },
      timeout: 180_000,
    })
  })

  it('copes with an answer that is not in the expected form', async () => {
    post.mockResolvedValue(null)
    expect(await api.sync.triggerCollections()).toEqual({ message: '', results: [] })
  })
})
