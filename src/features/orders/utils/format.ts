import type { BadgeTone } from '../../../components/ui/Badge.tsx'
import type { OrderListItem } from '../../../lib/api/endpoints.ts'

/** "PARTIALLY_REFUNDED" → "Partially refunded". */
export function humanize(value: string | null | undefined): string {
  if (!value) return ''
  const words = value.replace(/[_-]+/g, ' ').trim().toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

const FINANCIAL_TONES: Record<string, BadgeTone> = {
  PAID: 'success',
  PENDING: 'warning',
  AUTHORIZED: 'default',
  PARTIALLY_REFUNDED: 'warning',
  REFUNDED: 'neutral',
  VOIDED: 'danger',
}

const FULFILLMENT_TONES: Record<string, BadgeTone> = {
  FULFILLED: 'success',
  PARTIALLY_FULFILLED: 'warning',
  UNFULFILLED: 'neutral',
  ON_HOLD: 'danger',
}

export const financialTone = (status: string | null | undefined): BadgeTone =>
  (status && FINANCIAL_TONES[status.toUpperCase()]) || 'neutral'

export const fulfillmentTone = (status: string | null | undefined): BadgeTone =>
  (status && FULFILLMENT_TONES[status.toUpperCase()]) || 'neutral'

/** What the order's channel is called: the API's `source_name` made readable. */
export function sourceLabel(source: string | null | undefined): string {
  if (!source) return ''
  switch (source.toLowerCase()) {
    case 'web':
      return 'Online store'
    case 'pos':
      return 'Point of sale'
    case 'shopify':
      return 'Shopify'
    case 'draft_order':
    case 'shopify_draft_order':
      return 'Draft order'
    default:
      // An app's id (e.g. "4974139") has no name the CRM could show.
      return /^\d+$/.test(source) ? `App ${source}` : humanize(source)
  }
}

/** The order number as the page shows it: the API's name ("#17516") without the hashtag. */
export function orderLabel(order: Pick<OrderListItem, 'name'>): string {
  return order.name.replace(/^#/, '')
}

/** The customer to show: their name, else the email the order was placed with. */
export function orderCustomerName(
  order: Pick<OrderListItem, 'customer' | 'email'>,
): string {
  return order.customer?.full_name?.trim() || order.customer?.email || order.email || '—'
}

/** The email to show under the name (the order's own, else the customer's). */
export function orderEmail(order: Pick<OrderListItem, 'customer' | 'email'>): string {
  return order.email || order.customer?.email || ''
}

/** Has a refund been made (a total above zero)? */
export function hasRefund(order: Pick<OrderListItem, 'total_refunded'>): boolean {
  return Number.parseFloat(order.total_refunded ?? '0') > 0
}
