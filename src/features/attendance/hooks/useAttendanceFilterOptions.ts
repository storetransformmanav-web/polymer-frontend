import { useQuery } from '@tanstack/react-query'
import { api } from '../../../lib/api/endpoints.ts'

const FIVE_MINUTES = 5 * 60_000

/**
 * The people and roles the Employee and Role dropdowns offer — requested only once the Filters grid
 * has been opened (and only for an administrator), never when the page opens.
 */
export function useAttendanceFilterOptions(enabled: boolean) {
  const users = useQuery({
    queryKey: ['attendance', 'user-options'],
    queryFn: () => api.users.list({ page: 1, page_size: 100 }),
    staleTime: FIVE_MINUTES,
    enabled,
  })
  const roles = useQuery({
    queryKey: ['attendance', 'role-options'],
    queryFn: () => api.roles.list(),
    staleTime: FIVE_MINUTES,
    enabled,
  })
  return { users: users.data?.items ?? [], roles: roles.data ?? [] }
}
