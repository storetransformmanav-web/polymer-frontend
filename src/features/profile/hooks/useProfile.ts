import { useQuery } from '@tanstack/react-query'
import { toUserMessage } from '../../../lib/api/ApiError.ts'
import { api } from '../../../lib/api/endpoints.ts'

const STALE_MS = 30_000

/**
 * The signed-in person's own profile (`GET /hr/profile`), from the TanStack cache. Asked for
 * only when the profile page opens; a read older than 30 s is refreshed quietly behind what is
 * on screen.
 */
export function useProfile() {
  const query = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.hr.profile(),
    staleTime: STALE_MS,
  })

  return {
    profile: query.data ?? null,
    isPending: query.isPending,
    isRefreshing: query.isFetching && Boolean(query.data),
    error: query.isError && !query.data ? toUserMessage(query.error) : null,
    retry: () => void query.refetch(),
  }
}
