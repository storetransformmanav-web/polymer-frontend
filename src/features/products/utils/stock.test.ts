import { describe, expect, it } from 'vitest'
import type { ProductVariant } from '../../../lib/api/endpoints.ts'
import { productStock, variantStock } from './stock.ts'

const variant = (
  quantity: number | null | undefined,
  levels: Array<number | null>,
): ProductVariant =>
  ({
    id: 'v1',
    inventory_quantity: quantity,
    inventory_levels: levels.map((available, index) => ({
      location_shopify_id: index + 1,
      location_name: null,
      available,
    })),
  }) as unknown as ProductVariant

describe('variantStock', () => {
  it('follows the locations, so a stock edit shows even when the total lags behind', () => {
    expect(variantStock(variant(0, [25]))).toBe(25)
  })

  it('adds the locations that give a figure', () => {
    expect(variantStock(variant(0, [10, 5, null]))).toBe(15)
  })

  it('falls back to the variant total when no location gives a figure', () => {
    expect(variantStock(variant(7, []))).toBe(7)
    expect(variantStock(variant(7, [null]))).toBe(7)
  })

  it('is unknown when nothing says', () => {
    expect(variantStock(variant(undefined, []))).toBeNull()
  })
})

describe('productStock', () => {
  it('adds the variants’ own stock, so the header agrees with the tabs', () => {
    const variants = [variant(0, [25]), variant(0, [10, 5])]
    expect(productStock({ variants, total_inventory: 0 })).toBe(40)
  })

  it('falls back to the store’s total when no variant gives a figure', () => {
    expect(productStock({ variants: [], total_inventory: 9 })).toBe(9)
    expect(productStock({ variants: [], total_inventory: null })).toBeNull()
  })
})
