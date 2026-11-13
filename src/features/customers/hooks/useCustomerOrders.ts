import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { toUserMessage } from '../../../lib/api/ApiError.ts'
import { api, type CustomerDetail } from '../../../lib/api/endpoints.ts'

/**
 * One page of this customer's orders, newest first (`GET /orders?customer_id=`), for the Order
 * history. Asked for only while that tab is open (`enabled`) — nothing is read before — and kept
 * 30 s, with the previous page on screen while the next one loads.
 */
export function useCustomerOrderHistory(
  customer: CustomerDetail,
  page: number,
  pageSize: number,
  enabled: boolean,
) {
  const shop = customer.shop?.key ?? undefined
  const query = useQuery({
    queryKey: ['customer-orders', customer.id, shop, page, pageSize],
    queryFn: () =>
      api.orders.list({
        customer_id: customer.id,
        shop,
        sort: 'created_at',
        order: 'desc',
        page,
        page_size: pageSize,
      }),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
  return {
    data: query.data ?? null,
    orders: query.data?.items ?? [],
    isPending: query.isPending && enabled,
    isFetching: query.isFetching,
    error: query.isError && !query.data ? toUserMessage(query.error) : null,
    retry: () => void query.refetch(),
  }
}
