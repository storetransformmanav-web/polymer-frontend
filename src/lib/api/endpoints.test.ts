import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from './endpoints.ts'
import { apiClient } from './client.ts'

vi.mock('./client.ts', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

const WRITE_RESULT = {
  product_id: 'p1',
  sync_status: 'pending',
  push_id: null,
  changes: null,
  message: 'Product archived',
}

describe('api.products.remove', () => {
  beforeEach(() => {
    vi.mocked(apiClient.delete).mockReset()
    vi.mocked(apiClient.delete).mockResolvedValue(WRITE_RESULT)
  })

  it('sends DELETE /products/{id} for the store, leaving `mode` to the backend', async () => {
    const result = await api.products.remove('p1', 'polymer-uk')

    expect(apiClient.delete).toHaveBeenCalledWith('/products/p1', {
      params: { shop: 'polymer-uk' },
    })
    expect(result.message).toBe('Product archived')
  })

  it('leaves out an empty store', async () => {
    await api.products.remove('p1', null)

    expect(apiClient.delete).toHaveBeenCalledWith('/products/p1', { params: undefined })
  })

  it('encodes the id in the path', async () => {
    await api.products.remove('a/b c')

    expect(vi.mocked(apiClient.delete).mock.calls[0][0]).toBe('/products/a%2Fb%20c')
  })
})

describe('api.products.syncHistory', () => {
  const PUSH = {
    id: 'push-1',
    entity: 'product',
    entity_id: 'p1',
    action: 'update',
    status: 'success',
    attempts: 1,
    error: null,
    changes: { title: 'x' },
    created_at: '2026-10-15T10:00:00Z',
    finished_at: '2026-10-15T10:00:03Z',
  }

  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset()
  })

  it('asks for the product’s pushes with the limit (20 by default) and the store', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([])
    await api.products.syncHistory('p1', 'polymer-uk')

    expect(apiClient.get).toHaveBeenCalledWith('/products/p1/sync', {
      params: { limit: 20, shop: 'polymer-uk' },
    })
  })

  it('reads the envelope the API answers with ({ code, status, message, items })', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      code: 200,
      status: 'OK',
      message: 'Push history fetched successfully',
      items: [PUSH],
    })

    const history = await api.products.syncHistory('p1', null, 20)

    expect(history).toHaveLength(1)
    expect(history[0].changes).toEqual({ title: 'x' })
    expect(vi.mocked(apiClient.get).mock.calls[0][1]).toEqual({ params: { limit: 20 } })
  })

  it('also reads an empty envelope and a bare list', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ code: 200, items: [] })
    expect(await api.products.syncHistory('p1')).toEqual([])

    vi.mocked(apiClient.get).mockResolvedValueOnce([PUSH])
    expect(await api.products.syncHistory('p1')).toHaveLength(1)
  })
})

describe('the answer to an edit, a retried push and a delete', () => {
  // Exactly what PUT /products/{id} answered in the browser.
  const ENVELOPE = {
    code: 200,
    status: 'OK',
    message: 'Product updated, sending to Shopify',
    result: {
      product_id: '74170f4d-1ca0-4173-acd9-2d5316b84bf3',
      sync_status: 'pending',
      push_id: '8f31a438-4674-4609-8e6e-bee748663d91',
      changes: { status: { from: 'ACTIVE', to: 'DRAFT' } },
      message: 'Saved. Sending the changes to Shopify.',
    },
  }

  beforeEach(() => {
    vi.mocked(apiClient.put).mockReset()
    vi.mocked(apiClient.post).mockReset()
    vi.mocked(apiClient.delete).mockReset()
  })

  it('reads an edit’s answer from inside the { code, status, message, result } envelope', async () => {
    vi.mocked(apiClient.put).mockResolvedValue(ENVELOPE)

    const result = await api.products.update('p1', { status: 'DRAFT' }, 'polymer-uk')

    expect(result.product_id).toBe('74170f4d-1ca0-4173-acd9-2d5316b84bf3')
    expect(result.sync_status).toBe('pending')
    expect(result.changes).toEqual({ status: { from: 'ACTIVE', to: 'DRAFT' } })
    // The product's own message, not the envelope's.
    expect(result.message).toBe('Saved. Sending the changes to Shopify.')
  })

  it('reads a retried push and a delete the same way', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(ENVELOPE)
    vi.mocked(apiClient.delete).mockResolvedValue(ENVELOPE)

    expect((await api.products.push('p1', 'polymer-uk')).sync_status).toBe('pending')
    expect((await api.products.remove('p1', 'polymer-uk')).push_id).toBe(
      '8f31a438-4674-4609-8e6e-bee748663d91',
    )
  })

  it('still reads the fields when they come on their own', async () => {
    vi.mocked(apiClient.put).mockResolvedValue(ENVELOPE.result)

    expect((await api.products.update('p1', { status: 'DRAFT' })).sync_status).toBe(
      'pending',
    )
  })

  it('rejects an answer that is neither', async () => {
    vi.mocked(apiClient.put).mockResolvedValue({ code: 200, status: 'OK' })

    await expect(api.products.update('p1', { status: 'DRAFT' })).rejects.toThrow()
  })
})

