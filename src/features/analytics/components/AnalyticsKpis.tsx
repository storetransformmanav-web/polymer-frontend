import {
  OrdersIcon,
  PoundIcon,
  ProductsIcon,
  TagIcon,
} from '../../../components/ui/icons.tsx'
import { KpiCards, type Kpi } from '../../../components/ui/KpiCards.tsx'
import type { SalesOverview } from '../../../lib/api/salesOverview.ts'
import { formatPrice } from '../../../lib/format.ts'
import { formatCount } from '../utils/format.ts'

/** "↑ 6.4%" beside a figure: how it moved against the period straight before. */
function change(value: number | null | undefined) {
  if (typeof value !== 'number') return undefined
  const tone = value > 0 ? 'text-accent' : value < 0 ? 'text-danger' : ''
  const arrow = value > 0 ? '↑' : value < 0 ? '↓' : '→'
  const word = value > 0 ? 'Up' : value < 0 ? 'Down' : 'No change'
  return (
    <span className={`font-bold whitespace-nowrap tabular-nums ${tone}`}>
      <span aria-hidden="true">{arrow} </span>
      <span className="sr-only">{word} </span>
      {Math.abs(value).toLocaleString('en-GB', { maximumFractionDigits: 1 })}%
    </span>
  )
}

/**
 * The four headline figures for the period, in the same compact cards as the Products page. Each
 * shows a dash until the answer arrives.
 */
export function AnalyticsKpis({ overview }: { overview: SalesOverview | null }) {
  const totals = overview?.totals
  const currency = overview?.currency
  const sold = totals?.products_sold

  const items: Kpi[] = [
    {
      label: 'Revenue',
      value: formatPrice(totals?.revenue, currency),
      note: change(totals?.revenue_change_percent),
      info: 'After refunds and line discounts, without shipping or tax. The percentage compares with the period before.',
      icon: PoundIcon,
    },
    {
      label: 'Orders',
      value: formatCount(totals?.orders),
      note: change(totals?.orders_change_percent),
      info: 'Orders in the period, without cancelled and test orders. The percentage compares with the period before.',
      icon: OrdersIcon,
    },
    {
      label: 'Units sold',
      value: formatCount(totals?.units_sold),
      note: change(totals?.units_change_percent),
      info: 'Units sold after refunds. The percentage compares with the period before.',
      icon: ProductsIcon,
    },
    {
      label: 'Avg. order value',
      value: formatPrice(totals?.average_order_value, currency),
      note: typeof sold === 'number' ? `${formatCount(sold)} products sold` : undefined,
      info: 'The average value of an order in the period.',
      icon: TagIcon,
    },
  ]

  return <KpiCards compact items={items} />
}
