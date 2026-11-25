import { Fragment, useState, type ReactNode } from 'react'
import { Badge } from '../../../components/ui/Badge.tsx'
import { Highlight } from '../../../components/ui/Highlight.tsx'
import {
  ActivityIcon,
  AlertTriangleIcon,
  CheckIcon,
  ClockIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  SearchIcon,
} from '../../../components/ui/icons.tsx'
import { useMediaQuery } from '../../../hooks/useMediaQuery.ts'
import type { AttendanceItem } from '../../../lib/api/endpoints.ts'
import { initials } from '../../../lib/format.ts'
import {
  formatClock,
  formatDay,
  formatMinutes,
  humanize,
  statusTone,
} from '../utils/format.ts'

const TH_BASE =
  'text-text border-border-strong bg-table-head sticky top-0 z-[1] border-b px-3.5 py-3 text-[0.7rem] font-bold tracking-wide whitespace-nowrap uppercase backdrop-blur'
const TH = `${TH_BASE} text-left`
const TH_CENTER = `${TH_BASE} text-center`
const TD = 'px-3.5 py-2.5 whitespace-nowrap'
const SKELETON_ROWS = 8
const MESSAGE_BUTTON =
  'border-border bg-bg text-text hover:border-accent cursor-pointer rounded-lg border px-4 py-2 text-[0.82rem] font-semibold transition-colors'

const rowKey = (item: AttendanceItem) =>
  `${item.employee?.user_id ?? 'me'}|${item.work_date}`

const nameOf = (item: AttendanceItem) =>
  item.employee?.full_name?.trim() || item.employee?.employee_code || '—'

interface AttendanceListProps {
  items: AttendanceItem[]
  /** An administrator's list has an Employee column. */
  isAdmin: boolean
  isPending: boolean
  error: string | null
  hasFilters: boolean
  /** Rows belong to the previous query while the new one loads. */
  isStale: boolean
  onRetry: () => void
  onClearFilters: () => void
}

function Message({ children }: { children: ReactNode }) {
  return (
    <div className="text-text-muted flex flex-col items-center gap-3 px-4 py-14 text-center text-[0.9rem]">
      {children}
    </div>
  )
}

function StatusPill({ item }: { item: AttendanceItem }) {
  return (
    <Badge tone={statusTone(item.status)} className="min-w-32 px-2.5">
      {item.status_label || humanize(item.status)}
    </Badge>
  )
}

function Employee({ item }: { item: AttendanceItem }) {
  const name = nameOf(item)
  return (
    <span className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className="bg-accent-tint text-accent inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-bold"
      >
        {item.employee?.initials || initials(name) || '?'}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="max-w-44 truncate font-semibold" title={name}>
          <Highlight text={name} />
        </span>
        <span className="text-text-muted text-[0.74rem]">
          {item.employee?.employee_code ? (
            <Highlight text={item.employee.employee_code} />
          ) : null}
          {item.employee?.employee_code && item.employee?.role_label ? ' · ' : ''}
          {item.employee?.role_label ?? ''}
        </span>
      </span>
    </span>
  )
}

/** The date with its weekday, and what kind of day it is when it isn't a plain working day. */
function DayCell({ item }: { item: AttendanceItem }) {
  const special =
    item.holiday_name || (item.day_type && item.day_type !== 'working')
      ? item.holiday_name || humanize(item.day_type)
      : null
  return (
    <span className="flex min-w-0 flex-col">
      <span className="font-semibold">{formatDay(item.work_date)}</span>
      <span className="text-text-muted text-[0.74rem]">
        {item.weekday ?? ''}
        {special ? ` · ${special}` : ''}
      </span>
    </span>
  )
}

const lateText = (item: AttendanceItem) =>
  item.is_late ? (item.late_minutes ? `Late by ${item.late_minutes} min` : 'Late') : '—'

