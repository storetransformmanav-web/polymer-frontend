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
const check = vi.mocked(api.access.check)
const setup = vi.mocked(api.access.setup)
const productsList = vi.mocked(api.products.list)
const customersList = vi.mocked(api.customers.list)

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
      expect(row.getByText('Enabled')).toBeInTheDocument()
      expect(row.getByText('Synced')).toBeInTheDocument()
      expect(screen.getByText(/2 locked products/)).toBeInTheDocument()
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
      await user.selectOptions(screen.getByLabelText('Lock status'), 'Enabled')

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

    it('opens like a product page: a header, tabs, and cards that can only be read', async () => {
      const user = await openLock()

      expect(screen.getByRole('tablist', { name: 'Lock sections' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Back to list' })).toBeInTheDocument()
      // The keys are plain chips: no add box, no pencil, no Save.
      expect(
        within(screen.getByRole('list', { name: 'Keys' })).getByText('vans'),
      ).toBeInTheDocument()
      expect(screen.queryByLabelText('Search or add a tag')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^Edit / })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^Save/ })).not.toBeInTheDocument()

      // Nor on the Settings tab: the values are shown, with no switch or box to change.
      await tab(user, 'Settings')
      expect(screen.getByText('Hidden from navigation menus')).toBeInTheDocument()
      expect(screen.queryByRole('switch')).not.toBeInTheDocument()
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^Edit / })).not.toBeInTheDocument()
    })

    it('never writes: opening a lock sends no lock or tag update', async () => {
      const user = await openLock()
      await tab(user, 'Settings')
      await tab(user, 'Check access')

      expect(lock).not.toHaveBeenCalled()
      expect(updateTags).not.toHaveBeenCalled()
    })

    it('tells whether a customer would see the product', async () => {
      const user = await openLock()
      await tab(user, 'Check access')
      check.mockResolvedValue({
        allowed: false,
        reason: 'no_matching_tag',
        matched_tags: [],
        customer_tags: ['retail'],
        message: 'Not allowed',
      })

      await user.type(screen.getByLabelText('Customer email or id'), 'jane@example.com')
      await user.click(screen.getByRole('button', { name: 'Check' }))

      await waitFor(() =>
        expect(check).toHaveBeenCalledWith({
          shop: 'polymer-uk',
          customer: 'jane@example.com',
          product: 'prod-1',
        }),
      )
      expect(await screen.findByText('Not allowed')).toBeInTheDocument()
      expect(screen.getByText(/none of the lock/)).toBeInTheDocument()
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
      // A disabled lock says so in its header.
      expect(screen.getByText('Disabled')).toBeInTheDocument()
    })

    it('says so when the store has no such lock', async () => {
      locks.mockResolvedValue(locksAnswer([]))
      renderPage('/locks/nope')

      expect(await screen.findByText('This lock was not found')).toBeInTheDocument()
    })
  })
})
