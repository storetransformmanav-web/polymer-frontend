import { KpiCards } from '../../../components/ui/KpiCards.tsx'
import type { OrderFilters } from '../../../app/store/ordersSlice.ts'
import { useOrderSummary } from '../hooks/useOrderSummary.ts'
import { cardForFilters, summaryKpis } from '../utils/summary.ts'

interface OrdersKpisProps {
  filters: OrderFilters
  onChange: (changes: Partial<OrderFilters>) => void
}

/**
 * The eight cards above the list — Total Orders, Total Revenue, Average Order Value, Net Revenue,
 * Paid, Pending, Authorized and Refunded Orders — from `GET /orders/summary` for the list's own
 * filters. Total Orders and the four payment-status cards are filter buttons like the Products
 * page's stock cards: each sets the list's payment filter (and the Filters grid follows), and
 * pressing the selected one again shows every matching order. **Total Orders** is the selected card
 * while no payment filter is on, so the page opens on it without narrowing anything. The money
 * cards (revenue, average) are display-only. The (i) beside each title shows the API's own `info`.
 */
export function OrdersKpis({ filters, onChange }: OrdersKpisProps) {
  const { summary } = useOrderSummary(filters)
  const selected = cardForFilters(filters)

  return (
    <KpiCards
      compact
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
