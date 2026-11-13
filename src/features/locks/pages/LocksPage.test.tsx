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
const setup = vi.mocked(api.access.setup)
const productsList = vi.mocked(api.products.list)
const customersList = vi.mocked(api.customers.list)

/**
 * The Customer Access tab: search the store's customers and tick each one. The store's customer
 * search answers with just these people.
 */
async function tickCustomers(
  user: ReturnType<typeof userEvent.setup>,
  people: { name: string; email: string; tags?: string[] }[],
) {
  customersList.mockResolvedValue(
    pageOf(
      people.map((person, index) => ({
        id: `s-${index}`,
        full_name: person.name,
        email: person.email,
        tags: person.tags ?? [],
      })),
    ) as unknown as CustomerListResponse,
  )
  await user.type(screen.getByLabelText('Search customers to add'), people[0].email)
  for (const person of people) {
    const box = await screen.findByRole(
      'checkbox',
      { name: person.name },
      { timeout: 2000 },
    )
    if (!(box as HTMLInputElement).disabled) await user.click(box)
  }
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
    // The Columns menu's choice is remembered in the browser: every test starts from the default.
    window.localStorage.clear()
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

    describe('the Columns menu', () => {
      const headerNames = () =>
        within(screen.getByRole('table'))
          .getAllByRole('columnheader')
          .map((header) => header.textContent)

      it('lists every column with an eye, the shown ones first', async () => {
        const user = userEvent.setup()
        renderPage()
        await screen.findByText('Locked Product 1')

        await user.click(screen.getByRole('button', { name: 'Columns' }))

        for (const name of [
          'Keys (tags)',
          'With access',
          'Hidden from',
          'Status',
          'Shopify',
          'Updated',
        ]) {
          expect(screen.getByRole('button', { name: `Hide ${name}` })).toBeInTheDocument()
        }
        for (const name of ['Handle', 'Product status', 'Store', 'Manual locking']) {
          expect(screen.getByRole('button', { name: `Show ${name}` })).toBeInTheDocument()
        }
      })

      it('hides a column and shows another, and remembers the choice in this browser', async () => {
        const user = userEvent.setup()
        renderPage()
        await screen.findByText('Locked Product 1')

        await user.click(screen.getByRole('button', { name: 'Columns' }))
        await user.click(screen.getByRole('button', { name: 'Hide With access' }))
        await user.click(screen.getByRole('button', { name: 'Show Handle' }))

        expect(headerNames()).toEqual([
          'Product',
          'Keys (tags)',
          'Hidden from',
          'Status',
          'Shopify',
          'Updated',
          'Handle',
          'Actions',
        ])
        expect(screen.getByText('locked-product-1')).toBeInTheDocument()
        expect(window.localStorage.getItem('polymer-crm:lock-columns')).toContain(
          'handle',
        )
      })

      it('Clear All puts the default columns back', async () => {
        const user = userEvent.setup()
        renderPage()
        await screen.findByText('Locked Product 1')
        await user.click(screen.getByRole('button', { name: 'Columns' }))
        await user.click(screen.getByRole('button', { name: 'Hide Updated' }))
        expect(headerNames()).not.toContain('Updated')

        await user.click(screen.getByRole('button', { name: 'Clear All' }))

        expect(headerNames()).toEqual([
          'Product',
          'Keys (tags)',
          'With access',
          'Hidden from',
          'Status',
          'Shopify',
          'Updated',
          'Actions',
        ])
      })
    })

    it('draws the Enabled dropdown and the Shopify pill the same width', async () => {
      renderPage()
      await screen.findByText('Locked Product 1')

      const row = within(
        screen.getByText('Locked Product 1').closest('tr') as HTMLElement,
      )
      expect(
        row.getByRole('button', { name: /^Status of Locked Product 1/ }),
      ).toHaveClass('w-32')
      expect(row.getByText('Synced')).toHaveClass('w-32')
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
      await openLock()

      expect(screen.getByRole('tablist', { name: 'Lock sections' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Back to list' })).toBeInTheDocument()
      // Like a product's header: the figures beside the name.
      expect(screen.getByText('with access')).toBeInTheDocument()
      expect(screen.getByText(/^keys?$/)).toBeInTheDocument()
      // Like a product's Overview: the big picture links to the product page, which opens in
      // this same page (as a tab of Lock Management), not on the Products page.
      expect(screen.queryByText('Last sent to Shopify')).toBeNull()
      expect(screen.getByRole('link', { name: /view product/i })).toHaveAttribute(
        'href',
        expect.stringMatching(/^\/locks\/product\//),
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

      // The settings are on the Overview too (there is no Settings tab), each a Yes / No toggle.
      expect(screen.queryByRole('tab', { name: 'Settings' })).toBeNull()
      expect(
        screen.getByRole('switch', { name: 'Hidden from navigation menus' }),
      ).toBeInTheDocument()
      expect(screen.getByRole('switch', { name: 'Manual locking' })).toBeInTheDocument()
      expect(screen.getAllByRole('switch')).toHaveLength(5)
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
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

      it('a setting is a Yes / No toggle: switching asks nothing; Save changes asks once, then sends', async () => {
        const user = await openLock()

        // Switching only changes the page: no question, nothing sent.
        const value = screen.getByRole('switch', { name: 'Hidden from lists' })
        expect(value).toHaveAttribute('aria-checked', 'false')
        await user.click(value)
        expect(value).toHaveAttribute('aria-checked', 'true')
        expect(screen.queryByRole('alertdialog')).toBeNull()
        expect(lock).not.toHaveBeenCalled()

        // The status in the header joins the same save.
        await user.click(
          screen.getByRole('button', { name: /^Status of Locked Product 1: Enabled$/ }),
        )
        await user.click(await screen.findByRole('option', { name: /Disabled/ }))
        expect(screen.queryByRole('alertdialog')).toBeNull()

        const bar = within(screen.getByRole('region', { name: 'Unsaved changes' }))
        expect(bar.getByText('2 unsaved changes')).toBeInTheDocument()
        await user.click(bar.getByRole('button', { name: 'Save changes' }))

        const dialog = await screen.findByRole('alertdialog')
        expect(lock).not.toHaveBeenCalled()
        expect(within(dialog).getByText('Hidden from lists')).toBeInTheDocument()
        expect(within(dialog).getByText('Status')).toBeInTheDocument()
        willHold({ hide_from_lists: true, enabled: false })
        await user.click(within(dialog).getByRole('button', { name: 'Yes, update' }))

        await waitFor(() =>
          expect(lock).toHaveBeenCalledWith({
            shop: 'polymer-uk',
            products: ['locked-product-1'],
            tags: ['vans'],
            enabled: false,
            hide_from_lists: true,
          }),
        )
        expect(lock).toHaveBeenCalledTimes(1)
        await waitFor(() =>
          expect(screen.queryByRole('region', { name: 'Unsaved changes' })).toBeNull(),
        )
        expect(
          await screen.findByRole('switch', { name: 'Hidden from lists' }),
        ).toHaveAttribute('aria-checked', 'true')
      })

      it('Status is changed once, from the header dropdown; the settings do not repeat it', async () => {
        await openLock()

        expect(
          screen.getByRole('button', { name: /^Status of Locked Product 1: Enabled$/ }),
        ).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Status: Enabled' })).toBeNull()
        expect(
          screen.getByRole('switch', { name: 'Hidden from lists' }),
        ).toBeInTheDocument()
      })

      it('Cancel puts the settings back and sends nothing', async () => {
        const user = await openLock()

        const value = screen.getByRole('switch', { name: 'Manual locking' })
        await user.click(value)
        await user.click(
          within(screen.getByRole('region', { name: 'Unsaved changes' })).getByRole(
            'button',
            { name: 'Cancel' },
          ),
        )

        expect(value).toHaveAttribute('aria-checked', 'false')
        expect(screen.queryByRole('region', { name: 'Unsaved changes' })).toBeNull()
        expect(lock).not.toHaveBeenCalled()
      })

      it('the advanced settings change the same way', async () => {
        const user = await openLock()

        await user.click(await screen.findByRole('switch', { name: 'Manual locking' }))
        await user.click(screen.getByRole('button', { name: 'Save changes' }))
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
      const openAccess = async () => {
        const user = await openLock()
        await tab(user, 'Customer Access')
        await screen.findByText('Ada Buyer')
        return user
      }
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
        // is typed, and Add New Customer. There is no Check button.
        expect(screen.getByLabelText('Search customers to add')).toBeInTheDocument()
        expect(screen.queryByRole('list', { name: 'Customers to add' })).toBeNull()
        expect(customersList).not.toHaveBeenCalled()
        expect(screen.queryByRole('button', { name: 'Check' })).toBeNull()
        expect(screen.queryByText(/Check shows whether/)).toBeNull()
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

      it('shows the API’s error when the customer already has the access', async () => {
        setLockCustomers.mockRejectedValue(
          new ApiError('buyer@example.com already has this access', { status: 422 }),
        )
        const user = await openAccess()

        await tickCustomers(user, [{ name: 'Ada Buyer', email: 'buyer@example.com' }])
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

        await tickCustomers(user, [
          { name: 'New Person', email: 'new@example.com' },
          { name: 'Other Person', email: 'other@example.com' },
        ])
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

      it('a customer’s name opens their details inside this page', async () => {
        await openAccess()
        const link = screen.getByRole('link', { name: 'Ada Buyer' })
        expect(link).toHaveAttribute(
          'href',
          `/locks/customer/${encodeURIComponent(ADA.id)}`,
        )
        // There is no separate share icon: the name is the way in.
        expect(screen.queryByRole('link', { name: /^Open details of/ })).toBeNull()
      })

      it('shows a customer who already has the access ticked and locked, and cannot add them', async () => {
        const user = await openAccess()
        await tickCustomers(user, [
          { name: 'Ada Buyer', email: 'buyer@example.com', tags: ['vans'] },
        ])

        const box = await screen.findByRole('checkbox', { name: 'Ada Buyer' })
        expect(box).toBeChecked()
        expect(box).toBeDisabled()
        expect(screen.getByText('Already has access')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Add New Customer' })).toBeDisabled()
      })

      it('a lock with several tags gives its first one', async () => {
        locks.mockResolvedValue(locksAnswer([makeLock(1, { tags: ['vans', 'b2b'] })]))
        const user = await openAccess()
        await tickCustomers(user, [{ name: 'New Person', email: 'new@example.com' }])
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

      it('has a search box on the customers list, but no Tag filter or Sort by', async () => {
        locks.mockResolvedValue(locksAnswer([makeLock(1, { tags: ['vans', 'b2b'] })]))
        await openAccess()

        expect(screen.getByLabelText('Search customers with access')).toBeInTheDocument()
        expect(screen.queryByLabelText('Tag')).toBeNull()
        expect(screen.queryByLabelText('Sort by')).toBeNull()
      })

      it('searches the customers with access by what is typed, and Clear undoes it', async () => {
        const user = await openAccess()

        await user.type(screen.getByLabelText('Search customers with access'), 'ada')
        await waitFor(() =>
          expect(lockCustomers).toHaveBeenLastCalledWith(
            'locked-product-1',
            expect.objectContaining({ shop: 'polymer-uk', search: 'ada' }),
          ),
        )

        // What was searched for is marked in yellow in the rows, as on the product list.
        expect(await screen.findByText('Ada', { selector: 'mark' })).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Clear customer search' }))
        await waitFor(() =>
          expect(lockCustomers).toHaveBeenLastCalledWith(
            'locked-product-1',
            expect.not.objectContaining({ search: expect.anything() }),
          ),
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
      await tab(user, 'Customer Access')

      expect(lock).not.toHaveBeenCalled()
      expect(updateTags).not.toHaveBeenCalled()
    })

    it('searches the store’s customers only once something is typed', async () => {
      const user = await openLock()
      await tab(user, 'Customer Access')
      expect(customersList).not.toHaveBeenCalled()

      await user.type(screen.getByLabelText('Search customers to add'), 'jane')
      await waitFor(() =>
        expect(customersList).toHaveBeenCalledWith(
          expect.objectContaining({ shop: 'polymer-uk', role: 'all', search: 'jane' }),
        ),
      )
      const list = await screen.findByRole('list', { name: 'Customers to add' })
      expect(within(list).getByText('Jane Buyer')).toBeInTheDocument()

      // Clearing the search puts the list away again.
      await user.click(screen.getByRole('button', { name: 'Clear search' }))
      await waitFor(() =>
        expect(screen.queryByRole('list', { name: 'Customers to add' })).toBeNull(),
      )
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
