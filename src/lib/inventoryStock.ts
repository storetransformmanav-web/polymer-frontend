import {
  STOCK_QUANTITY_NAMES,
  type EditableStockQuantity,
  type StockLine,
  type StockQuantities,
  type StockQuantityName,
} from './api/endpoints.ts'

/** The four quantities that add up to `unavailable`. */
const UNAVAILABLE_PARTS = [
  'reserved',
  'safety_stock',
  'damaged',
  'quality_control',
] as const

/** The API's limits for an adjustment. */
export const MAX_DELTA = 100_000
export const MAX_NOTE = 500

const zero = (value: number | null | undefined) => value ?? 0

/** A quantity of a line or a total, 0 when it is missing. */
export function quantityOf(
  source: Partial<StockQuantities> | null | undefined,
  name: StockQuantityName,
): number {
  return zero(source?.[name])
}

/** A key in words: "safety_stock" → "Safety stock" (no table of names — the key is the data). */
export function humanize(key: string): string {
  const words = key.replace(/_/g, ' ').trim()
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : ''
}

/** The label of a reason: the backend's own label for it when it sent one, else its value in words. */
export function reasonLabel(
  reason: string | null | undefined,
  options: { value: string; label: string }[] = [],
): string {
  if (!reason) return '—'
  return options.find((option) => option.value === reason)?.label || humanize(reason)
}

/** What a quantity name says in words ("safety_stock" → "Safety stock"). */
export function quantityLabel(name: string | null | undefined): string {
  return name ? humanize(name) : '—'
}

/**
 * The line after one quantity was set to `value`, worked out the way Shopify does it — so the
 * screen can show the result at once, before Shopify has confirmed:
 *  - **available** moves **on hand** by the same amount;
 *  - **on hand** moves **available** (never below 0);
 *  - **reserved / safety stock / damaged / quality control** move **unavailable** and **on hand**
 *    (available stays as it is).
 * Committed and incoming are Shopify's own and never change here.
 */
export function setQuantity<T extends Partial<StockQuantities>>(
  line: T,
  name: EditableStockQuantity,
  value: number,
): T {
  const before = quantityOf(line, name)
  const diff = value - before
  const next: Partial<StockQuantities> = { ...line, [name]: value }
  if (name === 'available') {
    next.on_hand = quantityOf(line, 'on_hand') + diff
  } else if (name === 'on_hand') {
    next.available = Math.max(0, quantityOf(line, 'available') + diff)
  } else {
    next.unavailable = unavailableOf(line) + diff
    next.on_hand = quantityOf(line, 'on_hand') + diff
  }
  return next as T
}

/** Several quantities set at once, in the order given. */
export function setQuantities<T extends Partial<StockQuantities>>(
  line: T,
  quantities: Partial<Record<EditableStockQuantity, number>>,
): T {
  let next = line
  for (const [name, value] of Object.entries(quantities) as [
    EditableStockQuantity,
    number,
  ][]) {
    next = setQuantity(next, name, value)
  }
  return next
}

/** `unavailable` as the line says it, else worked out from its four parts. */
export function unavailableOf(line: Partial<StockQuantities>): number {
  if (line.unavailable !== null && line.unavailable !== undefined) return line.unavailable
  return UNAVAILABLE_PARTS.reduce((sum, name) => sum + quantityOf(line, name), 0)
}

/** The totals of a variant: every quantity added up over its locations. */
export function sumLines(lines: Partial<StockQuantities>[]): StockQuantities {
  const totals = {} as Record<StockQuantityName, number>
  for (const name of STOCK_QUANTITY_NAMES) {
    totals[name] = lines.reduce((sum, line) => sum + quantityOf(line, name), 0)
  }
  return totals
}

/** A variant's lines after `change` was applied at one location (a new location gets a new line). */
export function applyToLines(
  lines: StockLine[],
  locationId: number,
  change: (line: StockLine) => StockLine,
): StockLine[] {
  if (lines.some((line) => line.location_id === locationId)) {
    return lines.map((line) => (line.location_id === locationId ? change(line) : line))
  }
  const blank: StockLine = {
    location_id: locationId,
    location_name: null,
    updated_at: null,
    available: 0,
    on_hand: 0,
    committed: 0,
    incoming: 0,
    reserved: 0,
    safety_stock: 0,
    damaged: 0,
    quality_control: 0,
    unavailable: 0,
  }
  return [...lines, change(blank)]
}

/** Why a "Set to" number can't be sent, or null. */
export function validateSet(text: string): string | null {
  const value = text.trim()
  if (value === '') return 'Enter a number'
  if (!/^\d+$/.test(value)) return 'Enter a whole number, 0 or more'
  if (Number(value) > 2_000_000_000) return 'That number is too large'
  return null
}

/** Why an "Adjust by" amount can't be sent, or null. `current` is the quantity now. */
export function validateDelta(text: string, current: number): string | null {
  const value = text.trim()
  if (value === '') return 'Enter an amount'
  if (!/^[-+]?\d+$/.test(value)) return 'Enter a whole number, such as 12 or -3'
  const delta = Number(value)
  if (delta === 0) return 'The amount can’t be 0'
  if (Math.abs(delta) > MAX_DELTA) {
    return `The amount must be between -${MAX_DELTA.toLocaleString('en-GB')} and ${MAX_DELTA.toLocaleString('en-GB')}`
  }
  if (current + delta < 0) return 'That would take the quantity below 0'
  return null
}

export type StockLevel = 'in' | 'low' | 'out'

/** The stock state of a figure: out at 0 or below, low under the threshold, else in stock. */
export function stockLevel(
  available: number | null | undefined,
  threshold = 10,
): StockLevel {
  const value = zero(available)
  if (value <= 0) return 'out'
  return value < threshold ? 'low' : 'in'
}

/** A number as the tables show it. */
export const formatQuantity = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : value.toLocaleString('en-GB')

/** A signed change ("+12", "-3", "0"). */
export function formatDelta(delta: number | null | undefined): string {
  if (delta === null || delta === undefined) return '—'
  const text = Math.abs(delta).toLocaleString('en-GB')
  return delta > 0 ? `+${text}` : delta < 0 ? `-${text}` : '0'
}
