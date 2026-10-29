import type { AccessLock, AccessLockBody } from '../../../lib/api/endpoints.ts'

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

/** The options of a lock the list or the details already have. */
export function optionsOf(lock: AccessLock): LockOptions {
  return {
    enabled: lock.enabled,
    hideFromLists: lock.hide_from_lists,
    hideFromNav: lock.hide_from_nav,
    noindex: lock.noindex,
    hideFromSitemap: lock.hide_from_sitemap,
    manualLocking: lock.manual_locking,
    message: lock.message ?? '',
  }
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

/** The one `POST /access/locks` call for a draft; every option is sent, so what you see is what is set. */
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
  if (draft.products.length > 0) body.products = draft.products.map((item) => item.id)
  if (draft.customers.length > 0) body.customers = draft.customers.map((item) => item.id)
  if (draft.tags.length > 0) body.tags = draft.tags
  const message = options.message.trim()
  if (message) body.message = message
  return body
}

/**
 * The settings of one existing lock that changed, as an update of that product only. The
 * lock's own tags travel along so the backend never takes "no tags" for a login-only lock.
 * Returns null when nothing changed.
 */
export function buildOptionsUpdate(
  lock: AccessLock,
  options: LockOptions,
  shop: string,
): AccessLockBody | null {
  const before = optionsOf(lock)
  const body: AccessLockBody = { shop, products: [lock.product_id] }
  let changed = false
  if (options.enabled !== before.enabled) {
    body.enabled = options.enabled
    changed = true
  }
  if (options.hideFromLists !== before.hideFromLists) {
    body.hide_from_lists = options.hideFromLists
    changed = true
  }
  if (options.hideFromNav !== before.hideFromNav) {
    body.hide_from_nav = options.hideFromNav
    changed = true
  }
  if (options.noindex !== before.noindex) {
    body.noindex = options.noindex
    changed = true
  }
  if (options.hideFromSitemap !== before.hideFromSitemap) {
    body.hide_from_sitemap = options.hideFromSitemap
    changed = true
  }
  if (options.manualLocking !== before.manualLocking) {
    body.manual_locking = options.manualLocking
    changed = true
  }
  if (options.message.trim() !== before.message.trim()) {
    body.message = options.message.trim()
    changed = true
  }
  if (!changed) return null
  if (lock.tags.length > 0) body.tags = lock.tags
  return body
}
