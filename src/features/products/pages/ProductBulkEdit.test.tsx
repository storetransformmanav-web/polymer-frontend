import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../lib/api/ApiError.ts'
import {
  api,
  type ProductDetail,
  type ProductListItem,
  type ProductListResponse,
  type ProductWriteResult,
} from '../../../lib/api/endpoints.ts'
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
const V_A = '11111111-1111-4111-8111-111111111111'
const V_B1 = '22222222-2222-4222-8222-222222222222'
const V_B2 = '33333333-3333-4333-8333-333333333333'

function row(id: string, title: string, variants: number): ProductListItem {
  return {
    shop: SHOP,
    id,
    shopify_id: Number(id.replace('id-', '')),
    title,
    handle: title.toLowerCase().replace(/ /g, '-'),
    status: 'ACTIVE',
    vendor: 'Polymer',
    product_type: 'Bags',
    category_name: null,
    tags: [],
    image_url: null,
    price_min: '6.00',
    price_max: '7.50',
    currency: 'GBP',
    variants_count: variants,
    total_inventory: 5,
    shopify_created_at: null,
    shopify_updated_at: null,
    synced_at: '2026-01-01T00:00:00Z',
  }
}

function variant(id: string, title: string, price: string, sku: string) {
  return {
    id,
    shopify_id: 1,
    title,
    sku,
    barcode: '',
    price,
    compare_at_price: null,
    currency: 'GBP',
    weight: null,
    weight_unit: 'GRAMS',
    taxable: true,
    requires_shipping: true,
    inventory_policy: 'DENY',
    inventory_management: 'SHOPIFY',
    inventory_levels: [],
    metafields: [],
  }
}

function detail(base: ProductListItem, variants: ReturnType<typeof variant>[]) {
  return {
    shop: SHOP,
    id: base.id,
    shopify_id: base.shopify_id,
    title: base.title,
    handle: base.handle,
    description_html: '',
    status: 'ACTIVE',
    vendor: 'Polymer',
    product_type: 'Bags',
    category: null,
    tags: [],
    template_suffix: '',
    seo: { title: null, description: null },
    currency: 'GBP',
    featured_image_url: null,
    variants_count: variants.length,
    options: [],
    images: [],
    variants,
    collections: [],
    metafields: [],
  } as unknown as ProductDetail
}

const HIPPO = row('id-1', 'Hippo Bag', 1)
const LID = row('id-2', 'Foil Lid', 2)
const DETAILS: Record<string, ProductDetail> = {
  'id-1': detail(HIPPO, [variant(V_A, 'Default', '25.85', 'HIP-1')]),
  'id-2': detail(LID, [
    variant(V_B1, '7x9inch', '6.00', 'LID-7'),
    variant(V_B2, '9x11inch', '7.50', 'LID-9'),
  ]),
}

const LIST: ProductListResponse = {
  items: [HIPPO, LID],
  page: 1,
  page_size: 25,
  total: 2,
  total_pages: 1,
  has_next: false,
  sort: 'created_at',
  order: 'desc',
}

const writeOk = (id: string): ProductWriteResult => ({
  product_id: id,
  sync_status: 'pending',
  push_id: `push-${id}`,
  changes: null,
  message: 'Saved. Sending to the store.',
})

