import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  api,
  type ProductDetail,
  type ProductWriteResult,
} from '../../../lib/api/endpoints.ts'
import { confirmUpdate } from '../../../test/confirmUpdate.ts'
import { renderWithProviders } from '../../../test/renderWithProviders.tsx'
import { VariantsPanel } from './ProductDetailPanels.tsx'

vi.mock('../../../lib/api/endpoints.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/api/endpoints.ts')>()),
  api: {
    products: {
      list: vi.fn(),
      details: vi.fn(),
      update: vi.fn(),
      syncHistory: vi.fn(),
    },
    inventory: { locations: vi.fn() },
    auth: {},
  },
}))

const update = vi.mocked(api.products.update)
const WRITE_OK: ProductWriteResult = {
  product_id: 'id-1',
  sync_status: 'pending',
  push_id: 'push-1',
  changes: {},
  message: 'Saved.',
}

const variant = (
  n: number,
  size: string,
  color: string,
  price: string,
  stock: number,
) => ({
  id: `v${n}`,
  shopify_id: n,
  title: `${size} / ${color}`,
  sku: `SKU-${n}`,
  barcode: '',
  price,
  compare_at_price: null,
  cost: '10.00',
  currency: 'GBP',
  weight: '250',
  weight_unit: 'GRAMS',
  taxable: true,
  requires_shipping: true,
  inventory_policy: 'DENY',
  inventory_management: 'SHOPIFY',
  inventory_levels: [
    { location_shopify_id: 7, location_name: 'Unit 9', available: stock },
  ],
  inventory_quantity: stock,
  metafields: [],
  selected_options: [
    { name: 'Size', value: size },
    { name: 'Color', value: color },
  ],
  image_url: null,
})

/** Size × Colour: Small has Red and Black, Medium has Red (out of stock). */
const PRODUCT = {
  shop: { key: 'polymer-uk', name: 'Polymer UK', domain: 'polymer-uk-ltd.myshopify.com' },
  id: 'id-1',
  shopify_id: 1,
  title: 'H.M Tshirt',
  handle: 'h-m-tshirt',
  status: 'ACTIVE',
  currency: 'GBP',
  tags: [],
  images: [],
  collections: [],
  metafields: [],
  seo: { title: '', description: null },
  has_only_default_variant: false,
  total_inventory: 35,
  options: [
    { name: 'Size', position: 1, values: ['Small', 'Medium'] },
    { name: 'Color', position: 2, values: ['Red', 'Black'] },
  ],
  variants: [
    variant(1, 'Small', 'Red', '50.00', 25),
    variant(2, 'Small', 'Black', '200.00', 10),
    variant(3, 'Medium', 'Red', '62.00', 0),
  ],
} as unknown as ProductDetail

/** The picture card, the unit-price card and the chosen variant's details. */
const picture = () => within(screen.getByRole('figure'))
const price = () => within(screen.getByRole('region', { name: 'Unit price' }))
const details = (name: string) =>
  within(screen.getByRole('region', { name: `Details of ${name}` }))
const choose = (name: string) => screen.getByRole('button', { name, pressed: undefined })

const IMAGES = [
  { id: 'img-1', url: 'https://cdn.example.com/a.jpg', alt_text: 'Front' },
  { id: 'img-2', url: 'https://cdn.example.com/b.jpg', alt_text: 'Back' },
]
/** The same product with two pictures, the first shown by the first variant. */
const PICTURED = {
  ...PRODUCT,
  images: IMAGES,
  variants: PRODUCT.variants.map((one, index) => ({
    ...one,
    image_url: index === 0 ? IMAGES[0].url : null,
  })),
} as unknown as ProductDetail

beforeEach(() => {
  update.mockResolvedValue(WRITE_OK)
  vi.mocked(api.products.details).mockResolvedValue(PRODUCT)
  vi.mocked(api.products.syncHistory).mockResolvedValue([])
  vi.mocked(api.inventory.locations).mockResolvedValue([])
  vi.mocked(api.products.list).mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    page_size: 25,
    total_pages: 0,
  } as unknown as Awaited<ReturnType<typeof api.products.list>>)
})
afterEach(() => vi.clearAllMocks())

