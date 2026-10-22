import { matchPath, useLocation } from 'react-router-dom'
import { NAV_ITEMS, type NavItem } from '../router/navigation.ts'

/** The sidebar entry whose page is open (undefined on a page that has none). */
export function useActiveNavItem(): NavItem | undefined {
  const { pathname } = useLocation()
  return NAV_ITEMS.find((item) =>
    matchPath({ path: item.to, end: item.end ?? false }, pathname),
  )
}
