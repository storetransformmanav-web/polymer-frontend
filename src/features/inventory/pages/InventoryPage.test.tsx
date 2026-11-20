import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { trackingConfig } from '../../../app/store/inventorySlice.ts'
import { ApiError } from '../../../lib/api/ApiError.ts'
import {
  api,
  type InventoryItem,
  type InventoryListResponse,
  type InventoryVariant,
} from '../../../lib/api/endpoints.ts'
import { renderWithProviders } from '../../../test/renderWithProviders.tsx'
import { InventoryPage } from './InventoryPage.tsx'

vi.mock('../../../lib/api/endpoints.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/api/endpoints.ts')>()),
  api: {
    inventory: {
      list: vi.fn(),
      detail: vi.fn(),
      set: vi.fn(),
      adjust: vi.fn(),
      history: vi.fn(),
      adjustment: vi.fn(),
      reasons: vi.fn(),
    },
    auth: {},
  },
}))

const UNIT9 = 60465184951
const STANMORE = 70137741495

const line = (id: number, name: string, over: Record<string, number> = {}) => ({
  location_id: id,
  location_name: name,
  updated_at: '2026-11-03T10:00:00Z',
  available: 5,
  on_hand: 8,
  committed: 3,
  incoming: 0,
  reserved: 0,
  safety_stock: 0,
  damaged: 0,
  quality_control: 0,
  unavailable: 0,
  ...over,
})

const HIPPO: InventoryItem = {
  variant_id: 'v-1',
  product_id: 'p-1',
  title: 'Hippo Bag',
  variant_title: 'Small',
  sku: 'HB-S',
  barcode: '5012345678900',
  status: 'ACTIVE',
  tracked: true,
  image_url: null,
  totals: {
    available: 25,
    on_hand: 28,
    committed: 3,
    incoming: 0,
    unavailable: 0,
  } as InventoryItem['totals'],
  locations: [
    line(UNIT9, 'Unit 9'),
    line(STANMORE, 'Stanmore Warehouse', { available: 20, on_hand: 20, committed: 0 }),
  ],
}
const LID: InventoryItem = {
  variant_id: 'v-2',
  product_id: 'p-2',
  title: 'Foil Lid',
  variant_title: 'Default Title',
  sku: 'FL-1',
  barcode: null,
  status: 'DRAFT',
  tracked: false,
  image_url: null,
  totals: {
    available: 0,
    on_hand: 0,
    committed: 0,
    incoming: 0,
    unavailable: 0,
  } as InventoryItem['totals'],
  locations: [],
}

const LIST: InventoryListResponse = {
  items: [HIPPO, LID],
  totals: {
    variants: 2,
    available: 25,
    on_hand: 28,
    committed: 3,
    incoming: 0,
    unavailable: 0,
    in_stock: 1,
    low_stock: 0,
    out_of_stock: 1,
  },
  locations: [
    { id: UNIT9, name: 'Unit 9', variants: 2 },
    { id: STANMORE, name: 'Stanmore Warehouse', variants: 1 },
  ],
  // The quantities and reasons the Edit stock window offers come from the backend's answer.
  quantities: [
    { name: 'available', label: 'Available', editable: true },
    { name: 'on_hand', label: 'On hand', editable: true },
    { name: 'reserved', label: 'Reserved', editable: true },
    { name: 'safety_stock', label: 'Safety stock', editable: true },
    { name: 'damaged', label: 'Damaged', editable: true },
    { name: 'quality_control', label: 'Quality control', editable: true },
    { name: 'committed', label: 'Committed', editable: false },
  ],
  reasons: [
    { value: 'correction', label: 'Correction' },
    { value: 'received', label: 'Received' },
  ],
  page: 1,
  page_size: 25,
  total: 2,
  total_pages: 1,
  has_next: false,
}

const DETAIL: InventoryVariant = {
  ...HIPPO,
  price: '12.50',
  currency: 'GBP',
  inventory_policy: 'DENY',
  shop: {
    key: 'polymer-uk',
    name: 'Polymer UK',
    domain: 'x.myshopify.com',
    currency: 'GBP',
  },
} as InventoryVariant

