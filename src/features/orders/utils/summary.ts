import type { ComponentType } from 'react'
import {
  CheckCircleIcon,
  ClockIcon,
  CreditCardIcon,
  OrdersIcon,
  PoundIcon,
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
  label: string
  icon: ComponentType<IconProps>
  /** `count`: the figure is a number of orders (the money goes beside it); `money`: the figure is an amount. */
  kind: 'count' | 'money'
  tone?: Kpi['tone']
  /** The list's filters while this card is the selected one. */
  filter: CardFilter
  /** What the card means, in plain words — used for the (i) tooltip only when the API sends no `info`. */
  description: string
}

/**
 * The five cards, in order. **Total Orders** is every order matching the page's other filters (no
 * payment or cancelled filter, so it never narrows the list on its own); the others show the orders
 * their figure is made of: live (not cancelled) orders, paid orders, pending orders.
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
    filter: { financial: '', cancelled: 'no' },

    description:
      'The combined value of all the orders that are not cancelled and match your filters, before refunds.',
  },
  {
    key: 'net_revenue',
    label: 'Net Revenue',
    icon: CreditCardIcon,
    kind: 'money',
    tone: 'good',
    filter: { financial: 'PAID', cancelled: 'no' },

    description:
      'Money actually earned: the value of paid orders once refunds have been taken off.',
  },
  {
    key: 'paid_orders',
    label: 'Paid Orders',
    icon: CheckCircleIcon,
    kind: 'count',
    tone: 'good',
    filter: { financial: 'PAID', cancelled: '' },

    description: 'Orders that have been paid in full.',
  },
  {
    key: 'pending_orders',
    label: 'Pending Orders',
    icon: ClockIcon,
    kind: 'count',
    tone: 'warning',
    filter: { financial: 'PENDING', cancelled: '' },

    description:
      'Orders that have been placed but not paid yet, so payment is still to come.',
  },
]

/** The card whose filter is exactly what the list has on now (nothing when it is another choice). */
export function cardForFilters(filters: OrderFilters): CardDef | null {
  return (
    ORDER_SUMMARY_CARDS.find(
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

const isMoneyCard = (card: OrderSummaryCard) => /revenue/.test(card.key)

const percent = (value: number | null) =>
  value === null ? undefined : `${Number(value.toFixed(1))}% of orders`

/**
 * The cards' figures, from the answer when there is one (a dash until then). The label, the (i)
 * text (`info`), the extra line (`detail`), the amount and the share of orders are all the API's.
 */
export function summaryKpis(
  summary: OrderSummary | null,
  selected: CardDef | null,
  onSelect: (card: CardDef) => void,
): Kpi[] {
  return ORDER_SUMMARY_CARDS.map((def) => {
    const card = summary?.cards[def.key] ?? null
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
      active: selected?.key === def.key,
      onClick: () => onSelect(def),
    }
  })
}
