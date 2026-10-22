import type { ComponentType } from 'react'
import {
  ActivityIcon,
  DashboardIcon,
  InventoryIcon,
  OrdersIcon,
  ProductsIcon,
  StoreIcon,
  UserCogIcon,
  UsersIcon,
  type IconProps,
} from '../../components/ui/icons.tsx'

export interface NavItem {
  to: string
  label: string
  icon: ComponentType<IconProps>
  /** Matches react-router's `end` prop — exact match required. */
  end?: boolean
  /**
   * The page honours the top-bar store dropdown (it sends the API's `shop`
   * filter). Only set this for pages that do — the dropdown is hidden elsewhere.
   */
  shopScoped?: boolean
  /** The top bar shows this page's "Sync" button (it re-imports the page's data from Shopify). */
  syncs?: 'products'
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
      { to: '/orders', label: 'Orders', icon: OrdersIcon, shopScoped: true },
      {
        to: '/products',
        label: 'Products',
        icon: ProductsIcon,
        shopScoped: true,
        syncs: 'products',
      },
      { to: '/customers', label: 'Customers', icon: UsersIcon, shopScoped: true },
      { to: '/inventory', label: 'Inventory', icon: InventoryIcon },
    ],
  },
  { to: '/users', label: 'User Management', icon: UserCogIcon },
  { to: '/activity', label: 'Activity Management', icon: ActivityIcon },
]

/**
 * Every routable link, flattened out of the groups. The AppBar uses the
 * active one's `label` as the page heading.
 */
export const NAV_ITEMS: NavItem[] = NAV_ENTRIES.flatMap((entry) =>
  isNavGroup(entry) ? entry.items : [entry],
)
