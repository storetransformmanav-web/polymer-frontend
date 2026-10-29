import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from './client.ts'
import { api, type ProductUpdateBody } from './endpoints.ts'

vi.mock('./client.ts', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

/** The backend's documented example request for `PUT /products/{id}`, field for field. */
const DOCUMENTED_UPDATE: ProductUpdateBody = {
  title: 'Hinged Salad Container 500ml',
  description_html:
    '<p>Clear hinged salad container, 500ml. Leak resistant, recyclable PET.</p>',
  vendor: 'Packaging By Polymer',
  product_type: 'Food Packaging',
  status: 'ACTIVE',
  handle: 'hinged-salad-container-500ml',
  redirect_new_handle: true,
  tags_add: ['Specification_Freezable'],
  tags_remove: ['Category_Hot Food Packaging'],
  seo: {
    title: 'Hinged Salad Container 500ml | Packaging By Polymer',
    description: 'Clear 500ml hinged salad containers in packs of 50 and 250.',
  },
  category: 'Food Container Covers',
  collections_add: ['Hinged Container'],
  collections_remove: ['Hot Food Packaging'],
  collections_create: false,
  options_update: [
    {
      name: 'Pack size',
      new_name: 'Pack Size',
      values_rename: [{ from: '50', to: '50 pcs' }],
    },
  ],
  options_add: [{ name: 'Colour', values: ['Clear', 'Black'] }],
  variants: [
    {
      id: '8a1d2f0e-5b7c-4c1a-9f3e-2d6b7a8c9e01',
      price: '9.49',
      compare_at_price: '11.99',
      sku: 'HSC500-50',
      barcode: '5060000000017',
      taxable: true,
      inventory_policy: 'DENY',
      tracked: true,
      requires_shipping: true,
      cost: '4.10',
      weight: '0.900',
      weight_unit: 'KILOGRAMS',
      stock: [
        { location_id: 60465184951, available: 150 },
        { location_id: 70137741495, available: 25 },
      ],
      image_attachment_id: '2b9f6e1a-7c3d-4a5e-8f1b-0c2d3e4f5a61',
      remove_image: false,
      metafields: [
        {
          namespace: 'custom',
          key: 'pack_note',
          type: 'single_line_text_field',
          value: '50 per sleeve',
        },
      ],
      metafields_remove: [{ namespace: 'custom', key: 'old_note' }],
    },
    {
      option_values: ['250', 'Black'],
      price: '39.99',
      sku: 'HSC500-250-BLK',
      taxable: true,
      inventory_policy: 'DENY',
      tracked: true,
      requires_shipping: true,
      cost: '16.40',
      weight: '4.500',
      weight_unit: 'KILOGRAMS',
      stock: [{ location_id: 60465184951, available: 40 }],
      image_url: 'https://cdn.shopify.com/s/files/1/0000/0000/files/hsc500-250-black.jpg',
      metafields: [
        {
          namespace: 'custom',
          key: 'pack_note',
          type: 'single_line_text_field',
          value: '250 per box',
        },
      ],
    },
  ],
  variants_remove: ['c4e7b9a2-1d3f-4e8a-b6c5-7f9e0a1b2c03'],
  metafields: [
    {
      namespace: 'custom',
      key: 'material',
      type: 'list.single_line_text_field',
      value: '["Plastic"]',
    },
  ],
  metafields_remove: [{ namespace: 'custom', key: 'custom_print_available' }],
  media_add: [
    {
      url: 'https://cdn.shopify.com/s/files/1/0000/0000/files/hsc500-side.jpg',
      alt: 'Side view',
      media_type: 'IMAGE',
    },
  ],
  media_update: [
    { attachment_id: '2b9f6e1a-7c3d-4a5e-8f1b-0c2d3e4f5a61', alt: 'Pack of 50, front' },
  ],
  media_remove: ['9e0f1a2b-3c4d-4e5f-8a6b-7c8d9e0f1a83'],
  media_order: [
    '2b9f6e1a-7c3d-4a5e-8f1b-0c2d3e4f5a61',
    '5d8a3c7e-2f1b-4e6d-9a0c-1b2c3d4e5f72',
  ],
}

describe('api.products.update (PUT /products/{id})', () => {
  const put = vi.mocked(apiClient.put)

  beforeEach(() => {
    put.mockReset()
    put.mockResolvedValue({
      code: 200,
      status: 'OK',
      message: 'Updated',
      result: { product_id: 'p1', sync_status: 'pending', message: 'Updated' },
    })
  })

  it('sends the documented example body untouched, for the product’s store', async () => {
    await api.products.update('p1', DOCUMENTED_UPDATE, 'polymer-uk')

    expect(put).toHaveBeenCalledWith('/products/p1', DOCUMENTED_UPDATE, {
      params: { shop: 'polymer-uk' },
    })
  })
})