describe('api.products.addMedia and removeMedia', () => {
  const ENVELOPE = {
    code: 200,
    status: 'OK',
    message: 'Media queued for Shopify',
    result: {
      product_id: 'p1',
      sync_status: 'pending',
      push_id: 'push-1',
      changes: {},
      message: 'Media queued for Shopify',
    },
  }

  beforeEach(() => {
    vi.mocked(apiClient.post).mockReset()
    vi.mocked(apiClient.delete).mockReset()
  })

  it('POSTs { items } to /products/{id}/media for the store', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(ENVELOPE)
    const items = [
      {
        url: 'https://example.com/product-image.jpg',
        alt: 'Product image',
        media_type: 'IMAGE' as const,
      },
    ]

    const result = await api.products.addMedia('p1', items, 'polymer-uk')

    expect(apiClient.post).toHaveBeenCalledWith(
      '/products/p1/media',
      { items },
      { params: { shop: 'polymer-uk' } },
    )
    expect(result.message).toBe('Media queued for Shopify')
  })

  it('leaves the store out when there is none', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(ENVELOPE.result)

    await api.products.addMedia('p1', [{ url: 'https://example.com/a.jpg' }])

    expect(vi.mocked(apiClient.post).mock.calls[0][2]).toEqual({ params: undefined })
  })

  it('DELETEs /products/{id}/media/{attachment} for the store', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue(ENVELOPE)

    const result = await api.products.removeMedia(
      'p1',
      '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      'polymer-uk',
    )

    expect(apiClient.delete).toHaveBeenCalledWith(
      '/products/p1/media/3fa85f64-5717-4562-b3fc-2c963f66afa6',
      { params: { shop: 'polymer-uk' } },
    )
    expect(result.sync_status).toBe('pending')
  })

  it('sends exactly the documented request for the three-image example', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(ENVELOPE)
    const productId = '772859e7-64f1-4c4c-9dbf-f8ab63046aa7'
    const items = [
      {
        url: 'https://placehold.co/600x600?text=Small+Carrier+Bag',
        alt: 'Small white plastic carrier bag',
        media_type: 'IMAGE' as const,
      },
      {
        url: 'https://placehold.co/600x600?text=Large+Carrier+Bag',
        alt: 'Large white plastic carrier bag',
        media_type: 'IMAGE' as const,
      },
      {
        url: 'https://placehold.co/600x600?text=White+Plastic+Carrier+Bag',
        alt: 'White plastic carrier bag',
        media_type: 'IMAGE' as const,
      },
    ]

    await api.products.addMedia(productId, items, 'shop')

    // POST /products/{product_id}/media?shop=shop   body { items: [...] }
    expect(apiClient.post).toHaveBeenCalledWith(
      '/products/772859e7-64f1-4c4c-9dbf-f8ab63046aa7/media',
      { items },
      { params: { shop: 'shop' } },
    )
  })

  it('sends exactly the documented delete request (product id, attachment id and shop)', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue(ENVELOPE)

    await api.products.removeMedia(
      '772859e7-64f1-4c4c-9dbf-f8ab63046aa7',
      '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      'shop',
    )

    // DELETE /products/{product_id}/media/{attachment_id}?shop=shop   (no body)
    expect(apiClient.delete).toHaveBeenCalledWith(
      '/products/772859e7-64f1-4c4c-9dbf-f8ab63046aa7/media/3fa85f64-5717-4562-b3fc-2c963f66afa6',
      { params: { shop: 'shop' } },
    )
  })

  it('encodes both ids in the path', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue(ENVELOPE.result)

    await api.products.removeMedia('a/b', 'c d')

    expect(vi.mocked(apiClient.delete).mock.calls[0][0]).toBe(
      '/products/a%2Fb/media/c%20d',
    )
  })
})

