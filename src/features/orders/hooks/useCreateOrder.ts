import { useMutation } from '@tanstack/react-query'
import { toUserMessage } from '../../../lib/api/ApiError.ts'
import { api, type OrderCreateBody } from '../../../lib/api/endpoints.ts'
import { useRefreshOrderList } from './useRefreshOrderList.ts'

/**
 * Creates an order (`POST /orders`). Never retried — a repeat would make the order twice. Once
 * the store has it, the orders list (and the fulfillment counts already on hand) are re-read
 * quietly, so it shows up with no reload. A refusal is the backend's own message.
 */
export function useCreateOrder() {
  const refreshList = useRefreshOrderList()
  const mutation = useMutation({
    mutationFn: (body: OrderCreateBody) => api.orders.create(body),
    retry: false,
    onSuccess: () => refreshList(true),
  })

  return {
    create: mutation.mutateAsync,
    isCreating: mutation.isPending,
    error: mutation.isError ? toUserMessage(mutation.error) : null,
    clearError: mutation.reset,
  }
}
