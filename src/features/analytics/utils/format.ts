import { addDays, RANGE_PRESETS, toYmd } from '../../../components/ui/dateRange.ts'
import type { RangePreset } from '../../../components/ui/dateRange.ts'

const lastDays = (days: number): RangePreset => ({
  label: days === 365 ? 'Last 12 Months' : `Last ${days} Days`,
  range: (today) => ({ from: toYmd(addDays(today, 1 - days)), to: toYmd(today) }),
})

const preset = (label: string) => RANGE_PRESETS.find((item) => item.label === label)!

/**
 * The period choices. "Default period" sends no dates, so the backend uses its own default
 * (the dates it chose are shown on the page). There is no "All Time": the API reads two years
 * at most.
 */
export const SALES_RANGE_PRESETS: RangePreset[] = [
  { label: 'Default period', range: () => ({ from: '', to: '' }) },
  preset('Today'),
  preset('Last 7 Days'),
  preset('Last 60 Days'),
  lastDays(90),
  lastDays(365),
]

/** The API's days are plain calendar days, so they are written out in UTC (no time-zone shift). */
function dayText(value: string, options: Intl.DateTimeFormatOptions): string {
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...options }).format(date)
}

/** "29 Oct 2026" */
export const formatDayShort = (value: string) =>
  dayText(value, { day: 'numeric', month: 'short', year: 'numeric' })

/** "29 Oct – 27 Nov 2026"; the first year is only written when it differs. */
export function formatPeriod(from: string, to: string): string {
  if (from === to) return formatDayShort(to)
  const sameYear = from.slice(0, 4) === to.slice(0, 4)
  const start = sameYear
    ? dayText(from, { day: 'numeric', month: 'short' })
    : formatDayShort(from)
  return `${start} – ${formatDayShort(to)}`
}

/** A chart point's label under the axis: "29 Oct", or "Nov 26" for monthly points. */
export const formatTick = (value: string, groupBy: string) =>
  groupBy === 'month'
    ? dayText(value, { month: 'short', year: '2-digit' })
    : dayText(value, { day: 'numeric', month: 'short' })

/** A chart point's full name, for the tooltip and the table behind the chart. */
export function formatPointName(value: string, groupBy: string): string {
  if (groupBy === 'month') return dayText(value, { month: 'long', year: 'numeric' })
  if (groupBy === 'week') return `Week of ${formatDayShort(value)}`
  return formatDayShort(value)
}

export const formatCount = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : value.toLocaleString('en-GB')

/** A money axis label: "£0", "£5k", "£1.2m". */
export function formatCompactMoney(value: number, currency: string): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    notation: 'compact',
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })
    .format(value)
    .replace('K', 'k')
    .replace('M', 'm')
}

/**
 * Clean axis steps from 0 up to at least `max`, in about `count` steps (1, 2, 2.5, 5 × 10ⁿ).
 * With `whole`, the steps are whole numbers (orders and units can't be halves).
 */
export function niceTicks(max: number, count = 3, whole = false): number[] {
  const top = max > 0 ? max : 1
  const rough = top / count
  const power = 10 ** Math.floor(Math.log10(rough))
  const steps = [1, 2, 2.5, 5, 10].map((factor) => factor * power)
  let step = steps.find((candidate) => candidate >= rough) ?? 10 * power
  if (whole) step = Math.max(1, Math.ceil(step))
  const ticks = [0]
  while (ticks[ticks.length - 1] < top) ticks.push(ticks.length * step)
  return ticks
}

/**
 * A smooth line through the points that never overshoots them (monotone cubic), so a curve can't
 * dip below zero or rise above a real figure.
 */
export function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return ''
  const slopes = points.slice(1).map((point, index) => {
    const previous = points[index]
    return (point.y - previous.y) / (point.x - previous.x || 1)
  })
  const tangents = points.map((_, index) => {
    const before = slopes[index - 1] ?? slopes[index] ?? 0
    const after = slopes[index] ?? before
    if (before * after <= 0) return 0
    return (2 * before * after) / (before + after)
  })
  return points.slice(1).reduce((path, point, index) => {
    const previous = points[index]
    const third = (point.x - previous.x) / 3
    return `${path} C${previous.x + third},${previous.y + tangents[index] * third} ${
      point.x - third
    },${point.y - tangents[index + 1] * third} ${point.x},${point.y}`
  }, `M${points[0].x},${points[0].y}`)
}
