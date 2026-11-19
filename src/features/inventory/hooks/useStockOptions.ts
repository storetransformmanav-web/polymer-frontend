import { useMemo } from 'react'
import { useAppSelector } from '../../../app/store/hooks.ts'
import type { EditableStockQuantity } from '../../../lib/api/endpoints.ts'
import { humanize } from '../../../lib/inventoryStock.ts'

export interface QuantityChoice {
  name: EditableStockQuantity
  label: string
}

export interface ReasonChoice {
  value: string
  label: string
}

/**
 * What the Edit stock window offers, **as the backend sent it** with the stock list: the quantities
 * a person may pick (only the `editable` ones; each named by its own `label`) and the reasons for a
 * change (the first is the default). Nothing is written in the app: a list the backend has not
 * sent is empty, and the window then leaves that box out (the quantity stays Available and no
 * reason is sent). A choice with no label shows its key in words ("safety_stock" → "Safety stock").
 */
export function useStockOptions() {
  const options = useAppSelector((state) => state.inventory.stockOptions)
  return useMemo(
    () => ({
      quantities: options.quantities
        .filter((option) => option.editable)
        .map((option): QuantityChoice => ({
          name: option.name as EditableStockQuantity,
          label: option.label || humanize(option.name),
        })),
      reasons: options.reasons.map((option): ReasonChoice => ({
        value: option.value,
        label: option.label || humanize(option.value),
      })),
    }),
    [options],
  )
}
