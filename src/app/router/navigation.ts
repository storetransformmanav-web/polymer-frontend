import type { ComponentType } from 'react'
import {
  DashboardIcon,
  InventoryIcon,
  OrdersIcon,
  ProductsIcon,
  StoreIcon,
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

/** A sidebar accordion: a heading that opens to reveal its own links. */
export interface NavGroup {
  label: string
  icon: ComponentType<IconProps>
  items: NavItem[]
}

export type NavEntry = NavItem | NavGroup

export function isNavGroup(entry: NavEntry): entry is NavGroup {
  return 'items' in entry
}

/**
 * What the sidebar renders, in order: plain links and accordion groups.
 * Add an entry here for every new top-level route rather than editing
 * Navbar/AppBar separately.
 */
export const NAV_ENTRIES: NavEntry[] = [
  { to: '/', label: 'Dashboard', icon: DashboardIcon, end: true },
  {
    label: 'Shopify Management',
    icon: StoreIcon,
    items: [
      { to: '/orders', label: 'Orders', icon: OrdersIcon },
      { to: '/products', label: 'Products', icon: ProductsIcon },
      { to: '/customers', label: 'Customers', icon: UsersIcon },
      { to: '/inventory', label: 'Inventory', icon: InventoryIcon },
    ],
  },
]

/**
 * Every routable link, flattened out of the groups. The AppBar uses the
 * active one's `label` as the page heading.
 */
export const NAV_ITEMS: NavItem[] = NAV_ENTRIES.flatMap((entry) =>
  isNavGroup(entry) ? entry.items : [entry],
)
