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
/** Chooses a variant from the dropdown ("Medium / Red"). */
const choose = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  await user.selectOptions(screen.getByLabelText('Choose a variant'), name)
}

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

    await choose(user, 'Medium / Red')
    expect(
      screen.getByRole('figure', { name: 'Picture of Medium / Red' }),
    ).toBeInTheDocument()
    expect(price().getByText('£62.00')).toBeInTheDocument()
    expect(price().getByText('Out of stock')).toBeInTheDocument()
    const fields = details('Medium / Red')
    expect(fields.getByRole('button', { name: 'SKU-3' })).toBeInTheDocument()
    expect(fields.getByText('250 g')).toBeInTheDocument()
    expect(fields.getByText('Stops selling')).toBeInTheDocument()

    await choose(user, 'Small / Black')
    expect(price().getByText('£200.00')).toBeInTheDocument()
    expect(price().getByText('10 in stock')).toBeInTheDocument()
  })

  it('changes a value by double-clicking it, after "Are you sure?"', async () => {
    const user = userEvent.setup()
    renderWithProviders(<VariantsPanel product={PRODUCT} />)

    await choose(user, 'Small / Black')
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
      expect(screen.queryByRole('button', { name: 'Save Changes' })).toBeNull()
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
  })

  describe('one place to choose the variant', () => {
    it('is a dropdown of every variant — no option rows and no second list', async () => {
      const user = userEvent.setup()
      renderWithProviders(<VariantsPanel product={PRODUCT} />)

      expect(screen.getAllByRole('region', { name: 'Variants' })).toHaveLength(1)
      expect(screen.queryByRole('region', { name: 'Variant options' })).toBeNull()
      expect(screen.queryByRole('list', { name: 'Variants' })).toBeNull()
      const dropdown = screen.getByLabelText('Choose a variant')
      expect(dropdown).toHaveValue('v1')
      expect(
        within(dropdown)
          .getAllByRole('option')
          .map((o) => o.textContent),
      ).toEqual(['Small / Red', 'Small / Black', 'Medium / Red'])

      await user.selectOptions(dropdown, 'Medium / Red')
      expect(
        screen.getByRole('figure', { name: 'Picture of Medium / Red' }),
      ).toBeInTheDocument()
    })
  })

  describe('choosing a picture: from media or by web address', () => {
    beforeEach(() => {
      vi.mocked(api.products.details).mockResolvedValue(PICTURED)
    })

    it('Change image shows both ways before anything is chosen, and sends a new address with the media', async () => {
      const user = userEvent.setup()
      renderWithProviders(<VariantsPanel product={PICTURED} />)

      await user.click(picture().getByRole('button', { name: 'Change image' }))
      const dialog = within(
        screen.getByRole('dialog', { name: 'Change the picture of Small / Red' }),
      )
      expect(dialog.getByRole('button', { name: 'From media' })).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      expect(dialog.getByRole('button', { name: 'Web address' })).toBeInTheDocument()

      await user.click(dialog.getByRole('button', { name: 'Web address' }))
      await user.type(
        dialog.getByLabelText(/^Picture web address/),
        'https://cdn.example.com/new.jpg',
      )
      await user.click(dialog.getByRole('button', { name: 'Use this picture' }))
      await confirmUpdate(user)

      await waitFor(() => expect(update).toHaveBeenCalledTimes(1))
      expect(update.mock.calls[0][1]).toEqual(
        expect.objectContaining({
          media_add: [
            expect.objectContaining({ url: 'https://cdn.example.com/new.jpg' }),
          ],
        }),
      )
    })

    it('the New variant window offers both in its Picture section; a media picture is used by its address', async () => {
      const user = userEvent.setup()
      renderWithProviders(<VariantsPanel product={PICTURED} />)

      await user.click(screen.getByRole('button', { name: 'Add variant' }))
      const win = within(screen.getByRole('dialog', { name: 'New variant' }))
      await user.click(win.getByRole('button', { name: 'Picture' }))
      expect(win.getByRole('button', { name: 'From media' })).toBeInTheDocument()
      expect(win.getByRole('button', { name: 'Web address' })).toBeInTheDocument()

      await user.click(win.getByRole('button', { name: 'Image 2' }))
      await user.type(win.getByLabelText('Size'), 'Large')
      await user.type(win.getByLabelText('Color'), 'Red')
      await user.type(win.getByLabelText('Price'), '71.5')
      await user.click(win.getByRole('button', { name: 'Add variant' }))
      await confirmUpdate(user)

      await waitFor(() => expect(update).toHaveBeenCalledTimes(1))
      expect(update.mock.calls[0][1].variants?.[0]).toEqual(
        expect.objectContaining({ image_url: IMAGES[1]!.url }),
      )
    })

    it('the Edit Variant page has both too, in its Picture card', async () => {
      const user = userEvent.setup()
      renderWithProviders(<VariantsPanel product={PICTURED} />)

      await user.click(screen.getByRole('button', { name: 'Edit variants' }))
      const win = within(
        screen.getByRole('region', { name: 'Edit variant \u2013 Small / Red' }),
      )
      expect(win.getByRole('button', { name: 'From media' })).toBeInTheDocument()
      expect(win.getByRole('button', { name: 'Web address' })).toBeInTheDocument()
      expect(win.getByRole('button', { name: 'Image 1' })).toHaveAttribute(
        'aria-pressed',
        'true',
      )
    })
  })

  describe('the Edit Variant page', () => {
    const NAME = 'Edit variant \u2013 '
    const open = async (
      user: ReturnType<typeof userEvent.setup>,
      name = 'Small / Red',
    ) => {
      if (name !== 'Small / Red') await choose(user, name)
      await user.click(screen.getByRole('button', { name: 'Edit variants' }))
      return within(screen.getByRole('region', { name: `${NAME}${name}` }))
    }
    const gone = () =>
      waitFor(() =>
        expect(screen.queryByRole('region', { name: /^Edit variant/ })).toBeNull(),
      )

    it('has no Bulk edit button and no Edit variant button on the details card', () => {
      renderWithProviders(<VariantsPanel product={PRODUCT} />)

      expect(screen.queryByRole('button', { name: 'Bulk edit' })).toBeNull()
      expect(screen.queryByRole('button', { name: /^Edit variant / })).toBeNull()
    })

    it('opens in place of the tab for the chosen variant, with an Editing tab and cards of fields', async () => {
      const user = userEvent.setup()
      renderWithProviders(<VariantsPanel product={PRODUCT} />)

      const win = await open(user, 'Medium / Red')
      expect(
        screen.getByRole('navigation', { name: 'Editing a variant' }),
      ).toBeInTheDocument()
      expect(screen.queryByRole('region', { name: 'Variants' })).toBeNull()
      expect(win.getByRole('heading', { name: 'Edit Variant' })).toBeInTheDocument()
      for (const card of ['Variant', 'Pricing', 'Inventory', 'Shipping', 'Picture']) {
        expect(win.getByRole('region', { name: card })).toBeInTheDocument()
      }
      expect(win.getByText('Unit price')).toBeInTheDocument()
      expect(win.getByLabelText('Price')).toHaveValue('62.00')
      expect(win.getByLabelText('SKU')).toHaveValue('SKU-3')
      expect(win.getByLabelText('Available')).toHaveValue('0')
      expect(win.getByLabelText('Weight')).toHaveValue('250')
      expect(win.getByRole('checkbox', { name: 'Charge tax' })).toBeChecked()
      // Nothing to save until something changes.
      expect(win.getByRole('button', { name: 'Save Changes' })).toBeDisabled()
    })

    it('has one Shipping card: Physical product and Weight once each, then the packed size, country and HS code', async () => {
      const user = userEvent.setup()
      renderWithProviders(<VariantsPanel product={PRODUCT} />)

      const win = await open(user)
      expect(win.getAllByRole('checkbox', { name: 'Physical product' })).toHaveLength(1)
      expect(win.getAllByLabelText('Weight')).toHaveLength(1)
      expect(win.getByRole('group', { name: 'Packed product size' })).toBeInTheDocument()
      expect(win.getByLabelText('Length')).toBeInTheDocument()
      expect(win.getByLabelText('Country of origin')).toBeInTheDocument()
      expect(win.getByLabelText('HS code')).toBeInTheDocument()

      await user.type(win.getByLabelText('Length'), '22')
      await user.type(win.getByLabelText('Width'), '13')
      await user.type(win.getByLabelText('Height'), '4')
      await user.click(win.getByRole('button', { name: 'Save Changes' }))
      await confirmUpdate(user)
      await waitFor(() => expect(update).toHaveBeenCalledTimes(1))
      expect(update.mock.calls[0][1].variants?.[0]).toEqual(
        expect.objectContaining({
          id: 'v1',
          packed_dimensions: expect.objectContaining({
            length: 22,
            width: 13,
            height: 4,
          }),
        }),
      )
    })

    it('the unit price follows the price typed, and Save Changes sends only what changed after "Are you sure?", then returns to the tab', async () => {
      const user = userEvent.setup()
      renderWithProviders(<VariantsPanel product={PRODUCT} />)

      const win = await open(user)
      const price = win.getByLabelText('Price')
      await user.clear(price)
      await user.type(price, '55')
      expect(win.getByText('\u00a355.00')).toBeInTheDocument()
      await user.clear(win.getByLabelText('SKU'))
      await user.type(win.getByLabelText('SKU'), 'HM-NEW')

      await user.click(win.getByRole('button', { name: 'Save Changes' }))
      expect(update).not.toHaveBeenCalled()
      await confirmUpdate(user)

      await waitFor(() =>
        expect(update).toHaveBeenCalledWith(
          'id-1',
          { variants: [{ id: 'v1', price: '55', sku: 'HM-NEW' }] },
          'polymer-uk',
        ),
      )
      await gone()
      expect(
        screen.getByRole('figure', { name: 'Picture of Small / Red' }),
      ).toBeInTheDocument()
    })

    it('says what is wrong instead of asking, when a price is not a number', async () => {
      const user = userEvent.setup()
      renderWithProviders(<VariantsPanel product={PRODUCT} />)

      const win = await open(user)
      await user.clear(win.getByLabelText('Price'))
      await user.type(win.getByLabelText('Price'), 'abc')
      await user.click(win.getByRole('button', { name: 'Save Changes' }))

      expect(await win.findByText('Enter a number, 0 or more')).toBeInTheDocument()
      expect(screen.queryByRole('alertdialog')).toBeNull()
      expect(update).not.toHaveBeenCalled()
    })

    it('Cancel and Back leave at once when nothing changed, and ask first when something did', async () => {
      const user = userEvent.setup()
      renderWithProviders(<VariantsPanel product={PRODUCT} />)

      let win = await open(user)
      await user.click(win.getByRole('button', { name: 'Cancel' }))
      await gone()

      win = await open(user)
      await user.click(win.getByRole('button', { name: 'Back to Small / Red' }))
      await gone()

      win = await open(user)
      await user.type(win.getByLabelText('Barcode'), '123')
      await user.click(win.getByRole('button', { name: 'Cancel' }))
      await user.click(screen.getByRole('button', { name: 'Yes, cancel' }))
      await gone()
      expect(update).not.toHaveBeenCalled()
    })
  })

  it('Edit Variants (options): a row per option, and the + turns that row into a value box', async () => {
    const user = userEvent.setup()
    renderWithProviders(<VariantsPanel product={PRODUCT} />)

    await user.click(screen.getByRole('button', { name: 'Edit options' }))
    expect(screen.getByRole('heading', { name: 'Edit Variants' })).toBeInTheDocument()
    expect(screen.getByText('Manage product variants and options')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back to variants' })).toBeInTheDocument()
    const rows = within(screen.getByRole('region', { name: 'Options' }))
    expect(rows.getByLabelText(/^Variant name \(now .Size.\)/)).toHaveValue('Size')
    expect(rows.getByLabelText(/^Variant name \(now .Color.\)/)).toHaveValue('Color')
    // No strip and no note under the options.
    expect(screen.queryByText(/Changes are saved to Shopify/)).toBeNull()
    expect(screen.queryByLabelText('Option to add a value to')).toBeNull()

    // The Color row's + becomes a value box in that row; Enter adds the value.
    await user.click(rows.getByRole('button', { name: 'Add a value to Color' }))
    await user.type(rows.getByLabelText('New value for Color'), 'Green{Enter}')

    // The value joins the Color pills and opens a new variant to be priced below.
    expect(
      within(rows.getByRole('list', { name: 'Values of Color' })).getByText('Green'),
    ).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /^New variants/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeEnabled()
  })

  it('Edit options still opens the whole-tab editor for the options', async () => {
    const user = userEvent.setup()
    renderWithProviders(<VariantsPanel product={PRODUCT} />)

    await user.click(screen.getByRole('button', { name: 'Edit options' }))
    expect(screen.getByRole('heading', { name: 'Edit Variants' })).toBeInTheDocument()
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
})
