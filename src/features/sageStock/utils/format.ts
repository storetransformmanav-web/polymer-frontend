import type { BadgeTone } from '../../../components/ui/Badge.tsx'
import { formatDate, formatPrice } from '../../../lib/format.ts'

/** "out_of_stock" → "Out of stock": a word the API sends, written for people. */
export function humanize(value: string | null | undefined): string {
  const words = (value ?? '').replace(/[_-]+/g, ' ').trim().toLowerCase()
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : ''
}

/** An amount in pounds (the stock answer names no currency); a dash when there is none. */
export function money(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : formatPrice(value)
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