describe('the Variants tab', () => {
  it('has no table: a picture, a unit price and a details card for the chosen variant', () => {
    renderWithProviders(<VariantsPanel product={PRODUCT} />)

    expect(screen.queryByRole('table')).toBeNull()
    expect(
      screen.getByRole('figure', { name: 'Picture of Small / Red' }),
    ).toBeInTheDocument()
    expect(price().getByText('£50.00')).toBeInTheDocument()
    expect(price().getByText('25 in stock')).toBeInTheDocument()
    // Text buttons open the editor; the Edit button carries a small pencil.
    expect(screen.getByRole('button', { name: 'Edit variants' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add variant' })).toBeInTheDocument()
  })

  it('choosing another variant changes the price and every field at once', async () => {
    const user = userEvent.setup()
    renderWithProviders(<VariantsPanel product={PRODUCT} />)

    await user.click(choose('Medium / Red'))
    expect(
      screen.getByRole('figure', { name: 'Picture of Medium / Red' }),
    ).toBeInTheDocument()
    expect(price().getByText('£62.00')).toBeInTheDocument()
    expect(price().getByText('Out of stock')).toBeInTheDocument()
    const fields = details('Medium / Red')
    expect(fields.getByRole('button', { name: 'SKU-3' })).toBeInTheDocument()
    expect(fields.getByText('250 g')).toBeInTheDocument()
    expect(fields.getByText('Stops selling')).toBeInTheDocument()

    await user.click(choose('Small / Black'))
    expect(price().getByText('£200.00')).toBeInTheDocument()
    expect(price().getByText('10 in stock')).toBeInTheDocument()
  })

  it('changes a value by double-clicking it, after "Are you sure?"', async () => {
    const user = userEvent.setup()
    renderWithProviders(<VariantsPanel product={PRODUCT} />)

    await user.click(choose('Small / Black'))
    await user.dblClick(details('Small / Black').getByRole('button', { name: 'SKU-2' }))
    const box = screen.getByRole('textbox', { name: 'SKU of Small / Black' })
    await user.clear(box)
    await user.type(box, 'HM-S-B{Enter}')
    expect(update).not.toHaveBeenCalled()
    await confirmUpdate(user)

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        'id-1',
        { variants: [{ id: 'v2', sku: 'HM-S-B' }] },
        'polymer-uk',
      ),
    )
  })

  it('a blank cost clears it', async () => {
    const user = userEvent.setup()
    renderWithProviders(<VariantsPanel product={PRODUCT} />)

    await user.dblClick(details('Small / Red').getByRole('button', { name: '£10.00' }))
    await user.clear(
      screen.getByRole('textbox', { name: 'Cost per item of Small / Red' }),
    )
    await user.keyboard('{Enter}')
    await confirmUpdate(user)
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        'id-1',
        { variants: [{ id: 'v1', cost: null }] },
        'polymer-uk',
      ),
    )
  })

  describe('the New variant window', () => {
    const win = () => within(screen.getByRole('dialog', { name: 'New variant' }))

    it('Add variant opens it with a box per option, a price and the other fields — not the whole editor', async () => {
      const user = userEvent.setup()
      renderWithProviders(<VariantsPanel product={PRODUCT} />)

      await user.click(screen.getByRole('button', { name: 'Add variant' }))
      expect(win().getByLabelText('Size')).toHaveValue('')
      expect(win().getByLabelText('Color')).toHaveValue('')
      expect(win().getByLabelText('Price')).toHaveValue('')
      expect(win().getByLabelText(/^SKU/)).toBeInTheDocument()
      expect(win().getByLabelText(/^Weight/)).toBeInTheDocument()
      // The whole-tab editor did not open.
      expect(screen.queryByRole('button', { name: 'Save variants' })).toBeNull()
    })

    it('adds one new variant — a typed Large with a chosen colour — and sends only it, after "Are you sure?"', async () => {
      const user = userEvent.setup()
      renderWithProviders(<VariantsPanel product={PRODUCT} />)

      await user.click(screen.getByRole('button', { name: 'Add variant' }))
      await user.type(win().getByLabelText('Size'), 'Large')
      await user.type(win().getByLabelText('Color'), 'Red')
      await user.type(win().getByLabelText('Price'), '71.5')
      await user.type(win().getByLabelText(/^SKU/), 'HM-L-R')
      await user.type(win().getByLabelText(/^Weight/), '300')
      await user.click(win().getByRole('button', { name: 'Add variant' }))
      expect(update).not.toHaveBeenCalled()
      await confirmUpdate(user)

      await waitFor(() => expect(update).toHaveBeenCalledTimes(1))
      expect(update.mock.calls[0][1]).toEqual({
        variants: [
          expect.objectContaining({
            option_values: ['Large', 'Red'],
            price: '71.5',
            sku: 'HM-L-R',
            weight: '300',
          }),
        ],
      })
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    })

    it('says what is missing instead of asking, and refuses a combination that exists', async () => {
      const user = userEvent.setup()
      renderWithProviders(<VariantsPanel product={PRODUCT} />)

      await user.click(screen.getByRole('button', { name: 'Add variant' }))
      await user.click(win().getByRole('button', { name: 'Add variant' }))
      expect(await win().findByText('Choose a Size')).toBeInTheDocument()
      expect(win().getByText('Choose a Color')).toBeInTheDocument()
      expect(win().getByText('Enter a price')).toBeInTheDocument()

      await user.type(win().getByLabelText('Size'), 'Small')
      await user.type(win().getByLabelText('Color'), 'Red')
      await user.type(win().getByLabelText('Price'), '9')
      await user.click(win().getByRole('button', { name: 'Add variant' }))
      expect(
        await win().findByText('A variant with these values already exists'),
      ).toBeInTheDocument()
      expect(screen.queryByRole('alertdialog')).toBeNull()
      expect(update).not.toHaveBeenCalled()
    })

    it('Cancel closes at once when nothing was typed, and asks first when something was', async () => {
      const user = userEvent.setup()
      renderWithProviders(<VariantsPanel product={PRODUCT} />)

      await user.click(screen.getByRole('button', { name: 'Add variant' }))
      await user.click(win().getByRole('button', { name: 'Cancel' }))
      expect(screen.queryByRole('dialog')).toBeNull()

      await user.click(screen.getByRole('button', { name: 'Add variant' }))
      await user.type(win().getByLabelText('Size'), 'Large')
      await user.click(win().getByRole('button', { name: 'Cancel' }))
      await user.click(screen.getByRole('button', { name: 'Yes, cancel' }))
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(update).not.toHaveBeenCalled()
    })

    it('the Edit variant window has a New variant button that switches to it', async () => {
      const user = userEvent.setup()
      renderWithProviders(<VariantsPanel product={PRODUCT} />)

      await user.click(screen.getByRole('button', { name: 'Edit variant Small / Red' }))
      const editWin = within(screen.getByRole('dialog', { name: /^Edit variant/ }))
      await user.click(editWin.getByRole('button', { name: 'New variant' }))

      expect(screen.queryByRole('dialog', { name: /^Edit variant/ })).toBeNull()
      expect(screen.getByRole('dialog', { name: 'New variant' })).toBeInTheDocument()
    })
  })

  describe('the Edit variant window', () => {
    const open = async (
      user: ReturnType<typeof userEvent.setup>,
      name = 'Small / Red',
    ) => {
      await user.click(screen.getByRole('button', { name: `Edit variant ${name}` }))
      return within(screen.getByRole('dialog', { name: `Edit variant \u2013 ${name}` }))
    }

    it('opens for the chosen variant, laid out like the tab: picture, unit price and fields', async () => {
      const user = userEvent.setup()
      renderWithProviders(<VariantsPanel product={PRODUCT} />)

      await user.click(choose('Medium / Red'))
      const win = await open(user, 'Medium / Red')
      expect(win.getByText('Unit price')).toBeInTheDocument()
      expect(win.getByLabelText('Price')).toHaveValue('62.00')
      expect(win.getByLabelText('SKU')).toHaveValue('SKU-3')
      expect(win.getByLabelText('Available')).toHaveValue('0')
      expect(win.getByLabelText('Weight')).toHaveValue('250')
      expect(win.getByRole('checkbox', { name: 'Charge tax' })).toBeChecked()
      // Nothing to save until something changes.
      expect(win.getByRole('button', { name: 'Update variant' })).toBeDisabled()
    })

    it('the unit price follows the price typed, and Update variant sends only what changed after "Are you sure?"', async () => {
      const user = userEvent.setup()
      renderWithProviders(<VariantsPanel product={PRODUCT} />)

      const win = await open(user)
      const price = win.getByLabelText('Price')
      await user.clear(price)
      await user.type(price, '55')
      expect(win.getByText('£55.00')).toBeInTheDocument()
      await user.clear(win.getByLabelText('SKU'))
      await user.type(win.getByLabelText('SKU'), 'HM-NEW')

      await user.click(win.getByRole('button', { name: 'Update variant' }))
      expect(update).not.toHaveBeenCalled()
      await confirmUpdate(user)

      await waitFor(() =>
        expect(update).toHaveBeenCalledWith(
          'id-1',
          { variants: [{ id: 'v1', price: '55', sku: 'HM-NEW' }] },
          'polymer-uk',
        ),
      )
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    })

    it('says what is wrong instead of asking, when a price is not a number', async () => {
      const user = userEvent.setup()
      renderWithProviders(<VariantsPanel product={PRODUCT} />)

      const win = await open(user)
      await user.clear(win.getByLabelText('Price'))
      await user.type(win.getByLabelText('Price'), 'abc')
      await user.click(win.getByRole('button', { name: 'Update variant' }))

      expect(await win.findByText('Enter a number, 0 or more')).toBeInTheDocument()
      expect(screen.queryByRole('alertdialog')).toBeNull()
      expect(update).not.toHaveBeenCalled()
    })

    it('Cancel closes at once when nothing changed, and asks first when something did', async () => {
      const user = userEvent.setup()
      renderWithProviders(<VariantsPanel product={PRODUCT} />)

      let win = await open(user)
      await user.click(win.getByRole('button', { name: 'Cancel' }))
      expect(screen.queryByRole('dialog')).toBeNull()

      win = await open(user)
      await user.type(win.getByLabelText('Barcode'), '123')
      await user.click(win.getByRole('button', { name: 'Cancel' }))
      await user.click(screen.getByRole('button', { name: 'Yes, cancel' }))
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(update).not.toHaveBeenCalled()
    })
  })

  describe('the picture', () => {
    beforeEach(() => {
      vi.mocked(api.products.details).mockResolvedValue(PICTURED)
    })

    it('shows the variant\u2019s own picture, with View Full and Change image', () => {
      renderWithProviders(<VariantsPanel product={PICTURED} />)

      expect(
        picture().getByRole('img', { name: 'Picture of Small / Red' }),
      ).toHaveAttribute('src', IMAGES[0].url)
      expect(picture().getByRole('button', { name: 'View Full' })).toBeInTheDocument()
      expect(picture().getByRole('button', { name: 'Change image' })).toBeInTheDocument()
    })

    it('Change image picks one of the product\u2019s pictures, asks, and sends only that', async () => {
      const user = userEvent.setup()
      renderWithProviders(<VariantsPanel product={PICTURED} />)

      await user.click(picture().getByRole('button', { name: 'Change image' }))
      const dialog = within(
        screen.getByRole('dialog', { name: 'Change the picture of Small / Red' }),
      )
      expect(dialog.getByRole('button', { name: 'Use this picture' })).toBeDisabled()
      expect(dialog.getByRole('button', { name: 'Image 1' })).toHaveAttribute(
        'aria-pressed',
        'true',
      )

      await user.click(dialog.getByRole('button', { name: 'Image 2' }))
      await user.click(dialog.getByRole('button', { name: 'Use this picture' }))
      expect(update).not.toHaveBeenCalled()
      const ask = within(screen.getByRole('alertdialog'))
      expect(ask.getByText('Picture of Small / Red')).toBeInTheDocument()
      expect(ask.getByText('Image 1')).toBeInTheDocument()
      expect(ask.getByText('Image 2')).toBeInTheDocument()
      await confirmUpdate(user)

      await waitFor(() =>
        expect(update).toHaveBeenCalledWith(
          'id-1',
          { variants: [{ id: 'v1', image_attachment_id: 'img-2' }] },
          'polymer-uk',
        ),
      )
    })

    it('Cancel sends nothing', async () => {
      const user = userEvent.setup()
      renderWithProviders(<VariantsPanel product={PICTURED} />)

      await user.click(picture().getByRole('button', { name: 'Change image' }))
      const dialog = within(screen.getByRole('dialog'))
      await user.click(dialog.getByRole('button', { name: 'Image 2' }))
      await user.click(dialog.getByRole('button', { name: 'Cancel' }))
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(update).not.toHaveBeenCalled()
    })
  })

  describe('the option rows', () => {
    const options = () => within(screen.getByRole('region', { name: 'Variant options' }))

    it('shows each option on its own row — Size with its values, Color with its values', () => {
      renderWithProviders(<VariantsPanel product={PRODUCT} />)

      const size = within(options().getByRole('list', { name: 'Values of Size' }))
      expect(size.getAllByRole('button').map((b) => b.textContent)).toEqual([
        'Small',
        'Medium',
      ])
      const color = within(options().getByRole('list', { name: 'Values of Color' }))
      expect(color.getAllByRole('button').map((b) => b.textContent)).toEqual([
        'Red',
        'Black',
      ])
    })

    it('a click on a value makes it a box; Enter asks, and Yes renames just that value', async () => {
      const user = userEvent.setup()
      renderWithProviders(<VariantsPanel product={PRODUCT} />)

      await user.click(options().getByRole('button', { name: 'Medium' }))
      const box = screen.getByLabelText('Value \u201cMedium\u201d of Size')
      expect(box).toHaveValue('Medium')
      await user.clear(box)
      await user.type(box, 'Large{Enter}')

      expect(update).not.toHaveBeenCalled()
      const dialog = screen.getByRole('alertdialog')
      expect(within(dialog).getByText('Value of Size')).toBeInTheDocument()
      expect(within(dialog).getByText('Medium')).toBeInTheDocument()
      expect(within(dialog).getByText('Large')).toBeInTheDocument()
      await confirmUpdate(user)

      await waitFor(() =>
        expect(update).toHaveBeenCalledWith(
          'id-1',
          {
            options_update: [
              { name: 'Size', values_rename: [{ from: 'Medium', to: 'Large' }] },
            ],
          },
          'polymer-uk',
        ),
      )
    })

    it('the option\u2019s name is renamed the same way', async () => {
      const user = userEvent.setup()
      renderWithProviders(<VariantsPanel product={PRODUCT} />)

      await user.click(options().getByRole('button', { name: 'Color' }))
      const box = screen.getByLabelText('Name of option Color')
      await user.clear(box)
      await user.type(box, 'Colour{Enter}')
      await confirmUpdate(user)

      await waitFor(() =>
        expect(update).toHaveBeenCalledWith(
          'id-1',
          { options_update: [{ name: 'Color', new_name: 'Colour' }] },
          'polymer-uk',
        ),
      )
    })

    it('refuses a value the option already has, sends nothing on Escape or an unchanged value', async () => {
      const user = userEvent.setup()
      renderWithProviders(<VariantsPanel product={PRODUCT} />)

      await user.click(options().getByRole('button', { name: 'Medium' }))
      const box = screen.getByLabelText('Value \u201cMedium\u201d of Size')
      await user.clear(box)
      await user.type(box, 'small{Enter}')
      expect(screen.getByRole('alert')).toHaveTextContent('already has that value')
      expect(screen.queryByRole('alertdialog')).toBeNull()

      await user.keyboard('{Escape}')
      expect(screen.queryByLabelText('Value \u201cMedium\u201d of Size')).toBeNull()

      await user.click(options().getByRole('button', { name: 'Red' }))
      await user.keyboard('{Enter}')
      expect(screen.queryByRole('alertdialog')).toBeNull()
      expect(update).not.toHaveBeenCalled()
    })
  })

  it('Bulk edit opens every variant in a spreadsheet, with an All variants row', async () => {
    const user = userEvent.setup()
    renderWithProviders(<VariantsPanel product={PRODUCT} />)

    await user.click(screen.getByRole('button', { name: 'Bulk edit' }))
    const bulk = within(screen.getByRole('region', { name: 'Bulk edit variants' }))
    expect(bulk.getByText('Editing 3 variants')).toBeInTheDocument()

    // The All variants row sets the price of every one; then one SKU is changed on its own.
    await user.type(bulk.getByLabelText('Price for all variants'), '55')
    expect(bulk.getByLabelText('Price for Small / Red')).toHaveValue('55')
    expect(bulk.getByLabelText('Price for Medium / Red')).toHaveValue('55')
    await user.clear(bulk.getByLabelText('SKU for Medium / Red'))
    await user.type(bulk.getByLabelText('SKU for Medium / Red'), 'HM-M')

    await user.click(bulk.getByRole('button', { name: 'Save the variants' }))
    await confirmUpdate(user)

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1))
    expect(update.mock.calls[0][1].variants).toEqual([
      { id: 'v1', price: '55' },
      { id: 'v2', price: '55' },
      { id: 'v3', price: '55', sku: 'HM-M' },
    ])
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Bulk edit variants' })).toBeNull(),
    )
  })

  it('Back from Bulk edit leaves at once when nothing changed, and asks first when it did', async () => {
    const user = userEvent.setup()
    renderWithProviders(<VariantsPanel product={PRODUCT} />)

    await user.click(screen.getByRole('button', { name: 'Bulk edit' }))
    await user.click(screen.getByRole('button', { name: 'Back to list' }))
    expect(
      screen.getByRole('figure', { name: 'Picture of Small / Red' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Bulk edit' }))
    const bulk = within(screen.getByRole('region', { name: 'Bulk edit variants' }))
    await user.type(bulk.getByLabelText('Price for Small / Red'), '9')
    await user.click(bulk.getByRole('button', { name: 'Cancel bulk editing' }))
    await user.click(screen.getByRole('button', { name: 'Yes, cancel' }))
    expect(screen.queryByRole('region', { name: 'Bulk edit variants' })).toBeNull()
    expect(update).not.toHaveBeenCalled()
  })
})
