import { useMemo, useState, type ComponentType } from 'react'
import { Badge } from '../../../components/ui/Badge.tsx'
import { DETAIL_CARD } from '../../../components/ui/DetailSection.tsx'
import {
  ActivityIcon,
  ArchiveIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ClockIcon,
  CreditCardIcon,
  FileTextIcon,
  LayersIcon,
  MailIcon,
  OrdersIcon,
  PoundIcon,
  ShieldCheckIcon,
  TruckIcon,
  type IconProps,
} from '../../../components/ui/icons.tsx'
import { SelectField, type SelectOption } from '../../../components/ui/SelectField.tsx'
import type { OrderDetail } from '../../../lib/api/endpoints.ts'
import { formatTimestamp } from '../../../lib/format.ts'
import {
  formatStoreClock,
  getStoreTimeZone,
  storeTimeZoneAbbreviation,
} from '../../../lib/storeTime.ts'
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  countByCategory,
  groupTimelineByDay,
  parseTimelineEvents,
  type TimelineCategory,
  type TimelineEvent,
  type TimelineIcon,
} from '../utils/timeline.ts'

const ICONS: Record<TimelineIcon, ComponentType<IconProps>> = {
  order: OrdersIcon,
  confirmation: FileTextIcon,
  card: CreditCardIcon,
  shield: ShieldCheckIcon,
  mail: MailIcon,
  confirmed: CheckCircleIcon,
  fulfillment: TruckIcon,
  pending: ClockIcon,
  schedule: LayersIcon,
  archive: ArchiveIcon,
  payout: PoundIcon,
  activity: ActivityIcon,
}

const BUTTON =
  'border-border bg-bg text-text hover:border-accent inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-[0.82rem] font-semibold transition-colors'

const plural = (count: number, word: string) =>
  `${count.toLocaleString('en-GB')} ${word}${count === 1 ? '' : 's'}`

