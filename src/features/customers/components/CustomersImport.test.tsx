import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../lib/api/ApiError.ts'
import { api, type Shop } from '../../../lib/api/endpoints.ts'
import { downloadBlob } from '../../../lib/download.ts'
import { renderWithProviders } from '../../../test/renderWithProviders.tsx'
import { CustomersImport } from './CustomersImport.tsx'

vi.mock('../../../lib/api/endpoints.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/api/endpoints.ts')>()),
  api: {
    customers: { list: vi.fn(), import: vi.fn(), importStatus: vi.fn() },
    shops: { list: vi.fn() },
    products: {},
    auth: {},
  },
}))
vi.mock('../../../lib/download.ts', () => ({ downloadBlob: vi.fn() }))

const CSV =
  'First Name,Last Name,Email,Accepts Email Marketing,Default Address City,Default Address Country Code,Tags\n' +
  'Jane,Example,jane@example.com,yes,Leeds,GB,b2b\n' +
  'Sam,Sample,sam@example.com,no,,,\n'

const csvFile = (name = 'customers.csv', text = CSV) =>
  new File([text], name, { type: 'text/csv' })

const SHOP = {
  key: 'polymer-uk',
  name: 'Polymer UK',
  domain: 'polymer-uk.myshopify.com',
  currency: 'GBP',
  connected: true,
  is_active: true,
} as Shop

const send = vi.mocked(api.customers.import)
const status = vi.mocked(api.customers.importStatus)
const shopsList = vi.mocked(api.shops.list)

const PLAN = { importId: null, message: '', counts: {}, problems: [] }

async function openWithFile(file = csvFile()) {
  const user = userEvent.setup()
  renderWithProviders(<CustomersImport />)
  await user.click(screen.getByRole('button', { name: 'Import' }))
  const dialog = await screen.findByRole('dialog', { name: 'Import customers' })
  await user.upload(within(dialog).getByLabelText('Choose a CSV file'), file)
  await within(dialog).findByText(/2 customers/)
  await waitFor(() =>
    expect(within(dialog).getByRole('button', { name: 'Upload file' })).toBeEnabled(),
  )
  return { user, dialog }
}

describe('CustomersImport', () => {
  beforeEach(() => {
    shopsList.mockResolvedValue([SHOP])
    vi.mocked(api.customers.list).mockResolvedValue({
      items: [],
      page: 1,
      page_size: 25,
      total: 0,
      total_pages: 0,
      has_next: false,
      sort: 'created_at',
      order: 'desc',
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('sends nothing for a chosen file until Upload, which only checks it', async () => {
    send.mockResolvedValue(PLAN)
    const { user, dialog } = await openWithFile()
    expect(send).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole('button', { name: 'Upload file' }))

    await waitFor(() => expect(send).toHaveBeenCalledTimes(1))
    expect(send.mock.calls[0][1]).toEqual({
      shop: 'polymer-uk',
      createNew: true,
      updateExisting: true,
      dryRun: true,
    })

    const review = await screen.findByRole('dialog', {
      name: 'Preview your first customer',
    })
    expect(within(review).getByText('Jane Example')).toBeInTheDocument()
    expect(within(review).getByText('jane@example.com')).toBeInTheDocument()
    expect(within(review).getByText('Leeds, GB')).toBeInTheDocument()
    expect(review).toHaveTextContent('2 customers')
    expect(review).toHaveTextContent('overwrite any existing customers')
  })

  it('imports, follows the run, and re-reads the customers when it ends', async () => {
    send.mockResolvedValueOnce(PLAN).mockResolvedValueOnce({ ...PLAN, importId: 'imp-1' })
    status.mockResolvedValue({
      state: 'done',
      status: 'completed',
      processed: 2,
      total: 2,
      message: 'Imported 2 customers.',
      counts: { created: 2 },
      problems: [],
    })
    const { user, dialog } = await openWithFile()

    await user.click(within(dialog).getByRole('button', { name: 'Upload file' }))
    const review = await screen.findByRole('dialog', {
      name: 'Preview your first customer',
    })
    await user.click(within(review).getByRole('button', { name: 'Import customers' }))

    await waitFor(() => expect(status).toHaveBeenCalledWith('imp-1'))
    expect(send.mock.calls[1][1].dryRun).toBe(false)
    expect(await screen.findByText('Imported 2 customers.')).toBeInTheDocument()
    await waitFor(() => expect(api.customers.list).toHaveBeenCalled())
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('shows the rows the check would skip, naming them by email', async () => {
    send.mockResolvedValue({
      ...PLAN,
      problems: [{ row: 3, handle: 'sam@example.com', message: 'Invalid phone' }],
    })
    const { user, dialog } = await openWithFile()

    await user.click(within(dialog).getByRole('button', { name: 'Upload file' }))

    const problems = await screen.findByRole('group', {
      name: '1 row had a problem and will be skipped',
    })
    expect(problems).toHaveTextContent('Row 3 · sam@example.com')
    expect(problems).toHaveTextContent('Invalid phone')
  })

  it('refuses a products file before sending anything', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CustomersImport />)
    await user.click(screen.getByRole('button', { name: 'Import' }))
    const dialog = await screen.findByRole('dialog', { name: 'Import customers' })

    await user.upload(
      within(dialog).getByLabelText('Choose a CSV file'),
      csvFile('products.csv', 'Handle,Title\nmop,Mop\n'),
    )

    expect(await within(dialog).findByText(/no “Email” or “Phone” column/)).toBeVisible()
    expect(within(dialog).getByRole('button', { name: 'Upload file' })).toBeDisabled()
    expect(send).not.toHaveBeenCalled()
  })

  it('shows a refusal inside the window and keeps the file', async () => {
    send.mockRejectedValue(new ApiError('The file is too large.', { status: 422 }))
    const { user, dialog } = await openWithFile()

    await user.click(within(dialog).getByRole('button', { name: 'Upload file' }))

    expect(await within(dialog).findByText('The file is too large.')).toBeVisible()
    expect(within(dialog).getByText('customers.csv')).toBeInTheDocument()
  })

  it('needs at least one of the two choices', async () => {
    const { user, dialog } = await openWithFile()

    await user.click(within(dialog).getByRole('checkbox', { name: /^Overwrite/ }))
    await user.click(within(dialog).getByRole('checkbox', { name: /^Create new/ }))

    expect(within(dialog).getByRole('alert')).toHaveTextContent('Choose at least one')
    expect(within(dialog).getByRole('button', { name: 'Upload file' })).toBeDisabled()
  })

  it('offers a sample file', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CustomersImport />)
    await user.click(screen.getByRole('button', { name: 'Import' }))
    const dialog = await screen.findByRole('dialog', { name: 'Import customers' })

    await user.click(within(dialog).getByRole('button', { name: 'Download sample CSV' }))

    expect(vi.mocked(downloadBlob).mock.calls[0][0]).toBe('sample-customers-import.csv')
  })
})
