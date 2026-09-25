import { useLocation, matchPath } from 'react-router-dom'
import { NAV_ITEMS } from '../router/navigation.ts'
import { UserMenu } from './UserMenu.tsx'

/**
 * Top application bar: shows the active section's label (derived from
 * the shared NAV_ITEMS, so it never drifts from the Navbar) plus
 * global actions. Add cross-page actions here, not in feature pages.
 */
export function AppBar() {
  const { pathname } = useLocation()
  const activeItem = NAV_ITEMS.find((item) =>
    matchPath({ path: item.to, end: item.end ?? false }, pathname),
  )

  return (
    <header className="border-border bg-bg sticky top-0 z-10 flex h-16 items-center justify-between border-b px-6">
      <span className="text-text-muted text-xs font-bold tracking-wider uppercase">
        {activeItem?.label ?? ''}
      </span>
      <div className="flex items-center gap-3">
        <UserMenu />
      </div>
    </header>
  )
}
