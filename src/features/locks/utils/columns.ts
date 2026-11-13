import type { ColumnConfig as BaseColumnConfig } from '../../../lib/columnConfig.ts'

/**
 * The locks table's columns. **Product** (the picture and name, always first) and **Actions**
 * (always last) are fixed; every other column is here, can be shown or hidden and put in any order
 * from the Columns menu (`components/ui/ColumnsMenu.tsx`, the same one the Orders table uses). Only
 * what the lock list answer (`GET /access/locks`) carries is a column.
 */
export const LOCK_COLUMN_IDS = [
  'keys',
  'with_access',
  'hidden_from',
  'status',
  'shopify',
  'updated',
  'handle',
  'product_status',
  'store',
  'manual_locking',
  'hide_from_lists',
  'hide_from_nav',
  'hide_from_sitemap',
  'last_pushed',
] as const

export type LockColumnId = (typeof LOCK_COLUMN_IDS)[number]

export type LockColumnConfig = BaseColumnConfig<LockColumnId>

export interface LockColumnDef {
  id: LockColumnId
  label: string
  /** Width in rem (the table is fixed-layout, so every column has one). */
  width: number
  align: 'left' | 'center'
}

const column = (
  id: LockColumnId,
  label: string,
  width: number,
  align: LockColumnDef['align'] = 'center',
): [LockColumnId, LockColumnDef] => [id, { id, label, width, align }]

export const LOCK_COLUMNS: Record<LockColumnId, LockColumnDef> = Object.fromEntries([
  column('keys', 'Keys (tags)', 14),
  column('with_access', 'With access', 7),
  column('hidden_from', 'Hidden from', 12),
  // The status dropdown and the Shopify pill are the same size (`w-32`), and the status keeps room
  // for the amber "Manual" tag beside it.
  column('status', 'Status', 13),
  column('shopify', 'Shopify', 9),
  column('updated', 'Updated', 8),
  column('handle', 'Handle', 12, 'left'),
  column('product_status', 'Product status', 9),
  column('store', 'Store', 11),
  column('manual_locking', 'Manual locking', 8),
  column('hide_from_lists', 'Hidden from lists', 9),
  column('hide_from_nav', 'Hidden from menus', 9),
  column('hide_from_sitemap', 'Hidden from sitemaps', 9),
  column('last_pushed', 'Last sent to Shopify', 12),
]) as Record<LockColumnId, LockColumnDef>

/** Shown to begin with, in this order: Product, then these, then Actions. */
export const DEFAULT_VISIBLE_LOCK_COLUMNS: LockColumnId[] = [
  'keys',
  'with_access',
  'hidden_from',
  'status',
  'shopify',
  'updated',
]

/** Width of the fixed columns, in rem: Product (its name takes room beyond this) and Actions. */
export const LOCK_PRODUCT_COLUMN_REM = 16
export const LOCK_ACTIONS_COLUMN_REM = 6

/** The columns to draw, in order. */
export function shownLockColumns(config: LockColumnConfig): LockColumnDef[] {
  return config.order
    .filter((id) => config.visible.includes(id))
    .map((id) => LOCK_COLUMNS[id])
}

/** The table's least width in rem: Product, the shown columns and Actions. */
export function lockTableMinWidthRem(columns: LockColumnDef[]): number {
  return (
    LOCK_PRODUCT_COLUMN_REM +
    LOCK_ACTIONS_COLUMN_REM +
    columns.reduce((total, shown) => total + shown.width, 0)
  )
}
