import { useEffect, useMemo } from 'react'
import { useAppSelector } from '../../../app/store/hooks.ts'
import { usePrefetchDetails } from './useBulkEdit.ts'
import { collectionsOf, type KnownCollection } from '../utils/collectionSuggestions.ts'

/** Most products whose details are read to learn their collections. */
const HARVEST_LIMIT = 25

/**
 * The collections the app knows of: those of every product whose details it has loaded.
 * The API has no endpoint that lists all collections, so when `harvest` is set (the Add
 * collection list is open) the details of the products on the list page are read too (the
 * ones not cached yet, a few at a time, at most 25) and their collections join the rest.
 * `loading` is true while any of those details is still on its way.
 */
export function useKnownCollections(harvest = false): {
  collections: KnownCollection[]
  loading: boolean
} {
  const details = useAppSelector((state) => state.products.details)
  const listed = useAppSelector((state) => state.products.lastData?.items)
  const prefetch = usePrefetchDetails()

  const ids = useMemo(
    () => (listed ?? []).slice(0, HARVEST_LIMIT).map((item) => item.id),
    [listed],
  )
  useEffect(() => {
    if (harvest && ids.length > 0) prefetch(ids)
  }, [harvest, ids, prefetch])

  const collections = useMemo(
    () => collectionsOf(Object.values(details).map((entry) => entry.data)),
    [details],
  )
  const loading = harvest && ids.some((id) => details[id]?.isFetching)
  return { collections, loading }
}
