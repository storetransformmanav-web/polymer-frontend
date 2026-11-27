import type { ReactNode } from 'react'
import { Highlight } from '../../../components/ui/Highlight.tsx'
import { AlertTriangleIcon, SearchIcon } from '../../../components/ui/icons.tsx'
import { ariaSort, SortButton } from '../../../components/ui/SortButton.tsx'
import type {
  MonthCell,
  MonthDay,
  MonthlyAttendanceSort,
  MonthRow,
} from '../../../lib/api/endpoints.ts'
import { initials } from '../../../lib/format.ts'
import { employeeKey, employeeName } from '../utils/employee.ts'
import {
  formatClock,
  formatDayLongName,
  formatMinutes,
  humanize,
} from '../utils/format.ts'
import { CELL_LEGEND, CELL_STYLES, cellKind, monthLabel } from '../utils/month.ts'

/** Column widths in rem: the table is fixed-layout, and its least width follows the days shown. */
const MEMBER_REM = 15
const DAY_REM = 5.9
const TOTAL_REM = 8.5
const SKELETON_ROWS = 8

const TH =
  'border-border-strong bg-table-head text-text sticky top-0 border-b px-2 py-2.5 text-[0.7rem] font-bold tracking-wide uppercase'
// The member column stays at the left while the days scroll; the total stays at the right from `sm`.
const STICKY_MEMBER = 'sticky left-0 border-r'
const STICKY_TOTAL = 'sm:sticky sm:right-0 sm:border-l'
const MESSAGE_BUTTON =
  'border-border bg-bg text-text hover:border-accent cursor-pointer rounded-lg border px-4 py-2 text-[0.82rem] font-semibold transition-colors'

function Message({ children }: { children: ReactNode }) {
  return (
    <div className="text-text-muted flex flex-col items-center gap-3 px-4 py-14 text-center text-[0.9rem]">
      {children}
    </div>
  )
}

/** Everything known about one day, for the hover and for screen readers. */
function cellSummary(cell: MonthCell, day: MonthDay): string {
  const lines = [formatDayLongName(cell.date)]
  if (day.holiday_name) lines.push(day.holiday_name)
  if (cell.status) lines.push(humanize(cell.status))
  if (cell.check_in_time) lines.push(`In ${formatClock(null, cell.check_in_time)}`)
  if (cell.check_out_time) lines.push(`Out ${formatClock(null, cell.check_out_time)}`)
  if ((cell.worked_minutes ?? 0) > 0 || (cell.expected_minutes ?? 0) > 0) {
    lines.push(
      `Worked ${cell.worked ?? formatMinutes(cell.worked_minutes)} of ${formatMinutes(cell.expected_minutes)}`,
    )
  }
  const tags = (cell.tags ?? []).map(humanize)
  if (tags.length) lines.push(tags.join(', '))
  return lines.join('\n')
}

/** One day of one member: the hours worked, coloured by the backend's tone. */
function DayValue({ cell, day }: { cell: MonthCell | undefined; day: MonthDay }) {
  if (!cell) return <span className="text-text-muted/60">–</span>
  const kind = cellKind(cell)
  const summary = cellSummary(cell, day)
  if (kind === 'blank') {
    return (
      <span className="text-text-muted/60 block py-2" title={summary}>
        <span aria-hidden="true">–</span>
        <span className="sr-only">{summary}</span>
      </span>
    )
  }
  const hasHours = (cell.worked_minutes ?? 0) > 0
  const value = hasHours
    ? (cell.worked ?? formatMinutes(cell.worked_minutes))
    : humanize(kind === 'live' ? 'working' : kind)
  const under = cell.check_in_time
    ? `${cell.is_late ? 'Late' : 'In'} ${formatClock(null, cell.check_in_time)}`
    : null
  return (
    <span
      title={summary}
      className={`flex h-11 flex-col items-center justify-center rounded-lg border px-1 leading-tight ${CELL_STYLES[kind]}`}
    >
      <span
        aria-hidden="true"
        className={`max-w-full truncate font-bold ${hasHours ? 'text-[0.78rem]' : 'text-[0.68rem]'}`}
      >
        {value}
      </span>
      {under && (
        <span
          aria-hidden="true"
          className={`max-w-full truncate text-[0.6rem] ${cell.is_late ? 'text-warning font-bold' : 'opacity-80'}`}
        >
          {under}
        </span>
      )}
      <span className="sr-only">{summary}</span>
    </span>
  )
}

