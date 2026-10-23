import {
  CheckCircleIcon,
  OrdersIcon,
  PoundIcon,
  RefreshIcon,
} from '../../../components/ui/icons.tsx'
import { KpiCards, type Kpi } from '../../../components/ui/KpiCards.tsx'
import type { OrderListResponse } from '../../../lib/api/endpoints.ts'
import { formatPrice } from '../../../lib/format.ts'

/**
 * The four figures the API's `totals` gives for every order that matches the filters
 * (not just this page): `orders`, `total_price`, `total_refunded` and `net_payment`.
 * The API gives no currency for the amounts, so the first order's is used.
 */
function kpis(data: OrderListResponse | null): Kpi[] {
  const totals = data?.totals
  const currency = data?.items[0]?.currency
  const money = (value: string | null | undefined) =>
    value === null || value === undefined ? '—' : formatPrice(value, currency)

  const orders = totals?.orders ?? data?.total ?? null

  return [
    {
      label: 'Orders',
      value: orders === null ? '—' : orders.toLocaleString('en-GB'),
      // note: 'matching filters',
      icon: OrdersIcon,
    },
    {
      label: 'Total price',
      value: money(totals?.total_price),
      // note: 'of all orders',
      icon: PoundIcon,
    },
    {
      label: 'Total refunded',
      value: money(totals?.total_refunded),
      // note: 'returned to customers',
      icon: RefreshIcon,
      tone: 'warning',
    },
    {
      label: 'Net payment',
      value: money(totals?.net_payment),
      // note: 'paid, after refunds',
      icon: CheckCircleIcon,
      tone: 'good',
    },
  ]
}

/** The four figures above the list: orders, total price, total refunded, net payment. */
export function OrdersKpis({ data }: { data: OrderListResponse | null }) {
  return <KpiCards items={kpis(data)} />
}
