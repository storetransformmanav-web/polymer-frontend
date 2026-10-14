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
  email: 'manav@polymer.co',
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
// One-row requests are the method tabs' counts, not pages of the list.
const isCountQuery = (params: ActivityListParams) => params.page_size === 1
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
          email: 'manav@polymer.co',
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
      const page1Calls = () =>
        list.mock.calls.filter(([p]) => !isCountQuery(p) && p.page === 1).length
      const before = page1Calls()
      await user.click(screen.getByRole('button', { name: 'Page 1' }))
      expect(screen.getByText('Manav viewed product 1')).toBeInTheDocument()
      expect(page1Calls()).toBe(before)
    })

    it('fetches the next page ahead of time, so paging forward is instant', async () => {
      const user = userEvent.setup()
      renderWithProviders(<ActivityPage />)
      await screen.findByText('Manav viewed product 1')

      await waitFor(() => expect(list).toHaveBeenCalledWith({ page: 2, page_size: 25 }))
      const page2Calls = () =>
        list.mock.calls.filter(([p]) => !isCountQuery(p) && p.page === 2).length
      expect(page2Calls()).toBe(1)

      await user.click(screen.getByRole('button', { name: 'Page 2' }))

      // No await: page 2's rows are there in the same render as the click, and
      // page 2 isn't requested a second time (page 3 is now fetched ahead instead).
      expect(screen.getByText('Manav viewed product 26')).toBeInTheDocument()
      expect(page2Calls()).toBe(1)
      await waitFor(() => expect(list).toHaveBeenCalledWith({ page: 3, page_size: 25 }))
    })

    it('does not prefetch a "next page" for a new filter using the previous results', async () => {
      const user = userEvent.setup()
      renderWithProviders(<ActivityPage />)
      await screen.findByText('Manav viewed product 1')
      await waitFor(() => expect(list).toHaveBeenCalledWith({ page: 2, page_size: 25 }))
      list.mockClear()

      // The POST query's own answer says there is no next page.
      list.mockImplementation((params) =>
        Promise.resolve({
          ...respond(params),
          has_next: false,
          total: 1,
          total_pages: 1,
        }),
      )
      await user.click(screen.getByRole('button', { name: /^POST/ }))
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
      // The list request fails once; the tabs' count requests are unaffected.
      let failList = true
      list.mockImplementation((params) =>
        failList && !isCountQuery(params)
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

    it('shows a count on every method tab, honouring the other filters', async () => {
      const byMethod = { GET: 50, POST: 6, PUT: 1, PATCH: 2, DELETE: 1 }
      list.mockImplementation((params) => {
        const total = params.method ? byMethod[params.method] : 60
        return Promise.resolve({ ...respond(params), total })
      })
      const user = userEvent.setup()
      renderWithProviders(<ActivityPage />)
      await screen.findByText('Manav viewed product 1')

      const tabs = screen.getByRole('group', { name: 'Filter by method' })
      expect(
        await within(tabs).findByRole('button', { name: /^All Methodss*60$/ }),
      ).toBeInTheDocument()
      for (const [method, count] of Object.entries(byMethod)) {
        expect(
          within(tabs).getByRole('button', {
            name: new RegExp(`^${method}\\s*${count}$`),
          }),
        ).toBeInTheDocument()
      }

      // The search narrows every tab's count (the count queries carry it).
      await user.type(screen.getByRole('searchbox', { name: 'Search activity' }), 'login')
      await waitFor(() =>
        expect(list).toHaveBeenCalledWith(
          expect.objectContaining({ search: 'login', method: 'DELETE', page_size: 1 }),
        ),
      )
    })

    it('does not ask for any count while the date range is backwards', async () => {
      const user = userEvent.setup()
      renderWithProviders(<ActivityPage />)
      await screen.findByText('Manav viewed product 1')
      await user.click(screen.getByRole('button', { name: 'Filters' }))
      list.mockClear()

      await user.type(screen.getByLabelText('From'), '2026-10-14T18:00')
      await user.type(screen.getByLabelText('To'), '2026-10-14T09:00')
      await screen.findByRole('alert')

      expect(list).not.toHaveBeenCalledWith(
        expect.objectContaining({ from: expect.any(String), to: expect.any(String) }),
      )
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

    it('filters by user (from the Users list) and by method', async () => {
      const user = userEvent.setup()
      renderWithProviders(<ActivityPage />)
      await screen.findByText('Manav viewed product 1')

      const userSelect = screen.getByLabelText('User:')
      expect(
        within(userSelect)
          .getAllByRole('option')
          .map((option) => option.textContent),
      ).toEqual(['All Users', 'Manav'])
      await user.selectOptions(userSelect, 'Manav')
      await waitFor(() =>
        expect(list).toHaveBeenCalledWith(
          expect.objectContaining({ user_id: 'user-1', page: 1 }),
        ),
      )

      await user.click(screen.getByRole('button', { name: /^POST/ }))
      await waitFor(() =>
        expect(list).toHaveBeenCalledWith(
          expect.objectContaining({ user_id: 'user-1', method: 'POST', page: 1 }),
        ),
      )
      expect(screen.getByRole('button', { name: /^POST/ })).toHaveAttribute(
        'aria-pressed',
        'true',
      )

      await user.click(screen.getByRole('button', { name: 'Clear All' }))
      expect(screen.getByLabelText('User:')).toHaveValue('')
      expect(screen.getByRole('button', { name: /^All Methods/ })).toHaveAttribute(
        'aria-pressed',
        'true',
      )
    })

    it('filters by action (names with counts from the actions API), entity and date range', async () => {
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
      await user.type(screen.getByLabelText('Entity type'), 'user')
      await user.type(screen.getByLabelText('Entity ID'), 'fe686ca4')
      await user.type(screen.getByLabelText('From'), '2026-10-14T09:00')
      await user.type(screen.getByLabelText('To'), '2026-10-14T18:30')

      await waitFor(() =>
        expect(list).toHaveBeenCalledWith({
          page: 1,
          page_size: 25,
          action: 'create_user',
          entity_type: 'user',
          entity_id: 'fe686ca4',
          from: new Date('2026-10-14T09:00').toISOString(),
          to: new Date('2026-10-14T18:30').toISOString(),
        }),
      )
    })

    it('warns about a backwards date range and does not ask the server', async () => {
      const user = userEvent.setup()
      renderWithProviders(<ActivityPage />)
      await screen.findByText('Manav viewed product 1')
      await user.click(screen.getByRole('button', { name: 'Filters' }))
      list.mockClear()

      await user.type(screen.getByLabelText('From'), '2026-10-14T18:00')
      await user.type(screen.getByLabelText('To'), '2026-10-14T09:00')

      expect(await screen.findByRole('alert')).toHaveTextContent(/before its start/)
      expect(list).not.toHaveBeenCalledWith(
        expect.objectContaining({ from: expect.any(String), to: expect.any(String) }),
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
      expect(within(panel).getByText('manav@polymer.co')).toBeInTheDocument()
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
