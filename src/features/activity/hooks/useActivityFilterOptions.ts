import { useQuery } from '@tanstack/react-query'
import { activityRolesOptions, activityUsersOptions } from './activityQueries.ts'

/**
 * The choices for the dropdowns of the Filters grid: the users (name and id) and the roles.
 *
 * Nothing is requested until `enabled`: the page opens with just its list, and the choices
 * are fetched when the Filters grid is opened.
 */
export function useActivityFilterOptions(enabled = true) {
  const users = useQuery({ ...activityUsersOptions(), enabled })
  const roles = useQuery({ ...activityRolesOptions(), enabled })
  return {
    users: users.data?.items ?? [],
    roles: roles.data ?? [],
  }
}
