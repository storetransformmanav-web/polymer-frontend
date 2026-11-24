import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from './client.ts'
import { api } from './endpoints.ts'

vi.mock('./client.ts', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

const put = vi.mocked(apiClient.put)
const CUSTOMER = '00000000-0000-4000-8000-000000000001'
// A made-up password for the test only.
const BODY = { password: 'Example-pass-1', password_confirmation: 'Example-pass-1' }

beforeEach(() => {
  put.mockReset()
})

describe('PUT /customers/{customer_ref}/password (api.customers.setPassword)', () => {
  it('sends the two boxes in the body (never the address) and reads the documented answer', async () => {
    put.mockResolvedValue({
      code: 200,
      status: 'OK',
      message: 'Website password set',
      result: {
        customer_id: CUSTOMER,
        email: 'customer@example.com',
        account_state: 'ENABLED',
        message:
          'Password set. customer@example.com can now log in on the website with it.',
      },
    })

    await expect(
      api.customers.setPassword(CUSTOMER, BODY, 'polymer-uk'),
    ).resolves.toEqual({
      message: 'Website password set',
      detail: 'Password set. customer@example.com can now log in on the website with it.',
      accountState: 'ENABLED',
      email: 'customer@example.com',
    })
    expect(put).toHaveBeenCalledWith(`/customers/${CUSTOMER}/password`, BODY, {
      params: { shop: 'polymer-uk' },
    })
  })

  it('sends no shop when none is known, and copes with an answer of another shape', async () => {
    put.mockResolvedValue('ok')
    await expect(api.customers.setPassword(CUSTOMER, BODY)).resolves.toEqual({
      message: '',
      detail: '',
      accountState: null,
      email: null,
    })
    expect(put).toHaveBeenCalledWith(`/customers/${CUSTOMER}/password`, BODY, {
      params: undefined,
    })
  })

  it('passes a refusal on (the backend’s own message)', async () => {
    put.mockImplementation(() =>
      Promise.reject(new Error('Please wait a minute before changing it again.')),
    )
    const outcome = await api.customers.setPassword(CUSTOMER, BODY).then(
      () => null,
      (error: unknown) => error,
    )
    expect((outcome as Error).message).toBe(
      'Please wait a minute before changing it again.',
    )
  })
})
