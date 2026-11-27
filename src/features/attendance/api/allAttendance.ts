import { addDays, toYmd } from '../../../components/ui/dateRange.ts'
import {
  api,
  type AttendanceCurrent,
  type AttendanceEmployee,
  type AttendanceItem,
  type AttendanceListParams,
  type AttendanceTotals,
} from '../../../lib/api/endpoints.ts'
import { storeToday } from '../../../lib/storeTime.ts'
import { formatMinutes, MAX_RANGE_DAYS } from '../utils/format.ts'

/** The most rows the list gives in one request. */
const PAGE_SIZE = 200
/** A stop in case the backend never answers with an empty period (about ten years). */
const MAX_PERIODS = 40

/** The filters that go to the server; the status is narrowed afterwards. */
export type AllAttendanceFilters = Pick<
  AttendanceListParams,
  'search' | 'employee' | 'role'
>

export interface AllAttendance {
  /** Every day found, newest first. */
  items: AttendanceItem[]
  totals: AttendanceTotals | null
  employee: AttendanceEmployee | null
  current: AttendanceCurrent | null
}

interface Period {
  items: AttendanceItem[]
  totals: AttendanceTotals | null
  employee: AttendanceEmployee | null
  current: AttendanceCurrent | null
}

/** One period of at most `MAX_RANGE_DAYS` days: every page of it. */
async function readPeriod(
  isAdmin: boolean,
  filters: AllAttendanceFilters,
  from: string,
  to: string,
): Promise<Period> {
  const dates = { date_from: from, date_to: to }
  if (!isAdmin) {
    const answer = await api.hr.myAttendance(dates)
    const employee = answer.employee ?? null
    return {
      items: answer.items.map((item) => ({
        ...item,
        employee: item.employee ?? employee,
      })),
      totals: answer.totals ?? null,
      employee,
      current: answer.current ?? null,
    }
  }
  const items: AttendanceItem[] = []
  let totals: AttendanceTotals | null = null
  for (let page = 1; ; page += 1) {
    const answer = await api.hr.attendance({
      ...filters,
      ...dates,
      page,
      page_size: PAGE_SIZE,
    })
    items.push(...answer.items)
    totals ??= answer.totals ?? null
    const more = answer.has_next ?? page < (answer.total_pages ?? 1)
    if (!more || answer.items.length === 0) break
  }
  return { items, totals, employee: null, current: null }
}

const hasPunches = (items: AttendanceItem[]) =>
  items.some(
    (item) =>
      Boolean(item.check_in_at || item.check_in_time) ||
      (item.punch_count ?? 0) > 0 ||
      (item.log?.length ?? 0) > 0,
  )

const SUMMED = [
  'days',
  'working_days',
  'week_off_days',
  'holiday_days',
  'present_days',
  'absent_days',
  'late_days',
  'incomplete_days',
  'worked_minutes',
  'break_minutes',
] as const

/** The periods' own totals added up. People are counted once, from the rows. */
function addTotals(periods: Period[]): AttendanceTotals | null {
  const all = periods.flatMap((period) => (period.totals ? [period.totals] : []))
  if (all.length === 0) return null
  const sum: AttendanceTotals = { ...all[0] }
  for (const key of SUMMED) {
    const values = all.flatMap((totals) => totals[key] ?? [])
    sum[key] = values.length ? values.reduce((a, b) => a + b, 0) : null
  }
  sum.worked =
    sum.worked_minutes === null || sum.worked_minutes === undefined
      ? null
      : formatMinutes(sum.worked_minutes)
  const people = periods.flatMap((period) =>
    period.items.flatMap((item) => item.employee?.user_id ?? []),
  )
  sum.employees = new Set(people).size
  return sum
}

/**
 * "All Time". The API reads at most `MAX_RANGE_DAYS` days at once, so this reads one period after
 * another, going back from today, until a whole period has no check-in or punch at all (that one
 * is left out). The newest period is always kept.
 */
export async function readAllAttendance(
  isAdmin: boolean,
  filters: AllAttendanceFilters,
): Promise<AllAttendance> {
  const today = storeToday()
  const periods: Period[] = []
  for (let index = 0; index < MAX_PERIODS; index += 1) {
    const end = addDays(today, -MAX_RANGE_DAYS * index)
    const period = await readPeriod(
      isAdmin,
      filters,
      toYmd(addDays(end, 1 - MAX_RANGE_DAYS)),
      toYmd(end),
    )
    const empty = !hasPunches(period.items)
    // Today's period is kept even when empty, and the one before it is still looked at.
    if (empty && index > 0) break
    periods.push(period)
  }
  return {
    items: periods.flatMap((period) => period.items),
    totals: addTotals(periods),
    employee: periods[0]?.employee ?? null,
    current: periods[0]?.current ?? null,
  }
}
