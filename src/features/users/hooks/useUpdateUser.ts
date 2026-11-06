import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toUserMessage } from '../../../lib/api/ApiError.ts'
import {
  api,
  type Role,
  type UserDetail,
  type UserListResponse,
  type UserUpdateBody,
} from '../../../lib/api/endpoints.ts'
import { applyUserBody } from '../utils/userEdit.ts'
import { userDetailsKey } from './useUserDetails.ts'

/**
 * Updates a user (`PUT /users/{user_id}`). The moment the server confirms, the new values go into
 * the cached details and every cached list row (so the page is right with no loader); the
 * answer's own user, when it sends one, replaces the details. The lists and the details are then
 * re-read quietly so what the backend worked out itself (the role's display name, the status
 * counts) is true. A write is never retried automatically — see lib/api/client.ts. A refusal (a
 * duplicate email, say) is returned as the backend's message.
 */
export function useUpdateUser(roles: Role[] = []) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UserUpdateBody }) =>
      api.users.update(id, body),
    onSuccess: (result, { id, body }) => {
      const roleLabel = roles.find((role) => role.name === body.role)?.label ?? null

      queryClient.setQueryData<UserDetail>(userDetailsKey(id), (cached) =>
        result.user
          ? result.user
          : cached
            ? applyUserBody(cached, body, roleLabel)
            : cached,
      )
      queryClient.setQueriesData<UserListResponse>({ queryKey: ['users'] }, (cached) => {
        if (!cached || !Array.isArray(cached.items)) return cached
        if (!cached.items.some((item) => item.id === id)) return cached
        return {
          ...cached,
          items: cached.items.map((item) =>
            item.id === id ? applyUserBody(item, body, roleLabel) : item,
          ),
        }
      })
      void queryClient.invalidateQueries({ queryKey: ['users'] })
      void queryClient.invalidateQueries({ queryKey: userDetailsKey(id) })
    },
  })

  return {
    update: mutation.mutateAsync,
    isUpdating: mutation.isPending,
    error: mutation.isError ? toUserMessage(mutation.error) : null,
    clearError: mutation.reset,
  }
}
