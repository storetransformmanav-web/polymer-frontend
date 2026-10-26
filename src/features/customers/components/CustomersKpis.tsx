import {
  CheckCircleIcon,
  MailIcon,
  OrdersIcon,
  UsersIcon,
} from '../../../components/ui/icons.tsx'
import { KpiCards, type Kpi } from '../../../components/ui/KpiCards.tsx'
import type { CustomerListResponse } from '../../../lib/api/endpoints.ts'

const count = (value: number | null | undefined) =>
  value == null ? '—' : value.toLocaleString('en-GB')

/**
 * Four figures above the customers list, read from the list answer's `totals` block — they
 * make no request of their own. They count every customer matching the list, not just the
 * page on screen: **Customers**, **With orders**, **Without orders** and **Email
 * subscribers**. (`totals` also carries `verified_email` and `email_checked_valid`; no card
 * shows them.) Each shows a dash until the answer arrives; Customers falls back to the
 * answer's `total`.
 */
export function CustomersKpis({
  totals,
  total,
}: {
  /** The list answer's `totals` block, or null/undefined until it arrives. */
  totals: CustomerListResponse['totals']
  /** The answer's `total`: everyone matching the list, across every page. */
  total: number | null
}) {
  const kpis: Kpi[] = [
    {
      label: 'Customers',
      value: count(totals?.customers ?? total),
      hint: 'Everyone matching the list',
      icon: UsersIcon,
    },
    {
      label: 'With orders',
      value: count(totals?.with_orders),
      hint: 'Have placed at least one order',
      icon: CheckCircleIcon,
      tone: 'good',
    },
    {
      label: 'Without orders',
      value: count(totals?.without_orders),
      hint: 'Have not ordered yet',
      icon: OrdersIcon,
      tone: 'warning',
    },
    {
      label: 'Email subscribers',
      value: count(totals?.email_subscribers),
      hint: 'Accept marketing emails',
      icon: MailIcon,
    },
  ]
  return <KpiCards items={kpis} />
}
