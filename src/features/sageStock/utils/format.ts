import type { BadgeTone } from '../../../components/ui/Badge.tsx'
import { formatDate, formatDateTimeAmPm, formatPrice } from '../../../lib/format.ts'

/** "out_of_stock" → "Out of stock": a word the API sends, written for people. */
export function humanize(value: string | null | undefined): string {
  const words = (value ?? '').replace(/[_-]+/g, ' ').trim().toLowerCase()
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : ''
}

/** An amount in the currency given (pounds when the answer names none); a dash when there is none. */
export function money(
  value: number | null | undefined,
  currency?: string | null,
): string {
  return value === null || value === undefined ? '—' : formatPrice(value, currency)
}

/** A quantity or a count as "1,250"; a dash when there is none. */
export const count = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : value.toLocaleString('en-GB')

/** A rate as "98.4%" (written without trailing zeros); a dash when there is none. */
export function percent(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : `${Number(value.toFixed(2))}%`
}

/** A date ("2026-07-23") or a timestamp as "23 Jul 2026"; text that is not a date as it is; nothing as a dash. */
export function dateText(value: string | null | undefined): string {
  if (!value) return '—'
  return Number.isNaN(Date.parse(value)) ? value : formatDate(value)
}

/** A timestamp as "15 Sep 2025, 08:39 PM"; a plain date as a date, text that is not a date as it is, nothing as a dash. */
export function dateTimeText(value: string | null | undefined): string {
  if (!value) return '—'
  if (Number.isNaN(Date.parse(value))) return value
  return /[T ]\d{2}:\d{2}/.test(value) ? formatDateTimeAmPm(value) : formatDate(value)
}

/** A month ("2026-04") as "Apr 2026"; anything else as it is, nothing as a dash. */
export function monthText(value: string | null | undefined): string {
  if (!value) return '—'
  const match = /^(\d{4})-(\d{2})$/.exec(value)
  if (!match) return value
  return new Date(Number(match[1]), Number(match[2]) - 1, 1).toLocaleDateString('en-GB', {
    month: 'short',
    year: 'numeric',
  })
}

/** "calculation_method" → "Calculation method": a field name written for people. */
export function fieldLabel(key: string): string {
  const words = key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase()
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : key
}

const MONEY_KEY = /(price|cost|value|amount|total|sales|net|gross|tax|discount)/i
const NOT_MONEY_KEY =
  /(qty|quantity|rate|percent|pct|days|code|(^|_)id($|_)|number|ref|date)/i

/**
 * Any field of a free-form record the API sends without describing it (a discount band, an open order
 * line) as text: dates as dates, yes / no as Yes / No, a number under an amount-like name as money, other
 * numbers as numbers; everything else as it is, and nothing as a dash.
 */
export function looseValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') {
    return MONEY_KEY.test(key) && !NOT_MONEY_KEY.test(key)
      ? formatPrice(value)
      : value.toLocaleString('en-GB')
  }
  if (typeof value === 'string') {
    return /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}.*)?$/.test(value.trim())
      ? dateTimeText(value.trim())
      : value
  }
  return '—'
}

/** true / false as Yes / No; nothing as a dash. */
export const yesNo = (value: boolean | null | undefined) =>
  value === null || value === undefined ? '—' : value ? 'Yes' : 'No'

const STATUS_TONES: Record<string, BadgeTone> = {
  in_stock: 'success',
  low_stock: 'warning',
  out_of_stock: 'danger',
  not_tracked: 'neutral',
  inactive: 'neutral',
}

/** The stock status as a pill: the words the API sends, in colour for the usual ones. */
export function statusPill(status: string): { label: string; tone: BadgeTone } {
  const key = status
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
  return { label: humanize(key) || '—', tone: STATUS_TONES[key] ?? 'neutral' }
}
