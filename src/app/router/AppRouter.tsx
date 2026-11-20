import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { AuthLayout } from '../layouts/AuthLayout.tsx'
import { DashboardLayout } from '../layouts/DashboardLayout.tsx'
import { ActivityPage } from '../../features/activity/index.ts'
import { CollectionsPage } from '../../features/collections/index.ts'
import { CustomersPage } from '../../features/customers/index.ts'
import { DashboardPage } from '../../features/dashboard/index.ts'
import { InventoryPage } from '../../features/inventory/index.ts'
import { InvoicesPage } from '../../features/invoices/index.ts'
import { SageCustomersPage } from '../../features/sageCustomers/index.ts'
import { SageOrdersPage } from '../../features/sageOrders/index.ts'
import { SageStockPage } from '../../features/sageStock/index.ts'
import { LoginPage } from '../../features/auth/index.ts'
import { LocksPage } from '../../features/locks/index.ts'
import { OrdersPage } from '../../features/orders/index.ts'
import { ProductsPage } from '../../features/products/index.ts'
import { UsersPage } from '../../features/users/index.ts'
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
          // `*` lets OrdersPage also serve /orders/:number (the details page).
          { path: 'orders/*', element: <OrdersPage /> },
          // `*` lets ProductsPage also serve /products/:id (the details page).
          { path: 'products/*', element: <ProductsPage /> },
          // `*` lets CollectionsPage also serve /collections/new and /collections/:id.
          { path: 'collections/*', element: <CollectionsPage /> },
          // `*` lets CustomersPage also serve /customers/:id (the details page).
          { path: 'customers/*', element: <CustomersPage /> },
          { path: 'inventory/*', element: <InventoryPage /> },
          // `*` lets UsersPage also serve /users/new (the Add user form).
          { path: 'users/*', element: <UsersPage /> },
          // `*` lets LocksPage also serve /locks/new (Add lock) and /locks/:handle (one lock).
          { path: 'locks/*', element: <LocksPage /> },
          // `*` lets ActivityPage also serve /activity/:id (one entry's details).
          { path: 'activity/*', element: <ActivityPage /> },
          // Sage 50 → Invoices (a group in the sidebar; more Sage pages can sit beside it). `*` lets
          // InvoicesPage also serve /sage/invoices/<number> and /sage/invoices/customer/<ref>.
          { path: 'sage/invoices/*', element: <InvoicesPage /> },
          // Sage 50 → Customers; `*` lets SageCustomersPage also serve /sage/customers/<account ref>.
          { path: 'sage/customers/*', element: <SageCustomersPage /> },
          // Sage 50 → Orders (the sales orders list; the API has no call for one order). `*` lets
          // SageOrdersPage also serve /sage/orders/customer/<account ref>, a customer opened as a tab.
          { path: 'sage/orders/*', element: <SageOrdersPage /> },
          // Sage 50 → Stock (the stock items list; the API has no call for one item).
          { path: 'sage/stock', element: <SageStockPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
