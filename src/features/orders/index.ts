// Public surface of the `orders` feature. Other code should only
// import from this file, never reach into `orders/pages/...` directly.
export { OrdersPage } from './pages/OrdersPage.tsx'
export { usePrefetchOrders } from './hooks/usePrefetchOrders.ts'
