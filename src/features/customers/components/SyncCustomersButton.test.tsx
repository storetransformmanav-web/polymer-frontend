import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { shopSelected } from '../../../app/store/shopSlice.ts'
import { ApiError } from '../../../lib/api/ApiError.ts'
import { api, type Shop, type SyncRun } from '../../../lib/api/endpoints.ts'
import { renderWithProviders } from '../../../test/renderWithProviders.tsx'
import { SyncCustomersButton } from './SyncCustomersButton.tsx'

vi.mock('../../../lib/api/endpoints.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/api/endpoints.ts')>()),
  api: {
    shops: { list: vi.fn() },
    sync: { triggerCustomers: vi.fn(), status: vi.fn() },
    customers: { list: vi.fn() },
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
  entity: 'customers',
  mode: '',
  status: 'running',
  started_at: new Date().toISOString(),
  finished_at: null,
  records_read: 0,
  records_written: 0,
  error: null,
  ...overrides,
})

const never = () => new Promise<never>(() => undefined)

const shopsList = vi.mocked(api.shops.list)
const trigger = vi.mocked(api.sync.triggerCustomers)
const status = vi.mocked(api.sync.status)
const customersList = vi.mocked(api.customers.list)

describe('the Sync customers button', () => {
  beforeEach(() => {
    shopsList.mockResolvedValue(SHOPS)
    trigger.mockResolvedValue({ message: 'Customer sync started' })
    status.mockResolvedValue([])
    customersList.mockResolvedValue({
      items: [],
      totals: null,
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
    const view = renderWithProviders(<SyncCustomersButton />)
    const button = await screen.findByRole('button', { name: 'Sync customers' })
    await waitFor(() => expect(button).toBeEnabled())
    if (selected) view.store.dispatch(shopSelected(selected))
    return { user, button, ...view }
  }

  it('waits for the stores to load before it can be used', async () => {
    shopsList.mockImplementation(never)
    renderWithProviders(<SyncCustomersButton />)

    expect(await screen.findByRole('button', { name: 'Sync customers' })).toBeDisabled()
  })

  it('sends nothing until it is clicked, and says which stores it will sync', async () => {
    const { button } = await setup('polymer-uk')
    expect(button).toHaveAttribute('title', 'Sync customers from Polymer UK')
    expect(trigger).not.toHaveBeenCalled()
    expect(status).not.toHaveBeenCalled()
  })

  it('syncs the selected store through POST /sync/customers, with no confirmation', async () => {
    const { user, button } = await setup('polymer-eu')
    await user.click(button)

    await waitFor(() => expect(trigger).toHaveBeenCalledTimes(1))
    expect(trigger).toHaveBeenCalledWith('polymer-eu')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('syncs every connected, active store when "All shops" is selected', async () => {
    const { user, button } = await setup()
    expect(button).toHaveAttribute('title', 'Sync customers from Polymer UK, Polymer EU')
    await user.click(button)

    await waitFor(() => expect(trigger).toHaveBeenCalledTimes(2))
    expect(trigger).toHaveBeenNthCalledWith(1, 'polymer-uk')
    expect(trigger).toHaveBeenNthCalledWith(2, 'polymer-eu')
  })

  it('shows it is syncing at once, with the progress read from the run, and cannot be started twice', async () => {
    status.mockResolvedValue([run({ status: 'running', records_read: 120 })])
    const { user, button } = await setup('polymer-uk')
    await user.click(button)

    const busy = await screen.findByRole('button', { name: 'Syncing customers' })
    expect(busy).toBeDisabled()
    await waitFor(() =>
      expect(status).toHaveBeenCalledWith({
        entity: 'customers',
        limit: 3,
        shop: 'polymer-uk',
      }),
    )
    expect(await screen.findByText('Syncing… 120')).toBeInTheDocument()
    expect(trigger).toHaveBeenCalledTimes(1)
  })

  it('refreshes the customers list while the run goes, as its progress moves', async () => {
    status.mockResolvedValue([
      run({ status: 'running', records_read: 50, records_written: 40 }),
    ])
    const { user, button } = await setup('polymer-uk')
    customersList.mockClear()
    await user.click(button)

    await waitFor(() => expect(customersList).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('button', { name: 'Syncing customers' })).toBeDisabled()
  })

  it('reports the result and refreshes the list when the run finishes — no reload', async () => {
    status.mockResolvedValue([
      run({
        status: 'completed',
        finished_at: new Date().toISOString(),
        records_read: 9762,
        records_written: 9760,
      }),
    ])
    const { user, button } = await setup('polymer-uk')
    customersList.mockClear()
    await user.click(button)

    expect(await screen.findByText('Synced 9,760 customers')).toBeInTheDocument()
    await waitFor(() => expect(customersList).toHaveBeenCalled())
    // Only the list: the role counts were never asked for, so they are not asked for now.
    expect(customersList).toHaveBeenCalledTimes(1)
    expect(customersList).toHaveBeenCalledWith(expect.objectContaining({ role: 'all' }))
    expect(screen.getByRole('button', { name: 'Sync customers' })).toBeEnabled()
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

    expect(
      await screen.findByRole('button', { name: 'Syncing customers' }),
    ).toBeDisabled()
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
    expect(screen.getByRole('button', { name: 'Sync customers' })).toBeEnabled()
  })

  it("shows the backend's message when the sync cannot be started, and can be tried again", async () => {
    trigger.mockRejectedValueOnce(
      new ApiError('You are not allowed to sync customers.', { status: 403 }),
    )
    const { user, button } = await setup('polymer-uk')
    await user.click(button)

    expect(
      await screen.findByText('You are not allowed to sync customers.'),
    ).toBeInTheDocument()
    expect(status).not.toHaveBeenCalled()
    // Never retried by itself; another click starts it again.
    expect(trigger).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Sync customers' }))
    await waitFor(() => expect(trigger).toHaveBeenCalledTimes(2))
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
