import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from './client.ts'
import { api, readOrderCreate, type OrderCreateBody } from './endpoints.ts'

vi.mock('./client.ts', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

const post = vi.mocked(apiClient.post)

/** The documented example request, as it is sent. */
const EXAMPLE: OrderCreateBody = {
  shop: 'polymer-uk',
  customer: {
    email: 'buyer@example.com',
    first_name: 'Sam',
    last_name: 'Taylor',
    phone: '+447700900123',
  },
  shipping_address: {
    first_name: 'Sam',
    last_name: 'Taylor',
    company: 'Taylor Foods Ltd',
    address1: '1 High Street',
    city: 'London',
    zip: 'NW10 7RX',
    country_code: 'GB',
    phone: '+447700900123',
  },
  line_items: [
    { variant_id: '2503d64d-42b7-4261-afe4-14ef76bfea13', quantity: 2 },
    {
      title: 'Custom printing',
      price: '25.00',
      quantity: 1,
      taxable: true,
      requires_shipping: false,
    },
  ],
  discount_codes: ['WELCOME10'],
  shipping: { title: 'Next day delivery', price: '6.95' },
  note: 'Phone order',
  tags: ['crm'],
  payment: { status: 'paid', method: 'Bank Transfer' },
}

describe('POST /orders (api.orders.create)', () => {
  beforeEach(() => post.mockReset())

  it('sends the documented example untouched as the body of POST /orders', async () => {
    post.mockResolvedValue({
      code: 201,
      status: 'success',
      message: 'Order #17600 created.',
      order: {
        id: 'a1',
        order_number: 17600,
        name: '#17600',
        shop: { key: 'polymer-uk' },
      },
    })

    const result = await api.orders.create(EXAMPLE)

    expect(post).toHaveBeenCalledWith('/orders', EXAMPLE)
    expect(result).toEqual({
      id: 'a1',
      order_number: 17600,
      name: '#17600',
      shop: 'polymer-uk',
      message: 'Order #17600 created.',
    })
  })
})

describe('readOrderCreate', () => {
  it('reads the order under result, or at the top', () => {
    expect(
      readOrderCreate({ result: { order_id: 'x', order_number: '42' } }),
    ).toMatchObject({
      id: 'x',
      order_number: 42,
    })
    expect(readOrderCreate({ id: 'y', name: '#1001', shop: 'polymer-eu' })).toMatchObject(
      {
        id: 'y',
        order_number: 1001,
        shop: 'polymer-eu',
        message: '',
      },
    )
  })

  it('copes with an answer that names no order', () => {
    expect(readOrderCreate(null)).toEqual({
      id: null,
      order_number: null,
      name: null,
      shop: null,
      message: '',
    })
    expect(readOrderCreate({ message: 'Order queued.' }).message).toBe('Order queued.')
  })
})
