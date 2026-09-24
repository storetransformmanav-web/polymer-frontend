import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { RootLayout } from '../layouts/RootLayout.jsx'
import { DashboardPage } from '../../features/dashboard/index.js'
import { NotFoundPage } from './NotFoundPage.jsx'

/**
 * Central route table. Add one entry per top-level route here and point
 * it at a feature's page component — keep route *logic* inside the
 * feature, not in this file.
 *
 * When auth is introduced, wrap protected routes with a `ProtectedRoute`
 * element here rather than scattering auth checks across pages.
 */
const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <NotFoundPage />,
    children: [{ index: true, element: <DashboardPage /> }],
  },
  { path: '*', element: <NotFoundPage /> },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
