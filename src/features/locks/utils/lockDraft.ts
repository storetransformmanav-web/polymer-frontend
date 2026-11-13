import { ownLockTag } from '../../../lib/lockOwnTag.ts'
import type { AccessLockBody } from '../../../lib/api/endpoints.ts'

/** The backend's limits for one call of `POST /access/locks`. */
export const MAX_ITEMS = 250
export const MAX_TAGS = 20
const MAX_TAG_LENGTH = 255

/** A product or customer ticked in a picker — kept whole so it can be shown after its page is gone. */
export interface PickedItem {
  /** CRM id — what is sent to the backend. */
  id: string
  label: string
  /** A second line: a product's handle, a customer's email. */
  sub?: string | null
  image?: string | null
}

/** The lock's settings. Defaults are those of a plain, working lock. */
export interface LockOptions {
  enabled: boolean
  hideFromLists: boolean
  hideFromNav: boolean
  noindex: boolean
  hideFromSitemap: boolean
  manualLocking: boolean
  /** What a customer without access reads; empty = the store's default. */
  message: string
}

export const DEFAULT_OPTIONS: LockOptions = {
  enabled: true,
  hideFromLists: false,
  hideFromNav: false,
  noindex: false,
  hideFromSitemap: false,
  manualLocking: false,
  message: '',
}

export interface LockDraft {
  products: PickedItem[]
  customers: PickedItem[]
  tags: string[]
  options: LockOptions
}

export const blankLockDraft = (): LockDraft => ({
  products: [],
  customers: [],
  tags: [],
  options: DEFAULT_OPTIONS,
})

/** What was already entered (so Back can ask before throwing it away). */
export function isLockDraftDirty(draft: LockDraft): boolean {
  return (
    draft.products.length > 0 ||
    draft.customers.length > 0 ||
    draft.tags.length > 0 ||
    JSON.stringify(draft.options) !== JSON.stringify(DEFAULT_OPTIONS)
  )
}

/**
 * Typed text → tags: split on commas (the backend refuses a comma inside a tag), trimmed,
 * blanks and repeats dropped (compared ignoring case), anything past 255 characters cut.
 */
export function parseTags(text: string, existing: readonly string[] = []): string[] {
  const seen = new Set(existing.map((tag) => tag.toLowerCase()))
  const out: string[] = []
  for (const piece of text.split(',')) {
    const tag = piece.trim().slice(0, MAX_TAG_LENGTH)
    if (!tag || seen.has(tag.toLowerCase())) continue
    seen.add(tag.toLowerCase())
    out.push(tag)
  }
  return out
}

/**
 * Adds the tags of an already-locked product to the ones chosen (compared without case, no
 * repeats), up to `MAX_TAGS`; `skipped` counts the ones that did not fit.
 */
export function mergeKeys(
  current: readonly string[],
  incoming: readonly string[],
): { tags: string[]; skipped: number } {
  const tags = [...current]
  const seen = new Set(tags.map((tag) => tag.toLowerCase()))
  let skipped = 0
  for (const tag of incoming) {
    if (seen.has(tag.toLowerCase())) continue
    if (tags.length >= MAX_TAGS) {
      skipped += 1
      continue
    }
    seen.add(tag.toLowerCase())
    tags.push(tag)
  }
  return { tags, skipped }
}

/**
 * Adds the customers (or products) of an already-locked product to the ones ticked (by id, no
 * repeats), up to `max` (`MAX_ITEMS`); `skipped` counts the ones that did not fit.
 */
export function mergePicked(
  current: readonly PickedItem[],
  incoming: readonly PickedItem[],
  max: number = MAX_ITEMS,
): { items: PickedItem[]; skipped: number } {
  const items = [...current]
  const seen = new Set(items.map((item) => item.id))
  let skipped = 0
  for (const item of incoming) {
    if (!item.id || seen.has(item.id)) continue
    if (items.length >= max) {
      skipped += 1
      continue
    }
    seen.add(item.id)
    items.push(item)
  }
  return { items, skipped }
}

/** What changed between a lock's keys and an edited list (a tag compares without case). */
export function diffTags(
  original: readonly string[],
  edited: readonly string[],
): { add: string[]; remove: string[] } {
  const had = new Set(original.map((tag) => tag.toLowerCase()))
  const has = new Set(edited.map((tag) => tag.toLowerCase()))
  return {
    add: edited.filter((tag) => !had.has(tag.toLowerCase())),
    remove: original.filter((tag) => !has.has(tag.toLowerCase())),
  }
}

