import {
  AlertTriangleIcon,
  CheckCircleIcon,
  LayersIcon,
  XCircleIcon,
} from '../../../components/ui/icons.tsx'
import { KpiCards, type Kpi } from '../../../components/ui/KpiCards.tsx'
import type { InventoryStatus, InventoryTotals } from '../../../lib/api/endpoints.ts'

const count = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : value.toLocaleString('en-GB')

/**
 * The four headline figures above the list, read straight from the answer's `totals` — `variants`,
 * `in_stock`, `low_stock` and `out_of_stock`, nothing else. They cover the whole filtered result (or
 * one location, when a location is chosen), not just this page. Nothing is worked out here, and an
 * edit moves them at once (the slice shifts them).
 *
 * **Each card is a filter** — the same as the Stock status dropdown in Filters, which follows along:
 * In stock, Low stock and Out of stock show only those variants (pressing the one that is on again
 * shows all), and Variants shows all of them. The figures don't change while one is on.
 */
export function InventoryKpis({
  totals,
  variants,
  status,
  onStatusChange,
}: {
  totals: InventoryTotals | null
  /** The list's own total, shown until the figures arrive. */
  variants: number | null
  /** The stock status the list is filtered by ('' = every variant). */
  status: InventoryStatus | ''
  onStatusChange: (status: InventoryStatus | '') => void
}) {
  // A stock-status card: on shows only those variants, pressed again shows all.
  const filter = (value: InventoryStatus) => ({
    active: status === value,
    onClick: () => onStatusChange(status === value ? '' : value),
  })

  const items: Kpi[] = [
    {
      label: 'Variants',
      hint: 'Every variant in the list',
      value: count(totals?.variants ?? variants),
      icon: LayersIcon,
      active: status === '',
      onClick: () => onStatusChange(''),
      title: 'Show all variants',
    },
    {
      label: 'In stock',
      hint: 'Variants with stock to sell',
      value: count(totals?.in_stock),
      icon: CheckCircleIcon,
      tone: 'good',
      ...filter('in_stock'),
    },
    {
      label: 'Low stock',
      hint: 'Variants running low',
      value: count(totals?.low_stock),
      icon: AlertTriangleIcon,
      tone: 'warning',
      ...filter('low'),
    },
    {
      label: 'Out of stock',
      hint: 'Variants with none left',
      value: count(totals?.out_of_stock),
      icon: XCircleIcon,
      tone: 'danger',
      ...filter('out'),
    },
  ]
  return <KpiCards items={items} />
}