function Member({ row, onOpen }: { row: MonthRow; onOpen: (row: MonthRow) => void }) {
  const { employee } = row
  const name = employeeName(employee)
  const inactive = row.is_active === false
  return (
    <span className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className={`hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[0.72rem] font-bold sm:inline-flex ${
          inactive ? 'bg-border text-text-muted' : 'bg-accent text-accent-contrast'
        }`}
      >
        {employee.initials || initials(name) || '?'}
      </span>
      <span className="flex min-w-0 flex-col items-start">
        {employeeKey(employee) ? (
          <button
            type="button"
            onClick={() => onOpen(row)}
            title={`Open the attendance of ${name}`}
            className={`hover:text-accent focus-visible:outline-accent max-w-full cursor-pointer truncate border-none bg-transparent p-0 text-left text-[0.84rem] font-semibold underline-offset-2 hover:underline focus-visible:outline-2 ${
              inactive ? 'text-text-muted' : 'text-text'
            }`}
          >
            <Highlight text={name} />
          </button>
        ) : (
          <span className="max-w-full truncate text-[0.84rem] font-semibold">{name}</span>
        )}
        <span className="text-text-muted max-w-full truncate text-[0.7rem]">
          {employee.employee_code && <Highlight text={employee.employee_code} />}
          {employee.employee_code && employee.role_label ? ' · ' : ''}
          {employee.role_label ?? ''}
          {inactive ? ' · Inactive' : ''}
        </span>
      </span>
    </span>
  )
}

function Total({ row }: { row: MonthRow }) {
  const worked = (row.total_minutes ?? 0) > 0
  return (
    <span
      className="flex flex-col items-center gap-0.5"
      title={`${row.present_days ?? 0} present · ${row.absent_days ?? 0} absent · ${row.late_days ?? 0} late`}
    >
      <span
        className={`inline-block min-w-24 rounded-lg border px-2 py-1 text-[0.82rem] font-bold ${
          worked
            ? 'border-info/30 bg-info-bg text-info'
            : 'border-border bg-surface text-text-muted'
        }`}
      >
        {row.total ?? formatMinutes(row.total_minutes)}
      </span>
      {(row.expected_minutes ?? 0) > 0 && (
        <span className="text-text-muted text-[0.62rem]">
          of {formatMinutes(row.expected_minutes)}
        </span>
      )}
    </span>
  )
}

const dayShade = (day: MonthDay) =>
  day.is_today ? 'bg-accent-tint' : day.is_weekend || day.holiday_name ? 'bg-page/70' : ''

interface MonthlyGridProps {
  month: string
  /** The days to draw as columns (none in the future). */
  days: MonthDay[]
  rows: MonthRow[]
  sort: MonthlyAttendanceSort
  order: 'asc' | 'desc'
  isPending: boolean
  error: string | null
  hasFilters: boolean
  /** Rows belong to the previous query while the new one loads. */
  isStale: boolean
  onSort: (sort: MonthlyAttendanceSort) => void
  onOpen: (row: MonthRow) => void
  onRetry: () => void
  onClearFilters: () => void
}

/**
 * The month's grid, in its own scrolling box: one row per member, one column per day up to today and
 * the total hours. The header, the member column and (from `sm`) the total column stay in place.
 */
