import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from './client.ts'
import { api } from './endpoints.ts'

vi.mock('./client.ts', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

const get = vi.mocked(apiClient.get)
const post = vi.mocked(apiClient.post)
const put = vi.mocked(apiClient.put)

const LINE = {
  location_id: 60465184951,
  location_name: 'Unit 9 Cumberland Avenue, Park Royal',
  updated_at: '2026-11-03T10:00:00Z',
  available: 5,
  on_hand: 8,
  committed: 3,
  incoming: 0,
  reserved: 0,
  safety_stock: 0,
  damaged: 0,
  quality_control: 0,
  unavailable: 0,
}

const ITEM = {
  variant_id: 'v-1',
  product_id: 'p-1',
  title: 'Hippo Bag',
  variant_title: 'Small',
  sku: 'HB-S',
  barcode: '5012345678900',
  status: 'ACTIVE',
  tracked: true,
  image_url: 'https://cdn.example.com/a.jpg',
  totals: { available: 5, on_hand: 8, committed: 3, incoming: 0, unavailable: 0 },
  locations: [LINE],
}

beforeEach(() => vi.clearAllMocks())

describe('api.inventory.list (page 1)', () => {
  it('sends the query as given and reads items, totals, locations and paging', async () => {
    get.mockResolvedValue({
      items: [ITEM],
      totals: {
        variants: 1,
        available: 5,
        on_hand: 8,
        committed: 3,
        incoming: 0,
        unavailable: 0,
        in_stock: 0,
        low_stock: 1,
        out_of_stock: 0,
      },
      locations: [{ id: 60465184951, name: 'Unit 9', variants: 1 }],
      page: 1,
      page_size: 25,
      total: 1,
      total_pages: 1,
      has_next: false,
    })

    const result = await api.inventory.list({
      search: 'hippo',
      location: '60465184951',
      status: 'low',
      low_threshold: 10,
      product_status: 'ACTIVE',
      sort: 'available',
      order: 'desc',
      page: 1,
      page_size: 25,
    })

    expect(get).toHaveBeenCalledWith('/inventory', {
      params: {
        search: 'hippo',
        location: '60465184951',
        status: 'low',
        low_threshold: 10,
        product_status: 'ACTIVE',
        sort: 'available',
        order: 'desc',
        page: 1,
        page_size: 25,
      },
    })
    expect(result.items[0].variant_id).toBe('v-1')
    expect(result.items[0].locations[0].location_id).toBe(60465184951)
    expect(result.totals.low_stock).toBe(1)
    expect(result.locations).toEqual([{ id: 60465184951, name: 'Unit 9', variants: 1 }])
    expect(result.total_pages).toBe(1)
  })

  it('reads a location id sent as text, and an untracked variant', async () => {
    get.mockResolvedValue({
      items: [
        { ...ITEM, tracked: false, locations: [{ ...LINE, location_id: '60465184951' }] },
      ],
      totals: {},
      locations: [],
    })

    const result = await api.inventory.list({})
    expect(result.items[0].tracked).toBe(false)
    expect(result.items[0].locations[0].location_id).toBe(60465184951)
    expect(result.page).toBe(1)
  })
})

describe('api.inventory.list — answers that name things differently', () => {
  it('reads `location_shopify_id`, `id`, `product_title` and quantities sent as text', async () => {
    get.mockResolvedValue({
      items: [
        {
          id: 'v-9',
          product_title: 'Hippo Bag',
          locations: [
            {
              location_shopify_id: '60465184951',
              location_name: 'Unit 9',
              available: '5',
              on_hand: '8',
            },
          ],
        },
      ],
    })

    const result = await api.inventory.list({})
    const item = result.items[0]
    expect(item.variant_id).toBe('v-9')
    expect(item.title).toBe('Hippo Bag')
    expect(item.totals).toEqual({})
    expect(item.locations[0]).toMatchObject({
      location_id: 60465184951,
      available: 5,
      on_hand: 8,
    })
  })

  it('says which part of an answer is wrong instead of "Something went wrong"', async () => {
    get.mockResolvedValue({
      items: [{ ...ITEM, locations: [{ ...LINE, available: 'many' }] }],
    })

    await expect(api.inventory.list({})).rejects.toThrow(
      /inventory list answer was not in the expected form \(items\.0\.locations\.0\.available/,
    )
  })
})

describe('api.inventory.detail (page 2)', () => {
  it('asks for one variant by its id and unwraps `variant`', async () => {
    get.mockResolvedValue({
      variant: {
        ...ITEM,
        price: '12.50',
        currency: 'GBP',
        inventory_policy: 'DENY',
        shop: { key: 'polymer-uk', name: 'Polymer UK' },
      },
    })

    const variant = await api.inventory.detail('a/b c')

    expect(get).toHaveBeenCalledWith('/inventory/a%2Fb%20c')
    expect(variant.price).toBe('12.50')
    expect(variant.inventory_policy).toBe('DENY')
    expect(variant.shop?.name).toBe('Polymer UK')
  })
})

describe('api.inventory.set and adjust (page 3)', () => {
  const WRITE = {
    code: 200,
    status: 'OK',
    message: 'Stock updated',
    result: { adjustments: [{ id: 'adj-1', status: 'pending' }] },
  }

  it('"Set to": PUT with the documented body, the answer\'s adjustments pending', async () => {
    put.mockResolvedValue(WRITE)
    const body = {
      location_id: 60465184951,
      quantities: { available: 22 },
      reason: 'correction' as const,
      note: 'Stock count 3 Nov',
    }

    const result = await api.inventory.set('v-1', body)

    expect(put).toHaveBeenCalledWith('/inventory/v-1', body)
    expect(result.adjustments).toEqual([
      expect.objectContaining({ id: 'adj-1', status: 'pending' }),
    ])
    expect(result.message).toBe('Stock updated')
  })

  it('"Adjust by": POST to /adjust with the documented body', async () => {
    post.mockResolvedValue({ result: { adjustments: [{ id: 7, status: 'pending' }] } })
    const body = {
      location_id: 60465184951,
      name: 'available' as const,
      delta: 12,
      reason: 'received' as const,
      note: 'Delivery PO-1041',
    }

    const result = await api.inventory.adjust('v-1', body)

    expect(post).toHaveBeenCalledWith('/inventory/v-1/adjust', body)
    // A numeric id is read as text.
    expect(result.adjustments[0].id).toBe('7')
  })

  it('reads a bare `adjustments` answer too', async () => {
    put.mockResolvedValue({ adjustments: [{ id: 'a', status: 'synced' }] })
    expect(
      (await api.inventory.set('v', { location_id: 1, quantities: { on_hand: 3 } }))
        .adjustments[0].status,
    ).toBe('synced')
  })
})

describe('api.inventory.history (page 4) and adjustment', () => {
  it('sends the filters and reads each entry, with a user that is text or an object', async () => {
    get.mockResolvedValue({
      items: [
        {
          id: 1,
          created_at: '2026-11-03T10:00:00Z',
          user: 'Kairav',
          title: 'Hippo Bag',
          sku: 'HB-S',
          location_name: 'Unit 9',
          quantity_name: 'available',
          mode: 'adjust',
          quantity_before: 5,
          quantity_after: 17,
          delta: 12,
          reason: 'received',
          note: 'Delivery',
          status: 'synced',
          synced_at: '2026-11-03T10:00:04Z',
        },
        {
          id: 2,
          user: { name: null, email: 'a@example.com' },
          status: 'error',
          error: 'Location not found',
        },
      ],
      page: 1,
      page_size: 50,
      total: 2,
      total_pages: 1,
      has_next: false,
    })

    const result = await api.inventory.history({
      variant_id: 'v-1',
      status: 'synced',
      page: 1,
      page_size: 50,
    })

    expect(get).toHaveBeenCalledWith('/inventory/history', {
      params: { variant_id: 'v-1', status: 'synced', page: 1, page_size: 50 },
    })
    expect(result.items[0]).toMatchObject({ id: '1', delta: 12, status: 'synced' })
    expect(result.items[1].error).toBe('Location not found')
  })

  it('asks for one change by id and unwraps `adjustment`', async () => {
    get.mockResolvedValue({
      adjustment: { id: 'adj-1', status: 'error', error: 'Shopify said no' },
    })

    const adjustment = await api.inventory.adjustment('adj-1')

    expect(get).toHaveBeenCalledWith('/inventory/adjustments/adj-1')
    expect(adjustment).toMatchObject({
      id: 'adj-1',
      status: 'error',
      error: 'Shopify said no',
    })
  })
})
