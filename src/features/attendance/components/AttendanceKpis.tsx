import { KpiCards, type Kpi } from '../../../components/ui/KpiCards.tsx'
import {
  AlertTriangleIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  UsersIcon,
  XIcon,
} from '../../../components/ui/icons.tsx'
import type { AttendanceTotals } from '../../../lib/api/endpoints.ts'
import type { AttendanceFilters } from '../hooks/useAttendance.ts'
import { formatMinutes } from '../utils/format.ts'

const count = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : value.toLocaleString('en-GB')

/**
 * The summary cards, read from the answer's `totals` (they cover the whole date range, not just the
 * page, and make no request of their own). Present, Late, Absent and Incomplete are filter buttons that
 * set the same Status as the Filters grid; pressing the one that is on clears it.
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
  const toggle = (value: AttendanceFilters['status']) => () =>
    onStatus(status === value ? '' : value)

  const workedTime = totals
    ? (totals.worked ?? formatMinutes(totals.worked_minutes))
    : '—'
  const breakTime = totals ? formatMinutes(totals.break_minutes) : '—'

  const cards: Kpi[] = [
    ...(isAdmin
      ? [
          {
            label: 'Employees',
            value: count(totals?.employees),
            icon: UsersIcon,
            info: 'The number of employees in the rows for this date range.',
          },
        ]
      : []),
    {
      label: 'Working Days',
      value: count(totals?.working_days),
      icon: CalendarIcon,
      info:
        totals?.working_days_note ??
        'Days in the range that count as working days. Week offs and holidays are not counted.',
    },
    {
      label: 'Present',
      value: count(totals?.present_days),
      icon: CheckIcon,
      tone: 'good',
      info: 'Working days with a completed attendance record. Press to show only these days.',
      onClick: toggle('present'),
      active: status === 'present',
    },
    {
      label: 'Late',
      value: count(totals?.late_days),
      icon: ClockIcon,
      tone: 'warning',
      info: 'Days someone checked in after their shift start. Press to show only these days.',
      onClick: toggle('late'),
      active: status === 'late',
    },
    {
      label: 'Absent',
      value: count(totals?.absent_days),
      icon: XIcon,
      tone: 'danger',
      info: 'Past working days with no check-in. Press to show only these days.',
      onClick: toggle('absent'),
      active: status === 'absent',
    },
    {
      label: 'Incomplete',
      value: count(totals?.incomplete_days),
      icon: AlertTriangleIcon,
      tone: 'warning',
      info: 'Days with a check-in but a missing check-out or another problem. Press to show only these days.',
      onClick: toggle('incomplete'),
      active: status === 'incomplete',
    },
    {
      label: 'Hours Worked',
      value: workedTime,
      icon: ClockIcon,
      info: 'Total time worked in the range, breaks taken off.',
    },
    // Eight cards fit the row: an administrator gets Employees instead of Break Time.
    ...(isAdmin
      ? []
      : [
          {
            label: 'Break Time',
            value: breakTime,
            icon: ClockIcon,
            info: 'Total break time taken in the range.',
          },
        ]),
  ]

  return <KpiCards items={cards} compact />
}
