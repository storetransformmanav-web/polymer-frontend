import { useEffect, useState } from 'react'
import { ClockIcon } from '../../components/ui/icons.tsx'
import {
  formatStoreClock,
  getStoreTimeZone,
  storeTimeZoneAbbreviation,
} from '../../lib/storeTime.ts'

/**
 * A live clock on the store's time zone (BST in summer, GMT in winter for Europe/London — whatever
 * zone `GET /shops` gives), ticking every second, so what the pages show can be read against "now".
 * Hidden on narrow screens, where the top bar has no room for it.
 */
export function StoreClock() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const iso = now.toISOString()
  const zone = getStoreTimeZone()
  const date = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(now)

  return (
    <div
      role="timer"
      aria-label={`Store time, ${zone}`}
      title={`Store time (${zone})`}
      className="border-border bg-surface text-text hidden h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-[0.82rem] lg:flex"
    >
      <ClockIcon width={15} height={15} className="text-accent shrink-0" />
      <span className="text-text-muted">{date}</span>
      <span className="font-semibold tabular-nums">{formatStoreClock(iso)}</span>
      <span className="bg-accent-tint text-accent rounded px-1.5 py-0.5 text-[0.68rem] font-bold">
        {storeTimeZoneAbbreviation(iso)}
      </span>
    </div>
  )
}
