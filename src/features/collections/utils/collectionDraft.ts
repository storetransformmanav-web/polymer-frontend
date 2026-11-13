import type {
  CollectionCreateBody,
  CollectionDetail,
  CollectionRuleColumn,
  CollectionRules,
  CollectionUpdateBody,
} from '../../../lib/api/endpoints.ts'
import { sanitizeHtml } from '../../../lib/sanitizeHtml.ts'

/** The API's limits. */
export const TITLE_MAX = 255
export const SEO_TITLE_MAX = 70
export const SEO_DESCRIPTION_MAX = 320
export const MAX_CONDITIONS = 60
export const MAX_PRODUCTS = 250

/** "custom" → Manual, "smart" → Automated. */
export type CollectionKind = 'custom' | 'smart'

export const isSmart = (type: string | null | undefined) =>
  (type ?? '').toLowerCase() === 'smart'

export const typeLabel = (type: string | null | undefined) =>
  isSmart(type) ? 'Automated' : 'Manual'

/** The words for Shopify's product orders (the API sends the codes). */
const SORT_ORDER_LABELS: Record<string, string> = {
  ALPHA_ASC: 'Product title A–Z',
  ALPHA_DESC: 'Product title Z–A',
  BEST_SELLING: 'Best selling',
  CREATED: 'Oldest first',
  CREATED_DESC: 'Newest first',
  MANUAL: 'Manually',
  MOST_RELEVANT: 'Most relevant',
  PRICE_ASC: 'Lowest price',
  PRICE_DESC: 'Highest price',
}

export const sortOrderLabel = (code: string | null | undefined) =>
  code ? (SORT_ORDER_LABELS[code.toUpperCase()] ?? code) : '—'

/** One row of the conditions form; `key` only keeps React's list steady. */
export interface ConditionDraft {
  key: string
  column: string
  relation: string
  condition: string
}

/** What the create form and the details page's editor hold. */
export interface CollectionDraft {
  title: string
  handle: string
  /** With a changed handle: redirect the old address (the API's default). */
  redirectOldHandle: boolean
  descriptionHtml: string
  imageUrl: string
  imageAlt: string
  removeImage: boolean
  seoTitle: string
  seoDescription: string
  sortOrder: string
  kind: CollectionKind
  /** Manual: the products to put in (create) — CRM ids with a name to show. */
  products: { id: string; title: string; image: string | null }[]
  match: 'all' | 'any'
  conditions: ConditionDraft[]
}

let nextKey = 0
export const newConditionKey = () => `condition-${(nextKey += 1)}`

/** A blank condition row on the first column the options offer. */
export function blankCondition(columns: readonly CollectionRuleColumn[]): ConditionDraft {
  const first = columns[0]
  return {
    key: newConditionKey(),
    column: first?.column ?? '',
    relation: first?.relations[0]?.value ?? '',
    condition: '',
  }
}

export function blankCollectionDraft(): CollectionDraft {
  return {
    title: '',
    handle: '',
    redirectOldHandle: true,
    descriptionHtml: '',
    imageUrl: '',
    imageAlt: '',
    removeImage: false,
    seoTitle: '',
    seoDescription: '',
    sortOrder: '',
    kind: 'custom',
    products: [],
    match: 'all',
    conditions: [],
  }
}

/** The draft of an existing collection, frozen when its editor opens (the diff is taken against it). */
export function draftFromCollection(collection: CollectionDetail): CollectionDraft {
  const ruleSet = collection.rule_set
  return {
    title: collection.title,
    handle: collection.handle,
    redirectOldHandle: true,
    descriptionHtml: collection.description_html ?? '',
    imageUrl: collection.image_url ?? '',
    imageAlt: collection.image_alt ?? '',
    removeImage: false,
    seoTitle: collection.seo_title ?? '',
    seoDescription: collection.seo_description ?? '',
    sortOrder: collection.sort_order ?? '',
    kind: isSmart(collection.collection_type) ? 'smart' : 'custom',
    products: [],
    match: ruleSet?.match === 'any' ? 'any' : 'all',
    conditions: (ruleSet?.conditions ?? []).map((condition) => ({
      key: newConditionKey(),
      column: condition.column,
      relation: condition.relation,
      condition: condition.condition ?? '',
    })),
  }
}

export type DraftErrors = Partial<Record<string, string>>

