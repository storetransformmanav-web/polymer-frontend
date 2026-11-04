import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from './client.ts'
import { api, readProductSync } from './endpoints.ts'

vi.mock('./client.ts', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

const post = vi.mocked(apiClient.post)

describe('POST /sync/products/{shopify_product_id} (api.sync.product)', () => {
  beforeEach(() => {
    post.mockReset()
  })

  it('sends the documented example: the id in the path, shop and dry_run in the query, no body', async () => {
    post.mockResolvedValue({ message: 'Compared.' })

    await api.sync.product('15497136308609', 'polymer-uk', true)

    expect(post).toHaveBeenCalledWith('/sync/products/15497136308609', undefined, {
      params: { shop: 'polymer-uk', dry_run: true },
    })
  })

  it('sends dry_run=false for a real sync (the API’s own default only compares)', async () => {
    post.mockResolvedValue({})
    await api.sync.product('42', 'polymer-uk', false)
    expect(post).toHaveBeenCalledWith('/sync/products/42', undefined, {
      params: { shop: 'polymer-uk', dry_run: false },
    })
  })
})

describe('readProductSync', () => {
  it('reads the message, flat or inside result', () => {
    expect(readProductSync({ message: 'Saved.' })).toEqual({
      message: 'Saved.',
      differences: [],
    })
    expect(readProductSync({ code: 200, result: { message: 'Synced.' } }).message).toBe(
      'Synced.',
    )
  })

  it('lists the differences in words, whatever their shape', () => {
    expect(
      readProductSync({
        result: {
          differences: [
            { field: 'price', crm: '9.99', shopify: '10.99' },
            'title changed',
            { field: 'tags', message: 'added b2b' },
          ],
        },
      }).differences,
    ).toEqual(['price: 9.99 → 10.99', 'title changed', 'tags: added b2b'])

    expect(
      readProductSync({ changes: { status: { from: 'DRAFT', to: 'ACTIVE' } } })
        .differences,
    ).toEqual(['status: DRAFT → ACTIVE'])
  })

  it('copes with an answer that is not an object', () => {
    expect(readProductSync(null)).toEqual({ message: '', differences: [] })
    expect(readProductSync('ok')).toEqual({ message: '', differences: [] })
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
