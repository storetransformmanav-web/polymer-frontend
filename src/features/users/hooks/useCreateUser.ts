import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toUserMessage } from '../../../lib/api/ApiError.ts'
import { api, type UserCreateBody } from '../../../lib/api/endpoints.ts'

/**
 * Creates a user. On success every cached Users query is marked stale, so the
 * list (and its paging) refetches and shows the new person. A write is never
 * retried automatically — see lib/api/client.ts.
 */
export function useCreateUser() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (body: UserCreateBody) => api.users.create(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  })

  return {
    create: mutation.mutateAsync,
    isCreating: mutation.isPending,
    error: mutation.isError ? toUserMessage(mutation.error) : null,
    clearError: mutation.reset,
  }
}
