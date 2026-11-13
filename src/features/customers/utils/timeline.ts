import type { BadgeTone } from '../../../components/ui/Badge.tsx'
import type { ActivityListResponse, CustomerDetail } from '../../../lib/api/endpoints.ts'
import { formatPrice } from '../../../lib/format.ts'
import { formatStoreDay, storeDateKey } from '../../../lib/storeTime.ts'
import { humanize } from './format.ts'
import { paymentTone } from './orderStatus.ts'

/** The groups the filter offers. */
export type CustomerTimelineCategory = 'account' | 'marketing' | 'orders' | 'staff'

/** Which icon an event gets (the component maps these to its SVGs). */
export type CustomerTimelineIcon =
  | 'account'
  | 'created'
  | 'verified'
  | 'mail'
  | 'sms'
  | 'login'
  | 'order'
  | 'sync'
  | 'update'
  | 'staff'

export const CATEGORY_LABELS: Record<CustomerTimelineCategory, string> = {
  account: 'Account',
  marketing: 'Marketing',
  orders: 'Orders',
  staff: 'Staff activity',
}

/** The order the filter lists its categories in. */
export const CATEGORY_ORDER: CustomerTimelineCategory[] = [
  'account',
  'marketing',
  'orders',
  'staff',
]

/** One timeline event of a customer. */
export interface CustomerTimelineEvent {
  /** Unique among the events shown. */
  key: string
  title: string
  category: CustomerTimelineCategory
  icon: CustomerTimelineIcon
  /** A plain sentence about it. */
  message: string
  /** Who did it (staff activity only). */
  author: string | null
  /** The instant, as the API sent it. */
  occurredAt: string
  /** The instant in milliseconds (for ordering). */
  time: number
  badge: { label: string; tone: BadgeTone } | null
  /** Other plain facts, as label / value. */
  details: [string, string][]
  /** An order event can be opened: its number and the label of its tab. */
  order?: { ref: string; label: string }
}

/** A day's events, under the store's calendar day. */
export interface CustomerTimelineDay {
  /** "2026-11-05" on the store's clock. */
  key: string
  /** "Nov 5, 2026". */
  label: string
  events: CustomerTimelineEvent[]
}

type ActivityItem = ActivityListResponse['items'][number]

const MINUTE = 60_000

function timeOf(iso: string | null | undefined): number | null {
  if (!iso) return null
  const time = Date.parse(iso)
  return Number.isFinite(time) ? time : null
}

/** A marketing state as a badge: subscribed is good, the rest is just said. */
function marketingBadge(state: string | null | undefined) {
  const value = (state ?? '').toUpperCase()
  if (!value) return null
  return {
    label: humanize(value),
    tone: (value === 'SUBSCRIBED' ? 'success' : 'neutral') as BadgeTone,
  }
}

/**
 * Everything the customer carries that has a date, and what staff did to them, as one list, newest
 * first. **Account** (created in Shopify / added to the CRM, email verified, last login, updated,
 * synced), **Marketing** (email and SMS), **Orders** (the latest ones the answer carries, plus the
 * first and latest order when they are not among them) and **Staff activity** (the audit log's
 * entries for this customer). An event with no usable time is left out, so every row is placed.
 */
