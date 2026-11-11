import type { BadgeTone } from '../../../components/ui/Badge.tsx'
import { formatStoreDay, storeDateKey } from '../../../lib/storeTime.ts'

/** The groups the filter offers. `other` is any verb this app has no name for. */
export type TimelineCategory =
  'order' | 'payment' | 'fulfillment' | 'notification' | 'payout' | 'security' | 'other'

/** Which icon an event gets (the component maps these to its SVGs). */
export type TimelineIcon =
  | 'order'
  | 'confirmation'
  | 'card'
  | 'shield'
  | 'mail'
  | 'confirmed'
  | 'fulfillment'
  | 'pending'
  | 'schedule'
  | 'archive'
  | 'payout'
  | 'activity'

export const CATEGORY_LABELS: Record<TimelineCategory, string> = {
  order: 'Orders',
  payment: 'Payments',
  fulfillment: 'Fulfillment',
  notification: 'Notifications',
  payout: 'Payouts',
  security: 'Security',
  other: 'Other',
}

/** The order the filter lists its categories in. */
export const CATEGORY_ORDER: TimelineCategory[] = [
  'order',
  'payment',
  'fulfillment',
  'notification',
  'payout',
  'security',
  'other',
]

/** One timeline event, read from the order's `events` (`verb`, `message`, `author`, `occurred_at`). */
export interface TimelineEvent {
  /** Unique among the events shown (the position breaks ties between identical events). */
  key: string
  verb: string
  title: string
  category: TimelineCategory
  icon: TimelineIcon
  /** The store's own message, exactly as sent. */
  message: string
  author: string | null
  /** The instant, as the API sent it. */
  occurredAt: string
  /** The instant in milliseconds (for ordering). */
  time: number
  badge: { label: string; tone: BadgeTone } | null
  /** Any other plain fields the event carried, as label / value. */
  details: [string, string][]
}

/** A day's events, under the store's calendar day. */
export interface TimelineDay {
  /** "2026-11-05" on the store's clock. */
  key: string
  /** "Nov 5, 2026". */
  label: string
  events: TimelineEvent[]
}

interface Known {
  title: string
  category: TimelineCategory
  icon: TimelineIcon
}

/** The verbs the store is known to send, with the name, group and icon each gets. */
const KNOWN: Record<string, Known> = {
  placed: { title: 'Order placed', category: 'order', icon: 'order' },
  confirmation_number_generated: {
    title: 'Confirmation number generated',
    category: 'order',
    icon: 'confirmation',
  },
  authorization_success: {
    title: 'Payment authorized',
    category: 'payment',
    icon: 'card',
  },
  chargeback_risk_assessed: {
    title: 'Chargeback risk assessed',
    category: 'security',
    icon: 'shield',
  },
  mail_sent: { title: 'Confirmation email sent', category: 'notification', icon: 'mail' },
  confirmed: { title: 'Order confirmed', category: 'order', icon: 'confirmed' },
  fulfillment_success: {
    title: 'Fulfillment completed',
    category: 'fulfillment',
    icon: 'fulfillment',
  },
  capture_pending: { title: 'Capture pending', category: 'payment', icon: 'pending' },
  payment_schedule_captured: {
    title: 'Payment schedule captured',
    category: 'payment',
    icon: 'schedule',
  },
  capture_success: { title: 'Payment captured', category: 'payment', icon: 'card' },
  closed: { title: 'Order archived', category: 'order', icon: 'archive' },
  payments_charge: { title: 'Payout activity', category: 'payout', icon: 'payout' },
}

/** "refund_success" → "Refund success": a readable name for a verb this app doesn't know. */
function fallbackTitle(verb: string): string {
  const words = verb
    .replace(/[_.-]+/g, ' ')
    .trim()
    .toLowerCase()
  if (!words) return 'Activity'
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/**
 * `payments_charge` is used for both payout steps; only the message tells them apart:
 * "£1,090.23 GBP will be added to your Nov 11, 2026 payout." is scheduled, "… was added to …"
 * is added. Anything else stays "Payout activity".
 */
function payoutStep(message: string): 'scheduled' | 'added' | null {
  if (/\bwill be (added|paid|sent|deposited)\b|\bscheduled\b/i.test(message))
    return 'scheduled'
  if (/\b(was|has been|were) (added|paid|sent|deposited)\b/i.test(message)) return 'added'
  return null
}

/** The risk level in a "chargeback risk assessed" message ("…detected a low risk level."). */
function riskLevel(message: string): 'low' | 'medium' | 'high' | null {
  const found = /\b(low|medium|high)\s+risk\b/i.exec(message)
  return found ? (found[1].toLowerCase() as 'low' | 'medium' | 'high') : null
}

function badgeFor(
  verb: string,
  message: string,
  payout: 'scheduled' | 'added' | null,
): TimelineEvent['badge'] {
  switch (verb) {
    case 'chargeback_risk_assessed': {
      const level = riskLevel(message)
      if (level === 'low') return { label: 'Low risk', tone: 'success' }
      if (level === 'medium') return { label: 'Medium risk', tone: 'warning' }
      if (level === 'high') return { label: 'High risk', tone: 'danger' }
      return null
    }
    case 'capture_success':
      return { label: 'Captured', tone: 'success' }
    case 'fulfillment_success':
      return { label: 'Fulfilled', tone: 'success' }
    case 'capture_pending':
      return { label: 'Pending', tone: 'warning' }
    case 'payments_charge':
      return payout === 'added' ? { label: 'Added to payout', tone: 'success' } : null
    default:
      // An unknown verb that says it failed or is waiting still gets a badge.
      if (/(fail|error|declin|reject|denied)/i.test(verb))
        return { label: 'Failed', tone: 'danger' }
      if (/pending/i.test(verb)) return { label: 'Pending', tone: 'warning' }
      return null
  }
}

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

/** The author as a name: a plain string, or an object's name / email. */
function authorOf(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return (
      text(record.name) ||
      text(record.full_name) ||
      text(record.email) ||
      [text(record.first_name), text(record.last_name)].filter(Boolean).join(' ') ||
      null
    )
  }
  return null
}

