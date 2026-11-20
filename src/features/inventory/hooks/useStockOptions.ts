import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useAppSelector } from '../../../app/store/hooks.ts'
import { api, type EditableStockQuantity } from '../../../lib/api/endpoints.ts'
import { humanize } from '../../../lib/inventoryStock.ts'

export interface QuantityChoice {
  name: EditableStockQuantity
  label: string
  /** What the quantity means ("Can be sold now"), as the backend words it. */
  description?: string
  /** Whether "Set to" (`PUT`) can take it; the backend says so (`set_supported`). */
  setSupported: boolean
}

export interface ReasonChoice {
  value: string
  label: string
  description?: string
  /** `increase`, `decrease` or `either`: which way a change with this reason may go (the backend's). */
  direction?: string
  /** `set` or `adjust`: how the backend suggests making a change with this reason. */
  suggestedMode?: string
  isDefault?: boolean
}

export interface ModeChoice {
  value: 'set' | 'adjust'
  label: string
  /** One line saying when to use it, as the backend words it. */
  help?: string
}

/**
 * What the stock-change boxes offer, **as the backend sent it**: the quantities a person may pick (only
 * the `editable` ones, each named by its own `label`, with whether "Set to" can take it), the reasons for
 * a change (each with its direction and suggested mode; the one marked `is_default` is the default) and
 * the two modes (`Set to`, `Adjust by`). Pass `fresh` from a box that is opening: it then asks
 * `GET /inventory/reasons` (kept for 5 minutes) and uses that answer; until it arrives — or when it
 * fails — what the stock list carried is used. Nothing is written in the app: a list the backend has not
 * sent is empty, and the box leaves that choice out. A choice with no label shows its key in words
 * ("safety_stock" → "Safety stock").
 */
export function useStockOptions({ fresh = false }: { fresh?: boolean } = {}) {
  const listed = useAppSelector((state) => state.inventory.stockOptions)
  const query = useQuery({
    queryKey: ['inventory-reasons'],
    queryFn: () => api.inventory.reasons(),
    enabled: fresh,
    staleTime: 5 * 60_000,
    retry: false,
  })
  const asked = query.data
  return useMemo(() => {
    const fromApi = asked && asked.quantities.length > 0
    const quantities: QuantityChoice[] = fromApi
      ? asked.quantities
          .filter((option) => option.editable ?? true)
          .map((option) => ({
            name: option.name as EditableStockQuantity,
            label: option.label?.trim() || humanize(option.name),
            description: option.description?.trim() || undefined,
            setSupported: option.set_supported ?? true,
          }))
      : listed.quantities
          .filter((option) => option.editable)
          .map((option) => ({
            name: option.name as EditableStockQuantity,
            label: option.label || humanize(option.name),
            setSupported: true,
          }))

    const reasons: ReasonChoice[] =
      asked && asked.reasons.length > 0
        ? asked.reasons.map((option) => ({
            value: option.value,
            label: option.label?.trim() || humanize(option.value),
            description: option.description?.trim() || undefined,
            direction: option.direction?.trim().toLowerCase() || undefined,
            suggestedMode: option.suggested_mode?.trim().toLowerCase() || undefined,
            isDefault: option.is_default ?? false,
          }))
        : listed.reasons.map((option) => ({
            value: option.value,
            label: option.label || humanize(option.value),
          }))

    const modes: ModeChoice[] = (asked?.modes ?? [])
      .filter((option) => option.value === 'set' || option.value === 'adjust')
      .map((option) => ({
        value: option.value as ModeChoice['value'],
        label: option.label?.trim() || humanize(option.value),
        help: option.help?.trim() || undefined,
      }))

    return { quantities, reasons, modes }
  }, [asked, listed])
}
