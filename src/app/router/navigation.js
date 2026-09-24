import {
  DashboardIcon,
  InventoryIcon,
  OrdersIcon,
  ProductsIcon,
} from '../../components/ui/icons.jsx'

/**
 * Single source of truth for the app's top-level authenticated routes.
 * The Navbar renders these as links; the AppBar uses the active one's
 * `label` as the page heading. Add an entry here for every new
 * top-level route rather than editing Navbar/AppBar separately.
 */
export const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: DashboardIcon, end: true },
  { to: '/orders', label: 'Orders', icon: OrdersIcon },
  { to: '/products', label: 'Products', icon: ProductsIcon },
  { to: '/inventory', label: 'Inventory', icon: InventoryIcon },
]
