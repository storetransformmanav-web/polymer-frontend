import { useMemo } from 'react'
import { useAppSelector } from '../app/store/hooks.ts'
import {
  NAV_ENTRIES,
  SHOPIFY_PATHS,
  isNavGroup,
  type NavEntry,
  type NavItem,
} from '../app/router/navigation.ts'
import type { AuthUser } from '../lib/api/endpoints.ts'

type Permissions = AuthUser['permissions']

const mayView = (permissions: Permissions, area?: string) =>
  !area || permissions?.[area]?.view !== false

/** The role that only sees the Shopify Management pages (Orders, Products, Customers, Inventory, Lock Management). */
const OFFICE_ROLE = 'office'

/** True for the "office" role, whatever the backend's letter case. */
export const isOfficeRole = (role?: string | null) =>
  role?.trim().toLowerCase() === OFFICE_ROLE

/** The "office" role may open only the Shopify Management pages; any other role is not limited by role. */
const roleAllows = (role: string | null | undefined, item: NavItem) =>
  !isOfficeRole(role) || SHOPIFY_PATHS.has(item.to)

/**
 * The sidebar for these permissions: a page the user may not view is left out, and so is a group
 * with no page left. Only an explicit `view: false` hides anything. The "office" role sees only the
 * Shopify Management group.
 */
export function visibleNavEntries(
  permissions: Permissions,
  entries: NavEntry[] = NAV_ENTRIES,
  role?: string | null,
): NavEntry[] {
  return entries.flatMap((entry): NavEntry[] => {
    if (!isNavGroup(entry)) {
      return roleAllows(role, entry) && mayView(permissions, entry.area) ? [entry] : []
    }
    const items = entry.items.filter(
      (item: NavItem) => roleAllows(role, item) && mayView(permissions, item.area),
    )
    return items.length > 0 ? [{ ...entry, items }] : []
  })
}

const usePermissions = () =>
  useAppSelector((state) => state.auth.session?.user.permissions)

const useRole = () => useAppSelector((state) => state.auth.session?.user.role)

export function useVisibleNavEntries(): NavEntry[] {
  const permissions = usePermissions()
  const role = useRole()
  return useMemo(
    () => visibleNavEntries(permissions, NAV_ENTRIES, role),
    [permissions, role],
  )
}

/**
 * Whether the signed-in user may open this page: not hidden by their role ("office" has only the
 * Shopify Management pages) and not `view: false` in their permissions. Like everything here it only
 * tidies the screen — the backend is the protection.
 */
export function useCanOpen(item?: NavItem): boolean {
  const permissions = usePermissions()
  const role = useRole()
  if (!item) return true
  return roleAllows(role, item) && mayView(permissions, item.area)
}

/** True when the signed-in user has the "office" role. */
export function useIsOffice(): boolean {
  return isOfficeRole(useRole())
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
