import { KpiCards } from '../../../components/ui/KpiCards.tsx'
import type { OrderFilters } from '../../../app/store/ordersSlice.ts'
import { useOrderSummary } from '../hooks/useOrderSummary.ts'
import { cardForFilters, summaryKpis } from '../utils/summary.ts'

interface OrdersKpisProps {
  filters: OrderFilters
  onChange: (changes: Partial<OrderFilters>) => void
}

/**
 * The five cards above the list — Total Orders, Total Revenue, Net Revenue, Paid Orders and Pending
 * Orders — from `GET /orders/summary` for the list's own filters. Each is a filter button like the
 * Products page's stock cards: it sets the list's payment / cancelled filter (and the Filters grid
 * follows), and pressing the selected one again shows every matching order. **Total Orders** is the
 * selected card while neither filter is on, so the page opens on it without narrowing anything.
 * The (i) beside each arrow shows the API's own `info` text.
 */
export function OrdersKpis({ filters, onChange }: OrdersKpisProps) {
  const { summary } = useOrderSummary(filters)
  const selected = cardForFilters(filters)

  return (
    <KpiCards
      items={summaryKpis(summary, selected, (card) => {
        // The card that is on is pressed again: back to every matching order.
        if (selected?.key === card.key) {
          if (card.filter.financial !== '' || card.filter.cancelled !== '') {
            onChange({ financial: '', cancelled: '' })
          }
          return
        }
        onChange(card.filter)
      })}
    />
  )
}
