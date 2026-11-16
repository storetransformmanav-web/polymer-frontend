import { useQueries } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useAccess } from '../../../hooks/useAccess.ts'
import { api } from '../../../lib/api/endpoints.ts'

/** The API's largest page of locks. */
const PAGE_SIZE = 100
/** A safety stop: 20 pages is 2,000 locks. */
const MAX_PAGES = 20
const FIVE_MINUTES = 5 * 60_000

/** The handles (lower case) of every locked product of one store, from `GET /access/locks`. */
async function loadLockedHandles(shop: string): Promise<string[]> {
  const handles: string[] = []
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const answer = await api.access.locks({ shop, page, page_size: PAGE_SIZE })
    for (const lock of answer.locks) {
      if (lock.handle) handles.push(lock.handle.toLowerCase())
    }
    if (!answer.has_next) break
  }
  return handles
}

interface ProductRef {
  handle: string
  shop?: { key?: string | null } | null
}

/**
 * Which of the products on screen are locked — for the small lock icon beside a name in the
 * products list. The list answer says nothing about locks, so the locks of each store shown are
 * read once from `GET /access/locks` (every page, cached five minutes under `['locks', …]`, so any
 * lock write — Add lock, Delete lock — refreshes it) and a product is locked when its handle is
 * among them. Only stores that have a product on screen are asked, and nothing is asked for a
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
      queryKey: ['locks', 'locked-handles', shop],
      queryFn: () => loadLockedHandles(shop),
      enabled: enabled && canView,
      staleTime: FIVE_MINUTES,
      retry: false,
      // The list is the page's real content: re-reading on focus would only add requests.
      refetchOnWindowFocus: false,
    })),
  })

  const stamp = results.map((result) => result.dataUpdatedAt).join('|')
  const locked = useMemo(() => {
    const byShop = new Map<string, Set<string>>()
    shops.forEach((shop, index) => {
      byShop.set(shop, new Set(results[index]?.data ?? []))
    })
    return byShop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shops, stamp])

  return (product: ProductRef): boolean => {
    const shop = product.shop?.key ?? ''
    return Boolean(
      shop && product.handle && locked.get(shop)?.has(product.handle.toLowerCase()),
    )
  }
}