/** A tag list with `add` put in and `remove` taken out (what the store will hold after `PUT /access/tags`). */
export function applyTagChange(
  tags: readonly string[],
  add: readonly string[],
  remove: readonly string[],
): string[] {
  const gone = new Set(remove.map((tag) => tag.toLowerCase()))
  const kept = tags.filter((tag) => !gone.has(tag.toLowerCase()))
  const seen = new Set(kept.map((tag) => tag.toLowerCase()))
  for (const tag of add) {
    if (seen.has(tag.toLowerCase())) continue
    seen.add(tag.toLowerCase())
    kept.push(tag)
  }
  return kept
}

/** The longest customer email / id the API is asked about. */
export const MAX_CUSTOMER_REF_LENGTH = 200

/**
 * The customers typed into a box — emails or ids split on commas, semicolons, spaces or new
 * lines, a repeat (without case) dropped. `existing` are already in the list.
 */
export function parseCustomerRefs(
  text: string,
  existing: readonly string[] = [],
): string[] {
  const seen = new Set(existing.map((ref) => ref.toLowerCase()))
  const out: string[] = []
  for (const piece of text.split(/[\s,;]+/)) {
    const ref = piece.trim().slice(0, MAX_CUSTOMER_REF_LENGTH)
    if (!ref || seen.has(ref.toLowerCase())) continue
    seen.add(ref.toLowerCase())
    out.push(ref)
  }
  return out
}

export interface LockProblems {
  /** About the whole form (nothing chosen). */
  form?: string
  products?: string
  customers?: string
  tags?: string
}

/** Checks a draft against what the API accepts; an empty object means it can be sent. */
export function validateLockDraft(draft: LockDraft): LockProblems {
  const problems: LockProblems = {}
  if (draft.products.length === 0 && draft.customers.length === 0) {
    problems.form = 'Choose at least one product or customer.'
  }
  if (draft.products.length > MAX_ITEMS) {
    problems.products = `A lock can take at most ${MAX_ITEMS} products at a time.`
  }
  if (draft.customers.length > MAX_ITEMS) {
    problems.customers = `At most ${MAX_ITEMS} customers can be given a tag at a time.`
  }
  if (draft.tags.length > MAX_TAGS) {
    problems.tags = `Use at most ${MAX_TAGS} tags at a time.`
  } else if (draft.customers.length > 0 && draft.tags.length === 0) {
    problems.tags = 'Customers need at least one tag — it is the key that lets them in.'
  }
  return problems
}

// The lock's own tag lives in lib/ (the product page uses it too).
export { findOwnTag, OWN_TAG_PREFIX, ownLockTag } from '../../../lib/lockOwnTag.ts'

/**
 * The one `POST /access/locks` call for a draft; every option is sent, so what you see is what is
 * set. With customers chosen, the lock's own tag (`lock-<first product's handle>`) goes with the
 * chosen tags, so only those customers hold it and the lock's page can list exactly them.
 */
export function buildLockBody(draft: LockDraft, shop: string): AccessLockBody {
  const { options } = draft
  const body: AccessLockBody = {
    shop,
    enabled: options.enabled,
    hide_from_lists: options.hideFromLists,
    hide_from_nav: options.hideFromNav,
    noindex: options.noindex,
    hide_from_sitemap: options.hideFromSitemap,
    manual_locking: options.manualLocking,
  }
  // As the API's example: products by handle, customers by email (the id when there is none).
  if (draft.products.length > 0) {
    body.products = draft.products.map((item) => item.sub?.trim() || item.id)
  }
  if (draft.customers.length > 0) {
    body.customers = draft.customers.map((item) => item.sub?.trim() || item.id)
  }
  const firstProduct = draft.products[0]
  const own =
    draft.customers.length > 0 && firstProduct
      ? ownLockTag(firstProduct.sub?.trim() || firstProduct.label)
      : null
  const tags =
    own && !draft.tags.some((tag) => tag.toLowerCase() === own)
      ? [...draft.tags, own]
      : draft.tags
  if (tags.length > 0) body.tags = tags
  const message = options.message.trim()
  if (message) body.message = message
  return body
}
