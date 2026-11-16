import { useQueries } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useAccess } from '../../../hooks/useAccess.ts'
import { api, type AccessLock } from '../../../lib/api/endpoints.ts'

/** The API's largest page of locks. */
const PAGE_SIZE = 100
/** A safety stop: 20 pages is 2,000 locks. */
const MAX_PAGES = 20
const FIVE_MINUTES = 5 * 60_000

/** Every lock of one store, from `GET /access/locks` (all pages). */
async function loadLocks(shop: string): Promise<AccessLock[]> {
  const found: AccessLock[] = []
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const answer = await api.access.locks({ shop, page, page_size: PAGE_SIZE })
    found.push(...answer.locks)
    if (!answer.has_next) break
  }
  return found
}

interface ProductRef {
  handle: string
  shop?: { key?: string | null } | null
}

/**
 * The lock of each product on screen, or null when it has none — for the small lock icon beside a
 * name in the products list, and for the lock side panel that icon opens (which draws from this
 * very row, so it needs no request of its own). The list answer says nothing about locks, so the
 * locks of each store shown are read once from `GET /access/locks` (every page, cached five
 * minutes under `['locks', …]`, so any lock write — Add lock, Delete lock — refreshes it) and a
 * product is locked when its handle is among them. Only stores that have a product on screen are asked, and nothing is asked for a
 * user who may not view Lock Management (the backend would refuse) or while `enabled` is false.
 * When the call fails no icon is drawn — the list never depends on it.
 */
export function useLockedProducts(products: readonly ProductRef[], enabled = true) {
  const { canView } = useAccess('access')
  const shops = useMemo(
    () => [
      ...new Set(
        products.map((product) => product.shop?.key ?? '').filter((key) => key !== ''),
      ),
    ],
    [products],
  )

  const results = useQueries({
    queries: shops.map((shop) => ({
      queryKey: ['locks', 'by-shop', shop],
      queryFn: () => loadLocks(shop),
      enabled: enabled && canView,
      staleTime: FIVE_MINUTES,
      retry: false,
      // The list is the page's real content: re-reading on focus would only add requests.
      refetchOnWindowFocus: false,
    })),
  })

  const stamp = results.map((result) => result.dataUpdatedAt).join('|')
  const locked = useMemo(() => {
    const byShop = new Map<string, Map<string, AccessLock>>()
    shops.forEach((shop, index) => {
      const locks = new Map<string, AccessLock>()
      for (const lock of results[index]?.data ?? []) {
        if (lock.handle) locks.set(lock.handle.toLowerCase(), lock)
      }
      byShop.set(shop, locks)
    })
    return byShop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shops, stamp])

  return (product: ProductRef): AccessLock | null => {
    const shop = product.shop?.key ?? ''
    if (!shop || !product.handle) return null
    return locked.get(shop)?.get(product.handle.toLowerCase()) ?? null
  }
}
