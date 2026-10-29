import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from './client.ts'
import { api } from './endpoints.ts'

vi.mock('./client.ts', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

const get = vi.mocked(apiClient.get)
const post = vi.mocked(apiClient.post)
const put = vi.mocked(apiClient.put)

const SHOP = {
  key: 'polymer-uk',
  name: 'Polymer UK',
  domain: 'polymer-uk-ltd.myshopify.com',
  currency: 'GBP',
}

/** `GET /access/locks` as documented. */
const LOCKS_ANSWER = {
  code: 200,
  status: 'OK',
  message: '45 locked product(s)',
  locks: [
    {
      product_id: '6b1f0000-0000-0000-0000-000000000001',
      shopify_id: 6850862612663,
      title: 'Bulk Storage Container',
      handle: 'bulk-storage-container',
      status: 'ACTIVE',
      image_url: 'https://cdn.shopify.com/a.jpg',
      product_tags: ['b2b-delivery-in-our-vans', 'Category_Food Packaging'],
      enabled: true,
      tags: ['b2b-delivery-in-our-vans'],
      hide_from_lists: true,
      hide_from_nav: false,
      noindex: true,
      hide_from_sitemap: false,
      manual_locking: false,
      message: null,
      customers_with_access: 1671,
      sync_status: 'synced',
      sync_error: null,
      last_pushed_at: '2026-10-29T09:12:40Z',
      updated_at: '2026-10-29T09:12:38Z',
      shop: SHOP,
    },
  ],
  page: 1,
  page_size: 25,
  total: 45,
  total_pages: 2,
  has_next: true,
}

describe('api.access', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lists the locked products with the documented query and reads the answer', async () => {
    get.mockResolvedValue(LOCKS_ANSWER)

    const answer = await api.access.locks({
      shop: 'polymer-uk',
      search: 'bulk',
      enabled: true,
      sync_status: 'synced',
      sort: 'title',
      page: 1,
      page_size: 25,
    })

    expect(get).toHaveBeenCalledWith('/access/locks', {
      params: {
        shop: 'polymer-uk',
        search: 'bulk',
        enabled: true,
        sync_status: 'synced',
        sort: 'title',
        page: 1,
        page_size: 25,
      },
    })
    expect(answer.total).toBe(45)
    expect(answer.locks[0]).toMatchObject({
      title: 'Bulk Storage Container',
      tags: ['b2b-delivery-in-our-vans'],
      hide_from_lists: true,
      customers_with_access: 1671,
      sync_status: 'synced',
    })
  })

  it('sends the one-call lock request as given and reads what the backend did', async () => {
    post.mockResolvedValue({
      code: 200,
      status: 'OK',
      message:
        'Products: 2 updated, 1 unchanged. Customers: 2 updated, 1 already had the tags. 1 new lock(s). Pushing to Shopify.',
      result: {
        products: { updated: ['6b1f', '9c2d'], unchanged: ['a7e4'] },
        customers: { updated: ['4f3a', '5b2c'], unchanged: ['9d1e'] },
        created_locks: 1,
        removed_locks: 0,
        new_tags: [],
        queued: 4,
      },
    })
    const body = {
      shop: 'polymer-uk',
      products: ['6b1f', '6850862612663', 'bulk-storage-container'],
      customers: ['4f3a', '7788990011', 'buyer@example.com'],
      tags: ['b2b'],
      enabled: true,
      hide_from_lists: true,
      hide_from_nav: false,
      noindex: true,
      hide_from_sitemap: false,
      manual_locking: false,
      message: 'This product is for approved trade accounts. Please log in to continue.',
    }

    const result = await api.access.lock(body)

    expect(post).toHaveBeenCalledWith('/access/locks', body)
    expect(result).toEqual({
      message: expect.stringContaining('1 new lock(s)'),
      createdLocks: 1,
      removedLocks: 0,
      queued: 4,
    })
  })

  it('lists tags (lock tags first) and adds a lock tag with a label', async () => {
    get.mockResolvedValue({
      code: 200,
      status: 'OK',
      message: "4 tag(s) match 'b2b'",
      tags: [
        {
          tag: 'b2b',
          label: 'B2B trade',
          is_lock_tag: true,
          products: 0,
          locked_products: 0,
          customers: 2539,
        },
        {
          tag: 'b2b-credit',
          label: null,
          is_lock_tag: false,
          products: 0,
          locked_products: 0,
          customers: 18,
        },
      ],
      page: 1,
      page_size: 50,
      total: 4,
      total_pages: 1,
      has_next: false,
    })
    post.mockResolvedValue({
      tag: 'b2b-credit',
      label: 'B2B credit account',
      is_lock_tag: true,
    })

    const tags = await api.access.tags({
      shop: 'polymer-uk',
      search: 'b2b',
      page_size: 50,
    })
    await api.access.createTag({
      shop: 'polymer-uk',
      tag: 'b2b-credit',
      label: 'B2B credit account',
    })

    expect(get).toHaveBeenCalledWith('/access/tags', {
      params: { shop: 'polymer-uk', search: 'b2b', page_size: 50 },
    })
    expect(tags.tags.map((tag) => tag.tag)).toEqual(['b2b', 'b2b-credit'])
    expect(tags.tags[0]).toMatchObject({ is_lock_tag: true, customers: 2539 })
    expect(post).toHaveBeenCalledWith('/access/tags', {
      shop: 'polymer-uk',
      tag: 'b2b-credit',
      label: 'B2B credit account',
    })
  })

  it('adds and removes tags with PUT and counts the products it unlocked', async () => {
    put.mockResolvedValue({
      code: 200,
      status: 'OK',
      message: 'Products: 1 updated.',
      result: {
        products: { updated: ['p1'], unchanged: [] },
        removed_locks: 1,
        queued: 1,
      },
    })

    const result = await api.access.updateTags({
      shop: 'polymer-uk',
      products: ['bulk-storage-container'],
      customers: ['buyer@example.com'],
      tags_add: [],
      tags_remove: ['boxes'],
    })

    expect(put).toHaveBeenCalledWith('/access/tags', {
      shop: 'polymer-uk',
      products: ['bulk-storage-container'],
      customers: ['buyer@example.com'],
      tags_add: [],
      tags_remove: ['boxes'],
    })
    expect(result).toMatchObject({ removedLocks: 1, createdLocks: 0, queued: 1 })
  })

  it('checks whether a customer would see a product', async () => {
    get.mockResolvedValue({
      code: 200,
      status: 'OK',
      message: 'Allowed: customer tag b2b-delivery-in-our-vans matches',
      check: {
        allowed: true,
        reason: 'tag_match',
        matched_tags: ['b2b-delivery-in-our-vans'],
        lock: { v: 1, enabled: true },
        customer_tags: ['b2b', 'b2b-delivery-in-our-vans'],
      },
    })

    const check = await api.access.check({
      shop: 'polymer-uk',
      customer: 'buyer@example.com',
      product: 'bulk-storage-container',
    })

    expect(get).toHaveBeenCalledWith('/access/check', {
      params: {
        shop: 'polymer-uk',
        customer: 'buyer@example.com',
        product: 'bulk-storage-container',
      },
    })
    expect(check).toMatchObject({
      allowed: true,
      reason: 'tag_match',
      matched_tags: ['b2b-delivery-in-our-vans'],
      message: 'Allowed: customer tag b2b-delivery-in-our-vans matches',
    })
  })

  it('sets a store up with the shop in the query, no body', async () => {
    post.mockResolvedValue({
      code: 200,
      status: 'OK',
      message: 'Metafield definition created. 45 lock(s) pushing to Shopify.',
      result: { definition: 'created', queued: 45 },
    })

    const message = await api.access.setup('polymer-uk')

    expect(post).toHaveBeenCalledWith('/access/setup', undefined, {
      params: { shop: 'polymer-uk' },
    })
    expect(message).toBe('Metafield definition created. 45 lock(s) pushing to Shopify.')
  })
})
