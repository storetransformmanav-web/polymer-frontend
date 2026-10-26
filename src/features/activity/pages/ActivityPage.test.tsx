import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../lib/api/ApiError.ts'
import {
  api,
  type ActivityItem,
  type ActivityListParams,
  type ActivityListResponse,
} from '../../../lib/api/endpoints.ts'
import { renderWithProviders } from '../../../test/renderWithProviders.tsx'
import { ActivityPage } from './ActivityPage.tsx'

vi.mock('../../../lib/api/endpoints.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/api/endpoints.ts')>()),
  api: {
    activity: { list: vi.fn(), actions: vi.fn() },
    users: { list: vi.fn() },
    auth: {},
  },
}))

const TOTAL = 60

const USER = {
  id: 'user-1',
  full_name: 'Manav',
  email: 'admin@example.com',
  role: 'admin',
}

/** Entry N: mostly GETs; #3 is a POST with changes, #5 a failed PATCH, #7 an injection attempt. */
function makeItem(n: number): ActivityItem {
  const base: ActivityItem = {
    id: n,
    time: '2026-10-14T11:04:03.652167Z',
    user: USER,
    action: 'get_product',
    summary: `Manav viewed product ${n}`,
    method: 'GET',
    path: `/api/products/${n}`,
    entity_type: null,
    entity_id: null,
    entity_label: null,
    details: { query: { include_raw: 'false' } },
    changes: null,
    status_code: 200,
    duration_ms: 81,
    ip: '183.82.198.229',
    device: 'Chrome on Windows',
  }
  if (n === 3) {
    return {
      ...base,
      action: 'create_user',
      summary: 'Manav created user jane@company.com',
      method: 'POST',
      path: '/api/users',
      status_code: 201,
      duration_ms: 1320,
      entity_type: 'user',
      entity_label: 'Jane Doe',
      changes: { role: { from: null, to: 'office' } },
    }
  }
  if (n === 5) {
    return {
      ...base,
      action: 'update_user',
      summary: 'Manav updated a user',
      method: 'PATCH',
      status_code: 403,
    }
  }
  if (n === 7) {
    return {
      ...base,
      summary: 'Viewed <img src=x onerror=alert(1)> product',
      details: { note: '<script>alert(1)</script>' },
    }
  }
  if (n === 8)
    return { ...base, user: null, summary: 'A system job ran', ip: null, device: null }
  return base
}

/** A fake server: 60 entries, paged by the request's page/page_size. */
function respond(params: ActivityListParams): ActivityListResponse {
  const page = params.page ?? 1
  const pageSize = params.page_size ?? 25
  const matches = params.search === 'nomatch' ? 0 : TOTAL
  const start = (page - 1) * pageSize
  const count = Math.max(0, Math.min(pageSize, matches - start))

  return {
    items: Array.from({ length: count }, (_, i) => makeItem(start + i + 1)),
    page,
    page_size: pageSize,
    total: matches,
    total_pages: Math.max(1, Math.ceil(matches / pageSize)),
    has_next: start + count < matches,
  }
}

const list = vi.mocked(api.activity.list)
const actions = vi.mocked(api.activity.actions)
const usersList = vi.mocked(api.users.list)