describe('api.customers.remove', () => {
  beforeEach(() => {
    vi.mocked(apiClient.delete).mockReset()
  })

  it('DELETEs /customers/{customer_ref} for the store, with no body', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({
      code: 200,
      message: 'Customer deleted',
    })

    const result = await api.customers.remove(
      '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      'polymer-uk',
    )

    expect(apiClient.delete).toHaveBeenCalledWith(
      '/customers/3fa85f64-5717-4562-b3fc-2c963f66afa6',
      { params: { shop: 'polymer-uk' } },
    )
    expect(result).toEqual({ message: 'Customer deleted' })
  })

  it('leaves the store out when there is none', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({})

    await api.customers.remove('c1')
    await api.customers.remove('c2', null)

    expect(vi.mocked(apiClient.delete).mock.calls[0][1]).toEqual({ params: undefined })
    expect(vi.mocked(apiClient.delete).mock.calls[1][1]).toEqual({ params: undefined })
  })

  it('encodes the reference in the path (an email works as a reference too)', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({})

    await api.customers.remove('a+b@example.com')

    expect(vi.mocked(apiClient.delete).mock.calls[0][0]).toBe(
      '/customers/a%2Bb%40example.com',
    )
  })

  it('takes whatever the backend answers: a message if there is one, otherwise none', async () => {
    vi.mocked(apiClient.delete).mockResolvedValueOnce({
      message: 'Deleted in Shopify too',
    })
    expect(await api.customers.remove('c1')).toEqual({
      message: 'Deleted in Shopify too',
    })

    for (const answer of [{}, null, '', 'ok', undefined, [], { message: null }]) {
      vi.mocked(apiClient.delete).mockResolvedValueOnce(answer)
      expect(await api.customers.remove('c1')).toEqual({ message: '' })
    }
  })

  it('lets a refusal through, for the page to show (never retried here)', async () => {
    vi.mocked(apiClient.delete).mockRejectedValue(new Error('refused'))

    await expect(api.customers.remove('c1')).rejects.toThrow('refused')
    expect(apiClient.delete).toHaveBeenCalledTimes(1)
  })
})

describe('api.auth sign-in', () => {
  // The answer to POST /auth/otp/verify, as the backend sends it (with its envelope and permissions).
  const LOGIN = {
    code: 200,
    status: 'OK',
    message: 'Login successful',
    access_token: 'test-access-token',
    token_type: 'bearer',
    expires_at: '2026-11-20T11:31:17.119751Z',
    user: {
      id: '00000000-0000-4000-8000-000000000001',
      email: 'admin@example.com',
      full_name: 'Test Admin',
      first_name: 'Test Admin',
      last_name: '',
      phone: null,
      role: 'admin',
      is_active: true,
      last_login_at: '2026-10-21T11:31:17.119751Z',
      permissions: {
        products: { view: true, manage: true },
        users: { view: true, manage: true },
        activity: { view: true, manage: false },
      },
    },
  }

  beforeEach(() => {
    vi.mocked(apiClient.post).mockReset()
  })

  it('verifies a code with remember_me: true when "Remember me" is ticked (30-day token)', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(LOGIN)

    const result = await api.auth.verifyOtp('admin@example.com', '079941', true)

    expect(apiClient.post).toHaveBeenCalledWith('/auth/otp/verify', {
      email: 'admin@example.com',
      code: '079941',
      remember_me: true,
    })
    expect(result.access_token).toBe('test-access-token')
    expect(result.expires_at).toBe('2026-11-20T11:31:17.119751Z')
    expect(result.user).toMatchObject({
      id: '00000000-0000-4000-8000-000000000001',
      role: 'admin',
    })
  })

  it('verifies a code with remember_me: false when it is not ticked (default session)', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(LOGIN)

    await api.auth.verifyOtp('admin@example.com', '079941', false)

    expect(apiClient.post).toHaveBeenCalledWith('/auth/otp/verify', {
      email: 'admin@example.com',
      code: '079941',
      remember_me: false,
    })
  })

  it('signs in with Google with the same remember_me choice', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(LOGIN)

    await api.auth.google('google-id-token-0123456789', true)
    expect(apiClient.post).toHaveBeenLastCalledWith('/auth/google', {
      credential: 'google-id-token-0123456789',
      remember_me: true,
    })

    await api.auth.google('google-id-token-0123456789', false)
    expect(apiClient.post).toHaveBeenLastCalledWith('/auth/google', {
      credential: 'google-id-token-0123456789',
      remember_me: false,
    })
  })

  it('keeps the user’s permissions from the answer', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(LOGIN)

    const { user } = await api.auth.verifyOtp('admin@example.com', '079941', true)

    expect(user.permissions?.products).toEqual({ view: true, manage: true })
    expect(user.permissions?.activity).toEqual({ view: true, manage: false })
  })

  it('still accepts an answer without permissions (older backends)', async () => {
    const { permissions: _permissions, ...user } = LOGIN.user
    vi.mocked(apiClient.post).mockResolvedValue({ ...LOGIN, user })

    const result = await api.auth.verifyOtp('a@b.co', '123456', true)

    expect(result.user.permissions).toBeUndefined()
  })

  it('refuses an answer without a token', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ ...LOGIN, access_token: '' })

    await expect(api.auth.verifyOtp('a@b.co', '123456', true)).rejects.toThrow()
  })
})