/** The step name shown under a dot on the timeline. */
function stepLabel(entry: NonNullable<AttendanceItem['log']>[number]): string {
  switch (entry.action) {
    case 'check_in':
      return 'Check-in'
    case 'check_out':
      return 'Check-out'
    case 'break_in':
      return 'Break start'
    case 'break_out':
      return 'Break end'
    default:
      return entry.label || humanize(entry.action)
  }
}

const CARD = 'border-border bg-bg rounded-xl border p-3'
const CARD_TITLE = 'mb-2.5 flex items-center gap-2 text-[0.82rem] font-bold'

function Tile({
  label,
  value,
  tone = 'default',
  icon: Icon,
}: {
  label: string
  value: string
  tone?: 'default' | 'warning'
  icon: typeof ClockIcon
}) {
  return (
    <div
      className={`flex min-w-0 items-center gap-2.5 rounded-lg px-2.5 py-2 ${
        tone === 'warning' ? 'bg-warning-bg text-warning' : 'bg-accent-tint text-accent'
      }`}
    >
      <Icon width={16} height={16} className="hidden shrink-0 @md:block" />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="text-[0.68rem] opacity-80">{label}</span>
        <span className="text-[0.95rem] font-bold">{value}</span>
      </span>
    </div>
  )
}

/**
 * What sits under an opened row, as two cards: the **Daily Activity Timeline** (every punch of the
 * day in order as a stepper — the first and the last are filled, the last says "(Ongoing)" while it
 * has no check-out) and a **Summary** (worked, break, punches, late by, and any problems).
 */