export function buildCustomerTimeline(
  customer: CustomerDetail,
  activity: readonly ActivityItem[] = [],
): CustomerTimelineEvent[] {
  const events: CustomerTimelineEvent[] = []

  function add(
    event: Omit<CustomerTimelineEvent, 'time' | 'author' | 'badge' | 'details'> &
      Partial<Pick<CustomerTimelineEvent, 'author' | 'badge' | 'details'>>,
  ) {
    const time = timeOf(event.occurredAt)
    if (time === null) return
    events.push({
      author: null,
      badge: null,
      details: [],
      ...event,
      time,
    })
  }

  // --- Account
  const shopifyCreated = timeOf(customer.shopify_created_at)
  add({
    key: 'shopify-created',
    title: 'Customer account created',
    category: 'account',
    icon: 'created',
    message: 'The account was created in the store.',
    occurredAt: customer.shopify_created_at ?? '',
  })
  const crmCreated = timeOf(customer.created_at)
  if (
    crmCreated !== null &&
    (shopifyCreated === null || Math.abs(crmCreated - shopifyCreated) > MINUTE)
  ) {
    add({
      key: 'crm-created',
      title: 'Added to the CRM',
      category: 'account',
      icon: 'account',
      message: 'The customer was first saved in the CRM.',
      occurredAt: customer.created_at ?? '',
    })
  }
  add({
    key: 'email-verified',
    title: 'Email verified',
    category: 'account',
    icon: 'verified',
    message: customer.email
      ? `${customer.email} was confirmed as a real address.`
      : 'The email address was confirmed.',
    occurredAt: customer.email_verified_at ?? '',
  })
  add({
    key: 'last-login',
    title: 'Last login',
    category: 'account',
    icon: 'login',
    message: 'The last time they signed in to the store.',
    occurredAt: customer.last_login_at ?? '',
  })
  add({
    key: 'shopify-updated',
    title: 'Updated in Shopify',
    category: 'account',
    icon: 'update',
    message: 'The customer was last changed in the store.',
    occurredAt: customer.shopify_updated_at ?? '',
  })
  add({
    key: 'crm-updated',
    title: 'Updated in the CRM',
    category: 'account',
    icon: 'update',
    message: 'The customer was last changed in the CRM.',
    occurredAt: customer.updated_at ?? '',
  })
  add({
    key: 'synced',
    title: 'Synced from Shopify',
    category: 'account',
    icon: 'sync',
    message: 'The CRM last read this customer from the store.',
    occurredAt: customer.shopify_synced_at ?? '',
  })

  // --- Marketing
  add({
    key: 'email-marketing',
    title: `Email marketing: ${humanize(customer.email_marketing_state) || 'updated'}`,
    category: 'marketing',
    icon: 'mail',
    message: customer.email_marketing_opt_in_level
      ? `Opt-in level: ${humanize(customer.email_marketing_opt_in_level)}.`
      : 'The email marketing choice was changed.',
    occurredAt: customer.email_marketing_updated_at ?? '',
    badge: marketingBadge(customer.email_marketing_state),
  })
  add({
    key: 'sms-marketing',
    title: `SMS marketing: ${humanize(customer.sms_marketing_state) || 'updated'}`,
    category: 'marketing',
    icon: 'sms',
    message: customer.sms_marketing_opt_in_level
      ? `Opt-in level: ${humanize(customer.sms_marketing_opt_in_level)}.`
      : 'The SMS marketing choice was changed.',
    occurredAt: customer.sms_marketing_updated_at ?? '',
    badge: marketingBadge(customer.sms_marketing_state),
  })

  // --- Orders
  const listed = new Set<string>()
  for (const order of customer.orders ?? []) {
    listed.add(order.name)
    const total = formatPrice(order.total_price, order.currency ?? customer.currency)
    const items = order.items_count ?? 0
    add({
      key: `order-${order.id}`,
      title: `Order ${order.name} placed`,
      category: 'orders',
      icon: 'order',
      message: `${items} ${items === 1 ? 'item' : 'items'} · ${total}`,
      occurredAt: order.created_at ?? '',
      badge: order.cancelled
        ? { label: 'Cancelled', tone: 'danger' }
        : order.financial_status
          ? {
              label: humanize(order.financial_status),
              tone: paymentTone(order.financial_status),
            }
          : null,
      details: [
        ['Order', order.name],
        ['Payment status', humanize(order.financial_status) || '—'],
        ['Fulfillment', humanize(order.fulfillment_status) || '—'],
        ['Items', String(items)],
        ['Total price', total],
      ],
      order: {
        ref: String(order.order_number ?? order.name.replace(/^#/, '')),
        label: String(order.order_number ?? order.name.replace(/^#/, '')),
      },
    })
  }
  const summary = customer.order_summary
  if (summary?.first_order_name && !listed.has(summary.first_order_name)) {
    add({
      key: 'first-order',
      title: `First order ${summary.first_order_name}`,
      category: 'orders',
      icon: 'order',
      message: 'Their first order in the CRM.',
      occurredAt: summary.first_order_at ?? '',
      order: {
        ref: summary.first_order_name.replace(/^#/, ''),
        label: summary.first_order_name.replace(/^#/, ''),
      },
    })
  }
  if (summary?.last_order_name && !listed.has(summary.last_order_name)) {
    add({
      key: 'latest-order',
      title: `Latest order ${summary.last_order_name}`,
      category: 'orders',
      icon: 'order',
      message: 'Their most recent order.',
      occurredAt: summary.last_order_at ?? '',
      order: {
        ref: summary.last_order_name.replace(/^#/, ''),
        label: summary.last_order_name.replace(/^#/, ''),
      },
    })
  }

  // --- Staff activity (the audit log)
  for (const item of activity) {
    const who = item.user?.full_name?.trim() || item.user?.email?.trim() || null
    const failed = typeof item.status_code === 'number' && item.status_code >= 400
    add({
      key: `staff-${item.id}`,
      title: humanize(item.action) || 'Activity',
      category: 'staff',
      icon: 'staff',
      message: item.summary || '',
      author: who,
      occurredAt: item.time,
      badge: failed ? { label: 'Failed', tone: 'danger' } : null,
      details: [
        ...(item.method
          ? ([['Request', `${item.method} ${item.path ?? ''}`.trim()]] as [
              string,
              string,
            ][])
          : []),
        ...(item.ip ? ([['IP address', item.ip]] as [string, string][]) : []),
        ...(item.device ? ([['Device', item.device]] as [string, string][]) : []),
      ],
    })
  }

  // Newest first; the key breaks a tie so the order never jumps between renders.
  return events.sort((a, b) => b.time - a.time || a.key.localeCompare(b.key))
}

/** The events under the store's calendar days, in the order given (newest day first). */
export function groupTimelineByDay(
  events: readonly CustomerTimelineEvent[],
  timeZone?: string,
): CustomerTimelineDay[] {
  const days: CustomerTimelineDay[] = []
  for (const event of events) {
    const key = storeDateKey(event.occurredAt, timeZone) || 'unknown'
    const last = days[days.length - 1]
    if (last && last.key === key) {
      last.events.push(event)
    } else {
      days.push({
        key,
        label: formatStoreDay(event.occurredAt, timeZone) || 'No date',
        events: [event],
      })
    }
  }
  return days
}

/** How many events each category holds (only the ones that have any). */
export function countByCategory(
  events: readonly CustomerTimelineEvent[],
): Partial<Record<CustomerTimelineCategory, number>> {
  const counts: Partial<Record<CustomerTimelineCategory, number>> = {}
  for (const event of events) counts[event.category] = (counts[event.category] ?? 0) + 1
  return counts
}
