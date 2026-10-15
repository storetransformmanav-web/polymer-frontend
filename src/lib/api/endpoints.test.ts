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
