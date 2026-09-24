import { Outlet } from 'react-router-dom'
import { AppBar } from './AppBar.jsx'
import { Navbar } from './Navbar.jsx'
import './DashboardLayout.css'

/**
 * Shell for authenticated pages: an AppBar on top, a Navbar on the
 * side, and the active route rendered via <Outlet /> in between.
 * Pages should not re-implement this chrome themselves.
 */
export function DashboardLayout() {
  return (
    <div className="dashboard-layout">
      <AppBar />
      <div className="dashboard-layout__body">
        <Navbar />
        <main className="dashboard-layout__content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
