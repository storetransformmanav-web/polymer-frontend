import type { ComponentType, ReactNode } from 'react'
import {
  CheckCircleIcon,
  DollarSignIcon,
  OrdersIcon,
  RefreshIcon,
  type IconProps,
} from '../../../components/ui/icons.tsx'
import type { OrderListResponse } from '../../../lib/api/endpoints.ts'
import { formatPrice } from '../../../lib/format.ts'

interface Kpi {
  label: string
  value: ReactNode
  /** Small text under/beside the value. */
  note?: string
  icon: ComponentType<IconProps>
  tone?: 'default' | 'good' | 'warning'
}

const VALUE_TONE = {
  default: 'text-text',
  good: 'text-accent',
  warning: 'text-warning',
}

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
      note: 'matching filters',
      icon: OrdersIcon,
    },
    {
      label: 'Total price',
      value: money(totals?.total_price),
      note: 'of all orders',
      icon: DollarSignIcon,
    },
    {
      label: 'Total refunded',
      value: money(totals?.total_refunded),
      note: 'returned to customers',
      icon: RefreshIcon,
      tone: 'warning',
    },
    {
      label: 'Net payment',
      value: money(totals?.net_payment),
      note: 'paid, after refunds',
      icon: CheckCircleIcon,
      tone: 'good',
    },
  ]
}

/** The four figures above the list: orders, total price, total refunded, net payment. */
export function OrdersKpis({ data }: { data: OrderListResponse | null }) {
  return (
    <div className="grid grid-cols-1 gap-4 min-[520px]:grid-cols-2 xl:grid-cols-4">
      {kpis(data).map((kpi) => (
        <div
          key={kpi.label}
          className="border-border bg-bg flex items-center justify-between gap-3 rounded-2xl border px-5 py-4"
        >
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-text-muted text-[0.68rem] font-bold tracking-wider uppercase">
              {kpi.label}
            </span>
            <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
              <span
                className={`text-[1.55rem] leading-tight font-bold ${VALUE_TONE[kpi.tone ?? 'default']}`}
              >
                {kpi.value}
              </span>
              {kpi.note && (
                <span className="text-text-muted text-[0.74rem]">{kpi.note}</span>
              )}
            </span>
          </div>
          <span className="bg-surface text-text border-border flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border">
            <kpi.icon width={18} height={18} />
          </span>
        </div>
      ))}
    </div>
  )
}