describe('api.customers.list', () => {
  const SAMPLE = {
    items: [
      {
        shop: {
          key: 'polymer-uk',
          name: 'Polymer UK',
          domain: 'polymer-uk-ltd.myshopify.com',
          currency: 'GBP',
        },
        id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
        shopify_id: 9001,
        email: 'a@b.co',
        full_name: 'Ada Lovelace',
        first_name: 'Ada',
        last_name: 'Lovelace',
        phone: '+44 20 7946 0000',
        role: 'subscriber',
        is_active: true,
        shopify_state: 'ENABLED',
        accepts_marketing: true,
        orders_count: 3,
        total_spent: '45.70',
        currency: 'GBP',
        tags: ['vip'],
        city: 'London',
        country: 'United Kingdom',
        last_order_name: '#1042',
        shopify_created_at: '2026-10-21T05:17:20.481Z',
        last_login_at: '2026-10-21T05:17:20.481Z',
      },
    ],
    page: 1,
    page_size: 20,
    total: 1,
    total_pages: 1,
    has_next: false,
    sort: 'created_at',
    order: 'desc',
  }

  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset()
  })

  it('GETs /customers with the query as sent, and reads the documented response', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(SAMPLE)
    const params = {
      search: 'ada',
      role: 'all' as const,
      source: 'shopify' as const,
      state: 'ENABLED' as const,
      accepts_marketing: true,
      has_orders: true,
      tag: 'vip',
      country: 'GB',
      min_spent: 10,
      max_spent: 500,
      sort: 'total_spent' as const,
      order: 'asc' as const,
      page: 2,
      page_size: 50,
      shop: 'polymer-uk',
    }

    const result = await api.customers.list(params)

    expect(apiClient.get).toHaveBeenCalledWith('/customers', { params })
    expect(result.items[0]).toMatchObject({
      id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      full_name: 'Ada Lovelace',
      orders_count: 3,
      total_spent: '45.70',
      shop: { key: 'polymer-uk', name: 'Polymer UK' },
      last_login_at: '2026-10-21T05:17:20.481Z',
    })
    expect(result).toMatchObject({ page: 1, total: 1, has_next: false })
  })

  it('accepts customers created in the CRM: no Shopify id, no store, nothing optional', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      ...SAMPLE,
      items: [
        {
          id: 'c1',
          shopify_id: null,
          shop: null,
          email: null,
          role: 'administrator',
          is_active: true,
          orders_count: 0,
        },
      ],
    })

    const result = await api.customers.list({ role: 'all' })

    expect(result.items[0]).toMatchObject({ id: 'c1', shopify_id: null, tags: [] })
  })

  it('refuses an answer that is not a customer list', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ items: 'nope' })

    await expect(api.customers.list({})).rejects.toThrow()
  })
})

