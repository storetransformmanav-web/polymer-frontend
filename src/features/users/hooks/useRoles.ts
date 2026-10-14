import { useQuery } from '@tanstack/react-query'
import { toUserMessage } from '../../../lib/api/ApiError.ts'
import { api } from '../../../lib/api/endpoints.ts'

/**
 * The roles a user can have (their names feed the role filter and the create
 * form). They change rarely, so they're kept for five minutes.
 */
export function useRoles() {
  const query = useQuery({
    queryKey: ['roles'],
    queryFn: api.roles.list,
    staleTime: 5 * 60_000,
  })

  return {
    roles: query.data ?? [],
    isPending: query.isPending,
    error: query.isError ? toUserMessage(query.error) : null,
    retry: () => void query.refetch(),
  }
}
