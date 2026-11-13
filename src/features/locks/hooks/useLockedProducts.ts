import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api, type AccessLock, type LockCustomer } from '../../../lib/api/endpoints.ts'
import { MAX_ITEMS, type PickedItem } from '../utils/lockDraft.ts'
import { customerName } from '../utils/format.ts'

const STALE_MS = 30_000
/** Customers are read this many to a page (the API allows up to 200). */
const CUSTOMER_PAGE_SIZE = 100

/**
 * The locks the store already has among the products the picker is showing: the locks whose title
 * or handle matches the same search, by product id. It is how the Add lock form marks a product
 * that is **already locked**. A `lock-picker` query, so every lock write refreshes it; asked for
 * with the picker, 100 locks at most (a product beyond them is still found when it is ticked —
 * see `findLockOfProduct`).
 */
export function useLockedProducts(shop: string, search: string) {
  const text = search.trim()
  const query = useQuery({
    queryKey: ['lock-picker', 'locked-products', shop, text],
    enabled: shop !== '',
    staleTime: STALE_MS,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const answer = await api.access.locks({
        shop,
        ...(text ? { search: text } : {}),
        sort: 'title',
        page_size: 100,
      })
      return new Map(answer.locks.map((lock) => [lock.product_id, lock]))
    },
  })
  return query.data ?? new Map<string, AccessLock>()
}

/** The lock of one product (matched by id; the search matches its handle or title), or none. */
export async function findLockOfProduct(
  shop: string,
  product: { id: string; handle?: string | null; title?: string },
): Promise<AccessLock | null> {
  const search = (product.handle || product.title || '').trim()
  if (!search) return null
  const answer = await api.access.locks({ shop, search, sort: 'title', page_size: 25 })
  return answer.locks.find((lock) => lock.product_id === product.id) ?? null
}

/** A customer of a lock as the form keeps a ticked customer. */
const toPickedCustomer = (customer: LockCustomer): PickedItem => ({
  id: customer.id,
  label: customerName(customer),
  sub: customer.email,
})

/**
 * The customers who can see a locked product (`GET /access/locks/{product}/customers`), as ticked
 * customers: at most `limit` of them, `total` being how many there are in all. A login-only lock
 * (no keys) lists every customer with an account, so it gives none: there is nobody in particular
 * to pre-select.
 */
export async function loadLockCustomers(
  shop: string,
  lock: AccessLock,
  limit: number = MAX_ITEMS,
): Promise<{ items: PickedItem[]; total: number }> {
  if (lock.tags.length === 0 || limit <= 0) return { items: [], total: 0 }
  const items: PickedItem[] = []
  let total = 0
  for (let page = 1; items.length < limit; page += 1) {
    const answer = await api.access.lockCustomers(lock.handle ?? lock.product_id, {
      shop,
      sort: 'name',
      page,
      page_size: CUSTOMER_PAGE_SIZE,
    })
    total = answer.total
    items.push(...answer.customers.map(toPickedCustomer).filter((item) => item.id))
    if (page >= answer.total_pages || answer.customers.length === 0) break
  }
  return { items: items.slice(0, limit), total }
}
