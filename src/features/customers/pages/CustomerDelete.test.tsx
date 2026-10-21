import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../lib/api/ApiError.ts'
import {
  api,
  type CustomerDetail,
  type CustomerListItem,
  type CustomerListParams,
  type CustomerListResponse,
} from '../../../lib/api/endpoints.ts'
import { renderWithProviders } from '../../../test/renderWithProviders.tsx'
import { CustomersPage } from './CustomersPage.tsx'

vi.mock('../../../lib/api/endpoints.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/api/endpoints.ts')>()),
  api: {
    customers: { list: vi.fn(), details: vi.fn(), remove: vi.fn() },
    products: {},
    auth: {},
  },
}))

const SHOP = {
  key: 'polymer-uk',
  name: 'Polymer UK',
  domain: 'polymer-uk-ltd.myshopify.com',
  currency: 'GBP',
}

/** #1 is a CRM customer with no store; #2 has orders; #3 and #4 have none. */
function makeItem(n: number): CustomerListItem {
  const crm = n === 1
  return {
    shop: crm ? null : SHOP,
    id: `cust-${n}`,
    shopify_id: crm ? null : 1000 + n,
    email: `customer${n}@example.com`,
    full_name: `Customer ${n}`,
    first_name: null,
    last_name: null,
    phone: null,
    role: crm ? 'administrator' : 'subscriber',
    is_active: true,
    shopify_state: crm ? null : 'ENABLED',
    accepts_marketing: true,
    orders_count: n === 2 ? 2 : 0,
    total_spent: '0.00',
    currency: 'GBP',
    tags: [],
    city: null,
    country: 'United Kingdom',
    last_order_name: null,
    shopify_created_at: '2026-10-08T12:55:03Z',
    last_login_at: null,
  }
}

function makeDetail(id: string): CustomerDetail {
  const n = Number(id.replace('cust-', ''))
  return {
    ...makeItem(n),
    id,
    shopify_gid: null,
    verified_email: true,
    tax_exemptions: [],
    addresses: [],
    metafields: [],
    raw_json: null,
  } as unknown as CustomerDetail
}

/** The fake server: four customers, minus whichever have been deleted. */
let deleted = new Set<string>()
function respond(params: CustomerListParams): CustomerListResponse {
  const items = [1, 2, 3, 4].map(makeItem).filter((item) => !deleted.has(item.id))
  const pageSize = params.page_size ?? 20
  return {
    items: items.slice(0, pageSize),
    page: 1,
    page_size: pageSize,
    total: items.length,
    total_pages: 1,
    has_next: false,
    sort: 'created_at',
    order: 'desc',
  }
}

const list = vi.mocked(api.customers.list)
const details = vi.mocked(api.customers.details)
const remove = vi.mocked(api.customers.remove)
const never = () => new Promise<never>(() => undefined)

function Path() {
  return <p data-testid="path">{useLocation().pathname}</p>
}

function renderPage(route = '/customers') {
  return renderWithProviders(
    <>
      <Path />
      <Routes>
        <Route path="/customers/*" element={<CustomersPage />} />
      </Routes>
    </>,
    { route },
  )
}

