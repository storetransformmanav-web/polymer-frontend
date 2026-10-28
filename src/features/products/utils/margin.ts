import { formatPrice } from '../../../lib/format.ts'

/** A decimal as the form holds it: digits with an optional fraction, nothing else. */
const DECIMAL = /^\d+(\.\d+)?$/

const amountOf = (value: string): number | null => {
  const text = value.trim()
  return DECIMAL.test(text) ? Number(text) : null
}

/**
 * What the store earns on one item: the price less the cost per item, and that as a share of the
 * price. Either is `null` until both the price and the cost are real amounts (and the margin
 * also until the price is above zero) — nothing is guessed from half-typed boxes.
 */
export function profitAndMargin(
  price: string,
  cost: string,
): { profit: number | null; margin: number | null } {
  const sold = amountOf(price)
  const paid = amountOf(cost)
  if (sold === null || paid === null) return { profit: null, margin: null }
  const profit = sold - paid
  return { profit, margin: sold > 0 ? (profit / sold) * 100 : null }
}

/** "£12.50" — or "12.50" when the store's currency isn't known; a dash for no amount. */
export function formatMoney(value: number | null, currency: string | null): string {
  if (value === null) return '—'
  return currency ? formatPrice(value, currency) : value.toFixed(2)
}

/** "37.5%" (one decimal, none when it is whole); a dash for no figure. */
export function formatPercent(value: number | null): string {
  if (value === null) return '—'
  return `${Number(value.toFixed(1))}%`
}