const CORE_FIELDS = new Set(['verb', 'message', 'author', 'occurred_at'])

/** "subject_type" → "Subject type". */
function labelOf(key: string): string {
  const words = key.replace(/[_-]+/g, ' ').trim().toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** The event's other plain fields (text, numbers, yes/no), for the expanded view. */
function extraDetails(record: Record<string, unknown>): [string, string][] {
  const rows: [string, string][] = []
  for (const [key, value] of Object.entries(record)) {
    if (CORE_FIELDS.has(key) || value === null || value === undefined) continue
    if (typeof value === 'string' && value.trim()) rows.push([labelOf(key), value.trim()])
    else if (typeof value === 'number') rows.push([labelOf(key), String(value)])
    else if (typeof value === 'boolean') rows.push([labelOf(key), value ? 'Yes' : 'No'])
    if (rows.length >= 12) break
  }
  return rows
}

/**
 * The order's `events`, ready to show: each with a readable title, group, icon and (only when
 * it means something) a badge; newest first; an event sent twice (same verb, message and time)
 * shown once. Nothing else is dropped — an event with no time or an unknown verb is kept (a
 * timeless one goes last). The store's message is never changed.
 */
export function parseTimelineEvents(
  records: readonly Record<string, unknown>[],
): TimelineEvent[] {
  const seen = new Set<string>()
  const events: (TimelineEvent & { index: number })[] = []

  records.forEach((record, index) => {
    const verb = text(record.verb).toLowerCase()
    const message = typeof record.message === 'string' ? record.message.trim() : ''
    const occurredAt = text(record.occurred_at)

    const signature = `${verb}|${message}|${occurredAt}`
    if (seen.has(signature)) return
    seen.add(signature)

    const known = KNOWN[verb]
    const payout = verb === 'payments_charge' ? payoutStep(message) : null
    const title =
      verb === 'payments_charge'
        ? payout === 'scheduled'
          ? 'Payout scheduled'
          : payout === 'added'
            ? 'Payout added'
            : 'Payout activity'
        : (known?.title ?? fallbackTitle(verb))

    const parsed = Date.parse(occurredAt)
    events.push({
      index,
      key: `${index}-${signature}`,
      verb,
      title,
      category: known?.category ?? 'other',
      icon: known?.icon ?? 'activity',
      message,
      author: authorOf(record.author),
      occurredAt,
      time: Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed,
      badge: badgeFor(verb, message, payout),
      details: extraDetails(record),
    })
  })

  // Newest first (descending); events at the same moment come in the reverse of the order the
  // store listed them in, so the whole list is the exact reverse of the store's story. An event
  // with no time goes last.
  events.sort((a, b) => {
    const aTimeless = a.time === Number.POSITIVE_INFINITY
    const bTimeless = b.time === Number.POSITIVE_INFINITY
    if (aTimeless !== bTimeless) return aTimeless ? 1 : -1
    return a.time === b.time ? b.index - a.index : b.time - a.time
  })
  return events.map((event) => {
    const { index, ...rest } = event
    void index
    return rest
  })
}

/** The events under the store's calendar days, in the order given (newest day first; timeless events last). */
export function groupTimelineByDay(
  events: readonly TimelineEvent[],
  timeZone?: string,
): TimelineDay[] {
  const days: TimelineDay[] = []
  for (const event of events) {
    const key = storeDateKey(event.occurredAt, timeZone) || 'unknown'
    const last = days[days.length - 1]
    if (last && last.key === key) {
      last.events.push(event)
    } else {
      days.push({
        key,
        label: formatStoreDay(event.occurredAt, timeZone) || 'No date',
        events: [event],
      })
    }
  }
  return days
}

/** How many events each category holds (only the ones that have any). */
export function countByCategory(
  events: readonly TimelineEvent[],
): Partial<Record<TimelineCategory, number>> {
  const counts: Partial<Record<TimelineCategory, number>> = {}
  for (const event of events) counts[event.category] = (counts[event.category] ?? 0) + 1
  return counts
}
