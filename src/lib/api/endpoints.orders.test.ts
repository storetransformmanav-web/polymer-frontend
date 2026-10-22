import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from './client.ts'
import { api } from './endpoints.ts'

vi.mock('./client.ts', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

/** Two of the orders the real API answers with: a guest checkout and a CRM customer's. */
const SHOP = {
  key: 'polymer-uk',
  name: 'Packaging By Polymer',
  domain: 'polymer-uk-ltd.myshopify.com',
  currency: 'GBP',
}

const GUEST = {
  id: '2abd6b08-a7f7-4285-abb5-daa0932a8a38',
  shopify_id: 14292500775297,
  name: '#17516',
  order_number: 17516,
  email: 'david@woodandresinbydavid.co.uk',
  customer: { id: null, full_name: null, email: null, phone: null, orders_count: null },
  shop: SHOP,
  currency: 'GBP',
  subtotal_price: '12.50',
  total_discounts: '0.00',
  total_shipping: '9.58',
  total_tax: '4.42',
  total_price: '26.50',
  total_refunded: '0.00',
  net_payment: '0.00',
  financial_status: 'AUTHORIZED',
  fulfillment_status: 'UNFULFILLED',
  return_status: 'NO_RETURN',
  payment_gateway_names: ['shopify_payments'],
  source_name: 'web',
  tags: ['Expected Delivery Day: Wednesday'],
  items_count: 1,
  line_items_preview: ['Pizza Box White Plain, Square [Alternative]'],
  shopify_created_at: '2026-10-22T07:48:51Z',
  shopify_updated_at: '2026-10-22T07:48:59Z',
  cancelled_at: null,
  closed_at: null,
}

const CRM_CUSTOMER = {
  ...GUEST,
  id: '8bfb5796-89d4-4a38-b434-039f3e67cd43',
  name: '#17511',
  order_number: 17511,
  email: 'SALES@DPLTD.CO.UK',
  customer: {
    id: 'a7d98ea3-17e3-4367-bb65-078d904d38f9',
    full_name: 'DELTA PACKAGING LTD',
    email: 'sales@dpltd.co.uk',
    phone: null,
    orders_count: 3,
  },
  total_price: '144.43',
  source_name: 'shopify_draft_order',
  tags: ['b2b', 'Expected Delivery Day: Wednesday'],
  closed_at: '2026-10-21T15:29:02Z',
}

const SAMPLE = {
  code: 200,
  status: 'OK',
  message: 'Orders fetched successfully',
  items: [GUEST, CRM_CUSTOMER],
  totals: {
    orders: 2070,
    total_price: '593213.32',
    total_refunded: '1452.65',
    net_payment: '375118.93',
  },
  page: 1,
  page_size: 25,
  total: 2070,
  total_pages: 83,
  has_next: true,
  sort: 'created_at',
  order: 'desc',
}

describe('api.orders.list', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset()
    vi.mocked(apiClient.get).mockResolvedValue(SAMPLE)
  })

  it('GETs /orders with the query exactly as given', async () => {
    const params = {
      search: '1001',
      financial_status: 'PAID',
      fulfillment_status: 'UNFULFILLED',
      tag: 'b2b',
      gateway: 'shopify_payments',
      source: 'web',
      from: '2026-10-01T00:00:00Z',
      to: '2026-10-22T23:59:59Z',
      min_total: 100,
      max_total: 1000,
      cancelled: false,
      sort: 'total',
      order: 'asc',
      page: 2,
      page_size: 50,
      shop: 'polymer-uk',
    } as const

    await api.orders.list(params)

    expect(apiClient.get).toHaveBeenCalledWith('/orders', { params })
  })

  it('reads the documented answer: orders, the totals of every match and the paging', async () => {
    const result = await api.orders.list({ sort: 'created_at', order: 'desc', page: 1 })

    expect(result.items).toHaveLength(2)
    expect(result.items[0]).toMatchObject({
      id: '2abd6b08-a7f7-4285-abb5-daa0932a8a38',
      name: '#17516',
      order_number: 17516,
      email: 'david@woodandresinbydavid.co.uk',
      total_price: '26.50',
      financial_status: 'AUTHORIZED',
      fulfillment_status: 'UNFULFILLED',
      payment_gateway_names: ['shopify_payments'],
      source_name: 'web',
      items_count: 1,
      line_items_preview: ['Pizza Box White Plain, Square [Alternative]'],
      shop: { key: 'polymer-uk', name: 'Packaging By Polymer' },
      cancelled_at: null,
    })
    expect(result.items[1]).toMatchObject({
      name: '#17511',
      customer: { full_name: 'DELTA PACKAGING LTD', orders_count: 3 },
      closed_at: '2026-10-21T15:29:02Z',
    })
    expect(result.totals).toEqual({
      orders: 2070,
      total_price: '593213.32',
      total_refunded: '1452.65',
      net_payment: '375118.93',
    })
    expect(result).toMatchObject({
      page: 1,
      page_size: 25,
      total: 2070,
      total_pages: 83,
      has_next: true,
      sort: 'created_at',
      order: 'desc',
    })
  })

  it('accepts a guest checkout: a customer with every field null', async () => {
    const result = await api.orders.list({})

    expect(result.items[0].customer).toEqual({
      id: null,
      full_name: null,
      email: null,
      phone: null,
      orders_count: null,
    })
  })

  it('accepts an order with only the essentials, and an answer without totals', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      items: [{ id: 'o1', name: '#1' }],
      page: 1,
      page_size: 25,
      total: 1,
      total_pages: 1,
      has_next: false,
      sort: 'created_at',
      order: 'desc',
    })

    const result = await api.orders.list({})

    expect(result.items[0]).toMatchObject({
      id: 'o1',
      name: '#1',
      tags: [],
      payment_gateway_names: [],
      line_items_preview: [],
      items_count: 0,
    })
    expect(result.totals).toBeUndefined()
  })

  it('refuses an answer that is not an order list', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ items: 'nope' })

    await expect(api.orders.list({})).rejects.toThrow()
  })

  it('lets a failure through, for the page to show (never retried here)', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('Not logged in.'))

    await expect(api.orders.list({})).rejects.toThrow('Not logged in.')
    expect(apiClient.get).toHaveBeenCalledTimes(1)
  })
})

describe('api.orders.details', () => {
  beforeEach(() => vi.clearAllMocks())

  it('asks for one order without the raw payload, for its store, and unwraps { order }', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      code: 200,
      status: 'success',
      message: 'ok',
      order: { ...GUEST, line_items: [], note: 'Hi' },
    })

    const order = await api.orders.details('17516', 'polymer-uk')

    expect(apiClient.get).toHaveBeenCalledWith('/orders/17516', {
      params: { include_raw: false, shop: 'polymer-uk' },
    })
    expect(order.order_number).toBe(17516)
    expect(order.note).toBe('Hi')
  })

  it('leaves shop out when there is none', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ order: GUEST })
    await api.orders.details('a/b')
    expect(apiClient.get).toHaveBeenCalledWith('/orders/a%2Fb', {
      params: { include_raw: false },
    })
  })
})
