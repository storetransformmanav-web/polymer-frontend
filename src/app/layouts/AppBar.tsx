import { AppBarSlot, RefreshSlot } from '../../components/ui/AppBarSlot.tsx'
import { InfoIcon } from '../../components/ui/icons.tsx'
import { SyncCollectionsButton } from '../../features/collections/index.ts'
import { SyncCustomersButton } from '../../features/customers/index.ts'
import { SyncInventoryButton } from '../../features/inventory/index.ts'
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

const ORDERS_DATA_NOTE = 'Order data from 23 July 2026 onward.'
const ORDERS_DATA_NOTE_DETAIL =
  'We are displaying order data from 23 July 2026 onward. Orders created before this date are not included in the listing.'

/**
 * Beside the store dropdown on the Orders page: a soft green pill with an (i), a bold "Note:" and a
 * short line saying where the order data starts (the hover text spells it out in full). One line, so it
 * shows from wide screens up.
 */
function OrdersDataNote() {
  return (
    <p
      title={ORDERS_DATA_NOTE_DETAIL}
      className="border-accent/30 bg-accent-tint/60 text-text m-0 hidden min-w-0 shrink items-center gap-2 rounded-lg border px-3 py-1.5 text-[0.85rem] min-[1400px]:flex"
    >
      <InfoIcon width={16} height={16} className="text-accent shrink-0" />
      <span className="truncate">
        <strong className="text-[0.95rem] font-bold">Note:</strong> {ORDERS_DATA_NOTE}
      </span>
    </p>
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
        {activeItem?.to === '/orders' && <OrdersDataNote />}
      </div>
      <div className="flex min-w-0 shrink-0 items-center gap-3">
        <StoreClock />
        <RefreshSlot />
        <AppBarSlot />
        {canSync && activeItem?.syncs === 'orders' && <SyncOrdersButton />}
        {canSync && activeItem?.syncs === 'products' && <SyncProductsButton />}
        {canSync && activeItem?.syncs === 'customers' && <SyncCustomersButton />}
        {canSync && activeItem?.syncs === 'collections' && <SyncCollectionsButton />}
        {canSync && activeItem?.syncs === 'inventory' && <SyncInventoryButton />}
        <UserMenu />
      </div>
    </header>
  )
}
