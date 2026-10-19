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