/** What `GET /inventory/reasons` answers (the shape of the backend's own example, trimmed). */
const REASONS = {
  reasons: [
    {
      value: 'correction',
      label: 'Correction',
      description: 'The number in the system was wrong: put it right.',
      direction: 'either',
      suggested_mode: 'set',
      is_default: true,
    },
    {
      value: 'received',
      label: 'Received',
      direction: 'increase',
      suggested_mode: 'adjust',
      is_default: false,
    },
    {
      value: 'damaged',
      label: 'Damaged',
      direction: 'decrease',
      suggested_mode: 'adjust',
      is_default: false,
    },
  ],
  quantities: [
    { name: 'available', label: 'Available', editable: true, set_supported: true },
    { name: 'on_hand', label: 'On hand', editable: true, set_supported: true },
    { name: 'committed', label: 'Committed', editable: false, set_supported: false },
    {
      name: 'damaged',
      label: 'Unavailable: Damaged',
      editable: true,
      set_supported: false,
    },
  ],
  modes: [
    { value: 'set', label: 'Set to', help: 'Type the new total.' },
    { value: 'adjust', label: 'Adjust by', help: 'Type + or - units.' },
  ],
}

const list = vi.mocked(api.inventory.list)
const reasonsCall = vi.mocked(api.inventory.reasons)
const detail = vi.mocked(api.inventory.detail)
const set = vi.mocked(api.inventory.set)
const adjust = vi.mocked(api.inventory.adjust)
const history = vi.mocked(api.inventory.history)
const adjustment = vi.mocked(api.inventory.adjustment)

const WRITE_OK = { adjustments: [{ id: 'adj-1', status: 'pending' }] }

function renderPage(route = '/inventory') {
  return renderWithProviders(
    <Routes>
      <Route path="/inventory/*" element={<InventoryPage />} />
    </Routes>,
    { route },
  )
}

const never = () => new Promise<never>(() => undefined)

beforeEach(() => {
  list.mockResolvedValue(LIST)
  reasonsCall.mockResolvedValue(REASONS)
  detail.mockResolvedValue(DETAIL)
  set.mockResolvedValue(WRITE_OK)
  adjust.mockResolvedValue(WRITE_OK)
  adjustment.mockResolvedValue({ id: 'adj-1', status: 'synced' })
  history.mockResolvedValue({
    items: [
      {
        id: 'h-1',
        created_at: '2026-11-03T10:00:00Z',
        user: 'Kairav',
        title: 'Hippo Bag',
        sku: 'HB-S',
        location_name: 'Unit 9',
        quantity_name: 'available',
        mode: 'adjust',
        quantity_before: 5,
        quantity_after: 17,
        delta: 12,
        reason: 'received',
        note: 'Delivery PO-1041',
        status: 'synced',
        synced_at: '2026-11-03T10:00:04Z',
      },
    ],
    page: 1,
    page_size: 25,
    total: 1,
    total_pages: 1,
    has_next: false,
  })
  trackingConfig.intervalMs = 5
  trackingConfig.maxMs = 2000
})

afterEach(() => {
  vi.clearAllMocks()
})

const kpi = (label: string) =>
  screen.getByText(label, { selector: 'span' }).parentElement as HTMLElement

