import { KpiCards, type Kpi } from '../../../components/ui/KpiCards.tsx'
import {
  ActivityIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  UsersIcon,
  XCircleIcon,
} from '../../../components/ui/icons.tsx'
import type { MonthTotals } from '../../../lib/api/endpoints.ts'

/** A figure from the answer's `totals`; a dash until it arrives (or when the backend leaves it out). */
const figure = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : value.toLocaleString('en-GB')

/**
 * The month's figure cards. **Every figure is the backend's** `totals`, which cover every matching
 * member, not just the page.
 */
export function MonthlyKpis({ totals }: { totals: MonthTotals | null }) {
  const cards: Kpi[] = [
    {
      label: 'Total Hours',
      value: totals?.total ?? '—',
      icon: ClockIcon,
      info: 'Hours worked by every matching member this month.',
    },
    {
      label: 'Members',
      value: figure(totals?.members),
      icon: UsersIcon,
      info: 'Every member that matches the search and filters.',
    },
    {
      label: 'Average Hours',
      value: totals?.average ?? '—',
      icon: ActivityIcon,
      info: 'Average hours worked per member.',
    },
    {
      label: 'Present Days',
      value: figure(totals?.present_days),
      icon: CheckCircleIcon,
      tone: 'good',
      info: 'Days present, added up over every matching member.',
    },
    {
      label: 'Absent Days',
      value: figure(totals?.absent_days),
      icon: XCircleIcon,
      tone: 'danger',
      info: 'Days absent, added up over every matching member.',
    },
    {
      label: 'Late Days',
      value: figure(totals?.late_days),
      icon: AlertTriangleIcon,
      tone: 'warning',
      info: 'Late arrivals, added up over every matching member.',
    },
  ]

  return <KpiCards items={cards} compact />
}
