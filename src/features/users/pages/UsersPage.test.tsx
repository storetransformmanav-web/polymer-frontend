import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../lib/api/ApiError.ts'
import {
  api,
  type Role,
  type Shop,
  type UserItem,
  type UserListParams,
  type UserListResponse,
} from '../../../lib/api/endpoints.ts'
import { Route, Routes } from 'react-router-dom'
import { renderWithProviders } from '../../../test/renderWithProviders.tsx'
import { UsersPage } from './UsersPage.tsx'

vi.mock('../../../lib/api/endpoints.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/api/endpoints.ts')>()),
  api: {
    users: { list: vi.fn(), create: vi.fn(), remove: vi.fn() },
    roles: { list: vi.fn() },
    shops: { list: vi.fn() },
    auth: {},
  },
}))

const TOTAL = 60

const ROLES: Role[] = [
  {
    name: 'admin',
    label: 'Administrator',
    description: null,
    is_system: true,
    users_count: 1,
  },
  {
    name: 'office',
    label: 'Office',
    description: null,
    is_system: true,
    users_count: 40,
  },
  {
    name: 'warehouse',
    label: 'Warehouse',
    description: null,
    is_system: false,
    users_count: 19,
  },
]

function makeShop(id: string, key: string, name: string): Shop {
  return {
    id,
    key,
    name,
    domain: `${key}.myshopify.com`,
    is_active: true,
    position: 0,
    connected: true,
    products_count: 0,
  }
}
const SHOPS = [
  makeShop('s1', 'polymer-uk', 'Polymer UK'),
  makeShop('s2', 'polymer-eu', 'Polymer EU'),
]

/** User #1 is an administrator who signs in with Google; the rest are office staff. */
function makeUser(n: number): UserItem {
  const admin = n === 1
  return {
    id: `user-${n}`,
    first_name: `First${n}`,
    last_name: `Last${n}`,
    full_name: `First${n} Last${n}`,
    email: `user${n}@polymer.co`,
    phone: n === 2 ? '+44 20 7946 0000' : null,
    role: admin ? 'admin' : 'office',
    role_label: admin ? 'Administrator' : 'Office',
    is_active: n % 5 !== 0,
    google_linked: admin,
    last_login_at: n === 2 ? '2026-10-14T10:59:11Z' : null,
    created_at: '2026-10-08T12:58:01Z',
    shop_keys: n === 2 ? ['polymer-uk', 'polymer-eu'] : [],
  }
}

/** A fake server: 60 users, paged by the request's page/page_size. */
function respond(params: UserListParams): UserListResponse {
  const page = params.page ?? 1
  const pageSize = params.page_size ?? 25
  const matches = params.search === 'nomatch' ? 0 : TOTAL
  const start = (page - 1) * pageSize
  const count = Math.max(0, Math.min(pageSize, matches - start))

  return {
    items: Array.from({ length: count }, (_, i) => makeUser(start + i + 1)),
    page,
    page_size: pageSize,
    total: matches,
    total_pages: Math.max(1, Math.ceil(matches / pageSize)),
    has_next: start + count < matches,
  }
}

const list = vi.mocked(api.users.list)
const create = vi.mocked(api.users.create)
const remove = vi.mocked(api.users.remove)
const rolesList = vi.mocked(api.roles.list)
const shopsList = vi.mocked(api.shops.list)

// One-row requests are the status tabs' counts, not pages of the list.
const isCountQuery = (params: UserListParams) => params.page_size === 1
const callsForPage = (page: number) =>
  list.mock.calls.filter(([params]) => !isCountQuery(params) && params.page === page)
    .length

/** The page where the app serves it: `/users`, and `/users/new` for the Add user form. */
function renderPage(route = '/users') {
  return renderWithProviders(
    <Routes>
      <Route path="/users/*" element={<UsersPage />} />
    </Routes>,
    { route },
  )
}