describe('the inventory list', () => {
  it('shows the figures from the answer and a row per variant — and no chips: the stock status is in Filters', async () => {
    renderPage()

    expect(
      await screen.findByRole('button', { name: 'View Hippo Bag Small' }),
    ).toBeInTheDocument()
    // Only the four figures asked for: variants, in stock, low stock and out of stock.
    expect(within(kpi('Variants')).getByText('2')).toBeInTheDocument()
    expect(within(kpi('In stock')).getByText('1')).toBeInTheDocument()
    expect(within(kpi('Low stock')).getByText('0')).toBeInTheDocument()
    expect(within(kpi('Out of stock')).getByText('1')).toBeInTheDocument()
    for (const gone of ['On hand', 'Committed', 'Incoming', 'Unavailable'])
      expect(screen.queryByText(gone, { selector: 'span' })).toBeNull()

    const table = screen.getByRole('table')
    // There is no Barcode column.
    expect(within(table).queryByRole('columnheader', { name: /Barcode/ })).toBeNull()
    expect(within(table).queryByText('5012345678900')).toBeNull()
    const hippo = within(within(table).getByText('HB-S').closest('tr') as HTMLElement)
    expect(hippo.getByText('Hippo Bag')).toBeInTheDocument()
    expect(hippo.getByText('Small')).toBeInTheDocument()
    expect(hippo.getByText('Active')).toBeInTheDocument()
    // A variant Shopify does not track has no numbers and no edit button.
    const lid = within(within(table).getByText('FL-1').closest('tr') as HTMLElement)
    expect(lid.getByText('Not tracked')).toBeInTheDocument()
    expect(lid.queryByRole('button', { name: /^Edit stock of/ })).toBeNull()

    expect(screen.queryByRole('group', { name: 'Stock status' })).toBeNull()
  })

  it('has the stock status as the first field of the Filters grid, each choice with its count', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Hippo Bag')

    await user.click(screen.getByRole('button', { name: 'Filters' }))
    const status = screen.getByLabelText('Stock status')
    expect(
      within(status)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['All variants (2)', 'In stock (1)', 'Low stock (0)', 'Out of stock (1)'])
    expect(status).toHaveValue('')
  })

  it('asks for the list with the paging and sort of the first page', async () => {
    renderPage()
    await screen.findByText('Hippo Bag')

    expect(list).toHaveBeenCalledWith({
      sort: 'title',
      order: 'asc',
      page: 1,
      page_size: 25,
    })
  })

  it('filters by a location and by a stock status, keeping the counts of the choices', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Hippo Bag')

    await user.selectOptions(screen.getByLabelText('Location'), 'Unit 9 (2)')
    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(
        expect.objectContaining({ location: String(UNIT9) }),
      ),
    )

    await user.click(screen.getByRole('button', { name: 'Filters' }))
    await user.selectOptions(screen.getByLabelText('Stock status'), 'in_stock')
    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'in_stock', location: String(UNIT9) }),
      ),
    )
    expect(screen.getByLabelText('Stock status')).toHaveValue('in_stock')
    // The counts are still the ones of the list without a stock status.
    expect(
      within(screen.getByLabelText('Stock status'))
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['All variants (2)', 'In stock (1)', 'Low stock (0)', 'Out of stock (1)'])
  })

  it('filters by stock status from the cards: each card is a filter, pressing it again shows all', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Hippo Bag')
    const card = (label: string) =>
      screen.getByRole('button', { name: new RegExp(`^${label}`) })

    // Every variant to begin with.
    expect(card('Variants')).toHaveAttribute('aria-pressed', 'true')
    expect(card('Out of stock')).toHaveAttribute('aria-pressed', 'false')

    await user.click(card('Out of stock'))
    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'out', page: 1 }),
      ),
    )
    expect(card('Out of stock')).toHaveAttribute('aria-pressed', 'true')
    expect(card('Variants')).toHaveAttribute('aria-pressed', 'false')
    // The Stock status dropdown in Filters follows along, and the figures stay as they were.
    await user.click(screen.getByRole('button', { name: 'Filters' }))
    expect(screen.getByLabelText('Stock status')).toHaveValue('out')
    expect(within(kpi('In stock')).getByText('1')).toBeInTheDocument()

    // Another card switches the filter over.
    await user.click(card('Low stock'))
    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'low' })),
    )
    expect(screen.getByLabelText('Stock status')).toHaveValue('low')

    // Pressing the one that is on again shows all; so does Variants.
    await user.click(card('Low stock'))
    await waitFor(() => expect(screen.getByLabelText('Stock status')).toHaveValue(''))
    // (All variants was seen before, so it shows at once from the cache — no new request.)

    await user.click(card('In stock'))
    await waitFor(() =>
      expect(screen.getByLabelText('Stock status')).toHaveValue('in_stock'),
    )
    await user.click(card('Variants'))
    await waitFor(() => expect(screen.getByLabelText('Stock status')).toHaveValue(''))
    expect(card('Variants')).toHaveAttribute('aria-pressed', 'true')
  })

  it('has no row accordion and no Edit stock button: View is the only row action', async () => {
    renderPage()
    await screen.findByText('Hippo Bag')

    expect(screen.queryByRole('button', { name: /^Show locations of/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Edit stock of/ })).toBeNull()
    expect(
      screen.getByRole('button', { name: 'View Hippo Bag Small' }),
    ).toBeInTheDocument()
    // The pencils beside Available and On hand are how a quantity is changed from the list.
    expect(
      screen.getByRole('button', { name: /^Edit available of Hippo Bag/ }),
    ).toBeInTheDocument()
  })

  it('says so when the list cannot be loaded, and tries again', async () => {
    list.mockRejectedValueOnce(new ApiError('The server is busy.', { status: 503 }))
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText("Couldn't load the inventory")).toBeInTheDocument()
    expect(screen.getByText('The server is busy.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Hippo Bag')).toBeInTheDocument()
  })
})

