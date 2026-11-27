import { toYmd } from '../../../components/ui/dateRange.ts'
import type { MonthCell } from '../../../lib/api/endpoints.ts'
import { storeToday } from '../../../lib/storeTime.ts'

/** How far back the month dropdown goes. */
export const MONTHS_BACK = 24

const pad = (value: number) => String(value).padStart(2, '0')

const parts = (month: string) => {
  const [year, number] = month.split('-').map(Number)
  return { year, number }
}

/** This month on the store's calendar, `YYYY-MM`. */
export const currentMonth = () => toYmd(storeToday()).slice(0, 7)

/** "2026-01" moved by -1 → "2025-12". */
export function shiftMonth(month: string, by: number): string {
  const { year, number } = parts(month)
  const date = new Date(Date.UTC(year, number - 1 + by, 1))
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`
}

/** "November 2026". */
export function monthLabel(month: string): string {
  const { year, number } = parts(month)
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric',
  }).format(new Date(Date.UTC(year, number - 1, 1)))
}

/** The dropdown's months, newest (the current one) first. */
export const monthOptions = () => {
  const latest = currentMonth()
  return Array.from({ length: MONTHS_BACK + 1 }, (_, index) => {
    const value = shiftMonth(latest, -index)
    return { value, label: monthLabel(value) }
  })
}

/** A month's first day to its last — or to today, while the month is still running. */
export function monthRange(month: string): { from: string; to: string } {
  const { year, number } = parts(month)
  const from = `${month}-01`
  const last = `${month}-${pad(new Date(Date.UTC(year, number, 0)).getUTCDate())}`
  const today = toYmd(storeToday())
  return { from, to: last > today && from <= today ? today : last }
}

/** How a day's cell is drawn. */
export type CellKind =
  'full' | 'short' | 'incomplete' | 'live' | 'absent' | 'holiday' | 'blank'

/**
 * The backend's `tone` decides the colour. A tone it adds later, or hours worked on a day off, falls
 * back to the hours themselves: at least the expected time is "full", less is "short".
 */
export function cellKind(cell: MonthCell): CellKind {
  const worked = cell.worked_minutes ?? 0
  switch (cell.tone) {
    case 'short':
    case 'incomplete':
    case 'live':
    case 'absent':
    case 'holiday':
      return cell.tone
  }
  if (worked > 0) return worked >= (cell.expected_minutes ?? 0) ? 'full' : 'short'
  if (cell.status === 'holiday') return 'holiday'
  return 'blank'
}

export const CELL_STYLES: Record<Exclude<CellKind, 'blank'>, string> = {
  full: 'border-accent/40 bg-accent-tint text-accent',
  short: 'border-danger/30 bg-danger-bg/60 text-danger',
  incomplete: 'border-warning/40 bg-warning-bg text-warning',
  live: 'border-info/40 bg-info-bg text-info',
  absent: 'border-danger/40 border-dashed bg-transparent text-danger',
  holiday: 'border-violet/40 bg-violet-bg text-violet',
}

/** The key to the colours, shown above the grid. */
export const CELL_LEGEND: { kind: Exclude<CellKind, 'blank'>; label: string }[] = [
  { kind: 'full', label: 'Full hours' },
  { kind: 'short', label: 'Short hours' },
  { kind: 'incomplete', label: 'Incomplete' },
  { kind: 'live', label: 'Working now' },
  { kind: 'absent', label: 'Absent' },
  { kind: 'holiday', label: 'Holiday' },
]