function EventRow({
  event,
  open,
  onToggle,
}: {
  event: TimelineEvent
  open: boolean
  onToggle: () => void
}) {
  const Icon = ICONS[event.icon]
  const bodyId = `timeline-${event.key}`
  const time = formatStoreClock(event.occurredAt)

  return (
    <li className="border-border bg-bg overflow-hidden rounded-lg border">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={onToggle}
        className="hover:bg-accent-tint/60 grid w-full cursor-pointer grid-cols-[2rem_minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-1 border-none bg-transparent px-3 py-2 text-left transition-colors md:grid-cols-[2rem_13rem_minmax(0,1fr)_auto_auto_auto]"
      >
        <span
          aria-hidden="true"
          className="bg-accent-tint text-accent border-border-strong flex h-8 w-8 items-center justify-center rounded-lg border"
        >
          <Icon width={16} height={16} />
        </span>
        <span className="min-w-0 truncate text-[0.88rem] font-semibold">
          {event.title}
        </span>
        <span
          title={event.message}
          className="text-text-muted min-w-0 text-[0.85rem] leading-snug max-md:order-2 max-md:col-span-4 max-md:line-clamp-2 md:truncate"
        >
          {event.message || '—'}
        </span>
        <span className="max-md:order-3 max-md:col-span-3 max-md:col-start-2 md:justify-self-end">
          {event.badge && (
            <Badge tone={event.badge.tone} className="!px-2 !py-0 !text-[0.7rem]">
              {event.badge.label}
            </Badge>
          )}
        </span>
        <span className="text-text-muted text-[0.78rem] tabular-nums max-md:order-1">
          {time || '—'}
        </span>
        <ChevronDownIcon
          width={16}
          height={16}
          className={`text-text-muted transition-transform max-md:order-1 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div
          id={bodyId}
          className="border-border bg-surface/60 flex flex-col gap-3 border-t px-4 py-3 md:pl-[3.5rem]"
        >
          <p className="m-0 text-[0.85rem] leading-relaxed break-words whitespace-pre-wrap">
            {event.message || 'No message was sent with this event.'}
          </p>
          <dl className="m-0 grid grid-cols-1 gap-x-6 gap-y-2 min-[520px]:grid-cols-2 lg:grid-cols-4">
            <Detail label="Time">
              {formatTimestamp(event.occurredAt)
                ? `${formatTimestamp(event.occurredAt)} ${storeTimeZoneAbbreviation(event.occurredAt)}`.trim()
                : '—'}
            </Detail>
            <Detail label="Time zone">{getStoreTimeZone()}</Detail>
            {event.author && <Detail label="By">{event.author}</Detail>}
            <Detail label="Category">{CATEGORY_LABELS[event.category]}</Detail>
            {event.verb && (
              <Detail label="Event">
                <span className="font-mono text-[0.8rem]">{event.verb}</span>
              </Detail>
            )}
            {event.details.map(([label, value]) => (
              <Detail key={label} label={label}>
                {value}
              </Detail>
            ))}
          </dl>
        </div>
      )}
    </li>
  )
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-text-muted mb-0.5 text-[0.7rem] font-bold tracking-wide uppercase">
        {label}
      </dt>
      <dd className="m-0 text-[0.85rem] font-medium break-words">{children}</dd>
    </div>
  )
}

/**
 * The **Timeline** tab: the order's events (`order.events`: `verb`, `message`, `author`,
 * `occurred_at`) as a vertical timeline grouped by day on the store's clock — a date chip on
 * the left, a line with a marker per day, and a compact row per event (icon, readable title,
 * the store's own message, a badge only when it means something, the time) that opens to the
 * whole message, the full time, who did it and any other details. A dropdown filters by category
 * (the count follows) and Expand all opens every row. Nothing is asked of the backend: it
 * reads what the order already carries, and no event is dropped (unknown verbs get a readable
 * name and a default icon).
 */
export function OrderTimelinePanel({ order }: { order: OrderDetail }) {
  const events = useMemo(() => parseTimelineEvents(order.events), [order.events])
  const [category, setCategory] = useState<TimelineCategory | 'all'>('all')
  const [openKeys, setOpenKeys] = useState<ReadonlySet<string>>(new Set())

  const counts = useMemo(() => countByCategory(events), [events])
  const shown = useMemo(
    () =>
      category === 'all' ? events : events.filter((event) => event.category === category),
    [events, category],
  )
  const days = useMemo(() => groupTimelineByDay(shown), [shown])

  const options: SelectOption[] = [
    { value: 'all', label: `All events (${events.length.toLocaleString('en-GB')})` },
    ...CATEGORY_ORDER.filter((value) => counts[value]).map((value) => ({
      value,
      label: `${CATEGORY_LABELS[value]} (${counts[value]})`,
    })),
  ]
  // A category that no longer has events (the order was re-read) falls back to everything.
  const selected = category === 'all' || counts[category] ? category : 'all'

  const allOpen = shown.length > 0 && shown.every((event) => openKeys.has(event.key))

  function toggle(key: string) {
    setOpenKeys((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function toggleAll() {
    setOpenKeys(allOpen ? new Set() : new Set(shown.map((event) => event.key)))
  }

  return (
    <section aria-label="Order timeline" className={`${DETAIL_CARD} flex flex-col`}>
      <header className="border-border-strong flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-3 sm:px-5">
        <span
          aria-hidden="true"
          className="bg-accent-tint text-accent border-border-strong flex h-9 w-9 shrink-0 items-center justify-center rounded-full border"
        >
          <ClockIcon width={18} height={18} />
        </span>
        <h3 className="text-[1.05rem] font-bold">Timeline</h3>
        <span className="bg-accent-tint text-accent rounded-full px-2.5 py-0.5 text-[0.7rem] font-bold">
          {selected === 'all'
            ? plural(events.length, 'event')
            : `${shown.length.toLocaleString('en-GB')} of ${plural(events.length, 'event')}`}
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {shown.length > 0 && (
            <button type="button" onClick={toggleAll} className={BUTTON}>
              {allOpen ? 'Collapse all' : 'Expand all'}
            </button>
          )}
          <div className="w-44">
            <SelectField
              compact
              id="timeline-category"
              label="Filter events"
              hideLabel
              value={selected}
              options={options}
              onChange={(value) => setCategory(value as TimelineCategory | 'all')}
            />
          </div>
        </div>
      </header>

      {events.length === 0 ? (
        <p className="text-text-muted m-0 px-5 py-10 text-center text-[0.9rem]">
          No events yet.
        </p>
      ) : shown.length === 0 ? (
        <p className="text-text-muted m-0 px-5 py-10 text-center text-[0.9rem]">
          No events in this category.
        </p>
      ) : (
        <ol className="m-0 flex list-none flex-col gap-6 p-3 sm:p-5">
          {days.map((day, index) => (
            <li
              key={day.key}
              className="grid gap-3 md:grid-cols-[9.5rem_1.25rem_minmax(0,1fr)] md:gap-x-3"
            >
              <div className="border-border-strong bg-accent-tint/50 flex h-fit flex-col rounded-xl border px-3 py-2 max-md:flex-row max-md:items-baseline max-md:gap-2">
                <span className="text-[0.88rem] font-bold">{day.label}</span>
                <span className="text-text-muted text-[0.78rem]">
                  {plural(day.events.length, 'event')}
                </span>
              </div>

              {/* The line and this day's marker (from `md`; below it the date sits above its events). */}
              <div aria-hidden="true" className="relative hidden md:block">
                {index < days.length - 1 && (
                  <span className="bg-accent/30 absolute top-4 -bottom-6 left-1/2 w-px -translate-x-1/2" />
                )}
                <span className="border-accent bg-bg absolute top-3 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full border-2" />
              </div>

              <ul className="m-0 flex min-w-0 list-none flex-col gap-1.5 p-0">
                {day.events.map((event) => (
                  <EventRow
                    key={event.key}
                    event={event}
                    open={openKeys.has(event.key)}
                    onToggle={() => toggle(event.key)}
                  />
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