describe('changing stock from the list — instant, then confirmed by Shopify', () => {
  // The location lines are on the variant's own page (the list has no accordion any more).
  async function openLines(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole('button', { name: 'View Hippo Bag Small' }))
    await screen.findByRole('heading', { level: 1, name: 'Hippo Bag' })
  }
  /** The double-click cell of one location's line (its button says the number it holds). */
  const cell = (place: string, shows: string) =>
    within(
      within(screen.getByRole('article')).getByText(place).closest('tr') as HTMLElement,
    ).getByRole('button', { name: shows })

  it('double-click, type, Enter, Yes: the numbers move at once, then "Sending to Shopify…" and "Confirmed"', async () => {
    const user = userEvent.setup()
    // The server has not answered yet — everything below is the instant update.
    set.mockImplementation(never)
    renderPage()
    await openLines(user)

    await user.dblClick(cell('Unit 9', '5'))
    // The box is as wide as its text and grows as more is typed — it is not held to the cell.
    const box = screen.getByRole('textbox', { name: /^Available of / })
    expect(box.style.width).toBe('calc(2ch + 1.25rem)')
    await user.keyboard('22')
    expect(box.style.width).toBe('calc(3ch + 1.25rem)')
    await user.keyboard('{Enter}')
    // The question says what changes.
    const dialog = screen.getByRole('alertdialog')
    expect(within(dialog).getByText('Available at Unit 9')).toBeInTheDocument()
    expect(within(dialog).getByText('5')).toBeInTheDocument()
    expect(within(dialog).getByText('22')).toBeInTheDocument()
    expect(set).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Yes, update' }))

    expect(set).toHaveBeenCalledWith('v-1', {
      location_id: UNIT9,
      quantities: { available: 22 },
      reason: 'correction',
    })
    // The line shows the new number at once — no reload.
    expect(cell('Unit 9', '22')).toBeInTheDocument()
  })

  it('the pencil beside Available opens a small box: Set to, a number and ✓ send one quantity', async () => {
    const user = userEvent.setup()
    set.mockImplementation(never)
    renderPage()
    await screen.findByText('Hippo Bag')

    await user.click(screen.getByRole('button', { name: /^Edit available of Hippo Bag/ }))
    const box = within(
      screen.getByRole('dialog', { name: /^Edit available of Hippo Bag/ }),
    )
    // Location and Quantity are the backend's lists; Reason and Note sit behind the notes button.
    expect(box.getByLabelText('Location')).toBeInTheDocument()
    expect(box.getByLabelText('Quantity')).toHaveValue('available')
    // "Set to" is the mode it opens on, and lists every editable quantity the backend has.
    expect(box.getByLabelText('How to change the stock')).toHaveValue('set')
    await waitFor(() =>
      expect(
        within(box.getByLabelText('Quantity'))
          .getAllByRole('option')
          .map((option) => option.textContent),
      ).toEqual(['Available', 'On hand', 'Unavailable: Damaged']),
    )
    // The reason is behind the highlighted button: every reason the backend has, none chosen to begin with.
    expect(box.queryByLabelText('Reason')).not.toBeInTheDocument()
    await user.click(box.getByRole('button', { name: 'Reason and note' }))
    await waitFor(() =>
      expect(
        within(box.getByLabelText('Reason'))
          .getAllByRole('option')
          .map((option) => option.textContent),
      ).toEqual(['Add reason', 'Correction', 'Received', 'Damaged']),
    )
    expect(box.getByLabelText('Reason')).toHaveValue('')
    await user.click(box.getByRole('button', { name: 'Reason and note' }))

    await user.type(box.getByLabelText('New quantity'), '30')
    await user.click(box.getByRole('button', { name: 'Save stock' }))

    expect(set).toHaveBeenCalledWith('v-1', {
      location_id: UNIT9,
      quantities: { available: 30 },
    })
  })

  it('the small box: Adjust by checks the amount; Reason and Note are behind the highlighted button', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Hippo Bag')

    await user.click(screen.getByRole('button', { name: /^Edit on hand of Hippo Bag/ }))
    const box = within(screen.getByRole('dialog', { name: /^Edit on hand of Hippo Bag/ }))
    await user.selectOptions(box.getByLabelText('How to change the stock'), 'adjust')
    await user.type(box.getByLabelText('Amount to add or remove'), '0')
    await user.click(box.getByRole('button', { name: 'Save stock' }))
    expect(box.getByRole('alert')).toHaveTextContent('The amount can’t be 0')
    expect(adjust).not.toHaveBeenCalled()

    await user.clear(box.getByLabelText('Amount to add or remove'))
    await user.type(box.getByLabelText('Amount to add or remove'), '12')
    await user.click(box.getByRole('button', { name: 'Reason and note' }))
    await user.selectOptions(box.getByLabelText('Reason'), 'Received')
    await user.type(box.getByLabelText('Note (optional)'), 'Delivery PO-1041')
    await user.click(box.getByRole('button', { name: 'Save stock' }))

    await waitFor(() => expect(adjust).toHaveBeenCalledTimes(1))
    expect(adjust).toHaveBeenCalledWith('v-1', {
      location_id: UNIT9,
      name: 'on_hand',
      delta: 12,
      reason: 'received',
      note: 'Delivery PO-1041',
    })
  })

  it('the small box: Adjust by has From and To — an addition adds to a quantity, a removal takes from it', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Hippo Bag')

    await user.click(screen.getByRole('button', { name: /^Edit available of Hippo Bag/ }))
    const box = within(
      screen.getByRole('dialog', { name: /^Edit available of Hippo Bag/ }),
    )
    await user.selectOptions(box.getByLabelText('How to change the stock'), 'adjust')
    // Begins as an addition to the quantity the pencil is for.
    expect(box.getByLabelText('From')).toHaveValue('@addition')
    expect(box.getByLabelText('To')).toHaveValue('available')

    // Taking away: from the quantity to Inventory removal.
    await user.selectOptions(box.getByLabelText('From'), 'available')
    await user.selectOptions(box.getByLabelText('To'), '@removal')
    await user.type(box.getByLabelText('Amount to add or remove'), '2')
    await user.click(box.getByRole('button', { name: 'Save stock' }))

    await waitFor(() => expect(adjust).toHaveBeenCalledTimes(1))
    expect(adjust).toHaveBeenCalledWith('v-1', {
      location_id: UNIT9,
      name: 'available',
      delta: -2,
    })
  })

  it('the small box: moving stock between two quantities is explained and not sent', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Hippo Bag')

    await user.click(screen.getByRole('button', { name: /^Edit available of Hippo Bag/ }))
    const box = within(
      screen.getByRole('dialog', { name: /^Edit available of Hippo Bag/ }),
    )
    await user.selectOptions(box.getByLabelText('How to change the stock'), 'adjust')
    await user.selectOptions(box.getByLabelText('From'), 'available')
    await user.selectOptions(box.getByLabelText('To'), 'damaged')
    await user.type(box.getByLabelText('Amount to add or remove'), '2')
    await user.click(box.getByRole('button', { name: 'Save stock' }))

    expect(box.getByRole('alert')).toHaveTextContent(
      'Moving stock from one quantity to another isn’t available yet.',
    )
    expect(adjust).not.toHaveBeenCalled()
  })

  it('the small box: "Set to" a quantity the backend cannot set directly is sent as an adjustment of the difference', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Hippo Bag')

    await user.click(screen.getByRole('button', { name: /^Edit available of Hippo Bag/ }))
    const box = within(
      screen.getByRole('dialog', { name: /^Edit available of Hippo Bag/ }),
    )
    await user.selectOptions(box.getByLabelText('Quantity'), 'damaged')
    await user.type(box.getByLabelText('New quantity'), '4')
    await user.click(box.getByRole('button', { name: 'Save stock' }))

    // Damaged was 0 at Unit 9, so "set to 4" is "adjust by +4".
    await waitFor(() => expect(adjust).toHaveBeenCalledTimes(1))
    expect(adjust).toHaveBeenCalledWith('v-1', {
      location_id: UNIT9,
      name: 'damaged',
      delta: 4,
    })
    expect(set).not.toHaveBeenCalled()
  })

  it('the small box closes on Escape and sends nothing', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Hippo Bag')

    await user.click(screen.getByRole('button', { name: /^Edit available of Hippo Bag/ }))
    expect(screen.getByRole('dialog', { name: /^Edit available of/ })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: /^Edit available of/ })).toBeNull()
    expect(set).not.toHaveBeenCalled()
  })

  it('shows the notice while Shopify has it, and "Confirmed by Shopify" once it is synced', async () => {
    const user = userEvent.setup()
    adjustment
      .mockResolvedValueOnce({ id: 'adj-1', status: 'pending' })
      .mockResolvedValue({
        id: 'adj-1',
        status: 'synced',
      })
    renderPage()
    await openLines(user)

    await user.dblClick(cell('Unit 9', '8'))
    await user.keyboard('10{Enter}')
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Yes, update',
      }),
    )

    expect(await screen.findByText('Saved. Sending to Shopify…')).toBeInTheDocument()
    expect(await screen.findByText('Confirmed by Shopify')).toBeInTheDocument()
    expect(adjustment).toHaveBeenCalledWith('adj-1')
    // Once confirmed the variant is read again, so the numbers are what Shopify says.
    await waitFor(() => expect(detail).toHaveBeenCalledWith('v-1'))
  })

  it('puts the numbers back and says why when the backend refuses', async () => {
    const user = userEvent.setup()
    set.mockRejectedValue(new ApiError('available can’t be negative.', { status: 422 }))
    renderPage()
    await openLines(user)

    await user.dblClick(cell('Unit 9', '5'))
    await user.keyboard('22{Enter}')
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Yes, update',
      }),
    )

    expect(await screen.findByText('available can’t be negative.')).toBeInTheDocument()
    expect(cell('Unit 9', '5')).toBeInTheDocument()
  })

  it('shows an error from Shopify with the reason and Try again, which sends it again', async () => {
    const user = userEvent.setup()
    adjustment.mockResolvedValue({
      id: 'adj-1',
      status: 'error',
      error: 'Location is not a location of this store',
    })
    renderPage()
    await openLines(user)

    await user.dblClick(cell('Unit 9', '5'))
    await user.keyboard('22{Enter}')
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Yes, update',
      }),
    )

    expect(
      await screen.findByText('Shopify did not accept this change'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Location is not a location of this store'),
    ).toBeInTheDocument()

    adjustment.mockResolvedValue({ id: 'adj-1', status: 'synced' })
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(set).toHaveBeenCalledTimes(2))
  })

  it('refuses a number that is not a whole number, 0 or more, and sends nothing', async () => {
    const user = userEvent.setup()
    renderPage()
    await openLines(user)

    await user.dblClick(cell('Unit 9', '5'))
    await user.keyboard('-3{Enter}')

    expect(screen.getByRole('alert')).toHaveTextContent('Enter a whole number, 0 or more')
    expect(set).not.toHaveBeenCalled()
  })
})

