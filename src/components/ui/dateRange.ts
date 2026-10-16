/**
 * Date helpers for `DateRangePicker`. Days are plain `YYYY-MM-DD` strings in the
 * viewer's local time (they sort and compare as text), and weeks start on Monday.
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

/** "14 Oct 2026". */
export function formatDay(value: string): string {
  const date = parseYmd(value)
  return date
    ? date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : value
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

const mondayOf = (date: Date) => addDays(date, -((date.getDay() + 6) % 7))

const span = (from: Date, to: Date): DayRange => ({ from: toYmd(from), to: toYmd(to) })

/** The quick choices, in the order they are listed. */
export const RANGE_PRESETS: RangePreset[] = [
  { label: 'All Time', range: () => ({ from: '', to: '' }) },
  { label: 'Today', range: (today) => span(today, today) },
  {
    label: 'Yesterday',
    range: (today) => span(addDays(today, -1), addDays(today, -1)),
  },
  { label: 'Last 7 days', range: (today) => span(addDays(today, -6), today) },
  {
    label: 'Last week',
    range: (today) => {
      const monday = mondayOf(today)
      return span(addDays(monday, -7), addDays(monday, -1))
    },
  },
  { label: 'Last 2 weeks', range: (today) => span(addDays(today, -13), today) },
  { label: 'Last 30 days', range: (today) => span(addDays(today, -29), today) },
  {
    label: 'This month',
    range: (today) =>
      span(
        new Date(today.getFullYear(), today.getMonth(), 1),
        new Date(today.getFullYear(), today.getMonth() + 1, 0),
      ),
  },
  {
    label: 'Last month',
    range: (today) =>
      span(
        new Date(today.getFullYear(), today.getMonth() - 1, 1),
        new Date(today.getFullYear(), today.getMonth(), 0),
      ),
  },
]

/** The preset that is exactly this range, if any. */
export function matchingPreset(value: DayRange, today: Date): RangePreset | undefined {
  return RANGE_PRESETS.find((preset) => {
    const range = preset.range(today)
    return range.from === value.from && range.to === value.to
  })
}

/** What the picker's button says: the preset's name, a day, or "from – to". */
export function describeRange(value: DayRange, today: Date): string {
  const preset = matchingPreset(value, today)
  if (preset) return preset.label
  const from = value.from || value.to
  const to = value.to || value.from
  return from === to ? formatDay(from) : `${formatDay(from)} – ${formatDay(to)}`
}

/** The six weeks (42 days, Monday first) that a month's calendar shows. */
export function monthGrid(year: number, month: number): Date[] {
  const offset = (new Date(year, month, 1).getDay() + 6) % 7
  return Array.from(
    { length: 42 },
    (_, index) => new Date(year, month, 1 - offset + index),
  )
}
