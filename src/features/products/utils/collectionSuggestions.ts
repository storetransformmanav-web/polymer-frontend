import type { ProductDetail } from '../../../lib/api/endpoints.ts'

export type KnownCollection = ProductDetail['collections'][number]

/** Most collections the Add collection dropdown shows — with or without something typed. */
export const COLLECTION_LIST_LIMIT = 10

/** Every distinct collection found in these products' details, by title. */
export function collectionsOf(
  products: readonly (Pick<ProductDetail, 'collections'> | null | undefined)[],
): KnownCollection[] {
  const byId = new Map<string, KnownCollection>()
  for (const product of products) {
    for (const collection of product?.collections ?? []) {
      if (!byId.has(collection.id)) byId.set(collection.id, collection)
    }
  }
  return [...byId.values()].sort((a, b) =>
    a.title.localeCompare(b.title, 'en', { sensitivity: 'base' }),
  )
}

/**
 * The collections to offer for what was typed: those whose title, handle or id contains
 * it (any case) — everything when nothing was typed — leaving out the ones the product is
 * already in or has been given, those starting with the text first. `shown` is every
 * match, or only the first `limit` when one is given; `total` is how many matched.
 */
export function matchCollections(
  known: readonly KnownCollection[],
  query: string,
  skip: ReadonlySet<string>,
  limit = Number.POSITIVE_INFINITY,
): { shown: KnownCollection[]; total: number } {
  const needle = query.trim().toLowerCase()
  const hits = known.filter(
    (collection) =>
      !skip.has(collection.id) &&
      (!needle ||
        collection.title.toLowerCase().includes(needle) ||
        collection.handle.toLowerCase().includes(needle) ||
        collection.id.toLowerCase().includes(needle)),
  )
  if (needle) {
    const starts = (collection: KnownCollection) =>
      collection.title.toLowerCase().startsWith(needle) ? 0 : 1
    hits.sort((a, b) => starts(a) - starts(b))
  }
  return { shown: hits.slice(0, limit), total: hits.length }
}