describe('one variant’s stock', () => {
  async function openVariant(user: ReturnType<typeof userEvent.setup>) {
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'View Hippo Bag Small' }))
    await screen.findByRole('heading', { level: 1, name: 'Hippo Bag' })
  }

  it('the figures have the same small edit box: the pencil beside Available sends one quantity', async () => {
    const user = userEvent.setup()
    set.mockImplementation(() => new Promise<never>(() => undefined))
    await openVariant(user)

    const page = within(screen.getByRole('article'))
    await user.click(page.getByRole('button', { name: /^Edit available of Hippo Bag/ }))
    const box = within(
      screen.getByRole('dialog', { name: /^Edit available of Hippo Bag/ }),
    )
    await user.type(box.getByLabelText('New quantity'), '40')
    await user.click(box.getByRole('button', { name: 'Save stock' }))

    expect(set).toHaveBeenCalledWith('v-1', {
      location_id: UNIT9,
      quantities: { available: 40 },
    })
  })

  it('opens it in the same page, with a tab, its header, the figures and the stock by location', async () => {
    const user = userEvent.setup()
    await openVariant(user)

    expect(screen.getByRole('navigation', { name: 'Open variants' })).toBeInTheDocument()
    const page = within(screen.getByRole('article'))
    expect(page.getByText('HB-S')).toBeInTheDocument()
    expect(screen.getByText('Stops selling at 0')).toBeInTheDocument()
    expect(screen.getByText('Polymer UK')).toBeInTheDocument()
    const stock = within(screen.getByRole('tabpanel'))
    expect(stock.getByText('Unit 9')).toBeInTheDocument()
    expect(stock.getByText('Stanmore Warehouse')).toBeInTheDocument()
    // A totals row.
    expect(stock.getByText('Total')).toBeInTheDocument()
    expect(detail).toHaveBeenCalledWith('v-1')
  })

  it('"Set to": the window starts on the row clicked, previews before → after and sends one quantity', async () => {
    const user = userEvent.setup()
    // What Shopify will say once it has the change (so the quiet re-read agrees with the screen).
    detail.mockResolvedValueOnce(DETAIL).mockResolvedValue({
      ...DETAIL,
      locations: [
        line(UNIT9, 'Unit 9', { available: 22, on_hand: 25 }),
        DETAIL.locations[1],
      ],
    })
    await openVariant(user)

    await user.click(screen.getByRole('button', { name: 'Set stock at Unit 9' }))
    const dialog = within(screen.getByRole('dialog', { name: /^Edit stock/ }))
    expect(dialog.getByLabelText('Location')).toHaveValue(String(UNIT9))
    expect(dialog.getByRole('button', { name: 'Set to' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await user.type(dialog.getByLabelText('New quantity'), '22')
    const preview = within(dialog.getByRole('group', { name: 'Preview' }))
    expect(preview.getByText('Available')).toBeInTheDocument()
    expect(preview.getByText('22')).toBeInTheDocument()
    // On hand follows: 8 → 25.
    expect(preview.getByText('25')).toBeInTheDocument()

    await user.type(dialog.getByLabelText(/^Note/), 'Stock count 3 Nov')
    await user.click(dialog.getByRole('button', { name: 'Save stock' }))

    await waitFor(() => expect(set).toHaveBeenCalledTimes(1))
    expect(set).toHaveBeenCalledWith('v-1', {
      location_id: UNIT9,
      quantities: { available: 22 },
      reason: 'correction',
      note: 'Stock count 3 Nov',
    })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    // The table already shows it: 22 at Unit 9.
    const table = within(screen.getByRole('tabpanel'))
    const unit9 = table.getByText('Unit 9').closest('tr') as HTMLElement
    expect(within(unit9).getByText('22')).toBeInTheDocument()
    expect(await screen.findByText('Confirmed by Shopify')).toBeInTheDocument()
  })

  it('"Adjust by": checks the amount, then sends the amount, the reason and the note', async () => {
    const user = userEvent.setup()
    await openVariant(user)

    await user.click(screen.getByRole('button', { name: 'Adjust stock at Unit 9' }))
    const dialog = within(screen.getByRole('dialog', { name: /^Edit stock/ }))
    await user.click(dialog.getByRole('button', { name: 'Adjust by' }))

    // 5 are there: -6 would go below zero.
    await user.type(dialog.getByLabelText('Amount to add or remove'), '-6')
    await user.click(dialog.getByRole('button', { name: 'Save stock' }))
    expect(dialog.getByRole('alert')).toHaveTextContent(
      'That would take the quantity below 0',
    )
    expect(adjust).not.toHaveBeenCalled()

    await user.clear(dialog.getByLabelText('Amount to add or remove'))
    await user.type(dialog.getByLabelText('Amount to add or remove'), '12')
    await user.selectOptions(dialog.getByLabelText('Reason'), 'Received')
    await user.type(dialog.getByLabelText(/^Note/), 'Delivery PO-1041')
    await user.click(dialog.getByRole('button', { name: 'Save stock' }))

    await waitFor(() => expect(adjust).toHaveBeenCalledTimes(1))
    expect(adjust).toHaveBeenCalledWith('v-1', {
      location_id: UNIT9,
      name: 'available',
      delta: 12,
      reason: 'received',
      note: 'Delivery PO-1041',
    })
  })

  it('keeps the window open with the backend’s message when the change is refused', async () => {
    const user = userEvent.setup()
    set.mockRejectedValue(new ApiError('Variant not found.', { status: 404 }))
    await openVariant(user)

    await user.click(screen.getByRole('button', { name: 'Set stock at Unit 9' }))
    const dialog = within(screen.getByRole('dialog', { name: /^Edit stock/ }))
    await user.type(dialog.getByLabelText('New quantity'), '9')
    await user.click(dialog.getByRole('button', { name: 'Save stock' }))

    expect(await dialog.findByText('Variant not found.')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('can stock the variant at a location it has none at yet', async () => {
    const user = userEvent.setup()
    detail.mockResolvedValue({ ...DETAIL, locations: [DETAIL.locations[0]] })
    await openVariant(user)

    await user.click(screen.getByRole('button', { name: 'Stock at another location' }))
    const dialog = within(screen.getByRole('dialog', { name: /^Edit stock/ }))
    expect(dialog.getByLabelText('Location')).toHaveValue(String(STANMORE))
    expect(
      dialog.getByText(/No stock is recorded at this location yet/),
    ).toBeInTheDocument()
    await user.type(dialog.getByLabelText('New quantity'), '4')
    await user.click(dialog.getByRole('button', { name: 'Save stock' }))

    await waitFor(() =>
      expect(set).toHaveBeenCalledWith(
        'v-1',
        expect.objectContaining({ location_id: STANMORE, quantities: { available: 4 } }),
      ),
    )
  })

  it('shows its history on a tab, filtered to this variant', async () => {
    const user = userEvent.setup()
    await openVariant(user)

    await user.click(screen.getByRole('tab', { name: /^History/ }))

    await waitFor(() =>
      expect(history).toHaveBeenCalledWith({ variant_id: 'v-1', page: 1, page_size: 25 }),
    )
    const row = (await screen.findByText('Delivery PO-1041')).closest('tr') as HTMLElement
    expect(within(row).getByText('Kairav')).toBeInTheDocument()
    expect(within(row).getByText('Received')).toBeInTheDocument()
    expect(within(row).getByText('(+12)')).toBeInTheDocument()
    expect(within(row).getByText('Synced')).toBeInTheDocument()
  })
})

describe('the stock history page', () => {
  it('opens laid out like a product page: header, no tab strip, and Back to list', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Hippo Bag')

    await user.click(screen.getByRole('button', { name: 'Stock history' }))

    const page = within(await screen.findByRole('article'))
    expect(page.getByRole('heading', { name: 'Stock history' })).toBeInTheDocument()
    expect(page.queryByRole('tab')).toBeNull()
    expect(await page.findByText('Delivery PO-1041')).toBeInTheDocument()

    await user.click(page.getByRole('button', { name: 'Back to list' }))
    expect(
      await screen.findByRole('button', { name: 'Stock history' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('article')).toBeNull()
  })

  it('lists every change, with filters for location and status', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Hippo Bag')

    await user.click(screen.getByRole('button', { name: 'Stock history' }))

    expect(
      await screen.findByRole('heading', { name: 'Stock history' }),
    ).toBeInTheDocument()
    await waitFor(() => expect(history).toHaveBeenCalledWith({ page: 1, page_size: 25 }))
    expect(await screen.findByText('Delivery PO-1041')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Status'), 'Error')
    await waitFor(() =>
      expect(history).toHaveBeenLastCalledWith({
        status: 'error',
        page: 1,
        page_size: 25,
      }),
    )
  })
})
