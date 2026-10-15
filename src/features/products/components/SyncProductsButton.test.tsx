import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { shopSelected } from '../../../app/store/shopSlice.ts'
import { ApiError } from '../../../lib/api/ApiError.ts'
import { api, type Shop, type SyncRun } from '../../../lib/api/endpoints.ts'
import { renderWithProviders } from '../../../test/renderWithProviders.tsx'
import { SyncProductsButton } from './SyncProductsButton.tsx'

vi.mock('../../../lib/api/endpoints.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/api/endpoints.ts')>()),
  api: {
    shops: { list: vi.fn() },
    sync: { triggerProducts: vi.fn(), status: vi.fn() },
    products: { list: vi.fn() },
    auth: {},
  },
}))

function shop(overrides: Partial<Shop>): Shop {
  return {
    id: 'id',
    key: null,
    name: null,
    domain: 'x.myshopify.com',
    is_active: true,
    position: 0,
    connected: true,
    products_count: 0,
    ...overrides,
  }
}

const SHOPS = [
  shop({ id: 's1', key: 'polymer-uk', name: 'Polymer UK', domain: 'uk.myshopify.com' }),
  shop({ id: 's2', key: 'polymer-eu', name: 'Polymer EU', domain: 'eu.myshopify.com' }),
  shop({
    id: 's3',
    key: 'old',
    name: 'Old store',
    domain: 'old.myshopify.com',
    is_active: false,
  }),
]

const run = (overrides: Partial<SyncRun>): SyncRun => ({
  id: 'run-1',
  entity: 'products',
  mode: 'full',
  status: 'running',
  started_at: new Date().toISOString(),
  finished_at: null,
  records_read: 0,
  records_written: 0,
  error: null,
  ...overrides,
})

const shopsList = vi.mocked(api.shops.list)
const trigger = vi.mocked(api.sync.triggerProducts)
const status = vi.mocked(api.sync.status)
const productsList = vi.mocked(api.products.list)
const never = () => new Promise<never>(() => undefined)