export function MonthlyGrid({
  month,
  days,
  rows,
  sort,
  order,
  isPending,
  error,
  hasFilters,
  isStale,
  onSort,
  onOpen,
  onRetry,
  onClearFilters,
}: MonthlyGridProps) {
  const title = (
    <div className="border-border flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-4 py-2.5">
      <h2 className="m-0 text-[0.82rem] font-bold tracking-wide uppercase">
        Daily hours · {monthLabel(month)}
      </h2>
      <ul
        aria-label="Colour key"
        className="text-text-muted flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[0.72rem]"
      >
        {CELL_LEGEND.map((entry) => (
          <li key={entry.kind} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={`h-3 w-3 rounded-full border ${CELL_STYLES[entry.kind]}`}
            />
            {entry.label}
          </li>
        ))}
      </ul>
    </div>
  )

  if (error) {
    return (
      <>
        {title}
        <Message>
          <AlertTriangleIcon width={28} height={28} className="text-danger" />
          <div>
            <p className="text-text font-semibold">Couldn&apos;t load attendance</p>
            <p>{error}</p>
          </div>
          <button type="button" className={MESSAGE_BUTTON} onClick={onRetry}>
            Try again
          </button>
        </Message>
      </>
    )
  }

  if (!isPending && rows.length === 0) {
    return (
      <>
        {title}
        <Message>
          <SearchIcon width={28} height={28} />
          <div>
            <p className="text-text font-semibold">No members found</p>
            <p>
              {hasFilters
                ? 'Nothing matches the current month, search and filters.'
                : 'No attendance has been recorded for this month.'}
            </p>
          </div>
          {hasFilters && (
            <button type="button" className={MESSAGE_BUTTON} onClick={onClearFilters}>
              Clear all filters
            </button>
          )}
        </Message>
      </>
    )
  }

  // The member, the days, the spare column and the total.
  const columns = days.length + 3

  return (
    <>
      {title}
      <div
        aria-busy={isPending || isStale}
        className="relative max-h-[min(68svh,760px)] overflow-auto lg:max-h-none lg:min-h-0 lg:flex-1"
      >
        <table
          style={{ minWidth: `${MEMBER_REM + TOTAL_REM + days.length * DAY_REM}rem` }}
          className={`w-full table-fixed border-separate border-spacing-0 transition-opacity duration-150 ${
            isStale ? 'opacity-60' : ''
          }`}
        >
          <thead>
            <tr>
              <th
                scope="col"
                aria-sort={ariaSort(sort === 'name', order)}
                className={`${TH} ${STICKY_MEMBER} z-[3] w-40 pl-4 text-left sm:w-60`}
              >
                <SortButton
                  label="Member"
                  active={sort === 'name'}
                  order={order}
                  onClick={() => onSort('name')}
                />
              </th>
              {days.map((day) => (
                <th
                  key={day.date}
                  scope="col"
                  style={{ width: `${DAY_REM}rem` }}
                  title={
                    day.holiday_name
                      ? `${formatDayLongName(day.date)} · ${day.holiday_name}`
                      : formatDayLongName(day.date)
                  }
                  className={`${TH} z-[2] text-center ${day.is_today ? 'shadow-[inset_0_-3px_0_var(--color-accent)]' : ''}`}
                >
                  <span
                    className={`block text-[0.92rem] leading-tight ${day.is_today ? 'text-accent' : ''}`}
                  >
                    {day.day ?? Number(day.date.slice(8, 10))}
                  </span>
                  <span className="text-text-muted block text-[0.62rem] font-semibold">
                    {day.is_today ? 'Today' : (day.weekday ?? '')}
                  </span>
                </th>
              ))}
              {/* Takes the spare width early in a month, when there are only a few days. */}
              <th aria-hidden="true" className={`${TH} z-[2] px-0`} />
              <th
                scope="col"
                aria-sort={ariaSort(sort === 'total', order)}
                style={{ width: `${TOTAL_REM}rem` }}
                className={`${TH} ${STICKY_TOTAL} z-[3] text-center`}
              >
                <SortButton
                  label="Total hours"
                  active={sort === 'total'}
                  order={order}
                  onClick={() => onSort('total')}
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {isPending
              ? Array.from({ length: SKELETON_ROWS }, (_, row) => (
                  <tr key={row} aria-hidden="true">
                    {Array.from({ length: columns }, (_, cell) => (
                      <td key={cell} className="border-border border-b px-2 py-3">
                        <div className="bg-border/70 h-5 w-full animate-pulse rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map((row, index) => {
                  const cells = new Map(row.days.map((cell) => [cell.date, cell]))
                  return (
                    <tr key={employeeKey(row.employee) || index} className="group">
                      {/* Pinned cells are solid, so the days never show through them. */}
                      <th
                        scope="row"
                        className={`${STICKY_MEMBER} border-border bg-bg group-hover:bg-accent-tint z-[1] border-b py-2 pr-2 pl-4 text-left font-normal`}
                      >
                        <Member row={row} onOpen={onOpen} />
                      </th>
                      {days.map((day) => (
                        <td
                          key={day.date}
                          className={`border-border group-hover:bg-accent-tint/60 border-b px-1 py-1.5 text-center ${dayShade(day)}`}
                        >
                          <DayValue cell={cells.get(day.date)} day={day} />
                        </td>
                      ))}
                      <td
                        aria-hidden="true"
                        className="border-border group-hover:bg-accent-tint/60 border-b"
                      />
                      <td
                        className={`${STICKY_TOTAL} border-border bg-bg group-hover:bg-accent-tint z-[1] border-b px-2 py-1.5 text-center`}
                      >
                        <Total row={row} />
                      </td>
                    </tr>
                  )
                })}
          </tbody>
        </table>
      </div>
    </>
  )
}
