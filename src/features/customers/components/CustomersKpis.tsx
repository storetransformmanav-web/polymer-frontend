import {
  CheckCircleIcon,
  MailIcon,
  OrdersIcon,
  UsersIcon,
} from '../../../components/ui/icons.tsx'
import { KpiCards, type Kpi } from '../../../components/ui/KpiCards.tsx'
import type { CustomerListItem } from '../../../lib/api/endpoints.ts'

const count = (value: number | null) =>
  value === null ? '—' : value.toLocaleString('en-GB')

/**
 * Four figures above the customers list, all read from the list's own answer — they make no
 * request of their own (the API has no summary block for customers, and a request per figure
 * made the page ask for customers four times). **Customers** is the answer's `total`, for
 * everyone matching the list; the other three are counted among the customers shown on
 * the current page (`orders_count`, `accepts_marketing`), and say so.
 */
export function CustomersKpis({
  items,
  total,
}: {
  /** The customers on the page being shown. */
  items: readonly CustomerListItem[]
  /** The answer's `total`: everyone matching the list, across every page. */
  total: number | null
}) {
  const loaded = total !== null
  const shown = items.length
  const kpis: Kpi[] = [
    {
      label: 'Customers',
      value: count(total),
      hint: 'Everyone matching the list',
      icon: UsersIcon,
    },
    {
      label: 'With orders',
      value: loaded ? count(items.filter((item) => item.orders_count > 0).length) : '—',
      hint: `Of the ${shown.toLocaleString('en-GB')} on this page`,
      icon: CheckCircleIcon,
      tone: 'good',
    },
    {
      label: 'Without orders',
      value: loaded ? count(items.filter((item) => item.orders_count === 0).length) : '—',
      hint: `Of the ${shown.toLocaleString('en-GB')} on this page`,
      icon: OrdersIcon,
      tone: 'warning',
    },
    {
      label: 'Email subscribers',
      value: loaded
        ? count(items.filter((item) => item.accepts_marketing === true).length)
        : '—',
      hint: `Of the ${shown.toLocaleString('en-GB')} on this page`,
      icon: MailIcon,
    },
  ]
  return <KpiCards items={kpis} />
}
