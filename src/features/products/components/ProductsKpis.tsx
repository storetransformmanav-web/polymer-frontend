import {
  AlertTriangleIcon,
  BoxesIcon,
  CheckCircleIcon,
  SlidersIcon,
  XCircleIcon,
} from '../../../components/ui/icons.tsx'
import { KpiCards, type Kpi } from '../../../components/ui/KpiCards.tsx'
import type { ProductFilters } from '../../../app/store/productsSlice.ts'
import type { ProductListResponse } from '../../../lib/api/endpoints.ts'

/**
 * The number of products, then the four figures of the answer's `stock_summary`: how many
 * are in stock, low on stock and out of stock, and the threshold that counts as "low".
 * Nothing is worked out here.
 */
function kpis(
  summary: ProductListResponse['stock_summary'],
  total: number | undefined,
  stock: ProductFilters['stock'],
  onStock: (stock: ProductFilters['stock']) => void,
): Kpi[] {
  const count = (value: number | undefined) =>
    value === undefined ? '—' : value.toLocaleString('en-GB')
  const threshold = summary?.low_stock_threshold
  return [
    {
      label: 'Total products',
      hint: 'Products in this list, whatever their stock',
      value: count(total),
      icon: BoxesIcon,
    },
    {
      label: 'In stock',
      hint: 'Products with stock above 0',
      value: count(summary?.in_stock),
      icon: CheckCircleIcon,
      tone: 'good',
      active: stock === 'in',
      onClick: () => onStock(stock === 'in' ? '' : 'in'),
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
      active: stock === 'out',
      onClick: () => onStock(stock === 'out' ? '' : 'out'),
    },
    {
      label: 'Low stock threshold',
      hint: 'Below this many counts as low',
      value: count(summary?.low_stock_threshold),
      icon: SlidersIcon,
    },
  ]
}

/**
 * The total number of products and the four stock figures above the products list.
 * **In stock** and **Out of stock** are buttons: pressing one shows only those products in the table (the same filter as Stock in
 * Filters), pressing it again shows everything. Pressing a card only adds that filter to the
 * table — the four figures keep their values (see `useStockSummary`).
 */
export function ProductsKpis({
  summary,
  total,
  stock,
  onStock,
}: {
  summary: ProductListResponse['stock_summary']
  /** The list answer's `total` (not part of `stock_summary`); a dash until it arrives. */
  total: number | undefined
  stock: ProductFilters['stock']
  onStock: (stock: ProductFilters['stock']) => void
}) {
  return <KpiCards items={kpis(summary, total, stock, onStock)} />
}
