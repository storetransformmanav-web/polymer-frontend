import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  api,
  type ProductDetail,
  type ProductListResponse,
  type ProductWriteResult,
} from '../../../lib/api/endpoints.ts'
import { confirmUpdate } from '../../../test/confirmUpdate.ts'
import { renderWithProviders } from '../../../test/renderWithProviders.tsx'
import { ProductsPage } from './ProductsPage.tsx'

vi.mock('../../../lib/api/endpoints.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/api/endpoints.ts')>()),
  api: {
    products: {
      list: vi.fn(),
      details: vi.fn(),
      update: vi.fn(),
      push: vi.fn(),
      syncHistory: vi.fn(),
    },
    auth: {},
  },
}))

const SHOP = {
  key: 'polymer-uk',
  name: 'Polymer UK',
  domain: 'polymer-uk-ltd.myshopify.com',
  currency: 'GBP',
}

const VARIANT = '11111111-1111-4111-8111-111111111111'

function product(withMetafields = true): ProductDetail {
  return {
    shop: SHOP,
    id: 'id-1',
    shopify_id: 1,
    title: 'Sushi Tray',
    handle: 'sushi-tray',
    description_html: '',
    status: 'ACTIVE',
    vendor: 'Polymer',
    product_type: 'Trays',
    category: null,
    tags: [],
    template_suffix: '',
    seo: { title: null, description: null },
    currency: 'GBP',
    price_range: { min: '9.50', max: '9.50', currency: 'GBP' },
    compare_at_price_range: null,
    featured_image_url: null,
    total_inventory: 5,
    variants_count: 1,
    options: [],
    images: [],
    variants: [
      {
        id: VARIANT,
        shopify_id: 11,
        title: 'Default Title',
        sku: 'SKU-1',
        barcode: '',
        position: 1,
        price: '9.50',
        compare_at_price: null,
        cost: null,
        currency: 'GBP',
        taxable: true,
        weight: null,
        weight_unit: 'GRAMS',
        requires_shipping: true,
        inventory_policy: 'DENY',
        inventory_management: 'SHOPIFY',
        inventory_levels: [],
        metafields: withMetafields
          ? [
              {
                namespace: 'my_fields',
                key: 'unit_of_sale',
                type: 'number_integer',
                value: '500',
              },
            ]
          : [],
      },
    ],
    collections: [],
    metafields: withMetafields
      ? [
          {
            namespace: 'custom',
            key: 'material',
            type: 'single_line_text_field',
            value: 'Foil',
          },
          { namespace: 'custom', key: 'eco_friendly', type: 'boolean', value: 'true' },
          {
            namespace: 'custom',
            key: 'pack_materials',
            type: 'list.single_line_text_field',
            value: '["Plastic"]',
          },
          {
            namespace: 'apd',
            key: 'apd',
            type: 'json_string',
            value: JSON.stringify({
              sections: [{ title: 'About', content: '<p>x</p>', position: 0 }],
            }),
          },
          {
            namespace: 'global',
            key: 'title_tag',
            type: 'single_line_text_field',
            value: 'Hi',
          },
        ]
      : [],
  } as unknown as ProductDetail
}

const LIST: ProductListResponse = {
  items: [],
  page: 1,
  page_size: 25,
  total: 0,
  total_pages: 1,
  has_next: false,
  sort: 'created_at',
  order: 'desc',
}

const WRITE_OK: ProductWriteResult = {
  product_id: 'id-1',
  sync_status: 'pending',
  push_id: 'push-1',
  changes: null,
  message: 'Saved.',
}

const details = vi.mocked(api.products.details)
const update = vi.mocked(api.products.update)

async function openTab(name: RegExp, withMetafields = true) {
  details.mockResolvedValue(product(withMetafields))
  const user = userEvent.setup()
  renderWithProviders(
    <Routes>
      <Route path="/products/*" element={<ProductsPage />} />
    </Routes>,
    { route: '/products/id-1' },
  )
  await user.click(await screen.findByRole('tab', { name }))
  return user
}

