import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAppDispatch } from '../../../app/store/hooks.ts'
import { fetchCustomerDetails } from '../../../app/store/customersSlice.ts'
import { invalidateAccessQueries } from '../../../lib/accessQueries.ts'
import { toUserMessage } from '../../../lib/api/ApiError.ts'
import { api, type AccessLock, type CustomerDetail } from '../../../lib/api/endpoints.ts'

/** The API's largest page of locks, and how many pages are read (1,000 locks) before stopping. */
const PAGE_SIZE = 100
const MAX_PAGES = 10

/**
 * Every locked product of one store (`GET /access/locks`, 100 a page), read once and kept 30 s.
 * The tab works out from it which products the customer can open and which tags are keys, so one
 * read serves both lists and every search. Under `['locks']`, so any access change re-reads it.
 * Asked for when the tab is opened, not before.
 */
export function useStoreLocks(shop: string) {
  const query = useQuery({
    queryKey: ['locks', 'customer-view', shop],
    enabled: shop !== '',
    staleTime: 30_000,
    queryFn: async () => {
      const locks: AccessLock[] = []
      let truncated = false
      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const answer = await api.access.locks({
          shop,
          sort: 'title',
          page,
          page_size: PAGE_SIZE,
        })
        locks.push(...answer.locks)
        if (!answer.has_next) break
        truncated = page === MAX_PAGES
      }
      return { locks, truncated }
    },
  })
  return {
    locks: query.data?.locks ?? [],
    /** More locks exist than were read. */
    truncated: query.data?.truncated ?? false,
    isPending: query.isPending,
    isFetching: query.isFetching,
    error: query.isError && !query.data ? toUserMessage(query.error) : null,
    retry: () => void query.refetch(),
  }
}

/** What the API is sent for a customer: the email, else the id. */
export const customerRef = (customer: CustomerDetail) => customer.email ?? customer.id

/**
 * The two writes of the product list, on the access API (never retried):
 * - **give** — `PUT /access/locks/{product}/customers` `{ add: [customer], tag }` (the tag only
 *   when the lock has several keys, as the API asks);
 * - **remove** — the same call with `{ remove: [customer] }`: it takes away every tag of that
 *   product the customer holds.
 * When the backend confirms, the customer and every access read are fetched again, so the lists
 * show what the store says. A refusal is thrown as the backend's message for the dialog.
 */
export function useCustomerLockWrites(customer: CustomerDetail) {
  const dispatch = useAppDispatch()
  const queryClient = useQueryClient()
  const shop = customer.shop?.key ?? ''
  const ref = customerRef(customer)

  const refresh = async () => {
    void dispatch(fetchCustomerDetails({ id: customer.id, force: true }))
    await invalidateAccessQueries(queryClient)
  }

  const give = useMutation({
    mutationFn: async ({ lock, tag }: { lock: AccessLock; tag: string }) => {
      const result = await api.access.setLockCustomers(lock.handle ?? lock.product_id, {
        shop,
        add: [ref],
        ...(lock.tags.length > 1 ? { tag } : {}),
      })
      return result.message
    },
    onSuccess: refresh,
  })

  const remove = useMutation({
    mutationFn: async ({ lock }: { lock: AccessLock }) => {
      const result = await api.access.setLockCustomers(lock.handle ?? lock.product_id, {
        shop,
        remove: [ref],
      })
      return result.message
    },
    onSuccess: refresh,
  })

  return {
    give: give.mutateAsync,
    remove: remove.mutateAsync,
    isWriting: give.isPending || remove.isPending,
    /** Re-reads the access lists (after a change of the customer's tags). */
    refresh,
  }
}
