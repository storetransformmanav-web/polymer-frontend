import { OWN_TAG_PREFIX } from '../../../lib/lockOwnTag.ts'
import type { AccessLock } from '../../../lib/api/endpoints.ts'

/**
 * The pure rules of a customer's Lock Access tab. A customer opens a locked product when they hold
 * one of the lock's tags (its "keys"); a lock with no keys is login-only (any signed-in customer).
 * Every lock also has an internal **own tag** (`lock-<handle>`, made with it): it is how a customer
 * is chosen for just that one product, so it is never listed as a tag — the product shows instead.
 */

export const lowerSet = (tags: readonly string[]) =>
  new Set(tags.map((tag) => tag.toLowerCase()))

/** A lock's internal own tag (never shown as a tag). */
export const isOwnTag = (tag: string) => tag.toLowerCase().startsWith(OWN_TAG_PREFIX)

/** The lock's tags the customer holds, as the lock writes them. */
export function heldKeys(lock: AccessLock, customerTags: readonly string[]): string[] {
  const mine = lowerSet(customerTags)
  return lock.tags.filter((tag) => mine.has(tag.toLowerCase()))
}

/** Whether the customer can open this locked product by a tag they hold. */
export const hasAccess = (lock: AccessLock, customerTags: readonly string[]) =>
  heldKeys(lock, customerTags).length > 0

/** A lock with no keys at all: every customer who is signed in can open it. */
export const isLoginOnly = (lock: AccessLock) => lock.tags.length === 0

/** How many locks use each tag (lower case) — a tag used by several opens all of those products. */
export function tagUse(locks: readonly AccessLock[]): Map<string, number> {
  const use = new Map<string, number>()
  for (const lock of locks) {
    for (const tag of new Set(lock.tags.map((item) => item.toLowerCase()))) {
      use.set(tag, (use.get(tag) ?? 0) + 1)
    }
  }
  return use
}

/**
 * A customer's tags split for the tab: the **keys** (tags some lock uses, own tags left out) and
 * the **others**. Own tags are in neither.
 */
export function splitTags(
  customerTags: readonly string[],
  use: ReadonlyMap<string, number>,
): { keys: string[]; others: string[] } {
  const keys: string[] = []
  const others: string[] = []
  for (const tag of customerTags) {
    if (isOwnTag(tag)) continue
    if (use.has(tag.toLowerCase())) keys.push(tag)
    else others.push(tag)
  }
  return { keys, others }
}

/**
 * The tags that could give access to this product: its own tag when it has one (that opens only
 * this product), else its keys. Giving access uses the first unless the person picks another.
 */
export function giveCandidates(lock: AccessLock): string[] {
  const own = lock.tags.find(isOwnTag)
  return own ? [own] : [...lock.tags]
}

/**
 * Other locked products that stop opening for the customer when this one's access is taken away:
 * taking access away removes every tag of this product the customer holds, and a tag shared with
 * other locks opens those too.
 */
export function alsoLosing(
  locks: readonly AccessLock[],
  lock: AccessLock,
  customerTags: readonly string[],
): AccessLock[] {
  const held = lowerSet(heldKeys(lock, customerTags))
  if (held.size === 0) return []
  return locks.filter(
    (other) =>
      other.product_id !== lock.product_id &&
      other.tags.some((tag) => held.has(tag.toLowerCase())),
  )
}

/** The customer's tags after adding and removing some (case-insensitive, no repeats). */
export function changeTags(
  current: readonly string[],
  added: readonly string[],
  removed: readonly string[],
): string[] {
  const gone = lowerSet(removed)
  const out: string[] = []
  const seen = new Set<string>()
  for (const tag of [...current, ...added]) {
    const key = tag.toLowerCase()
    if (gone.has(key) || seen.has(key)) continue
    seen.add(key)
    out.push(tag)
  }
  return out
}

/** Locks matching a typed search (title or handle, any case). */
export function matchLocks(locks: readonly AccessLock[], search: string): AccessLock[] {
  const text = search.trim().toLowerCase()
  if (!text) return [...locks]
  return locks.filter(
    (lock) =>
      lock.title.toLowerCase().includes(text) ||
      (lock.handle ?? '').toLowerCase().includes(text),
  )
}
