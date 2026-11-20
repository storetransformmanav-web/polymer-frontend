import type { BadgeTone } from '../../../components/ui/Badge.tsx'
import { formatDate, formatDateTimeAmPm, formatPrice } from '../../../lib/format.ts'
import type { SageOrder } from '../../../lib/api/sageOrders.ts'

/** "part_despatched" → "Part despatched": a word the API sends, written for people. */
export function humanize(value: string | null | undefined): string {
  const words = (value ?? '').replace(/[_-]+/g, ' ').trim().toLowerCase()
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : ''
}

/** An amount in the order's currency (pounds when the answer names none); a dash when there is none. */
export function money(
  value: number | null | undefined,
  currency?: string | null,
): string {
  return value === null || value === undefined ? '—' : formatPrice(value, currency)
}

/** A rate as "20%" (written without trailing zeros); a dash when there is none. */
export function percent(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : `${Number(value.toFixed(2))}%`
}

export const count = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : value.toLocaleString('en-GB')

/** A date ("2026-10-02") or a timestamp as "2 Oct 2026"; text that is not a date as it is; nothing as a dash. */
export function dateText(value: string | null | undefined): string {
  if (!value) return '—'
  return Number.isNaN(Date.parse(value)) ? value : formatDate(value)
}

/** A timestamp as "16 Oct 2026, 10:24 AM"; a plain date as a date, text that is not a date as it is, nothing as a dash. */
export function dateTimeText(value: string | null | undefined): string {
  if (!value) return '—'
  if (Number.isNaN(Date.parse(value))) return value
  return /[T ]\d{2}:\d{2}/.test(value) ? formatDateTimeAmPm(value) : formatDate(value)
}

const PAYMENT_TONES: Record<string, BadgeTone> = {
  paid: 'success',
  part_paid: 'warning',
  overdue: 'danger',
  unpaid: 'default',
}

/** An invoice's payment status as a pill: the words the API sends, in colour for the usual ones. */
export function paymentPill(status: string): { label: string; tone: BadgeTone } {
  const key = status
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
  return { label: humanize(key) || '—', tone: PAYMENT_TONES[key] ?? 'neutral' }
}

const STATUS_TONES: Record<string, BadgeTone> = {
  open: 'default',
  allocated: 'default',
  part_allocated: 'warning',
  part_despatched: 'warning',
  outstanding: 'warning',
  complete: 'success',
  cancelled: 'danger',
}

/** The order's status as a pill: the words the API sends, in colour for the usual ones. */
export function statusPill(status: string): { label: string; tone: BadgeTone } {
  const key = status
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
  return { label: humanize(key) || '—', tone: STATUS_TONES[key] ?? 'neutral' }
}

/** The currency the figures above the list are in: the first order's (pounds otherwise). */
export function listCurrency(items: readonly SageOrder[]): string | null {
  return items.find((item) => item.currency)?.currency ?? null
}