function Details({ item, stacked = false }: { item: AttendanceItem; stacked?: boolean }) {
  // The punches stay in the order the backend sent them.
  const log = item.log ?? []
  const problems = item.problems ?? []
  const ongoing =
    log.length > 0 &&
    !item.check_out_at &&
    item.state !== 'off' &&
    log[log.length - 1].action !== 'check_out'
  const late = item.is_late
  const lateMinutes = item.late_minutes ?? 0

  return (
    <div>
      <div
        className={`grid gap-3 ${stacked ? '' : 'grid-cols-[minmax(0,13fr)_minmax(0,7fr)]'}`}
      >
        <section aria-label="Daily Activity Timeline" className={CARD}>
          <h3 className={CARD_TITLE}>
            <ClockIcon width={16} height={16} className="text-accent" />
            Daily Activity Timeline
          </h3>
          {log.length === 0 ? (
            <p className="text-text-muted text-[0.82rem]">
              Nothing was recorded this day.
            </p>
          ) : (
            <ol className="flex overflow-x-auto pb-1">
              {log.map((entry, index) => {
                const edge = index === 0 || index === log.length - 1
                return (
                  <li
                    key={entry.id ?? index}
                    className="relative flex min-w-[5.5rem] flex-1 flex-col items-center text-center"
                  >
                    {index > 0 && (
                      <span
                        aria-hidden="true"
                        className="bg-accent/50 absolute top-[0.45rem] right-1/2 left-[-50%] h-px"
                      />
                    )}
                    <span
                      aria-hidden="true"
                      className={`relative z-[1] h-3.5 w-3.5 rounded-full border-2 ${
                        entry.voided
                          ? 'border-danger bg-bg'
                          : edge
                            ? 'border-accent bg-accent ring-accent-tint ring-2'
                            : 'border-accent bg-bg'
                      }`}
                    />
                    <span
                      className={`mt-1.5 text-[0.76rem] font-semibold ${
                        entry.voided ? 'text-text-muted line-through' : ''
                      }`}
                    >
                      {stepLabel(entry)}
                    </span>
                    <span className="text-text-muted text-[0.76rem]">
                      {formatClock(entry.at, entry.time)}
                    </span>
                    {entry.voided && (
                      <span className="text-danger text-[0.68rem]">voided</span>
                    )}
                    {ongoing && index === log.length - 1 && (
                      <span className="text-text-muted text-[0.68rem]">Ongoing</span>
                    )}
                  </li>
                )
              })}
            </ol>
          )}
        </section>

        <section aria-label="Daily Summary" className={`${CARD} @container`}>
          <h3 className={CARD_TITLE}>
            <ActivityIcon width={16} height={16} className="text-accent" />
            Daily Summary
          </h3>
          <div className="grid grid-cols-2 gap-2 @xs:grid-cols-4">
            <Tile
              label="Worked"
              value={item.worked ?? formatMinutes(item.worked_minutes)}
              icon={ClockIcon}
            />
            <Tile
              label="Break"
              value={`${item.break_minutes ?? 0}m`}
              icon={ActivityIcon}
            />
            <Tile
              label="Punches"
              value={String(item.punch_count ?? log.length)}
              icon={ActivityIcon}
            />
            <Tile
              label={late ? 'Late by' : 'Arrival'}
              value={late ? (lateMinutes ? `${lateMinutes}m` : 'Late') : 'On time'}
              tone={late ? 'warning' : 'default'}
              icon={ClockIcon}
            />
          </div>
          {problems.length === 0 ? (
            <p className="text-text-muted mt-3 flex items-center gap-2 text-[0.8rem]">
              <CheckIcon width={14} height={14} className="text-accent" />
              No problems reported.
            </p>
          ) : (
            <ul className="text-warning mt-3 flex flex-col gap-1 text-[0.8rem]">
              {problems.map((problem, index) => (
                <li key={index} className="flex items-start gap-2">
                  <AlertTriangleIcon width={14} height={14} className="mt-0.5 shrink-0" />
                  {problem}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

/**
 * The results: a sticky-header table from `md` up (its own scrolling box) and stacked cards below it,
 * with the loading skeleton, error and empty states handled here. A chevron opens a row to the day's
 * punches, breaks and problems. Everything shown is the backend's answer.
 */
export function AttendanceList({
  items,
  isAdmin,
  isPending,
  error,
  hasFilters,
  isStale,
  onRetry,
  onClearFilters,
}: AttendanceListProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set())
  const toggle = (key: string) =>
    setOpen((current) => {
      const next = new Set(current)
      if (!next.delete(key)) next.add(key)
      return next
    })

  if (error) {
    return (
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
    )
  }

  if (!isPending && items.length === 0) {
    return (
      <Message>
        <SearchIcon width={28} height={28} />
        <div>
          <p className="text-text font-semibold">No attendance found</p>
          <p>
            {hasFilters
              ? 'Nothing matches the current search, dates and filters.'
              : 'No attendance has been recorded for these dates.'}
          </p>
        </div>
        {hasFilters && (
          <button type="button" className={MESSAGE_BUTTON} onClick={onClearFilters}>
            Clear all filters
          </button>
        )}
      </Message>
    )
  }

  const dim = isStale ? 'opacity-60' : ''
  const columns = isAdmin ? 10 : 9

  if (!isDesktop) {
    return (
      <ul
        aria-busy={isPending || isStale}
        className={`flex flex-col gap-2.5 p-3 transition-opacity duration-150 ${dim}`}
      >
        {isPending
          ? Array.from({ length: SKELETON_ROWS }, (_, index) => (
              <li
                key={index}
                aria-hidden="true"
                className="border-border bg-surface h-24 animate-pulse rounded-xl border"
              />
            ))
          : items.map((item) => {
              const key = rowKey(item)
              const isOpen = open.has(key)
              return (
                <li key={key} className="border-border bg-bg rounded-xl border p-3">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => toggle(key)}
                    className="flex w-full cursor-pointer items-start justify-between gap-3 border-none bg-transparent p-0 text-left"
                  >
                    <span className="flex min-w-0 flex-col gap-1">
                      {isAdmin && <Employee item={item} />}
                      <DayCell item={item} />
                    </span>
                    <StatusPill item={item} />
                  </button>
                  <p className="text-text-muted mt-2 flex flex-wrap gap-x-3 text-[0.8rem]">
                    <span>In {formatClock(item.check_in_at, item.check_in_time)}</span>
                    <span>Out {formatClock(item.check_out_at, item.check_out_time)}</span>
                    <span>
                      Worked {item.worked ?? formatMinutes(item.worked_minutes)}
                    </span>
                  </p>
                  {isOpen && (
                    <div className="border-border mt-3 border-t pt-3">
                      <Details item={item} stacked />
                    </div>
                  )}
                </li>
              )
            })}
      </ul>
    )
  }

  return (
    <div
      aria-busy={isPending || isStale}
      className="relative max-h-[min(68svh,760px)] overflow-auto lg:max-h-none lg:min-h-0 lg:flex-1"
    >
      <table
        className={`w-full min-w-[960px] border-collapse text-[0.85rem] transition-opacity duration-150 ${dim}`}
      >
        <thead>
          <tr>
            <th className={`${TH} w-10`}>
              <span className="sr-only">Details</span>
            </th>
            <th className={TH}>Date</th>
            {isAdmin && <th className={TH}>Employee</th>}
            <th className={TH_CENTER}>Status</th>
            <th className={TH}>Check In</th>
            <th className={TH}>Check Out</th>
            <th className={TH}>Breaks</th>
            <th className={TH}>Worked</th>
            <th className={TH}>Late</th>
            <th className={TH_CENTER}>Punches</th>
          </tr>
        </thead>
        <tbody>
          {isPending
            ? Array.from({ length: SKELETON_ROWS }, (_, row) => (
                <tr key={row} aria-hidden="true" className="border-border border-b">
                  {Array.from({ length: columns }, (_, cell) => (
                    <td key={cell} className={TD}>
                      <div className="bg-border/70 h-4 w-full max-w-24 animate-pulse rounded" />
                    </td>
                  ))}
                </tr>
              ))
            : items.map((item) => {
                const key = rowKey(item)
                const isOpen = open.has(key)
                const Chevron = isOpen ? ChevronDownIcon : ChevronRightIcon
                return (
                  <Fragment key={key}>
                    <tr className="border-border even:bg-surface hover:bg-accent-tint/60 border-b transition-colors">
                      <td className={TD}>
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          aria-label={`${isOpen ? 'Hide' : 'Show'} details for ${formatDay(item.work_date)}${isAdmin ? ` — ${nameOf(item)}` : ''}`}
                          onClick={() => toggle(key)}
                          className="text-text-muted hover:text-accent cursor-pointer border-none bg-transparent p-0.5"
                        >
                          <Chevron width={16} height={16} />
                        </button>
                      </td>
                      <td className={TD}>
                        <DayCell item={item} />
                      </td>
                      {isAdmin && (
                        <td className={TD}>
                          <Employee item={item} />
                        </td>
                      )}
                      <td className={`${TD} text-center`}>
                        <StatusPill item={item} />
                      </td>
                      <td className={TD}>
                        {formatClock(item.check_in_at, item.check_in_time)}
                      </td>
                      <td className={TD}>
                        {formatClock(item.check_out_at, item.check_out_time)}
                      </td>
                      <td className={TD}>
                        {(item.breaks?.length ?? 0) > 0 || (item.break_minutes ?? 0) > 0
                          ? `${item.breaks?.length ?? 0} · ${formatMinutes(item.break_minutes)}`
                          : '—'}
                      </td>
                      <td className={`${TD} font-semibold`}>
                        {item.worked ?? formatMinutes(item.worked_minutes)}
                      </td>
                      <td
                        className={`${TD} ${item.is_late ? 'text-warning font-semibold' : 'text-text-muted'}`}
                      >
                        {lateText(item)}
                      </td>
                      <td className={`${TD} text-center`}>{item.punch_count ?? 0}</td>
                    </tr>
                    {isOpen && (
                      <tr className="border-border bg-accent-tint/30 border-accent border-b border-l-2">
                        <td colSpan={columns} className="px-3 py-2.5">
                          <Details item={item} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
        </tbody>
      </table>
    </div>
  )
}
