import type { BadgeTone } from '../../../components/ui/Badge.tsx'
import type { AccessLock } from '../../../lib/api/endpoints.ts'

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
