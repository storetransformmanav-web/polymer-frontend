import type { ComponentType } from 'react'
import {
  ActivityIcon,
  CheckCircleIcon,
  ClockIcon,
  CreditCardIcon,
  OrdersIcon,
  PoundIcon,
  RefreshIcon,
  ShieldCheckIcon,
  type IconProps,
} from '../../../components/ui/icons.tsx'
import type { Kpi } from '../../../components/ui/KpiCards.tsx'
import type { OrderSummaryParams } from '../../../lib/api/endpoints.ts'
import type { OrderSummary, OrderSummaryCard } from '../../../lib/api/orderSummary.ts'
import { formatPrice } from '../../../lib/format.ts'
import { toOrderParams, type OrderFilters } from '../../../app/store/ordersSlice.ts'

/** The two filters the cards stand for. Everything else on the page is left alone. */
export interface CardFilter {
  financial: OrderFilters['financial']
  cancelled: OrderFilters['cancelled']
}

interface CardDef {
  /** The key of the card in the answer's `summary.cards`. */
  key: string
  /** Other keys the answer may use for the same card. */
  aliases?: string[]
  /** The answer's `summary.statuses` row to read the card from when `cards` has none (lower case). */
  statusKey?: string
  label: string
  icon: ComponentType<IconProps>
  /** `count`: the figure is a number of orders (the money goes beside it); `money`: the figure is an amount. */
  kind: 'count' | 'money'
  tone?: Kpi['tone']
  /**
   * The list's filters while this card is the selected one. A card with none is display-only: it is
   * not a button (money figures — revenue and averages — have no list behind them).
   */
  filter?: CardFilter
  /** What the card means, in plain words — used for the (i) tooltip only when the API sends no `info`. */
  description: string
}

/** A card that filters the list when pressed. */
export type FilterCardDef = CardDef & { filter: CardFilter }

/**
 * The eight cards, in order. **Total Orders** is every order matching the page's other filters (no
 * payment or cancelled filter, so it never narrows the list on its own). **Paid**, **Pending**,
 * **Authorized** and **Refunded Orders** are filter buttons: each shows the orders of that payment
 * status. **Total Revenue**, **Average Order Value** and **Net Revenue** are money figures with no
 * list behind them, so they are display-only (same look, no button).
 */
export const ORDER_SUMMARY_CARDS: CardDef[] = [
  {
    key: 'total_orders',
    label: 'Total Orders',
    icon: OrdersIcon,
    kind: 'count',
    filter: { financial: '', cancelled: '' },
    description:
      'Every order that matches your search and filters, whatever its payment status.',
  },
  {
    key: 'total_revenue',
    label: 'Total Revenue',
    icon: PoundIcon,
    kind: 'money',
    description:
      'The combined value of all the orders that are not cancelled and match your filters, before refunds.',
  },
  {
    key: 'average_order_value',
    aliases: ['avg_order_value', 'aov'],
    label: 'Average Order Value',
    icon: ActivityIcon,
    kind: 'money',
    description:
      'Total revenue divided by the number of orders: what a typical order is worth.',
  },
  {
    key: 'net_revenue',
    label: 'Net Revenue',
    icon: CreditCardIcon,
    kind: 'money',
    tone: 'good',
    description:
      'Money actually earned: the value of paid orders once refunds have been taken off.',
  },
  {
    key: 'paid_orders',
    statusKey: 'paid',
    label: 'Paid Orders',
    icon: CheckCircleIcon,
    kind: 'count',
    tone: 'good',
    filter: { financial: 'PAID', cancelled: '' },
    description: 'Orders that have been paid in full.',
  },
  {
    key: 'pending_orders',
    statusKey: 'pending',
    label: 'Pending Orders',
    icon: ClockIcon,
    kind: 'count',
    tone: 'warning',
    filter: { financial: 'PENDING', cancelled: '' },
    description:
      'Orders that have been placed but not paid yet, so payment is still to come.',
  },
  {
    key: 'authorized_orders',
    statusKey: 'authorized',
    label: 'Authorized Orders',
    icon: ShieldCheckIcon,
    kind: 'count',
    filter: { financial: 'AUTHORIZED', cancelled: '' },
    description:
      'Orders whose payment has been authorized by the customer’s bank but not captured yet.',
  },
  {
    key: 'refunded_orders',
    statusKey: 'refunded',
    label: 'Refunded Orders',
    icon: RefreshIcon,
    kind: 'count',
    tone: 'danger',
    filter: { financial: 'REFUNDED', cancelled: '' },
    description: 'Orders that have been refunded in full.',
  },
]

const hasFilter = (card: CardDef): card is FilterCardDef => card.filter !== undefined

/** The card whose filter is exactly what the list has on now (nothing when it is another choice). */
export function cardForFilters(filters: OrderFilters): FilterCardDef | null {
  return (
    ORDER_SUMMARY_CARDS.filter(hasFilter).find(
      (card) =>
        card.filter.financial === filters.financial &&
        card.filter.cancelled === filters.cancelled,
    ) ?? null
  )
}

