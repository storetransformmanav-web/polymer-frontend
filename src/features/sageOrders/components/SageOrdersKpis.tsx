import {
  AlertTriangleIcon,
  CheckCircleIcon,
  OrdersIcon,
  PoundIcon,
  TruckIcon,
} from '../../../components/ui/icons.tsx'
import { KpiCards, type Kpi } from '../../../components/ui/KpiCards.tsx'
import type { SageOrderStatus, SageOrderTotals } from '../../../lib/api/sageOrders.ts'
import { count, money } from '../utils/format.ts'

/**
 * The figures above the list, read from the answer's `totals` and `status_counts` — they cover
 * **every** order the filters match, not just the page shown, and make no request of their own:
 * **Total orders**, **Net**, **Tax** and **Gross**, and how many orders are **Open**, **Part
 * despatched** and **Complete**. A dash shows until the answer arrives. The four counts are filter
 * buttons (they set the list's status); the amounts are display-only.
 */
export function SageOrdersKpis({
  totals,
  total,
  statusCounts,
  currency,
  status,
  onStatus,
}: {
  /** The answer's `totals`, or null when it has none (yet). */
  totals: SageOrderTotals | null
  /** The answer's own `total` — the fallback for the number of orders. */
  total: number | null
  /** The answer's `status_counts` (how many orders each status holds). */
  statusCounts: Readonly<Record<string, number>>
  /** The orders' currency (the first one's), pounds when the answer names none. */
  currency: string | null
  status: SageOrderStatus
  onStatus: (status: SageOrderStatus) => void
}) {
  const filterCard = (target: SageOrderStatus): Pick<Kpi, 'onClick' | 'active'> => ({
    onClick: () => onStatus(status === target && target !== 'all' ? 'all' : target),
    active: status === target,
  })
  const kpis: Kpi[] = [
    {
      label: 'Total Orders',
      value: count(totals?.orders ?? total),
      info: 'Every Sage sales order matching your search and filters.',
      icon: OrdersIcon,
      ...filterCard('all'),
    },
    {
      label: 'Net Amount',
      value: money(totals?.net, currency),
      info: 'The total value of these orders before tax.',
      icon: PoundIcon,
    },
    {
      label: 'Tax Amount',
      value: money(totals?.tax, currency),
      info: 'The VAT on these orders.',
      icon: PoundIcon,
    },
    {
      label: 'Gross Amount',
      value: money(totals?.gross, currency),
      info: 'The total value of these orders including tax (net plus tax).',
      icon: PoundIcon,
      tone: 'good',
    },
    {
      label: 'Open Orders',
      value: count(statusCounts.open),
      info: 'Orders that are open. Press to show only these.',
      icon: AlertTriangleIcon,
      tone: (statusCounts.open ?? 0) > 0 ? 'warning' : 'default',
      ...filterCard('open'),
    },
    {
      label: 'Part Despatched',
      value: count(statusCounts.part_despatched),
      info: 'Orders that have been sent out in part. Press to show only these.',
      icon: TruckIcon,
      ...filterCard('part_despatched'),
    },
    {
      label: 'Complete Orders',
      value: count(statusCounts.complete),
      info: 'Orders that are complete. Press to show only these.',
      icon: CheckCircleIcon,
      tone: 'good',
      ...filterCard('complete'),
    },
  ]
  return <KpiCards compact items={kpis} />
}
