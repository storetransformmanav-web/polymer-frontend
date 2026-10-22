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

/** The order number as the page shows it: `order_number` (17516), not the name ("#17516"). */
export function orderLabel(order: Pick<OrderListItem, 'order_number' | 'name'>): string {
  return order.order_number != null
    ? String(order.order_number)
    : order.name.replace(/^#/, '')
}

/**
 * The order's customer, from the `customer` object only — its name and email. An order
 * with no customer in the CRM (a guest checkout: every field null) has none, and the
 * email the order was placed with is not passed off as the customer's.
 */
export function orderCustomer(
  order: Pick<OrderListItem, 'customer'>,
): { name: string; email: string } | null {
  const name = order.customer?.full_name?.trim() ?? ''
  const email = order.customer?.email?.trim() ?? ''
  if (!name && !email) return null
  // With no name, the email is what identifies them (and is not shown twice).
  return name ? { name, email } : { name: email, email: '' }
}

/** Has a refund been made (a total above zero)? */
export function hasRefund(order: Pick<OrderListItem, 'total_refunded'>): boolean {
  return Number.parseFloat(order.total_refunded ?? '0') > 0
}

/** What the order is called in its address and in the API's `{ref}`: the number, else the id. */
export function orderRef(order: Pick<OrderListItem, 'order_number' | 'id'>): string {
  return order.order_number != null ? String(order.order_number) : order.id
}

/** The details page of an order — its number, and its store when known (two stores can share a number). */
export function orderPath(
  order: Pick<OrderListItem, 'order_number' | 'id' | 'shop'>,
): string {
  const shop = order.shop?.key
  return `/orders/${encodeURIComponent(orderRef(order))}${
    shop ? `?shop=${encodeURIComponent(shop)}` : ''
  }`
}

/** The lines of a postal address, whichever parts exist ("55 Buckshaft Road", "Cinderford GL14 3DT"…). */
export function formatAddressLines(
  address:
    | {
        address1?: string | null
        address2?: string | null
        city?: string | null
        province?: string | null
        zip?: string | null
        country?: string | null
      }
    | null
    | undefined,
): string[] {
  if (!address) return []
  return [
    address.address1,
    address.address2,
    [address.city, address.zip].filter(Boolean).join(' '),
    address.province,
    address.country,
  ].filter((line): line is string => Boolean(line && line.trim()))
}

/**
 * The plain values of a record whose shape isn't documented (a refund, a fulfillment…):
 * its text, number and yes/no fields, with readable names. Nested values are left out.
 */
export function recordFields(record: Record<string, unknown>): [string, string][] {
  return Object.entries(record).flatMap(([key, value]) => {
    if (value === null || value === undefined || value === '') return []
    if (typeof value === 'string' || typeof value === 'number') {
      return [[humanize(key), String(value)] as [string, string]]
    }
    if (typeof value === 'boolean') {
      return [[humanize(key), value ? 'Yes' : 'No'] as [string, string]]
    }
    return []
  })
}
