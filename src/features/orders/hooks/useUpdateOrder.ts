import { useMutation } from '@tanstack/react-query'
import { useAppDispatch } from '../../../app/store/hooks.ts'
import { fetchOrderDetails } from '../../../app/store/ordersSlice.ts'
import { toUserMessage } from '../../../lib/api/ApiError.ts'
import { api, type OrderUpdateBody } from '../../../lib/api/endpoints.ts'
import { useRefreshOrderList } from './useRefreshOrderList.ts'

/**
 * Updates an order (`PATCH /orders/{ref}`). Never retried — a repeat could add a product twice.
 * Nothing on screen is changed from what was typed: once the backend has confirmed, the order and
 * the list are read again, so what shows is what the API answers. A refusal is its own message.
 */
export function useUpdateOrder(ref: string, shop: string | null) {
  const dispatch = useAppDispatch()
  const refreshList = useRefreshOrderList()
  const mutation = useMutation({
    mutationFn: (body: OrderUpdateBody) => api.orders.update(ref, body, shop),
    retry: false,
    onSuccess: () => {
      void dispatch(fetchOrderDetails({ ref, shop, force: true }))
      refreshList(true)
    },
  })

  return {
    update: mutation.mutateAsync,
    isUpdating: mutation.isPending,
    error: mutation.isError ? toUserMessage(mutation.error) : null,
    clearError: mutation.reset,
  }
}
