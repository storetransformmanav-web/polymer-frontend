import type { BadgeTone } from '../../../components/ui/Badge.tsx'
import { formatDate, formatDateTimeAmPm, formatPrice } from '../../../lib/format.ts'
import type { SageCustomer } from '../../../lib/api/sageCustomers.ts'

/** "part_paid" → "Part paid": a word the API sends, written for people. */
export function humanize(value: string | null | undefined): string {
  const words = (value ?? '').replace(/[_-]+/g, ' ').trim().toLowerCase()
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : ''
}

/** An amount in the customer's currency (pounds when the answer names none); a dash when there is none. */
export function money(
  value: number | null | undefined,
  currency?: string | null,
): string {
  return value === null || value === undefined ? '—' : formatPrice(value, currency)
}

export const count = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : value.toLocaleString('en-GB')

/** A date ("2026-10-02") or a timestamp as "2 Oct 2026"; text that is not a date as it is; nothing as a dash. */
export function dateText(value: string | null | undefined): string {
  if (!value) return '—'
  return Number.isNaN(Date.parse(value)) ? value : formatDate(value)
}

/** A timestamp with its time, 12-hour with AM / PM; a bare date stays a date. */
export function dateTimeAmPm(value: string | null | undefined): string {
  if (!value) return '—'
  if (Number.isNaN(Date.parse(value))) return value
  return /[T ]\d{2}:\d{2}/.test(value) ? formatDateTimeAmPm(value) : formatDate(value)
}

export const yesNo = (value: boolean | null | undefined) =>
  value === null || value === undefined ? '—' : value ? 'Yes' : 'No'

/**
 * The account's state in words: the status Sage sends; when it sends none, what the flags say (on
 * hold, inactive) — an account that is neither is open, as the list's own "Open" tab defines it.
 */
export function accountStatus(account: {
  status: string
  on_hold: boolean
  inactive: boolean
}): { label: string; tone: BadgeTone } {
  if (account.on_hold) return { label: 'On Hold', tone: 'danger' }
  if (account.inactive) return { label: 'Inactive', tone: 'neutral' }
  const status = account.status.trim()
  if (status && status.toLowerCase() !== 'open') {
    return { label: humanize(status), tone: 'warning' }
  }
  return { label: 'Open', tone: 'success' }
}

/** The currency the figures above the list are in: the first customer's (pounds otherwise). */
export function listCurrency(items: readonly SageCustomer[]): string | null {
  return items.find((item) => item.currency)?.currency ?? null
}

const PAYMENT_TONES: Record<string, BadgeTone> = {
  paid: 'success',
  part_paid: 'warning',
  unpaid: 'default',
  overdue: 'danger',
  not_posted: 'neutral',
}

export function paymentTone(status: string): BadgeTone {
  return PAYMENT_TONES[status.toLowerCase().replace(/[\s-]+/g, '_')] ?? 'neutral'
}
