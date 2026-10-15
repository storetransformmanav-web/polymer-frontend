import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from './endpoints.ts'
import { apiClient } from './client.ts'

vi.mock('./client.ts', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

const WRITE_RESULT = {
  product_id: 'p1',
  sync_status: 'pending',
  push_id: null,
  changes: null,
  message: 'Product archived',
}

describe('api.products.remove', () => {
  beforeEach(() => {
    vi.mocked(apiClient.delete).mockReset()
    vi.mocked(apiClient.delete).mockResolvedValue(WRITE_RESULT)
  })

  it('sends DELETE /products/{id} for the store, leaving `mode` to the backend', async () => {
    const result = await api.products.remove('p1', 'polymer-uk')

    expect(apiClient.delete).toHaveBeenCalledWith('/products/p1', {
      params: { shop: 'polymer-uk' },
    })
    expect(result.message).toBe('Product archived')
  })

  it('leaves out an empty store', async () => {
    await api.products.remove('p1', null)

    expect(apiClient.delete).toHaveBeenCalledWith('/products/p1', { params: undefined })
  })

  it('encodes the id in the path', async () => {
    await api.products.remove('a/b c')

    expect(vi.mocked(apiClient.delete).mock.calls[0][0]).toBe('/products/a%2Fb%20c')
  })
})

describe('api.products.syncHistory', () => {
  const PUSH = {
    id: 'push-1',
    entity: 'product',
    entity_id: 'p1',
    action: 'update',
    status: 'success',
    attempts: 1,
    error: null,
    changes: { title: 'x' },
    created_at: '2026-10-15T10:00:00Z',
    finished_at: '2026-10-15T10:00:03Z',
  }

  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset()
  })

  it('asks for the product’s pushes with the limit (20 by default) and the store', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([])
    await api.products.syncHistory('p1', 'polymer-uk')

    expect(apiClient.get).toHaveBeenCalledWith('/products/p1/sync', {
      params: { limit: 20, shop: 'polymer-uk' },
    })
  })

  it('reads the envelope the API answers with ({ code, status, message, items })', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      code: 200,
      status: 'OK',
      message: 'Push history fetched successfully',
      items: [PUSH],
    })

    const history = await api.products.syncHistory('p1', null, 20)

    expect(history).toHaveLength(1)
    expect(history[0].changes).toEqual({ title: 'x' })
    expect(vi.mocked(apiClient.get).mock.calls[0][1]).toEqual({ params: { limit: 20 } })
  })

  it('also reads an empty envelope and a bare list', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ code: 200, items: [] })
    expect(await api.products.syncHistory('p1')).toEqual([])

    vi.mocked(apiClient.get).mockResolvedValueOnce([PUSH])
    expect(await api.products.syncHistory('p1')).toHaveLength(1)
  })
})

describe('the answer to an edit, a retried push and a delete', () => {
  // Exactly what PUT /products/{id} answered in the browser.
  const ENVELOPE = {
    code: 200,
    status: 'OK',
    message: 'Product updated, sending to Shopify',
    result: {
      product_id: '74170f4d-1ca0-4173-acd9-2d5316b84bf3',
      sync_status: 'pending',
      push_id: '8f31a438-4674-4609-8e6e-bee748663d91',
      changes: { status: { from: 'ACTIVE', to: 'DRAFT' } },
      message: 'Saved. Sending the changes to Shopify.',
    },
  }

  beforeEach(() => {
    vi.mocked(apiClient.put).mockReset()
    vi.mocked(apiClient.post).mockReset()
    vi.mocked(apiClient.delete).mockReset()
  })

  it('reads an edit’s answer from inside the { code, status, message, result } envelope', async () => {
    vi.mocked(apiClient.put).mockResolvedValue(ENVELOPE)

    const result = await api.products.update('p1', { status: 'DRAFT' }, 'polymer-uk')

    expect(result.product_id).toBe('74170f4d-1ca0-4173-acd9-2d5316b84bf3')
    expect(result.sync_status).toBe('pending')
    expect(result.changes).toEqual({ status: { from: 'ACTIVE', to: 'DRAFT' } })
    // The product's own message, not the envelope's.
    expect(result.message).toBe('Saved. Sending the changes to Shopify.')
  })

  it('reads a retried push and a delete the same way', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(ENVELOPE)
    vi.mocked(apiClient.delete).mockResolvedValue(ENVELOPE)

    expect((await api.products.push('p1', 'polymer-uk')).sync_status).toBe('pending')
    expect((await api.products.remove('p1', 'polymer-uk')).push_id).toBe(
      '8f31a438-4674-4609-8e6e-bee748663d91',
    )
  })

  it('still reads the fields when they come on their own', async () => {
    vi.mocked(apiClient.put).mockResolvedValue(ENVELOPE.result)

    expect((await api.products.update('p1', { status: 'DRAFT' })).sync_status).toBe(
      'pending',
    )
  })

  it('rejects an answer that is neither', async () => {
    vi.mocked(apiClient.put).mockResolvedValue({ code: 200, status: 'OK' })

    await expect(api.products.update('p1', { status: 'DRAFT' })).rejects.toThrow()
  })
})

