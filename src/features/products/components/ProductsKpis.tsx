import {
  AlertTriangleIcon,
  CheckCircleIcon,
  SlidersIcon,
  XCircleIcon,
} from '../../../components/ui/icons.tsx'
import { KpiCards, type Kpi } from '../../../components/ui/KpiCards.tsx'
import type { ProductListResponse } from '../../../lib/api/endpoints.ts'

/**
 * The four figures of the answer's `stock_summary`: how many are in stock, low on stock
 * and out of stock, and the threshold that counts as "low". Nothing is worked out here.
 */
function kpis(data: ProductListResponse | null): Kpi[] {
  const summary = data?.stock_summary
  const count = (value: number | undefined) =>
    value === undefined ? '—' : value.toLocaleString('en-GB')
  const threshold = summary?.low_stock_threshold
  return [
    {
      label: 'In stock',
      hint: 'Products with stock above 0',
      value: count(summary?.in_stock),
      icon: CheckCircleIcon,
      tone: 'good',
    },
    {
      label: 'Low stock',
      hint:
        threshold === undefined
          ? 'Stock above 0 but below the threshold'
          : `Stock above 0 but below ${threshold.toLocaleString('en-GB')}`,
      value: count(summary?.low_stock),
      icon: AlertTriangleIcon,
      tone: 'warning',
    },
    {
      label: 'Out of stock',
      hint: 'No stock: 0, negative or unknown',
      value: count(summary?.out_of_stock),
      icon: XCircleIcon,
      tone: 'danger',
    },
    {
      label: 'Low stock threshold',
      hint: 'Below this many counts as low',
      value: count(summary?.low_stock_threshold),
      icon: SlidersIcon,
    },
  ]
}

/** The four stock figures above the products list. */
export function ProductsKpis({ data }: { data: ProductListResponse | null }) {
  return <KpiCards items={kpis(data)} />
}
