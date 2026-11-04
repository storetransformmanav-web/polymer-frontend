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
    sync: { triggerProducts: vi.fn(), status: vi.fn(), product: vi.fn() },
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
const syncOne = vi.mocked(api.sync.product)
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
    expect(panel.getByLabelText(/Shopify ID/)).toHaveFocus()
    expect(panel.getByRole('button', { name: 'Sync' })).toBeInTheDocument()
    expect(panel.getByRole('checkbox', { name: /^Only compare/ })).not.toBeChecked()
    expect(panel.getByRole('button', { name: 'Sync all products' })).toBeInTheDocument()
    // One store is picked in the top bar: no store to choose.
    expect(panel.queryByRole('combobox')).toBeNull()
    expect(trigger).not.toHaveBeenCalled()
    expect(syncOne).not.toHaveBeenCalled()

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
  })

  describe('one product (POST /sync/products/{shopify_product_id})', () => {
    const open = async (selected?: string) => {
      const view = await setup(selected)
      await view.user.click(view.button)
      const panel = within(screen.getByRole('group', { name: 'Sync products' }))
      return { ...view, panel }
    }

    it('syncs the product by its Shopify ID, closes the panel and shows the result beside the button', async () => {
      syncOne.mockResolvedValue({
        message: 'Product synced from Shopify.',
        differences: ['price: 9.99 → 10.99'],
      })
      const { user, panel } = await open('polymer-uk')

      await user.type(panel.getByLabelText(/Shopify ID/), '15497136308609')
      await user.click(panel.getByRole('button', { name: 'Sync' }))

      await waitFor(() =>
        expect(syncOne).toHaveBeenCalledWith('15497136308609', 'polymer-uk', false),
      )
      await waitFor(() =>
        expect(screen.queryByRole('group', { name: 'Sync products' })).toBeNull(),
      )
      const result = screen.getByRole('status')
      expect(result).toHaveTextContent('Synced product 15497136308609')
      expect(result).toHaveAttribute(
        'title',
        'Product synced from Shopify.\nprice: 9.99 → 10.99',
      )
      expect(trigger).not.toHaveBeenCalled()
    })

    it('Only compare sends dry_run (nothing saved); Enter sends it too', async () => {
      syncOne.mockResolvedValue({ message: '', differences: ['title: A → B'] })
      const { user, panel } = await open('polymer-uk')

      await user.click(panel.getByRole('checkbox', { name: /^Only compare/ }))
      expect(panel.getByRole('button', { name: 'Compare' })).toBeInTheDocument()
      await user.type(panel.getByLabelText(/Shopify ID/), '42{Enter}')

      await waitFor(() => expect(syncOne).toHaveBeenCalledWith('42', 'polymer-uk', true))
      expect(await screen.findByRole('status')).toHaveTextContent(
        'Compared product 42: 1 difference',
      )
    })

    it('takes digits only, at most 30 characters, and says why before sending', async () => {
      const { user, panel } = await open('polymer-uk')
      const box = panel.getByLabelText(/Shopify ID/)

      await user.click(panel.getByRole('button', { name: 'Sync' }))
      expect(panel.getByRole('alert')).toHaveTextContent(
        'Enter the product’s Shopify ID.',
      )

      await user.type(box, 'abc-12')
      await user.click(panel.getByRole('button', { name: 'Sync' }))
      expect(panel.getByRole('alert')).toHaveTextContent('Digits only')

      // The box itself stops at 30 characters.
      await user.clear(box)
      await user.type(box, '1'.repeat(40))
      expect(box).toHaveValue('1'.repeat(30))
      expect(panel.getByText('30/30')).toBeInTheDocument()
      expect(syncOne).not.toHaveBeenCalled()
    })

    it('asks which store when "All shops" is selected', async () => {
      syncOne.mockResolvedValue({ message: 'ok', differences: [] })
      const { user, panel } = await open()

      await user.selectOptions(panel.getByLabelText('Store'), 'polymer-eu')
      await user.type(panel.getByLabelText(/Shopify ID/), '7')
      await user.click(panel.getByRole('button', { name: 'Sync' }))

      await waitFor(() => expect(syncOne).toHaveBeenCalledWith('7', 'polymer-eu', false))
    })

    it('keeps the panel open with the backend’s message when it refuses', async () => {
      syncOne.mockRejectedValue(
        new ApiError('No product 7 in Polymer UK.', { status: 404 }),
      )
      const { user, panel } = await open('polymer-uk')

      await user.type(panel.getByLabelText(/Shopify ID/), '7')
      await user.click(panel.getByRole('button', { name: 'Sync' }))

      expect(await panel.findByText('No product 7 in Polymer UK.')).toBeInTheDocument()
      expect(screen.getByRole('group', { name: 'Sync products' })).toBeInTheDocument()
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
    expect(trigger).toHaveBeenCalledWith('polymer-eu')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('syncs every active store when "All shops" is selected', async () => {
    const { user, button } = await setup()
    expect(button).toHaveAttribute('title', 'Sync products from Polymer UK, Polymer EU')
    await syncAll(user, button)

    await waitFor(() => expect(trigger).toHaveBeenCalledTimes(2))
    expect(trigger).toHaveBeenNthCalledWith(1, 'polymer-uk')
    expect(trigger).toHaveBeenNthCalledWith(2, 'polymer-eu')
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
