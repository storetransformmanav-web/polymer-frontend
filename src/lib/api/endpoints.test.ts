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
