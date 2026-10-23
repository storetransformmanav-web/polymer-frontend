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
  return [
    {
      label: 'In stock',
      value: count(summary?.in_stock),
      icon: CheckCircleIcon,
      tone: 'good',
    },
    {
      label: 'Low stock',
      value: count(summary?.low_stock),
      icon: AlertTriangleIcon,
      tone: 'warning',
    },
    {
      label: 'Out of stock',
      value: count(summary?.out_of_stock),
      icon: XCircleIcon,
      tone: 'danger',
    },
    {
      label: 'Low stock threshold',
      value: count(summary?.low_stock_threshold),
      icon: SlidersIcon,
    },
  ]
}

/** The four stock figures above the products list. */
export function ProductsKpis({ data }: { data: ProductListResponse | null }) {
  return <KpiCards items={kpis(data)} />
}
