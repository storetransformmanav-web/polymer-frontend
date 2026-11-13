import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  api,
  type AccessLock,
  type AccessTagListResponse,
  type CustomerListResponse,
  type LockCustomersResponse,
  type ProductDetail,
} from '../../../lib/api/endpoints.ts'
import { renderWithProviders } from '../../../test/renderWithProviders.tsx'
import { LockAccessPanel } from './LockAccessPanel.tsx'

vi.mock('../../../lib/api/endpoints.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/api/endpoints.ts')>()),
  api: {
    access: {
      locks: vi.fn(),
      lock: vi.fn(),
      removeLock: vi.fn(),
      tags: vi.fn(),
      lockCustomers: vi.fn(),
      setLockCustomers: vi.fn(),
      customerTags: vi.fn(),
    },
    customers: { list: vi.fn() },
  },
}))

const locks = vi.mocked(api.access.locks)
const lockWrite = vi.mocked(api.access.lock)
const tags = vi.mocked(api.access.tags)
const lockCustomers = vi.mocked(api.access.lockCustomers)
const setLockCustomers = vi.mocked(api.access.setLockCustomers)
const storeCustomers = vi.mocked(api.customers.list)

const PRODUCT = {
  title: 'Hippo Bag',
  handle: 'hippo-bag',
  shop: { key: 'polymer-uk', name: 'Polymer UK' },
} as ProductDetail

function makeLock(patch: Partial<AccessLock> = {}): AccessLock {
  return {
    product_id: 'prod-1',
    shopify_id: 1,
    title: 'Hippo Bag',
    handle: 'hippo-bag',
    status: 'ACTIVE',
    image_url: null,
    product_tags: ['vans'],
    enabled: true,
    tags: ['vans'],
    hide_from_lists: true,
    hide_from_nav: false,
    noindex: false,
    hide_from_sitemap: false,
    manual_locking: false,
    message: null,
    customers_with_access: 1,
    sync_status: 'synced',
    sync_error: null,
    last_pushed_at: null,
    updated_at: '2026-10-29T09:12:38Z',
    shop: null,
    ...patch,
  }
}

const lockList = (...found: AccessLock[]) => ({
  locks: found,
  page: 1,
  page_size: 100,
  total: found.length,
  total_pages: 1,
  has_next: false,
})

const TAGS: AccessTagListResponse = {
  tags: [
    {
      tag: 'vans',
      label: null,
      is_lock_tag: true,
      products: 4,
      locked_products: 1,
      customers: 10,
    },
    {
      tag: 'b2b',
      label: 'B2B trade',
      is_lock_tag: true,
      products: 0,
      locked_products: 0,
      customers: 2539,
    },
    {
      tag: 'retail',
      label: null,
      is_lock_tag: false,
      products: 8,
      locked_products: 0,
      customers: 3,
    },
  ],
  page: 1,
  page_size: 12,
  total: 3,
  total_pages: 1,
  has_next: false,
}

const WITH_ACCESS: LockCustomersResponse = {
  message: null,
  customers: [
    {
      id: 'c1',
      name: 'Ada Buyer',
      email: 'buyer@example.com',
      phone: null,
      company: 'Buyer Ltd',
      tags: ['vans'],
      created_at: null,
    },
  ],
  tags: [{ tag: 'vans', label: null, locked_products: 1 }],
  login_only: false,
  page: 1,
  page_size: 25,
  total: 1,
  total_pages: 1,
  has_next: false,
}

const STORE_CUSTOMERS = {
  items: [
    { id: 'c1', full_name: 'Ada Buyer', email: 'buyer@example.com', tags: ['vans'] },
    {
      id: 'c9',
      full_name: 'Cy Newcomer',
      email: 'cy@example.com',
      tags: ['Login with Shop', 'Shop'],
    },
  ],
  page: 1,
  page_size: 10,
  total: 2,
  total_pages: 1,
  has_next: false,
} as unknown as CustomerListResponse

beforeEach(() => {
  vi.clearAllMocks()
  locks.mockResolvedValue(lockList(makeLock()))
  tags.mockResolvedValue(TAGS)
  lockCustomers.mockResolvedValue(WITH_ACCESS)
  storeCustomers.mockResolvedValue(STORE_CUSTOMERS)
  lockWrite.mockResolvedValue({ message: 'Lock updated.' } as never)
  setLockCustomers.mockResolvedValue({ message: 'Access given.' } as never)
})

const keysBox = () =>
  screen.findByRole('combobox', { name: /Add keys from the store’s tags/ })
