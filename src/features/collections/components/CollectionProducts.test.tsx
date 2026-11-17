import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CollectionDetail, CollectionProduct } from '../../../lib/api/endpoints.ts'
import { renderWithProviders } from '../../../test/renderWithProviders.tsx'
import type { useCollectionDetails } from '../hooks/useCollections.ts'
import { CollectionProducts } from './CollectionProducts.tsx'

const product = (id: string, title: string, sku: string): CollectionProduct =>
  ({
    id,
    shopify_id: 1,
    title,
    handle: `${id}-handle`,
    status: 'ACTIVE',
    total_inventory: 4,
    image_url: null,
    position: 1,
    vendor: 'Polymer',
    product_type: 'Bags',
    sku,
    price_min: '10.00',
    price_max: '10.00',
  }) as CollectionProduct

const PRODUCTS = [
  product('pa', 'Product A', 'SKU-A'),
  product('pb', 'Product B', 'SKU-B'),
]

const collection = {
  id: 'col1',
  title: 'Best Sellers',
  handle: 'best-sellers',
  collection_type: 'custom',
  editable: true,
  shop: { key: 'polymer-uk', name: 'Polymer UK', currency: 'GBP' },
} as unknown as CollectionDetail

const detailsState = {
  table: { search: '', sort: 'position', order: 'asc', page: 1, pageSize: 25 },
  setTable: vi.fn(),
  products: PRODUCTS,
  productsPage: { page: 1, page_size: 25, total: 2, total_pages: 1, has_next: false },
  productsPending: false,
  productsFetching: false,
  productsError: null,
  retryProducts: vi.fn(),
} as unknown as ReturnType<typeof useCollectionDetails>

/** Where a product link lands: shows the address and the state the link carried. */
function Landing() {
  const location = useLocation()
  return (
    <>
      <p data-testid="path">{location.pathname}</p>
      <p data-testid="state">{JSON.stringify(location.state)}</p>
    </>
  )
}

function renderTab() {
  return renderWithProviders(
    <Routes>
      <Route path="/collections/product/:id" element={<Landing />} />
      <Route
        path="/collections/:id"
        element={
          <CollectionProducts
            collection={collection}
            details={detailsState}
            canManage={false}
            onSave={vi.fn()}
          />
        }
      />
    </Routes>,
    { route: '/collections/col1' },
  )
}

describe('a collection’s Products tab — a product opens its own page', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('makes the product’s name and View icon links to its page, as an order’s items do', () => {
    renderTab()

    expect(screen.getByRole('link', { name: 'Product A' })).toHaveAttribute(
      'href',
      '/collections/product/pa',
    )
    expect(screen.getByRole('link', { name: 'View Product A' })).toHaveAttribute(
      'href',
      '/collections/product/pa',
    )
    expect(screen.getByRole('link', { name: 'Product B' })).toHaveAttribute(
      'href',
      '/collections/product/pb',
    )
  })

  it('carries the product’s name and where it was opened from, so Back returns here', async () => {
    const user = userEvent.setup()
    renderTab()

    await user.click(screen.getByRole('link', { name: 'Product A' }))

    expect(screen.getByTestId('path')).toHaveTextContent('/collections/product/pa')
    expect(JSON.parse(screen.getByTestId('state').textContent ?? '{}')).toEqual({
      linkedName: 'Product A',
      from: '/collections/col1',
    })
  })

  it('does the same from the View icon, and opens no window or drawer', async () => {
    const user = userEvent.setup()
    renderTab()

    await user.click(screen.getByRole('link', { name: 'View Product B' }))

    expect(screen.getByTestId('path')).toHaveTextContent('/collections/product/pb')
    expect(JSON.parse(screen.getByTestId('state').textContent ?? '{}')).toMatchObject({
      linkedName: 'Product B',
      from: '/collections/col1',
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
