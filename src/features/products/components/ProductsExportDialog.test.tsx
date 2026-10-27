import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_FILTERS, type ProductFilters } from '../../../app/store/productsSlice.ts'
import type { ProductListItem } from '../../../lib/api/endpoints.ts'
import { ProductsExportDialog } from './ProductsExportDialog.tsx'

const item = (id: string, shopifyId: number): ProductListItem => ({
  shop: {
    key: 'polymer-uk',
    name: 'Polymer UK',
    domain: 'p.myshopify.com',
    currency: 'GBP',
  },
  id,
  shopify_id: shopifyId,
  title: `Product ${id}`,
  handle: `product-${id}`,
  status: 'ACTIVE',
  vendor: 'Polymer',
  product_type: 'Bags',
  category_name: null,
  tags: [],
  image_url: null,
  price_min: '1.00',
  price_max: '1.00',
  currency: 'GBP',
  variants_count: 1,
  total_inventory: 1,
  shopify_created_at: null,
  shopify_updated_at: null,
  synced_at: '2026-01-01T00:00:00Z',
})

const ITEMS = [item('a', 111), item('b', 222), item('c', 333)]

function setup(
  over: {
    selected?: ProductListItem[]
    filters?: Partial<ProductFilters>
    total?: number
  } = {},
) {
  const onExport = vi.fn()
  const onClose = vi.fn()
  render(
    <ProductsExportDialog
      items={ITEMS}
      selected={over.selected ?? []}
      filters={{ ...DEFAULT_FILTERS, ...over.filters }}
      total={over.total ?? 1266}
      onClose={onClose}
      onExport={onExport}
    />,
  )
  return { onExport, onClose, user: userEvent.setup() }
}

describe('ProductsExportDialog', () => {
  it('offers the store admin’s choices, with the current page chosen', () => {
    setup()

    expect(screen.getByRole('dialog', { name: 'Export products' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Current page' })).toBeChecked()
    expect(screen.getByRole('radio', { name: /All products/ })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: 'Selected: 0 products' })).toBeDisabled()
    // Nothing is searched, so there is nothing "matching".
    expect(screen.getByRole('radio', { name: /matching your search/ })).toBeDisabled()
    expect(screen.getByRole('radio', { name: /CSV for Excel, Numbers/ })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Plain CSV file' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: /Include metafields/ })).toBeChecked()
  })

  it('exports the page by Shopify id, for Excel, with metafields', async () => {
    const { user, onExport } = setup()

    await user.click(screen.getByRole('button', { name: 'Export products' }))

    expect(onExport).toHaveBeenCalledWith({
      params: { ids: '111,222,333', metafields: true },
      format: 'excel',
      summary: '3 products',
    })
  })

  it('starts on the ticked products when some are ticked', async () => {
    const { user, onExport } = setup({ selected: [ITEMS[1]] })

    expect(screen.getByRole('radio', { name: 'Selected: 1 product' })).toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Export products' }))

    expect(onExport).toHaveBeenCalledWith(
      expect.objectContaining({ params: { ids: '222', metafields: true } }),
    )
  })

  it('exports every product as a plain file without metafields', async () => {
    const { user, onExport } = setup({ filters: { shop: 'polymer-uk' } })

    await user.click(screen.getByRole('radio', { name: /All products/ }))
    await user.click(screen.getByRole('radio', { name: 'Plain CSV file' }))
    await user.click(screen.getByRole('checkbox', { name: /Include metafields/ }))
    await user.click(screen.getByRole('button', { name: 'Export products' }))

    expect(onExport).toHaveBeenCalledWith({
      params: { metafields: false, shop: 'polymer-uk' },
      format: 'plain',
      summary: 'all products',
    })
  })

  it('exports the products matching the search with the search and filters', async () => {
    const { user, onExport } = setup({
      filters: { search: 'bucket', status: 'ACTIVE' },
      total: 12,
    })

    await user.click(
      screen.getByRole('radio', { name: '12 products matching your search' }),
    )
    await user.click(screen.getByRole('button', { name: 'Export products' }))

    expect(onExport).toHaveBeenCalledWith({
      params: { metafields: true, search: 'bucket', status: 'active' },
      format: 'excel',
      summary: '12 products',
    })
  })

  it('does not offer "matching" for a stock or price filter the API cannot apply', () => {
    setup({ filters: { search: 'bucket', stock: 'in' }, total: 12 })

    expect(screen.getByRole('radio', { name: /matching your search/ })).toBeDisabled()
    expect(screen.getByText(/can’t be used in an export/)).toBeInTheDocument()
  })

  it('closes with Cancel and sends nothing', async () => {
    const { user, onExport, onClose } = setup()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onClose).toHaveBeenCalled()
    expect(onExport).not.toHaveBeenCalled()
  })
})
