import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../lib/api/ApiError.ts'
import {
  api,
  type AccessLock,
  type AccessLockListResponse,
  type AccessTagListResponse,
  type LockCustomersResponse,
  type CustomerListResponse,
  type ProductListResponse,
  type Shop,
} from '../../../lib/api/endpoints.ts'
import { renderWithProviders } from '../../../test/renderWithProviders.tsx'
import { LocksPage } from './LocksPage.tsx'

vi.mock('../../../lib/api/endpoints.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/api/endpoints.ts')>()),
  api: {
    access: {
      locks: vi.fn(),
      lock: vi.fn(),
      tags: vi.fn(),
      updateTags: vi.fn(),
      lockCustomers: vi.fn(),
      setLockCustomers: vi.fn(),
      check: vi.fn(),
      setup: vi.fn(),
      createTag: vi.fn(),
    },
    products: { list: vi.fn() },
    customers: { list: vi.fn() },
    shops: { list: vi.fn() },
    auth: {},
  },
}))

const SHOPS = [
  {
    id: 's1',
    key: 'polymer-uk',
    name: 'Polymer UK',
    domain: 'polymer-uk.myshopify.com',
    is_active: true,
    position: 0,
    connected: true,
    products_count: 0,
  },
] as Shop[]

function makeLock(n: number, patch: Partial<AccessLock> = {}): AccessLock {
  return {
    product_id: `prod-${n}`,
    shopify_id: n,
    title: `Locked Product ${n}`,
    handle: `locked-product-${n}`,
    status: 'ACTIVE',
    image_url: null,
    product_tags: ['vans'],
    enabled: true,
    tags: ['vans'],
    hide_from_lists: false,
    hide_from_nav: false,
    noindex: false,
    hide_from_sitemap: false,
    manual_locking: false,
    message: null,
    customers_with_access: 12 * n,
    sync_status: 'synced',
    sync_error: null,
    last_pushed_at: null,
    updated_at: '2026-10-29T09:12:38Z',
    shop: null,
    ...patch,
  }
}

function customersAnswer(
  customers: LockCustomersResponse['customers'] = [
    {
      id: 'c1',
      name: 'Ada Buyer',
      email: 'buyer@example.com',
      phone: '+44 20 7946 0000',
      company: 'Buyer Ltd',
      tags: ['vans'],
      created_at: null,
    },
    {
      id: 'c2',
      name: 'Bo Trade',
      email: 'bo@example.com',
      phone: null,
      company: null,
      tags: ['vans'],
      created_at: null,
    },
  ],
  patch: Partial<LockCustomersResponse> = {},
): LockCustomersResponse {
  return {
    message: null,
    customers,
    tags: [{ tag: 'vans', label: null, locked_products: 3 }],
    login_only: false,
    page: 1,
    page_size: 25,
    total: customers.length,
    total_pages: 1,
    has_next: false,
    ...patch,
  }
}

function locksAnswer(locks: AccessLock[]): AccessLockListResponse {
  return {
    locks,
    page: 1,
    page_size: 25,
    total: locks.length,
    total_pages: 1,
    has_next: false,
  }
}

const TAGS: AccessTagListResponse = {
  tags: [
    {
      tag: 'b2b',
      label: 'B2B trade',
      is_lock_tag: true,
      products: 0,
      locked_products: 0,
      customers: 2539,
    },
    {
      tag: 'vans',
      label: null,
      is_lock_tag: true,
      products: 45,
      locked_products: 45,
      customers: 1671,
    },
  ],
  page: 1,
  page_size: 50,
  total: 2,
  total_pages: 1,
  has_next: false,
}

const PRODUCTS = ['Alpha Box', 'Beta Bag', 'Gamma Cup'].map((title, index) => ({
  id: `p-${index + 1}`,
  title,
  handle: title.toLowerCase().replace(' ', '-'),
  status: 'ACTIVE',
  image_url: null,
}))

const CUSTOMERS = [
  { id: 'c-1', full_name: 'Jane Buyer', email: 'jane@example.com', tags: ['retail'] },
  { id: 'c-2', full_name: 'Sam Trade', email: 'sam@example.com', tags: [] },
]

const pageOf = (items: unknown[]) => ({
  items,
  page: 1,
  page_size: 25,
  total: items.length,
  total_pages: 1,
  has_next: false,
  sort: 'title',
  order: 'asc',
})

const locks = vi.mocked(api.access.locks)
const lock = vi.mocked(api.access.lock)
const tags = vi.mocked(api.access.tags)
const updateTags = vi.mocked(api.access.updateTags)
const lockCustomers = vi.mocked(api.access.lockCustomers)
const setLockCustomers = vi.mocked(api.access.setLockCustomers)
const check = vi.mocked(api.access.check)
const setup = vi.mocked(api.access.setup)
const productsList = vi.mocked(api.products.list)
const customersList = vi.mocked(api.customers.list)

/**
 * The Customer Access tab: search the store's customers, tick each one, press Check. The store's
 * customer search answers with just these people.
 */
async function pickAndCheck(
  user: ReturnType<typeof userEvent.setup>,
  people: { name: string; email: string }[],
  check = true,
) {
  customersList.mockResolvedValue(
    pageOf(
      people.map((person, index) => ({
        id: `s-${index}`,
        full_name: person.name,
        email: person.email,
        tags: [],
      })),
    ) as unknown as CustomerListResponse,
  )
  await user.type(screen.getByLabelText('Search customers to check'), people[0].email)
  for (const person of people) {
    await user.click(
      await screen.findByRole('checkbox', { name: person.name }, { timeout: 2000 }),
    )
  }
  if (check) await user.click(screen.getByRole('button', { name: 'Check' }))
}

const WRITE_OK = {
  message: 'Products: 1 updated. 1 new lock(s).',
  createdLocks: 1,
  removedLocks: 0,
  queued: 1,
}

