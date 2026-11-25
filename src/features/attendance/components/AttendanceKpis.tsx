import { KpiCards, type Kpi } from '../../../components/ui/KpiCards.tsx'
import {
  CalendarIcon,
  ClockIcon,
  UsersIcon,
  XIcon,
} from '../../../components/ui/icons.tsx'
import type { AttendanceTotals } from '../../../lib/api/endpoints.ts'
import type { AttendanceFilters } from '../hooks/useAttendance.ts'

/** A figure from the answer's `totals`; a dash until it arrives (or when the backend leaves it out). */
const figure = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : value.toLocaleString('en-GB')

/**
 * The figure cards. **Every figure is the backend's** — read from the answer's `totals` (they cover
 * the whole date range and the filters, not just the page, and make no request of their own); nothing
 * is counted from the rows on screen. The Working Days card carries the backend's own
 * `working_days_note` as its (i). Absent is a filter button (pressing it shows only the absent days; pressing it again, or Clear All, clears it).
 */
export function AttendanceKpis({
  totals,
  isAdmin,
  status,
  onStatus,
}: {
  totals: AttendanceTotals | null
  isAdmin: boolean
  status: AttendanceFilters['status']
  onStatus: (status: AttendanceFilters['status']) => void
}) {
  const filter = (value: AttendanceFilters['status']) => ({
    onClick: () => onStatus(status === value ? '' : value),
    active: status === value,
  })

  const cards: Kpi[] = [
    ...(isAdmin
      ? [{ label: 'Employees', value: figure(totals?.employees), icon: UsersIcon }]
      : []),
    {
      label: 'Working Days',
      value: figure(totals?.working_days),
      icon: CalendarIcon,
      ...(totals?.working_days_note ? { info: totals.working_days_note } : {}),
    },
    {
      label: 'Absent',
      value: figure(totals?.absent_days),
      icon: XIcon,
      tone: 'danger',
      ...filter('absent'),
    },
    {
      label: 'Hours Worked',
      value: totals?.worked ?? '—',
      icon: ClockIcon,
    },
    {
      label: 'Break Time',
      value:
        totals?.break_minutes === null || totals?.break_minutes === undefined
          ? '—'
          : `${totals.break_minutes.toLocaleString('en-GB')}m`,
      icon: ClockIcon,
    },
  ]

  return <KpiCards items={cards} compact />
}
