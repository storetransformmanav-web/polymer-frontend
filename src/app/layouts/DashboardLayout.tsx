import { Outlet } from 'react-router-dom'
import { usePrefetchCustomers } from '../../features/customers/index.ts'
import { usePrefetchOrders } from '../../features/orders/index.ts'
import { usePrefetchProducts } from '../../features/products/index.ts'
import { useSessionGuard } from '../../hooks/useSessionGuard.ts'
import { AppBar } from './AppBar.tsx'
import { Navbar } from './Navbar.tsx'

/**
 * Shell for authenticated pages: a full-height Navbar on the left, and
 * a main column with the AppBar on top and the active route rendered
 * via <Outlet /> below it. Pages should not re-implement this chrome
 * themselves.
 */
export function DashboardLayout() {
  // Warm the list caches as soon as the user is signed in, so those pages
  // open with their data already loaded.
  usePrefetchProducts()
  usePrefetchCustomers()
  usePrefetchOrders()
  // Idle timeout, token expiry and cross-tab logout for the signed-in session.
  useSessionGuard()

  return (
    <div className="bg-bg flex min-h-svh">
      <Navbar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppBar />
        <main className="bg-surface flex-1 px-3 pt-4 pb-10 sm:px-6 sm:pt-6 lg:px-8 lg:pt-7">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