describe('UsersPage', () => {
  beforeEach(() => {
    list.mockImplementation((params) => Promise.resolve(respond(params)))
    rolesList.mockResolvedValue(ROLES)
    shopsList.mockResolvedValue(SHOPS)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('list', () => {
    it('loads the first page from the API with the default query', async () => {
      renderWithProviders(<UsersPage />)

      expect(await screen.findByText('First2 Last2')).toBeInTheDocument()
      expect(list).toHaveBeenCalledWith({ page: 1, page_size: 25 })
      expect(screen.getByText(/Showing/)).toHaveTextContent(
        'Showing 1 to 25 of 60 entries',
      )
    })

    it('shows name, email, role, status, phone, stores, sign-in method and last login', async () => {
      renderWithProviders(<UsersPage />)
      await screen.findByText('First2 Last2')

      const table = screen.getByRole('table')
      const headers = within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent)
      expect(headers).toEqual([
        'User',
        'Role',
        'Status',
        'Phone',
        'Stores',
        'Sign-in',
        'Last Login',
        'Created',
        'Actions',
      ])

      // Administrator: every store, signs in with Google, never logged in.
      const admin = within(screen.getByText('First1 Last1').closest('tr') as HTMLElement)
      expect(admin.getByText('user1@polymer.co')).toBeInTheDocument()
      expect(admin.getByText('Administrator')).toBeInTheDocument()
      expect(admin.getByText('All stores')).toBeInTheDocument()
      expect(admin.getByText('Google')).toBeInTheDocument()
      expect(admin.getByText('Never')).toBeInTheDocument()

      // Office user: their stores by name, a phone number, a last login date.
      const office = within(screen.getByText('First2 Last2').closest('tr') as HTMLElement)
      expect(office.getByText('Office')).toBeInTheDocument()
      expect(office.getByText('Active')).toBeInTheDocument()
      expect(office.getByText('+44 20 7946 0000')).toBeInTheDocument()
      expect(await office.findByText('Polymer UK')).toBeInTheDocument()
      expect(office.getByText('Polymer EU')).toBeInTheDocument()
      expect(office.getByText('Email code')).toBeInTheDocument()
      expect(office.getByText('14 Oct 2026')).toBeInTheDocument()

      // Inactive user (#5) and a non-admin with no stores.
      const inactive = within(
        screen.getByText('First5 Last5').closest('tr') as HTMLElement,
      )
      expect(inactive.getByText('Inactive')).toBeInTheDocument()
      expect(inactive.getByText('None')).toBeInTheDocument()
    })

    it('pages with the shared pagination (and prefetch-free cache on revisit)', async () => {
      const user = userEvent.setup()
      renderWithProviders(<UsersPage />)
      await screen.findByText('First2 Last2')

      await user.click(screen.getByRole('button', { name: 'Page 2' }))

      expect(await screen.findByText('First26 Last26')).toBeInTheDocument()
      expect(list).toHaveBeenCalledWith({ page: 2, page_size: 25 })
      expect(screen.getByText(/Showing/)).toHaveTextContent(
        'Showing 26 to 50 of 60 entries',
      )

      // Back to page 1: served from the cache, no extra request.
      const before = callsForPage(1)
      await user.click(screen.getByRole('button', { name: 'Page 1' }))
      expect(screen.getByText('First2 Last2')).toBeInTheDocument()
      expect(callsForPage(1)).toBe(before)
    })

    it('changes the page size and returns to page 1', async () => {
      const user = userEvent.setup()
      renderWithProviders(<UsersPage />)
      await screen.findByText('First2 Last2')
      await user.click(screen.getByRole('button', { name: 'Page 2' }))
      await screen.findByText('First26 Last26')

      await user.selectOptions(screen.getByLabelText('Entries per page'), '10')

      await waitFor(() => expect(list).toHaveBeenCalledWith({ page: 1, page_size: 10 }))
    })

    it('searches after a short pause, returns to page 1, and recovers from an empty result', async () => {
      const user = userEvent.setup()
      renderWithProviders(<UsersPage />)
      await screen.findByText('First2 Last2')
      await user.click(screen.getByRole('button', { name: 'Page 2' }))
      await screen.findByText('First26 Last26')

      await user.type(screen.getByRole('searchbox', { name: 'Search users' }), 'nomatch')

      await waitFor(() =>
        expect(list).toHaveBeenCalledWith(
          expect.objectContaining({ search: 'nomatch', page: 1 }),
        ),
      )
      expect(await screen.findByText('No users found')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Clear all filters' }))
      expect(await screen.findByText('First2 Last2')).toBeInTheDocument()
      expect(screen.getByRole('searchbox', { name: 'Search users' })).toHaveValue('')
    })

    it('filters by role (names from the roles API) and by status, both in the Filters grid', async () => {
      const user = userEvent.setup()
      renderWithProviders(<UsersPage />)
      await screen.findByText('First2 Last2')
      await user.click(screen.getByRole('button', { name: 'Filters' }))

      const role = screen.getByLabelText('Role')
      expect(
        within(role)
          .getAllByRole('option')
          .map((option) => option.textContent),
      ).toEqual(['All Roles', 'Administrator', 'Office', 'Warehouse'])
      await user.selectOptions(role, 'warehouse')
      await waitFor(() =>
        expect(list).toHaveBeenCalledWith(
          expect.objectContaining({ role: 'warehouse', page: 1 }),
        ),
      )

      await user.selectOptions(screen.getByLabelText('User status'), 'inactive')
      await waitFor(() =>
        expect(list).toHaveBeenCalledWith(
          expect.objectContaining({ role: 'warehouse', status: 'inactive', page: 1 }),
        ),
      )
      expect(screen.getByLabelText('User status')).toHaveValue('inactive')

      // "Clear All" resets both; the default query is still cached, so it shows at once.
      await user.click(screen.getByRole('button', { name: 'Clear All' }))
      expect(screen.getByLabelText('Role')).toHaveValue('')
      expect(screen.getByLabelText('User status')).toHaveValue('')
      expect(await screen.findByText('First2 Last2')).toBeInTheDocument()
    })

    it('has no status tabs and no role dropdown outside the Filters grid', async () => {
      renderWithProviders(<UsersPage />)
      await screen.findByText('First2 Last2')

      expect(screen.queryByRole('group', { name: 'Filter by status' })).toBeNull()
      const grid = document.getElementById('user-filter-grid')!
      expect(grid).toHaveAttribute('inert')
      // Both are the first fields of the (collapsed) grid, in this order.
      const selects = [...grid.querySelectorAll('select')]
      expect(selects.map((select) => select.id)).toEqual(['filter-status', 'filter-role'])
      // The Filters button is in the search row, beside the search box.
      const search = screen.getByRole('searchbox', { name: 'Search users' })
      const filters = screen.getByRole('button', { name: 'Filters' })
      expect(search.closest('section')).toContainElement(filters)
      expect(filters.parentElement).toBe(
        screen.getByRole('button', { name: 'Clear All' }).parentElement,
      )
    })

    it('shows the backend message when loading fails, and retries', async () => {
      // The list request fails once; the tabs' count requests are unaffected.
      let failList = true
      list.mockImplementation((params) =>
        failList && !isCountQuery(params)
          ? Promise.reject(
              new ApiError('You do not have access to Users.', { status: 403 }),
            )
          : Promise.resolve(respond(params)),
      )
      const user = userEvent.setup()
      renderWithProviders(<UsersPage />)

      expect(await screen.findByText("Couldn't load users")).toBeInTheDocument()
      expect(screen.getByText('You do not have access to Users.')).toBeInTheDocument()

      failList = false
      await user.click(screen.getByRole('button', { name: 'Try again' }))
      expect(await screen.findByText('First2 Last2')).toBeInTheDocument()
    })

    it('asks for no status counts until Filters is opened, then shows one on every choice', async () => {
      list.mockImplementation((params) => {
        const byStatus = { active: 48, inactive: 12 }
        const total = params.status ? byStatus[params.status] : 60
        return Promise.resolve({ ...respond(params), total })
      })
      const user = userEvent.setup()
      renderWithProviders(<UsersPage />)
      await screen.findByText('First2 Last2')
      await new Promise((resolve) => setTimeout(resolve, 20))
      expect(list.mock.calls.some(([params]) => isCountQuery(params))).toBe(false)

      await user.click(screen.getByRole('button', { name: 'Filters' }))
      const status = screen.getByLabelText('User status')
      await within(status).findByRole('option', { name: 'All Users (60)' })
      expect(
        within(status)
          .getAllByRole('option')
          .map((option) => option.textContent),
      ).toEqual(['All Users (60)', 'Active (48)', 'Inactive (12)'])

      // The role filter narrows every choice's count (the count queries carry it).
      await user.selectOptions(screen.getByLabelText('Role'), 'warehouse')
      await waitFor(() =>
        expect(list).toHaveBeenCalledWith(
          expect.objectContaining({
            role: 'warehouse',
            status: 'inactive',
            page_size: 1,
          }),
        ),
      )
    })
  })

  describe('the figures above the list', () => {
    const card = (label: string) =>
      screen.getByText(label, { selector: 'span' }).parentElement!.parentElement!

    it('shows four cards on top: the list total and what the roles say', async () => {
      renderWithProviders(<UsersPage />)
      await screen.findByText('First2 Last2')

      // 60 matching users; roles: admin 1, office 40 + warehouse 19, three roles.
      expect(within(card('Users')).getByText('60')).toBeInTheDocument()
      await waitFor(() =>
        expect(within(card('Administrators')).getByText('1')).toBeInTheDocument(),
      )
      expect(within(card('Other staff')).getByText('59')).toBeInTheDocument()
      expect(within(card('Roles')).getByText('3')).toBeInTheDocument()
      expect(
        within(card('Administrators')).getByText('Can see every store'),
      ).toBeVisible()
    })

    it('sit above the toolbar and the table, and ask for nothing of their own', async () => {
      renderWithProviders(<UsersPage />)
      await screen.findByText('First2 Last2')
      await new Promise((resolve) => setTimeout(resolve, 20))

      const order = (element: HTMLElement) =>
        [...document.querySelectorAll('*')].indexOf(element)
      expect(order(card('Users'))).toBeLessThan(
        order(screen.getByRole('searchbox', { name: 'Search users' })),
      )
      expect(order(card('Users'))).toBeLessThan(order(screen.getByRole('table')))
      // The list once, the roles once (they feed the cards, the Role filter and the form).
      expect(list).toHaveBeenCalledTimes(1)
      expect(rolesList).toHaveBeenCalledTimes(1)
    })

    it('show dashes until their answers arrive', async () => {
      list.mockImplementation(() => new Promise<never>(() => undefined))
      rolesList.mockImplementation(() => new Promise<never>(() => undefined))
      renderWithProviders(<UsersPage />)

      await waitFor(() => expect(within(card('Users')).getByText('—')).toBeVisible())
      expect(within(card('Administrators')).getByText('—')).toBeVisible()
      expect(within(card('Roles')).getByText('—')).toBeVisible()
    })
  })

  describe('delete user', () => {
    it('asks first, and sends nothing until Delete is pressed', async () => {
      remove.mockResolvedValue({ message: '' })
      const user = userEvent.setup()
      renderWithProviders(<UsersPage />)
      await screen.findByText('First2 Last2')

      await user.click(screen.getByRole('button', { name: 'Delete First2 Last2' }))

      const dialog = await screen.findByRole('alertdialog', {
        name: 'Delete “First2 Last2”?',
      })
      expect(
        within(dialog).getByText(/will be deactivated and hidden/),
      ).toBeInTheDocument()
      expect(within(dialog).getByText(/activity history is kept/)).toBeInTheDocument()
      // Cancel is the focused (safe) choice.
      expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus()
      expect(remove).not.toHaveBeenCalled()

      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
      expect(remove).not.toHaveBeenCalled()
      expect(screen.getByText('First2 Last2')).toBeInTheDocument()
    })

    it('deletes by id, drops the row at once and says so', async () => {
      // The server forgets the user once the delete has gone through.
      let deleted = false
      list.mockImplementation((params) => {
        const response = respond(params)
        return Promise.resolve(
          deleted
            ? {
                ...response,
                items: response.items.filter((item) => item.id !== 'user-2'),
                total: response.total - 1,
              }
            : response,
        )
      })
      remove.mockImplementation(() => {
        deleted = true
        return Promise.resolve({ message: 'User deleted' })
      })
      const user = userEvent.setup()
      renderWithProviders(<UsersPage />)
      await screen.findByText('First2 Last2')

      await user.click(screen.getByRole('button', { name: 'Delete First2 Last2' }))
      const dialog = await screen.findByRole('alertdialog')
      await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

      await waitFor(() => expect(remove).toHaveBeenCalledWith('user-2'))
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
      await waitFor(() =>
        expect(screen.queryByText('First2 Last2')).not.toBeInTheDocument(),
      )
      expect(
        screen.getByText(/Deleted “First2 Last2”\. User deleted/),
      ).toBeInTheDocument()
    })

    it('keeps the dialog open with the backend’s message when the delete is refused', async () => {
      remove.mockRejectedValue(
        new ApiError('You cannot delete your own account.', { status: 400 }),
      )
      const user = userEvent.setup()
      renderWithProviders(<UsersPage />)
      await screen.findByText('First1 Last1')

      await user.click(screen.getByRole('button', { name: 'Delete First1 Last1' }))
      const dialog = await screen.findByRole('alertdialog')
      await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

      expect(
        await within(dialog).findByText('You cannot delete your own account.'),
      ).toBeInTheDocument()
      expect(screen.getByRole('alertdialog')).toBeInTheDocument()
      expect(screen.getByText('First1 Last1')).toBeInTheDocument()
    })
  })

  describe('add user', () => {
    const formOf = () => screen.findByRole('region', { name: 'Add user' })
    const openForm = async (user: ReturnType<typeof userEvent.setup>) => {
      renderPage()
      await screen.findByText('First2 Last2')
      await user.click(screen.getByRole('button', { name: 'Add user' }))
      return formOf()
    }

    it('opens in place of the list as a "New user" tab, not in a slide-over', async () => {
      const user = userEvent.setup()
      const form = await openForm(user)

      expect(screen.queryByRole('dialog')).toBeNull()
      expect(within(form).getByRole('heading', { name: 'Add user' })).toBeInTheDocument()
      // The list stays mounted but hidden; the figures give way to the form too.
      expect(
        screen.getByRole('table', { hidden: true }).closest('.hidden'),
      ).not.toBeNull()
      const strip = screen.getByRole('navigation', { name: 'Open users' })
      expect(within(strip).getByRole('button', { name: 'All Users' })).toBeVisible()
      expect(
        within(strip).getByRole('button', { name: /^User\s*New user$/ }),
      ).toHaveAttribute('aria-current', 'page')
    })

    it('opens at /users/new straight away (a reload, a link)', async () => {
      renderPage('/users/new')

      expect(await formOf()).toBeInTheDocument()
      expect(screen.getByRole('navigation', { name: 'Open users' })).toBeInTheDocument()
    })

    it('opens a form with the roles from the API, office selected, and every store to choose', async () => {
      const form = await openForm(userEvent.setup())

      expect(within(form).getByLabelText('First name')).toHaveFocus()
      const role = within(form).getByLabelText('Role')
      expect(role).toHaveValue('office')
      expect(
        within(role)
          .getAllByRole('option')
          .map((option) => option.textContent),
      ).toEqual(['Administrator', 'Office', 'Warehouse'])
      expect(await within(form).findByLabelText('Polymer UK')).not.toBeChecked()
      expect(within(form).getByLabelText('Polymer EU')).not.toBeChecked()
    })

    it('validates the required fields without calling the API', async () => {
      const user = userEvent.setup()
      const form = await openForm(user)

      await user.click(within(form).getAllByRole('button', { name: 'Create user' })[0])

      expect(within(form).getByText('Enter a first name')).toBeInTheDocument()
      expect(within(form).getByText('Enter a valid email address')).toBeInTheDocument()
      expect(create).not.toHaveBeenCalled()

      // Typing clears that field's message.
      await user.type(within(form).getByLabelText('First name'), 'Jane')
      expect(within(form).queryByText('Enter a first name')).not.toBeInTheDocument()
    })

    it('creates the user, goes back to the list, confirms, and refreshes it', async () => {
      create.mockResolvedValue({
        ...makeUser(99),
        first_name: 'Jane',
        last_name: 'Doe',
        full_name: 'Jane Doe',
        email: 'jane@company.com',
      })
      const user = userEvent.setup()
      const form = await openForm(user)
      const within_ = within(form)

      await user.type(within_.getByLabelText('First name'), '  Jane ')
      await user.type(within_.getByLabelText(/^Last name/), 'Doe')
      await user.type(within_.getByLabelText('Email address'), ' Jane@Company.com ')
      await user.type(within_.getByLabelText(/^Phone/), '80159632145')
      await user.click(await within_.findByLabelText('Polymer UK'))
      const callsBefore = list.mock.calls.length

      await user.click(within_.getAllByRole('button', { name: 'Create user' })[0])

      // Trimmed, email lower-cased, default role, only the ticked store.
      await waitFor(() =>
        expect(create).toHaveBeenCalledWith({
          first_name: 'Jane',
          last_name: 'Doe',
          email: 'jane@company.com',
          role: 'office',
          shop_keys: ['polymer-uk'],
          phone: '80159632145',
        }),
      )
      await waitFor(() =>
        expect(
          screen.queryByRole('region', { name: 'Add user' }),
        ).not.toBeInTheDocument(),
      )
      expect(screen.queryByRole('navigation', { name: 'Open users' })).toBeNull()
      expect(
        screen.getByText('Jane Doe (jane@company.com) was added. They can now sign in.'),
      ).toBeInTheDocument()
      // Every cached users query was invalidated, so the list is fetched again.
      await waitFor(() => expect(list.mock.calls.length).toBeGreaterThan(callsBefore))
    })

    it('does not ask for stores for an administrator, and sends none', async () => {
      create.mockResolvedValue(makeUser(98))
      const user = userEvent.setup()
      const form = await openForm(user)
      const within_ = within(form)
      await within_.findByLabelText('Polymer UK')
      await user.click(within_.getByLabelText('Polymer UK'))

      await user.selectOptions(within_.getByLabelText('Role'), 'admin')

      expect(within_.getByText('Administrators can see every store.')).toBeInTheDocument()
      expect(within_.queryByLabelText('Polymer UK')).not.toBeInTheDocument()

      await user.type(within_.getByLabelText('First name'), 'Ada')
      await user.type(within_.getByLabelText('Email address'), 'ada@polymer.co')
      await user.click(within_.getAllByRole('button', { name: 'Create user' })[0])

      await waitFor(() =>
        expect(create).toHaveBeenCalledWith({
          first_name: 'Ada',
          last_name: '',
          email: 'ada@polymer.co',
          role: 'admin',
          shop_keys: [],
        }),
      )
    })

    it("keeps the form open and shows the backend's message when creating fails", async () => {
      create.mockRejectedValue(
        new ApiError('A user with this email already exists.', { status: 409 }),
      )
      const user = userEvent.setup()
      const form = await openForm(user)
      const within_ = within(form)
      await user.type(within_.getByLabelText('First name'), 'Jane')
      await user.type(within_.getByLabelText('Email address'), 'jane@company.com')

      await user.click(within_.getAllByRole('button', { name: 'Create user' })[0])

      expect(
        await within_.findByText('A user with this email already exists.'),
      ).toBeInTheDocument()
      expect(screen.getByRole('region', { name: 'Add user' })).toBeInTheDocument()

      // Editing a field dismisses the stale error so the user can try again.
      await user.type(within_.getByLabelText('Email address'), 'x')
      expect(
        within_.queryByText('A user with this email already exists.'),
      ).not.toBeInTheDocument()
    })

    it('leaves at once with nothing typed, and asks first when something was', async () => {
      const user = userEvent.setup()
      const form = await openForm(user)

      // Nothing entered: Back just goes back to the list.
      await user.click(within(form).getByRole('button', { name: 'Back' }))
      expect(screen.queryByRole('region', { name: 'Add user' })).not.toBeInTheDocument()

      // Something typed: asked first; Keep editing keeps it all.
      await user.click(screen.getByRole('button', { name: 'Add user' }))
      const again = await formOf()
      await user.type(within(again).getByLabelText('First name'), 'Jane')
      await user.click(within(again).getByRole('button', { name: 'Back' }))
      const dialog = await screen.findByRole('alertdialog', { name: 'Cancel editing?' })
      await user.click(within(dialog).getByRole('button', { name: 'Keep editing' }))
      expect(within(await formOf()).getByLabelText('First name')).toHaveValue('Jane')

      // Yes, cancel: gone, and a new form starts clean.
      await user.click(within(again).getByRole('button', { name: 'Cancel' }))
      await user.click(
        within(await screen.findByRole('alertdialog')).getByRole('button', {
          name: 'Yes, cancel',
        }),
      )
      expect(screen.queryByRole('region', { name: 'Add user' })).not.toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Add user' }))
      expect(within(await formOf()).getByLabelText('First name')).toHaveValue('')
    })

    it('keeps what was typed while you look at the list, and the tab brings it back', async () => {
      const user = userEvent.setup()
      const form = await openForm(user)
      await user.type(within(form).getByLabelText('First name'), 'Jane')
      const strip = screen.getByRole('navigation', { name: 'Open users' })

      await user.click(within(strip).getByRole('button', { name: 'All Users' }))
      expect(screen.getByRole('table')).toBeVisible()
      expect(
        screen.getByRole('region', { name: 'Add user', hidden: true }),
      ).toBeInTheDocument()

      await user.click(within(strip).getByRole('button', { name: /^User\s*New user$/ }))
      expect(within(await formOf()).getByLabelText('First name')).toHaveValue('Jane')
    })

    it('closes from the tab’s ✕ (asking first when something was typed)', async () => {
      const user = userEvent.setup()
      const form = await openForm(user)
      await user.type(within(form).getByLabelText('First name'), 'Jane')

      await user.click(screen.getByRole('button', { name: 'Close New user' }))
      await user.click(
        within(await screen.findByRole('alertdialog')).getByRole('button', {
          name: 'Yes, cancel',
        }),
      )

      expect(screen.queryByRole('region', { name: 'Add user' })).not.toBeInTheDocument()
      expect(screen.queryByRole('navigation', { name: 'Open users' })).toBeNull()
    })

    it('explains when the roles cannot be loaded and lets the user retry', async () => {
      rolesList.mockRejectedValueOnce(new ApiError('Server error', { status: 500 }))
      const user = userEvent.setup()
      const form = await openForm(user)

      expect(await within(form).findByText(/Couldn't load roles/)).toBeInTheDocument()

      await user.click(within(form).getByRole('button', { name: 'Try again' }))
      expect(await within(form).findByLabelText('Role')).toHaveValue('office')
    })
  })
})
