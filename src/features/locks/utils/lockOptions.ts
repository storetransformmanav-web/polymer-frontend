import type { AccessLock, AccessLockBody } from '../../../lib/api/endpoints.ts'

/** The yes/no settings of a lock (the ones `POST /access/locks` takes as options). */
export const LOCK_FLAGS = [
  'enabled',
  'hide_from_nav',
  'hide_from_lists',
  'manual_locking',
  'hide_from_sitemap',
  'noindex',
] as const
export type LockFlag = (typeof LOCK_FLAGS)[number]

/** What can be changed on a lock after it was created: a flag or the access-denied message. */
export type LockOptionChange = Partial<Record<LockFlag, boolean>> & { message?: string }

interface FlagInfo {
  /** The setting's name, as the Settings tab shows it. */
  label: string
  /** The words for on and off ("Enabled" / "Disabled", "Yes" / "No"). */
  on: string
  off: string
}

export const FLAG_INFO: Record<LockFlag, FlagInfo> = {
  enabled: { label: 'Status', on: 'Enabled', off: 'Disabled' },
  hide_from_nav: { label: 'Hidden from navigation menus', on: 'Yes', off: 'No' },
  hide_from_lists: { label: 'Hidden from lists', on: 'Yes', off: 'No' },
  manual_locking: { label: 'Manual locking', on: 'Yes', off: 'No' },
  hide_from_sitemap: { label: 'Hidden from sitemaps', on: 'Yes', off: 'No' },
  noindex: { label: 'Search engines told not to index', on: 'Yes', off: 'No' },
}

export const flagWord = (flag: LockFlag, value: boolean) =>
  value ? FLAG_INFO[flag].on : FLAG_INFO[flag].off

/** The longest "access denied" message the page lets you type. */
export const MAX_LOCK_MESSAGE = 500

/**
 * The `POST /access/locks` body that changes one lock's options and nothing else: the shop, this
 * product (by handle, else id), the lock's own keys again (adding keys it already has changes
 * nothing, and a lock with none stays login-only) and just the options that are being changed —
 * the API only applies an option that is sent.
 */
export function buildOptionsBody(
  lock: AccessLock,
  shop: string,
  change: LockOptionChange,
): AccessLockBody {
  return {
    shop,
    products: [lock.handle ?? lock.product_id],
    ...(lock.tags.length > 0 ? { tags: lock.tags } : {}),
    ...change,
  }
}

/** The lock with the change applied (what the screen shows the moment it is sent). */
export function withOptionChange(lock: AccessLock, change: LockOptionChange): AccessLock {
  return { ...lock, ...change }
}
