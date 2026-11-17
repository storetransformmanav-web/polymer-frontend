import { ApiError } from './ApiError.ts'

/**
 * `GET /api/orders/summary` — the figures behind the Orders page's cards, for the orders that match
 * the same filters as `GET /api/orders`. The answer is read from its `summary` object (`cards`,
 * `statuses`, `channels`). Its fields are read leniently (a card may be an object keyed by name or a
 * list; an amount a number, a numeric text or an object per currency), so a differently spelt answer
 * is one line to fix here.
 */

type Raw = Record<string, unknown>
const isRaw = (value: unknown): value is Raw =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** A number, or numeric text ("1,234.50", "£99"); anything else is nothing. */
function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null
  const cleaned = value.replace(/[^0-9.-]/g, '')
  if (!/\d/.test(cleaned)) return null
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

const toText = (value: unknown): string =>
  typeof value === 'string'
    ? value.trim()
    : typeof value === 'number'
      ? String(value)
      : ''

function toFlag(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string')
    return ['true', 'yes', '1'].includes(value.trim().toLowerCase())
  return value === 1
}

/** An amount per currency, when the answer sends one ({ GBP: 120, USD: 30 }). */
function readByCurrency(value: unknown): [string, number][] {
  if (!isRaw(value)) return []
  const rows: [string, number][] = []
  for (const [currency, amount] of Object.entries(value)) {
    const parsed = toNumber(amount)
    if (parsed !== null) rows.push([currency.toUpperCase(), parsed])
  }
  return rows
}

export interface OrderSummaryCard {
  /** `total_orders`, `paid_orders`… */
  key: string
  label: string
  /** The main figure (a count for the order cards, an amount for the revenue ones). */
  value: number | null
  /** The money that goes with it, in `currency` (or per currency when the stores differ). */
  amount: number | null
  amountByCurrency: [string, number][]
  percentOfOrders: number | null
  /** What the card counts, for its tooltip — the API's own words. */
  info: string
  /** A line of extra detail, the API's own words. */
  detail: string
  currency: string | null
  mixedCurrencies: boolean
}

export interface OrderSummaryBreakdown {
  key: string
  label: string
  value: number | null
  amount: number | null
  percentOfOrders: number | null
}

export interface OrderSummary {
  cards: Record<string, OrderSummaryCard>
  statuses: OrderSummaryBreakdown[]
  channels: OrderSummaryBreakdown[]
  currency: string | null
  mixedCurrencies: boolean
}

function readCard(key: string, raw: unknown, root: Raw): OrderSummaryCard {
  const card: Raw = isRaw(raw) ? raw : { value: raw }
  const valueByCurrency = readByCurrency(card.value)
  const amountByCurrency = readByCurrency(card.amount)
  return {
    key,
    label: toText(card.label ?? card.title ?? card.name),
    value: toNumber(card.value),
    amount: toNumber(card.amount),
    amountByCurrency: amountByCurrency.length > 0 ? amountByCurrency : valueByCurrency,
    percentOfOrders: toNumber(
      card.percent_of_orders ?? card.percentOfOrders ?? card.percent,
    ),
    info: toText(card.info),
    detail: toText(card.detail),
    currency:
      toText(card.currency ?? card.currency_code) ||
      toText(root.currency ?? root.currency_code) ||
      null,
    mixedCurrencies: toFlag(card.mixed_currencies ?? card.mixedCurrencies),
  }
}

function readBreakdown(raw: unknown): OrderSummaryBreakdown[] {
  const rows: [string, unknown][] = Array.isArray(raw)
    ? raw.map((item, index) => [
        isRaw(item)
          ? toText(item.key ?? item.status ?? item.channel ?? item.id ?? item.name)
          : String(index),
        item,
      ])
    : isRaw(raw)
      ? Object.entries(raw)
      : []
  return rows.map(([key, item]) => {
    const row: Raw = isRaw(item) ? item : { value: item }
    return {
      key,
      label: toText(row.label ?? row.title ?? row.name) || key,
      value: toNumber(row.value ?? row.count ?? row.orders),
      amount: toNumber(row.amount),
      percentOfOrders: toNumber(row.percent_of_orders ?? row.percent),
    }
  })
}

/** The whole answer. An answer with no cards is refused with a readable message. */
export function readOrderSummary(data: unknown): OrderSummary {
  const root = isRaw(data) ? (isRaw(data.summary) ? data.summary : data) : null
  const cardsRaw = root?.cards
  if (!root || (!isRaw(cardsRaw) && !Array.isArray(cardsRaw))) {
    throw new ApiError(
      'The order summary answer was not in the expected form (no cards).',
    )
  }

  const cards: Record<string, OrderSummaryCard> = {}
  const entries: [string, unknown][] = Array.isArray(cardsRaw)
    ? cardsRaw.map((item, index) => [
        isRaw(item)
          ? toText(item.key ?? item.id ?? item.name) || String(index)
          : String(index),
        item,
      ])
    : Object.entries(cardsRaw)
  for (const [key, item] of entries) cards[key] = readCard(key, item, root)

  return {
    cards,
    statuses: readBreakdown(root.statuses),
    channels: readBreakdown(root.channels),
    currency: toText(root.currency ?? root.currency_code) || null,
    mixedCurrencies:
      toFlag(root.mixed_currencies ?? root.mixedCurrencies) ||
      Object.values(cards).some((card) => card.mixedCurrencies),
  }
}
