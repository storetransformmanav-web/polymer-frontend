import type { ProductDetail } from '../../../lib/api/endpoints.ts'

export type KnownCollection = ProductDetail['collections'][number]

/** Most collections the Add collection dropdown shows — with or without something typed. */
export const COLLECTION_LIST_LIMIT = 10

/** How a collection is compared by name: trimmed, any case. */
export const collectionKey = (title: string) => title.trim().toLowerCase()

/**
 * The collections to offer from the backend's own search answer (`GET /collections?search=`),
 * in the order the backend sent them. The only thing taken out is what the product is already
 * in or has been given — compared by name (`skip` holds `collectionKey`s), since a collection
 * is added by its name — the backend has no parameter for that, and the total follows.
 * `answerTotal` is how many collections the whole search matched.
 */
export function offerFoundCollections<T extends Pick<KnownCollection, 'id' | 'title'>>(
  found: readonly T[],
  answerTotal: number,
  skip: ReadonlySet<string>,
  limit = Number.POSITIVE_INFINITY,
): { shown: T[]; total: number } {
  const hits = found.filter((collection) => !skip.has(collectionKey(collection.title)))
  return {
    shown: hits.slice(0, limit),
    total: Math.max(hits.length, answerTotal - (found.length - hits.length)),
  }
}
