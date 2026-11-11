import { Navigate, Outlet } from 'react-router-dom'
import { useCanOpen, useIsOffice } from '../../hooks/useAccess.ts'
import { setStoreTimeZone } from '../../lib/storeTime.ts'
import { useAppSelector } from '../store/hooks.ts'
import { ALL_SHOPS, shopValue } from '../store/shopSlice.ts'
import { SHOPIFY_HOME } from '../router/navigation.ts'
import { useSessionGuard } from '../../hooks/useSessionGuard.ts'
import { AppBar } from './AppBar.tsx'
import { Navbar } from './Navbar.tsx'
import { NoAccessPage } from './NoAccessPage.tsx'
import { useActiveNavItem } from './useActiveNavItem.ts'

/**
 * Shell for authenticated pages: a full-height Navbar on the left, and
 * a main column with the AppBar on top and the active route rendered
 * via <Outlet /> below it. Pages should not re-implement this chrome
 * themselves. A page marked `fillHeight` in navigation.ts (Orders, Products) gets the whole window
 * height from `lg` up: the layout stops scrolling and the page lays out its own list.
 */
export function DashboardLayout() {
  // Nothing is loaded here: each page asks for what it needs when it opens (the sidebar
  // warms a page's data when the pointer reaches its link — see Navbar).
  // Idle timeout, token expiry and cross-tab logout for the signed-in session.
  useSessionGuard()
  const activeItem = useActiveNavItem()
  const fill = activeItem?.fillHeight === true
  // Opened from an old link or a bookmark: the sidebar hides the page, this stops the address.
  const canView = useCanOpen(activeItem)
  const isOffice = useIsOffice()

  // Times are shown in the store's time zone (from `GET /shops`, `items[].timezone`): the chosen
  // store's, else the first store that has one, else Europe/London. It is set while rendering so
  // every page below formats with it from its first paint; if it changes (the stores just
  // loaded, another store picked) the page below is rebuilt once so every time is redone.
  const shops = useAppSelector((state) => state.shop.items)
  const selectedShop = useAppSelector((state) => state.shop.selected)
  const chosen =
    selectedShop === ALL_SHOPS
      ? undefined
      : shops.find((shop) => shopValue(shop) === selectedShop)
  const timeZone = setStoreTimeZone(
    chosen?.timezone ?? shops.find((shop) => shop.timezone)?.timezone,
  )

  // The "office" role has only the Shopify Management pages: anywhere else (the dashboard after
  // sign-in, an old bookmark) goes to Orders.
  if (isOffice && !canView && activeItem?.to !== SHOPIFY_HOME)
    return <Navigate to={SHOPIFY_HOME} replace />

  // `relative` + `overflow-clip`: a visually hidden helper (`sr-only`, absolutely positioned)
  // deep inside a page's own scroll box would otherwise be placed against the window and
  // stretch the document, so the window scrolled on past the app into empty space.
  return (
    <div
      className={`bg-bg relative flex min-h-svh ${fill ? 'lg:h-svh lg:min-h-0 lg:overflow-clip' : ''}`}
    >
      <Navbar />
      <div className={`flex min-w-0 flex-1 flex-col ${fill ? 'lg:min-h-0' : ''}`}>
        <AppBar />
        <main
          className={`bg-page flex-1 px-3 pt-4 pb-10 sm:px-6 sm:pt-6 lg:px-8 lg:pt-7 ${
            fill ? 'lg:flex lg:min-h-0 lg:flex-col lg:overflow-clip lg:pb-6' : ''
          }`}
        >
          {canView ? <Outlet key={timeZone} /> : <NoAccessPage />}
        </main>
      </div>
    </div>
  )
}
