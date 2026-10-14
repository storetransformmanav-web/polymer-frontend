import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { ActivityItem } from '../../../lib/api/endpoints.ts'
import { activityActionsOptions, activityUsersOptions } from './activityQueries.ts'

export interface UserOption {
  id: string
  name: string
  email: string | null
}

/**
 * The choices for the "Action" and "User" dropdowns. Actions come from the
 * log itself (with counts); users from the Users list. If the signed-in
 * person can't see the Users list, the dropdown still offers everyone who
 * appears in the rows already loaded, so it never ends up empty.
 */
export function useActivityFilterOptions(visibleItems: ActivityItem[]) {
  const actions = useQuery(activityActionsOptions())
  const users = useQuery(activityUsersOptions())

  const userOptions = useMemo(() => {
    const byId = new Map<string, UserOption>()
    for (const user of users.data?.items ?? []) {
      byId.set(user.id, {
        id: user.id,
        name: user.full_name.trim() || user.email,
        email: user.email,
      })
    }
    for (const item of visibleItems) {
      const user = item.user
      if (user?.id && !byId.has(user.id)) {
        byId.set(user.id, {
          id: user.id,
          name: user.full_name?.trim() || user.email || 'Unknown user',
          email: user.email ?? null,
        })
      }
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [users.data, visibleItems])

  return { actions: actions.data ?? [], users: userOptions }
}
