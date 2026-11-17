import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from './ApiError.ts'
import { apiClient } from './client.ts'
import { api } from './endpoints.ts'

vi.mock('./client.ts', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

const get = vi.mocked(apiClient.get)

describe('GET /sage/invoices (api.invoices.list)', () => {
  beforeEach(() => {
    get.mockReset()
  })

  it('asks /sage/invoices (the client adds /api) with the query as its parameters', async () => {
    get.mockResolvedValue({ items: [] })

    await api.invoices.list({ page: 2, page_size: 50, sort: 'date', order: 'desc' })

    expect(get).toHaveBeenCalledWith('/sage/invoices', {
      params: { page: 2, page_size: 50, sort: 'date', order: 'desc' },
    })
  })

  it('names the address when the server has no such route, instead of a bare "Not Found"', async () => {
    get.mockRejectedValue(new ApiError('Not Found', { status: 404 }))

    await expect(api.invoices.list({ page: 1 })).rejects.toThrow(
      /GET \/api\/sage\/invoices.*not at that address/,
    )
  })

  it('leaves every other failure as the backend said it', async () => {
    get.mockRejectedValue(new ApiError('Forbidden for this account', { status: 403 }))

    await expect(api.invoices.list({ page: 1 })).rejects.toThrow(
      'Forbidden for this account',
    )
  })
})

describe('GET /sage/invoices/{invoice_number} (api.invoiceDetail.get)', () => {
  beforeEach(() => {
    get.mockReset()
  })

  it('asks for the invoice by its number', async () => {
    get.mockResolvedValue({ invoice_number: '649409', lines: [] })

    const detail = await api.invoiceDetail.get('649409')

    expect(get).toHaveBeenCalledWith('/sage/invoices/649409')
    expect(detail.number).toBe('649409')
  })

  it('encodes a number that is not plain digits', async () => {
    get.mockResolvedValue({ invoice_number: 'SI/1', lines: [] })

    await api.invoiceDetail.get('SI/1')

    expect(get).toHaveBeenCalledWith('/sage/invoices/SI%2F1')
  })

  it('refuses an answer that is not an invoice', async () => {
    get.mockResolvedValue('<html></html>')

    await expect(api.invoiceDetail.get('1')).rejects.toBeInstanceOf(ApiError)
  })
})
