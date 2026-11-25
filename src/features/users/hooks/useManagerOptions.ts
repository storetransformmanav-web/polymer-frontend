import { useQuery } from '@tanstack/react-query'
import { toUserMessage } from '../../../lib/api/ApiError.ts'
import { api } from '../../../lib/api/endpoints.ts'

/**
 * The people a new user can be given as their manager (`GET /users?page_size=100&status=active`,
 * name and id). Asked for only when the dropdown is on screen (`enabled`), cached for a minute.
 */
export function useManagerOptions(enabled: boolean) {
  const query = useQuery({
    queryKey: ['users', 'manager-options'],
    queryFn: () => api.users.list({ page_size: 100, status: 'active' }),
    enabled,
    staleTime: 60_000,
  })

  return {
    managers: (query.data?.items ?? []).map((user) => ({
      id: user.id,
      label: user.full_name || user.email,
    })),
    isLoading: enabled && query.isPending,
    error: query.isError ? toUserMessage(query.error) : null,
  }
}