describe('deleting a customer', () => {
  beforeEach(() => {
    deleted = new Set()
    list.mockImplementation((params) => Promise.resolve(respond(params)))
    details.mockImplementation((id) => Promise.resolve(makeDetail(id)))
    remove.mockImplementation(async (id) => {
      deleted.add(id)
      return { message: 'Customer deleted' }
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  async function askToDelete(name: string, route = '/customers') {
    const user = userEvent.setup()
    renderPage(route)
    await screen.findByText('Customer 3')
    await user.click(screen.getByRole('button', { name: `Delete ${name}` }))
    return {
      user,
      dialog: await screen.findByRole('alertdialog', { name: `Delete “${name}”?` }),
    }
  }

  it('gives every row a trash button under Actions, next to View', async () => {
    renderPage()
    await screen.findByText('Customer 3')

    const table = screen.getByRole('table')
    expect(
      within(table).getByRole('columnheader', { name: 'Actions' }),
    ).toBeInTheDocument()
    for (const name of ['Customer 1', 'Customer 2', 'Customer 3', 'Customer 4']) {
      expect(screen.getByRole('button', { name: `View ${name}` })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: `Delete ${name}` })).toBeInTheDocument()
    }
    expect(remove).not.toHaveBeenCalled()
  })

  it('asks first — it also deletes in Shopify, are you sure — and sends nothing yet', async () => {
    const { dialog } = await askToDelete('Customer 3')

    expect(
      within(dialog).getByText('This will also delete this customer in Shopify.'),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByText(/Are you sure you want to delete this customer/),
    ).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus()
    expect(remove).not.toHaveBeenCalled()
  })

  it('does nothing on Cancel or Escape, and the customer stays', async () => {
    const { user, dialog } = await askToDelete('Customer 3')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete Customer 3' }))
    await screen.findByRole('alertdialog')
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(remove).not.toHaveBeenCalled()
    expect(screen.getByText('Customer 3')).toBeInTheDocument()
  })

  it('deletes through DELETE /customers/{id} for the customer’s store, and the row is gone at once', async () => {
    const { user, dialog } = await askToDelete('Customer 3')
    // The list has not been read again yet: what shows is the instant removal.
    list.mockImplementation(never)
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(remove).toHaveBeenCalledWith('cust-3', 'polymer-uk'))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.queryByText('Customer 3')).not.toBeInTheDocument()
    expect(screen.getByText('Customer 4')).toBeInTheDocument()
    expect(screen.getByText(/Showing/)).toHaveTextContent('of 3')
    expect(await screen.findByText(/Deleted “Customer 3”/)).toHaveTextContent(
      'Customer deleted',
    )
  })

  it('sends no store for a customer that has none (created in the CRM)', async () => {
    const { user, dialog } = await askToDelete('Customer 1')
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(remove).toHaveBeenCalledWith('cust-1', null))
  })

  it('reads the list and the role counts again afterwards, quietly', async () => {
    const { user, dialog } = await askToDelete('Customer 3')
    list.mockClear()
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

    await waitFor(() =>
      expect(list).toHaveBeenCalledWith(expect.objectContaining({ page_size: 25 })),
    )
    await waitFor(() =>
      expect(list).toHaveBeenCalledWith(
        expect.objectContaining({ page_size: 1, role: 'administrator' }),
      ),
    )
    expect(screen.queryByText('Customer 3')).not.toBeInTheDocument()
  })

  it('warns up front when the customer has orders, because Shopify refuses those', async () => {
    const { dialog } = await askToDelete('Customer 2')

    expect(within(dialog).getByText(/has 2 orders/)).toBeInTheDocument()
    expect(within(dialog).getByText(/may refuse/)).toBeInTheDocument()
    expect(remove).not.toHaveBeenCalled()
  })

  it('does not warn about orders for a customer without any', async () => {
    const { dialog } = await askToDelete('Customer 3')

    expect(within(dialog).queryByText(/orders/)).not.toBeInTheDocument()
  })

  it('keeps the dialog open with the backend’s message when the delete is refused', async () => {
    remove.mockRejectedValue(
      new ApiError('Shopify only allows deleting customers without orders.', {
        status: 422,
      }),
    )
    const { user, dialog } = await askToDelete('Customer 2')
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

    expect(
      await within(dialog).findByText(
        'Shopify only allows deleting customers without orders.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Delete' })).toBeEnabled()
    // Nothing changed behind it.
    expect(screen.getByText('Customer 2')).toBeInTheDocument()
    expect(screen.queryByText(/Deleted “/)).not.toBeInTheDocument()
  })

  it('locks the dialog while the delete is in flight, so it cannot go twice', async () => {
    remove.mockImplementation(never)
    const { user, dialog } = await askToDelete('Customer 3')
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: 'Delete' })).toBeDisabled(),
    )
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(remove).toHaveBeenCalledTimes(1)
  })

  describe('from a customer’s own page', () => {
    it('has a Delete button in the header, and after deleting goes back to the list without that customer', async () => {
      const user = userEvent.setup()
      renderPage('/customers/cust-3')
      await screen.findByRole('heading', { level: 1, name: 'Customer 3' })

      // (The hidden list has a trash button too: use the one in this customer's header.)
      await user.click(
        within(screen.getByRole('article')).getByRole('button', {
          name: 'Delete Customer 3',
        }),
      )
      const dialog = await screen.findByRole('alertdialog', {
        name: 'Delete “Customer 3”?',
      })
      expect(remove).not.toHaveBeenCalled()
      await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

      await waitFor(() => expect(remove).toHaveBeenCalledWith('cust-3', 'polymer-uk'))
      await waitFor(() =>
        expect(screen.getByTestId('path')).toHaveTextContent('/customers'),
      )
      expect(screen.getByTestId('path').textContent).toBe('/customers')
      expect(await screen.findByText(/Deleted “Customer 3”/)).toBeInTheDocument()
      expect(screen.queryByRole('heading', { level: 1, name: 'Customer 3' })).toBeNull()
      expect(screen.queryByRole('button', { name: 'View Customer 3' })).toBeNull()
    })
  })
})