const list = vi.mocked(api.products.list)
const details = vi.mocked(api.products.details)
const update = vi.mocked(api.products.update)
const syncHistory = vi.mocked(api.products.syncHistory)

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/products/*" element={<ProductsPage />} />
    </Routes>,
    { route: '/products' },
  )
}

describe('editing products in bulk', () => {
  beforeEach(() => {
    list.mockResolvedValue(LIST)
    details.mockImplementation(async (id) => DETAILS[id])
    update.mockImplementation(async (id) => writeOk(id))
    syncHistory.mockResolvedValue([])
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  async function openList() {
    const user = userEvent.setup()
    renderPage()
    await screen.findByLabelText('Select Hippo Bag')
    return user
  }

  /** Opens the editor with every product on the page. */
  async function openPageEditor() {
    const user = await openList()
    await user.click(screen.getByRole('button', { name: 'Edit in bulk' }))
    await user.click(screen.getByRole('menuitem', { name: /^Edit this page/ }))
    await screen.findByRole('heading', { name: 'Editing 2 products' })
    await screen.findByLabelText('Vendor for Hippo Bag')
    await screen.findByLabelText('Vendor for Foil Lid')
    return user
  }

  it('has a checkbox on every row and one that selects the whole page', async () => {
    const user = await openList()
    const all = screen.getByRole('checkbox', { name: 'Select all products on this page' })

    expect(screen.getByText('Tick products to edit several at once.')).toBeInTheDocument()

    await user.click(screen.getByLabelText('Select Hippo Bag'))
    expect(screen.getByText('1 selected')).toBeInTheDocument()
    expect(all).not.toBeChecked()
    expect((all as HTMLInputElement).indeterminate).toBe(true)

    await user.click(all)
    expect(screen.getByText('2 selected')).toBeInTheDocument()
    expect(screen.getByLabelText('Select Foil Lid')).toBeChecked()

    await user.click(all)
    expect(screen.queryByText(/selected$/)).not.toBeInTheDocument()
  })

  it('offers "Edit this page" and "Edit selected" under one menu', async () => {
    const user = await openList()
    await user.click(screen.getByRole('button', { name: 'Edit in bulk' }))

    expect(screen.getByRole('menuitem', { name: /^Edit this page/ })).toBeEnabled()
    // Nothing ticked yet, so there is nothing to "edit selected".
    expect(screen.getByRole('menuitem', { name: /^Edit selected/ })).toBeDisabled()
  })

  it('opens only the ticked products from "Edit selected"', async () => {
    const user = await openList()
    await user.click(screen.getByLabelText('Select Foil Lid'))
    await user.click(screen.getByRole('button', { name: 'Edit in bulk' }))
    await user.click(screen.getByRole('menuitem', { name: /^Edit selected/ }))

    expect(
      await screen.findByRole('heading', { name: 'Editing 1 product' }),
    ).toBeInTheDocument()
    expect(await screen.findByLabelText('Vendor for Foil Lid')).toBeInTheDocument()
    expect(screen.queryByLabelText('Vendor for Hippo Bag')).not.toBeInTheDocument()
  })

  it('opens every product on the page from "Edit this page", variants listed underneath', async () => {
    await openPageEditor()
    const editor = screen.getByRole('region', { name: 'Bulk edit' })

    // A single variant is edited on the product's own row; several are listed below it.
    expect(within(editor).getByLabelText('Price for Hippo Bag')).toHaveValue('25.85')
    expect(within(editor).getByText('7x9inch')).toBeInTheDocument()
    expect(within(editor).getByLabelText('Price for Foil Lid – 9x11inch')).toHaveValue(
      '7.50',
    )
    expect(within(editor).getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('saves only what changed, one update per changed product', async () => {
    const user = await openPageEditor()

    const vendor = screen.getByLabelText('Vendor for Hippo Bag')
    await user.clear(vendor)
    await user.type(vendor, 'Acme')
    const price = screen.getByLabelText('Price for Foil Lid – 9x11inch')
    await user.clear(price)
    await user.type(price, '8.25')

    expect(screen.getByText('2 unsaved')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(update).toHaveBeenCalledTimes(2))
    expect(update).toHaveBeenCalledWith('id-1', { vendor: 'Acme' }, 'polymer-uk')
    expect(update).toHaveBeenCalledWith(
      'id-2',
      { variants: [{ id: V_B2, price: '8.25' }] },
      'polymer-uk',
    )
    expect(await screen.findByText(/Saved 2 products/)).toBeInTheDocument()
    expect(screen.getAllByText('Saved')).toHaveLength(2)
    // Saved rows are no longer "unsaved", and Save is off again.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled(),
    )
  })

  it('does not send products that were not touched', async () => {
    const user = await openPageEditor()
    const type = screen.getByLabelText('Product type for Foil Lid')
    await user.clear(type)
    await user.type(type, 'Lids')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1))
    expect(update).toHaveBeenCalledWith('id-2', { product_type: 'Lids' }, 'polymer-uk')
  })

  it('changes the status of several products', async () => {
    const user = await openPageEditor()
    await user.selectOptions(screen.getByLabelText('Status for Hippo Bag'), 'DRAFT')
    await user.selectOptions(screen.getByLabelText('Status for Foil Lid'), 'ARCHIVED')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(update).toHaveBeenCalledTimes(2))
    expect(update).toHaveBeenCalledWith('id-1', { status: 'DRAFT' }, 'polymer-uk')
    expect(update).toHaveBeenCalledWith('id-2', { status: 'ARCHIVED' }, 'polymer-uk')
  })

  it('keeps going when one product fails, and says which', async () => {
    update.mockImplementation(async (id) => {
      if (id === 'id-2') throw new ApiError('Handle already taken.', { status: 422 })
      return writeOk(id)
    })
    const user = await openPageEditor()
    await user.type(screen.getByLabelText('Vendor for Hippo Bag'), '!')
    await user.type(screen.getByLabelText('Vendor for Foil Lid'), '!')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Handle already taken.')).toBeInTheDocument()
    expect(screen.getByText(/Saved 1 of 2 products/)).toBeInTheDocument()
    // The failed row keeps its edit, so Save is still on for a retry.
    expect(screen.getByLabelText('Vendor for Foil Lid')).toHaveValue('Polymer!')
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  it('sends nothing while a cell is invalid, and highlights it', async () => {
    const user = await openPageEditor()
    await user.type(screen.getByLabelText('Vendor for Hippo Bag'), '!')
    const price = screen.getByLabelText('Price for Hippo Bag')
    await user.clear(price)
    await user.type(price, 'abc')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(
      await screen.findByText(/Fix the highlighted cells in 1 product/),
    ).toBeInTheDocument()
    expect(update).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Price for Hippo Bag')).toHaveAttribute(
      'aria-invalid',
      'true',
    )
  })

  it('lets columns be hidden and shown from the Columns menu', async () => {
    const user = await openPageEditor()

    await user.click(screen.getByRole('button', { name: 'Columns' }))
    await user.click(screen.getByRole('checkbox', { name: 'Vendor' }))
    expect(screen.queryByLabelText('Vendor for Hippo Bag')).not.toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: /^SKU/ }))
    expect(screen.getByLabelText('SKU for Hippo Bag')).toHaveValue('HIP-1')
  })

  it('asks before leaving with unsaved changes, and stays if you say no', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = await openPageEditor()
    await user.type(screen.getByLabelText('Vendor for Hippo Bag'), '!')

    await user.click(screen.getByRole('button', { name: 'Back' }))

    expect(confirm).toHaveBeenCalled()
    expect(
      screen.getByRole('heading', { name: 'Editing 2 products' }),
    ).toBeInTheDocument()

    confirm.mockReturnValue(true)
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(
      screen.queryByRole('heading', { name: 'Editing 2 products' }),
    ).not.toBeInTheDocument()
  })

  it('goes back without asking when nothing changed', async () => {
    const confirm = vi.spyOn(window, 'confirm')
    const user = await openPageEditor()
    await user.click(screen.getByRole('button', { name: 'Back' }))

    expect(confirm).not.toHaveBeenCalled()
    expect(
      screen.queryByRole('heading', { name: 'Editing 2 products' }),
    ).not.toBeInTheDocument()
  })

  it('shows the saved values in the list once back, with no reload', async () => {
    const user = await openPageEditor()
    const title = screen.getByLabelText('Title for Hippo Bag')
    await user.clear(title)
    await user.type(title, 'Hippo Carrier Bag')
    // The server's own copy (what the quiet refetch after saving brings back).
    list.mockResolvedValue({
      ...LIST,
      items: [{ ...HIPPO, title: 'Hippo Carrier Bag' }, LID],
    })
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByText(/Saved 1 product/)

    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(await screen.findByLabelText('Select Hippo Carrier Bag')).toBeInTheDocument()
  })
})
