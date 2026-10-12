import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { AuthLayout } from '../layouts/AuthLayout.tsx'
import { DashboardLayout } from '../layouts/DashboardLayout.tsx'
import { CustomersPage } from '../../features/customers/index.ts'
import { DashboardPage } from '../../features/dashboard/index.ts'
import { InventoryPage } from '../../features/inventory/index.ts'
import { LoginPage } from '../../features/auth/index.ts'
import { OrdersPage } from '../../features/orders/index.ts'
import { ProductsPage } from '../../features/products/index.ts'
import { NotFoundPage } from './NotFoundPage.tsx'
import { RouteErrorPage } from './RouteErrorPage.tsx'
import { ProtectedRoute } from './ProtectedRoute.tsx'

/**
 * Central route table. Add one entry per top-level route here and point
 * it at a feature's page component — keep route *logic* inside the
 * feature, not in this file. Signed-in pages live under `ProtectedRoute`.
 */
const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    errorElement: <RouteErrorPage />,
    children: [{ path: '/login', element: <LoginPage /> }],
  },
  {
    element: <ProtectedRoute />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        path: '/',
        element: <DashboardLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'orders', element: <OrdersPage /> },
          // `*` lets ProductsPage also serve /products/:id (the details page).
          { path: 'products/*', element: <ProductsPage /> },
          // `*` lets CustomersPage also serve /customers/:id (the details page).
          { path: 'customers/*', element: <CustomersPage /> },
          { path: 'inventory', element: <InventoryPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
