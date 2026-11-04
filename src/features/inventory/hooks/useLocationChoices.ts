import { useMemo } from 'react'
import { useAppSelector } from '../../../app/store/hooks.ts'
import type { InventoryItem } from '../../../lib/api/endpoints.ts'

export interface LocationChoice {
  id: number
  name: string
}

/**
 * The locations a variant's stock can be at: the store's own (named by the stock list's
 * `locations`, the only place the dropdowns are filled from) plus any a variant already has a
 * line at, so one that is recorded is always listed. Stocking a variant at a location it has none
 * at yet is just choosing it — the API sets the location up in Shopify by itself.
 */
export function useLocationChoices(variant?: Pick<InventoryItem, 'locations'> | null) {
  const stored = useAppSelector((state) => state.inventory.locations)
  return useMemo(() => {
    const byId = new Map<number, string>()
    for (const location of stored) {
      byId.set(location.id, location.name?.trim() || `Location ${location.id}`)
    }
    for (const line of variant?.locations ?? []) {
      if (!byId.has(line.location_id)) {
        byId.set(
          line.location_id,
          line.location_name?.trim() || `Location ${line.location_id}`,
        )
      }
    }
    return [...byId.entries()].map(([id, name]): LocationChoice => ({ id, name }))
  }, [stored, variant?.locations])
}