describe('ActivityPage', () => {
  beforeEach(() => {
    list.mockImplementation((params) => Promise.resolve(respond(params)))
    actions.mockResolvedValue([
      { action: 'list_products', count: 227 },
      { action: 'create_user', count: 2 },
    ])
    usersList.mockResolvedValue({
      items: [
        {
          id: 'user-1',
          first_name: 'Manav',
          last_name: '',
          full_name: 'Manav',
          email: 'admin@example.com',
          phone: null,
          role: 'admin',
          role_label: 'Administrator',
          is_active: true,
          google_linked: true,
          last_login_at: null,
          created_at: null,
          shop_keys: [],
        },
      ],
      page: 1,
      page_size: 100,
      total: 1,
      total_pages: 1,
      has_next: false,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('list', () => {
    it('loads the first page from the API with the default query', async () => {
      renderWithProviders(<ActivityPage />)

      expect(await screen.findByText('Manav viewed product 1')).toBeInTheDocument()
      expect(list).toHaveBeenCalledWith({ page: 1, page_size: 25 })
      expect(screen.getByText(/Showing/)).toHaveTextContent(
        'Showing 1 to 25 of 60 entries',
      )
    })

    it('shows time, user, action, summary, path, method, status and duration', async () => {
      renderWithProviders(<ActivityPage />)
      await screen.findByText('Manav viewed product 1')

      const headers = within(screen.getByRole('table'))
        .getAllByRole('columnheader')
        .map((header) => header.textContent)
      expect(headers).toEqual([
        'Time',
        'User',
        'Action',
        'Summary',
        'Method',
        'Status',
        'Duration',
        'Device',
        'View',
      ])

      const created = within(
        screen
          .getByText('Manav created user jane@company.com')
          .closest('tr') as HTMLElement,
      )
      expect(created.getByText('Create user')).toBeInTheDocument()
      expect(created.getByText('/api/users')).toBeInTheDocument()
      expect(created.getByText('POST')).toBeInTheDocument()
      expect(created.getByText('201')).toBeInTheDocument()
      expect(created.getByText('1.3 s')).toBeInTheDocument()
      expect(created.getByText(/14 Oct 2026, \d\d:\d\d:\d\d/)).toBeInTheDocument()

      const failed = within(
        screen.getByText('Manav updated a user').closest('tr') as HTMLElement,
      )
      expect(failed.getByText('PATCH')).toBeInTheDocument()
      expect(failed.getByText('403')).toBeInTheDocument()

      // An entry with no acting user is attributed to the system.
      const system = within(
        screen.getByText('A system job ran').closest('tr') as HTMLElement,
      )
      expect(system.getByText('System')).toBeInTheDocument()
    })

    it('pages with the shared pagination, and re-visits pages from the cache', async () => {
      const user = userEvent.setup()
      renderWithProviders(<ActivityPage />)
      await screen.findByText('Manav viewed product 1')

      await user.click(screen.getByRole('button', { name: 'Page 2' }))
      expect(await screen.findByText('Manav viewed product 26')).toBeInTheDocument()
      expect(list).toHaveBeenCalledWith({ page: 2, page_size: 25 })
      expect(screen.getByText(/Showing/)).toHaveTextContent('Showing 26 to 50 of 60')

      // Back to page 1: served from the cache with no new request.
      const page1Calls = () => list.mock.calls.filter(([p]) => p.page === 1).length
      const before = page1Calls()
      await user.click(screen.getByRole('button', { name: 'Page 1' }))
      expect(screen.getByText('Manav viewed product 1')).toBeInTheDocument()
      expect(page1Calls()).toBe(before)
    })

    it('asks for page 1 only when it opens, and for page 2 when its button is clicked', async () => {
      const user = userEvent.setup()
      renderWithProviders(<ActivityPage />)
      await screen.findByText('Manav viewed product 1')
      const page2Calls = () => list.mock.calls.filter(([p]) => p.page === 2).length
      expect(page2Calls()).toBe(0)

      await user.hover(screen.getByRole('button', { name: 'Page 2' }))
      expect(page2Calls()).toBe(0)

      await user.click(screen.getByRole('button', { name: 'Page 2' }))

      expect(await screen.findByText('Manav viewed product 26')).toBeInTheDocument()
      expect(page2Calls()).toBe(1)
    })

    it('asks for just the filtered page 1 when a filter is applied — no other page, no extra request', async () => {
      const user = userEvent.setup()
      renderWithProviders(<ActivityPage />)
      await screen.findByText('Manav viewed product 1')
      await user.click(screen.getByRole('button', { name: 'Filters' }))
      list.mockClear()

      // The filtered query's own answer says there is no next page.
      list.mockImplementation((params) =>
        Promise.resolve({
          ...respond(params),
          has_next: false,
          total: 1,
          total_pages: 1,
        }),
      )
      await user.selectOptions(screen.getByLabelText('Method'), 'POST')
      await screen.findByText(/Showing/)

      await waitFor(() =>
        expect(list).toHaveBeenCalledWith({ page: 1, page_size: 25, method: 'POST' }),
      )
      expect(list).not.toHaveBeenCalledWith(
        expect.objectContaining({ method: 'POST', page: 2 }),
      )
    })

    it('searches after a short pause, returns to page 1, and recovers from an empty result', async () => {
      const user = userEvent.setup()
      renderWithProviders(<ActivityPage />)
      await screen.findByText('Manav viewed product 1')
      await user.click(screen.getByRole('button', { name: 'Page 2' }))
      await screen.findByText('Manav viewed product 26')

      await user.type(
        screen.getByRole('searchbox', { name: 'Search activity' }),
        'nomatch',
      )

      await waitFor(() =>
        expect(list).toHaveBeenCalledWith(
          expect.objectContaining({ search: 'nomatch', page: 1 }),
        ),
      )
      expect(await screen.findByText('No activity found')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Clear all filters' }))
      expect(await screen.findByText('Manav viewed product 1')).toBeInTheDocument()
      expect(screen.getByRole('searchbox', { name: 'Search activity' })).toHaveValue('')
    })

    it('shows the backend message when loading fails, without retrying a 403, and recovers', async () => {
      let failList = true
      list.mockImplementation((params) =>
        failList
          ? Promise.reject(
              new ApiError('You do not have access to Activity.', { status: 403 }),
            )
          : Promise.resolve(respond(params)),
      )
      const user = userEvent.setup()
      renderWithProviders(<ActivityPage />)

      expect(await screen.findByText("Couldn't load activity")).toBeInTheDocument()
      expect(screen.getByText('You do not have access to Activity.')).toBeInTheDocument()

      failList = false
      await user.click(screen.getByRole('button', { name: 'Try again' }))
      expect(await screen.findByText('Manav viewed product 1')).toBeInTheDocument()
    })

    it('has no "All Methods" tab row any more: it is the Method dropdown in the Filters grid', async () => {
      const user = userEvent.setup()
      renderWithProviders(<ActivityPage />)
      await screen.findByText('Manav viewed product 1')

      // No tab strip, no per-method buttons.
      expect(screen.queryByRole('group', { name: 'Filter by method' })).toBeNull()
      for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
        expect(
          screen.queryByRole('button', { name: new RegExp(`^${method}`) }),
        ).toBeNull()
      }
      // The Method dropdown is the first field of the (collapsed) grid and carries the total.
      const grid = document.getElementById('activity-filter-grid')!
      expect(grid).toHaveAttribute('inert')
      const method = screen.getByLabelText('Method')
      expect(grid.querySelector('select')).toBe(method)
      expect(
        within(method).getByRole('option', { name: 'All Methods (60)' }),
      ).toBeInTheDocument()
      expect(
        within(method)
          .getAllByRole('option')
          .map((option) => option.textContent),
      ).toEqual(['All Methods (60)', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'])

      await user.click(screen.getByRole('button', { name: 'Filters' }))
      expect(grid).not.toHaveAttribute('inert')
      // Only pages of the list are ever requested (no one-row count queries).
      expect(list.mock.calls.every(([params]) => params.page_size === 25)).toBe(true)
    })

    it('puts the Filters button in the search row, beside the search box', async () => {
      renderWithProviders(<ActivityPage />)
      await screen.findByText('Manav viewed product 1')

      const row = screen
        .getByRole('searchbox', { name: 'Search activity' })
        .closest('section') as HTMLElement
      const search = screen.getByRole('searchbox', { name: 'Search activity' })
      const filters = screen.getByRole('button', { name: 'Filters' })
      expect(row).toContainElement(filters)
      // Right of the search box, in the same row as Clear All.
      expect(
        search.compareDocumentPosition(filters) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
      const clear = screen.getByRole('button', { name: 'Clear All' })
      expect(filters.parentElement).toBe(clear.parentElement)
    })

    it('has the date range in the search row, right of the search box — not in the Filters grid', async () => {
      const user = userEvent.setup()
      renderWithProviders(<ActivityPage />)
      await screen.findByText('Manav viewed product 1')

      const date = screen.getByRole('button', { name: /^Date range/ })
      const grid = document.getElementById('activity-filter-grid')!
      // Reachable without opening Filters, and not inside the grid.
      expect(grid).toHaveAttribute('inert')
      expect(grid.contains(date)).toBe(false)
      const search = screen.getByRole('searchbox', { name: 'Search activity' })
      expect(
        search.compareDocumentPosition(date) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()

      await user.click(screen.getByRole('button', { name: 'Filters' }))
      expect(grid.contains(date)).toBe(false)
    })

    it('filters by method: only that list is asked for, from page 1, and Clear All undoes it', async () => {
      const user = userEvent.setup()
      renderWithProviders(<ActivityPage />)
      await screen.findByText('Manav viewed product 1')
      await user.click(screen.getByRole('button', { name: 'Filters' }))
      list.mockClear()

      await user.selectOptions(screen.getByLabelText('Method'), 'POST')

      await waitFor(() =>
        expect(list).toHaveBeenCalledWith({ page: 1, page_size: 25, method: 'POST' }),
      )
      expect(list).toHaveBeenCalledTimes(1)
      expect(screen.getByLabelText('Method')).toHaveValue('POST')

      await user.click(screen.getByRole('button', { name: 'Clear All' }))
      await waitFor(() => expect(screen.getByLabelText('Method')).toHaveValue(''))
    })
  })

  describe('filters', () => {
    it('starts with the filter grid collapsed and reveals it from the Filters button', async () => {
      const user = userEvent.setup()
      renderWithProviders(<ActivityPage />)
      await screen.findByText('Manav viewed product 1')

      const toggle = screen.getByRole('button', { name: 'Filters' })
      expect(toggle).toHaveAttribute('aria-expanded', 'false')
      expect(document.getElementById('activity-filter-grid')).toHaveAttribute('inert')

      await user.click(toggle)
      expect(toggle).toHaveAttribute('aria-expanded', 'true')
      expect(document.getElementById('activity-filter-grid')).not.toHaveAttribute('inert')
    })

    it('has no User filter and no Refresh button, and never asks for the users list', async () => {
      const user = userEvent.setup()
      renderWithProviders(<ActivityPage />)
      await screen.findByText('Manav viewed product 1')
      await user.click(screen.getByRole('button', { name: 'Filters' }))

      expect(screen.queryByLabelText('User:')).toBeNull()
      expect(screen.queryByLabelText('User')).toBeNull()
      expect(screen.queryByRole('button', { name: 'Refresh activity' })).toBeNull()
      await new Promise((resolve) => setTimeout(resolve, 20))
      expect(usersList).not.toHaveBeenCalled()
    })

    it('filters by action (names with counts from the actions API) and date range', async () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2026-10-16T10:00:00'))
      const user = userEvent.setup()
      renderWithProviders(<ActivityPage />)
      await screen.findByText('Manav viewed product 1')
      await user.click(screen.getByRole('button', { name: 'Filters' }))

      const action = screen.getByLabelText('Action')
      await within(action).findByRole('option', { name: 'List products (227)' })
      expect(
        within(action)
          .getAllByRole('option')
          .map((option) => option.textContent),
      ).toEqual(['All Actions', 'List products (227)', 'Create user (2)'])
      await user.selectOptions(action, 'create_user')
      await user.click(screen.getByRole('button', { name: /^Date range/ }))
      await user.click(screen.getByRole('option', { name: 'Custom Range' }))
      await user.click(await screen.findByRole('button', { name: '14 October 2026' }))
      await user.click(screen.getByRole('button', { name: '16 October 2026' }))

      await waitFor(() =>
        expect(list).toHaveBeenCalledWith({
          page: 1,
          page_size: 25,
          action: 'create_user',
          from: new Date('2026-10-14T00:00:00').toISOString(),
          to: new Date('2026-10-16T23:59:59').toISOString(),
        }),
      )
    })
  })

  describe('details', () => {
    it('opens the full record in a side panel, with the changes and request details as JSON', async () => {
      const user = userEvent.setup()
      renderWithProviders(<ActivityPage />)
      await screen.findByText('Manav viewed product 1')

      await user.click(screen.getByRole('button', { name: 'View activity 3' }))

      const panel = await screen.findByRole('dialog', { name: 'Activity 3 details' })
      expect(
        within(panel).getByText('Manav created user jane@company.com'),
      ).toBeInTheDocument()
      expect(within(panel).getByText('admin@example.com')).toBeInTheDocument()
      expect(within(panel).getByText('create_user')).toBeInTheDocument()
      expect(within(panel).getByText('POST /api/users')).toBeInTheDocument()
      expect(within(panel).getByText('user · Jane Doe')).toBeInTheDocument()
      expect(within(panel).getByText('183.82.198.229')).toBeInTheDocument()
      expect(within(panel).getByText('Chrome on Windows')).toBeInTheDocument()
      const changes = within(within(panel).getByRole('region', { name: 'Changes' }))
      expect(changes.getByText(/"to": "office"/)).toBeInTheDocument()
      expect(
        within(panel).getByRole('region', { name: 'Request details' }),
      ).toBeInTheDocument()

      await user.keyboard('{Escape}')
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('shows markup from the API as inert text — it never becomes elements or runs', async () => {
      const user = userEvent.setup()
      renderWithProviders(<ActivityPage />)
      await screen.findByText('Manav viewed product 1')

      // In the table...
      const summary = screen.getByText('Viewed <img src=x onerror=alert(1)> product')
      expect(summary.querySelector('img')).toBeNull()

      // ...and in the JSON of the panel.
      await user.click(screen.getByRole('button', { name: 'View activity 7' }))
      const panel = await screen.findByRole('dialog')
      expect(within(panel).getByText(/<script>alert\(1\)<\/script>/)).toBeInTheDocument()
      expect(panel.querySelector('script, img')).toBeNull()
    })

    it('does not show an empty Changes block for entries that changed nothing', async () => {
      const user = userEvent.setup()
      renderWithProviders(<ActivityPage />)
      await screen.findByText('Manav viewed product 1')

      await user.click(screen.getByRole('button', { name: 'View activity 1' }))

      const panel = await screen.findByRole('dialog')
      expect(
        within(panel).queryByRole('region', { name: 'Changes' }),
      ).not.toBeInTheDocument()
      expect(
        within(panel).getByRole('region', { name: 'Request details' }),
      ).toBeInTheDocument()
    })
  })
})
