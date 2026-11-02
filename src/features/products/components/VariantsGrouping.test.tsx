import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ProductDetail } from '../../../lib/api/endpoints.ts'
import { renderWithProviders } from '../../../test/renderWithProviders.tsx'
import { VariantsPanel } from './ProductDetailPanels.tsx'

const variant = (
  n: number,
  chosen: [string, string][],
  price: string,
  stock: number,
) => ({
  id: `v${n}`,
  shopify_id: n,
  title: chosen.map(([, value]) => value).join(' / '),
  sku: `SKU-${n}`,
  barcode: '',
  price,
  compare_at_price: null,
  currency: 'GBP',
  weight: '250',
  weight_unit: 'GRAMS',
  taxable: true,
  requires_shipping: true,
  inventory_policy: 'DENY',
  inventory_management: 'SHOPIFY',
  inventory_levels: [],
  inventory_quantity: stock,
  metafields: [],
  selected_options: chosen.map(([name, value]) => ({ name, value })),
  image_url: null,
})

const base = {
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
}

/** Size × Colour: Small has two colours, Medium one. */
const TWO_OPTIONS = {
  ...base,
  has_only_default_variant: false,
  total_inventory: 160,
  options: [
    { name: 'Size', position: 1, values: ['Small', 'Medium'] },
    { name: 'Color', position: 2, values: ['Red', 'Black'] },
  ],
  variants: [
    variant(
      1,
      [
        ['Size', 'Small'],
        ['Color', 'Red'],
      ],
      '50.00',
      25,
    ),
    variant(
      2,
      [
        ['Size', 'Medium'],
        ['Color', 'Red'],
      ],
      '62.00',
      25,
    ),
    variant(
      3,
      [
        ['Size', 'Small'],
        ['Color', 'Black'],
      ],
      '200.00',
      10,
    ),
  ],
} as unknown as ProductDetail

const ONE_OPTION = {
  ...base,
  has_only_default_variant: false,
  total_inventory: 50,
  options: [{ name: 'Size', position: 1, values: ['Small', 'Medium'] }],
  variants: [
    variant(1, [['Size', 'Small']], '50.00', 25),
    variant(2, [['Size', 'Medium']], '62.00', 25),
  ],
} as unknown as ProductDetail

describe('the Variants tab with two or more options', () => {
  it('groups the variants under the first option, closed to begin with', () => {
    renderWithProviders(<VariantsPanel product={TWO_OPTIONS} />)

    const small = screen.getByRole('button', { name: 'Small, 2 variants' })
    const medium = screen.getByRole('button', { name: 'Medium, 1 variant' })
    expect(small).toHaveAttribute('aria-expanded', 'false')
    expect(medium).toHaveAttribute('aria-expanded', 'false')
    // Only the groups are listed, not the variants inside them.
    expect(screen.queryByText('SKU-1')).not.toBeInTheDocument()

    // A group row shows its price range and its total stock.
    const row = small.closest('tr') as HTMLElement
    expect(within(row).getByText(/£50\.00\s*–\s*£200\.00/)).toBeInTheDocument()
    expect(within(row).getByText('35')).toBeInTheDocument()
  })

  it('opens a group to list its variants, named by the other option', async () => {
    const user = userEvent.setup()
    renderWithProviders(<VariantsPanel product={TWO_OPTIONS} />)

    const small = screen.getByRole('button', { name: 'Small, 2 variants' })
    await user.click(small)

    expect(small).toHaveAttribute('aria-expanded', 'true')
    // Inside the table (the header above it also lists Red and Black as pills).
    const table = within(screen.getByRole('table'))
    expect(table.getByText('Red')).toBeInTheDocument()
    expect(table.getByText('Black')).toBeInTheDocument()
    expect(screen.getByText('SKU-1')).toBeInTheDocument()
    expect(screen.getByText('SKU-3')).toBeInTheDocument()
    // The other group stays closed.
    expect(screen.queryByText('SKU-2')).not.toBeInTheDocument()

    await user.click(small)
    expect(screen.queryByText('SKU-1')).not.toBeInTheDocument()
  })
})

describe('the Variants tab with a single option', () => {
  it('lists the variants flat, with nothing to open', () => {
    renderWithProviders(<VariantsPanel product={ONE_OPTION} />)

    expect(screen.getByText('SKU-1')).toBeInTheDocument()
    expect(screen.getByText('SKU-2')).toBeInTheDocument()
    // No group rows: the table has no toggle buttons at all.
    expect(
      within(screen.getByRole('table')).queryByRole('button', { expanded: false }),
    ).not.toBeInTheDocument()
  })
})