describe('api.sync', () => {
  beforeEach(() => {
    vi.mocked(apiClient.post).mockReset()
    vi.mocked(apiClient.get).mockReset()
  })

  it('POSTs /sync/products for the store, with no body', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      code: 200,
      status: 'OK',
      message: 'Products sync started',
      result: { status: 'started', entity: 'products', mode: 'all' },
    })

    const result = await api.sync.triggerProducts('polymer-uk')

    expect(apiClient.post).toHaveBeenCalledWith('/sync/products', undefined, {
      params: { shop: 'polymer-uk' },
    })
    expect(result.message).toBe('Products sync started')
  })

  it('accepts whatever the backend answers, so a started sync is never reported as failed', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(undefined)
    expect((await api.sync.triggerProducts()).message).toBe('')
    expect(vi.mocked(apiClient.post).mock.calls[0][2]).toEqual({ params: undefined })

    vi.mocked(apiClient.post).mockResolvedValue({ status: 'started' })
    expect((await api.sync.triggerProducts('x')).message).toBe('')
  })

  it('GETs /sync/status with the entity, limit and store', async () => {
    const run = {
      id: 'r1',
      entity: 'products',
      mode: 'full',
      status: 'running',
      started_at: '2026-10-15T10:00:00Z',
      finished_at: null,
      records_read: 12,
      records_written: 10,
      error: null,
    }
    vi.mocked(apiClient.get).mockResolvedValue({ code: 200, items: [run] })

    const runs = await api.sync.status({
      entity: 'products',
      limit: 3,
      shop: 'polymer-uk',
    })

    expect(apiClient.get).toHaveBeenCalledWith('/sync/status', {
      params: { limit: 3, entity: 'products', shop: 'polymer-uk' },
    })
    expect(runs).toHaveLength(1)
    expect(runs[0].records_read).toBe(12)
  })

  it('also reads a bare list of runs', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([])
    expect(await api.sync.status({})).toEqual([])
    expect(vi.mocked(apiClient.get).mock.calls[0][1]).toEqual({ params: { limit: 10 } })
  })
})

describe('api.products.create', () => {
  const RESULT = {
    product_id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    shopify_id: 999,
    shopify_gid: 'gid://shopify/Product/999',
    handle: 'sushi-tray',
    title: 'Sushi Tray',
    status: 'DRAFT',
    shop: 'polymer-uk',
    variants: 1,
    media: 0,
    message: 'Product created in Shopify and the CRM',
  }

  beforeEach(() => {
    vi.mocked(apiClient.post).mockReset()
  })

  it('POSTs the body to /products', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(RESULT)
    const body = {
      shop: 'polymer-uk',
      title: 'Sushi Tray',
      variants: [{ price: '9.99' }],
    }

    const result = await api.products.create(body)

    expect(apiClient.post).toHaveBeenCalledWith('/products', body)
    expect(result.product_id).toBe('3fa85f64-5717-4562-b3fc-2c963f66afa6')
    expect(result.handle).toBe('sushi-tray')
  })

  it('reads the answer the backend really sends: { code: 201, status, message, product: {…} }', async () => {
    // Taken from the browser's Network tab.
    vi.mocked(apiClient.post).mockResolvedValue({
      code: 201,
      status: 'Created',
      message: 'Product created in Shopify and the CRM',
      product: {
        product_id: 'be5b87ed-70e8-4679-9fc3-0ce19e7bb111',
        shopify_id: 15564782305665,
        shopify_gid: 'gid://shopify/Product/15564782305665',
        handle: 'kairav-test',
        title: 'Kairav - Test',
        status: 'DRAFT',
        shop: 'polymer-uk',
        variants: 1,
        media: 0,
        message: 'Product created in Shopify and saved',
      },
    })

    const result = await api.products.create({
      shop: 'polymer-uk',
      title: 'Kairav - Test',
      variants: [{ price: '1' }],
    })

    expect(result.product_id).toBe('be5b87ed-70e8-4679-9fc3-0ce19e7bb111')
    expect(result.handle).toBe('kairav-test')
    expect(result.status).toBe('DRAFT')
    expect(result.message).toBe('Product created in Shopify and saved')
  })

  it('reads the answer from inside a { code, status, message, result } envelope', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      code: 201,
      status: 'Created',
      message: 'Product created in Shopify and the CRM',
      result: RESULT,
    })

    const result = await api.products.create({
      shop: 'polymer-uk',
      title: 'Sushi Tray',
      variants: [{ price: '9.99' }],
    })

    expect(result.title).toBe('Sushi Tray')
    expect(result.variants).toBe(1)
  })

  it('rejects an answer without a product id', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ code: 201, status: 'Created' })

    await expect(
      api.products.create({ shop: 'x', title: 'y', variants: [{ price: '1' }] }),
    ).rejects.toThrow()
  })
})

