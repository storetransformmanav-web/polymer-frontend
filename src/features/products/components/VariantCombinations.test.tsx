import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  api,
  type ProductDetail,
  type ProductWriteResult,
} from '../../../lib/api/endpoints.ts'
import { confirmUpdate } from '../../../test/confirmUpdate.ts'
import { renderWithProviders } from '../../../test/renderWithProviders.tsx'
import { VariantsPanel } from './ProductDetailPanels.tsx'

vi.mock('../../../lib/api/endpoints.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/api/endpoints.ts')>()),
  api: {
    products: {
      list: vi.fn(),
      details: vi.fn(),
      update: vi.fn(),
      syncHistory: vi.fn(),
    },
    inventory: { locations: vi.fn() },
    auth: {},
  },
}))

const update = vi.mocked(api.products.update)
const WRITE_OK: ProductWriteResult = {
  product_id: 'id-1',
  sync_status: 'pending',
  push_id: 'push-1',
  changes: {},
  message: 'Saved.',
}

const variant = (
  n: number,
  size: string,
  color: string,
  price: string,
  stock: number,
) => ({
  id: `v${n}`,
  shopify_id: n,
  title: `${size} / ${color}`,
  sku: `SKU-${n}`,
  barcode: '',
  price,
  compare_at_price: null,
  cost: '10.00',
  currency: 'GBP',
  weight: '250',
  weight_unit: 'GRAMS',
  taxable: true,
  requires_shipping: true,
  inventory_policy: 'DENY',
  inventory_management: 'SHOPIFY',
  inventory_levels: [
    { location_shopify_id: 7, location_name: 'Unit 9', available: stock },
  ],
  inventory_quantity: stock,
  metafields: [],
  selected_options: [
    { name: 'Size', value: size },
    { name: 'Color', value: color },
  ],
  image_url: null,
})

/** Size × Colour: Small has Red and Black, Medium has Red (out of stock). */
const PRODUCT = {
  shop: { key: 'polymer-uk', name: 'Polymer UK', domain: 'polymer-uk-ltd.myshopify.com' },
  id: 'id-1',
  shopify_id: 1,
  title: 'H.M Tshirt',
  handle: 'h-m-tshirt',
  status: 'ACTIVE',
  currency: 'GBP',
  tags: [],
  images: [],
  collections: [],
  metafields: [],
  seo: { title: '', description: null },
  has_only_default_variant: false,
  total_inventory: 35,
  options: [
    { name: 'Size', position: 1, values: ['Small', 'Medium'] },
    { name: 'Color', position: 2, values: ['Red', 'Black'] },
  ],
  variants: [
    variant(1, 'Small', 'Red', '50.00', 25),
    variant(2, 'Small', 'Black', '200.00', 10),
    variant(3, 'Medium', 'Red', '62.00', 0),
  ],
} as unknown as ProductDetail

const table = () => within(screen.getByRole('region', { name: 'Variant combinations' }))

beforeEach(() => {
  update.mockResolvedValue(WRITE_OK)
  vi.mocked(api.products.details).mockResolvedValue(PRODUCT)
  vi.mocked(api.products.syncHistory).mockResolvedValue([])
  vi.mocked(api.inventory.locations).mockResolvedValue([])
  vi.mocked(api.products.list).mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    page_size: 25,
    total_pages: 0,
  } as unknown as Awaited<ReturnType<typeof api.products.list>>)
})
afterEach(() => vi.clearAllMocks())

