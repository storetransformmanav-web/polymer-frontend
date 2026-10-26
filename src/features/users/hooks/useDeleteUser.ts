import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toUserMessage } from '../../../lib/api/ApiError.ts'
import { api, type UserListResponse } from '../../../lib/api/endpoints.ts'
import { userDetailsKey } from './useUserDetails.ts'

/**
 * Deletes a user (a soft delete on the server: deactivated and hidden, activity history
 * kept). The moment the server confirms, the person is taken out of every cached page of
 * the list (and the totals corrected), so the row is gone with no loader; the lists are
 * then re-read quietly so the status counts and paging stay true. A write is never retried
 * automatically — see lib/api/client.ts. A refusal is returned as the backend's message.
 */
export function useDeleteUser() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (id: string) => api.users.remove(id),
    onSuccess: (_result, id) => {
      queryClient.setQueriesData<UserListResponse>({ queryKey: ['users'] }, (cached) => {
        if (!cached || !Array.isArray(cached.items)) return cached
        if (!cached.items.some((item) => item.id === id)) return cached
        return {
          ...cached,
          items: cached.items.filter((item) => item.id !== id),
          total: Math.max(0, cached.total - 1),
        }
      })
      // A deleted user's opened details would only answer 404 now.
      queryClient.removeQueries({ queryKey: userDetailsKey(id) })
      void queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })

  return {
    remove: mutation.mutateAsync,
    isDeleting: mutation.isPending,
    error: mutation.isError ? toUserMessage(mutation.error) : null,
    clearError: mutation.reset,
  }
}
