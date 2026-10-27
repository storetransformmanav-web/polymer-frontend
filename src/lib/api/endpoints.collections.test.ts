import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from './client.ts'
import { api } from './endpoints.ts'

vi.mock('./client.ts', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

const SHOP = {
  key: 'polymer-uk',
  name: 'Packaging By Polymer',
  domain: 'polymer-uk-ltd.myshopify.com',
  currency: 'GBP',
}

/** The shape `GET /collections` answers with (two of its rows). */
const LIST_ANSWER = {
  code: 200,
  status: 'OK',
  message: 'Collections fetched successfully',
  items: [
    {
      id: 'd218492e-5c58-4ae4-9b7c-1e614c576da6',
      shopify_id: 266979672247,
      title: 'Bags',
      handle: 'bags',
      collection_type: 'smart',
      editable: false,
      sort_order: 'MANUAL',
      image_url: null,
      products_count: 68,
      shop: SHOP,
      shopify_updated_at: '2026-10-26T11:14:24Z',
    },
    {
      id: '5a09d8bb-6e4c-4aa6-935b-6173118102cd',
      shopify_id: 266979705015,
      title: 'Cleaning & Janitorial',
      handle: 'cleaning-janitorial',
      collection_type: 'smart',
      editable: false,
      sort_order: 'MANUAL',
      image_url: 'https://cdn.shopify.com/s/files/1/collections/Cleaning-ZZ.jpg?v=1',
      products_count: 130,
      shop: SHOP,
      shopify_updated_at: '2026-10-26T11:14:24Z',
    },
  ],
  page: 1,
  page_size: 50,
  total: 149,
  total_pages: 3,
  has_next: true,
}

/** `GET /collections/{id}`: the collection, with its products. */
const DETAIL_ANSWER = {
  code: 200,
  status: 'OK',
  message: 'Collection fetched successfully',
  collection: {
    id: 'd218492e-5c58-4ae4-9b7c-1e614c576da6',
    shopify_id: 266979672247,
    shopify_gid: 'gid://shopify/Collection/266979672247',
    title: 'Bags',
    handle: 'bags',
    description_html: '',
    collection_type: 'smart',
    editable: false,
    rules: {
      rules: [{ column: 'TAG', relation: 'EQUALS', condition: 'Category_Bags' }],
      appliedDisjunctively: false,
    },
    sort_order: 'MANUAL',
    seo_title: 'Wholesale Takeaway & Disposable Food Bags UK',
    seo_description: 'Disposable food bags.',
    image_url: null,
    products_count: 68,
    products: [
      {
        id: 'f38051ef-6aab-4381-9458-b4ba2d25188e',
        shopify_id: 6850856255671,
        title: 'Bags On Roll',
        handle: 'bags-on-roll-1',
        status: 'ACTIVE',
        total_inventory: 59,
        image_url: 'https://cdn.shopify.com/s/files/1/files/BOR03.png?v=1',
      },
      {
        id: '816ba740-161a-4588-975e-a8105b42f56e',
        shopify_id: 15234023850369,
        title: 'Bunify Large SOS Paper Bags',
        handle: 'bunify-large-sos-paper-bags',
        status: 'ACTIVE',
        total_inventory: 185,
        image_url: null,
      },
    ],
  },
}

describe('api.collections', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset()
  })

  it('searches the collections with the documented query and reads the answer', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(LIST_ANSWER)

    const answer = await api.collections.list({
      search: 'bag',
      sort: 'title',
      order: 'asc',
      shop: 'polymer-uk',
      page_size: 50,
    })

    expect(apiClient.get).toHaveBeenCalledWith('/collections', {
      params: {
        search: 'bag',
        sort: 'title',
        order: 'asc',
        shop: 'polymer-uk',
        page_size: 50,
      },
    })
    expect(answer.total).toBe(149)
    expect(answer.items.map((item) => item.title)).toEqual([
      'Bags',
      'Cleaning & Janitorial',
    ])
    expect(answer.items[0]).toMatchObject({ collection_type: 'smart', editable: false })
  })

  it('reads one collection by its id, unwrapping { collection }', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(DETAIL_ANSWER)

    const collection = await api.collections.detail(
      'd218492e-5c58-4ae4-9b7c-1e614c576da6',
    )

    expect(apiClient.get).toHaveBeenCalledWith(
      '/collections/d218492e-5c58-4ae4-9b7c-1e614c576da6',
    )
    expect(collection.title).toBe('Bags')
    expect(collection.products).toHaveLength(2)
    expect(collection.products[1].image_url).toBeNull()
  })

  it('rejects an answer that is not a collection list', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ items: 'nope' })

    await expect(api.collections.list({ search: 'x' })).rejects.toThrow()
  })
})
