import { Outlet } from 'react-router-dom'
import { useSessionGuard } from '../../hooks/useSessionGuard.ts'
import { AppBar } from './AppBar.tsx'
import { Navbar } from './Navbar.tsx'
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
  const fill = useActiveNavItem()?.fillHeight === true

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
          <Outlet />
        </main>
      </div>
    </div>
  )
}