const isHttps = (value: string) => {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

/** The column of a condition, from the rule options. */
export const columnOf = (columns: readonly CollectionRuleColumn[], column: string) =>
  columns.find((item) => item.column === column)

/**
 * Checks the draft against the API's limits. Errors are keyed by field (`title`, `imageUrl`,
 * `conditions.0.condition`…), so each one shows under its own box.
 */
export function validateCollectionDraft(
  draft: CollectionDraft,
  columns: readonly CollectionRuleColumn[],
): DraftErrors {
  const errors: DraftErrors = {}
  const title = draft.title.trim()
  if (!title) errors.title = 'Give the collection a title.'
  else if (title.length > TITLE_MAX) errors.title = `At most ${TITLE_MAX} characters.`

  if (draft.handle.trim() && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(draft.handle.trim())) {
    errors.handle =
      'Use lower-case letters, numbers and dashes only (e.g. juice-bottles).'
  }

  const image = draft.imageUrl.trim()
  if (image && !draft.removeImage && !isHttps(image)) {
    errors.imageUrl = 'Use a public https:// address.'
  }
  if (draft.seoTitle.length > SEO_TITLE_MAX) {
    errors.seoTitle = `At most ${SEO_TITLE_MAX} characters.`
  }
  if (draft.seoDescription.length > SEO_DESCRIPTION_MAX) {
    errors.seoDescription = `At most ${SEO_DESCRIPTION_MAX} characters.`
  }

  if (draft.kind === 'custom' && draft.products.length > MAX_PRODUCTS) {
    errors.products = `At most ${MAX_PRODUCTS} products at a time.`
  }

  if (draft.kind === 'smart') {
    if (draft.conditions.length === 0) {
      errors.conditions = 'Add at least one condition.'
    } else if (draft.conditions.length > MAX_CONDITIONS) {
      errors.conditions = `At most ${MAX_CONDITIONS} conditions.`
    }
    draft.conditions.forEach((condition, index) => {
      const column = columnOf(columns, condition.column)
      if (!column) {
        errors[`conditions.${index}.column`] = 'Choose what to check.'
        return
      }
      if (!column.relations.some((relation) => relation.value === condition.relation)) {
        errors[`conditions.${index}.relation`] = 'Choose a condition.'
      }
      const value = condition.condition.trim()
      if (column.value_type === 'boolean') return
      if (!value) {
        errors[`conditions.${index}.condition`] = 'Enter a value.'
      } else if (column.value_type === 'number') {
        const number = Number(value)
        if (!Number.isFinite(number)) {
          errors[`conditions.${index}.condition`] = 'Enter a number.'
        } else if (column.column === 'VARIANT_INVENTORY' && !Number.isInteger(number)) {
          errors[`conditions.${index}.condition`] = 'Enter a whole number.'
        }
      }
    })
  }
  return errors
}

/** The conditions as sent: a yes/no column's value is always "". */
export function rulesOf(
  draft: CollectionDraft,
  columns: readonly CollectionRuleColumn[],
): CollectionRules {
  return {
    match: draft.match,
    conditions: draft.conditions.map((condition) => ({
      column: condition.column,
      relation: condition.relation,
      condition:
        columnOf(columns, condition.column)?.value_type === 'boolean'
          ? ''
          : condition.condition.trim(),
    })),
  }
}

/** `POST /collections`: only what was filled in; `products` for manual, `rules` for automated. */
export function buildCreateBody(
  draft: CollectionDraft,
  shop: string,
  columns: readonly CollectionRuleColumn[],
): CollectionCreateBody {
  const body: CollectionCreateBody = { shop, title: draft.title.trim() }
  const description = sanitizeHtml(draft.descriptionHtml).trim()
  if (description) body.description_html = description
  if (draft.imageUrl.trim()) body.image_url = draft.imageUrl.trim()
  if (draft.imageAlt.trim()) body.image_alt = draft.imageAlt.trim()
  if (draft.seoTitle.trim()) body.seo_title = draft.seoTitle.trim()
  if (draft.seoDescription.trim()) body.seo_description = draft.seoDescription.trim()
  if (draft.sortOrder) body.sort_order = draft.sortOrder
  if (draft.kind === 'smart') body.rules = rulesOf(draft, columns)
  else if (draft.products.length > 0)
    body.products = draft.products.map((item) => item.id)
  return body
}

const sameRules = (a: CollectionRules, b: CollectionRules) =>
  JSON.stringify(a) === JSON.stringify(b)

/**
 * `PUT /collections/{id}`: only the fields that changed against the frozen copy (`before`). The
 * products of a manual collection are added and removed on the details page itself, not here.
 */
export function buildUpdateBody(
  before: CollectionDraft,
  draft: CollectionDraft,
  columns: readonly CollectionRuleColumn[],
): CollectionUpdateBody {
  const body: CollectionUpdateBody = {}
  if (draft.title.trim() !== before.title.trim()) body.title = draft.title.trim()
  if (draft.handle.trim() && draft.handle.trim() !== before.handle.trim()) {
    body.handle = draft.handle.trim()
    body.redirect_old_handle = draft.redirectOldHandle
  }
  if (draft.descriptionHtml !== before.descriptionHtml) {
    body.description_html = sanitizeHtml(draft.descriptionHtml)
  }
  if (draft.removeImage) {
    body.remove_image = true
  } else {
    if (draft.imageUrl.trim() !== before.imageUrl.trim() && draft.imageUrl.trim()) {
      body.image_url = draft.imageUrl.trim()
    }
    if (draft.imageAlt.trim() !== before.imageAlt.trim())
      body.image_alt = draft.imageAlt.trim()
  }
  if (draft.seoTitle.trim() !== before.seoTitle.trim())
    body.seo_title = draft.seoTitle.trim()
  if (draft.seoDescription.trim() !== before.seoDescription.trim()) {
    body.seo_description = draft.seoDescription.trim()
  }
  if (draft.sortOrder && draft.sortOrder !== before.sortOrder)
    body.sort_order = draft.sortOrder
  if (draft.kind === 'smart') {
    const next = rulesOf(draft, columns)
    if (!sameRules(next, rulesOf(before, columns))) body.rules = next
  }
  return body
}

/** Whether anything was typed into a new collection (asked before it is thrown away). */
export function isDraftDirty(draft: CollectionDraft): boolean {
  const blank = blankCollectionDraft()
  return (
    draft.title.trim() !== '' ||
    draft.handle.trim() !== '' ||
    draft.descriptionHtml.trim() !== '' ||
    draft.imageUrl.trim() !== '' ||
    draft.imageAlt.trim() !== '' ||
    draft.seoTitle.trim() !== '' ||
    draft.seoDescription.trim() !== '' ||
    draft.sortOrder !== blank.sortOrder ||
    draft.kind !== blank.kind ||
    draft.products.length > 0 ||
    draft.conditions.some((condition) => condition.condition.trim() !== '')
  )
}
