import { useLocation, matchPath } from 'react-router-dom'
import { ThemeToggle } from '../../components/ui/ThemeToggle.jsx'
import { NAV_ITEMS } from '../router/navigation.js'
import { UserMenu } from './UserMenu.jsx'
import './AppBar.css'

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
    <header className="app-bar">
      <span className="app-bar__title">{activeItem?.label ?? ''}</span>
      <div className="app-bar__actions">
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  )
}
