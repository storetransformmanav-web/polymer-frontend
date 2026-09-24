import { NavLink } from 'react-router-dom'
import { Logo } from '../../components/ui/Logo.jsx'
import { ChevronsLeftIcon } from '../../components/ui/icons.jsx'
import { useSidebarCollapsed } from '../../hooks/useSidebarCollapsed.js'
import { NAV_ITEMS } from '../router/navigation.js'
import './Navbar.css'

/**
 * Primary left-hand navigation. Collapses to icons-only (persisted via
 * `useSidebarCollapsed`) for a denser layout on smaller screens or by
 * user preference.
 */
export function Navbar() {
  const [collapsed, setCollapsed] = useSidebarCollapsed()

  return (
    <nav className={`navbar${collapsed ? ' navbar--collapsed' : ''}`}>
      <div className="navbar__header">
        {collapsed ? <Logo variant="mark" /> : <Logo />}
        <button
          type="button"
          className="navbar__collapse-toggle"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronsLeftIcon
            className={collapsed ? 'navbar__collapse-icon--flipped' : ''}
          />
        </button>
      </div>

      <ul className="navbar__list">
        {NAV_ITEMS.map(({ to, label, end, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                `navbar__link${isActive ? ' navbar__link--active' : ''}`
              }
            >
              <Icon className="navbar__link-icon" />
              <span className="navbar__link-label">{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