function renderPage(route = '/locks') {
  return renderWithProviders(
    <Routes>
      <Route path="/locks/*" element={<LocksPage />} />
    </Routes>,
    { route },
  )
}

describe('LocksPage', () => {
  beforeEach(() => {
    vi.mocked(api.shops.list).mockResolvedValue(SHOPS)
    locks.mockResolvedValue(locksAnswer([makeLock(1), makeLock(2, { enabled: false })]))
    tags.mockResolvedValue(TAGS)
    lock.mockResolvedValue(WRITE_OK)
    updateTags.mockResolvedValue({ ...WRITE_OK, createdLocks: 0 })
    lockCustomers.mockResolvedValue(customersAnswer())
    setLockCustomers.mockResolvedValue({ message: 'Customers: 1 updated.', tags: [] })
    setup.mockResolvedValue('Metafield definition created. 2 lock(s) pushing to Shopify.')
    productsList.mockResolvedValue(pageOf(PRODUCTS) as unknown as ProductListResponse)
    customersList.mockResolvedValue(pageOf(CUSTOMERS) as unknown as CustomerListResponse)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('list', () => {
    it('loads the first store’s locks and shows what each one protects', async () => {
      renderPage()

      expect(await screen.findByText('Locked Product 1')).toBeInTheDocument()
      expect(locks).toHaveBeenCalledWith({
        shop: 'polymer-uk',
        sort: 'updated_at',
        page: 1,
        page_size: 25,
      })

      const headers = within(screen.getByRole('table'))
        .getAllByRole('columnheader')
        .map((header) => header.textContent)
      expect(headers).toEqual([
        'Product',
        'Keys (tags)',
        'With access',
        'Hidden from',
        'Status',
        'Shopify',
        'Updated',
        'Actions',
      ])

      const row = within(
        screen.getByText('Locked Product 1').closest('tr') as HTMLElement,
      )
      expect(row.getByText('vans')).toBeInTheDocument()
      expect(row.getByText('12')).toBeInTheDocument()
      expect(
        row.getByRole('button', { name: /^Status of .*: Enabled$/ }),
      ).toBeInTheDocument()
      expect(row.getByText('Synced')).toBeInTheDocument()
      expect(screen.getByText(/2 locked products/)).toBeInTheDocument()
    })

    it('marks a lock with manual locking on with an amber Manual tag in Status', async () => {
      locks.mockResolvedValue(
        locksAnswer([makeLock(1, { manual_locking: true }), makeLock(2)]),
      )
      renderPage()

      const first = within(
        (await screen.findByText('Locked Product 1')).closest('tr') as HTMLElement,
      )
      expect(first.getByText('Manual')).toBeInTheDocument()
      const second = within(
        screen.getByText('Locked Product 2').closest('tr') as HTMLElement,
      )
      expect(second.queryByText('Manual')).not.toBeInTheDocument()
    })

    it('lines every header up with its cells: Product on the left, every other column centred', async () => {
      renderPage()
      await screen.findByText('Locked Product 1')

      const table = screen.getByRole('table')
      const headers = within(table).getAllByRole('columnheader')
      const cells = within(
        screen.getByText('Locked Product 1').closest('tr') as HTMLElement,
      ).getAllByRole('cell')
      expect(headers).toHaveLength(cells.length)
      headers.forEach((header, index) => {
        const side = index === 0 ? 'text-left' : 'text-center'
        expect(header).toHaveClass(side)
        expect(cells[index]).toHaveClass(side)
      })
    })

    it('shows the status from the API’s enabled flag: true is Enabled, false is Disabled', async () => {
      locks.mockResolvedValue(
        locksAnswer([makeLock(1, { enabled: true }), makeLock(2, { enabled: false })]),
      )
      renderPage()
      await screen.findByText('Locked Product 1')

      expect(
        screen
          .getAllByRole('button', { name: /^Status of Locked Product/ })
          .map((button) => button.getAttribute('aria-label')),
      ).toEqual([
        'Status of Locked Product 1: Enabled',
        'Status of Locked Product 2: Disabled',
      ])
      // The product's own status (Active / Draft / Archived) is not what the column shows.
      expect(screen.queryByText(/^(Draft|Archived)$/)).toBeNull()
    })

    it('the status is a dropdown: choose, confirm, and the row changes at once', async () => {
      const user = userEvent.setup()
      renderPage()
      await user.click(
        await screen.findByRole('button', {
          name: 'Status of Locked Product 2: Disabled',
        }),
      )
      const menu = await screen.findByRole('listbox', {
        name: 'Status of Locked Product 2',
      })
      expect(
        within(menu)
          .getAllByRole('option')
          .map((option) => option.textContent),
      ).toEqual(['Enabled', 'Disabled'])
      await user.click(within(menu).getByRole('option', { name: 'Enabled' }))

      // Nothing is sent until "Yes, update"; the question says what changes.
      const dialog = await screen.findByRole('alertdialog')
      expect(lock).not.toHaveBeenCalled()
      expect(within(dialog).getByText('Status')).toBeInTheDocument()
      expect(within(dialog).getByText('Disabled')).toBeInTheDocument()
      lock.mockImplementation(async () => {
        locks.mockResolvedValue(
          locksAnswer([makeLock(1), makeLock(2, { enabled: true })]),
        )
        return { ...WRITE_OK, createdLocks: 0, message: 'Products: 1 updated.' }
      })
      await user.click(within(dialog).getByRole('button', { name: 'Yes, update' }))

      await waitFor(() =>
        expect(lock).toHaveBeenCalledWith({
          shop: 'polymer-uk',
          products: ['locked-product-2'],
          tags: ['vans'],
          enabled: true,
        }),
      )
      expect(
        await screen.findByRole('button', {
          name: 'Status of Locked Product 2: Enabled',
        }),
      ).toBeInTheDocument()
    })

    it('sends nothing on Cancel, and puts the old status back when the backend refuses', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('Locked Product 1')
      const pick = async (name: string) => {
        await user.click(
          screen.getByRole('button', { name: 'Status of Locked Product 1: Enabled' }),
        )
        await user.click(
          within(screen.getByRole('listbox')).getByRole('option', { name }),
        )
      }

      await pick('Disabled')
      await user.click(
        within(await screen.findByRole('alertdialog')).getByRole('button', {
          name: 'Cancel',
        }),
      )
      expect(screen.queryByRole('alertdialog')).toBeNull()
      expect(lock).not.toHaveBeenCalled()

      lock.mockRejectedValueOnce(new ApiError('Shop is read only', { status: 403 }))
      await pick('Disabled')
      const dialog = await screen.findByRole('alertdialog')
      await user.click(within(dialog).getByRole('button', { name: 'Yes, update' }))
      expect(await within(dialog).findByText('Shop is read only')).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Status of Locked Product 1: Enabled' }),
      ).toBeInTheDocument()
    })

    it('asks for no tags and no products until they are needed', async () => {
      renderPage()
      await screen.findByText('Locked Product 1')

      expect(tags).not.toHaveBeenCalled()
      expect(productsList).not.toHaveBeenCalled()
      expect(customersList).not.toHaveBeenCalled()
    })

    it('narrows by status once the Filters grid is open, and the tag choices load then', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('Locked Product 1')

      await user.click(screen.getByRole('button', { name: /Filters/ }))
      await waitFor(() =>
        expect(tags).toHaveBeenCalledWith(
          expect.objectContaining({ shop: 'polymer-uk', lock_only: true }),
        ),
      )
      await user.selectOptions(screen.getByLabelText('Status'), 'Enabled')

      await waitFor(() =>
        expect(locks).toHaveBeenLastCalledWith(
          expect.objectContaining({ shop: 'polymer-uk', enabled: true, page: 1 }),
        ),
      )
    })

    it('shows the backend’s message when the list cannot load, and tries again', async () => {
      const user = userEvent.setup()
      locks.mockRejectedValueOnce(new ApiError('No right to see locks', { status: 403 }))
      renderPage()

      expect(await screen.findByText('No right to see locks')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Try again' }))
      expect(await screen.findByText('Locked Product 1')).toBeInTheDocument()
    })

    it('sets the store up after a confirmation, and says what the backend answered', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('Locked Product 1')

      await user.click(screen.getByRole('button', { name: 'Set up store' }))
      expect(setup).not.toHaveBeenCalled()
      await user.click(screen.getByRole('button', { name: 'Yes, set up' }))

      await waitFor(() => expect(setup).toHaveBeenCalledWith('polymer-uk'))
      expect(
        await screen.findByText(
          'Metafield definition created. 2 lock(s) pushing to Shopify.',
        ),
      ).toBeInTheDocument()
    })
  })

  describe('Add lock', () => {
    async function openForm() {
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('Locked Product 1')
      await user.click(screen.getByRole('button', { name: 'Add lock' }))
      await screen.findByRole('heading', { name: 'Add lock' })
      return user
    }

    it('lists every product, the store’s tags and the customers from the API', async () => {
      await openForm()

      expect(await screen.findByLabelText('Alpha Box')).toBeInTheDocument()
      expect(screen.getByLabelText('Gamma Cup')).toBeInTheDocument()
      expect(productsList).toHaveBeenCalledWith(
        expect.objectContaining({
          shop: 'polymer-uk',
          sort: 'title',
          order: 'asc',
          page: 1,
        }),
      )
      expect(await screen.findByLabelText('b2b')).toBeInTheDocument()
      expect(screen.getByText('2,539 customers', { exact: false })).toBeInTheDocument()
      expect(await screen.findByLabelText('Jane Buyer')).toBeInTheDocument()
      expect(customersList).toHaveBeenCalledWith(
        expect.objectContaining({ shop: 'polymer-uk', role: 'all' }),
      )
    })

    it('selects every product shown with one box and sends one lock call for it all', async () => {
      const user = await openForm()
      await screen.findByLabelText('Alpha Box')

      await user.click(screen.getByLabelText(/Select all shown \(3\)/))
      expect(screen.getByText('3 products selected')).toBeInTheDocument()

      await user.click(await screen.findByLabelText('b2b'))
      await user.click(await screen.findByLabelText('Jane Buyer'))
      await user.click(screen.getByLabelText(/Hide from lists/))
      await user.click(screen.getAllByRole('button', { name: 'Create lock' })[0])

      // Nothing is sent until the confirmation.
      expect(lock).not.toHaveBeenCalled()
      await user.click(await screen.findByRole('button', { name: 'Yes, create lock' }))

      await waitFor(() =>
        expect(lock).toHaveBeenCalledWith({
          shop: 'polymer-uk',
          products: ['p-1', 'p-2', 'p-3'],
          customers: ['c-1'],
          tags: ['b2b'],
          enabled: true,
          hide_from_lists: true,
          hide_from_nav: false,
          noindex: false,
          hide_from_sitemap: false,
          manual_locking: false,
        }),
      )
      // Back on the list, with what the backend said.
      expect(await screen.findByText(WRITE_OK.message)).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Add lock' })).not.toBeInTheDocument()
    })

    it('starts with manual locking off, and explains it', async () => {
      await openForm()
      const box = await screen.findByLabelText(/Enable manual locking/)
      expect(box).not.toBeChecked()
      expect(
        screen.getByText(
          'Manual locking: the website shows the product to everyone and leaves the lock to custom theme code. Keep this off unless a theme developer asks for it.',
        ),
      ).toBeInTheDocument()
    })

    it('adds a tag that does not exist yet by typing it', async () => {
      const user = await openForm()
      await screen.findByLabelText('Alpha Box')

      await user.click(screen.getByLabelText('Alpha Box'))
      await user.type(screen.getByLabelText('Search or add a tag'), 'brand-new{Enter}')
      expect(
        within(screen.getByRole('list', { name: 'Chosen tags' })).getByText('brand-new'),
      ).toBeInTheDocument()

      await user.click(screen.getAllByRole('button', { name: 'Create lock' })[0])
      await user.click(await screen.findByRole('button', { name: 'Yes, create lock' }))

      await waitFor(() =>
        expect(lock).toHaveBeenCalledWith(
          expect.objectContaining({ products: ['p-1'], tags: ['brand-new'] }),
        ),
      )
    })

    it('does not send customers without a tag, and says why', async () => {
      const user = await openForm()
      await user.click(await screen.findByLabelText('Sam Trade'))

      await user.click(screen.getAllByRole('button', { name: 'Create lock' })[0])

      expect(
        await screen.findByText(/Customers need at least one tag/),
      ).toBeInTheDocument()
      expect(lock).not.toHaveBeenCalled()
      expect(
        screen.queryByRole('button', { name: 'Yes, create lock' }),
      ).not.toBeInTheDocument()
    })

    it('does not send an empty form', async () => {
      const user = await openForm()

      await user.click(screen.getAllByRole('button', { name: 'Create lock' })[0])

      expect(
        await screen.findByText('Choose at least one product or customer.'),
      ).toBeInTheDocument()
      expect(lock).not.toHaveBeenCalled()
    })

    it('keeps the form open and shows the backend’s message when it refuses', async () => {
      const user = await openForm()
      lock.mockRejectedValueOnce(new ApiError('Unknown product', { status: 422 }))
      await user.click(await screen.findByLabelText('Alpha Box'))

      await user.click(screen.getAllByRole('button', { name: 'Create lock' })[0])
      await user.click(await screen.findByRole('button', { name: 'Yes, create lock' }))

      const dialog = await screen.findByRole('alertdialog')
      expect(await within(dialog).findByText('Unknown product')).toBeInTheDocument()
      // Still there, with the choice kept.
      expect(screen.getByRole('heading', { name: 'Add lock' })).toBeInTheDocument()
      expect(screen.getByText('1 product selected')).toBeInTheDocument()
    })

    it('asks before throwing away what was entered', async () => {
      const user = await openForm()
      await user.click(await screen.findByLabelText('Alpha Box'))

      await user.click(screen.getByRole('button', { name: /Back to list/ }))
      await user.click(await screen.findByRole('button', { name: 'Yes, cancel' }))

      expect(await screen.findByText('Locked Product 1')).toBeInTheDocument()
    })
  })

  describe('one lock', () => {
    async function openLock() {
      const user = userEvent.setup()
      renderPage()
      await user.click(
        await screen.findByRole('button', { name: 'View lock on Locked Product 1' }),
      )
      await screen.findByRole('heading', { name: 'Locked Product 1' })
      return user
    }

    const tab = async (user: ReturnType<typeof userEvent.setup>, name: string) =>
      user.click(screen.getByRole('tab', { name }))

    it('opens like a product page: a header, tabs, and cards (keys and access have a pencil)', async () => {
      const user = await openLock()

      expect(screen.getByRole('tablist', { name: 'Lock sections' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Back to list' })).toBeInTheDocument()
      // Like a product's header: the figures beside the name.
      expect(screen.getByText('with access')).toBeInTheDocument()
      expect(screen.getByText(/^keys?$/)).toBeInTheDocument()
      // Like a product's Overview: the big picture links to the product page.
      expect(screen.getByRole('link', { name: 'View product' })).toHaveAttribute(
        'href',
        expect.stringMatching(/^\/products\//),
      )
      // The keys are chips with a pencil: no add box and no Save until the pencil is used.
      expect(
        within(screen.getByRole('list', { name: 'Keys' })).getByText('vans'),
      ).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Edit keys' })).toBeInTheDocument()
      // Who has access is under Check access; the Overview has no customer or message card.
      expect(screen.queryByRole('tab', { name: 'Customers' })).not.toBeInTheDocument()
      expect(screen.queryByText('Customer access')).not.toBeInTheDocument()
      expect(screen.queryByText('Message')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Search or add a tag')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^Save/ })).not.toBeInTheDocument()

      // Nor on the Settings tab: the values are shown, with no switch or box to change.
      await tab(user, 'Settings')
      expect(screen.getByText('Hidden from navigation menus')).toBeInTheDocument()
      expect(screen.queryByRole('switch')).not.toBeInTheDocument()
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^Edit / })).not.toBeInTheDocument()
    })

    describe('changing settings with POST /access/locks', () => {
      /** What the store will answer once the change is confirmed. */
      const willHold = (patch: Partial<AccessLock>, n = 1) =>
        lock.mockImplementation(async () => {
          locks.mockResolvedValue(
            locksAnswer([makeLock(n, patch), makeLock(2, { enabled: false })]),
          )
          return { ...WRITE_OK, createdLocks: 0, message: 'Products: 1 updated.' }
        })

      it('a setting is double-clicked into a Yes / No dropdown, then confirmed', async () => {
        const user = await openLock()
        await tab(user, 'Settings')

        // A single click only shows the value; the double-click opens the choice.
        const value = screen.getByRole('button', { name: 'Hidden from lists: No' })
        expect(screen.queryByRole('combobox')).toBeNull()
        await user.dblClick(value)
        await user.selectOptions(
          screen.getByRole('combobox', { name: 'Hidden from lists' }),
          'Yes',
        )

        const dialog = await screen.findByRole('alertdialog')
        expect(lock).not.toHaveBeenCalled()
        expect(within(dialog).getByText('Hidden from lists')).toBeInTheDocument()
        willHold({ hide_from_lists: true })
        await user.click(within(dialog).getByRole('button', { name: 'Yes, update' }))

        await waitFor(() =>
          expect(lock).toHaveBeenCalledWith({
            shop: 'polymer-uk',
            products: ['locked-product-1'],
            tags: ['vans'],
            hide_from_lists: true,
          }),
        )
        expect(
          await screen.findByRole('button', { name: 'Hidden from lists: Yes' }),
        ).toBeInTheDocument()
      })

      it('Status is Enabled / Disabled, and Escape leaves the value as it was', async () => {
        const user = await openLock()
        await tab(user, 'Settings')

        await user.dblClick(screen.getByRole('button', { name: 'Status: Enabled' }))
        expect(
          within(screen.getByRole('combobox', { name: 'Status' }))
            .getAllByRole('option')
            .map((option) => option.textContent),
        ).toEqual(['Enabled', 'Disabled'])
        await user.keyboard('{Escape}')

        expect(
          screen.getByRole('button', { name: 'Status: Enabled' }),
        ).toBeInTheDocument()
        expect(lock).not.toHaveBeenCalled()
      })

      it('the advanced settings change the same way', async () => {
        const user = await openLock()
        await tab(user, 'Settings')
        await user.click(screen.getByRole('button', { name: /^Advanced settings/ }))

        await user.dblClick(
          await screen.findByRole('button', { name: 'Manual locking: No' }),
        )
        await user.selectOptions(
          screen.getByRole('combobox', { name: 'Manual locking' }),
          'Yes',
        )
        await user.click(
          within(await screen.findByRole('alertdialog')).getByRole('button', {
            name: 'Yes, update',
          }),
        )

        await waitFor(() =>
          expect(lock).toHaveBeenCalledWith({
            shop: 'polymer-uk',
            products: ['locked-product-1'],
            tags: ['vans'],
            manual_locking: true,
          }),
        )
      })
    })

    describe('editing with PUT /access/tags', () => {
      it('changes the keys of the product: Save asks first, then sends tags_add and tags_remove', async () => {
        const user = await openLock()
        await user.click(screen.getByRole('button', { name: 'Edit keys' }))
        await user.click(await screen.findByRole('button', { name: 'Remove tag vans' }))
        await user.type(screen.getByLabelText('Search or add a tag'), 'blue{Enter}')
        // Shopify will hold the new keys once the change is confirmed.
        updateTags.mockImplementation(async () => {
          locks.mockResolvedValue(locksAnswer([makeLock(1, { tags: ['blue'] })]))
          return { ...WRITE_OK, createdLocks: 0, message: 'Products: 1 updated.' }
        })

        await user.click(screen.getByRole('button', { name: 'Save keys' }))
        const dialog = await screen.findByRole('alertdialog')
        expect(updateTags).not.toHaveBeenCalled()
        expect(within(dialog).getByText('Keys to add')).toBeInTheDocument()
        expect(within(dialog).getByText('Keys to remove')).toBeInTheDocument()
        await user.click(within(dialog).getByRole('button', { name: 'Yes, update' }))

        await waitFor(() =>
          expect(updateTags).toHaveBeenCalledWith({
            shop: 'polymer-uk',
            products: ['locked-product-1'],
            tags_add: ['blue'],
            tags_remove: ['vans'],
          }),
        )
        const keys = await screen.findByRole('list', { name: 'Keys' })
        expect(within(keys).getByText('blue')).toBeInTheDocument()
        expect(within(keys).queryByText('vans')).toBeNull()
        expect(screen.getByText('Products: 1 updated.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Edit keys' })).toBeInTheDocument()
      })

      it('sends nothing when the keys are discarded, or when nothing changed', async () => {
        const user = await openLock()
        await user.click(screen.getByRole('button', { name: 'Edit keys' }))
        await user.click(await screen.findByRole('button', { name: 'Remove tag vans' }))
        await user.click(screen.getByRole('button', { name: 'Discard keys' }))
        expect(
          within(screen.getByRole('list', { name: 'Keys' })).getByText('vans'),
        ).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Edit keys' }))
        expect(screen.getByRole('button', { name: 'Save keys' })).toBeDisabled()
        expect(updateTags).not.toHaveBeenCalled()
      })

      it("keeps the question open with the backend's message when the change is refused", async () => {
        const user = await openLock()
        await user.click(screen.getByRole('button', { name: 'Edit keys' }))
        await user.type(
          await screen.findByLabelText('Search or add a tag'),
          'blue{Enter}',
        )
        updateTags.mockRejectedValue(new ApiError('Tag not allowed', { status: 422 }))

        await user.click(screen.getByRole('button', { name: 'Save keys' }))
        await user.click(
          within(await screen.findByRole('alertdialog')).getByRole('button', {
            name: 'Yes, update',
          }),
        )

        expect(await screen.findByText('Tag not allowed')).toBeInTheDocument()
        expect(screen.getByRole('alertdialog')).toBeInTheDocument()
      })
    })

    describe('Check access: the customer list and checking, adding, editing (GET / PUT /access/locks/{product}/customers)', () => {
      const ADA = customersAnswer().customers[0]
      const allowed = (message = 'Allowed: customer tag vans matches') => ({
        allowed: true,
        reason: 'tag_match',
        matched_tags: ['vans'],
        customer_tags: ['vans'],
        theme_enforces: true,
        message,
      })
      const denied = {
        allowed: false,
        reason: 'no_matching_tag',
        matched_tags: [],
        customer_tags: [],
        theme_enforces: true,
        message: 'Denied: the customer has none of vans.',
      }
      const openAccess = async () => {
        const user = await openLock()
        await tab(user, 'Customer Access')
        await screen.findByText('Ada Buyer')
        return user
      }
      const check_ = (
        user: ReturnType<typeof userEvent.setup>,
        email: string,
        name = 'Ada Buyer',
      ) => pickAndCheck(user, [{ name, email }])

      it('has no Customers tab: the list is under Check access, asked for only when it is opened', async () => {
        const user = await openLock()
        expect(screen.queryByRole('tab', { name: 'Customers' })).toBeNull()
        expect(lockCustomers).not.toHaveBeenCalled()

        await tab(user, 'Customer Access')
        expect(await screen.findByText('Ada Buyer')).toBeInTheDocument()
        expect(lockCustomers).toHaveBeenCalledWith('locked-product-1', {
          shop: 'polymer-uk',
          sort: 'name',
          page: 1,
          page_size: 25,
        })

        // A customer search like Add lock's, listing nothing (and asking nothing) until something
        // is typed, a Check button (off until a customer is ticked) and Add New Customer.
        expect(screen.getByLabelText('Search customers to check')).toBeInTheDocument()
        expect(screen.queryByRole('list', { name: 'Customers to check' })).toBeNull()
        expect(customersList).not.toHaveBeenCalled()
        expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled()
        expect(screen.queryByText(/Would a customer see this product/)).toBeNull()
        expect(
          screen.getByRole('button', { name: 'Add New Customer' }),
        ).toBeInTheDocument()
        const headers = within(screen.getByRole('table'))
          .getAllByRole('columnheader')
          .map((header) => header.textContent)
        expect(headers).toEqual(['Name', 'Email', 'Phone', 'Company', 'Tags', 'Actions'])
        const row = within(screen.getByText('Ada Buyer').closest('tr') as HTMLElement)
        expect(row.getByText('buyer@example.com')).toBeInTheDocument()
        expect(row.getByText('+44 20 7946 0000')).toBeInTheDocument()
        expect(row.getByText('Buyer Ltd')).toBeInTheDocument()
        expect(row.getByText('vans')).toHaveAttribute(
          'title',
          'Shared by 3 locked products',
        )
      })

      it('Check shows Allowed and highlights the customer in the list', async () => {
        check.mockResolvedValue(allowed())
        const user = await openAccess()

        await check_(user, 'buyer@example.com')

        await waitFor(() =>
          expect(check).toHaveBeenCalledWith({
            shop: 'polymer-uk',
            customer: 'buyer@example.com',
            product: 'prod-1',
          }),
        )
        const results = await screen.findByRole('list', { name: 'Access check results' })
        expect(within(results).getByText('Allowed')).toBeInTheDocument()
        expect(
          within(results).getByText('Allowed: customer tag vans matches'),
        ).toBeInTheDocument()
        // The customer's row in the list below is highlighted.
        const row = screen.getByText('Bo Trade').closest('tbody') as HTMLElement
        const ada = within(row).getByText('Ada Buyer').closest('tr') as HTMLElement
        await waitFor(() => expect(ada).toHaveAttribute('aria-current', 'true'))
        expect(within(ada).getByText('Checked')).toBeInTheDocument()
        // Allowed: it can be removed from here, not given again.
        expect(
          within(results).queryByRole('button', { name: 'Give access to Ada Buyer' }),
        ).toBeNull()
        expect(
          within(results).getByRole('button', { name: 'Remove access of Ada Buyer' }),
        ).toBeInTheDocument()
      })

      it('checks several customers at once, each with its own answer', async () => {
        check.mockImplementation(async ({ customer }) =>
          customer === 'buyer@example.com' ? allowed() : denied,
        )
        const user = await openAccess()

        await pickAndCheck(user, [
          { name: 'Ada Buyer', email: 'buyer@example.com' },
          { name: 'New Person', email: 'new@example.com' },
        ])

        // Both stay ticked, as chips that can be taken away.
        const chips = screen.getByRole('list', { name: 'Selected customers' })
        expect(within(chips).getAllByRole('listitem')).toHaveLength(2)
        await waitFor(() => expect(check).toHaveBeenCalledTimes(2))
        const results = await screen.findByRole('list', { name: 'Access check results' })
        const items = within(results).getAllByRole('listitem')
        expect(items).toHaveLength(2)
        expect(items[0]).toHaveTextContent('Allowed')
        expect(items[0]).toHaveTextContent('Ada Buyer')
        expect(items[1]).toHaveTextContent('Not allowed')
        expect(items[1]).toHaveTextContent('New Person')
        expect(
          within(items[1]).getByRole('button', { name: 'Give access to New Person' }),
        ).toBeInTheDocument()

        // Changing the choice clears the answers.
        await user.click(within(chips).getByRole('button', { name: 'Remove New Person' }))
        expect(screen.queryByRole('list', { name: 'Access check results' })).toBeNull()
      })

      it('a customer who is not in the list is given access straight from the check, with no window', async () => {
        check.mockResolvedValue(denied)
        const user = await openAccess()

        await check_(user, 'new@example.com', 'New Person')
        expect(await screen.findByText('Not allowed')).toBeInTheDocument()
        await user.click(
          await screen.findByRole('button', { name: 'Give access to New Person' }),
        )

        await waitFor(() =>
          expect(setLockCustomers).toHaveBeenCalledWith('locked-product-1', {
            shop: 'polymer-uk',
            add: ['new@example.com'],
          }),
        )
        expect(screen.queryByRole('alertdialog')).toBeNull()
        expect(await screen.findByText('Customers: 1 updated.')).toBeInTheDocument()
      })

      it('shows the API’s error when the customer already has the access', async () => {
        setLockCustomers.mockRejectedValue(
          new ApiError('buyer@example.com already has this access', { status: 422 }),
        )
        const user = await openAccess()

        await pickAndCheck(
          user,
          [{ name: 'Ada Buyer', email: 'buyer@example.com' }],
          false,
        )
        await user.click(screen.getByRole('button', { name: 'Add New Customer' }))

        expect(
          await screen.findByText('buyer@example.com already has this access'),
        ).toBeInTheDocument()
        expect(screen.queryByRole('alertdialog')).toBeNull()
      })

      it('Add New Customer adds the ticked customers at once, with no window; it is off until one is ticked', async () => {
        const user = await openAccess()
        const add = screen.getByRole('button', { name: 'Add New Customer' })
        expect(add).toBeDisabled()

        await pickAndCheck(
          user,
          [
            { name: 'New Person', email: 'new@example.com' },
            { name: 'Other Person', email: 'other@example.com' },
          ],
          false,
        )
        expect(setLockCustomers).not.toHaveBeenCalled()
        await user.click(add)

        await waitFor(() =>
          expect(setLockCustomers).toHaveBeenCalledWith('locked-product-1', {
            shop: 'polymer-uk',
            add: ['new@example.com', 'other@example.com'],
          }),
        )
        expect(screen.queryByRole('alertdialog')).toBeNull()
      })

      it('a lock with several tags gives its first one', async () => {
        locks.mockResolvedValue(locksAnswer([makeLock(1, { tags: ['vans', 'b2b'] })]))
        const user = await openAccess()
        await pickAndCheck(
          user,
          [{ name: 'New Person', email: 'new@example.com' }],
          false,
        )
        await user.click(screen.getByRole('button', { name: 'Add New Customer' }))

        await waitFor(() =>
          expect(setLockCustomers).toHaveBeenCalledWith('locked-product-1', {
            shop: 'polymer-uk',
            add: ['new@example.com'],
            tag: 'vans',
          }),
        )
      })

      it('Edit gives an existing customer another of the lock’s keys', async () => {
        locks.mockResolvedValue(locksAnswer([makeLock(1, { tags: ['vans', 'b2b'] })]))
        const user = await openAccess()
        // Bo Trade holds only “vans”: Edit is offered; with every key held it would not be.
        await user.click(screen.getByRole('button', { name: 'Edit access of Ada Buyer' }))
        const dialog = await screen.findByRole('alertdialog')

        expect(within(dialog).getByText('Edit access of Ada Buyer')).toBeInTheDocument()
        // Only the key she does not hold yet can be given.
        expect(
          within(within(dialog).getByLabelText('Tag to give'))
            .getAllByRole('option')
            .map((option) => option.textContent),
        ).toEqual(['b2b'])
        await user.click(within(dialog).getByRole('button', { name: 'Give access' }))

        await waitFor(() =>
          expect(setLockCustomers).toHaveBeenCalledWith('locked-product-1', {
            shop: 'polymer-uk',
            add: ['buyer@example.com'],
            tag: 'b2b',
          }),
        )
      })

      it('offers no Edit when the lock has one key (there is nothing more to give)', async () => {
        await openAccess()
        expect(screen.queryByRole('button', { name: /^Edit access of/ })).toBeNull()
      })

      it('has no search box; it filters by one of the lock’s tags and sorts — all by the API', async () => {
        locks.mockResolvedValue(locksAnswer([makeLock(1, { tags: ['vans', 'b2b'] })]))
        const user = await openAccess()

        expect(screen.queryByLabelText('Search customers')).toBeNull()
        await user.selectOptions(screen.getByLabelText('Tag'), 'b2b')
        await user.selectOptions(screen.getByLabelText('Sort by'), 'Newest')
        await waitFor(() =>
          expect(lockCustomers).toHaveBeenLastCalledWith('locked-product-1', {
            shop: 'polymer-uk',
            tag: 'b2b',
            sort: 'newest',
            page: 1,
            page_size: 25,
          }),
        )
      })

      it('says so when nobody can see the product yet', async () => {
        lockCustomers.mockResolvedValue(customersAnswer([]))
        const user = await openLock()
        await tab(user, 'Customer Access')
        expect(
          await screen.findByText('No customer can see this product yet.'),
        ).toBeInTheDocument()
      })

      it('removes a customer’s access from the row: asks first, sends remove, the row goes at once', async () => {
        const user = await openAccess()
        await user.click(
          screen.getByRole('button', { name: 'Remove access of Ada Buyer' }),
        )
        const dialog = await screen.findByRole('alertdialog')
        expect(setLockCustomers).not.toHaveBeenCalled()
        expect(
          within(dialog).getByText('Remove access of Ada Buyer?'),
        ).toBeInTheDocument()
        expect(within(dialog).getByRole('note')).toHaveTextContent('Tags are shared')
        // What the store will answer once it is done.
        setLockCustomers.mockImplementation(async () => {
          lockCustomers.mockResolvedValue(
            customersAnswer([customersAnswer().customers[1]]),
          )
          return { message: 'Customers: 1 removed.', tags: [] }
        })
        await user.click(within(dialog).getByRole('button', { name: 'Remove access' }))

        await waitFor(() =>
          expect(setLockCustomers).toHaveBeenCalledWith('locked-product-1', {
            shop: 'polymer-uk',
            remove: ['buyer@example.com'],
          }),
        )
        await waitFor(() => expect(screen.queryByText('Ada Buyer')).toBeNull())
        expect(screen.getByText('Bo Trade')).toBeInTheDocument()
        expect(await screen.findByText('Customers: 1 removed.')).toBeInTheDocument()
      })

      it('sends nothing when the removal is cancelled', async () => {
        const user = await openAccess()
        await user.click(
          screen.getByRole('button', { name: 'Remove access of Bo Trade' }),
        )
        await user.click(
          within(await screen.findByRole('alertdialog')).getByRole('button', {
            name: 'Cancel',
          }),
        )

        expect(setLockCustomers).not.toHaveBeenCalled()
        expect(screen.getByText('Bo Trade')).toBeInTheDocument()
      })

      it('a login-only lock (no keys) lists every customer and has no row actions', async () => {
        locks.mockResolvedValue(locksAnswer([makeLock(1, { tags: [] })]))
        lockCustomers.mockResolvedValue(
          customersAnswer(undefined, { login_only: true, tags: [] }),
        )
        const user = await openLock()
        await tab(user, 'Customer Access')
        await screen.findByText('Ada Buyer')

        expect(
          screen.getByText(/every customer with an account can see the product/),
        ).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /^Remove access of/ })).toBeNull()
        expect(screen.queryByLabelText('Tag')).toBeNull()
        expect(ADA.email).toBe('buyer@example.com')
      })
    })

    it('keeps a strip of opened locks, as the products page does', async () => {
      const user = await openLock()
      const strip = screen.getByRole('navigation', { name: 'Open locks' })
      expect(within(strip).getByText('Locked Product 1')).toBeInTheDocument()

      // "All Locks" goes back to the list; the tab stays and brings the lock back.
      await user.click(within(strip).getByRole('button', { name: 'All Locks' }))
      expect(
        await screen.findByRole('button', { name: 'View lock on Locked Product 1' }),
      ).toBeInTheDocument()
      await user.click(
        within(screen.getByRole('navigation', { name: 'Open locks' })).getByText(
          'Locked Product 1',
        ),
      )
      expect(
        await screen.findByRole('heading', { name: 'Locked Product 1' }),
      ).toBeInTheDocument()

      // Its ✕ closes it and returns to the list; with no tab left the strip goes.
      await user.click(screen.getByRole('button', { name: 'Close Locked Product 1' }))
      expect(
        await screen.findByRole('button', { name: 'View lock on Locked Product 1' }),
      ).toBeInTheDocument()
      expect(screen.queryByRole('navigation', { name: 'Open locks' })).toBeNull()
    })

    it('never writes: opening a lock sends no lock or tag update', async () => {
      const user = await openLock()
      await tab(user, 'Settings')
      await tab(user, 'Customer Access')

      expect(lock).not.toHaveBeenCalled()
      expect(updateTags).not.toHaveBeenCalled()
    })

    it('tells whether a customer would see the product', async () => {
      const user = await openLock()
      await tab(user, 'Customer Access')
      check.mockResolvedValue({
        allowed: false,
        reason: 'no_matching_tag',
        matched_tags: [],
        customer_tags: ['retail'],
        theme_enforces: true,
        message: 'Denied: the customer has none of vans.',
      })

      // Nothing is asked before Check is pressed.
      expect(check).not.toHaveBeenCalled()
      await pickAndCheck(user, [{ name: 'Jane Buyer', email: 'jane@example.com' }])

      await waitFor(() =>
        expect(check).toHaveBeenCalledWith({
          shop: 'polymer-uk',
          customer: 'jane@example.com',
          product: 'prod-1',
        }),
      )
      expect(check).toHaveBeenCalledTimes(1)
      expect(await screen.findByText('Not allowed')).toBeInTheDocument()
      // The backend's own explanation, as it sent it.
      expect(
        screen.getByText('Denied: the customer has none of vans.'),
      ).toBeInTheDocument()
      // The website enforces this lock: no warning.
      expect(screen.queryByText(/Manual locking is on/)).not.toBeInTheDocument()
    })

    it('searches the store’s customers only once something is typed', async () => {
      const user = await openLock()
      await tab(user, 'Customer Access')
      expect(customersList).not.toHaveBeenCalled()

      await user.type(screen.getByLabelText('Search customers to check'), 'jane')
      await waitFor(() =>
        expect(customersList).toHaveBeenCalledWith(
          expect.objectContaining({ shop: 'polymer-uk', role: 'all', search: 'jane' }),
        ),
      )
      const list = await screen.findByRole('list', { name: 'Customers to check' })
      expect(within(list).getByText('Jane Buyer')).toBeInTheDocument()

      // Clearing the search puts the list away again.
      await user.click(screen.getByRole('button', { name: 'Clear search' }))
      await waitFor(() =>
        expect(screen.queryByRole('list', { name: 'Customers to check' })).toBeNull(),
      )
    })

    it('warns when the website does not enforce the lock, and opens its settings', async () => {
      const user = await openLock()
      await tab(user, 'Customer Access')
      check.mockResolvedValue({
        allowed: false,
        reason: 'no_matching_tag',
        matched_tags: [],
        customer_tags: ['test'],
        theme_enforces: false,
        message:
          'Denied: the customer has none of vans. But Manual locking is on for this product, so the theme shows it to everyone',
      })

      await pickAndCheck(user, [{ name: 'Jane Buyer', email: 'jane@example.com' }])

      const warning = await screen.findByRole('alert')
      expect(warning).toHaveTextContent(
        'Manual locking is on for this product, so the website shows it to everyone. Switch Manual locking off to enforce the lock.',
      )
      await user.click(
        within(warning).getByRole('button', { name: 'Open lock settings' }),
      )

      // The Settings tab, with the advanced card (where manual locking is) open.
      expect(screen.getByRole('tab', { name: 'Settings' })).toHaveAttribute(
        'aria-selected',
        'true',
      )
      expect(screen.getByText('Manual locking')).toBeInTheDocument()
    })

    it('finds a lock opened from a bare address by its handle', async () => {
      locks.mockImplementation((params) =>
        Promise.resolve(
          locksAnswer(
            params.search === 'locked-product-2' ? [makeLock(2, { enabled: false })] : [],
          ),
        ),
      )
      renderPage('/locks/locked-product-2')

      expect(
        await screen.findByRole('heading', { name: 'Locked Product 2' }),
      ).toBeInTheDocument()
      expect(locks).toHaveBeenCalledWith(
        expect.objectContaining({ shop: 'polymer-uk', search: 'locked-product-2' }),
      )
      // An inactive lock says so in its header.
      expect(screen.getByText('Disabled')).toBeInTheDocument()
    })

    it('says so when the store has no such lock', async () => {
      locks.mockResolvedValue(locksAnswer([]))
      renderPage('/locks/nope')

      expect(await screen.findByText('This lock was not found')).toBeInTheDocument()
    })
  })
})
