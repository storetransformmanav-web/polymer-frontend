import { screen, waitFor, within } from '@testing-library/react'
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

  /** Opens the panel under the button and starts the sync of all products. */
  async function syncAll(user: ReturnType<typeof userEvent.setup>, button: HTMLElement) {
    await user.click(button)
    const panel = screen.getByRole('group', { name: 'Sync products' })
    await user.click(within(panel).getByRole('button', { name: 'Sync all products' }))
  }

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

  it('drops down a small panel under the button, and sends nothing until a sync is pressed', async () => {
    const { user, button } = await setup('polymer-uk')
    await user.click(button)

    expect(button).toHaveAttribute('aria-expanded', 'true')
    // A panel, not a window.
    expect(screen.queryByRole('dialog')).toBeNull()
    const panel = within(screen.getByRole('group', { name: 'Sync products' }))
    expect(panel.getByLabelText(/Last days/i)).toHaveFocus()
    expect(panel.getByLabelText(/Last days/i)).toHaveValue('5')
    expect(panel.getByRole('button', { name: 'Sync' })).toBeInTheDocument()
    expect(panel.getByRole('button', { name: 'Sync all products' })).toBeInTheDocument()
    expect(panel.queryByLabelText(/Shopify ID/)).toBeNull()
    expect(trigger).not.toHaveBeenCalled()

    // Escape (or a click outside, or the button again) closes it.
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('group', { name: 'Sync products' })).toBeNull()
    expect(button).toHaveFocus()
    await user.click(button)
    await user.click(document.body)
    expect(screen.queryByRole('group', { name: 'Sync products' })).toBeNull()
    expect(trigger).not.toHaveBeenCalled()
  })

  it('Sync all products starts the background sync and closes the panel', async () => {
    const { user, button } = await setup('polymer-uk')
    await syncAll(user, button)

    expect(screen.queryByRole('group', { name: 'Sync products' })).toBeNull()
    await waitFor(() => expect(trigger).toHaveBeenCalledTimes(1))
    // A full import: no days.
    expect(trigger).toHaveBeenCalledWith({ shop: 'polymer-uk', days: null })
  })

  describe('the last days (POST /sync/products?days=N)', () => {
    const open = async (selected?: string) => {
      const view = await setup(selected)
      await view.user.click(view.button)
      const panel = within(screen.getByRole('group', { name: 'Sync products' }))
      return { ...view, panel }
    }

    it('Execute syncs the products changed in the last days (5 to begin with) and closes the panel', async () => {
      const { user, panel } = await open('polymer-uk')

      await user.click(panel.getByRole('button', { name: 'Sync' }))

      await waitFor(() =>
        expect(trigger).toHaveBeenCalledWith({ shop: 'polymer-uk', days: 5 }),
      )
      expect(screen.queryByRole('group', { name: 'Sync products' })).toBeNull()
    })

    it('sends the number typed, and Enter sends it too', async () => {
      const { user, panel } = await open('polymer-uk')
      const box = panel.getByLabelText(/Last days/i)

      await user.clear(box)
      await user.type(box, '30{Enter}')

      await waitFor(() =>
        expect(trigger).toHaveBeenCalledWith({ shop: 'polymer-uk', days: 30 }),
      )
    })

    it('takes whole days from 1 to 365 and says why before sending', async () => {
      const { user, panel } = await open('polymer-uk')
      const box = panel.getByLabelText(/Last days/i)

      await user.clear(box)
      await user.click(panel.getByRole('button', { name: 'Sync' }))
      expect(panel.getByRole('alert')).toHaveTextContent('Enter the number of days')

      await user.type(box, 'ab')
      await user.click(panel.getByRole('button', { name: 'Sync' }))
      expect(panel.getByRole('alert')).toHaveTextContent('Whole days only')

      await user.clear(box)
      await user.type(box, '366')
      await user.click(panel.getByRole('button', { name: 'Sync' }))
      expect(panel.getByRole('alert')).toHaveTextContent('Between 1 and 365 days')

      await user.clear(box)
      await user.type(box, '0')
      await user.click(panel.getByRole('button', { name: 'Sync' }))
      expect(panel.getByRole('alert')).toHaveTextContent('Between 1 and 365 days')

      // The box itself stops at 3 characters.
      await user.clear(box)
      await user.type(box, '12345')
      expect(box).toHaveValue('123')
      expect(trigger).not.toHaveBeenCalled()
    })

    it('syncs every active store when "All shops" is selected', async () => {
      const { user, panel } = await open()

      await user.click(panel.getByRole('button', { name: 'Sync' }))

      await waitFor(() => expect(trigger).toHaveBeenCalledTimes(2))
      expect(trigger).toHaveBeenNthCalledWith(1, { shop: 'polymer-uk', days: 5 })
      expect(trigger).toHaveBeenNthCalledWith(2, { shop: 'polymer-eu', days: 5 })
    })

    it('shows the backend message when another products sync is already running (409)', async () => {
      trigger.mockRejectedValue(
        new ApiError('A product sync is already running.', { status: 409 }),
      )
      const { user, panel } = await open('polymer-uk')

      await user.click(panel.getByRole('button', { name: 'Sync' }))

      expect(
        await screen.findByText('A product sync is already running.'),
      ).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Sync products' })).toBeEnabled()
    })
  })

  it('says which stores it will sync in the button’s tooltip', async () => {
    const { button } = await setup('polymer-uk')
    expect(button).toHaveAttribute('title', 'Sync products from Polymer UK')
  })

  it('syncs the selected store through POST /sync/products', async () => {
    const { user, button } = await setup('polymer-eu')
    await syncAll(user, button)

    await waitFor(() => expect(trigger).toHaveBeenCalledTimes(1))
    expect(trigger).toHaveBeenCalledWith({ shop: 'polymer-eu', days: null })
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('syncs every active store when "All shops" is selected', async () => {
    const { user, button } = await setup()
    expect(button).toHaveAttribute('title', 'Sync products from Polymer UK, Polymer EU')
    await syncAll(user, button)

    await waitFor(() => expect(trigger).toHaveBeenCalledTimes(2))
    expect(trigger).toHaveBeenNthCalledWith(1, { shop: 'polymer-uk', days: null })
    expect(trigger).toHaveBeenNthCalledWith(2, { shop: 'polymer-eu', days: null })
  })

  it('shows it is syncing at once, with the progress read from the run, and cannot be started twice', async () => {
    status.mockResolvedValue([run({ status: 'running', records_read: 120 })])
    const { user, button } = await setup('polymer-uk')
    await syncAll(user, button)

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
    await syncAll(user, button)

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
    await syncAll(user, button)

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
    await syncAll(user, button)

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
    await syncAll(user, button)

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
    await syncAll(user, button)

    expect(await screen.findByText('Shopify rate limit reached')).toBeInTheDocument()
  })

  it("shows the backend's message when the sync cannot be started", async () => {
    trigger.mockRejectedValue(
      new ApiError('You are not allowed to sync products.', { status: 403 }),
    )
    const { user, button } = await setup('polymer-uk')
    await syncAll(user, button)

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
    await syncAll(user, button)

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
