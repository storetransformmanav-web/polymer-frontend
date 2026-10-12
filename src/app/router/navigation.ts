import type { ComponentType } from 'react'
import {
  DashboardIcon,
  InventoryIcon,
  OrdersIcon,
  ProductsIcon,
  UsersIcon,
  type IconProps,
} from '../../components/ui/icons.tsx'

export interface NavItem {
  to: string
  label: string
  icon: ComponentType<IconProps>
  /** Matches react-router's `end` prop — exact match required. */
  end?: boolean
}

/**
 * Single source of truth for the app's top-level authenticated routes.
 * The Navbar renders these as links; the AppBar uses the active one's
 * `label` as the page heading. Add an entry here for every new
 * top-level route rather than editing Navbar/AppBar separately.
 */
export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: DashboardIcon, end: true },
  { to: '/orders', label: 'Orders', icon: OrdersIcon },
  { to: '/products', label: 'Products', icon: ProductsIcon },
  { to: '/customers', label: 'Customers', icon: UsersIcon },
  { to: '/inventory', label: 'Inventory', icon: InventoryIcon },
]
