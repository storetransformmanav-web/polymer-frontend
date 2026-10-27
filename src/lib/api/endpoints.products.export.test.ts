import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from './ApiError.ts'
import { apiClient } from './client.ts'
import { api } from './endpoints.ts'

vi.mock('./client.ts', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

const CSV = 'Handle,Title,Body (HTML)\n12-litre-mop-bucket,12 Litre Mop Bucket,Plastic\n'

describe('api.products.export (GET /products/export)', () => {
  const get = vi.mocked(apiClient.get)

  beforeEach(() => {
    get.mockReset()
  })

  it('sends the documented query and returns the file text', async () => {
    get.mockResolvedValue(CSV)
    const controller = new AbortController()
    const params = {
      status: 'active' as const,
      search: 'search',
      ids: '123456789',
      handles: 'sample-product,another-product',
      vendor: 'vendor',
      product_type: 'product_type',
      tag: 'tag',
      collection_id: 'collection_id',
      metafields: true,
      shop: 'shop',
    }

    const text = await api.products.export(params, controller.signal)

    expect(text).toBe(CSV)
    expect(get).toHaveBeenCalledTimes(1)
    const [path, config] = get.mock.calls[0]
    expect(path).toBe('/products/export')
    expect(config?.params).toEqual(params)
    expect(config?.signal).toBe(controller.signal)
    // A whole store takes longer than the usual 15 s, and a file is asked for as such.
    expect(config?.timeout).toBeGreaterThan(15_000)
    expect(config?.headers).toMatchObject({ Accept: expect.stringContaining('text/csv') })
  })

  it('refuses an empty answer', async () => {
    get.mockResolvedValue('  \n')
    await expect(api.products.export({})).rejects.toThrow(/did not send a file/)
  })

  it('refuses a JSON answer, with its message', async () => {
    get.mockResolvedValue({ code: 200, message: 'Nothing to export' })
    await expect(api.products.export({})).rejects.toThrow('Nothing to export')
  })

  it('passes a failure on with the backend’s message', async () => {
    get.mockRejectedValue(new ApiError('Not allowed', { status: 403 }))
    await expect(api.products.export({})).rejects.toThrow('Not allowed')
  })
})
