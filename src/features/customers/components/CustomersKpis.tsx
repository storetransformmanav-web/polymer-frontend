import type { CustomerFilters } from '../../../app/store/customersSlice.ts'
import {
  CheckCircleIcon,
  MailIcon,
  OrdersIcon,
  UsersIcon,
} from '../../../components/ui/icons.tsx'
import { KpiCards, type Kpi } from '../../../components/ui/KpiCards.tsx'
import { useCustomerStats } from '../hooks/useCustomerStats.ts'

/** What each card adds to the list's own filters (see `useCustomerStats`). */
const CHANGES: Partial<CustomerFilters>[] = [
  {},
  { orders: 'yes' },
  { orders: 'no' },
  { marketing: 'yes' },
]

const count = (value: number | null) =>
  value === null ? '—' : value.toLocaleString('en-GB')

/**
 * Four figures above the customers list. The list answer carries no summary of its own, so
 * each is the `total` of `GET /customers` under the list's current filters with one more
 * condition: all customers, with orders (`has_orders=true`), without orders
 * (`has_orders=false`) and subscribed to email (`accepts_marketing=true`). They follow the
 * search, store and country, so they always describe the list below them.
 */
export function CustomersKpis({
  filters,
  total,
}: {
  filters: CustomerFilters
  /** The list's own total, shown while the first figure is still loading. */
  total: number | null
}) {
  const [all, withOrders, withoutOrders, subscribed] = useCustomerStats(filters, CHANGES)

  const kpis: Kpi[] = [
    {
      label: 'Customers',
      value: count(all ?? total),
      hint: 'Everyone matching the list',
      icon: UsersIcon,
    },
    {
      label: 'With orders',
      value: count(withOrders),
      hint: 'Have placed at least one order',
      icon: CheckCircleIcon,
      tone: 'good',
    },
    {
      label: 'Without orders',
      value: count(withoutOrders),
      hint: 'Have never ordered',
      icon: OrdersIcon,
      tone: 'warning',
    },
    {
      label: 'Email subscribers',
      value: count(subscribed),
      hint: 'Accept marketing emails',
      icon: MailIcon,
    },
  ]
  return <KpiCards items={kpis} />
}
