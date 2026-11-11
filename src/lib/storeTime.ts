/**
 * The store's time zone. Every time on screen is shown the way Shopify shows it — in the store's
 * zone, not the viewer's computer — so an order's time matches Shopify's. The zone comes from
 * `GET /shops` (`items[].timezone`); until it is known (or when a store has none) it is
 * `Europe/London`, which switches between GMT and BST by itself, so no offset is ever hard-coded.
 * The API's values are not changed: they are already correct, only the display is.
 */

export const DEFAULT_TIME_ZONE = 'Europe/London'

let current = DEFAULT_TIME_ZONE

/** Whether Intl knows this zone name. */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone })
    return true
  } catch {
    return false
  }
}

/** Sets the zone every date is shown in; an empty or unknown name gives the default. */
export function setStoreTimeZone(timeZone: string | null | undefined): string {
  current = timeZone && isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE
  return current
}

export function getStoreTimeZone(): string {
  return current
}

/** "2026-11-11T02:10:29Z" → "11 Nov 2026, 02:10" — in the store's zone, 24-hour clock. */
export function formatStoreDate(
  iso: string | null | undefined,
  timeZone: string = current,
): string {
  if (!iso) return ''
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso))
}

/** The calendar parts of an instant as the store's clock shows them. */
function partsInZone(time: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(time))
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value)
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  }
}

/** How far the store's clock is ahead of UTC at this instant (ms): +1 h in British summer time. */
function offsetAt(time: number, timeZone: string): number {
  const p = partsInZone(time, timeZone)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return asUtc - Math.floor(time / 1000) * 1000
}

/**
 * "Today" in the store: a date whose local year / month / day are the store's calendar day right
 * now, so `toYmd` of it is the store's day (used for the "Today" and "Last N days" choices).
 */
export function storeToday(timeZone: string = current): Date {
  const p = partsInZone(Date.now(), timeZone)
  return new Date(p.year, p.month - 1, p.day)
}

/**
 * A time on the store's clock ("2026-11-11" and "00:00:00") → the ISO instant it is, for the
 * API's `from` / `to`. Undefined when the text isn't a real date and time.
 */
export function storeTimeToIso(
  day: string,
  time: string,
  timeZone: string = current,
): string | undefined {
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)
  const clock = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(time)
  if (!date || !clock) return undefined
  const guess = Date.UTC(
    Number(date[1]),
    Number(date[2]) - 1,
    Number(date[3]),
    Number(clock[1]),
    Number(clock[2]),
    Number(clock[3] ?? 0),
  )
  if (Number.isNaN(guess)) return undefined
  let instant = guess - offsetAt(guess, timeZone)
  // Right after a clock change the first guess can be an hour out: settle it once more.
  const settled = guess - offsetAt(instant, timeZone)
  if (settled !== instant) instant = settled
  return new Date(instant).toISOString()
}

/** "10:37 am" — the time of day on the store's clock, 12-hour, lower-case am / pm. */
function clockTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
    .format(date)
    .replace(/\s/g, ' ')
    .toLowerCase()
}

/**
 * A moment the way a busy list shows it, on the store's clock:
 * today → "Today at 10:37 am", yesterday → "Yesterday at 11:45 pm", the days before that up to a
 * week → "Monday at 9:40 am", and anything older → "4 Nov at 10:38 am" ("4 Nov 2025 at …" when
 * it is not this year). Days are the store's calendar days, not 24-hour spans. `now` is only
 * for tests.
 */
export function formatRelativeDateTime(
  iso: string | null | undefined,
  now: Date = new Date(),
  timeZone: string = current,
): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''

  const then = partsInZone(date.getTime(), timeZone)
  const today = partsInZone(now.getTime(), timeZone)
  const dayNumber = (p: { year: number; month: number; day: number }) =>
    Date.UTC(p.year, p.month - 1, p.day) / 86_400_000
  const daysAgo = dayNumber(today) - dayNumber(then)
  const time = clockTime(date, timeZone)

  if (daysAgo <= 0) return `Today at ${time}`
  if (daysAgo === 1) return `Yesterday at ${time}`
  if (daysAgo < 7) {
    const weekday = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      weekday: 'long',
    }).format(date)
    return `${weekday} at ${time}`
  }
  const day = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    day: 'numeric',
    month: 'short',
    ...(then.year === today.year ? {} : { year: 'numeric' }),
  }).format(date)
  return `${day} at ${time}`
}