describe('the Sync products button', () => {
  beforeEach(() => {
    shopsList.mockResolvedValue(SHOPS)
    trigger.mockResolvedValue({ message: 'Products sync started' })
    status.mockResolvedValue([])
    productsList.mockResolvedValue({
      items: [],
      page: 1,
      page_size: 25,
      total: 0,
      total_pages: 1,
      has_next: false,
      sort: 'created_at',
      order: 'desc',
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  async function setup(selected?: string) {
    const user = userEvent.setup()
    const view = renderWithProviders(<SyncProductsButton />)
    const button = await screen.findByRole('button', { name: 'Sync products' })
    await waitFor(() => expect(button).toBeEnabled())
    if (selected) view.store.dispatch(shopSelected(selected))
    return { user, button, ...view }
  }

  it('waits for the stores to load before it can be used', async () => {
    shopsList.mockImplementation(never)
    renderWithProviders(<SyncProductsButton />)

    expect(await screen.findByRole('button', { name: 'Sync products' })).toBeDisabled()
  })

  it('starts at once on a click — there is no confirmation to answer', async () => {
    const { user, button } = await setup('polymer-uk')
    await user.click(button)

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    await waitFor(() => expect(trigger).toHaveBeenCalledTimes(1))
  })

  it('says which stores it will sync in the button’s tooltip', async () => {
    const { button } = await setup('polymer-uk')
    expect(button).toHaveAttribute('title', 'Sync products from Polymer UK')
  })

  it('syncs the selected store through POST /sync/products', async () => {
    const { user, button } = await setup('polymer-eu')
    await user.click(button)

    await waitFor(() => expect(trigger).toHaveBeenCalledTimes(1))
    expect(trigger).toHaveBeenCalledWith('polymer-eu')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('syncs every active store when "All shops" is selected', async () => {
    const { user, button } = await setup()
    expect(button).toHaveAttribute('title', 'Sync products from Polymer UK, Polymer EU')
    await user.click(button)

    await waitFor(() => expect(trigger).toHaveBeenCalledTimes(2))
    expect(trigger).toHaveBeenNthCalledWith(1, 'polymer-uk')
    expect(trigger).toHaveBeenNthCalledWith(2, 'polymer-eu')
  })

  it('shows it is syncing at once, with the progress read from the run, and cannot be started twice', async () => {
    status.mockResolvedValue([run({ status: 'running', records_read: 120 })])
    const { user, button } = await setup('polymer-uk')
    await user.click(button)

    const busy = await screen.findByRole('button', { name: 'Syncing products' })
    expect(busy).toBeDisabled()
    await waitFor(() =>
      expect(status).toHaveBeenCalledWith({
        entity: 'products',
        limit: 3,
        shop: 'polymer-uk',
      }),
    )
    expect(await screen.findByText('Syncing… 120')).toBeInTheDocument()
    expect(trigger).toHaveBeenCalledTimes(1)
  })

  it('keeps refreshing the product list while the run is still going, so products appear as they are saved', async () => {
    let polls = 0
    status.mockImplementation(async () => [
      run({
        status: 'running',
        records_read: (polls += 1) * 10,
        records_written: polls * 8,
      }),
    ])
    const { user, button } = await setup('polymer-uk')
    productsList.mockClear()
    await user.click(button)

    // First progress is read at once → one refresh; the next poll moves it → another. The run never ended.
    await waitFor(() => expect(productsList.mock.calls.length).toBeGreaterThanOrEqual(1))
    await waitFor(
      () => expect(productsList.mock.calls.length).toBeGreaterThanOrEqual(2),
      {
        timeout: 8000,
      },
    )
    expect(screen.getByRole('button', { name: 'Syncing products' })).toBeDisabled()
    expect(screen.queryByText(/^Synced/)).not.toBeInTheDocument()
  }, 15000)

  it('does not refresh the list again when the progress has not moved', async () => {
    status.mockResolvedValue([
      run({ status: 'running', records_read: 50, records_written: 40 }),
    ])
    const { user, button } = await setup('polymer-uk')
    productsList.mockClear()
    await user.click(button)

    await waitFor(() => expect(productsList).toHaveBeenCalledTimes(1))
    await new Promise((resolve) => setTimeout(resolve, 3500))
    expect(productsList).toHaveBeenCalledTimes(1)
  }, 15000)

  it('reports the result and refreshes the product list when the run finishes — no reload', async () => {
    status.mockResolvedValue([
      run({
        status: 'completed',
        finished_at: new Date().toISOString(),
        records_read: 450,
        records_written: 448,
      }),
    ])
    const { user, button } = await setup('polymer-uk')
    productsList.mockClear()
    await user.click(button)

    expect(await screen.findByText('Synced 448 products')).toBeInTheDocument()
    // The list (and the status tabs' counts) are re-read in the background.
    await waitFor(() => expect(productsList.mock.calls.length).toBeGreaterThanOrEqual(1))
    expect(screen.getByRole('button', { name: 'Sync products' })).toBeEnabled()
  })

  it('ignores an older run that was already finished before this click', async () => {
    status.mockResolvedValue([
      run({
        id: 'old',
        status: 'completed',
        started_at: '2020-01-01T00:00:00Z',
        finished_at: '2020-01-01T00:05:00Z',
        records_written: 999,
      }),
    ])
    const { user, button } = await setup('polymer-uk')
    await user.click(button)

    // Still waiting for the new run to appear — not "Synced 999 products".
    expect(await screen.findByRole('button', { name: 'Syncing products' })).toBeDisabled()
    expect(screen.queryByText(/Synced 999/)).not.toBeInTheDocument()
  })

  it('shows a failed run with its error', async () => {
    status.mockResolvedValue([
      run({
        status: 'failed',
        finished_at: new Date().toISOString(),
        error: 'Shopify rate limit reached',
      }),
    ])
    const { user, button } = await setup('polymer-uk')
    await user.click(button)

    expect(await screen.findByText('Shopify rate limit reached')).toBeInTheDocument()
  })

  it("shows the backend's message when the sync cannot be started", async () => {
    trigger.mockRejectedValue(
      new ApiError('You are not allowed to sync products.', { status: 403 }),
    )
    const { user, button } = await setup('polymer-uk')
    await user.click(button)

    expect(
      await screen.findByText('You are not allowed to sync products.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sync products' })).toBeEnabled()
    expect(status).not.toHaveBeenCalled()
  })

  it('keeps following the stores that did start when a later one fails', async () => {
    trigger.mockResolvedValueOnce({ message: 'ok' })
    trigger.mockRejectedValueOnce(
      new ApiError('Polymer EU is not connected.', { status: 422 }),
    )
    status.mockResolvedValue([run({ status: 'running', records_read: 5 })])
    const { user, button } = await setup()
    await user.click(button)

    await waitFor(() =>
      expect(status).toHaveBeenCalledWith(
        expect.objectContaining({ shop: 'polymer-uk' }),
      ),
    )
    expect(status).not.toHaveBeenCalledWith(
      expect.objectContaining({ shop: 'polymer-eu' }),
    )
  })
})
