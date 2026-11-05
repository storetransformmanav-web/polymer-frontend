import type { ComponentType } from 'react'
import {
  ActivityIcon,
  DashboardIcon,
  InventoryIcon,
  LockIcon,
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
  /**
   * From `lg` up the page fills the height of the window (the layout stops scrolling as a
   * whole): the page lays itself out in that height and its list scrolls inside its own box.
   */
  fillHeight?: boolean
  /**
   * The name of this page's area in the signed-in user's `permissions`. An area the answer
   * doesn't name is allowed: the backend is what really decides (see `hooks/useAccess.ts`).
   */
  area?: string
  /** A small status note shown beside the link in the sidebar (e.g. "In Progress"). */
  badge?: string
  /** The top bar shows this page's "Sync" button (it re-imports the page's data from Shopify). */
  syncs?: 'products' | 'orders' | 'customers'
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
      {
        to: '/orders',
        label: 'Orders',
        area: 'orders',
        icon: OrdersIcon,
        badge: 'In Progress',
        shopScoped: true,
        fillHeight: true,
        syncs: 'orders',
      },
      {
        to: '/products',
        label: 'Products',
        area: 'products',
        icon: ProductsIcon,
        shopScoped: true,
        fillHeight: true,
        syncs: 'products',
      },
      {
        to: '/customers',
        label: 'Customers',
        area: 'customers',
        icon: UsersIcon,
        shopScoped: true,
        syncs: 'customers',
      },
      {
        to: '/inventory',
        label: 'Inventory',
        area: 'inventory',
        icon: InventoryIcon,
        shopScoped: true,
        fillHeight: true,
      },
      {
        to: '/locks',
        label: 'Lock Management',
        area: 'locks',
        icon: LockIcon,
        shopScoped: true,
        fillHeight: true,
      },
    ],
  },
  { to: '/users', label: 'User Management', icon: UserCogIcon, area: 'users' },
  { to: '/activity', label: 'Activity Management', icon: ActivityIcon, area: 'activity' },
]

/** The paths inside the Shopify Management group — the only pages the "office" role may open. */
export const SHOPIFY_PATHS: ReadonlySet<string> = new Set(
  NAV_ENTRIES.flatMap((entry) =>
    isNavGroup(entry) && entry.label === 'Shopify Management'
      ? entry.items.map((item) => item.to)
      : [],
  ),
)

/** The first Shopify Management page — where an "office" user lands. */
export const SHOPIFY_HOME = '/orders'

/**
 * Every routable link, flattened out of the groups. The AppBar uses the
 * active one's `label` as the page heading.
 */
export const NAV_ITEMS: NavItem[] = NAV_ENTRIES.flatMap((entry) =>
  isNavGroup(entry) ? entry.items : [entry],
)