describe('the Variants tab', () => {
  it('shows each option plainly — its name and a pill per value — with no card and no pencil', () => {
    renderWithProviders(<VariantsPanel product={PRODUCT} />)

    const options = within(screen.getByRole('region', { name: 'Variant options' }))
    expect(options.getByText('Size')).toBeInTheDocument()
    expect(
      within(options.getByRole('list', { name: 'Values of Color' })).getAllByRole(
        'listitem',
      ),
    ).toHaveLength(2)
    // Text buttons open the editor; there is no pencil icon button.
    expect(screen.getByRole('button', { name: 'Edit variants' })).toHaveTextContent(
      'Edit variants',
    )
    expect(screen.getByRole('button', { name: 'Add variant' })).toBeInTheDocument()
  })

  it('lists every variant in one table, with its values, status and an Edit button', () => {
    renderWithProviders(<VariantsPanel product={PRODUCT} />)

    const rows = table().getAllByRole('row').slice(1)
    expect(rows).toHaveLength(3)
    const medium = within(rows[2])
    expect(medium.getByText('Medium / Red')).toBeInTheDocument()
    expect(medium.getByText('SKU-3')).toBeInTheDocument()
    expect(medium.getByText('£62.00')).toBeInTheDocument()
    expect(medium.getByText('£10.00')).toBeInTheDocument()
    expect(medium.getByText('Out of stock')).toBeInTheDocument()
    expect(within(rows[0]).getByText('In stock')).toBeInTheDocument()
    expect(medium.getByRole('button', { name: 'Edit Medium / Red' })).toHaveTextContent(
      'Edit',
    )
  })

  it('narrows the table by search and by stock', async () => {
    const user = userEvent.setup()
    renderWithProviders(<VariantsPanel product={PRODUCT} />)

    await user.type(table().getByLabelText('Search variants'), 'black')
    expect(table().getAllByRole('row')).toHaveLength(2)
    expect(table().getByText('Small / Black')).toBeInTheDocument()

    await user.clear(table().getByLabelText('Search variants'))
    await user.selectOptions(table().getByLabelText('Show'), 'out')
    expect(table().getAllByRole('row')).toHaveLength(2)
    expect(table().getByText('Medium / Red')).toBeInTheDocument()
  })

  it('changes a value by double-clicking it, after "Are you sure?"', async () => {
    const user = userEvent.setup()
    renderWithProviders(<VariantsPanel product={PRODUCT} />)

    await user.dblClick(table().getByRole('button', { name: 'SKU-2' }))
    const box = screen.getByRole('textbox', { name: 'SKU of Small / Black' })
    await user.clear(box)
    await user.type(box, 'HM-S-B{Enter}')
    expect(update).not.toHaveBeenCalled()
    await confirmUpdate(user)

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        'id-1',
        { variants: [{ id: 'v2', sku: 'HM-S-B' }] },
        'polymer-uk',
      ),
    )
  })

  it('a blank compare-at price or cost clears it', async () => {
    const user = userEvent.setup()
    renderWithProviders(<VariantsPanel product={PRODUCT} />)

    await user.dblClick(
      within(table().getAllByRole('row')[1]).getByRole('button', { name: '£10.00' }),
    )
    await user.clear(
      screen.getByRole('textbox', { name: 'Cost per item of Small / Red' }),
    )
    await user.keyboard('{Enter}')
    await confirmUpdate(user)
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        'id-1',
        { variants: [{ id: 'v1', cost: null }] },
        'polymer-uk',
      ),
    )
  })

  it('Edit opens the same spreadsheet as Bulk edit, with just that variant, and sends only its changes', async () => {
    const user = userEvent.setup()
    renderWithProviders(<VariantsPanel product={PRODUCT} />)

    await user.click(table().getByRole('button', { name: 'Edit Small / Black' }))
    const bulk = within(screen.getByRole('region', { name: 'Bulk edit variants' }))
    expect(bulk.getByText('Editing 1 variant')).toBeInTheDocument()
    // One row only, and so no "All variants" row.
    expect(bulk.queryByLabelText('Price for Small / Red')).toBeNull()
    expect(bulk.queryByLabelText('Price for all variants')).toBeNull()
    expect(bulk.getByRole('button', { name: 'Save the variants' })).toBeDisabled()

    const price = bulk.getByLabelText('Price for Small / Black')
    await user.clear(price)
    await user.type(price, '180')
    await user.click(bulk.getByRole('button', { name: 'Save the variants' }))
    await confirmUpdate(user)

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        'id-1',
        { variants: [{ id: 'v2', price: '180' }] },
        'polymer-uk',
      ),
    )
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Bulk edit variants' })).toBeNull(),
    )
  })

  it('Cancel in the editor asks first when something was changed', async () => {
    const user = userEvent.setup()
    renderWithProviders(<VariantsPanel product={PRODUCT} />)

    await user.click(table().getByRole('button', { name: 'Edit Small / Red' }))
    const bulk = within(screen.getByRole('region', { name: 'Bulk edit variants' }))
    await user.type(bulk.getByLabelText('Price for Small / Red'), '9')
    await user.click(bulk.getByRole('button', { name: 'Cancel bulk editing' }))
    await user.click(screen.getByRole('button', { name: 'Yes, cancel' }))

    expect(screen.queryByRole('region', { name: 'Bulk edit variants' })).toBeNull()
    expect(update).not.toHaveBeenCalled()
  })

  it('Bulk edit edits the ticked variants in a spreadsheet, with an All variants row', async () => {
    const user = userEvent.setup()
    renderWithProviders(<VariantsPanel product={PRODUCT} />)

    await user.click(table().getByLabelText('Select Small / Red'))
    await user.click(table().getByLabelText('Select Medium / Red'))
    await user.click(table().getByRole('button', { name: 'Bulk edit (2)' }))

    const bulk = within(screen.getByRole('region', { name: 'Bulk edit variants' }))
    expect(bulk.getByText('Editing 2 variants')).toBeInTheDocument()
    expect(bulk.queryByLabelText('Price for Small / Black')).toBeNull()

    // The All variants row sets the price of both; then one SKU is changed on its own.
    await user.type(bulk.getByLabelText('Price for all variants'), '55')
    expect(bulk.getByLabelText('Price for Small / Red')).toHaveValue('55')
    expect(bulk.getByLabelText('Price for Medium / Red')).toHaveValue('55')
    await user.clear(bulk.getByLabelText('SKU for Medium / Red'))
    await user.type(bulk.getByLabelText('SKU for Medium / Red'), 'HM-M')

    await user.click(bulk.getByRole('button', { name: 'Save the variants' }))
    await confirmUpdate(user)

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1))
    const body = update.mock.calls[0][1]
    expect(body.variants).toEqual([
      { id: 'v1', price: '55' },
      { id: 'v3', price: '55', sku: 'HM-M' },
    ])
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Bulk edit variants' })).toBeNull(),
    )
  })

  it('Bulk edit with nothing ticked takes every variant shown; Back leaves at once when unchanged', async () => {
    const user = userEvent.setup()
    renderWithProviders(<VariantsPanel product={PRODUCT} />)

    await user.click(table().getByRole('button', { name: 'Bulk edit' }))
    const bulk = within(screen.getByRole('region', { name: 'Bulk edit variants' }))
    expect(bulk.getByText('Editing 3 variants')).toBeInTheDocument()

    await user.click(bulk.getByRole('button', { name: 'Back to list' }))
    expect(
      screen.getByRole('region', { name: 'Variant combinations' }),
    ).toBeInTheDocument()
    expect(update).not.toHaveBeenCalled()
  })
})
