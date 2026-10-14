import { useLocation, matchPath } from 'react-router-dom'
import { useShops } from '../../hooks/useShops.ts'
import { NAV_ITEMS } from '../router/navigation.ts'
import { ShopSwitcher } from './ShopSwitcher.tsx'
import { UserMenu } from './UserMenu.tsx'

/**
 * Top application bar: shows the active section's label (derived from
 * the shared NAV_ITEMS, so it never drifts from the Navbar), the store
 * dropdown on pages that can be scoped to one store, plus global actions.
 * Add cross-page actions here, not in feature pages.
 */
export function AppBar() {
  const { pathname } = useLocation()
  const activeItem = NAV_ITEMS.find((item) =>
    matchPath({ path: item.to, end: item.end ?? false }, pathname),
  )
  // Loaded here (the bar is always mounted) so the list is ready when a page needs it.
  const shops = useShops()

  return (
    <header className="border-border bg-bg sticky top-0 z-10 flex h-16 items-center justify-between gap-3 border-b px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        <span className="text-text-muted shrink-0 text-xs font-bold tracking-wider uppercase">
          {activeItem?.label ?? ''}
        </span>
        {activeItem?.shopScoped && (
          <>
            <span aria-hidden="true" className="bg-border h-5 w-px shrink-0" />
            <ShopSwitcher
              shops={shops.shops}
              status={shops.status}
              selected={shops.selected}
              onSelect={shops.select}
            />
          </>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <UserMenu />
      </div>
    </header>
  )
}
