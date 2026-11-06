import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from './client.ts'
import { api, type OrderUpdateBody } from './endpoints.ts'

vi.mock('./client.ts', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

const patch = vi.mocked(apiClient.patch)

describe('PATCH /orders/{order_ref} (api.orders.update)', () => {
  beforeEach(() => {
    patch.mockReset()
  })

  it('sends the documented example: the number in the path, preview=false and the store', async () => {
    patch.mockResolvedValue({ message: 'Order updated.' })
    const body: OrderUpdateBody = {
      email: 'buyer@example.com',
      shipping_address: {
        first_name: 'Sam',
        last_name: 'Taylor',
        address1: '2 High Street',
        city: 'London',
        zip: 'NW10 7RX',
        country_code: 'GB',
      },
      line_items_add: [
        { variant_id: '2503d64d-42b7-4261-afe4-14ef76bfea13', quantity: 1 },
      ],
      line_items_update: [
        { line_item_id: '00000000-0000-0000-0000-000000000000', quantity: 3 },
      ],
      shipping: { title: 'Standard delivery', price: '4.95' },
      staff_note: 'Customer asked for one more box',
    }

    await expect(api.orders.update('1001', body, 'polymer-uk')).resolves.toEqual({
      message: 'Order updated.',
    })
    expect(patch).toHaveBeenCalledWith('/orders/1001', body, {
      params: { preview: false, shop: 'polymer-uk' },
    })
  })

  it('leaves the store out when there is none, and copes with an answer without a message', async () => {
    patch.mockResolvedValue(null)
    await expect(api.orders.update('1001', {}, null)).resolves.toEqual({ message: '' })
    expect(patch).toHaveBeenCalledWith('/orders/1001', {}, { params: { preview: false } })
  })
})
