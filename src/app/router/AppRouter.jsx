import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { AuthLayout } from '../layouts/AuthLayout.jsx'
import { DashboardLayout } from '../layouts/DashboardLayout.jsx'
import { DashboardPage } from '../../features/dashboard/index.js'
import { LoginPage } from '../../features/auth/index.js'
import { NotFoundPage } from './NotFoundPage.jsx'

/**
 * Central route table. Add one entry per top-level route here and point
 * it at a feature's page component — keep route *logic* inside the
 * feature, not in this file.
 *
 * When auth state exists, wrap the `DashboardLayout` routes with a
 * `ProtectedRoute` element here rather than scattering auth checks
 * across pages.
 */
const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    errorElement: <NotFoundPage />,
    children: [{ path: '/login', element: <LoginPage /> }],
  },
  {
    path: '/',
    element: <DashboardLayout />,
    errorElement: <NotFoundPage />,
    children: [{ index: true, element: <DashboardPage /> }],
  },
  { path: '*', element: <NotFoundPage /> },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