const customerBox = () =>
  screen.findByRole('combobox', { name: /Search the store’s customers to add/ })

describe('the Keys (tags) card', () => {
  it('shows the keys as chips and asks for no tags until the search box is used', async () => {
    renderWithProviders(<LockAccessPanel product={PRODUCT} />)
    const keys = await screen.findByRole('list', { name: 'Keys of this product' })
    expect(within(keys).getByText('vans')).toBeInTheDocument()
    expect(tags).not.toHaveBeenCalled()
  })

  it('drops down every tag of the store when the box is focused, and marks the keys', async () => {
    const user = userEvent.setup()
    renderWithProviders(<LockAccessPanel product={PRODUCT} />)
    await user.click(await keysBox())
    const list = await screen.findByRole('list', { name: 'Tags in the store' })
    // Nothing was typed, yet every tag of the store is offered.
    expect(await within(list).findByText('B2B trade')).toBeInTheDocument()
    expect(within(list).getByText('retail')).toBeInTheDocument()
    expect(tags).toHaveBeenCalledWith(
      expect.objectContaining({ shop: 'polymer-uk', page: 1 }),
    )
    expect(tags.mock.calls[0][0]).not.toHaveProperty('search')
    // The product's own key is ticked, locked and labelled.
    expect(within(list).getByRole('checkbox', { name: 'vans' })).toBeChecked()
    expect(within(list).getByRole('checkbox', { name: 'vans' })).toBeDisabled()
    expect(within(list).getByText('Key of this product')).toBeInTheDocument()
  })

  it('suggests matching tags as you type, and puts the list away on Escape', async () => {
    const user = userEvent.setup()
    renderWithProviders(<LockAccessPanel product={PRODUCT} />)
    await user.type(await keysBox(), 'b2')
    await waitFor(() =>
      expect(tags).toHaveBeenCalledWith(expect.objectContaining({ search: 'b2' })),
    )
    expect(screen.getByRole('list', { name: 'Tags in the store' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('list', { name: 'Tags in the store' })).toBeNull()
  })

  it('adds the ticked tags as keys with one question and one request', async () => {
    const user = userEvent.setup()
    renderWithProviders(<LockAccessPanel product={PRODUCT} />)
    await user.click(await keysBox())
    await user.click(await screen.findByRole('checkbox', { name: 'b2b' }))
    await user.click(screen.getByRole('checkbox', { name: 'retail' }))
    await user.click(screen.getByRole('button', { name: 'Add 2 keys' }))

    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText('Add 2 keys?')).toBeInTheDocument()
    // Nothing is sent before "Yes".
    expect(lockWrite).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Add keys' }))

    await waitFor(() =>
      expect(lockWrite).toHaveBeenCalledWith({
        shop: 'polymer-uk',
        products: ['hippo-bag'],
        tags: ['vans', 'b2b', 'retail'],
      }),
    )
  })

  it('can make a tag the store does not have yet', async () => {
    const user = userEvent.setup()
    renderWithProviders(<LockAccessPanel product={PRODUCT} />)
    await user.type(await keysBox(), 'wholesale{Enter}')
    const chosen = await screen.findByRole('list', { name: 'Keys to add' })
    expect(within(chosen).getByText('wholesale')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add key' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Add key' }))
    await waitFor(() =>
      expect(lockWrite).toHaveBeenCalledWith({
        shop: 'polymer-uk',
        products: ['hippo-bag'],
        tags: ['vans', 'wholesale'],
      }),
    )
  })
})

