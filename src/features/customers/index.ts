// Public surface of the `customers` feature. Other code should only
// import from this file, never reach into `customers/pages/...` directly.
export { CustomersPage } from './pages/CustomersPage.tsx'
export { usePrefetchCustomers } from './hooks/usePrefetchCustomers.ts'
