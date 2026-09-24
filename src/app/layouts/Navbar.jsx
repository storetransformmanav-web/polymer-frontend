import { NavLink } from 'react-router-dom'
import './Navbar.css'

// Add an entry here for every new top-level authenticated route.
const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/orders', label: 'Orders' },
  { to: '/products', label: 'Products' },
  { to: '/inventory', label: 'Inventory' },
]

/**
 * Primary left-hand navigation for authenticated pages.
 */
export function Navbar() {
  return (
    <nav className="navbar">
      <ul className="navbar__list">
        {NAV_ITEMS.map(({ to, label, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `navbar__link${isActive ? ' navbar__link--active' : ''}`
              }
            >
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
