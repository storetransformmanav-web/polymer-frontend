import type { ProductDetail, ProductVariant } from '../../../lib/api/endpoints.ts'

/**
 * How many of a variant are available. The per-location levels are what the Inventory tab shows
 * and edits, so they win when the store has recorded any; `inventory_quantity` (a separate total
 * that can lag behind a stock edit) is the fallback. `null` when neither says.
 */
export function variantStock(variant: ProductVariant): number | null {
  const counted = variant.inventory_levels
    .map((level) => level.available)
    .filter((available): available is number => typeof available === 'number')
  if (counted.length > 0) return counted.reduce((sum, available) => sum + available, 0)
  return variant.inventory_quantity ?? null
}

/**
 * How many of the product are available: the sum of its variants' stock (`variantStock`), so the
 * header, the Variants footer and the Inventory tab always agree with each other; the store's own
 * `total_inventory` only when no variant says. (That total can lag behind a stock edit.)
 */
export function productStock(
  product: Pick<ProductDetail, 'variants' | 'total_inventory'>,
): number | null {
  const known = product.variants
    .map(variantStock)
    .filter((stock): stock is number => stock !== null)
  if (known.length > 0) return known.reduce((sum, stock) => sum + stock, 0)
  return product.total_inventory ?? null
}
