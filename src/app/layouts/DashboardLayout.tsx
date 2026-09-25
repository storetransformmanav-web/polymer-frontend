import { Outlet } from 'react-router-dom'
import { AppBar } from './AppBar.tsx'
import { Navbar } from './Navbar.tsx'

/**
 * Shell for authenticated pages: a full-height Navbar on the left, and
 * a main column with the AppBar on top and the active route rendered
 * via <Outlet /> below it. Pages should not re-implement this chrome
 * themselves.
 */
export function DashboardLayout() {
  return (
    <div className="bg-bg flex min-h-svh">
      <Navbar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppBar />
        <main className="bg-surface flex-1 px-8 pt-7 pb-12">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
