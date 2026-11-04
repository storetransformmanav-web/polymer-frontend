import {
  AlertTriangleIcon,
  CheckCircleIcon,
  LayersIcon,
  XCircleIcon,
} from '../../../components/ui/icons.tsx'
import { KpiCards, type Kpi } from '../../../components/ui/KpiCards.tsx'
import type { InventoryTotals } from '../../../lib/api/endpoints.ts'

const count = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : value.toLocaleString('en-GB')

/**
 * The four headline figures above the list, read straight from the answer's `totals` — `variants`,
 * `in_stock`, `low_stock` and `out_of_stock`, nothing else. They cover the whole filtered result (or
 * one location, when a location is chosen), not just this page. Nothing is worked out here, and an
 * edit moves them at once (the slice shifts them).
 */
export function InventoryKpis({
  totals,
  variants,
}: {
  totals: InventoryTotals | null
  /** The list's own total, shown until the figures arrive. */
  variants: number | null
}) {
  const items: Kpi[] = [
    {
      label: 'Variants',
      hint: 'Every variant in the list',
      value: count(totals?.variants ?? variants),
      icon: LayersIcon,
    },
    {
      label: 'In stock',
      hint: 'Variants with stock to sell',
      value: count(totals?.in_stock),
      icon: CheckCircleIcon,
      tone: 'good',
    },
    {
      label: 'Low stock',
      hint: 'Variants running low',
      value: count(totals?.low_stock),
      icon: AlertTriangleIcon,
      tone: 'warning',
    },
    {
      label: 'Out of stock',
      hint: 'Variants with none left',
      value: count(totals?.out_of_stock),
      icon: XCircleIcon,
      tone: 'danger',
    },
  ]
  return <KpiCards items={items} />
}
