import { AppBarSlot } from '../../components/ui/AppBarSlot.tsx'
import { SyncCustomersButton } from '../../features/customers/index.ts'
import { SyncOrdersButton } from '../../features/orders/index.ts'
import { SyncProductsButton } from '../../features/products/index.ts'
import { useAccess } from '../../hooks/useAccess.ts'
import { useShops } from '../../hooks/useShops.ts'
import { ShopSwitcher } from './ShopSwitcher.tsx'
import { useActiveNavItem } from './useActiveNavItem.ts'
import { StoreClock } from './StoreClock.tsx'
import { UserMenu } from './UserMenu.tsx'

/**
 * The store dropdown. Its own component so the store list (`GET /shops`) is only requested
 * on a page that shows the dropdown — not on every page the bar is mounted for.
 */
function ShopScope() {
  const shops = useShops()
  return (
    <ShopSwitcher
      shops={shops.shops}
      status={shops.status}
      selected={shops.selected}
      onSelect={shops.select}
    />
  )
}

/**
 * Top application bar: shows the active section's label (derived from
 * the shared NAV_ITEMS, so it never drifts from the Navbar), the store
 * dropdown on pages that can be scoped to one store, plus global actions.
 * Add cross-page actions here, not in feature pages.
 */
export function AppBar() {
  const activeItem = useActiveNavItem()
  // The Sync buttons start a re-import from Shopify: they are for those who may use `sync` (the
  // permission the server checks for it), whatever they may do on the page itself.
  const syncAccess = useAccess('sync')
  const canSync = syncAccess.canView && syncAccess.canManage

  return (
    <header className="border-border bg-bg sticky top-0 z-10 flex h-16 items-center justify-between gap-3 border-b px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        <span className="text-text-muted shrink-0 text-xs font-bold tracking-wider uppercase">
          {activeItem?.label ?? ''}
        </span>
        {activeItem?.shopScoped && (
          <>
            <span aria-hidden="true" className="bg-border h-5 w-px shrink-0" />
            <ShopScope />
          </>
        )}
      </div>
      <div className="flex min-w-0 shrink-0 items-center gap-3">
        <StoreClock />
        <AppBarSlot />
        {canSync && activeItem?.syncs === 'orders' && <SyncOrdersButton />}
        {canSync && activeItem?.syncs === 'products' && <SyncProductsButton />}
        {canSync && activeItem?.syncs === 'customers' && <SyncCustomersButton />}
        <UserMenu />
      </div>
    </header>
  )
}