describe('the Visibility settings card', () => {
  it('shows every setting with its state and how many are on', async () => {
    renderWithProviders(<LockAccessPanel product={PRODUCT} />)
    const card = await screen.findByRole('region', { name: 'Lock settings' })
    expect(within(card).getByText('Visibility settings')).toBeInTheDocument()
    // Only "Hide from lists" is on in the fixture.
    expect(within(card).getByText('1 of 5 on')).toBeInTheDocument()
    expect(within(card).getByRole('switch', { name: 'Hide from lists' })).toBeChecked()
    expect(
      within(card).getByRole('switch', { name: 'Hide from navigation menus' }),
    ).not.toBeChecked()
  })

  it('asks before switching one, then sends only that setting', async () => {
    const user = userEvent.setup()
    renderWithProviders(<LockAccessPanel product={PRODUCT} />)
    const card = await screen.findByRole('region', { name: 'Lock settings' })
    await user.click(within(card).getByRole('switch', { name: 'Hide from sitemaps' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(lockWrite).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Yes, turn on' }))
    await waitFor(() =>
      expect(lockWrite).toHaveBeenCalledWith({
        shop: 'polymer-uk',
        products: ['hippo-bag'],
        tags: ['vans'],
        hide_from_sitemap: true,
      }),
    )
  })

  it('warns while manual locking is on', async () => {
    locks.mockResolvedValue(lockList(makeLock({ manual_locking: true })))
    renderWithProviders(<LockAccessPanel product={PRODUCT} />)
    expect(
      await screen.findByText(/shows this product to everyone\. Switch it off/),
    ).toBeInTheDocument()
  })
})

describe('Customer Access', () => {
  it('shows only the customers who have access by default, and asks the store for nothing', async () => {
    renderWithProviders(<LockAccessPanel product={PRODUCT} />)
    const section = await screen.findByRole('region', { name: 'Customer Access' })
    expect(await within(section).findByText('Ada Buyer')).toBeInTheDocument()
    expect(within(section).getByText('buyer@example.com')).toBeInTheDocument()
    expect(lockCustomers).toHaveBeenCalledWith(
      'hippo-bag',
      expect.objectContaining({ shop: 'polymer-uk' }),
    )
    expect(storeCustomers).not.toHaveBeenCalled()
    // No suggestion list until something is typed.
    expect(screen.queryByRole('list', { name: 'Customers in the store' })).toBeNull()
  })

  it('suggests the store’s customers when something is typed, and marks who already has access', async () => {
    const user = userEvent.setup()
    renderWithProviders(<LockAccessPanel product={PRODUCT} />)
    await user.type(await customerBox(), 'cy')
    const list = await screen.findByRole(
      'list',
      { name: 'Customers in the store' },
      { timeout: 3000 },
    )
    expect(await within(list).findByText('Cy Newcomer')).toBeInTheDocument()
    expect(storeCustomers).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'all', shop: 'polymer-uk', search: 'cy', page: 1 }),
    )
    // Ada already holds the key, so she can't be ticked again.
    expect(within(list).getByText('Has access')).toBeInTheDocument()
    expect(within(list).getByRole('checkbox', { name: 'Ada Buyer' })).toBeDisabled()
    // The customer's own tags are shown on the row.
    expect(within(list).getByText('Login with Shop')).toBeInTheDocument()
  })

  it('gives the picked customer access after the question', async () => {
    const user = userEvent.setup()
    renderWithProviders(<LockAccessPanel product={PRODUCT} />)
    // Nothing to add yet.
    expect(await screen.findByRole('button', { name: 'Add customer' })).toBeDisabled()
    await user.type(await customerBox(), 'cy')
    await user.click(
      await screen.findByRole('checkbox', { name: 'Cy Newcomer' }, { timeout: 3000 }),
    )
    const picked = screen.getByRole('list', { name: 'Customers to add' })
    expect(within(picked).getByText('Cy Newcomer')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add customer' }))

    const dialog = await screen.findByRole('alertdialog')
    expect(setLockCustomers).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Give access' }))
    await waitFor(() =>
      expect(setLockCustomers).toHaveBeenCalledWith('hippo-bag', {
        shop: 'polymer-uk',
        add: ['cy@example.com'],
      }),
    )
  })

  it('offers an email that is not in the store’s list, and asks which tag when there are several keys', async () => {
    locks.mockResolvedValue(lockList(makeLock({ tags: ['vans', 'b2b'] })))
    storeCustomers.mockResolvedValue({
      ...STORE_CUSTOMERS,
      items: [],
      total: 0,
      total_pages: 1,
    } as unknown as CustomerListResponse)
    const user = userEvent.setup()
    renderWithProviders(<LockAccessPanel product={PRODUCT} />)
    await user.type(await customerBox(), 'new@buyer.com')
    await user.click(
      await screen.findByRole(
        'button',
        { name: /Add “new@buyer.com” by email/ },
        { timeout: 3000 },
      ),
    )
    await user.click(screen.getByRole('button', { name: 'Add customer' }))
    const dialog = await screen.findByRole('alertdialog')
    // Two keys: the person chooses which one they get.
    await user.click(within(dialog).getByRole('radio', { name: 'b2b' }))
    await user.click(within(dialog).getByRole('button', { name: 'Give access' }))
    await waitFor(() =>
      expect(setLockCustomers).toHaveBeenCalledWith('hippo-bag', {
        shop: 'polymer-uk',
        add: ['new@buyer.com'],
        tag: 'b2b',
      }),
    )
  })
})
