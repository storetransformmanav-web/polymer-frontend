import { Outlet } from 'react-router-dom'
import { AppBar } from './AppBar.tsx'
import { Navbar } from './Navbar.tsx'
import './DashboardLayout.css'

/**
 * Shell for authenticated pages: a full-height Navbar on the left, and
 * a main column with the AppBar on top and the active route rendered
 * via <Outlet /> below it. Pages should not re-implement this chrome
 * themselves.
 */
export function DashboardLayout() {
  return (
    <div className="dashboard-layout">
      <Navbar />
      <div className="dashboard-layout__main">
        <AppBar />
        <main className="dashboard-layout__content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
