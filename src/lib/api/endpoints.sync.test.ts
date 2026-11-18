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

    await expect(api.sync.triggerCustomers('polymer-uk')).resolves.toEqual({
      message: 'Customer sync started.',
    })
    expect(post).toHaveBeenCalledWith('/sync/customers', undefined, {
      params: { shop: 'polymer-uk' },
    })
  })

  it('sends no shop when none is given, and copes with an answer without a message', async () => {
    post.mockResolvedValue(null)
    await expect(api.sync.triggerCustomers()).resolves.toEqual({ message: '' })
    expect(post).toHaveBeenCalledWith('/sync/customers', undefined, { params: undefined })
  })
})
