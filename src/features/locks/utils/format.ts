import type { BadgeTone } from '../../../components/ui/Badge.tsx'
import type { AccessLock, LockCustomer } from '../../../lib/api/endpoints.ts'

/** How a lock's push to the store is going, as a word and a pill colour. */
export function syncLabel(status: string | null | undefined): string {
  if (status === 'synced') return 'Synced'
  if (status === 'error') return 'Needs attention'
  return 'Pending'
}

export function syncTone(status: string | null | undefined): BadgeTone {
  if (status === 'synced') return 'success'
  if (status === 'error') return 'danger'
  return 'warning'
}

/** The short chips for what a lock hides from shoppers without access. */
export function hiddenFrom(lock: AccessLock): string[] {
  const out: string[] = []
  if (lock.hide_from_lists) out.push('Lists')
  if (lock.hide_from_nav) out.push('Menus')
  if (lock.noindex) out.push('Search engines')
  if (lock.hide_from_sitemap) out.push('Sitemap')
  return out
}

/** `GET /access/check` reasons, in plain words. */
export function checkReasonText(reason: string): string {
  switch (reason) {
    case 'not_locked':
      return 'The product is not locked, so everyone can see it.'
    case 'tag_match':
      return 'The customer has a tag that opens this lock.'
    case 'login_only':
      return 'Any signed-in customer can see it.'
    case 'no_matching_tag':
      return 'The customer has none of the lock’s tags.'
    case 'lock_disabled':
      return 'The lock is switched off, so everyone can see the product.'
    default:
      return reason
  }
}

/** The details page address of a lock — by handle, which is unique within a store. */
export const lockPath = (handle: string) => `/locks/${encodeURIComponent(handle)}`

/**
 * A tag is shared when other locked products use it too: giving or taking it changes access to all
 * of them. The sentence for the tags (of `names`) that more than one locked product uses, from the
 * customers answer's `tags[].locked_products`; null when none is shared.
 */
export function sharedTagsNote(
  tags: readonly { tag: string; locked_products: number | null }[],
  names: readonly string[],
): string | null {
  const wanted = new Set(names.map((name) => name.toLowerCase()))
  const shared = tags.filter(
    (item) => wanted.has(item.tag.toLowerCase()) && (item.locked_products ?? 0) > 1,
  )
  if (shared.length === 0) return null
  const list = shared
    .map((item) => `“${item.tag}” (${item.locked_products} locked products)`)
    .join(', ')
  return `Tags are shared: ${list}. This changes access to every product that uses ${shared.length === 1 ? 'it' : 'them'}, not only this one.`
}

/** The lock's tags a customer does not hold yet (compared without case). */
export function missingKeys(
  lockTags: readonly string[],
  held: readonly string[],
): string[] {
  const has = new Set(held.map((tag) => tag.toLowerCase()))
  return lockTags.filter((tag) => !has.has(tag.toLowerCase()))
}

/** A customer is named to the backend by email, else by id. */
export const customerRef = (customer: LockCustomer) => customer.email ?? customer.id

export const customerName = (customer: LockCustomer) =>
  customer.name ?? customer.email ?? customer.id

/** Whether Edit (give another of the lock's keys) makes sense for this customer. */
export const canEditCustomer = (lock: AccessLock, customer: LockCustomer) =>
  lock.tags.length > 1 && missingKeys(lock.tags, customer.tags).length > 0

/** A protected product's own page, shown inside Lock Management as a tab (`/locks/product/<id>`). */
export const linkedProductPath = (productId: string) =>
  `/locks/product/${encodeURIComponent(productId)}`

/** A customer's own page, shown inside Lock Management as a tab (`/locks/customer/<id>`). */
export const linkedCustomerPath = (customerId: string) =>
  `/locks/customer/${encodeURIComponent(customerId)}`
