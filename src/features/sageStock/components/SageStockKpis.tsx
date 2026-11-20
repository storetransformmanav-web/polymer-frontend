import {
  AlertTriangleIcon,
  BoxesIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
} from '../../../components/ui/icons.tsx'
import { KpiCards, type Kpi } from '../../../components/ui/KpiCards.tsx'
import type { SageStockTab } from '../../../lib/api/sageStock.ts'
import { count } from '../utils/format.ts'

/**
 * The figures above the list, read **only** from the answer's `tab_counts` — how many stock items each
 * stock status holds: **All items**, **In stock**, **Low stock**, **Out of stock**, **Not tracked** and
 * **Inactive**. They make no request of their own, and a dash shows until the answer arrives. Every
 * card is a filter button (it sets the list's stock status, the same as the Stock status field in
 * Filters); pressing the one that is on again shows every item.
 */
export function SageStockKpis({
  total,
  tabCounts,
  tab,
  onTab,
}: {
  /** The answer's own `total` — the fallback for the number of items before `tab_counts` says. */
  total: number | null
  /** The answer's `tab_counts` (how many items each stock status holds). */
  tabCounts: Readonly<Record<string, number>>
  tab: SageStockTab
  onTab: (tab: SageStockTab) => void
}) {
  const filterCard = (target: SageStockTab): Pick<Kpi, 'onClick' | 'active'> => ({
    onClick: () => onTab(tab === target && target !== 'all' ? 'all' : target),
    active: tab === target,
  })
  const kpis: Kpi[] = [
    {
      label: 'Total Items',
      value: count(tabCounts.all ?? total),
      info: 'Every Sage stock item. Press to show them all.',
      icon: BoxesIcon,
      ...filterCard('all'),
    },
    {
      label: 'In Stock',
      value: count(tabCounts.in_stock),
      info: 'Items with stock on hand. Press to show only these.',
      icon: CheckCircleIcon,
      tone: 'good',
      ...filterCard('in_stock'),
    },
    {
      label: 'Low Stock',
      value: count(tabCounts.low_stock),
      info: 'Items Sage marks as low on stock. Press to show only these.',
      icon: AlertTriangleIcon,
      tone: (tabCounts.low_stock ?? 0) > 0 ? 'warning' : 'default',
      ...filterCard('low_stock'),
    },
    {
      label: 'Out of Stock',
      value: count(tabCounts.out_of_stock),
      info: 'Items with no stock left. Press to show only these.',
      icon: XCircleIcon,
      tone: (tabCounts.out_of_stock ?? 0) > 0 ? 'danger' : 'default',
      ...filterCard('out_of_stock'),
    },
    {
      label: 'Not Tracked',
      value: count(tabCounts.not_tracked),
      info: 'Items whose stock Sage does not track. Press to show only these.',
      icon: ClockIcon,
      ...filterCard('not_tracked'),
    },
    {
      label: 'Inactive',
      value: count(tabCounts.inactive),
      info: 'Items marked inactive in Sage. Press to show only these.',
      icon: XCircleIcon,
      ...filterCard('inactive'),
    },
  ]
  return <KpiCards compact items={kpis} />
}
