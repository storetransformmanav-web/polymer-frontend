import {
  AlertTriangleIcon,
  ClockIcon,
  PoundIcon,
  UsersIcon,
} from '../../../components/ui/icons.tsx'
import { KpiCards, type Kpi } from '../../../components/ui/KpiCards.tsx'
import type {
  SageCustomerTab,
  SageCustomerTotals,
} from '../../../lib/api/sageCustomers.ts'
import { count, money } from '../utils/format.ts'

/**
 * The figures above the list, read from the answer's `totals` and `tab_counts` — they cover **every**
 * customer the filters match, not just the page shown, and make no request of their own: **Customers**,
 * **Total balance**, **Aged over 30 days**, **Credit limit**, **Turnover YTD**, and how many accounts are
 * **On hold** or **Over credit limit**. A dash shows until the answer arrives. The three counts are
 * filter buttons (they set the list's tab); the others are display-only.
 */
export function SageCustomersKpis({
  totals,
  total,
  tabCounts,
  currency,
  tab,
  onTab,
}: {
  /** The answer's `totals`, or null when it has none (yet). */
  totals: SageCustomerTotals | null
  /** The answer's own `total` — the fallback for the number of customers. */
  total: number | null
  /** The answer's `tab_counts` (how many accounts each tab holds). */
  tabCounts: Readonly<Record<string, number>>
  /** The customers' currency (the first one's), pounds when the answer names none. */
  currency: string | null
  tab: SageCustomerTab
  onTab: (tab: SageCustomerTab) => void
}) {
  const aged = totals?.agedOver30 ?? null
  const filterCard = (target: SageCustomerTab): Pick<Kpi, 'onClick' | 'active'> => ({
    onClick: () => onTab(tab === target && target !== 'all' ? 'all' : target),
    active: tab === target,
  })
  const kpis: Kpi[] = [
    {
      label: 'Total Customers',
      value: count(totals?.customers ?? total),
      info: 'Every Sage customer account matching your search and filters.',
      icon: UsersIcon,
      ...filterCard('all'),
    },
    {
      label: 'Total Balance',
      value: money(totals?.balance, currency),
      info: 'What these customers owe in total (a negative figure is a credit).',
      icon: PoundIcon,
    },
    {
      label: 'Aged Over 30 Days',
      value: money(aged, currency),
      info: 'The part of the balance that is more than 30 days old.',
      icon: ClockIcon,
      tone: aged !== null && aged > 0 ? 'warning' : 'default',
    },
    {
      label: 'Credit Limit',
      value: money(totals?.creditLimit, currency),
      info: 'The total credit these customers have been given.',
      icon: PoundIcon,
    },
    {
      label: 'Turnover YTD',
      value: money(totals?.turnoverYtd, currency),
      info: 'What these customers have been invoiced so far this financial year.',
      icon: PoundIcon,
      tone: 'good',
    },
    {
      label: 'On Hold',
      value: count(tabCounts.on_hold),
      info: 'Accounts that are on hold. Press to show only these.',
      icon: AlertTriangleIcon,
      tone: (tabCounts.on_hold ?? 0) > 0 ? 'warning' : 'default',
      ...filterCard('on_hold'),
    },
    {
      label: 'Over Credit Limit',
      value: count(tabCounts.over_limit),
      info: 'Accounts whose balance is above their credit limit. Press to show only these.',
      icon: AlertTriangleIcon,
      tone: (tabCounts.over_limit ?? 0) > 0 ? 'danger' : 'default',
      ...filterCard('over_limit'),
    },
  ]
  return <KpiCards compact items={kpis} />
}
