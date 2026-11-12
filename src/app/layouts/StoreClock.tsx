import { useEffect, useState } from 'react'
import { ClockIcon } from '../../components/ui/icons.tsx'
import { getStoreTimeZone, storeTimeZoneAbbreviation } from '../../lib/storeTime.ts'

/** "UTC+01:00" (British summer time) or "UTC+00:00" (winter) — the zone's offset at this moment. */
function utcOffset(date: Date, timeZone: string): string {
  const part = new Intl.DateTimeFormat('en-GB', { timeZone, timeZoneName: 'longOffset' })
    .formatToParts(date)
    .find((item) => item.type === 'timeZoneName')?.value
  if (!part) return ''
  // "GMT" alone means no offset; "GMT+01:00" becomes "UTC+01:00".
  return part === 'GMT' ? 'UTC+00:00' : part.replace('GMT', 'UTC')
}

/** "2:45:07 PM" — 12-hour clock with seconds and AM / PM, on the store's zone. */
function formatTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(date)
}

/** "Tue, 12 Nov 2026" — weekday, day, month, year, on the store's zone. */
function formatDate(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).formatToParts(date)
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  return `${pick('weekday')}, ${pick('day')} ${pick('month')} ${pick('year')}`
}

/**
 * A live clock on the store's time zone, as a rounded pill: a clock tile, a thin divider, then the
 * time ("2:45 PM") with its zone label — **BST** (British Summer Time) in summer, **GMT** in
 * winter, for Europe/London, or whatever zone `GET /shops` gives — and the date under it. The
 * zone's name and its offset from UTC are in the hover text. It re-reads the time every second, so
 * the minute changes on the dot. Hidden on narrow screens, where the top bar has no room for it.
 */
export function StoreClock() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const zone = getStoreTimeZone()
  const abbreviation = storeTimeZoneAbbreviation(now.toISOString())
  const offset = utcOffset(now, zone)
  const time = formatTime(now, zone)
  const date = formatDate(now, zone)

  return (
    <div
      role="timer"
      aria-label={`Store time: ${time} ${abbreviation}, ${date}, ${zone}`}
      title={`Store time — ${zone} (${abbreviation}, ${offset}). Britain is on GMT in winter and BST, British Summer Time (UTC+01:00), from the end of March to the end of October.`}
      className="border-border bg-bg hidden h-9 shrink-0 items-center gap-2 rounded-lg border pr-3 pl-1 lg:flex"
    >
      <span className="bg-accent-tint text-accent flex h-7 w-7 shrink-0 items-center justify-center rounded-md">
        <ClockIcon width={15} height={15} />
      </span>
      <span aria-hidden="true" className="bg-accent/25 h-6 w-px shrink-0" />
      <div className="flex flex-col leading-none">
        <span className="flex items-center gap-1.5">
          <span className="text-text text-[0.75rem] font-bold tabular-nums">{time}</span>
          <span className="bg-accent-tint text-accent rounded-full px-1.5 py-px text-[0.6rem] font-bold">
            {abbreviation}
          </span>
        </span>
        <span className="text-text-muted mt-0.5 text-[0.62rem] whitespace-nowrap">
          {date}
        </span>
      </div>
    </div>
  )
}
