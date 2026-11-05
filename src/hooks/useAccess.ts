import { useMemo } from 'react'
import { useAppSelector } from '../app/store/hooks.ts'
import {
  NAV_ENTRIES,
  isNavGroup,
  type NavEntry,
  type NavItem,
} from '../app/router/navigation.ts'
import type { AuthUser } from '../lib/api/endpoints.ts'

type Permissions = AuthUser['permissions']

const mayView = (permissions: Permissions, area?: string) =>
  !area || permissions?.[area]?.view !== false

/**
 * The sidebar for these permissions: a page the user may not view is left out, and so is a group
 * with no page left. Only an explicit `view: false` hides anything.
 */
export function visibleNavEntries(
  permissions: Permissions,
  entries: NavEntry[] = NAV_ENTRIES,
): NavEntry[] {
  return entries.flatMap((entry): NavEntry[] => {
    if (!isNavGroup(entry)) return mayView(permissions, entry.area) ? [entry] : []
    const items = entry.items.filter((item: NavItem) => mayView(permissions, item.area))
    return items.length > 0 ? [{ ...entry, items }] : []
  })
}

const usePermissions = () =>
  useAppSelector((state) => state.auth.session?.user.permissions)

export function useVisibleNavEntries(): NavEntry[] {
  const permissions = usePermissions()
  return useMemo(() => visibleNavEntries(permissions), [permissions])
}

/**
 * What the signed-in user may do in an area of the app, from `user.permissions`. **This only tidies
 * the screen — it is not the protection**: the stored session can be edited in the browser, so the
 * backend must refuse what isn't allowed. That is also why an area the answer doesn't name (or a
 * session without permissions) stays allowed: the backend's answer then decides.
 */
export function useAccess(area?: string): { canView: boolean; canManage: boolean } {
  const permissions = usePermissions()
  return {
    canView: mayView(permissions, area),
    canManage: !area || permissions?.[area]?.manage !== false,
  }
}
