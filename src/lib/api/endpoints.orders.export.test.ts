import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from './client.ts'
import { api } from './endpoints.ts'

vi.mock('./client.ts', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

const get = vi.mocked(apiClient.get)

beforeEach(() => {
  get.mockReset()
})

describe('GET /orders/export (api.orders.export)', () => {
  it('asks for a CSV with the given query and returns its text', async () => {
    get.mockResolvedValue('Name,Email\n#17002,a@example.com\n')

    await expect(
      api.orders.export({ shop: 'polymer-uk', financial_status: 'PAID' }),
    ).resolves.toBe('Name,Email\n#17002,a@example.com\n')

    expect(get).toHaveBeenCalledWith(
      '/orders/export',
      expect.objectContaining({
        params: { shop: 'polymer-uk', financial_status: 'PAID' },
        headers: { Accept: 'text/csv, application/json;q=0.5' },
      }),
    )
  })

  it('refuses an answer that is not a file, with the backend’s message', async () => {
    get.mockResolvedValue({ message: 'No orders.' })
    await expect(api.orders.export({})).rejects.toThrow('No orders.')

    get.mockResolvedValue('  ')
    await expect(api.orders.export({})).rejects.toThrow('The server did not send a file.')
  })
})
