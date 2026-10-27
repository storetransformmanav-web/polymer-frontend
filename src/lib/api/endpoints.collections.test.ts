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

  it('makes a collection with POST /collections and reads { collection } from the 201 answer', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      code: 201,
      status: 'Created',
      message: "Collection 'Juice Bottles' created in Shopify with 1 product(s).",
      collection: {
        id: '2ac9d27a-77c2-43e7-8790-796c094c9111',
        shopify_id: 694879420801,
        shopify_gid: 'gid://shopify/Collection/694879420801',
        title: 'Juice Bottles',
        handle: 'juice-bottles',
        description_html: '',
        collection_type: 'custom',
        editable: true,
        rules: null,
        sort_order: 'MOST_RELEVANT',
        seo_title: null,
        seo_description: null,
        image_url: null,
        products_count: 1,
        products: [
          {
            id: '23ea21e1-d3a8-4919-b698-f5d9aca2b698',
            shopify_id: 15577234473345,
            title: 'Example T-Shirt',
            handle: 'example-t-shirt',
            status: 'DRAFT',
            total_inventory: 100,
            image_url: 'https://cdn.shopify.com/s/files/1/0000/files/600x600.png?v=1',
          },
        ],
        shop: SHOP,
        shopify_updated_at: '2026-10-27T12:27:24Z',
      },
    })

    const result = await api.collections.create({
      products: ['23ea21e1-d3a8-4919-b698-f5d9aca2b698'],
      shop: 'polymer-uk',
      title: 'Juice Bottles',
    })

    expect(apiClient.post).toHaveBeenCalledWith('/collections', {
      products: ['23ea21e1-d3a8-4919-b698-f5d9aca2b698'],
      shop: 'polymer-uk',
      title: 'Juice Bottles',
    })
    expect(result.message).toBe(
      "Collection 'Juice Bottles' created in Shopify with 1 product(s).",
    )
    expect(result.collection).toMatchObject({
      title: 'Juice Bottles',
      handle: 'juice-bottles',
      collection_type: 'custom',
      editable: true,
    })
    expect(result.collection.products).toHaveLength(1)
  })

  it('rejects an answer that is not a collection list', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ items: 'nope' })

    await expect(api.collections.list({ search: 'x' })).rejects.toThrow()
  })
})