describe('api.products.addMedia and removeMedia', () => {
  const ENVELOPE = {
    code: 200,
    status: 'OK',
    message: 'Media queued for Shopify',
    result: {
      product_id: 'p1',
      sync_status: 'pending',
      push_id: 'push-1',
      changes: {},
      message: 'Media queued for Shopify',
    },
  }

  beforeEach(() => {
    vi.mocked(apiClient.post).mockReset()
    vi.mocked(apiClient.delete).mockReset()
  })

  it('POSTs { items } to /products/{id}/media for the store', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(ENVELOPE)
    const items = [
      {
        url: 'https://example.com/product-image.jpg',
        alt: 'Product image',
        media_type: 'IMAGE' as const,
      },
    ]

    const result = await api.products.addMedia('p1', items, 'polymer-uk')

    expect(apiClient.post).toHaveBeenCalledWith(
      '/products/p1/media',
      { items },
      { params: { shop: 'polymer-uk' } },
    )
    expect(result.message).toBe('Media queued for Shopify')
  })

  it('leaves the store out when there is none', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(ENVELOPE.result)

    await api.products.addMedia('p1', [{ url: 'https://example.com/a.jpg' }])

    expect(vi.mocked(apiClient.post).mock.calls[0][2]).toEqual({ params: undefined })
  })

  it('DELETEs /products/{id}/media/{attachment} for the store', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue(ENVELOPE)

    const result = await api.products.removeMedia(
      'p1',
      '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      'polymer-uk',
    )

    expect(apiClient.delete).toHaveBeenCalledWith(
      '/products/p1/media/3fa85f64-5717-4562-b3fc-2c963f66afa6',
      { params: { shop: 'polymer-uk' } },
    )
    expect(result.sync_status).toBe('pending')
  })

  it('encodes both ids in the path', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue(ENVELOPE.result)

    await api.products.removeMedia('a/b', 'c d')

    expect(vi.mocked(apiClient.delete).mock.calls[0][0]).toBe(
      '/products/a%2Fb/media/c%20d',
    )
  })
})

describe('api.sync', () => {
  beforeEach(() => {
    vi.mocked(apiClient.post).mockReset()
    vi.mocked(apiClient.get).mockReset()
  })

  it('POSTs /sync/products for the store, with no body', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      code: 200,
      status: 'OK',
      message: 'Products sync started',
      result: { status: 'started', entity: 'products', mode: 'all' },
    })

    const result = await api.sync.triggerProducts('polymer-uk')

    expect(apiClient.post).toHaveBeenCalledWith('/sync/products', undefined, {
      params: { shop: 'polymer-uk' },
    })
    expect(result.message).toBe('Products sync started')
  })

  it('accepts whatever the backend answers, so a started sync is never reported as failed', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(undefined)
    expect((await api.sync.triggerProducts()).message).toBe('')
    expect(vi.mocked(apiClient.post).mock.calls[0][2]).toEqual({ params: undefined })

    vi.mocked(apiClient.post).mockResolvedValue({ status: 'started' })
    expect((await api.sync.triggerProducts('x')).message).toBe('')
  })

  it('GETs /sync/status with the entity, limit and store', async () => {
    const run = {
      id: 'r1',
      entity: 'products',
      mode: 'full',
      status: 'running',
      started_at: '2026-10-15T10:00:00Z',
      finished_at: null,
      records_read: 12,
      records_written: 10,
      error: null,
    }
    vi.mocked(apiClient.get).mockResolvedValue({ code: 200, items: [run] })

    const runs = await api.sync.status({
      entity: 'products',
      limit: 3,
      shop: 'polymer-uk',
    })

    expect(apiClient.get).toHaveBeenCalledWith('/sync/status', {
      params: { limit: 3, entity: 'products', shop: 'polymer-uk' },
    })
    expect(runs).toHaveLength(1)
    expect(runs[0].records_read).toBe(12)
  })

  it('also reads a bare list of runs', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([])
    expect(await api.sync.status({})).toEqual([])
    expect(vi.mocked(apiClient.get).mock.calls[0][1]).toEqual({ params: { limit: 10 } })
  })
})