/**
 * What the cards are asked for: the list's filters (search, fulfillment, source, gateway, tag, dates,
 * totals, store…) without its sorting and paging — and without the payment / cancelled filter **when a
 * card put it there**, so choosing "Paid Orders" does not turn "Pending Orders" into 0. A payment
 * status chosen in the Filters grid that no card stands for is passed on.
 */
export function toOrderSummaryParams(filters: OrderFilters): OrderSummaryParams {
  const params = { ...toOrderParams(filters) }
  delete params.sort
  delete params.order
  delete params.page
  delete params.page_size
  if (cardForFilters(filters)) {
    delete params.financial_status
    delete params.cancelled
  }
  return params
}

const number = (value: number | null) =>
  value === null ? '—' : value.toLocaleString('en-GB')

const plainAmount = (value: number) =>
  value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** A card's money in the API's currency; per currency when the stores differ; plain when it names none. */
function cardMoney(card: OrderSummaryCard, summary: OrderSummary): string | null {
  if (card.amountByCurrency.length > 0) {
    return card.amountByCurrency
      .map(([currency, value]) => formatPrice(value, currency))
      .join(' + ')
  }
  const value =
    card.amount ?? (card.value !== null && isMoneyCard(card) ? card.value : null)
  if (value === null) return null
  const currency = card.currency ?? summary.currency
  if (currency) return formatPrice(value, currency)
  return summary.mixedCurrencies ? plainAmount(value) : formatPrice(value, null)
}

const isMoneyCard = (card: OrderSummaryCard) => /revenue|average|avg|aov/.test(card.key)

const percent = (value: number | null) =>
  value === null ? undefined : `${Number(value.toFixed(1))}% of orders`

const plain = (text: string) => text.toLowerCase().replace(/[^a-z]/g, '')

/**
 * The answer's figure for a card: its entry in `cards` (under its key or an alias); else, for a
 * payment-status card, the matching row of `statuses`; and the **average order value** is worked
 * out from the answer's own revenue and order count when the API does not send one (one currency
 * only — an average across currencies would mean nothing).
 */
function findCard(summary: OrderSummary | null, def: CardDef): OrderSummaryCard | null {
  if (!summary) return null
  for (const key of [def.key, ...(def.aliases ?? [])]) {
    if (summary.cards[key]) return summary.cards[key]
  }
  const blank: OrderSummaryCard = {
    key: def.key,
    label: '',
    value: null,
    amount: null,
    amountByCurrency: [],
    percentOfOrders: null,
    info: '',
    detail: '',
    currency: null,
    mixedCurrencies: false,
  }

  if (def.statusKey) {
    const row = summary.statuses.find(
      (candidate) =>
        plain(candidate.key) === def.statusKey ||
        plain(candidate.label) === def.statusKey,
    )
    if (!row) return null
    return {
      ...blank,
      value: row.value,
      amount: row.amount,
      percentOfOrders: row.percentOfOrders,
    }
  }

  if (def.key === 'average_order_value') {
    const revenue = summary.cards.total_revenue
    const orders = summary.cards.total_orders?.value ?? null
    if (!revenue || !orders || orders <= 0 || summary.mixedCurrencies) return null
    if (revenue.amountByCurrency.length > 1) return null
    const total = revenue.amountByCurrency[0]?.[1] ?? revenue.amount ?? revenue.value
    if (total === null || total === undefined) return null
    const average = Math.round((total / orders) * 100) / 100
    const currency = revenue.amountByCurrency[0]?.[0] ?? revenue.currency
    return {
      ...blank,
      amount: average,
      amountByCurrency: currency ? [[currency, average]] : [],
      currency: currency ?? null,
    }
  }
  return null
}

/**
 * The cards' figures, from the answer when there is one (a dash until then). The label, the (i)
 * text (`info`), the extra line (`detail`), the amount and the share of orders are all the API's.
 * Only the cards with a filter are buttons; the money cards are plain.
 */
export function summaryKpis(
  summary: OrderSummary | null,
  selected: FilterCardDef | null,
  onSelect: (card: FilterCardDef) => void,
): Kpi[] {
  return ORDER_SUMMARY_CARDS.map((def) => {
    const card = findCard(summary, def)
    const mixed = !!summary && (summary.mixedCurrencies || !!card?.mixedCurrencies)
    const money = card && summary ? cardMoney(card, summary) : null

    let value: string
    let hint: string | undefined
    if (def.kind === 'money') {
      value = money ?? '—'
      hint = [
        card?.detail,
        mixed && !card?.currency && !summary?.currency ? 'Mixed currencies' : '',
      ]
        .filter(Boolean)
        .join(' · ')
    } else {
      value = number(card?.value ?? null)
      hint = [money, card?.detail].filter(Boolean).join(' · ')
    }

    return {
      label: card?.label || def.label,
      value,
      note: percent(card?.percentOfOrders ?? null),
      hint: hint || undefined,
      info: card?.info || def.description,
      icon: def.icon,
      tone: def.tone,
      ...(hasFilter(def)
        ? { active: selected?.key === def.key, onClick: () => onSelect(def) }
        : {}),
    }
  })
}
