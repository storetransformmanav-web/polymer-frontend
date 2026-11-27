import {
  addDays,
  RANGE_PRESETS,
  toYmd,
  type RangePreset,
} from '../../../components/ui/dateRange.ts'
import type { BadgeTone } from '../../../components/ui/Badge.tsx'
import { getStoreTimeZone } from '../../../lib/storeTime.ts'

/** The API refuses a range longer than this many days. */
export const MAX_RANGE_DAYS = 93
const DAY_MS = 86_400_000

/**
 * The date filter's quick choices: the usual ones ("All Time" is both dates empty, see
 * `api/allAttendance.ts`) and the longest single range the API reads, ending today.
 */
export const ATTENDANCE_RANGE_PRESETS: RangePreset[] = [
  ...RANGE_PRESETS,
  {
    label: `Last ${MAX_RANGE_DAYS} Days`,
    range: (today) => ({
      from: toYmd(addDays(today, 1 - MAX_RANGE_DAYS)),
      to: toYmd(today),
    }),
  },
]

const parseDay = (value: string): number | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

/** How many days a range covers, both ends counted (0 when a date is not a real day). */
export function rangeLength(from: string, to: string): number {
  const start = parseDay(from)
  const end = parseDay(to)
  if (start === null || end === null) return 0
  return Math.round((end - start) / DAY_MS) + 1
}

/** A reason the range can't be asked for, or null when it is fine. */
export function rangeProblem(from: string, to: string): string | null {
  // "All Time": read a period at a time, so there is no limit to break.
  if (!from && !to) return null
  const days = rangeLength(from, to)
  if (days <= 0)
    return 'The end of the date range is before its start — nothing can match.'
  if (days > MAX_RANGE_DAYS) {
    return `Choose at most ${MAX_RANGE_DAYS} days at a time (this range is ${days}).`
  }
  return null
}

/** "25 Nov 2026" for a `YYYY-MM-DD` day (no time-zone shift). */
export function formatDay(value: string | null | undefined): string {
  const time = value ? parseDay(value.slice(0, 10)) : null
  if (time === null) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(time))
}

/** A clock time on the store's clock, 12-hour with AM / PM: "7:58 AM". */
export function formatClock(
  at: string | null | undefined,
  fallback?: string | null,
): string {
  if (at) {
    const date = new Date(at)
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: getStoreTimeZone(),
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
        .format(date)
        .replace(/\s/g, ' ')
    }
  }
  const match = fallback ? /^(\d{1,2}):(\d{2})/.exec(fallback) : null
  if (!match) return '—'
  const hour = Number(match[1])
  return `${hour % 12 === 0 ? 12 : hour % 12}:${match[2]} ${hour < 12 ? 'AM' : 'PM'}`
}

/** 95 → "1h 35m", 0 → "0h 00m". */
export function formatMinutes(minutes: number | null | undefined): string {
  const total = Math.max(0, Math.round(minutes ?? 0))
  return `${Math.floor(total / 60)}h ${String(total % 60).padStart(2, '0')}m`
}

/** The pill colour of an attendance status. */
export function statusTone(status: string | null | undefined): BadgeTone {
  switch (status) {
    case 'present':
      return 'success'
    case 'working':
      return 'default'
    case 'late':
    case 'on_break':
    case 'incomplete':
      return 'warning'
    case 'absent':
      return 'danger'
    default:
      return 'neutral'
  }
}

/** "not_checked_in" → "Not checked in" — only used when the backend sends no label. */
export function humanize(value: string | null | undefined): string {
  const text = (value ?? '').replace(/_/g, ' ').trim()
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '—'
}

/** "Wednesday, 25 Nov 2026" — the full date, for a hover. */
export function formatDayLongName(value: string | null | undefined): string {
  const time = value ? parseDay(value.slice(0, 10)) : null
  if (time === null) return ''
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(time))
}
