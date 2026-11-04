import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { shopSelected } from '../../../app/store/shopSlice.ts'
import { ApiError } from '../../../lib/api/ApiError.ts'
import { api, type Shop, type SyncRun } from '../../../lib/api/endpoints.ts'
import { renderWithProviders } from '../../../test/renderWithProviders.tsx'
import { SyncOrdersButton } from './SyncOrdersButton.tsx'

vi.mock('../../../lib/api/endpoints.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/api/endpoints.ts')>()),
  api: {
    shops: { list: vi.fn() },
    sync: { triggerOrders: vi.fn(), status: vi.fn() },
    orders: { list: vi.fn() },
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
  entity: 'orders',
  mode: 'new',
  status: 'running',
  started_at: new Date().toISOString(),
  finished_at: null,
  records_read: 0,
  records_written: 0,
  error: null,
  ...overrides,
})

const shopsList = vi.mocked(api.shops.list)
const trigger = vi.mocked(api.sync.triggerOrders)
const status = vi.mocked(api.sync.status)
const ordersList = vi.mocked(api.orders.list)

describe('the Sync orders button', () => {
  beforeEach(() => {
    shopsList.mockResolvedValue(SHOPS)
    trigger.mockResolvedValue({ message: 'Orders sync started' })
    status.mockResolvedValue([])
    ordersList.mockResolvedValue({
      items: [],
      totals: { orders: 0, total_price: '0', total_refunded: '0', net_payment: '0' },
      page: 1,
      page_size: 20,
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
    const view = renderWithProviders(<SyncOrdersButton />)
    const button = await screen.findByRole('button', { name: 'Sync orders' })
    await waitFor(() => expect(button).toBeEnabled())
    if (selected) view.store.dispatch(shopSelected(selected))
    return { user, button, ...view }
  }

  async function openPanel(selected?: string) {
    const view = await setup(selected)
    await view.user.click(view.button)
    const panel = within(screen.getByRole('group', { name: 'Sync orders' }))
    return { ...view, panel }
  }

  it('waits for the stores to load before it can be used', async () => {
    shopsList.mockImplementation(() => new Promise<never>(() => undefined))
    renderWithProviders(<SyncOrdersButton />)

    expect(await screen.findByRole('button', { name: 'Sync orders' })).toBeDisabled()
  })

  it('drops down a small panel and sends nothing until a sync is pressed', async () => {
    const { user, button, panel } = await openPanel('polymer-uk')

    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(screen.queryByRole('dialog')).toBeNull()
    // Like the products panel: the box is focused, with the two actions in it.
    expect(panel.getByLabelText(/Last days/)).toHaveFocus()
    expect(panel.getByLabelText(/Last days/)).toHaveValue('10')
    expect(panel.getByRole('button', { name: 'Refresh' })).toBeInTheDocument()
    expect(
      panel.getByRole('button', { name: /^Sync new and changed orders/ }),
    ).toBeInTheDocument()
    expect(trigger).not.toHaveBeenCalled()

    // Escape (or a click outside) closes it.
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('group', { name: 'Sync orders' })).toBeNull()
    expect(button).toHaveFocus()
    await user.click(button)
    await user.click(document.body)
    expect(screen.queryByRole('group', { name: 'Sync orders' })).toBeNull()
    expect(trigger).not.toHaveBeenCalled()
  })

  it('syncs new and changed orders with mode=new and closes the panel', async () => {
    const { user, panel } = await openPanel('polymer-uk')
    await user.click(panel.getByRole('button', { name: /^Sync new and changed orders/ }))

    expect(screen.queryByRole('group', { name: 'Sync orders' })).toBeNull()
    await waitFor(() => expect(trigger).toHaveBeenCalledTimes(1))
    expect(trigger).toHaveBeenCalledWith({ mode: 'new', shop: 'polymer-uk' })
  })

  it('refreshes the last 10 days by default (mode=refresh&days=10)', async () => {
    const { user, panel } = await openPanel('polymer-uk')
    await user.click(panel.getByRole('button', { name: 'Refresh' }))

    await waitFor(() => expect(trigger).toHaveBeenCalledTimes(1))
    expect(trigger).toHaveBeenCalledWith({
      mode: 'refresh',
      days: 10,
      shop: 'polymer-uk',
    })
    expect(screen.queryByRole('group', { name: 'Sync orders' })).toBeNull()
  })

  it('refreshes a typed number of days (Enter works)', async () => {
    const { user, panel } = await openPanel('polymer-uk')

    const box = panel.getByLabelText(/Last days/)
    await user.clear(box)
    await user.type(box, '3650')
    expect(panel.getByText('4/4')).toBeInTheDocument()
    await user.keyboard('{Enter}')
    await waitFor(() =>
      expect(trigger).toHaveBeenCalledWith({
        mode: 'refresh',
        days: 3650,
        shop: 'polymer-uk',
      }),
    )
  })

  it('takes whole days from 1 to 3650 and says why before sending', async () => {
    const { user, panel } = await openPanel('polymer-uk')
    const box = panel.getByLabelText(/Last days/)

    await user.clear(box)
    await user.click(panel.getByRole('button', { name: 'Refresh' }))
    expect(panel.getByRole('alert')).toHaveTextContent('Enter the number of days.')

    await user.type(box, '1.5')
    await user.click(panel.getByRole('button', { name: 'Refresh' }))
    expect(panel.getByRole('alert')).toHaveTextContent('Whole days only')

    await user.clear(box)
    await user.type(box, '0')
    await user.click(panel.getByRole('button', { name: 'Refresh' }))
    expect(panel.getByRole('alert')).toHaveTextContent('Between 1 and 3650 days.')

    await user.clear(box)
    await user.type(box, '3651')
    await user.click(panel.getByRole('button', { name: 'Refresh' }))
    expect(panel.getByRole('alert')).toHaveTextContent('Between 1 and 3650 days.')

    expect(trigger).not.toHaveBeenCalled()
    expect(screen.getByRole('group', { name: 'Sync orders' })).toBeInTheDocument()
  })

  it('says which stores it will sync in the button’s tooltip', async () => {
    const { button } = await setup('polymer-uk')
    expect(button).toHaveAttribute('title', 'Sync orders from Polymer UK')
  })

  it('syncs every active store when "All shops" is selected', async () => {
    const { user, button } = await setup()
    expect(button).toHaveAttribute('title', 'Sync orders from Polymer UK, Polymer EU')
    await user.click(button)
    await user.click(screen.getByRole('button', { name: /^Sync new and changed orders/ }))

    await waitFor(() => expect(trigger).toHaveBeenCalledTimes(2))
    expect(trigger).toHaveBeenNthCalledWith(1, { mode: 'new', shop: 'polymer-uk' })
    expect(trigger).toHaveBeenNthCalledWith(2, { mode: 'new', shop: 'polymer-eu' })
  })

  it('shows it is syncing at once, with the progress read from the run, and cannot be started twice', async () => {
    status.mockResolvedValue([run({ status: 'running', records_read: 120 })])
    const { user, panel } = await openPanel('polymer-uk')
    await user.click(panel.getByRole('button', { name: /^Sync new and changed orders/ }))

    const busy = await screen.findByRole('button', { name: 'Syncing orders' })
    expect(busy).toBeDisabled()
    await waitFor(() =>
      expect(status).toHaveBeenCalledWith({
        entity: 'orders',
        limit: 3,
        shop: 'polymer-uk',
      }),
    )
    expect(await screen.findByText('Syncing… 120')).toBeInTheDocument()
    expect(trigger).toHaveBeenCalledTimes(1)
  })

  it('refreshes the orders list when the run finishes and reports the result', async () => {
    status.mockResolvedValue([
      run({
        status: 'completed',
        finished_at: new Date().toISOString(),
        records_read: 40,
        records_written: 12,
      }),
    ])
    const { user, panel } = await openPanel('polymer-uk')
    ordersList.mockClear()
    await user.click(panel.getByRole('button', { name: /^Sync new and changed orders/ }))

    expect(await screen.findByText('Synced 12 orders')).toBeInTheDocument()
    await waitFor(() => expect(ordersList.mock.calls.length).toBeGreaterThanOrEqual(1))
    expect(screen.getByRole('button', { name: 'Sync orders' })).toBeEnabled()
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
    const { user, panel } = await openPanel('polymer-uk')
    await user.click(panel.getByRole('button', { name: /^Sync new and changed orders/ }))

    expect(await screen.findByRole('button', { name: 'Syncing orders' })).toBeDisabled()
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
    const { user, panel } = await openPanel('polymer-uk')
    await user.click(panel.getByRole('button', { name: /^Sync new and changed orders/ }))

    expect(await screen.findByText('Shopify rate limit reached')).toBeInTheDocument()
  })

  it("shows the backend's message when the sync cannot be started", async () => {
    trigger.mockRejectedValue(
      new ApiError('You are not allowed to sync orders.', { status: 403 }),
    )
    const { user, panel } = await openPanel('polymer-uk')
    await user.click(panel.getByRole('button', { name: /^Sync new and changed orders/ }))

    expect(
      await screen.findByText('You are not allowed to sync orders.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sync orders' })).toBeEnabled()
    expect(status).not.toHaveBeenCalled()
  })
})
