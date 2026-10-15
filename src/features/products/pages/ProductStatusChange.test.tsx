import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../lib/api/ApiError.ts'
import {
  api,
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
      remove: vi.fn(),
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

function row(id: string, title: string, status: string): ProductListItem {
  return {
    shop: SHOP,
    id,
    shopify_id: Number(id.replace('id-', '')),
    title,
    handle: title.toLowerCase().replace(/ /g, '-'),
    status,
    vendor: 'Polymer',
    product_type: 'Bags',
    category_name: null,
    tags: [],
    image_url: null,
    price_min: '6.00',
    price_max: '7.50',
    currency: 'GBP',
    variants_count: 1,
    total_inventory: 5,
    shopify_created_at: null,
    shopify_updated_at: null,
    synced_at: '2026-01-01T00:00:00Z',
  }
}

const LIST: ProductListResponse = {
  items: [
    row('id-1', 'Hippo Bag', 'ACTIVE'),
    row('id-2', 'Foil Lid', 'DRAFT'),
    row('id-3', 'Odd Box', 'UNLISTED'),
  ],
  page: 1,
  page_size: 25,
  total: 3,
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
const update = vi.mocked(api.products.update)
const syncHistory = vi.mocked(api.products.syncHistory)
const never = () => new Promise<never>(() => undefined)

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/products/*" element={<ProductsPage />} />
    </Routes>,
    { route: '/products' },
  )
}

/** The pill that shows a product's status and opens its menu. */
const statusOf = (title: string) =>
  screen.getByRole('button', { name: new RegExp(`^Status of ${title}:`) })

describe('changing a status from the products table', () => {
  beforeEach(() => {
    list.mockResolvedValue(LIST)
    update.mockImplementation(async (id) => writeOk(id))
    syncHistory.mockResolvedValue([])
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  async function openList() {
    const user = userEvent.setup()
    renderPage()
    await screen.findByLabelText('Select Hippo Bag')
    return user
  }

  /** Opens a product's menu and picks a status from it. */
  async function choose(
    user: ReturnType<typeof userEvent.setup>,
    title: string,
    label: string,
  ) {
    await user.click(statusOf(title))
    await user.click(screen.getByRole('option', { name: label }))
  }

  it('shows every product’s status as a pill with a dropdown arrow', async () => {
    await openList()

    expect(statusOf('Hippo Bag')).toHaveTextContent('Active')
    expect(statusOf('Foil Lid')).toHaveTextContent('Draft')
    expect(statusOf('Odd Box')).toHaveTextContent('Unlisted')
    expect(statusOf('Hippo Bag')).toHaveAttribute('aria-haspopup', 'listbox')
  })

  it('opens a menu of Active, Draft and Archived with the current one marked', async () => {
    const user = await openList()
    await user.click(statusOf('Foil Lid'))

    const options = within(screen.getByRole('listbox')).getAllByRole('option')
    expect(options.map((option) => option.textContent)).toEqual([
      'Active',
      'Draft',
      'Archived',
    ])
    expect(screen.getByRole('option', { name: 'Draft' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('option', { name: 'Active' })).toHaveAttribute(
      'aria-selected',
      'false',
    )
  })

  it('colours each status in the menu: Active green, Draft grey, Archived red', async () => {
    const user = await openList()
    await user.click(statusOf('Hippo Bag'))

    const pill = (label: string) =>
      within(screen.getByRole('option', { name: label })).getByText(label)
    expect(pill('Active')).toHaveClass('text-accent', 'bg-accent-tint')
    expect(pill('Draft')).toHaveClass('text-text-muted')
    expect(pill('Archived')).toHaveClass('text-danger', 'bg-danger-bg')
  })

  it('shows a status the API cannot set (Unlisted), but only as a place to move away from', async () => {
    const user = await openList()
    await user.click(statusOf('Odd Box'))

    const unlisted = screen.getByRole('option', { name: 'Unlisted' })
    expect(unlisted).toHaveAttribute('aria-disabled', 'true')
    await user.click(unlisted)
    expect(update).not.toHaveBeenCalled()
  })

  it('saves the chosen status at once, for the product’s store, and keeps it on screen', async () => {
    const user = await openList()
    // The refetch hasn't answered: what shows is the instant update.
    list.mockImplementation(never)
    await choose(user, 'Hippo Bag', 'Draft')

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith('id-1', { status: 'DRAFT' }, 'polymer-uk'),
    )
    expect(statusOf('Hippo Bag')).toHaveTextContent('Draft')
    await waitFor(() => expect(statusOf('Hippo Bag')).toBeEnabled())
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    // Nothing else was touched.
    expect(update).toHaveBeenCalledTimes(1)
  })

  it('shows the new status straight away while the save is still running, and locks that row', async () => {
    update.mockImplementation(never)
    const user = await openList()
    await choose(user, 'Hippo Bag', 'Archived')

    expect(statusOf('Hippo Bag')).toHaveTextContent('Archived')
    expect(statusOf('Hippo Bag')).toBeDisabled()
    // Other rows stay usable.
    expect(statusOf('Foil Lid')).toBeEnabled()
  })

  it('puts the old status back and shows the backend’s message when the save fails', async () => {
    update.mockRejectedValue(
      new ApiError('You cannot archive this product.', { status: 422 }),
    )
    const user = await openList()
    await choose(user, 'Hippo Bag', 'Archived')

    expect(
      await screen.findByText('You cannot archive this product.'),
    ).toBeInTheDocument()
    expect(statusOf('Hippo Bag')).toHaveTextContent('Active')
    expect(statusOf('Hippo Bag')).toBeEnabled()
  })

  it('changes several products independently', async () => {
    const user = await openList()
    await choose(user, 'Hippo Bag', 'Archived')
    await choose(user, 'Foil Lid', 'Active')

    await waitFor(() => expect(update).toHaveBeenCalledTimes(2))
    expect(update).toHaveBeenCalledWith('id-1', { status: 'ARCHIVED' }, 'polymer-uk')
    expect(update).toHaveBeenCalledWith('id-2', { status: 'ACTIVE' }, 'polymer-uk')
  })

  it('sends nothing when the current status is picked again', async () => {
    const user = await openList()
    await choose(user, 'Hippo Bag', 'Active')

    expect(update).not.toHaveBeenCalled()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('works from the keyboard: arrows move, Enter picks, Escape closes without saving', async () => {
    const user = await openList()
    statusOf('Hippo Bag').focus()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    await user.keyboard('{ArrowDown}{Enter}')
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith('id-1', { status: 'DRAFT' }, 'polymer-uk'),
    )

    await user.click(statusOf('Foil Lid'))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(update).toHaveBeenCalledTimes(1)
    expect(statusOf('Foil Lid')).toHaveFocus()
  })

  it('closes when you click elsewhere', async () => {
    const user = await openList()
    await user.click(statusOf('Hippo Bag'))
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    await user.click(document.body)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(update).not.toHaveBeenCalled()
  })
})
