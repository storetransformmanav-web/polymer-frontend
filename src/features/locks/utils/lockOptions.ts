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

/** What can be changed on a lock after it was created: its yes/no settings. */
export type LockOptionChange = Partial<Record<LockFlag, boolean>>

interface FlagInfo {
  /** The setting's name, as the Settings tab shows it. */
  label: string
  /** The words for on and off ("Enabled" / "Disabled", "Yes" / "No"). */
  on: string
  off: string
  /** One line saying what the setting does (shown as the ⓘ's tooltip). */
  hint: string
}

export const FLAG_INFO: Record<LockFlag, FlagInfo> = {
  enabled: {
    label: 'Status',
    on: 'Enabled',
    off: 'Disabled',
    hint: 'Turns the lock on or off.',
  },
  hide_from_nav: {
    label: 'Hidden from navigation menus',
    on: 'Yes',
    off: 'No',
    hint: 'Leaves the product out of the store’s navigation menus.',
  },
  hide_from_lists: {
    label: 'Hidden from lists',
    on: 'Yes',
    off: 'No',
    hint: 'Leaves the product out of collection and search lists.',
  },
  manual_locking: {
    label: 'Manual locking',
    on: 'Yes',
    off: 'No',
    hint: 'The website shows the product to everyone and leaves the lock to custom theme code.',
  },
  hide_from_sitemap: {
    label: 'Hidden from sitemaps',
    on: 'Yes',
    off: 'No',
    hint: 'Leaves the product out of the store’s sitemap.',
  },
  noindex: {
    label: 'Search engines told not to index',
    on: 'Yes',
    off: 'No',
    hint: 'Asks search engines not to list the product page.',
  },
}

export const flagWord = (flag: LockFlag, value: boolean) =>
  value ? FLAG_INFO[flag].on : FLAG_INFO[flag].off

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
