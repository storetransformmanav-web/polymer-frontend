import { useMemo } from 'react'
import type { ProductDetail } from '../../../lib/api/endpoints.ts'
import { useStockLocations } from './useStockLocations.ts'

export interface StockLocationChoice {
  id: string
  name: string
}

/**
 * The locations a product's stock can be put at, for the stock dropdowns of the Variants editor:
 * the store's locations (the same list the Add product form offers), plus any location one of the
 * product's variants already has stock at — so a recorded location is always there even when the
 * store's list is empty or could not be read. Asked only once an editor that needs it is open.
 */
export function useProductStockLocations(product: ProductDetail): StockLocationChoice[] {
  const { locations } = useStockLocations(product.shop?.key ?? '')
  return useMemo(() => {
    const byId = new Map<string, string>()
    for (const location of locations) {
      byId.set(String(location.id), location.name?.trim() || `Location ${location.id}`)
    }
    for (const variant of product.variants) {
      for (const level of variant.inventory_levels) {
        const id = String(level.location_shopify_id)
        if (!byId.has(id)) {
          byId.set(id, level.location_name?.trim() || `Location ${id}`)
        }
      }
    }
    return [...byId.entries()].map(([id, name]) => ({ id, name }))
  }, [locations, product.variants])
}
