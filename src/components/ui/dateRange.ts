/**
 * Date helpers for `DateRangePicker`. Days are plain `YYYY-MM-DD` strings in the
 * viewer's local time (they sort and compare as text). The calendar's weeks start on Sunday.
 */

const pad = (value: number) => String(value).padStart(2, '0')

/** A date as `YYYY-MM-DD` (local time). */
export function toYmd(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** `YYYY-MM-DD` → a local date at midnight, or null when it isn't a real day. */
export function parseYmd(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
    ? date
    : null
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

/** "14 October 2026" — the full name a screen reader gets for a day button. */
export function formatDayLong(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export interface DayRange {
  from: string
  to: string
}

export interface RangePreset {
  label: string
  range: (today: Date) => DayRange
}

const span = (from: Date, to: Date): DayRange => ({ from: toYmd(from), to: toYmd(to) })

/** The quick choices, in the order they are listed ("Custom Range" is the picker's own). */
export const RANGE_PRESETS: RangePreset[] = [
  { label: 'All Time', range: () => ({ from: '', to: '' }) },
  { label: 'Today', range: (today) => span(today, today) },
  { label: 'Last 7 Days', range: (today) => span(addDays(today, -6), today) },
  { label: 'Last 30 Days', range: (today) => span(addDays(today, -29), today) },
  { label: 'Last 60 Days', range: (today) => span(addDays(today, -59), today) },
]

/** The preset that is exactly this range, if any. */
export function matchingPreset(value: DayRange, today: Date): RangePreset | undefined {
  return RANGE_PRESETS.find((preset) => {
    const range = preset.range(today)
    return range.from === value.from && range.to === value.to
  })
}

/** The six weeks (42 days, Sunday first) that a month's calendar shows. */
export function monthGrid(year: number, month: number): Date[] {
  const offset = new Date(year, month, 1).getDay()
  return Array.from(
    { length: 42 },
    (_, index) => new Date(year, month, 1 - offset + index),
  )
}
