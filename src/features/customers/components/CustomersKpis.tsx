import {
  CheckCircleIcon,
  MailIcon,
  OrdersIcon,
  UsersIcon,
} from '../../../components/ui/icons.tsx'
import { KpiCards, type Kpi } from '../../../components/ui/KpiCards.tsx'
import type { CustomerFilters } from '../../../app/store/customersSlice.ts'
import type { CustomerListResponse } from '../../../lib/api/endpoints.ts'

const count = (value: number | null | undefined) =>
  value == null ? '—' : value.toLocaleString('en-GB')

/**
 * Four figures above the customers list, read from the list answer's `totals` block. They count
 * every customer matching the list, not just the page on screen: **Customers**, **With orders**,
 * **Without orders** and **Email subscribers**. Each shows a dash until the answer arrives;
 * Customers falls back to the answer's `total`.
 *
 * Every card is a button, like the stock cards on the Products page: **With orders** and
 * **Without orders** set the Orders filter (the same one as in Filters, which follows along),
 * **Email subscribers** shows only those who accept marketing emails, and **Customers** takes
 * those filters off to show everyone. Pressing a card that is on turns it off again. Pressing a
 * card only adds the filter to the table — the four figures keep their values (see
 * `useCustomerFigures`).
 */
export function CustomersKpis({
  totals,
  total,
  orders,
  marketing,
  onOrders,
  onMarketing,
}: {
  /** The figures' `totals` block, or null/undefined until it arrives. */
  totals: CustomerListResponse['totals']
  /** The answer's `total`: everyone matching the list, across every page. */
  total: number | null
  /** The filters the cards stand for. */
  orders: CustomerFilters['orders']
  marketing: CustomerFilters['marketing']
  onOrders: (orders: CustomerFilters['orders']) => void
  onMarketing: (marketing: CustomerFilters['marketing']) => void
}) {
  const kpis: Kpi[] = [
    {
      label: 'Customers',
      value: count(totals?.customers ?? total),
      hint: 'Everyone matching the list',
      icon: UsersIcon,
      title: 'Show every customer',
      active: orders === '' && marketing === '',
      onClick: () => {
        onOrders('')
        onMarketing('')
      },
    },
    {
      label: 'With orders',
      value: count(totals?.with_orders),
      hint: 'Have placed at least one order',
      icon: CheckCircleIcon,
      tone: 'good',
      active: orders === 'yes',
      onClick: () => onOrders(orders === 'yes' ? '' : 'yes'),
    },
    {
      label: 'Without orders',
      value: count(totals?.without_orders),
      hint: 'Have not ordered yet',
      icon: OrdersIcon,
      tone: 'warning',
      active: orders === 'no',
      onClick: () => onOrders(orders === 'no' ? '' : 'no'),
    },
    {
      label: 'Email subscribers',
      value: count(totals?.email_subscribers),
      hint: 'Accept marketing emails',
      icon: MailIcon,
      active: marketing === 'yes',
      onClick: () => onMarketing(marketing === 'yes' ? '' : 'yes'),
    },
  ]
  return <KpiCards items={kpis} />
}
