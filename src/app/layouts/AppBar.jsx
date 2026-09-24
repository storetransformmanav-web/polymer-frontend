import { Link } from 'react-router-dom'
import { ThemeToggle } from '../../components/ui/ThemeToggle.jsx'
import './AppBar.css'

/**
 * Top application bar. Shared chrome for every authenticated page —
 * add global actions (search, notifications, account menu) here, not
 * inside individual feature pages.
 */
export function AppBar() {
  return (
    <header className="app-bar">
      <span className="app-bar__brand">Polymer CRM</span>
      <div className="app-bar__actions">
        <ThemeToggle />
        {/* Placeholder until an `auth` feature exists to back this. */}
        <Link className="app-bar__account" to="/login">
          Sign out
        </Link>
      </div>
    </header>
  )
}