describe('editing metafields and the variant tax code on the product page', () => {
  beforeEach(() => {
    vi.mocked(api.products.list).mockResolvedValue(LIST)
    update.mockResolvedValue(WRITE_OK)
    vi.mocked(api.products.syncHistory).mockResolvedValue([])
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Metafields tab', () => {
    const rows = () => within(screen.getByRole('list', { name: 'Metafields' }))

    it('has a pencil, and only offers Save once something changed', async () => {
      const user = await openTab(/^Metafields/)

      await user.click(screen.getByRole('button', { name: 'Edit metafields' }))

      expect(screen.getByRole('button', { name: 'Save metafields' })).toBeDisabled()
      // The description sections and the SEO title have their own editors, so they are not here.
      expect(rows().queryByText('Description sections')).not.toBeInTheDocument()
      expect(rows().queryByText('SEO title')).not.toBeInTheDocument()
      expect(rows().getByText('Material')).toBeInTheDocument()
      expect(rows().getByText('Unit of sale')).toBeInTheDocument()
    })

    it('saves a changed value, asking first, and sends only that detail with its own type', async () => {
      const user = await openTab(/^Metafields/)
      await user.click(screen.getByRole('button', { name: 'Edit metafields' }))

      const box = screen.getByDisplayValue('Foil')
      await user.clear(box)
      await user.type(box, 'Paper')
      await user.click(screen.getByRole('button', { name: 'Save metafields' }))
      expect(update).not.toHaveBeenCalled()
      await confirmUpdate(user)

      await waitFor(() =>
        expect(update).toHaveBeenCalledWith(
          'id-1',
          {
            metafields: [
              {
                namespace: 'custom',
                key: 'material',
                type: 'single_line_text_field',
                value: 'Paper',
              },
            ],
          },
          'polymer-uk',
        ),
      )
    })

    it('changes a variant’s detail through that variant', async () => {
      const user = await openTab(/^Metafields/)
      await user.click(screen.getByRole('button', { name: 'Edit metafields' }))

      const box = screen.getByDisplayValue('500')
      await user.clear(box)
      await user.type(box, '750')
      await user.click(screen.getByRole('button', { name: 'Save metafields' }))
      await confirmUpdate(user)

      await waitFor(() =>
        expect(update).toHaveBeenCalledWith(
          'id-1',
          {
            variants: [
              {
                id: VARIANT,
                metafields: [
                  {
                    namespace: 'my_fields',
                    key: 'unit_of_sale',
                    type: 'number_integer',
                    value: '750',
                  },
                ],
              },
            ],
          },
          'polymer-uk',
        ),
      )
    })

    it('removes a detail, and Undo takes the removal back', async () => {
      const user = await openTab(/^Metafields/)
      await user.click(screen.getByRole('button', { name: 'Edit metafields' }))

      await user.click(screen.getByRole('button', { name: 'Remove Eco friendly' }))
      expect(screen.getByText('Will be deleted')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Undo' }))
      expect(screen.getByRole('button', { name: 'Save metafields' })).toBeDisabled()

      await user.click(screen.getByRole('button', { name: 'Remove Eco friendly' }))
      await user.click(screen.getByRole('button', { name: 'Save metafields' }))
      await confirmUpdate(user)

      await waitFor(() =>
        expect(update).toHaveBeenCalledWith(
          'id-1',
          { metafields_remove: [{ namespace: 'custom', key: 'eco_friendly' }] },
          'polymer-uk',
        ),
      )
    })

    it('adds a new metafield, even to a product that has none yet', async () => {
      const user = await openTab(/^Metafields/, false)
      expect(screen.getByText('No metafields yet.')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Edit metafields' }))
      await user.click(screen.getByRole('button', { name: 'Add a metafield' }))
      await user.type(screen.getByLabelText('Key'), 'unit_of_sale')
      await user.selectOptions(screen.getByLabelText('Kind'), 'Whole number')
      await user.type(screen.getByLabelText('Value'), '12')
      await user.click(screen.getByRole('button', { name: 'Save metafields' }))
      await confirmUpdate(user)

      await waitFor(() =>
        expect(update).toHaveBeenCalledWith(
          'id-1',
          {
            metafields: [
              {
                namespace: 'custom',
                key: 'unit_of_sale',
                type: 'number_integer',
                value: '12',
              },
            ],
          },
          'polymer-uk',
        ),
      )
    })

    it('does not send an incomplete new detail, and says what is missing', async () => {
      const user = await openTab(/^Metafields/)
      await user.click(screen.getByRole('button', { name: 'Edit metafields' }))
      await user.click(screen.getByRole('button', { name: 'Add a metafield' }))

      await user.click(screen.getByRole('button', { name: 'Save metafields' }))

      expect(await screen.findByText('Enter a key')).toBeInTheDocument()
      expect(screen.getByText('Fix the highlighted fields to save.')).toBeInTheDocument()
      expect(update).not.toHaveBeenCalled()
    })

    it('Discard throws the changes away without asking the server', async () => {
      const user = await openTab(/^Metafields/)
      await user.click(screen.getByRole('button', { name: 'Edit metafields' }))
      await user.type(screen.getByDisplayValue('Foil'), ' extra')

      await user.click(screen.getByRole('button', { name: 'Discard metafields changes' }))

      expect(screen.queryByDisplayValue('Foil extra')).not.toBeInTheDocument()
      expect(update).not.toHaveBeenCalled()
    })
  })

  describe('Variants tab', () => {
    it('sets a tax code on a variant, and sends only that', async () => {
      const user = await openTab(/^Variants/)
      await user.click(screen.getByRole('button', { name: 'Edit variants' }))

      // The tax code is in the Price card's extra options (closed to begin with).
      await user.click(screen.getByRole('button', { name: 'Show more options' }))
      await user.type(screen.getByLabelText(/^Tax code/), 'P0000000')
      await user.click(screen.getByRole('button', { name: 'Save variants' }))
      await confirmUpdate(user)

      await waitFor(() =>
        expect(update).toHaveBeenCalledWith(
          'id-1',
          { variants: [{ id: VARIANT, tax_code: 'P0000000' }] },
          'polymer-uk',
        ),
      )
    })
  })
})
