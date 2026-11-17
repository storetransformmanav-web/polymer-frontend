import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, type CollectionListResponse } from '../../../lib/api/endpoints.ts'
import { renderWithProviders } from '../../../test/renderWithProviders.tsx'
import { CollectionsPage } from './CollectionsPage.tsx'

vi.mock('../../../lib/api/endpoints.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/api/endpoints.ts')>()),
  api: {
    collections: { list: vi.fn(), detail: vi.fn(), ruleOptions: vi.fn() },
    shops: { list: vi.fn(() => Promise.resolve([])) },
    auth: {},
  },
}))

// The product's own page belongs to the products feature; here it is a stand-in with what the
// page hands it: the product's id, the Back button's words and what Back does.
vi.mock('../../products/index.ts', () => ({
  ProductLightbox: () => null,
  ProductDetailsView: ({
    id,
    backLabel,
    onBack,
  }: {
    id: string
    backLabel?: string
    onBack: () => void
  }) => (
    <section aria-label="Product page">
      <h2>Product page {id}</h2>
      <button type="button" onClick={onBack}>
        {backLabel}
      </button>
    </section>
  ),
}))

const EMPTY = {
  items: [],
  page: 1,
  page_size: 25,
  total: 0,
  total_pages: 0,
  has_next: false,
} as unknown as CollectionListResponse

function Path() {
  const location = useLocation()
  return <p data-testid="path">{location.pathname}</p>
}

function renderPage(route: string) {
  return renderWithProviders(
    <>
      <Path />
      <Routes>
        <Route path="/collections/*" element={<CollectionsPage />} />
      </Routes>
    </>,
    { route },
  )
}

describe('CollectionsPage — a product opened from a collection', () => {
  beforeEach(() => {
    vi.mocked(api.collections.list).mockResolvedValue(EMPTY)
    vi.mocked(api.collections.detail).mockRejectedValue(new Error('not needed here'))
    vi.mocked(api.collections.ruleOptions).mockRejectedValue(new Error('not needed here'))
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('shows the product’s page, with a Product tab in the strip', () => {
    renderPage('/collections/product/pa')

    expect(screen.getByRole('heading', { name: 'Product page pa' })).toBeInTheDocument()
    const strip = screen.getByRole('navigation', { name: 'Open collections' })
    const tab = within(strip).getByRole('button', { name: /^Product\s*Product$/ })
    expect(tab).toHaveAttribute('aria-current', 'page')
    // Not mistaken for a collection called "product": no collection was asked for.
    expect(api.collections.detail).not.toHaveBeenCalled()
  })

  it('goes back to the list from "Back to list" when it was not opened from a collection', async () => {
    const user = userEvent.setup()
    renderPage('/collections/product/pa')

    await user.click(screen.getByRole('button', { name: 'Back to list' }))

    await waitFor(() =>
      expect(screen.getByTestId('path')).toHaveTextContent(/^\/collections$/),
    )
    expect(screen.queryByRole('heading', { name: 'Product page pa' })).toBeNull()
  })

  it('closes the product with the ✕ on its tab', async () => {
    const user = userEvent.setup()
    renderPage('/collections/product/pa')

    await user.click(screen.getByRole('button', { name: 'Close Product' }))

    await waitFor(() =>
      expect(screen.getByTestId('path')).toHaveTextContent(/^\/collections$/),
    )
    expect(screen.queryByRole('heading', { name: 'Product page pa' })).toBeNull()
  })

  it('opens a collection called anything else as before', async () => {
    renderPage('/collections/summer-picks')

    await waitFor(() =>
      expect(api.collections.detail).toHaveBeenCalledWith('summer-picks', {}),
    )
    expect(screen.queryByRole('heading', { name: /Product page/ })).toBeNull()
  })
})