describe('api.inventory.locations', () => {
  it('reads the locations from the stock list, asking for one row only', async () => {
    vi.mocked(apiClient.get).mockReset()
    vi.mocked(apiClient.get).mockResolvedValue({
      code: 200,
      items: [],
      locations: [
        { id: 77, name: 'Warehouse', variants: 3 },
        { id: 78, name: null, variants: 0 },
      ],
      total: 0,
    })

    const locations = await api.inventory.locations('polymer-uk')

    expect(apiClient.get).toHaveBeenCalledWith('/inventory', {
      params: { page_size: 1, shop: 'polymer-uk' },
    })
    expect(locations).toEqual([
      { id: 77, name: 'Warehouse', variants: 3 },
      { id: 78, name: null, variants: 0 },
    ])
  })

  it('is an empty list when the answer names none', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ items: [] })
    expect(await api.inventory.locations()).toEqual([])
  })
})

describe('api.users.detail', () => {
  const USER = {
    id: 'a7d79a67-29ed-41eb-a125-c71816e9ed9b',
    first_name: 'Jane',
    last_name: 'Doe',
    full_name: 'Jane Doe',
    email: 'jane@polymer.co',
    phone: null,
    role: 'office',
    role_label: 'Office',
    is_active: true,
    google_linked: false,
    last_login_at: null,
    created_at: '2026-10-08T12:58:01Z',
    updated_at: '2026-10-09T08:00:00Z',
    shop_keys: ['polymer-uk'],
    permissions: { products: { view: true, manage: false } },
  }

  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset()
  })

  it('sends GET /users/{user_id} and reads a bare user', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(USER)

    const user = await api.users.detail(USER.id)

    expect(apiClient.get).toHaveBeenCalledWith(`/users/${USER.id}`)
    expect(user.full_name).toBe('Jane Doe')
    expect(user.permissions).toEqual({ products: { view: true, manage: false } })
    expect(user.updated_at).toBe('2026-10-09T08:00:00Z')
  })

  it('also reads the user wrapped as { user } or { result }', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ code: 200, user: USER })
    expect((await api.users.detail('x')).email).toBe('jane@polymer.co')

    vi.mocked(apiClient.get).mockResolvedValueOnce({ result: USER })
    expect((await api.users.detail('x')).email).toBe('jane@polymer.co')
  })

  it('does not fail when the extra fields are missing or odd', async () => {
    const bare: Record<string, unknown> = { ...USER }
    delete bare.permissions
    delete bare.updated_at
    vi.mocked(apiClient.get).mockResolvedValueOnce(bare)
    expect((await api.users.detail('x')).permissions).toBeUndefined()

    vi.mocked(apiClient.get).mockResolvedValueOnce({ ...USER, permissions: 'everything' })
    expect((await api.users.detail('x')).permissions).toBeUndefined()
  })

  it('encodes the id in the path', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(USER)
    await api.users.detail('a/b c')

    expect(vi.mocked(apiClient.get).mock.calls[0][0]).toBe('/users/a%2Fb%20c')
  })
})

describe('the totals block of the customers and users lists', () => {
  const PAGING = { page: 1, page_size: 25, total_pages: 1, has_next: false }

  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset()
  })

  it('keeps GET /customers totals (the cards above the list)', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      items: [],
      totals: {
        customers: 9760,
        with_orders: 2332,
        without_orders: 7428,
        email_subscribers: 3567,
        verified_email: 3493,
        email_checked_valid: 0,
      },
      ...PAGING,
      total: 9760,
      sort: 'created_at',
      order: 'desc',
    })

    const result = await api.customers.list({ role: 'all' })

    expect(result.totals).toEqual({
      customers: 9760,
      with_orders: 2332,
      without_orders: 7428,
      email_subscribers: 3567,
      verified_email: 3493,
      email_checked_valid: 0,
    })
  })

  it('keeps GET /users totals, and still accepts an answer without them', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      code: 200,
      status: 'OK',
      message: 'Users fetched successfully',
      items: [],
      totals: {
        users: 3,
        active: 3,
        inactive: 0,
        administrators: 3,
        other_staff: 0,
        roles: 2,
      },
      ...PAGING,
      total: 3,
    })
    const withTotals = await api.users.list({})
    expect(withTotals.totals).toEqual({
      users: 3,
      active: 3,
      inactive: 0,
      administrators: 3,
      other_staff: 0,
      roles: 2,
    })

    vi.mocked(apiClient.get).mockResolvedValue({ items: [], ...PAGING, total: 0 })
    expect((await api.users.list({})).totals).toBeUndefined()
  })
})
