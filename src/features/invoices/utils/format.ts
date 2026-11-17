import type { BadgeTone } from '../../../components/ui/Badge.tsx'
import { formatDate, formatDateTime, formatPrice } from '../../../lib/format.ts'
import type { InvoiceKind, InvoiceKindCount } from '../../../lib/api/invoices.ts'

/** "credit_note" → "Credit note": a word the API sends, written for people. */
export function humanize(value: string | null | undefined): string {
  const words = (value ?? '').replace(/[_-]+/g, ' ').trim().toLowerCase()
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : ''
}

const KIND_LABELS: Record<InvoiceKind, string> = {
  invoice: 'Invoice',
  credit_note: 'Credit Note',
  quotation: 'Quotation',
  proforma: 'Proforma',
}

/** The document type's name; a type the page doesn't know is shown as the API sends it. */
export function kindLabel(kind: string): string {
  return KIND_LABELS[kind as InvoiceKind] ?? (humanize(kind) || '—')
}

const PAYMENT_LABELS: Record<string, string> = {
  paid: 'Paid',
  part_paid: 'Part Paid',
  unpaid: 'Unpaid',
  overdue: 'Overdue',
  not_posted: 'Not Posted',
}

const PAYMENT_TONES: Record<string, BadgeTone> = {
  paid: 'success',
  part_paid: 'warning',
  unpaid: 'default',
  overdue: 'danger',
  not_posted: 'neutral',
}

export function paymentLabel(status: string): string {
  return PAYMENT_LABELS[status] ?? (humanize(status) || '—')
}

export function paymentTone(status: string): BadgeTone {
  return PAYMENT_TONES[status] ?? 'neutral'
}

/** An invoice's own date ("2026-11-10" or a timestamp) as "10 Nov 2026"; a dash when it has none. */
export function dateText(value: string | null | undefined): string {
  if (!value) return '—'
  return Number.isNaN(Date.parse(value)) ? value : formatDate(value)
}

/** An amount in the invoice's currency (pounds, unless the API says otherwise); a dash when it has none. */
export function money(
  value: number | null | undefined,
  currency?: string | null,
): string {
  return value === null || value === undefined ? '—' : formatPrice(value, currency)
}

export const count = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : value.toLocaleString('en-GB')

/** "1,200 invoices · 40 credit notes" from `kind_counts` (the words as the page names the types). */
export function kindCountsText(kindCounts: readonly InvoiceKindCount[]): string {
  return kindCounts
    .filter((entry) => entry.count > 0)
    .map((entry) => {
      const name = kindLabel(entry.kind).toLowerCase()
      return `${entry.count.toLocaleString('en-GB')} ${entry.count === 1 ? name : `${name}s`}`
    })
    .join(' · ')
}

/**
 * A date or a timestamp from the API as "10 Nov 2026" (with the time, "10 Nov 2026, 14:05", when it
 * has one); text that is not a date is shown as it is, and nothing as a dash.
 */
export function dateOrTime(value: string | null | undefined): string {
  if (!value) return '—'
  if (Number.isNaN(Date.parse(value))) return value
  return /[T ]\d{2}:\d{2}/.test(value) ? formatDateTime(value) : formatDate(value)
}

/** A rate as "20%" (a whole or decimal number, written without trailing zeros). */
export function percent(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : `${Number(value.toFixed(2))}%`
}

/** A plain amount of something (a quantity, days) as "1,250"; a dash when there is none. */
export function quantity(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : value.toLocaleString('en-GB')
}

const MONEY_KEY =
  /(amount|net|tax|gross|total|price|balance|limit|paid|outstanding|value|prepaid|discount)/i
const NOT_MONEY_KEY = /(rate|percent|pct|days|code|id\b|number|ref|date)/i

/**
 * Any field of the API's — a payment allocation's, say — as text: dates as dates, yes / no as Yes /
 * No, a number under an amount-like name as money in the invoice's currency, other numbers as
 * numbers; everything else as it is, and nothing as a dash.
 */
export function looseValue(key: string, value: unknown, currency: string | null): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') {
    return MONEY_KEY.test(key) && !NOT_MONEY_KEY.test(key)
      ? formatPrice(value, currency)
      : value.toLocaleString('en-GB')
  }
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}.*)?$/.test(value.trim())) {
      return dateOrTime(value.trim())
    }
    return value
  }
  if (Array.isArray(value))
    return value.map((item) => looseValue(key, item, currency)).join(', ')
  return JSON.stringify(value)
}
