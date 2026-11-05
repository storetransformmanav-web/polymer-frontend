import type { OrderDetail } from '../../../lib/api/endpoints.ts'
import { safeUrl } from '../../../lib/safeUrl.ts'
import { humanize } from './format.ts'

/** One parcel's tracking: who carries it, its number and a page to follow it on. */
export interface TrackingEntry {
  key: string
  /** What it belongs to ("#17516.1", "Tracking number"). */
  label: string
  company: string | null
  number: string | null
  /** Any address; only an http(s) one is ever made a link (`safeUrl`). */
  url: string | null
}

type NoteAttribute = OrderDetail['note_attributes'][number]

const text = (value: unknown): string | null => {
  if (typeof value === 'string') return value.trim() === '' ? null : value.trim()
  if (typeof value === 'number') return String(value)
  return null
}

const list = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : value === null || value === undefined ? [] : [value]

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null

/**
 * The tracking of an order's fulfillments. Their shape is not documented, so this reads what
 * Shopify's own fulfillment has — `tracking_company`, `tracking_number(s)`, `tracking_url(s)`,
 * or `tracking_info` (one object or a list) — and ignores everything else.
 */
export function fulfillmentTracking(
  fulfillments: Record<string, unknown>[],
): TrackingEntry[] {
  const entries: TrackingEntry[] = []
  fulfillments.forEach((record, index) => {
    const label = text(record.name) ?? `Fulfillment ${index + 1}`
    const company = text(record.tracking_company ?? record.company ?? record.carrier)
    const add = (
      parts: { company?: string | null; number?: string | null; url?: string | null },
      at: number,
    ) => {
      const number = parts.number ?? null
      const url = parts.url ?? null
      if (!number && !url) return
      entries.push({
        key: `fulfillment-${index}-${at}`,
        label,
        company: parts.company ?? company,
        number,
        url,
      })
    }

    const infos = list(record.tracking_info)
      .map(asRecord)
      .filter((info): info is Record<string, unknown> => info !== null)
    if (infos.length > 0) {
      infos.forEach((info, at) =>
        add(
          {
            company: text(info.company),
            number: text(info.number),
            url: text(info.url),
          },
          at,
        ),
      )
      return
    }

    const numbers = [...list(record.tracking_numbers), record.tracking_number]
      .map(text)
      .filter((value): value is string => value !== null)
    const urls = [...list(record.tracking_urls), record.tracking_url]
      .map(text)
      .filter((value): value is string => value !== null)
    const length = Math.max(numbers.length, urls.length)
    for (let at = 0; at < length; at += 1) {
      add({ number: numbers[at], url: urls[at] }, at)
    }
  })
  return entries
}

/**
 * Splits the order's own extra details (`note_attributes`) into the ones that are tracking — a
 * name with "track" in it ("Tracking number", "tracking_url") — and the rest. A tracking value
 * that is an address becomes the parcel's link, anything else its number.
 */
export function splitAttributes(attributes: NoteAttribute[]): {
  tracking: TrackingEntry[]
  details: NoteAttribute[]
} {
  const tracking: TrackingEntry[] = []
  const details: NoteAttribute[] = []
  attributes.forEach((attribute, index) => {
    const value = text(attribute.value)
    if (value && /track/i.test(attribute.key)) {
      const link = safeUrl(value) !== null
      tracking.push({
        key: `attribute-${index}`,
        label: humanize(attribute.key),
        company: null,
        number: link ? null : value,
        url: link ? value : null,
      })
    } else {
      details.push(attribute)
    }
  })
  return { tracking, details }
}

/** Everything the Notes & Tracking page shows for an order. */
export function orderTracking(
  order: Pick<OrderDetail, 'fulfillments' | 'note_attributes'>,
) {
  const fromAttributes = splitAttributes(order.note_attributes)
  return {
    tracking: [...fulfillmentTracking(order.fulfillments), ...fromAttributes.tracking],
    details: fromAttributes.details,
  }
}

/** How many things the Notes & Tracking page shows for an order (the tab's count). */
export function notesCount(
  order: Pick<OrderDetail, 'note' | 'fulfillments' | 'note_attributes'>,
): number {
  const { tracking, details } = orderTracking(order)
  return (order.note?.trim() ? 1 : 0) + tracking.length + details.length
}
